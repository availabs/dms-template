# Landbank admin dashboard → live DMS page

**Project:** Landbank · **Topic:** content · **Status:** IN PROGRESS — **ALL bands A–K built & live-verified** (admin pattern + draft dashboard page 1077: header, scope cross-filter, KPIs, by-year, by-status, map, neighborhood, pipeline, table, footer, add-parcel modal). **Design-alignment passes 1, 2 and the header/KPI pass all DONE 2026-08-07** (sessions 6/6b/6c: 11→4 section groups, white-card framing + per-band titles + mockup-order reflow, map held-only default, mockup table columns, header meta-strip + action buttons with no new sections, KPI sub-stats, title-case headings — all live-verified via the Playwright harness). **The page is feature-complete against the mockup except the flagged/blocked items.** **Session 7 (2026-08-10) fixed a broken production build (missing `colorbrewer` install) and ran the live create test, which surfaced 🔴 G12 — the add-parcel create path is BLOCKED by a defaultless `ogc_fid` PK on the source table (data-layer DDL fix needed; no data was written).** **Session 7c (2026-08-10) closed the last design gap: the grouped 2-series "Acquisitions vs. sales" chart is BUILT from calculated columns alone (an `unnest` unpivot) — the previously-recorded "needs a SQL view" blocker was wrong.** Remaining: **fix G12** (the only hard blocker), then **publish** (still draft-only — and publishing before G12 ships a button that always 500s), **run `npm run deploy-landbank`** (blocked: Netlify CLI not installed/authenticated), the composition-legend 6-bucket regroup (needs owner bucket definition), and escalate the library gaps (G7/G8/G11/G13 + the G4 follow-up). · **Created:** 2026-08-04

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
- **2026-08-07 (session 6c) — header/scope/KPI band alignment + heading fix. LIVE-VERIFIED, then the
  workstation crashed.** ⚠ This entry was **reconstructed on 2026-08-10** from the session's scratchpad
  artifacts (`bands.mjs`, `kpi-fix2.mjs`, `top-shot.mjs`, `sections/*.fresh.json`, `top.after2-3.png`,
  `dash.after8-9.png`, `dash.live2.png`) after the crash ended the session before the log was written —
  the code landed and was verified, only the write-up was lost. Code committed 2026-08-10 (`615c753`).
  - **Dev server WAS restarted** — the session-6 `heading` key is active; band titles render title-case
    in the final screenshots. ⚠ **Key fix:** title-case needed an explicit **`normal-case`** on every
    `heading` level, because the core section-title wrapper (`section.jsx` / `section_components.jsx`)
    hardcodes `uppercase`, which CSS-inherits into the title text. Setting `text-transform:none` on the
    heading element itself overrides it. (Worth a library note — a theme can't opt out of the hardcoded
    `uppercase` except by fighting inheritance.)
  - **New theme surface** in `src/themes/landbank/theme.js` (additive, author-selectable):
    `layoutGroup.styles` gained **`admin_header`** (plain paper, no plat texture, `pt-8`, no `py-12` —
    the mockup's title area sits on the pane, not in a band); `textSettings` gained **`displayXL_field`**
    (green display numeral), **`kpiSub`** / **`kpiUp`** (slate / forest sub-lines) and **`kpiMeta`**
    (muted secondary that draws its own hairline divider above), plus **`btnPrimary`** / **`btnGhost`**
    so a Card cell's *value* can render as a real button.
  - **`bands.mjs`** — header band regrouped to `admin_header`; **1078** rewritten as h1 + a meta strip
    ("● 1,314 parcels tracked · source: Landbank Properties · DAMA #3", `size:8`) — the mockup's
    "synced …" line stays dropped (no backing column); **1095** → two right-aligned static cells
    (Export `btnGhost`, "+ Add parcel" `btnPrimary`, `cellsGridSize:2`, `size:4`), so Band A's meta
    strip + action row landed **without adding sections** (the A2/A3 items the plan listed, and the
    session-6b "header meta-strip would add a section" blocker — solved by reusing 1078/1095).
  - **KPI sub-stats (1079–1082)** — each tile keeps cell 0 as the big number and gains contextual
    calc sub-lines: held → "▲ 19 acquired in 2025"; for-sale → "median ask $600" + "907 vacant lots ·
    395 buildings all-time" (green numeral via `displayXL_field`); pending → "+ 6 under option · 4 at
    board"; sold → "$13.17M total proceeds" + "median 3002 days in inventory". Built as string-concat
    calc expressions so one cell renders a whole sentence.
  - **`kpi-fix2.mjs` — two SQL fixes found only by live rendering.** (1) 1079's held-2025 expression
    rendered empty until it was given an explicit **`as` alias** (`as held_acq_2025`) — a bare
    aliasless concat expression doesn't come back on the row (same full-`name`-as-row-key behavior the
    session-2c `stacked_bar` finding documents). (2) `sum(sold_amount)` failed on the TEXT-ish money
    column; fixed with **`sum((NULLIF(sold_amount::text,''))::numeric)`** — the empty-string-to-NULL
    guard is required, a plain `::numeric` cast throws on `''`.
  - **Verified live** (`top.after3.png`, `dash.live2.png`): full page renders end to end — title-case
    band titles, Export / + Add parcel buttons, four KPI tiles with accents + sub-lines, by-year bars
    (2015→2026), status legend, avg-days 2,613, portfolio map (held-only, colored pins + 7-row legend),
    neighborhood bars, disposition pipeline, needs-attention 6/6/69, held-inventory table (187 rows,
    19 pages, mockup column order), footer, and the add-parcel form inline at the page foot (edit mode).
  - **Open cosmetic items noticed in the final screenshots (not addressed):** KPI tile heights are
    uneven (tiles 2 and 4 are taller — the `kpiMeta` divider row adds height; the mockup wants equal
    heights, likely `height:"fill"` on all four); the gap between the header band and the Scope band is
    larger than the mockup's; the composition legend still lists 10 raw statuses (session 6b's
    deliberate skip, still needs the owner's bucket definition).
  - **Sanity-check for the owner:** every `asking_price` on the table reads **$500–$600** and the
    for-sale median is **$600**. That is plausible for ACLB side-lot pricing, but it is worth one
    confirmation that the column isn't truncated/mis-typed at the source before this page is shown to
    staff as an asking-price figure.

