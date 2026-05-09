"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Image as ImageIcon, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/context";
import type { Grid, GridItem, GridSize } from "@/types/grid";
import type { Template } from "@/types/template";
import { SlideRenderer } from "@/components/editor/SlideRenderer";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: Template[];
  editing: Grid | null;
  onSaved: () => void;
}

const SIZE_OPTIONS: GridSize[] = [3, 6, 9];

export function GridBuilderDialog({ open, onOpenChange, templates, editing, onSaved }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [size, setSize] = useState<GridSize>(6);
  const [items, setItems] = useState<GridItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [scheduledStartAt, setScheduledStartAt] = useState("");
  const [scheduledEndAt, setScheduledEndAt] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setSize(editing.size);
      setItems(editing.items);
      setScheduledStartAt(editing.scheduledStartAt?.slice(0, 10) ?? "");
      setScheduledEndAt(editing.scheduledEndAt?.slice(0, 10) ?? "");
    } else {
      setName("");
      setSize(6);
      setItems(Array.from({ length: 6 }, (_, i) => ({ position: i })));
      setScheduledStartAt("");
      setScheduledEndAt("");
    }
  }, [open, editing]);

  useEffect(() => {
    setItems((prev) => {
      if (prev.length === size) return prev;
      return Array.from({ length: size }, (_, i) => prev[i] ?? { position: i });
    });
  }, [size]);

  const setItemTemplate = (position: number, templateId: string | undefined) => {
    setItems((prev) => prev.map((it) => (it.position === position ? { ...it, templateId } : it)));
    setPickerOpen(null);
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const schedulePayload = {
        scheduledStartAt: scheduledStartAt || undefined,
        scheduledEndAt: scheduledEndAt || undefined,
      };
      if (editing) {
        await fetch(`/api/grids/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed, size, items, ...schedulePayload }),
        });
      } else {
        const accountId = localStorage.getItem("activeAccountId") ?? undefined;
        await fetch("/api/grids", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed, size, items, accountId, ...schedulePayload }),
        });
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const templatesById = new Map(templates.map((t) => [t.id, t]));
  const cols = size === 3 ? 3 : 3;

  return (
    <>
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay data-oc-overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content data-oc-dialog className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl rounded-xl bg-surface border border-border p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="text-base font-semibold">
              {editing ? t("editGrid") : t("newGrid")}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t("gridName")}</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("gridNamePlaceholder")} />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t("gridSize")}</label>
              <div className="flex gap-2">
                {SIZE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setSize(opt)}
                    className={`px-4 py-1.5 rounded-md text-sm border transition-colors ${size === opt ? "bg-foreground text-background border-foreground" : "border-border hover:border-foreground/30"}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t("gridLayout")}</label>
              <div
                className="grid gap-2 p-2 rounded-lg bg-muted/50"
                style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
              >
                {items.map((item) => {
                  const tpl = item.templateId ? templatesById.get(item.templateId) : null;
                  return (
                    <button
                      key={item.position}
                      onClick={() => setPickerOpen(item.position)}
                      className="aspect-square relative rounded-md border-2 border-dashed border-border hover:border-accent bg-background overflow-hidden group"
                    >
                      {tpl && tpl.slides[0] ? (
                        <>
                          <SlideRenderer html={tpl.slides[0].html} aspectRatio={tpl.aspectRatio} className="w-full h-full" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <span className="text-[10px] text-white font-medium px-2 py-1 rounded bg-black/60">{t("change")}</span>
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/60 gap-1">
                          <span className="text-2xl font-light">+</span>
                          <span className="text-[10px]">{t("addTemplate")}</span>
                        </div>
                      )}
                      <span className="absolute top-1 left-1 text-[10px] font-mono text-muted-foreground/60 bg-background/80 rounded px-1">
                        {item.position + 1}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t("distributionPreview")}</label>
              <p className="text-[11px] text-muted-foreground mb-2">{t("distributionPreviewHint")}</p>
              <div
                className="grid gap-1.5"
                style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
              >
                {items.map((item) => {
                  const tpl = item.templateId ? templatesById.get(item.templateId) : null;
                  const isPost = tpl?.kind === "post";
                  return (
                    <div
                      key={item.position}
                      className={`aspect-square rounded-md flex flex-col items-center justify-center gap-1 border text-[10px] font-medium ${
                        tpl
                          ? isPost
                            ? "bg-blue-50 border-blue-200 text-blue-700"
                            : "bg-violet-50 border-violet-200 text-violet-700"
                          : "bg-muted border-border text-muted-foreground/50"
                      }`}
                    >
                      {tpl ? (
                        isPost ? (
                          <>
                            <ImageIcon className="h-3.5 w-3.5" />
                            Post
                          </>
                        ) : (
                          <>
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                            Carousel
                          </>
                        )
                      ) : (
                        <span className="text-[9px]">{item.position + 1}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Schedule date range */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t("scheduleRange")}</label>
              <p className="text-[11px] text-muted-foreground mb-2">{t("scheduleRangeHint")}</p>
              <div className="flex gap-2 flex-wrap">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-muted-foreground">{t("scheduleRangeStart")}</span>
                  <input
                    type="date"
                    value={scheduledStartAt}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setScheduledStartAt(e.target.value)}
                    className="h-8 px-2.5 rounded-md border border-border bg-background text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-muted-foreground">{t("scheduleRangeEnd")}</span>
                  <input
                    type="date"
                    value={scheduledEndAt}
                    min={scheduledStartAt}
                    onChange={(e) => setScheduledEndAt(e.target.value)}
                    className="h-8 px-2.5 rounded-md border border-border bg-background text-xs"
                    disabled={!scheduledStartAt}
                  />
                </div>
                {scheduledStartAt && (
                  <div className="flex flex-col gap-1 justify-end">
                    <button
                      onClick={() => { setScheduledStartAt(""); setScheduledEndAt(""); }}
                      className="h-8 px-2.5 rounded-md text-xs text-muted-foreground hover:text-destructive border border-border"
                    >
                      {t("clearDate")}
                    </button>
                  </div>
                )}
              </div>
            </div>

          <div className="flex justify-end gap-2 mt-6">
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm">{t("cancel")}</Button>
            </Dialog.Close>
            <Button variant="accent" size="sm" disabled={!name.trim() || saving} onClick={handleSave}>
              {saving ? t("saving") : t("save")}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>

    {/* Template picker — nested modal on top of the builder dialog */}
    <Dialog.Root open={pickerOpen !== null} onOpenChange={(o) => { if (!o) setPickerOpen(null); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-60 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-60 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xl bg-surface border border-border p-5 shadow-2xl max-h-[85vh] flex flex-col">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <Dialog.Title className="text-sm font-semibold">
              {pickerOpen !== null ? t("pickTemplateForCell", { n: String(pickerOpen + 1) }) : ""}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-sm text-muted-foreground hover:text-foreground">{t("cancel")}</button>
            </Dialog.Close>
          </div>

          {pickerOpen !== null && items.find((i) => i.position === pickerOpen)?.templateId && (
            <button
              onClick={() => setItemTemplate(pickerOpen, undefined)}
              className="w-full text-left text-xs text-destructive hover:bg-destructive/10 rounded px-2 py-1.5 mb-3 shrink-0"
            >
              {t("clearCell")}
            </button>
          )}

          <div className="overflow-y-auto flex-1">
            {templates.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">{t("noTemplates")}</p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => pickerOpen !== null && setItemTemplate(pickerOpen, tpl.id)}
                    className="rounded-lg border border-border hover:border-accent bg-background overflow-hidden text-left transition-colors"
                  >
                    <div className="aspect-square">
                      {tpl.slides[0] && (
                        <SlideRenderer html={tpl.slides[0].html} aspectRatio={tpl.aspectRatio} className="w-full h-full" />
                      )}
                    </div>
                    <div className="px-2 py-1.5 flex items-center gap-1.5 border-t border-border">
                      {tpl.kind === "post" ? (
                        <ImageIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                      ) : (
                        <SlidersHorizontal className="h-3 w-3 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-[11px] truncate">{tpl.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    </>
  );
}
