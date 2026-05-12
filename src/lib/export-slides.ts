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

async function launchBrowser(): Promise<Browser> {
  return puppeteer.launch({
    headless: true,
    protocolTimeout: 300000,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--font-render-hinting=none",
      "--disable-dev-shm-usage",
    ],
  });
}

async function getBrowser(): Promise<Browser> {
  if (browser && exportCount >= MAX_EXPORTS_BEFORE_RESTART) {
    await browser.close().catch(() => {});
    browser = null;
    exportCount = 0;
  }
  if (!browser || !browser.isConnected()) {
    browser = await launchBrowser();
    exportCount = 0;
  }
  return browser;
}

/** Kill the current browser so the next getBrowser() call gets a fresh one. */
async function resetBrowser(): Promise<void> {
  const b = browser;
  browser = null;
  exportCount = 0;
  if (b) await b.close().catch(() => {});
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

// Noto Color Emoji CSS from Google Fonts — kept as url() refs so Puppeteer fetches
// only the needed unicode-range subsets at render time (full font is ~10MB, too large to inline)
let notoEmojiCssCache: string | null = null;
async function fetchNotoEmojiCss(): Promise<string> {
  if (notoEmojiCssCache !== null) return notoEmojiCssCache;
  try {
    const res = await fetch(
      "https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=block",
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(8000),
      }
    );
    notoEmojiCssCache = res.ok ? await res.text() : "";
  } catch {
    notoEmojiCssCache = "";
  }
  return notoEmojiCssCache;
}

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
async function exportSlideOnce(
  fullHtml: string,
  width: number,
  height: number,
): Promise<Buffer> {
  const br = await getBrowser();
  const page = await br.newPage();

  try {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setContent(fullHtml, { waitUntil: "load", timeout: 30000 });

    // Font fallback patch: ensure every text element has 'Noto Sans Symbols 2' (ornaments, dingbats)
    // BEFORE 'Noto Color Emoji' (emoji). wrapSlideHtml already injects both in the correct order
    // into font-family declarations in the HTML, but elements using only class-based styles won't
    // have them yet — getComputedStyle picks those up. Order matters: Symbols 2 before Emoji so
    // ❝ (U+275D) and similar ornaments don't fall to Noto Color Emoji which lacks proper glyphs.
    await page.evaluate(() => {
      document.querySelectorAll<HTMLElement>("p, h1, h2, h3, h4, h5, h6, span, li, div, [style], [class]").forEach((el) => {
        const ff = window.getComputedStyle(el).fontFamily;
        if (!ff) return;
        let next = ff;
        // Insert Noto Sans Symbols 2 before Noto Color Emoji (if not already present)
        if (!ff.includes("Noto Sans Symbols 2")) {
          const insertBefore = ff.includes("Noto Color Emoji")
            ? ff.replace(/"Noto Color Emoji"/, '"Noto Sans Symbols 2", "Noto Color Emoji"')
            : null;
          next = insertBefore ?? (ff + ', "Noto Sans Symbols 2", "Apple Symbols", "Segoe UI Symbol"');
        }
        if (!next.includes("Noto Color Emoji")) {
          next += ', "Noto Color Emoji", emoji';
        }
        if (next !== ff) el.style.fontFamily = next;
      });
    }).catch(() => {});

    // Trigger Noto Color Emoji loading for the actual emoji characters present on this page.
    // Passing the emoji text arg ensures the browser fetches the correct unicode-range subsets.
    await page.evaluate(async () => {
      const allText = document.body.innerText;
      const emojiChars = [...new Set([...allText].filter(c => {
        const cp = c.codePointAt(0) ?? 0;
        return (cp >= 0x1F000 && cp <= 0x1FFFF) || (cp >= 0x2300 && cp <= 0x27BF) || cp === 0x2B50 || cp === 0x2B55;
      }))].join('');
      await document.fonts.load(`16px "Noto Color Emoji"`, emojiChars || '😀').catch(() => {});
    }).catch(() => {});

    // Wait for all fonts to finish loading (includes the Noto Color Emoji subsets Puppeteer is fetching)
    await page.waitForFunction(
      () => document.fonts.ready.then(() => true),
      { timeout: 15000 }
    ).catch(() => {});

    // Settle time for glyph painting
    await new Promise((r) => setTimeout(r, 400));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const screenshotBuffer = await (page.screenshot as any)({
      type: "png",
      clip: { x: 0, y: 0, width, height },
      timeout: 90000,
    });

    exportCount++;
    return screenshotBuffer as Buffer;
  } finally {
    await page.close().catch(() => {});
  }
}

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
  // Exclude 'Noto Color Emoji' from base64-inline — it's loaded separately via CSS url() refs.
  const fontFamilies = extractFontFamilies(processedHtml);
  if (!fontFamilies.includes("Noto Sans Symbols 2")) fontFamilies.push("Noto Sans Symbols 2");
  const familiesToInline = fontFamilies.filter((f) => f !== "Noto Color Emoji");
  const inlinedFontCss = await getInlinedFontCSS(familiesToInline);

  // Fetch Noto Color Emoji CSS from Google Fonts — keeps url() refs so Puppeteer fetches
  // only the needed unicode-range subsets at render time via its own network stack.
  const notoEmojiCss = await fetchNotoEmojiCss();

  // Inline images and external CDN stylesheets (icon fonts, etc.)
  const inlinedHtml = await inlineExternalCss(await inlineImages(processedHtml));
  const inlinedLogoConfig = logoConfig && logoConfig.path !== "none"
    ? { ...logoConfig, path: await inlineImagePath(logoConfig.path) }
    : logoConfig;

  // Build self-contained HTML (substitutions already applied — don't re-apply).
  // Pass fontRoles so wrapSlideHtml injects .slide-title / .slide-body CSS for class-based targeting.
  const fullHtml = wrapSlideHtml(inlinedHtml, aspectRatio, {
    inlineFontCss: inlinedFontCss + notoEmojiCss,
    logoConfig: inlinedLogoConfig,
    customBackground: customBackground ?? slide.styleOverride?.customBackground,
    fontRoles: fontSubstitution
      ? { heading: fontSubstitution.heading?.to, body: fontSubstitution.body?.to }
      : undefined,
    accentOverride,
  });

  try {
    const screenshotBuffer = await exportSlideOnce(fullHtml, width, height);
    return await sharp(screenshotBuffer).toColorspace("srgb").png().toBuffer();
  } catch (err) {
    // On any CDP/browser error, kill the browser and retry once with a fresh instance
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("timed out") || msg.includes("Protocol error") || msg.includes("Session closed") || msg.includes("Target closed")) {
      await resetBrowser();
      const screenshotBuffer = await exportSlideOnce(fullHtml, width, height);
      return await sharp(screenshotBuffer).toColorspace("srgb").png().toBuffer();
    }
    throw err;
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
  const CONCURRENCY = 2;

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