- **2026-08-10 (session 7) — deploy prep + the live create test RUN. Two blockers found; NO data written.**
  Picking up after the 2026-08-07 workstation crash (session 6c's code was committed 2026-08-10 as
  `753a29a`/`615c753`/`b967042`/`63ba402`; tree clean, everything pushed).
  - **⚠ Production build was broken — fixed.** `npm run build` failed with `Rollup failed to resolve
    import "colorbrewer"` from `src/themes/transportny/components/macroview/updateFilters.jsx`. The
    package **is** declared (`package.json` `colorbrewer:^1.7.0`) **and present in `package-lock.json`**,
    but was absent from `node_modules` — so this was a **stale local install**, not a repo defect
    (`npm install` left the lockfile byte-identical). Anyone doing a fresh install is unaffected; anyone
    who pulled the transportny map-plugins work without re-installing hits it. Fixed by `npm install`;
    build is now green (**✓ built in 1m 52s**, `dist/` populated, deploy-ready). Note the blast radius:
    it breaks the build for **every** site in this repo, not just landbank — the themes barrel imports
    all themes, so one unresolved import fails the whole bundle.
  - **⚠ BLOCKER — the add-parcel create path cannot work: the source table's PK has no default.**
    Ran the owner-approved live create submission through the real form (`create-test.mjs`, Playwright,
    edit mode on localhost). The form filled and submitted correctly, but the create round-trip returned
    **HTTP 500**:
    ```
    null value in column "ogc_fid" of relation "s3_v3_landbank_properties"
    violates not-null constraint
    ```
    The request itself was **well-formed** — `call ["uda","data","create"]` with
    `["landbank_dama", 3, {street_address, city, zip_code, property_status:"Processing",
    active:"Y", inventory_type:"Land Bank"}]` — so the modal, the `isEditable` gate, the field wiring
    and **both `selectOnly` create-defaults plus the `property_status` default all work as designed**.
    The failure is in the **data layer**: `ogc_fid` is `NOT NULL` with **no sequence/identity default**
    (the table looks like a materialized copy — `s3_v3_…` — which drops the original `serial`'s
    sequence), and the server deliberately never sends `ogc_fid` (it is absent from `metadata.columns`,
    so `buildRowPayload` strips it — `uda.controller.js:742-751`). Postgres therefore has nothing to
    fill the PK with. **Reads are unaffected** — this only breaks create.
    - **✅ No data was written.** Verified before and after: `street_address = 'ZZTEST 9999 Claude
      Verify Ln'` → **0 rows**, table total unchanged at **1,314**. Nothing to clean up, no test row to
      delete.
    - **Fix is an owner/data-team action (new gap G12, below)** — needs a DDL change on
      `landbank_dama.s3_v3_landbank_properties`, which is outside this task's access.
    - ⚠ **This changes the publish calculus:** publishing the dashboard as-is ships a "+ Add parcel"
      button to staff that always 500s. Recommend fixing G12 (or hiding the trigger) before publish.
  - **Verification tooling added** — `scratchpad/landbank/uda.mjs` (count / rows / delete against an
    external DAMA view via the real falcor paths: `['uda',env,'viewsById',view,'options',<json>,'length'
    |'dataByIndex']`, `call ['uda','data','delete'] [env,view,id]`), plus `form-probe.mjs` (DOM/selector
    probe) and `create-test.mjs` (the create submission, with failing-response-body capture).
    **Read path validated against known-good numbers:** total **1,314** (matches the header strip),
    For Sale **60**, Sale Pending **17** — all reconcile with the KPI tiles.
    ⚠ Two gotchas for future scripts: the falcor length value sits at `…options[<optionsJson>].length`
    keyed by the **exact** options JSON string, and on Windows the `import.meta.url === file://${argv[1]}`
    main-module guard **never matches** (`import.meta.url` has three slashes) — compare basenames.
  - **⚠ Netlify deploy NOT run — needs credentials.** `npm run deploy-landbank` (site
    `6049e6b1-c619-45cc-90b1-d2fd70b10560`) requires the Netlify CLI, which is **not installed**
    (absent from `node_modules/.bin` and from the global npm prefix) and **not authenticated** (no
    `NETLIFY_AUTH_TOKEN` in the environment or `.env`, no `~/.config/netlify` config). `netlify login`
    is an interactive browser flow, so this step is owner-run or needs a token supplied.
  - **Dev server note:** nothing survived the crash; a fresh `npm run dev` took **port 5174** (5173 was
    occupied), so `auth.json` now carries the `userToken` for **both** 5173 and 5174 origins.

