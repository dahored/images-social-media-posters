"use client";

import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Send, Download, Loader2, Check, X, ChevronDown, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";
import { ShareReadyPanel } from "./ShareReadyPanel";

interface PublishButtonProps {
  carouselId: string;
  carouselName?: string;
  caption?: string;
  hashtags?: string[];
  slideCount: number;
  isPost?: boolean;
}

const SOCIAL_TARGETS = [
  { id: "facebook",  label: "Facebook",  url: "https://www.facebook.com/",  icon: "F" },
  { id: "instagram", label: "Instagram", url: "https://www.instagram.com/", icon: "IG" },
] as const;

type SocialTargetId = typeof SOCIAL_TARGETS[number]["id"];

interface PublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  carouselId: string;
  carouselName?: string;
  caption?: string;
  hashtags?: string[];
  isPost?: boolean;
}

/** Standalone publish dialog — can be opened from anywhere (editor, calendar, etc.) */
export function PublishDialog({ open, onOpenChange, carouselId, carouselName, caption, hashtags, isPost = false }: PublishDialogProps) {
  const { t } = useI18n();
  const [telegramConfigured, setTelegramConfigured] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [done, setDone] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState<SocialTargetId | null>(null);

  const webShareSupported = typeof navigator !== "undefined" && "share" in navigator && "canShare" in navigator;

  useEffect(() => {
    if (!open) return;
    fetch("/api/telegram")
      .then((r) => r.json())
      .then((d) => setTelegramConfigured(d.configured || false))
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) { setShareTarget(null); setError(null); setDone(false); setShared(false); setDownloaded(false); }
  }, [open]);

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      const response = await fetch(`/api/carousels/${carouselId}/export`, { method: "POST" });
      if (!response.ok) { setError("Export failed"); return; }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = isPost ? `post-${carouselId}.png` : `carousel-${carouselId}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setDownloaded(true);
      setTimeout(() => onOpenChange(false), 1500);
    } catch {
      setError("Download failed");
    } finally {
      setDownloading(false);
    }
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
        setTimeout(() => { setShared(false); onOpenChange(false); }, 1500);
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
        setTimeout(() => { setDone(false); onOpenChange(false); }, 2000);
      } else {
        setError(data.error || "Publish failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setPublishing(false);
    }
  };

  const activeTarget = SOCIAL_TARGETS.find((t) => t.id === shareTarget) ?? null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay data-oc-overlay className="fixed inset-0 z-60 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content data-oc-dialog className="fixed z-60 w-full max-w-sm rounded-xl bg-surface border border-border p-5 shadow-2xl max-h-[min(600px,85vh)] overflow-y-auto" style={{ left: "50%", top: "50%" }}>
          {activeTarget ? (
            <ShareReadyPanel
              carouselId={carouselId}
              carouselName={carouselName}
              caption={caption}
              hashtags={hashtags}
              target={activeTarget}
              onBack={() => setShareTarget(null)}
            />
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <Dialog.Title className="text-sm font-semibold">{t("publish")}</Dialog.Title>
                <Dialog.Close asChild>
                  <button className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted">
                    <X className="h-4 w-4" />
                  </button>
                </Dialog.Close>
              </div>

              <div className="space-y-2">
                <button onClick={handleDownload} disabled={downloading || downloaded} className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-foreground/30 hover:bg-muted text-left transition-colors disabled:opacity-60 cursor-pointer">
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                    {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : downloaded ? <Check className="h-4 w-4 text-green-500" /> : <Download className="h-4 w-4" />}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{downloaded ? t("downloaded") : downloading ? t("downloading") : isPost ? t("downloadPNG") : t("downloadZIP")}</div>
                    <div className="text-xs text-muted-foreground">{isPost ? t("singleImageFile") : t("allSlidesZIP")}</div>
                  </div>
                </button>

                {webShareSupported && (
                  <button onClick={handleShare} disabled={sharing || shared} className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-foreground/30 hover:bg-muted text-left transition-colors disabled:opacity-60 cursor-pointer">
                    <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                      {sharing ? <Loader2 className="h-4 w-4 text-accent animate-spin" /> : shared ? <Check className="h-4 w-4 text-green-500" /> : <Share2 className="h-4 w-4 text-accent" />}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{shared ? t("shared") : sharing ? t("sharing") : t("shareFiles")}</div>
                      <div className="text-xs text-muted-foreground">{t("shareFilesDesc")}</div>
                    </div>
                  </button>
                )}

                {SOCIAL_TARGETS.map((target) => (
                  <button key={target.id} onClick={() => setShareTarget(target.id)} className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-foreground/30 hover:bg-muted text-left transition-colors cursor-pointer">
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground select-none">{target.icon}</div>
                    <div>
                      <div className="text-sm font-medium">{target.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {target.id === "instagram"
                          ? isPost ? t("shareInstagramPostDesc") : t("shareInstagramCarouselDesc")
                          : isPost ? t("shareFacebookPostDesc") : t("shareFacebookCarouselDesc")}
                      </div>
                    </div>
                  </button>
                ))}

                {telegramConfigured ? (
                  <button onClick={handleTelegram} disabled={publishing || done} className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-foreground/30 hover:bg-muted text-left transition-colors disabled:opacity-60">
                    <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                      {publishing ? <Loader2 className="h-4 w-4 text-accent animate-spin" /> : done ? <Check className="h-4 w-4 text-green-500" /> : <Send className="h-4 w-4 text-accent" />}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{done ? t("sent") : publishing ? t("sending") : t("sendToTelegram")}</div>
                      <div className="text-xs text-muted-foreground">{isPost ? t("sendImageToChannel") : t("sendSlidesMediaGroup")}</div>
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

              {error && <p className="mt-3 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function PublishButton({ carouselId, carouselName, caption, hashtags, slideCount, isPost = false }: PublishButtonProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" disabled={slideCount === 0} className="gap-1.5" onClick={() => setOpen(true)}>
        <Send className="h-3.5 w-3.5" />
        {t("publish")}
        <ChevronDown className="h-3 w-3 opacity-50" />
      </Button>
      <PublishDialog
        open={open}
        onOpenChange={setOpen}
        carouselId={carouselId}
        carouselName={carouselName}
        caption={caption}
        hashtags={hashtags}
        isPost={isPost}
      />
    </>
  );
}
