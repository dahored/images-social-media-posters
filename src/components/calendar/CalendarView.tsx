"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import type { Carousel } from "@/types/carousel";

interface Props {
  carousels: Carousel[];
}

const DAY_LABELS_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DAY_LABELS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = (firstDay.getDay() + 6) % 7;
  const days: { date: Date; current: boolean }[] = [];
  for (let i = startPad - 1; i >= 0; i--) days.push({ date: new Date(year, month, -i), current: false });
  for (let d = 1; d <= lastDay.getDate(); d++) days.push({ date: new Date(year, month, d), current: true });
  const rem = 7 - (days.length % 7);
  if (rem < 7) for (let d = 1; d <= rem; d++) days.push({ date: new Date(year, month + 1, d), current: false });
  return days;
}

export function CalendarView({ carousels }: Props) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const dayLabels = locale === "es" ? DAY_LABELS_ES : DAY_LABELS_EN;
  const days = buildMonthGrid(year, month);
  const todayKey = toDateKey(now);

  const byDate = new Map<string, Carousel[]>();
  for (const c of carousels) {
    if (!c.scheduledAt) continue;
    const key = c.scheduledAt.slice(0, 10);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(c);
  }

  const prevMonth = useCallback(() => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1);
  }, [month]);

  const nextMonth = useCallback(() => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1);
  }, [month]);

  const monthName = new Date(year, month, 1).toLocaleString(
    locale === "es" ? "es-ES" : "en-US",
    { month: "long", year: "numeric" }
  );

  return (
    <div>
      {/* Month header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="text-sm font-semibold capitalize">{monthName}</h2>
        <button onClick={nextMonth} className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-1">
        {dayLabels.map((d) => (
          <div key={d} className="text-[11px] font-medium text-muted-foreground text-center py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border border-border">
        {days.map(({ date, current }, i) => {
          const key = toDateKey(date);
          const posts = byDate.get(key) ?? [];
          const isToday = key === todayKey;

          return (
            <button
              key={i}
              onClick={() => router.push(`/calendar/day/${key}`)}
              className={`relative min-h-18 p-1.5 text-left transition-colors flex flex-col ${
                current ? "bg-surface hover:bg-muted/50" : "bg-muted/30"
              }`}
            >
              <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                isToday ? "bg-accent text-white" : current ? "text-foreground" : "text-muted-foreground/40"
              }`}>
                {date.getDate()}
              </span>
              {posts.length > 0 && (
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  {posts.slice(0, 2).map((c) => (
                    <div key={c.id} className={`rounded px-1 py-0.5 text-[10px] leading-tight truncate ${
                      c.kind === "post" ? "bg-blue-100 text-blue-800" : "bg-violet-100 text-violet-800"
                    }`}>
                      {c.name}
                    </div>
                  ))}
                  {posts.length > 2 && (
                    <span className="text-[10px] text-muted-foreground px-1">+{posts.length - 2}</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {byDate.size === 0 && (
        <div className="mt-6 text-center py-8">
          <CalendarDays className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{t("noScheduledPosts")}</p>
        </div>
      )}
    </div>
  );
}
