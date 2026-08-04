# Landbank Admin Panel — design mockups (Phase 1)

**Topic:** themes · **Status:** IN PROGRESS · **Started:** 2026-07-30
**Owner brief:** Build an admin panel for the Albany County Land Bank, themed with the
current landbank design system, using the Fable‑5 `dashboard.html` as a structural
reference. **Phase 1 (this task) = flat HTML mockups for design review** — no live data
binding. Data *filtering / linkages / editability* come in **Phase 2**.

> Scope clarified by owner 2026‑07‑30: "we are currently making flat html files for
> design review, we'll implement the data filtering linkages in the next phase. but
> continue to use the data in your table, map and chart designs for consistency."

---

## Objective

Produce a set of static HTML mockups for a staff/admin console, in the exact idiom of
`src/themes/landbank/design_system/pages/` (plain HTML + Tailwind Play CDN + `_shared.css`,
no build step), that a reviewer can open in a browser. All figures/rows/coordinates use the
**real** ACLB property dataset for consistency with Phase 2.

## Deliverables (files in `src/themes/landbank/design_system/pages/`)

New admin pages (ink **`app`** layout — dark `#16232C` SideNav, staff console):
- [x] `admin-dashboard.html` — DONE, screenshot-verified. Portfolio ops dashboard (re-theme of Fable `dashboard.html`):
      page header + freshness strip · scope/filter band (visual only; "all charts + the table
      share this slice") · KPI row · Acquisitions vs Sales by year · Held-by-status donut ·
      Portfolio map (real held coords, colored by status) · Held-by-neighborhood bars ·
      Disposition pipeline stacked bar · inventory table (real rows, status pills, row → view/edit
      icons) · footer. "Add parcel" → `admin-new-property.html`.
- [x] `admin-table.html` — DONE, screenshot-verified. **Spreadsheet/table edit mode**: wide ledger of
      real rows with inline-edit affordances (select-pills, toggles, a focused editing cell, sticky
      first/last columns); a **"Keep these categories current"** context panel (4 category cards naming
      the real columns); per-row **view (eye) + edit (pencil)** icon links → `property-view.html` /
      `property-edit.html`; inline add-new row + "Add property" → `admin-new-property.html`.
- [x] `admin-new-property.html` — DONE, screenshot-verified. Address prompt (input + geocode-match
      chip) with an **open modal edit form** pre-populated with dataset‑3 columns in designed field
      groups (Identification · Location · Status & disposition · Parcel & zoning · Acquisition &
      pricing · Potential use & tags). Create → `property-view.html`.
- [x] `property-view.html` — DONE, screenshot-verified. Single-property view card (110 Alexander St ·
      SBL 76.64‑2‑6 · For Sale): status pill + SBL header; parcel‑plate at real 25×50 dims; record
      summary grid; full-record groups; mini map w/ pin; disposition timeline; steward card;
      **Edit** → `property-edit.html`. Linked from admin table/dashboard + public properties.
- [x] `property-edit.html` — DONE, screenshot-verified. Full edit form pre-filled for the existing
      parcel (grouped fieldsets, tag chips), sticky save rail (record card + pending-changes +
      Save/Cancel) and a Danger zone (Unlist/Delete). Reached from the table pencil + view card Edit.

Updates to existing public pages (`default` layout) — DONE:
- [x] `home.html`, `about.html`, `properties.html` — added a **Staff user menu** to each topnav
      (dropdown → Admin dashboard / Inventory table / Add property / Sign in) and extended each
      floating DS widget with an **Admin panel** section (all 5 pages).
- [x] `properties.html` — the 3 featured listing cards now carry a **View →** link and **every
      ledger row is click-through** to `property-view.html`.

## Design system it must match (source of truth)

- Type: `font-display` (Archivo @118% width), `font-prose` (Public Sans), `font-meta` (IBM Plex
  Mono) + arbitrary Tailwind sizes matching the `T` tokens in `src/themes/landbank/theme.js`
  (displayHero/XL/LG/MD/SM · proseLG/prose/proseSM/proseXS · labelMD/labelSM · metaMD/metaSM/metaXS).
  **NOT** the Fable `t-*` utility classes — those must be translated.
- Palette (inline `tailwind.config` per page): ink `#16232C`, slate `#475A66`, mist `#8CA0AB`,
  paper `#F2F5F6`, papertint `#EAEFF1`, sky `#0AA7E4`, skydeep `#0A6E99`, leaf `#8CC63E`,
  field `#4C9129`, forest `#33641B`, amber `#E0940B`, violet `#8B6FC7`, rose `#CE5B4E`, steel.
- Surfaces from `_shared.css`: `lb-paper`, `lb-paper-tint`, `lb-card`, `lb-card-ink`, `lb-plat`,
  `lb-plat-ink`, `lb-plate`, `lb-lot`/`lb-lot-sky`/`lb-lot-slate`, `lb-press`, `dot-pulse`.
- 7‑status color system → real `property_status` values:
  For Sale · ACLB Project(rehab) · Sale Pending · CoDev(co‑development) · Processing(in‑process) ·
  on‑hold group (Tabled/Title Problem/Under Option/App to Board/Foreclosure Vacated) · Sold.
- Icons: inline the SVG path data from `src/themes/landbank/icons.jsx` (39 glyphs + aliases:
  Gauge/ChartBar/Table/House/Plus/Download/Search/Filter/SortAsc/SortDesc/MapPin/Info/CircleAlert/
  Pencil(Edit)/User/Settings/Lot/Ruler/Dollar/Calendar/ChevronLeft/Right, …).
- Chrome vocabulary (KPI card, pills, ledger table, form fields, modal, buttons, filter band,
  record card, band headers): extracted from `design-system/{layouts,components,patterns}.html`
  into `scratchpad` cheat-sheet.

## Real data (source: DAMA `landbank_dama` view 3 "Landbank Properties", 1,314 rows, 85 cols)

Captured in `scratchpad/…/lb-data.json`. Key figures:
- **KPIs:** 1,314 tracked · ~199 held · 60 For Sale · 17 Sale Pending · 1,115 Sold ·
  **$13.25M** total proceeds · median ask $600–$1,500 · median days in inventory ≈ 3,002.
- **property_status:** Sold 1115 · For Sale 60 · ACLB Project 57 · Sale Pending 17 · Processing 16 ·
  CoDev 11 · Under Option 6 · Tabled 6 · Title Problem 6 · App to Board 4 · Foreclosure Vacated 4.
- **property_class:** Residential Vacant Lot 895 · Residential Building 370 · Commercial Building 22 ·
  Commercial Vacant Lot 12 · Accessory Structure 3.
- **neighborhood (all-time):** West Hill 280 · South End 269 · Arbor Hill 95 · Sheridan Hollow 74 ·
  Cohoes 66 · Colonie 58 · N. Albany/Shaker Park 41 · Delaware Ave 35 · Eagle Hill 28 · …
- **city:** Albany 1027 · Cohoes 68 · Colonie 43 · Watervliet 29 · Bethlehem 19 · …
- **inventory_type:** Private 1135 · Land Bank 152 · ACLB Holdings LLC 16.
- **held w/coords:** 169 (real lat/long, mostly South End / West Hill / Eagle Hill / Campus Area).
- **Real sample rows** (table + view + edit): e.g. `76.64‑2‑6` · 110 Alexander Street · South End ·
  Res Vacant Lot · For Sale · $600 · 2,333 days · 25×50 ft · 0.03 ac · R‑2 · assessed $1,000 ·
  42.6411,‑73.7637. (14+ real For‑Sale rows + mixed-status rows in `lb-data.json`.)
- **Acq vs Sold by year:** date columns are Excel serials (noisy on raw pull) → use the design
  system's documented 2015–2026 series (2017 intake wave ≈316; sales outpace acq since 2020).

## Environment notes (for Phase 2 — NOT needed for Phase 1)

- App `landbank` on `https://dmsserver.availabs.org` (dev creds). Two sites: `home:site` (public)
  and `dev2:site`. Public pages Home/About/Properties already exist & published under
  `dev2 | dashboard` pattern (pages 27/51/75). No admin pattern yet.
- "Dataset 3" = **DAMA `gis_dataset`** `source_id:3 / view_id:3`, pgEnv `landbank_dama`, `isDms:false`.
  Editing external DAMA sources requires `metadata.isEditable:true` (flows to
  `externalSource.isEditable` → enables Card/Spreadsheet `updateItem`/`addItem`/`removeItem`).
- CLI `site tree`/`pattern list`/`dataset list`/`raw get <id>` **hang** against this remote
  (client-side attribute fan-out), but **bounded direct `POST /graph` reads are ~100ms** — use
  `["dms","data",app,"byId",…]` and UDA `["uda",env,"viewsById",view,"options",[key],…]`. Scripts in
  `scratchpad/`: `lb-map.mjs`, `lb-src.mjs`, `lb-schema.mjs`, `lb-data.mjs`.
- All requested Phase‑2 interactivity is achievable with existing DMS primitives (no new
  components): page-variable cross-filter, Spreadsheet `allowEditInView`, Card add-new
  (`navigate`/`closeModalOnAdd`/`usePageParams`), single-record `?id=` detail leaf, per-column
  `isLink`+`searchParams:'id'` link/icon cells, modal section groups. (Verified from dms source.)

## Testing checklist

- [x] Each new page opens standalone in a browser (Tailwind CDN + `_shared.css`) — all 5 + 2 public
      pages screenshot-verified at 1440px, no layout errors.
- [x] Type/scale/color/surface match the existing pages (font-role classes, `lb-*` surfaces, 7-status
      pills, one radius) — verified against the shared cheat-sheet.
- [x] All figures/rows/coords trace to `lb-data.json` (real data): 199 held · 60/57/17/16/11 status
      split · $13.25M · real SBLs/addresses/parcel dims · real held coords projected onto the maps.
- [x] Cross-links resolve: dashboard/table → view/edit; view ↔ edit; public → admin via Staff user
      menu; properties featured cards + ledger rows → view card; DS widget lists all pages on every page.
- [~] Mobile (≤lg) pass: admin sidenav is `max-lg:hidden` and the topbar carries a menu button, but a
      mobile drawer is not wired (design mockup) — note for Phase 2.

## Phase-1 status: COMPLETE (2026-07-31)

7 files delivered in `src/themes/landbank/design_system/pages/`: 5 new admin mockups
(`admin-dashboard`, `admin-table`, `admin-new-property`, `property-view`, `property-edit`) +
3 updated public pages (`home`, `about`, `properties`). Screenshots in the session scratchpad
(`shot-*.png`). Ready for design review; Phase 2 (live DMS wiring) remains per the section below.

## Phase 2 (deferred, not this task)

Wire the mockups into live DMS pages under a new `app`-layout admin pattern: page-variable
cross-filter (Property Status primary + municipality/year/inventory facets), Spreadsheet edit mode
on source 3 (`isEditable`), Card add-new modal (address prefill → navigate to edit), single-record
view/edit via `?id=`, table link/icon cells, user-menu nav items in the theme.
