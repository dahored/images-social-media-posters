import { readDataSafe, writeData } from "./data";
import { generateId, now } from "./utils";
import type { Grid, GridItem, GridSize, GridsData } from "@/types/grid";

const FILE = "grids.json";

async function load(): Promise<GridsData> {
  return readDataSafe<GridsData>(FILE, { grids: [] });
}

async function save(data: GridsData): Promise<void> {
  await writeData(FILE, data);
}

export async function listGrids(filter?: { accountId?: string }): Promise<Grid[]> {
  const data = await load();
  if (!filter?.accountId) return data.grids;
  // Account-scoped + legacy (no accountId) visible to all.
  return data.grids.filter((g) => !g.accountId || g.accountId === filter.accountId);
}

export async function getGrid(id: string): Promise<Grid | null> {
  const data = await load();
  return data.grids.find((g) => g.id === id) ?? null;
}

export async function createGrid(input: {
  name: string;
  size: GridSize;
  accountId?: string;
  items?: GridItem[];
  scheduledStartAt?: string;
  scheduledEndAt?: string;
}): Promise<Grid> {
  const data = await load();
  const items: GridItem[] =
    input.items && input.items.length === input.size
      ? input.items
      : Array.from({ length: input.size }, (_, i) => ({ position: i }));
  const grid: Grid = {
    id: generateId(),
    name: input.name,
    accountId: input.accountId,
    size: input.size,
    items,
    ...(input.scheduledStartAt ? { scheduledStartAt: input.scheduledStartAt } : {}),
    ...(input.scheduledEndAt   ? { scheduledEndAt:   input.scheduledEndAt   } : {}),
    createdAt: now(),
    updatedAt: now(),
  };
  data.grids.push(grid);
  await save(data);
  return grid;
}

export async function updateGrid(
  id: string,
  updates: Partial<Pick<Grid, "name" | "size" | "items" | "scheduledStartAt" | "scheduledEndAt">>
): Promise<Grid | null> {
  const data = await load();
  const idx = data.grids.findIndex((g) => g.id === id);
  if (idx === -1) return null;
  const current = data.grids[idx];

  // If size changes, reshape items array (truncate or extend with empty cells).
  let nextItems = updates.items ?? current.items;
  const nextSize = updates.size ?? current.size;
  if (nextItems.length !== nextSize) {
    nextItems = Array.from({ length: nextSize }, (_, i) => {
      return nextItems[i] ?? { position: i };
    });
  }

  data.grids[idx] = {
    ...current,
    ...updates,
    items: nextItems,
    size: nextSize,
    updatedAt: now(),
  };
  await save(data);
  return data.grids[idx];
}

export async function deleteGrid(id: string): Promise<boolean> {
  const data = await load();
  const idx = data.grids.findIndex((g) => g.id === id);
  if (idx === -1) return false;
  data.grids.splice(idx, 1);
  await save(data);
  return true;
}
