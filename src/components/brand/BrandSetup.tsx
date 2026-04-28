"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronRight, ChevronLeft, Check, Palette, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ColorPicker } from "./ColorPicker";
import { FontSelector } from "./FontSelector";
import { LogoUpload } from "./LogoUpload";
import { useI18n } from "@/lib/i18n/context";
import type { Brand } from "@/types/brand";

interface BrandSetupProps {
  open: boolean;
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

const DEFAULT_BRAND_DRAFT = {
  name: "",
  colors: {
    primary: "#1a1a2e",
    secondary: "#16213e",
    accent: "#7f22fe",
    background: "#ffffff",
    surface: "#f5f5f5",
  },
  fonts: { heading: "Inter", body: "Inter" },
  logoPath: null as string | null,
  styleKeywords: [] as string[],
};

export function BrandSetup({ open, onComplete, brandId, initialBrand }: BrandSetupProps) {
  const { t } = useI18n();
  const isEdit = Boolean(brandId);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(DEFAULT_BRAND_DRAFT);
  const [saving, setSaving] = useState(false);

  const STEPS = [
    t("stepBrandName"),
    t("stepColors"),
    t("stepFonts"),
    t("stepLogo"),
    t("stepStyle"),
  ];

  useEffect(() => {
    if (open) {
      setStep(0);
      if (initialBrand) {
        setDraft({
          name: initialBrand.name,
          colors: { ...initialBrand.colors },
          fonts: { ...initialBrand.fonts },
          logoPath: initialBrand.logoPath,
          styleKeywords: [...initialBrand.styleKeywords],
        });
      } else {
        setDraft(DEFAULT_BRAND_DRAFT);
      }
    }
  }, [open, initialBrand]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const url = isEdit ? `/api/brands/${brandId}` : "/api/brands";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
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

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onComplete(initialBrand as Brand);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onComplete, initialBrand]);

  if (!open) return null;

  return (
    <div
      className="oc-fade fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onComplete(initialBrand as Brand); }}
    >
      <div className="oc-enter-pop bg-surface rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden relative">
        {/* Close button */}
        <button
          onClick={() => onComplete(initialBrand as Brand)}
          className="absolute top-4 right-4 h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors z-10 cursor-pointer"
          aria-label={t("close")}
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <Palette className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {isEdit ? t("editBrand") : t("setupBrand")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t("wizardStep", { step: step + 1, total: STEPS.length, name: STEPS[step] })}
              </p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="flex gap-1 mt-4">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= step ? "bg-accent" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 min-h-60">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">{t("brandNameQuestion")}</label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder={t("brandNamePlaceholder")}
                  className="mt-2 text-lg h-12"
                  autoFocus
                />
              </div>
              <p className="text-xs text-muted-foreground">{t("brandNameHelp")}</p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <ColorPicker label={t("primaryColor")} value={draft.colors.primary}
                onChange={(v) => setDraft({ ...draft, colors: { ...draft.colors, primary: v } })} />
              <ColorPicker label={t("secondaryColor")} value={draft.colors.secondary}
                onChange={(v) => setDraft({ ...draft, colors: { ...draft.colors, secondary: v } })} />
              <ColorPicker label={t("accentColor")} value={draft.colors.accent}
                onChange={(v) => setDraft({ ...draft, colors: { ...draft.colors, accent: v } })} />
              <ColorPicker label={t("backgroundColor")} value={draft.colors.background}
                onChange={(v) => setDraft({ ...draft, colors: { ...draft.colors, background: v } })} />
              <ColorPicker label={t("surfaceColor")} value={draft.colors.surface}
                onChange={(v) => setDraft({ ...draft, colors: { ...draft.colors, surface: v } })} />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <FontSelector label={t("headingFont")} value={draft.fonts.heading}
                onChange={(v) => setDraft({ ...draft, fonts: { ...draft.fonts, heading: v } })} />
              <FontSelector label={t("bodyFont")} value={draft.fonts.body}
                onChange={(v) => setDraft({ ...draft, fonts: { ...draft.fonts, body: v } })} />
            </div>
          )}

          {step === 3 && (
            <LogoUpload
              value={draft.logoPath}
              onChange={(path) => setDraft({ ...draft, logoPath: path })}
            />
          )}

          {step === 4 && (
            <div>
              <label className="text-sm font-medium">{t("brandStyle")}</label>
              <p className="text-xs text-muted-foreground mt-1 mb-3">{t("brandStyleHelp")}</p>
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
                    {t(STYLE_LABEL_KEYS[keyword as StyleKeyword])}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={step === 0}>
            <ChevronLeft className="h-4 w-4" />
            {t("back")}
          </Button>

          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(step + 1)} disabled={step === 0 && !draft.name.trim()}>
              {t("next")}
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="accent" onClick={handleSave} disabled={saving || !draft.name.trim()}>
              {saving ? t("saving") : (
                <>
                  <Check className="h-4 w-4" />
                  {isEdit ? t("saveChanges") : t("completeSetup")}
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
