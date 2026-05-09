"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ExternalLink, Loader2, RefreshCw, Unplug } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";

type Status = "checking" | "logged-in" | "not-logged-in" | "unavailable";
type LoginStep = "idle" | "connecting" | "waiting-url" | "has-url" | "done" | "error";

export default function ClaudeSettingsPage() {
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>("checking");
  const [loginStep, setLoginStep] = useState<LoginStep>("idle");
  const [loginUrl, setLoginUrl] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const esRef = useRef<EventSource | null>(null);

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
    return () => { esRef.current?.close(); };
  }, []);

  const startLogin = () => {
    esRef.current?.close();
    setLoginStep("connecting");
    setLoginUrl(null);
    setLoginError(null);
    setLogs([]);

    const es = new EventSource("/api/claude/login");
    esRef.current = es;

    es.onmessage = (e) => {
      const data = JSON.parse(e.data) as { type: string; url?: string; text?: string; message?: string };

      if (data.type === "log" && data.text) {
        setLogs((prev) => [...prev.slice(-10), data.text!]);
        if (loginStep !== "has-url") setLoginStep("waiting-url");
      }
      if (data.type === "url" && data.url) {
        setLoginUrl(data.url);
        setLoginStep("has-url");
      }
      if (data.type === "done") {
        setLoginStep("done");
        setStatus("logged-in");
        es.close();
      }
      if (data.type === "error") {
        setLoginStep("error");
        setLoginError(data.message ?? t("claudeLoginError"));
        es.close();
      }
    };

    es.onerror = () => {
      if (loginStep !== "done") {
        setLoginStep("error");
        setLoginError(t("claudeLoginConnectionFailed"));
      }
      es.close();
    };
  };

  const cancelLogin = () => {
    esRef.current?.close();
    setLoginStep("idle");
    setLoginUrl(null);
    setLoginError(null);
    setLogs([]);
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
                    <p className="text-sm text-muted-foreground">{t("claudeOpenUrlDesc")}</p>
                    <a
                      href={loginUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {t("claudeOpenLoginPage")}
                    </a>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                      <span>{t("claudeWaitingLogin")}</span>
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
                  <div className="space-y-2">
                    <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                      {loginError}
                    </p>
                    <Button onClick={startLogin} variant="outline" size="sm">
                      {t("claudeRetryLogin")}
                    </Button>
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
