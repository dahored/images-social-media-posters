import { NextResponse } from "next/server";
import { listGrids, createGrid } from "@/lib/grids";
import type { GridSize } from "@/types/grid";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const accountId = url.searchParams.get("accountId") ?? undefined;
  const grids = await listGrids({ accountId });
  return NextResponse.json({ grids });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      name?: string;
      size?: number;
      accountId?: string;
      items?: Array<{ position: number; templateId?: string }>;
    };
    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }
    if (body.size !== 3 && body.size !== 6 && body.size !== 9) {
      return NextResponse.json({ error: "size must be 3, 6, or 9" }, { status: 400 });
    }
    const grid = await createGrid({
      name: body.name,
      size: body.size as GridSize,
      accountId: body.accountId,
      items: body.items,
    });
    return NextResponse.json(grid, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
