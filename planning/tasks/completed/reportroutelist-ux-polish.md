# ReportRouteList: UX polish + route discovery/add-flow + incremental refactor

## Status: DONE, live-verified (2026-07-21)

## Objective

`ReportRouteList` (`src/themes/transportny/components/ReportRouteList/ReportRouteList.jsx`) works
(both prerequisite bugs — row persistence and the page-template architecture — are closed) but is a
single ~772-line file mixing persistence logic with presentation, the visual design is dense/minimal,
and the "add a route" flow is genuinely rough. This task: (1) incrementally refactors the file into
hooks + subcomponents as each feature below touches that code, (2) polishes the visual design, (3)
improves the route add-flow within a bounded scope (see "Explicitly deferred").

## Background: why the add-flow is rough (confirmed 2026-07-21)

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

## Scope (this round)

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

## Target file structure

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

## Phases

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

## Files touched

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

## Testing / verification — DONE (2026-07-21)

Reused the existing `Claude Scratch - Measure Picker` page (id `2195034`, app `npmrdsv5`) as the
scratch report rather than driving the "+ Add Page → Your Templates" modal flow — it was already a
disposable scratch page from a prior session. It had 0 sections attached (an earlier session created
the page row but never materialized sections), so this round attached the 3 standard Report Page
sections via `dms section create` and fixed up two real gaps found along the way (see "Findings"
below) before it rendered.

All verification via `node scripts/report_probe.mjs edit/claude_scratch_measure_picker --auth`
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

### Findings along the way (not blocking, worth remembering)

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
  new value, but a follow-up direct read (`scripts/dbq.py new`, querying
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
