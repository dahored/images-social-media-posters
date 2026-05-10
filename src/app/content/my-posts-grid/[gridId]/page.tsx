"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Layers, SlidersHorizontal, Trash2, X, ChevronLeft, ChevronRight, Pencil, Send } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { SlideRenderer } from "@/components/editor/SlideRenderer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { PublishDialog } from "@/components/editor/PublishButton";
import { useI18n } from "@/lib/i18n/context";
import type { Carousel } from "@/types/carousel";
import type { Grid } from "@/types/grid";
import type { EffectiveBranding } from "@/types/account";
import { computeSlideRendererProps } from "@/lib/slide-renderer-props";

export default function PostsGridDetailPage() {
  const router = useRouter();
  const params = useParams();
  const gridId = params.gridId as string;
  const { t } = useI18n();

  const [grid, setGrid] = useState<Grid | null>(null);
  const [carousels, setCarousels] = useState<Carousel[]>([]);
  const [branding, setBranding] = useState<EffectiveBranding | null>(null);
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [publishOpen, setPublishOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    open: boolean; title: string; description: string; onConfirm: () => void;
  }>({ open: false, title: "", description: "", onConfirm: () => {} });

  // Fullscreen preview state
  const [preview, setPreview] = useState<{ carousel: Carousel; slideIdx: number } | null>(null);

  const fetchData = useCallback(() => {
    const accountId = localStorage.getItem("activeAccountId");
    setAccountId(accountId ?? undefined);
    if (!accountId) { setLoading(false); return; }

    Promise.all([
      fetch(`/api/grids/${gridId}`).then((r) => r.json()).catch(() => null),
      fetch(`/api/carousels?accountId=${accountId}`).then((r) => r.json()).catch(() => ({ carousels: [] })),
      fetch(`/api/accounts/${accountId}`).then((r) => r.json()).catch(() => null),
    ]).then(([gridData, carouselData, accountData]) => {
      setGrid(gridData?.grid ?? null);
      const all: Carousel[] = carouselData?.carousels ?? [];
      setCarousels(all.filter((c) => c.sourceGridId === gridId));
      setBranding(accountData?.effectiveBranding ?? null);
      setReloadKey((k) => k + 1);
      setLoading(false);
    });
  }, [gridId]);

  useEffect(() => {
    fetchData();
    const handler = () => fetchData();
    window.addEventListener("account-changed", handler);
    return () => window.removeEventListener("account-changed", handler);
  }, [fetchData]);

  // Close fullscreen on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreview(null);
      if (preview) {
        if (e.key === "ArrowRight") setPreview((p) => p && p.slideIdx < p.carousel.slides.length - 1 ? { ...p, slideIdx: p.slideIdx + 1 } : p);
        if (e.key === "ArrowLeft") setPreview((p) => p && p.slideIdx > 0 ? { ...p, slideIdx: p.slideIdx - 1 } : p);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [preview]);

  function getSlideRendererProps(carousel: Carousel, slide = carousel.slides[0]) {
    if (!branding || !slide) return {};
    return computeSlideRendererProps(branding, carousel, slide);
  }

  const handleDelete = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    setConfirmState({
      open: true,
      title: t("deleteCarouselConfirm", { name }),
      description: t("deleteCarouselDesc"),
      onConfirm: async () => {
        const res = await fetch(`/api/carousels/${id}`, { method: "DELETE" });
        if (res.ok) {
          setCarousels((prev) => prev.filter((c) => c.id !== id));
          if (preview?.carousel.id === id) setPreview(null);
        }
      },
    });
  };

  const returnPath = `/content/my-posts-grid/${gridId}`;

  return (
    <div className="h-full flex flex-col">
      <TopBar />
      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={(open) => setConfirmState((s) => ({ ...s, open }))}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel={t("delete")}
        variant="destructive"
        onConfirm={confirmState.onConfirm}
      />

      {/* Fullscreen preview overlay */}
      {preview && (() => {
        const { carousel: pc, slideIdx } = preview;
        const slide = pc.slides[slideIdx];
        const rendererProps = slide ? getSlideRendererProps(pc, slide) : {};
        const total = pc.slides.length;
        return (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center"
            onClick={() => setPreview(null)}
          >
            {/* Top bar */}
            <div
              className="absolute top-0 inset-x-0 flex items-center justify-between px-4 py-3 bg-black/40"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-white text-sm font-medium truncate max-w-xs">{pc.name}</p>
              <div className="flex items-center gap-2">
                <PublishDialog
                  open={publishOpen}
                  onOpenChange={setPublishOpen}
                  carouselId={pc.id}
                  carouselName={pc.name}
                  caption={pc.caption}
                  hashtags={pc.hashtags}
                  isPost={pc.kind === "post" || pc.slides.length === 1}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); setPublishOpen(true); }}
                  className="h-8 px-3 rounded-lg flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-sm font-medium transition-colors"
                >
                  <Send className="h-3.5 w-3.5" />
                  {t("publish")}
                </button>
                <Button
                  variant="accent"
                  size="sm"
                  onClick={() => router.push(`/carousel/${pc.id}?from=${encodeURIComponent(returnPath)}`)}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  {t("edit")}
                </Button>
                <button
                  onClick={() => setPreview(null)}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Slide */}
            <div
              className="relative flex items-center justify-center w-full max-w-lg px-16"
              onClick={(e) => e.stopPropagation()}
            >
              {total > 1 && (
                <button
                  onClick={() => setPreview((p) => p && p.slideIdx > 0 ? { ...p, slideIdx: p.slideIdx - 1 } : p)}
                  disabled={slideIdx === 0}
                  className="absolute left-2 h-10 w-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 disabled:opacity-20 transition-all"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              <div className="w-full aspect-3/4 rounded-xl overflow-hidden shadow-2xl">
                {slide && (
                  <SlideRenderer
                    html={slide.html}
                    aspectRatio={pc.aspectRatio}
                    className="w-full h-full"
                    {...rendererProps}
                  />
                )}
              </div>
              {total > 1 && (
                <button
                  onClick={() => setPreview((p) => p && p.slideIdx < p.carousel.slides.length - 1 ? { ...p, slideIdx: p.slideIdx + 1 } : p)}
                  disabled={slideIdx === total - 1}
                  className="absolute right-2 h-10 w-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 disabled:opacity-20 transition-all"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Slide dots */}
            {total > 1 && (
              <div className="flex gap-1.5 mt-4" onClick={(e) => e.stopPropagation()}>
                {pc.slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPreview((p) => p ? { ...p, slideIdx: i } : p)}
                    className={`h-1.5 rounded-full transition-all ${i === slideIdx ? "w-4 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70"}`}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })()}

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => router.push("/content/my-posts-grid")}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold">{grid?.name ?? "Post Grid"}</h1>
              {!loading && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {carousels.length} {t(carousels.length === 1 ? "post" : "posts")}
                </p>
              )}
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-3 gap-1">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="aspect-square bg-muted animate-pulse rounded-sm" />
              ))}
            </div>
          ) : carousels.length === 0 ? (
            <div className="text-center py-20">
              <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">{t("noContentYet")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {carousels.map((carousel) => (
                <div
                  key={carousel.id}
                  onClick={() => setPreview({ carousel, slideIdx: 0 })}
                  className="relative aspect-square bg-muted rounded-sm overflow-hidden group cursor-pointer"
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

                  {/* Slide count badge — always visible, bottom-left */}
                  {carousel.kind !== "post" && carousel.slides.length > 1 && (
                    <div className="absolute bottom-1.5 left-1.5 bg-black/70 rounded-md px-1.5 py-0.5 text-[9px] text-white font-semibold flex items-center gap-0.5 z-10">
                      <SlidersHorizontal className="h-2.5 w-2.5" />
                      {carousel.slides.length}
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors opacity-0 group-hover:opacity-100 flex items-center justify-center">
                    {/* Fullscreen icon center */}
                    <div className="h-10 w-10 rounded-full bg-black/50 flex items-center justify-center">
                      <ChevronRight className="h-5 w-5 text-white -ml-0.5 hidden" />
                      <Layers className="h-5 w-5 text-white hidden" />
                      <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                      </svg>
                    </div>
                    {/* Delete button top-right */}
                    <button
                      onClick={(e) => handleDelete(e, carousel.id, carousel.name)}
                      className="absolute top-1.5 right-1.5 h-6 w-6 rounded flex items-center justify-center bg-black/60 text-white hover:bg-red-500 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Name tooltip bottom */}
                  <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-white text-[10px] font-medium line-clamp-1 leading-tight">{carousel.name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
