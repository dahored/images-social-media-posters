import { findClaudePath } from "@/lib/claude-path";
import { spawn } from "child_process";

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

      const keepalive = setInterval(() => {
        try { controller.enqueue(encoder.encode(": keepalive\n\n")); } catch { /* closed */ }
      }, 3000);

      let urlSent = false;
      let settled = false;

      const settle = (exitCode: number) => {
        if (settled) return;
        settled = true;
        clearInterval(keepalive);
        clearTimeout(hardTimeout);
        if (exitCode === 0) {
          send({ type: "done" });
        } else {
          send({ type: "error", message: `Process exited with code ${exitCode}` });
        }
        try { controller.close(); } catch { /* already closed */ }
      };

      let menuAnswered = false;
      let loginSent = false;

      const onLine = (line: string) => {
        const trimmed = line.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "").trim();
        if (!trimmed) return;
        send({ type: "log", text: trimmed });

        // Claude shows a numbered login-method selector when not authenticated.
        // PTY output strips spaces between words → "Selectloginmethod:" instead of "Select login method:".
        // Option 1 is pre-selected (shown by ">"); sending \r confirms it.
        if (!menuAnswered && /login.{0,5}method|1\..*claude.*subscription|1\..*claude.*account/i.test(trimmed)) {
          menuAnswered = true;
          setTimeout(() => {
            send({ type: "log", text: "→ Confirmando opción 1 (Claude subscription)…" });
            writeFn("\r");
          }, 400);
        }

        // After selecting the method, Claude shows the OAuth URL.
        if (!urlSent) {
          const match = trimmed.match(/https:\/\/[^\s"'<>]+/);
          if (match) { urlSent = true; send({ type: "url", url: match[0] }); }
        }

        // After the user completes OAuth, Claude confirms login.
        if (/logged.?in successfully|login complete|authenticated/i.test(trimmed) && urlSent) {
          settle(0);
        }
      };

      const onChunk = (chunk: Buffer | string) => {
        const text = (typeof chunk === "string" ? chunk : chunk.toString()).replace(/\r/g, "");
        text.split("\n").forEach(onLine);
      };

      // write() and kill() are set in either the PTY or the pipe branch
      let writeFn: (s: string) => void = () => {};
      let killFn: () => void = () => {};

      try {
        // Dynamic require — a missing native module won't crash the handler
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pty = require("node-pty") as typeof import("node-pty");
        send({ type: "log", text: "Starting Claude CLI (PTY mode)…" });

        const term = pty.spawn(claudePath, [], {
          name: "xterm-color",
          cols: 120,
          rows: 30,
          env: { ...process.env, BROWSER: "echo" } as Record<string, string>,
        });

        term.onData((data: string) => onChunk(data));
        term.onExit(({ exitCode }: { exitCode: number }) => settle(exitCode));
        writeFn = (s) => term.write(s);
        killFn = () => term.kill();

      } catch (e) {
        send({ type: "log", text: `PTY not available: ${(e as Error).message}` });
        send({ type: "log", text: "Falling back to pipe mode…" });

        const child = spawn(claudePath, [], {
          stdio: ["pipe", "pipe", "pipe"],
          env: { ...process.env, BROWSER: "echo" },
        });
        child.stdout?.on("data", onChunk);
        child.stderr?.on("data", onChunk);
        child.on("close", (code) => settle(code ?? 1));
        writeFn = (s) => child.stdin?.write(s);
        killFn = () => child.kill();
      }

      // Give Claude 4s to display its startup prompt, then send /login
      setTimeout(() => {
        send({ type: "log", text: "Sending /login…" });
        writeFn("/login\r");
      }, 4000);

      const hardTimeout = setTimeout(() => {
        killFn();
        clearInterval(keepalive);
        send({ type: "error", message: "Login timed out (3 min)" });
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
