import { extractSlots } from "@/lib/slot-extractor";
import type { ParsedContent } from "@/types/bulk";
import type { BulkCellPlan, BulkPreview } from "@/types/bulk";
import type { Grid } from "@/types/grid";
import type { Template } from "@/types/template";

/**
 * Distributes parsed content across grid cells using a strict 1-section-per-cell
 * positional mapping:
 * - The Nth section in the input maps to the Nth filled cell in the grid.
 * - Post cells get 1 item from the section.
 * - Carousel cells get all items from the section.
 *
 * Empty cells (no template) are skipped without consuming a section.
 */
export function planBulkDistribution(
  grid: Grid,
  templates: Template[],
  content: ParsedContent
): BulkPreview {
  const tplById = new Map(templates.map((t) => [t.id, t]));
  const warnings: string[] = [];
  const cells: BulkCellPlan[] = [];

  let sectionIdx = 0;

  for (const cell of grid.items) {
    if (!cell.templateId) continue; // unfilled slot — skip silently

    const tpl = tplById.get(cell.templateId);
    if (!tpl) {
      warnings.push(`Celda ${cell.position + 1}: plantilla no encontrada.`);
      continue;
    }

    const section = content.categories[sectionIdx];
    if (!section || section.items.length === 0) {
      warnings.push(
        `Celda ${cell.position + 1}: sin sección de contenido. Añade un bloque más al input.`
      );
      sectionIdx++;
      continue;
    }
    sectionIdx++;

    const slidesSchema = tpl.slides.map((s) => {
      const { slots } = extractSlots(s.html);
      return {
        slideId: s.id,
        slots: slots.map((slot) => ({
          id: slot.id,
          role: slot.role,
          currentText: slot.text,
          hasAccent: slot.hasAccent,
        })),
      };
    });

    if (tpl.kind === "post") {
      cells.push({
        position: cell.position,
        templateId: tpl.id,
        templateName: tpl.name,
        templateKind: "post",
        slidesSchema,
        contentFragment: { title: section.title || undefined, items: [section.items[0]] },
      });
    } else {
      cells.push({
        position: cell.position,
        templateId: tpl.id,
        templateName: tpl.name,
        templateKind: "carousel",
        slidesSchema,
        contentFragment: { title: section.title || undefined, items: [...section.items] },
      });
    }
  }

  return { cells, warnings };
}
