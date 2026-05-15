"use client";

import { useEffect, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlideRenderer } from "./SlideRenderer";
import { useI18n } from "@/lib/i18n/context";
import type { Slide, AspectRatio } from "@/types/carousel";
import type { LogoConfig, ColorSubstitution, FontSubstitution } from "@/lib/slide-html";
import type { SlideRendererProps } from "@/lib/slide-renderer-props";

interface FullscreenPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slides: Slide[];
  aspectRatio: AspectRatio;
  activeIndex: number;
  onActiveChange: (index: number) => void;
  /** Per-slide branding props — when provided, overrides the static logoConfig/colorSubstitution etc. */
  perSlideProps?: SlideRendererProps[];
  logoConfig?: LogoConfig;
  colorSubstitution?: ColorSubstitution;
  fontSubstitution?: FontSubstitution;
  accentOverride?: string;
}

export function FullscreenPreview({
  open,
  onOpenChange,
  slides,
  aspectRatio,
  activeIndex,
  onActiveChange,
  perSlideProps,
  logoConfig,
  colorSubstitution,
  fontSubstitution,
  accentOverride,
}: FullscreenPreviewProps) {
  const { t } = useI18n();
  const slide = slides[activeIndex];
  const activeSlideProps = perSlideProps?.[activeIndex];
  const resolvedLogoConfig      = activeSlideProps?.logoConfig      ?? logoConfig;
  const resolvedColorSub        = activeSlideProps?.colorSubstitution ?? colorSubstitution;
  const resolvedFontSub         = activeSlideProps?.fontSubstitution  ?? fontSubstitution;
  const resolvedAccentOverride  = activeSlideProps?.accentOverride    ?? accentOverride;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && activeIndex > 0) {
        onActiveChange(activeIndex - 1);
      } else if (e.key === "ArrowRight" && activeIndex < slides.length - 1) {
        onActiveChange(activeIndex + 1);
      }
    },
    [activeIndex, slides.length, onActiveChange]
  );

  useEffect(() => {
    if (!open) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay data-oc-overlay className="fixed inset-0 z-80 bg-black/90" />
        <Dialog.Content data-oc-fade-scale className="fixed inset-0 z-80 flex items-center justify-center p-8">
          <Dialog.Close asChild>
            <button
              className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10"
              aria-label="Close fullscreen"
            >
              <X className="h-5 w-5" />
            </button>
          </Dialog.Close>

          {/* Prev */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onActiveChange(activeIndex - 1)}
            disabled={activeIndex <= 0}
            className="absolute left-4 z-10 text-white bg-white/10 hover:bg-white/20 disabled:opacity-30 h-12 w-12"
            aria-label={t("previousSlide")}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>

          {/* Slide */}
          {slide && (
            <SlideRenderer
              html={slide.html}
              aspectRatio={aspectRatio}
              style={{ width: "100%", height: "100%", maxWidth: 800 }}
              logoConfig={resolvedLogoConfig}
              colorSubstitution={resolvedColorSub}
              fontSubstitution={resolvedFontSub}
              accentOverride={resolvedAccentOverride}
            />
          )}

          {/* Next */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onActiveChange(activeIndex + 1)}
            disabled={activeIndex >= slides.length - 1}
            className="absolute right-4 z-10 text-white bg-white/10 hover:bg-white/20 disabled:opacity-30 h-12 w-12"
            aria-label={t("nextSlide")}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>

          {/* Counter */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => onActiveChange(i)}
                className={`h-2 rounded-full transition-all ${
                  i === activeIndex
                    ? "w-8 bg-white"
                    : "w-2 bg-white/30 hover:bg-white/50"
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
            <span className="text-white/60 text-xs ml-2">
              {activeIndex + 1}/{slides.length}
            </span>
          </div>

          <Dialog.Title className="sr-only">Fullscreen Preview</Dialog.Title>
          <Dialog.Description className="sr-only">
            Viewing slide {activeIndex + 1} of {slides.length}
          </Dialog.Description>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
