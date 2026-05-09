"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, Layers, SlidersHorizontal, Image as ImageIcon,
  Pencil, Share2, CalendarMinus, ChevronLeft, ChevronRight, Expand,
} from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { SlideRenderer } from "@/components/editor/SlideRenderer";
import { FullscreenPreview } from "@/components/editor/FullscreenPreview";
import { PublishDialog } from "@/components/editor/PublishButton";
import { useI18n } from "@/lib/i18n/context";
import type { Carousel } from "@/types/carousel";
import type { EffectiveBranding } from "@/types/account";
import { computeSlideRendererProps, type SlideRendererProps as RendererProps } from "@/lib/slide-renderer-props";

function PostCard({
  c,
  rendererProps,
  onClearDate,
}: {
  c: Carousel;
  rendererProps?: RendererProps;
  onClearDate: () => void;
}) {
  const { t } = useI18n();
  const [activeSlide, setActiveSlide] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const total = c.slides.length;

  return (
    <div className="rounded-xl border border-border bg-surface p-3 group hover:border-accent/50 hover:shadow-md transition-[border-color,box-shadow] duration-200">
      <FullscreenPreview
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        slides={c.slides}
        aspectRatio={c.aspectRatio}
        activeIndex={activeSlide}
        onActiveChange={setActiveSlide}
        {...rendererProps}
      />
      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        carouselId={c.id}
        carouselName={c.name}
        caption={c.caption}
        hashtags={c.hashtags}
        isPost={c.kind === "post"}
      />

      {/* Preview */}
      <div
        className="relative h-40 rounded-lg bg-muted mb-3 overflow-hidden cursor-zoom-in"
        onClick={() => setPreviewOpen(true)}
      >
        {total > 0 ? (
          <SlideRenderer
            html={c.slides[activeSlide].html}
            aspectRatio={c.aspectRatio}
            className="w-full h-full"
            {...rendererProps}
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <Layers className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}

        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
          <div className="h-8 w-8 rounded-full bg-black/50 flex items-center justify-center">
            <Expand className="h-4 w-4 text-white" />
          </div>
        </div>

        {total > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); setActiveSlide(i => Math.max(0, i - 1)); }}
              disabled={activeSlide === 0}
              className="absolute left-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 disabled:opacity-0 cursor-pointer z-10"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setActiveSlide(i => Math.min(total - 1, i + 1)); }}
              disabled={activeSlide === total - 1}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 disabled:opacity-0 cursor-pointer z-10"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1 z-10">
              {c.slides.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setActiveSlide(i); }}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${i === activeSlide ? "w-3 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <h3 className="font-semibold text-sm truncate group-hover:text-accent transition-colors mb-0.5">
        {c.name}
      </h3>
      <p className="flex items-center gap-1 text-[11px] text-muted-foreground mb-3">
        {c.kind === "post"
          ? <><ImageIcon className="h-3 w-3" />{t("post")}</>
          : <><SlidersHorizontal className="h-3 w-3" />{total} {t("slides")}</>
        }
        {c.scheduledAt && c.scheduledAt.length > 10 && (
          <span className="ml-1">· {c.scheduledAt.slice(11, 16)}</span>
        )}
      </p>

      <div className="flex items-center gap-1">
        <button
          onClick={() => window.open(`/carousel/${c.id}`, "_blank")}
          className="flex-1 h-7 rounded-md flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-border cursor-pointer"
        >
          <Pencil className="h-3 w-3" />
          {t("edit")}
        </button>
        <button
          onClick={() => setPublishOpen(true)}
          title={t("publish")}
          className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-accent hover:bg-accent/10 transition-colors border border-border shrink-0 cursor-pointer"
        >
          <Share2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onClearDate}
          title={t("clearDate")}
          className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors border border-border shrink-0 cursor-pointer"
        >
          <CalendarMinus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function CalendarDayPage() {
  const router = useRouter();
  const params = useParams();
  const { t, locale } = useI18n();
  const date = params.date as string;

  const [carousels, setCarousels] = useState<Carousel[]>([]);
  const [branding, setBranding] = useState<EffectiveBranding | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    const accountId = localStorage.getItem("activeAccountId");
    if (!accountId) { setLoading(false); return; }
    Promise.all([
      fetch(`/api/carousels?accountId=${accountId}`).then((r) => r.json()),
      fetch(`/api/accounts/${accountId}`).then((r) => r.json()),
    ]).then(([cd, ad]) => {
      const all: Carousel[] = cd.carousels ?? [];
      setCarousels(all.filter((c) => c.scheduledAt?.slice(0, 10) === date));
      setBranding(ad.effectiveBranding ?? null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [date]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const clearDate = useCallback(async (id: string) => {
    await fetch(`/api/carousels/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledAt: null }),
    });
    setCarousels((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const dateLabel = date
    ? new Date(date + "T12:00").toLocaleDateString(
        locale === "es" ? "es-ES" : "en-US",
        { weekday: "long", day: "numeric", month: "long", year: "numeric" }
      )
    : "";

  function getRendererProps(c: Carousel): RendererProps | undefined {
    if (!branding || !c.slides[0]) return undefined;
    return computeSlideRendererProps(branding, c, c.slides[0]);
  }

  return (
    <div className="h-full flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => router.push("/calendar")}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-xl font-bold capitalize">{dateLabel}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {carousels.length} {carousels.length === 1 ? t("post") : t("posts")}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <div key={i} className="h-64 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : carousels.length === 0 ? (
            <div className="text-center py-20">
              <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">{t("noScheduledPosts")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {carousels.map((c) => (
                <PostCard
                  key={c.id}
                  c={c}
                  rendererProps={getRendererProps(c)}
                  onClearDate={() => clearDate(c.id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
