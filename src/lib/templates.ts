import { readDataSafe, writeData } from "./data";
import { generateId, now } from "./utils";
import { extractSlots, fillSlots } from "./slot-extractor";
import { detectSlideRootBackground } from "./slide-html";
import type { SlotRole } from "@/types/slot";
import type { Template, TemplatesData } from "@/types/template";
import type { Carousel, CarouselBrandingOverride } from "@/types/carousel";

const FILE = "templates.json";

async function load(): Promise<TemplatesData> {
  return readDataSafe<TemplatesData>(FILE, { templates: [] });
}

async function save(data: TemplatesData): Promise<void> {
  await writeData(FILE, data);
}

export async function listTemplates(filter?: { accountId?: string }): Promise<Template[]> {
  const data = await load();
  if (!filter?.accountId) return data.templates;
  return data.templates.filter((t) => !t.accountId || t.accountId === filter.accountId);
}

export async function getTemplate(id: string): Promise<Template | null> {
  const data = await load();
  return data.templates.find((t) => t.id === id) ?? null;
}

function hexBrightness(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Derive a minimal brandingOverride with theme from the carousel, or detect from HTML. */
function buildBrandingOverride(carousel: Carousel): { brandingOverride?: CarouselBrandingOverride } {
  if (carousel.brandingOverride) return { brandingOverride: carousel.brandingOverride };
  const firstHtml = carousel.slides[0]?.html;
  const bg = firstHtml ? detectSlideRootBackground(firstHtml) : null;
  const theme: "light" | "dark" = bg && hexBrightness(bg) > 128 ? "light" : "dark";
  return { brandingOverride: { theme } };
}

export async function saveAsTemplate(
  carousel: Carousel,
  name?: string,
  description?: string
): Promise<Template> {
  const data = await load();
  const cleanName = stripFromTemplateSuffix(name || carousel.name);
  const template: Template = {
    id: generateId(),
    name: cleanName,
    description: description || `Template from ${cleanName}`,
    aspectRatio: carousel.aspectRatio,
    kind: carousel.kind ?? (carousel.slides.length === 1 ? "post" : "carousel"),
    slides: carousel.slides.map(({ id, html, order, notes, styleOverride }) => ({
      id,
      html: anonymizeSlideHtml(html),
      order,
      notes,
      ...(styleOverride ? { styleOverride } : {}),
    })),
    tags: carousel.tags,
    scope: carousel.accountId ? "account" : undefined,
    accountId: carousel.accountId,
    ...(buildBrandingOverride(carousel)),
    createdAt: now(),
    updatedAt: now(),
  };
  data.templates.push(template);
  await save(data);
  return template;
}

/** Strip the "(from template)" suffix added at template-use time. */
function stripFromTemplateSuffix(name: string): string {
  return name.replace(/\s*\(from template\)\s*$/i, "").trim() || name;
}

// Full Lorem Ipsum corpus — long enough to generate any slot length
const LOREM_WORDS = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim est laborum".split(" ");

// Minimum word counts per role so the layout never looks too empty
const ROLE_MIN_WORDS: Record<SlotRole, number> = {
  "title":         3,
  "subtitle":      3,
  "body":          8,
  "quote":         5,
  "list-item":     2,
  "section-title": 2,
  "section-body":  6,
  "cta":           2,
};

/**
 * Generate Lorem Ipsum text that matches the approximate character length of the
 * original slot text. Wraps a portion in {{accent}} markers at the same proportional
 * position as the original accent span, so the template preview looks structurally
 * faithful — not just "accent always at the end".
 */
function loremForSlot(slot: { role: SlotRole; text: string; hasAccent: boolean; accentText?: string }): string {
  const minWords = ROLE_MIN_WORDS[slot.role] ?? 2;
  const targetChars = Math.max(slot.text.length, minWords * 5);

  // Build Lorem Ipsum until we hit the target char count
  const words: string[] = [];
  let len = 0;
  let i = 0;
  while (len < targetChars || words.length < minWords) {
    const w = LOREM_WORDS[i % LOREM_WORDS.length];
    words.push(w);
    len += w.length + 1;
    i++;
    if (i > 200) break; // safety
  }

  if (!slot.hasAccent || words.length < 3) {
    const result = words.join(" ");
    return result.charAt(0).toUpperCase() + result.slice(1);
  }

  // Calculate the accent's proportional position in the original text so the
  // Lorem Ipsum accent lands at the same relative point, not always at the end.
  let accentStartRatio = 0.65; // fallback: 65% through
  let accentLengthRatio = 0.2;  // fallback: 20% of total

  if (slot.accentText && slot.text.length > 0) {
    const idx = slot.text.indexOf(slot.accentText);
    if (idx >= 0) {
      accentStartRatio = idx / slot.text.length;
      accentLengthRatio = slot.accentText.length / slot.text.length;
    }
  }

  // Map ratios to word indices, clamping to valid ranges
  const accentStartWord = Math.max(1, Math.floor(accentStartRatio * words.length));
  const accentWordCount = Math.max(1, Math.round(accentLengthRatio * words.length));
  const accentEndWord = Math.min(words.length - 1, accentStartWord + accentWordCount);

  const before  = words.slice(0, accentStartWord).join(" ");
  const accented = words.slice(accentStartWord, accentEndWord).join(" ");
  const after   = words.slice(accentEndWord).join(" ");

  let result = before.charAt(0).toUpperCase() + before.slice(1);
  result += ` {{accent}}${accented}{{/accent}}`;
  if (after) result += ` ${after}`;
  return result;
}

/**
 * Replace each slot's text with Lorem Ipsum of similar length.
 * Preserves all visual styles, colors, fonts, layout, and accent spans —
 * only the topic-specific text changes. This makes templates look like
 * realistic structural previews rather than labeled placeholders.
 */
function anonymizeSlideHtml(html: string): string {
  const { slots } = extractSlots(html);
  if (slots.length === 0) return html;
  const fills: Record<string, string> = {};
  for (const slot of slots) {
    fills[slot.id] = loremForSlot(slot);
  }
  return fillSlots(html, fills);
}

/**
 * Replace the slides/aspectRatio/kind/tags of an existing template with the carousel's
 * current state. Keeps id, name, scope, accountId, createdAt unchanged.
 */
export async function updateTemplateFromCarousel(
  templateId: string,
  carousel: Carousel
): Promise<Template | null> {
  const data = await load();
  const idx = data.templates.findIndex((t) => t.id === templateId);
  if (idx === -1) return null;
  const existing = data.templates[idx];
  data.templates[idx] = {
    ...existing,
    aspectRatio: carousel.aspectRatio,
    kind: carousel.kind ?? (carousel.slides.length === 1 ? "post" : "carousel"),
    slides: carousel.slides.map(({ id, html, order, notes, styleOverride }) => ({
      id, html: anonymizeSlideHtml(html), order, notes,
      ...(styleOverride ? { styleOverride } : {}),
    })),
    tags: carousel.tags,
    ...buildBrandingOverride(carousel),
    updatedAt: now(),
  };
  await save(data);
  return data.templates[idx];
}

export async function deleteTemplate(id: string): Promise<boolean> {
  const data = await load();
  const idx = data.templates.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  data.templates.splice(idx, 1);
  await save(data);
  return true;
}
