# Landbank admin dashboard → live DMS page

**Project:** Landbank · **Topic:** content · **Status:** IN PROGRESS — **ALL bands A–K built & live-verified** (admin pattern + draft dashboard page 1077: header, scope cross-filter, KPIs, by-year, by-status, map, neighborhood, pipeline, table, footer, add-parcel modal). **Design-alignment pass 1 DONE 2026-08-07** (11→4 section groups to kill stacked `py-12` padding, white-card framing + inner padding + per-band titles + mockup-order reflow, all live-verified via the new Playwright harness). Remaining: design-alignment **pass 2** (map held-default, table columns, composition regroup, scope eyebrow — element-data surgery), dev restart to activate the title-case `heading` theme key, run the live create-submission test, publish, escalate library gaps. · **Created:** 2026-08-04

## Working method (IMPORTANT — read before resuming)

**The CLI now works** (use it). Its earlier total hang was **NOT** the VPN and **NOT**
remote fan-out — it was a cross-platform bug in `src/dms/packages/dms/cli/src/config.js`
`findConfigFile`: `while (dir !== '/')` never terminates on Windows (`dirname('C:\\') ===
'C:\\'`, never `'/'`), so every command spun forever before making a request. **Fixed
2026-08-04** (terminate on `dirname(dir) === dir`). `mint-token.mjs` was unaffected
(standalone, no `resolveConfig`). Escalated as a library fix — see
`src/dms/planning/tasks/completed/`.

The direct `POST /graph` helpers below still work and are handy for bounded reads /
scripted bulk writes, but plain `dms page|section|raw …` commands are fine now.

- Reusable helpers in the session scratchpad: `gget.mjs` (get), `gcall.mjs` (call),
  `build-dashboard.mjs` (the page builder). Env: `DMS_HOST`, `DMS_APP=landbank`,
  `DMS_AUTH_TOKEN` (token in `scratchpad/token.txt`, ~6h expiry — re-mint via
  `src/dms/packages/dms/cli/bin/mint-token.mjs --host … --project landbank --email availabs@gmail.com --password test123`).
- Read a row:  `get [["dms","data","landbank","byId",<id>,["id","type","data"]]]`
- Create:      `call ["dms","data","create"]  ["landbank","<type>",<dataObj>]` → new id in `jsonGraph…byId`
- Edit (shallow-merge, first-level keys): `call ["dms","data","edit"] ["landbank",<id>,<partialData>]`
- **Discovery quirk:** pages are discoverable by the type-list key
  (`landbank+<patternInstance>|page`), but **patterns are NOT** — a pattern only exists
  to the site if its `{id,ref}` is in **site row 10's `data.patterns`** array (append it
  after creating the pattern row; resend the full site `data` to be safe).
- **Gotchas:** section `data.parent` and `data.size` are stored as **strings**
  (`parent` is a JSON *string*). A Card selects its `dataCard` named style via
  `display.cardStyle` (Card.jsx:231). `externalSource` (85 cols) is copied verbatim from
  live section 1055.

## Progress log

