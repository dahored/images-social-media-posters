import { NextResponse } from "next/server";
import { getGrid } from "@/lib/grids";
import { listTemplates } from "@/lib/templates";
import { parseBulkContent } from "@/lib/bulk-parser";
import { planBulkDistribution } from "@/lib/bulk-planner";

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

    const allTemplates = await listTemplates({ accountId: body.accountId });
    const parsed = parseBulkContent(body.content);
    const preview = planBulkDistribution(grid, allTemplates, parsed);
    return NextResponse.json({ parsed, preview });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid request" },
      { status: 400 }
    );
  }
}
