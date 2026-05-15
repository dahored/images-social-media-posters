import { getGrid } from "@/lib/grids";
import { getTemplate, listTemplates } from "@/lib/templates";
import { parseBulkContent } from "@/lib/bulk-parser";
import { planBulkDistribution } from "@/lib/bulk-planner";
import { runClaudeOnce, extractJson } from "@/lib/claude-runner";
import { fillSlots, extractSlots } from "@/lib/slot-extractor";
import { detectSlideRootBackground } from "@/lib/slide-html";
import { createCarousel, addSlide, updateCarousel, getCarousel } from "@/lib/carousels";
import { getEffectiveBranding } from "@/lib/accounts";
import type { BulkCellPlan } from "@/types/bulk";
import type { EffectiveBranding } from "@/types/account";
import type { CarouselBrandingOverride } from "@/types/carousel";

function detectThemeFromHtml(html: string | undefined): "default" | "light" {
  const bg = detectSlideRootBackground(html ?? "");
  if (!bg) return "default";
  const r = parseInt(bg.slice(1, 3), 16);
  const g = parseInt(bg.slice(3, 5), 16);
  const b = parseInt(bg.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 128 ? "light" : "default";
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

function buildCellPrompt(
  plan: BulkCellPlan,
  branding: EffectiveBranding | null
): { system: string; user: string } {
  const brandContext = branding
    ? `
## Brand context
- Brand: ${branding.name}
- Accent color: ${branding.colors.accent}
- Style: ${branding.styleKeywords?.join(", ") || "professional, engaging"}
- Voice: write in the brand's voice — casual or formal depending on the style keywords above.
`
    : "";

  const system = `You are a content writer for social-media slide templates.

Your ONLY job is to return a JSON object that fills the given semantic slots
with the user-provided content fragment. NEVER write HTML. NEVER add new keys
beyond the slots provided.
${brandContext}
## ⚠️ CRITICAL — currentText is structural reference only

The "currentText" shown for each slot is the TEMPLATE'S ORIGINAL EXAMPLE CONTENT.
It tells you the TYPE and LENGTH of content that fits there — NOT what the new content should say.

REPLACE all slot text 100% with fresh content from the content fragment provided.
Do NOT imitate, adapt, or theme-match the original currentText in any way.
Use ONLY the slot role (title, body, cta…) and the content fragment to decide what to write.

## ⚠️ NEVER use real dates, times, or system context

Do NOT use the current date, current time, or any real-world timestamp in any slot.
Even if a slot's currentText looks like a time (e.g. "03:47") or a date, treat it as
a placeholder for TEXT content, not a literal time/date to fill in.
Ignore any date/time information you may have in your context.

Slot roles:
- slide-title: main headline — punchy, direct, on-brand
- slide-subtitle: secondary heading / kicker
- slide-body: paragraph / description
- slide-quote: standalone quoted phrase
- slide-list-item: bullet item in a list
- slide-section-title: title of a sub-card
- slide-section-body: body of a sub-card
- slide-cta: call-to-action

Match the LANGUAGE of the content fragment (if content is in Spanish, write in Spanish).
If the fragment has more items than list-item slots, pick the strongest items.
If fewer, leave extra list-item slots with a short placeholder that fits.

## Accent emphasis
When a slot's "hasAccent" is true, the template has an accent-colored span ready to use.
Wrap ONE word or short phrase in {{accent}}...{{/accent}} — pick whatever deserves to stand out: a striking word, a key concept, a stat, a strong verb, or the emotional peak of the sentence.
Examples: "{{accent}}3x más{{/accent}} clientes", "el secreto es {{accent}}la consistencia{{/accent}}", "empieza {{accent}}hoy{{/accent}}".
If "hasAccent" is false for a slot, do NOT include the markers.

## Content quality
Every fill must make sense on its own for the reader — clear, direct, and relevant to the content fragment. Never write filler, nonsensical placeholders, or content disconnected from the topic.

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

export async function POST(request: Request) {
  const enc = new TextEncoder();

  const send = (
    controller: ReadableStreamDefaultController,
    event: string,
    data: unknown
  ) => {
    controller.enqueue(
      enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    );
  };

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const body = (await request.json()) as {
          gridId?: string;
          content?: string;
          accountId?: string;
          positions?: number[];
        };

        const bulkRunId = crypto.randomUUID();

        if (!body.gridId || typeof body.content !== "string") {
          send(controller, "error", { message: "gridId and content required" });
          controller.close();
          return;
        }

        const grid = await getGrid(body.gridId);
        if (!grid) {
          send(controller, "error", { message: "Grid not found" });
          controller.close();
          return;
        }

        const accountId = body.accountId ?? grid.accountId;
        const [allTemplates, branding] = await Promise.all([
          listTemplates({ accountId }),
          accountId ? getEffectiveBranding(accountId) : Promise.resolve(null),
        ]);
        const parsed = parseBulkContent(body.content);
        const preview = planBulkDistribution(grid, allTemplates, parsed);

        const isRetry = body.positions && body.positions.length > 0;
        const cellsToProcess = isRetry
          ? preview.cells.filter((c) => body.positions!.includes(c.position))
          : preview.cells;

        // Only send plan on full generation (not retries — client manages its own state)
        if (!isRetry) {
          send(controller, "plan", {
            bulkRunId,
            cells: preview.cells.map((c) => ({
              position: c.position,
              templateName: c.templateName,
              templateKind: c.templateKind,
            })),
            warnings: preview.warnings,
          });
        }

        const carousels: Array<{ id: string; name: string; templateId: string }> = [];
        const errors: Array<{ position: number; error: string }> = [];

        for (const cell of cellsToProcess) {
          send(controller, "progress", {
            position: cell.position,
            status: "generating",
          });

          const tpl = await getTemplate(cell.templateId);
          if (!tpl) {
            const err = "Template not found at generate time";
            errors.push({ position: cell.position, error: err });
            send(controller, "progress", { position: cell.position, status: "error", error: err });
            continue;
          }

          const { system, user } = buildCellPrompt(cell, branding);
          const ai = await runClaudeOnce(user, system, { maxBudgetUsd: 0.3, timeoutMs: 120000 });
          if (!ai.ok) {
            const err = `AI: ${ai.error}`;
            errors.push({ position: cell.position, error: err });
            send(controller, "progress", { position: cell.position, status: "error", error: err });
            continue;
          }

          let parsedJson: { slides?: Array<{ slideId: string; fills: Record<string, string> }> };
          try {
            parsedJson = extractJson(ai.text) as typeof parsedJson;
          } catch (e) {
            const err = `JSON parse: ${e instanceof Error ? e.message : "?"}`;
            errors.push({ position: cell.position, error: err });
            send(controller, "progress", { position: cell.position, status: "error", error: err });
            continue;
          }

          if (!parsedJson?.slides || !Array.isArray(parsedJson.slides)) {
            const err = "AI response missing slides[]";
            errors.push({ position: cell.position, error: err });
            send(controller, "progress", { position: cell.position, status: "error", error: err });
            continue;
          }

          const fillsBySlideId = new Map(parsedJson.slides.map((s) => [s.slideId, s.fills]));

          // Use the AI-generated title slot as the carousel name, falling back to content fragment
          let carouselName = cell.contentFragment.items[0] || cell.contentFragment.title || tpl.name;
          for (const slideFill of parsedJson.slides) {
            const schema = cell.slidesSchema.find((s) => s.slideId === slideFill.slideId);
            if (schema) {
              const titleSlot = schema.slots.find((s) => s.role === "title");
              if (titleSlot && slideFill.fills[titleSlot.id]) {
                carouselName = slideFill.fills[titleSlot.id]
                  .replace(/\{\{accent\}\}|\{\{\/accent\}\}/g, "")
                  .trim();
                break;
              }
            }
          }

          // Ensure the generated carousel always has a brandingOverride with the correct theme.
          // If the template already has one (saved after our fix), use it as-is.
          // Otherwise detect the theme from the first slide's HTML background brightness.
          const brandingOverride: CarouselBrandingOverride = tpl.brandingOverride ?? {
            theme: detectThemeFromHtml(tpl.slides[0]?.html),
          };
          const carousel = await createCarousel(
            carouselName.slice(0, 80),
            tpl.aspectRatio,
            tpl.kind ?? "carousel",
            undefined,
            accountId,
            brandingOverride
          );
          for (const slide of tpl.slides) {
            const fills = fillsBySlideId.get(slide.id) ?? {};
            // Re-apply emoji prefixes from the template slots — they act as visual markers
            // (e.g. "💔 " before a list item) but the AI replaces them with plain text.
            const { slots: templateSlots } = extractSlots(slide.html);
            const fillsWithEmoji: Record<string, string> = {};
            for (const [slotId, text] of Object.entries(fills)) {
              const slot = templateSlots.find((s) => s.id === slotId);
              fillsWithEmoji[slotId] = slot?.emojiPrefix ? slot.emojiPrefix + text : text;
            }
            const filledHtml = fillSlots(slide.html, fillsWithEmoji);
            // Copy styleOverride from the template slide (preserves per-slide theme, logo, colors)
            await addSlide(carousel.id, filledHtml, slide.notes, slide.styleOverride);
          }
          await updateCarousel(carousel.id, {
            templateId: tpl.id,
            templateLocked: true,
            sourceGridId: body.gridId,
            bulkRunId,
          });
          const final = await getCarousel(carousel.id);
          if (final) {
            const item = { id: final.id, name: final.name, templateId: tpl.id };
            carousels.push(item);
            send(controller, "progress", {
              position: cell.position,
              status: "done",
              carousel: item,
            });
          }
        }

        send(controller, "complete", { result: { carousels, errors }, warnings: preview.warnings });
      } catch (err) {
        send(controller, "error", {
          message: err instanceof Error ? err.message : "Unknown error",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
