# images-social-media-posters

AI-powered **multi-brand, multi-network, multi-format** social media post builder. Fork de [Open Carrusel](https://github.com/Hainrixz/open-carrusel) que evoluciona la arquitectura a un estudio local para manejar múltiples marcas, cuentas en varias redes sociales, posts de una sola imagen, carruseles, y envío directo a Telegram.

**Stack**: Next.js 16 + React 19 + TypeScript + Tailwind v4.

---

## Conceptos fundamentales

La jerarquía de datos tiene tres niveles:

```
Brand (Marca)
  └── Account (Cuenta en una red concreta)
        └── Posts / Carousels / Templates
```

- **Brand** — agrupador narrativo (ej. "MyAppCube", "Daho Ads"). Tiene nombre, logo, color, descripción. Se crea dinámicamente desde la UI.
- **Account** — perfil concreto en una red específica (ej. `@myappcube` en Instagram, `/myappcube` en Facebook). Pertenece a una marca. Tiene handle, red, branding propio (hereda o sobrescribe el de la marca).
- **Network** — entrada del catálogo editable `networks.json`. Define la red (Instagram, Facebook, TikTok, etc.), sus formatos soportados (single-image, carousel, story), dimensiones por aspect ratio, y hints de estilo.
- **Post** — caso con 1 slide (imagen única).
- **Carousel** — caso con N slides (2-10).
- **Template** — post o carrusel guardado como plantilla reutilizable, alcance por cuenta.

Todos los IDs son opacos (ULID/nanoid), nunca slugs derivados del nombre. Los nombres bonitos viven **dentro** de los JSON, nunca en nombres de archivo o carpeta.

---

## Arquitectura

- **Frontend**: React app en `localhost:3000` con selector de cuenta activa (top-left, estilo Meta Business Suite), chat panel (izquierda), preview (centro), filmstrip (abajo, solo para carruseles).
- **AI Agent**: Claude CLI spawneado como subproceso vía `/api/chat`, comunica por SSE streaming.
- **Storage**: Archivos JSON en `/data/` con async-mutex locking y escrituras atómicas (tmp file + rename).
- **Export**: Puppeteer captura HTML de slides a PNG en dimensiones exactas de la red/ratio seleccionado.
- **Slides**: HTML a nivel body renderizado en iframes sandboxed. `wrapSlideHtml()` en `src/lib/slide-html.ts` es el contrato compartido entre preview y export.
- **Destinos de publicación**: sistema extensible. Fase actual soporta ZIP download + envío a Telegram vía bot.

---

## Estructura de archivos

```
data/
├── brands/
│   └── brand_<ulid>.json              ← { id, name, logo, color, description, createdAt }
├── accounts/
│   └── acc_<ulid>/
│       ├── account.json               ← { id, brandId, networkId, handle, displayName, telegramChatId, createdAt }
│       ├── brand-override.json        ← opcional: colores/fonts específicos de esta cuenta
│       ├── posts/
│       │   └── post_<ulid>.json
│       ├── carousels/
│       │   └── carousel_<ulid>.json
│       └── templates/
│           └── template_<ulid>.json
├── networks.json                      ← catálogo editable de redes
└── config.json                        ← { telegramBotToken, globalDefaults, ... }

public/uploads/
└── <ulid>.<ext>                       ← logos, reference images, gitignored

src/
├── app/
│   ├── api/
│   │   ├── brands/                    ← CRUD de marcas
│   │   ├── accounts/                  ← CRUD de cuentas, anidadas con posts/carousels
│   │   ├── networks/                  ← lectura + edición del catálogo
│   │   ├── chat/                      ← Claude CLI subprocess + SSE
│   │   ├── telegram/                  ← envío a Telegram
│   │   ├── upload/                    ← imágenes (PNG/JPG/WebP, max 10MB)
│   │   └── fonts/                     ← lista de Google Fonts
│   ├── brands/[brandId]/              ← vista de una marca
│   ├── accounts/[accountId]/          ← editor de posts/carruseles de una cuenta
│   └── page.tsx                       ← dashboard con selector de marca/cuenta activa
├── components/
│   ├── brand/                         ← BrandCard, BrandForm, ColorPicker, FontSelector, LogoUpload
│   ├── account/                       ← AccountSelector, AccountCard, AccountForm, NetworkBadge
│   ├── chat/                          ← ChatPanel, ChatMessage, ChatInput, ReferenceImages
│   ├── editor/                        ← PostPreview, CarouselPreview, SlideFilmstrip, SlideRenderer, ExportButton, PublishButton
│   ├── layout/                        ← TopBar (con selector de marca/cuenta)
│   ├── templates/                     ← TemplateGallery, TemplateCard
│   ├── networks/                      ← NetworkCatalogEditor, NetworkForm
│   └── ui/                            ← primitivos: Button, Input, Badge, Dialog
├── lib/
│   ├── brands.ts                      ← CRUD de brands
│   ├── accounts.ts                    ← CRUD de accounts + posts/carousels anidados
│   ├── networks.ts                    ← carga/edición del catálogo
│   ├── chat-system-prompt.ts          ← prompt dinámico (brand + account + network + format context)
│   ├── slide-html.ts                  ← wrapSlideHtml() — contrato de rendering
│   ├── data.ts                        ← storage JSON con async-mutex + writes atómicos
│   ├── telegram.ts                    ← sendToTelegram() con media groups para carruseles
│   ├── destinations.ts                ← abstracción de destinos (zip, telegram, webhook futuro, meta api futuro)
│   ├── claude-path.ts                 ← descubrimiento portable del Claude CLI
│   └── ids.ts                         ← generación de ULIDs
└── types/
    ├── brand.ts
    ├── account.ts
    ├── network.ts
    ├── post.ts
    ├── carousel.ts
    └── destination.ts
```

---

## Modelo de datos

### Brand

```typescript
type Brand = {
  id: string                    // "brand_01H..."
  name: string                  // "MyAppCube"
  description?: string
  logoPath?: string             // "/uploads/<ulid>.png"
  color: string                 // hex, usado en avatares e iconos del selector
  defaultBranding?: BrandingConfig   // colores/fonts por defecto que heredan las cuentas
  createdAt: string             // ISO datetime
  updatedAt: string
}
```

### Account

```typescript
type Account = {
  id: string                    // "acc_01H..."
  brandId: string               // referencia a Brand
  networkId: string             // referencia a una entrada de networks.json
  handle: string                // "@myappcube"
  displayName?: string          // "MyAppCube Oficial"
  brandingOverride?: Partial<BrandingConfig>   // sobrescribe campos del brand padre
  telegramChatId?: string       // destino Telegram específico de esta cuenta (opcional)
  createdAt: string
  updatedAt: string
}

type BrandingConfig = {
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
    surface: string
  }
  fonts: {
    heading: string             // Google Font family name
    body: string
  }
  styleKeywords: string         // "editorial, minimalist, warm tones"
}
```

### Network

```typescript
type Network = {
  id: string                    // "instagram", "tiktok", "linkedin", "daho_give_u"
  displayName: string
  icon: string                  // nombre del icono lucide o "custom"
  formats: Format[]
  defaultStyleHint?: string     // "LinkedIn: profesional, data-driven"
  builtin: boolean              // true = viene con la app, false = creada por el usuario
}

type Format = {
  type: 'single-image' | 'carousel' | 'story'
  ratios: AspectRatio[]         // aspect ratios soportados para este formato en esta red
  maxSlides?: number            // solo para carousel
}

type AspectRatio = {
  id: string                    // "1:1", "4:5", "9:16", "1.91:1"
  width: number                 // px reales del export
  height: number
}
```

### Post y Carousel

```typescript
type Post = {
  id: string                    // "post_01H..."
  accountId: string
  title: string
  slideHtml: string             // HTML body-level, pasa por wrapSlideHtml() al renderizar
  ratio: string                 // referencia a AspectRatio.id
  caption?: string
  hashtags?: string[]
  versionHistory: string[]      // slideHtml previos para undo
  createdAt: string
  updatedAt: string
}

type Carousel = {
  id: string                    // "carousel_01H..."
  accountId: string
  title: string
  slides: Slide[]
  ratio: string
  caption?: string
  hashtags?: string[]
  createdAt: string
  updatedAt: string
}

type Slide = {
  id: string                    // "slide_01H..."
  html: string
  order: number
  versionHistory: string[]
}
```

### Destination

```typescript
type Destination =
  | { type: 'download-zip' }
  | { type: 'telegram', chatId?: string, label: string }
  | { type: 'webhook', url: string, label: string }    // futuro
  | { type: 'meta-graph', accountId: string }          // futuro

type PublishResult = {
  success: boolean
  destination: Destination
  message?: string
  artifactPaths?: string[]      // paths de PNGs generados
}
```

---

## API Routes

Todas en `localhost:3000`:

### Marcas
- `GET /api/brands` — listar todas
- `POST /api/brands` — crear
- `GET /api/brands/[brandId]` — obtener una
- `PUT /api/brands/[brandId]` — actualizar
- `DELETE /api/brands/[brandId]` — eliminar (falla si tiene cuentas asociadas; forzar con `?cascade=true`)

### Cuentas
- `GET /api/accounts?brandId=<id>` — listar (filtrable por marca)
- `POST /api/accounts` — crear
- `GET /api/accounts/[accountId]` — obtener una (incluye conteos de posts/carousels)
- `PUT /api/accounts/[accountId]` — actualizar
- `DELETE /api/accounts/[accountId]` — eliminar (borra todo su contenido)

### Posts
- `GET /api/accounts/[accountId]/posts` — listar
- `POST /api/accounts/[accountId]/posts` — crear
- `PUT /api/accounts/[accountId]/posts/[postId]` — actualizar
- `DELETE /api/accounts/[accountId]/posts/[postId]` — eliminar
- `POST /api/accounts/[accountId]/posts/[postId]/undo` — deshacer último cambio

### Carruseles
- `GET /api/accounts/[accountId]/carousels`
- `POST /api/accounts/[accountId]/carousels`
- `GET/PUT/DELETE /api/accounts/[accountId]/carousels/[carouselId]`
- `POST /api/accounts/[accountId]/carousels/[carouselId]/slides` — agregar slide
- `PUT/DELETE /api/accounts/[accountId]/carousels/[carouselId]/slides/[slideId]`
- `PUT /api/accounts/[accountId]/carousels/[carouselId]/slides` — reordenar (body: `{ slideIds: [...] }`)
- `POST /api/accounts/[accountId]/carousels/[carouselId]/slides/[slideId]/undo`

### Export y publicación
- `POST /api/accounts/[accountId]/posts/[postId]/export` — PNG único
- `POST /api/accounts/[accountId]/carousels/[carouselId]/export` — ZIP de PNGs
- `POST /api/accounts/[accountId]/posts/[postId]/publish` — body: `{ destination: Destination }`
- `POST /api/accounts/[accountId]/carousels/[carouselId]/publish`

### Catálogo de redes
- `GET /api/networks` — catálogo completo
- `POST /api/networks` — crear red custom
- `PUT /api/networks/[networkId]` — actualizar (solo custom, las builtin son read-only excepto el hint de estilo)
- `DELETE /api/networks/[networkId]` — eliminar (solo custom)

### Config global
- `GET /api/config` — lee `/data/config.json`
- `PUT /api/config` — actualiza (incluye token de Telegram bot)

### Otros
- `POST /api/chat` — Claude CLI subprocess + SSE. Body incluye `{ accountId, message, context }` para que el system prompt sepa el contexto.
- `POST /api/upload` — imágenes (PNG/JPG/WebP, max 10MB)
- `GET /api/fonts` — lista curada de Google Fonts

---

## Contratos clave

### `wrapSlideHtml(bodyHtml, config)` — el contrato de rendering

Recibe HTML body-level + config con dimensiones y branding. Devuelve documento HTML completo con `<!DOCTYPE>`, `<html>`, `<head>` (fonts, reset), `<body>` (wrapper con dimensiones).

**Debe producir el MISMO output** para:
- Preview en iframe sandboxed del editor
- Screenshot de Puppeteer al exportar

Si cambias esta función, testea el round-trip preview ↔ export.

### `buildSystemPrompt(context)` en `chat-system-prompt.ts`

Recibe `{ account, brand, network, format, ratio }` y construye el system prompt inyectando:
- Branding efectivo (override de account encima de default de brand)
- Red activa y su `defaultStyleHint`
- Formato activo (single-image vs. carousel) y dimensiones objetivo
- Estado actual de posts/slides del contexto (si aplica)

### `sendToTelegram(artifact, destination)` en `telegram.ts`

Recibe:
- `artifact` — path a PNG individual o paths a múltiples PNGs + caption/hashtags
- `destination` — `{ chatId, label }`

Usa el bot token de `/data/config.json`. Para carruseles usa `sendMediaGroup` (hasta 10 imágenes en un mensaje). Caption va en la primera imagen.

---

## Convenciones de código

- Componentes ≤ 300 líneas por archivo
- Tipos en `src/types/`, utilidades en `src/lib/`, componentes en `src/components/`
- Todas las mutaciones de datos pasan por `src/lib/data.ts` (jamás `fs.writeFile` directo para JSON)
- `cn()` de `src/lib/utils.ts` para class merging
- IDs siempre por `generateId(prefix)` de `src/lib/ids.ts` — nunca slugs de nombre
- Iframes de slides siempre con `sandbox=""` (sin JS en los slides)
- Claude CLI subprocess recibe `--allowedTools Bash WebFetch`

---

## Reglas del HTML de slides

Los slides guardan **solo HTML body-level** (sin `<html>`, `<head>`, `<!DOCTYPE>`). `wrapSlideHtml()` añade la estructura completa. Los slides deben:

- Usar inline styles o `<style>` tags
- Referenciar imágenes como `/uploads/<ulid>.ext`
- Usar Google Font family names en `font-family`
- NO contener `<script>` tags (el sandbox lo bloquea)
- Ajustarse a las dimensiones del ratio activo

---

## Dimensiones por red (cheat sheet)

Valores de referencia, el catálogo real vive en `networks.json`:

| Red | Formato | Ratio | Dimensiones |
|---|---|---|---|
| Instagram | square | 1:1 | 1080×1080 |
| Instagram | portrait | 4:5 | 1080×1350 |
| Instagram | story / reel cover | 9:16 | 1080×1920 |
| Facebook | feed | 1.91:1 | 1200×628 |
| Facebook | square | 1:1 | 1080×1080 |
| LinkedIn | feed | 1.91:1 | 1200×628 |
| LinkedIn | square | 1:1 | 1080×1080 |
| LinkedIn | carousel doc | 1:1 | 1080×1080 |
| TikTok | cover / post | 9:16 | 1080×1920 |
| X (Twitter) | feed | 16:9 | 1600×900 |
| Pinterest | pin | 2:3 | 1000×1500 |

Max 10 slides por carrusel (límite real de IG/LinkedIn).

---

## Telegram (publicación)

Setup único en la config global:
1. Crear bot con `@BotFather` en Telegram, obtener `TELEGRAM_BOT_TOKEN`
2. Enviar un mensaje al bot desde tu chat destino, obtener `chat_id` vía `https://api.telegram.org/bot<token>/getUpdates`
3. Pegar ambos en `/data/config.json` o desde el panel de settings

Cada cuenta puede tener un `telegramChatId` propio (canal del equipo, chat con cliente, etc.) o usar el default global.

Al publicar:
- Post único → `sendPhoto` con caption + hashtags
- Carrusel → `sendMediaGroup` con las N imágenes, caption en la primera
- Metadata del mensaje incluye `brandId` + `accountId` + `handle` para identificar de qué marca/cuenta viene

---

## Slash commands (Claude Code)

Heredados del proyecto original, más uno nuevo:

| Comando | Qué hace |
|---|---|
| `/start [port]` | Instalar + seed + run + abrir browser |
| `/stop [port]` | Matar dev server |
| `/reset` | Borrar `/data/` y `/public/uploads/`, re-sembrar defaults (pide confirmación) |
| `/doctor` | Diagnóstico del entorno (Node, Claude CLI, deps, puertos) |
| `/seed-demo` *(nuevo)* | Crear 1 brand demo + 2 accounts demo con contenido de ejemplo, útil para probar la app |

---

## Qué NO cambia respecto a Open Carrusel

- Filosofía local-first, single-user
- Slides como HTML (no JSON DSL, no canvas)
- Iframes sandboxed, sin JS en slides
- Claude CLI como agente (no API directa)
- Storage en JSON con async-mutex + writes atómicos
- `wrapSlideHtml()` como contrato único
- Animaciones CSS-first estilo Emil Kowalski
- Licencia MIT

---

## Atribución

Este proyecto es un fork de [Hainrixz/open-carrusel](https://github.com/Hainrixz/open-carrusel) por Enrique Rocha (tododeia), MIT License. El trabajo original incluye la arquitectura base (Claude CLI subprocess, wrapSlideHtml, JSON storage con async-mutex, export con Puppeteer, editor three-panel). Las adiciones de este fork (multi-brand, multi-account, multi-network, destinos de publicación, Telegram integration) están bajo la misma licencia MIT.