import { claudeLoginSessions } from "@/lib/claude-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { sessionId, code } = await req.json() as { sessionId?: string; code?: string };

  if (!sessionId || !code) {
    return Response.json({ error: "sessionId and code are required" }, { status: 400 });
  }

  const write = claudeLoginSessions.get(sessionId);
  if (!write) {
    return Response.json({ error: "Session not found or expired" }, { status: 404 });
  }

  write(code.trim() + "\r");
  return Response.json({ ok: true });
}
