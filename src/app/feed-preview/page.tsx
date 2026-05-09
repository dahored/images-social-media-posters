"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Layers, SlidersHorizontal, Image, Pencil } from "lucide-react";
import { SlideRenderer } from "@/components/editor/SlideRenderer";
import { useI18n } from "@/lib/i18n/context";
import type { Carousel } from "@/types/carousel";
import type { EffectiveBranding } from "@/types/account";
import type { ColorSubstitution, FontSubstitution } from "@/lib/slide-html";

function FeedPreviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();

  const [carousels, setCarousels] = useState<Carousel[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeBranding, setActiveBranding] = useState<EffectiveBranding | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const accountId = searchParams.get("accountId") ?? (typeof window !== "undefined" ? localStorage.getItem("activeAccountId") : null) ?? "";
  const gridId = searchParams.get("gridId") ?? null;

  const fetchData = useCallback(() => {
    if (!accountId) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      fetch(`/api/carousels?accountId=${accountId}`).then((r) => r.json()),
      fetch(`/api/accounts/${accountId}`).then((r) => r.json()),
    ])
      .then(([cd, ad]) => {
        let all: Carousel[] = cd.carousels || [];
        if (gridId) all = all.filter((c) => c.sourceGridId === gridId);
        const sorted = all.sort(
          (a: Carousel, b: Carousel) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        setCarousels(sorted);
        setActiveBranding(ad.effectiveBranding ?? null);
        setReloadKey((k) => k + 1);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [accountId, gridId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function getSlideRendererProps(carousel: Carousel): {
    colorSubstitution?: ColorSubstitution;
    accentOverride?: string;
    fontSubstitution?: FontSubstitution;
  } {
    if (!activeBranding) return {};
    const brandDark = activeBranding.colors;
    const brandLight = activeBranding.colorsLight;
    const slide0Override = carousel.slides[0]?.styleOverride;
    const theme = slide0Override?.theme ?? carousel.brandingOverride?.theme ?? "dark";
    const base = theme === "dark" ? brandDark : (brandLight ?? brandDark);
    const carOv = theme === "dark" ? carousel.brandingOverride?.colors : carousel.brandingOverride?.colorsLight;
    const slideOv = theme === "dark" ? slide0Override?.colors : slide0Override?.colorsLight;
    const toColors = {
      primary:    slideOv?.primary    ?? carOv?.primary    ?? base.primary,
      secondary:  slideOv?.secondary  ?? carOv?.secondary  ?? base.secondary,
      accent:     slideOv?.accent     ?? carOv?.accent     ?? base.accent,
      background: slideOv?.background ?? carOv?.background ?? base.background,
      surface:    slideOv?.surface    ?? carOv?.surface    ?? base.surface,
    };
    const brandFonts = activeBranding.fonts;
    const overrideFonts = carousel.brandingOverride?.fonts;
    const slideFonts = slide0Override?.fonts;
    const activeHeading = slideFonts?.heading ?? overrideFonts?.heading ?? brandFonts?.heading;
    const activeBody    = slideFonts?.body    ?? overrideFonts?.body    ?? brandFonts?.body;
    return {
      colorSubstitution: { from: { ...base }, to: toColors },
      accentOverride: toColors.accent,
      fontSubstitution: brandFonts ? {
        heading: activeHeading ? { from: brandFonts.heading, to: activeHeading } : undefined,
        body:    activeBody    ? { from: brandFonts.body,    to: activeBody    } : undefined,
      } : undefined,
    };
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-sm font-semibold">{t("feedPreviewTitle")}</h1>
        <span className="text-xs text-muted-foreground ml-auto">
          {carousels.length} {carousels.length === 1 ? t("post") : t("posts")}
        </span>
      </div>

      <div className="max-w-md mx-auto px-0 py-0">
        {loading ? (
          <div className="grid grid-cols-3 gap-0.5 mt-0.5">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="aspect-square bg-muted animate-pulse" />
            ))}
          </div>
        ) : carousels.length === 0 ? (
          <div className="text-center py-20 px-6">
            <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">{t("feedPreviewEmpty")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-0.5 mt-0.5">
            {carousels.map((carousel) => (
              <div
                key={carousel.id}
                className="relative aspect-square bg-muted overflow-hidden cursor-pointer"
                onMouseEnter={() => setHoveredId(carousel.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => router.push(`/carousel/${carousel.id}`)}
              >
                {carousel.slides.length > 0 ? (
                  <SlideRenderer
                    key={`${carousel.id}-${reloadKey}`}
                    html={carousel.slides[0].html}
                    aspectRatio={carousel.aspectRatio}
                    className="w-full h-full"
                    {...getSlideRendererProps(carousel)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Layers className="h-6 w-6 text-muted-foreground/30" />
                  </div>
                )}

                {hoveredId === carousel.id && (
                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2 p-2">
                    <span className="text-white text-[11px] font-medium text-center leading-tight line-clamp-2">
                      {carousel.name}
                    </span>
                    <span className="flex items-center gap-1 text-white/70 text-[10px]">
                      {carousel.kind === "post" ? (
                        <><Image className="h-3 w-3" />{t("post")}</>
                      ) : (
                        <><SlidersHorizontal className="h-3 w-3" />{carousel.slides.length} {t("slides")}</>
                      )}
                    </span>
                    <div className="flex items-center gap-1 mt-1 bg-white/20 rounded px-2 py-1 text-[10px] text-white">
                      <Pencil className="h-2.5 w-2.5" />
                      {t("editPost")}
                    </div>
                  </div>
                )}

                {carousel.kind !== "post" && carousel.slides.length > 1 && (
                  <div className="absolute top-1.5 right-1.5 bg-black/60 rounded px-1 py-0.5 text-[9px] text-white font-medium">
                    {carousel.slides.length}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function FeedPreviewPage() {
  return (
    <Suspense>
      <FeedPreviewContent />
    </Suspense>
  );
}
