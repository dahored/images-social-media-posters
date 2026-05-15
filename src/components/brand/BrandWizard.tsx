"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, Palette, Moon, Sun, Sparkles, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ColorPicker } from "./ColorPicker";
import { FontSelector, loadGoogleFont } from "./FontSelector";
import { LogoUpload } from "./LogoUpload";
import { useI18n } from "@/lib/i18n/context";
import type { Brand, BrandColors, BrandFonts, LogoPosition } from "@/types/brand";

interface BrandWizardProps {
  onComplete: (brand: Brand) => void;
  brandId?: string;
  initialBrand?: Brand;
}

const STYLE_OPTIONS = [
  "minimal", "bold", "playful", "corporate", "luxury",
  "vintage", "modern", "elegant", "creative", "professional",
] as const;
type StyleKeyword = typeof STYLE_OPTIONS[number];
const STYLE_LABEL_KEYS: Record<StyleKeyword, `styleKeyword${Capitalize<StyleKeyword>}`> = {
  minimal: "styleKeywordMinimal", bold: "styleKeywordBold", playful: "styleKeywordPlayful",
  corporate: "styleKeywordCorporate", luxury: "styleKeywordLuxury", vintage: "styleKeywordVintage",
  modern: "styleKeywordModern", elegant: "styleKeywordElegant", creative: "styleKeywordCreative",
  professional: "styleKeywordProfessional",
};

const DEFAULT_COLORS: BrandColors = {
  primary: "#1a1a2e", secondary: "#16213e", accent: "#7f22fe",
  background: "#ffffff", surface: "#f5f5f5",
};
const DEFAULT_COLORS_LIGHT: BrandColors = {
  primary: "#ffffff", secondary: "#f0f0f0", accent: "#7f22fe",
  background: "#1a1a2e", surface: "#f8f8f8",
};
const DEFAULT_FONTS: BrandFonts = { heading: "Inter", body: "Inter" };

const LOGO_POSITIONS: { value: LogoPosition; Icon: React.ElementType }[] = [
  { value: "bottom-left", Icon: AlignLeft },
  { value: "bottom-center", Icon: AlignCenter },
  { value: "bottom-right", Icon: AlignRight },
];

type ThemeTab = "default" | "dark" | "light";

const DEFAULT_DRAFT = {
  name: "",
  colors: DEFAULT_COLORS,
  colorsDark: undefined as BrandColors | undefined,
  colorsLight: DEFAULT_COLORS_LIGHT,
  fonts: DEFAULT_FONTS,
  fontsDark: undefined as BrandFonts | undefined,
  fontsLight: undefined as BrandFonts | undefined,
  logoPath: null as string | null,
  // "dark theme logo" = light-colored logo (readable on dark backgrounds)
  logoPathLight: null as string | null,
  // "light theme logo" = dark-colored logo (readable on light backgrounds)
  logoPathDark: null as string | null,
  logoPosition: "bottom-center" as LogoPosition,
  logoHeight: 72,
  logoPositionDark: undefined as LogoPosition | undefined,
  logoHeightDark: undefined as number | undefined,
  logoPositionLight: undefined as LogoPosition | undefined,
  logoHeightLight: undefined as number | undefined,
  styleKeywords: [] as string[],
};

