---
name: slide-design
description: Rules for generating, reviewing, and debugging slide HTML in Open Carrusel
---

# Slide Design Guide

## The fundamental rule
Slides store **body-level HTML only** — no `<!DOCTYPE>`, `<html>`, `<head>`, or `<body>` tags. `wrapSlideHtml()` in `src/lib/slide-html.ts` adds the full document structure. This contract is shared between iframe preview and Puppeteer export — breaking it breaks both.

## Dimensions (current Instagram-only set)
| Ratio | Width | Height | Use |
|-------|-------|--------|-----|
| 1:1   | 1080px | 1080px | Square — safe default |
| 4:5   | 1080px | 1350px | Portrait — recommended, best reach |
| 9:16  | 1080px | 1920px | Story / Reels |

## Slide HTML template
```html
<style>
  .slide {
    width: 1080px; height: 1350px;  /* match carousel ratio */
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 80px;
    background: #0a0a0a;
    font-family: 'Inter', sans-serif;
    box-sizing: border-box;
  }
  h1 { font-size: 72px; font-weight: 800; line-height: 1.1; color: #ffffff; }
  p  { font-size: 28px; line-height: 1.5; color: #e5e5e5; margin-top: 24px; }
</style>
<div class="slide">
  <h1>Your Hook Here</h1>
  <p>Supporting detail in one or two sentences.</p>
</div>
```

## Typography rules
- Hook slides: 64–96px bold heading, ≤8 words
- Content slides: 36–48px heading, 24–28px body
- Max 2 font families per carousel
- `line-height: 1.2` for headings, `1.5` for body
- Font families declared in CSS auto-load from Google Fonts (e.g. `font-family: 'Playfair Display', serif`)

## Layout rules
- 60–80px padding on all sides minimum
- One key message per slide — two messages = two slides
- `flexbox` or `grid` for layout; `position: absolute` for overlays only
- Keep critical content in the center 80% of the slide (profile grid crops to 1:1)

## Color & contrast
- Text/background contrast ratio > 4.5:1 always
- Gradients: `linear-gradient(135deg, color1, color2)` — adds depth without clutter
- Solid color backgrounds > busy patterns for readability
- Vary background between slides for visual interest

## Carousel narrative arc (8 slides)
1. **Hook** — provocative question, bold stat, or contrarian claim (≤8 words, huge text)
2. **Problem** — establish the problem or context
3. **Agitate** — deepen the problem
4. **Value 1** — first key insight
5. **Value 2** — second key insight
6. **Value 3** — third key insight
7. **Summary** — transformation or key takeaway
8. **CTA** — "Follow for more" / "Save this" / "Share with someone who needs this"

## Image paths
- User uploads: `/uploads/{filename}` (stored in `public/uploads/`)
- Brand logo: use the `logoPath` from brand config
- Never use absolute filesystem paths in slide HTML

## What NOT to do
- `<script>` tags — iframe sandbox blocks all JS
- External CSS links (`<link rel="stylesheet">`) — only inline styles or `<style>` tags
- `<html>`, `<head>`, `<body>` — the wrapper adds these
- Fixed viewport units (`100vw`, `100vh`) — use pixel values instead
- Images from external URLs — always copy to `/uploads/` first

## Debugging preview vs export mismatches
Preview uses Google Fonts CDN; export inlines base64 `@font-face`. If fonts render differently:
1. Check `extractFontFamilies()` in `src/lib/slide-html.ts` — it must detect the font name
2. Make sure `font-family` uses the exact Google Fonts name (e.g. `'Playfair Display'` not `'playfair-display'`)
3. Puppeteer runs headless — network is disabled during export, so CDN fonts don't load; inlined CSS must work standalone
