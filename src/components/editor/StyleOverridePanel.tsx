"use client";

import { useEffect, useState } from "react";
import { X, Moon, Sun, AlignLeft, AlignCenter, AlignRight, Layers, Square } from "lucide-react";
import { ColorPicker } from "@/components/brand/ColorPicker";
import { FontSelector, loadGoogleFont } from "@/components/brand/FontSelector";
import type { CarouselBrandingOverride, Slide, SlideColorSet } from "@/types/carousel";
import type { LogoPosition } from "@/types/brand";

const LOGO_POSITIONS: { value: LogoPosition; Icon: React.ElementType }[] = [
  { value: "bottom-left",   Icon: AlignLeft },
  { value: "bottom-center", Icon: AlignCenter },
  { value: "bottom-right",  Icon: AlignRight },
];

type ColorSet = { primary: string; secondary: string; accent: string; background: string; surface: string };
type FontSet = { heading: string; body: string };

/** Which scope the panel is editing */
type PanelMode = "carousel" | "slide";

interface StyleOverridePanelProps {
  brandColors: ColorSet;
  brandColorsLight?: ColorSet;
  brandFonts: FontSet;
  override: CarouselBrandingOverride;
  onChange: (override: CarouselBrandingOverride) => void;
  onClose: () => void;
  /** If provided, the panel shows a "Carousel / Este slide" toggle */
  activeSlide?: Slide;
  onSlideOverrideChange?: (slideId: string, override: NonNullable<Slide["styleOverride"]>) => void;
}

const DEFAULT_LIGHT: ColorSet = {
  primary: "#ffffff", secondary: "#f0f0f0", accent: "#7f22fe",
  background: "#1a1a2e", surface: "#f8f8f8",
};

const COLOR_FIELDS: Array<{ key: keyof ColorSet; label: string }> = [
  { key: "primary",    label: "Fondo del slide" },
  { key: "secondary",  label: "Tono secundario" },
  { key: "accent",     label: "Acento / Énfasis" },
  { key: "background", label: "Color de texto" },
  { key: "surface",    label: "Panel / Superficie" },
];

function hasActiveOverrides(o: CarouselBrandingOverride): boolean {
  const anyColor = (obj?: Record<string, string | undefined>) =>
    obj && Object.values(obj).some((v) => v != null && v !== "");
  return !!(anyColor(o.colors) || anyColor(o.colorsLight) ||
    (o.fonts && Object.values(o.fonts).some((v) => v)));
}

function hasSlideOverrides(slide?: Slide): boolean {
  if (!slide?.styleOverride) return false;
  return (
    Object.values(slide.styleOverride.colors ?? {}).some(Boolean) ||
    Object.values(slide.styleOverride.colorsLight ?? {}).some(Boolean)
  );
}

