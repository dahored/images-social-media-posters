"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ExternalLink, Loader2, RefreshCw, Unplug } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";

type Status = "checking" | "logged-in" | "not-logged-in" | "unavailable";
type LoginStep = "idle" | "connecting" | "waiting-url" | "has-url" | "needs-code" | "submitting-code" | "done" | "error";

export default function ClaudeSettingsPage() {
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>("checking");
  const [loginStep, setLoginStep] = useState<LoginStep>("idle");
  const [loginUrl, setLoginUrl] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const esRef = useRef<EventSource | null>(null);
  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkStatus = async () => {
    setStatus("checking");
    try {
      const res = await fetch("/api/claude/status");
      const data = await res.json();
      if (!data.available) setStatus("unavailable");
      else setStatus(data.loggedIn ? "logged-in" : "not-logged-in");
    } catch {
      setStatus("unavailable");
    }
  };

  useEffect(() => {
    checkStatus();
    return () => {
      esRef.current?.close();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startLogin = () => {
    esRef.current?.close();
    setLoginStep("connecting");
    setLoginUrl(null);
    setLoginError(null);
    setLogs([]);
    setSessionId(null);
    setCodeInput("");

    // Open a blank popup NOW (synchronously during the click event) so the
    // browser allows it. We'll navigate it to the OAuth URL once SSE delivers it.
    popupRef.current?.close();
    popupRef.current = window.open("about:blank", "claude-oauth", "width=520,height=680");

    const es = new EventSource("/api/claude/login");
    esRef.current = es;

    es.onmessage = (e) => {
      const data = JSON.parse(e.data) as {
        type: string;
        url?: string;
        text?: string;
        message?: string;
        sessionId?: string;
      };

      if (data.type === "log" && data.text) {
        setLogs((prev) => [...prev.slice(-10), data.text!]);
        setLoginStep((prev) => (prev === "connecting" ? "waiting-url" : prev));
      }
      if (data.type === "url" && data.url) {
        setLoginUrl(data.url);
        setLoginStep("has-url");
        // Navigate the pre-opened popup to the OAuth URL
        if (popupRef.current && !popupRef.current.closed) {
          popupRef.current.location.href = data.url;
        }
      }
      if (data.type === "needs-code" && data.sessionId) {
        setSessionId(data.sessionId);
        setLoginStep("needs-code");
        // Keep the popup open — the user needs to read the code from it
      }
      if (data.type === "done") {
        setLoginStep("done");
        setStatus("logged-in");
        popupRef.current?.close();
        es.close();
      }
      if (data.type === "error") {
        setLoginStep("error");
        setLoginError(data.message ?? t("claudeLoginError"));
        es.close();
      }
    };

    es.onerror = () => {
      setLoginStep((prev) => {
        if (prev !== "done") {
          setLoginError(t("claudeLoginConnectionFailed"));
          return "error";
        }
        return prev;
      });
      es.close();
    };
  };

  const submitCode = async () => {
    if (!sessionId || !codeInput.trim()) return;
    setLoginStep("submitting-code");
    try {
      const res = await fetch("/api/claude/login/submit-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, code: codeInput.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        setLoginStep("error");
        setLoginError(err.error ?? t("claudeLoginError"));
        return;
      }
      // Poll /api/claude/status every 2s as robust fallback in case Claude's
      // output text doesn't match the SSE "done" pattern
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const r = await fetch("/api/claude/status");
          const d = await r.json();
          if (d.loggedIn) {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            esRef.current?.close();
            popupRef.current?.close();
            setLoginStep("done");
            setStatus("logged-in");
          }
        } catch { /* ignore polling errors */ }
      }, 2000);
      // Give up polling after 2 min
      setTimeout(() => { if (pollRef.current) clearInterval(pollRef.current); }, 120_000);
    } catch {
      setLoginStep("error");
      setLoginError(t("claudeLoginError"));
    }
  };

  const cancelLogin = () => {
    esRef.current?.close();
    popupRef.current?.close();
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setLoginStep("idle");
    setLoginUrl(null);
    setLoginError(null);
    setLogs([]);
    setSessionId(null);
    setCodeInput("");
  };

  return (
    <div className="h-full flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-6">
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-xl font-bold">{t("claudeSettingsTitle")}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{t("claudeSettingsSubtitle")}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-6 space-y-5">
            {/* Status row */}
            <div className="flex items-center gap-3">
              {status === "checking" && (
                <>
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">{t("claudeCheckingStatus")}</p>
                </>
              )}

              {status === "logged-in" && (
                <>
                  <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <Check className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{t("claudeConnected")}</p>
                    <p className="text-xs text-muted-foreground">{t("claudeConnectedDesc")}</p>
                  </div>
                  <button onClick={checkStatus} className="text-muted-foreground hover:text-foreground transition-colors" title={t("refresh")}>
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </>
              )}

              {status === "not-logged-in" && loginStep === "idle" && (
                <>
                  <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                    <Unplug className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{t("claudeNotConnected")}</p>
                    <p className="text-xs text-muted-foreground">{t("claudeNotConnectedDesc")}</p>
                  </div>
                  <button onClick={checkStatus} className="text-muted-foreground hover:text-foreground transition-colors" title={t("refresh")}>
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </>
              )}

              {status === "unavailable" && (
                <>
                  <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                    <Unplug className="h-4 w-4 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{t("claudeUnavailable")}</p>
                    <p className="text-xs text-muted-foreground">{t("claudeUnavailableDesc")}</p>
                  </div>
                </>
              )}
            </div>

            {/* Login flow */}
            {status === "not-logged-in" && (
              <div className="space-y-3 pt-1">
                {loginStep === "idle" && (
                  <Button onClick={startLogin} variant="accent" className="w-full">
                    {t("claudeConnectBtn")}
                  </Button>
                )}

                {(loginStep === "connecting" || loginStep === "waiting-url") && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                      <span>{t("claudeStartingLogin")}</span>
                    </div>
                    {logs.length > 0 && (
                      <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground font-mono max-h-24 overflow-y-auto space-y-0.5">
                        {logs.map((l, i) => <div key={i}>{l}</div>)}
                      </div>
                    )}
                    <button onClick={cancelLogin} className="text-xs text-muted-foreground hover:text-foreground underline">
                      {t("cancel")}
                    </button>
                  </div>
                )}

                {loginStep === "has-url" && loginUrl && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                      <span>{t("claudeWaitingLogin")}</span>
                    </div>
                    {/* Fallback link in case popup was blocked */}
                    <a
                      href={loginUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-accent underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {t("claudeOpenLoginPage")}
                    </a>
                    <button onClick={cancelLogin} className="text-xs text-muted-foreground hover:text-foreground underline">
                      {t("cancel")}
                    </button>
                  </div>
                )}

                {(loginStep === "needs-code" || loginStep === "submitting-code") && (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium mb-0.5">{t("claudePasteCodeTitle")}</p>
                      <p className="text-xs text-muted-foreground">{t("claudePasteCodeDesc")}</p>
                    </div>
                    <div className="flex gap-2 items-stretch">
                      <input
                        type="text"
                        value={codeInput}
                        onChange={(e) => setCodeInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && submitCode()}
                        placeholder={t("claudeCodePlaceholder")}
                        className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/50"
                        autoFocus
                        disabled={loginStep === "submitting-code"}
                      />
                      <Button
                        onClick={submitCode}
                        variant="accent"
                        className="shrink-0 self-stretch h-auto"
                        disabled={!codeInput.trim() || loginStep === "submitting-code"}
                      >
                        {loginStep === "submitting-code"
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : t("confirm")}
                      </Button>
                    </div>
                    <button onClick={cancelLogin} className="text-xs text-muted-foreground hover:text-foreground underline">
                      {t("cancel")}
                    </button>
                  </div>
                )}

                {loginStep === "done" && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <Check className="h-4 w-4" />
                    {t("claudeLoginDone")}
                  </div>
                )}

                {loginStep === "error" && (
                  <div className="space-y-3">
                    <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                      {loginError}
                    </p>

                    {/* Manual fallback: terminal command */}
                    <div className="rounded-lg border border-border p-3 space-y-2">
                      <p className="text-xs font-medium">{t("claudeManualFallbackTitle")}</p>
                      <p className="text-xs text-muted-foreground">{t("claudeManualFallbackDesc")}</p>
                      <div className="rounded bg-muted px-3 py-2 font-mono text-xs select-all">
                        docker compose exec -it app claude
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t("claudeManualFallbackStep2")} <code className="bg-muted px-1 rounded">/login</code>
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={startLogin} variant="outline" size="sm">
                        {t("claudeRetryLogin")}
                      </Button>
                      <Button onClick={checkStatus} variant="outline" size="sm">
                        {t("claudeCheckStatusBtn")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Help note */}
          <p className="text-xs text-muted-foreground mt-4">
            {t("claudeSettingsHint")}
          </p>
        </div>
      </main>
    </div>
  );
}
