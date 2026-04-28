import type { AspectRatio } from "@/types/carousel";
import type { LogoPosition } from "@/types/brand";
import { DIMENSIONS } from "@/types/carousel";

export interface LogoConfig {
  path: string;
  position: LogoPosition;
  height: number;
}

/**
 * Describes a color substitution to apply to slide HTML at render time.
 * `from` maps color role keys to their original hex values (lowercase, e.g. "#1a1a2e").
 * `to` maps the same keys to replacement hex values.
 * Only pairs where from[key] !== to[key] are substituted.
 */
export interface ColorSubstitution {
  from: Record<string, string>;
  to: Record<string, string>;
}

/** Describes per-role font family replacements to apply at render time. */
export interface FontSubstitution {
  heading?: { from: string; to: string };
  body?: { from: string; to: string };
}

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return null;
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

/**
 * Replaces brand colors in `subs.from` with counterparts in `subs.to`.
 *
 * Two-pass, cascade-free approach:
 *  Pass 1 — hex values (#rrggbb) in a single regex so swapped colors don't overwrite each other.
 *  Pass 2 — rgba/rgb(...) using the same RGB components, preserving the alpha channel.
 *            This handles decorative uses like `rgba(255,255,255,0.04)` that wouldn't match hex.
 */
function applyColorSubstitution(html: string, subs: ColorSubstitution): string {
  const hexMap = new Map<string, string>();
  const rgbPairs: Array<{ fromRgb: [number, number, number]; toRgb: [number, number, number] }> = [];

  for (const [key, toHex] of Object.entries(subs.to)) {
    const fromHex = subs.from[key];
    if (!fromHex || fromHex.toLowerCase() === toHex.toLowerCase()) continue;
    hexMap.set(fromHex.toLowerCase(), toHex.toLowerCase());
    const fromRgb = hexToRgb(fromHex);
    const toRgb = hexToRgb(toHex);
    if (fromRgb && toRgb) rgbPairs.push({ fromRgb, toRgb });
  }

  if (hexMap.size === 0) return html;

  // Pass 1: hex replacement (single pass — no cascade between swapped pairs)
  const hexPattern = Array.from(hexMap.keys())
    .map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  let result = html.replace(new RegExp(hexPattern, "gi"), (m) => hexMap.get(m.toLowerCase()) ?? m);

  // Pass 2: rgba/rgb replacement — different syntax from hex, so no cascade with pass 1
  if (rgbPairs.length > 0) {
    const rgbaPattern = rgbPairs
      .map(({ fromRgb: [r, g, b] }) => `rgba?\\(\\s*${r}\\s*,\\s*${g}\\s*,\\s*${b}\\s*(?:,\\s*([^)]+))?\\)`)
      .join("|");
    result = result.replace(new RegExp(rgbaPattern, "gi"), (match) => {
      const m = match.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([^)]+))?\s*\)/i);
      if (!m) return match;
      const [r, g, b] = [+m[1], +m[2], +m[3]];
      const alpha = m[4];
      const rep = rgbPairs.find((p) => p.fromRgb[0] === r && p.fromRgb[1] === g && p.fromRgb[2] === b);
      if (!rep) return match;
      const [tr, tg, tb] = rep.toRgb;
      return alpha !== undefined ? `rgba(${tr},${tg},${tb},${alpha.trim()})` : `rgb(${tr},${tg},${tb})`;
    });
  }

  return result;
}

/**
 * Extract Google Font family names from slide HTML.
 * Looks for font-family declarations in inline styles and <style> tags.
 */
