"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, Palette, Moon, Sun, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ColorPicker } from "./ColorPicker";
import { FontSelector, loadGoogleFont } from "./FontSelector";
import { LogoUpload } from "./LogoUpload";
import { useI18n } from "@/lib/i18n/context";
import type { Brand, BrandColors, LogoPosition } from "@/types/brand";

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
  minimal: "styleKeywordMinimal",
  bold: "styleKeywordBold",
  playful: "styleKeywordPlayful",
  corporate: "styleKeywordCorporate",
  luxury: "styleKeywordLuxury",
  vintage: "styleKeywordVintage",
  modern: "styleKeywordModern",
  elegant: "styleKeywordElegant",
  creative: "styleKeywordCreative",
  professional: "styleKeywordProfessional",
};

const DEFAULT_COLORS_DARK: BrandColors = {
  primary: "#1a1a2e",
  secondary: "#16213e",
  accent: "#7f22fe",
  background: "#ffffff",
  surface: "#f5f5f5",
};

const DEFAULT_COLORS_LIGHT: BrandColors = {
  primary: "#ffffff",
  secondary: "#f0f0f0",
  accent: "#7f22fe",
  background: "#1a1a2e",
  surface: "#f8f8f8",
};

const LOGO_POSITIONS: { value: LogoPosition; Icon: React.ElementType }[] = [
  { value: "bottom-left", Icon: AlignLeft },
  { value: "bottom-center", Icon: AlignCenter },
  { value: "bottom-right", Icon: AlignRight },
];

const DEFAULT_DRAFT = {
  name: "",
  colors: DEFAULT_COLORS_DARK,
  colorsLight: DEFAULT_COLORS_LIGHT,
  fonts: { heading: "Inter", body: "Inter" },
  logoPath: null as string | null,
  logoPathDark: null as string | null,
  logoPathLight: null as string | null,
  logoPosition: "bottom-center" as LogoPosition,
  logoHeight: 72,
  styleKeywords: [] as string[],
};

