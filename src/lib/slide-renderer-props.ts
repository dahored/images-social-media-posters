import { detectSlideRootBackground } from "@/lib/slide-html";

function htmlBrightness(html: string | undefined): number {
  const bg = detectSlideRootBackground(html ?? "");
  if (!bg) return 0;
  const r = parseInt(bg.slice(1, 3), 16);
  const g = parseInt(bg.slice(3, 5), 16);
  const b = parseInt(bg.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
import type { LogoConfig, ColorSubstitution, FontSubstitution } from "@/lib/slide-html";
import type { Carousel, Slide, SlideColorSet } from "@/types/carousel";
import type { EffectiveBranding } from "@/types/account";
import type { BrandColors } from "@/types/brand";

export interface SlideRendererProps {
  colorSubstitution?: ColorSubstitution;
  fontSubstitution?: FontSubstitution;
  logoConfig?: LogoConfig;
  accentOverride?: string;
}

// Mirrors the editor's mergeSlideColors — priority: slide override > carousel override > brand base.
function mergeSlideColors(
  base: BrandColors,
  carouselOverride?: Partial<BrandColors>,
  slideOverride?: Partial<SlideColorSet>
): Record<string, string> {
  return {
    primary:    slideOverride?.primary    ?? carouselOverride?.primary    ?? base.primary,
    secondary:  slideOverride?.secondary  ?? carouselOverride?.secondary  ?? base.secondary,
    accent:     slideOverride?.accent     ?? carouselOverride?.accent     ?? base.accent,
    background: slideOverride?.background ?? carouselOverride?.background ?? base.background,
    surface:    slideOverride?.surface    ?? carouselOverride?.surface    ?? base.surface,
  };
}

// Detects which brand palette the slide was authored with, by matching the slide's root
// background color against known palette primaries and backgrounds.
//
// Priority order matters: default.primary is checked BEFORE light/dark backgrounds to prevent
// false positives when a default palette's primary shares the same hex as another palette's
// background (e.g. colors.primary = #16213e AND colorsLight.background = #16213e).
function detectHtmlBase(
  html: string | undefined,
  brandDefault: BrandColors,
  brandDark?: BrandColors,
  brandLight?: BrandColors
): BrandColors {
  if (!html) return brandDefault;
  const bg = detectSlideRootBackground(html)?.toLowerCase();
  if (!bg) return brandDefault;

  // 1. Default palette primary — most common canvas color (AI often uses primary as slide bg).
  if (brandDefault.primary && bg === brandDefault.primary.toLowerCase()) return brandDefault;

  // 2. Light/dark palette primaries
  if (brandLight?.primary && bg === brandLight.primary.toLowerCase()) return brandLight;
  if (brandDark?.primary  && bg === brandDark.primary.toLowerCase())  return brandDark;

  // 3. Light/dark backgrounds — only when they differ from the default background, to avoid
  //    false positives when palettes share the same background value.
  if (brandLight?.background &&
      brandLight.background.toLowerCase() !== brandDefault.background?.toLowerCase() &&
      bg === brandLight.background.toLowerCase()) return brandLight;
  if (brandDark?.background &&
      brandDark.background.toLowerCase() !== brandDefault.background?.toLowerCase() &&
      bg === brandDark.background.toLowerCase()) return brandDark;

  // 4. Default palette background (last resort explicit match before falling back)
  if (brandDefault.background && bg === brandDefault.background.toLowerCase()) return brandDefault;

  return brandDefault;
}

/**
 * Computes SlideRenderer/FullscreenPreview props for a single slide using the same logic
 * as the carousel editor's filmstrip thumbnail computation. Use this in all card preview
 * contexts so they stay in sync with the editor.
 */
// Resolve the brand palette for a given theme.
function paletteForTheme(
  theme: "dark" | "light" | "default",
  branding: EffectiveBranding
): BrandColors {
  if (theme === "light") return branding.colorsLight ?? branding.colors;
  if (theme === "dark")  return branding.colorsDark  ?? branding.colors;
  return branding.colors; // "default"
}

// Resolve fonts for a given theme (falls back to default fonts).
function fontsForTheme(
  theme: "dark" | "light" | "default",
  branding: EffectiveBranding
): import("@/types/brand").BrandFonts {
  if (theme === "light") return branding.fontsLight ?? branding.fonts;
  if (theme === "dark")  return branding.fontsDark  ?? branding.fonts;
  return branding.fonts;
}

// Resolve logo position for a given theme.
function logoPositionForTheme(
  theme: "dark" | "light" | "default",
  branding: EffectiveBranding
): import("@/types/brand").LogoPosition {
  if (theme === "light") return branding.logoPositionLight ?? branding.logoPosition ?? "bottom-center";
  if (theme === "dark")  return branding.logoPositionDark  ?? branding.logoPosition ?? "bottom-center";
  return branding.logoPosition ?? "bottom-center";
}

// Resolve logo height for a given theme.
function logoHeightForTheme(
  theme: "dark" | "light" | "default",
  branding: EffectiveBranding
): number {
  if (theme === "light") return branding.logoHeightLight ?? branding.logoHeight ?? 72;
  if (theme === "dark")  return branding.logoHeightDark  ?? branding.logoHeight ?? 72;
  return branding.logoHeight ?? 72;
}

// Resolve the logo path for a given theme.
// default → logoPath (the generic brand logo, no theme bias)
// dark    → logoPathLight (light-colored logo readable on dark backgrounds)
// light   → logoPathDark  (dark-colored logo readable on light backgrounds)
function logoForTheme(
  theme: "dark" | "light" | "default",
  branding: EffectiveBranding
): string | null {
  if (theme === "light") return branding.logoPathDark  ?? branding.logoPath ?? null;
  if (theme === "dark")  return branding.logoPathLight ?? branding.logoPath ?? null;
  return branding.logoPath ?? null;
}

// Per-slide carousel-override color set for a given theme.
function carOvForTheme(
  theme: "dark" | "light" | "default",
  carouselOverride: { colors?: Partial<BrandColors>; colorsLight?: Partial<BrandColors> } | undefined
): Partial<BrandColors> | undefined {
  if (theme === "light") return carouselOverride?.colorsLight;
  return carouselOverride?.colors; // dark + default both use the primary color override slot
}

// Per-slide style-override color set for a given theme.
function slideColorOvForTheme(
  theme: "dark" | "light" | "default",
  styleOverride: { colors?: Partial<BrandColors>; colorsDark?: Partial<BrandColors>; colorsLight?: Partial<BrandColors> } | undefined
): Partial<BrandColors> | undefined {
  if (theme === "light") return styleOverride?.colorsLight;
  if (theme === "dark")  return styleOverride?.colorsDark ?? styleOverride?.colors;
  return styleOverride?.colors;
}

export function computeSlideRendererProps(
  branding: EffectiveBranding,
  carousel: Carousel,
  slide: Slide
): SlideRendererProps {
  const carouselOverride = carousel.brandingOverride;
  const overrideFonts = carouselOverride?.fonts;

  // When there is no explicit branding intent on the carousel or slide, the baked-in
  // HTML colors are authoritative. Only inject the logo — skip color substitution.
  if (!carouselOverride && !slide.styleOverride) {
    // Pick the logo variant that's readable against the slide's actual background.
    const isLight = htmlBrightness(slide.html) > 128;
    const detectedTheme: "light" | "dark" = isLight ? "light" : "dark";
    const logoPath = logoForTheme(detectedTheme, branding);
    const logoPosition = logoPositionForTheme(detectedTheme, branding);
    const logoHeight   = logoHeightForTheme(detectedTheme, branding);
    return {
      logoConfig: logoPath ? { path: logoPath, position: logoPosition, height: logoHeight } : undefined,
    };
  }

  const carouselTheme = carouselOverride?.theme ?? "default";
  const slideTheme: "dark" | "light" | "default" = slide.styleOverride?.theme ?? carouselTheme;

  const baseForSlide  = paletteForTheme(slideTheme, branding);
  const carOvForSlide = carOvForTheme(slideTheme, carouselOverride);
  const sColorOv      = slideColorOvForTheme(slideTheme, slide.styleOverride);

  // Prefer the stored generation palette (set when AI last generated slides) so
  // color substitution keeps working even if the brand palette was updated afterwards.
  const sHtmlBase = carousel.generationPalette
    ?? detectHtmlBase(slide.html, branding.colors, branding.colorsDark, branding.colorsLight);
  const mergedColors = mergeSlideColors(baseForSlide, carOvForSlide, sColorOv);

  // Logo — per-slide per-theme override > theme-based brand variant > generic brand logo
  const brandLogoPosition = logoPositionForTheme(slideTheme, branding);
  const brandLogoHeight   = logoHeightForTheme(slideTheme, branding);
  const logoPosition = slide.styleOverride?.logoPosition ?? carouselOverride?.logoPosition ?? brandLogoPosition;
  const logoHeight   = slide.styleOverride?.logoHeight   ?? carouselOverride?.logoHeight   ?? brandLogoHeight;
  const themeBasedLogoPath = logoForTheme(slideTheme, branding);
  // Each theme has its own slide-level logo override slot so they stay independent.
  const sLogoOverride =
    slideTheme === "light"   ? slide.styleOverride?.logoPathLight
    : slideTheme === "dark"  ? slide.styleOverride?.logoPathDark
    : slide.styleOverride?.logoPath;
  const sLogoPath = sLogoOverride ?? themeBasedLogoPath;

  // Fonts — slide per-theme override > carousel override > per-theme brand fonts
  const brandFonts = fontsForTheme(slideTheme, branding);
  const sFonts =
    slideTheme === "dark"  ? (slide.styleOverride?.fontsDark  ?? slide.styleOverride?.fonts)
    : slideTheme === "light" ? (slide.styleOverride?.fontsLight ?? slide.styleOverride?.fonts)
    : slide.styleOverride?.fonts;
  const activeHeading = sFonts?.heading ?? overrideFonts?.heading ?? brandFonts.heading;
  const activeBody    = sFonts?.body    ?? overrideFonts?.body    ?? brandFonts.body;

  // Determine which brand font was used to author the HTML so substitution has the correct `from`.
  // The detected HTML base palette tells us which brand theme was active at generation time;
  // we use the same theme to resolve the source font rather than always assuming the default font.
  // Note: sHtmlBase is compared by reference only when generationPalette is null (detectHtmlBase
  // returns the actual branding object) — when generationPalette is a copy we fall back to default.
  const htmlAuthFonts =
    sHtmlBase === branding.colorsDark  ? fontsForTheme("dark",  branding)
    : sHtmlBase === branding.colorsLight ? fontsForTheme("light", branding)
    : branding.fonts;

  return {
    colorSubstitution: { from: { ...sHtmlBase }, to: mergedColors },
    accentOverride: mergedColors.accent,
    fontSubstitution: {
      heading: { from: htmlAuthFonts.heading, to: activeHeading },
      body:    { from: htmlAuthFonts.body,    to: activeBody    },
    },
    logoConfig: sLogoPath ? { path: sLogoPath, position: logoPosition, height: logoHeight } : undefined,
  };
}
