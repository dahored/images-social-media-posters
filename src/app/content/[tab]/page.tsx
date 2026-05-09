"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Plus, Layers, Calendar, SlidersHorizontal, Trash2, Copy, Image, ArrowRight } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CreateContentDialog } from "@/components/ui/create-content-dialog";
import { SlideRenderer } from "@/components/editor/SlideRenderer";
import { TemplateGallery } from "@/components/templates/TemplateGallery";
import { GridGallery } from "@/components/grids/GridGallery";
import { BulkPanel } from "@/components/bulk/BulkPanel";
import { MyPostsGridTab } from "@/components/content/MyPostsGridTab";
import { useI18n } from "@/lib/i18n/context";
import type { Carousel, AspectRatio } from "@/types/carousel";
import type { EffectiveBranding } from "@/types/account";
import { computeSlideRendererProps } from "@/lib/slide-renderer-props";

type TabId = "content" | "my-posts-grid" | "templates" | "grids" | "bulk";

const TAB_TO_PATH: Record<TabId, string> = {
  content: "my-content",
  "my-posts-grid": "my-posts-grid",
  templates: "templates",
  grids: "grids",
  bulk: "bulk",
};

const PATH_TO_TAB: Record<string, TabId> = {
  "my-content": "content",
  "my-posts-grid": "my-posts-grid",
  templates: "templates",
  grids: "grids",
  bulk: "bulk",
};

