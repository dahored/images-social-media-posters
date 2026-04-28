"use client";

import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { wrapSlideHtml, type LogoConfig, type ColorSubstitution } from "@/lib/slide-html";
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
}

export function SlideRenderer({
  html,
  aspectRatio,
  className,
  style,
  showSafeZones = false,
  logoConfig,
  colorSubstitution,
}: SlideRendererProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const { width: slideW, height: slideH } = DIMENSIONS[aspectRatio];

  const srcDoc = useMemo(
    () => wrapSlideHtml(html, aspectRatio, { logoConfig, colorSubstitution }),
    [html, aspectRatio, logoConfig, colorSubstitution]
  );

  const measure = useCallback(() => {
    const el = outerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setDims({ w: rect.width, h: rect.height });
    }
  }, []);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => measure());
    obs.observe(el);
    measure();
    return () => obs.disconnect();
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
          <iframe
            sandbox=""
            srcDoc={srcDoc}
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
          <SafeZoneOverlay aspectRatio={aspectRatio} visible={showSafeZones} />
        </div>
      )}
    </div>
  );
}
