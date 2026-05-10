"use client";

import { useState, useEffect } from "react";
import type { EffectiveBranding } from "@/types/account";

/**
 * Fetches and caches the effective branding for the active account.
 * Re-fetches automatically when the active account changes.
 */
export function useBranding(): EffectiveBranding | null {
  const [branding, setBranding] = useState<EffectiveBranding | null>(null);

  useEffect(() => {
    const fetchBranding = () => {
      const accountId = localStorage.getItem("activeAccountId");
      if (!accountId) { setBranding(null); return; }
      fetch(`/api/accounts/${accountId}`)
        .then((r) => r.json())
        .then((data) => setBranding(data?.effectiveBranding ?? null))
        .catch(() => setBranding(null));
    };
    fetchBranding();
    window.addEventListener("account-changed", fetchBranding);
    return () => window.removeEventListener("account-changed", fetchBranding);
  }, []);

  return branding;
}
