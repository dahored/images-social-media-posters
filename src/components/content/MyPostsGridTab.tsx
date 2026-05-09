"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Layers, SlidersHorizontal, Image, LayoutGrid, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlideRenderer } from "@/components/editor/SlideRenderer";
import { useI18n } from "@/lib/i18n/context";
import type { Carousel } from "@/types/carousel";
import type { Grid } from "@/types/grid";
import type { SlideRendererProps } from "@/lib/slide-renderer-props";

interface Props {
  carousels: Carousel[];
  loading: boolean;
  reloadKey: number;
  getSlideRendererProps: (carousel: Carousel) => SlideRendererProps | {};
}

export function MyPostsGridTab({ carousels, loading, reloadKey, getSlideRendererProps }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const [grids, setGrids] = useState<Grid[]>([]);

  const fetchGrids = useCallback(() => {
    const accountId = localStorage.getItem("activeAccountId");
    const url = accountId ? `/api/grids?accountId=${accountId}` : "/api/grids";
    fetch(url)
      .then((r) => r.json())
      .then((d) => setGrids(d.grids || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchGrids();
    const handler = () => fetchGrids();
    window.addEventListener("account-changed", handler);
    return () => window.removeEventListener("account-changed", handler);
  }, [fetchGrids]);

  const gridById = new Map(grids.map((g) => [g.id, g]));

  // Only carousels generated via Masivo
  const bulkCarousels = carousels.filter((c) => !!c.sourceGridId);

  // Group by sourceGridId, sorted newest batch first
  const groups: { grid: Grid | null; gridId: string; items: Carousel[] }[] = [];
  const seen = new Map<string, number>();
  const sorted = [...bulkCarousels].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  for (const c of sorted) {
    const gid = c.sourceGridId!;
    if (!seen.has(gid)) {
      seen.set(gid, groups.length);
      groups.push({ grid: gridById.get(gid) ?? null, gridId: gid, items: [] });
    }
    groups[seen.get(gid)!].items.push(c);
  }

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-1">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="aspect-square bg-muted animate-pulse rounded-sm" />
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-20">
        <LayoutGrid className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-sm font-semibold mb-1">{t("noContentYet")}</h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          {t("bulkPickGridHint")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {groups.map(({ grid, gridId, items }) => (
        <div key={gridId}>
          <div className="flex items-center gap-3 mb-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold truncate">{grid?.name ?? gridId}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {items.length} {items.length === 1 ? t("post") : t("posts")}
              </p>
            </div>
            <div className="flex-1 h-px bg-border" />
            <button
              onClick={() => {
                const accountId = localStorage.getItem("activeAccountId") ?? "";
                window.open(`/feed-preview?accountId=${accountId}&gridId=${gridId}`, "_blank");
              }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-accent transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {t("viewAll")}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1">
            {items.map((carousel) => (
              <button
                key={carousel.id}
                onClick={() => router.push(`/carousel/${carousel.id}`)}
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

                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                  <span className="text-white text-[11px] font-medium px-2 text-center leading-tight line-clamp-2">
                    {carousel.name}
                  </span>
                  <span className="flex items-center gap-1 text-white/70 text-[10px]">
                    {carousel.kind === "post" ? (
                      <><Image className="h-3 w-3" />{t("post")}</>
                    ) : (
                      <><SlidersHorizontal className="h-3 w-3" />{carousel.slides.length} {t("slides")}</>
                    )}
                  </span>
                </div>

                {carousel.kind !== "post" && carousel.slides.length > 1 && (
                  <div className="absolute top-1.5 right-1.5 bg-black/60 rounded px-1 py-0.5 text-[9px] text-white font-medium">
                    {carousel.slides.length}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
