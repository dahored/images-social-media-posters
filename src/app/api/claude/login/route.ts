import { findClaudePath } from "@/lib/claude-path";
import { claudeLoginSessions } from "@/lib/claude-sessions";
import { spawn } from "child_process";
import { randomUUID } from "crypto";

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

  const sessionId = randomUUID();
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
        claudeLoginSessions.delete(sessionId);
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
      // write() and kill() are set in either the PTY or the pipe branch
      let writeFn: (s: string) => void = () => {};
      let killFn: () => void = () => {};

      // Register the session so submit-code route can write the OAuth code back
      claudeLoginSessions.set(sessionId, (s: string) => writeFn(s));

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

        // After OAuth, Claude asks the user to paste the authorization code back.
        // PTY output: "Pastecodehereifprompted>" (spaces stripped by terminal renderer).
        if (/pastecode|paste.{0,5}code/i.test(trimmed)) {
          send({ type: "needs-code", sessionId });
        }

        // After the user completes OAuth, Claude confirms login.
        // PTY strips spaces → "Loggedin" / "Loggedinas" / "Loginsuccessful"
        if (/logged.{0,5}in|loginsucc|authenticat|signedin/i.test(trimmed)) {
          settle(0);
        }
      };

      const onChunk = (chunk: Buffer | string) => {
        const text = (typeof chunk === "string" ? chunk : chunk.toString()).replace(/\r/g, "");

        // PTY wraps long lines at the terminal width, splitting the OAuth URL across multiple
        // \n characters. Join the full chunk before searching so we capture the complete URL.
        if (!urlSent) {
          const joined = text.replace(/\n/g, "");
          const urlMatch = joined.match(/https:\/\/[^\s"'<>]{80,}/);
          if (urlMatch) { urlSent = true; send({ type: "url", url: urlMatch[0] }); }
        }

        text.split("\n").forEach(onLine);
      };

      try {
        // Dynamic require — a missing native module won't crash the handler
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pty = require("node-pty") as typeof import("node-pty");
        send({ type: "log", text: "Starting Claude CLI (PTY mode)…" });

        const term = pty.spawn(claudePath, [], {
          name: "xterm-color",
          cols: 2000,
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
