#!/usr/bin/env node
/**
 * Idempotent migration: single brand.json → brands.json + accounts.json
 * Safe to run multiple times — skips if already migrated.
 */
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../data");

function generateId() {
  return randomBytes(8).toString("hex");
}

function now() {
  return new Date().toISOString();
}

async function readJsonSafe(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf-8"));
  } catch {
    return fallback;
  }
}

async function writeJson(file, data) {
  const tmp = file + ".tmp";
  await writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
  await import("fs/promises").then(({ rename }) => rename(tmp, file));
}

async function run() {
  await mkdir(DATA_DIR, { recursive: true });

  const brandsFile = path.join(DATA_DIR, "brands.json");
  const accountsFile = path.join(DATA_DIR, "accounts.json");
  const brandFile = path.join(DATA_DIR, "brand.json");

  const existingBrands = await readJsonSafe(brandsFile, { brands: [] });
  const existingAccounts = await readJsonSafe(accountsFile, { accounts: [] });

  // Already migrated — skip
  if (existingBrands.brands.length > 0 || existingAccounts.accounts.length > 0) {
    console.log("✓ Already migrated. Skipping.");
    console.log(`  Brands: ${existingBrands.brands.length}`);
    console.log(`  Accounts: ${existingAccounts.accounts.length}`);
    return;
  }

  // Read old brand.json
  const oldBrand = await readJsonSafe(brandFile, null);

  const ts = now();
  const brandId = generateId();
  const accountId = generateId();

  const brand = {
    id: brandId,
    name: oldBrand?.name || "Default Brand",
    colors: oldBrand?.colors || {
      primary: "#1a1a2e",
      secondary: "#16213e",
      accent: "#e94560",
      background: "#ffffff",
      surface: "#f5f5f5",
    },
    fonts: oldBrand?.fonts || { heading: "Inter", body: "Inter" },
    logoPath: oldBrand?.logoPath || null,
    styleKeywords: oldBrand?.styleKeywords || [],
    createdAt: oldBrand?.createdAt || ts,
    updatedAt: ts,
  };

  const account = {
    id: accountId,
    brandId,
    networkId: "instagram",
    handle: oldBrand?.name ? `@${oldBrand.name.toLowerCase().replace(/\s+/g, "")}` : "@default",
    displayName: oldBrand?.name || "Default Account",
    createdAt: ts,
    updatedAt: ts,
  };

  await writeJson(brandsFile, { brands: [brand] });
  await writeJson(accountsFile, { accounts: [account] });

  console.log("✓ Migration complete!");
  console.log(`  Brand created: "${brand.name}" (id: ${brandId})`);
  console.log(`  Account created: "${account.displayName}" on Instagram (id: ${accountId})`);
  console.log(`  Original brand.json preserved at data/brand.json (still used by legacy UI)`);
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
