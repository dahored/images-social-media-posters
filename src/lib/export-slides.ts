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
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
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

  // Get inlined font CSS (after substitution so new font names are included)
  const fontFamilies = extractFontFamilies(processedHtml);
  const inlinedFontCss = await getInlinedFontCSS(fontFamilies);

  // Inline images (including logo path if present)
  const inlinedHtml = await inlineImages(processedHtml);
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
    await page.setContent(fullHtml, { waitUntil: "domcontentloaded", timeout: 15000 });

    // Wait for fonts to be ready
    await page
      .waitForFunction(
        () =>
          document.fonts.ready.then(() =>
            [...document.fonts].every((f) => f.status === "loaded")
          ),
        { timeout: 10000 }
      )
      .catch(() => {
        // Font loading timeout — proceed with whatever loaded
      });

    const screenshotBuffer = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width, height },
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
