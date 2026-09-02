# TransportNY · DMS Design System v2

**v0.2 · 2026-05-26** (last revised **2026-08-19** — the NPMRDS category gained two pages,
`npmrds-route-creation` and `npmrds-tmc`, closing the set's input and output ends; see
[NPMRDS: the tool that makes a route, and the leaf](#npmrds-the-tool-that-makes-a-route-and-the-leaf-2026-08-19).
Before that, **2026-08-05**: the **content sidebar (side content)** region is now documented as
layout knowledge *and* as a component, with a second named style; the individual report page is
rebuilt on it and its route controls redrawn at full capability — see
[Content sidebar](#content-sidebar-2026-08-05).) · A second-pass DMS-format implementation of the
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

## Content sidebar (2026-08-05)

The **side content** region — the rail beside the content column, switched on per page by the
“Show Content Sidebar” setting (`item.sidebar` = left/right) and filled from the page's `sidebar`
section group — had no entry in this catalogue: pages that used it drew it ad hoc, and
`npmrds-report.html` drew it as a `col-span-3` grid column, which is not what the platform renders.
Closed in four places:

1. **`design-system/layouts.html` § 09 · Content sidebar.** The layout knowledge: the four moving
   parts (toggle · `navLabel` nav items · the `sidebar` group · which band hosts it), the rendered
   wrapper tree, the full `contentRow` / `contentCol` / `sideNavContainer1..3` class reference for
   both styles, and the load-bearing rules (`items-stretch`, one sticky wrapper, hidden below `xl`).
   States plainly that **the rail is not a grid column** — it is a fixed-width flex sibling outside
   the 12-col grid, so the canvas keeps its own `grid-cols-12`.
2. **`design-system/components.html` § Content Sidebar** (in Navigation, after SideNav). The
   component: both styles drawn side by side, the key list, and the author controls.
3. **`theme/theme.js`** gains `pages.sectionGroup` — which this theme never shipped, so every rail
   on a TransportNY site was running the codebase's neutral defaults. Two named styles:
   `styles[0] default` (302-px card rail, 40-px gutter, sticky under the header) and
   **`styles[1] flush`** (340 px, **no padding, hugging the content area's left edge, `sticky top-0
   h-svh`** — full height of the tab, panel-owned internal scroll). `flush` asks two things of the
   page: the rail-hosting band must be Full Width, and the page header must be a section in the
   content column rather than its own full-bleed band — so **on a flush rail the header is not full
   width**, by design. Also fixes `modal`, which was a flat object and so silently ignored
   `activeStyle: 'wide'`; it is now a styles array with a `wide` entry (max-w-7xl).
4. **`pages/npmrds-report.html`** is rebuilt on it: one band hosts the flush rail plus the whole
   canvas, and the header and the finding are canvas sections. Two claims from earlier drafts are
   corrected there: route edits write straight through to the report's own dataset row
   (publish/discard don't apply to route content), and the mutation gate is two flags —
   `editPageMode` **and** the section's own edit pencil.

**This one page is interactive** (`pages/npmrds-report.js`, ~700 lines of plain browser JS, no
build step — same contract as everything else here). It is the only page in the catalogue that
needed to be: the rail is a control surface and the two modals are multi-step flows, and a first
attempt that answered "what do these look like" with ~775 lines of drawn states below the fold was
the wrong artifact. Live: edit-mode toggle (rail chrome + section toolbars + Measure Picker on the
canvas), panel collapse, row expand, TMC "+N more", search with the real no-match copy, inline
rename with the real duplicate-name refusal, date+time editing with the time-of-day presets and
day-of-week mask, the colour picker, the assignment chips, the Dynamic Report switch, and both
modals in full — tag-folder browsing with breadcrumbs and free-text tags, the four-value graph
vocabulary with live guidance and the conditional Anchor Route select. Deliberately inert: the two
confirm buttons, remove, duplicate and the Settings drawer — adding or removing would change the
report, so the flow is what's designed, not the write; each says so when clicked.

**Add Route and Add Graph are always available** — not gated behind edit mode, because they are the
report's two jobs and a report with no routes has to offer the way out of that state. One
always-present action row holds both plus the edit toggle, and the row carries the mode itself. This
is an escalation for the component: its `canMutate` gate has to move from "hide the button" to "the
button enters edit mode and opens the modal", which keeps the read-only guarantee (nothing writes
until confirm).

Both modals are on their **second pass**, and the interesting part is the prioritisation:

- **Add Graph** had four identical dropdowns, which said "four settings" when the shape is one
  decision plus two refinements. Now: **01 what shape** — four *cards* with glyphs, because picking
  a chart type is a visual choice a closed select hides; **02 what value** — one select, grouped
  Speed / Travel time / Delay / Emissions, with the measure's own sentence live under it; **03
  routes** — checklist with select-all and an n/total count, in the secondary column; and
  **refine** — resolution + comparison mode, muted and labelled optional, with the Anchor Route
  select appearing only for Difference with exactly two routes. The cards made room for the type
  that was missing — **Table**, which builds a Spreadsheet section (the real reports are full of
  "Route Info Box" tables and the only way to get one was the long path this modal replaces); each
  card names what it creates. Two shapes were missing and are now there: **Table** (builds a
  Spreadsheet — the real reports are full of "Route Info Box" tables) and **Map** (builds a Map —
  the only card that answers *where* on the corridor the value changes); for both, the only way in
  was the long path this modal replaces, which made the row a chart menu rather than a card menu.
  The default pick moved from the component's `BarGraph · speed · 5-minutes` to `Line · travel
  time · hour`, since the former is the densest, least readable combination in the vocabulary and
  it was what an author saw before touching anything.
- **The window controls were saying something the tool doesn't do**, in the component as well as
  in the drawing. "Start date + start time / end date + end time" claims one continuous stretch
  between two instants; what `useGraphPublish` builds is a list of *days* (start date → end date,
  minus the weekday mask) and, separately, a band of *hours applied to every one of those days* —
  it averages the same hours across days. The controls are now three facets in the engine's own
  order — **dates** (which days) → **days** (which of those count) → **time of day** (which hours
  of each) — and the time block says so outright. Two silent engine behaviours are surfaced from
  the code: a backwards time window empties the epoch list and an empty list means the filter is
  never sent, so it silently returns all-day data (the same reason the midnight-crossing presets
  don't exist), and a time on only one bound is ignored. A window can also now be **copied and
  pasted** between routes, with the bulk case ("paste into all") offered first, because a
  before/after report is four routes with one window and retyping four fields per route is a
  transcription-error generator; derived-date routes are skipped and say why. Two more selection
  aids: **shift ± 1 year**, which moves a span without changing its length (the before/after move,
  and where hand-typed dates reliably go wrong), and preset pills that carry their own hours —
  "AM Peak" alone makes you hover to learn this brand means 06:00–10:00, and two of the five
  presets differ only by hours.
- **The charts are the AVL Graph's own shape** (2026-08-06), drawn against the real DOM —
  `div.avl-graph-container` → `svg.avl-graph` with **no viewBox**, px geometry against a measured
  container, `g.axis-group > g.axis.axis-left` with `path.domain` and `g.tick`, and the plot
  translated by the margin. That fixes the fit as well as the fidelity: the old `viewBox` drawings
  *scaled*, so a size-4 card had 9-px axis text and the wrong proportions. A GridGraph's left axis
  is band (its index is the row), so it draws row labels, not numbers.
- **`avlGraph.chartDefaults` now ships**, which the brand never had — so every TransportNY chart was
  running the library's loose defaults. Tightened where they were wrong for this brand: margin
  20/20/50/100 → 12/12/30/48, ticks 0.75rem inherited → 9-px mono (ticks are chrome and now match
  the meta rows), `strokeWidth` 1 → 2, bars 0.75 → solid, height 300 → 260, axis colour off
  `currentColor`. Every one of those is a key `chartDefaults` already exposed and merges *under* a
  section's own `display` — the library needed no change.
- **The route row lost its `+`** (everything a row has is on the row now that the TMC list is gone
  and the window is one line) and **"on N cards" became a pill** beside the name, where the
  "unused" badge already sat.
- **The control row fits itself.** Five controls don't fit every card, so set values shrink to
  tokens (`1h`, `06–10 · Wd`, a glyph for the overlay/difference flip) and what's left collapses
  by priority into one "⋯" that opens the same contents — measured against what the header can
  spare, not against a size threshold, since the same card is wide at 1600px and narrow at 1280.
  The "graph N" chips left the headers (nothing points at them now), and the title truncates to a
  112-px floor with a tooltip: the controls claim the spare width first. Three measurement traps
  worth not repeating are written into the page — `scrollWidth` never fires on a `justify-end`
  row, shedding pills one at a time thrashes once you account for the "⋯", and the budget belongs
  to the header, not the slot.
- **One edit mode per route.** The row's single pencil opens the name *and* the dates with one
  save/cancel pair; a pencil for the name plus a second one for the dates made two edit modes out
  of one object.
- **Quick Controls, for real** (2026-08-06). `theme.sectionHeaderExtensions` injects a builder into
  a section's header band — the row with the title and the ⋮ trigger — with the same ctx the
  Settings-drawer extensions get; it ships Measure and Comparison Mode today. The page now draws
  that row live on every card and extends it to **Routes · Measure · Aggregate · When · Mode**,
  with the row folding into one "⋯" pill below size 6. Route selection is a card control now, and
  its mode follows the shape: a Map is single-select, charts and tables are multi.
- **Time of day, days of week and the aggregate moved off the route onto the card.** They describe
  the question a card asks, not the route: on the route they forced a duplicate route to ask a
  second question of the same road, and one window silently governed every card that route fed. A
  route now carries name · colour · TMCs · date span; a card carries shape · measure · aggregate ·
  when · mode · routes. Set in the Add Graph modal's **When** step, edited afterwards in the card's
  own controls. *Escalation:* storage moves with them — `useGraphPublish` would take the date list
  from each route's span minus the **card's** weekday mask and the epoch list from the **card's**
  time window; today both read off the route.
- **The per-graph chips left the route rows.** A chip per graph was fine at five and unusable at
  twenty, which these reports reach; a row now says "on N cards" and jumps to the first one.
- **Every per-route control is live** — window, colour, name, order, assignment. They briefly sat
  behind page edit mode, which (once the rail's own edit toggle was gone) meant opening a route
  showed a read-only summary with no way in. Page edit mode now governs only the *page*: section
  toolbars, the Measure Picker, the Dynamic Report switch.
- **The graph cards deliberately don't move.** In the product a window/colour/assignment change
  publishes to every graph the route feeds and those cards refetch. A version of this page
  simulated a slice of that (legends rebuilt from assignment, series recoloured, attribution
  rewritten, an "updating" flash) and it was reverted at Alex's direction: with no data behind the
  page, anything that made a card look refreshed implied numbers that hadn't changed. The binding is
  documented instead of faked; the page's job is the controls.
- **The route rail** dropped the TMC list from the open-out (the widest content in a 340-px panel,
  for information nobody uses that way — the count stays in the meta line and the extent lives on
  the map card), moved **identity colour into a popover on the row's own colour dot** (inline it was
  doubly buried behind expand-then-change, for a control whose whole job is "this route is blue
  everywhere"), and dropped its local *edit routes* button — the page header's Edit already owns the
  mode, so the action row just shows the state.
- **Add Route** now leads with search (largest element, focused on open, result count stated), puts
  the three real tag axes in the header as pills so browsing isn't below the fold, demotes
  Auto-generated and Other tags to text links beside them (a provenance flag and a free-text search
  aren't axes), and gives every row its county/region/agency tags — name plus TMC count can't
  separate "NY-9D NB (Beacon)" from "NY-9D NB · Main St to Verplanck". What's left below
the fold is what interaction can't carry: the control inventory (what each control writes), the
design rules, and the print state.

Two more recorded deviations from the NPMRDS cross-page contract, both Alex, 2026-08-05, both
written into `npmrds-home.html`'s canonical contract note as well as this page's own header:

- **No breadcrumb band.** Layout consequence worth keeping: with no sticky chrome above it, the
  flush rail's `sticky top-0 h-svh` is exact. A page that keeps a breadcrumb strip has to offset
  both `top` and the height by its height, the way styles[0] does for the page header.
- **The compact 64-px icon SideNav** instead of the 256-px expanded one — the second page in the
  set to use it (npmrds-macro was the first). 256 + the 340-px route rail was 596 px of chrome,
  which left the graph canvas narrower than the chrome beside it; compact reclaims 192 px and
  loses no destination (same items, same order, same amber active rail, labels become `title`
  tooltips). The extra width then exposed one thing: the freshness line is ~640 px of tracked
  mono, and inside the `shrink-0` action stack it starved the h1 until the title wrapped, so it
  is now the header card's full-width foot line.

Open item, logged rather than invented: the style is chosen in the theme
(`pages.sectionGroup.options.activeStyle`), so it is brand-wide. Page settings has a per-page
picker for the app SideNav's style but none for the content sidebar's; a parallel **“Content
Sidebar Style”** setting is the natural fix, since `flush` is right for report pages and wrong for
docs pages on the same site.

---

## NPMRDS: the tool that makes a route, and the leaf (2026-08-19)

Two pages joined the `npmrds` category, closing the two ends the six-page set left open —
`pages/npmrds-route-creation.html` and `pages/npmrds-tmc.html`. Both are registered in
`ds-nav.js`; Reports' “New route” action and the macro view's segment popup now link to them,
so neither arrives as an orphan.

**`npmrds-route-creation.html` — the input side.** Four pages in the category *consume* routes
(reports, the individual report, route comparison, the routes list) and none documented how one
is made. The page is the workbench shape (Layout `app`, compact 64-px SideNav, one Map section
in a `workbench` band, everything else floating panels), transcribed from both implementations:
the legacy `transportNY/src/sites/npmrds/pages/route_creation/` tool and the live target, the
`routecreation` **map plugin** in `src/themes/transportny/components/routecreation/`. Because
the target is a plugin, the page is one Map section plus the plugin's `comp` — not a bespoke
page, and it says so.

Four things it *specifies* rather than transcribes, each labelled on the page and repeated in
its § 04 table so a build task can pick them up: **(1)** the route paints in the brand's
selection blue with an amber highlight, replacing `#FF0000` on `#CCCCCC` — red-on-grey is the
brand's *bad value* pair and a selected segment is not a bad segment; **(2)** the row↔segment
highlight the old tool had both ways and the port dropped; **(3)** the route's own name on the
canvas, so an editor arriving on `?route_id=…` can see what they are editing; **(4)** the mode
hint, docked to the canvas because the instruction is about the canvas. Four gaps are drawn as
gaps and never as working chrome: the pinned 2022 network vintage (a year selector is blocked on
re-verifying which years the routing service actually matches), waypoints not surviving a save,
no folder field, and the routing call still going client-direct.

**`npmrds-tmc.html` — the output side.** Every other NPMRDS surface aggregates; this is where
one segment is read in full before any of that is trusted. Transcribed from
`transportNY/src/sites/npmrds/pages/TmcPage/` — attributes, the month × time-of-day completeness
grid, the peak-stacked distribution with its median / 85th-percentile rules and outlier filter,
and the three PM3 measures over ten years.

It is the catalogue's second page on the **`default` content sidebar** (302-px card rail,
sidebar='right'), and the interesting decision is what did *not* go in the rail. The legacy page
keeps Year · Metric · Data source · Resolution there; here they are a sticky section at the top
of the canvas, because the rail is `hidden xl:block` and a page whose charts cannot be re-scoped
below 1280 px is broken rather than responsive. The rail keeps the jump list, the links out and
the provenance card — all of it losable.

**One escalation.** `graph` ships `catPalette` (5) and `seqSpeedPalette` (5) and **no neutral
sequential ramp**, so the completeness grid — a magnitude from none to all — had nothing correct
to bind to; the legacy page used `getColorRange(7,'BrBG')`, a *diverging* ramp, which puts a
false midpoint at 50%. The page draws a 7-step single-hue ramp off `graph.primary` and names the
missing token: `graph.seqNeutralPalette`. It needs adding to `theme/theme.js` before a build task
can bind the grid.

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
│   ├── layouts.html           · Layout + LayoutGroup variants (page chrome shapes) + § 09 the content sidebar
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
    ├── datasets-source.html       · single Source page · Overview tab (description, metadata, downloads)
│   ── NPMRDS (the six-page category — one product, one contract) ──
    ├── npmrds-home.html           · Home · four product sections (Macro View · Reports · Route
    │                                Comparison · MAP-21), each opened by its own doorway card and
    │                                carrying that product's stats or links-into-views; sticky
    │                                in-page nav + documentation card in a `sidebar` rail
    ├── npmrds-reports.html        · report library · THE TEMPLATE SHELF and nothing below it
    │                                (12 cards in 5 typed sections, each card with a layout-derived
    │                                preview tile); search lives in a modal section group and the
    │                                dialog on this page WORKS (57 real rows, live filter, URL-bound
    │                                query), opened from the header. Rev 3 (2026-09-02) removed
    │                                § 02 your-reports, § 03 worked-examples and § 04's state
    │                                drivers; the dialog itself stayed
    ├── npmrds-reports-list.html   · ALL REPORTS — the same library as a filtered, paginated table:
    │                                ReportPickerModal un-modaled (standing tag rail + facets +
    │                                prominence sort) over 26 REAL `reports_snap_2` rows. The page
    │                                pays back the one thing the modal costs, pagination; its header
    │                                logs five measured findings about the live tag vocabulary
    ├── npmrds-macro.html          · full-page map workbench (controls left, measure context right)
    ├── npmrds-report.html         · the individual report canvas (compact SideNav + flush
    │                                content-sidebar route rail + graph-card grid) — the one
    │                                INTERACTIVE page: live rail, live Add Route / Add Graph
    │                                modals, inert confirms
    ├── npmrds-report.js           · that page's behaviour layer (data + render + events)
    ├── map-21.html                ·  ⎫
    ├── map-21-system-performance.html ⎬ retrofitted into the NPMRDS category
    ├── map-21-lottr.html          ·  ⎪ (nav, header, breadcrumb, freshness, footer)
    ├── map-21-trend.html          ·  ⎭
    └── route-comparison.html      · retrofitted likewise
```

The nine `npmrds-*` / `map-21*` / `route-comparison` pages form the **NPMRDS category** —
one `ds-nav.js` section, one SideNav, and a nine-item cross-page contract (page-header shape,
breadcrumb rule, the data-freshness strip, the measure vocabulary, the route-row treatment, the
download affordance, the shared empty/loading/error states, and the compound-card rule). The
contract is written out at the top of `pages/npmrds-home.html` and specified in
`planning/transportny/tasks/current/npmrds-category-design-set.md`. The four new compositions the
set introduced — **data-freshness strip**, **search-first index with facet chips** (inline *and*
in-dialog placements), **map workbench with measure-context panel**, **report canvas (rail +
graph-card grid)** — are documented in `design-system/patterns.html` §10–13, joined by
**§14 preview plate · the shape of a report** (the 4:5 report-shape tile at 1/4 card width, its
fallback order, and the two saturations the categorical palette needs when it fills large areas). Content is real: NPMRDS speed data complete
through **June 2026** (July partial, continuous since January 2017, 14.38B observations), PM3
reporting year **2025**, a **869**-report library with **32** rebuilt as DMS pages, and the actual
`npmrds_docs` page set.

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
| §7 deliverable structure      | `theme/` + `design-system/` (5 pages) + `pages/` (**43** product mockups across 8 families: platform · **NPMRDS ×9** · Freight Atlas ×7 · TSMO ×10 · explorers · Site Management ×5 · Datasets ×2) ✓ |
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
- **Numbers are tabular; the big ones are Oswald.** Every numeric uses
  `tabular-nums`. Inline metadata and table cells are `ui-monospace`
  (`metaMD` / `metaSM` / `chromeTick`), but **large KPI figures are Oswald**
  — the `statXL` / `statLG` / `statMD` ladder in `theme.html § type`, i.e.
  `displayHero` / `displayMD` / `displaySM` weights plus `tabular-nums`.
  An earlier revision of this paragraph said all KPI values were
  `ui-monospace`; the handoff, `theme.html`'s stat ladder, and every
  drawn page disagree (see the transcription note in `pages/map-21.html`:
  "handoff wins over brief"). Oswald is otherwise reserved for headings
  and chrome; Proxima Nova / Source Sans 3 for running prose; never the
  reverse.
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

**Screenshots (new 2026-08-27).** `assets/screens/` holds captures of the
running application, used by the two NPMRDS documentation pages. They are
the first image assets in this design system. Before adding one, read
[`assets/screens/README.md`](./assets/screens/README.md) — it carries the
capture convention (real tool only; every figure names the state that
produced it; annotate with CSS overlays, never baked into the PNG) and the
auth/dev-server recipe, including the two traps that each cost a run:
the token must be minted against the app's real API host, and URL
parameters do not set macro-view state — drive the UI.

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
