"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Pencil, Trash2, Globe, Check, X } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/lib/i18n/context";
import type { Network } from "@/types/network";

export default function NetworksSettingsPage() {
  const { t } = useI18n();
  const [networks, setNetworks] = useState<Network[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editHint, setEditHint] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newHint, setNewHint] = useState("");
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: "", description: "", onConfirm: () => {} });

  const load = () => {
    fetch("/api/networks")
      .then((r) => r.json())
      .then((d) => {
        setNetworks(d.networks || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const startEdit = (network: Network) => {
    setEditingId(network.id);
    setEditHint(network.defaultStyleHint);
  };

  const saveEdit = async (id: string) => {
    await fetch(`/api/networks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultStyleHint: editHint }),
    });
    setEditingId(null);
    load();
  };

  const handleDelete = (network: Network) => {
    setConfirmState({
      open: true,
      title: t("networkDeleteTitle", { name: network.name }),
      description: t("networkDeleteDesc"),
      onConfirm: async () => {
        await fetch(`/api/networks/${network.id}`, { method: "DELETE" });
        load();
      },
    });
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await fetch("/api/networks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), defaultStyleHint: newHint }),
    });
    setShowAddForm(false);
    setNewName("");
    setNewHint("");
    load();
  };

  return (
    <div className="h-full flex flex-col">
      <TopBar />
      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={(open) => setConfirmState((s) => ({ ...s, open }))}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel={t("delete")}
        variant="destructive"
        onConfirm={confirmState.onConfirm}
      />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-6">
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-xl font-bold">{t("networkCatalogTitle")}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t("networkCatalogSubtitle")}
              </p>
            </div>
            <div className="ml-auto">
              <Button onClick={() => setShowAddForm(true)} variant="accent" size="sm">
                <Plus className="h-4 w-4" />
                {t("addNetwork")}
              </Button>
            </div>
          </div>

          {showAddForm && (
            <div className="mb-6 p-4 rounded-xl border border-accent/40 bg-accent/5 space-y-3">
              <h3 className="text-sm font-semibold">{t("newCustomNetwork")}</h3>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t("networkNamePlaceholder")}
                autoFocus
              />
              <Input
                value={newHint}
                onChange={(e) => setNewHint(e.target.value)}
                placeholder={t("networkStyleHintPlaceholder")}
              />
              <div className="flex gap-2">
                <Button onClick={handleAdd} variant="accent" size="sm" disabled={!newName.trim()}>
                  <Check className="h-3.5 w-3.5" />
                  {t("create")}
                </Button>
                <Button onClick={() => setShowAddForm(false)} variant="outline" size="sm">
                  <X className="h-3.5 w-3.5" />
                  {t("cancel")}
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {networks.map((network) => (
                <div
                  key={network.id}
                  className="rounded-xl border border-border bg-surface p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">{network.name}</span>
                        {network.builtin && (
                          <Badge variant="secondary" className="text-[10px]">{t("networkBuiltinBadge")}</Badge>
                        )}
                        <div className="flex gap-1 ml-auto">
                          {network.formats.map((f) => (
                            <Badge key={f.id} variant="secondary" className="text-[10px]">
                              {f.name}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {editingId === network.id ? (
                        <div className="flex gap-2 mt-2">
                          <Input
                            value={editHint}
                            onChange={(e) => setEditHint(e.target.value)}
                            className="text-xs h-8"
                            placeholder={t("networkStyleHintEditPlaceholder")}
                            autoFocus
                          />
                          <Button onClick={() => saveEdit(network.id)} variant="accent" size="sm">
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button onClick={() => setEditingId(null)} variant="outline" size="sm">
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {network.defaultStyleHint || t("networkNoStyleHint")}
                        </p>
                      )}
                    </div>

                    {editingId !== network.id && (
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => startEdit(network)}
                          className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
                          title={t("networkEditStyleHint")}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        {!network.builtin && (
                          <button
                            onClick={() => handleDelete(network)}
                            className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-muted"
                            title={t("networkDeleteNetwork")}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
