"use client";

import { useState, useRef } from "react";
import { Send, Square, Moon, Sun, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";
import type { AspectRatio } from "@/types/carousel";

const RATIOS: AspectRatio[] = ["1:1", "4:5", "9:16"];

interface ChatInputProps {
  onSend: (message: string) => void;
  isStreaming: boolean;
  disabled?: boolean;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  onStop?: () => void;
  isPost?: boolean;
  theme?: "dark" | "light" | "default";
  onThemeChange?: (theme: "dark" | "light" | "default") => void;
  aspectRatio?: AspectRatio;
  onAspectRatioChange?: (ratio: AspectRatio) => void;
}

export function ChatInput({ onSend, isStreaming, disabled, textareaRef: externalRef, onStop, isPost = false, theme, onThemeChange, aspectRatio, onAspectRatioChange }: ChatInputProps) {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = externalRef || internalRef;

  const SUGGESTIONS = isPost
    ? [t("suggestionPost1"), t("suggestionPost2"), t("suggestionPost3"), t("suggestionPost4"), t("suggestionPost5")]
    : [t("suggestionCarousel1"), t("suggestionCarousel2"), t("suggestionCarousel3"), t("suggestionCarousel4"), t("suggestionCarousel5")];

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
    }
  };

  return (
    <div className="border-t border-border p-3">
      {(onThemeChange || onAspectRatioChange) && (
        <div className="flex flex-col gap-1.5 mb-2">
          {onAspectRatioChange && (
            <div className="flex items-center gap-0.5 p-0.5 bg-muted rounded-md">
              {RATIOS.map((r) => (
                <button
                  key={r}
                  onClick={() => onAspectRatioChange(r)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    aspectRatio === r ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
          {onThemeChange && (
            <div className="flex items-center gap-0.5 p-0.5 bg-muted rounded-md">
              <button
                onClick={() => onThemeChange("default")}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  (theme ?? "default") === "default" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sparkles className="h-2.5 w-2.5" />
                {t("themeDefault")}
              </button>
              <button
                onClick={() => onThemeChange("dark")}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  (theme ?? "default") === "dark" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Moon className="h-2.5 w-2.5" />
                {t("themeDark")}
              </button>
              <button
                onClick={() => onThemeChange("light")}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  (theme ?? "default") === "light" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sun className="h-2.5 w-2.5" />
                {t("themeLight")}
              </button>
            </div>
          )}
        </div>
      )}
      {value.length === 0 && !isStreaming && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {SUGGESTIONS.slice(0, 3).map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => setValue(suggestion)}
              className="text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={isStreaming ? t("aiIsWorking") : isPost ? t("describePost") : t("describeCarousel")}
          disabled={isStreaming || disabled}
          rows={1}
          className="flex-1 resize-none bg-muted rounded-lg px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          aria-label="Chat message input"
        />
        {isStreaming ? (
          <Button size="icon" variant="accent" onClick={onStop} aria-label={t("stopGenerating")}>
            <Square className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button size="icon" onClick={handleSubmit} disabled={!value.trim() || disabled} aria-label={t("sendMessage")}>
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
