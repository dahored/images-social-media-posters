import { NextResponse } from "next/server";
import { listAccounts, createAccount } from "@/lib/accounts";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const brandId = searchParams.get("brandId") || undefined;
  const accounts = await listAccounts(brandId);
  return NextResponse.json({ accounts });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { brandId, networkId, handle, displayName, brandingOverride, telegramChatId } =
      body as Record<string, unknown>;

    if (!brandId || typeof brandId !== "string") {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }
    if (!networkId || typeof networkId !== "string") {
      return NextResponse.json({ error: "networkId is required" }, { status: 400 });
    }
    if (!displayName || typeof displayName !== "string") {
      return NextResponse.json({ error: "displayName is required" }, { status: 400 });
    }

    const account = await createAccount({
      brandId: brandId as string,
      networkId: networkId as string,
      handle: (handle as string) || "",
      displayName: (displayName as string).trim(),
      ...(brandingOverride ? { brandingOverride: brandingOverride as never } : {}),
      ...(telegramChatId ? { telegramChatId: telegramChatId as string } : {}),
    });

    return NextResponse.json(account, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
