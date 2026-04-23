# Roadmap — images-social-media-posters

Plan de implementación por fases del fork de Open Carrusel. Cada fase es una entrega funcional autocontenida; puedes parar después de cualquier fase y tener una app útil.

Cada task tiene el contexto suficiente para pegárselo a Claude Code y pedirle que la implemente. Las referencias a archivos siguen la estructura definida en `CLAUDE.md`.

---

## Fase 0 — Bootstrap del fork

**Objetivo**: partir del código de Open Carrusel y prepararlo para la evolución sin romper nada.

### 0.1 Clonar y renombrar
- Clonar `Hainrixz/open-carrusel` localmente
- Actualizar el remote a `dahored/images-social-media-posters`
- Actualizar `package.json` → `"name": "images-social-media-posters"`
- Preservar atribución en LICENSE (MIT permite fork, buena práctica mantener copyright original + añadir el propio)

### 0.2 Reemplazar docs raíz
- Reemplazar `CLAUDE.md` con la versión extendida del fork
- Añadir `ROADMAP.md` (este archivo)
- Reemplazar `README.md` con la versión del fork (ver entregable separado)

### 0.3 Añadir utilidad de IDs
- Crear `src/lib/ids.ts` con `generateId(prefix: string): string` usando `ulid` (npm: `ulid`)
- Instalar dependencia: `npm install ulid`

### 0.4 Validar que todo sigue corriendo
- `npm run setup`
- `npm run dev` → debe abrir el proyecto original funcionando
- `npm run doctor` → debe pasar verde

**Criterio de aceptación**: el proyecto original corre igual que antes, pero ya está en tu repo con la nueva documentación.

---

## Fase 1 — Single-image posts

**Objetivo**: además de carruseles, poder crear posts de una sola imagen.

**Insight clave**: un post es un carrusel de 1 slide. No necesitamos un motor de rendering nuevo, solo generalizar el modelo y adaptar la UI.

### 1.1 Generalizar el tipo
- Crear `src/types/post.ts` con el tipo `Post` (1 slide HTML, ratio, caption, hashtags)
- Mantener `src/types/carousel.ts` separado (carruseles pueden tener features que posts no)
- Tipo discriminado `Content = Post | Carousel` con campo `kind: 'post' | 'carousel'`

### 1.2 CRUD de posts
- Crear `src/lib/posts.ts` con funciones `createPost`, `getPost`, `updatePost`, `deletePost`, `undoPost`
- Reutilizar `src/lib/data.ts` (writes atómicos, async-mutex)
- Crear API routes `/api/carousels/[id]/posts/*` siguiendo el mismo patrón que carousels (temporalmente, en Fase 3 se reorganiza bajo accounts)

### 1.3 UI: botón "Nuevo post"
- En el dashboard, añadir botón "Nuevo post" junto al de "Nuevo carrusel"
- Dialog de creación pide: título, ratio (1:1, 4:5, 9:16), red destino (por ahora solo Instagram)

### 1.4 Editor adaptativo
- Si el content activo es `kind: 'post'`, ocultar el `SlideFilmstrip`
- `CarouselPreview` pasa a ser `ContentPreview` con branch: single slide centrada (post) o carrusel con navegación (carousel)
- El export funciona igual: un PNG único (no ZIP) si es post

### 1.5 Chat context
- `chat-system-prompt.ts` recibe `contentKind` y adapta el prompt: si es post, Claude entiende que debe generar UNA slide completa y autocontenida

**Criterio de aceptación**: puedes crear un post de una sola imagen chateando con Claude, previsualizarlo, y exportarlo como PNG único.

---

## Fase 2 — Catálogo de redes

**Objetivo**: soportar dinámicamente cualquier red social, cada una con sus formatos y dimensiones.

### 2.1 Definir el tipo Network y el catálogo seed
- Crear `src/types/network.ts` con los tipos `Network`, `Format`, `AspectRatio` definidos en `CLAUDE.md`
- Crear `scripts/seed-networks.mjs` que genera `/data/networks.json` inicial con: Instagram, Facebook, TikTok, LinkedIn, X, Pinterest (ver dimensiones en `CLAUDE.md` cheat sheet)
- Cada red seed con `builtin: true`

### 2.2 CRUD de networks
- Crear `src/lib/networks.ts` con `listNetworks`, `getNetwork`, `createNetwork`, `updateNetwork`, `deleteNetwork`
- Las redes `builtin: true` solo permiten editar `defaultStyleHint`, no estructura
- API routes `/api/networks` y `/api/networks/[networkId]`

### 2.3 UI del catálogo
- Página `/settings/networks` con lista de redes del catálogo
- Botón "Agregar red custom" abre form: id (slug), displayName, icono (picker de lucide-react + opción "custom"), formatos soportados con sus ratios y dimensiones
- Permitir editar `defaultStyleHint` de cualquier red

