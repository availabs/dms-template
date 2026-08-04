# Landbank admin dashboard → live DMS page

**Project:** Landbank · **Topic:** content · **Status:** PLAN (no implementation yet) · **Created:** 2026-08-04

**Design source:** `src/themes/landbank/design_system/pages/admin-dashboard.html` (ADMIN PANEL 1 of 5,
Phase 1 mockup — see [`landbank-admin-panel/README.md`](./landbank-admin-panel/README.md))
**Target site:** `VITE_DMS_APP=landbank`, `VITE_DMS_TYPE=dev2`, `VITE_DMS_PG_ENVS=landbank_dama`
**API/DAMA host:** `https://dmsserver.availabs.org` (the site's `.env` has no `VITE_DAMA_HOST`, so
`DAMA_HOST === API_HOST`; tiles verified on this host, **not** on `graph.availabs.org`)

## Objective

Build the staff **Portfolio dashboard** as a real DMS page, bound to the single ACLB properties
source, using only existing page primitives (Card / Spreadsheet / Graph / Map / Filter) configured
through the admin UI or the CLI — plus a **modal section group** carrying an "Add parcel" create
form that writes a new row into that same source.

Where the mockup can't be expressed by today's primitives, the deliverable is **the smallest
enrichment that lets an author express it** (a theme style, a column type, one display knob) — not a
custom dashboard component. See [`src/themes/CLAUDE.md`](../../../../src/themes/CLAUDE.md) and
§"Platform / theme gaps" below.

## Read first (skills)

Ordered by how load-bearing they are for this task. All paths relative to `src/dms/skills/`:

1. [`modal-section-group.md`](../../../../src/dms/skills/modal-section-group.md) — **the create-row
   modal is entirely existing core behavior**: `isModal` + `modalParamKey` group, `click_publish`
   trigger cell, `allowAdddNew` Card as the form, `closeModalOnAdd`, `add_publish` +
   `data_refresh` for live refresh, `usePageParams` prefill, create defaults.
2. [`using-a-datawrapper-card.md`](../../../../src/dms/skills/using-a-datawrapper-card.md) — how to
   bind a section to this source (recipe A: copy the existing `externalSource` verbatim).
3. [`card-layout.md`](../../../../src/dms/skills/card-layout.md) — the two grids, `cellSpan`,
   `selectOnly`, `cardHints`, composite cells.
4. [`creating-interactive-pages.md`](../../../../src/dms/skills/creating-interactive-pages.md) — the
   scope band: `Filter` control writes a `searchParamKey`; data sections react via `usePageFilters`
   leaves.
5. [`creating-pages-from-a-design-pattern.md`](../../../../src/dms/skills/creating-pages-from-a-design-pattern.md)
   — `dms page create` / `dms section create --data`, the `element-data` JSON-string gotcha,
   draft-only discipline.
6. [`creating-a-map-section.md`](../../../../src/dms/skills/creating-a-map-section.md) +
   [`editing-map-symbologies.md`](../../../../src/dms/skills/editing-map-symbologies.md) — the
   portfolio map.
7. [`full-text-search-filter.md`](../../../../src/dms/skills/full-text-search-filter.md) — the
   topbar "Search parcel or address…" box.
8. [`authenticating-the-dms-cli.md`](../../../../src/dms/skills/authenticating-the-dms-cli.md) —
   `page list` / all writes return `no-access` without `DMS_AUTH_TOKEN`.
9. [`traversing-dms-pages.md`](../../../../src/dms/skills/traversing-dms-pages.md) — before any live
   browser verification. Living document: update it if this build turns up something new.

## Current state (verified 2026-08-04 via the CLI against dmsserver.availabs.org)

### The site

```
Site: landbank (id 10)
├── Pattern 11  dev2|auth:pattern       Auth       base_url=auth
├── Pattern 12  dev2|data:pattern       Data       base_url=datasets   dmsEnvId=13 (no internal sources)
└── Pattern 21  dev2|dashboard:pattern  Dashboard  base_url=/          selectedTheme="landbank"
                 layout.options: topNav size=compact (Logo + UserMenu), sideNav size=none
                 authPermissions: {"*": {users:{175:["*"]}, groups:{"landbank Admin":["*"], public:[]}}}
```

