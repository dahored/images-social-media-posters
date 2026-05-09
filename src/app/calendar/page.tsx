"use client";

import { useEffect, useState, useCallback } from "react";
import { SlidersHorizontal, Image as ImageIcon, CalendarDays, X, LayoutGrid } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { CalendarView } from "@/components/calendar/CalendarView";
import { useI18n } from "@/lib/i18n/context";
import type { Carousel } from "@/types/carousel";
import type { EffectiveBranding } from "@/types/account";
import type { Grid } from "@/types/grid";

function ScheduleDatePicker({
  carousel,
  onSave,
  onClear,
}: {
  carousel: Carousel;
  onSave: (scheduledAt: string) => void;
  onClear: () => void;
}) {
  const { t } = useI18n();
  const existing = carousel.scheduledAt ?? "";
  const [date, setDate] = useState(existing.slice(0, 10));
  const [time, setTime] = useState(existing.length > 10 ? existing.slice(11, 16) : "");
  const today = new Date().toISOString().slice(0, 10);

  const handleSave = () => {
    if (!date) return;
    onSave(time ? `${date}T${time}` : date);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        type="date"
        value={date}
        min={today}
        onChange={(e) => setDate(e.target.value)}
        className="h-7 px-2 rounded-md border border-border bg-background text-xs"
      />
      <input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className="h-7 px-2 rounded-md border border-border bg-background text-xs w-24"
      />
      <button
        onClick={handleSave}
        disabled={!date}
        className="h-7 px-2.5 rounded-md bg-accent text-white text-xs font-medium disabled:opacity-40"
      >
        {t("save")}
      </button>
      {existing && (
        <button onClick={onClear} className="h-7 px-2 rounded-md text-xs text-muted-foreground hover:text-destructive">
          {t("clearDate")}
        </button>
      )}
    </div>
  );
}

function TypePill({ c }: { c: Carousel }) {
  const { t } = useI18n();
  if (c.sourceGridId) {
    return (
      <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide bg-emerald-100 text-emerald-700">
        Grid
      </span>
    );
  }
  if (c.kind === "post") {
    return (
      <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide bg-blue-100 text-blue-700">
        {t("post")}
      </span>
    );
  }
  return (
    <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide bg-violet-100 text-violet-700">
      {t("carousel")}
    </span>
  );
}

function ItemIcon({ c }: { c: Carousel }) {
  if (c.sourceGridId) {
    return (
      <div className="h-6 w-6 rounded flex items-center justify-center shrink-0 bg-emerald-100 text-emerald-600">
        <LayoutGrid className="h-3 w-3" />
      </div>
    );
  }
  if (c.kind === "post") {
    return (
      <div className="h-6 w-6 rounded flex items-center justify-center shrink-0 bg-blue-100 text-blue-600">
        <ImageIcon className="h-3 w-3" />
      </div>
    );
  }
  return (
    <div className="h-6 w-6 rounded flex items-center justify-center shrink-0 bg-violet-100 text-violet-600">
      <SlidersHorizontal className="h-3 w-3" />
    </div>
  );
}

