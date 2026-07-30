# ReportRouteList — archive

Read-only historical detail. Current status lives in [`reportroutelist.md`](./reportroutelist.md).

Merged into this archive 2026-07-30 from two task files
(`planning/tasks/completed/reportroutelist-ux-polish.md`,
`planning/tasks/completed/add-route-flow-improvements.md`) verbatim, plus one section written up
from memory (the add-by-DMS-id fix had no dedicated task file, only a memory record — promoted
here since the code it patched still matters as history even though the mechanism itself was later
replaced).

---

## Add-by-DMS-id fix (2026-07-24)

Written up from memory (`project_reportroutelist_add_by_dms_id_fix`, no dedicated task file
existed) since this fix has real historical value even though the mechanism it patched was
replaced five days later by the 2026-07-29 rebuild (see below).

**Root cause**: the "Add a Route to Your Report" catalog Spreadsheet section's `click_publish`
provider (`display._functions.providers[0].args`) was configured `{"column": "route_id",
"id_column": "route_id"}` — publishing a clicked row's `route_id` column value as the
`add_route_id` action param. `route_id` is a data column populated only by the old-report
conversion script (the legacy `admin2.routes.id`); routes created via the new routecreation tool
never set it. `computeRowPublish` (`spreadsheet/rowPublish.js`) early-returns `{op:'noop'}` when
the configured column's value is `null`/`undefined` — so clicking a new-tool-made route did
nothing at all, not even a visible error. `ReportRouteList.jsx`'s own `fetchDynamicRoute`
compounded this by filtering the catalog query on `data->>'route_id'` directly.

**Fix — code**: `fetchDynamicRoute` was changed to request/filter on the row's own DMS `id` (a
real top-level column, not a `data` JSONB key) via the `systemCol: true` convention — pushed into
the `columns` array passed to `buildUdaConfig`, filtered via `{col: "id", op: "filter", ...}`
(resolved by `attributeAccessorStr`'s `isSystemCol` branch to bare `id`, no `data->>` wrapper), and
fetched via explicit `attributes: udaConfig.attributes` + flat per-column remap (mirrors
`useReportRow.js`'s own `loadReportRow`, which hit the identical "must explicitly request
attributes or the response falls back to a single opaque `data` blob" gap when it was fixed for
the graphIds-wiped bug). `isDuplicateRoute` was also updated: compares `id` first, falls back to
`route_id` only for routes added to a report *before* this fix.

**Fix — DB config migration**: the `click_publish` args are stored per-section, and every report
page owns a frozen copy of this section (not a shared reference) — editing just the template had
zero effect on already-created pages. A one-off script (`scratchpad/npmrds-sub/fix_add_route_click_publish.py`,
dry-run by default) patched both templates (`add_route_to_report` section template id `2187290`,
"Report Page" page template id `2187021`) plus 79 live section copies (draft+published) across 40
existing report pages, found via a join between each page's own `sections`/`draft_sections`
pointers and `data_items` — not a blind text-search, since a page accumulates a new historical
`component` row on every save and most naive "find rows mentioning add_route_id" hits are stale.

**Live-verified end-to-end 2026-07-24**: clicked a routecreation-tool-made route (id `2195795`, no
`route_id`) in a real report's catalog table → confirm banner appeared and stayed (previously:
dead silence, or a "Loading…" flash that vanished with no banner) → Confirm → persisted with the
correct `id` field flowing through → removed afterward to leave the report as found.

**Debugging detour worth knowing about**: a "banner flashes then vanishes" symptom turned out to
be only the "Loading…" indicator flashing (query returns 0 rows, `pendingRoute` never sets), not
the confirm banner itself appearing and being wiped by some other effect. A red herring
(`updatePageStateFiltersOnSearchParamChange` rebuilding `page.filters` from a static registry that
excludes runtime-only action params — a real, separate, latent bug, but not what was happening
here) was chased first. The actual giveaway was capturing the literal network request and seeing
`"col":"data->>'route_id'"` still being sent from a stale build.

**Superseded**: the entire mechanism this fixed (`fetchDynamicRoute`, `click_publish`,
`AddRouteBanner`) was deleted and replaced by the inline search/add box in the 2026-07-29 rebuild
below. This section is kept purely as history.

---

## ReportRouteList: UX polish + route discovery/add-flow + incremental refactor (originally `tasks/completed/reportroutelist-ux-polish.md`)

### Status: DONE, live-verified (2026-07-21)

### Objective

`ReportRouteList` (`src/themes/transportny/components/ReportRouteList/ReportRouteList.jsx`) works
(both prerequisite bugs — row persistence and the page-template architecture — are closed) but is a
single ~772-line file mixing persistence logic with presentation, the visual design is dense/minimal,
and the "add a route" flow is genuinely rough. This task: (1) incrementally refactors the file into
hooks + subcomponents as each feature below touches that code, (2) polishes the visual design, (3)
improves the route add-flow within a bounded scope (see "Explicitly deferred").

### Background: why the add-flow is rough (confirmed 2026-07-21)

A report has **three** sections on the page, not two: `ReportRouteList` itself (sidebar), an "AVL
Graph" section, and a separate generic **Spreadsheet** section titled "Add a Route to Your Report"
(main content area) bound to the `routes_data` catalog (~**5,884** rows), wired with a `click_publish`
provider (`paramKey: 'add_route_id'`, column `route_id`). Clicking a catalog row publishes an action
param; `ReportRouteList.jsx`'s `fetchDynamicRoute()`/`pendingRoute` picks it up and renders a small
confirm/cancel prompt at the very bottom of its own panel (today: `ReportRouteList.jsx:756-766`).

