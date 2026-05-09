"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Moon, Sun, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
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

const DEFAULT_LIGHT: ColorSet = {
  primary: "#ffffff", secondary: "#f0f0f0", accent: "#7f22fe",
  background: "#1a1a2e", surface: "#f8f8f8",
};

interface StyleOverridePanelProps {
  brandColors: ColorSet;
  brandColorsLight?: ColorSet;
  brandFonts: FontSet;
  /** Carousel-level override — read-only, used only for cascade display (slide > carousel > brand). */
  override: CarouselBrandingOverride;
  onClose: () => void;
  activeSlide?: Slide;
  onSlideOverrideChange?: (slideId: string, override: NonNullable<Slide["styleOverride"]>) => void;
  initialSlideTheme?: "dark" | "light";
  brandLogos?: { path: string; label: string }[];
}

export function StyleOverridePanel({
  brandColors,
  brandColorsLight,
  brandFonts,
  override,
  onClose,
  activeSlide,
  onSlideOverrideChange,
  initialSlideTheme,
  brandLogos,
}: StyleOverridePanelProps) {
  const { t } = useI18n();
  const [themeTab, setThemeTab] = useState<"dark" | "light">(initialSlideTheme ?? "dark");

  useEffect(() => { setThemeTab(initialSlideTheme ?? "dark"); }, [initialSlideTheme]);
  // Reset theme tab when switching slides
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setThemeTab(initialSlideTheme ?? "dark"); }, [activeSlide?.id]);

  const baseDark  = brandColors;
  const baseLight = brandColorsLight ?? DEFAULT_LIGHT;

  // Effective fonts — cascade: slide > carousel > brand (read cascade; editing only goes to slide)
  const carouselHeading = override.fonts?.heading ?? brandFonts.heading;
  const carouselBody    = override.fonts?.body    ?? brandFonts.body;
  const slideEffectiveHeading = activeSlide?.styleOverride?.fonts?.heading ?? carouselHeading;
  const slideEffectiveBody    = activeSlide?.styleOverride?.fonts?.body    ?? carouselBody;

  useEffect(() => { if (slideEffectiveHeading) loadGoogleFont(slideEffectiveHeading); }, [slideEffectiveHeading]);
  useEffect(() => { if (slideEffectiveBody)    loadGoogleFont(slideEffectiveBody);    }, [slideEffectiveBody]);

  const slideOverride = activeSlide?.styleOverride ?? {};

  const handleThemeChange = (tab: "dark" | "light") => {
    setThemeTab(tab);
    if (!activeSlide || !onSlideOverrideChange) return;
    onSlideOverrideChange(activeSlide.id, { ...slideOverride, theme: tab });
  };

  const handleSlideColorChange = (key: keyof ColorSet, value: string) => {
    if (!activeSlide || !onSlideOverrideChange) return;
    if (themeTab === "dark") {
      onSlideOverrideChange(activeSlide.id, { ...slideOverride, colors: { ...slideOverride.colors, [key]: value } });
    } else {
      onSlideOverrideChange(activeSlide.id, { ...slideOverride, colorsLight: { ...slideOverride.colorsLight, [key]: value } });
    }
  };

  const handleSlideFontChange = (key: "heading" | "body", value: string) => {
    if (!activeSlide || !onSlideOverrideChange) return;
    onSlideOverrideChange(activeSlide.id, { ...slideOverride, fonts: { ...slideOverride.fonts, [key]: value } });
  };

  const handleSlideLogoChange = (path: string | null) => {
    if (!activeSlide || !onSlideOverrideChange) return;
    if (themeTab === "dark") {
      onSlideOverrideChange(activeSlide.id, { ...slideOverride, logoPath: path ?? undefined });
    } else {
      onSlideOverrideChange(activeSlide.id, { ...slideOverride, logoPathLight: path ?? undefined });
    }
  };

  const handleSlideCustomBgChange = (value: string) => {
    if (!activeSlide || !onSlideOverrideChange) return;
    onSlideOverrideChange(activeSlide.id, { ...slideOverride, customBackground: value });
  };

  const handleClearCustomBg = () => {
    if (!activeSlide || !onSlideOverrideChange) return;
    const { customBackground: _, ...rest } = slideOverride;
    onSlideOverrideChange(activeSlide.id, rest);
  };

  const handleResetSlide = () => {
    if (!activeSlide || !onSlideOverrideChange) return;
    onSlideOverrideChange(activeSlide.id, {});
  };

  const detectedBg = useMemo(
    () => (activeSlide ? detectSlideRootBackground(activeSlide.html) : null),
    [activeSlide?.html] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Cascade display values: slide override > carousel override > brand base
  const carouselActiveOverride = themeTab === "dark" ? override.colors : override.colorsLight;
  const slideActiveOverride: Partial<SlideColorSet> | undefined =
    themeTab === "dark" ? slideOverride.colors : slideOverride.colorsLight;
  const activeBase = themeTab === "dark" ? baseDark : baseLight;

  const resolveSlideColor = (key: keyof ColorSet): string =>
    slideActiveOverride?.[key] ?? carouselActiveOverride?.[key] ?? activeBase[key];

  const colorFieldKeys: Array<{ key: keyof ColorSet; translationKey: "slideColorPrimary" | "slideColorSecondary" | "slideColorAccent" | "slideColorBackground" | "slideColorSurface" }> = [
    { key: "primary",    translationKey: "slideColorPrimary" },
    { key: "secondary",  translationKey: "slideColorSecondary" },
    { key: "accent",     translationKey: "slideColorAccent" },
    { key: "background", translationKey: "slideColorBackground" },
    { key: "surface",    translationKey: "slideColorSurface" },
  ];

  return (
    <div className="w-72 border-l border-border shrink-0 flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <span className="text-sm font-semibold">{t("slideStyle")}</span>
        <div className="flex items-center gap-2">
          {activeSlide && onSlideOverrideChange && (
            <button
              onClick={handleResetSlide}
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
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("colors")}</h3>
              <div className="flex items-center gap-0.5 p-0.5 bg-muted rounded-md ml-auto">
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

          {/* Custom background */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t("customBackground")}</h3>
            <ColorPicker
              label={t("slideCustomBgColor")}
              value={slideOverride.customBackground ?? detectedBg ?? "#000000"}
              onChange={handleSlideCustomBgChange}
            />
            {slideOverride.customBackground && (
              <button
                onClick={handleClearCustomBg}
                className="mt-2 text-xs text-muted-foreground hover:text-accent transition-colors cursor-pointer"
              >
                {t("slideRestoreOriginalBg")}
              </button>
            )}
          </section>

          {/* Logo */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t("logoSection")}</h3>

            {/* Logo variant (only when multiple options exist) */}
            {brandLogos && brandLogos.length > 1 && (
              <div className="mb-3">
                <label className="text-xs text-muted-foreground mb-1.5 block">{t("variant")}</label>
                <div className="flex flex-wrap gap-2">
                  {brandLogos.map(({ path, label }) => {
                    const currentLogoPath = themeTab === "dark" ? slideOverride.logoPath : slideOverride.logoPathLight;
                    const isSelected = currentLogoPath === path;
                    return (
                      <button
                        key={path}
                        onClick={() => handleSlideLogoChange(isSelected ? null : path)}
                        title={label}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-colors cursor-pointer ${
                          isSelected
                            ? "border-accent bg-accent/5"
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
                {(themeTab === "dark" ? slideOverride.logoPath : slideOverride.logoPathLight) && (
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
