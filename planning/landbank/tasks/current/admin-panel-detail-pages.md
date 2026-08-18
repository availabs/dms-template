# Landbank admin panel — the three remaining live pages (view · edit · table)

**Project:** Landbank · **Topic:** content · **Status:** IN PROGRESS — **ALL THREE PAGES BUILT & live-verified, all draft**: property view
(**1210**, `/admin/property-view?id=`), property edit (**1228**, `/admin/property-edit?id=`) and
the inventory table (**1240**, `/admin/inventory`). The SideNav lists the two
browsable pages (dashboard · inventory) with icons; the two detail pages are routable but hidden,
since they need an `?id=`. ⚠ Two things deliberately open: the edit page's live SAVE test (writes to production
source 3 — needs owner sign-off) and the danger-zone delete button (blocked on the stubbed
`RenderActions.getIcon`). A consolidated recommendations report is owed to the owner at the end of
this build. · **Created:** 2026-08-13

Owner direction 2026-08-13, immediately after
[the dashboard](./admin-dashboard-dms-page.md) reached design parity: build the remaining admin-panel
pages live, "as close to the landbank theme design html mockups as possible, using the skills learned
in the process of building the dashboard page." Owner also confirmed the pages may be **tackled one
at a time**.

## Slugs are already committed — do not rename unilaterally

The dashboard **already links to two of these pages**, in two places each. The slugs below are load-
bearing; changing one means changing every reference in the same commit.

