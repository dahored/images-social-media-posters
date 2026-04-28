"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Building2, User, Settings, ArrowLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
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
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setActiveAccountId(stored);
  }, []);

  const loadBrands = () => {
    Promise.all([
      fetch("/api/brands").then((r) => r.json()),
      fetch("/api/accounts").then((r) => r.json()),
    ]).then(([bd, ad]) => {
      setBrands(bd.brands || []);
      setAccounts(ad.accounts || []);
    }).catch(() => {});
  };

  useEffect(() => { loadBrands(); }, []);

  // Initialize selectedBrandId once — do NOT include selectedBrandId in deps
  // to avoid overriding the user's manual brand selection
  useEffect(() => {
    if (accounts.length === 0 && brands.length === 0) return;
    if (activeAccountId) {
      const account = accounts.find((a) => a.id === activeAccountId);
      if (account) { setSelectedBrandId(account.brandId); return; }
    }
    if (brands.length > 0) setSelectedBrandId((prev) => prev ?? brands[0].id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAccountId, accounts, brands]);

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
  const selectedBrand = brands.find((b) => b.id === selectedBrandId);
  const brandAccounts = accounts.filter((a) => a.brandId === selectedBrandId);

  const openDropdown = () => {
    if (activeAccountId && activeAccount) {
      setSelectedBrandId(activeAccount.brandId);
      setStep(2);
    } else {
      setStep(1);
    }
    setOpen(true);
  };

  const selectBrand = (brandId: string) => {
    setSelectedBrandId(brandId);
    setStep(2);
  };

  const selectAccount = (accountId: string) => {
    localStorage.setItem(STORAGE_KEY, accountId);
    setActiveAccountId(accountId);
    onAccountChange?.(accountId);
    window.dispatchEvent(new CustomEvent("account-changed", { detail: accountId }));
    setOpen(false);
    router.push("/");
  };

  if (brands.length === 0) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={openDropdown}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm hover:bg-muted transition-colors border border-border cursor-pointer"
      >
        <User className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium max-w-28 truncate">
          {activeAccount ? activeAccount.displayName : t("selectAccount")}
        </span>
        {activeBrand && (
          <span className="text-xs text-muted-foreground hidden sm:inline">
            · {activeBrand.name}
          </span>
        )}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 w-56 rounded-xl border border-border bg-surface shadow-xl z-50 overflow-hidden">

          {/* Step 1: brands */}
          {step === 1 && (
            <>
              <div className="px-3 pt-2.5 pb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("brands")}
                </span>
              </div>
              <div className="max-h-60 overflow-y-auto">
                {brands.map((brand) => (
                  <div key={brand.id} className="flex items-center group hover:bg-muted transition-colors">
                    <button
                      onClick={() => selectBrand(brand.id)}
                      className="flex-1 flex items-center gap-2 px-3 py-2 text-left text-sm text-foreground cursor-pointer"
                    >
                      <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{brand.name}</span>
                    </button>
                    <button
                      onClick={() => { setOpen(false); router.push(`/brands/${brand.id}/edit`); }}
                      title={t("editBrandTooltip")}
                      className="pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <Settings className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="border-t border-border p-2">
                <a
                  href="/brands/new"
                  onClick={() => setOpen(false)}
                  className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  {t("newBrandBtn")}
                </a>
              </div>
            </>
          )}

          {/* Step 2: accounts */}
          {step === 2 && (
            <>
              <div className="flex items-center gap-1 px-2 pt-2 pb-1">
                <button
                  onClick={() => setStep(1)}
                  className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  aria-label={t("backToBrandsAriaLabel")}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
                <span className="text-xs font-semibold truncate text-foreground">
                  {selectedBrand?.name}
                </span>
              </div>

              {brandAccounts.length === 0 ? (
                <div className="px-3 py-4 text-center">
                  <p className="text-xs text-muted-foreground mb-2">{t("noAccountsSelector")}</p>
                  <a
                    href={`/brands/${selectedBrandId}?new=1`}
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-accent text-accent-foreground hover:bg-accent/90 transition-colors cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    {t("newAccount")}
                  </a>
                </div>
              ) : (
                <>
                  <div className="px-3 pb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("accounts")}
                    </span>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {brandAccounts.map((account) => (
                      <div
                        key={account.id}
                        className={`flex items-center group transition-colors ${
                          activeAccountId === account.id ? "bg-accent/10" : "hover:bg-muted"
                        }`}
                      >
                        <button
                          onClick={() => selectAccount(account.id)}
                          className={`flex-1 flex items-center gap-2 px-3 py-2 text-left text-sm cursor-pointer ${
                            activeAccountId === account.id ? "text-accent font-medium" : "text-foreground"
                          }`}
                        >
                          <div className={`h-2 w-2 rounded-full shrink-0 ${
                            activeAccountId === account.id ? "bg-accent" : "bg-border"
                          }`} />
                          <div className="min-w-0">
                            <div className="truncate">{account.displayName}</div>
                            <div className="text-[10px] text-muted-foreground truncate">
                              {account.handle} · {account.networkId}
                            </div>
                          </div>
                        </button>
                        <a
                          href={`/accounts/${account.id}`}
                          title={t("accountSettingsTooltip")}
                          onClick={() => setOpen(false)}
                          className="pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          <Settings className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                        </a>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-border p-2">
                    <a
                      href={`/brands/${selectedBrandId}`}
                      onClick={() => setOpen(false)}
                      className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                      {t("newAccountBtn")}
                    </a>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
