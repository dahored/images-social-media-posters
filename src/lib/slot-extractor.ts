import * as cheerio from "cheerio";
import type { Cheerio } from "cheerio";
import type { Element } from "domhandler";
import type { SlideSlot, SlotFills, SlotRole, SlotSchema } from "@/types/slot";

const ROLE_CLASSES: Record<string, SlotRole> = {
  "slide-title": "title",
  "slide-subtitle": "subtitle",
  "slide-body": "body",
  "slide-quote": "quote",
  "slide-list-item": "list-item",
  "slide-section-title": "section-title",
  "slide-section-body": "section-body",
  "slide-cta": "cta",
};

const SECTION_ROLES = new Set<SlotRole>(["section-title", "section-body"]);

const ROLE_SELECTOR = Object.keys(ROLE_CLASSES)
  .map((c) => `.${c}`)
  .join(",");

function classListToRoles(classAttr: string): SlotRole[] {
  if (!classAttr) return [];
  const out: SlotRole[] = [];
  for (const cls of classAttr.split(/\s+/)) {
    const role = ROLE_CLASSES[cls];
    if (role) out.push(role);
  }
  return out;
}

function hasAccentClass(classAttr: string): boolean {
  return classAttr ? classAttr.split(/\s+/).includes("slide-accent") : false;
}

/**
 * Pick the primary role of an element when its class list contains multiple
 * role classes (e.g. `slide-title slide-accent`). Accent isn't a role and is
 * already filtered out by ROLE_CLASSES; here we just take the first role.
 */
function primaryRole(roles: SlotRole[]): SlotRole | null {
  return roles.length > 0 ? roles[0] : null;
}

/**
 * True when this element is wholly contained inside another role-classed
 * element AND the inner role matches the outer (e.g. a span.slide-title.slide-accent
 * inside a p.slide-title — that span is not its own slot, it's an accent fragment).
 *
 * If the inner role is different from the outer (e.g. a slide-section-body inside
 * a slide-section that itself wraps a slide-title), it IS a separate slot.
 */
function isAccentFragment(
  $: cheerio.CheerioAPI,
  el: Element,
  myRole: SlotRole
): boolean {
  let parent = el.parent;
  while (parent && parent.type === "tag") {
    const parentClass = ($(parent).attr("class") || "") as string;
    const parentRoles = classListToRoles(parentClass);
    if (parentRoles.length > 0) {
      // If parent shares the same primary role and we have slide-accent → fragment
      if (parentRoles.includes(myRole) && hasAccentClass($(el).attr("class") || "")) {
        return true;
      }
      // Otherwise the inner element is a real slot (section-body inside section, etc.)
      return false;
    }
    parent = parent.parent;
  }
  return false;
}

/** Walk up to find the nearest ancestor that is a section-* slot, return its slot id. */
function findParentSectionId(
  $: cheerio.CheerioAPI,
  el: Element,
  slotsByElement: Map<Element, string>
): string | undefined {
  let parent = el.parent;
  while (parent && parent.type === "tag") {
    const id = slotsByElement.get(parent);
    if (id) {
      const cls = ($(parent).attr("class") || "") as string;
      const roles = classListToRoles(cls);
      const primary = primaryRole(roles);
      if (primary && SECTION_ROLES.has(primary)) return id;
    }
    parent = parent.parent;
  }
  return undefined;
}

/** Whitespace-normalize text content for stable comparison. */
function cleanText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/**
 * Detect a leading emoji acting as a visual marker (e.g. "💔 ", "⏰ ", "🎮 ").
 * Returns the emoji + trailing whitespace if found at the start of the text, else undefined.
 * Covers the most common pictographic ranges plus variation selectors and ZWJ sequences.
 */
const LEADING_EMOJI_RE = /^([\u{1F000}-\u{1FFFF}\u{2300}-\u{27BF}\u{2B50}\u{2B55}][️⃣]?(?:‍[\u{1F000}-\u{1FFFF}][️]?)*\s+)/u;
function extractEmojiPrefix(text: string): string | undefined {
  return LEADING_EMOJI_RE.exec(text)?.[1];
}

