/**
 * A Grid is a meta-template: a sequence of N cells where each cell references
 * a Template (post or carousel). Used as a layout pattern for bulk content
 * generation ("Masivo") and as a visual feed planner.
 */

export type GridSize = 3 | 6 | 9;

export interface GridItem {
  /** 0-based position in the grid (0..size-1). */
  position: number;
  /** Template referenced by this cell. Optional — empty cell allowed during build. */
  templateId?: string;
}

export interface Grid {
  id: string;
  name: string;
  accountId?: string;
  size: GridSize;
  items: GridItem[];
  /** Start date for scheduling this grid's posts (ISO 8601, time optional). */
  scheduledStartAt?: string;
  /** End date for the scheduling range (ISO 8601). If absent, all posts go on scheduledStartAt. */
  scheduledEndAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GridsData {
  grids: Grid[];
}
