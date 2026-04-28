"use client";

import { Plus, Trash2, Undo2 } from "lucide-react";
import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { SlideRenderer } from "./SlideRenderer";
import { useI18n } from "@/lib/i18n/context";
import type { Slide, AspectRatio } from "@/types/carousel";
import type { LogoConfig, ColorSubstitution, FontSubstitution } from "@/lib/slide-html";
import { DIMENSIONS, MAX_SLIDES } from "@/types/carousel";
import { cn } from "@/lib/utils";

interface SlideSubstitution {
  colorSubstitution?: ColorSubstitution;
  fontSubstitution?: FontSubstitution;
}

interface SlideFilmstripProps {
  slides: Slide[];
  aspectRatio: AspectRatio;
  activeIndex: number;
  onActiveChange: (index: number) => void;
  onDeleteSlide?: (slideId: string) => void;
  onUndoSlide?: (slideId: string) => void;
  onAddSlideRequest?: () => void;
  onReorderSlides?: (slideIds: string[]) => void;
  isGenerating?: boolean;
  logoConfig?: LogoConfig;
  /** Per-slide color+font substitutions. If provided, replaces the old shared props. */
  slideSubstitutions?: Record<string, SlideSubstitution>;
  colorSubstitution?: ColorSubstitution;
  fontSubstitution?: FontSubstitution;
}

function SortableSlideThumb({
  slide,
  index,
  isActive,
  thumbWidth,
  thumbHeight,
  aspectRatio,
  onSelect,
  onDelete,
  onUndo,
  logoConfig,
  colorSubstitution,
  fontSubstitution,
}: {
  slide: Slide;
  index: number;
  isActive: boolean;
  thumbWidth: number;
  thumbHeight: number;
  aspectRatio: AspectRatio;
  onSelect: () => void;
  onDelete?: () => void;
  onUndo?: () => void;
  logoConfig?: LogoConfig;
  colorSubstitution?: ColorSubstitution;
  fontSubstitution?: FontSubstitution;
}) {
  const { t } = useI18n();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slide.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "oc-enter-pop relative group shrink-0 cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40!"
      )}
    >
      <button
        onClick={onSelect}
        className={cn(
          "block rounded-lg overflow-hidden transition-[border-color,box-shadow] duration-200 border-2 relative",
          isActive
            ? "border-accent shadow-md ring-2 ring-accent/20"
            : "border-border hover:border-muted-foreground/50"
        )}
        style={{ width: thumbWidth, height: thumbHeight }}
        aria-label={t("selectSlide", { index: index + 1 })}
      >
        <SlideRenderer
          html={slide.html}
          aspectRatio={aspectRatio}
          className="w-full h-full"
          logoConfig={logoConfig}
          colorSubstitution={colorSubstitution}
          fontSubstitution={fontSubstitution}
        />
        {/* Per-slide override indicator dot */}
        {slide.styleOverride && (
          Object.values(slide.styleOverride.colors ?? {}).some(Boolean) ||
          Object.values(slide.styleOverride.colorsLight ?? {}).some(Boolean)
        ) && (
          <div className="absolute top-1 left-1 h-1.5 w-1.5 rounded-full bg-accent pointer-events-none" />
        )}
      </button>

      {/* Hover actions */}
      <div className="absolute -top-1 -right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {onUndo && slide.previousVersions.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 bg-white shadow-sm border border-border rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              onUndo();
            }}
            aria-label={t("undoLastChange")}
          >
            <Undo2 className="h-2.5 w-2.5" />
          </Button>
        )}
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 bg-white shadow-sm border border-border rounded-full text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            aria-label={t("deleteSlide", { index: index + 1 })}
          >
            <Trash2 className="h-2.5 w-2.5" />
          </Button>
        )}
      </div>

      {/* Slide number */}
      <div className="absolute bottom-1 left-1 text-[9px] font-bold text-white bg-black/60 rounded px-1 py-0.5 leading-none">
        {index + 1}
      </div>
    </div>
  );
}

export function SlideFilmstrip({
  slides,
  aspectRatio,
  activeIndex,
  onActiveChange,
  onDeleteSlide,
  onUndoSlide,
  onAddSlideRequest,
  onReorderSlides,
  isGenerating,
  logoConfig,
  slideSubstitutions,
  colorSubstitution,
  fontSubstitution,
}: SlideFilmstripProps) {
  const { t } = useI18n();
  const { width: slideW, height: slideH } = DIMENSIONS[aspectRatio];
  const thumbHeight = 80;
  const thumbWidth = Math.round(thumbHeight * (slideW / slideH));

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = slides.findIndex((s) => s.id === active.id);
    const newIndex = slides.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newSlides = [...slides];
    const [moved] = newSlides.splice(oldIndex, 1);
    newSlides.splice(newIndex, 0, moved);

    onReorderSlides?.(newSlides.map((s) => s.id));

    if (activeIndex === oldIndex) {
      onActiveChange(newIndex);
    } else if (activeIndex > oldIndex && activeIndex <= newIndex) {
      onActiveChange(activeIndex - 1);
    } else if (activeIndex < oldIndex && activeIndex >= newIndex) {
      onActiveChange(activeIndex + 1);
    }
  };

  return (
    <div className="border-t border-border bg-surface shrink-0">
      <div className="h-28 flex items-center gap-3 px-4 overflow-x-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={slides.map((s) => s.id)}
            strategy={horizontalListSortingStrategy}
          >
            {slides.map((slide, index) => (
              <SortableSlideThumb
                key={slide.id}
                slide={slide}
                index={index}
                isActive={index === activeIndex}
                thumbWidth={thumbWidth}
                thumbHeight={thumbHeight}
                aspectRatio={aspectRatio}
                onSelect={() => onActiveChange(index)}
                onDelete={onDeleteSlide ? () => onDeleteSlide(slide.id) : undefined}
                onUndo={onUndoSlide ? () => onUndoSlide(slide.id) : undefined}
                logoConfig={logoConfig}
                colorSubstitution={slideSubstitutions?.[slide.id]?.colorSubstitution ?? colorSubstitution}
                fontSubstitution={slideSubstitutions?.[slide.id]?.fontSubstitution ?? fontSubstitution}
              />
            ))}
          </SortableContext>
        </DndContext>

        {isGenerating && (
          <div
            className="shrink-0 rounded-lg border-2 border-dashed border-accent/50 flex items-center justify-center bg-accent/5"
            style={{ width: thumbWidth, height: thumbHeight }}
          >
            <div className="flex flex-col items-center gap-1">
              <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-[8px] text-accent font-medium">{t("creating")}</span>
            </div>
          </div>
        )}

        {slides.length < MAX_SLIDES && !isGenerating && (
          <button
            onClick={onAddSlideRequest}
            className="shrink-0 rounded-lg border-2 border-dashed border-border flex items-center justify-center hover:border-muted-foreground/50 hover:bg-muted/50 transition-colors cursor-pointer"
            style={{ width: thumbWidth, height: thumbHeight }}
            aria-label={t("addSlideViaAI")}
          >
            <Plus className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}
