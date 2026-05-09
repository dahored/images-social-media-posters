import { detectSlideRootBackground } from "@/lib/slide-html";
import type { LogoConfig, ColorSubstitution, FontSubstitution } from "@/lib/slide-html";
import type { Carousel, Slide, SlideColorSet } from "@/types/carousel";
import type { EffectiveBranding } from "@/types/account";
import type { BrandColors } from "@/types/brand";

export interface SlideRendererProps {
  colorSubstitution?: ColorSubstitution;
  fontSubstitution?: FontSubstitution;
  logoConfig?: LogoConfig;
  customBackground?: string;
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

// Mirrors the editor's detectHtmlBase exactly — only checks brandLight.primary to detect
// light-authored slides. Checking other fields (e.g. background) causes false positives
// when the light palette reuses dark colors in non-primary roles.
function detectHtmlBase(
  html: string | undefined,
  brandDark: BrandColors,
  brandLight?: BrandColors
): BrandColors {
  if (!html) return brandDark;
  const bg = detectSlideRootBackground(html)?.toLowerCase();
  if (bg && brandLight?.primary && bg === brandLight.primary.toLowerCase()) return brandLight;
  return brandDark;
}

/**
 * Computes SlideRenderer/FullscreenPreview props for a single slide using the same logic
 * as the carousel editor's filmstrip thumbnail computation. Use this in all card preview
 * contexts so they stay in sync with the editor.
 */
export function computeSlideRendererProps(
  branding: EffectiveBranding,
  carousel: Carousel,
  slide: Slide
): SlideRendererProps {
  const brandDark = branding.colors;
  const brandLight = branding.colorsLight;
  const brandFonts = branding.fonts;
  const carouselOverride = carousel.brandingOverride;
  const overrideFonts = carouselOverride?.fonts;

  const carouselTheme = carouselOverride?.theme ?? "dark";
  const slideTheme: "dark" | "light" = slide.styleOverride?.theme ?? carouselTheme;

  const baseForSlide = slideTheme === "dark" ? brandDark : (brandLight ?? brandDark);
  const carOvForSlide = slideTheme === "dark"
    ? carouselOverride?.colors
    : carouselOverride?.colorsLight;
  const sColorOv = slideTheme === "dark"
    ? slide.styleOverride?.colors
    : slide.styleOverride?.colorsLight;

  const sHtmlBase = detectHtmlBase(slide.html, brandDark, brandLight);
  const mergedColors = mergeSlideColors(baseForSlide, carOvForSlide, sColorOv);

  // Logo — per-slide override > theme-based brand variant > generic brand logo
  const logoPosition = slide.styleOverride?.logoPosition ?? carouselOverride?.logoPosition ?? branding.logoPosition ?? "bottom-center";
  const logoHeight   = slide.styleOverride?.logoHeight   ?? carouselOverride?.logoHeight   ?? branding.logoHeight   ?? 72;
  const themeBasedLogoPath = slideTheme === "dark"
    ? (branding.logoPathLight ?? branding.logoPath ?? null)
    : (branding.logoPathDark  ?? branding.logoPath ?? null);
  const sLogoOverride = slideTheme === "dark"
    ? slide.styleOverride?.logoPath
    : slide.styleOverride?.logoPathLight;
  const sLogoPath = sLogoOverride ?? themeBasedLogoPath;

  // Fonts — slide override > carousel override > brand
  const sFonts = slide.styleOverride?.fonts;
  const activeHeading = sFonts?.heading ?? overrideFonts?.heading ?? brandFonts.heading;
  const activeBody    = sFonts?.body    ?? overrideFonts?.body    ?? brandFonts.body;

  return {
    colorSubstitution: { from: { ...sHtmlBase }, to: mergedColors },
    accentOverride: mergedColors.accent,
    customBackground: slide.styleOverride?.customBackground,
    fontSubstitution: {
      heading: { from: brandFonts.heading, to: activeHeading },
      body:    { from: brandFonts.body,    to: activeBody    },
    },
    logoConfig: sLogoPath ? { path: sLogoPath, position: logoPosition, height: logoHeight } : undefined,
  };
}
