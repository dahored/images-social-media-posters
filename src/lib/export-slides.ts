import puppeteer, { type Browser } from "puppeteer";
import { readFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { wrapSlideHtml, extractFontFamilies, preprocessSlideHtml, type LogoConfig, type ColorSubstitution, type FontSubstitution } from "./slide-html";
import { getInlinedFontCSS } from "./fonts";
import type { Slide, AspectRatio } from "@/types/carousel";
import { DIMENSIONS } from "@/types/carousel";

// Singleton browser with lifecycle management
let browser: Browser | null = null;
let exportCount = 0;
const MAX_EXPORTS_BEFORE_RESTART = 50;

async function getBrowser(): Promise<Browser> {
  if (browser && exportCount >= MAX_EXPORTS_BEFORE_RESTART) {
    await browser.close().catch(() => {});
    browser = null;
    exportCount = 0;
  }
  if (!browser || !browser.isConnected()) {
    browser = await puppeteer.launch({
      headless: true,
      protocolTimeout: 180000,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--font-render-hinting=none",
      ],
    });
    exportCount = 0;
  }
  return browser;
}

/**
 * Inline all image references in slide HTML.
 * Replaces /uploads/xxx.png paths with data: URIs.
 */
async function inlineImages(html: string): Promise<string> {
  const uploadDir = path.resolve(process.cwd(), "public");
  const imgRegex = /(?:src=["']|url\(["']?)(\/uploads\/[^"'\s)]+)/g;
  const matches = [...html.matchAll(imgRegex)];

  let result = html;
  for (const match of matches) {
    const imgPath = match[1];
    try {
      const fullPath = path.join(uploadDir, imgPath);
      const buffer = await readFile(fullPath);
      const ext = path.extname(imgPath).toLowerCase();
      const mime =
        ext === ".png"
          ? "image/png"
          : ext === ".jpg" || ext === ".jpeg"
            ? "image/jpeg"
            : "image/webp";
      const base64 = buffer.toString("base64");
      result = result.replace(imgPath, `data:${mime};base64,${base64}`);
    } catch {
      // Keep original path — Puppeteer can fetch from localhost
    }
  }

  return result;
}

/**
 * Fetch external CDN stylesheets (Font Awesome, Bootstrap Icons, etc.) and replace
 * <link rel="stylesheet"> tags with inline <style> blocks containing the CSS text.
 * Font binary files (woff2, etc.) are kept as external URLs — Puppeteer fetches them
 * via network and document.fonts.ready waits for them before the screenshot.
 *
 * Only the CSS text is inlined (typically 50-150KB). Inlining font binaries as base64
 * produces 5-20MB HTML documents that cause Chromium to hang and timeout.
 */
const cssCache = new Map<string, string>();
async function inlineExternalCss(html: string): Promise<string> {
  const linkRegex = /<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["'](https?:\/\/[^"']+)["'][^>]*\/?>/gi;
  const matches = [...html.matchAll(linkRegex)];
  let result = html;
  for (const match of matches) {
    const [fullTag, href] = match;
    try {
      let css = cssCache.get(href) ?? null;
      if (!css) {
        const res = await fetch(href, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) continue;
        css = await res.text();
        cssCache.set(href, css);
      }
      result = result.replace(fullTag, `<style>${css}</style>`);
    } catch {
      // Keep original <link> — Puppeteer will attempt to fetch it directly
    }
  }
  return result;
}

async function inlineImagePath(imgPath: string): Promise<string> {
  try {
    const uploadDir = path.resolve(process.cwd(), "public");
    const fullPath = path.join(uploadDir, imgPath);
    const buffer = await readFile(fullPath);
    const ext = path.extname(imgPath).toLowerCase();
    const mime =
      ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/webp";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return imgPath;
  }
}

/**
 * Export a single slide to PNG buffer.
 */
