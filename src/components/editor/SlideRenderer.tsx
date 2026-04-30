"use client";

import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { wrapSlideHtml, type LogoConfig, type ColorSubstitution, type FontSubstitution } from "@/lib/slide-html";
import { SafeZoneOverlay } from "./SafeZoneOverlay";
import type { AspectRatio } from "@/types/carousel";
import { DIMENSIONS } from "@/types/carousel";

interface SlideRendererProps {
  html: string;
  aspectRatio: AspectRatio;
  className?: string;
  style?: React.CSSProperties;
  showSafeZones?: boolean;
  logoConfig?: LogoConfig;
  colorSubstitution?: ColorSubstitution;
  fontSubstitution?: FontSubstitution;
  customBackground?: string;
  accentOverride?: string;
}

export function SlideRenderer({
  html,
  aspectRatio,
  className,
  style,
  showSafeZones = false,
  logoConfig,
  colorSubstitution,
  fontSubstitution,
  customBackground,
  accentOverride,
}: SlideRendererProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const { width: slideW, height: slideH } = DIMENSIONS[aspectRatio];

  const wrappedHtml = useMemo(
    () => wrapSlideHtml(html, aspectRatio, { logoConfig, colorSubstitution, fontSubstitution, customBackground, accentOverride }),
    [html, aspectRatio, logoConfig, colorSubstitution, fontSubstitution, customBackground, accentOverride]
  );

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  useEffect(() => {
    const blob = new Blob([wrappedHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [wrappedHtml]);

  const measure = useCallback(() => {
    const el = outerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let w = rect.width;
    let h = rect.height;
    if (w === 0 || h === 0) {
      w = el.offsetWidth || el.clientWidth;
      h = el.offsetHeight || el.clientHeight;
    }
    if (w > 0 && h > 0) {
      setDims((prev) => (prev?.w === w && prev?.h === h ? prev : { w, h }));
    }
  }, []);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => measure());
    obs.observe(el);
    measure();
    const r1 = requestAnimationFrame(measure);
    const t1 = setTimeout(measure, 50);
    const t2 = setTimeout(measure, 200);
    const t3 = setTimeout(measure, 800);
    return () => {
      cancelAnimationFrame(r1);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      obs.disconnect();
    };
  }, [measure]);

  // Calculate scale to fit the slide into the container
  const scale = dims
    ? Math.min(dims.w / slideW, dims.h / slideH)
    : 0;

  const scaledW = Math.floor(slideW * scale);
  const scaledH = Math.floor(slideH * scale);

  return (
    <div
      ref={outerRef}
      className={className}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      {scale > 0 && (
        <div
          style={{
            width: scaledW,
            height: scaledH,
            overflow: "hidden",
            borderRadius: 8,
            position: "relative",
            boxShadow: "0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)",
            border: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          {blobUrl && (
            <iframe
              sandbox=""
              src={blobUrl}
              title="Slide preview"
              style={{
                width: slideW,
                height: slideH,
                border: "none",
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                position: "absolute",
                top: 0,
                left: 0,
                pointerEvents: "none",
              }}
            />
          )}
          <SafeZoneOverlay aspectRatio={aspectRatio} visible={showSafeZones} />
        </div>
      )}
    </div>
  );
}
