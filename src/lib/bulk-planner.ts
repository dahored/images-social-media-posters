import { extractSlots } from "@/lib/slot-extractor";
import type { ParsedContent } from "@/types/bulk";
import type { BulkCellPlan, BulkPreview } from "@/types/bulk";
import type { Grid } from "@/types/grid";
import type { Template } from "@/types/template";

/**
 * Distributes parsed content across grid cells:
 * - `post` cells get one item each (drawn from the next available item in any category, in order).
 * - `carousel` cells get a whole category (title + items).
 *
 * Greedy strategy: walks cells in order. Posts consume one item; carousels consume one category.
 * If content runs out, remaining cells get a warning and are skipped from generation.
 */
export function planBulkDistribution(
  grid: Grid,
  templates: Template[],
  content: ParsedContent
): BulkPreview {
  const tplById = new Map(templates.map((t) => [t.id, t]));
  const warnings: string[] = [];
  const cells: BulkCellPlan[] = [];

  // Flatten content into two consumable queues:
  // - itemQueue: every individual bullet, with its parent category title (for context)
  // - categoryQueue: full categories (for carousels)
  const categoryQueue = content.categories.map((c) => ({ title: c.title, items: [...c.items] }));
  const itemQueue: Array<{ title: string; text: string }> = [];
  for (const c of content.categories) {
    for (const item of c.items) itemQueue.push({ title: c.title, text: item });
  }

  for (const cell of grid.items) {
    if (!cell.templateId) {
      warnings.push(`Cell ${cell.position + 1} has no template assigned.`);
      continue;
    }
    const tpl = tplById.get(cell.templateId);
    if (!tpl) {
      warnings.push(`Cell ${cell.position + 1} references missing template ${cell.templateId}.`);
      continue;
    }

    const slidesSchema = tpl.slides.map((s) => {
      const { slots } = extractSlots(s.html);
      return {
        slideId: s.id,
        slots: slots.map((slot) => ({
          id: slot.id,
          role: slot.role,
          currentText: slot.text,
        })),
      };
    });

    if (tpl.kind === "post") {
      const next = itemQueue.shift();
      if (!next) {
        warnings.push(`Cell ${cell.position + 1} (post) — out of content items.`);
        continue;
      }
      cells.push({
        position: cell.position,
        templateId: tpl.id,
        templateName: tpl.name,
        templateKind: "post",
        slidesSchema,
        contentFragment: { title: next.title || undefined, items: [next.text] },
      });
      // Remove this item from the parent category queue too (so a subsequent carousel doesn't reuse it)
      const cat = categoryQueue.find((c) => c.title === next.title);
      if (cat) {
        const idx = cat.items.indexOf(next.text);
        if (idx >= 0) cat.items.splice(idx, 1);
      }
    } else {
      // carousel — find the next category with content
      let cat = categoryQueue.find((c) => c.items.length > 0);
      if (!cat) {
        warnings.push(`Cell ${cell.position + 1} (carousel) — out of content categories.`);
        continue;
      }
      cells.push({
        position: cell.position,
        templateId: tpl.id,
        templateName: tpl.name,
        templateKind: "carousel",
        slidesSchema,
        contentFragment: { title: cat.title || undefined, items: [...cat.items] },
      });
      // Mark the category as consumed
      cat.items = [];
      // Also drain items from the post queue that came from this category
      for (let i = itemQueue.length - 1; i >= 0; i--) {
        if (itemQueue[i].title === cat.title) itemQueue.splice(i, 1);
      }
    }
  }

  return { cells, warnings };
}