export async function exportSlide(
  slide: Slide,
  aspectRatio: AspectRatio,
  logoConfig?: LogoConfig,
  colorSubstitution?: ColorSubstitution,
  fontSubstitution?: FontSubstitution,
  customBackground?: string,
  accentOverride?: string
): Promise<Buffer> {
  const { width, height } = DIMENSIONS[aspectRatio];

  // Apply style overrides first so font extraction uses the final font names
  const processedHtml = preprocessSlideHtml(slide.html, { colorSubstitution, fontSubstitution });

  // Get inlined font CSS (after substitution so new font names are included).
  // Always include Noto Sans Symbols 2 — covers Dingbats, special symbols, and other
  // Unicode ranges that generic fonts (serif, sans-serif) miss in headless Chromium.
  const fontFamilies = extractFontFamilies(processedHtml);
  if (!fontFamilies.includes("Noto Sans Symbols 2")) fontFamilies.push("Noto Sans Symbols 2");
  const inlinedFontCss = await getInlinedFontCSS(fontFamilies);

  // Inline images and external CDN stylesheets (icon fonts, etc.)
  const inlinedHtml = await inlineExternalCss(await inlineImages(processedHtml));
  const inlinedLogoConfig = logoConfig && logoConfig.path !== "none"
    ? { ...logoConfig, path: await inlineImagePath(logoConfig.path) }
    : logoConfig;

  // Build self-contained HTML (substitutions already applied — don't re-apply).
  // Pass fontRoles so wrapSlideHtml injects .slide-title / .slide-body CSS for class-based targeting.
  const fullHtml = wrapSlideHtml(inlinedHtml, aspectRatio, {
    inlineFontCss: inlinedFontCss,
    logoConfig: inlinedLogoConfig,
    customBackground: customBackground ?? slide.styleOverride?.customBackground,
    fontRoles: fontSubstitution
      ? { heading: fontSubstitution.heading?.to, body: fontSubstitution.body?.to }
      : undefined,
    accentOverride,
  });

  const br = await getBrowser();
  const page = await br.newPage();

  try {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setContent(fullHtml, { waitUntil: "load", timeout: 30000 });

    // Patch generic font-family values (serif, sans-serif) in inline styles to include
    // system symbol/dingbat fonts before the generic family. This ensures characters like
    // U+275D (❝), Dingbats, and other special glyphs render correctly in headless Chromium,
    // which has a weaker font fallback chain than the full browser.
    await page.evaluate(() => {
      const SYM = '"Noto Sans Symbols 2", "Apple Symbols", "Segoe UI Symbol", "Noto Sans Symbols", "DejaVu Sans"';
      document.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
        const ff = el.style.fontFamily;
        if (!ff) return;
        if (/\b(serif|sans-serif)\b/i.test(ff) && !ff.includes("Apple Symbols")) {
          el.style.fontFamily = ff.replace(/\b(serif|sans-serif)\b/gi, `${SYM}, $1`);
        }
      });
    }).catch(() => {});

    // Wait for fonts to be ready after DOM patch (includes CDN icon font files).
    await page.waitForFunction(
      () => document.fonts.ready.then(() => true),
      { timeout: 15000 }
    ).catch(() => {});

    // Settle time for glyph painting
    await new Promise((r) => setTimeout(r, 400));

    const screenshotBuffer = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width, height },
      timeout: 60000,
    });

    exportCount++;

    // Post-process with Sharp: enforce sRGB
    const processed = await sharp(screenshotBuffer)
      .toColorspace("srgb")
      .png()
      .toBuffer();

    return processed;
  } finally {
    await page.close().catch(() => {});
  }
}

export type SlideExportOverrides = {
  colorSubstitution?: ColorSubstitution;
  fontSubstitution?: FontSubstitution;
  customBackground?: string;
  logoConfig?: LogoConfig;
  accentOverride?: string;
};

/**
 * Export all slides of a carousel to PNG buffers.
 * Processes up to 3 slides concurrently.
 * `getSlideOverrides` receives each slide and returns its color/font substitutions (optional).
 */
export async function exportAllSlides(
  slides: Slide[],
  aspectRatio: AspectRatio,
  logoConfig?: LogoConfig,
  getSlideOverrides?: (slide: Slide) => SlideExportOverrides | undefined,
  onProgress?: (current: number, total: number) => void
): Promise<{ name: string; buffer: Buffer }[]> {
  const results: { name: string; buffer: Buffer }[] = [];
  const CONCURRENCY = 3;

  for (let i = 0; i < slides.length; i += CONCURRENCY) {
    const batch = slides.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (slide, batchIdx) => {
        const idx = i + batchIdx;
        const overrides = getSlideOverrides?.(slide);
        const buffer = await exportSlide(slide, aspectRatio, overrides?.logoConfig ?? logoConfig, overrides?.colorSubstitution, overrides?.fontSubstitution, overrides?.customBackground, overrides?.accentOverride);
        onProgress?.(idx + 1, slides.length);
        return { name: `slide-${idx + 1}.png`, buffer };
      })
    );
    results.push(...batchResults);
  }

  return results;
}
