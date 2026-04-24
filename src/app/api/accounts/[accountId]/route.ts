import { NextResponse } from "next/server";
import { getAccount, updateAccount, deleteAccount, duplicateAccount, getEffectiveBranding } from "@/lib/accounts";

type Params = { params: Promise<{ accountId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { accountId } = await params;
  const account = await getAccount(accountId);
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  const effectiveBranding = await getEffectiveBranding(accountId);
  return NextResponse.json({ ...account, effectiveBranding });
}

export async function PUT(request: Request, { params }: Params) {
  const { accountId } = await params;
  try {
    const body = await request.json();
    const updated = await updateAccount(accountId, body);
    if (!updated) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { accountId } = await params;
  const deleted = await deleteAccount(accountId);
  if (!deleted) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request, { params }: Params) {
  const { accountId } = await params;
  const { searchParams } = new URL(request.url);
  if (searchParams.get("action") === "duplicate") {
    const duplicate = await duplicateAccount(accountId);
    if (!duplicate) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    return NextResponse.json(duplicate, { status: 201 });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