### 2.4 Selector de red en creación de contenido
- Al crear post/carrusel: selector de red (dropdown con iconos), luego selector de formato disponible en esa red, luego selector de ratio
- Las dimensiones se toman del catálogo, no hardcodeadas
- `wrapSlideHtml()` recibe `{ width, height }` del ratio seleccionado

### 2.5 Chat adapta tono por red
- `buildSystemPrompt` incluye `network.defaultStyleHint` en el prompt
- Claude escribe slides adaptados: LinkedIn más profesional, TikTok más punchy, etc.

**Criterio de aceptación**: puedes crear un post de Facebook 1200×628, un carrusel cuadrado de LinkedIn, y agregar una red custom "Mi Red Loca" con ratio inventado, todo sin tocar código.

---

## Fase 3 — Marcas y cuentas (la migración grande)

**Objetivo**: reemplazar el `/data/brand.json` global por el modelo jerárquico Brand → Account.

Esta es la fase más invasiva. Hacerla en ramas separadas y con tests manuales.

### 3.1 Tipos y lib
- Crear `src/types/brand.ts` y `src/types/account.ts` con los tipos de `CLAUDE.md`
- Crear `src/lib/brands.ts` con CRUD completo
- Crear `src/lib/accounts.ts` con CRUD + helpers `getEffectiveBranding(accountId)` que merge brand default + account override

### 3.2 Migración de datos existentes
- Crear `scripts/migrate-to-multi-brand.mjs`: si encuentra `/data/brand.json` (estructura vieja), crea una brand "default" con ese branding y una account "default" de Instagram con todo el contenido existente movido a `/data/accounts/acc_<ulid>/`
- El script es idempotente: si ya corrió, no hace nada

### 3.3 API routes nuevas
- `/api/brands/*` — CRUD de brands
- `/api/accounts/*` — CRUD de accounts
- `/api/accounts/[accountId]/posts/*` — reemplaza `/api/carousels/[id]/posts/*`
- `/api/accounts/[accountId]/carousels/*` — reemplaza `/api/carousels/*`
- Dejar las viejas rutas con deprecation warning por 1-2 versiones, después eliminar

### 3.4 UI: selector de cuenta activa estilo Meta
- Componente `AccountSelector` en la top bar (posición top-left, como en Meta Business Suite)
- Dropdown con dos columnas: izquierda marcas, derecha cuentas de la marca seleccionada
- Búsqueda global integrada
- Botones "+ Nueva marca" y "+ Nueva cuenta"
- Guarda la cuenta activa en `localStorage` (persistencia entre sesiones)

### 3.5 UI: gestión de marcas
- Página `/brands` lista todas las marcas en grid
- Click en marca → página `/brands/[brandId]` muestra sus cuentas, permite editar branding default
- Botón "Eliminar marca" con confirmación y opción "mover cuentas a otra marca" o "eliminar cuentas también"

### 3.6 UI: gestión de cuentas
- Página `/accounts/[accountId]` = editor actual, pero scopeado a esa cuenta
- Settings de la cuenta: red (inmutable post-creación), handle, displayName, branding override, telegramChatId
- Botón "Duplicar cuenta" (útil para cuentas similares en distintas redes)

### 3.7 Chat context enriquecido
- `buildSystemPrompt` ahora recibe `{ brand, account, network, format, ratio }`
- El branding efectivo (merge brand + account override) entra al prompt
- Si la cuenta tiene handle `@myappcube`, Claude puede mencionarlo cuando tenga sentido (no siempre)

**Criterio de aceptación**: puedes crear 3 marcas con 2 cuentas cada una (una de IG y una de FB por marca), y cada cuenta tiene sus propios posts y branding independiente. El selector del top-bar permite cambiar entre ellas fluidamente.

---

## Fase 4 — Destino Telegram

**Objetivo**: publicar posts y carruseles directamente a Telegram desde la UI.

### 4.1 Tipo Destination y lib base
- Crear `src/types/destination.ts` con los tipos de `CLAUDE.md`
- Crear `src/lib/destinations.ts` con `publishToDestination(content, destination)`
- Soportar ya en v1: `download-zip` (refactor del export actual) y `telegram`

### 4.2 Setup de Telegram bot
- Página `/settings/telegram` con:
  - Input del `TELEGRAM_BOT_TOKEN` (se guarda en `/data/config.json`)
  - Input para `DEFAULT_CHAT_ID`
  - Botón "Probar conexión" que envía un mensaje de test
  - Link a la guía de cómo crear el bot con @BotFather
- Los campos son opcionales — si no están, Telegram no aparece como destino

