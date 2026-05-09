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

      // Launch claude in interactive mode (no args) then pipe /login as the
      // first command. BROWSER=echo makes it print the OAuth URL to stdout
      // instead of trying to open a browser (which fails in Docker).
      const child = spawn(claudePath, [], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, BROWSER: "echo" },
      });

      // Wait briefly for the REPL to initialise before sending /login
      setTimeout(() => { child.stdin?.write("/login\n"); }, 1500);

      const onOutput = (chunk: Buffer) => {
        const text = chunk.toString();

        for (const line of text.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          send({ type: "log", text: trimmed });

          // Detect the OAuth URL (claude login prints it when it can't open a browser)
          const match = trimmed.match(/https:\/\/[^\s"']+/);
          if (match) {
            send({ type: "url", url: match[0] });
          }
        }
      };

      child.stdout?.on("data", onOutput);
      child.stderr?.on("data", onOutput);

      // 3-minute timeout — more than enough for the user to complete OAuth
      const timeout = setTimeout(() => {
        child.kill();
        send({ type: "error", message: "Login timed out after 3 minutes" });
        controller.close();
      }, 180_000);

      child.on("close", (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          send({ type: "done" });
        } else {
          send({ type: "error", message: `Login process exited with code ${code}` });
        }
        try { controller.close(); } catch { /* already closed */ }
      });

      child.on("error", (err) => {
        clearTimeout(timeout);
        send({ type: "error", message: err.message });
        try { controller.close(); } catch { /* already closed */ }
      });
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