User-confirmed pain points (2026-07-21):
- **Disconnected sections**: the catalog table lives in the main content area, the confirm prompt
  lives in the sidebar panel — clicking a row and not noticing anything happened is easy.
- **Bad browsing experience**: `display.pageSize: 5` against a ~5,884-row catalog, with no search
  enabled by default (the Spreadsheet component has a working, author-togglable per-column
  `serverFilter` search box already — confirmed via direct code read of
  `ComponentRegistry/spreadsheet/config.jsx`/`TableHeaderCell.jsx` — it's just never turned on for
  this template).

**Longer-term direction (user, 2026-07-21): bringing browse/search/add fully inline into
`ReportRouteList` itself — no separate Spreadsheet section, no cross-section action-param handoff —
is probably the right eventual answer, but is explicitly NOT a mega-lift for this round.** Tracked
under "Explicitly deferred" below; this round instead tightens the existing two-section split.

### Scope (this round)

**In scope:**
1. Incremental refactor of `ReportRouteList.jsx` into hooks (`useReportRow.js`, `useGraphPublish.js`)
   + subcomponents (`RouteRow.jsx`, `AddRouteBanner.jsx`), done alongside the feature work below.
2. Visual polish: route count header, "unassigned to any graph" badge, TMC list truncation, loading
   skeleton, empty-state hint, spacing/typography tidy-up in `ReportRouteList.theme.js`.
3. Add-flow, code side: move the pending-route confirm banner to the **top** of the panel with more
   visual weight + a route preview (TMC count, description); soft (non-blocking) "already in this
   report" notice on a duplicate `route_id`; a local client-side name search filtering the panel's
   own already-added route list.
4. Add-flow, config-only (no code): on the live "Report Page" template (`npmrds_sub|page_template`
   id `2187021`), enable `serverFilter: true` on the Add-Route Spreadsheet's `name` column AND raise
   its `display.pageSize` well above 5 — both cheap, reversible, template-level changes.

**Explicitly deferred (this round):**
- **Bringing route browse/search/add fully inline into `ReportRouteList`** (self-contained panel,
  no separate Spreadsheet section, no `click_publish`/action-param cross-section handoff) — identified
  as the better long-term direction (2026-07-21) but deliberately out of scope for now; revisit as its
  own follow-up task when there's appetite for the bigger lift. Whoever picks this up next should read
  this file's "Background" section first — the current split, its `sourceInfo`/`routeSourceInfo`
  binding, and why it's disconnected are all documented above.
- Drag-and-drop reorder (DndList) and bulk multi-route graph assignment — deprioritized by user.
- Cross-dataset "highlight already-added routes" in the Add-Route catalog (would need a real
  `conditional_row_style` library enrichment — bigger, separate).
- The graphIds task file's remaining cleanup items (stray duplicate rows, dev-server tile-join crash) —
  unrelated, tracked in `reportroutelist-graphids-wiped-on-refresh.md`.

### Target file structure

```
src/themes/transportny/components/ReportRouteList/
├── ReportRouteList.jsx      ← orchestrator: wires hooks, renders search box + AddRouteBanner + RouteRow list
├── ReportRouteList.theme.js ← Tailwind class map (+ badge/banner/search/skeleton classes)
├── useReportRow.js          ← NEW: loadReportRow/persistRoutes/reportRowIdRef + mutation helpers
├── useGraphPublish.js       ← NEW: findSelfBoundGraphs, graphs memo, publish effect, orphan-cleanup effect
├── RouteRow.jsx             ← NEW: one route's row (header, edit, TMC truncation, graph chips, badge, remove)
├── AddRouteBanner.jsx       ← NEW: pending-route confirm/cancel UI, moved to top, "already added" notice
└── index.jsx                ← unchanged (registry entry)
```

### Phases

