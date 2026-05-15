"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Moon, Sun, Sparkles, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { ColorPicker } from "@/components/brand/ColorPicker";
import { FontSelector, loadGoogleFont } from "@/components/brand/FontSelector";
import { detectSlideRootBackground } from "@/lib/slide-html";
import { useI18n } from "@/lib/i18n/context";
import type { CarouselBrandingOverride, Slide, SlideColorSet } from "@/types/carousel";
import type { LogoPosition } from "@/types/brand";

const LOGO_POSITIONS: { value: LogoPosition; Icon: React.ElementType }[] = [
  { value: "bottom-left",   Icon: AlignLeft },
  { value: "bottom-center", Icon: AlignCenter },
  { value: "bottom-right",  Icon: AlignRight },
];

type ColorSet = { primary: string; secondary: string; accent: string; background: string; surface: string };
type FontSet = { heading: string; body: string };
type LogoOption = { path: string; label: string };

const DEFAULT_LIGHT: ColorSet = {
  primary: "#ffffff", secondary: "#f0f0f0", accent: "#7f22fe",
  background: "#1a1a2e", surface: "#f8f8f8",
};

/** Per-theme logo options. Each key is optional — only show picker when there are options. */
export interface ThemeLogos {
  default?: LogoOption[];
  dark?: LogoOption[];
  light?: LogoOption[];
}

/**
 * Per-theme auto-selected logo path — mirrors logoForTheme() in slide-renderer-props.ts.
 * Used so the picker can highlight the correct brand default (not just the first option).
 */
export interface BrandDefaultLogoPaths {
  default?: string;
  dark?: string;
  light?: string;
}

interface StyleOverridePanelProps {
  brandColors: ColorSet;
  brandColorsDark?: ColorSet;
  brandColorsLight?: ColorSet;
  brandFonts: FontSet;
  brandFontsDark?: FontSet;
  brandFontsLight?: FontSet;
  /** Per-theme logo options (replaces old flat brandLogos array). */
  themeLogos?: ThemeLogos;
  /** Auto-selected logo path per theme — mirrors logoForTheme(). Used to highlight correct brand default in picker. */
  brandDefaultLogoPaths?: BrandDefaultLogoPaths;
  /** Carousel-level override — read-only, used only for cascade display (slide > carousel > brand). */
  override: CarouselBrandingOverride;
  onClose: () => void;
  activeSlide?: Slide;
  onSlideOverrideChange?: (slideId: string, override: NonNullable<Slide["styleOverride"]>) => void;
  initialSlideTheme?: "dark" | "light" | "default";
}

