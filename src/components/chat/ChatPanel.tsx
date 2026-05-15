"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { ReferenceImages } from "./ReferenceImages";
import { AlertCircle, Plug } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import type { ReferenceImage, AspectRatio } from "@/types/carousel";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatPanelProps {
  carouselId: string;
  referenceImages?: ReferenceImage[];
  claudeAvailable: boolean;
  isPost?: boolean;
  onStreamStart?: () => void;
  onStreamEnd?: () => void;
  chatInputRef?: React.RefObject<HTMLTextAreaElement | null>;
  autoSendMessage?: string;
  onAutoSendConsumed?: () => void;
  /** Bump the nonce to fire `silentMessage` to the AI without showing it as a user message in the transcript. */
  silentSend?: { message: string; nonce: number };
  // Current values from the carousel (used to initialize local state)
  theme?: "dark" | "light" | "default";
  aspectRatio?: AspectRatio;
  // Called only when the user sends a message — not on every button click
  onCommitChanges?: (ratio: AspectRatio, theme: "dark" | "light" | "default") => Promise<void>;
}

export function ChatPanel({
  carouselId,
  claudeAvailable,
  referenceImages = [],
  isPost = false,
  onStreamStart,
  onStreamEnd,
  chatInputRef,
  autoSendMessage,
  onAutoSendConsumed,
  silentSend,
  theme,
  aspectRatio,
  onCommitChanges,
}: ChatPanelProps) {
  const { t } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Local pending state — buttons update these, nothing changes in preview until send
  const [pendingRatio, setPendingRatio] = useState<AspectRatio>(aspectRatio ?? "4:5");
  const [pendingTheme, setPendingTheme] = useState<"dark" | "light" | "default">(theme ?? "default");

  // Sync if parent initializes async (carousel loads after mount)
  useEffect(() => { if (aspectRatio) setPendingRatio(aspectRatio); }, [aspectRatio]);
  useEffect(() => { if (theme) setPendingTheme(theme); }, [theme]);

  useEffect(() => {
    const storedSession = localStorage.getItem(`chat-session-${carouselId}`);
    if (storedSession) setSessionId(storedSession);
    try {
      const storedMessages = localStorage.getItem(`chat-messages-${carouselId}`);
      if (storedMessages) setMessages(JSON.parse(storedMessages));
    } catch {
      // ignore corrupted data
    }
  }, [carouselId]);

  const persistMessages = useCallback(
    (msgs: Message[]) => {
      try {
        localStorage.setItem(`chat-messages-${carouselId}`, JSON.stringify(msgs));
      } catch {
        // ignore quota errors
      }
    },
    [carouselId]
  );

  const handleClearChat = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    localStorage.removeItem(`chat-messages-${carouselId}`);
    localStorage.removeItem(`chat-session-${carouselId}`);
  }, [carouselId]);

  const handleStopGenerating = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(
    async (message: string, options: { silent?: boolean } = {}) => {
      if (isStreaming) return;
      setError(null);

      // Commit pending ratio/theme to the carousel before sending
      if (onCommitChanges) {
        await onCommitChanges(pendingRatio, pendingTheme);
      }

      setIsStreaming(true);
      onStreamStart?.();

      if (!options.silent) {
        const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: message };
        setMessages((prev) => [...prev, userMsg]);
      }

      const assistantId = crypto.randomUUID();
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

      abortRef.current = new AbortController();

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            sessionId,
            carouselId,
            accountId: typeof window !== "undefined"
              ? localStorage.getItem("activeAccountId") ?? undefined
              : undefined,
          }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || "Failed to connect to AI");
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let accumulated = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === "token" && typeof data.text === "string") {
                  accumulated += data.text;
                  setMessages((prev) =>
                    prev.map((m) => m.id === assistantId ? { ...m, content: accumulated } : m)
                  );
                } else if (data.type === "result" && typeof data.text === "string") {
                  accumulated = data.text;
                  setMessages((prev) =>
                    prev.map((m) => m.id === assistantId ? { ...m, content: accumulated } : m)
                  );
                }
              } catch { /* skip */ }
            }
          }
        }

        if (buffer.trim()) {
          for (const line of buffer.split("\n")) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.sessionId) {
                  setSessionId(data.sessionId);
                  localStorage.setItem(`chat-session-${carouselId}`, data.sessionId);
                }
              } catch { /* skip */ }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        const msg = err instanceof Error ? err.message : "An unexpected error occurred";
        setError(msg);
        setMessages((prev) => prev.filter((m) => m.id !== assistantId || m.content.length > 0));
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
        setMessages((prev) => { persistMessages(prev); return prev; });
        onStreamEnd?.();
      }
    },
    [isStreaming, sessionId, carouselId, onStreamStart, onStreamEnd, persistMessages, onCommitChanges, pendingRatio, pendingTheme]
  );

  useEffect(() => {
    if (autoSendMessage && !isStreaming) {
      handleSend(autoSendMessage);
      onAutoSendConsumed?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSendMessage]);

  useEffect(() => {
    if (silentSend && silentSend.nonce > 0 && !isStreaming) {
      handleSend(silentSend.message, { silent: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [silentSend?.nonce]);

  const typeWord = isPost ? t("postWord") : t("carouselWord");

  if (!claudeAvailable) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <Plug className="h-10 w-10 text-muted-foreground mb-3" />
        <h3 className="font-semibold text-sm mb-1">{t("connectClaude")}</h3>
        <p className="text-xs text-muted-foreground max-w-[200px]">
          {t("connectClaudeDesc", { type: typeWord })}{" "}
          <a
            href="https://docs.anthropic.com/en/docs/claude-code"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline"
          >
            {t("installGuide")}
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-border flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold">{t("aiAssistant")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("describeContent", { type: typeWord })}
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClearChat}
            className="text-[10px] text-muted-foreground hover:text-destructive transition-colors px-1.5 py-0.5 rounded"
          >
            {t("clearChat")}
          </button>
        )}
      </div>

      <ReferenceImages
        carouselId={carouselId}
        images={referenceImages}
        onImagesChange={() => onStreamEnd?.()}
      />

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 && (
          <div className="p-6 text-center text-muted-foreground">
            <p className="text-sm mb-1">{t("noMessages")}</p>
            <p className="text-xs">{t("tellMeWhat", { type: typeWord })}</p>
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            role={msg.role}
            content={msg.content}
            isStreaming={
              isStreaming &&
              msg.role === "assistant" &&
              msg.id === messages[messages.length - 1]?.id
            }
          />
        ))}
        {error && (
          <div className="mx-4 my-2 flex items-center gap-2 text-destructive text-xs bg-destructive/10 rounded-lg p-3">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
      </div>

      <ChatInput
        onSend={handleSend}
        isStreaming={isStreaming}
        textareaRef={chatInputRef}
        onStop={handleStopGenerating}
        isPost={isPost}
        theme={pendingTheme}
        onThemeChange={setPendingTheme}
        aspectRatio={pendingRatio}
        onAspectRatioChange={setPendingRatio}
      />
    </div>
  );
}