export function extractSlots(slideHtml: string): SlotSchema {
  const $ = cheerio.load(`<div id="__root">${slideHtml}</div>`, null, false);
  const slots: SlideSlot[] = [];
  const slotsByElement = new Map<Element, string>();

  let order = 0;
  $(ROLE_SELECTOR).each((_, el) => {
    if (el.type !== "tag") return;
    const $el = $(el) as Cheerio<Element>;
    const cls = ($el.attr("class") || "") as string;
    const roles = classListToRoles(cls);
    const role = primaryRole(roles);
    if (!role) return;

    if (isAccentFragment($, el, role)) return;

    const text = cleanText($el.text());
    if (!text) return;

    const id = `slot-${order}`;
    const parentSectionId = findParentSectionId($, el, slotsByElement);

    // Has accent if this element itself OR any descendant carries slide-accent
    const selfAccent = hasAccentClass(cls);
    const descendantAccent = $el.find(".slide-accent").length > 0;
    const hasAccent = selfAccent || descendantAccent;

    // Capture the accent text for position-aware Lorem Ipsum generation
    let accentText: string | undefined;
    if (hasAccent) {
      if (selfAccent && !descendantAccent) {
        accentText = text; // the element itself is the accent
      } else {
        const accentEl = $el.find(".slide-accent").first();
        if (accentEl.length > 0) accentText = cleanText(accentEl.text());
      }
    }

    slots.push({
      id,
      role,
      text,
      hasAccent,
      accentText,
      order,
      parentSectionId,
      emojiPrefix: extractEmojiPrefix(text),
    });
    slotsByElement.set(el, id);
    order += 1;
  });

  return { slots };
}

/**
 * Replace text content of slots identified by id. Preserves all element attributes,
 * inline styles, and accent-fragment spans (their text is replaced too if they carry
 * the same primary role).
 *
 * Strategy: walk the DOM in document order using the same selector as extractSlots,
 * skip accent fragments, increment a counter, and on a slot we want to replace,
 * set its textContent.
 */
export function fillSlots(slideHtml: string, fills: SlotFills): string {
  const $ = cheerio.load(`<div id="__root">${slideHtml}</div>`, null, false);

  // First pass: collect slot elements in document order (same logic as extractSlots).
  // Snapshotting first avoids confusing the iterator when fills mutate the tree
  // (e.g. removing an accent-fragment child detaches it but cheerio's array still holds it).
  const slotEls: Array<{ id: string; el: Element }> = [];
  let order = 0;
  $(ROLE_SELECTOR).each((_, el) => {
    if (el.type !== "tag") return;
    const cls = ($(el).attr("class") || "") as string;
    const role = primaryRole(classListToRoles(cls));
    if (!role) return;
    if (isAccentFragment($, el, role)) return;
    slotEls.push({ id: `slot-${order}`, el });
    order += 1;
  });

  // Second pass: apply fills.
  for (const { id, el } of slotEls) {
    const replacement = fills[id];
    if (replacement === undefined) continue;
    const $el = $(el);

    // If the slot contains an accent-fragment child and the replacement contains
    // {{accent}}...{{/accent}} markers, preserve the span's tag/attrs and only
    // swap text. Otherwise replace the whole text content.
    const accentFrag = $el.children(".slide-accent").first();
    const accentMatch = replacement.match(/\{\{accent\}\}([\s\S]+?)\{\{\/accent\}\}/);
    if (accentFrag.length > 0 && accentMatch) {
      const before = replacement.slice(0, accentMatch.index ?? 0);
      const accentText = accentMatch[1];
      const after = replacement.slice((accentMatch.index ?? 0) + accentMatch[0].length);
      $el.empty();
      if (before) $el.append(escapeText(before));
      const accentClone = accentFrag.clone();
      accentClone.text(accentText);
      $el.append(accentClone);
      if (after) $el.append(escapeText(after));
    } else {
      $el.text(replacement.replace(/\{\{accent\}\}|\{\{\/accent\}\}/g, ""));
    }
  }

  return $("#__root").html() ?? slideHtml;
}

/**
 * True when two slide HTML strings have the same slot schema —
 * same number of slots in the same order with the same roles.
 * Use this server-side to validate that an AI update preserves
 * the template structure (only text content / colors changed).
 */
export function isStructurallyEquivalent(originalHtml: string, candidateHtml: string): boolean {
  const a = extractSlots(originalHtml).slots;
  const b = extractSlots(candidateHtml).slots;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].role !== b[i].role) return false;
  }
  return true;
}

function escapeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
