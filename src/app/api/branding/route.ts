import { NextResponse } from "next/server";
import { getEffectiveBranding } from "@/lib/accounts";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");

  if (!accountId) {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }

  const branding = await getEffectiveBranding(accountId);
  if (!branding) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  return NextResponse.json(branding);
}