- [x] **Phase 1 — Extract `useReportRow` + `useGraphPublish`** (no behavior change; riskiest phase
  precisely because it must be a no-op — verified against today's behavior before moving on).
- [x] **Phase 2 — Extract `RouteRow` + `AddRouteBanner`** (structural; banner JSX relocated, visual
  move-to-top happened in Phase 4).
- [x] **Phase 3 — Visual polish** (route-count header, unassigned badge, TMC truncation, skeleton
  loading state, empty-state copy, theme spacing/typography).
- [x] **Phase 4 — Add-flow**: banner to top with route preview + soft duplicate notice; local search
  box over the already-added route list (rendering-only, doesn't affect persisted `routes` or graph
  publishing which stay keyed off the full unfiltered list).
- [x] **Phase 5 — Config-only, DONE (2026-07-21)**: `dms raw update 2187021 --data <patch>` applied —
  `serverFilter: true` on both `name` and `description` columns (not just `name` — cheap to do both,
  and old-tool-generated names are often terse codes while descriptions carry more distinct search
  terms) + `display.pageSize` 5→25, on the Add-Route Spreadsheet section (`draft_sections[2]`,
  title "Add a Route to Your Report") of the "Report Page" template (`npmrds_sub|page_template` id
  `2187021`). Server response confirmed `"message":"Item updated"` with both changes reflected.
  Applied patch saved to `scratchpad/npmrds-sub/old-reports/template_2187021_patch.json` for
  reference. One earlier `dms raw update` attempt timed out client-side and did NOT land (verified via
  read-back showing `pageSize: 5` still) — root cause was the user's own intermittent connectivity to
  the VPN-tunneled dev DB (mercury.availabs.org), confirmed via a raw TCP reachability check timing out
  in lockstep with the CLI calls; dms-server itself stayed up on :3001 throughout. The retry after
  connectivity recovered applied cleanly. Note: this changes the **template**, so it affects only
  reports created after this change — existing already-materialized report pages don't inherit it
  automatically (not applied retroactively, per the task's own out-of-scope note on bulk-updating
  existing reports).

### Files touched

| File | Change |
|---|---|
| `ReportRouteList.jsx` | Shrinks to orchestrator; new search box, skeleton, empty-state copy |
| `useReportRow.js` | NEW — extracted persistence hook |
| `useGraphPublish.js` | NEW — extracted graph-discovery/publish hook |
| `RouteRow.jsx` | NEW — one route's row, incl. unassigned badge + TMC truncation |
| `AddRouteBanner.jsx` | NEW — pending-add confirm UI, moved to top |
| `ReportRouteList.theme.js` | New/updated Tailwind classes |
| `README.md` | Update file-structure section + document new UX once shipped |
| DB: `npmrds_sub\|page_template` row `2187021` (via `dms` CLI) | `serverFilter: true` + bigger `pageSize` on Add-Route Spreadsheet's `name` column |

No `src/dms/` submodule/library changes this round — stays entirely inside `src/themes/`.

### Testing / verification — DONE (2026-07-21)

Reused the existing `Claude Scratch - Measure Picker` page (id `2195034`, app `npmrdsv5`) as the
scratch report rather than driving the "+ Add Page → Your Templates" modal flow — it was already a
disposable scratch page from a prior session. It had 0 sections attached (an earlier session created
the page row but never materialized sections), so this round attached the 3 standard Report Page
sections via `dms section create` and fixed up two real gaps found along the way (see "Findings"
below) before it rendered.

All verification via `node scripts/npmrds-reports/report_probe.mjs edit/claude_scratch_measure_picker --auth`
(`--eval` scripts for interaction, screenshots for ground truth — text-based Playwright locators were
unreliable, see Findings):

- [x] **Phase 1 (no behavior change)**: every fresh `report_probe` navigation across ~10 separate
  probe runs consistently showed the same persisted routes (never reverted to empty, never lost data)
  — direct evidence the hook extraction didn't regress the graphIds persistence fix. Add (via real
  catalog click → top banner → Confirm), remove, and graph-chip toggle all round-tripped correctly.
- [x] **Phase 3 (visual polish)**: confirmed live — `Routes(6)` count header; `Unassigned` badge shown
  on every route not on a graph (correctly absent — never actually got a clean graph-assigned route
  into this dataset live, see Findings, but the badge *condition* `graphs.length > 0 && !graphIds.length`
  was exercised and renders correctly); `TMCs (N):` count label; TMC truncation confirmed exactly at
  the boundary — a 10-TMC route (`NY-7 36001 E`) rendered `TMCs (10): <first 6 TMCs> +4 more`, and a
  6-TMC route rendered all 6 with no toggle (6 is not `> TMC_PREVIEW_COUNT`, correct).
- [x] **Phase 4 (add-flow)**: banner renders at the top of the panel immediately on a catalog click
  (not buried at the bottom); soft duplicate notice confirmed verbatim: "Already in this report —
  adding again will create a second entry." (non-blocking, Confirm stayed enabled); local search box
  present and filters the panel's route list live (typing "NY-149" left only that route visible in
  the panel — verified via body-text diff, not just presence).
  - Not independently re-confirmed: that the search box leaves `comparisonSeries`/graph-publish
    payloads untouched while filtering — inherently true from the code (the filter only changes what
    `filteredEntries` renders; `routes`/`graphs` effects still consume the full unfiltered `routes`
    array) but not captured via a live network diff this round.
- [x] **Phase 5 (config-only)**: confirmed via the same page — "Add a Route to Your Report" section
  shows "Page 1 of 236, Rows 1 to 25 of 5884" (25/page, was 5), inherited automatically from the
  template once this page's own Add-Route section was (re-)materialized from the post-Phase-5
  template. The per-column search POPUP itself (clicking the "NAME" header) was not independently
  click-verified this round (Playwright selector friction, see Findings) — confirmed instead by direct
  code read (`TableHeaderCell.jsx`'s `ServerFilterControl`, no gating beyond `attribute.serverFilter`)
  and by the DB write's own round-trip confirmation (`serverFilter: true` persisted on `name` and
  `description`).
  - A **pre-existing** report page (`converted_reports/pok_wb_arterial_weave`, created before this
    change) still shows `pageSize: 5` and no search box on its own Add-Route section, confirming the
    documented expectation: the template change only affects reports created after it.

#### Findings along the way (not blocking, worth remembering)

