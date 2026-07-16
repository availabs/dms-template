# MitigateNY (mny) Design System

**Version:** 1.0  
**Date:** 2025-11  
**Source:** Figma handoff — MitigateNY UX/UI (Client Copy, Nov 12 2025)  
**Live reference:** https://mitigateny.org

---

## Brand Summary

MitigateNY is New York State's hazard mitigation planning platform — a serious public-information site for emergency managers, county planners, and citizens. The visual identity communicates authority, trust, and accessibility through a deep steel-blue palette, restrained use of amber/yellow as the sole warm accent, and Oswald (display) paired with Proxima Nova (body) as its two-family type system.

The defining surface texture is a topographic line-art background (topolines.png) used on the page canvas, masked behind a near-white or dark wash. Content lifts off this canvas on white rounded cards with a soft shadow.

---

## Folder structure

```
mny/design/
├── README.md                         ← this file
├── theme/
│   └── index.css.additions           ← @font-face aliases + brand surface utilities
│                                       canonical source; linked by all mockup pages
├── design-system/                    ← five DMS-shaped documentation pages
│   ├── theme.html                      color / type / icons / spacing / shadows
│   ├── layouts.html                    Layout + LayoutGroup variants (page chrome)
│   ├── grid.html                       sectionArray column grid
│   ├── components.html                 every UI primitive skinned in the mny brand
│   └── patterns.html                   composed multi-primitive patterns
├── pages/                            ← example product surfaces in the mny brand
│   ├── home.html · home-v2.html        public landing
│   ├── section-landing.html            a topic landing page
│   ├── actions-dashboard.html          action tracking for one county
│   ├── actions-prioritize.html         prioritize actions — list/worklist view (stat strip + filter bar + editable table)
│   ├── actions-prioritization.html     prioritize actions — card view (tiers across counties)
│   ├── actions-qa.html                 actions data-quality / location-precision audit
│   ├── actions-location-overview.html  MapLibre map (donut clusters by status) + statewide exec summary
│   ├── datasets-files.html             the datasets pattern
│   └── site-management*.html           admin surfaces
├── assets/mny/                       ← logo, topolines, hazard glyphs, county art
└── references/                       ← original Figma handoff exports (read-only)
    └── MitigateNY UX_UI [...]/*.jpg
```

> `pages/actions-qa.html` and `pages/actions-location-overview.html` are backed by real data —
> every number and the map's 17,769 points come from `references/actions/` (see
> `report/actions-data-quality.md`), not from placeholder copy. The overview page loads MapLibre GL
> + the generated `assets/mny/data/actions_locations.geojson`, so it must be viewed over a local
> server (`python3 -m http.server` in `pages/`), not opened as a `file://`.

---

## Color tokens

| Token name       | Hex       | Role                                    |
|------------------|-----------|-----------------------------------------|
| `blue-900`       | `#2D3E4C` | ink — headings, section titles          |
| `blue-700`       | `#37576B` | body text, icons, links                 |
| `blue-400`       | `#6D96AE` | secondary accents, placeholder text     |
| `blue-200`       | `#C5D7E0` | dividers, tag backgrounds, borders      |
| `blue-100`       | `#E0EBF0` | hover tints, submenu backgrounds        |
| `blue-50`        | `#F3F8F9` | table header bg, subtle section fills   |
| `yellow-700`     | `#EAAD43` | primary CTA, heading underline accent   |
| `yellow-500`     | `#F1CA87` | softer accent, save buttons             |
| `yellow-50`      | `#FCF6EC` | accent tint background                  |
| `white`          | `#FFFFFF` | cards, nav, overlays                    |
| `page-bg`        | `#F4F4F4` | topo-textured canvas base               |
| `red-700`        | `#AA2E26` | danger dark                             |
| `red-500`        | `#DD524C` | error / cancel / delete                 |
| `orange-400`     | `#EA8954` | warning / high-risk indicator           |
| `green-700`      | `#54B99B` | success / very-low-risk indicator       |

