"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Pencil, LayoutGrid, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/lib/i18n/context";
import type { Grid } from "@/types/grid";
import type { Template } from "@/types/template";
import type { Carousel, Slide } from "@/types/carousel";
import { GridBuilderDialog } from "./GridBuilderDialog";
import { SlideRenderer } from "@/components/editor/SlideRenderer";
import { computeSlideRendererProps } from "@/lib/slide-renderer-props";
import { useBranding } from "@/lib/hooks/useBranding";

export function GridGallery() {
  const { t } = useI18n();
  const branding = useBranding();
  const [grids, setGrids] = useState<Grid[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing] = useState<Grid | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Grid | null>(null);

  const fetchAll = useCallback(() => {
    const accountId = localStorage.getItem("activeAccountId");
    const url = accountId ? `/api/grids?accountId=${accountId}` : "/api/grids";
    const tplUrl = accountId ? `/api/templates?accountId=${accountId}` : "/api/templates";
    setLoading(true);
    Promise.all([
      fetch(url).then((r) => r.json()),
      fetch(tplUrl).then((r) => r.json()),
    ])
      .then(([gd, td]) => {
        setGrids(gd.grids || []);
        setTemplates(td.templates || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAll();
    const handler = () => fetchAll();
    window.addEventListener("account-changed", handler);
    return () => window.removeEventListener("account-changed", handler);
  }, [fetchAll]);

  const handleSaved = () => {
    setBuilderOpen(false);
    setEditing(null);
    fetchAll();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const res = await fetch(`/api/grids/${confirmDelete.id}`, { method: "DELETE" });
    if (res.ok) {
      setGrids((prev) => prev.filter((g) => g.id !== confirmDelete.id));
    }
    setConfirmDelete(null);
  };

  const templatesById = new Map(templates.map((t) => [t.id, t]));

  return (
    <div>
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title={t("deleteGridConfirm", { name: confirmDelete?.name ?? "" })}
        description={t("actionCannotBeUndone")}
        confirmLabel={t("delete")}
        variant="destructive"
        onConfirm={handleDelete}
      />

      <GridBuilderDialog
        open={builderOpen || !!editing}
        onOpenChange={(open) => { if (!open) { setBuilderOpen(false); setEditing(null); } }}
        templates={templates}
        editing={editing}
        onSaved={handleSaved}
      />

      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted-foreground">{t("gridGalleryHint")}</p>
        <Button variant="accent" size="sm" onClick={() => { setEditing(null); setBuilderOpen(true); }}>
          <Plus className="h-3.5 w-3.5" />
          {t("newGrid")}
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2].map((i) => <div key={i} className="h-56 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : grids.length === 0 ? (
        <div className="text-center py-16">
          <LayoutGrid className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-sm font-semibold mb-1">{t("noGridsYet")}</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">{t("noGridsDesc")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {grids.map((grid) => {
            const cols = grid.size === 3 ? 3 : grid.size === 6 ? 3 : 3;
            return (
              <div key={grid.id} className="rounded-xl border border-border bg-surface p-4 group hover:border-accent/50 hover:shadow-md hover:-translate-y-0.5 transition-[translate,border-color,box-shadow] duration-200">
                <div
                  className="rounded-lg bg-muted mb-3 overflow-hidden grid gap-1 p-1"
                  style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, aspectRatio: `${cols} / ${grid.size / cols}` }}
                >
                  {grid.items.map((item) => {
                    const tpl = item.templateId ? templatesById.get(item.templateId) : null;
                    return (
                      <div key={item.position} className="relative bg-background rounded overflow-hidden">
                        {tpl && tpl.slides[0] ? (
                          <SlideRenderer
                            html={tpl.slides[0].html}
                            aspectRatio={tpl.aspectRatio}
                            className="w-full h-full"
                            {...(branding ? computeSlideRendererProps(branding, { brandingOverride: tpl.brandingOverride } as unknown as Carousel, tpl.slides[0] as unknown as Slide) : {})}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground/40">
                            {t("emptyCell")}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm truncate">{grid.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {grid.size} {t("cells")} &middot; {grid.items.filter((i) => i.templateId).length}/{grid.size} {t("filled")}
                    </p>
                    <p className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                      <Calendar className="h-3 w-3" />
                      {new Date(grid.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => setEditing(grid)}
                      className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
                      title={t("edit")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(grid)}
                      className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title={t("delete")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
