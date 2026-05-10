"use client";

import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Send, Loader2, Check, X, ChevronDown, Image, SlidersHorizontal, Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";
import type { Carousel } from "@/types/carousel";

interface GridPublishButtonProps {
  carousels: Carousel[];
  gridName?: string;
  accountId?: string;
  className?: string;
}

type PublishState = "idle" | "publishing" | "done" | "error";

export function GridPublishButton({ carousels, gridName, accountId, className }: GridPublishButtonProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [telegramConfigured, setTelegramConfigured] = useState(false);
  const [telegramState, setTelegramState] = useState<PublishState>("idle");
  const [telegramProgress, setTelegramProgress] = useState({ current: 0, total: 0 });
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const webShareSupported = typeof navigator !== "undefined" && "share" in navigator && "canShare" in navigator;

  useEffect(() => {
    if (!open) return;
    fetch("/api/telegram")
      .then((r) => r.json())
      .then((d) => setTelegramConfigured(d.configured || false))
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) {
      setTelegramState("idle");
      setError(null);
      setTelegramProgress({ current: 0, total: 0 });
      setDownloadProgress({ current: 0, total: 0 });
      setSharing(false);
      setShared(false);
    }
  }, [open]);

  // Sort by creation time so posts are sent/downloaded in generation order
  const ordered = [...carousels].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  function buildSummary(): string {
    const date = new Date().toLocaleDateString("es-ES", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    const lines: string[] = [`📅 <b>Posts para el ${date}</b>`];
    if (gridName) lines.push(`🗂 ${gridName}\n`);
    let carouselIdx = 0;
    let postIdx = 0;
    for (const c of ordered) {
      const isPost = c.kind === "post" || c.slides.length === 1;
      if (isPost) {
        postIdx++;
        lines.push(`📸 Post ${postIdx}: ${c.name}`);
        if (c.caption) lines.push(`   ${c.caption}`);
      } else {
        carouselIdx++;
        lines.push(`🎠 Carrusel ${carouselIdx}: ${c.name} — inicio (${c.slides.length} slides)`);
      }
    }
    return lines.join("\n");
  }

  const downloading = downloadProgress.total > 0 && downloadProgress.current < downloadProgress.total;

  const handleDownload = async () => {
    setError(null);
    setDownloadProgress({ current: 0, total: ordered.length });
    try {
      for (let i = 0; i < ordered.length; i++) {
        setDownloadProgress({ current: i, total: ordered.length });
        const carousel = ordered[i];
        const isPost = carousel.kind === "post" || carousel.slides.length === 1;
        const res = await fetch(`/api/carousels/${carousel.id}/export`, { method: "POST" });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error ?? `Error exportando "${carousel.name}"`);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = isPost
          ? `${carousel.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`
          : `${carousel.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.zip`;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        // Wait for browser to register the download before starting the next export
        await new Promise((r) => setTimeout(r, 800));
      }
      setDownloadProgress({ current: ordered.length, total: ordered.length });
      setTimeout(() => setDownloadProgress({ current: 0, total: 0 }), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al descargar");
      setDownloadProgress({ current: 0, total: 0 });
    }
  };

  const handleShare = async () => {
    setSharing(true);
    setError(null);
    try {
      const allFiles: File[] = [];
      for (const carousel of ordered) {
        const res = await fetch(`/api/carousels/${carousel.id}/export?format=json`, { method: "POST" });
        if (!res.ok) throw new Error(`Export fallido: "${carousel.name}"`);
        const { files: fileData } = await res.json() as { files: { name: string; data: string }[] };
        for (const { name, data } of fileData) {
          const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
          allFiles.push(new File([bytes], name, { type: "image/png" }));
        }
      }
      if (navigator.canShare({ files: allFiles })) {
        await navigator.share({ files: allFiles, title: gridName });
        setShared(true);
        setTimeout(() => { setShared(false); setOpen(false); }, 1500);
      } else {
        await handleDownload();
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Error al compartir");
    } finally {
      setSharing(false);
    }
  };

  const handleTelegram = async () => {
    setTelegramState("publishing");
    setError(null);
    setTelegramProgress({ current: 0, total: ordered.length });

    const summaryRes = await fetch("/api/telegram?action=message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: buildSummary(), accountId }),
    });
    if (!summaryRes.ok) {
      const d = await summaryRes.json().catch(() => ({}));
      setError(d.error ?? "Error al enviar el resumen");
      setTelegramState("error");
      return;
    }

    for (let i = 0; i < ordered.length; i++) {
      setTelegramProgress({ current: i + 1, total: ordered.length });
      const res = await fetch(`/api/carousels/${ordered[i].id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: "telegram", accountId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(`Error en "${ordered[i].name}": ${d.error ?? "Error desconocido"}`);
        setTelegramState("error");
        return;
      }
    }

    setTelegramState("done");
    setTimeout(() => { setTelegramState("idle"); setOpen(false); }, 2500);
  };

  const busy = downloading || sharing || telegramState === "publishing";

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={carousels.length === 0}
        className={`gap-1.5 ${className ?? ""}`}
        onClick={() => setOpen(true)}
      >
        <Send className="h-3.5 w-3.5" />
        {t("publish")}
        <ChevronDown className="h-3 w-3 opacity-50" />
      </Button>

      <Dialog.Root open={open} onOpenChange={(o) => { if (!busy) setOpen(o); }}>
        <Dialog.Portal>
          <Dialog.Overlay data-oc-overlay className="fixed inset-0 z-60 bg-black/50 backdrop-blur-sm" />
          <Dialog.Content
            data-oc-dialog
            className="fixed z-60 w-full max-w-sm rounded-xl bg-surface border border-border p-5 shadow-2xl max-h-[min(640px,85vh)] overflow-y-auto"
            style={{ left: "50%", top: "50%" }}
          >
            <div className="flex items-center justify-between mb-1">
              <Dialog.Title className="text-sm font-semibold">{t("publish")}</Dialog.Title>
              <Dialog.Close asChild>
                <button
                  disabled={busy}
                  className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40"
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            <p className="text-xs text-muted-foreground mb-3">
              {gridName && <span className="font-medium text-foreground">{gridName} · </span>}
              {ordered.length} {t(ordered.length === 1 ? "post" : "posts")}
            </p>

            {/* Order preview */}
            <div className="mb-4 rounded-lg bg-muted p-2.5 space-y-1 max-h-36 overflow-y-auto">
              {ordered.map((c, i) => {
                const isPost = c.kind === "post" || c.slides.length === 1;
                const done = telegramState === "done" || (telegramState === "publishing" && i < telegramProgress.current);
                return (
                  <div key={c.id} className="flex items-center gap-2 text-xs">
                    <span className="text-[10px] text-muted-foreground/50 w-4 text-right shrink-0">{i + 1}</span>
                    {done
                      ? <Check className="h-3 w-3 text-green-500 shrink-0" />
                      : isPost
                      ? <Image className="h-3 w-3 text-blue-500 shrink-0" />
                      : <SlidersHorizontal className="h-3 w-3 text-accent shrink-0" />}
                    <span className={`truncate ${done ? "text-muted-foreground" : ""}`}>{c.name}</span>
                    {!isPost && (
                      <span className="text-[10px] text-muted-foreground/60 shrink-0">
                        {c.slides.length} slides
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="space-y-2">
              {/* Download */}
              <button
                onClick={handleDownload}
                disabled={busy}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-foreground/30 hover:bg-muted text-left transition-colors disabled:opacity-60 cursor-pointer"
              >
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  {downloading
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : downloadProgress.current === downloadProgress.total && downloadProgress.total > 0
                    ? <Check className="h-4 w-4 text-green-500" />
                    : <Download className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {downloading
                      ? `Exportando ${downloadProgress.current + 1}/${downloadProgress.total}...`
                      : downloadProgress.current === downloadProgress.total && downloadProgress.total > 0
                      ? `✓ ${downloadProgress.total} descargados`
                      : t("downloadZIP")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {downloading
                      ? ordered[downloadProgress.current]?.name ?? ""
                      : t("allSlidesZIP")}
                  </div>
                </div>
              </button>

              {/* Web Share */}
              {webShareSupported && (
                <button
                  onClick={handleShare}
                  disabled={busy}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-foreground/30 hover:bg-muted text-left transition-colors disabled:opacity-60 cursor-pointer"
                >
                  <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                    {sharing
                      ? <Loader2 className="h-4 w-4 text-accent animate-spin" />
                      : shared
                      ? <Check className="h-4 w-4 text-green-500" />
                      : <Share2 className="h-4 w-4 text-accent" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {shared ? t("shared") : sharing ? t("sharing") : t("shareFiles")}
                    </div>
                    <div className="text-xs text-muted-foreground">{t("shareFilesDesc")}</div>
                  </div>
                </button>
              )}

              {/* Telegram */}
              {telegramConfigured ? (
                <button
                  onClick={handleTelegram}
                  disabled={busy || telegramState === "done"}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-foreground/30 hover:bg-muted text-left transition-colors disabled:opacity-70 cursor-pointer"
                >
                  <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                    {telegramState === "publishing"
                      ? <Loader2 className="h-4 w-4 text-accent animate-spin" />
                      : telegramState === "done"
                      ? <Check className="h-4 w-4 text-green-500" />
                      : <Send className="h-4 w-4 text-accent" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {telegramState === "done"
                        ? `✓ ${ordered.length} enviados`
                        : telegramState === "publishing"
                        ? `Enviando ${telegramProgress.current}/${telegramProgress.total}...`
                        : t("sendToTelegram")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {telegramState === "done"
                        ? "Resumen + posts enviados en orden"
                        : "Resumen de fecha + cada post en orden"}
                    </div>
                  </div>
                </button>
              ) : (
                <div className="p-3 rounded-lg border border-dashed border-border text-center">
                  <p className="text-xs text-muted-foreground">
                    {t("telegramNotConfigured")}{" "}
                    <a href="/settings/telegram" className="text-accent underline">{t("telegramSetUpNow")}</a>
                  </p>
                </div>
              )}
            </div>

            {error && (
              <p className="mt-3 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
