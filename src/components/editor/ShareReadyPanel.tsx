"use client";

import { useState, useEffect } from "react";
import { Copy, Check, Loader2, ArrowLeft, ExternalLink, Download } from "lucide-react";

interface ShareImage {
  name: string;
  dataUrl: string;
  blob: Blob;
}

interface ShareReadyPanelProps {
  carouselId: string;
  carouselName?: string;
  caption?: string;
  hashtags?: string[];
  target: { id: string; label: string; url: string };
  onBack: () => void;
}

export function ShareReadyPanel({
  carouselId,
  carouselName,
  caption,
  hashtags,
  target,
  onBack,
}: ShareReadyPanelProps) {
  const [images, setImages] = useState<ShareImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copiedImg, setCopiedImg] = useState<number | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetch(`/api/carousels/${carouselId}/export?format=json`, { method: "POST" })
      .then((r) => {
        if (!r.ok) throw new Error("Export failed");
        return r.json() as Promise<{ files: { name: string; data: string }[] }>;
      })
      .then(({ files }) => {
        if (cancelled) return;
        const imgs = files.map(({ name, data }) => {
          const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
          const blob = new Blob([bytes], { type: "image/png" });
          const dataUrl = URL.createObjectURL(blob);
          return { name, dataUrl, blob };
        });
        setImages(imgs);
      })
      .catch((e) => { if (!cancelled) setLoadError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [carouselId]);

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => { images.forEach((img) => URL.revokeObjectURL(img.dataUrl)); };
  }, [images]);

  const copyImage = async (img: ShareImage, idx: number) => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": img.blob })]);
      setCopiedImg(idx);
      setTimeout(() => setCopiedImg(null), 2000);
    } catch {
      // ignore
    }
  };

  const downloadImage = (img: ShareImage) => {
    const a = document.createElement("a");
    a.href = img.dataUrl;
    a.download = img.name;
    a.click();
  };

  const textToCopy = [carouselName, caption, hashtags?.join(" ")].filter(Boolean).join("\n\n");

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold flex-1">{target.label}</span>
        <a
          href={target.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-accent hover:underline"
        >
          Abrir <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Images */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {loadError && (
        <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{loadError}</p>
      )}
      {!loading && images.length > 0 && (
        <div className={`grid gap-2 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"} max-h-72 overflow-y-auto`}>
          {images.map((img, idx) => (
            <div key={idx} className="relative group rounded-lg overflow-hidden bg-muted aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.dataUrl}
                alt={`Slide ${idx + 1}`}
                className="w-full h-full object-contain"
              />
              {/* Overlay on hover */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Download — primary, centered */}
                <button
                  onClick={() => downloadImage(img)}
                  className="flex flex-col items-center gap-1 text-white"
                >
                  <Download className="h-7 w-7" />
                  <span className="text-xs font-medium">
                    {images.length > 1 ? `Slide ${idx + 1}` : "Descargar"}
                  </span>
                </button>
              </div>
              {/* Copy — small icon, top-right corner */}
              <button
                onClick={(e) => { e.stopPropagation(); copyImage(img, idx); }}
                title="Copiar al portapapeles"
                className="absolute top-1.5 right-1.5 h-7 w-7 rounded-md flex items-center justify-center bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
              >
                {copiedImg === idx ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Caption + hashtags */}
      {textToCopy && (
        <div className="relative group rounded-lg border border-border bg-muted/50 p-3">
          <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed pr-7 max-h-28 overflow-y-auto">
            {textToCopy}
          </p>
          <button
            onClick={copyText}
            className="absolute top-2 right-2 h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Copiar texto"
          >
            {copiedText ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        {target.id === "instagram"
          ? `Descarga cada imagen, ábrela en ${target.label} y súbela con el selector de archivos`
          : `Copia cada imagen, ábrela en ${target.label} y pégala en el compositor`}
      </p>
    </div>
  );
}
