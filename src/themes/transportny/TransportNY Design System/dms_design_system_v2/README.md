# TransportNY · DMS Design System v2

**v0.2 · 2026-05-26** · A second-pass DMS-format implementation of the
TransportNY brand. Translates the high-fidelity HTML/JSX prototypes in
`../design_handoff_transportny_design_system/` into the deliverable
shape mandated by the up-to-date DMS authoring skills.

> Reading order before changes:
>
> 1. [`src/dms/skills/designing-a-dms-design-system.md`](../../../../dms/skills/designing-a-dms-design-system.md) — the structural grammar this folder honors.
> 2. [`src/dms/skills/translating-design-system-to-dms-theme.md`](../../../../dms/skills/translating-design-system-to-dms-theme.md) — the per-primitive key checklist used to fill in `theme/theme.js`.
> 3. [`src/dms/skills/card-layout.md`](../../../../dms/skills/card-layout.md) — what every Card cell-/cards-grid knob does.
> 4. [`src/themes/CLAUDE.md`](../../../CLAUDE.md) — "configure the Card, don't write a new component."
>
> This folder honors the contract those skills describe — including the
> rule that every mockup page is **plain HTML + Tailwind CDN only**
> (no JSX, no React, no build step).

---

## What changed since v1

The first DMS pass (`../dms_design_system/`) shipped before the
authoring skills were finalised. v2 adds the structural pages, key
sets, and rules the skills now require:

1. **`design-system/layouts.html`** (new). The skill renamed the old
   `grid.html` (page-chrome shapes) to `layouts.html`. v1 only had
   the single page; v2 ships both `layouts.html` (chrome shapes) and
   a separate `grid.html` (the sectionArray column grid).
2. **`design-system/grid.html`** is now scoped strictly to the
   page-content column grid — `gridSize`, `defaultSize`, the `sizes`
   vocabulary, the `centered` max-width, `sectionPadding`,
   row-span vocabulary, and the in-editor grid overlay.
3. **`design-system/components.html` is comprehensive.** Every
   primitive listed in
   `src/dms/packages/dms/src/ui/components/` — not just the ones
   the handoff used — has at least one styled appearance. The
   handoff focused on the brand's *intended* primitives; v2 ensures
   the theme also looks coherent on the primitives an author might
   reach for that the handoff didn't explicitly depict (Drawer,
   Pagination, ButtonSelect, NavigableMenu submenus, Popup,
   DeleteModal, Logo lockups, Lexical full heading set, etc.).
4. **Every page in `pages/` is translated from the handoff.** The
   v1 deliverable shipped two example pages (landing + a dashboard);
   v2 covers every page in
   `design_handoff_transportny_design_system/pages/`:
   landing, login, getting-started, docs-overview, map-21,
   map-21-trend, floating-car, congestion, work-zones — plus the
   four design-system pages translated to v2 (theme, layouts, grid,
   components, patterns).
5. **Meta-nav strip on every page.** Per the updated skill (§7.0),
   every HTML file ships a top meta-nav and a footer link block that
   reaches every other page in the deliverable in one click.
6. **`textSettings` uses the universal `{role}{Size}[Variant]` pattern.**
   The display / displayItalic / prose / meta ladder lives alongside
   the legacy `textXS..text8XL` ladder so authors get clean brand
   names in the `valueFontStyle` dropdown without breaking older
   sections that pin a generic key.
7. **The sectionArray override pulls every gotcha.** `_replace:
   ['sizes']`, `gridSize: 12`, `defaultSize: '12'`, `layouts.centered:
   'max-w-[1480px] mx-auto'`, brand-colored edit-mode chrome. The
   handoff's pages were already 12-col-shaped; v2 makes that the
   theme contract.
8. **Lexical Approach B wired up.** `textSettings.options.slashKeys`
   lists the brand tokens that should appear in the `/Style:`
   slash menu; `lexical.heading_h1..h6` is set explicitly so the
   codebase default's `font-display` rule doesn't shadow the brand.

---

## Layout

