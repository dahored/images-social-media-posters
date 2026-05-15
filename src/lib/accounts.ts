import { readDataSafe, writeData } from "./data";
import { generateId, now } from "./utils";
import { getBrand } from "./brands";
import type { Account, AccountsData, EffectiveBranding, AccountBrandingOverride } from "@/types/account";

const FILE = "accounts.json";

async function load(): Promise<AccountsData> {
  return readDataSafe<AccountsData>(FILE, { accounts: [] });
}

async function save(data: AccountsData): Promise<void> {
  await writeData(FILE, data);
}

export async function listAccounts(brandId?: string): Promise<Account[]> {
  const data = await load();
  if (brandId) {
    return data.accounts.filter((a) => a.brandId === brandId);
  }
  return data.accounts;
}

export async function getAccount(id: string): Promise<Account | null> {
  const data = await load();
  return data.accounts.find((a) => a.id === id) ?? null;
}

export async function createAccount(
  input: Omit<Account, "id" | "createdAt" | "updatedAt">
): Promise<Account> {
  const data = await load();
  const account: Account = {
    ...input,
    id: generateId(),
    createdAt: now(),
    updatedAt: now(),
  };
  data.accounts.push(account);
  await save(data);
  return account;
}

export async function updateAccount(
  id: string,
  updates: Partial<Omit<Account, "id" | "brandId" | "networkId" | "createdAt" | "updatedAt">>
): Promise<Account | null> {
  const data = await load();
  const idx = data.accounts.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  Object.assign(data.accounts[idx], { ...updates, updatedAt: now() });
  await save(data);
  return data.accounts[idx];
}

export async function deleteAccount(id: string): Promise<boolean> {
  const data = await load();
  const idx = data.accounts.findIndex((a) => a.id === id);
  if (idx === -1) return false;
  data.accounts.splice(idx, 1);
  await save(data);
  return true;
}

export async function duplicateAccount(id: string): Promise<Account | null> {
  const data = await load();
  const source = data.accounts.find((a) => a.id === id);
  if (!source) return null;
  const duplicate: Account = {
    ...source,
    id: generateId(),
    handle: `${source.handle}_copy`,
    displayName: `${source.displayName} (copy)`,
    createdAt: now(),
    updatedAt: now(),
  };
  data.accounts.push(duplicate);
  await save(data);
  return duplicate;
}

export async function getEffectiveBranding(accountId: string): Promise<EffectiveBranding | null> {
  const account = await getAccount(accountId);
  if (!account) return null;

  const brand = await getBrand(account.brandId);
  if (!brand) return null;

  const override: AccountBrandingOverride = account.brandingOverride ?? {};

  return {
    name: account.displayName || brand.name,
    colors: { ...brand.colors, ...override.colors },
    colorsDark: brand.colorsDark,
    colorsLight: brand.colorsLight,
    fonts: { ...brand.fonts, ...override.fonts },
    fontsDark: brand.fontsDark,
    fontsLight: brand.fontsLight,
    logoPath: override.logoPath !== undefined ? override.logoPath : brand.logoPath,
    logoPathDark: brand.logoPathDark,
    logoPathLight: brand.logoPathLight,
    logoPosition: brand.logoPosition,
    logoHeight: brand.logoHeight,
    logoPositionDark: brand.logoPositionDark,
    logoHeightDark: brand.logoHeightDark,
    logoPositionLight: brand.logoPositionLight,
    logoHeightLight: brand.logoHeightLight,
    styleKeywords: override.styleKeywords ?? brand.styleKeywords,
  };
}
