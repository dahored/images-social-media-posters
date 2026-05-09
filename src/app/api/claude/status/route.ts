import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { findClaudePath } from "@/lib/claude-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function checkLoggedIn(claudePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(claudePath, ["-p", ".", "--output-format", "text"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stdin?.end();

    let combined = "";
    let settled = false;

    const settle = (loggedIn: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { child.kill("SIGKILL"); } catch { /* already dead */ }
      resolve(loggedIn);
    };

    const onData = (chunk: Buffer) => {
      combined += chunk.toString();
      if (combined.includes("Not logged in")) settle(false);
    };

    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);

    // If 5s pass without "Not logged in", Claude is authenticated
    // (it would be mid-API-call, which we kill)
    const timer = setTimeout(() => settle(true), 5000);

    child.on("close", () => settle(!combined.includes("Not logged in")));
  });
}

export async function GET() {
  const claudePath = findClaudePath();
  if (!claudePath) {
    return NextResponse.json({ available: false, loggedIn: false });
  }
  const loggedIn = await checkLoggedIn(claudePath);
  return NextResponse.json({ available: true, loggedIn });
}