```
dms_design_system_v2/
├── README.md              ← you are here
├── theme/                 ← the shipped code artifact
│   ├── theme.js               · DMS theme overlay (textSettings, layout, layoutGroup, every primitive, pages.*/datasets.*/auth.*)
│   ├── icons.js               · name → SVG-component map (~35 icons)
│   ├── icons/README.md
│   ├── tailwind.additions.js  · theme.extend snippet (brand colors, fontFamily, container widths)
│   ├── index.css.additions    · @font-face + .tny-* surface utilities
│   └── README.md
├── design-system/         ← FIVE pages documenting the brand
│   ├── _shared.css            · mirror of theme/index.css.additions for mockup pages
│   ├── theme.html             · color, type, icons, spacing — the foundational tokens
│   ├── layouts.html           · Layout + LayoutGroup variants (page chrome shapes)
│   ├── grid.html              · the page-content column grid (sectionArray)
│   ├── components.html        · every UI primitive THIS theme styles
│   └── patterns.html          · multi-primitive compositions
└── pages/                 ← every page from the handoff, translated to DMS shape
    ├── landing.html               · public marketing
    ├── login.html                 · sign-in / SSO
    ├── getting-started.html       · NPMRDS catalog
    ├── docs-overview.html         · long-form docs with TOC
    ├── map-21.html                · MAP-21 PM3 per-year deep-dive
    ├── map-21-trend.html          · MAP-21 PM3 multi-year trend
    ├── floating-car.html          · 50p speed report
    ├── congestion.html            · congestion report
    ├── work-zones.html            · work-zone report
    │   ── Freight Atlas (the 6 sitemap surfaces + per-dataset page) ──
    ├── freight-atlas-home.html    · public front door (Layout default: hero + audience doorways)
    ├── freight-atlas-map.html     · flagship interactive map (3-pane GIS workbench, vintage toggle)
    ├── freight-atlas-gallery.html · curated thematic presets → deep-link into the Atlas
    ├── freight-atlas-insights.html· six-goal dashboards + data stories (level-2 goal sub-nav)
    ├── freight-atlas-data.html    · data catalog (datasets pattern over npmrds2, category rail)
    ├── freight-atlas-dataset.html · single Source page (Overview/Table/Map/Metadata + downloads)
    ├── freight-atlas-about.html   · About & The Plan (six goals, report library, what-changed)
    │   ── Datasets (the datasets pattern as its own product surface) ──
    ├── datasets-catalog.html      · data catalog · rail + source cards (public + auth-gated admin)
    └── datasets-source.html       · single Source page · Overview tab (description, metadata, downloads)
```

The two `datasets-*.html` pages mock the **datasets pattern (DataManager) as its
own product surface** — the generic, un-skinned counterpart to the Freight-Atlas
pages above (which are the *public skin* of the same pattern). One surface serves
both roles: it reads as a public data catalog, and every admin affordance (New
source, per-card edit, the Admin tab, Add version, the hidden Sandbox / Data
Processing / Inactive category buckets) is the **same page** with `isUserAuthed()`-gated
chrome, tagged with the `admin` Pill. The catalog rail + source-card and the
source-page header/tabs/overview compositions are documented in
`design-system/patterns.html` (§08–09). Real `npmrds2` taxonomy from the
category-tagging pass: 49 production sources across 5 areas.

The seven `freight-atlas-*.html` pages are a fully-realized mockup of the
**redesigned NYS Freight Atlas** (the 2024 State Freight Plan tasks AVAIL
with modernizing it). They transcribe the agreed sitemap in
`references/freight atlas/02_SITEMAP_redesign.md` and use real plan data
(936.5M tons / $1,293.7B 2021; 37 bottlenecks; 1,145 mi PHFS; 216+47 truck
parking; NHFP $304M) and real `npmrds2` source names (`primary_freight_network`,
`truck_parking`, `major_ports`, `intermodal_facility`, `mpo_boundaries`, …).
They add no new primitives — every element appears in `components.html` /
`patterns.html`. Home uses Layout `default`; the six working surfaces share
one Freight Atlas SideNav on Layout `app`.

Every HTML file is **plain HTML5 + Tailwind via CDN + the brand's
`_shared.css`**. No JSX. No React. No build step. Open any file
directly in a browser (`python -m http.server` from the project root)
and edit it in a text editor — there is no toolchain.

