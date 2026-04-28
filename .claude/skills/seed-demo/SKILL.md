---
name: seed-demo
description: Create demo brand, accounts, and sample content to showcase the app after cloning
---

# Seed Demo

Creates: 1 demo brand, 2 demo accounts (Instagram + LinkedIn), 1 sample post and 1 sample carousel per account.

This maps to ROADMAP Fase 5.3. If the multi-brand model (Fase 3) is not yet implemented, seed a single brand config + 2 sample carousels instead.

## Implementation path

### If Fase 3 (multi-brand) is NOT yet done
Create `scripts/seed-demo.mjs` that:
1. Writes `/data/brand.json` with a demo brand (MyAppCube colors + Inter/Playfair fonts)
2. Calls `POST /api/carousels` twice to create:
   - A carousel "Demo — Instagram tips" (4:5, 3 slides of placeholder HTML)
   - A carousel "Demo — LinkedIn insight" (1:1, 2 slides of placeholder HTML)
3. Prints "Demo seeded! Open http://localhost:3000 to explore."

### If Fase 3 (multi-brand) IS done
Create `scripts/seed-demo.mjs` that:
1. Calls `POST /api/brands` → creates brand "MyAppCube Demo"
2. Calls `POST /api/accounts` twice → Instagram account + LinkedIn account under that brand
3. Calls content APIs to create 1 post + 1 carousel per account
4. Prints summary with URLs

## Demo brand config
```json
{
  "name": "MyAppCube Demo",
  "colors": {
    "primary": "#6366f1",
    "secondary": "#8b5cf6",
    "accent": "#f59e0b",
    "background": "#0f0f23",
    "surface": "#1e1e3f"
  },
  "fonts": { "heading": "Syne", "body": "Inter" },
  "styleKeywords": ["bold", "tech", "minimalist", "dark"]
}
```

## Sample slide HTML (Instagram 4:5 hook slide)
```html
<style>
  .slide { width:1080px;height:1350px;display:flex;flex-direction:column;
    align-items:center;justify-content:center;padding:80px;
    background:linear-gradient(135deg,#0f0f23,#1e1e3f);box-sizing:border-box; }
  h1 { font-family:'Syne',sans-serif;font-size:80px;font-weight:800;
    color:#ffffff;line-height:1.1;text-align:center; }
  .accent { color:#f59e0b; }
  .swipe { font-family:'Inter',sans-serif;font-size:22px;color:#6366f1;
    margin-top:48px;letter-spacing:0.1em; }
</style>
<div class="slide">
  <h1>5 things every <span class="accent">app founder</span> gets wrong</h1>
  <p class="swipe">swipe →</p>
</div>
```

## Slash command wiring
Add to `.claude/skills/seed-demo/SKILL.md` invocation: this skill creates `scripts/seed-demo.mjs` if it doesn't exist, then runs `node scripts/seed-demo.mjs` against the running server.

**Pre-flight checks before running:**
1. Dev server must be running at localhost:3000 (`curl -s http://localhost:3000/api/carousels` returns 200)
2. `data/` directory exists (run `npm run setup` first if not)

## Idempotency
The script should check if demo content already exists (e.g. carousel named "Demo — Instagram tips") and skip creation if it does — safe to run multiple times.
