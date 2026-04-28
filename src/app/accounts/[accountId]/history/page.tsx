"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, Check, X, Send, Download } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import type { Carousel } from "@/types/carousel";

interface PageProps { params: Promise<{ accountId: string }> }

export default function AccountHistoryPage({ params }: PageProps) {
  const { accountId } = use(params);
  const [carousels, setCarousels] = useState<Carousel[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDest, setFilterDest] = useState<string>("all");

  useEffect(() => {
    fetch("/api/carousels")
      .then((r) => r.json())
      .then((d) => {
        const all: Carousel[] = d.carousels || [];
        const withHistory = all.filter(
          (c) => c.publishHistory && c.publishHistory.length > 0
        );
        setCarousels(withHistory);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const allEntries = carousels
    .flatMap((c) =>
      (c.publishHistory || []).map((entry) => ({ ...entry, carousel: c }))
    )
    .filter((e) => filterDest === "all" || e.destination === filterDest)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const destinations = [...new Set(carousels.flatMap((c) => (c.publishHistory || []).map((e) => e.destination)))];

  return (
    <div className="h-full flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-6">
            <Link href={`/accounts/${accountId}`} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-xl font-bold">Publish History</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{allEntries.length} publish events</p>
            </div>
          </div>

          {/* Filter tabs */}
          {destinations.length > 0 && (
            <div className="flex gap-1 mb-4 border-b border-border">
              {["all", ...destinations].map((d) => (
                <button
                  key={d}
                  onClick={() => setFilterDest(d)}
                  className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors capitalize cursor-pointer ${
                    filterDest === d
                      ? "border-accent text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : allEntries.length === 0 ? (
            <div className="text-center py-16">
              <Send className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No publish history yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {allEntries.map((entry, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                    entry.success ? "bg-green-500/10" : "bg-destructive/10"
                  }`}>
                    {entry.success
                      ? <Check className="h-4 w-4 text-green-500" />
                      : <X className="h-4 w-4 text-destructive" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/carousel/${entry.carousel.id}`} className="text-sm font-medium hover:text-accent transition-colors truncate block">
                      {entry.carousel.name}
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground capitalize flex items-center gap-1">
                        {entry.destination === "telegram" ? <Send className="h-2.5 w-2.5" /> : <Download className="h-2.5 w-2.5" />}
                        {entry.destination}
                      </span>
                      {entry.error && (
                        <span className="text-xs text-destructive">{entry.error}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
