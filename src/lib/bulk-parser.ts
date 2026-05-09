import type { ParsedContent, ParsedCategory } from "@/types/bulk";

/**
 * Heuristic parser for bulk content input. Detects two structures:
 *
 * 1. Markdown-ish with headings:
 *    "Category title"
 *    "- item 1"
 *    "- item 2"
 *
 * 2. Bare list of phrases (no headings) — treated as a single anonymous category.
 *
 * Headings are recognized as:
 *  - Lines starting with #, ##, ### (markdown)
 *  - Lines that don't start with a bullet/number AND end without sentence punctuation,
 *    AND are followed by at least one bullet line.
 */

const BULLET_RE = /^\s*([-*•·–]|\d+[.)])\s+(.+)$/;
const HEADING_RE = /^#{1,6}\s+(.+)$/;
const QUOTE_RE = /^[\s]*["“]([^"”]+)["”]/;

function isLikelyBullet(line: string): boolean {
  return BULLET_RE.test(line) || QUOTE_RE.test(line);
}

function stripBulletPrefix(line: string): string {
  const m = line.match(BULLET_RE);
  if (m) return m[2].trim();
  return line.trim();
}

function looksLikeHeading(line: string, nextLine?: string): boolean {
  if (!line.trim()) return false;
  if (HEADING_RE.test(line)) return true;
  if (isLikelyBullet(line)) return false;

  // Heuristic: short line, no terminal punctuation (. ! ?), and the next non-empty line is a bullet
  const trimmed = line.trim();
  const tooLong = trimmed.length > 80;
  if (tooLong) return false;
  const endsWithSentence = /[.!?…]$/.test(trimmed);
  if (endsWithSentence) return false;
  if (nextLine && isLikelyBullet(nextLine)) return true;
  // Fallback: ALL CAPS short line
  if (/^[A-ZÁÉÍÓÚÑ\s\d&,'-]{3,}$/.test(trimmed)) return true;
  return false;
}

function stripHeadingPrefix(line: string): string {
  const m = line.match(HEADING_RE);
  if (m) return m[1].trim();
  return line.trim();
}

export function parseBulkContent(raw: string): ParsedContent {
  const lines = raw.split(/\r?\n/);
  const prose: string[] = [];
  const categories: ParsedCategory[] = [];
  let current: ParsedCategory | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Look ahead to find the next non-empty line for heading detection
    let nextNonEmpty: string | undefined;
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim()) { nextNonEmpty = lines[j]; break; }
    }

    if (looksLikeHeading(line, nextNonEmpty)) {
      current = { title: stripHeadingPrefix(line), items: [] };
      categories.push(current);
      continue;
    }

    if (isLikelyBullet(line)) {
      const text = stripBulletPrefix(line);
      if (current) {
        current.items.push(text);
      } else {
        // Bullets without a heading → put under "Sin categoría"
        current = { title: "", items: [text] };
        categories.push(current);
      }
      continue;
    }

    // Quoted phrase or plain line — treat as a bullet under current category if present, else prose
    if (current) {
      current.items.push(line.trim());
    } else {
      // Could be prose (intro) — but if the very next thing is bullets, this could also be a heading
      // We already checked heading. Treat as prose.
      prose.push(line.trim());
    }
  }

  // If we have prose lines but no categories, treat each prose line as an item under an anonymous category
  if (categories.length === 0 && prose.length > 0) {
    return {
      prose: [],
      categories: [{ title: "", items: prose }],
      totalItems: prose.length,
    };
  }

  // Strip empty categories
  const cleaned = categories.filter((c) => c.items.length > 0);
  const totalItems = cleaned.reduce((s, c) => s + c.items.length, 0);
  return { prose, categories: cleaned, totalItems };
}
