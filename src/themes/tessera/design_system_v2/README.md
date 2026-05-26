# Tessera — Design System v2

> First-pass DMS-shaped design system for **Tessera**, translating the
> v0.1 Claude design template (in `../Tessera Design System/`) into the
> structure prescribed by `src/dms/skills/designing-a-dms-theme.md`.
>
> v2 · 2026-05-22 · Tessera brand, applied to the DMS UI kit.

## What's in this folder

```
design_system_v2/
├── README.md            ← this file
├── theme/               ← the shipped code artifact
│   ├── theme.js             re-export of ../../tessera-theme.js
│   ├── icons.js             name → React-component map (Lucide-backed)
│   ├── tailwind.additions.js suggested tailwind.config extensions
│   ├── icons/                custom SVGs (empty in v0.1)
│   └── README.md
├── design-system/       ← FIVE DMS-shaped docs pages
│   ├── theme.html           foundation tokens (color, type, icons, spacing, radii, elevation)
│   ├── layouts.html         Layout + LayoutGroup variants with diagrams (page chrome shapes)
│   ├── grid.html            the page-content column grid (sectionArray, 12 columns)
│   ├── components.html      every UI primitive themed
│   ├── patterns.html        composed multi-primitive patterns
│   └── _dms-page.css        shared chrome for the five pages
└── pages/               ← OPTIONAL example page(s) — theme's choice
    └── civic-overview.html  Sullivan County mitigation overview
                              (a MitigateNY-shaped surface)
```

## What's outside this folder but related

| Path | Role |
|---|---|
| `../tessera-theme.js` | **The actual DMS theme file.** Imported by `src/themes/index.js`; what the live DMS site consumes. This folder's `theme/theme.js` re-exports it. |
| `../Tessera Design System/` | The v0.1 design template by Claude design — CSS tokens, fonts, logos, atomic preview cards, three full UI kits (marketing, product, docs). This folder is the v2 translation into DMS-shape; the v0.1 template is preserved alongside. |
| `../Tessera Design System/colors_and_type.css` | Design tokens (CSS variables) consumed by every page in this folder. |
| `../Tessera Design System/fonts/` | Webfonts (Newsreader, IBM Plex Sans, IBM Plex Mono). |
| `../Tessera Design System/assets/logos/` | Logo lockups (wordmark, monogram, stacked, favicon). |
| `references/dms product/positioning-v2.md` | Product positioning (what Tessera is). |
| `references/dms product/brand-tessera.md` | Brand brief (aesthetics, voice, anti-patterns). |
| `src/dms/skills/designing-a-dms-theme.md` | Design contract / skill (the folder structure and DMS-shaped-pages principle this v2 honours; **mandates plain HTML + Tailwind CDN for mockup pages — no JSX, no build step**). |

## How the three folders relate

- **`theme/`** — the **shipped code artifact**. JS, icons, Tailwind
  additions. What ends up in `src/themes/<brand>/` for a production
  consumer.
- **`design-system/`** — **introspective documentation pages.** Five
  DMS-shaped pages that document the theme on its own terms. Each page
  is laid out as a real DMS page (Layout > LayoutGroup > Section), so
  the design system documents itself using the platform it documents.
- **`pages/`** — **optional example page(s)** demonstrating what this
  theme is *for*. Theme's choice; not a mandated stress-test set. The
  Tessera brand emphasises architectural / civic / durable — so the one
  example page is a Sullivan County mitigation overview, the shape of
  surface the brand is most clearly designed for.

## How to view

Open any HTML file directly in a browser — they're plain HTML with relative imports. There's no build step.

Try this order:

1. `design-system/theme.html` — orientation: see the brand's vocabulary.
2. `design-system/layouts.html` — the page chrome (Layout + LayoutGroup variants).
3. `design-system/grid.html` — the page-content column grid every section sits on.
4. `design-system/components.html` — every primitive.
5. `design-system/patterns.html` — primitives composed.
6. `pages/civic-overview.html` — the system applied to a real surface.

## How to use it

For a live DMS site that wants this theme:

1. Wire `../tessera-theme.js` into `src/themes/index.js`.
2. Apply `theme/tailwind.additions.js` to the project's
   `tailwind.config.js` (or accept the v0.1 use of Tailwind arbitrary
   values — see `theme/README.md`).
3. Load `../Tessera Design System/colors_and_type.css` (or its
   equivalent `@font-face` declarations) at the site level so the
   Newsreader / IBM Plex fonts are available.
4. Set a site's `theme_id` to point at `tessera`.

For a design pass refining or extending this work:

1. Read `src/dms/skills/designing-a-dms-theme.md` first.
2. Read this file and `theme/README.md`.
3. Open the five `design-system/` pages and the example page to see
   what's already covered.
4. The brand brief (`references/dms product/brand-tessera.md`) is the
   gospel for aesthetic decisions — anti-patterns, motion principles,
   colour ratios, voice.

## What's deliberately out of scope for v0.1

- **Tiempos Headline / GT Alpina.** Brief calls for these licensed
  faces; v0.1 ships **Newsreader** as the free substitute. Drop the
  woff2 files in `../Tessera Design System/fonts/` and update
  `colors_and_type.css` when licensed.
- **Custom drawn icon set.** v0.1 uses Lucide via `theme/icons.js`. A
  custom Phosphor-style drawn set can be commissioned and swapped in
  without re-keying.
- **Dark mode.** Tokens exist in `colors_and_type.css` (under
  `prefers-color-scheme: dark`) but no theme primitive ships a `dark`
  named variant in v0.1. A v0.2 task.
- **Stress-test pages for other shapes** (wcdb-shaped, NPMRDS-shaped,
  AVAIL-docs-shaped). Per the design contract §12.6, themes are
  *choices* and don't need to validate against every shape the platform
  supports. Tessera's example demonstrates its primary use case
  (civic / durable / architectural). The brand should add a second
  example page only if a clearly distinct use case wants showing.
- **Real graph / map component themes for production.** v0.1 ships
  placeholders matching the brand palette; full chart + MapLibre style
  work is a v0.2.
