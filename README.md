# images-social-media-posters

### Estudio local para crear posts de redes sociales con IA — multi-marca, multi-cuenta, multi-red.

**Chatea con Claude. Diseña posts y carruseles. Publica a Telegram o exporta a PNG.**

Fork extendido de [Open Carrusel](https://github.com/Hainrixz/open-carrusel), evolucionado para manejar **múltiples marcas con múltiples cuentas en múltiples redes sociales**.

---

## ¿Qué hace distinto a este fork?

El Open Carrusel original es un constructor brillante de carruseles de Instagram para una sola marca. Este fork lo lleva más allá para creadores que manejan varios proyectos al mismo tiempo:

- **Multi-marca y multi-cuenta** — gestiona todas tus marcas (ej. proyecto personal, agencia, cuentas de clientes) con el patrón de organización de Meta Business Suite: marcas que agrupan cuentas, cuentas que viven en redes concretas.
- **Multi-red social** — Instagram, Facebook, TikTok, LinkedIn, X, Pinterest incluidas de fábrica. Añade cualquier red custom desde la UI con sus propias dimensiones.
- **Posts de una imagen además de carruseles** — no todo es carrusel; a veces solo quieres un post único.
- **Publicación a Telegram** — configura un bot una vez y manda tus posts/carruseles directo a tu chat, canal privado, o grupo de equipo.
- **Todo dinámico** — añades marcas, cuentas, redes sin tocar código. Los IDs son opacos, los nombres son datos.

Todo lo demás del original se preserva: local-first, open source MIT, Claude CLI como agente, slides como HTML, export pixel-perfect con Puppeteer.

---

## Estado del proyecto

🚧 **En desarrollo activo.** Este fork sigue el [`ROADMAP.md`](./ROADMAP.md) con 5 fases principales:

1. Single-image posts ← *próxima*
2. Catálogo dinámico de redes
3. Marcas y cuentas (la migración grande)
4. Destino Telegram
5. Pulido y detalles de workflow

Mientras tanto, el código base hereda **toda la funcionalidad de Open Carrusel** y funciona igual que el original.

---

## Quickstart

> Primer arranque: ~2 minutos (Puppeteer descarga Chromium la primera vez).

```bash
git clone https://github.com/dahored/images-social-media-posters.git
cd images-social-media-posters
claude           # abre Claude Code
/start           # instala, siembra data, corre servidor, abre browser
```

Si no usas Claude Code, el camino manual:

```bash
npm run setup
npm run dev
```

Necesitas tener Node 20+ y [Claude Code](https://docs.anthropic.com/en/docs/claude-code) autenticado para que funcione el agente de chat interno. El editor y el export de PNGs funcionan sin Claude Code.

---

## Cómo funciona (versión corta)

1. Seleccionas (o creas) una **marca** → dentro de ella seleccionas (o conectas) una **cuenta** en una red concreta.
2. Dentro de la cuenta, creas un **post** (una imagen) o un **carrusel** (2-10 slides).
3. Chateas con Claude: *"Hazme un post cuadrado con la oferta de 3x2 para el lanzamiento"*. Claude entiende la red, las dimensiones, el branding de esa cuenta.
4. Previsualizas, ajustas slide por slide, reordenas.
5. Le das **Publicar** y eliges destino: descargar ZIP de PNGs, o enviar a Telegram.

Para la arquitectura técnica completa, ver [`CLAUDE.md`](./CLAUDE.md).

---

## Tech stack

Mismo que el original:

- **Framework**: Next.js 16 (Turbopack) + React 19
- **Lenguaje**: TypeScript 5
- **Estilos**: Tailwind CSS v4
- **UI**: Radix UI, lucide-react
- **Drag & drop**: @dnd-kit
- **Agente IA**: Claude CLI como subproceso
- **Export de imagen**: Puppeteer + Sharp
- **Zipping**: Archiver
- **Storage**: JSON + async-mutex
- **Nuevo**: `ulid` para IDs opacos, `node-fetch` para la API de Telegram

---

## Estructura

Para la estructura completa de carpetas y la API, ver [`CLAUDE.md`](./CLAUDE.md).

Resumen de dónde viven las cosas:

- **Código**: `src/` (app, components, lib, types)
- **Datos del usuario**: `data/` (gitignored — tus marcas, cuentas, posts, carruseles)
- **Uploads**: `public/uploads/` (gitignored — logos, imágenes de referencia)
- **Scripts**: `scripts/` (setup, doctor, migraciones, seeds)
- **Docs para Claude Code**: `CLAUDE.md` + `ROADMAP.md`

---

## Comandos (Claude Code slash commands)

| Comando | Qué hace |
|---|---|
| `/start [port]` | Instalar + seed + run + abrir browser |
| `/stop [port]` | Matar dev server |
| `/reset` | Borrar `/data/` y `/public/uploads/`, re-sembrar defaults |
| `/doctor` | Diagnóstico del entorno |
| `/seed-demo` | Crear marca + cuentas demo con contenido de ejemplo |

---

## Contribuir

PRs bienvenidas. Antes de abrir una PR:

- `npm run doctor` y `npm run build` deben pasar limpio
- Seguir las convenciones del [`CLAUDE.md`](./CLAUDE.md)
- No tocar `wrapSlideHtml()` en `src/lib/slide-html.ts` sin testear el round-trip preview ↔ export

Buenas primeras contribuciones: tasks del roadmap, más redes sociales en el catálogo seed, presets de branding para categorías comunes (gaming, fashion, tech), traducciones.

---

## Créditos

Este proyecto es un fork de [**Open Carrusel**](https://github.com/Hainrixz/open-carrusel) por [Enrique Rocha / tododeia](https://www.tododeia.com), MIT License. Toda la arquitectura base (Claude CLI subprocess, `wrapSlideHtml`, JSON storage con async-mutex, export con Puppeteer, editor three-panel, CSS-first animations estilo Emil Kowalski) es trabajo del autor original.

Las adiciones de este fork (modelo multi-brand / multi-account, catálogo dinámico de redes, posts de una sola imagen, destinos de publicación, integración con Telegram) están bajo la misma licencia MIT.

**Si este fork te sirve:** también dale una estrella al [proyecto original](https://github.com/Hainrixz/open-carrusel) — es la forma de reconocer el trabajo en el que esto se basa.

---

## Licencia

[MIT](./LICENSE) — haz lo que quieras con esto. Atribución apreciada, nunca requerida.

---

Construido por [MyAppCube](https://github.com/dahored) sobre los hombros de [tododeia](https://www.tododeia.com).