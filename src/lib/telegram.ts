import { getConfig } from "./config";

async function apiUrl(token: string, method: string) {
  return `https://api.telegram.org/bot${token}/${method}`;
}

export async function getToken(): Promise<string | null> {
  const config = await getConfig();
  return config.telegram?.botToken || process.env.TELEGRAM_BOT_TOKEN || null;
}

export async function getDefaultChatId(): Promise<string | null> {
  const config = await getConfig();
  return config.telegram?.defaultChatId || process.env.TELEGRAM_DEFAULT_CHAT_ID || null;
}

export async function isTelegramConfigured(): Promise<boolean> {
  const token = await getToken();
  return token !== null && token.trim() !== "";
}

export async function testConnection(token: string): Promise<{ ok: boolean; username?: string; error?: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json() as { ok: boolean; result?: { username?: string }; description?: string };
    if (data.ok) {
      return { ok: true, username: data.result?.username };
    }
    return { ok: false, error: data.description || "Invalid token" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

export async function sendTextMessage(chatId: string, text: string): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  const token = await getToken();
  if (!token) return { ok: false, error: "Telegram not configured" };

  try {
    const res = await fetch(await apiUrl(token, "sendMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    const data = await res.json() as { ok: boolean; result?: { message_id?: number }; description?: string };
    if (data.ok) return { ok: true, messageId: data.result?.message_id };
    return { ok: false, error: data.description };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

export async function sendPhoto(
  chatId: string,
  imageBuffer: Buffer,
  caption?: string
): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  const token = await getToken();
  if (!token) return { ok: false, error: "Telegram not configured" };

  try {
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("photo", new Blob([new Uint8Array(imageBuffer)], { type: "image/png" }), "slide.png");
    if (caption) form.append("caption", caption.slice(0, 1024));

    const res = await fetch(await apiUrl(token, "sendPhoto"), { method: "POST", body: form });
    const data = await res.json() as { ok: boolean; result?: { message_id?: number }; description?: string };
    if (data.ok) return { ok: true, messageId: data.result?.message_id };
    return { ok: false, error: data.description };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

export async function sendMediaGroup(
  chatId: string,
  imageBuffers: Buffer[],
  caption?: string
): Promise<{ ok: boolean; error?: string }> {
  const token = await getToken();
  if (!token) return { ok: false, error: "Telegram not configured" };

  if (imageBuffers.length === 0) return { ok: false, error: "No images" };
  // Single photo: use sendPhoto
  if (imageBuffers.length === 1) {
    const result = await sendPhoto(chatId, imageBuffers[0], caption);
    return { ok: result.ok, error: result.error };
  }

  try {
    const form = new FormData();
    form.append("chat_id", chatId);

    const media = imageBuffers.map((_, i) => ({
      type: "photo",
      media: `attach://slide${i}`,
      ...(i === 0 && caption ? { caption: caption.slice(0, 1024) } : {}),
    }));
    form.append("media", JSON.stringify(media));

    imageBuffers.forEach((buf, i) => {
      form.append(`slide${i}`, new Blob([new Uint8Array(buf)], { type: "image/png" }), `slide${i}.png`);
    });

    const res = await fetch(await apiUrl(token, "sendMediaGroup"), { method: "POST", body: form });
    const data = await res.json() as { ok: boolean; description?: string };
    if (data.ok) return { ok: true };
    return { ok: false, error: data.description };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

export function buildCaption(caption?: string, hashtags?: string[]): string {
  const parts: string[] = [];
  if (caption) parts.push(caption);
  if (hashtags && hashtags.length > 0) {
    parts.push(hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" "));
  }
  // parts.push("🎨 via images-social-media-posters");
  return parts.join("\n\n");
}