export default function ContentPage() {
  const router = useRouter();
  const params = useParams();
  const { t } = useI18n();

  const activeTab: TabId = PATH_TO_TAB[params.tab as string] ?? "content";

  const [carousels, setCarousels] = useState<Carousel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBranding, setActiveBranding] = useState<EffectiveBranding | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const fetchBranding = useCallback(() => {
    const id = localStorage.getItem("activeAccountId");
    if (!id) { setActiveBranding(null); return; }
    fetch(`/api/accounts/${id}`)
      .then((r) => r.json())
      .then((d) => setActiveBranding(d.effectiveBranding ?? null))
      .catch(() => setActiveBranding(null));
  }, []);

  const fetchCarousels = useCallback(() => {
    const id = localStorage.getItem("activeAccountId");
    if (!id) {
      setCarousels([]);
      setLoading(false);
      return;
    }
    const url = `/api/carousels?accountId=${id}`;
    setCarousels([]);
    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        setCarousels(d.carousels || []);
        setReloadKey((k) => k + 1);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchCarousels();
    fetchBranding();
    const handleAccountChange = () => { fetchCarousels(); fetchBranding(); };
    const handleVisibility = () => { if (document.visibilityState === "visible") fetchCarousels(); };
    window.addEventListener("account-changed", handleAccountChange);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("account-changed", handleAccountChange);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchCarousels, fetchBranding]);

  function getSlideRendererProps(carousel: Carousel) {
    if (!activeBranding || !carousel.slides[0]) return {};
    return computeSlideRendererProps(activeBranding, carousel, carousel.slides[0]);
  }

  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: "", description: "", onConfirm: () => {} });

  const handleDelete = useCallback((e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    setConfirmState({
      open: true,
      title: t("deleteCarouselConfirm", { name }),
      description: t("deleteCarouselDesc"),
      onConfirm: async () => {
        const res = await fetch(`/api/carousels/${id}`, { method: "DELETE" });
        if (res.ok) {
          setCarousels((prev) => prev.filter((c) => c.id !== id));
        }
      },
    });
  }, [t]);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [contentFilter, setContentFilter] = useState<"all" | "carousel" | "post">("all");

  const handleCreate = useCallback(async (name: string, aspectRatio: AspectRatio, kind: "carousel" | "post" = "carousel", networkId?: string, theme?: "dark" | "light") => {
    const accountId = localStorage.getItem("activeAccountId") ?? undefined;
    const res = await fetch("/api/carousels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, aspectRatio, kind, networkId, accountId,
        ...(theme ? { brandingOverride: { theme } } : {}),
      }),
    });
    if (res.ok) {
      const carousel = await res.json();
      router.push(`/carousel/${carousel.id}`);
    }
  }, [router]);

  const navigateTab = (tab: TabId) => router.push(`/content/${TAB_TO_PATH[tab]}`);

  function getDateGroup(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const todayStr = now.toDateString();
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(now.getDate() - 1);
    const yesterdayStr = yesterdayDate.toDateString();
    if (d.toDateString() === todayStr) return "__today__";
    if (d.toDateString() === yesterdayStr) return "__yesterday__";
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function groupCarouselsByDate(items: Carousel[]) {
    const sorted = [...items].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const groups: { label: string; key: string; items: Carousel[] }[] = [];
    const seen = new Map<string, number>();
    for (const c of sorted) {
      const key = getDateGroup(c.createdAt);
      if (!seen.has(key)) {
        seen.set(key, groups.length);
        const label = key === "__today__" ? t("today") : key === "__yesterday__" ? t("yesterday") : key;
        groups.push({ label, key, items: [] });
      }
      groups[seen.get(key)!].items.push(c);
    }
    return groups;
  }

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

      <CreateContentDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreate={(name, aspectRatio, kind, networkId, theme) => handleCreate(name, aspectRatio, kind, networkId, theme)}
      />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">{t("contentStudio")}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t("dashboardSubtitle")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => setShowCreateDialog(true)} variant="accent">
                <Plus className="h-4 w-4" />
                {t("new")}
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 border-b border-border overflow-x-auto">
            {(["content", "my-posts-grid", "templates", "grids", "bulk"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => navigateTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === tab
                    ? "border-accent text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "content" ? t("myContent")
                  : tab === "my-posts-grid" ? t("myPostsGrid")
                  : tab === "templates" ? t("templates")
                  : tab === "grids" ? t("grids")
                  : t("bulk")}
              </button>
            ))}
          </div>

          {/* Content filter pills */}
          {activeTab === "content" && (
            <div className="flex gap-1.5 mb-5">
              {(["all", "carousel", "post"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setContentFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border cursor-pointer ${
                    contentFilter === f
                      ? "bg-foreground text-background border-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f === "all" ? t("all") : f === "carousel" ? t("carousels") : t("posts")}
                </button>
              ))}
            </div>
          )}

          {activeTab === "templates" ? (
            <TemplateGallery />
          ) : activeTab === "grids" ? (
            <GridGallery />
          ) : activeTab === "bulk" ? (
            <BulkPanel />
          ) : activeTab === "my-posts-grid" ? (
            <MyPostsGridTab carousels={carousels} loading={loading} reloadKey={reloadKey} getSlideRendererProps={getSlideRendererProps} />
          ) : loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : carousels.filter((c) => contentFilter === "all" || (c.kind || "carousel") === contentFilter).length === 0 ? (
            <div className="text-center py-20">
              <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">{t("noContentYet")}</h2>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                {t("noContentDesc")}
              </p>
              <div className="flex items-center justify-center gap-3">
                <Button onClick={() => setShowCreateDialog(true)} variant="accent" size="lg">
                  <Plus className="h-5 w-5" />
                  {t("createContent")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {groupCarouselsByDate(
                carousels.filter((c) => contentFilter === "all" || (c.kind || "carousel") === contentFilter)
              ).map((group) => (
                <div key={group.key}>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-xs font-semibold text-foreground bg-muted px-2.5 py-1 rounded-full">
                      {group.label}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                    <button
                      onClick={() => {
                        const iso = group.items[0]?.createdAt?.slice(0, 10) ?? "";
                        router.push(`/content/day/${iso}`);
                      }}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-accent transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {t("viewAll")}
                    </button>
                  </div>
                  <div className="oc-stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.items.map((carousel) => (
                      <div
                        key={carousel.id}
                        onClick={() => router.push(`/carousel/${carousel.id}`)}
                        className="relative text-left rounded-xl border border-border bg-surface hover:border-accent/50 hover:shadow-md hover:-translate-y-0.5 p-4 group cursor-pointer transition-[translate,border-color,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]"
                      >
                        <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const res = await fetch(`/api/carousels/${carousel.id}/duplicate`, { method: "POST" });
                              if (res.ok) {
                                const dup = await res.json();
                                setCarousels((prev) => [dup, ...prev]);
                              }
                            }}
                            className="h-7 w-7 rounded-lg flex items-center justify-center bg-white border border-border hover:bg-muted"
                            aria-label={`Duplicate ${carousel.name}`}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(e, carousel.id, carousel.name)}
                            className="h-7 w-7 rounded-lg flex items-center justify-center bg-white border border-border hover:bg-destructive hover:text-white hover:border-destructive"
                            aria-label={`Delete ${carousel.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="relative h-28 rounded-lg bg-muted mb-3 overflow-hidden">
                          {carousel.slides.length > 0 ? (
                            <SlideRenderer
                              key={`${carousel.id}-${reloadKey}`}
                              html={carousel.slides[0].html}
                              aspectRatio={carousel.aspectRatio}
                              className="w-full h-full"
                              {...getSlideRendererProps(carousel)}
                            />
                          ) : (
                            <div className="h-full flex items-center justify-center">
                              <Layers className="h-8 w-8 text-muted-foreground/30" />
                            </div>
                          )}
                        </div>
                        <h3 className="font-semibold text-sm group-hover:text-accent transition-colors truncate">
                          {carousel.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          {carousel.kind === "post" ? (
                            <Badge variant="secondary" className="text-[10px]">
                              <Image className="h-2.5 w-2.5 mr-1" />
                              {t("post")}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">
                              <SlidersHorizontal className="h-2.5 w-2.5 mr-1" />
                              {t("carousel")}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-[10px]">
                            {carousel.aspectRatio}
                          </Badge>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(carousel.createdAt).toLocaleDateString()}
                          </span>
                          {carousel.scheduledAt && (
                            <Badge variant="secondary" className="text-[10px] text-accent border-accent/30">
                              {new Date(carousel.scheduledAt + (carousel.scheduledAt.length === 10 ? "T12:00" : "")).toLocaleDateString()}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
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
