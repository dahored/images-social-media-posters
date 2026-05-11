/**
 * Semantic role slots derived from `slide-*` classes.
 * Used by the slot-extractor to read template structure and by the slot-filler
 * to inject new content while preserving styles/layout.
 */

export type SlotRole =
  | "title"
  | "subtitle"
  | "body"
  | "quote"
  | "list-item"
  | "section-title"
  | "section-body"
  | "cta";

export interface SlideSlot {
  /** Unique within a slide. Stable across extract/fill cycles for the same HTML. */
  id: string;
  role: SlotRole;
  /** Current text content of the slot (whitespace-collapsed). */
  text: string;
  /** True if the element itself (or its only meaningful child) carries class="slide-accent". */
  hasAccent: boolean;
  /** Text content of the accent span, if present. Used to calculate accent position ratio. */
  accentText?: string;
  /** Order in document. */
  order: number;
  /** id of the parent slot if this slot is nested inside a slide-section-* element. */
  parentSectionId?: string;
  /** Leading emoji character(s) + trailing space that act as a visual marker (e.g. "💔 "). Preserved across slot fills. */
  emojiPrefix?: string;
}

export interface SlotSchema {
  slots: SlideSlot[];
}

/** Map of slotId → new text content. */
export type SlotFills = Record<string, string>;