Pages on pattern 21: **27 Home** (`home`), **51 About** (`about`), **75 Properties**
(`properties`) — all published. Per-page `authPermissions` also exist (page pattern's Permissions
pane, merged with the pattern's).

### The one data source

Every data section on every page binds to the same external DAMA source — copy this
`externalSource` verbatim (recipe A):

```json
{ "source_id": 3, "view_id": 3, "isDms": false, "env": "landbank_dama", "srcEnv": "landbank_dama",
  "baseUrl": "/datasources", "type": "gis_dataset", "name": "Landbank Properties",
  "view_name": "1", "app": "landbank", "columns": [ … 85 columns … ] }
```

85 columns; the ones this page needs:

| Column | Type | Used for |
|---|---|---|
| `name` | TEXT | Parcel ID (SBL) |
| `eproperty_id` | TEXT | Parcel number |
| `street_address`, `address_2`, `city`, `zip_code` | TEXT | Address |
| `neighborhood` | TEXT | Geography rollups |
| `property_class`, `structure_type`, `general_zoning`, `zoned_as` | TEXT | Class / zoning |
| `property_status` | TEXT | The 7-status system (pills, donut, map color, pipeline) |
| `sale_status`, `program_type`, `target_disposition`, `actual_disposition` | TEXT | Disposition |
| `inventory_type`, `available`, `active`, `featured` | TEXT | Flags |
| `days_in_inventory` | DOUBLE | Days held |
| `asking_price`, `deposit`, `appraised_value`, `current_assessed_value`, `sold_amount`, `acquisition_amount` | INT/DOUBLE | Money |
| `acquisition_method`, `acquisition_date`, `sold_date` | TEXT | Dates are **Excel serials or 4-digit years stored as TEXT** — see the year-parse expression below |
| `parcel_width_ft`, `parcel_length_ft`, `parcel_acres` | DOUBLE | `parcel_plate` + parcel facts |
| `latitude`, `longitude`, `geocodio_latitude`, `geocodio_longitude` | DOUBLE | Map / geocode |
| `potential_use`, `tags`, `property_condition`, `occupied` | TEXT | Notes |
| `ogc_fid` | (PK, not in metadata list) | `fn: count` cells; the table's real primary key |

**Status vocabulary** (from the live `pillColors` maps on pages 27/75 — reuse identically):
`For Sale` → `for_sale` · `ACLB Project` → `aclb_rehab` · `Sale Pending` → `sale_pending` ·
`CoDev` → `co_development` · `Processing`/`Under Option`/`Application to Board` → `in_process` ·
`Title Problem`/`Tabled`/`Foreclosure Vacated` → `on_hold` · `Sold` → `sold`.

"Held / in inventory" = everything except `Sold`, expressed on the live pages as the explicit list
`('For Sale','ACLB Project','Sale Pending','Processing','CoDev','Under Option','Title Problem','Tabled','Foreclosure Vacated','Application to Board') OR property_status IS NULL`.

**Excel-serial year parse** (lifted verbatim from live section 1062 — reuse for `acquisition_date`
by swapping the column name):

```sql
CASE WHEN sold_date ~ '^[0-9]+$' AND sold_date::int > 10000
       THEN extract(year from date '1899-12-30' + sold_date::int)::int
     WHEN sold_date ~ '^[0-9]{4}$' THEN sold_date::int END as sold_year
```

### Patterns already proven on this site (copy, don't invent)

| Live section | What it proves |
|---|---|
| **1055** (Properties KPI strip) | One-row Card, `pageSize:1`, 6 `count(*) FILTER (…)`/`percentile_cont` calc columns + 6 `origin:"static"` caption cells, `valueFontStyle:"displayXL"` / `headerFontStyle:"metaXS"` |
| **1058** | Group-by-`property_status` Card with `type:"status_pill"` + `pillColors`, `ogc_fid` `fn:"count"` |
| **1063 / 1064** | Group-by Card with `type:"data_bar"`, `barMax:100`, `barColorKey`, and the `round(count(*)*100.0/max(count(*)) over (),1)` share expression; 1064 also shows the `tail_rank` + `selectOnly` sort trick for an "All others" bucket |
| **1062 / 977** | AVL Graph `BarGraph`, calc xAxis (`target:"xAxis"`, `group:true`) + `count(*)` yAxis (`fn:"exempt"`), `height:280`, axes/legend off |
| **1067 / 974 / 965** | Record cards: `parcel_plate` full-bleed cell, `formatFn:"combine"` + `combineWith`/`combineSeparator`, `selectOnly` loader cells |
| **1069** | Spreadsheet, `usePagination:true`, `pageSize:10`, `striped`, status pill in a table cell |

### Theme surface already available (`src/themes/landbank/theme.js`)

`layout.styles`: `default` (public) · **`app` (ink SideNav staff console — this page's layout)** ·
`bare`. `layoutGroup.styles`: `content`/`content_tint`/`hero`/`header`/`feature`/`footer`/`auth`/**`workbench`**.
`dataCard.styles`: `default` · **`kpi`** (border-t-2 accent, 38px tabular display numeral).
`table.styles`: `default` (the ledger) · `below-row`. **`filters.styles`: `panel` — described in the
theme README as "the dashboard filter band"** · `chip`. `modal.styles`: `default` · `wide`.
`pill.styles`: the 7 statuses. `dataBar` theme key (papertint track; `sky`/`field` fills).
`columnTypes.parcel_plate`. Core column types available: `status_pill`, `data_bar`, `stacked_bar`,
`stat_value`, `delta`, `target_bar`, `download_button`, plus edit inputs `text`/`string`/`textarea`/
`number`/`date`/`select`/`multiselect`/`boolean`.

## Prerequisites (do these first — the modal cannot work without #1)

1. **Make source 3 writable.** Add/edit/delete for external DAMA sources is implemented
   (`src/dms/planning/tasks/current/external-source-editable-crud.md`, "implemented, live-tested
   2026-07-08") but is gated on two things:
   - the table has a real Postgres **primary key** — a `gis_dataset` normally has `ogc_fid`, which
     the server auto-detects and aliases `AS id` per request (`uda.controller.js`'s
     `resolveIdAttribute`); and
   - **`metadata.isEditable === true`** on the source, flipped deliberately via the "Allow editing"
     toggle on the datasets admin page (`patterns/datasets/pages/dataTypes/default/admin.jsx`),
     never automatically.

   The existing sections' `externalSource` blobs carry no `isEditable` key, so **assume it is
   currently off** and verify in the Data pattern's UI (`/datasets`). Writes route to
   `uda.data.create/edit/delete`; the server re-checks `isEditable` + PK independently.
   ⚠ Turning the toggle on is an owner decision (it makes the source writable from any page) — get
   explicit sign-off before flipping it.
2. **Confirm the page's home.** The dashboard is staff-only and needs `layout` style `app` (ink
   SideNav), but layout is chosen **per pattern**, and pattern 21 serves the public site at
   `base_url=/` with `sideNav size=none`. Decision needed (see gap **G1**): recommended is a new
   `page` pattern (e.g. `dev2|admin:pattern`, `base_url=/admin`, `selectedTheme=landbank`, layout
   `app` with the staff SideNav menu, `authPermissions` = `{groups:{"landbank Admin":["*"], public:[]}}`).
3. **Mint a token** (`DMS_AUTH_TOKEN`) — skill #8. Build **draft-only**; never `dms page publish`.
   ⚠ Caveat from the modal skill: the view-mode modal renders `item.sections` (**published**
   sections), so the modal cannot be observed on a draft-only page — verify it on a throwaway
   published page, then bring the config over.
4. **Harvest option lists** for the create form's `select` fields (`property_status`, `sale_status`,
   `program_type`, `target_disposition`, `property_class`, `neighborhood`, `acquisition_method`).
   The mockup renders them as static buttons, so it carries no vocabulary. `property_status` is
   known (above); the rest need one distinct-values pass over the source (Data pattern → metadata,
   or a grouped Card built temporarily). See gap **G8**.

## Page structure — bands, sections, and data bindings

Twelve-column `pages.sectionArray` grid, `p-3` gutters (already the landbank theme's contract), so
the mockup's `col-span-*` map 1:1 onto section widths. Bands = `draft_section_groups` entries.

### Band A — Page header (`theme: "header"`, position `content`)

| # | Section | Binding |
|---|---|---|
| A1 | `lexical` | `h1` "Portfolio dashboard" (displayXL/h1 → `font-display`) |
| A2 | **Card** (one row, `pageSize:1`, `cellsGridSize:3`, no border) | Live meta strip. Calc cells: `count(*) as parcels_tracked` (`formatFn:"comma"`, caption "parcels tracked"); static cell `source: Landbank Properties · DAMA #3`. ⚠ The mockup's "synced Jul 30, 2026 6:00 AM" has **no backing column** — either drop it or add a `last_synced` column to the source (owner decision) |
| A3 | **Card** (action row, right-justified) | Two `origin:"static"` cells: `export_btn` ("Export", `valueFontStyle` = a button token) and `add_parcel` ("+ Add parcel"). `display._functions.providers = [{functionId:"click_publish", enabled:true, paramKey:"addparcel", args:{column:"add_parcel"}}]` → opens Band K. Export: see gap **G7** |

### Band B — Scope / cross-filter (`theme: "content"`)

| # | Section | Binding |
|---|---|---|
| B1 | **Filter** (`display.filterStyle:"panel"`, `gridSize:3`, `placement:"inline"`) | Three controls, each writing a page variable: `acquisition_year` (op `filter` over the acquisition-year calc, or a range), `city` (op `filter`, distinct), `status` (op `filter` over `property_status`) |
| B2 | **Filter** (`filterStyle:"chip"`, optional) | The topbar search box: one `like` control writing `searchParamKey:"search"`. Every data section then carries an `OR` group of `like` leaves over `street_address`, `name`, `eproperty_id`, `neighborhood` (skill #7). ⚠ In the mockup this box lives in the **topbar** (pattern chrome); as a section it sits in the scope band — documented deviation, or move it into the pattern's `topNav.rightMenu` if a search widget exists there |

Every section in bands C–I then gets the matching `usePageFilters` leaves so "every chart, the map
& the table share this slice" (the mockup's own promise, and Phase 2 of the mockup task).

### Band C — KPI row (`theme: "content"`, 4 × `col-span-3`)

Four **separate Card sections**, each `pageSize:1`, `cardsGridSize:1`, `activeStyle` = a `dataCard`
KPI variant (gap **G2** — per-tile accent colors need 4 variants; one shared `kpi` style gives four
identical accents).

| Tile | Value column (calc) | Sub-line(s) |
|---|---|---|
| C1 Currently held | `count(*) FILTER (WHERE property_status IN (<held list>) OR property_status IS NULL) as inventory_total` | `count(*) FILTER (WHERE <acq_year>=2025) as acquired_2025` → "▲ N acquired in 2025" (`type:"delta"` or plain calc + static caption). Mockup's sparkline: gap **G3** |
| C2 For sale now | `count(*) FILTER (WHERE property_status='For Sale') as for_sale_total` | `round((percentile_cont(0.5) within group (order by asking_price) FILTER (WHERE property_status='For Sale'))::numeric) as median_asking` (`formatFn:"comma_dollar"`); `count(*) FILTER (WHERE property_class ILIKE '%vacant%') as vacant_lots` + `count(*) FILTER (WHERE property_class NOT ILIKE '%vacant%') as buildings` |
| C3 Sale pending | `count(*) FILTER (WHERE property_status='Sale Pending') as pending_total` | `count(*) FILTER (WHERE property_status='Under Option')`, `count(*) FILTER (WHERE property_status='Application to Board')`. ⚠ "avg 41 days application → closing" has **no backing column** (no application/closing dates) — drop it |
| C4 Sold to date | `count(*) FILTER (WHERE property_status='Sold') as sold_total` | `sum(sold_amount) FILTER (WHERE property_status='Sold') as proceeds` (`formatFn:"abbreviate"`/`comma_dollar`); `round((percentile_cont(0.5) within group (order by days_in_inventory) FILTER (WHERE property_status='Sold'))::numeric) as median_days_sold` |

Captions are `origin:"static"` cells with `valueFontStyle:"proseXS"` (exactly as sections 1055/966).

### Band D — Acquisitions vs. sales by year (`col-span-8`)

⚠ **The grouped two-series bar cannot be built from this table as-is**: acquisitions and sales live
in two different columns on the same row (`acquisition_date`, `sold_date`), and a single GROUP BY
can only key on one of them. Options, in preference order:

1. **(recommended) Add a small SQL view in `landbank_dama`** — `(year, acquired, sold)`, one row per
   year — and register it as a second DAMA source; then it's a plain 2-series `BarGraph`
   (`target:"xAxis"` on `year`, two `yAxis` count columns). Data-layer prerequisite, no library
   change, and every future "by year" chart benefits.
2. **Two adjacent BarGraph sections** ("Acquired by year", "Sold by year"), `col-span-4` each — ships
   today with zero new work, loses the side-by-side comparison the mockup makes.
3. A library-level unpivot/union capability in `dataWrapper` — out of scope here; note only.

Whichever ships, the axis/legend styling copies section 1062 (`height:280`, `yAxis.show:false`,
`legend.show:false`, `barOpacity:1`, `paddingInner:0.25`) and the callout sentence under the chart is
a `lexical` section.

### Band E — Held inventory by status (`col-span-4`)

| # | Section | Binding |
|---|---|---|
| E1 | **AVL Graph** `PieGraph` | `property_status` (`group:true`, `target:"xAxis"`) + `count(*)` (`fn:"exempt"`, `target:"yAxis"`), filtered to held. ⚠ **Donut is not available** — `PieGraph.jsx` hardcodes `innerRadius = 0`; the mockup's ring + centered "199 HELD" needs gap **G4** |
| E2 | **Card** (legend list) | Verbatim clone of live section **1058**: `property_status` `status_pill` + `ogc_fid` `fn:"count"`, held filter, sorted desc |
| E3 | **Card** (one row) | `round(avg(days_in_inventory) FILTER (WHERE property_status<>'Sold'))` + `percentile_cont(0.5) … FILTER (…)` → "Avg days in inventory (held)" |

### Band F — Portfolio map (`col-span-12`, `theme: "workbench"` or `content`)

**Map: Dama Map** section (page-state aware, so the scope band cross-filters it) over view 3.
Tiles verified 2026-08-04:

```
curl "https://dmsserver.availabs.org/dama-admin/landbank_dama/tiles/3/10/302/377/t.pbf?cols=property_status"
→ 200, 19,621 bytes   (14/4835/6041 → 200, 3,562 bytes)
```

(the same request against `graph.availabs.org` returns **204** — wrong host for this pgEnv.)

- Symbology: categorical on `property_status` using the theme's 7 status colors; build per skill #6
  (`?cols=property_status` is rebuilt at runtime from `data-column`).
- Filters bound to the page variables + `zoomToFilterBounds`; legend gated on layer type; the
  Held/Sold/All segmented toggle = a `Filter` control writing a status page variable.
- ⚠ The mockup's **cluster bubbles with counts** and the pinned popover are not DMS map features —
  ship colored points and the standard hover/popup (documented deviation, gap **G5**).

### Band G — Held inventory by neighborhood (`col-span-6`)

Verbatim clone of live section **1064**, with the `For Sale` filter swapped for the held-status list:
`hood_label` bucket expression (top neighborhoods + "All others"), `tail_rank` `selectOnly` sort,
`ogc_fid` `fn:"count"`, and the `data_bar` share cell (`barColorKey:"field"`, `cellSpan:2`).

### Band H — Disposition pipeline (`col-span-6`)

| # | Section | Binding |
|---|---|---|
| H1 | **Card** (one row) | The stacked bar via the core **`stacked_bar`** column type: six `count(*) FILTER (…) as st_for_sale / st_project / st_pending / st_processing / st_codev / st_onhold` calc columns (`fn:"exempt"`, `selectOnly:true`) + one `stacked_bar` cell whose `segments: [{col, label, color}]` point at them (order = bar order). `showLegend:true` gives the counts line; the 2-column legend grid can also stay a separate cloned 1058-style Card. Needs a `stackedBar` theme key — gap **G6** |
| H2 | **Card** (one row, `content_tint`/papertint cell) | "Needs attention": `count(*) FILTER (WHERE property_status='Title Problem')`, `… ='Tabled'`, `count(*) FILTER (WHERE days_in_inventory > 2920 AND property_status<>'Sold')` (>8 years) |

### Band I — Held inventory table (`col-span-12`)

**Spreadsheet**, clone of live section **1069** plus:

- Columns: `street_address` (Address) · `name` (Parcel/SBL, `valueFontStyle:"metaMD"`) ·
  `neighborhood` · `property_class` (Class) · `property_status` (`type:"status_pill"` + the
  `pillColors` map) · `days_in_inventory` (`formatFn:"comma"`, `justify:"right"`, `sort:"desc"`) ·
  `asking_price` (`formatFn:"comma_dollar"`, `justify:"right"`).
- `display`: `usePagination:true`, `pageSize:10`, `striped:true`, `allowDownload:true` (the mockup's
  CSV button — Spreadsheet exports xlsx), held-status filter + the page-variable leaves.
- Row actions (view / edit): link cells (`isLink`, `location`, `searchParams:"id"`, `linkText`).
  ⚠ Icon-only action buttons are gap **G9**; the detail pages themselves
  (`property-view.html` / `property-edit.html`) are **out of scope** — this task links to
  `properties` (or leaves `location` unset) until those pages exist.

### Band J — Footer (`theme: "footer"`, position `bottom`)

`lexical` — staff-portal footer line + links (Public site / Inventory / Add property).

### Band K — "Add parcel" modal (`isModal`)

Group entry (`draft_section_groups`), index after every visible band:

```json
{ "name": "<uuid>", "index": 20, "theme": "content", "position": "content",
  "displayName": "Add-parcel modal", "isModal": true,
  "modalParamKey": "addparcel", "modalSize": "3xl" }
```

**K1 — the create form: one Card**, `externalSource` = source 3, and:

```json
"display": {
  "readyToLoad": true, "fetchMode": "smart", "usePagination": false, "pageSize": 1,
  "cardsGridSize": 1, "cellsGridSize": 12, "cardBorder": false,
  "allowAdddNew": true,
  "addItemLabel": "Save property",
  "addNewBehaviour": "append",
  "closeModalOnAdd": "addparcel",
  "_functions": { "providers": [ { "functionId": "add_publish", "enabled": true, "paramKey": "newparcel" } ] }
},
"filters": { "op": "AND", "groups": [ { "col": "eproperty_id", "op": "filter", "value": ["__none__"] } ] }
```

The never-match filter makes the section render **only** the new-item form (no existing rows).
Every other data section on the page gets
`_functions.subscribers: [{functionId:"data_refresh", enabled:true, paramKey:"newparcel"}]` so the
new row lands in the KPIs / table / map without a reload.

**Form fields** — transcribed from `admin-new-property.html`'s modal, grouped as it groups them.
⚠ Every form column **must** carry an explicit `type` or it renders as an empty non-editable box.
`cellSpan` values are against `cellsGridSize:12`.

| Group | Column | `type` | Span | Notes |
|---|---|---|---|---|
| Identification | `name` | `text` | 4 | Parcel ID (SBL), `valueFontStyle:"metaMD"` |
| | `eproperty_id` | `text` | 4 | |
| | `program_type` | `select` | 4 | `options` — see prereq 4 |
| Location | `street_address` | `text` | 6 | first field; the mockup's address-first flow (§Deviations) |
| | `city` | `text` | 3 | `defaultValue:"Albany"` candidate |
| | `zip_code` | `text` | 3 | |
| | `neighborhood` | `select` | 4 | `options` |
| | `latitude` | `number` | 4 | mockup shows these as **geocoded, read-only** — gap **G10** (no geocoder in DMS): enter manually for now |
| | `longitude` | `number` | 4 | |
| Status & disposition | `property_status` | `select` | 4 | 11-value vocabulary above; `defaultValue:"Processing"` candidate |
| | `sale_status` | `select` | 4 | `options` |
| | `target_disposition` | `select` | 4 | `options` |
| Parcel & zoning | `property_class` | `select` | 4 | `options` |
| | `zoned_as` | `text` | 4 | |
| | `general_zoning` | `text` | 4 | mockup omits it; include or drop by owner call |
| | `parcel_width_ft` | `number` | 4 | feeds `parcel_plate` on the detail/record cards |
| | `parcel_length_ft` | `number` | 4 | |
| | `parcel_acres` | `number` | 4 | |
| Acquisition & pricing | `acquisition_method` | `select` | 4 | `options` |
| | `acquisition_date` | `text` | 4 | ⚠ stored as TEXT (Excel serial **or** `YYYY`) — a `date` input would write a shape the year-parse expression doesn't read. Keep `text` + `placeholder:"YYYY-MM-DD"` and decide the canonical write format (owner) |
| | `asking_price` | `number` | 4 | |
| | `current_assessed_value` | `number` | 4 | |
| Notes | `potential_use` | `textarea` | 12 | `rows:2`, `placeholder` from the mockup |
| | `tags` | `text` | 12 | `placeholder:"side-lot, corner…"` |

Field labels come from `customName`; style them with `headerFontStyle:"labelSM"` (mono micro-caps
read badly on a form). **Create-time defaults** — `selectOnly:true` columns that fill blanks only:
candidates `active:"Y"`, `inventory_type`, `owner:"Albany County Land Bank"`, and `defaultFn:"user"`
on an entered-by column **if one is added** (the schema has no created_at/created_by — flag to owner).

**K2 (optional) — a lexical header** inside the modal group ("Add a property", the mockup's modal
title bar). The group's own ✕/overlay close is built in.

## Platform / theme gaps and proposed enrichments

Each is stated as the *smallest* change that puts the capability in an author's hands. Library items
(`@availabs/dms`) must be escalated to `src/dms/planning/tasks/current/` with their own task doc, per
the planning rules.

| # | Gap | Where | Proposed enrichment |
|---|---|---|---|
| **G1** | Staff pages need `layout` style `app` (ink SideNav) + restricted access, but layout is a **pattern-level** choice and pattern 21 is the public site | site config (no code) | Create a second `page` pattern `dev2|admin:pattern`, `base_url=/admin`, `selectedTheme=landbank`, layout `activeStyle` = `app`, SideNav menu = Dashboard / Inventory table / Add property / For-sale list, `authPermissions` `{groups:{"landbank Admin":["*"]}, public:[]}`. Public pages stay on 21. No library change |
| **G2** | The 4 KPI tiles have **different top-border accent colors**; `dataCard.styles` has one `kpi` variant, and `activeStyle` is per section | **landbank theme** | Add `kpi_sky` / `kpi_field` / `kpi_amber` / `kpi_ink` variants (same recipe, different `border-t` color) to `dataCard.styles`. Author-selectable per section from the existing style dropdown; every future stat strip benefits |
| **G3** | KPI tile 1's **sparkline** (11 mini bars, last one highlighted) | recommend *no code* | Ship the tile as a Card + a tiny `BarGraph` section (`height:48`, axes/legend off) beneath it in the same band — expressible today. If sparkline-in-a-cell is wanted later: a `sparkline` column type reading a sibling **array** column (`array_agg(...)` calc), same "reads the row" convention `data_bar`/`stacked_bar` already use |
| **G4** | **Donut** (ring + centered total) — `PieGraph.jsx` hardcodes `innerRadius = 0` | **library** | Add `display.pieInnerRadius` (0–0.9, default 0) to graph_new's config + pass it through `PieGraph`'s `p.innerRadius = pieDiameter * 0.5 * pieInnerRadius`; optionally `pieCenterLabel` for the total. Small, backward-compatible, and it's the one graph knob every dashboard mockup asks for |
| **G5** | Map **cluster bubbles with counts** + pinned popover | recommend *no code* | Ship status-colored points + the standard legend/hover/popup. Clustering is a MapLibre/symbology-level feature, not a section knob — treat as a separate research item, not a blocker |
| **G6** | `stacked_bar` reads its colors from a `stackedBar` theme key the landbank theme doesn't ship (only `dataBar`) | **landbank theme** | Add a top-level `stackedBar` key mirroring `dataBar` (papertint track) with `fills` for the 7 status colors, so the pipeline bar and its legend match the pills exactly |
| **G7** | Export button on a **Card** — `dataWrapper` has the xlsx export, but only Spreadsheet's config exposes `allowDownload` | **library** (1-line config) | Add the same `{type:'toggle', label:'Allow Download', key:'allowDownload'}` control to `Card.config.jsx`. Until then: put the export on the Spreadsheet (Band I) only, and drop the header Export button |
| **G8** | Create-form `select` fields need **option lists**; `mapped_options` loads rows from a lookup source (this source has none), so options must be hand-listed | **library** (optional) | Ship hand-listed `options` now (harvest via one distinct pass). Enrichment worth considering: let `mapped_options` take `{distinctColumn}` against the section's own source so an author can say "options = the distinct values of this column" |
| **G9** | Table row **icon-only** view/edit actions; link cells render text (`isLink` + `linkText`) | **landbank theme** | A small `icon_link` column type (icon name + `location`/`searchParams` template, per the theme's own icon registry) — pure chrome, one concern, exactly the `portrait_banner`/`stream_player` shape sanctioned in `src/themes/CLAUDE.md`. Interim: `linkText:"View"`/`"Edit"` text links |
| **G10** | Mockup's flow is **address → geocode → prefilled modal**; DMS has no geocoding step | out of scope | Ship the single-step modal with manual `latitude`/`longitude`. A geocode-on-create step is a server/datatype concern (geocodio is already the source's provenance) — separate task if the owner wants it |
| **G11** | No CLI command inspects or sets **external (DAMA) source metadata** (`isEditable`, PK) — `dms dataset *` only covers internal DMS sources | **library (CLI)** | Add `dms dataset external show <source-id> --env <pgEnv>` (+ optionally `set-editable`) so prereq 1 is verifiable from the terminal instead of only through the admin UI |

## Documented deviations from the mockup (no code, decisions already made above)

- Topbar search box lives in the scope band, not the topbar (unless the pattern's `topNav` gets a
  search widget).
- "synced Jul 30, 2026 6:00 AM" and "avg 41 days application → closing" have no backing columns —
  dropped unless the source gains them.
- Pagination footer text ("showing 1–6 of 199") is whatever Spreadsheet's own pager renders.
- The mockup's SideNav "For-sale list · 60" count badge is pattern nav chrome, not a data binding.

## Build order

1. Prereqs: pattern decision (**G1**), `isEditable` sign-off + toggle, token, option-list harvest.
2. Theme additions **G2** + **G6** (cheap, unblock bands C and H).
3. Page + bands A, C, E2/E3, G, I — all clones of proven sections. Verify live.
4. Band B scope filters + the `usePageFilters` leaves on every data section. Verify cross-filtering.
5. Band F map (tiles + symbology).
6. Band D (after the year-view decision) and E1 (pie now, donut if **G4** lands).
7. Band K modal — on a throwaway **published** page first, then port the config; verify create →
   modal closes → other sections refresh.
8. Escalate **G4** / **G7** / **G8** / **G11** to `src/dms/planning/` if taken up.

## Testing checklist

- [ ] Every section loads with real data (no `invalidState`, no empty cards) in view mode
- [ ] KPI numbers reconcile against the Properties page's own strip (same source, same filters)
- [ ] Held-status filter list is applied identically in every band (spot-check counts sum to the held total)
- [ ] Scope band: changing status / city / year updates KPIs, charts, map, and table together
- [ ] Search box matches across address / SBL / eProperty ID / neighborhood
- [ ] Map: tiles render, points colored by status, legend matches paint, filter zoom works
- [ ] Table: pagination, sort by days held, xlsx download, row links resolve
- [ ] Modal: trigger opens it, form validates/saves, row appears in the DB with the right column values
- [ ] Modal closes on successful add; a failed add leaves it open with the form intact
- [ ] Created row appears in the table + KPIs without a reload (`add_publish` → `data_refresh`)
- [ ] Page is **not** reachable by an anonymous user (pattern/page `authPermissions`)
- [ ] Draft-only: no `dms page publish` run by this task (except the throwaway modal-verification page, which gets deleted)
