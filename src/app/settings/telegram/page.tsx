"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, Send } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function TelegramSettingsPage() {
  const [botToken, setBotToken] = useState("");
  const [defaultChatId, setDefaultChatId] = useState("");
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; username?: string; error?: string } | null>(null);

  useEffect(() => {
    fetch("/api/telegram")
      .then((r) => r.json())
      .then((d) => {
        setConfigured(d.configured || false);
        setDefaultChatId(d.defaultChatId || "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await fetch("/api/telegram", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ botToken: botToken || undefined, defaultChatId }),
    });
    setConfigured(!!botToken);
    setSaving(false);
  };

  const handleTest = async () => {
    if (!botToken) return;
    setTesting(true);
    setTestResult(null);
    const res = await fetch("/api/telegram?action=test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ botToken }),
    });
    const data = await res.json();
    setTestResult(data);
    setTesting(false);
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
              <h1 className="text-xl font-bold">Telegram</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Publish posts directly to Telegram</p>
            </div>
            {configured && (
              <Badge className="ml-auto" variant="secondary">Connected</Badge>
            )}
          </div>

          {loading ? (
            <div className="h-32 flex items-center justify-center">
              <div className="h-6 w-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-muted/50 border border-border text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">How to get a bot token</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Open Telegram and search for <span className="font-mono">@BotFather</span></li>
                  <li>Send <span className="font-mono">/newbot</span> and follow the steps</li>
                  <li>Copy the token BotFather gives you and paste it below</li>
                  <li>Add the bot to your channel/group as admin</li>
                </ol>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Bot Token
                </label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    placeholder="123456789:ABCDEFabcdef..."
                    className="flex-1 font-mono text-xs"
                  />
                  <Button
                    onClick={handleTest}
                    variant="outline"
                    size="sm"
                    disabled={!botToken || testing}
                  >
                    {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Test
                  </Button>
                </div>
                {testResult && (
                  <p className={`text-xs mt-1.5 ${testResult.ok ? "text-green-600" : "text-destructive"}`}>
                    {testResult.ok
                      ? `Connected as @${testResult.username}`
                      : `Error: ${testResult.error}`}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Default Chat ID <span className="text-[10px] opacity-60">(optional)</span>
                </label>
                <Input
                  value={defaultChatId}
                  onChange={(e) => setDefaultChatId(e.target.value)}
                  placeholder="-1001234567890"
                  className="font-mono text-xs"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Used when the account has no specific chat ID set. Find your channel ID with @userinfobot.
                </p>
              </div>

              <Button onClick={handleSave} variant="accent" size="sm" disabled={saving}>
                <Check className="h-3.5 w-3.5" />
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
