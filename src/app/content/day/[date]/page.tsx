"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Layers, SlidersHorizontal, Image as ImageIcon, Copy, Trash2, Calendar } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { SlideRenderer } from "@/components/editor/SlideRenderer";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/lib/i18n/context";
import type { Carousel } from "@/types/carousel";
import type { EffectiveBranding } from "@/types/account";
import { computeSlideRendererProps } from "@/lib/slide-renderer-props";

export default function DayPage() {
  const router = useRouter();
  const params = useParams();
  const { t } = useI18n();
  const date = params.date as string; // "YYYY-MM-DD"

  const [carousels, setCarousels] = useState<Carousel[]>([]);
  const [loading, setLoading] = useState(true);
  const [branding, setBranding] = useState<EffectiveBranding | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  const fetchData = useCallback(() => {
    const accountId = localStorage.getItem("activeAccountId");
    if (!accountId) { setLoading(false); return; }
    Promise.all([
      fetch(`/api/carousels?accountId=${accountId}`).then((r) => r.json()),
      fetch(`/api/accounts/${accountId}`).then((r) => r.json()),
    ]).then(([cd, ad]) => {
      const all: Carousel[] = cd.carousels ?? [];
      setCarousels(all.filter((c) => c.createdAt.slice(0, 10) === date));
      setBranding(ad.effectiveBranding ?? null);
      setReloadKey((k) => k + 1);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [date]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const dateLabel = date
    ? new Date(date + "T12:00").toLocaleDateString("es-ES", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      })
    : "";

  function getRendererProps(c: Carousel) {
    if (!branding || !c.slides[0]) return {};
    return computeSlideRendererProps(branding, c, c.slides[0]);
  }

  return (
    <div className="h-full flex flex-col">
      <TopBar />

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title={t("deleteCarouselConfirm", { name: confirmDelete?.name ?? "" })}
        description={t("deleteCarouselDesc")}
        confirmLabel={t("delete")}
        variant="destructive"
        onConfirm={async () => {
          if (!confirmDelete) return;
          const res = await fetch(`/api/carousels/${confirmDelete.id}`, { method: "DELETE" });
          if (res.ok) setCarousels((prev) => prev.filter((c) => c.id !== confirmDelete.id));
          setConfirmDelete(null);
        }}
      />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => router.back()}
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
              {[1, 2, 3].map((i) => <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : carousels.length === 0 ? (
            <div className="text-center py-20">
              <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">{t("noContentYet")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {carousels.map((c) => (
                <div
                  key={c.id}
                  onClick={() => router.push(`/carousel/${c.id}`)}
                  className="relative text-left rounded-xl border border-border bg-surface hover:border-accent/50 hover:shadow-md hover:-translate-y-0.5 p-4 group cursor-pointer transition-[translate,border-color,box-shadow] duration-200"
                >
                  <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const res = await fetch(`/api/carousels/${c.id}/duplicate`, { method: "POST" });
                        if (res.ok) { const dup = await res.json(); setCarousels((prev) => [dup, ...prev]); }
                      }}
                      className="h-7 w-7 rounded-lg flex items-center justify-center bg-white border border-border hover:bg-muted"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete({ id: c.id, name: c.name }); }}
                      className="h-7 w-7 rounded-lg flex items-center justify-center bg-white border border-border hover:bg-destructive hover:text-white hover:border-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="relative h-28 rounded-lg bg-muted mb-3 overflow-hidden">
                    {c.slides.length > 0 ? (
                      <SlideRenderer
                        key={`${c.id}-${reloadKey}`}
                        html={c.slides[0].html}
                        aspectRatio={c.aspectRatio}
                        className="w-full h-full"
                        {...getRendererProps(c)}
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <Layers className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>

                  <h3 className="font-semibold text-sm group-hover:text-accent transition-colors truncate">{c.name}</h3>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    {c.kind === "post" ? (
                      <Badge variant="secondary" className="text-[10px]">
                        <ImageIcon className="h-2.5 w-2.5 mr-1" />{t("post")}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        <SlidersHorizontal className="h-2.5 w-2.5 mr-1" />{t("carousel")}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-[10px]">{c.aspectRatio}</Badge>
                    {c.scheduledAt && (
                      <Badge variant="secondary" className="text-[10px] text-accent border-accent/30">
                        <Calendar className="h-2.5 w-2.5 mr-1" />
                        {new Date(c.scheduledAt + (c.scheduledAt.length === 10 ? "T12:00" : "")).toLocaleDateString()}
                      </Badge>
                    )}
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
