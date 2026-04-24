import { NextResponse } from "next/server";
import { getBrand, updateBrand, deleteBrand } from "@/lib/brands";
import { listAccounts } from "@/lib/accounts";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { brandId } = await params;
  const brand = await getBrand(brandId);
  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }
  const accounts = await listAccounts(brandId);
  return NextResponse.json({ ...brand, accounts });
}

export async function PUT(request: Request, { params }: Params) {
  const { brandId } = await params;
  try {
    const body = await request.json();
    const updated = await updateBrand(brandId, body);
    if (!updated) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { brandId } = await params;
  const deleted = await deleteBrand(brandId);
  if (!deleted) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
