import type { BrandColors, BrandFonts } from "./brand";

export interface AccountBrandingOverride {
  colors?: Partial<BrandColors>;
  fonts?: Partial<BrandFonts>;
  logoPath?: string | null;
  styleKeywords?: string[];
}

export interface Account {
  id: string;
  brandId: string;
  networkId: string;
  handle: string;
  displayName: string;
  brandingOverride?: AccountBrandingOverride;
  telegramChatId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountsData {
  accounts: Account[];
}

export interface EffectiveBranding {
  name: string;
  colors: BrandColors;
  fonts: BrandFonts;
  logoPath: string | null;
  styleKeywords: string[];
}
