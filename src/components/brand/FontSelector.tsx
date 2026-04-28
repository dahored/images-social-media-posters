"use client";

import { useState, useEffect, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";

interface Font {
  name: string;
  category: string;
}

// Module-level cache — avoids duplicate <link> injections across re-renders
const loadedFonts = new Set<string>();

export function loadGoogleFont(family: string) {
  if (loadedFonts.has(family)) return;
  loadedFonts.add(family);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&display=swap`;
  document.head.appendChild(link);
}

interface FontSelectorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function FontSelector({ label, value, onChange }: FontSelectorProps) {
  const [fonts, setFonts] = useState<Font[]>([]);
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Always load the currently selected font so the trigger preview renders
  useEffect(() => {
    if (value) loadGoogleFont(value);
  }, [value]);

  useEffect(() => {
    fetch("/api/fonts")
      .then((r) => r.json())
      .then((data) => setFonts(data.fonts || []))
      .catch(() => {});
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const dropdown = document.getElementById("font-dropdown-portal");
      if (
        triggerRef.current &&
        !triggerRef.current.closest("[data-font-selector]")?.contains(target) &&
        !dropdown?.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleToggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: "fixed",
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    }
    setOpen((v) => !v);
  };

  return (
    <div data-font-selector="">
      <label className="text-xs font-medium text-muted-foreground block mb-1.5">
        {label}
      </label>

      {/* Trigger button */}
      <button
        ref={triggerRef}
        onClick={handleToggle}
        className="w-full h-10 rounded-lg border border-border bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring flex items-center justify-between cursor-pointer hover:border-muted-foreground/50 transition-colors"
      >
        <span style={{ fontFamily: `'${value}', sans-serif` }}>{value}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Always-visible preview of selected font */}
      <p
        className="mt-1.5 text-sm text-muted-foreground"
        style={{ fontFamily: `'${value}', sans-serif` }}
      >
        The quick brown fox jumps over the lazy dog
      </p>

      {/* Dropdown — portaled to body to escape dialog stacking context */}
      {open && createPortal(
        <div
          id="font-dropdown-portal"
          style={dropdownStyle}
          className="rounded-lg border border-border bg-surface shadow-xl max-h-64 overflow-y-auto"
        >
          {fonts.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              Loading fonts…
            </div>
          ) : (
            fonts.map((font) => (
              <FontOption
                key={font.name}
                font={font}
                isSelected={font.name === value}
                onClick={() => { onChange(font.name); setOpen(false); }}
              />
            ))
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

function FontOption({
  font,
  isSelected,
  onClick,
}: {
  font: Font;
  isSelected: boolean;
  onClick: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  // Lazy-load Google Font only when this option scrolls into view
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          loadGoogleFont(font.name);
          observer.disconnect();
        }
      },
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [font.name]);

  return (
    <button
      ref={ref}
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 hover:bg-muted transition-colors cursor-pointer border-b border-border/40 last:border-0 ${
        isSelected ? "bg-accent/5" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-xs font-medium text-foreground">{font.name}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">{font.category}</span>
          {isSelected && <Check className="h-3 w-3 text-accent shrink-0" />}
        </div>
      </div>
      <span
        className="text-sm text-muted-foreground block leading-snug"
        style={{ fontFamily: `'${font.name}', sans-serif` }}
      >
        The quick brown fox jumps over the lazy dog
      </span>
    </button>
  );
}
