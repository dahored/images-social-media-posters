"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight, AlertCircle, CheckCircle2, Sparkles, Copy, Check, Circle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";
import { useBranding } from "@/lib/hooks/useBranding";
import { computeSlideRendererProps } from "@/lib/slide-renderer-props";
import type { Grid } from "@/types/grid";
import type { Template } from "@/types/template";
import type { BulkPreview, ParsedContent } from "@/types/bulk";
import type { Carousel, Slide } from "@/types/carousel";
import { SlideRenderer } from "@/components/editor/SlideRenderer";

type Step = "pick-grid" | "input" | "preview" | "generating" | "done";

type CellStatus = "pending" | "generating" | "done" | "error";

interface CellProgress {
  position: number;
  templateName: string;
  templateKind: "post" | "carousel";
  topic: string;
  status: CellStatus;
  result?: { id: string; name: string };
  error?: string;
}

export function BulkPanel() {
  const { t } = useI18n();
  const router = useRouter();
  const branding = useBranding();
  const [step, setStep] = useState<Step>("pick-grid");
  const [grids, setGrids] = useState<Grid[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedGrid, setSelectedGrid] = useState<Grid | null>(null);
  const [content, setContent] = useState("");
  const [parsed, setParsed] = useState<ParsedContent | null>(null);
  const [preview, setPreview] = useState<BulkPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [cellProgress, setCellProgress] = useState<CellProgress[]>([]);
  const [generatedCarousels, setGeneratedCarousels] = useState<Array<{ id: string; name: string }>>([]);
  const [errors, setErrors] = useState<Array<{ position: number; error: string }>>([]);
  const [copied, setCopied] = useState(false);

  const fetchData = useCallback(() => {
    const accountId = localStorage.getItem("activeAccountId");
    const gridUrl = accountId ? `/api/grids?accountId=${accountId}` : "/api/grids";
    const tplUrl = accountId ? `/api/templates?accountId=${accountId}` : "/api/templates";
    Promise.all([fetch(gridUrl).then((r) => r.json()), fetch(tplUrl).then((r) => r.json())])
      .then(([gd, td]) => {
        setGrids(gd.grids || []);
        setTemplates(td.templates || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchData();
    const handler = () => fetchData();
    window.addEventListener("account-changed", handler);
    return () => window.removeEventListener("account-changed", handler);
  }, [fetchData]);

  const templatesById = new Map(templates.map((t) => [t.id, t]));

  const handlePreview = async () => {
    if (!selectedGrid || !content.trim()) return;
    setPreviewing(true);
    try {
      const accountId = localStorage.getItem("activeAccountId") ?? undefined;
      const res = await fetch("/api/bulk/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gridId: selectedGrid.id, content, accountId }),
      });
      if (res.ok) {
        const data = await res.json();
        setParsed(data.parsed);
        setPreview(data.preview);
        setStep("preview");
      }
    } finally {
      setPreviewing(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedGrid || !content.trim() || !preview) return;

    // Initialise progress list from preview plan
    const initialProgress: CellProgress[] = preview.cells.map((c) => ({
      position: c.position,
      templateName: c.templateName,
      templateKind: c.templateKind,
      topic: c.contentFragment.items[0] || c.contentFragment.title || "",
      status: "pending",
    }));
    setCellProgress(initialProgress);
    setGeneratedCarousels([]);
    setErrors([]);
    setStep("generating");

    const accountId = localStorage.getItem("activeAccountId") ?? undefined;
    const res = await fetch("/api/bulk/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gridId: selectedGrid.id, content, accountId }),
    });

    if (!res.body) {
      setStep("done");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const carousels: Array<{ id: string; name: string }> = [];
    const errs: Array<{ position: number; error: string }> = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const messages = buffer.split("\n\n");
      buffer = messages.pop() ?? "";

      for (const msg of messages) {
        const eventMatch = msg.match(/^event: (.+)$/m);
        const dataMatch = msg.match(/^data: (.+)$/m);
        if (!dataMatch) continue;
        const event = eventMatch?.[1] ?? "message";
        let data: Record<string, unknown>;
        try { data = JSON.parse(dataMatch[1]); } catch { continue; }

        if (event === "plan") {
          // Server may send updated plan (e.g., with warnings) — reinit progress
          const planCells = data.cells as Array<{ position: number; templateName: string; templateKind: "post" | "carousel" }>;
          if (planCells?.length) {
            setCellProgress(planCells.map((c) => ({ ...c, topic: "", status: "pending" })));
          }
        } else if (event === "progress") {
          const { position, status, carousel, error } = data as {
            position: number;
            status: CellStatus;
            carousel?: { id: string; name: string };
            error?: string;
          };
          setCellProgress((prev) =>
            prev.map((c) =>
              c.position === position
                ? { ...c, status, result: carousel, error }
                : c
            )
          );
          if (status === "done" && carousel) carousels.push(carousel);
          if (status === "error" && error) errs.push({ position, error });
        } else if (event === "complete") {
          setGeneratedCarousels(carousels);
          setErrors(errs);
          setStep("done");
        }
      }
    }

    // Fallback if stream ended without complete event
    setGeneratedCarousels(carousels);
    setErrors(errs);
    if (step === "generating") setStep("done");
  };

  const reset = () => {
    setStep("pick-grid");
    setSelectedGrid(null);
    setContent("");
    setParsed(null);
    setPreview(null);
    setCellProgress([]);
    setGeneratedCarousels([]);
    setErrors([]);
  };

  const retryCell = useCallback(async (position: number) => {
    if (!selectedGrid || !content.trim()) return;

    setCellProgress((prev) =>
      prev.map((c) =>
        c.position === position ? { ...c, status: "generating" as CellStatus, error: undefined, result: undefined } : c
      )
    );
    setErrors((prev) => prev.filter((e) => e.position !== position));
    setStep("generating");

    const accountId = localStorage.getItem("activeAccountId") ?? undefined;
    const res = await fetch("/api/bulk/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gridId: selectedGrid.id, content, accountId, positions: [position] }),
    });

    if (!res.body) {
      setCellProgress((prev) => {
        if (prev.every((c) => c.status === "done" || c.status === "error")) setTimeout(() => setStep("done"), 0);
        return prev;
      });
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const messages = buffer.split("\n\n");
      buffer = messages.pop() ?? "";

      for (const msg of messages) {
        const eventMatch = msg.match(/^event: (.+)$/m);
        const dataMatch = msg.match(/^data: (.+)$/m);
        if (!dataMatch) continue;
        const event = eventMatch?.[1] ?? "message";
        let data: Record<string, unknown>;
        try { data = JSON.parse(dataMatch[1]); } catch { continue; }

        if (event === "progress") {
          const { position: pos, status, carousel, error } = data as {
            position: number;
            status: CellStatus;
            carousel?: { id: string; name: string };
            error?: string;
          };
          setCellProgress((prev) =>
            prev.map((c) =>
              c.position === pos ? { ...c, status, result: carousel, error } : c
            )
          );
          if (status === "done" && carousel) {
            setGeneratedCarousels((prev) =>
              prev.some((c) => c.id === carousel.id) ? prev : [...prev, carousel]
            );
          }
          if (status === "error" && error) {
            setErrors((prev) => [...prev.filter((e) => e.position !== pos), { position: pos, error }]);
          }
        }
      }
    }

    setCellProgress((current) => {
      if (current.every((c) => c.status === "done" || c.status === "error")) {
        setTimeout(() => setStep("done"), 0);
      }
      return current;
    });
  }, [selectedGrid, content]);

  if (step === "pick-grid") {
    return (
      <div>
        <p className="text-xs text-muted-foreground mb-4">{t("bulkPickGridHint")}</p>
        {grids.length === 0 ? (
          <div className="text-center py-16 rounded-xl border border-dashed border-border">
            <p className="text-sm font-semibold mb-1">{t("bulkNoGrids")}</p>
            <p className="text-xs text-muted-foreground">{t("bulkCreateGridFirst")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {grids.map((g) => {
              const cols = 3;
              return (
                <button
                  key={g.id}
                  onClick={() => { setSelectedGrid(g); setStep("input"); }}
                  className="text-left rounded-xl border border-border bg-surface p-4 hover:border-accent hover:shadow-md transition-all"
                >
                  <div
                    className="rounded-lg bg-muted mb-3 overflow-hidden grid gap-1 p-1"
                    style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, aspectRatio: `${cols} / ${g.size / cols}` }}
                  >
                    {g.items.map((item) => {
                      const tpl = item.templateId ? templatesById.get(item.templateId) : null;
                      return (
                        <div key={item.position} className="bg-background rounded overflow-hidden">
                          {tpl && tpl.slides[0] ? (
                            <SlideRenderer
                              html={tpl.slides[0].html}
                              aspectRatio={tpl.aspectRatio}
                              className="w-full h-full"
                              {...(branding ? computeSlideRendererProps(
                                branding,
                                { brandingOverride: tpl.brandingOverride } as unknown as Carousel,
                                tpl.slides[0] as unknown as Slide,
                              ) : {})}
                            />
                          ) : <div className="w-full h-full" />}
                        </div>
                      );
                    })}
                  </div>
                  <h3 className="font-semibold text-sm">{g.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {g.size} {t("cells")} · {g.items.filter((i) => i.templateId).length}/{g.size} {t("filled")}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (step === "input") {
    let carouselsNeeded = 0;
    let postsNeeded = 0;
    if (selectedGrid) {
      for (const item of selectedGrid.items) {
        if (!item.templateId) continue;
        const tpl = templatesById.get(item.templateId);
        if (!tpl) continue;
        if (tpl.kind === "post") postsNeeded++;
        else carouselsNeeded++;
      }
    }
    const hasRequirements = carouselsNeeded + postsNeeded > 0;

    let example = "";
    if (selectedGrid && hasRequirements) {
      const exampleBlocks: string[] = [];
      let cIdx = 0;
      let pIdx = 0;
      for (const item of selectedGrid.items) {
        if (!item.templateId) continue;
        const tpl = templatesById.get(item.templateId);
        if (!tpl) continue;
        if (tpl.kind === "post") {
          pIdx++;
          exampleBlocks.push(
            `${t("bulkExamplePostHeading", { n: String(pIdx) })}\n${t("bulkExamplePostBody", { n: String(pIdx) })}`
          );
        } else {
          cIdx++;
          exampleBlocks.push(
            `${t("bulkExampleCarouselHeading", { n: String(cIdx) })}\n- ${t("bulkExampleCarouselTopic", { n: String(cIdx) })}`
          );
        }
      }
      example = exampleBlocks.join("\n\n");
    }

    return (
      <div>
        <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
          <button onClick={() => setStep("pick-grid")} className="hover:text-foreground">{t("bulkBackToGrid")}</button>
          <span>/</span>
          <span className="text-foreground font-medium">{selectedGrid?.name}</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4 items-start">
          <div className="p-3 rounded-lg bg-accent/5 border border-accent/20 text-xs lg:sticky lg:top-4">
            <p className="font-medium mb-1.5">{t("bulkRequirementsTitle")}</p>
            {hasRequirements ? (
              <ul className="space-y-0.5 text-muted-foreground">
                {carouselsNeeded > 0 && <li>· {t("bulkReqCarousels", { n: String(carouselsNeeded) })}</li>}
                {postsNeeded > 0 && <li>· {t("bulkReqPosts", { n: String(postsNeeded) })}</li>}
              </ul>
            ) : (
              <p className="text-muted-foreground">{t("bulkReqEmpty")}</p>
            )}
            {example && (
              <div className="mt-3 pt-3 border-t border-accent/20">
                <p className="text-[11px] font-medium mb-1.5 text-muted-foreground">{t("bulkExampleTitle")}</p>
                <div className="relative">
                  <pre className="p-2 bg-background rounded border border-border text-[11px] whitespace-pre-wrap font-mono leading-relaxed">{example}</pre>
                  <button
                    onClick={() => { navigator.clipboard.writeText(example); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                    className="absolute top-1.5 right-1.5 h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Copiar"
                  >
                    {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
                <button
                  onClick={() => setContent(example)}
                  className="mt-1.5 text-[11px] text-accent hover:underline"
                >
                  {t("bulkExampleUse")} →
                </button>
              </div>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-3">{t("bulkInputHint")}</p>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t("bulkInputPlaceholder")}
              className="w-full h-96 rounded-lg border border-border bg-surface p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" size="sm" onClick={() => setStep("pick-grid")}>{t("back")}</Button>
              <Button variant="accent" size="sm" disabled={!content.trim() || previewing} onClick={handlePreview}>
                {previewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                {t("bulkPreview")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === "preview" && preview && parsed) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
          <button onClick={() => setStep("input")} className="hover:text-foreground">{t("bulkBackToInput")}</button>
          <span>/</span>
          <span className="text-foreground font-medium">{t("bulkPreviewTitle")}</span>
        </div>

        <div className="mb-4 p-3 rounded-lg bg-muted/50 border border-border text-xs">
          <p className="font-medium mb-1">{t("bulkParsedSummary")}</p>
          <p className="text-muted-foreground">
            {parsed.categories.length} {t("bulkCategoriesDetected")} · {parsed.totalItems} {t("bulkItemsDetected")}
          </p>
        </div>

        {preview.warnings.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-xs">
            <div className="flex items-center gap-1.5 mb-1 font-medium">
              <AlertCircle className="h-3.5 w-3.5" />
              {t("bulkWarnings")}
            </div>
            <ul className="text-muted-foreground space-y-0.5">
              {preview.warnings.map((w, i) => <li key={i}>· {w}</li>)}
            </ul>
          </div>
        )}

        <p className="text-xs font-medium mb-2">{t("bulkAssignedCells")}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 mb-5">
          {preview.cells.map((cell) => (
            <div key={cell.position} className="rounded-lg border border-border p-3 bg-surface flex items-start gap-3">
              <span className="text-xs font-mono text-muted-foreground bg-muted rounded px-1.5 py-0.5 shrink-0 mt-0.5">
                #{cell.position + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{cell.templateName} <span className="text-muted-foreground">({cell.templateKind})</span></p>
                {cell.contentFragment.title && (
                  <p className="text-[11px] text-accent mt-0.5 truncate">{cell.contentFragment.title}</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {cell.contentFragment.items.slice(0, 3).join(" · ")}
                  {cell.contentFragment.items.length > 3 && ` +${cell.contentFragment.items.length - 3}`}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setStep("input")}>{t("back")}</Button>
          <Button variant="accent" size="sm" disabled={preview.cells.length === 0} onClick={handleGenerate}>
            <Sparkles className="h-3.5 w-3.5" />
            {t("bulkGenerate", { n: String(preview.cells.length) })}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "generating") {
    const done = cellProgress.filter((c) => c.status === "done" || c.status === "error").length;
    const total = cellProgress.length;
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium">{t("bulkGeneratingTitle")}</p>
          <p className="text-xs text-muted-foreground">{done}/{total}</p>
        </div>
        <div className="space-y-2">
          {cellProgress.map((cell) => (
            <div
              key={cell.position}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3"
            >
              <span className="text-xs font-mono text-muted-foreground bg-muted rounded px-1.5 py-0.5 shrink-0">
                #{cell.position + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{cell.templateName} <span className="text-muted-foreground font-normal">({cell.templateKind})</span></p>
                {cell.topic && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{cell.topic}</p>}
              </div>
              <div className="shrink-0">
                {cell.status === "pending" && <Circle className="h-4 w-4 text-muted-foreground/40" />}
                {cell.status === "generating" && <Loader2 className="h-4 w-4 text-accent animate-spin" />}
                {cell.status === "done" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                {cell.status === "error" && (
                  <div className="flex items-center gap-1.5">
                    <span title={cell.error}>
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    </span>
                    <button
                      onClick={() => retryCell(cell.position)}
                      className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-accent hover:bg-accent/10 transition-colors"
                      title="Reintentar"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        {total > 0 && (
          <div className="mt-4 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-500"
              style={{ width: `${(done / total) * 100}%` }}
            />
          </div>
        )}
      </div>
    );
  }

  if (step === "done") {
    return (
      <div>
        <div className="text-center py-8">
          <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-3" />
          <p className="text-base font-semibold mb-1">
            {t("bulkDoneTitle", { n: String(generatedCarousels.length) })}
          </p>
          {errors.length > 0 && (
            <p className="text-xs text-destructive">{errors.length} {t("bulkErrors")}</p>
          )}
        </div>
        {generatedCarousels.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 mb-5">
            {generatedCarousels.map((c) => (
              <button
                key={c.id}
                onClick={() => router.push(`/carousel/${c.id}`)}
                className="text-left rounded-lg border border-border p-3 bg-surface hover:border-accent transition-colors"
              >
                <p className="text-sm font-medium truncate">{c.name}</p>
              </button>
            ))}
          </div>
        )}
        {errors.length > 0 && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 mb-4 text-xs">
            <p className="font-medium mb-1">{t("bulkErrorsTitle")}</p>
            <ul className="space-y-1 text-muted-foreground">
              {errors.map((e, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="flex-1">· #{e.position + 1}: {e.error}</span>
                  <button
                    onClick={() => retryCell(e.position)}
                    className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-accent hover:bg-accent/10 transition-colors font-medium"
                    title="Reintentar"
                  >
                    <RefreshCw className="h-3 w-3" />
                    {t("retry")}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex justify-center gap-3">
          <Button variant="outline" size="sm" onClick={reset}>{t("bulkStartOver")}</Button>
          <Button variant="accent" size="sm" onClick={() => router.push(selectedGrid ? `/content/my-posts-grid/${selectedGrid.id}` : "/content/my-posts-grid")}>{t("bulkViewPostGrid")}</Button>
        </div>
      </div>
    );
  }

  return null;
}
