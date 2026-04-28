export interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
}

export interface BrandFonts {
  heading: string;
  body: string;
}

export interface CustomFont {
  name: string;
  path: string;
}

export type LogoPosition = "bottom-left" | "bottom-center" | "bottom-right";

export interface BrandConfig {
  name: string;
  colors: BrandColors;
  colorsLight?: BrandColors;
  fonts: BrandFonts;
  customFonts: CustomFont[];
  logoPath: string | null;
  logoPathDark?: string | null;
  logoPathLight?: string | null;
  logoPosition?: LogoPosition;
  logoHeight?: number;
  styleKeywords: string[];
  createdAt: string;
  updatedAt: string;
}

// Multi-brand entity (used in Fase 3+)
export interface Brand {
  id: string;
  name: string;
  colors: BrandColors;
  colorsLight?: BrandColors;
  fonts: BrandFonts;
  logoPath: string | null;
  logoPathDark?: string | null;
  logoPathLight?: string | null;
  logoPosition?: LogoPosition;
  logoHeight?: number;
  styleKeywords: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BrandsData {
  brands: Brand[];
}

export const DEFAULT_BRAND: BrandConfig = {
  name: "",
  colors: {
    primary: "#1a1a2e",
    secondary: "#16213e",
    accent: "#7f22fe",
    background: "#ffffff",
    surface: "#f5f5f5",
  },
  fonts: {
    heading: "Inter",
    body: "Inter",
  },
  customFonts: [],
  logoPath: null,
  styleKeywords: [],
  createdAt: "",
  updatedAt: "",
};