export function extractFontFamilies(html: string): string[] {
  const families = new Set<string>();
  // Match font-family: "Font Name" or font-family: 'Font Name' or font-family: Font Name
  const regex = /font-family:\s*['"]?([^;'"}\n]+?)['"]?\s*[;}"]/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const raw = match[1].trim();
    // Split on commas and take non-generic font names
    const generics = new Set([
      "serif",
      "sans-serif",
      "monospace",
      "cursive",
      "fantasy",
      "system-ui",
      "inherit",
      "initial",
      "unset",
    ]);
    for (const part of raw.split(",")) {
      const name = part.trim().replace(/['"]/g, "");
      if (name && !generics.has(name.toLowerCase())) {
        families.add(name);
      }
    }
  }
  return Array.from(families);
}

/**
 * Wraps slide body HTML into a full HTML document at the correct dimensions.
 * This is THE shared rendering contract between preview (iframe) and export (Puppeteer).
 * Logo is injected here at system level so the AI never has to manage its position.
 */
function applyFontSub(html: string, sub: { from: string; to: string }): string {
  if (!sub.from || !sub.to || sub.from.toLowerCase() === sub.to.toLowerCase()) return html;
  const escaped = sub.from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(new RegExp(escaped, "gi"), sub.to);
}

/**
 * Applies color and font substitutions to raw slide HTML without wrapping it.
 * Use this before calling extractFontFamilies() so font extraction uses final names.
 */
export function preprocessSlideHtml(
  html: string,
  options: { colorSubstitution?: ColorSubstitution; fontSubstitution?: FontSubstitution }
): string {
  let result = html;
  if (options.colorSubstitution) result = applyColorSubstitution(result, options.colorSubstitution);
  if (options.fontSubstitution?.heading) result = applyFontSub(result, options.fontSubstitution.heading);
  if (options.fontSubstitution?.body) result = applyFontSub(result, options.fontSubstitution.body);
  return result;
}

export function wrapSlideHtml(
  slideHtml: string,
  aspectRatio: AspectRatio,
  options?: { inlineFontCss?: string; logoConfig?: LogoConfig; colorSubstitution?: ColorSubstitution; fontSubstitution?: FontSubstitution }
): string {
  const { width, height } = DIMENSIONS[aspectRatio];

  // Apply color substitution BEFORE any other processing
  let processedHtml = slideHtml;
  if (options?.colorSubstitution) {
    processedHtml = applyColorSubstitution(processedHtml, options.colorSubstitution);
  }
  if (options?.fontSubstitution?.heading) {
    processedHtml = applyFontSub(processedHtml, options.fontSubstitution.heading);
  }
  if (options?.fontSubstitution?.body) {
    processedHtml = applyFontSub(processedHtml, options.fontSubstitution.body);
  }

  const fontFamilies = extractFontFamilies(processedHtml);

  let fontBlock = "";
  if (options?.inlineFontCss) {
    fontBlock = `<style>${options.inlineFontCss}</style>`;
  } else if (fontFamilies.length > 0) {
    const params = fontFamilies
      .map(
        (f) =>
          `family=${encodeURIComponent(f)}:wght@300;400;500;600;700;800`
      )
      .join("&");
    fontBlock = `<link href="https://fonts.googleapis.com/css2?${params}&display=swap" rel="stylesheet">`;
  }

  // Strip any logo the AI may have included in the slide HTML to avoid duplicates
  let cleanSlideHtml = processedHtml;
  if (options?.logoConfig && options.logoConfig.path !== "none") {
    // Remove img tags whose src exactly matches the logo path (AI-added logo)
    const escapedPath = options.logoConfig.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    cleanSlideHtml = cleanSlideHtml.replace(
      new RegExp(`<img[^>]*src=["']${escapedPath}["'][^>]*>`, "gi"),
      ""
    );
  }

  let logoOverlay = "";
  if (options?.logoConfig && options.logoConfig.path !== "none") {
    const { path, position, height: logoH } = options.logoConfig;
    // Safe zone bottom = max(10%, uiOverlay(14%) + 2%) = 16% from bottom.
    // Place logo bottom edge at 18% to sit clearly inside the safe zone.
    const bottomPx = Math.round(height * 0.18);
    const sidePx = Math.round(width * 0.12);
    const posStyle =
      position === "bottom-left"
        ? `left:${sidePx}px`
        : position === "bottom-right"
          ? `right:${sidePx}px`
          : `left:50%;transform:translateX(-50%)`;
    logoOverlay = `<img src="${path}" alt="logo" style="position:absolute;bottom:${bottomPx}px;${posStyle};height:${logoH}px;width:auto;object-fit:contain;pointer-events:none;z-index:10;">`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=${width}, initial-scale=1">
  ${fontBlock}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${width}px; height: ${height}px; overflow: hidden; position: relative; }
  </style>
</head>
<body>
  ${cleanSlideHtml}
  ${logoOverlay}
</body>
</html>`;
}
