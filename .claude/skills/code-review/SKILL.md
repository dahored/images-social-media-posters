---
name: code-review
description: Code review checklist for Next.js 16 + React 19 + TypeScript + Tailwind v4 — specific to this project's architecture
---

# Code Review Checklist

## Storage & data integrity
- [ ] All JSON writes go through `writeData()` in `src/lib/data.ts` — never raw `writeFile` for data files
- [ ] `readDataSafe()` used for reads that need a fallback, `readData()` only when missing file is an error
- [ ] Mutex locking is implicit in `writeData()` — no need to add extra locks
- [ ] Atomic writes: `.tmp` → `rename` pattern is already in `writeData()`; don't bypass it

## API routes (`src/app/api/`)
- [ ] Routes return `NextResponse.json()` — no raw `Response` unless streaming (SSE)
- [ ] Error responses include a `{ error: string }` body
- [ ] SSE routes (`/api/chat`) must set `Content-Type: text/event-stream` and handle client disconnect
- [ ] No direct filesystem access for user data — must go through `src/lib/*.ts` helpers

## Slide HTML contract
- [ ] Slides store BODY-level HTML only — no `<html>`, `<head>`, `<body>`, `<!DOCTYPE>`
- [ ] `wrapSlideHtml()` in `src/lib/slide-html.ts` is the ONLY function that wraps slides for preview or export — never duplicate this logic
- [ ] Slides reference images as `/uploads/{filename}` — never absolute paths in HTML
- [ ] No `<script>` tags in slide HTML (iframe sandbox blocks JS execution)
- [ ] Inline styles or `<style>` tags only — no external CSS links in slides

## TypeScript
- [ ] New data shapes go in `src/types/` as exported interfaces
- [ ] No `any` — use `unknown` with type guards instead
- [ ] Discriminated unions for multi-kind types (e.g. `kind: 'post' | 'carousel'`)
- [ ] `generateId()` from `src/lib/utils.ts` for all new entity IDs

## Components
- [ ] Max ~300 lines per component file — split if larger
- [ ] `cn()` from `src/lib/utils.ts` for class merging — never raw string concatenation of class names
- [ ] Tailwind v4 — no `tailwind.config.js` classes; utility classes only
- [ ] iframes rendering slides must have `sandbox=""` attribute — no exceptions

## Chat / AI agent
- [ ] `buildSystemPrompt()` in `src/lib/chat-system-prompt.ts` must be updated when adding new content types
- [ ] Claude subprocess gets `--allowedTools Bash WebFetch` only — don't add filesystem tools
- [ ] API port `3000` is hardcoded in system prompt curl examples — keep consistent

## Security
- [ ] Upload route (`/api/upload`) validates mime type (PNG/JPG/WebP only) and size (≤10MB) before writing
- [ ] No user-supplied strings interpolated into shell commands (Claude subprocess args)
- [ ] No path traversal: user-supplied filenames must be sanitized before writing to `public/uploads/`

## Roadmap compatibility
- [ ] New features should not block future multi-brand migration (Fase 3)
- [ ] If adding new content to `data/`, use `readDataSafe()` with a safe fallback so Fase 3 migration script can run idempotently
