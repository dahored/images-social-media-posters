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
 * Detects the first hex color (#rrggbb) from the root element's background property.
 * Scans the first div's inline style — returns null for class-based or gradient-only slides.
 */
export function detectSlideRootBackground(html: string): string | null {
  const divMatch = html.match(/<div[^>]*style="([^"]*)"/i);
  if (!divMatch) return null;
  const bgMatch = divMatch[1].match(/background(?:-color)?\s*:[^;]*?(#[0-9a-fA-F]{6})/i);
  return bgMatch ? bgMatch[1].toLowerCase() : null;
}

const MIN_FONT_BY_RATIO: Record<string, number> = {
  "1:1": 20,
  "4:5": 24,
  "9:16": 24,
};
const DEFAULT_MIN_FONT = 20;

function clampFontSizes(html: string, minSize: number): string {
  return html.replace(/font-size:\s*(\d+(?:\.\d+)?)px/gi, (match, raw) => {
    const size = parseFloat(raw);
    if (size > 0 && size < minSize) return `font-size: ${minSize}px`;
    return match;
  });
}

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

/**
 * Inject 'Noto Color Emoji' into every font-family declaration in HTML (inline styles + <style> blocks).
 * Placed before the trailing generic family keyword so it takes priority over the OS default emoji font
 * (Apple Color Emoji on macOS, Segoe UI Emoji on Windows) in both browser iframes and Puppeteer exports.
 */
function injectNotoEmojiFont(html: string): string {
  return html.replace(
    /font-family\s*:\s*[^;};"]+/gi,
    (match) => {
      if (/noto color emoji/i.test(match)) return match;
      const trimmed = match.trimEnd();
      const withNoto = trimmed.replace(
        /,?\s*(sans-serif|serif|monospace|emoji)\s*$/i,
        `, 'Noto Color Emoji', $1`
      );
      return withNoto !== trimmed ? withNoto : trimmed + ", 'Noto Color Emoji'";
    }
  );
}

export function wrapSlideHtml(
  slideHtml: string,
  aspectRatio: AspectRatio,
  options?: {
    inlineFontCss?: string;
    logoConfig?: LogoConfig;
    colorSubstitution?: ColorSubstitution;
    fontSubstitution?: FontSubstitution;
    /** Effective heading/body font names for CSS class injection only — no string replacement. Use when preprocessSlideHtml already applied string subs. */
    fontRoles?: { heading?: string; body?: string };
    customBackground?: string;
    /** Override accent color for elements with class="slide-accent" */
    accentOverride?: string;
    /** Origin to inject as <base href> so relative URLs (e.g. /uploads/...) resolve correctly inside iframes loaded via blob: or about:blank. */
    baseHref?: string;
  }
): string {
  const { width, height } = DIMENSIONS[aspectRatio];

  // Apply color substitution BEFORE any other processing
  let processedHtml = slideHtml;
  if (options?.colorSubstitution) {
    processedHtml = applyColorSubstitution(processedHtml, options.colorSubstitution);
  }

  if (options?.fontSubstitution?.heading) processedHtml = applyFontSub(processedHtml, options.fontSubstitution.heading);
  if (options?.fontSubstitution?.body) processedHtml = applyFontSub(processedHtml, options.fontSubstitution.body);

  const minFont = MIN_FONT_BY_RATIO[aspectRatio] ?? DEFAULT_MIN_FONT;
  processedHtml = clampFontSizes(processedHtml, minFont);

  const fontFamilies = extractFontFamilies(processedHtml);

  // CSS injection for slide-title/slide-body classes — precise per-role targeting with !important.
  // This takes priority over string-replaced inline styles when both heading and body share the same source font.
  const headingTarget = options?.fontSubstitution?.heading?.to ?? options?.fontRoles?.heading;
  const bodyTarget    = options?.fontSubstitution?.body?.to    ?? options?.fontRoles?.body;
  const accentCss = options?.accentOverride
    ? `.slide-accent { color: ${options.accentOverride} !important; }`
    : "";

  const fontRoleCss = [
    headingTarget ? `.slide-title { font-family: '${headingTarget}', 'Noto Color Emoji', sans-serif !important; }` : "",
    bodyTarget    ? `.slide-body  { font-family: '${bodyTarget}', 'Noto Color Emoji', sans-serif !important; }` : "",
    accentCss,
  ].filter(Boolean).join("\n    ");

  // Always include override target fonts in Google Fonts, even if string replacement didn't find them in the HTML.
  // This ensures the font loads when CSS class injection applies it.
  const allFontFamilies = [...fontFamilies];
  if (headingTarget && !fontFamilies.some((f) => f.toLowerCase() === headingTarget.toLowerCase())) {
    allFontFamilies.push(headingTarget);
  }
  if (bodyTarget && !fontFamilies.some((f) => f.toLowerCase() === bodyTarget.toLowerCase())) {
    allFontFamilies.push(bodyTarget);
  }

  let fontBlock = "";
  if (allFontFamilies.length > 0) {
    const params = allFontFamilies
      .map((f) => `family=${encodeURIComponent(f)}:wght@300;400;500;600;700;800`)
      .join("&");
    // Always include a Google Fonts link so fonts load even if inlining failed/was partial
    fontBlock = `<link href="https://fonts.googleapis.com/css2?${params}&display=swap" rel="stylesheet">`;
  }
  // Always load Noto Color Emoji so emoji render consistently in iframes and Puppeteer exports
  const notoEmojiLink = `<link href="https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=block" rel="stylesheet">`;
  fontBlock = fontBlock ? `${fontBlock}\n  ${notoEmojiLink}` : notoEmojiLink;

  if (options?.inlineFontCss) {
    // Inlined CSS takes priority (instant load, no network round-trip) but the link above acts as fallback
    fontBlock = `<style>${options.inlineFontCss}</style>\n  ${fontBlock}`;
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

  // Strip AI-generated full-width separator divs/hrs placed above the logo zone.
  // Pattern: <div style="...left:0;right:0;height:[1-3]px..."> or <hr ...>
  // These appear as a horizontal line just above the logo overlay.
  cleanSlideHtml = cleanSlideHtml.replace(/<hr\b[^>]*>/gi, "");
  cleanSlideHtml = cleanSlideHtml.replace(
    /<div\s+style="[^"]*(?:left\s*:\s*0[^"]*right\s*:\s*0|right\s*:\s*0[^"]*left\s*:\s*0)[^"]*height\s*:\s*[1-4]px[^"]*"[^>]*>\s*<\/div>/gi,
    ""
  );

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

  // Directly patch backgrounds so a custom color fully overrides whatever the AI generated.
  // CSS !important alone doesn't beat inline shorthand backgrounds in sandboxed iframes.
  if (options?.customBackground) {
    const bg = options.customBackground;
    const clearBg = (style: string) =>
      style.split(";").map((s: string) => s.trim()).filter((s: string) => s && !/^background/i.test(s)).join(";");

    // Pass 1: root div — set custom background
    const patched = cleanSlideHtml.replace(
      /(<div\b[^>]*\bstyle=")([^"]*)(")/,
      (_, pre, style, close) => {
        const stripped = clearBg(style);
        return `${pre}background:${bg};background-color:${bg}${stripped ? ";" + stripped : ""}${close}`;
      }
    );
    if (patched !== cleanSlideHtml) cleanSlideHtml = patched;

    // Pass 2: full-screen overlay divs (position:absolute + top:0 + left:0 + right:0 pattern).
    // AI slides commonly use these for gradient backgrounds layered on top of the root div.
    cleanSlideHtml = cleanSlideHtml.replace(
      /<div[^>]*\bstyle="([^"]*)"[^>]*>/gi,
      (match, style) => {
        if (!/background/i.test(style)) return match;
        const hasTop0  = /\btop\s*:\s*0/.test(style)   || /\binset\s*:\s*0/.test(style);
        const hasLeft0 = /\bleft\s*:\s*0/.test(style)  || /\binset\s*:\s*0/.test(style);
        const hasRight0 = /\bright\s*:\s*0/.test(style) || /\binset\s*:\s*0/.test(style);
        if (!hasTop0 || !hasLeft0 || !hasRight0) return match;
        const cleared = clearBg(style);
        return match.replace(/\bstyle="[^"]*"/, `style="${cleared}"`);
      }
    );
  }

  // Inject 'Noto Color Emoji' into all font-family declarations so emoji render from Noto in both
  // browser iframes (preview) and Puppeteer (export) instead of falling back to the OS emoji font.
  cleanSlideHtml = injectNotoEmojiFont(cleanSlideHtml);

  const baseTag = options?.baseHref ? `<base href="${options.baseHref}">` : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=${width}, initial-scale=1">
  ${baseTag}
  ${fontBlock}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${width}px; height: ${height}px; overflow: hidden; position: relative; }
    ${fontRoleCss}
  </style>
</head>
<body>
  ${cleanSlideHtml}
  ${logoOverlay}
</body>
</html>`;
}
