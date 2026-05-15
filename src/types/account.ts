import type { BrandColors, BrandFonts, LogoPosition } from "./brand";

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
  language?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountsData {
  accounts: Account[];
}

export interface EffectiveBranding {
  name: string;
  colors: BrandColors;
  colorsDark?: BrandColors;
  colorsLight?: BrandColors;
  fonts: BrandFonts;
  fontsDark?: BrandFonts;
  fontsLight?: BrandFonts;
  logoPath: string | null;
  logoPathDark?: string | null;
  logoPathLight?: string | null;
  logoPosition?: LogoPosition;
  logoHeight?: number;
  logoPositionDark?: LogoPosition;
  logoHeightDark?: number;
  logoPositionLight?: LogoPosition;
  logoHeightLight?: number;
  styleKeywords: string[];
}
