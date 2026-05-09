"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, Grid3X3, Bookmark, Maximize2, X, Settings2, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, RefreshCw, Lock, LockOpen } from "lucide-react";
import { PublishButton } from "@/components/editor/PublishButton";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import * as Dialog from "@radix-ui/react-dialog";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { CarouselPreview } from "@/components/editor/CarouselPreview";
import { SlideFilmstrip } from "@/components/editor/SlideFilmstrip";
import { ExportButton } from "@/components/editor/ExportButton";
import { ContentSidebar } from "@/components/editor/ContentSidebar";
import { SafeZoneOverlay } from "@/components/editor/SafeZoneOverlay";
import { FullscreenPreview } from "@/components/editor/FullscreenPreview";
import { StyleOverridePanel } from "@/components/editor/StyleOverridePanel";
import { useI18n } from "@/lib/i18n/context";
import type { Carousel, AspectRatio, CarouselBrandingOverride, Slide, SlideColorSet } from "@/types/carousel";
import { detectSlideRootBackground } from "@/lib/slide-html";
import type { LogoConfig, ColorSubstitution, FontSubstitution } from "@/lib/slide-html";
import type { EffectiveBranding } from "@/types/account";
import type { BrandColors } from "@/types/brand";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function CarouselEditorPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { t } = useI18n();
  const [carousel, setCarousel] = useState<Carousel | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [claudeAvailable, setClaudeAvailable] = useState(true);
  const [chatOpen, setChatOpen] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("cs-chat-open") !== "0" : true
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const SAFE_ZONE_KEY = "cs-safe-zones";
  const [showSafeZones, setShowSafeZones] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(SAFE_ZONE_KEY) === "1";
    }
    return false;
  });
  const toggleSafeZones = (v: boolean) => {
    setShowSafeZones(v);
    localStorage.setItem(SAFE_ZONE_KEY, v ? "1" : "0");
  };
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);
  const [templateChoiceOpen, setTemplateChoiceOpen] = useState(false);

  const saveAsNewTemplate = async () => {
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carouselId: carousel?.id }),
    });
    if (res.ok) {
      setTemplateSaved(true);
      setTimeout(() => setTemplateSaved(false), 2000);
    }
    setTemplateChoiceOpen(false);
  };

  const overwriteOriginalTemplate = async () => {
    if (!carousel?.templateId) return;
    const res = await fetch(`/api/templates/${carousel.templateId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carouselId: carousel.id }),
    });
    if (res.ok) {
      setTemplateSaved(true);
      setTimeout(() => setTemplateSaved(false), 2000);
    }
    setTemplateChoiceOpen(false);
  };
  const [ratioChangeBanner, setRatioChangeBanner] = useState<{ from: AspectRatio; to: AspectRatio } | null>(null);
  const [slidesDesignedForRatio, setSlidesDesignedForRatio] = useState<AspectRatio | null>(null);
  const [autoSendMessage, setAutoSendMessage] = useState<string | undefined>();
  const [silentSendNonce, setSilentSendNonce] = useState(0);
  const [contentSidebarOpen, setContentSidebarOpen] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("cs-info-open") !== "0" : true
  );
  const [showStylePanel, setShowStylePanel] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("cs-style-open") === "1" : false
  );
  const [effectiveBranding, setEffectiveBranding] = useState<EffectiveBranding | null>(null);

  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: "", description: "", onConfirm: () => {} });

  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);


  const fetchCarousel = useCallback(async () => {
    try {
      const res = await fetch(`/api/carousels/${id}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setCarousel((prev) => {
          if (prev && data.slides.length > prev.slides.length) {
            setActiveSlide(data.slides.length - 1);
          } else {
            setActiveSlide((prevIdx) =>
              data.slides.length === 0 ? 0 : Math.min(prevIdx, data.slides.length - 1)
            );
          }
          return data;
        });
      }
    } catch {
      // ignore network errors
    }
  }, [id]);

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`/api/carousels/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSlidesDesignedForRatio(data.aspectRatio);
      }
      await fetchCarousel();
      try {
        const res2 = await fetch("/api/chat/check");
        const data2: { available?: boolean } = await res2.json();
        if (data2.available === false) setClaudeAvailable(false);
      } catch {
        // assume available
      }
    };
    load();
  }, [fetchCarousel, id]);

  useEffect(() => {
    const accountId = localStorage.getItem("activeAccountId");
    if (!accountId) return;
    fetch(`/api/branding?accountId=${accountId}`)
      .then((r) => r.json())
      .then((b) => setEffectiveBranding(b))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isGenerating) return;
    const interval = setInterval(() => {
      fetchCarousel();
    }, 500);
    return () => clearInterval(interval);
  }, [isGenerating, fetchCarousel]);

  // When AI finishes generating, the slides are now for the current ratio — clear the banner
  const prevIsGenerating = useRef(false);
  useEffect(() => {
    if (prevIsGenerating.current && !isGenerating && ratioChangeBanner && carousel) {
      setRatioChangeBanner(null);
      setSlidesDesignedForRatio(carousel.aspectRatio);
    }
    prevIsGenerating.current = isGenerating;
  }, [isGenerating, ratioChangeBanner, carousel]);

  const handleAspectChange = async (ratio: AspectRatio) => {
    if (!carousel) return;
    const designed = slidesDesignedForRatio ?? carousel.aspectRatio;
    const res = await fetch(`/api/carousels/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aspectRatio: ratio }),
    });
    if (res.ok) {
      const updated = await res.json();
      setCarousel(updated);
      if (carousel.slides.length > 0 && designed !== ratio) {
        setRatioChangeBanner({ from: designed, to: ratio });
      } else {
        setRatioChangeBanner(null);
      }
    }
  };

  const handleDeleteSlide = (slideId: string) => {
    if (!carousel) return;
    const slideIndex = carousel.slides.findIndex((s) => s.id === slideId);
    setConfirmState({
      open: true,
      title: t("deleteSlideConfirm", { index: slideIndex + 1 }),
      description: t("actionCannotBeUndone"),
      onConfirm: async () => {
        const res = await fetch(`/api/carousels/${id}/slides/${slideId}`, {
          method: "DELETE",
        });
        if (res.ok) await fetchCarousel();
      },
    });
  };

  const handleUndoSlide = async (slideId: string) => {
    const res = await fetch(`/api/carousels/${id}/slides/${slideId}/undo`, {
      method: "POST",
    });
    if (res.ok) await fetchCarousel();
  };

  const handleDeleteCarousel = useCallback(() => {
    if (!carousel) return;
    setConfirmState({
      open: true,
      title: t("deleteCarouselConfirm", { name: carousel.name }),
      description: t("deleteCarouselDesc"),
      onConfirm: async () => {
        const res = await fetch(`/api/carousels/${id}`, { method: "DELETE" });
        if (res.ok) router.push("/");
      },
    });
  }, [carousel, id, router, t]);

  const handleStreamStart = useCallback(() => {
    setIsGenerating(true);
  }, []);

  const handleStreamEnd = useCallback(() => {
    setIsGenerating(false);
    fetchCarousel();
  }, [fetchCarousel]);

  const handleReorderSlides = useCallback(
    async (slideIds: string[]) => {
      await fetch(`/api/carousels/${id}/slides`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slideIds }),
      });
      await fetchCarousel();
    },
    [id, fetchCarousel]
  );

  const handleAddSlideRequest = useCallback(() => {
    setChatOpen(true);
    setTimeout(() => {
      chatInputRef.current?.focus();
    }, 100);
  }, []);

  const handleBrandingOverrideChange = useCallback(async (override: CarouselBrandingOverride) => {
    setCarousel((prev) => prev ? { ...prev, brandingOverride: override } : prev);
    fetch(`/api/carousels/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandingOverride: override }),
    });
  }, [id]);

  const handleSlideOverrideChange = useCallback(async (slideId: string, override: NonNullable<Slide["styleOverride"]>) => {
    setCarousel((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        slides: prev.slides.map((s) => s.id === slideId ? { ...s, styleOverride: override } : s),
      };
    });
    fetch(`/api/carousels/${id}/slides/${slideId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ styleOverride: override }),
    });
  }, [id]);

  if (notFound) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <p className="text-lg font-semibold">{t("carouselNotFound")}</p>
        <p className="text-sm text-muted-foreground">
          {t("carouselDeletedMsg")}
        </p>
        <Link href="/" className="text-sm text-accent underline">
          {t("backToDashboard")}
        </Link>
      </div>
    );
  }

  if (!carousel) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Compute effective logo config: per-post override wins, then brand defaults
  const activeTheme = carousel.brandingOverride?.theme ?? "dark";
  const logoPath = activeTheme === "dark"
    ? (effectiveBranding?.logoPathLight ?? effectiveBranding?.logoPath ?? null)
    : (effectiveBranding?.logoPathDark ?? effectiveBranding?.logoPath ?? null);

  const logoPosition = carousel.brandingOverride?.logoPosition ?? effectiveBranding?.logoPosition ?? "bottom-center";
  const logoHeight = carousel.brandingOverride?.logoHeight ?? effectiveBranding?.logoHeight ?? 72;

  const logoConfig: LogoConfig | undefined = logoPath
    ? { path: logoPath, position: logoPosition, height: logoHeight }
    : undefined;

  // Brand logo variants available for per-slide override
  const brandLogos = [
    effectiveBranding?.logoPathLight ? { path: effectiveBranding.logoPathLight, label: "Logo claro" } : null,
    effectiveBranding?.logoPathDark  ? { path: effectiveBranding.logoPathDark,  label: "Logo oscuro" } : null,
    effectiveBranding?.logoPath && !effectiveBranding?.logoPathLight && !effectiveBranding?.logoPathDark
      ? { path: effectiveBranding.logoPath, label: "Logo" } : null,
  ].filter((x): x is { path: string; label: string } => x !== null && !!x.path);

  /**
   * Merges brand base colors with carousel and optional slide overrides.
   * Priority: slideOverride > carouselOverride > brand base.
   */
  function mergeSlideColors(
    brand: BrandColors,
    carouselOverride?: Partial<BrandColors>,
    slideOverride?: Partial<SlideColorSet>
  ): Record<string, string> {
    return {
      primary:    slideOverride?.primary    ?? carouselOverride?.primary    ?? brand.primary,
      secondary:  slideOverride?.secondary  ?? carouselOverride?.secondary  ?? brand.secondary,
      accent:     slideOverride?.accent     ?? carouselOverride?.accent     ?? brand.accent,
      background: slideOverride?.background ?? carouselOverride?.background ?? brand.background,
      surface:    slideOverride?.surface    ?? carouselOverride?.surface    ?? brand.surface,
    };
  }

  // Base brand colors (from effectiveBranding)
  const brandColors = effectiveBranding?.colors;           // dark — what the AI generated with
  const brandColorsLight = effectiveBranding?.colorsLight; // light — desired when theme is "light"

  // Detect which palette a slide's HTML was authored with by inspecting its root background.
  // Falls back to dark when ambiguous. Used to pick the correct `from` for color substitution
  // so a slide saved with light colors can still flip to dark and vice versa.
  const detectHtmlBase = (html: string | undefined) => {
    if (!html || !brandColors) return brandColors;
    const bg = detectSlideRootBackground(html)?.toLowerCase();
    if (bg && brandColorsLight?.primary && bg === brandColorsLight.primary.toLowerCase()) {
      return brandColorsLight;
    }
    return brandColors;
  };

  // Base colors for the current theme: dark brand OR light brand
  const brandBaseForTheme = activeTheme === "dark"
    ? brandColors
    : (brandColorsLight ?? brandColors);

  const carouselOverrideColors = activeTheme === "dark"
    ? carousel.brandingOverride?.colors
    : carousel.brandingOverride?.colorsLight;

  // Color substitution for the currently active slide — uses per-slide stored theme (persists across reloads + export)
  const activeSlideData = carousel.slides[activeSlide];
  const activeSlidePreviewTheme: "dark" | "light" = activeSlideData?.styleOverride?.theme ?? activeTheme;
  const previewBrandBase = activeSlidePreviewTheme === "dark" ? brandColors : (brandColorsLight ?? brandColors);
  const previewCarouselOverride = activeSlidePreviewTheme === "dark"
    ? carousel.brandingOverride?.colors
    : carousel.brandingOverride?.colorsLight;
  const previewSlideOverrideColors = activeSlideData
    ? (activeSlidePreviewTheme === "dark"
        ? activeSlideData.styleOverride?.colors
        : activeSlideData.styleOverride?.colorsLight)
    : undefined;

  const activeHtmlBase = detectHtmlBase(activeSlideData?.html);
  const activeSlideColorSub: ColorSubstitution | undefined = activeHtmlBase && previewBrandBase
    ? {
        from: { ...activeHtmlBase },
        to: mergeSlideColors(previewBrandBase, previewCarouselOverride, previewSlideOverrideColors),
      }
    : undefined;

  // Resolved accent for CSS injection — drives .slide-accent class color
  const activeSlideAccent =
    previewSlideOverrideColors?.accent ??
    previewCarouselOverride?.accent ??
    previewBrandBase?.accent;

  // Active slide logo: per-theme explicit override > theme-based auto variant > carousel default
  const activeSlideTheme: "dark" | "light" = activeSlideData?.styleOverride?.theme ?? activeTheme;
  const activeSlideAutoLogoPath = activeSlideTheme === "dark"
    ? (effectiveBranding?.logoPathLight ?? effectiveBranding?.logoPath ?? null)
    : (effectiveBranding?.logoPathDark  ?? effectiveBranding?.logoPath ?? null);
  const activeSlideLogoOverride = activeSlideTheme === "dark"
    ? activeSlideData?.styleOverride?.logoPath
    : activeSlideData?.styleOverride?.logoPathLight;
  const activeSlideLogoPath = activeSlideLogoOverride ?? activeSlideAutoLogoPath;
  const activeSlideLogoPosition = activeSlideData?.styleOverride?.logoPosition ?? logoPosition;
  const activeSlideLogoHeight   = activeSlideData?.styleOverride?.logoHeight   ?? logoHeight;
  const activeLogoConfig: LogoConfig | undefined = activeSlideLogoPath
    ? { path: activeSlideLogoPath, position: activeSlideLogoPosition, height: activeSlideLogoHeight }
    : undefined;

  // Color substitution for filmstrip thumbnails (carousel-level only, no per-slide)
  const filmstripColorSub: ColorSubstitution | undefined = brandColors && brandBaseForTheme
    ? {
        from: { ...(brandBaseForTheme ?? brandColors) },
        to: mergeSlideColors(brandBaseForTheme, carouselOverrideColors),
      }
    : undefined;

  // Font substitution for the active slide: slide override → carousel override → brand
  const brandFonts = effectiveBranding?.fonts;
  const overrideFonts = carousel.brandingOverride?.fonts;
  const activeSlideFontOverride = activeSlideData?.styleOverride?.fonts;
  const activeHeading = activeSlideFontOverride?.heading ?? overrideFonts?.heading ?? brandFonts?.heading;
  const activeBody    = activeSlideFontOverride?.body    ?? overrideFonts?.body    ?? brandFonts?.body;
  // Always include both roles so CSS injection can target .slide-title / .slide-body independently.
  // applyFontSub skips pairs where from === to, so no-op substitutions cost nothing.
  const fontSubstitution: FontSubstitution | undefined = brandFonts
    ? {
        heading: activeHeading ? { from: brandFonts.heading, to: activeHeading } : undefined,
        body:    activeBody    ? { from: brandFonts.body,    to: activeBody    } : undefined,
      }
    : undefined;

  // Per-slide substitutions for filmstrip — each slide uses its own persisted theme
  const slideSubstitutions: Record<string, { colorSubstitution?: ColorSubstitution; fontSubstitution?: FontSubstitution; customBackground?: string }> =
    brandColors && brandFonts
      ? Object.fromEntries(carousel.slides.map((s) => {
          const themeForSlide: "dark" | "light" = s.styleOverride?.theme ?? activeTheme;
          const baseForSlide  = themeForSlide === "dark" ? brandColors : (brandColorsLight ?? brandColors);
          const carOvForSlide = themeForSlide === "dark"
            ? carousel.brandingOverride?.colors
            : carousel.brandingOverride?.colorsLight;
          const sColorOv = themeForSlide === "dark" ? s.styleOverride?.colors : s.styleOverride?.colorsLight;
          const sFonts = s.styleOverride?.fonts;
          const sHeading = sFonts?.heading ?? overrideFonts?.heading ?? brandFonts.heading;
          const sBody    = sFonts?.body    ?? overrideFonts?.body    ?? brandFonts.body;
          const mergedForSlide = baseForSlide
            ? mergeSlideColors(baseForSlide, carOvForSlide, sColorOv)
            : undefined;
          const sHtmlBase = detectHtmlBase(s.html);
          return [s.id, {
            colorSubstitution: baseForSlide && sHtmlBase ? {
              from: { ...sHtmlBase },
              to: mergedForSlide!,
            } : undefined,
            fontSubstitution: {
              heading: { from: brandFonts.heading, to: sHeading },
              body:    { from: brandFonts.body,    to: sBody    },
            },
            customBackground: s.styleOverride?.customBackground,
            accentOverride: mergedForSlide?.accent,
          }];
        }))
      : {};

  // Per-slide logo configs for filmstrip thumbnails.
  // Each slide uses its own position/height overrides; path comes from explicit override or theme-based variant.
  const slideLogoConfigs: Record<string, LogoConfig> = Object.fromEntries(
    carousel.slides.flatMap((s) => {
      const sLogoPosition = s.styleOverride?.logoPosition ?? logoPosition;
      const sLogoHeight   = s.styleOverride?.logoHeight   ?? logoHeight;
      const slideTheme: "dark" | "light" = s.styleOverride?.theme ?? activeTheme;
      const themeBasedPath = slideTheme === "dark"
        ? (effectiveBranding?.logoPathLight ?? effectiveBranding?.logoPath ?? null)
        : (effectiveBranding?.logoPathDark  ?? effectiveBranding?.logoPath ?? null);
      const sLogoOverride = slideTheme === "dark"
        ? s.styleOverride?.logoPath
        : s.styleOverride?.logoPathLight;
      const sLogoPath = sLogoOverride ?? themeBasedPath;
      if (!sLogoPath) return [];
      // Skip if identical to the carousel-default logoConfig (SlideFilmstrip will use the default)
      if (
        sLogoPath === logoConfig?.path &&
        sLogoPosition === logoPosition &&
        sLogoHeight === logoHeight
      ) return [];
      return [[s.id, { path: sLogoPath, position: sLogoPosition, height: sLogoHeight }]];
    })
  );


  return (
    <div className="h-full flex flex-col">
      <TopBar
        title={carousel.name}
        showBack
        editable
        onTitleChange={async (name) => {
          const res = await fetch(`/api/carousels/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
          });
          if (res.ok) {
            const updated = await res.json();
            setCarousel(updated);
          }
        }}
      />

      <FullscreenPreview
        open={showFullscreen}
        onOpenChange={setShowFullscreen}
        slides={carousel.slides}
        aspectRatio={carousel.aspectRatio}
        activeIndex={activeSlide}
        onActiveChange={setActiveSlide}
        logoConfig={activeLogoConfig}
        colorSubstitution={activeSlideColorSub}
        fontSubstitution={fontSubstitution}
        customBackground={activeSlideData?.styleOverride?.customBackground}
        accentOverride={activeSlideAccent}
      />

      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={(open) => setConfirmState((s) => ({ ...s, open }))}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel={t("delete")}
        variant="destructive"
        onConfirm={confirmState.onConfirm}
      />

      <Dialog.Root open={templateChoiceOpen} onOpenChange={setTemplateChoiceOpen}>
        <Dialog.Portal>
          <Dialog.Overlay data-oc-overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
          <Dialog.Content data-oc-dialog className="fixed left-1/2 top-1/2 z-50 w-full max-w-md rounded-xl bg-surface border border-border p-6 shadow-2xl">
            <Dialog.Title className="text-sm font-semibold mb-1">{t("templateSaveTitle")}</Dialog.Title>
            <Dialog.Description className="text-xs text-muted-foreground mb-5">
              {t("templateSaveDesc")}
            </Dialog.Description>
            <div className="flex flex-col gap-2">
              <Button variant="accent" size="sm" onClick={overwriteOriginalTemplate}>
                {t("templateOverwrite")}
              </Button>
              <Button variant="outline" size="sm" onClick={saveAsNewTemplate}>
                {t("templateSaveNew")}
              </Button>
              <Dialog.Close asChild>
                <Button variant="ghost" size="sm">{t("cancel")}</Button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {chatOpen && (
          <div className="oc-fade w-80 border-r border-border shrink-0 flex flex-col bg-surface">
            <ChatPanel
              carouselId={id}
              claudeAvailable={claudeAvailable}
              referenceImages={carousel.referenceImages || []}
              isPost={carousel.kind === "post"}
              onStreamStart={handleStreamStart}
              onStreamEnd={handleStreamEnd}
              chatInputRef={chatInputRef}
              autoSendMessage={autoSendMessage}
              onAutoSendConsumed={() => setAutoSendMessage(undefined)}
              silentSend={{ message: "Regenera este slide manteniendo estilo, paleta de marca y estructura semántica (mismas role classes). Genera una variación con un fraseo o disposición distinta.", nonce: silentSendNonce }}
              theme={carousel.brandingOverride?.theme ?? "dark"}
              aspectRatio={carousel.aspectRatio}
              onCommitChanges={async (ratio, theme) => {
                if (ratio !== carousel.aspectRatio) await handleAspectChange(ratio);
                if (theme !== (carousel.brandingOverride?.theme ?? "dark")) {
                  await handleBrandingOverrideChange({ ...(carousel.brandingOverride ?? {}), theme });
                }
              }}
            />
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Toolbar */}
          <div className="h-11 border-b border-border bg-surface flex items-center shrink-0">
            {/* Left panel toggle */}
            <button
              onClick={() => { const v = !chatOpen; setChatOpen(v); localStorage.setItem("cs-chat-open", v ? "1" : "0"); }}
              className="h-11 w-11 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted border-r border-border transition-colors shrink-0"
              aria-label={chatOpen ? t("hideChat") : t("showChat")}
              title={chatOpen ? t("hideChat") : t("showChat")}
            >
              {chatOpen
                ? <PanelLeftClose className="h-4 w-4" />
                : <PanelLeftOpen className="h-4 w-4" />}
            </button>

            <div className="flex items-center gap-3 px-3 flex-1 min-w-0">
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFullscreen(true)}
                className="text-muted-foreground"
                aria-label={t("fullscreenPreview")}
                title={t("fullscreenPreview")}
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSilentSendNonce((n) => n + 1)}
                disabled={isGenerating}
                className="text-muted-foreground hover:text-accent"
                aria-label={t("regenerate")}
                title={t("regenerate")}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isGenerating ? "animate-spin" : ""}`} />
              </Button>
              {carousel.templateId && (
                <Button
                  variant={carousel.templateLocked ? "outline" : "ghost"}
                  size="sm"
                  onClick={async () => {
                    const next = !carousel.templateLocked;
                    const res = await fetch(`/api/carousels/${carousel.id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ templateLocked: next }),
                    });
                    if (res.ok) {
                      const updated = await res.json();
                      setCarousel(updated);
                    }
                  }}
                  className={carousel.templateLocked ? "border-accent text-accent" : "text-muted-foreground"}
                  aria-label={carousel.templateLocked ? t("templateLocked") : t("templateUnlocked")}
                  title={carousel.templateLocked ? t("templateLocked") : t("templateUnlocked")}
                >
                  {carousel.templateLocked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
                </Button>
              )}
              <Button
                variant={showSafeZones ? "outline" : "ghost"}
                size="sm"
                onClick={() => toggleSafeZones(!showSafeZones)}
                className={showSafeZones ? "border-accent text-accent" : "text-muted-foreground"}
                aria-label={t("safeZones")}
                title={t("safeZones")}
              >
                <Grid3X3 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (carousel.templateId) {
                    setTemplateChoiceOpen(true);
                  } else {
                    saveAsNewTemplate();
                  }
                }}
                className={templateSaved ? "text-accent" : "text-muted-foreground hover:text-accent"}
                aria-label={t("saveAsTemplate")}
                title={t("saveAsTemplate")}
              >
                <Bookmark className={`h-3.5 w-3.5 transition-all ${templateSaved ? "fill-accent" : ""}`} />
                {templateSaved && <span className="text-xs ml-1">{t("savedTemplate")}</span>}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteCarousel}
                className="text-muted-foreground hover:text-destructive"
                aria-label={t("deleteCarouselLabel")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={showStylePanel ? "outline" : "ghost"}
                size="sm"
                onClick={() => setShowStylePanel((v) => {
                const next = !v;
                localStorage.setItem("cs-style-open", next ? "1" : "0");
                return next;
              })}
                className={showStylePanel ? "border-accent text-accent" : "text-muted-foreground"}
                aria-label={t("postStyle")}
                title={t("postStyle")}
              >
                <Settings2 className="h-3.5 w-3.5" />
              </Button>
              <PublishButton
                carouselId={carousel.id}
                carouselName={carousel.name}
                caption={carousel.caption}
                hashtags={carousel.hashtags}
                slideCount={carousel.slides.length}
                isPost={carousel.kind === "post"}
              />
              <ExportButton
                carouselId={carousel.id}
                slideCount={carousel.slides.length}
                isPost={carousel.kind === "post"}
              />
            </div>

            {/* Right panel toggle */}
            <button
              onClick={() => { const v = !contentSidebarOpen; setContentSidebarOpen(v); localStorage.setItem("cs-info-open", v ? "1" : "0"); }}
              className="h-11 w-11 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted border-l border-border transition-colors shrink-0"
              aria-label={contentSidebarOpen ? t("hideInfo") : t("showInfo")}
              title={contentSidebarOpen ? t("hideInfo") : t("showInfo")}
            >
              {contentSidebarOpen
                ? <PanelRightClose className="h-4 w-4" />
                : <PanelRightOpen className="h-4 w-4" />}
            </button>
          </div>

          {/* Ratio change banner */}
          {ratioChangeBanner && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 border-b border-amber-200 text-sm shrink-0">
              <span className="text-amber-800 flex-1">
                {t("ratioChangeBanner", { from: ratioChangeBanner.from, to: ratioChangeBanner.to })}
              </span>
              <button
                onClick={() => {
                  setChatOpen(true);
                  setAutoSendMessage(`Please redesign all slides to fit the ${ratioChangeBanner.to} aspect ratio properly.`);
                  setSlidesDesignedForRatio(ratioChangeBanner.to);
                  setRatioChangeBanner(null);
                }}
                className="shrink-0 px-3 py-1 rounded-md bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 transition-colors cursor-pointer"
              >
                {t("regenerateSlides")}
              </button>
              <button
                onClick={() => setRatioChangeBanner(null)}
                className="shrink-0 text-amber-600 hover:text-amber-800 transition-colors cursor-pointer"
                aria-label={t("close")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <CarouselPreview
            slides={carousel.slides}
            aspectRatio={carousel.aspectRatio}
            activeIndex={activeSlide}
            onActiveChange={setActiveSlide}
            showSafeZones={showSafeZones}
            isPost={carousel.kind === "post"}
            isGenerating={isGenerating}
            logoConfig={activeLogoConfig}
            colorSubstitution={activeSlideColorSub}
            fontSubstitution={fontSubstitution}
            customBackground={activeSlideData?.styleOverride?.customBackground}
            accentOverride={activeSlideAccent}
          />
        </div>

        {contentSidebarOpen && (
          <ContentSidebar
            carouselId={id}
            caption={carousel.caption}
            hashtags={carousel.hashtags}
            networkId={carousel.networkId}
            isPost={carousel.kind === "post"}
            onRefresh={fetchCarousel}
          />
        )}

        {showStylePanel && effectiveBranding && (
          <StyleOverridePanel
            brandColors={effectiveBranding.colors}
            brandColorsLight={effectiveBranding.colorsLight}
            brandFonts={effectiveBranding.fonts}
            override={carousel.brandingOverride ?? {}}
            onClose={() => setShowStylePanel(false)}
            activeSlide={activeSlideData}
            onSlideOverrideChange={handleSlideOverrideChange}
            initialSlideTheme={activeSlidePreviewTheme}
            brandLogos={brandLogos}
          />
        )}
      </div>

      {carousel.kind !== "post" && (
        <SlideFilmstrip
          slides={carousel.slides}
          aspectRatio={carousel.aspectRatio}
          activeIndex={activeSlide}
          onActiveChange={setActiveSlide}
          onDeleteSlide={handleDeleteSlide}
          onUndoSlide={handleUndoSlide}
          onAddSlideRequest={handleAddSlideRequest}
          onReorderSlides={handleReorderSlides}
          isGenerating={isGenerating}
          logoConfig={logoConfig}
          slideLogoConfigs={slideLogoConfigs}
          slideSubstitutions={slideSubstitutions}
        />
      )}
    </div>
  );
}
