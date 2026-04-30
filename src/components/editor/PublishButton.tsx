"use client";

import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Send, Download, Loader2, Check, X, ChevronDown, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";

interface PublishButtonProps {
  carouselId: string;
  carouselName?: string;
  caption?: string;
  hashtags?: string[];
  slideCount: number;
  isPost?: boolean;
}

type CopyTarget = "facebook" | "instagram";

const TARGETS: { id: CopyTarget; label: string; descKey: string; url: string; icon: string }[] = [
  {
    id: "facebook",
    label: "Facebook",
    descKey: "shareToFacebookDesc",
    url: "https://www.facebook.com/",
    icon: "f",
  },
  {
    id: "instagram",
    label: "Instagram",
    descKey: "shareToInstagramDesc",
    url: "https://www.instagram.com/",
    icon: "ig",
  },
];

export function PublishButton({ carouselId, carouselName, caption, hashtags, slideCount, isPost = false }: PublishButtonProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [telegramConfigured, setTelegramConfigured] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [done, setDone] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);
  const [copyingFor, setCopyingFor] = useState<CopyTarget | null>(null);
  const [copiedFor, setCopiedFor] = useState<CopyTarget | null>(null);
  const [error, setError] = useState<string | null>(null);

  const webShareSupported = typeof navigator !== "undefined" && "share" in navigator && "canShare" in navigator;
  const clipboardSupported = typeof navigator !== "undefined" && "clipboard" in navigator && "ClipboardItem" in window;

  useEffect(() => {
    if (!open) return;
    fetch("/api/telegram")
      .then((r) => r.json())
      .then((d) => setTelegramConfigured(d.configured || false))
      .catch(() => {});
  }, [open]);

  const handleDownload = async () => {
    setOpen(false);
    const response = await fetch(`/api/carousels/${carouselId}/export`, { method: "POST" });
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = isPost ? `post-${carouselId}.png` : `carousel-${carouselId}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    setSharing(true);
    setError(null);
    try {
      const res = await fetch(`/api/carousels/${carouselId}/export?format=json`, { method: "POST" });
      if (!res.ok) throw new Error("Export failed");
      const { files: fileData } = await res.json() as { files: { name: string; data: string }[] };
      const files = fileData.map(({ name, data }) => {
        const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
        return new File([bytes], name, { type: "image/png" });
      });
      if (navigator.canShare({ files })) {
        const parts = [caption, hashtags?.join(" ")].filter(Boolean);
        const text = parts.length > 0 ? parts.join("\n\n") : undefined;
        await navigator.share({ files, title: carouselName, text });
        setShared(true);
        setTimeout(() => { setShared(false); setOpen(false); }, 1500);
      } else {
        handleDownload();
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Share failed");
    } finally {
      setSharing(false);
    }
  };

  const handleCopyAndOpen = async (target: CopyTarget) => {
    setCopyingFor(target);
    setError(null);
    try {
      const res = await fetch(`/api/carousels/${carouselId}/export?format=json`, { method: "POST" });
      if (!res.ok) throw new Error("Export failed");
      const { files: fileData } = await res.json() as { files: { name: string; data: string }[] };
      const first = fileData[0];
      const bytes = Uint8Array.from(atob(first.data), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "image/png" });
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      const url = TARGETS.find((t) => t.id === target)!.url;
      window.open(url, "_blank", "noopener");
      setCopiedFor(target);
      setTimeout(() => setCopiedFor(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Copy failed");
    } finally {
      setCopyingFor(null);
    }
  };

  const handleTelegram = async () => {
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch(`/api/carousels/${carouselId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: "telegram" }),
      });
      const data = await res.json();
      if (res.ok) {
        setDone(true);
        setTimeout(() => { setDone(false); setOpen(false); }, 2000);
      } else {
        setError(data.error || "Publish failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="outline" size="sm" disabled={slideCount === 0} className="gap-1.5">
          <Send className="h-3.5 w-3.5" />
          {t("publish")}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay data-oc-overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content data-oc-dialog className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm rounded-xl bg-surface border border-border p-5 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-sm font-semibold">{t("publish")}</Dialog.Title>
            <Dialog.Close asChild>
              <button className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-2">
            {/* Download */}
            <button
              onClick={handleDownload}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-foreground/30 hover:bg-muted text-left transition-colors cursor-pointer"
            >
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                <Download className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-medium">
                  {isPost ? t("downloadPNG") : t("downloadZIP")}
                </div>
                <div className="text-xs text-muted-foreground">
                  {isPost ? t("singleImageFile") : t("allSlidesZIP")}
                </div>
              </div>
            </button>

            {/* Web Share API (mobile / macOS Safari) */}
            {webShareSupported && (
              <button
                onClick={handleShare}
                disabled={sharing || shared}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-foreground/30 hover:bg-muted text-left transition-colors disabled:opacity-60 cursor-pointer"
              >
                <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  {sharing ? (
                    <Loader2 className="h-4 w-4 text-accent animate-spin" />
                  ) : shared ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Share2 className="h-4 w-4 text-accent" />
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium">
                    {shared ? t("shared") : sharing ? t("sharing") : t("shareFiles")}
                  </div>
                  <div className="text-xs text-muted-foreground">{t("shareFilesDesc")}</div>
                </div>
              </button>
            )}

            {/* Clipboard + open (Chrome desktop) */}
            {clipboardSupported && TARGETS.map((target) => {
              const isCopying = copyingFor === target.id;
              const isCopied = copiedFor === target.id;
              return (
                <button
                  key={target.id}
                  onClick={() => handleCopyAndOpen(target.id)}
                  disabled={!!copyingFor || !!copiedFor}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-foreground/30 hover:bg-muted text-left transition-colors disabled:opacity-60 cursor-pointer"
                >
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground select-none">
                    {isCopying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isCopied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      target.icon.toUpperCase()
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium">
                      {isCopied
                        ? `${t("copyAndOpen")} ${target.label}`
                        : isCopying
                        ? t("sharing")
                        : target.label}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {isCopied ? "Cmd+V / Ctrl+V para pegar" : t(target.descKey as Parameters<typeof t>[0])}
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Telegram */}
            {telegramConfigured ? (
              <button
                onClick={handleTelegram}
                disabled={publishing || done}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-foreground/30 hover:bg-muted text-left transition-colors disabled:opacity-60"
              >
                <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  {publishing ? (
                    <Loader2 className="h-4 w-4 text-accent animate-spin" />
                  ) : done ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Send className="h-4 w-4 text-accent" />
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium">
                    {done ? t("sent") : publishing ? t("sending") : t("sendToTelegram")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {isPost ? t("sendImageToChannel") : t("sendSlidesMediaGroup")}
                  </div>
                </div>
              </button>
            ) : (
              <div className="p-3 rounded-lg border border-dashed border-border text-center">
                <p className="text-xs text-muted-foreground">
                  {t("telegramNotConfigured")}{" "}
                  <a href="/settings/telegram" className="text-accent underline">
                    {t("telegramSetUpNow")}
                  </a>
                </p>
              </div>
            )}
          </div>

          {error && (
            <p className="mt-3 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
