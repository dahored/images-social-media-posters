"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Layers, LayoutGrid, Trash2 } from "lucide-react";
import { SlideRenderer } from "@/components/editor/SlideRenderer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/lib/i18n/context";
import type { Carousel } from "@/types/carousel";
import type { Grid } from "@/types/grid";
import type { SlideRendererProps } from "@/lib/slide-renderer-props";

interface Props {
  carousels: Carousel[];
  loading: boolean;
  reloadKey: number;
  getSlideRendererProps: (carousel: Carousel) => SlideRendererProps | {};
  onCarouselsDeleted?: (ids: string[]) => void;
}

export function MyPostsGridTab({ carousels, loading, reloadKey, getSlideRendererProps, onCarouselsDeleted }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const [grids, setGrids] = useState<Grid[]>([]);
  const [confirmState, setConfirmState] = useState<{
    open: boolean; title: string; description: string; onConfirm: () => void;
  }>({ open: false, title: "", description: "", onConfirm: () => {} });

  const fetchGrids = useCallback(() => {
    const aid = localStorage.getItem("activeAccountId");
    const url = aid ? `/api/grids?accountId=${aid}` : "/api/grids";
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
  const bulkCarousels = carousels.filter((c) => !!c.sourceGridId);

  // Group by bulkRunId (one unique group per generation run).
  // Carousels without bulkRunId (created before this feature) fall back to sourceGridId.
  const runGroupMap = new Map<string, { runId: string; grid: Grid | null; items: Carousel[]; createdAt: string }>();
  for (const c of bulkCarousels) {
    const runId = c.bulkRunId ?? c.sourceGridId!;
    if (!runGroupMap.has(runId)) {
      runGroupMap.set(runId, {
        runId,
        grid: gridById.get(c.sourceGridId!) ?? null,
        items: [],
        createdAt: c.createdAt,
      });
    }
    runGroupMap.get(runId)!.items.push(c);
  }

  // Sort by first carousel createdAt, most recent first
  const sortedGroups = [...runGroupMap.values()]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  function getDateKey(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const todayStr = now.toDateString();
    const yest = new Date(now); yest.setDate(now.getDate() - 1);
    if (d.toDateString() === todayStr) return "__today__";
    if (d.toDateString() === yest.toDateString()) return "__yesterday__";
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  }

  // Group sorted runs by their first carousel's creation date
  type RunGroup = { runId: string; grid: Grid | null; items: Carousel[]; createdAt: string };
  const dateGroups: { label: string; key: string; groups: RunGroup[] }[] = [];
  const seenDate = new Map<string, number>();
  for (const g of sortedGroups) {
    const key = getDateKey(g.createdAt);
    if (!seenDate.has(key)) {
      seenDate.set(key, dateGroups.length);
      const label = key === "__today__" ? t("today") : key === "__yesterday__" ? t("yesterday") : key;
      dateGroups.push({ label, key, groups: [] });
    }
    dateGroups[seenDate.get(key)!].groups.push(g);
  }

  const groups = sortedGroups;

  const handleDeleteGroup = (e: React.MouseEvent, _runId: string, gridName: string, items: Carousel[]) => {
    e.stopPropagation();
    setConfirmState({
      open: true,
      title: `¿Eliminar "${gridName}"?`,
      description: `Se eliminarán ${items.length} ${items.length === 1 ? "publicación" : "publicaciones"} generadas. Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        await fetch("/api/carousels", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: items.map((c) => c.id) }),
        });
        onCarouselsDeleted?.(items.map((c) => c.id));
      },
    });
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((_, i) => (
          <div key={i} className="h-56 rounded-xl bg-muted animate-pulse" />
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
    <>
      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={(open) => setConfirmState((s) => ({ ...s, open }))}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel={t("delete")}
        variant="destructive"
        onConfirm={confirmState.onConfirm}
      />

      <div className="space-y-8">
        {dateGroups.map(({ label, key, groups: dateGroupItems }) => (
          <div key={key}>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {label}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {dateGroupItems.map(({ runId, grid, items, createdAt }) => {
                const preview = items.slice(0, 9);
                const cols = 3;
                const rows = Math.min(3, Math.ceil(Math.max(preview.length, 1) / cols));
                const slots = cols * rows;
                const gridName = grid?.name ?? runId;
                return (
                  <div
                    key={runId}
                    className="relative rounded-xl border border-border bg-surface p-4 hover:border-accent hover:shadow-md transition-all group cursor-pointer"
                    onClick={() => router.push(`/content/my-posts-grid/${runId}`)}
                  >
                    {/* Delete button */}
                    <button
                      onClick={(e) => handleDeleteGroup(e, runId, gridName, items)}
                      className="absolute top-3 right-3 h-7 w-7 rounded-lg flex items-center justify-center bg-white border border-border hover:bg-destructive hover:text-white hover:border-destructive opacity-0 group-hover:opacity-100 transition-all z-10"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>

                    {/* Mini grid preview */}
                    <div
                      className="rounded-lg overflow-hidden mb-3 grid gap-0.5 bg-muted"
                      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
                    >
                      {Array.from({ length: slots }).map((_, i) => {
                        const carousel = preview[i];
                        return (
                          <div key={i} className="aspect-square bg-muted/50 overflow-hidden">
                            {carousel?.slides[0] ? (
                              <SlideRenderer
                                key={`${carousel.id}-${reloadKey}`}
                                html={carousel.slides[0].html}
                                aspectRatio={carousel.aspectRatio}
                                className="w-full h-full"
                                {...getSlideRendererProps(carousel)}
                              />
                            ) : carousel ? (
                              <div className="w-full h-full flex items-center justify-center">
                                <Layers className="h-4 w-4 text-muted-foreground/30" />
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                    <h3 className="font-semibold text-sm truncate pr-6">{gridName}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {items.length} {t(items.length === 1 ? "post" : "posts")}
                      {createdAt && (
                        <span className="ml-2 opacity-60">
                          · {new Date(createdAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