| Page | Slug / route | Already referenced by |
|---|---|---|
| Property view | `property-view` → **`/admin/property-view?id=<ogc_fid>`** | dashboard table (1091) `action_view` cell |
| Property edit | `property-edit` → **`/admin/property-edit?id=<ogc_fid>`** | dashboard table (1091) `action_edit` cell **and** the add-parcel modal's `display.navigateUrlOnAdd` (1096) — a save navigates here with the new row's id |
| Inventory table | `inventory` → **`/admin/inventory`** | nothing yet (the mockup's "Edit in table" button was never built) — free to choose; `inventory` matches the design's SideNav label "Inventory table" better than the mockup's filename `admin-table` |

`?id=` is the house convention for a detail param — the core table's own `actionType: 'url'` path
builds `?id=${newItem.id}`.

## Shared build facts (all three pages)

- **Pattern 1076** (`dev2|admin:pattern`, `base_url=/admin`, layout `app`, admin-only
  `authPermissions`). New pages are `type=admin|page`; they appear in the SideNav automatically.
- **Draft-only.** Never `dms page publish` (same discipline as the dashboard; a throwaway published
  page is the way to verify modal chrome).
- **Source 3** (`landbank_dama`, view 3, 85 cols) — copy `externalSource` verbatim from any live
  section, and remember `externalSource.isEditable = true` is required on any *editable* card.
- **Band grammar:** `admin_header` + `admin_content` layoutGroup styles (the pair — see the theme
  README). Sections draw their own white card chrome via `bg`/`border`/`radius`; **section frame XOR
  card frame**.
- **The `?id=` page variable** (per `creating-interactive-pages.md`): register it once in the page's
  `data.filters` whitelist (`{searchKey:"id", useSearchParams:true}`), then every data section
  carries a leaf `{col:"ogc_fid", op:"filter", usePageFilters:true, searchParamKey:"id"}` and
  `pageSize: 1`. Without the page-level registration **nothing reacts**.
- Reusable helpers in `scratchpad/landbank/`: `eldata.mjs` (read-modify-write element-data),
  `uda.mjs` (bounded row reads), `attention-geom.mjs` / `table-shot.mjs` / `scroll-shots.mjs`
  (Playwright verification). ⚠ `mint-token.mjs` prints a second line — take line 1 only — and
  `auth.json` must be re-seeded with the fresh JWT for the dev-server origin.

## Page 1 — Property view (`property-view.html`, 253 lines)

Read-only record page. One record, `pageSize: 1`, everything filtered by `?id=`.

| Band | Mockup | Plan |
|---|---|---|
| Header | status pill · SBL · h1 address · `neighborhood · city, zip · lat,lon` · **Public listing** + **Edit record** buttons | one Card (`pageSize:1`) — the KPI-tile trick: static + calc cells render once. Buttons = `icon_link` with the new `linkText`/`variant` support |
| Parcel plate | `lb-plate` lot drawing + asking price + `0.03 ac · zoned R-2` | Card using the **existing `parcel_plate` column type** (full-bleed) + calc cells |
| Record summary | 8 label/value facts, 2-col | one Card, `cellsGridSize: 2`, `headerValueLayout: 'col'` |
| Full record | 3 groups × 4 facts under mono group headings | one Card, `cellsGridSize: 4`, group headings as `static` cells at `cellSpan: 4` |
| Mini map | single pin, `zoomToFilterBounds` | `Map` section with a `dynamic-filters` leaf on `?id=`. ⚠ This is the ONE case where the G5 empty-page-var-hides-the-layer trap does not bite, because `id` is always set here |
| Disposition timeline | 4-step vertical timeline with dots | ⚠ **Derived/editorial** — the steps ("Processed & cleared title", "awaiting buyer") aren't columns. Build a reduced factual version or flag |
| Steward card | "A. Torres · Disposition · South End" | ⚠ **No backing column** — the source has no steward/assigned-to field. Flag, don't invent |
| Footer | source line + 3 links | lexical or a static Card |

## Page 2 — Property edit (`property-edit.html`, 206 lines)

The same record, editable. The write path is the proven external-CRUD Card
(`externalSource.isEditable` + `allowEditInView`), which the add-parcel modal already exercises.

- Five fieldsets (Status & disposition · Location · Parcel & zoning · Pricing & assessment ·
  Potential use & tags) with the design's stacked labels — remember
  **`display.headerValueLayout: 'col'`** and the **`fieldLabel`** token (session 7g: the dataCard
  `header` class hard-codes `uppercase`, so a form label must override it).
- Sticky rail: record card + pending-changes panel + danger zone.
  ⚠ "Pending changes" is client-side diff state DMS doesn't expose — flag.
- ⚠ **Editing is a real write to production source 3.** Unlike the dashboard, this page's whole
  purpose is writing. Get explicit owner sign-off before the first live save test, and prefer a
  parcel the owner nominates.
- 🔴 Note G12 does **not** block this page — it breaks CREATE (defaultless `ogc_fid`), not UPDATE.

## Page 3 — Inventory table (`admin-table.html`, 391 lines)

The wide ledger, spreadsheet-edit mode. Closest to something already built (dashboard section 1091),
so mostly a wider clone with `allowEditInView`.

- Page header + a Columns/Filters/Export action row; scope band; the wide table with sticky first
  and last columns, inline-edit affordances, row actions.
- A **"Keep these categories current"** context panel (4 cards naming real columns).
- ⚠ Sticky columns, the inline add-new row and the column picker need checking against what
  Spreadsheet actually exposes before promising them.

## Progress log

- **2026-08-13 (session 10) — PAGE 1 (property view) BUILT & LIVE-VERIFIED.** Page **1210**,
  `url_slug=property-view` → **`/admin/property-view?id=<ogc_fid>`** (edit at
  `/admin/edit/property-view`). Draft-only. Seven sections + a map, three groups
  (`admin_header` / `admin_content` / `footer`):
  | # | Section | What |
  |---|---|---|
  | 1211 | header (8) | status pill · `SBL <name>` · h1 `street_address` · `neighborhood · city, NY zip · lat, lon` |
  | 1212 | header (4) | **Public listing** + **Edit record** link buttons, bottom-right |
  | 1213 | body (3) | `parcel_plate` lot drawing + asking price + `acres · zoned` |
  | 1214 | body (5) | Record summary — 8 facts, 2-up |
  | 1218 | body (4) | mini-map, pinned + zoomed to this parcel |
  | 1215 | body (8) | Full record — 3 groups × 4 facts |
  | 1216 | body (4) | Disposition — acquired / current / target / tags |
  | 1217 | footer | source line |
  - **The `?id=` plumbing works end to end.** Verified against three parcels:
    `?id=3` → 110 Alexander Street / For Sale / 25′×50′ (the mockup's own parcel — it is
    **ogc_fid 3**, and nearly every field the mockup shows is a real column, so this binds
    faithfully rather than approximately); `?id=1` → 1 Valley Street Rear / Eagle Hill / 7′×59′;
    `?id=250` → 136 Livingston Avenue / **Sold** / Arbor Hill. Every band moves together.
  - **⭐ NEW: `icon_link` gained `linkText` + `linkVariant`.** With a label the cell stops being a
    28px hit target and becomes a real button — which is what the design's "Edit record" /
    "Public listing" actions are: **links**, so they can't be the theme's `button` component. Three
    variants (primary / secondary / ghost) mirroring `button.styles`. The same control serves the
    other two pages' "Back to inventory" / "Edit in table" actions.
  - **⚠ Four defects found only by rendering — three of them the same underlying lesson.**
    1. **The parcel plate read "SURVEY PENDING" with width 25 and length 50 both present.**
       `parcel_plate` reads its length and status off SIBLING row columns, and a section only
       fetches the columns it LISTS. Fixed with `selectOnly` siblings. **This is now the third
       time this exact trap has cost time** (icon_link's `row.id` in session 9b, `barColorColumn`
       in 8c): *any* column type that reads a sibling needs that sibling fetched — "the source
       has the column" is not "the row has the value".
    2. **A null money column formatted `comma_dollar` renders `$0`** — indistinguishable from a
       real zero — and `defaultValue` does NOT rescue it (the formatFn has already produced a
       string). Say it in SQL: `CASE WHEN fmv IS NULL THEN '—' …`. Same for the Y/N flags, which
       the design writes as Yes/No.
    3. **`height: "1/2"` is not a valid map height.** `HEIGHT_OPTIONS` is
       `full | screen | 1 | 2/3 | 1/3 | 1/4` (`map/index.jsx:28`); anything else resolves to
       undefined and the map renders at a collapsed height. `1/3` = 300px = the sidecar's size.
    4. **`layer-type: "categories"` re-derives a legend at runtime from the paint expression**
       (`map/index.jsx:889`), ignoring an empty saved `legend-data` — so a one-parcel pin sprouted
       an 11-row status legend that covered the header buttons. Only
       categories/choropleth/circles recompute, so a single-record pin should be `"simple"` with
       a flat colour.
  - **🔴 The one that took the page down — and it was MINE, not the library's.**
    `symbology.zoomToFilterBounds` is **not** a list of layer ids; it is the computed **`[sw, ne]`
    pair** the runtime writes after resolving the filter's extent. I seeded it `["lbpin01"]`. With
    a matching id the runtime overwrote it and everything looked fine; with **no match** the
    extent guard returns early, leaves the seed in place, and maplibre gets a string as a
    `LngLatLike` → throws → the router error boundary replaces the **entire route** with "Unable to
    complete your request." So `/admin/property-view` with no param — which is exactly what a
    SideNav click does, since the admin pattern auto-lists pages — was a dead page. Fixed by
    seeding `[]`. **Verified all three states:** no param, `?id=999999` (valid but unmatched) and
    `?id=3` now render empty / empty / the record, with no crash.
    ⚠ Latent library wart worth a look: the early return leaves whatever was in
    `zoomToFilterBounds` untouched, so a stale value survives a filter that matches nothing.
  - **Deliberately not built (flag, not guess):**
    - **The disposition TIMELINE** (4 dotted steps: Acquired → Processed & cleared title → Listed →
      Sale pending). Two of the four steps aren't columns — "quiet title complete" and "awaiting
      buyer" are editorial. Shipped instead as a **Disposition facts card** (acquired year +
      method, current status + days, target disposition, tags) — all real. A true timeline needs
      either those columns or an owner decision about inferring them from `property_status`.
    - **The steward card** ("A. Torres · Disposition · South End") — **no backing column**; the
      source has no assigned-to field. Not invented.
    - The empty state (no/unknown `?id=`) renders a bare page rather than a "No record selected"
      message. Worth one static section.
    - "Public listing" points at `/properties?id=` — the public Properties page exists (75) but
      whether it reads `?id=` is unverified.

