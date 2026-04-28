---
name: roadmap-task
description: Workflow for implementing a ROADMAP.md phase or subtask — one subtask at a time, build → verify → commit
---

# Roadmap Task Implementation

## The workflow (per subtask)

1. **Read the subtask** from `ROADMAP.md` — understand the acceptance criteria before writing any code
2. **Implement one subtask** (e.g. `1.2`, not the full Phase 1)
3. **Verify**: `npm run build` → `npm run doctor` — both must pass
4. **Commit** using the `commit` skill conventions: `feat(phase-N): <description>`
5. Move to the next subtask

Never implement an entire phase in one go — always subtask by subtask with a passing build between each.

## Current roadmap phases

| Phase | Status | Description |
|-------|--------|-------------|
| 0 | ✅ Done | Bootstrap — fork, docs, ids utility |
| 1 | 🔜 Next | Single-image posts |
| 2 | Pending | Dynamic network catalog |
| 3 | Pending | Multi-brand / multi-account (big migration) |
| 4 | Pending | Telegram publishing destination |
| 5 | Pending | Polish — export naming, template scopes, seed-demo, history |
| 6 | Future | Advanced destinations (Meta Graph API, LinkedIn, webhooks) |

## Recommended order if short on time: Fase 1 → 4 → 2 → 3 → 5

## Phase 1 — Single-image posts
Key insight: a post is a carousel with exactly 1 slide. No new rendering engine needed.

- `1.1` — Add `Post` type in `src/types/post.ts`, discriminated union `Content = Post | Carousel`
- `1.2` — CRUD in `src/lib/posts.ts` (follow `src/lib/carousels.ts` pattern exactly)
- `1.3` — Dashboard UI: "Nuevo post" button → dialog (title, ratio, network)
- `1.4` — Editor adapts: hide `SlideFilmstrip` for posts; export returns single PNG not ZIP
- `1.5` — Update `buildSystemPrompt()` to receive `contentKind` and adjust instructions

## Phase 2 — Network catalog
- `2.1` — `src/types/network.ts` + `scripts/seed-networks.mjs` (Instagram, Facebook, TikTok, LinkedIn, X, Pinterest)
- `2.2` — `src/lib/networks.ts` CRUD + API routes `/api/networks/`
- `2.3` — Settings page `/settings/networks` with custom network form
- `2.4` — Network/format/ratio selector in content creation dialogs; dimensions from catalog not hardcoded
- `2.5` — `buildSystemPrompt()` includes `network.defaultStyleHint`

## Phase 3 — Multi-brand / multi-account (branch: `feature/multi-brand`)
**Work in a feature branch — this is the most invasive phase.**
- `3.1` — Types `src/types/brand.ts` + `src/types/account.ts`; lib `brands.ts` + `accounts.ts`
- `3.2` — Migration script `scripts/migrate-to-multi-brand.mjs` (idempotent)
- `3.3` — New API routes `/api/brands/*` + `/api/accounts/*`; deprecate old routes with warnings
- `3.4` — `AccountSelector` component in TopBar (two-column dropdown, localStorage persistence)
- `3.5` — `/brands` page + `/brands/[brandId]` page
- `3.6` — `/accounts/[accountId]` page (scoped editor)
- `3.7` — Enrich `buildSystemPrompt()` with `{ brand, account, network, format, ratio }`

## Phase 4 — Telegram destination
- `4.1` — `src/types/destination.ts` + `src/lib/destinations.ts`
- `4.2` — Settings page `/settings/telegram` (bot token, default chat ID, test button)
- `4.3` — `src/lib/telegram.ts` with `sendPhoto()` + `sendMediaGroup()`
- `4.4` — "Publicar" modal in editor (Descargar ZIP / Enviar a Telegram)
- `4.5` — `publishHistory` array on carousel/post + history display

## Phase 5 — Polish
- `5.1` — Export file naming: `{brandSlug}_{networkId}_{title}_{ratio}.{ext}`
- `5.2` — Template scopes: per-account (default), per-brand, global — tabs in gallery
- `5.3` — `/seed-demo` slash command (see `seed-demo` skill)
- `5.4` — `/accounts/[accountId]/history` timeline with filters
- `5.5` — "Duplicar en otra cuenta" with Claude dimension adaptation

## Tips for Phase 3 specifically
- Run `scripts/migrate-to-multi-brand.mjs` on a copy of `data/` first
- Test with 3 brands × 2 accounts each before merging
- Keep the old `/api/carousels/*` routes alive (with deprecation header) until all UI is migrated
- The `AccountSelector` localStorage key should be `activeAccountId`