- **2026-08-04 — Build order step 2 (theme additions) DONE.** Implemented the two
  author-facing theme enrichments that unblock bands C and H, in
  `src/themes/landbank/theme.js` (no library change, no server access needed):
  - **G2** — four KPI accent variants `kpi_sky` / `kpi_field` / `kpi_amber` / `kpi_ink`
    on `dataCard.styles`, built from a shared `mkKpi(accent)` helper (named dataCard
    styles inherit only from `styles[0]`, so each variant carries the full stat-tile
    treatment and differs only in `border-t` color). The existing `kpi` style is
    preserved as the field-green default. Author picks the accent per KPI tile from the
    existing style dropdown. Lint + syntax clean.
  - **G6** — top-level `stackedBar` theme key mirroring `dataBar` (papertint track),
    with `fills` keyed by the seven canonical status names (`for_sale`, `aclb_rehab`,
    `sale_pending`, `co_development`, `in_process`, `on_hold`, `sold`) plus brand-name
    aliases, so the disposition-pipeline bar (H1) and its legend match the pills/map
    pins exactly. Verified against `stacked_bar.jsx`'s `getComponentTheme(theme,
    "stackedBar")` read (keys: `wrapper/track/segment/legend/empty/fills`).
  - Not verified in a running app (additive theme keys only; needs the live page build
    to render). No other files touched.
- **2026-08-04 (session 2) — prereqs cleared + admin pattern + page skeleton built.**
  Owner cleared prereqs: `isEditable` is ON (source 3), G1 approved (build a new admin
  pattern), token minting authorized.
  - **Prereq 3 (token) DONE** — minted via the CLI skill; stored in `scratchpad/token.txt`.
  - **G1 / prereq 2 (admin pattern) DONE + verified** — created pattern **id 1076**
    `type=dev2|admin:pattern`, `base_url=/admin`, `pattern_type=page`,
    `theme.selectedTheme=landbank`, `layout.options.activeStyle=1` (the `app` ink-SideNav
    style), `sideNav.size=compact` / `nav=main` (Logo top, UserMenu bottom),
    `topNav.size=none`, `authPermissions` = `{groups:{"landbank Admin":["*"]}, public:[]}`
    (admin-only). Appended `{id:1076,ref:"landbank+dev2|pattern"}` to **site 10**
    `data.patterns` (dms_envs/site_name preserved). Verified by graph read.
  - **Draft page DONE + verified** — created page **id 1077** `type=admin|page`,
    `url_slug=dashboard`, `title="Portfolio dashboard"` → route **`/admin/dashboard`**
    (edit at `/admin/edit/dashboard`). Draft-only (`sections`/`section_groups` empty;
    content in `draft_*`). Not published.
  - **Band A (header) DONE** — section **1078**, lexical h1 "Portfolio dashboard" +
    subtitle, group theme `header`.
  - **Band C (KPI row) DONE — exercises G2** — four Card tiles (sections **1079–1082**),
    each `pageSize:1`, `cellsGridSize:1`, bound to source 3, `display.cardStyle` =
    `kpi_sky` (Currently held), `kpi_field` (For sale now), `kpi_amber` (Sale pending),
    `kpi_ink` (Sold to date). Calc expressions copied verbatim from live section 1055
    (held-list filter, `count(*) FILTER`), so numbers should reconcile with the
    Properties strip (~199 / 60 / 17 / 1115).
  - **Theme compiles clean** — `npm run dev` (Vite 7) started with no build errors, so
    the G2/G6 theme additions are good in a real build.
  - (Transient, now resolved) At first the whole app blanked because the checked-out
    `src/dms` submodule was momentarily missing the `reconcileComparisonSeriesColumnOnState`
    export that `transportny/theme.js` → `ReportRouteList` → `useAddGraphSection.js`
    statically imports (the themes barrel imports all themes, so one bad import blanks
    everything). The owner pulled dms updates; the export is present again; not a real bug.
- **2026-08-04 (session 2b) — LIVE-VERIFIED at `/admin/edit/dashboard`, two G2 bugs found & fixed.**
  With the CLI/config fix + the dms pull, the dev server renders the page. Confirmed:
  the ink `app`-layout SideNav (G1) with the ACLB logo + "Portfolio dashboard" nav item;
  Band A header; Band C's four KPI tiles with **real numbers that reconcile** — 198 held /
  60 for sale / 17 pending / 1,115 sold (task expected ~199/60/17/1115). Live rendering
  exposed two defects in the `kpi_*` variants (invisible at the data layer), both fixed in
  `theme.js` and re-verified via computed styles:
  1. The `kpi` style baked `text-[38px]` into `value`, so it landed on the caption cell
     too (captions rendered 38px). Fixed: `value:"w-full"` (font comes from the cell's
     `valueFontStyle`; the KPI figure uses `displayXL`), matching the default style's
     documented rule.
  2. `border ${BORDER}` (the `border-[ink]/10` shorthand) set border-top-color and, by
     Tailwind's stylesheet order, overrode `border-t-[accent]` — so every tile's accent
     computed to the neutral `/10`. Fixed: color r/b/l per-side, leaving the top color
     owned solely by the accent. Computed `border-top-color` now = sky/field/amber/ink
     per tile (rgb(10,167,228)/(76,145,41)/(224,148,11)/(22,35,44)).
- **2026-08-04 (session 2c) — display bands D, E, G, H, I, J built & LIVE-VERIFIED.**
  Created 10 sections (1083–1092) via direct `/graph`, then fixed 4 issues found only by
  live rendering. Final live state at `/admin/edit/dashboard`:
  - **Band D — Sold by year** (BarGraph, span 12, sec 1084): clean 2015→2026 distribution
    (2017 intake peak). ⚠ The companion **Acquired-by-year** graph (sec 1083) threw a
    server-side fetch error on the `acquisition_date` parse and was **deleted** — confirms
    the task's Band-D note: a two-series year chart needs the pre-agg SQL view (option 1),
    it can't be done from this column as-is. Widened Sold to full width.
  - **Band E — By status** (content_tint): status legend Card (clone of 1058, span 6) +
    avg-days-held tile (2,613, `kpi_ink`, span 6). ⚠ Dropped the **pie/donut** (sec 1085):
    AVL `PieGraph` renders empty (G4), and a BarGraph on the plain `property_status` column
    also came back empty (AVL Graph groups a true expression like the year-CASE fine, but
    not a bare categorical column). The legend conveys the same held-by-status data with
    exact counts + colored pills, so the chart slot was removed. **Open item:** held-by-status
    as a chart needs either a groupable calc expression AVL Graph accepts, or a different
    viz — worth a follow-up if a chart (not the legend) is wanted.
  - **Band G — By neighborhood** (data_bar clone of 1064, held filter, span 6): South End 57,
    Eagle Hill 9, Colonie 6, Buckingham Pond 6, Delaware Ave 5, Campus Area 3, All others 101
    — proportional green bars, `tail_rank` "All others" bucket works.
  - **Band H2 — Needs attention** (span 6, beside G): Title problem 6 · Tabled 6 · Held > 8 yrs 69.
  - **Band H1 — Disposition pipeline** (stacked_bar → **G6**, sec 1090, span 12): renders the
    seven-status colored bar + legend "60 For Sale · 57 ACLB Project · 17 Sale Pending ·
    26 Processing · 11 CoDev · 16 On hold" (sums to 187 = held-non-null total).
    ⚠ **Key finding (worth a library note):** `stacked_bar`'s docs say `segments[].col` =
    the sibling's normalName (the SQL alias), but the fetched **row keys calc columns by
    their FULL `name` string, not the alias** (verified via React fiber). So `col` must be
    the exact full `count(*) FILTER (…) as x` string; using the alias silently yields an
    all-zero bar. Also the count columns need `show:true` AND `selectOnly:true` (fetch gate
    is `show && !selectOnly`, Card.jsx:896). Consider fixing getData to set
    `normalName = alias` for aliased calc columns so the documented usage works.
  - **Band I — Inventory table** (Spreadsheet clone of 1069, held filter + `allowDownload`,
    span 12): real rows, colored status pills, right-aligned Price/Days, pagination
    (187 held rows), CSV/xlsx download button. Excellent.
  - **Band J — Footer** (lexical, ink band): staff-portal line.
- **2026-08-06 (session 3) — Band B (scope filters + cross-filtering) built & LIVE-VERIFIED.**
  Full page-variable machinery per `creating-interactive-pages.md` + `full-text-search-filter.md`:
  - **Part 0** — registered page variables `status`, `city`, `search` in page 1077
    `data.filters` (the whitelist; without it nothing reacts). Confirmed live: URL carries
    `?status=&city=&search=`.
  - **Part 1** — a **Filter control** section (**1093**, element-type `Filter`, span 12) in a
    new **"Band B — Scope"** group inserted below the header (all groups reindexed): a Status
    select, a Municipality select, and a "Search parcel or address" box (`operation:"like"`,
    `hideExternalToggle`), `filterStyle:"panel"`, `placement:"inline"`, `gridSize:3`.
  - **Part 2** — consuming leaves added to the data sections' filter trees (`data:[]` cleared
    so they re-query). Matrix: **city + search** on KPIs (1079–82), legend (1086), avg-days
    (1087), neighborhood (1088), needs-attention (1089), pipeline (1090), table (1091);
    **status** additionally on avg-days, neighborhood, table (the detail views — NOT the KPIs
    or the status-breakdown sections, where a status facet is self-referential). Sold-by-year
    (1084) deliberately ignores all (historical). Search = one `OR` group of `like` leaves over
    `street_address` / `name` / `eproperty_id` / `neighborhood`, all `searchParamKey:"search"`.
  - **Verified live:** search "Delaware" → KPIs 198/60/17/1115 → **11/11/0/40**; city
    "Cohoes" → **3/1/1/65**; city "Bethlehem" (via dropdown) → **0/0/…/19** with a
    "Bethlehem ×" chip. Selections round-trip through the URL + the control.
  - ⚠ **Finding — external-source select filters need static `options`.** The Filter control's
    dropdowns came up **empty** (the in-browser distinct-values fetch in `RenderFilters.jsx`
    didn't populate for the external DAMA source — though the same UDA options path works fine
    from a script: `['uda','landbank_dama','viewsById',3,'options','{"groupBy":["city"]}','dataByIndex',…]`
    returns all 29 cities). Fix = the sanctioned **static-options** path (`RenderFilters.jsx:121`):
    hand-listed `options:[{value,label}]` on the status (10 held) + city (29) columns. This is
    gap **G8**. The *filter itself* always worked (proven by setting `?city=…` directly before
    options were added); only the picker UI needed the options. Worth a library follow-up:
    why the live options fetch no-ops for external sources.
- **2026-08-06 (session 4) — Band F (portfolio map) built & LIVE-VERIFIED.** A page-state-aware
  **`Map`** section (**1094**, span 12) in a new "Band F — Map" group inserted after Band E:
  - One **circle** layer over view 3 (`landbank_dama`), categorical `circle-color` = `match` on
    `property_status` → the 7 status colors; radius `interpolate` zoom 6→14, white stroke; 7-row
    `legend-data` (For Sale / ACLB Project / Sale Pending / CoDev / In process / On hold / Sold).
    Tile host is **dmsserver.availabs.org** (NOT graph.availabs.org — 204 there); pre-flighted
    the tile (200, carries `property_status`+`city`, MVT layer name `view_3`).
  - Component choice per `creating-a-map-section.md`: **`Map`** (page-state-aware), not
    `Map: Dama Map` (page-blind).
  - **Verified live:** basemap frames Albany County; **1207 point features render** colored by
    status (confirmed via `queryRenderedFeatures`), legend shows all 7 rows.
  - ⚠ **Finding — dynamic-filters hide an always-visible data layer when the page var is empty.**
    I first bound `city`/`status` dynamic-filters (for map cross-filter). Result: **zero points**
    — the runtime compiles an empty page var to `["in", <col>, [""]]` (matches nothing), and
    `map/index.jsx:681-688` treats `defaultValue` as a single value (no "show all when empty").
    Debugged via the maplibre instance (fiber walk → `getStyle`/`querySourceFeatures`): 1232
    source features present, `renderedCount:0`, layer `filter` = `["all",["in",…city…,[""]],["in",…status…,[""]]]`.
    **Fix:** removed the dynamic-filters → the map is a **full-portfolio overview** (always shows
    every parcel colored by status — the task's "portfolio map, colored by status"). The map does
    NOT cross-filter with the scope band (gap **G5** — map interactivity is limited; the KPIs/
    charts/table already carry the scope filters). Making the map cross-filter would need a
    runtime change (treat empty dynamic-filter value as "no constraint" for always-on layers).
  - Note: maplibre fetches tiles in a **Web Worker**, so CDP network tracking does NOT see
    `/tiles/` requests (the basemap's don't show either) — verify the layer via the map instance
    (`querySourceFeatures`/`queryRenderedFeatures`), not the network panel.
- **2026-08-06 (session 5) — Band K (add-parcel modal) built & LIVE-VERIFIED.** All core behavior
  per `modal-section-group.md`:
  - **Prereq 4 (option harvest) DONE** — pulled distinct values via the UDA options path for
    `property_status` (12), `sale_status` (9), `program_type` (5), `target_disposition` (2),
    `property_class` (5), `acquisition_method` (9), `neighborhood` (49) → saved as static
    `options` on the form's select columns (same external-source reason as Band B / G8).
  - **Modal group** (`isModal`, `modalParamKey:"addparcel"`, `modalSize:"3xl"`) + **create-form
    Card** (**1096**): `externalSource`=source 3, `allowAdddNew`, `addItemLabel:"Save property"`,
    `addNewBehaviour:"append"`, `closeModalOnAdd:"addparcel"`, `add_publish` provider
    (`paramKey:"newparcel"`), never-match filter (`eproperty_id in ["__none__"]`) so only the
    new-item form shows. ~24 fields (task Band K table) each with explicit `type` (text / number /
    select+options / textarea+rows), `headerFontStyle:"labelSM"`, placeholders, defaults
    (`city:"Albany"`, `property_status:"Processing"`), + `selectOnly` create defaults
    (`active:"Y"`, `inventory_type:"Land Bank"`).
  - **Trigger** (**1095**): a Card cell "+ Add parcel" with the `click_publish` provider
    (`paramKey:"addparcel"`), in the header band.
  - **Live refresh**: `data_refresh` subscribers (`paramKey:"newparcel"`) added to all 11 data
    sections (1079–82, 1086–91, 1094) so a created row updates them without a reload.
  - ⚠ **Key fix — the add form is gated on `externalSource.isEditable`, not just the source-level
    toggle.** The `externalSource` blob copied from section 1055 lacked `isEditable`, so the Card
    rendered only field LABELS (no inputs). Setting `externalSource.isEditable = true` on the form
    Card made the full editable form render. (The source-level metadata toggle is on — the owner
    confirmed — but the embedded blob needs the flag too.)
  - **Verified live on a throwaway PUBLISHED page** (`/admin/modal-test`, created + deleted; the
    view-mode modal only reads published sections): "+ Add parcel" opens the modal overlay; the
    form renders all fields as correct editable widgets — text inputs, **select dropdowns** with
    the harvested options, number inputs, the `YYYY-MM-DD` date field, the Potential-use textarea,
    Tags, and the **"Save property"** button; the ✕ closes the modal. Also confirmed the admin
    SideNav auto-lists pages (both "Portfolio dashboard" and the temp page appeared). Throwaway
    page 1097 + sections 1098/1099 deleted after verifying.
  - ⚠ **NOT executed — a live create submission.** Clicking "Save property" writes a real row to
    the production ACLB source 3. To avoid polluting real data, I verified the form/modal render
    but did not submit. The write path itself is the proven external-CRUD (`isEditable` + `ogc_fid`
    PK, "live-tested 2026-07-08"). **Owner test to run deliberately:** submit one parcel, confirm
    the row lands in source 3 with the right columns, the modal closes (`closeModalOnAdd`), and the
    KPIs/table/map refresh (`add_publish`→`data_refresh`); delete the test row after.
- **ALL BANDS A–K BUILT.** Remaining polish: (1) run the live create test above; (2) publish the
  dashboard so the modal works in view mode (currently draft-only — the modal is invisible in view
  mode until published; edit mode shows it inline); (3) an index page/route for `/admin` itself
  (currently `/admin` resolves to the dashboard, which is fine); (4) the escalated library gaps
  (G4 donut, G7 Card export, G8 external-source select options, plus the two runtime findings:
  stacked_bar sibling-key resolution, and dynamic-filter "show-all-when-empty" for always-on map
  layers). Browser auth for verification: admin pattern is restricted — seed the minted JWT into
  `localStorage.userToken` (mint via `mint-token.mjs`) rather than the login form.
- **2026-08-07 (session 6) — design-alignment pass 1: mockup vs live diff + section-group
  restructure. Playwright loop established + structural rebuild DONE & LIVE-VERIFIED.**
  - **Playwright verify harness** (per `transcribing-a-design-card-to-dms.md`): installed
    `playwright` + chromium; helper scripts in `scratchpad/landbank/` — `page-shot.mjs`
    (mockup vs live), `page-shot-live.mjs` (live only, long-wait + scroll + console capture).
    Auth via `mint-token.mjs` → `scratchpad/landbank/auth.json` (storageState, origin
    `http://localhost:5173`, `userToken` key). ⚠ **Verification caveat:** the remote-DAMA
    aggregates take **>5s** to land in a headless browser — a 5s wait screenshots an all-empty
    page (spinners). Use ~14s + a scroll pass (`page-shot-live.mjs`) or the data reads as broken
    when it isn't. Page row backed up first to `scratchpad/landbank/backups/page_1077.good.json`
    (edit-mode loads can auto-persist a degraded layout). Live edit URL: `/admin/edit/dashboard`.
  - **Diff findings** (mockup `admin-dashboard.html` vs live): biggest gap was **stacked group
    padding** — every band was its own `layoutGroup`, and the `content`/`content_tint` styles carry
    `wrapper1: … py-12` (48px top+bottom); 8 stacked groups = ~96px between bands, on top of the
    `sectionArray` `p-3` gutter. Also: bands floated on paper with no card frame or title; layout
    didn't pair neighborhood+pipeline; map shows full portfolio (sold=ink dominates); table
    column order/labels off; no header meta strip/Export; composition legend lists 10 raw statuses
    (mockup groups to 6) + no donut (G4); by-year single-series (needs the year SQL view).
  - **Restructure DONE (owner rule: only add section groups when necessary).** Collapsed **11
    groups → 4**: `header` (1078, 1095), one `content` **"Dashboard"** group (all 13 data bands),
    `footer` (1092, position `bottom`), and the `isModal` add-parcel group (1096). Reused existing
    group uuids. Scripts: `scratchpad/landbank/restructure.mjs` (group/size/frame/title/height
    patches via direct `/graph` `dms.data.edit`) + `reorder.mjs` (sets `draft_sections` **ref-array
    order** — ⚠ **key finding: section order within a group is the page's `draft_sections` array
    order, NOT the section's `data.index`**; patching `index` alone did nothing).
  - **Per-section framing (no new sections, no new groups):** each data band now renders as a white
    bordered card via the sectionArray inner-box chrome — set on the section row: `bg`, `border`
    `{top,right,bottom,left}`, `radius` `{tl,tr,bl,br}`, `height:"fill"` on side-by-side pairs.
    **Inner padding:** the chrome box has no padding knob, so injected via `bg:"bg-white p-4"`
    (resolveBg passes any `bg-`-prefixed literal verbatim — localized, avoids touching the shared
    `backgrounds.white` token). Needs-attention uses `bg-[#F7FAFB] p-4` (tint). KPI tiles keep their
    own `kpi_*` dataCard frame (no section bg → no double frame).
  - **Per-band titles (no new sections):** set `data.title` on the lead section of each band —
    `section.jsx` renders it as a heading styled by `theme.heading[level] || theme.heading.default`.
    Landbank had no `heading` key (base theme's uppercased it), so **added a `heading` key** to
    `src/themes/landbank/theme.js` (title-case `displayMD` + bottom rule). ⚠ **Theme edit — needs a
    dev-server restart to take effect** (code-theme edits don't hot-reload); until then titles render
    UPPERCASE from the base theme. Did **not** restart (3 `npm run dev` instances running; PID 3636
    serves 5173) — activates on the next natural restart.
  - **Verified live** (`dash.after3.png`): 4 groups, tight spacing (single `py-12`), scope→KPI→
    by-year→(status+avg)→map→(neighborhood+pipeline)→needs-attention→table flow matches the mockup,
    white framed cards with padding, titles present. Page 1077 confirmed intact (17 sections/4 groups).
  - **Remaining design-alignment items (pass 2, mostly element-data surgery — not yet done):**
    map held-only default (static MapLibre layer `filter` `["!=",["get","property_status"],"Sold"]`
    on sec 1094 so colors show, not ink-dominated); table (1091) column reorder Address-first +
    short Class label + days-held sort + row action links (G9); composition legend (1086) regroup to
    the mockup's 6 buckets via a CASE calc; scope band (1093) eyebrow/Reset/helper; header meta-strip
    Card + Export (Export = G7). Blocked/decision: 2-series by-year (needs `(year,acquired,sold)` SQL
    view), donut (G4 library), SideNav groups/topbar (pattern nav to pages that don't exist yet).
- **2026-08-07 (session 6b) — design-alignment pass 2 (content) + add-parcel modal rework. LIVE-VERIFIED.**
  Helpers: `scratchpad/landbank/eldata.mjs` (`get`/`edit`/`editElData` — read-modify-write a section's
  element-data JSON string, preserving `element-type`). Screenshot progression `dash.after1..5.png`.
  - **Add-parcel modal (1096) — reduced + create-then-open-edit.** Per owner: trimmed the form to
    **5 visible fields** — `street_address`(12), `city`(6), `zip_code`(6), `neighborhood`(6, select),
    `property_status`(6, select) — keeping the two hidden `selectOnly` create-defaults (`active:"Y"`,
    `inventory_type:"Land Bank"`) so the row is valid. **Save behavior:** `display.addNewBehaviour:"navigate"`
    + `display.navigateUrlOnAdd:"/property-edit?id="`, button `addItemLabel:"Save parcel"`. On save the Card
    creates the row (Postgres assigns the `ogc_fid` PK → `res.id`) and `dataWrapper/index.jsx:624` runs
    `navigate(\`${baseUrl}${navigateUrlOnAdd}${res.id}\`)` → **`/admin/property-edit?id=<newId>`**. ⚠ That
    edit-view page does **not exist yet** (owner: "link it up once the view page is implemented") — the slug
    `property-edit` is a placeholder to rename when that page is built. Live create submission still NOT run
    (writes to prod source 3) — deliberate owner test.
  - **Portfolio map (1094) — held-only default.** Map was ink-dominated (1,115 Sold vs ~200 held). Added a
    **static layer filter** (NOT a page-var dynamic filter — sidesteps the G5 empty-hides-layer bug) on the
    `lbprops01` layer: `filter: { property_status: { operator:"!=", value:["Sold"] } }`. The runtime
    (`map/SymbologyViewLayer.jsx:463-572`) composes static `filter` (a **column-keyed object**, not a maplibre
    array) into `['all', …]`. Verified: map now renders colored held points, Sold excluded.
  - **Table (1091) — mockup columns.** Reordered to **Address · Parcel (SBL) · Neighborhood · Class · Status ·
    Days held · Asking**; switched the parcel column from `eproperty_id` → **`name`** (the SBL, per the source
    map), relabeled "Type"→"Class", `asking_price` formatFn `comma_dollar`. ⚠ Tried `days_in_inventory sort:desc`
    but Postgres `DESC NULLS FIRST` surfaced 0/null-day rows on top (worse) — **removed the sort**; a real
    days-desc needs NULLS-LAST support (follow-up). Row action links (view/edit) deferred to G9 + the view page.
  - **Scope band (1093)** — added `data.title:"Scope"` (mockup eyebrow).
  - **Deliberately skipped (flagged, not guessed):** composition legend 6-bucket regroup — the mockup's bucket
    counts don't reconcile with the data and regrouping would break `status_pill` coloring (keyed on raw status);
    needs an explicit bucket definition from the owner. Header meta-strip + Export — would add a section (owner
    rule: avoid) and Export is G7. 2-series by-year (SQL view), donut (G4), SideNav/topbar (pattern nav) unchanged.
  - **Still pending a dev restart:** the title-case `heading` theme key from session 6 — band titles render
    UPPERCASE until `npm run dev` is restarted.

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
| **G2** ✅ DONE (2026-08-04) | The 4 KPI tiles have **different top-border accent colors**; `dataCard.styles` has one `kpi` variant, and `activeStyle` is per section | **landbank theme** | ~~Add~~ **Added** `kpi_sky` / `kpi_field` / `kpi_amber` / `kpi_ink` variants (shared `mkKpi(accent)` helper, different `border-t` color) to `dataCard.styles` in `src/themes/landbank/theme.js`. Author-selectable per section from the existing style dropdown; every future stat strip benefits |
| **G3** | KPI tile 1's **sparkline** (11 mini bars, last one highlighted) | recommend *no code* | Ship the tile as a Card + a tiny `BarGraph` section (`height:48`, axes/legend off) beneath it in the same band — expressible today. If sparkline-in-a-cell is wanted later: a `sparkline` column type reading a sibling **array** column (`array_agg(...)` calc), same "reads the row" convention `data_bar`/`stacked_bar` already use |
| **G4** | **Donut** (ring + centered total) — `PieGraph.jsx` hardcodes `innerRadius = 0` | **library** | Add `display.pieInnerRadius` (0–0.9, default 0) to graph_new's config + pass it through `PieGraph`'s `p.innerRadius = pieDiameter * 0.5 * pieInnerRadius`; optionally `pieCenterLabel` for the total. Small, backward-compatible, and it's the one graph knob every dashboard mockup asks for |
| **G5** | Map **cluster bubbles with counts** + pinned popover | recommend *no code* | Ship status-colored points + the standard legend/hover/popup. Clustering is a MapLibre/symbology-level feature, not a section knob — treat as a separate research item, not a blocker |
| **G6** ✅ DONE (2026-08-04) | `stacked_bar` reads its colors from a `stackedBar` theme key the landbank theme doesn't ship (only `dataBar`) | **landbank theme** | ~~Add~~ **Added** a top-level `stackedBar` key mirroring `dataBar` (papertint track) with `fills` for the 7 status colors (canonical status keys + brand aliases) in `src/themes/landbank/theme.js`, so the pipeline bar and its legend match the pills exactly |
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

1. Prereqs: ✅ pattern decision (**G1**, approved), ✅ `isEditable` (ON), ✅ token; ⬜ option-list harvest (prereq 4, still needed for band K selects).
2. ✅ **DONE (2026-08-04)** — Theme additions **G2** + **G6** (cheap, unblock bands C and H).
3. Page + bands A, C, E2/E3, G, I — all clones of proven sections. Verify live.
   → ✅ admin pattern **1076**, draft page **1077**, **Band A** (1078) + **Band C** KPI row
     (1079–1082, exercising the four `kpi_*` variants) built & data-layer-verified.
     ⬜ Bands E2/E3, G, I still to clone. ⚠ Live render blocked by the transportny/dms
     `reconcileComparisonSeriesColumnOnState` import breakage (see progress log).
4. ✅ **DONE (2026-08-06)** — Band B scope filters + the `usePageFilters` leaves on the data
   sections. Cross-filtering verified live (search + city/status). Select controls use static
   `options` (G8) because the external-source distinct-values fetch didn't populate the pickers.
5. ✅ **DONE (2026-08-06)** — Band F map (tiles + symbology). Circle layer over view 3, categorical
   on `property_status`; verified 1207 points render. Cross-filter dropped (empty dynamic-filter
   hides an always-on layer — G5); shows the full portfolio.
6. Band D (after the year-view decision) and E1 (pie now, donut if **G4** lands).
7. ✅ **DONE (2026-08-06)** — Band K modal. Verified on a throwaway published page (trigger → modal
   → editable form with select options + Save button → ✕ closes). Key fix: `externalSource.isEditable
   = true` on the form blob. NOT run: the live create submission (writes to production source 3) —
   left as a deliberate owner test (verify create → modal closes → sections refresh → delete test row).
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
