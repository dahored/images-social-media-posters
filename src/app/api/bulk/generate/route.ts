import { NextResponse } from "next/server";
import { getGrid } from "@/lib/grids";
import { getTemplate, listTemplates } from "@/lib/templates";
import { parseBulkContent } from "@/lib/bulk-parser";
import { planBulkDistribution } from "@/lib/bulk-planner";
import { runClaudeOnce, extractJson } from "@/lib/claude-runner";
import { fillSlots } from "@/lib/slot-extractor";
import { createCarousel, addSlide, updateCarousel, getCarousel } from "@/lib/carousels";
import type { BulkCellPlan, BulkResult } from "@/types/bulk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

/**
 * Build the per-cell prompt: tell the AI exactly what slots exist and what content
 * fragment to distribute, ask for a strict JSON response.
 */
function buildCellPrompt(plan: BulkCellPlan): { system: string; user: string } {
  const system = `You are a content distributor for social-media slide templates.

Your ONLY job is to return a JSON object that fills the given semantic slots
with the user-provided content fragment. NEVER write HTML. NEVER add new keys
beyond the slots provided.

## ⚠️ CRITICAL — currentText is structural reference only

The "currentText" shown for each slot is the TEMPLATE'S ORIGINAL EXAMPLE CONTENT.
It tells you the TYPE and LENGTH of content that fits there — NOT what the new content should say.

REPLACE all slot text 100% with fresh content from the content fragment provided.
Do NOT imitate, adapt, or theme-match the original currentText in any way.
Use ONLY the slot role (title, body, cta…) and the content fragment to decide what to write.

Slot roles:
- slide-title: main headline
- slide-subtitle: secondary heading / kicker
- slide-body: paragraph / description
- slide-quote: standalone quoted phrase
- slide-list-item: bullet item in a list
- slide-section-title: title of a sub-card
- slide-section-body: body of a sub-card
- slide-cta: call-to-action

If the fragment has more items than list-item slots, pick the strongest items.
If fewer, leave extra list-item slots with a short placeholder that fits (don't invent unrelated content).
For accent emphasis inside a slot, wrap the emphasized phrase in {{accent}}...{{/accent}} markers.

OUTPUT FORMAT — return ONLY this JSON, no prose:
{
  "slides": [
    { "slideId": "<slide id>", "fills": { "<slot id>": "<new text>", ... } }
  ]
}`;

  const fragment = plan.contentFragment;
  const slidesJson = JSON.stringify(plan.slidesSchema, null, 2);

  const user = `Template: "${plan.templateName}" (${plan.templateKind})

Slot schema (preserve every slideId / slot.id exactly as given):
${slidesJson}

Content fragment to distribute:
${fragment.title ? `Category: "${fragment.title}"\n` : ""}Items:
${fragment.items.map((it) => `- ${it}`).join("\n")}

Return the JSON now.`;

  return { system, user };
}

/** Distribute N dates evenly across [start, end] inclusive. If no end, all dates = start. */
function distributeScheduleDates(n: number, startAt: string, endAt?: string): string[] {
  const start = new Date(startAt + (startAt.length === 10 ? "T12:00" : ""));
  if (!endAt) return Array(n).fill(startAt);
  const end = new Date(endAt + "T12:00");
  const totalDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return Array.from({ length: n }, (_, i) => {
    const dayIndex = Math.floor((i * totalDays) / n);
    const d = new Date(start);
    d.setDate(start.getDate() + dayIndex);
    return d.toISOString().slice(0, 10);
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      gridId?: string;
      content?: string;
      accountId?: string;
    };
    if (!body.gridId || typeof body.content !== "string") {
      return NextResponse.json({ error: "gridId and content required" }, { status: 400 });
    }
    const grid = await getGrid(body.gridId);
    if (!grid) return NextResponse.json({ error: "Grid not found" }, { status: 404 });

    const accountId = body.accountId ?? grid.accountId;
    const allTemplates = await listTemplates({ accountId });
    const parsed = parseBulkContent(body.content);
    const preview = planBulkDistribution(grid, allTemplates, parsed);

    const result: BulkResult = { carousels: [], errors: [] };

    // Pre-compute scheduled dates for each cell position (if grid has dates)
    const cellCount = preview.cells.length;
    const scheduledDates: string[] | null = grid.scheduledStartAt && cellCount > 0
      ? distributeScheduleDates(cellCount, grid.scheduledStartAt, grid.scheduledEndAt)
      : null;

    for (const cell of preview.cells) {
      const tpl = await getTemplate(cell.templateId);
      if (!tpl) {
        result.errors.push({ position: cell.position, error: "Template not found at generate time" });
        continue;
      }

      const { system, user } = buildCellPrompt(cell);
      const ai = await runClaudeOnce(user, system, { maxBudgetUsd: 0.3, timeoutMs: 120000 });
      if (!ai.ok) {
        result.errors.push({ position: cell.position, error: `AI: ${ai.error}` });
        continue;
      }

      let parsedJson: { slides?: Array<{ slideId: string; fills: Record<string, string> }> };
      try {
        parsedJson = extractJson(ai.text) as typeof parsedJson;
      } catch (err) {
        result.errors.push({
          position: cell.position,
          error: `JSON parse: ${err instanceof Error ? err.message : "?"}`,
        });
        continue;
      }
      if (!parsedJson?.slides || !Array.isArray(parsedJson.slides)) {
        result.errors.push({ position: cell.position, error: "AI response missing slides[]" });
        continue;
      }

      // Apply fills slide-by-slide
      const fillsBySlideId = new Map(parsedJson.slides.map((s) => [s.slideId, s.fills]));
      const carousel = await createCarousel(
        `${tpl.name} — ${cell.contentFragment.title || "Bulk"}`.slice(0, 80),
        tpl.aspectRatio,
        tpl.kind ?? "carousel",
        undefined,
        accountId,
      );
      for (const slide of tpl.slides) {
        const fills = fillsBySlideId.get(slide.id) ?? {};
        const filledHtml = fillSlots(slide.html, fills);
        await addSlide(carousel.id, filledHtml, slide.notes);
      }
      // Stamp template lineage + lock + grid origin + scheduled date
      const cellIndex = preview.cells.indexOf(cell);
      const scheduledAt = scheduledDates ? scheduledDates[cellIndex] : undefined;
      await updateCarousel(carousel.id, {
        templateId: tpl.id,
        templateLocked: true,
        sourceGridId: body.gridId,
        ...(scheduledAt ? { scheduledAt } : {}),
      });
      const final = await getCarousel(carousel.id);
      if (final) result.carousels.push({ id: final.id, name: final.name, templateId: tpl.id });
    }

    return NextResponse.json({ result, warnings: preview.warnings });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid request" },
      { status: 500 }
    );
  }
}