- **2026-08-10 (session 7b) — KPI uniform heights + the by-year/composition row rebuilt as a
  4-card compound card. LIVE-VERIFIED by measurement, not just screenshots.** Deploy is on hold
  (owner), so this is design-alignment only.
  - **⭐ The `height:'fill'` diagnosis (the question "why doesn't the card fill its section?").**
    The theme's height mechanism is **not** broken. Neither the landbank theme nor the default
    `pages.sectionArray` ships a `heights` map, but that is harmless — `sectionArray.jsx`'s
    `resolveHeight` and `section.jsx`'s `resolveSectionHeightStyles` both fall through to a literal
    `'fill'` branch, and `pages.section` (which landbank does not override, so it inherits the
    pattern default) *does* ship `heights: {auto, fill, hero, tall, medium, small}`. Measured live:
    the grid item, the inner chrome box **and** `section.jsx`'s contentWrapper all reach the full row
    height (`h-full` + `flex: 1 1 auto`). **The height propagates correctly all the way to the Card's
    container — the Card simply declines to consume it.** Cause: `Card.config.jsx:499-503` —
    *"Model default: v1 themes fill, `layoutModel:'v2'` themes pack"*. The landbank `dataCard`
    `styles[0]` sets `layoutModel:'v2'`, and every named style (`kpi`, `kpi_sky/field/amber/ink`,
    built by `mkKpi()`) inherits it from `styles[0]`, so **on this theme cards pack to content height
    by default and ignore the section's spare height.**
    **Fix = two author-facing display knobs** (this is what the controls exist for):
    `display.cardsVerticalAlign:'stretch'` (card box → section box) and, when the card's own
    border/bg must reach the bottom, `display.cellsVerticalAlign:'stretch'` (cell rows → card box).
    ⚠ **Enrichment gap worth filing:** graphs get theme-level display defaults via
    `theme.chartDefaults` (`mergeChartDefaults`, graph_new/index.jsx:171), but **Cards have no
    equivalent** — no `cardDefaults`/`displayDefaults` anywhere. So a theme *cannot* say "KPI tiles
    fill by default"; every author must set the knob per section. Adding a Card equivalent is the
    author-empowerment fix (and would let `mkKpi` ship `cardsVerticalAlign:'stretch'` itself).
  - **KPI row (1079-1082) — uniform + tighter.** `height:'fill'` on each section +
    `cardsVerticalAlign:'stretch'`. Theme: `mkKpi` `cellGutter` 16→**12**, `headerValueWrapper`
    `justify-center`→**`justify-start`** with `gap-0.5` (centering pushed the figure down in the
    two-cell tiles so the four numerals lost their shared baseline), and `kpiMeta` `mt-2 pt-2`→
    `mt-1.5 pt-1.5`. **Measured: card boxes 133/133/133/133 in 157px sections — uniform.**
  - **Row layout → mockup.** 1084 "Acquisitions vs. sales" is now **size 8 + `rowspan:"3"`**
    (`md:row-span-3`), graph `display.height` 280→**600** so the plot fills its card instead of
    leaving ~400px empty. The composition column is the remaining 4 cols.
  - **The status card is FOUR sections fused into one card** (per the owner's structure: title spans
    2 units, donut 1, list 1, avg-days 2 → 4/2/2/4 page columns), using the shipped gap-0 compound-card
    model (`src/dms/planning/tasks/current/gap0-section-grid-compound-cards-migration.md`) — zero each
    shared edge's **padding**, and toggle borders on one side of each seam only:
    | Section | size | padding | border | radius |
    |---|---|---|---|---|
    | **1170** title (new `lexical`) | 4 | `{bottom:0}` | top+left+right | tl,tr |
    | **1169** donut (new `AVL Graph`) | 2 | `{top:0,right:0,bottom:0}` | left | — |
    | **1086** status list | 2 | `{top:0,left:0,bottom:0}` | right | — |
    | **1087** avg-days | 4 | `{top:0}` | top(divider)+left+right+bottom | bl,br |
    **Measured seams: title→list 0.0px, list→avg 0.0px**, and the graph card (590→1342) matches the
    column exactly. ⚠ **Every card in a fused column must be `height:'fill'`** — the title card was
    initially content-sized, and when the rowspan-3 graph grew the grid rows its box stopped reaching
    the row boundary and the seam reopened as a gap.
  - **⚠ Key fix — a section that draws its own frame must turn the Card's frame OFF.** The
    list→avg seam measured a stubborn 17px gap and the avg box was inset 17px on *all* sides: the
    section chrome (`bg-white p-4` + borders) and the Card's own `cardBorder` were drawing **two
    nested frames**. 1086 already had `cardBorder:false`; 1087 did not. Setting
    `display.cardBorder:false` (+`cellBorder:false`) closed it to 0.0px. Worth remembering for every
    compound card: **section frame XOR card frame, never both.**
  - **G4 donut SHIPPED (library, 3 files).** `avl-graph/PieGraph.jsx` hardcoded `p.innerRadius = 0`;
    now a `pieInnerRadius` prop (fraction of the slice's **outerRadius**, so the band stays
    proportional when `radiusScale` sizes pies by total; clamped to ≤0.95, added to the layout
    effect's deps), threaded through `GraphComponent.jsx` as
    `pieInnerRadius={get(graphFormat,"pieInnerRadius",0)}`, and exposed to authors as **"Donut Hole
    (0–0.95)"** in the existing `pieGraph` control group in `graph_new/config.jsx` (already gated on
    `graphType === 'PieGraph'`). Default 0 = the historical solid pie, so this is fully BC. The
    dashboard donut uses `pieInnerRadius: 0.62`. **Needs its own task doc under `src/dms/planning/`.**
  - **Three traps hit while creating the two new sections** (all now understood — put these in the
    page-creation skill):
    1. **A new section row needs `group`.** Without `data.group` = the band's uuid the section belongs
       to no band and renders **nothing at all** (no title, no component, no fiber node) while still
       existing and still sitting in `draft_sections`. Also copy `type` and a `trackingId`.
    2. **`draft_sections[].id` must be a NUMBER.** Appended as a String `"1169"` it was silently
       **pruned on the next edit-mode load** (18 entries → 17) — the session-6 "edit-mode loads can
       auto-persist a degraded layout" hazard, triggered by the type mismatch against every other
       numeric entry.
    3. **AVL Graph won't group a bare categorical column** (session 2c's finding, re-confirmed): the
       donut was blank with `property_status` as the `categorize` column and works with
       `coalesce(property_status,'Unknown') as status_label`. Pie also uses **different column targets
       than Bar** — `index`/`slice`/`categorize`, not `xAxis`/`yAxis`; with only a `categorize` + a
       `slice` column the wrapper builds one pie whose keys are the categories.
    4. Graph **margins** are sized for a full-width chart (left 100 / bottom 50). In a 2-col cell they
       consumed nearly everything and `pieDiameter` collapsed to an ~80px ring — set
       `display.margin` to ~8 all round for a small donut.
  - **Verified live** (`s7i.full.png`): KPI row uniform; graph 2/3-width and full-height; the
    composition card reads as ONE card — COMPOSITION eyebrow → "Held inventory by status" → "198
    parcels currently held" → donut + counted status list → divider → "AVG DAYS HELD 2,613"; map,
    neighborhood, pipeline, needs-attention, table, footer and the add-parcel form all unchanged.
  - **Still open on this row (not guessed at):**
    - 🔴 **"Acquisitions vs. sales" is still ONE series.** Confirmed blocked, and I tested two
      candidate workarounds rather than assuming: (a) the server's **`seriesVariants`** fan-out
      (`query_sets/postgres.js:416`) only varies each arm's **WHERE** — all arms share one
      SELECT/GROUP BY — so it cannot key year off `acquisition_date` in one arm and `sold_date` in
      another; (b) a **correlated scalar subquery** as a second measure returns an empty atom (the
      column is stripped by the attribute sanitizer). So the task's **option 1 stands: a
      `(year, acquired, sold)` pre-agg view in `landbank_dama`** — same DB access as G12. The
      single-series data is real and matches the mockup (2017 = **316** acquired).
    - The donut/list show the **10 raw statuses**, not the mockup's 6 buckets (still needs the owner's
      bucket definition — unchanged from session 6b). Slice colors are a palette in count-desc order,
      so the three 6-count statuses can swap color↔status; the durable fix is the regroup or per-key
      colors.
    - Legend pills wrap to two lines in the 2-col column; mockup has them on one.
    - Avg-days shows the mean only; the mockup also carries "median 2,756".
    - The title card uses **`h4`** (the theme's 21px `displayMD` slot). The mockup calls it `h2` but
      styles it 21px, and this theme maps `h2`→`displayXL` (38px), which rendered far too large.

- **2026-08-10 (session 7c) — Band D's grouped "Acquisitions vs. sales" chart BUILT & LIVE-VERIFIED.**
  Owner asked whether `acquisition_date` + `sold_date` could drive the side-by-side chart via
  calculated columns. **They can** — see the rewritten §"Band D" above for the full mechanism, the
  verification numbers and the caveats. Section **1084** rebuilt in place (element-data backed up to
  `scratchpad/landbank/backups/section_1084.pre-grouped.json`): three calc columns
  (`unnest` year / `unnest` series / `count(*)`), `graphType:'BarGraph'`,
  **`groupMode:'grouped'`**, `pageSize:60` (must exceed the 25-group count), `legend.position:'top'`,
  `colors:['#0AA7E4','#4C9129']` (Acquired sky / Sold field, per the mockup swatches). Row-level
  filters deliberately removed — a filter on either date would drop parcels missing the *other* one
  and undercount both series; the chart is historical and ignores the scope band by design.
  - **Verified live** (`s8a.full.png`): clean **2015–2026** axis with paired blue/green bars, 2017
    Acquired tallest (316), 2021 Sold tallest (186), 2026 correctly Sold-only, legend renders both
    series, and the unparsed-year buckets do not appear as a stray tick.
  - **⚠ Process note worth carrying forward:** across sessions 7 and 7b this task twice recorded a
    capability as "blocked" on the strength of reasoning plus two failed probes. The reasoning was
    sound about the paths it tested and wrong about the conclusion. **A negative result about a
    mechanism is not a negative result about the goal** — enumerate what the sanitizer/engine actually
    permits (here: read `disallowedKeywords`, then ask what non-blocklisted constructs reshape rows)
    before writing "impossible" into a task file.
  - **G13 (theme-level Card display defaults) and the two DDL items are unaffected** — G12 (`ogc_fid`
    has no default → the add-parcel create path 500s) is still the one hard blocker on this page, and
    still needs someone with DDL access to `landbank_dama`.

- **2026-08-10 (session 7d) — KPI tile padding unified to the mockup.** Owner spotted that tiles
  **2, 3 and 4 had no top/left padding** while tile 1 did.
  - **Cause:** section **1079** was missing `cellsPadding` / `cardsGridPadding` /
    `cardsVerticalAlign` entirely, while 1080-1082 all carried them. Session 7b's loop wrote the same
    three keys to all four; 1079's copy did not stick (most likely an edit-mode auto-persist rewrote
    its element-data — the same hazard that pruned the donut's `draft_sections` ref). So tile 1 fell
    back to the theme's ambient `cellGutter` (padding) while 2-4 had an explicit `cellsPadding: 0`
    (no padding). **Lesson: after a bulk element-data loop, read the values back and compare — don't
    assume a loop that reported success left all N sections in the same state.**
  - **Fix — put the padding on the CARD, not the cells,** which is how the mockup does it
    (`admin-dashboard.html:176-207`: every tile is `lb-card p-4 h-full border-t-2 border-t-<accent>`,
    i.e. 16px on the card; the stacked lines carry no padding and get their rhythm from
    `mt-1`/`mt-0.5`/`mt-3 pt-2`). Applied **identically** to 1079-1082:
    `cardsPadding: 16` (= `p-4`), `cellsPadding: 0`, `cellsGridGap: 4` (8 was looser than the
    mockup's rhythm), `cardsGridPadding: "0"`, `cardsGridSize/cellsGridSize: 1`,
    `cardsVerticalAlign: "stretch"`, `cardBorder: true` (the `kpi_*` accent frame IS the card border),
    `cellBorder: false`.
  - **Theme reverted toward baseline:** `mkKpi` `cellGutter` put **back to 16** (its original value).
    Session 7b had dropped it to 12 to shed whitespace, but with `cellsPadding: 0` +
    `cardsPadding: 16` set explicitly it is inert for these tiles, so leaving it modified would only
    risk drift for other cards using a `kpi_*` style. The two `mkKpi` changes that ARE load-bearing
    stay: `justify-start` (keeps the four numerals on a shared baseline once the row fills) and the
    tightened `kpiMeta` `mt-1.5 pt-1.5`.
  - **Verified by measurement, all four tiles:** computed `padding: 16px 16px 16px 16px`, label inset
    **17px** top and left on every tile (16px padding + 1px border), card heights **148/148/148/148**.

- **2026-08-10 (session 7e) — composition card tightened + a new `status_dot` column type.**
  - **⭐ NEW theme column type `status_dot`** (`src/themes/landbank/columnTypes/statusDot.{jsx,theme.js,config.js}`,
    registered as `columnTypes.status_dot` + `statusDot:` theme tokens). The legend was using the core
    **`status_pill`** type, which always fills a `UI.Pill` behind the text; the design file draws the
    composition legend as a **colored dot + plain label** (`size-2.5 rounded-full bg-<hue>` + a
    `flex-1 text-slate` label). `status_pill` has no dot variant, so per
    [`src/themes/CLAUDE.md`](../../../../src/themes/CLAUDE.md) this is the sanctioned shape: one small
    theme-registered type rendering one visual element, the same precedent as `parcel_plate`. Reads
    only its own value; the count stays a normal right-aligned Card cell. `dotColorByValue` in the
    theme maps the raw ACLB status vocabulary onto the mockup's six hues (in-process statuses share
    steel, on-hold statuses share rose), and an optional per-column `dotColors` overrides it.
    ⚠ **Key fix:** the wrapper must be **`flex w-full`**, not `inline-flex` — an inline-flex box sizes
    to its content, so a long label overran its cell and the next cell's count rendered *underneath
    it*; `truncate` never engaged because it had no constrained basis. `flex w-full` + a
    `flex-1 min-w-0` label matches the mockup's own row and makes the ellipsis work.
  - **Padding: one `p-6` card, sliced four ways.** The mockup is a single `lb-card p-6` with `mt-4`
    between blocks; ours is four fused sections each adding `p-4`, which doubled at the seams and left
    the title/footer looking airy. Now each section carries only its slice, injected via the `bg`
    string (`resolveBg` passes any `bg-`-prefixed literal verbatim): title `bg-white px-6 pt-5 pb-0`,
    donut `bg-white pl-6 pr-2 py-2`, list `bg-white pl-2 pr-6 py-2`, avg-days
    `bg-white px-6 pt-3 pb-5` (the `pt-3` is the mockup's divider gap).
  - **Donut margin 1 all round** (was 8) so the ring fills its cell — `display.margin: {1,1,1,1}`.
  - **Graph plot 600 → 430.** The real source of the airy title/footer was the rowspan-3 grid rows
    stretching to the graph's height; the slack landed as dead space in those two `height:'fill'`
    cards (they grow, their content stays top-aligned). Shortening the plot removes the slack at
    source rather than fighting it per-card.
  - **Legend cells** `cellsGridSize: 5` with the label at `cellSpan: 4` and the count at `1` — two
    equal cells gave the label only half of a ~2-col card.
  - **Verified by measurement:** every label background `rgba(0,0,0,0)` (no pill), dots 10px and fully
    rounded with the right hues (steel `rgb(129,149,161)` for Application to Board, rose
    `rgb(206,91,78)` for Foreclosure Vacated), and the two long labels now **clip with an ellipsis**
    (`text-overflow: ellipsis`, 16–17px of overflow hidden) instead of colliding with the count.
  - ⚠ **Those two ellipses are a symptom of the still-open 6-bucket regroup** — the mockup's legend
    has six short labels ("On hold / other"), so nothing truncates there. Still needs the owner's
    bucket definition; truncation is the correct interim, not the target.
  - **Dev-server hygiene:** killed the two orphaned Vite instances this session had created (5175/5176)
    and left the owner's two (5173/5174, started 11:54) alone. Current dev server: **5175**.

- **2026-08-11 (session 7f) — chart tooltips ON + the band cut from 752px to 478px.**
  - **⭐ Why neither chart had a tooltip.** avl-graph gates it on `show`
    (`BarGraph.jsx:580` `!showHoverComp ? null : …`) and **`DefaultHoverCompData` ships no `show`
    key** — it can only arrive via `display.tooltip`, which `GraphComponent` spreads into `hoverComp`.
    graph_new's `graphOptions` *does* default `tooltip:{show:true}`, but that only seeds sections
    created through the **UI**; both of these were script-built, so `show` was `undefined` → falsy →
    no tooltip, ever. Fixed with `display.tooltip` on both (no library change):
    bar `{show:true, showTotal:false, valueFormat:'comma'}` (both series for the hovered year is the
    comparison; their sum is meaningless) and donut `{show:true, showTotal:true, valueFormat:'comma'}`
    (the pie's total IS the held figure).
    **Verified by hovering:** bar tooltip returns `Sold: / Acquired: / <value>`; donut has 10
    `path.avl-slice` arcs and hovering one lists the status breakdown.
    ⚠ Note for future graph sections built by script: **always set `display.tooltip.show`** — the
    component default is off, not on.
    ⚠ The donut tooltip lists all ten statuses (a single-index pie has one index and N keys, so
    DefaultHoverComp shows them all) — effectively a second legend. Harmless, but the 6-bucket
    regroup would make it read much better.
  - **⭐ Big whitespace win: the graph's default margins.** 1084 had no explicit `margin`, so it used
    the defaults — **left 100 / bottom 50 / top 20 / right 20**. With `yAxis.show:false` that 100px
    left gutter was pure dead space. Now `{top:8,right:8,bottom:26,left:8}`.
  - **Title card: lexical → Card of static cells.** Measured, it was **168px tall for 87px of
    content**; the dead space was the lexical component's hard-default `p-4` PLUS the theme's
    `lexical.paragraph` `mb-4` on every paragraph — neither safely changeable (both global). Rebuilt
    as a Card with three cells (eyebrow / title / caption), which has no prose margins and exposes
    exact spacing (`cardsPadding` / `cellsPadding` / `cellsGridGap: 2`). This is the Card-first move
    `src/themes/CLAUDE.md` asks for, and matches how the header action row (1095) already works.
    **92px now.** Backup: `scratchpad/landbank/backups/section_1170.pre-card.json`.
    - Bonus: the caption is now a **calculated column**
      (`count(*)::text || ' parcels currently held'`) reading the same filter tree as the legend, so
      it tracks the source (and the scope band) instead of being hardcoded.
    - **NEW theme token `eyebrow`** (`metaSM`'s small-caps treatment in `skydeep`) — the design set
      puts an eyebrow above every band title, so it belongs in `textSettings`, not inline.
  - **avg-days footer:** `cardBorder:false`, `cardsPadding:0`, `cellsPadding:0`, `cellsGridGap:2`,
    section `bg-white px-6 pt-3 pb-4` → **192px → 118px**.
  - **Plot sized to fill, not to overflow.** The band height is set by the composition column
    (478px = title 92 + list 268 + avg 118), and the graph card carries ~**168px** of non-plot
    overhead (band title, section `p-4`, legend row, x-tick row). 380 overshot and pushed the band to
    548; **310 fills the card exactly** — measured `graph card 478px, plot 310px, unused 168px`, i.e.
    zero genuine slack. Worth remembering: in a rowspan column, raising a graph's `height` past
    `columnHeight − overhead` grows the whole band rather than filling the card.
  - **Net: band 752px → 478px (−36%)**, and the KPI row → band → map seams all measure 0px.
  - 🔴 **DATA INCONSISTENCY SURFACED — needs an owner decision.** The now-live caption reads
    **"187 parcels currently held"** while the KPI tile reads **"CURRENTLY HELD 198"**. Both are
    correct for their own definition: the KPI uses the documented held rule (the 10-status list
    **OR `property_status IS NULL`**), while the legend/caption filter is `property_status IN (…10…)`,
    which **excludes 11 NULL-status rows**. Previously the caption was hardcoded "198" and so agreed
    with the KPI but contradicted its own legend (which sums to 187). It is now self-consistent with
    the legend and visibly disagrees with the KPI — better, but not resolved. The mockup has no such
    gap (its legend sums to 199 = its caption), because its sixth bucket is "On hold / other" —
    exactly where those 11 NULL rows belong. **So this is the same decision as the 6-bucket regroup:
    define the buckets, put NULL in "other", and all three numbers reconcile.** Do not paper over it
    by hardcoding 198 again.

- **2026-08-11 (session 7g) — add-parcel modal form aligned to `admin-new-property.html`.**
  Reference: the design file's Location fieldset (`:126-135`) — a `block … mb-1` label **above** a
  `w-full h-10 px-3` input, on a `grid grid-cols-12 gap-3`.
  - **⭐ Root cause of the whole mismatch: `headerValueLayout` was unset**, and it defaults to
    **`'row'` (Inline)** — so every label sat *beside* its input, and the input only occupied part of
    its cell. That is also why the address field didn't span the modal: `street_address` was already
    `cellSpan: 12`, but the input was sharing that 12-col cell with its label. Setting
    `display.headerValueLayout: 'col'` (Stacked) fixed the label position **and** the full-width
    address input in one move. Backup: `scratchpad/landbank/backups/section_1096.pre-design.json`.
  - **Field spans** transcribed from the design file, with the address widened to the full 12 per the
    owner: `street_address` 12 · `city` 4 · `zip_code` 4 · `neighborhood` 4 · `property_status` 12.
    Status went to 12 so the Save button drops onto its own row instead of being squeezed into the
    leftover columns. Grid: `cellsGridGap: 12` (design `gap-3`), `cellsRowGap: 18`, `cardsPadding: 8`.
  - **⚠ NEW theme token `fieldLabel`** — labels were rendering `UPPERCASE` with wide tracking. Cause:
    the dataCard `header` class carries `uppercase tracking-[0.16em]` (correct for a data card's
    column headers, wrong for a form), and a `headerFontStyle` token is **added to** that class rather
    than replacing it, so `text-transform` has to be overridden explicitly. `fieldLabel` = `labelSM` +
    `normal-case tracking-normal`. **This is the third instance of the same trap** (section titles
    needed `normal-case` in session 6c, band titles again in 7b) — the pattern is: a core wrapper
    hard-codes `uppercase`, and a theme can only escape it by overriding on the element itself.
    Labels also renamed to the design file's sentence case ("Street address", "Zip", …).
  - **⚠ `whitespace-nowrap` added to `BTN_BASE`** — load-bearing, not cosmetic: the base fixes button
    height at `h-10`, so "Save parcel" wrapped to two lines *inside* a 40px box and overflowed it.
  - **⚠ `col-span-full` added to `formAddNewItemWrapper` / `formEditButtonsWrapper`** (landbank
    `dataCard`) — the real reason the Save button sat hard against the left edge, clipped, with a
    wrapping label. Both wrappers are **grid items in the CELLS grid**, and they shipped
    `w-fit justify-self-end self-end` (core default, same value). Without a span they land in
    **column 1** of a `cellsGridSize`-wide grid — 1/12 of the width on this form — so
    `justify-self-end` faithfully aligned the button to the end of that one narrow track, i.e. the far
    left. Now `col-span-full w-full flex justify-end pt-4 mt-2 border-t`, which also echoes the design
    system's modal footer (`px-6 py-4 border-t border-ink/10 … justify-between`).
    **Measured:** button right edge **1434px** = address-input right edge **1434px** (0px delta),
    height 40px (single line, no wrap), left edge inside the field grid.
    ⚠ The core default carries the same latent bug for any Card whose `cellsGridSize` > 1 — worth
    fixing upstream in `card.theme.jsx` rather than per theme.
  - **Modal body padding** — set on the section (`padding: {6,6,6,6}` = 24px, matching the design's
    `px-6 py-5`) because the modal panel itself has none. See G14.
  - ⚠ **Verified in the INLINE edit-mode render only.** The view-mode modal reads *published*
    sections, so the actual modal chrome (panel padding, scrim, ✕) is still unverified — as in session
    5, that needs a throwaway published page. The field layout, labels, spans and button are confirmed.
  - **Not done (deliberately out of scope, flag not guess):** the design file's modal **header** —
    eyebrow ("New property record · step 2 of 2") + the address as an `h2` + an SBL/neighborhood
    subtitle — plus its grouped fieldsets with icon captions ("Identification", "Location", …) and a
    footer action row. Those need at least one more section in the modal group; worth doing but it is
    a scope decision, not a formatting fix.

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

✅ **SOLVED 2026-08-10 (session 7c) — the grouped two-series bar IS buildable from this table, with
calculated columns only.** No SQL view, no library change, no DDL. **Superseded reasoning is kept
below for the record because it was wrong in an instructive way.**

**The solution — an `unnest` unpivot in two calculated columns.** Two same-cardinality
set-returning functions in the SELECT list zip in lockstep (Postgres 10+), so each parcel becomes
**two rows** — `(acq_year,'Acquired')` and `(sold_year,'Sold')`:

```sql
-- xAxis      (group: true)
unnest(array[<year_of(acquisition_date)>, <year_of(sold_date)>]) as yr
-- categorize (group: true)
unnest(array['Acquired','Sold']) as series
-- yAxis      (fn: 'exempt')
count(*) as parcels
```

Grouping on the two `unnest(...)` expressions yields exactly `(year, series, count)` — the shape a
grouped `BarGraph` wants (`display.groupMode: 'grouped'`). Why this works where everything else
failed: `unnest` is **not** in `sanitizeName`'s blocklist (`select`/`union`/`cast` are, which is what
killed the subquery and inline-UNION approaches), and — the surprise — **Postgres accepts the SRF as
a GROUP BY key here**, so the server aggregates it rather than the client.

**Verified**: 25 group rows (11 years × 2 series + 2026-Sold-only + 2 unparsed buckets), zero
duplicates, the `length` route independently agrees (25), and both series reconcile exactly to the
table total — Acquired 1285 + 29 unparsed = 1314, Sold 1135 + 179 unparsed = 1314. The **year spine
is the union of both columns for free**, so 2026 (23 sales, no acquisitions) appears — a spine
derived from `acquisition_date` alone would silently drop it.

⚠ **Caveats:** (1) the 29/179 unparsed-date rows are silently excluded, so the chart's Sold total
(1135) will not match the KPI strip's status-based 1,115 — state which definition is meant;
(2) slice/series colors are assigned by key order from the data, so Acquired↔Sold could swap colors
if that order changes — currently correct (Acquired sky, Sold field) but worth pinning with
`colorsByKey`.

<details><summary>Superseded (pre-session-7c) analysis — kept because the dead ends are worth knowing</summary>

The original claim was that acquisitions and sales live in two columns on the same row and a single
GROUP BY can only key on one, so the chart needed one of: (1) a `(year, acquired, sold)` SQL view in
`landbank_dama` registered as a second DAMA source; (2) two adjacent single-series BarGraphs; (3) a
library-level unpivot. Genuinely dead ends, each confirmed by test rather than assumption:
`seriesVariants` (`query_sets/postgres.js:416`) varies only each arm's **WHERE** — all arms share one
SELECT/GROUP BY; a **correlated scalar subquery** as a second measure is stripped (blocklisted
`select`) and returns an empty atom; `join.sources` must resolve to a **registered DAMA view** via
`getEssentials(view_id, env)`, so no inline `(VALUES …)` relation for a cross-join unpivot. The error
was concluding from those that the whole class was impossible, instead of testing the SELECT-list SRF.
</details>

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
| **G4** ✅ **DONE (2026-08-10)** | **Donut** (ring + centered total) — `PieGraph.jsx` hardcoded `innerRadius = 0` | **library** | ~~Add~~ **Added** `pieInnerRadius` (0–0.95, default 0): `avl-graph/PieGraph.jsx` derives `p.innerRadius` from the slice's own `outerRadius`, `GraphComponent.jsx` passes `get(graphFormat,"pieInnerRadius",0)`, and `graph_new/config.jsx` exposes **"Donut Hole (0–0.95)"** in the `pieGraph` group. Fully BC (0 = solid pie). Live on the dashboard at 0.62. **Still to do:** the centered "199 HELD" total (`pieCenterLabel`) is NOT implemented, and this needs its own task doc under `src/dms/planning/` |
| **G14** | **The modal section group's chrome is hardcoded, un-themed Tailwind.** `sectionGroup.jsx:107-120` renders the panel as `relative bg-white rounded-lg shadow-xl w-full ${modalWidthClass} mx-4 max-h-[90vh] overflow-y-auto` — **no padding class at all**, so section content sits flush to the modal edges; plus a `bg-black/50` backdrop and a `text-gray-400` ✕. The theme's own `modal` style (ink scrim, `rounded-md`, themed title/close/body) is never consulted, and this contradicts `packages/dms/CLAUDE.md`'s "all markup must be styled through the theme" rule | **library** | Read the panel/backdrop/close classes from `getComponentTheme(theme, 'modal')` (the key already exists with `panel`/`header`/`title`/`closeButton`/`body`, and landbank already ships `default` + `wide` styles), falling back to the current literals for BC. Then a modal gets its padding and scrim from the theme instead of each author padding the inner section. Interim used here: put the padding on the section (`padding: {6,6,6,6}`) |
| **G13** | **A theme cannot set default `display` values for Cards.** Graphs merge `theme.chartDefaults` into their display (`mergeChartDefaults`); Cards have no equivalent, so theme-level intent like "KPI tiles fill their section" can't be expressed and every author must set `cardsVerticalAlign:'stretch'` per section | **library** | Add a Card counterpart (e.g. `theme.dataCard.styles[i].displayDefaults`, merged under the section's own `display` so explicit section values always win). Then `mkKpi()` can ship `cardsVerticalAlign:'stretch'` and the landbank KPI strip fills by default. Found while diagnosing why `height:'fill'` alone doesn't make a v2-model card fill — see session 7b |
| **G5** | Map **cluster bubbles with counts** + pinned popover | recommend *no code* | Ship status-colored points + the standard legend/hover/popup. Clustering is a MapLibre/symbology-level feature, not a section knob — treat as a separate research item, not a blocker |
| **G6** ✅ DONE (2026-08-04) | `stacked_bar` reads its colors from a `stackedBar` theme key the landbank theme doesn't ship (only `dataBar`) | **landbank theme** | ~~Add~~ **Added** a top-level `stackedBar` key mirroring `dataBar` (papertint track) with `fills` for the 7 status colors (canonical status keys + brand aliases) in `src/themes/landbank/theme.js`, so the pipeline bar and its legend match the pills exactly |
| **G7** | Export button on a **Card** — `dataWrapper` has the xlsx export, but only Spreadsheet's config exposes `allowDownload` | **library** (1-line config) | Add the same `{type:'toggle', label:'Allow Download', key:'allowDownload'}` control to `Card.config.jsx`. Until then: put the export on the Spreadsheet (Band I) only, and drop the header Export button |
| **G8** | Create-form `select` fields need **option lists**; `mapped_options` loads rows from a lookup source (this source has none), so options must be hand-listed | **library** (optional) | Ship hand-listed `options` now (harvest via one distinct pass). Enrichment worth considering: let `mapped_options` take `{distinctColumn}` against the section's own source so an author can say "options = the distinct values of this column" |
| **G9** | Table row **icon-only** view/edit actions; link cells render text (`isLink` + `linkText`) | **landbank theme** | A small `icon_link` column type (icon name + `location`/`searchParams` template, per the theme's own icon registry) — pure chrome, one concern, exactly the `portrait_banner`/`stream_player` shape sanctioned in `src/themes/CLAUDE.md`. Interim: `linkText:"View"`/`"Edit"` text links |
| **G10** | Mockup's flow is **address → geocode → prefilled modal**; DMS has no geocoding step | out of scope | Ship the single-step modal with manual `latitude`/`longitude`. A geocode-on-create step is a server/datatype concern (geocodio is already the source's provenance) — separate task if the owner wants it |
| **G11** | No CLI command inspects or sets **external (DAMA) source metadata** (`isEditable`, PK) — `dms dataset *` only covers internal DMS sources | **library (CLI)** | Add `dms dataset external show <source-id> --env <pgEnv>` (+ optionally `set-editable`) so prereq 1 is verifiable from the terminal instead of only through the admin UI |
| **G12** 🔴 **BLOCKER (found 2026-08-10)** | **Create fails on any external source whose PK has no default.** `landbank_dama.s3_v3_landbank_properties.ogc_fid` is `NOT NULL` with no sequence/identity, and the server never sends `ogc_fid` (absent from `metadata.columns` → stripped by `buildRowPayload`), so every insert violates the not-null constraint. Breaks the whole add-parcel flow; reads unaffected | **data layer** (primary) + **library** (defensive) | **Primary (owner/data team):** give the PK a default on the materialized table — `ALTER TABLE …s3_v3_landbank_properties ALTER COLUMN ogc_fid ADD GENERATED BY DEFAULT AS IDENTITY;` then `SELECT setval(pg_get_serial_sequence('…','ogc_fid'), (SELECT max(ogc_fid) FROM …));` (verify the exact DDL against the live table first — the `s3_v3_` materialization is what dropped the original serial). **Defensive (library):** `resolveEditableTable`/`createExternalRow` should detect a defaultless NOT NULL PK and fail with an actionable message (or offer an explicit opt-in `max(pk)+1` fallback) instead of surfacing a raw Postgres 500 — right now an author gets no clue what is wrong. Also worth folding into **G11**, so `dataset external show` reports "PK has default: yes/no" and prereq 1 becomes verifiable before a form is ever built |

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
6. ✅ **DONE (2026-08-10)** — Band D grouped 2-series by-year chart (sec 1084) via the `unnest`
   unpivot in calculated columns — **no SQL view needed after all**; and E1's donut, via the shipped
   **G4** `pieInnerRadius` knob (sec 1169).
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
- [x] Modal: trigger opens it (verified session 5) — form renders + submits the correct payload (session 7)
- [ ] 🔴 **BLOCKED by G12** — row appears in the DB with the right column values. The submit returns
      HTTP 500 (`ogc_fid` not-null violation); nothing is ever written. Re-run `create-test.mjs` once
      the PK gets a default.
- [x] A failed add leaves the form intact (session 7: the 500 left the page and the typed values in place)
- [ ] 🔴 **BLOCKED by G12** — created row appears in the table + KPIs without a reload (`add_publish` → `data_refresh`)
- [ ] Page is **not** reachable by an anonymous user (pattern/page `authPermissions`)
- [ ] Draft-only: no `dms page publish` run by this task (except the throwaway modal-verification page, which gets deleted)
