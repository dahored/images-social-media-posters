"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import type { Carousel, AspectRatio, CarouselBrandingOverride, Slide } from "@/types/carousel";
import type { EffectiveBranding } from "@/types/account";
import { computeSlideRendererProps } from "@/lib/slide-renderer-props";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function CarouselEditorPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const backHref = searchParams.get("from") ?? "/";
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
  const [sourceTemplateExists, setSourceTemplateExists] = useState(false);

  const saveAsNewTemplate = async () => {
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carouselId: carousel?.id }),
    });
    if (res.ok) {
      setTemplateSaved(true);
      setSourceTemplateExists(true);
      // Sync carousel state so it reflects the new templateId
      fetchCarousel();
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
  // Captures the active merged palette at render time so handleStreamEnd can persist it
  // without a stale closure — updated on every render via assignment below.
  const generationPaletteRef = useRef<Record<string, string> | null>(null);


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
        if (data.templateId) {
          const tplRes = await fetch(`/api/templates/${data.templateId}`);
          setSourceTemplateExists(tplRes.ok);
        }
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
    // Persist the active palette so future theme switches can do correct substitution
    // even if the brand palette is updated later.
    if (generationPaletteRef.current) {
      fetch(`/api/carousels/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationPalette: generationPaletteRef.current }),
      });
    }
  }, [fetchCarousel, id]);

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

  const activeTheme: "dark" | "light" | "default" = carousel.brandingOverride?.theme ?? "default";

  // Compute the currently-active merged palette so handleStreamEnd can store it as generationPalette.
  // This captures what the AI actually used so future theme switches do correct color substitution.
  const activePaletteBase =
    activeTheme === "light" ? (effectiveBranding?.colorsLight ?? effectiveBranding?.colors)
    : activeTheme === "dark"  ? (effectiveBranding?.colorsDark  ?? effectiveBranding?.colors)
    : effectiveBranding?.colors;
  const carouselColorOv =
    activeTheme === "light" ? carousel.brandingOverride?.colorsLight
    : carousel.brandingOverride?.colors;
  generationPaletteRef.current = activePaletteBase
    ? { ...activePaletteBase, ...Object.fromEntries(Object.entries(carouselColorOv ?? {}).filter(([, v]) => v)) }
    : null;

  // Per-theme logo options for the StyleOverridePanel logo picker.
  // Convention (matches BrandWizard): logoPathLight = light-colored logo (for dark backgrounds),
  // logoPathDark = dark-colored logo (for light backgrounds).
  const themeLogos = effectiveBranding ? (() => {
    const generic = effectiveBranding.logoPath ? [{ path: effectiveBranding.logoPath, label: "Logo" }] : [];
    // Dark slides have dark backgrounds → show light-colored logo (logoPathLight)
    const dark  = effectiveBranding.logoPathLight ? [{ path: effectiveBranding.logoPathLight, label: "Logo claro"  }] : generic;
    // Light slides have light backgrounds → show dark-colored logo (logoPathDark)
    const light = effectiveBranding.logoPathDark  ? [{ path: effectiveBranding.logoPathDark,  label: "Logo oscuro" }] : generic;
    const def   = [
      ...generic,
      ...(effectiveBranding.logoPathDark  ? [{ path: effectiveBranding.logoPathDark,  label: "Logo oscuro" }] : []),
      ...(effectiveBranding.logoPathLight ? [{ path: effectiveBranding.logoPathLight, label: "Logo claro"  }] : []),
    ];
    return { dark, light, default: def };
  })() : undefined;

  // Tells the picker which logo the brand auto-selects per theme.
  // Default tab → logoPath (the generic brand logo, no theme bias).
  // Dark tab  → logoPathLight (light-colored logo for dark backgrounds).
  // Light tab → logoPathDark (dark-colored logo for light backgrounds).
  const brandDefaultLogoPaths = effectiveBranding ? {
    default: effectiveBranding.logoPath ?? undefined,
    dark:    effectiveBranding.logoPathLight ?? effectiveBranding.logoPath ?? undefined,
    light:   effectiveBranding.logoPathDark  ?? effectiveBranding.logoPath ?? undefined,
  } : undefined;

  const activeSlideData = carousel.slides[activeSlide];
  const activeSlidePreviewTheme: "dark" | "light" | "default" =
    activeSlideData?.styleOverride?.theme ?? activeTheme;

  // Unified rendering props — same logic as export and content cards.
  const activeSlideProps = effectiveBranding && activeSlideData
    ? computeSlideRendererProps(effectiveBranding, carousel, activeSlideData)
    : undefined;
  const allSlideProps = effectiveBranding
    ? Object.fromEntries(
        carousel.slides.map((s) => [s.id, computeSlideRendererProps(effectiveBranding, carousel, s)])
      )
    : {};
  const perSlidePropsArray = carousel.slides.map((s) => allSlideProps[s.id]);


  return (
    <div className="h-full flex flex-col">
      <TopBar
        title={carousel.name}
        showBack
        backHref={backHref}
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
        perSlideProps={perSlidePropsArray}
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
              silentSend={{
                message: (() => {
                  const slide = carousel.slides[activeSlide];
                  if (!slide) return "Regenera el carousel completo con variaciones de texto.";
                  return `Regenera SOLO el slide con ID ${slide.id} (slide ${activeSlide + 1} de ${carousel.slides.length}). Mantén el estilo visual, la paleta de colores y la estructura semántica exacta (mismas role classes, mismo número de slots). Cambia únicamente el texto y opcionalmente detalles decorativos para generar una variación. No toques ningún otro slide.`;
                })(),
                nonce: silentSendNonce,
              }}
              theme={carousel.brandingOverride?.theme ?? "default"}
              aspectRatio={carousel.aspectRatio}
              onCommitChanges={async (ratio, theme) => {
                if (ratio !== carousel.aspectRatio) await handleAspectChange(ratio);
                if (theme !== (carousel.brandingOverride?.theme ?? "default")) {
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
                  if (carousel.templateId && sourceTemplateExists) {
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
            logoConfig={activeSlideProps?.logoConfig}
            colorSubstitution={activeSlideProps?.colorSubstitution}
            fontSubstitution={activeSlideProps?.fontSubstitution}
            accentOverride={activeSlideProps?.accentOverride}
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
            brandColorsDark={effectiveBranding.colorsDark}
            brandColorsLight={effectiveBranding.colorsLight}
            brandFonts={effectiveBranding.fonts}
            brandFontsDark={effectiveBranding.fontsDark}
            brandFontsLight={effectiveBranding.fontsLight}
            themeLogos={themeLogos}
            brandDefaultLogoPaths={brandDefaultLogoPaths}
            override={carousel.brandingOverride ?? {}}
            onClose={() => setShowStylePanel(false)}
            activeSlide={activeSlideData}
            onSlideOverrideChange={handleSlideOverrideChange}
            initialSlideTheme={activeSlidePreviewTheme}
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
          slideSubstitutions={allSlideProps}
        />
      )}
    </div>
  );
}