- **2026-08-13 (session 10b) — PAGE 2 (property edit) BUILT & LIVE-VERIFIED (no live save yet).**
  Page **1228**, `url_slug=property-edit` → **`/admin/property-edit?id=<ogc_fid>`**. Draft-only.
  Four sections, two groups. Per the owner: "mostly reuse what you built with the view page but
  make the various cards live edit via the component data settings" — which is exactly what this
  is: the same `?id=` plumbing and the same section shapes, with the form Card switched into edit
  mode through its own display settings.
  | # | Section | What |
  |---|---|---|
  | 1229 | header (8) | `● Edit record` eyebrow · h1 `street_address` · `SBL … · neighborhood · editing writes to …` |
  | 1230 | header (4) | **Back to record** link button (→ the view page, same id) |
  | 1231 | body (8) | **the editable form** — 5 fieldsets, 24 fields |
  | 1232 | body (4) | rail record card — parcel plate + address + SBL, read-only |
  - **The edit switch is three display settings, not a different component:**
    `allowEditInView: true` (cells become inputs in view mode), `liveEdit: false` (so the design's
    explicit Save/Cancel row appears rather than saving keystroke-by-keystroke), plus
    `externalSource.isEditable: true` **on the section's own copy of the blob** — the source-level
    metadata toggle is necessary but not sufficient (session 5). And every editable column needs an
    explicit `type` or the cell silently falls back to the read-only renderer.
  - **Fieldsets transcribed from the design:** Status & disposition (status / sale status / target
    disposition / available / featured / active) · Location (address 6, city 3, zip 3, neighborhood,
    lat, lon) · Parcel & zoning (class, zoned as, W, L, acres) · Pricing & assessment (asking,
    deposit, assessed, FMV) · Potential use & tags. Spans match the mockup's 12-col grid.
  - **Select options re-harvested** (gap G8 — an external DAMA source doesn't populate the
    in-browser distinct fetch, so options must be hand-listed): `sale_status` 9,
    `target_disposition` 2, `property_class` 5, `acquisition_method` 9, `general_zoning` 3, plus
    `neighborhood` 49 and `property_status` 12 reused from the add-parcel modal. Harvester kept as
    `scratchpad/landbank/harvest-options.mjs` → `options.json`.
    ⚠ The lists session 5 harvested were **lost** when the modal was trimmed to 5 fields in 6b —
    worth keeping `options.json` in the repo rather than in scratchpad if a third page needs them.
  - **The three Y/N flags are selects, not switches.** The design draws toggles, but the columns are
    `'Y'`/`'N'` TEXT; the `boolean` renderer would write `true`/`false` into a text column. Explicit
    Yes/No selects keep the stored vocabulary intact. Flagged as a deliberate deviation.
  - **⭐ Small library gap closed: the save/cancel buttons were unlabelable.** `Card.jsx` hardcoded
    `save` / `cancel` while the sibling add-new button already read `display.addItemLabel`. Added
    `display.saveItemLabel` / `cancelItemLabel` (defaults = the old literals, so BC), and surfaced
    all **three** in `Card.config.jsx` — `addItemLabel` was read by the component but had no
    control at all, so it was only reachable by editing data directly. This page now reads
    "Save changes" / "Cancel" as the design does.
  - **Verified live:** `?id=3` renders 110 Alexander Street with every field populated from the
    record (selects on their stored values, text/number inputs filled, textarea empty where the
    column is null); `?id=250` renders 136 Livingston Avenue / Arbor Hill. 215/215 tests, build
    green.
  - **🔴 NOT DONE — the live save test.** Saving writes to production source 3. Owner sign-off is
    required first, and the parcel should be one the owner nominates. (G12 does not block this —
    it breaks CREATE, not UPDATE.)
  - **Deliberately not built (flag, not guess):**
    - **"Pending changes"** panel — a client-side diff (`$0 → $50`) DMS doesn't expose. Would need
      the Card to publish its dirty-field set.
    - **Danger zone** (Unlist / Delete) — Card has **no delete affordance at all** (no
      `allowDeleteItem`; only the Spreadsheet's `RenderActions` can remove a row). "Unlist" is
      already expressible via the Available select, so only Delete is genuinely missing.
    - The **Cancel button still renders primary-blue** — `<Button>` with no `activeStyle` resolves
      to the theme's `styles[0]`, which in landbank is the skydeep press. A theme can't distinguish
      "the cancel button" from any other default Button, and giving it an explicit style would
      change every other theme's cancel button too. Left alone deliberately.
    - The design's **sticky** rail (`sticky top-20`) — the section grid has no sticky knob.

- **2026-08-13 (session 10c) — edit-page rail finished, SideNav wired, and PAGE 3 (inventory
  table) BUILT.** Owner asked to finish the right-hand boxes, put the page in the nav with an
  icon, and move on to the table.
  - **Rail complete (sections 1238 + 1239).** The form (1231) got `rowspan: 3` so the three rail
    cards stack beside it instead of wrapping onto a new row — the same grid rule as the
    dashboard's neighborhood/pipeline band.
    - **"Pending changes" → "Record state."** The design lists a client-side diff
      (`Deposit · $0 → $50`); DMS does not expose a Card's dirty-field set, so a box under that
      title could only ever lie. The slot instead shows status pill · availability · asking ·
      days held, read live, with a `data_refresh` subscriber on the form's save so it can't go
      stale. **Renaming the box was the honest move; faking the diff was not.**
    - **Danger zone is a Spreadsheet, not a Card** — Card has no delete affordance at all, but the
      table's built-in action column does (`actionType` ≠ `'url'` → the core DeleteBtn + confirm
      modal → `removeItem` → `uda.data.delete`). "Unlist" needs no control: it is the Available
      select on the form.
      🔴 **The delete BUTTON does not render** — the cell is empty. Same root cause already logged
      on the dashboard: `RenderActions.jsx`'s `getIcon` is stubbed to
      `() => <span>{name}</span>` with the icon branch commented out. Box and wiring are in place;
      the button needs that upstream fix. **Do not ship the edit page to staff until this either
      renders or is removed.**
  - **⚠⚠ SideNav — two traps, one of which briefly emptied the whole nav.**
    1. **`hide_in_nav` must be `null`, never `false`.** The server reads it as
       `data ->> 'hide_in_nav'`, which stringifies JSON false to `'false'` — **truthy** — so the
       nav filter (`!hide_in_nav`) hid every page including the dashboard. `pagesEditor.jsx:688`
       documents exactly this and stores null for the same reason; I wrote `false` from a script
       and reproduced the bug the comment warns about.
    2. **A page's `parent` is a parent PAGE, not its pattern.** Pattern membership is the row's
       `type` (`admin|page`). I had set `parent` to the pattern, so the nav could not place the
       pages and silently dropped them while the routes still worked. The dashboard has no
       `parent` at all. Cleared it.
    Pages now carry `icon` + `index`: Portfolio dashboard `ChartBar` 0 · Inventory table `Table` 1 ·
    Property `Eye` 2 · Edit property `Edit` 3. All four render in the ink SideNav with glyphs.
  - **PAGE 3 — inventory table.** Page **1240**, `url_slug=inventory` → **`/admin/inventory`**
    (the mockup's filename is `admin-table`, but the design's own SideNav label is "Inventory
    table"). Four sections: header Card (eyebrow · h1 · live `count(*)` line = **1,314 parcels**),
    a Dashboard link button, the **scope band cloned verbatim from the dashboard's Filter section
    1093** (status · municipality · search · Reset, on the `scope_bar` design), and the wide
    ledger.
    - The ledger is the dashboard table widened and **switched to `allowEditInView`** — Address ·
      SBL · Neighborhood · Class · Status · Sale status · City · Days held · Asking · the two
      `icon_link` row actions. Select columns carry the harvested option lists so an inline edit
      offers the real vocabulary. `pageSize: 25`, striped, download, attribution.
    - No held-only filter: unlike the dashboard band, this page is the whole portfolio.
  - **Not built on page 3 (flag, not guess):** the mockup's Columns picker and sticky first/last
    columns (Spreadsheet exposes neither), the inline add-new row, and the "Keep these categories
    current" context panel (4 cards of authored copy naming real columns — cheap to add, but it is
    editorial copy, not data).


