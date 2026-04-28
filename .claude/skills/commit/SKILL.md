---
name: commit
description: Git commit conventions for images-social-media-posters
---

# Commit conventions

Use Conventional Commits: `<type>(<scope>): <subject>` — all lowercase, imperative mood, no period.

## Types
- `feat` — new feature (new API route, new UI component, new phase from roadmap)
- `fix` — bug fix
- `chore` — setup, scripts, deps, config
- `refactor` — restructuring without behavior change
- `docs` — CLAUDE.md, ROADMAP.md, README.md only
- `style` — Tailwind/CSS only, no logic change
- `test` — doctor script changes, manual test notes

## Scopes (use when helpful)
- `carousel`, `slide`, `brand`, `chat`, `export`, `templates`, `upload`
- `api` for route changes, `ui` for component-only changes
- `data` for `src/lib/data.ts` or JSON storage changes
- `phase-N` when implementing a ROADMAP phase (e.g. `phase-1`)

## Examples
```
feat(slide): add undo to slide filmstrip
fix(export): prevent Puppeteer crash on empty slide
feat(phase-1): add single-image post type and CRUD
chore: add ulid dependency for opaque IDs
refactor(data): extract readDataSafe helper
docs: update ROADMAP phase 2 acceptance criteria
```

## Before committing
1. `npm run build` must pass
2. `npm run doctor` must pass
3. Stage specific files — never `git add .` blindly (data/ and public/uploads/ are gitignored but double-check)
4. One logical change per commit — if you implemented 1.2 and 1.3, make two commits