export function BrandWizard({ onComplete, brandId, initialBrand }: BrandWizardProps) {
  const { t } = useI18n();
  const isEdit = Boolean(brandId);
  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  const [saving, setSaving] = useState(false);
  const [themeTab, setThemeTab] = useState<ThemeTab>("default");

  useEffect(() => {
    loadGoogleFont(draft.fonts.heading);
    loadGoogleFont(draft.fonts.body);
  }, [draft.fonts.heading, draft.fonts.body]);

  useEffect(() => {
    if (initialBrand) {
      setDraft({
        name: initialBrand.name,
        colors: { ...initialBrand.colors },
        colorsDark: initialBrand.colorsDark ? { ...initialBrand.colorsDark } : undefined,
        colorsLight: initialBrand.colorsLight ? { ...initialBrand.colorsLight } : { ...DEFAULT_COLORS_LIGHT },
        fonts: { ...initialBrand.fonts },
        fontsDark: initialBrand.fontsDark ? { ...initialBrand.fontsDark } : undefined,
        fontsLight: initialBrand.fontsLight ? { ...initialBrand.fontsLight } : undefined,
        logoPath: initialBrand.logoPath ?? null,
        logoPathLight: initialBrand.logoPathLight ?? null,
        logoPathDark: initialBrand.logoPathDark ?? null,
        logoPosition: initialBrand.logoPosition ?? "bottom-center",
        logoHeight: initialBrand.logoHeight ?? 72,
        logoPositionDark: initialBrand.logoPositionDark,
        logoHeightDark: initialBrand.logoHeightDark,
        logoPositionLight: initialBrand.logoPositionLight,
        logoHeightLight: initialBrand.logoHeightLight,
        styleKeywords: [...initialBrand.styleKeywords],
      });
    }
  }, [initialBrand]);

  // Resolved values for the active tab (with inheritance from default)
  const activeColors =
    themeTab === "light" ? (draft.colorsLight ?? DEFAULT_COLORS_LIGHT)
    : themeTab === "dark"  ? (draft.colorsDark  ?? DEFAULT_COLORS)
    : draft.colors;

  const activeFonts: BrandFonts =
    themeTab === "light" ? (draft.fontsLight ?? draft.fonts)
    : themeTab === "dark"  ? (draft.fontsDark  ?? draft.fonts)
    : draft.fonts;

  // Which logo path/position/height to show for the current tab
  // Default tab → generic logoPath; Dark tab → light-colored logo (logoPathLight); Light tab → dark-colored logo (logoPathDark)
  const activeLogoPath =
    themeTab === "dark"  ? draft.logoPathLight
    : themeTab === "light" ? draft.logoPathDark
    : draft.logoPath;

  const activeLogoPosition: LogoPosition =
    themeTab === "light" ? (draft.logoPositionLight ?? draft.logoPosition)
    : themeTab === "dark"  ? (draft.logoPositionDark  ?? draft.logoPosition)
    : draft.logoPosition;

  const activeLogoHeight: number =
    themeTab === "light" ? (draft.logoHeightLight ?? draft.logoHeight)
    : themeTab === "dark"  ? (draft.logoHeightDark  ?? draft.logoHeight)
    : draft.logoHeight;

  // Whether dark/light tabs have their own (non-inherited) values
  const hasFontOverride = themeTab === "dark" ? !!draft.fontsDark : themeTab === "light" ? !!draft.fontsLight : true;
  const hasLogoPositionOverride =
    themeTab === "dark"  ? draft.logoPositionDark  !== undefined
    : themeTab === "light" ? draft.logoPositionLight !== undefined
    : true;
  const hasLogoHeightOverride =
    themeTab === "dark"  ? draft.logoHeightDark  !== undefined
    : themeTab === "light" ? draft.logoHeightLight !== undefined
    : true;

  const setColor = (key: keyof BrandColors, value: string) => {
    if (themeTab === "light") {
      setDraft((d) => ({ ...d, colorsLight: { ...(d.colorsLight ?? DEFAULT_COLORS_LIGHT), [key]: value } }));
    } else if (themeTab === "dark") {
      setDraft((d) => ({ ...d, colorsDark: { ...(d.colorsDark ?? DEFAULT_COLORS), [key]: value } }));
    } else {
      setDraft((d) => ({ ...d, colors: { ...d.colors, [key]: value } }));
    }
  };

  const setFont = (key: keyof BrandFonts, value: string) => {
    if (themeTab === "light") {
      setDraft((d) => ({ ...d, fontsLight: { ...(d.fontsLight ?? d.fonts), [key]: value } }));
    } else if (themeTab === "dark") {
      setDraft((d) => ({ ...d, fontsDark: { ...(d.fontsDark ?? d.fonts), [key]: value } }));
    } else {
      setDraft((d) => ({ ...d, fonts: { ...d.fonts, [key]: value } }));
    }
  };

  const clearFontOverride = () => {
    if (themeTab === "dark")  setDraft((d) => ({ ...d, fontsDark:  undefined }));
    if (themeTab === "light") setDraft((d) => ({ ...d, fontsLight: undefined }));
  };

  const setLogoPath = (path: string | null) => {
    if (themeTab === "dark")   setDraft((d) => ({ ...d, logoPathLight: path }));
    else if (themeTab === "light") setDraft((d) => ({ ...d, logoPathDark: path }));
    else setDraft((d) => ({ ...d, logoPath: path }));
  };

  const setLogoPosition = (pos: LogoPosition) => {
    if (themeTab === "dark")   setDraft((d) => ({ ...d, logoPositionDark:  pos }));
    else if (themeTab === "light") setDraft((d) => ({ ...d, logoPositionLight: pos }));
    else setDraft((d) => ({ ...d, logoPosition: pos }));
  };

  const setLogoHeight = (h: number) => {
    if (themeTab === "dark")   setDraft((d) => ({ ...d, logoHeightDark:  h }));
    else if (themeTab === "light") setDraft((d) => ({ ...d, logoHeightLight: h }));
    else setDraft((d) => ({ ...d, logoHeight: h }));
  };

  const clearLogoOverride = () => {
    if (themeTab === "dark") {
      setDraft((d) => ({ ...d, logoPositionDark: undefined, logoHeightDark: undefined }));
    } else if (themeTab === "light") {
      setDraft((d) => ({ ...d, logoPositionLight: undefined, logoHeightLight: undefined }));
    }
  };

  const handleSave = useCallback(async () => {
    if (!draft.name.trim()) return;
    setSaving(true);
    try {
      const url = isEdit ? `/api/brands/${brandId}` : "/api/brands";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (res.ok) {
        const saved: Brand = await res.json();
        onComplete(saved);
      }
    } finally {
      setSaving(false);
    }
  }, [draft, isEdit, brandId, onComplete]);

  // Preview background uses the active theme's primary color
  const previewBg = `radial-gradient(ellipse at 70% 30%, ${activeColors.accent}55 0%, transparent 60%), ${activeColors.primary}`;

  const InheritedBadge = () => (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-normal">
      {t("themeDefault")}
    </span>
  );

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 w-full">
      {/* Title */}
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
          <Palette className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold">{isEdit ? t("editBrand") : t("setupBrand")}</h1>
          <p className="text-sm text-muted-foreground">{t("brandNameHelp")}</p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Name */}
        <section>
          <h2 className="text-sm font-semibold mb-3">{t("stepBrandName")}</h2>
          <Input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder={t("brandNamePlaceholder")}
            className="text-base h-11 max-w-sm"
            autoFocus
          />
        </section>

        <div className="border-t border-border" />

        {/* Theme section: colors + fonts + logo */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-sm font-semibold">{t("theme")}</h2>
            <div className="flex items-center gap-0.5 p-0.5 bg-muted rounded-lg">
              {(["default", "dark", "light"] as ThemeTab[]).map((tab) => {
                const Icon = tab === "default" ? Sparkles : tab === "dark" ? Moon : Sun;
                const label = tab === "default" ? t("themeDefault") : tab === "dark" ? t("themeDark") : t("themeLight");
                return (
                  <button
                    key={tab}
                    onClick={() => setThemeTab(tab)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      themeTab === tab
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 items-start">
            {/* Left: controls */}
            <div className="space-y-6">
              {/* Colors */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t("colors")}</h3>
                <div className="space-y-3">
                  <ColorPicker label={t("primaryColor")}    value={activeColors.primary}    onChange={(v) => setColor("primary",    v)} />
                  <ColorPicker label={t("secondaryColor")}  value={activeColors.secondary}  onChange={(v) => setColor("secondary",  v)} />
                  <ColorPicker label={t("accentColor")}     value={activeColors.accent}     onChange={(v) => setColor("accent",     v)} />
                  <ColorPicker label={t("backgroundColor")} value={activeColors.background} onChange={(v) => setColor("background", v)} />
                  <ColorPicker label={t("surfaceColor")}    value={activeColors.surface}    onChange={(v) => setColor("surface",    v)} />
                </div>
              </div>

              <div className="border-t border-border" />

              {/* Fonts */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("fonts")}</h3>
                  {themeTab !== "default" && !hasFontOverride && <InheritedBadge />}
                  {themeTab !== "default" && hasFontOverride && (
                    <button
                      onClick={clearFontOverride}
                      className="text-[10px] text-muted-foreground hover:text-accent transition-colors cursor-pointer"
                    >
                      ↩ {t("themeDefault")}
                    </button>
                  )}
                </div>
                <div className="space-y-4">
                  <FontSelector label={t("headingFont")} value={activeFonts.heading} onChange={(v) => setFont("heading", v)} />
                  <FontSelector label={t("bodyFont")}    value={activeFonts.body}    onChange={(v) => setFont("body",    v)} />
                </div>
              </div>

              <div className="border-t border-border" />

              {/* Logo */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t("logoSection")}</h3>
                <LogoUpload hideLabel value={activeLogoPath ?? null} onChange={setLogoPath} />

                {/* Position + height */}
                <div className="flex items-end gap-4 mt-4">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <label className="text-xs text-muted-foreground">{t("position")}</label>
                      {themeTab !== "default" && !hasLogoPositionOverride && <InheritedBadge />}
                    </div>
                    <div className="flex items-center gap-0.5 p-0.5 bg-muted rounded-md">
                      {LOGO_POSITIONS.map(({ value, Icon }) => (
                        <button
                          key={value}
                          onClick={() => setLogoPosition(value)}
                          className={`flex items-center justify-center h-8 w-8 rounded transition-colors cursor-pointer ${
                            activeLogoPosition === value
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                          title={value}
                        >
                          <Icon className="h-4 w-4" />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <label className="text-xs text-muted-foreground">{t("logoHeight")}</label>
                      {themeTab !== "default" && !hasLogoHeightOverride && <InheritedBadge />}
                    </div>
                    <input
                      type="number" min={24} max={72}
                      value={activeLogoHeight}
                      onChange={(e) => setLogoHeight(Math.min(72, Math.max(24, Number(e.target.value))))}
                      className="w-20 h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  {themeTab !== "default" && (hasLogoPositionOverride || hasLogoHeightOverride) && (
                    <button
                      onClick={clearLogoOverride}
                      className="text-[10px] text-muted-foreground hover:text-accent transition-colors cursor-pointer pb-2"
                    >
                      ↩ {t("themeDefault")}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Right: live preview */}
            <div
              className="rounded-xl overflow-hidden shadow-lg sticky top-4 flex flex-col justify-between w-full"
              style={{ aspectRatio: "4/5", background: previewBg }}
            >
              <div className="p-4 flex flex-col justify-center flex-1 gap-2">
                <div>
                  <p className="text-[10px] font-semibold tracking-widest uppercase mb-1.5 opacity-60"
                    style={{ color: activeColors.background, fontFamily: activeFonts.body }}>
                    // {draft.name || "Brand"}
                  </p>
                  <div className="w-6 h-px mb-3" style={{ backgroundColor: activeColors.accent }} />
                </div>
                <p className="text-[18px] font-black leading-tight"
                  style={{ color: activeColors.background, fontFamily: activeFonts.heading }}>
                  {t("brandPreviewTagline")}
                </p>
                <p className="text-[11px] leading-relaxed opacity-60 mt-1"
                  style={{ color: activeColors.background, fontFamily: activeFonts.body }}>
                  {t("brandPreviewDesc")}
                </p>
                <div className="w-6 h-px mt-2" style={{ backgroundColor: activeColors.accent }} />
              </div>
              {/* Logo preview */}
              {activeLogoPath && (
                <div className={`px-4 pb-4 flex ${activeLogoPosition === "bottom-center" ? "justify-center" : activeLogoPosition === "bottom-right" ? "justify-end" : "justify-start"}`}>
                  <img
                    src={activeLogoPath}
                    alt="logo"
                    style={{ height: Math.round(activeLogoHeight * 0.35), maxWidth: "70%", objectFit: "contain" }}
                  />
                </div>
              )}
              <div className="px-4 pb-3 flex gap-1">
                {[activeColors.primary, activeColors.secondary, activeColors.accent, activeColors.surface].map((c, i) => (
                  <div key={i} className="h-2.5 w-2.5 rounded-full border border-white/20" style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="border-t border-border" />

        {/* Style keywords */}
        <section>
          <h2 className="text-sm font-semibold mb-1">{t("stepStyle")}</h2>
          <p className="text-xs text-muted-foreground mb-4">{t("brandStyleHelp")}</p>
          <div className="flex flex-wrap gap-2">
            {STYLE_OPTIONS.map((keyword) => (
              <button
                key={keyword}
                onClick={() => {
                  const keywords = draft.styleKeywords.includes(keyword)
                    ? draft.styleKeywords.filter((k) => k !== keyword)
                    : [...draft.styleKeywords, keyword];
                  setDraft({ ...draft, styleKeywords: keywords });
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border cursor-pointer ${
                  draft.styleKeywords.includes(keyword)
                    ? "bg-accent text-accent-foreground border-accent"
                    : "bg-transparent text-foreground border-border hover:border-muted-foreground"
                }`}
              >
                {t(STYLE_LABEL_KEYS[keyword])}
              </button>
            ))}
          </div>
        </section>

        <div className="border-t border-border" />

        <div className="flex justify-end pb-4">
          <Button variant="accent" onClick={handleSave} disabled={saving || !draft.name.trim()}>
            {saving ? t("saving") : (
              <>
                <Check className="h-4 w-4" />
                {isEdit ? t("saveChanges") : t("completeSetup")}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
