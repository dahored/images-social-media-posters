import { findClaudePath } from "@/lib/claude-path";
import * as pty from "node-pty";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const claudePath = findClaudePath();
  if (!claudePath) {
    return new Response(
      `data: ${JSON.stringify({ type: "error", message: "Claude CLI not found" })}\n\n`,
      { status: 200, headers: sseHeaders() }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch { /* stream closed */ }
      };

      send({ type: "log", text: "Starting Claude CLI with PTY…" });

      // Keepalive to prevent proxy/browser timeouts and force buffer flushing
      const keepalive = setInterval(() => {
        try { controller.enqueue(encoder.encode(": keepalive\n\n")); } catch { /* closed */ }
      }, 3000);

      // Spawn Claude in a PTY so it behaves as if it has a real terminal.
      // Without a PTY, Claude ignores slash commands and never outputs the URL.
      const term = pty.spawn(claudePath, [], {
        name: "xterm-color",
        cols: 120,
        rows: 30,
        env: { ...process.env, BROWSER: "echo" } as Record<string, string>,
      });

      let urlSent = false;

      term.onData((data: string) => {
        // Strip ANSI escape codes for clean log output
        const clean = data.replace(/\x1b\[[0-9;]*[mGKHF]/g, "").replace(/\r/g, "");

        for (const line of clean.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          send({ type: "log", text: trimmed });

          // Detect the OAuth URL
          if (!urlSent) {
            const match = trimmed.match(/https:\/\/[^\s"']+/);
            if (match) {
              urlSent = true;
              send({ type: "url", url: match[0] });
            }
          }

          // Detect successful login
          if (/logged in|login successful|authenticated|welcome/i.test(trimmed)) {
            send({ type: "done" });
            clearTimeout(timeout);
            clearInterval(keepalive);
            term.kill();
            try { controller.close(); } catch { /* already closed */ }
          }
        }
      });

      term.onExit(({ exitCode }: { exitCode: number }) => {
        clearTimeout(timeout);
        clearInterval(keepalive);
        if (exitCode === 0) {
          send({ type: "done" });
        } else {
          send({ type: "error", message: `Process exited with code ${exitCode}` });
        }
        try { controller.close(); } catch { /* already closed */ }
      });

      // Send /login after 3s — enough for Claude to show its startup prompt
      const loginTimer = setTimeout(() => {
        send({ type: "log", text: "Sending /login…" });
        term.write("/login\r");
      }, 3000);

      // 3-minute hard timeout
      const timeout = setTimeout(() => {
        clearInterval(keepalive);
        clearTimeout(loginTimer);
        term.kill();
        send({ type: "error", message: "Login timed out after 3 minutes" });
        try { controller.close(); } catch { /* already closed */ }
      }, 180_000);
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}

function sseHeaders() {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  };
}