export function BrandWizard({ onComplete, brandId, initialBrand }: BrandWizardProps) {
  const { t } = useI18n();
  const isEdit = Boolean(brandId);
  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  const [saving, setSaving] = useState(false);
  const [themeTab, setThemeTab] = useState<"dark" | "light">("dark");

  useEffect(() => {
    loadGoogleFont(draft.fonts.heading);
    loadGoogleFont(draft.fonts.body);
  }, [draft.fonts.heading, draft.fonts.body]);

  useEffect(() => {
    if (initialBrand) {
      setDraft({
        name: initialBrand.name,
        colors: { ...initialBrand.colors },
        colorsLight: initialBrand.colorsLight ? { ...initialBrand.colorsLight } : { ...DEFAULT_COLORS_LIGHT },
        fonts: { ...initialBrand.fonts },
        logoPath: initialBrand.logoPath ?? null,
        logoPathDark: initialBrand.logoPathDark ?? initialBrand.logoPath ?? null,
        logoPathLight: initialBrand.logoPathLight ?? null,
        logoPosition: initialBrand.logoPosition ?? "bottom-center",
        logoHeight: initialBrand.logoHeight ?? 72,
        styleKeywords: [...initialBrand.styleKeywords],
      });
    }
  }, [initialBrand]);

  const activeColors = themeTab === "dark" ? draft.colors : (draft.colorsLight ?? DEFAULT_COLORS_LIGHT);

  const setColor = (key: keyof BrandColors, value: string) => {
    if (themeTab === "dark") {
      setDraft((d) => ({ ...d, colors: { ...d.colors, [key]: value } }));
    } else {
      setDraft((d) => ({ ...d, colorsLight: { ...(d.colorsLight ?? DEFAULT_COLORS_LIGHT), [key]: value } }));
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

  const previewColors = activeColors;

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 w-full">
      {/* Page title */}
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

        {/* Colors + Fonts */}
        <section>
          {/* Theme toggle */}
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-sm font-semibold">{t("stepColors")}</h2>
            <div className="flex items-center gap-0.5 p-0.5 bg-muted rounded-lg">
              <button
                onClick={() => setThemeTab("dark")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  themeTab === "dark"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Moon className="h-3 w-3" />
                {t("themeDark")}
              </button>
              <button
                onClick={() => setThemeTab("light")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  themeTab === "light"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sun className="h-3 w-3" />
                {t("themeLight")}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 items-start">
            {/* Left: colors then fonts */}
            <div className="space-y-6">
              <div className="space-y-3">
                <ColorPicker label={t("primaryColor")} value={activeColors.primary}
                  onChange={(v) => setColor("primary", v)} />
                <ColorPicker label={t("secondaryColor")} value={activeColors.secondary}
                  onChange={(v) => setColor("secondary", v)} />
                <ColorPicker label={t("accentColor")} value={activeColors.accent}
                  onChange={(v) => setColor("accent", v)} />
                <ColorPicker label={t("backgroundColor")} value={activeColors.background}
                  onChange={(v) => setColor("background", v)} />
                <ColorPicker label={t("surfaceColor")} value={activeColors.surface}
                  onChange={(v) => setColor("surface", v)} />
              </div>

              <div>
                <h2 className="text-sm font-semibold mb-4">{t("stepFonts")}</h2>
                <div className="space-y-4">
                  <FontSelector label={t("headingFont")} value={draft.fonts.heading}
                    onChange={(v) => setDraft({ ...draft, fonts: { ...draft.fonts, heading: v } })} />
                  <FontSelector label={t("bodyFont")} value={draft.fonts.body}
                    onChange={(v) => setDraft({ ...draft, fonts: { ...draft.fonts, body: v } })} />
                </div>
              </div>
            </div>

            {/* Right: live preview */}
            <div
              className="rounded-xl overflow-hidden shadow-lg sticky top-4 flex flex-col justify-between w-full"
              style={{
                aspectRatio: "4/5",
                background: `radial-gradient(ellipse at 70% 30%, ${previewColors.accent}55 0%, transparent 60%), ${previewColors.primary}`,
              }}
            >
              <div className="p-4 flex flex-col justify-center flex-1 gap-2">
                <div>
                  <p className="text-[10px] font-semibold tracking-widest uppercase mb-1.5 opacity-60"
                    style={{ color: previewColors.background, fontFamily: draft.fonts.body }}>
                    // {draft.name || "Brand"}
                  </p>
                  <div className="w-6 h-px mb-3" style={{ backgroundColor: previewColors.accent }} />
                </div>
                <p className="text-[18px] font-black leading-tight"
                  style={{ color: previewColors.background, fontFamily: draft.fonts.heading }}>
                  {t("brandPreviewTagline")}
                </p>
                <p className="text-[11px] leading-relaxed opacity-60 mt-1"
                  style={{ color: previewColors.background, fontFamily: draft.fonts.body }}>
                  {t("brandPreviewDesc")}
                </p>
                <div className="w-6 h-px mt-2" style={{ backgroundColor: previewColors.accent }} />
              </div>
              <div className="px-4 pb-3 flex gap-1">
                {[previewColors.primary, previewColors.secondary, previewColors.accent, previewColors.surface].map((c, i) => (
                  <div key={i} className="h-2.5 w-2.5 rounded-full border border-white/20" style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="border-t border-border" />

        {/* Logo */}
        <section>
          <h2 className="text-sm font-semibold mb-1">{t("stepLogo")}</h2>
          <p className="text-xs text-muted-foreground mb-4">
            {t("logoLight")} / {t("logoDark")}
          </p>
          <div className="grid grid-cols-2 gap-6">
            <div className="rounded-xl border border-border p-4" style={{ background: "#1a1a2e" }}>
              <div className="flex items-center gap-1.5 mb-3">
                <Moon className="h-3.5 w-3.5 text-white/60" />
                <span className="text-xs font-medium text-white/80">{t("logoLight")}</span>
              </div>
              <LogoUpload
                hideLabel
                value={draft.logoPathLight}
                onChange={(path) => setDraft({ ...draft, logoPathLight: path })}
              />
            </div>
            <div className="rounded-xl border border-border p-4 bg-surface">
              <div className="flex items-center gap-1.5 mb-3">
                <Sun className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">{t("logoDark")}</span>
              </div>
              <LogoUpload
                hideLabel
                value={draft.logoPathDark}
                onChange={(path) => setDraft((d) => ({ ...d, logoPathDark: path }))}
              />
            </div>
          </div>

          {/* Logo position + height */}
          <div className="flex items-end gap-4 mt-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t("logoPosition")}</label>
              <div className="flex items-center gap-0.5 p-0.5 bg-muted rounded-md">
                {LOGO_POSITIONS.map(({ value, Icon }) => (
                  <button
                    key={value}
                    onClick={() => setDraft((d) => ({ ...d, logoPosition: value }))}
                    className={`flex items-center justify-center h-8 w-8 rounded transition-colors cursor-pointer ${
                      draft.logoPosition === value
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
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t("logoHeight")}</label>
              <input
                type="number"
                min={24}
                max={72}
                value={draft.logoHeight}
                onChange={(e) => setDraft((d) => ({ ...d, logoHeight: Math.min(72, Math.max(24, Number(e.target.value))) }))}
                className="w-20 h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </section>

        <div className="border-t border-border" />

        {/* Style */}
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

        {/* Save */}
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