### 4.3 Implementación de envío
- Crear `src/lib/telegram.ts` con:
  - `sendTextMessage(chatId, text)`
  - `sendPhoto(chatId, imagePath, caption?)` para posts
  - `sendMediaGroup(chatId, imagePaths[], caption?)` para carruseles (hasta 10 imágenes)
- Usar `node-fetch` o `fetch` nativo; la API de Telegram es HTTP simple, no requiere SDK
- Caption incluye: texto del usuario + hashtags + línea final con `🎨 via images-social-media-posters`

### 4.4 UI: botón "Publicar"
- En el editor, junto al botón "Exportar", un botón "Publicar"
- Al click, modal con los destinos disponibles según config:
  - Siempre: "Descargar ZIP"
  - Si Telegram configurado: "Enviar a Telegram — [chat name]" (usa el `telegramChatId` de la account si tiene uno, si no el default global)
  - Si la account tiene un chat específico + existe el default: mostrar ambas opciones
- Al confirmar, ejecuta el pipeline: export → publish → toast de resultado

### 4.5 Historial de publicaciones
- Cada post/carousel guarda `publishHistory: Array<{ destination, timestamp, success, messageId? }>`
- Página del contenido muestra las últimas publicaciones
- Útil para no duplicar envíos accidentalmente

**Criterio de aceptación**: creas un carrusel, le das "Publicar → Enviar a Telegram", y en menos de 5 segundos aparece el media group con sus 5 imágenes y caption en tu chat/canal.

---

## Fase 5 — Pulido

**Objetivo**: detalles que convierten la app de "funciona" a "se siente bien usarla".

### 5.1 Naming de exports
- Archivos exportados con sufijo: `{brandSlug}_{networkId}_{contentTitle}_{ratio}.{ext}`
- Ej: `myappcube_instagram_morning-habits_4x5.zip`

### 5.2 Templates con alcance
- Templates por cuenta (default)
- Opción "Template global" para que aparezca en todas las cuentas
- Opción "Template por marca" para que aparezca en todas las cuentas de una marca
- UI: tabs en la galería de templates

### 5.3 Seed demo (`/seed-demo`)
- Slash command que crea: 1 brand demo, 2 accounts (IG + LinkedIn), 1 post y 1 carousel de ejemplo en cada una
- Útil para probar la app al clonarla

### 5.4 Historial por cuenta
- Página `/accounts/[accountId]/history` con timeline de todos los posts/carruseles publicados
- Filtros: por red, por destino, por fecha

### 5.5 Duplicar entre cuentas
- En un post/carousel, botón "Duplicar en otra cuenta"
- Si las dimensiones de la cuenta destino son diferentes, Claude regenera las slides adaptadas

**Criterio de aceptación**: sientes que la app entiende tu workflow multi-marca, no que estás peleando con ella.

---

## Fase 6 (opcional, futuro) — Destinos avanzados

No urgente, pero la arquitectura ya lo soporta:

- **Webhook genérico** — útil para conectar con n8n/Zapier/Make
- **Meta Graph API** — publicación directa a Instagram Business/Creator + Facebook Pages
- **LinkedIn API** — publicación a perfiles personales y páginas de empresa
- **Pinterest API** — la más fácil de las APIs "reales"
- **Programar publicaciones** — con un scheduler que corre el bot de Telegram o las APIs directas a una hora específica

Cada uno es una PR independiente que agrega un tipo al discriminated union `Destination` y una función en `destinations.ts`. Cero impacto en las fases anteriores.

---

## Orden sugerido si vas con prisa

Si quieres valor rápido sin rediseñar todo: **Fase 1 → Fase 4 → Fase 2 → Fase 3 → Fase 5**.

- Con Fase 1 ya tienes posts sueltos (ganancia inmediata)
- Con Fase 4 ya publicas a Telegram desde el Open Carrusel original + posts (no necesitas multi-brand para que Telegram funcione)
- Después Fase 2 y 3 cuando tengas tiempo para el rediseño grande

Si prefieres hacer las cosas "bien" desde el inicio: **Fase 1 → 2 → 3 → 4 → 5**.

---

## Tips para trabajar con Claude Code

1. Al abrir una sesión, comparte con Claude Code ambos archivos: `CLAUDE.md` (contexto general) y el bloque de la fase actual de este `ROADMAP.md`.
2. Pídele que implemente **una sub-task a la vez** (ej. "implementa la 1.2 completa"), no la fase entera de golpe.
3. Después de cada sub-task, corre `npm run build` y `npm run doctor`. Si pasa, commit. Si no, dile a Claude Code qué falló y que lo arregle.
4. Para la Fase 3 (migración grande), trabaja en una rama `feature/multi-brand` y no mergees hasta que todo pase.
5. Mantén un archivo `NOTES.md` (gitignored) donde apuntes decisiones que tomaste sobre la marcha. Claude Code puede leerlo en futuras sesiones.