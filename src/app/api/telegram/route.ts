import { NextResponse } from "next/server";
import { getConfig, updateConfig } from "@/lib/config";
import { isTelegramConfigured, testConnection, sendTextMessage, getDefaultChatId } from "@/lib/telegram";
import { getAccount } from "@/lib/accounts";

export async function GET() {
  const config = await getConfig();
  const configured = await isTelegramConfigured();
  return NextResponse.json({
    configured,
    botToken: config.telegram?.botToken ? "***" : "",
    defaultChatId: config.telegram?.defaultChatId || "",
  });
}

export async function PUT(request: Request) {
  try {
    const body = await request.json() as { botToken?: string; defaultChatId?: string };
    const { botToken, defaultChatId } = body;

    await updateConfig({
      telegram: {
        botToken: botToken || "",
        defaultChatId: defaultChatId || "",
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("action") === "test") {
    try {
      const body = await request.json() as { botToken?: string };
      if (!body.botToken) {
        return NextResponse.json({ ok: false, error: "No token provided" }, { status: 400 });
      }
      const result = await testConnection(body.botToken);
      return NextResponse.json(result);
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
    }
  }
  if (searchParams.get("action") === "message") {
    try {
      const body = await request.json() as { text: string; accountId?: string; chatId?: string };
      let chatId = body.chatId;
      if (!chatId && body.accountId) {
        const account = await getAccount(body.accountId);
        chatId = account?.telegramChatId ?? undefined;
      }
      if (!chatId) chatId = await getDefaultChatId() ?? undefined;
      if (!chatId) return NextResponse.json({ error: "No chat ID configured" }, { status: 400 });
      const result = await sendTextMessage(chatId, body.text);
      return NextResponse.json(result);
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