- **2026-08-13 (session 10d) — inventory-page refinements + detail pages out of the nav.**
  Four owner requests, all on page 1240 unless noted.
  - **Pagination removed; the ledger scrolls all 1,314 parcels.** ⚠ `usePagination: false` is
    **not** enough on its own — `getData` still bounds the fetch by `pageSize`, and falls back to
    **25** when it is unset (`getData.js:364`), so switching the pager off without touching
    pageSize would have silently shown 25 rows with no way to reach the rest. Set `pageSize: 2000`
    (> the 1,314 total) plus **`display.maxHeight: '70vh'`** — the paired knob, whose control is
    gated on `!usePagination` for exactly this case. **Measured:** no pager, one scroll container
    at `clientHeight 846 / scrollHeight 52,502`, and the table virtualizes (≈31 row-action links
    rendered at a time), so the full set is scrollable without rendering 1,314 rows at once.
  - **Server-side header filters on the five categorical columns** — `neighborhood`,
    `property_class`, `property_status`, `sale_status`, `city` — via the per-column
    **`serverFilter: true`** flag. Worth knowing: the *toggle* that sets it is `isEdit`-gated, but
    the resulting **Filter control is not** (`spreadsheet/config.jsx:288` keys only on
    `attribute.serverFilter`), so once set from the data layer the filter is usable by staff in
    view mode. **Verified:** clicking the Neighborhood header opens a `0 selected` multiselect plus
    the Sort control.
  - **"+ Add property" top-right**, with the add-parcel modal cloned onto this page (section
    **1250** in a new `isModal` group, `modalParamKey: addparcel`) so the button has something to
    open rather than bouncing staff to the dashboard. Trigger is a `click_publish` provider on the
    header actions Card — the same wiring as the dashboard's header button.
    ⚠ **Not verifiable yet:** the view-mode modal renders *published* sections only (session 5), so
    the overlay can't be confirmed until this page is published or re-tested on a throwaway
    published page. Edit mode shows the form inline. And the create path itself is still 🔴 **G12**
    (defaultless `ogc_fid`), so the button will 500 on save until that DDL fix lands.
  - **Property view + Property edit removed from the SideNav** (`hide_in_nav: true` on 1210/1228).
    Both render nothing without an `?id=`, so a nav entry was a link to an empty page. They remain
    fully routable and are reached from the table's row actions. Per the owner, re-adding them to
    the nav later needs **a property search/picker** to choose the record first — that is a real
    piece of work, not a toggle. Nav is now Portfolio dashboard · Inventory table.
    ⚠ Note the asymmetry that bit earlier: `hide_in_nav: true` is fine; only JSON **`false`** is
    poison (the server stringifies it to a truthy `'false'`). Use `null` to un-hide.


## Build order

1. ✅ **Property view** — DONE 2026-08-13 (page 1210). Exercised the `?id=` plumbing every later
   page needs, and closed the `zoomToFilterBounds` crash that would have hit them too.
2. ✅ **Property edit** — DONE 2026-08-13 (page 1228). Form is live-editable; the live SAVE test
   is still pending owner sign-off.
3. ✅ **Inventory table** — DONE 2026-08-13 (page 1240, `/admin/inventory`).
4. ⬜ Wire the dashboard's "Edit in table" button to `/admin/inventory` (page 3 now exists).

## Testing checklist

- [ ] `/admin/property-view?id=<real ogc_fid>` renders that parcel's real values, not the first row
- [ ] Changing `?id=` changes every band together (the page variable is registered)
- [ ] A missing/invalid `?id=` degrades sanely (empty state, not a crash or the wrong record)
- [ ] The dashboard table's eye/pencil land on the right record end to end
- [ ] The add-parcel modal's post-save navigate lands on the edit page (blocked by G12 until the PK
      gets a default — the navigate itself can be checked with a hand-typed id)
- [ ] Edit page: a save writes the right columns and the view page reflects it (owner-approved test)
- [ ] All three pages are admin-only (pattern `authPermissions`) and remain **draft**
