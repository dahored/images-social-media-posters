"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Plus, Building2, User } from "lucide-react";
import type { Brand } from "@/types/brand";
import type { Account } from "@/types/account";

const STORAGE_KEY = "activeAccountId";

export function useActiveAccount() {
  const [activeAccountId, setActiveAccountIdState] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setActiveAccountIdState(stored);
  }, []);

  const setActiveAccountId = (id: string | null) => {
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    setActiveAccountIdState(id);
  };

  return { activeAccountId, setActiveAccountId };
}

interface AccountSelectorProps {
  onAccountChange?: (accountId: string | null) => void;
}

export function AccountSelector({ onAccountChange }: AccountSelectorProps) {
  const [open, setOpen] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setActiveAccountId(stored);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/brands").then((r) => r.json()),
      fetch("/api/accounts").then((r) => r.json()),
    ]).then(([bd, ad]) => {
      const b: Brand[] = bd.brands || [];
      const a: Account[] = ad.accounts || [];
      setBrands(b);
      setAccounts(a);
      if (!selectedBrandId && b.length > 0) {
        setSelectedBrandId(b[0].id);
      }
    }).catch(() => {});
  }, [selectedBrandId]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const activeAccount = accounts.find((a) => a.id === activeAccountId);
  const activeBrand = brands.find((b) => b.id === activeAccount?.brandId);

  const selectAccount = (accountId: string) => {
    localStorage.setItem(STORAGE_KEY, accountId);
    setActiveAccountId(accountId);
    onAccountChange?.(accountId);
    setOpen(false);
  };

  const brandAccounts = accounts.filter((a) => a.brandId === selectedBrandId);

  if (brands.length === 0) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm hover:bg-muted transition-colors border border-border"
      >
        <User className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium max-w-[120px] truncate">
          {activeAccount ? activeAccount.displayName : "Select account"}
        </span>
        {activeBrand && (
          <span className="text-xs text-muted-foreground hidden sm:inline">
            · {activeBrand.name}
          </span>
        )}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 rounded-xl border border-border bg-surface shadow-xl z-50 overflow-hidden">
          <div className="flex divide-x divide-border h-56">
            {/* Brands column */}
            <div className="w-1/2 overflow-y-auto">
              <div className="px-3 pt-2 pb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Brands
                </span>
              </div>
              {brands.map((brand) => (
                <button
                  key={brand.id}
                  onClick={() => setSelectedBrandId(brand.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                    selectedBrandId === brand.id
                      ? "bg-accent/10 text-accent"
                      : "hover:bg-muted text-foreground"
                  }`}
                >
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{brand.name}</span>
                </button>
              ))}
            </div>

            {/* Accounts column */}
            <div className="w-1/2 overflow-y-auto">
              <div className="px-3 pt-2 pb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Accounts
                </span>
              </div>
              {brandAccounts.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">No accounts yet</p>
              ) : (
                brandAccounts.map((account) => (
                  <button
                    key={account.id}
                    onClick={() => selectAccount(account.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                      activeAccountId === account.id
                        ? "bg-accent/10 text-accent font-medium"
                        : "hover:bg-muted text-foreground"
                    }`}
                  >
                    <User className="h-3.5 w-3.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="truncate">{account.displayName}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {account.handle} · {account.networkId}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Footer actions */}
          <div className="border-t border-border p-2 flex gap-1">
            <a
              href="/brands"
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Plus className="h-3 w-3" />
              New brand
            </a>
            {selectedBrandId && (
              <a
                href="/brands/new-account"
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-mused transition-colors"
              >
                <Plus className="h-3 w-3" />
                New account
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