export function StyleOverridePanel({
  brandColors,
  brandColorsLight,
  brandFonts,
  override,
  onChange,
  onClose,
  activeSlide,
  onSlideOverrideChange,
}: StyleOverridePanelProps) {
  const [themeTab, setThemeTab] = useState<"dark" | "light">("dark");
  const [panelMode, setPanelMode] = useState<PanelMode>("carousel");

  // Reset to carousel mode if there's no active slide
  useEffect(() => {
    if (!activeSlide || !onSlideOverrideChange) {
      setPanelMode("carousel");
    }
  }, [activeSlide, onSlideOverrideChange]);

  const baseDark  = brandColors;
  const baseLight = brandColorsLight ?? DEFAULT_LIGHT;

  const effectiveHeading = override.fonts?.heading ?? brandFonts.heading;
  const effectiveBody    = override.fonts?.body    ?? brandFonts.body;

  useEffect(() => { if (effectiveHeading) loadGoogleFont(effectiveHeading); }, [effectiveHeading]);
  useEffect(() => { if (effectiveBody)    loadGoogleFont(effectiveBody);    }, [effectiveBody]);

  // ── Carousel mode handlers ────────────────────────────────────────────────

  const handleCarouselColorChange = (key: keyof ColorSet, value: string) => {
    if (themeTab === "dark") {
      onChange({ ...override, colors: { ...override.colors, [key]: value } });
    } else {
      onChange({ ...override, colorsLight: { ...override.colorsLight, [key]: value } });
    }
  };

  const handleFontChange = (key: "heading" | "body", value: string) => {
    onChange({ ...override, fonts: { ...override.fonts, [key]: value } });
  };

  // ── Slide mode handlers ───────────────────────────────────────────────────

  const slideOverride = activeSlide?.styleOverride ?? {};

  const handleSlideColorChange = (key: keyof ColorSet, value: string) => {
    if (!activeSlide || !onSlideOverrideChange) return;
    const currentOverride = activeSlide.styleOverride ?? {};
    if (themeTab === "dark") {
      onSlideOverrideChange(activeSlide.id, {
        ...currentOverride,
        colors: { ...currentOverride.colors, [key]: value },
      });
    } else {
      onSlideOverrideChange(activeSlide.id, {
        ...currentOverride,
        colorsLight: { ...currentOverride.colorsLight, [key]: value },
      });
    }
  };

  const handleResetSlideOverride = () => {
    if (!activeSlide || !onSlideOverrideChange) return;
    onSlideOverrideChange(activeSlide.id, {});
  };

  // ── Effective values shown in the color pickers ───────────────────────────

  const carouselActiveOverride = themeTab === "dark" ? override.colors : override.colorsLight;
  const slideActiveOverride: Partial<SlideColorSet> | undefined =
    themeTab === "dark" ? slideOverride.colors : slideOverride.colorsLight;

  const activeBase = themeTab === "dark" ? baseDark : baseLight;

  // For slide mode: fall through slide override → carousel override → brand base
  const resolveSlideColor = (key: keyof ColorSet): string => {
    return (
      slideActiveOverride?.[key] ??
      carouselActiveOverride?.[key] ??
      activeBase[key]
    );
  };

  const showScopeToggle = !!(activeSlide && onSlideOverrideChange);

  return (
    <div className="w-72 border-l border-border shrink-0 flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <span className="text-sm font-semibold">Estilo del post</span>
        <div className="flex items-center gap-2">
          {panelMode === "carousel" && hasActiveOverrides(override) && (
            <button
              onClick={() => onChange({})}
              className="text-xs text-muted-foreground hover:text-accent transition-colors cursor-pointer"
            >
              Restaurar marca
            </button>
          )}
          {panelMode === "slide" && hasSlideOverrides(activeSlide) && (
            <button
              onClick={handleResetSlideOverride}
              className="text-xs text-muted-foreground hover:text-accent transition-colors cursor-pointer"
            >
              Restaurar slide
            </button>
          )}
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scope toggle (only when a slide is active) */}
      {showScopeToggle && (
        <div className="flex items-center gap-0.5 p-1 mx-4 mt-3 bg-muted rounded-lg">
          <button
            onClick={() => setPanelMode("carousel")}
            className={`flex items-center gap-1.5 flex-1 justify-center px-2 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              panelMode === "carousel"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="h-3 w-3" />
            Carousel
          </button>
          <button
            onClick={() => setPanelMode("slide")}
            className={`flex items-center gap-1.5 flex-1 justify-center px-2 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              panelMode === "slide"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Square className="h-3 w-3" />
            Este slide
            {hasSlideOverrides(activeSlide) && (
              <span className="h-1.5 w-1.5 rounded-full bg-accent inline-block" />
            )}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
        {/* Colors */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Colores</h3>
            <div className="flex items-center gap-0.5 p-0.5 bg-muted rounded-md ml-auto">
              <button
                onClick={() => setThemeTab("dark")}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  themeTab === "dark" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Moon className="h-2.5 w-2.5" />
                Oscuro
              </button>
              <button
                onClick={() => setThemeTab("light")}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  themeTab === "light" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sun className="h-2.5 w-2.5" />
                Claro
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {panelMode === "carousel"
              ? COLOR_FIELDS.map(({ key, label }) => (
                  <ColorPicker
                    key={`carousel-${themeTab}-${key}`}
                    label={label}
                    value={carouselActiveOverride?.[key] ?? activeBase[key]}
                    onChange={(v) => handleCarouselColorChange(key, v)}
                  />
                ))
              : COLOR_FIELDS.map(({ key, label }) => (
                  <ColorPicker
                    key={`slide-${themeTab}-${key}`}
                    label={label}
                    value={resolveSlideColor(key)}
                    onChange={(v) => handleSlideColorChange(key, v)}
                  />
                ))
            }
          </div>
        </section>

        {/* Fonts — only in carousel mode (shared across themes) */}
        {panelMode === "carousel" && (
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Fuentes</h3>
            <div className="flex flex-col gap-4">
              <FontSelector label="Título" value={effectiveHeading} onChange={(v) => handleFontChange("heading", v)} />
              <FontSelector label="Cuerpo" value={effectiveBody}    onChange={(v) => handleFontChange("body",    v)} />
            </div>
          </section>
        )}

        {/* Logo — only in carousel mode */}
        {panelMode === "carousel" && (
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Logo</h3>
            <div className="flex items-end gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Posición</label>
                <div className="flex items-center gap-0.5 p-0.5 bg-muted rounded-md">
                  {LOGO_POSITIONS.map(({ value, Icon }) => (
                    <button
                      key={value}
                      onClick={() => onChange({ ...override, logoPosition: value })}
                      className={`flex items-center justify-center h-7 w-7 rounded transition-colors cursor-pointer ${
                        (override.logoPosition ?? "bottom-center") === value
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
                <label className="text-xs text-muted-foreground mb-1.5 block">Altura (px)</label>
                <input
                  type="number"
                  min={24}
                  max={72}
                  value={override.logoHeight ?? 72}
                  onChange={(e) => onChange({ ...override, logoHeight: Math.min(72, Math.max(24, Number(e.target.value))) })}
                  className="w-16 h-7 rounded-md border border-border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </section>
        )}

        {/* Slide mode hint */}
        {panelMode === "slide" && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            Los colores de este slide se fusionan sobre el override del carousel. Fuentes y logo se controlan a nivel carousel.
          </p>
        )}
      </div>
    </div>
  );
}
