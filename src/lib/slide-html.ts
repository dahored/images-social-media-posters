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

/**
 * Replaces each color in `subs.from` with its counterpart in `subs.to`.
 * Handles both lowercase and uppercase hex notation.
 */
function applyColorSubstitution(html: string, subs: ColorSubstitution): string {
  let result = html;
  for (const [key, replacement] of Object.entries(subs.to)) {
    const fromColor = subs.from[key];
    if (!fromColor || fromColor.toLowerCase() === replacement.toLowerCase()) continue;
    result = result.replaceAll(fromColor.toLowerCase(), replacement.toLowerCase());
    result = result.replaceAll(fromColor.toUpperCase(), replacement.toUpperCase());
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
export function wrapSlideHtml(
  slideHtml: string,
  aspectRatio: AspectRatio,
  options?: { inlineFontCss?: string; logoConfig?: LogoConfig; colorSubstitution?: ColorSubstitution }
): string {
  const { width, height } = DIMENSIONS[aspectRatio];

  // Apply color substitution BEFORE any other processing
  let processedHtml = slideHtml;
  if (options?.colorSubstitution) {
    processedHtml = applyColorSubstitution(processedHtml, options.colorSubstitution);
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
