---
name: architect-developer
description: Patterns for adding new features to Open Carrusel — types, lib, API routes, UI components
---

# Architect & Developer Guide

## Stack
Next.js 16 (App Router, Turbopack) · React 19 · TypeScript 5 · Tailwind v4 · Radix UI · @dnd-kit · Puppeteer · async-mutex

## Directory layout
```
src/
  app/             — Next.js App Router (pages + API routes)
    api/           — all API handlers as route.ts files
    carousel/[id]/ — editor page
    page.tsx       — dashboard (list of carousels)
  components/
    brand/         — brand setup components
    chat/          — ChatPanel, ChatInput, ChatMessage
    editor/        — CarouselPreview, SlideFilmstrip, ExportButton, etc.
    layout/        — TopBar
    templates/     — TemplateGallery, TemplateCard
    ui/            — shared primitives (button, input, dialog, badge)
  lib/             — server-side logic (never import from client components)
    data.ts        — atomic JSON read/write with async-mutex
    carousels.ts   — Carousel + Slide CRUD
    brand.ts       — brand config read/write
    chat-system-prompt.ts — dynamic system prompt builder
    slide-html.ts  — wrapSlideHtml() shared rendering contract
    export-slides.ts — Puppeteer PNG export pipeline
    templates.ts   — template CRUD
    style-presets.ts — style preset CRUD
    claude-path.ts — portable Claude CLI discovery
    utils.ts       — cn(), generateId(), now()
  types/
    carousel.ts    — Carousel, Slide, AspectRatio, DIMENSIONS, MAX_SLIDES
    brand.ts       — BrandConfig
    template.ts    — Template
    style-preset.ts — StylePreset
    staged-action.ts — StagedAction
data/              — gitignored JSON files (carousels.json, brand.json, ...)
public/uploads/    — gitignored user-uploaded images
scripts/           — setup.mjs, doctor.mjs, seed-*.mjs
```

## How to add a new data entity (e.g. "networks")

### 1. Type — `src/types/network.ts`
```typescript
export interface Network { id: string; name: string; /* ... */; createdAt: string; updatedAt: string; }
export interface NetworksData { networks: Network[]; }
```

### 2. Lib — `src/lib/networks.ts`
Follow the exact pattern in `src/lib/carousels.ts`:
- `const FILE = "networks.json"`
- `async function load()` + `async function save()`
- Export: `listNetworks`, `getNetwork`, `createNetwork`, `updateNetwork`, `deleteNetwork`
- Use `generateId()` and `now()` from `src/lib/utils.ts`
- Use `readDataSafe(FILE, { networks: [] })` — safe fallback for missing file

### 3. API routes — `src/app/api/networks/`
```
src/app/api/networks/route.ts         — GET (list) + POST (create)
src/app/api/networks/[networkId]/route.ts — GET + PUT + DELETE
```
Each handler imports from `src/lib/networks.ts` only — never touches `data.ts` directly.

### 4. UI component
- Create in the matching `src/components/` subfolder (e.g. `src/components/networks/`)
- Max ~300 lines per file
- Use `cn()` from `src/lib/utils.ts` for class merging
- Fetch data with `useEffect` + `fetch('/api/networks')` (client components) or `fetch()` in server components

## Aspect ratios & dimensions
All defined in `src/types/carousel.ts`:
```typescript
// Current (Instagram only)
"1:1" → 1080×1080  "4:5" → 1080×1350  "9:16" → 1080×1920
```
Roadmap Fase 2 will expand this to a dynamic `networks.json` catalog.

## Slide rendering contract
`wrapSlideHtml(slideHtml, aspectRatio)` in `src/lib/slide-html.ts` is the shared contract between:
- Preview: `<iframe sandbox="">` in `src/components/editor/SlideRenderer.tsx`
- Export: Puppeteer in `src/lib/export-slides.ts`

Never replicate the wrapping logic — always call `wrapSlideHtml()`.

## System prompt extension
When adding a new content type or context, update `buildSystemPrompt()` in `src/lib/chat-system-prompt.ts`:
- Add a new section with the relevant context
- Keep curl examples up to date with the actual API routes
- Claude subprocess only has `Bash` + `WebFetch` tools — all operations go via curl to localhost:3000

## Export pipeline
`src/lib/export-slides.ts` — Puppeteer screenshots each slide HTML at exact pixel dimensions, Sharp optimizes, archiver zips. Entry: `POST /api/carousels/[id]/export`.

## Key constraints
- No direct `fs` writes for JSON — always via `writeData()` in `src/lib/data.ts`
- iframes must keep `sandbox=""` — no JS in slides
- Components: max ~300 lines
- IDs: `generateId()` from `src/lib/utils.ts` (currently nanoid-based; Fase 3 migrates to `ulid`)
