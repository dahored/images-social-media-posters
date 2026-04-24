"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Building2, User, Pencil, Trash2, Check, X } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { Brand } from "@/types/brand";
import type { Account } from "@/types/account";

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmState, setConfirmState] = useState<{
    open: boolean; title: string; description: string; onConfirm: () => void;
  }>({ open: false, title: "", description: "", onConfirm: () => {} });

  const load = () => {
    Promise.all([
      fetch("/api/brands").then((r) => r.json()),
      fetch("/api/accounts").then((r) => r.json()),
    ]).then(([bd, ad]) => {
      setBrands(bd.brands || []);
      setAccounts(ad.accounts || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await fetch("/api/brands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    setShowAddForm(false);
    setNewName("");
    load();
  };

  const saveEdit = async (id: string) => {
    await fetch(`/api/brands/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });
    setEditingId(null);
    load();
  };

  const handleDelete = (brand: Brand) => {
    const brandAccountCount = accounts.filter((a) => a.brandId === brand.id).length;
    setConfirmState({
      open: true,
      title: `Delete "${brand.name}"?`,
      description: brandAccountCount > 0
        ? `This brand has ${brandAccountCount} account(s). Deleting the brand won't delete the accounts — you can reassign them later.`
        : "This action cannot be undone.",
      onConfirm: async () => {
        await fetch(`/api/brands/${brand.id}`, { method: "DELETE" });
        load();
      },
    });
  };

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
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-xl font-bold">Brands</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Manage your brands and their accounts</p>
            </div>
            <div className="ml-auto">
              <Button onClick={() => setShowAddForm(true)} variant="accent" size="sm">
                <Plus className="h-4 w-4" />
                New Brand
              </Button>
            </div>
          </div>

          {showAddForm && (
            <div className="mb-6 p-4 rounded-xl border border-accent/40 bg-accent/5 flex gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Brand name..."
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                className="flex-1"
              />
              <Button onClick={handleAdd} variant="accent" size="sm" disabled={!newName.trim()}>
                <Check className="h-3.5 w-3.5" />
                Create
              </Button>
              <Button onClick={() => setShowAddForm(false)} variant="outline" size="sm">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : brands.length === 0 ? (
            <div className="text-center py-16">
              <Building2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No brands yet. Create your first brand.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {brands.map((brand) => {
                const brandAccounts = accounts.filter((a) => a.brandId === brand.id);
                return (
                  <div key={brand.id} className="rounded-xl border border-border bg-surface p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                        <Building2 className="h-5 w-5 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {editingId === brand.id ? (
                          <div className="flex gap-2">
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="h-8 text-sm"
                              autoFocus
                              onKeyDown={(e) => { if (e.key === "Enter") saveEdit(brand.id); }}
                            />
                            <Button onClick={() => saveEdit(brand.id)} variant="accent" size="sm">
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button onClick={() => setEditingId(null)} variant="outline" size="sm">
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <Link href={`/brands/${brand.id}`} className="font-semibold text-sm hover:text-accent transition-colors">
                              {brand.name}
                            </Link>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-[10px]">
                                <User className="h-2.5 w-2.5 mr-1" />
                                {brandAccounts.length} account{brandAccounts.length !== 1 ? "s" : ""}
                              </Badge>
                              {brand.styleKeywords.slice(0, 2).map((k) => (
                                <Badge key={k} variant="secondary" className="text-[10px]">{k}</Badge>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                      {editingId !== brand.id && (
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => { setEditingId(brand.id); setEditName(brand.name); }}
                            className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => handleDelete(brand)}
                            className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-muted"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
