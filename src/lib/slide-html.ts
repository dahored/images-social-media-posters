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

function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Replaces brand colors in `subs.from` with counterparts in `subs.to`.
 *
 * Two-pass, cascade-free approach:
 *  Pass 1 — hex values (#rrggbb). Exact matches first; then a fuzzy scan of all hex colors in the
 *            HTML finds any color within FUZZY_THRESHOLD RGB-distance of a `from` palette entry
 *            and maps it to the corresponding `to` color. This handles slides where the AI wrote
 *            a near-match approximation of the brand palette hex.
 *  Pass 2 — rgba/rgb(...) using the same RGB components, preserving the alpha channel.
 *            This handles decorative uses like `rgba(255,255,255,0.04)` that wouldn't match hex.
 */
const FUZZY_THRESHOLD = 30; // Max Euclidean RGB distance to count as "same brand color"

function applyColorSubstitution(html: string, subs: ColorSubstitution): string {
  // Build exact substitution pairs.
  // When the accent from-color is identical to another slot's from-color (e.g. accent=#ffffff
  // AND background=#ffffff), we can't safely substitute accent by hex — every white text element
  // would incorrectly turn into the accent color. Skip accent in that case; accent elements are
  // handled via accentOverride CSS class injection instead.
  // Other slots (background, primary…) are always kept — e.g. background #ffffff → #16213e is
  // essential for light-mode slides so white text becomes dark on the light background.
  type Pair = { fromHex: string; fromRgb: [number, number, number]; toHex: string; toRgb: [number, number, number] | null };
  const fromAccentHex = subs.from.accent?.toLowerCase();
  const accentIsAmbiguous = fromAccentHex
    ? Object.entries(subs.from).some(([k, v]) => k !== "accent" && v?.toLowerCase() === fromAccentHex)
    : false;

  const pairs: Pair[] = [];
  for (const [key, toHex] of Object.entries(subs.to)) {
    const fromHex = subs.from[key];
    if (!fromHex || fromHex.toLowerCase() === toHex.toLowerCase()) continue;
    if (key === "accent" && accentIsAmbiguous) continue; // handled via accentOverride CSS
    const fromRgb = hexToRgb(fromHex);
    if (!fromRgb) continue;
    pairs.push({ fromHex: fromHex.toLowerCase(), fromRgb, toHex: toHex.toLowerCase(), toRgb: hexToRgb(toHex) });
  }

  if (pairs.length === 0) return html;

  // hexMap: htmlColor → replacementColor (starts with exact matches)
  const hexMap = new Map<string, string>(pairs.map((p) => [p.fromHex, p.toHex]));

  // rgbPairs accumulates both exact and fuzzy pairs for Pass 2
  const rgbPairs: Array<{ fromRgb: [number, number, number]; toRgb: [number, number, number] }> = pairs
    .filter((p) => p.toRgb !== null)
    .map((p) => ({ fromRgb: p.fromRgb, toRgb: p.toRgb! }));

  // Fuzzy scan: find all unique hex colors in the HTML that are not already mapped,
  // then check if they are close to any from-palette color.
  const htmlHexRegex = /#([0-9a-fA-F]{6})\b/gi;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = htmlHexRegex.exec(html)) !== null) {
    const h = `#${m[1].toLowerCase()}`;
    if (seen.has(h) || hexMap.has(h)) continue;
    seen.add(h);
    const hRgb = hexToRgb(h);
    if (!hRgb) continue;

    let nearest: Pair | null = null;
    let nearestDist = FUZZY_THRESHOLD + 1;
    for (const pair of pairs) {
      const d = colorDistance(hRgb, pair.fromRgb);
      if (d <= FUZZY_THRESHOLD && d < nearestDist) { nearestDist = d; nearest = pair; }
    }

    if (nearest && nearest.toHex !== h) {
      hexMap.set(h, nearest.toHex);
      if (nearest.toRgb && !rgbPairs.some((p) => p.fromRgb[0] === hRgb[0] && p.fromRgb[1] === hRgb[1] && p.fromRgb[2] === hRgb[2])) {
        rgbPairs.push({ fromRgb: hRgb, toRgb: nearest.toRgb });
      }
    }
  }

  if (hexMap.size === 0) return html;

  // Pass 1: hex replacement (single pass — no cascade between swapped pairs)
  const hexPattern = Array.from(hexMap.keys())
    .map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  let result = html.replace(new RegExp(hexPattern, "gi"), (match) => hexMap.get(match.toLowerCase()) ?? match);

  // Pass 2: rgba/rgb replacement — different syntax from hex, so no cascade with pass 1
  if (rgbPairs.length > 0) {
    const rgbaPattern = rgbPairs
      .map(({ fromRgb: [r, g, b] }) => `rgba?\\(\\s*${r}\\s*,\\s*${g}\\s*,\\s*${b}\\s*(?:,\\s*([^)]+))?\\)`)
      .join("|");
    result = result.replace(new RegExp(rgbaPattern, "gi"), (match) => {
      const rm = match.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([^)]+))?\s*\)/i);
      if (!rm) return match;
      const [r, g, b] = [+rm[1], +rm[2], +rm[3]];
      const alpha = rm[4];
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
      // 'Noto Sans Symbols 2' must come BEFORE 'Noto Color Emoji':
      // both claim the Dingbats range (U+2700-U+27BF). Noto Color Emoji lacks
      // proper glyphs for ornaments like ❝ (U+275D) and renders them as boxes,
      // while Noto Sans Symbols 2 renders them correctly. For actual emoji
      // (U+1F000+) Noto Sans Symbols 2 has no glyphs, so Noto Color Emoji
      // handles them as the next fallback.
      const withNoto = trimmed.replace(
        /,?\s*(sans-serif|serif|monospace|emoji)\s*$/i,
        `, 'Noto Sans Symbols 2', 'Noto Color Emoji', $1`
      );
      return withNoto !== trimmed ? withNoto : trimmed + ", 'Noto Sans Symbols 2', 'Noto Color Emoji'";
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

  // Strip background/background-color props from an inline style string, preserving the rest.
  const clearBgFromStyle = (style: string) =>
    style.split(";").map((s: string) => s.trim()).filter((s: string) => s && !/^background/i.test(s)).join(";");

  // Patch only the root div's background-color inline style to the target hex.
  const patchRootBackground = (html: string, targetHex: string): string => {
    const patched = html.replace(
      /(<div\b[^>]*\bstyle=")([^"]*)(")/,
      (_, pre, style, close) => {
        const stripped = clearBgFromStyle(style);
        return `${pre}background:${targetHex};background-color:${targetHex}${stripped ? ";" + stripped : ""}${close}`;
      }
    );
    return patched;
  };

  // Apply color substitution BEFORE any other processing
  let processedHtml = slideHtml;
  if (options?.colorSubstitution) {
    processedHtml = applyColorSubstitution(processedHtml, options.colorSubstitution);

    // After substitution, anchor the root div background to to.primary.
    // Role-based substitution can mis-map the root background when the AI used a secondary/accent
    // color as the slide background — this makes "Fondo del slide" always control the background.
    const targetPrimary = options.colorSubstitution.to.primary?.toLowerCase();
    if (targetPrimary) {
      const rootBgAfter = detectSlideRootBackground(processedHtml)?.toLowerCase();
      if (rootBgAfter && rootBgAfter !== targetPrimary) {
        processedHtml = patchRootBackground(processedHtml, targetPrimary);
      }
    }
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
  const sub = options?.colorSubstitution;

  // Inject text color for all slide-role text elements. Works even when AI hardcoded
  // off-palette colors. Exclude slide-secondary/slide-surface (decoration, not text).
  // Exclude slide-secondary (decorative shapes, no text) and slide-accent (accent controls its own color).
  // slide-surface is NOT excluded — color: X !important only affects text, not background-color,
  // so covering surface elements ensures card titles inside them get the correct text color.
  const textColorCss = sub?.to.background
    ? `[class*="slide-"]:not(.slide-secondary):not(.slide-accent) { color: ${sub.to.background} !important; }`
    : "";

  // Decorative elements (slide-secondary) and surface/card backgrounds (slide-surface)
  // must reflect the palette regardless of what color the AI originally hardcoded.
  // slide-secondary: only remap SVG fill and borders — NOT background-color.
  // background-color !important flattens opacity/gradients and turns shapes into solid squares.
  // background substitution is already handled by applyColorSubstitution (string + fuzzy replacement).
  const secondaryCss = sub?.to.secondary
    ? `.slide-secondary { fill: ${sub.to.secondary} !important; border-color: ${sub.to.secondary} !important; }`
    : "";
  // slide-surface: same reasoning — let applyColorSubstitution handle background-color.
  // Only force border-color which isn't covered by string replacement.
  const surfaceCss = sub?.to.surface
    ? `.slide-surface { border-color: ${sub.to.surface} !important; }`
    : "";

  // Accent: text color only. background-color must NOT be forced here — slide-accent is used
  // on text spans and block elements alike; forcing bg would create colored rectangles over text.
  const accentColor = options?.accentOverride ?? sub?.to.accent;
  const accentCss = accentColor
    ? `.slide-accent { color: ${accentColor} !important; }`
    : "";

  const fontRoleCss = [
    headingTarget ? `.slide-title { font-family: '${headingTarget}', 'Noto Color Emoji', sans-serif !important; }` : "",
    bodyTarget    ? `.slide-body  { font-family: '${bodyTarget}', 'Noto Color Emoji', sans-serif !important; }` : "",
    textColorCss,
    secondaryCss,
    surfaceCss,
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
  // Always load Noto Sans Symbols 2 + Noto Color Emoji so symbols and emoji render consistently.
  // Symbols 2 must come first in the link order (same as font-family order) so the browser
  // prefers it for ornament characters (❝ U+275D, etc.) over Noto Color Emoji.
  const notoLinksBlock = [
    `<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Symbols+2&display=block" rel="stylesheet">`,
    `<link href="https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=block" rel="stylesheet">`,
  ].join("\n  ");
  fontBlock = fontBlock ? `${fontBlock}\n  ${notoLinksBlock}` : notoLinksBlock;

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
    // Pass 1: root div
    const patched = patchRootBackground(cleanSlideHtml, bg);
    if (patched !== cleanSlideHtml) cleanSlideHtml = patched;

    // Pass 2: full-screen overlay divs (position:absolute + top:0 + left:0 + right:0 pattern).
    cleanSlideHtml = cleanSlideHtml.replace(
      /<div[^>]*\bstyle="([^"]*)"[^>]*>/gi,
      (match, style) => {
        if (!/background/i.test(style)) return match;
        const hasTop0  = /\btop\s*:\s*0/.test(style)   || /\binset\s*:\s*0/.test(style);
        const hasLeft0 = /\bleft\s*:\s*0/.test(style)  || /\binset\s*:\s*0/.test(style);
        const hasRight0 = /\bright\s*:\s*0/.test(style) || /\binset\s*:\s*0/.test(style);
        if (!hasTop0 || !hasLeft0 || !hasRight0) return match;
        const cleared = clearBgFromStyle(style);
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
    body { font-family: 'Noto Sans Symbols 2', 'Noto Color Emoji', sans-serif; }
    ${fontRoleCss}
  </style>
</head>
<body>
  ${cleanSlideHtml}
  ${logoOverlay}
</body>
</html>`;
}
