"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, History } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/context";
import type { Account } from "@/types/account";
import type { Network } from "@/types/network";

interface PageProps { params: Promise<{ accountId: string }> }

export default function AccountSettingsPage({ params }: PageProps) {
  const { accountId } = use(params);
  const router = useRouter();
  const { t } = useI18n();
  const [account, setAccount] = useState<Account | null>(null);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/accounts/${accountId}`).then((r) => r.json()),
      fetch("/api/networks").then((r) => r.json()),
    ]).then(([ad, nd]) => {
      if (ad.error) { router.push("/brands"); return; }
      setAccount(ad);
      setDisplayName(ad.displayName || "");
      setHandle(ad.handle || "");
      setTelegramChatId(ad.telegramChatId || "");
      setNetworks(nd.networks || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [accountId, router]);

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch(`/api/accounts/${accountId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, handle, telegramChatId: telegramChatId || undefined }),
    });
    if (res.ok) {
      const updated = await res.json();
      setAccount(updated);
    }
    setSaving(false);
  };

  const network = networks.find((n) => n.id === account?.networkId);

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <TopBar />
        <div className="flex-1 flex items-center justify-center">
          <div className="h-8 w-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!account) return null;

  return (
    <div className="h-full flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-6">
            <Link href={`/brands/${account.brandId}`} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-xl font-bold">{account.displayName}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t("accountSettingsSubtitle", { network: network?.name || account.networkId })}
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t("accountDisplayNameLabel")}</label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t("accountDisplayName")}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t("accountHandleLabel")}</label>
              <Input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="@username"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t("accountNetworkLabel")}</label>
              <p className="text-sm px-3 py-2 rounded-lg bg-muted text-muted-foreground">
                {network?.name || account.networkId} <span className="text-xs">{t("accountNetworkReadonly")}</span>
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                {t("accountTelegramChatIdLabel")} <span className="text-[10px] opacity-60">{t("telegramOptionalHint")}</span>
              </label>
              <Input
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                placeholder="-1001234567890"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                {t("accountTelegramChatIdHelp")}
              </p>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <Button onClick={handleSave} variant="accent" size="sm" disabled={saving}>
                <Save className="h-3.5 w-3.5" />
                {saving ? t("accountSaving") : t("saveChanges")}
              </Button>
              <Link
                href={`/accounts/${accountId}/history`}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <History className="h-3.5 w-3.5" />
                {t("accountViewPublishHistory")}
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