export function StyleOverridePanel({
  brandColors,
  brandColorsDark,
  brandColorsLight,
  brandFonts,
  brandFontsDark,
  brandFontsLight,
  themeLogos,
  brandDefaultLogoPaths,
  override,
  onClose,
  activeSlide,
  onSlideOverrideChange,
  initialSlideTheme,
}: StyleOverridePanelProps) {
  const { t } = useI18n();
  const [themeTab, setThemeTab] = useState<"dark" | "light" | "default">(initialSlideTheme ?? "default");

  useEffect(() => { setThemeTab(initialSlideTheme ?? "default"); }, [initialSlideTheme]);
  // Reset theme tab when switching slides
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setThemeTab(initialSlideTheme ?? "default"); }, [activeSlide?.id]);

  const baseDefault = brandColors;
  const baseDark    = brandColorsDark ?? brandColors;
  const baseLight   = brandColorsLight ?? DEFAULT_LIGHT;

  // Per-theme brand fonts — used as fallback in the cascade so switching tabs
  // immediately reflects the brand's configured font for that theme.
  const brandFontsForTab =
    themeTab === "light" ? (brandFontsLight ?? brandFonts)
    : themeTab === "dark"  ? (brandFontsDark  ?? brandFonts)
    : brandFonts;

  // Effective fonts — cascade: slide per-theme > carousel > per-theme brand
  const carouselHeading = override.fonts?.heading ?? brandFontsForTab.heading;
  const carouselBody    = override.fonts?.body    ?? brandFontsForTab.body;
  const slideFontsForTab =
    themeTab === "dark"  ? (activeSlide?.styleOverride?.fontsDark  ?? activeSlide?.styleOverride?.fonts)
    : themeTab === "light" ? (activeSlide?.styleOverride?.fontsLight ?? activeSlide?.styleOverride?.fonts)
    : activeSlide?.styleOverride?.fonts;
  const slideEffectiveHeading = slideFontsForTab?.heading ?? carouselHeading;
  const slideEffectiveBody    = slideFontsForTab?.body    ?? carouselBody;

  useEffect(() => { if (slideEffectiveHeading) loadGoogleFont(slideEffectiveHeading); }, [slideEffectiveHeading]);
  useEffect(() => { if (slideEffectiveBody)    loadGoogleFont(slideEffectiveBody);    }, [slideEffectiveBody]);

  const slideOverride = activeSlide?.styleOverride ?? {};

  const handleThemeChange = (tab: "dark" | "light" | "default") => {
    setThemeTab(tab);
    if (!activeSlide || !onSlideOverrideChange) return;
    onSlideOverrideChange(activeSlide.id, { ...slideOverride, theme: tab });
  };

  const handleSlideColorChange = (key: keyof ColorSet, value: string) => {
    if (!activeSlide || !onSlideOverrideChange) return;
    if (themeTab === "light") {
      onSlideOverrideChange(activeSlide.id, { ...slideOverride, colorsLight: { ...slideOverride.colorsLight, [key]: value } });
    } else if (themeTab === "dark") {
      onSlideOverrideChange(activeSlide.id, { ...slideOverride, colorsDark: { ...slideOverride.colorsDark, [key]: value } });
    } else {
      onSlideOverrideChange(activeSlide.id, { ...slideOverride, colors: { ...slideOverride.colors, [key]: value } });
    }
  };

  const handleSlideFontChange = (key: "heading" | "body", value: string) => {
    if (!activeSlide || !onSlideOverrideChange) return;
    if (themeTab === "light") {
      onSlideOverrideChange(activeSlide.id, { ...slideOverride, fontsLight: { ...slideOverride.fontsLight, [key]: value } });
    } else if (themeTab === "dark") {
      onSlideOverrideChange(activeSlide.id, { ...slideOverride, fontsDark: { ...slideOverride.fontsDark, [key]: value } });
    } else {
      onSlideOverrideChange(activeSlide.id, { ...slideOverride, fonts: { ...slideOverride.fonts, [key]: value } });
    }
  };

  const handleSlideLogoChange = (path: string | null) => {
    if (!activeSlide || !onSlideOverrideChange) return;
    if (themeTab === "light") {
      onSlideOverrideChange(activeSlide.id, { ...slideOverride, logoPathLight: path ?? undefined });
    } else if (themeTab === "dark") {
      onSlideOverrideChange(activeSlide.id, { ...slideOverride, logoPathDark: path ?? undefined });
    } else {
      onSlideOverrideChange(activeSlide.id, { ...slideOverride, logoPath: path ?? undefined });
    }
  };

  // Restore only the active theme's overrides — colors, fonts, logo — leaving other themes intact.
  // Explicitly sets next.theme = themeTab to avoid stale-closure races where slideOverride
  // still holds the previous theme from before the tab switch re-renders the parent.
  const handleResetTheme = () => {
    if (!activeSlide || !onSlideOverrideChange) return;
    const next = { ...slideOverride } as NonNullable<Slide["styleOverride"]>;
    next.theme = themeTab;
    if (themeTab === "default") {
      delete next.colors;
      delete next.fonts;
      delete next.logoPath;
    } else if (themeTab === "dark") {
      delete next.colorsDark;
      delete next.fontsDark;
      delete next.logoPathDark;
    } else {
      delete next.colorsLight;
      delete next.fontsLight;
      delete next.logoPathLight;
    }
    onSlideOverrideChange(activeSlide.id, next);
  };

  const detectedBg = useMemo(
    () => (activeSlide ? detectSlideRootBackground(activeSlide.html) : null),
    [activeSlide?.html] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Cascade display values: slide override > carousel override > brand base
  const carouselActiveOverride = themeTab === "light" ? override.colorsLight : override.colors;
  const slideActiveOverride: Partial<SlideColorSet> | undefined =
    themeTab === "light" ? slideOverride.colorsLight
    : themeTab === "dark" ? (slideOverride.colorsDark ?? slideOverride.colors)
    : slideOverride.colors;
  const activeBase = themeTab === "light" ? baseLight : themeTab === "dark" ? baseDark : baseDefault;

  const resolveSlideColor = (key: keyof ColorSet): string =>
    slideActiveOverride?.[key] ?? carouselActiveOverride?.[key] ?? activeBase[key];

  // Logos relevant to the currently-active theme tab
  const activeLogoOptions: LogoOption[] = themeLogos?.[themeTab] ?? [];
  // Explicit slide-level override for this theme (undefined = no override set)
  const logoOverridePath =
    themeTab === "light" ? slideOverride.logoPathLight
    : themeTab === "dark" ? slideOverride.logoPathDark
    : slideOverride.logoPath;
  // Brand-default for this theme — mirrors logoForTheme() in slide-renderer-props.ts.
  // Use explicit brandDefaultLogoPaths when provided; fall back to first option for backwards compat.
  const brandFallbackLogoPath = brandDefaultLogoPaths?.[themeTab] ?? activeLogoOptions[0]?.path;
  // Effective logo: explicit override takes priority, otherwise show what the brand provides.
  const effectiveLogoPath = logoOverridePath ?? brandFallbackLogoPath;

  const colorFieldKeys: Array<{ key: keyof ColorSet; translationKey: "slideColorPrimary" | "slideColorSecondary" | "slideColorAccent" | "slideColorBackground" | "slideColorSurface" }> = [
    { key: "primary",    translationKey: "slideColorPrimary" },
    { key: "secondary",  translationKey: "slideColorSecondary" },
    { key: "accent",     translationKey: "slideColorAccent" },
    { key: "background", translationKey: "slideColorBackground" },
    { key: "surface",    translationKey: "slideColorSurface" },
  ];

  // Suppress unused-variable warning for detectedBg
  void detectedBg;

  return (
    <div className="w-72 border-l border-border shrink-0 flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <span className="text-sm font-semibold">{t("slideStyle")}</span>
        <div className="flex items-center gap-2">
          {activeSlide && onSlideOverrideChange && (
            <button
              onClick={handleResetTheme}
              className="text-xs text-muted-foreground hover:text-accent transition-colors cursor-pointer"
            >
              {t("slideStyleRestore")}
            </button>
          )}
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!activeSlide ? (
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <p className="text-sm text-muted-foreground">{t("slideSelectPrompt")}</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
          {/* Colors */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t("colors")}</h3>
            <div className="mb-3">
              <div className="flex items-center gap-0.5 p-0.5 bg-muted rounded-md">
                <button
                  onClick={() => handleThemeChange("default")}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    themeTab === "default" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Sparkles className="h-2.5 w-2.5" />
                  {t("themeDefault")}
                </button>
                <button
                  onClick={() => handleThemeChange("dark")}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    themeTab === "dark" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Moon className="h-2.5 w-2.5" />
                  {t("slideThemeDark")}
                </button>
                <button
                  onClick={() => handleThemeChange("light")}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    themeTab === "light" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Sun className="h-2.5 w-2.5" />
                  {t("slideThemeLight")}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {colorFieldKeys.map(({ key, translationKey }) => (
                <ColorPicker
                  key={`slide-${themeTab}-${key}`}
                  label={t(translationKey)}
                  value={resolveSlideColor(key)}
                  onChange={(v) => handleSlideColorChange(key, v)}
                />
              ))}
            </div>
          </section>

          {/* Fonts */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t("fonts")}</h3>
            <div className="flex flex-col gap-4">
              <FontSelector label={t("slideFontHeading")} value={slideEffectiveHeading} onChange={(v) => handleSlideFontChange("heading", v)} />
              <FontSelector label={t("slideFontBody")}    value={slideEffectiveBody}    onChange={(v) => handleSlideFontChange("body",    v)} />
            </div>
          </section>

          {/* Logo */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t("logoSection")}</h3>

            {/* Logo variant — show picker whenever there are options for this theme */}
            {activeLogoOptions.length > 0 && (
              <div className="mb-3">
                <label className="text-xs text-muted-foreground mb-1.5 block">{t("variant")}</label>
                <div className="flex flex-wrap gap-2">
                  {activeLogoOptions.map(({ path, label }) => {
                    const isEffective = effectiveLogoPath === path;
                    const isOverride  = logoOverridePath  === path;
                    return (
                      <button
                        key={path}
                        onClick={() => handleSlideLogoChange(isOverride ? null : path)}
                        title={label}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-colors cursor-pointer ${
                          isOverride
                            ? "border-accent bg-accent/5"
                            : isEffective
                              ? "border-accent/40 bg-accent/5"
                              : "border-border hover:border-muted-foreground/50"
                        }`}
                      >
                        <div className="w-16 h-8 flex items-center justify-center bg-muted/50 rounded">
                          <img src={path} alt={label} className="max-h-7 max-w-full object-contain" />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{label}</span>
                      </button>
                    );
                  })}
                </div>
                {logoOverridePath && (
                  <button
                    onClick={() => handleSlideLogoChange(null)}
                    className="mt-2 text-xs text-muted-foreground hover:text-accent transition-colors cursor-pointer"
                  >
                    {t("slideRestoreAutoLogo")}
                  </button>
                )}
              </div>
            )}

            {/* Position and height */}
            <div className="flex items-end gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">{t("position")}</label>
                <div className="flex items-center gap-0.5 p-0.5 bg-muted rounded-md">
                  {LOGO_POSITIONS.map(({ value, Icon }) => (
                    <button
                      key={value}
                      onClick={() => {
                        if (!activeSlide || !onSlideOverrideChange) return;
                        onSlideOverrideChange(activeSlide.id, { ...slideOverride, logoPosition: value });
                      }}
                      className={`flex items-center justify-center h-7 w-7 rounded transition-colors cursor-pointer ${
                        (slideOverride.logoPosition ?? "bottom-center") === value
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      title={value}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">{t("logoHeight")}</label>
                <input
                  type="number"
                  min={24}
                  max={120}
                  value={slideOverride.logoHeight ?? 72}
                  onChange={(e) => {
                    if (!activeSlide || !onSlideOverrideChange) return;
                    onSlideOverrideChange(activeSlide.id, {
                      ...slideOverride,
                      logoHeight: Math.min(120, Math.max(24, Number(e.target.value))),
                    });
                  }}
                  className="w-16 h-7 rounded-md border border-border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
