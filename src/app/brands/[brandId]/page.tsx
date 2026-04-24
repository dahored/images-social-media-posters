"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, User, Copy, Trash2 } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { Brand } from "@/types/brand";
import type { Account } from "@/types/account";
import type { Network } from "@/types/network";

interface PageProps { params: Promise<{ brandId: string }> }

export default function BrandDetailPage({ params }: PageProps) {
  const { brandId } = use(params);
  const router = useRouter();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountHandle, setNewAccountHandle] = useState("");
  const [newAccountNetwork, setNewAccountNetwork] = useState("instagram");
  const [confirmState, setConfirmState] = useState<{
    open: boolean; title: string; description: string; onConfirm: () => void;
  }>({ open: false, title: "", description: "", onConfirm: () => {} });

  const load = () => {
    Promise.all([
      fetch(`/api/brands/${brandId}`).then((r) => r.json()),
      fetch(`/api/accounts?brandId=${brandId}`).then((r) => r.json()),
      fetch("/api/networks").then((r) => r.json()),
    ]).then(([bd, ad, nd]) => {
      if (bd.error) { router.push("/brands"); return; }
      setBrand(bd);
      setAccounts(ad.accounts || []);
      setNetworks(nd.networks || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [brandId]);

  const handleAddAccount = async () => {
    if (!newAccountName.trim()) return;
    await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandId,
        networkId: newAccountNetwork,
        displayName: newAccountName.trim(),
        handle: newAccountHandle.trim(),
      }),
    });
    setShowAddAccount(false);
    setNewAccountName("");
    setNewAccountHandle("");
    load();
  };

  const handleDeleteAccount = (account: Account) => {
    setConfirmState({
      open: true,
      title: `Delete account "${account.displayName}"?`,
      description: "This won't delete the posts/carousels associated with this account.",
      onConfirm: async () => {
        await fetch(`/api/accounts/${account.id}`, { method: "DELETE" });
        load();
      },
    });
  };

  const handleDuplicate = async (accountId: string) => {
    await fetch(`/api/accounts/${accountId}?action=duplicate`, { method: "POST" });
    load();
  };

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

  if (!brand) return null;

  return (
    <div className="h-full flex flex-col">
      <TopBar />
      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={(open) => setConfirmState((s) => ({ ...s, open }))}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={confirmState.onConfirm}
      />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-6">
            <Link href="/brands" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-xl font-bold">{brand.name}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {accounts.length} account{accounts.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="ml-auto">
              <Button onClick={() => setShowAddAccount(true)} variant="accent" size="sm">
                <Plus className="h-4 w-4" />
                New Account
              </Button>
            </div>
          </div>

          {showAddAccount && (
            <div className="mb-6 p-4 rounded-xl border border-accent/40 bg-accent/5 space-y-3">
              <h3 className="text-sm font-semibold">New account in {brand.name}</h3>
              <Input
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                placeholder="Account display name"
                autoFocus
              />
              <Input
                value={newAccountHandle}
                onChange={(e) => setNewAccountHandle(e.target.value)}
                placeholder="@handle (optional)"
              />
              <div className="flex flex-wrap gap-1.5">
                {networks.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => setNewAccountNetwork(n.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                      newAccountNetwork === n.id
                        ? "bg-foreground text-background border-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {n.name}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddAccount} variant="accent" size="sm" disabled={!newAccountName.trim()}>
                  Create Account
                </Button>
                <Button onClick={() => setShowAddAccount(false)} variant="outline" size="sm">Cancel</Button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {accounts.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border rounded-xl">
                <User className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No accounts yet.</p>
              </div>
            ) : (
              accounts.map((account) => {
                const network = networks.find((n) => n.id === account.networkId);
                return (
                  <div key={account.id} className="rounded-xl border border-border bg-surface p-4 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/accounts/${account.id}`}
                        className="font-semibold text-sm hover:text-accent transition-colors"
                      >
                        {account.displayName}
                      </Link>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {account.handle || "no handle"} · {network?.name || account.networkId}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => handleDuplicate(account.id)}
                        className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
                        title="Duplicate account"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteAccount(account)}
                        className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-muted"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
