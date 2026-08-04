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
├── ds-nav.js                         ← the floating nav widget, shared by every page
│                                       section-contextual: lists the current section's
│                                       pages + one jump link per other section
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
│   ├── actions-location-overview.html  MapLibre map (donut clusters by status) + statewide exec summary
│   ├── datasets-files.html             the datasets pattern
│   ├── site-management*.html           admin surfaces
│   └── county-actions/               ← COUNTY ACTIONS WORKFLOW — one linked 5-page flow
│       ├── dashboard.html              1 · county actions dashboard (stats + needs-attention + map + table)
│       ├── jurisdictions.html          2 · pick a jurisdiction, or take the whole county
│       ├── workspace.html              3 · prioritization worklist + create-action modal
│       ├── action-view.html            4 · read one action (redesign of the live /actions/view)
│       └── action-edit.html            5 · edit one action (same IA, editable + sticky save bar)
├── reports/                          ← data-analysis reports (NOT for DMS migration)
│   ├── actions-qa.html                 actions data-quality / location-precision audit
│   ├── duplicate-actions.html          same-place redundant rows — cause + safe-to-delete case
│   ├── boilerplate-actions.html        cross-jurisdiction template reuse — where + how to shape it
│   └── location-from-text.html         recovering site coords from action text (mining the descriptions)
├── assets/mny/                       ← logo, topolines, hazard glyphs, county art
└── references/                       ← original Figma handoff exports (read-only)
    └── MitigateNY UX_UI [...]/*.jpg
```

> **`reports/` vs `pages/`.** `pages/` holds product-surface mockups meant to be built as real DMS
> pages. `reports/` holds standalone **analysis outputs** — HTML that renders a data finding for a
> human, never intended to migrate to DMS. They still wear the mny brand (same tokens, hero, nav
> widget) so a finding reads like part of the product.
>
> The three `reports/*.html` are backed by **real data** — every number comes from
> `references/actions/` (analysis scripts in `references/actions/scripts/`, findings in
> `references/actions/report/actions-data-quality.md`), not from placeholder copy.
> `pages/actions-location-overview.html` loads MapLibre GL + the generated
> `assets/mny/data/actions_locations.geojson`, so it (and the reports, for their relative asset
> links) must be viewed over a local server (`python3 -m http.server` in `design/`), not `file://`.
> The same applies to `pages/county-actions/dashboard.html`, which fetches
> `assets/mny/data/sullivan_boundaries.geojson` and `sullivan_actions.geojson`.

---

## `ds-nav.js` — the nav widget

Every page in `design-system/`, `pages/` and `reports/` ends with one line:

```html
<script src="../ds-nav.js"></script>       <!-- ../../ from pages/county-actions/ -->
```

The widget is **section-contextual**, mirroring how a real DMS site navigates. It reads
`location.pathname`, finds which of the seven sections owns the current page, and renders:

1. **the current section, expanded** — its pages numbered in flow order, the current one
   highlighted in `yellow-700` on a `yellow-50` row;
2. **`jump to section`** — one link per *other* section, pointing at that section's landing
   page with its page count.

So the panel is 9–11 links instead of the 22-link flat dump the old inline widget carried, and
any page is at most two hops from any other. The sections are the site's real IA:

| Section | Folder | Landing |
|---|---|---|
| Design System | `design-system/` | `theme.html` |
| Public Site | `pages/` | `home.html` |
| Actions (Statewide) | `pages/` | `actions-dashboard.html` |
| County Actions Workflow | `pages/county-actions/` | `dashboard.html` |
| Site Management | `pages/` | `site-management-v2.html` |
| Authoring Reference | `pages/` | `page-templates.html` |
| Reports | `reports/` | `actions-qa.html` |

**Adding a page: add one line to that section's `pages` array in `ds-nav.js`, and the script tag
to the page.** Nothing else. A section's `dir` may be nested (`pages/county-actions`) — hrefs are
recomputed from the current page's depth, so no section needs to know where another one lives, and
the relative paths hold whether you serve `design/` as the root or open a file directly.

Widget styling stays out of `theme.js` — it is review scaffolding and never ships on a live site.

---

## `pages/county-actions/` — the County Actions Workflow

One **linked five-page flow**, not five independent mockups: a county planner moves
dashboard → jurisdictions → workspace → action view ⇄ action edit, and every page carries the
breadcrumb and footer index back out. It is the design for the live `actions` pattern
(`mitigat-ny-prod`, pattern `2265530`, base_url `actions`), whose `view` page is currently the
actions form transcribed as eight flat half-width Cards.

**Every number, name and quoted sentence on these five pages is real Sullivan County data** —
geoid `36105`, 475 actions across 23 jurisdictions, pulled from the DMS internal actions dataset
(source `1029065` / view `1074456`). Aggregates are baked by
[`references/actions/scripts/16_sullivan_map.mjs`](../../../../references/actions/scripts/16_sullivan_map.mjs)
into `references/actions/data/sullivan_stats.json`; re-run it to refresh them. The specimen action
on pages 4 and 5 is id `1100379` (*Delaware — Kohlertown Route 52, Culvert Issues*), prose verbatim.

**Layout rule for this section: one boxed `content` LayoutGroup per page, and nothing on the topo
canvas.** No page here uses an unboxed `header` or `footer` group — identity bands, stat strips and
the footer page index all sit inside the white surface with everything else, and the topo texture
shows only in the Layout's outer gutter. Only genuinely fixed chrome floats over the canvas (TopNav,
the `action-edit` sticky save bar, the design-system widget). Note the knock-on when copying patterns
out of these pages: chrome toned for the topo canvas (`bg-white` pills, `hover:bg-white`) goes
invisible on the white surface — the tinted `bg-mny-50` variants here are the version that reads.

Two facts the pages state rather than hide, because they shape the design:

- **County priority is unset on all 475 actions.** The workspace's progress meter is therefore
  empty by design — that is the job the page exists to do, not a placeholder.
- **Nothing in Sullivan has a site coordinate.** 472 mapped actions sit on 26 town/county
  centroids, so the dashboard map draws the **county outline and 21 jurisdiction polygons** under
  the donut clusters: the polygon is the real unit of precision, and the caveat panel says so.
  Ateres (Village) has 11 actions but no polygon in the NFIP layer, and is flagged as such.

Sullivan was chosen over higher-fill counties (Chemung, Niagara) for continuity with the existing
`actions-prioritize.html` / `actions-dashboard.html` mockups. Its trade-off: `estimated_cost` is
empty on every row and point-of-contact on 439 of 475, so pages 4–5 double as the reference for how
**empty** fields present (collapsed behind a "show 18 empty fields" toggle on view; dashed amber
`.mny-field-empty` inputs on edit).

Full rationale, per-page section tables and the figures: `planning/mitigateny/tasks/current/county-actions-workflow-design.md`.

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