---

## Type tokens (textSettings)

Two font families: **Oswald** (display, always uppercase) and **Source Sans 3** proxy for **Proxima Nova** (prose).

| Token          | Family      | Size  | Weight | lh    | Other          | Role                          |
|----------------|-------------|-------|--------|-------|----------------|-------------------------------|
| `displayHero`  | Oswald      | 96px  | 500    | 95%   | uppercase, -track | Hero KPI numbers, splash heads |
| `displayXL`    | Oswald      | 72px  | 500    | 100%  | uppercase      | Large stat banners            |
| `displayLG`    | Oswald      | 60px  | 500    | 100%  | uppercase      | Section number callouts       |
| `displayMD`    | Oswald      | 48px  | 500    | 100%  | uppercase      | Feature headings              |
| `displaySM`    | Oswald      | 36px  | 500    | 100%  | uppercase, -track | H1 page titles             |
| `displayXS`    | Oswald      | 30px  | 500    | 100%  | uppercase, -track | H2 / sub-headings           |
| `metaLG`       | Oswald      | 24px  | 500    | 100%  | uppercase      | Card section titles           |
| `metaMD`       | Oswald      | 16px  | 500    | 100%  | uppercase      | Table headers, eyebrows       |
| `metaSM`       | Oswald      | 14px  | 500    | 100%  | uppercase      | Column headers, labels        |
| `metaXS`       | Oswald      | 12px  | 500    | 100%  | uppercase      | Pagination, micro labels      |
| `proseLG`      | Proxima Nova| 20px  | 400    | 140%  |                | Lead body text                |
| `prose`        | Proxima Nova| 16px  | 400    | 140%  |                | Body text (base)              |
| `proseSM`      | Proxima Nova| 14px  | 400    | 140%  |                | Table cells, captions         |
| `proseXS`      | Proxima Nova| 12px  | 140%   |       |                | Attribution, footnotes        |

Modifier axes (not separate tokens): color (`text-[#37576B]` / `text-white`), weight (`font-semibold`/`font-bold`), italic, `uppercase`, `tabular-nums`.

---

## Radius

- `rounded-sm` (2px) — tooltip/legend chips, input chips
- `rounded-[12px]` — cards, nav panels, table containers, overlays
- `rounded-full` (1000px) — buttons, pill tags, input fields

---

## Shadows

- `mny-shadow-sm` — `0px 0px 6px 0px rgba(0,0,0,.02), 0px 2px 4px 0px rgba(0,0,0,.08)` — cards, form elements
- `mny-shadow-md` — `0px 0px 4px 0px rgba(0,0,0,.04), 0px 4px 8px 0px rgba(0,0,0,.06)` — layout white-card panels

---

## Layout choices

- Max page width: **1440px** (`max-w-[1440px] mx-auto`)
- Content cap (centered sectionArray): **1020px** (`max-w-[1020px] mx-auto`)
- Side gutters: `md:px-4 xl:px-[64px]` (16px → 64px)
- TopNav: **floating** — fixed, rounded at md+, 80px height, white bg, shadow
- SideNav: optional (compact 302px or icon-only 64-84px strips)
- LayoutGroup content wrapper: `pt-[118px]` offset to clear the floating nav

---

## What this theme is designed for

✅ Public information / risk-assessment dashboards  
✅ Data-heavy pages with tables, statistics, and hazard cards  
✅ Long-form content with typographic hierarchy  
✅ Map workbench pages  
✅ Auth (sign-in) pages  

Not designed for: print-first layouts, dark-mode-first surfaces.

---

## Translation

Hand this design system to `translating-design-system-to-dms-theme.md` to produce the
runnable `theme/theme.js` overlay. The current `src/themes/mny/theme.js` is the live
production theme and can be reconciled against the design system specification here.