function SidebarItem({
  c,
  schedulingId,
  onToggle,
  onSave,
  onClear,
  showDate,
  onClearDate,
}: {
  c: Carousel;
  schedulingId: string | null;
  onToggle: () => void;
  onSave: (at: string) => void;
  onClear: () => void;
  showDate?: boolean;
  onClearDate?: () => void;
}) {
  return (
    <div className="group">
      <div
        onClick={onToggle}
        className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors"
      >
        <ItemIcon c={c} />
        <div className="min-w-0 flex-1">
          <p className="text-xs truncate">{c.name}</p>
          {showDate && c.scheduledAt && (
            <p className="text-[10px] text-muted-foreground">
              {new Date(c.scheduledAt + (c.scheduledAt.length === 10 ? "T12:00" : "")).toLocaleDateString()}
              {c.scheduledAt.length > 10 && ` · ${c.scheduledAt.slice(11, 16)}`}
            </p>
          )}
        </div>
        <TypePill c={c} />
        {!showDate && (
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 shrink-0" />
        )}
        {showDate && onClearDate && (
          <button
            onClick={(e) => { e.stopPropagation(); onClearDate(); }}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {schedulingId === c.id && (
        <div className="px-2 pb-2">
          <ScheduleDatePicker carousel={c} onSave={onSave} onClear={onClear} />
        </div>
      )}
    </div>
  );
}

export default function CalendarPage() {
  const { t } = useI18n();
  const [carousels, setCarousels] = useState<Carousel[]>([]);
  const [grids, setGrids] = useState<Grid[]>([]);
  const [branding, setBranding] = useState<EffectiveBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [schedulingId, setSchedulingId] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    const id = localStorage.getItem("activeAccountId");
    if (!id) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      fetch(`/api/carousels?accountId=${id}`).then((r) => r.json()),
      fetch(`/api/accounts/${id}`).then((r) => r.json()),
      fetch(`/api/grids?accountId=${id}`).then((r) => r.json()),
    ]).then(([cd, ad, gd]) => {
      setCarousels(cd.carousels || []);
      setBranding(ad.effectiveBranding ?? null);
      setGrids(gd.grids || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
    const handleVisibility = () => { if (document.visibilityState === "visible") fetchData(); };
    window.addEventListener("account-changed", fetchData);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("account-changed", fetchData);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchData]);

  const updateSchedule = useCallback(async (id: string, scheduledAt: string | undefined) => {
    await fetch(`/api/carousels/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledAt: scheduledAt ?? null }),
    });
    setCarousels((prev) =>
      prev.map((c) => c.id === id ? { ...c, scheduledAt } : c)
    );
    setSchedulingId(null);
  }, []);

  const gridById = new Map(grids.map((g) => [g.id, g]));

  const scheduled = carousels.filter((c) => !!c.scheduledAt);
  const unscheduled = carousels.filter((c) => !c.scheduledAt);

  // Split unscheduled into standalone and grid groups
  const standaloneUnscheduled = unscheduled.filter((c) => !c.sourceGridId);
  const gridUnscheduledMap = new Map<string, Carousel[]>();
  for (const c of unscheduled.filter((c) => !!c.sourceGridId)) {
    const gid = c.sourceGridId!;
    if (!gridUnscheduledMap.has(gid)) gridUnscheduledMap.set(gid, []);
    gridUnscheduledMap.get(gid)!.push(c);
  }

  const itemProps = (c: Carousel, showDate = false) => ({
    c,
    schedulingId,
    onToggle: () => setSchedulingId(schedulingId === c.id ? null : c.id),
    onSave: (at: string) => updateSchedule(c.id, at),
    onClear: () => updateSchedule(c.id, undefined),
    showDate,
    onClearDate: showDate ? () => updateSchedule(c.id, undefined) : undefined,
  });

  return (
    <div className="h-full flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">{t("calendarTitle")}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {scheduled.length} {t("scheduled").toLowerCase()} · {unscheduled.length} {t("unscheduled").toLowerCase()}
            </p>
          </div>

          {loading ? (
            <div className="h-96 rounded-xl bg-muted animate-pulse" />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Calendar - 2/3 width */}
              <div className="lg:col-span-2">
                <CalendarView carousels={carousels} />
              </div>

              {/* Sidebar - 1/3 width */}
              <div className="space-y-4">
                {/* Unscheduled */}
                <div className="rounded-xl border border-border bg-surface p-4">
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    {t("unscheduled")} · {unscheduled.length}
                  </h2>
                  {unscheduled.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t("noUnscheduledPosts")}</p>
                  ) : (
                    <div className="space-y-1 max-h-100 overflow-y-auto">
                      {standaloneUnscheduled.map((c) => (
                        <SidebarItem key={c.id} {...itemProps(c)} />
                      ))}

                      {Array.from(gridUnscheduledMap.entries()).map(([gid, items]) => (
                        <div key={gid} className="mt-2">
                          <div className="flex items-center gap-1.5 px-2 py-1">
                            <LayoutGrid className="h-3 w-3 text-emerald-600 shrink-0" />
                            <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wide truncate">
                              {gridById.get(gid)?.name ?? gid}
                            </span>
                          </div>
                          <div className="pl-2 border-l-2 border-emerald-100 ml-2 space-y-0.5">
                            {items.map((c) => (
                              <SidebarItem key={c.id} {...itemProps(c)} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Scheduled list (upcoming) */}
                {scheduled.length > 0 && (
                  <div className="rounded-xl border border-border bg-surface p-4">
                    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      {t("scheduled")} · {scheduled.length}
                    </h2>
                    <div className="space-y-1 max-h-75 overflow-y-auto">
                      {[...scheduled]
                        .sort((a, b) => (a.scheduledAt ?? "") < (b.scheduledAt ?? "") ? -1 : 1)
                        .map((c) => (
                          <SidebarItem key={c.id} {...itemProps(c, true)} />
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
