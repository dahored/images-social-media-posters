"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Layers, Image, X, ArrowLeft, Plus, Bookmark, Moon, Sun } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
import { AspectRatioSelector } from "@/components/editor/AspectRatioSelector";
import { SlideRenderer } from "@/components/editor/SlideRenderer";
import { useI18n } from "@/lib/i18n/context";
import type { AspectRatio, ContentKind } from "@/types/carousel";
import type { Template } from "@/types/template";

interface CreateContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string, aspectRatio: AspectRatio, kind: ContentKind, networkId?: string, theme?: "dark" | "light") => void;
}

type Step = "kind" | "source" | "blank" | "template";

export function CreateContentDialog({ open, onOpenChange, onCreate }: CreateContentDialogProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState<Step>("kind");
  const [kind, setKind] = useState<ContentKind>("carousel");
  const [name, setName] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("4:5");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  useEffect(() => {
    if (!open) { setStep("kind"); setName(""); }
  }, [open]);

  const loadTemplates = useCallback(async (k: ContentKind) => {
    setLoadingTemplates(true);
    const accountId = localStorage.getItem("activeAccountId");
    const url = accountId ? `/api/templates?accountId=${accountId}` : "/api/templates";
    const d = await fetch(url).then((r) => r.json()).catch(() => ({ templates: [] }));
    const all: Template[] = d.templates || [];
    setTemplates(all.filter((tmpl) => !tmpl.kind || tmpl.kind === k));
    setLoadingTemplates(false);
  }, []);

  const chooseKind = (k: ContentKind) => { setKind(k); setStep("source"); };

  const chooseSource = (source: "blank" | "template") => {
    if (source === "template") { loadTemplates(kind); setStep("template"); }
    else setStep("blank");
  };

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed, aspectRatio, kind, undefined, theme);
    onOpenChange(false);
  };

  const useTemplate = async (templateId: string) => {
    const accountId = localStorage.getItem("activeAccountId") ?? undefined;
    const res = await fetch(`/api/templates/${templateId}/use`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId }),
    });
    if (res.ok) {
      const carousel = await res.json();
      onOpenChange(false);
      router.push(`/carousel/${carousel.id}`);
    }
  };

  const title = step === "kind" ? t("newContentTitle")
    : step === "source" ? (kind === "post" ? t("newPostTitle") : t("newCarouselTitle"))
    : step === "blank" ? (kind === "post" ? t("newPostTitle") : t("newCarouselTitle"))
    : t("chooseTemplate");

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay data-oc-overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content data-oc-dialog className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg rounded-xl bg-surface border border-border shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
            {step !== "kind" && (
              <button
                onClick={() => setStep(step === "blank" || step === "template" ? "source" : "kind")}
                className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <Dialog.Title className="text-base font-semibold flex-1">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Step 1: kind */}
          {step === "kind" && (
            <div className="p-6 grid grid-cols-2 gap-3">
              <button
                onClick={() => chooseKind("post")}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border hover:border-accent hover:bg-accent/5 transition-colors cursor-pointer group"
              >
                <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                  <Image className="h-6 w-6 text-accent" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm">{t("post")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("singleImage")}</p>
                </div>
              </button>
               <button
                onClick={() => chooseKind("carousel")}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border hover:border-accent hover:bg-accent/5 transition-colors cursor-pointer group"
              >
                <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                  <Layers className="h-6 w-6 text-accent" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm">{t("carousel")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("multipleSlides")}</p>
                </div>
              </button>
            </div>
          )}

          {/* Step 2: source */}
          {step === "source" && (
            <div className="p-6 grid grid-cols-2 gap-3">
              <button
                onClick={() => chooseSource("blank")}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border hover:border-accent hover:bg-accent/5 transition-colors cursor-pointer group"
              >
                <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                  <Plus className="h-6 w-6 text-muted-foreground group-hover:text-accent transition-colors" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm">{t("blank")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("startFromScratch")}</p>
                </div>
              </button>
              <button
                onClick={() => chooseSource("template")}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border hover:border-accent hover:bg-accent/5 transition-colors cursor-pointer group"
              >
                <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                  <Bookmark className="h-6 w-6 text-muted-foreground group-hover:text-accent transition-colors" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm">{t("fromTemplate")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("startWithSaved")}</p>
                </div>
              </button>
            </div>
          )}

          {/* Step 3a: blank form */}
          {step === "blank" && (
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t("contentTitleLabel")}</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={kind === "post" ? t("postTitlePlaceholder") : t("carouselTitlePlaceholder")}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                />
              </div>
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t("aspectRatio")}</label>
                  <AspectRatioSelector value={aspectRatio} onChange={setAspectRatio} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t("theme")}</label>
                  <div className="flex items-center gap-0.5 p-0.5 bg-muted rounded-md h-9">
                    <button
                      onClick={() => setTheme("dark")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                        theme === "dark" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Moon className="h-3 w-3" />
                      {t("themeDark")}
                    </button>
                    <button
                      onClick={() => setTheme("light")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                        theme === "light" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Sun className="h-3 w-3" />
                      {t("themeLight")}
                    </button>
                  </div>
                </div>
              </div>
              <Button variant="accent" className="w-full mt-2" disabled={!name.trim()} onClick={handleCreate}>
                {kind === "post" ? t("createPost") : t("createCarousel")}
              </Button>
            </div>
          )}

          {/* Step 3b: template picker */}
          {step === "template" && (
            <div className="p-6">
              {loadingTemplates ? (
                <div className="grid grid-cols-2 gap-3">
                  {[1, 2, 3, 4].map((i) => <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />)}
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-12">
                  <Bookmark className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {kind === "post" ? t("noPostTemplates") : t("noCarouselTemplates")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {kind === "post" ? t("savePostTemplateHint") : t("saveCarouselTemplateHint")}
                  </p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => chooseSource("blank")}>
                    {t("startBlankInstead")}
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto">
                  {templates.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      onClick={() => useTemplate(tmpl.id)}
                      className="text-left rounded-xl border border-border hover:border-accent hover:shadow-md transition-[border-color,box-shadow] p-3 cursor-pointer"
                    >
                      <div className="h-24 rounded-lg bg-muted mb-2 overflow-hidden">
                        {tmpl.slides.length > 0 ? (
                          <SlideRenderer html={tmpl.slides[0].html} aspectRatio={tmpl.aspectRatio} className="w-full h-full" />
                        ) : (
                          <div className="h-full flex items-center justify-center text-muted-foreground/30 text-xs">{t("empty")}</div>
                        )}
                      </div>
                      <p className="font-semibold text-xs truncate">{tmpl.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {tmpl.slides.length} {tmpl.slides.length !== 1 ? t("slides") : t("slide")} · {tmpl.aspectRatio}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
