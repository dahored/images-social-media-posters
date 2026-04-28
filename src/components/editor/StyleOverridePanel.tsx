"use client";

import { useEffect, useState } from "react";
import { X, Moon, Sun, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { ColorPicker } from "@/components/brand/ColorPicker";
import { FontSelector, loadGoogleFont } from "@/components/brand/FontSelector";
import type { CarouselBrandingOverride } from "@/types/carousel";
import type { LogoPosition } from "@/types/brand";

const LOGO_POSITIONS: { value: LogoPosition; Icon: React.ElementType }[] = [
  { value: "bottom-left",   Icon: AlignLeft },
  { value: "bottom-center", Icon: AlignCenter },
  { value: "bottom-right",  Icon: AlignRight },
];

type ColorSet = { primary: string; secondary: string; accent: string; background: string; surface: string };
type FontSet = { heading: string; body: string };

interface StyleOverridePanelProps {
  brandColors: ColorSet;
  brandColorsLight?: ColorSet;
  brandFonts: FontSet;
  override: CarouselBrandingOverride;
  onChange: (override: CarouselBrandingOverride) => void;
  onClose: () => void;
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

export function StyleOverridePanel({
  brandColors,
  brandColorsLight,
  brandFonts,
  override,
  onChange,
  onClose,
}: StyleOverridePanelProps) {
  const [themeTab, setThemeTab] = useState<"dark" | "light">("dark");

  const baseDark  = brandColors;
  const baseLight = brandColorsLight ?? DEFAULT_LIGHT;

  const effectiveHeading = override.fonts?.heading ?? brandFonts.heading;
  const effectiveBody    = override.fonts?.body    ?? brandFonts.body;

  useEffect(() => { if (effectiveHeading) loadGoogleFont(effectiveHeading); }, [effectiveHeading]);
  useEffect(() => { if (effectiveBody)    loadGoogleFont(effectiveBody);    }, [effectiveBody]);

  const handleColorChange = (key: keyof ColorSet, value: string) => {
    if (themeTab === "dark") {
      onChange({ ...override, colors: { ...override.colors, [key]: value } });
    } else {
      onChange({ ...override, colorsLight: { ...override.colorsLight, [key]: value } });
    }
  };

  const handleFontChange = (key: "heading" | "body", value: string) => {
    onChange({ ...override, fonts: { ...override.fonts, [key]: value } });
  };

  const activeBase     = themeTab === "dark" ? baseDark   : baseLight;
  const activeOverride = themeTab === "dark" ? override.colors : override.colorsLight;

  return (
    <div className="w-72 border-l border-border shrink-0 flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <span className="text-sm font-semibold">Estilo del post</span>
        <div className="flex items-center gap-2">
          {hasActiveOverrides(override) && (
            <button
              onClick={() => onChange({})}
              className="text-xs text-muted-foreground hover:text-accent transition-colors cursor-pointer"
            >
              Restaurar marca
            </button>
          )}
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

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
            {COLOR_FIELDS.map(({ key, label }) => (
              <ColorPicker
                key={`${themeTab}-${key}`}
                label={label}
                value={activeOverride?.[key] ?? activeBase[key]}
                onChange={(v) => handleColorChange(key, v)}
              />
            ))}
          </div>
        </section>

        {/* Fonts — shared across both themes */}
        <section>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Fuentes</h3>
          <div className="flex flex-col gap-4">
            <FontSelector label="Título" value={effectiveHeading} onChange={(v) => handleFontChange("heading", v)} />
            <FontSelector label="Cuerpo" value={effectiveBody}    onChange={(v) => handleFontChange("body",    v)} />
          </div>
        </section>

        {/* Logo */}
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
      </div>
    </div>
  );
}
