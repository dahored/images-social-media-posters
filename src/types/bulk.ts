/**
 * Types for the Masivo (bulk) flow: distribute or generate content across N
 * grid cells, each backed by a template.
 */

import type { SlotRole } from "./slot";

export interface ParsedCategory {
  title: string;
  items: string[];
}

export interface ParsedContent {
  /** Untitled top-level lines that aren't bullets — used as preamble or prose. */
  prose: string[];
  /** Categories with their bullets. */
  categories: ParsedCategory[];
  /** Total bullet count across categories. */
  totalItems: number;
}

/** A single planned cell ready to be sent to the AI. */
export interface BulkCellPlan {
  position: number;
  templateId: string;
  templateName: string;
  templateKind: "post" | "carousel";
  /** Slot schema of the template's first slide (for posts) or all slides (for carousels). */
  slidesSchema: Array<{
    slideId: string;
    slots: Array<{ id: string; role: SlotRole; currentText: string; hasAccent: boolean }>;
  }>;
  /** Content fragment assigned to this cell — either a single bullet, a category, or free text. */
  contentFragment: {
    title?: string;
    items: string[];
  };
}

export interface BulkPreview {
  cells: BulkCellPlan[];
  /** Cells that couldn't be planned (no template, or no content assigned). */
  warnings: string[];
}

export interface BulkResult {
  carousels: Array<{ id: string; name: string; templateId: string }>;
  errors: Array<{ position: number; error: string }>;
}
