"use client";

import { useState } from "react";
import { Trash2, ArrowRight, ChevronLeft, ChevronRight, Expand, Calendar, Image, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlideRenderer } from "@/components/editor/SlideRenderer";
import { FullscreenPreview } from "@/components/editor/FullscreenPreview";
import { useI18n } from "@/lib/i18n/context";
import { computeSlideRendererProps } from "@/lib/slide-renderer-props";
import type { Template } from "@/types/template";
import type { EffectiveBranding } from "@/types/account";
import type { Carousel, Slide } from "@/types/carousel";
import type { SlideRendererProps } from "@/lib/slide-renderer-props";

interface TemplateCardProps {
  template: Template;
  branding?: EffectiveBranding | null;
  onUse: (id: string) => void;
  onDelete: (id: string) => void;
}

export function TemplateCard({ template, branding, onUse, onDelete }: TemplateCardProps) {
  const { t } = useI18n();
  const [activeSlide, setActiveSlide] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const total = template.slides.length;

  function getRendererProps(slideIdx: number): SlideRendererProps {
    const slide = template.slides[slideIdx];
    if (!branding || !slide) return {};
    // Cast to satisfy types — computeSlideRendererProps only reads brandingOverride from carousel
    // and styleOverride/html from slide, both of which templates have.
    return computeSlideRendererProps(
      branding,
      { brandingOverride: template.brandingOverride } as unknown as Carousel,
      slide as unknown as Slide,
    );
  }

  const allSlideProps: SlideRendererProps[] | undefined = branding
    ? template.slides.map((_, i) => getRendererProps(i))
    : undefined;

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
        perSlideProps={allSlideProps}
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
              {...getRendererProps(activeSlide)}
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

        <div className="flex items-center gap-1.5 mt-0.5 mb-1">
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${template.kind === "post" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : "bg-accent/10 text-accent"}`}>
            {template.kind === "post"
              ? <><Image className="h-2.5 w-2.5" />{t("post")}</>
              : <><SlidersHorizontal className="h-2.5 w-2.5" />{t("carousel")}</>}
          </span>
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