Class strings are hard-coded from `theme/theme.js`. If you change a
value in `theme.js`, mirror the change in any mockup HTML that demos
the affected primitive. The trade-off is intentional — see
[`designing-a-dms-design-system.md` §8](../../../../dms/skills/designing-a-dms-design-system.md#8-implementation-rules-for-mockup-pages).

Each page is shaped as a real DMS page (`Layout > LayoutGroup >
Section > Component`) — wrappers carry `data-dms-layout`,
`data-dms-group`, and `data-dms-section` attributes so a reviewer
can see the structure. The four `design-system/` pages ship with
`dms-annotated` on `<body>` so the structural badges (`LAYOUT ·
GROUP · SECTION`) appear overlaid; `pages/` examples leave it off
so they read like real product surfaces.

---

## Mapping to the spec

| Spec section                  | This folder                                                                 |
|------------------------------|-----------------------------------------------------------------------------|
| §7 deliverable structure      | `theme/` + `design-system/` (5 pages) + `pages/` (9 handoff examples + 7 Freight Atlas) ✓ |
| §7.2 design-system/theme      | `design-system/theme.html` — brand, palette, data viz, surface, type, icons, elevation ✓ |
| §7.3 design-system/layouts    | `design-system/layouts.html` — hierarchy diagram + 3 Layout variants + 8 LayoutGroup variants + nesting + naming reference ✓ |
| §7.4 design-system/grid       | `design-system/grid.html` — `gridSize`, `defaultSize`, the `sizes` vocabulary, span examples, row-span examples, in-editor overlay, picker rules ✓ |
| §7.5 design-system/components | `design-system/components.html` — every primitive in `src/dms/packages/dms/src/ui/components/`, grouped by category ✓ |
| §7.6 design-system/patterns   | `design-system/patterns.html` — empty/loading/error/stale, data section with filters, card grid, form, auth, section toolbar, pattern-editor chrome ✓ |
| §7.7 pages/ (theme's choice)  | Every public-facing handoff page translated, including the dense product dashboards ✓ |
| §1 five-layer hierarchy       | Every mockup uses `<Layout>` → `<LayoutGroup>` → `<Section>` → primitive   |
| §10 done criteria             | Every primitive used in `pages/` is documented in `components.html`; every Section sits on the grid `grid.html` documents; TopNav/SideNav show ≥2 nesting levels with active + indicator states ✓ |

---

## Brand intent

TransportNY is a public-sector data platform for NYSDOT, MPOs, academic
partners, and the public — used for NPMRDS travel-time data, MAP-21 PM3
federal reporting, freight reliability, congestion, route analysis,
and work-zone monitoring.

The visual signature is:

- **Institutional, not playful.** Deep NYS blue (#1F3F8F), warm amber
  (#FACC15) for active state, persistent dark sidebar (#12181F), pale
  grey content pane (#ECEEF2).
- **Cards on pane.** Section bg is always the pane; content lives inside
  white cards with a hairline edge. Never `bg-white` on a section.
- **Editorial moments.** A warm bone surface (#F5F1E8) is reserved for
  printable narrative cards (jurisdictional profiles, public-read
  notices) — used sparingly.
- **Numbers are mono.** All KPI values and table cells use tabular-nums
  in `ui-monospace`. Oswald is reserved for headings and chrome;
  Proxima Nova / Source Sans 3 for running prose; never the reverse.
- **Tone-bar press.** Primary CTAs ship a 4px bottom edge that
  compresses to 2px on `:active` for an 80ms tactile press.

## Theme-chosen scope

TransportNY is a dense-data product theme. Its example pages exercise:

- A marketing / catalog moment (`landing.html`, `getting-started.html`).
- An auth form (`login.html`).
- Long-form documentation (`docs-overview.html`).
- Dense product dashboards with map workbench + KPI strip +
  multi-line trend chart + leaderboard (`map-21.html`,
  `map-21-trend.html`, `floating-car.html`, `congestion.html`,
  `work-zones.html`).
- A complete public **data-platform site** — the NYS Freight Atlas:
  marketing front door, a multi-layer GIS map workbench, a curated
  map gallery, six-goal insight dashboards, a multi-format data
  catalog (datasets pattern over `npmrds2`), a single dataset page
  with downloads, and an About/the-plan surface (`freight-atlas-*.html`).

The brand does **not** ship example pages for radio rotations,
podcast catalogs, or marketing-CMS. The platform supports them; this
*theme* doesn't have to.

---

## Working with this folder

**To preview locally:** serve the project root over any static HTTP
server (`python -m http.server`) and open the files in the browser.
Hot-reload is unnecessary — these are HTML mockups.

**To port to a live DMS site:** copy `theme/theme.js`, `theme/icons.js`,
the contents of `theme/tailwind.additions.js`, and `theme/index.css.additions`
into the DMS site's `src/themes/transportny/`. Merge the tailwind
additions into the site's `tailwind.config.js`. Append the CSS additions
to the site's `index.css`. The fonts in `assets/fonts/` (Oswald +
Source Sans 3) need to be served at `/themes/transportny/fonts/`
(or wherever the `@font-face` URLs point).

**When you change a token:** update `theme/theme.js`, then mirror the
new class string into any mockup HTML that demos the affected
primitive (`grep` for the old string across `design-system/*.html`
and `pages/*.html`). The mockups don't import from `theme.js` —
that's the trade-off the skill spec calls out, and it's what keeps
the mockups editable in a text editor with no toolchain.

**To add a new primitive's theme:** put it in `theme/theme.js` first,
then add a demo of it to `design-system/components.html`. If it
composes with other primitives in a recognisable pattern, add a
Section to `design-system/patterns.html`.

---

## Known gaps in v0.2 / open questions

These are noted so a future pass can clear them up. They are also
worth threading back into the skill files — see [Skill feedback](#skill-feedback)
below.

- `theme/icons/*.svg` standalone files are not generated — icons are
  React components in `icons.js`. See `theme/icons/README.md`.
- Tailwind config additions assume Tailwind v3+. The dms-template
  consumes Tailwind v4 via `@tailwindcss/vite`; adapt the
  `theme.extend` shape (and prefer the `{ type: 'tailwind' }` font
  loader entry over `tailwind.additions.js`) if porting to v4.
- Tone-bar selects in the static mockups can only depict an open or a
  closed state, not animated transitions. The behaviour is documented
  in `components.html` text.
- `dataCard.styles[1+]` only ships `kpi`, `editorial`, `title_bar`,
  and (new in v2) `compact` and `dashboard`. Authors who need a
  per-page card variant beyond those should reach for cell-level
  font + span overrides rather than a new `dataCard` style.

## Skill feedback

While building this folder, three questions surfaced that the skill
files left ambiguous. Suggested edits are below; the same notes are
captured at the end of the corresponding mockup HTML files so a
reader hitting the same question finds them inline.

1. **What goes in `components.html` when the brand declines a
   primitive?** §7.5 says "every primitive … unless this theme is
   explicit about not supporting it." But "explicit" isn't defined —
   a one-line README note, a `data-dms-skipped="map"` annotation, a
   muted demo with "TransportNY does not theme `<Map>`"? v2 chooses
   "ship the codebase default unchanged with a one-line note in the
   Spec" but the skill should pick a canonical convention.
2. **Where does the meta-nav strip live in the markup tree?** §7.0
   says "at the very top of `<body>` (above the in-DMS TopNav each
   page renders for its own simulated content)." Fine, but the
   skill should clarify whether the meta-nav counts as part of the
   Layout (and so should be styled with theme keys) or as
   documentation chrome (and so should NOT be styled with theme
   keys, since it'll never appear on a real DMS site). v2 treats it
   as documentation chrome (a single `tny-meta-nav` utility class in
   `_shared.css`) but every page's title and links are duplicated
   — a partial-include would help if the skill blessed a convention.
3. **TopNav vs SideNav for the design-system pages.** Both v1 and
   the handoff put the design-system pages on a SideNav. The skill
   doesn't say which to use; for a product theme that defaults to
   SideNav, the design-system pages should match — that's what v2
   does. The skill could note this explicitly so future themes
   don't drift.

---

## Sources

- `../design_handoff_transportny_design_system/` — the HTML/JSX
  prototypes this folder translates from.
- `../dms_design_system/` — the v1 DMS pass; this folder supersedes
  it but inherits its theme.js shape.
- `src/dms/skills/designing-a-dms-design-system.md` — the design
  contract / skill this folder honors.
- `src/dms/skills/translating-design-system-to-dms-theme.md` — the
  per-primitive key checklist `theme.js` consumes.
- `src/dms/packages/dms/src/ui/components/*.theme.{js,jsx}` — the
  authoritative key set for every primitive.
