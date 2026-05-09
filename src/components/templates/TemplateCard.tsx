"use client";

import { useState } from "react";
import { Trash2, ArrowRight, ChevronLeft, ChevronRight, Expand, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlideRenderer } from "@/components/editor/SlideRenderer";
import { FullscreenPreview } from "@/components/editor/FullscreenPreview";
import { useI18n } from "@/lib/i18n/context";
import type { Template } from "@/types/template";

interface TemplateCardProps {
  template: Template;
  onUse: (id: string) => void;
  onDelete: (id: string) => void;
}

export function TemplateCard({ template, onUse, onDelete }: TemplateCardProps) {
  const { t } = useI18n();
  const [activeSlide, setActiveSlide] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const total = template.slides.length;

  // FullscreenPreview expects Slide[] which includes previousVersions
  const fullscreenSlides = template.slides.map((s) => ({ ...s, previousVersions: [] }));

  return (
    <>
      <FullscreenPreview
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        slides={fullscreenSlides}
        aspectRatio={template.aspectRatio}
        activeIndex={activeSlide}
        onActiveChange={setActiveSlide}
      />

      <div className="rounded-xl border border-border bg-surface p-4 group hover:border-accent/50 hover:shadow-md hover:-translate-y-0.5 transition-[translate,border-color,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]">
        {/* Slide preview */}
        <div
          className="relative h-36 rounded-lg bg-muted mb-3 overflow-hidden cursor-zoom-in"
          onClick={() => setPreviewOpen(true)}
        >
          {total > 0 ? (
            <SlideRenderer
              html={template.slides[activeSlide].html}
              aspectRatio={template.aspectRatio}
              className="w-full h-full"
            />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground/30 text-xs">
              {t("empty")}
            </div>
          )}

          {/* Expand hint on hover */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div className="h-8 w-8 rounded-full bg-black/50 flex items-center justify-center">
              <Expand className="h-4 w-4 text-white" />
            </div>
          </div>

          {/* Slide nav arrows */}
          {total > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveSlide((i) => Math.max(0, i - 1)); }}
                disabled={activeSlide === 0}
                className="absolute left-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors disabled:opacity-0 cursor-pointer z-10"
                aria-label={t("previousSlide")}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveSlide((i) => Math.min(total - 1, i + 1)); }}
                disabled={activeSlide === total - 1}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors disabled:opacity-0 cursor-pointer z-10"
                aria-label={t("nextSlide")}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>

              {/* Dot indicators */}
              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1 z-10">
                {template.slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); setActiveSlide(i); }}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${i === activeSlide ? "w-3 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"}`}
                    aria-label={t("goToSlide", { n: String(i + 1) })}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <h3 className="font-semibold text-sm truncate">{template.name}</h3>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {total} {total !== 1 ? t("slides") : t("slide")} &middot; {template.aspectRatio}
          {total > 1 && <span className="ml-1 text-[10px]">({activeSlide + 1}/{total})</span>}
        </p>
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
          <Calendar className="h-3 w-3" />
          {new Date(template.createdAt).toLocaleDateString()}
        </p>

        <div className="flex items-center gap-2 mt-3">
          <Button
            variant="accent"
            size="sm"
            className="flex-1 text-xs"
            onClick={() => onUse(template.id)}
          >
            {t("useTemplate")}
            <ArrowRight className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(template.id)}
            aria-label={t("deleteTemplate")}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </>
  );
}
