import { readDataSafe, writeData } from "./data";
import { generateId, now } from "./utils";
import type { Brand, BrandsData, BrandColors, BrandFonts } from "@/types/brand";

const FILE = "brands.json";

const DEFAULT_COLORS: BrandColors = {
  primary: "#1a1a2e",
  secondary: "#16213e",
  accent: "#e94560",
  background: "#ffffff",
  surface: "#f5f5f5",
};

const DEFAULT_FONTS: BrandFonts = {
  heading: "Inter",
  body: "Inter",
};

async function load(): Promise<BrandsData> {
  return readDataSafe<BrandsData>(FILE, { brands: [] });
}

async function save(data: BrandsData): Promise<void> {
  await writeData(FILE, data);
}

export async function listBrands(): Promise<Brand[]> {
  const data = await load();
  return data.brands;
}

export async function getBrand(id: string): Promise<Brand | null> {
  const data = await load();
  return data.brands.find((b) => b.id === id) ?? null;
}

export async function createBrand(
  input: Partial<Omit<Brand, "id" | "createdAt" | "updatedAt">> & { name: string }
): Promise<Brand> {
  const data = await load();
  const brand: Brand = {
    id: generateId(),
    name: input.name,
    colors: input.colors ?? { ...DEFAULT_COLORS },
    fonts: input.fonts ?? { ...DEFAULT_FONTS },
    logoPath: input.logoPath ?? null,
    styleKeywords: input.styleKeywords ?? [],
    createdAt: now(),
    updatedAt: now(),
  };
  data.brands.push(brand);
  await save(data);
  return brand;
}

export async function updateBrand(
  id: string,
  updates: Partial<Omit<Brand, "id" | "createdAt" | "updatedAt">>
): Promise<Brand | null> {
  const data = await load();
  const idx = data.brands.findIndex((b) => b.id === id);
  if (idx === -1) return null;
  const brand = data.brands[idx];
  Object.assign(brand, {
    ...updates,
    colors: updates.colors ? { ...brand.colors, ...updates.colors } : brand.colors,
    fonts: updates.fonts ? { ...brand.fonts, ...updates.fonts } : brand.fonts,
    updatedAt: now(),
  });
  await save(data);
  return brand;
}

export async function deleteBrand(id: string): Promise<boolean> {
  const data = await load();
  const idx = data.brands.findIndex((b) => b.id === id);
  if (idx === -1) return false;
  data.brands.splice(idx, 1);
  await save(data);
  return true;
}