- **`dms section create <page> --data '{...,"element-data":{...}}'` produces a malformed row** —
  missing the `element: {element-type, element-data}` wrapper (stores `element-data`/`element-type` as
  flat top-level keys instead), and mints no `trackingId`/`parent`. This matches the CLI's own
  documented example (`cli/docs/EXAMPLES.md`'s `section create ... --data '{"title":...,
  "element-data": {...}}'`) but that shape doesn't actually render — sections silently don't appear at
  all (0 console/page errors, just a blank content area). Fixed live by hand-constructing the full row
  shape (`title, group, level, parent, trackingId, type, element: {element-type, element-data-as-a-
  JSON-STRING}`) via `dms raw update <section-id> --data <file>`, mirroring an existing real section's
  shape exactly. Also needed the PAGE's own `data.sidebar = "left"` field set (present on the
  template's page-level data, absent on a bare `page create`-minted page) — without it, `sidebar`-group
  sections (`ReportRouteList` itself) have nowhere to render. Not fixed in the CLI itself — flagged
  here for whoever next uses `dms section create` for a from-scratch report page.
- **`dms raw update <id> --data <file>` (and `--set key=<json-array>`) silently no-op on this specific
  split-table (`:data`) row** — the command prints a success response that echoes back the intended
  new value, but a follow-up direct read (`scripts/npmrds-reports/dbq.py new`, querying
  `dms_npmrdsv5.data_items__s2177438_v2177440_reports_snap_2` directly) showed the row unchanged, twice,
  with two different write attempts. Root cause not fully isolated (plausibly the same class of gap as
  the documented `raw get`-on-split-rows bug, just on the write side) — worked around by testing
  against whatever routes were already there (added live through the real UI, which demonstrably DOES
  persist correctly — this is a CLI-only gap, not a `ReportRouteList`/`apiUpdate` bug). Flagging for a
  future session rather than chasing further here; out of scope for this task.
- **Playwright text-based locators are unreliable against this component** for scripted interaction —
  in order: (1) `hasText`/`getByText` substring matching picks up unrelated buttons/text elsewhere on
  the admin page unless matched `exact`; (2) clicking a live index-based collection
  (`locator.nth(i)` computed once via `.count()`) breaks when the click itself changes which elements
  match the same locator (e.g. a "+" expand toggle becomes "-" after being clicked) — re-query
  `.first()` in a loop instead of iterating a stale `.nth(i)` range; (3) the TMC count label renders as
  `TMCs (N):` (mixed case) in the DOM even though CSS visually uppercases it — text-matching locators
  must match the real DOM text, not the rendered visual case. None of these were product bugs; all were
  test-script mistakes, corrected live.

Task complete — no unresolved code changes remain. The three findings above are tooling/methodology
notes for next time, not follow-up work items against `ReportRouteList` itself.

---

## Add Route flow — investigation + Tier 0 fixes (originally `tasks/completed/add-route-flow-improvements.md`)

### Status: Tier 0 DONE. Option 2 (full inline-sidebar rebuild) DONE + live-verified (2026-07-29).

### Objective

The current "Add a route to your report" flow splits across two pieces: the `ReportRouteList`
(RRL) sidebar (manages routes already on the report) and a separate `Spreadsheet` section
("Add a Route to Your Report") elsewhere on the page that lists the whole route catalog —
click a row there, confirm in RRL. User ask (2026-07-29): investigate improvements to this
flow. Floor requirement: a mechanism so the catalog only shows while the page is in edit mode,
regardless of whether the rest of the flow changes.

### Current state (as investigated)

Confirmed live via `report_probe.mjs` against a real converted report
(`converted_reports/i_278_between_interchanges_8_and_15`), not assumed from reading code:

- The RRL sidebar is already `position: sticky` (`sectionGroup.theme.js`'s `sideNavContainer2`)
  — confirmed by scrolling 1400px and re-screenshotting; it stays pinned. So "click a catalog
  row far down the page, then hunt for the confirm banner" is less painful than it looks — the
  banner is visible immediately wherever you are on the page.
- The catalog Spreadsheet rendered on the **published, read-only page** too — pure noise there,
  since mutations are edit-gated and a viewer's click does nothing.
- Before this fix, the catalog had **no search** and paginated 5 rows at a time across 5,884
  routes (1,177 pages) — not realistically browsable.

The platform already had the needed primitives, just not wired up on this template:

- **`hideInView`** — a section-level boolean (author-facing as the section menu's "Display" →
  "Hide Component" toggle). Enforced in `sectionArray.jsx`'s read-only render path
  (`hideSectionCondition`, ~line 406-412); the page-editor's own render path ignores it, so a
  `hideInView: true` section is invisible to readers but fully visible/editable in edit mode
  (shown with a "Hidden from View" pill, `section.jsx` ~line 518). Exactly the floor requirement.
- **`serverFilter`** — a per-column toggle on the Spreadsheet (`spreadsheet/config.jsx`) that
  opens a real debounced, server-backed search box in that column's header
  (`TableHeaderCell.jsx`'s `ServerFilterControl`).
- `pageSize` is a plain config number, no code needed to raise it.

### Done (Tier 0)

1. **`hideInView: true`** added to the "Add a Route to Your Report" section in the **Report
   Page** page template (`npmrds_sub|page_template` id `2187021`, embedded `draft_sections`).
   New reports created from this template now hide the catalog from readers by construction.
2. **Section template sync**: the underlying reusable section template (`add_route_to_report`,
   id `2187290`) was stale relative to the page template's embedded copy — brought up to date
   (`serverFilter: true` on `name`/`description`, `pageSize` 5→25) so a future
   `dms section create --template add_route_to_report` doesn't regress.
3. **Real bug found and fixed along the way**: `scripts/npmrds-reports/report_build.mjs`'s
   `clonedSection()` helper silently dropped `hideInView` (and any such template-level section
   attribute) when materializing sections for a report built via the CLI — a narrow, separate
   bug from the platform mechanism itself. The native "+ Add Page" UI path was unaffected (its
   `newPage()` in `editFunctions.jsx` spreads the whole template section object, `hideInView`
   included). Fixed with a one-line change; re-verified live after the fix.

**Explicitly NOT done, per user decision**: retroactively applying either fix to already-
converted report pages' own materialized copies of the section (each page owns a frozen copy
from creation time, independent of later template edits). Separate, deferred decision — same
shape as the earlier `fix_add_route_click_publish.py` precedent if it's ever wanted.

**Live verification** (scratch pages built via `report_build.mjs`, all deleted after — see
Testing checklist): published view shows zero trace of the catalog section; edit view shows it
with a "Hidden from View" pill, 25 rows/page ("Page 1 of 236" vs the old "Page 1 of 1177"), and
a working per-column filter (clicked the Name header, typed "9D", live-refetched down to the 7
matching routes — confirmed via captured network request, not just the UI appearing to work).

### Further options considered — none committed, all still open

The floor requirement (Tier 0) is done. Beyond that, the underlying UX gap is real: route
search/add lives in a completely different part of the page from where routes are managed
(RRL), unlike the old tool which kept everything in one sidebar (see
`old_tool_routes.png` screenshot referenced in the original ask). Three directions were
discussed; **none chosen yet**:

1. **Move the Spreadsheet section into the sidebar `group`** (so it sits directly under RRL in
   the same sticky rail, no separate page location at all). **Spiked live, not just theorized**:
   changing one section's `group` from `default` to `sidebar` is mechanically trivial, but the
   result does NOT work as-is — the Spreadsheet's column-sizing model doesn't adapt to the
   rail's fixed `w-[302px]` width (`sectionGroup.theme.js`), so the table renders at its normal
   multi-column width and overflows on top of the main content below it (screenshot taken during
   the spike, not kept — reproducible by repeating the group-field patch on any scratch page).
   Making this good would need real, scoped work: dropping down to essentially a `name` column
   (+ compact add affordance) for the narrow rail, forcing fixed narrow column widths instead of
   the current auto-resize behavior, and likely a bespoke narrow-row style rather than the
   generic data-grid look. Estimate: a real mini-project (styling + `spreadsheet`/`Table`
   component work), not a config change.
2. **Full inline-sidebar rebuild** — move route search/add logic directly into `ReportRouteList`
   itself (a live-typing autocomplete against the route catalog, click-to-add with no separate
   section or action-param round trip at all), closest to the old tool's actual UX. Biggest lift
   of the three: new debounced search/results-list UI in RRL, and a decision on whether the
   standalone catalog Spreadsheet goes away entirely or survives as a secondary "browse
   everything" view for power users.
3. **Reposition/restyle in place** — keep the click-publish + separate-section mechanism, but
   move the section physically closer to RRL in the main content column (not the sidebar rail)
   and clean up its visual styling. Smallest lift of the three, weakest parity with the old tool.

User's 2026-07-29 direction (initial): don't commit to any of these yet — later the same day,
after discussing tradeoffs, chose **Option 2 (full inline-sidebar rebuild)**, scoped down per the
user's own observation about actual usage (see plan below). Options 1 and 3 remain undone,
documented above for reference only.

### Option 2 plan — full inline-sidebar rebuild (chosen 2026-07-29)

#### Why this shape, not the other two sub-approaches discussed

User asked to weigh three ways to build the inline-sidebar option: (a) a wholly new one-off
component, (b) fold directly into RRL, (c) enrich the base `Spreadsheet` component. Landed on a
hybrid closest to (b): RRL is already an accepted bespoke component (justified per
`src/themes/CLAUDE.md`'s "when a custom section IS appropriate" — it renders genuinely stateful,
non-Card behavior), so adding to it isn't the one-off-component smell the CLAUDE.md principle
warns about. `Spreadsheet` (option c) is the wrong shape entirely — a live-typing autocomplete is
not a paginated grid, no styling change closes that gap (that's the separate "Option 1" idea
above, a real but different feature). A wholly new component (option a) would have duplicated
logic that already exists in **three** places in this exact shape (debounced search → UDA `like`
filter → `apiLoad`) — `ConditionValueInput.jsx`'s `useColumnOptions`, `MultiSelect.jsx`'s
`onSearch`, `TableHeaderCell.jsx`'s `ServerFilterControl` — so the query logic is written as one
new, focused piece local to this feature (see Data layer below), not a fourth reimplementation,
without promoting it to a shared library primitive the user explicitly said isn't worth the
investment right now ("the search stuff, tbh, I don't think is huge right now").

**Key UX pivot from the user's own insight**: most users create a route, then immediately build a
report using it — they already know the name, and it's recent. So the default (no typing) state
is a short **"recently created" list**, not a search box waiting for input. Typing is the fallback
for when the route isn't in that short list, not the primary interaction.

#### Confirmed schema fact (via `dbq.py new`, live query, not assumed)

RRL's existing `join.sources` catalog binding (`routeSourceInfo`) points at `Routes Data`
(`npmrdsv5`, source `2107426` / view `2107427`), which has a real `created_at` column (confirmed
by dumping `page_template_2187021`'s `draft_sections[1]` — the RRL section's own `element-data.join`
— from `scratchpad/npmrds-sub/old-reports/page_template_2187021_current.json`). Sorting this
column `desc` with a `limit` is a real "recently created" query, not an `id`-ordering hack.

#### Data layer

New function (lives in `ReportRouteList.jsx` or a small local sibling file, e.g.
`useRouteSearch.js` — decide during implementation based on how large it gets), modeled on the
**existing** `fetchDynamicRoute` (`ReportRouteList.jsx:115-150`) — NOT on `RouteComparison.jsx`'s
`buildCatalogRequest`, which is missing the same `attributes`-explicit fix `fetchDynamicRoute`
already has and therefore never gets `id` back (RouteComparison only reads `route_id`, a legacyJSONB
column; RRL's own dedupe (`sameRoute`) prefers the real DMS `id` per the 2026-07-24 add-by-DMS-id
fix). Concretely:

- Same `buildUdaConfig` call shape as `fetchDynamicRoute`: `columns: [...routeSourceInfo.columns
  .map(c => ({...c, show: true})), {name: 'id', systemCol: true, show: true}]`, explicit
  `attributes: udaConfig.attributes` passed into the request `filter`, and the same
  `udaConfig.columnsToFetch.reduce(...)` unwrap of the response (flat fields, not the bare-`data`
  fallback shape).
- Two modes, one function, parameterized by `searchTerm`:
  - **Empty** (default/recent mode): no filter groups, add `sort: 'desc'` to the `created_at`
    column entry, cap via `fromIndex`/`toIndex` (same windowing `RouteComparison.jsx`'s
    `buildCatalogRequest` already uses) to a small limit (~8).
  - **`searchTerm.trim().length >= 2`** (mirrors `RouteComparison`'s threshold): filter group
    `[{ col: 'name', op: 'like', value: term }]`, capped higher (~20 — a sidebar list, not
    `RouteComparison`'s 50-row rail).
- Debounce 250ms on the search-term path (same constant `RouteComparison.jsx` uses), no debounce
  needed on the recent-list fetch (runs once on mount / whenever the list is empty).
- Already-added routes filtered out of both result sets via the existing `sameRoute(a, b)` helper
  (`ReportRouteList.jsx:96-98`) — re-adding is still technically allowed (not hard-blocked, per
  `AddRouteBanner`'s old "different date range is a legitimate use case" comment) but doesn't
  clutter the default list with routes already on the report.

#### UI layer

New local component, `AddRouteSearch.jsx` (sibling to `RouteRow.jsx`/`AddRouteBanner.jsx` in the
same folder), replacing `AddRouteBanner` entirely:

- A text input (placeholder "Add a route…") — reuses the existing `t.searchWrapper`-style
  convention, new theme keys added to `ReportRouteList.theme.js`.
- Below it: "Recently created" header + up to ~8 rows when the input is empty; live search
  results when >= 2 chars typed; a loading state; an empty state ("No matching routes").
  Each row: route name + TMC count (`parseTmcArray` from `utils.js`, already used by
  `AddRouteBanner`/`RouteRow`) + click-anywhere-on-row to add.
- **Click adds immediately** — calls `addRoute(row)` (`useReportRow.js:258-291`, unchanged) with
  no confirm step. Safe because `removeRoute` is one click away and `addRoute` already handles
  dedup-by-name/color/comp-id assignment. Give a small transient success indication (e.g. a
  fading inline "Added" line) since the confirm banner's preview step is gone — exact treatment
  decided during implementation, kept minimal per the user's steer not to over-invest here.
- Placed in `ReportRouteList.jsx`'s render near the top of the panel (where `AddRouteBanner` used
  to render), above the existing "search *added* routes" box (`t.searchWrapper`, `ReportRouteList
  .jsx:202-215`) — these are two different search boxes (search-the-catalog-to-add vs.
  filter-what's-already-added) and must stay visually distinct; naming/labeling to make that
  obvious is part of the UI work.

#### Removing the old mechanism

- `ReportRouteList.jsx`: delete `pendingRoute` state, `fetchDynamicRoute`, the `addRouteId`
  derivation (`pageState.filters.find(... 'add_route_id' ...)`), the effect that triggers the
  fetch, `confirmAddRoute`/`cancelAdd`, `isDuplicateRoute`, and the `AddRouteBanner` import/render.
- Delete `AddRouteBanner.jsx` (dead code once nothing renders it).
- `ReportRouteList.theme.js`: drop the now-unused `addRouteBanner*`/`addRoutePreview`/
  `addRouteButtons`/`addRouteDuplicateNotice` keys, add new keys for `AddRouteSearch`.
- No changes needed to the `click_publish` provider mechanism itself (`component-actions.md`,
  `spreadsheet/rowPublish.js`, etc.) — it's generic platform machinery other sections may still
  use; only this template's usage of it goes away.

#### Template mutation (DB row, not code) — do this LAST, after code is verified

- Back up `page_template_2187021` to scratchpad first (existing convention — see
  `scratchpad/npmrds-sub/page_template_2187021.pre-*.json` from earlier rounds).
- Remove the "Add a Route to Your Report" `Spreadsheet` section entirely from the template's
  `draft_sections` (and `sections`, if a separately-materialized published copy also carries it —
  check both during implementation; Tier 0's dump only inspected `draft_sections`).
- Section template `2187290` (`add_route_to_report`) becomes unused — leave it as orphaned
  history, no cleanup required (per established "mint freely, clean up opportunistically"
  convention).
- Check `scripts/npmrds-reports/report_build.mjs` for any hardcoded reference to this section
  (beyond the generic template-section cloning `clonedSection()` already does) — expect none, but
  verify, since the Tier 0 fix touched this exact function.
- **Explicitly NOT done** (same precedent as Tier 0): retroactively removing this section from
  already-converted report pages' own frozen section copies. Separate, deferred decision.

#### Verification checklist (report_probe.mjs, scratch report pages, all deleted after — including
their orphaned `reports_snap_2` rows and section rows, which `dms page delete` does NOT cascade
to; see "known operational gotcha" note below)

- [x] Empty-input state shows a "recently created" list, order matches `created_at desc` — spot
      checked against `dbq.py new` directly. **Found and fixed a real bug along the way** (see
      below): the naive version showed obviously-stale test routes first.
- [x] Typing >= 2 characters live-filters via a real network request (captured via
      `report_probe.mjs --grep`, not just UI appearing to update) — typed "9D", got 16 real
      catalog matches including legitimate substring hits.
- [x] Clicking a result adds the route immediately (no confirm click) — confirmed via the
      transient "Added "..."" indicator AND a direct `dbq.py new` read of the report's
      `reports_snap_2` row showing the new route persisted with a real `id`, auto-assigned color,
      and `route_comp_id`.
- [x] Already-added routes don't clutter the default recent list — confirmed live (a route on the
      report correctly skipped in the recent list, ground-truth order otherwise intact).
- [x] Removing a route (existing `removeRoute`) still works — unchanged code path, not re-tested
      in isolation (no reason to regress; nothing about this rebuild touches it).
- [x] Published (view-mode) page: no search/add UI renders at all — confirmed via a separate
      published scratch page screenshot (edit-gated exactly like the old `AddRouteBanner`).
- [x] Fresh scratch report built via `report_build.mjs` (post template-mutation) has NO standalone
      catalog Spreadsheet section anywhere on the page — confirmed via screenshot + 0 console/page
      errors.
- [x] Sticky sidebar still scrolls/behaves correctly with the new UI added at the top of the
      panel — no visual regression observed in any screenshot.

### Bug found and fixed during verification: recent-list NULLs-first ordering

`ORDER BY created_at DESC` puts NULL values FIRST in Postgres by default. ~26 of 64,801 catalog
rows (legacy imports) have no `created_at` at all, so the naive recent-list query surfaced those
undated legacy rows ahead of genuinely recent ones — confirmed live (the box showed things like
"ASDASD", a blank-name row, "CorrectFormat" instead of real recent routes). Fixed by adding a
`{ col: 'created_at', op: 'notempty' }` filter group to the recent-mode query (`useRouteSearch.js`)
— excluding undated rows is correct, not a workaround: a route with no creation timestamp genuinely
isn't orderable by recency. Re-verified live against `dbq.py`'s own ground-truth top-8 query —
exact match after the fix.

### Unplanned dependency found and fixed: `report_build.mjs` required the removed section

`scripts/npmrds-reports/report_build.mjs` unconditionally cloned the template's "Spreadsheet"
section (the standalone catalog) into every new report page (`templateSectionByType('Spreadsheet')`,
both the create-new-page path and the `--update` reconcile path) — removing it from the template
broke report building entirely (`SPEC ERROR: Report Page template has no "Spreadsheet" section`).
Fixed by removing both `clonedSection(templateSectionByType('Spreadsheet'), ...)` call sites; the
`--update` reconcile path's `spreadsheetSection` lookup + `fail()`-if-missing was also removed
(no longer required — an old page's own frozen copy, if it has one, is simply left untouched by
the reconcile, same as it was already excluded from the deletion sweep). Re-verified live: a fresh
build + `--update`-shaped reconcile path both work post-fix.

### A second, more consequential instance of the same bug: `convert_old_reports.py`

User prompt (after the feature was already shipped): "are there any other portions of reports/RRL
that assumed there would be a Spreadsheet section... something coming up because we use `$self`
for the dynamic comparison series binding, and we also iterate/look at sibling sections in a
page." Checked both leads:

- **`$self` / `usePageFilterSync` / `useGraphPublish.findSelfBoundGraphs`** — content-based
  disambiguation only (checks each sibling's own `display._functions.subscribers` for an enabled
  `comparison_series` subscriber keyed `$self`), never element-type-based and never assumes a
  Spreadsheet/Add-a-Route sibling exists. The removed section never carried that subscriber (it
  had a `click_publish` PROVIDER, not a subscriber) — its removal changes nothing here. No bug.
- **Sibling-section iteration** — this is where the real second bug was: `scripts/npmrds-reports/
  convert_old_reports.py` (the **old-report → new-DMS-report bulk conversion tool**, 68+ rounds of
  ongoing production work, 36 real reports converted, ~145 more "full_producible" and still
  pending) has its own **independent Python reimplementation** of the exact same pattern
  `report_build.mjs` had: `template_section_by_type(page_template, "Spreadsheet")` (line 5058,
  raises `RuntimeError` if missing) plus `section_datas.append(build_cloned_section_data(page_id,
  sheet_tmpl, ...))` (line 5089) — unconditionally cloning the now-removed template section into
  every newly converted page. This would have broken the **very next real conversion run**, not
  just a hypothetical — a live production-blocking regression, not merely a code-quality nit.

**Fix**: removed both the `sheet_tmpl` lookup and its clone-append call (mirrors the
`report_build.mjs` fix exactly); updated the dry-run summary message (`"+RRL +Add-a-Route"` →
`"+RRL"`). Dry-run mode doesn't exercise this code path at all (it returns before reaching section
construction), so verification required a **real, non-dry-run conversion**: ran `convert_old_reports.py
--report-id 36` (a real, previously-unconverted, gap-free old report) against the live dev stack —
succeeded, created exactly 2 draft sections (RRL + 1 graph, correctly no third Spreadsheet section,
down from the old 3), `report_probe.mjs` confirmed a clean render (0 console/page errors, real SVG).
Cleaned up afterward via the script's own `delete_converted_page()` (page + both section-row sets +
the `reports_snap_2` row), since this was a verification run, not a deliberate conversion round.

**Swept for a third instance**: grepped all of `scripts/npmrds-reports/*.{py,mjs}` and
`src/themes/transportny/**` for `Spreadsheet`/`template_section_by_type`/`templateSectionByType`/
the literal "Add a Route to Your Report" title/`add_route_id`/`click_publish` strings — every other
hit is either the generic library mechanism (used by unrelated features: transportNY's
ticket/corridor/incident QA build tools, ConditionValueInput, TableRow, Card) or this task's own
new/updated files. No third dependency found.

### Files touched

#### Tier 0

| What | Where |
|---|---|
| Page template `2187021`'s "Add a Route to Your Report" section | `hideInView: true` added (DB row, not code) |
| Section template `2187290` (`add_route_to_report`) | `serverFilter`/`pageSize` synced to match (DB row, not code) |
| `scripts/npmrds-reports/report_build.mjs` | `clonedSection()` now forwards `hideInView` from the template section |

#### Option 2 (full inline-sidebar rebuild)

| What | Where |
|---|---|
| `src/themes/transportny/components/ReportRouteList/useRouteSearch.js` | **New.** Debounced recent/search fetch hook against the route catalog. |
| `src/themes/transportny/components/ReportRouteList/AddRouteSearch.jsx` | **New.** The inline "Add a route" box UI (input + recent/search results, click-to-add). |
| `src/themes/transportny/components/ReportRouteList/AddRouteBanner.jsx` | **Deleted.** Replaced by `AddRouteSearch.jsx`; the click-publish/confirm-banner flow it supported no longer exists. |
| `src/themes/transportny/components/ReportRouteList/ReportRouteList.jsx` | Removed `pendingRoute`/`fetchDynamicRoute`/`addRouteId`/`confirmAddRoute`/`cancelAdd`/`AddRouteBanner`; wired in `useRouteSearch` + `AddRouteSearch` with direct `addRoute()` on click. |
| `src/themes/transportny/components/ReportRouteList/ReportRouteList.theme.js` | Dropped unused `addRouteBanner*` keys, added `addRoute*` keys for the new search box. |
| `src/themes/transportny/components/ReportRouteList/utils.js` | Comment update only (which component now uses `parseTmcArray`). |
| `scripts/npmrds-reports/report_build.mjs` | Stopped cloning a template "Spreadsheet" section into new/reconciled report pages (see bug note above); header doc comment updated. |
| `scripts/npmrds-reports/convert_old_reports.py` | Same fix, independently — the old-report bulk conversion tool had its own Python reimplementation of the same clone-from-template pattern; would have broken the next real conversion run. |
| Page template `2187021` | "Add a Route to Your Report" `Spreadsheet` section removed from `draft_sections` (DB row, not code) — backed up first to `scratchpad/npmrds-sub/page_template_2187021.pre-remove-spreadsheet-section.*.json`. |
| `scratchpad/npmrds-sub/remove_add_route_spreadsheet_section.py` | One-off migration script used for the template mutation above (dry-run by default, `--apply` to write). |

**Explicitly NOT done** (same precedent as Tier 0): already-converted report pages keep their own
frozen copy of the old catalog Spreadsheet section, untouched. Section template `2187290`
(`add_route_to_report`) is now unused/orphaned — left as-is, no cleanup needed.

### Testing checklist

- [x] Published view of a fresh report built from the (patched) template shows no trace of the
      catalog section — confirmed via `report_probe.mjs` screenshot, scratch page
      `converted_reports/scratch_hideinview_test`, deleted after.
- [x] Edit view of the same page shows the catalog with a "Hidden from View" pill, 25 rows/page.
- [x] Per-column search works end-to-end: clicked the Name header, typed "9D", confirmed a real
      re-fetch (network capture) narrowing 5,890 routes to 7 matches — not just a UI popup
      appearing.
- [x] `report_build.mjs`'s `hideInView`-forwarding fix re-verified live after the change (first
      scratch build predated the fix and did NOT hide the section; rebuild after the fix did).
- [x] Sidebar-group move spiked live on a scratch page — confirmed it does not work cleanly
      as-is (documented above); not pursued further per user direction.
- [ ] Retroactive fix to already-converted report pages — explicitly deferred, not attempted.
