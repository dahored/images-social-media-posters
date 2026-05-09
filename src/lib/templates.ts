import { readDataSafe, writeData } from "./data";
import { generateId, now } from "./utils";
import { extractSlots, fillSlots } from "./slot-extractor";
import type { SlotRole } from "@/types/slot";
import type { Template, TemplatesData } from "@/types/template";
import type { Carousel } from "@/types/carousel";

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
    kind: carousel.kind,
    slides: carousel.slides.map(({ id, html, order, notes }) => ({
      id,
      html: anonymizeSlideHtml(html),
      order,
      notes,
    })),
    tags: carousel.tags,
    scope: carousel.accountId ? "account" : undefined,
    accountId: carousel.accountId,
    createdAt: now(),
  };
  data.templates.push(template);
  await save(data);
  return template;
}

/** Strip the "(from template)" suffix added at template-use time. */
function stripFromTemplateSuffix(name: string): string {
  return name.replace(/\s*\(from template\)\s*$/i, "").trim() || name;
}

const ROLE_PLACEHOLDER: Record<SlotRole, string> = {
  "title":          "[Título]",
  "subtitle":       "[Subtítulo]",
  "body":           "[Cuerpo del texto]",
  "quote":          "[Frase o cita]",
  "list-item":      "[Elemento de lista]",
  "section-title":  "[Título de sección]",
  "section-body":   "[Texto de sección]",
  "cta":            "[Llamada a la acción]",
};

/**
 * Replace each slot's text with a role-based placeholder.
 * Preserves all visual styles, colors, fonts, and layout — only text changes.
 * This ensures templates describe STRUCTURE, not topic-specific content.
 */
function anonymizeSlideHtml(html: string): string {
  const { slots } = extractSlots(html);
  if (slots.length === 0) return html;
  const fills: Record<string, string> = {};
  for (const slot of slots) {
    fills[slot.id] = ROLE_PLACEHOLDER[slot.role] ?? "[Texto]";
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
    kind: carousel.kind,
    slides: carousel.slides.map(({ id, html, order, notes }) => ({ id, html: anonymizeSlideHtml(html), order, notes })),
    tags: carousel.tags,
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
