import { NextResponse } from "next/server";
import { getNetwork, updateNetwork, deleteNetwork } from "@/lib/networks";

type Params = { params: Promise<{ networkId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { networkId } = await params;
  const network = await getNetwork(networkId);
  if (!network) {
    return NextResponse.json({ error: "Network not found" }, { status: 404 });
  }
  return NextResponse.json(network);
}

export async function PUT(request: Request, { params }: Params) {
  const { networkId } = await params;
  try {
    const body = await request.json();
    const updated = await updateNetwork(networkId, body);
    if (!updated) {
      return NextResponse.json({ error: "Network not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { networkId } = await params;
  const deleted = await deleteNetwork(networkId);
  if (!deleted) {
    return NextResponse.json(
      { error: "Network not found or is a builtin network" },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true });
}
