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
      share this slice") · KPI row · Acquisitions vs Sales by year · Held-by-class donut ·
      Portfolio map (real held coords, colored by status) · Held-by-neighborhood bars ·
      Disposition pipeline stacked bar · inventory table (real rows, status pills, row → view/edit
      icons) · footer. "Add parcel" → `admin-new-property.html`.
- [ ] `admin-table.html` — **spreadsheet/table edit mode**: wide ledger of real rows with
      inline-edit affordances; a "key data categories to keep current" context panel/callouts;
      per-row **view (eye) + edit (pencil)** icon links → `property-view.html` / `property-edit.html`;
      "Add property" → `admin-new-property.html`; column-group headers.
- [ ] `admin-new-property.html` — new-property flow: prominent **address prompt** (address input +
      geocode affordance), then an **open modal edit form** populated with dataset‑3 columns,
      organized into designed field groups (Identification · Location · Status & Program ·
      Acquisition · Disposition/Sale · Parcel geometry · Structure · Assessment · Tags/flags).
- [ ] `property-view.html` — **single-property view card** for a real parcel
      (e.g. 110 Alexander Street · SBL 76.64‑2‑6 · For Sale): header w/ address+SBL+status pill;
      parcel‑plate thumbnail (`lb-plate`/`lb-lot` at real 25×50 dims); key‑facts grid; mini map;
      acquisition→disposition timeline; **Edit** → `property-edit.html`. Linked from the admin
      table, dashboard, and the public `properties.html`.
- [ ] `property-edit.html` — the edit form pre-filled for an existing parcel (same field groups as
      the new-property modal); reached from the table pencil icon + the view card's Edit button.

Updates to existing public pages (`default` layout):
- [ ] `home.html`, `about.html`, `properties.html` — add a **user menu** in the topnav that links
      into the admin panel (`admin-dashboard.html`), and make `properties.html` listings link to
      `property-view.html`. Add the new admin pages to each page's floating DS nav widget.

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

- [ ] Each new page opens standalone in a browser (Tailwind CDN + `_shared.css`), no console errors.
- [ ] Type/scale/color/surface match the existing pages (side-by-side).
- [ ] All figures/rows/coords trace to `lb-data.json` (real data).
- [ ] Cross-links resolve: dashboard/table → view/edit; view ↔ edit; public → admin via user menu;
      properties listing → view card; DS nav widget lists all pages.
- [ ] Playwright screenshot pass (msedge channel; memory recipe) at 1440px + mobile.

## Phase 2 (deferred, not this task)

Wire the mockups into live DMS pages under a new `app`-layout admin pattern: page-variable
cross-filter (Property Status primary + municipality/year/inventory facets), Spreadsheet edit mode
on source 3 (`isEditable`), Card add-new modal (address prefill → navigate to edit), single-record
view/edit via `?id=`, table link/icon cells, user-menu nav items in the theme.
