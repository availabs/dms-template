# Lingua — Design System v0.2

> Second-pass DMS-shaped design system for **Lingua**, translating the
> v0.2 brand brief into the structure prescribed by
> `src/dms/skills/designing-a-dms-design-system.md`.
>
> v0.2 · 2026-05-24 · modern technical product, pivoted from the v0.1
> magazine direction.

## What changed from v0.1

v0.1 framed Lingua as a *literary magazine* — warm cream paper, italic
Fraunces, drop-caps, square corners, anti-tech-startup, generous
editorial space. That direction made Lingua read as a *publication*
rather than a *platform*, and the resulting design system landed too
close visually to Tessera (which is also an editorial-serif paper-
feeling brand).

v0.2 reframes Lingua as a **modern technical product** taking cues from
[hex.tech](https://hex.tech), [zed.dev](https://zed.dev), and
[warpstream.com](https://www.warpstream.com):

| Axis | v0.1 (retired) | v0.2 (current) |
|---|---|---|
| Mood | Literary magazine, "paper at night" | Modern developer-product |
| Surfaces | Warm cream `#FBF7F0` paper | Pure white `#FFFFFF` + zinc grays |
| Primary type | Fraunces (editorial serif) | Inter Tight (grotesque sans) |
| Accent | Oxide/terracotta + italic display moments | Lingua blue `#3B5BFF` (electric ultramarine) |
| Corners | Square (radius 0) default | Rounded (4 / 6 / 8 / 12) |
| Shadows | Forbidden (one barely-visible lift) | Tiered (`sm` / `md` / `lg`) and welcome |
| Body size | 17px (publication) | 16px (developer-product) |
| Brand signature | Italic pull quotes, drop-caps | Dark code blocks, terminals, architecture diagrams, live activity feed |
| Reference brands | The Drift, n+1, The Believer, Granta | Hex, Zed, Linear, Vercel, Warpstream, Resend |

The lingua-franca essence survives — the brand is still about the
*shared row format that lets unlike communities compose*. But it's
now expressed through the **clarity of a well-designed developer
tool**, not the *texture of a literary journal*.

Editorial moments still exist (the Theory essay page uses Fraunces
Italic for its hero and pull quotes) — but they are *accents inside a
sans-serif brand*, not the default voice.

## What's in this folder

```
design_system/
├── README.md            ← this file
├── _shared.css          ← brand foundation (CSS variables, fonts, surface utilities)
├── design-system/       ← FIVE DMS-shaped docs pages
│   ├── _dms-page.css       shared chrome — DMS layout/group/section classes,
│   │                       type tokens, all primitive component classes
│   ├── theme.html          foundation tokens — color (incl. dark code surface),
│   │                       type (16 tokens), icons, spacing, radii, elevation, motion
│   ├── layouts.html        Layout + LayoutGroup variants (incl. new `dark` band) —
│   │                       page CHROME shapes, the bands that stack down a page
│   ├── grid.html           the page-content column grid (12-col sectionArray) —
│   │                       the lattice every Section snaps to inside any LayoutGroup
│   ├── components.html     every UI primitive — incl. v0.2 brand-signature primitives
│   │                       (code block, terminal, architecture diagram, live activity,
│   │                       KPI strip, customer logo strip, command palette)
│   └── patterns.html       composed multi-primitive patterns
└── pages/               ← EIGHT example pages
    ├── marketing-homepage.html   Hex-style hero + product mock + dark code band + logo strip
    ├── marketing-comparison.html Warpstream-style side-by-side architecture diagrams
    ├── marketing-theory.html     the one editorial-Fraunces moment in the system
    ├── docs-page.html            Vercel-style 3-pane docs with prominent code blocks
    ├── civic-overview.html       Sullivan County mitigation dashboard, treated as a
    │                             serious technical product (not a government PowerPoint)
    ├── product-site-overview.html admin "Site overview" for The Drift, with KPIs + live activity
    ├── product-page-editor.html   3-pane page editor with section list, preview, inspector
    └── product-dataset-view.html  filterable table + schema + downstream patterns
```

## How to view

Open any HTML file in a browser. No build step. Google Fonts are
loaded over the network for Inter Tight, JetBrains Mono, and Fraunces
(the last is used only on `marketing-theory.html`).

Suggested reading order:

1. `design-system/theme.html` — orientation: the brand's vocabulary.
2. `design-system/layouts.html` — the page chrome (Layout + LayoutGroup variants).
3. `design-system/grid.html` — the page-content column grid (sectionArray).
4. `design-system/components.html` — every leaf primitive.
5. `design-system/patterns.html` — primitives composed.
6. `pages/marketing-homepage.html` — the brand at full strength.
7. `pages/marketing-comparison.html` — the architecture-diagram move.
8. `pages/marketing-theory.html` — the one editorial moment.
9. The remaining five product/docs/civic pages in any order.

### Layouts vs grid — which is which

The design system splits two different structural concerns into two
separate pages, and it's worth keeping them straight:

- **`layouts.html`** documents the page **chrome** — Layout
  variants (`default`, `app`, `bare`) and LayoutGroup variants
  (`content`, `header`, `auth`, `footer`, `dark`). These are the
  **bands that stack down a page**: which navs render, which
  surface a band uses, whether it's boxed or full-bleed.
- **`grid.html`** documents the page-content **column grid** that
  Sections lay on — the 12-column `sectionArray` lattice inside any
  LayoutGroup. The grid is the **horizontal** vocabulary: which span
  (`12`, `8`, `6`, `4`, `3`, or fractional aliases like `1/2`,
  `1/3`) each Section claims of the row.

A reviewer who only reads one of the two pages will be missing half
the platform's structural story. Read both.

## Navigation

Per `src/dms/skills/designing-a-dms-design-system.md` §7.0, every
file in `design-system/` and `pages/` includes:

- A **meta-nav strip** at the top of `<body>` (on the dark code
  surface, matching the brand's contrast move) with links to all 5
  design-system pages and all 8 example pages. The current page is
  marked active (Lingua-blue tint).
- A **footer link block** repeating the same index in a 3-column
  layout (brand · System · Pages).

Verified: every one of the 13 pages reaches every other in one
click, with zero broken hrefs across the 15 files.

## Brand summary

**Essence:** modern technical product. ~80% light surface + ink type.
~15% dark code/terminal surface (the brand's contrast move). ~5% one
accent color: Lingua blue.

**Type system (16 tokens, 5 roles):**
- `display` (5) — Inter Tight 600/700, tight tracking. Hero, page
  titles, KPI values.
- `heading` (3) — Inter Tight 600. h2/h3/h4 inside content.
- `prose` (4) — Inter Tight 400. Ledes, body (16px base), captions.
- `mono` (3) — JetBrains Mono. Code, labels, KPI numerics, timestamps.
- `editorial` (2) — Fraunces Italic. **Theory page only.**

**Color:**
- `surface` (#FFFFFF) / `surface-soft` (#F7F7F8) / `surface-sunken` (#F1F1F3) / `border` (#E4E4E7)
- `ink` (#18181B) / `ink-soft` (#3F3F46) / `mute` (#71717A)
- `accent` (#3B5BFF) · **Lingua blue** — the brand
- `signal` (#FF5630) · `margin` (#FFC83D) · `success` (#14B881) — status only
- `code-bg` (#0E0F12) — deep slate code surface

**Foundations:**
- Rounded corners by default. 4px on small chrome, 6px on buttons/
  inputs, 8px on cards, 12px on modals, full-pill on pills.
- Three soft shadow tiers (`sm` for cards, `md` on hover/popover,
  `lg` for modals). Neutral, never coloured.
- 4px-base spacing scale, 12 steps from 4 to 160.
- 1280px max content width, 720px max long-form measure.
- Snappy motion (120–280ms). No looping background animation.
- Subtle single-hue gradients allowed (accent → accent-hover);
  rainbows and frosted glass are not.

**Brand-signature primitives (new in v0.2):**

| Primitive | Class | Where used |
|---|---|---|
| Code block | `.ling-code` | At least once per marketing page. Dark surface + chrome (filename + Copy) + syntax highlighting. The defining visual move. |
| Terminal | `.ling-terminal` | Homepage CLI demo, comparison page export demo, product overview quick-actions. macOS-style dots + prompt + output + blinking cursor. |
| Architecture diagram | `.ling-arch` + `.ling-arch__node` | Comparison page (centerpiece), homepage, patterns. Boxy rounded nodes with accent / dark variants. |
| Live activity feed | `.ling-activity` | Homepage + site overview. Avatar + verb-in-accent + mono timestamp rows. |
| KPI strip | `.ling-kpi` | Site overview + civic dashboard. Large mono tabular values with deltas. |
| Customer logo strip | `.ling-logos` | Homepage. Partner brand names in their representative colors (per Warpstream convention). |

## Fonts

Google Fonts substitutes for the brief's commercial picks:

| Brief calls for | This folder ships | Loaded via |
|---|---|---|
| Söhne / ABC Diatype / Geist (display + body) | **Inter Tight** | Google Fonts CDN |
| Söhne Mono / Berkeley Mono / Geist Mono | **JetBrains Mono** | Google Fonts CDN |
| Reckless / GT Alpina (editorial, Theory only) | **Fraunces** | Google Fonts CDN |

Swap `@import` URLs in `_shared.css` when licensed faces are acquired
— no other tokens need to change.

## What's outside this folder but related

| Path | Role |
|---|---|
| `research/dms product/brand-lingua.md` | The v0.2 brand brief that drove every decision here. |
| `research/dms product/positioning-v2.md` | Product positioning (what Lingua is). |
| `src/dms/skills/designing-a-dms-design-system.md` | The contract: the folder structure, the four-page docs principle, the meta-nav requirement, the plain-HTML+CSS implementation rule. |
| `src/dms/skills/translating-design-system-to-dms-theme.md` | The next step (v0.3): how this folder becomes a runnable `theme/theme.js`. |
| `src/themes/tessera/design_system_v2/` | A sibling design system in a different brand voice — useful for visual contrast with this one. |

## How to use it

For a live DMS site that wants this theme (future work — v0.3):

1. Translate this folder into a `theme/theme.js` per
   `src/dms/skills/translating-design-system-to-dms-theme.md`.
2. Wire that file into `src/themes/index.js`.
3. Promote `accent`, `signal`, `margin`, `success`, `ink`, `surface`
   to named colors in the project's `tailwind.config.js`; map
   `font-display` and `font-sans` → Inter Tight, `font-mono` →
   JetBrains Mono, `font-editorial` → Fraunces.
4. Set a site's `theme_id` to point at `lingua`.

For a design pass refining or extending this work:

1. Read `src/dms/skills/designing-a-dms-design-system.md` first.
2. Read this file and the brand brief.
3. Open the four `design-system/` pages and 2-3 example pages to see
   the visual language at work.
4. Use the type-token earn-a-token rule (see `theme.html#type`)
   before adding any 17th token.

## What's deliberately out of scope for v0.2

- **Söhne / ABC Diatype / Berkeley Mono.** Brief calls these out as
  upgrade targets; v0.2 ships Inter Tight / JetBrains Mono as free
  substitutes. Drop replacement `@font-face` declarations into
  `_shared.css` when licensed.
- **Custom drawn icon set.** v0.2 uses inline SVGs drafted to
  Lucide/Phosphor proportions (1.5px stroke, 24px grid).
- **Full dark mode.** v0.2 is light-mode first with the dark code
  surface as a contrast band. Tokens are reserved in `_shared.css`
  (`--color-surface-dark`, `--color-ink-dark`, etc.) for a v0.3
  full-theme deliverable. Dark mode is not "inverted paper" — it's
  the same crisp aesthetic with deep slate surfaces and a more
  luminous accent blue.
- **The runnable theme.** This folder is the visual / structural
  source-of-truth; the `theme/theme.js` overlay is a v0.3 deliverable.
- **CLI design treatment.** v0.2 ships terminal-pane *visuals* as
  part of the marketing surface but doesn't design the real CLI
  output yet. v0.3 work.
- **Real graph / map component themes for production.** Charts and
  the map placeholder ship as styled SVG mockups in the brand
  palette; full chart + MapLibre style work is v0.3.

## Why this many example pages

Per the design skill §7.6, the number of example pages a theme ships
is the theme's choice. Lingua's brief explicitly names four
templates the system must support (radio station, civic dashboard,
heavy analytics, documentation), plus marketing surfaces (homepage,
comparison, theory). Lingua v0.2 ships eight pages spanning that set
to show the brand surviving a wide range of contexts — and to
demonstrate that the dual-author claim works visually: marketing
copy, code samples, product chrome, and civic data all in the same
brand.

## Counts

- 15 files
- 13 mutually-navigable pages (5 docs + 8 examples)
- 16 declared type tokens
- 12 color tokens (4 surface, 4 ink, 4 accent, 3 status, 6 code) + dark-mode reservations
- 6 brand-signature primitives new in v0.2
