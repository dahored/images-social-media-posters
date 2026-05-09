import { spawn } from "child_process";
import { getClaudePath, isClaudeAvailable } from "./claude-path";

/**
 * Runs the Claude CLI in single-shot mode (no streaming) with the given prompt
 * and system prompt. Returns the full text output.
 */
export async function runClaudeOnce(
  userPrompt: string,
  systemPrompt: string,
  options?: { maxBudgetUsd?: number; timeoutMs?: number }
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  if (!isClaudeAvailable()) {
    return { ok: false, error: "Claude CLI not found" };
  }
  const claudePath = getClaudePath();

  const args = [
    "-p",
    userPrompt,
    "--output-format",
    "text",
    "--append-system-prompt",
    systemPrompt,
    "--max-budget-usd",
    String(options?.maxBudgetUsd ?? 0.5),
    "--name",
    "bulk-fill",
  ];

  return new Promise((resolve) => {
    const child = spawn(claudePath, args, {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stdin?.end();

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr?.on("data", (chunk: Buffer) => (stderr += chunk.toString()));

    const timeout = setTimeout(() => {
      child.kill();
      resolve({ ok: false, error: `Timeout after ${options?.timeoutMs ?? 120000}ms` });
    }, options?.timeoutMs ?? 120000);

    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve({ ok: true, text: stdout });
      } else {
        resolve({ ok: false, error: stderr.slice(-500) || `Exit code ${code}` });
      }
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      resolve({ ok: false, error: err.message });
    });
  });
}

/**
 * Extracts a JSON object/array from a freeform text response. Looks for the
 * first balanced { ... } or [ ... ] block. Tolerates leading/trailing prose.
 */
export function extractJson(text: string): unknown {
  // Try fenced blocks first
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()); } catch { /* fall through */ }
  }
  // Look for the first { or [
  const startIdx = text.search(/[{[]/);
  if (startIdx === -1) throw new Error("No JSON found in response");
  // Find balanced end via simple counter
  let depth = 0;
  let inString = false;
  let escape = false;
  const open = text[startIdx];
  const close = open === "{" ? "}" : "]";
  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        const json = text.slice(startIdx, i + 1);
        return JSON.parse(json);
      }
    }
  }
  throw new Error("Unbalanced JSON in response");
}
