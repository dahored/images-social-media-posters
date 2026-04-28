"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Hash, Sparkles, Copy, Check, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";

const NETWORK_LIMITS: Record<string, { chars: number; hashtags: number }> = {
  instagram: { chars: 2200, hashtags: 5 },
  facebook: { chars: 63206, hashtags: 30 },
  linkedin: { chars: 3000, hashtags: 30 },
  tiktok: { chars: 2200, hashtags: 30 },
  twitter: { chars: 280, hashtags: 10 },
  x: { chars: 280, hashtags: 10 },
  pinterest: { chars: 500, hashtags: 20 },
};

function getLimits(networkId?: string) {
  if (!networkId) return NETWORK_LIMITS.instagram;
  const key = networkId.toLowerCase();
  return NETWORK_LIMITS[key] ?? NETWORK_LIMITS.instagram;
}

interface ContentSidebarProps {
  carouselId: string;
  caption?: string;
  hashtags?: string[];
  networkId?: string;
  isPost?: boolean;
  onRefresh?: () => void;
}

export function ContentSidebar({
  carouselId,
  caption: initialCaption = "",
  hashtags: initialHashtags = [],
  networkId,
  isPost = false,
  onRefresh,
}: ContentSidebarProps) {
  const { t } = useI18n();
  const [caption, setCaption] = useState(initialCaption);
  const [hashtags, setHashtags] = useState<string[]>(initialHashtags);
  const [hashtagInput, setHashtagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<"caption" | "hashtags" | null>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const limits = getLimits(networkId);

  // Sync when parent refreshes (e.g. after AI generates caption)
  useEffect(() => { setCaption(initialCaption); }, [initialCaption]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setHashtags(initialHashtags); }, [initialHashtags.join(",")]);

  const hashtagsText = hashtags.map((h) => `#${h}`).join(" ");
  const totalChars = caption.length + (hashtagsText ? hashtagsText.length + 1 : 0);
  const charsLeft = limits.chars - totalChars;
  const hashtagsLeft = limits.hashtags - hashtags.length;
  const isOverChar = charsLeft < 0;
  const isOverHashtag = hashtagsLeft < 0;

  const save = useCallback(
    async (newCaption: string, newHashtags: string[]) => {
      setSaving(true);
      await fetch(`/api/carousels/${carouselId}/caption`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption: newCaption, hashtags: newHashtags }),
      });
      setSaving(false);
      onRefresh?.();
    },
    [carouselId, onRefresh]
  );

  const debouncedSave = useCallback(
    (newCaption: string, newHashtags: string[]) => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => save(newCaption, newHashtags), 800);
    },
    [save]
  );

  const handleCaptionChange = (v: string) => {
    setCaption(v);
    debouncedSave(v, hashtags);
  };

  const addHashtag = (raw: string) => {
    const tag = raw.replace(/^#+/, "").replace(/\s+/g, "").toLowerCase().trim();
    if (!tag || hashtags.includes(tag) || hashtags.length >= limits.hashtags) return;
    const next = [...hashtags, tag];
    setHashtags(next);
    setHashtagInput("");
    debouncedSave(caption, next);
  };

  const removeHashtag = (tag: string) => {
    const next = hashtags.filter((h) => h !== tag);
    setHashtags(next);
    debouncedSave(caption, next);
  };

  const handleHashtagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === " " || e.key === ",") {
      e.preventDefault();
      addHashtag(hashtagInput);
    }
    if (e.key === "Backspace" && !hashtagInput && hashtags.length > 0) {
      removeHashtag(hashtags[hashtags.length - 1]);
    }
  };

  const handleCopy = async (type: "caption" | "hashtags") => {
    const text = type === "caption" ? caption : hashtags.map((h) => `#${h}`).join(" ");
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Generate a compelling caption (max ${limits.chars} characters total including hashtags) and exactly ${Math.min(limits.hashtags, 5)} relevant hashtags for this ${isPost ? "post" : "carousel"}. Save them using: PUT http://localhost:3000/api/carousels/${carouselId}/caption with body {"caption":"...","hashtags":["tag1","tag2",...]}. Do it now without asking questions.`,
          carouselId,
          accountId: typeof window !== "undefined"
            ? localStorage.getItem("activeAccountId") ?? undefined
            : undefined,
        }),
      });
      if (res.body) {
        const reader = res.body.getReader();
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      }
    } catch {
      // ignore
    }
    setGenerating(false);
    onRefresh?.();
  };

  const networkLabel = networkId
    ? networkId.charAt(0).toUpperCase() + networkId.slice(1)
    : "Instagram";

  return (
    <div className="w-72 border-l border-border bg-surface shrink-0 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">{t("captionAndHashtags")}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t("networkLimits", { network: networkLabel })}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Caption */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t("captionLabel")}</label>
            <button
              onClick={() => handleCopy("caption")}
              className="h-5 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {copied === "caption" ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
              {copied === "caption" ? t("copied") : t("copy")}
            </button>
          </div>
          <textarea
            value={caption}
            onChange={(e) => handleCaptionChange(e.target.value)}
            placeholder={t("writeCaptionHere")}
            rows={6}
            className="w-full resize-none rounded-lg border border-border bg-muted px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className={`flex justify-end mt-1 text-[10px] ${isOverChar ? "text-destructive font-medium" : "text-muted-foreground"}`}>
            {totalChars.toLocaleString()} / {limits.chars.toLocaleString()} chars
            {isOverChar && t("overLimit")}
          </div>
        </div>

        {/* Hashtags */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Hash className="h-3 w-3" />
              {t("hashtagsLabel")}
              <span className={`ml-1 ${isOverHashtag ? "text-destructive" : ""}`}>
                ({hashtags.length}/{limits.hashtags})
              </span>
            </label>
            {hashtags.length > 0 && (
              <button
                onClick={() => handleCopy("hashtags")}
                className="h-5 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                {copied === "hashtags" ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                {copied === "hashtags" ? t("copied") : t("copyAll")}
              </button>
            )}
          </div>

          {hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {hashtags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-0.5 text-[10px] bg-accent/10 text-accent rounded-full px-2 py-0.5"
                >
                  #{tag}
                  <button
                    onClick={() => removeHashtag(tag)}
                    className="ml-0.5 hover:text-destructive transition-colors cursor-pointer"
                    aria-label={`Remove #${tag}`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-1.5">
            <input
              value={hashtagInput}
              onChange={(e) => setHashtagInput(e.target.value)}
              onKeyDown={handleHashtagKeyDown}
              placeholder={t("hashtagPlaceholder")}
              disabled={hashtags.length >= limits.hashtags}
              className="flex-1 h-8 rounded-lg border border-border bg-muted px-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <button
              onClick={() => addHashtag(hashtagInput)}
              disabled={!hashtagInput.trim() || hashtags.length >= limits.hashtags}
              className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-40 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">{t("hashtagHelp")}</p>
        </div>

        {/* Total summary */}
        {(caption || hashtags.length > 0) && (
          <div className={`text-[10px] rounded-lg px-3 py-2 ${isOverChar || isOverHashtag ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
            Total: {totalChars.toLocaleString()} / {limits.chars.toLocaleString()} chars · {hashtags.length}/{limits.hashtags} hashtags
            {saving && <span className="ml-2 opacity-60">{t("saving")}</span>}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border">
        <Button variant="outline" size="sm" className="w-full gap-2" onClick={handleGenerate} disabled={generating}>
          <Sparkles className="h-3.5 w-3.5" />
          {generating ? t("generating") : t("generateWithAI")}
        </Button>
      </div>
    </div>
  );
}
