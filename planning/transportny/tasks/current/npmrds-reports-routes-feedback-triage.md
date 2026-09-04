# NPMRDS Reports/Routes tools — 2026-09-04 feedback batch: triage

**Project:** TransportNY · **Topic:** themes · **Status:** IN PROGRESS — **Phase 1 DONE** (all 4
non-deferred items shipped + live-verified 2026-09-04; map TMC line-width and submodule graph-theme
tuning remain deferred per Ryan's call, see below). Phase 2 (RRL panel restructure) not yet started.
· **Started:** 2026-09-04

## Objective

Ryan dropped a batch of notes on the NPMRDS Reports/Routes tools (RRL panel, Dynamic Reports, Report
Header, graph/map/section theming, Reports List view). Per his explicit instruction, **this pass does
not validate, reproduce, or implement any of it** — it only reads/parses the raw notes and bundles
them into a logical order for addressing, cross-referenced against what's already tracked so later
sessions don't duplicate or collide with in-flight work. Each phase below still needs its own
scoping/reproduction pass before code changes, per normal `planning-rules.md` workflow.

**Explicitly out of scope for this doc:** the "RYAN RETHINK REWORD IDK SECTION" portion of the
original feedback (auto-seeding template routes from simple routes on dynamic-toggle; a "date
template" editor for relative-date relationships) — Ryan asked to disregard that section for now.
Revisit separately when he's ready to firm it up.

**Process notes:**
- Held off editing existing `.md` files for the initial triage pass, per Ryan's instruction that
  other Claude sessions may have files open. **Lifted 2026-09-04** — Ryan confirmed it's fine to
  update docs now. `todo.md` got a pointer to this doc; `report-route-ui-parity-gaps.md` (gap #7) and
  `graph-legend-position-quickcontrol.md` (default-value change) each got a same-day note so they
  don't read as stale against the decisions below.
- Do not touch `npmrds-reports-combined-page-design.md`, `ds-nav.js`, or `patterns.html` under
  `src/themes/transportny/TransportNY Design System/...` — those are a different, currently in-flight
  session's work (new/modified today, unrelated to this feedback batch).

## Source material

Raw feedback: Ryan's message, 2026-09-04, five numbered items (RRL panel, Dynamic Reports, Report
Header, Graphs/Maps/Sections, Reports List View). Screenshot referenced for item 1 was not
independently reviewed here (visual — defer to reproduction pass).

## Cross-reference against existing task files (read-only survey)

| Existing doc | Status | Overlap |
|---|---|---|
| `reportroutelist.md` | DONE (UX/add-flow history) | Item 1 builds on top of a settled component; also has the existing route→graph-chip persistence path relevant to Item 5's write-path option |
| `dynamic-reports-and-route-tags.md` (+ archive) | "Core mechanism DONE" — route slots fill via URL param, 12 templates ported | Item 2's four sub-asks are all *new* extensions on top of a finished mechanism, not rework |
| `report-route-ui-parity-gaps.md` | gap #7 "RRL rename control" **deprioritized 2026-08-24**, blocked on an input-commit bug | Same edit-toggle surface as Item 1's "combine expand/edit" ask — should be reopened and solved together, not as two separate efforts |
| `npmrds-all-reports-list-page.md` | BUILT + verified live, **draft only, not yet published** | This is almost certainly why Ryan noticed the stale routes/graphs-count column — Item 5 is a real gap blocking publish of otherwise-finished work |
| `graph-legend-position-quickcontrol.md` | BUILT 2026-09-01, **live-verified working** (confirmed by Ryan 2026-09-04), sets NPMRDS default legend position to `"bottom"` in `composeMeasureConfig.js` | **Resolved 2026-09-04** — Ryan has changed his mind: default should move from `bottom` to `top`/`top-right`. No longer a conflict, just a follow-up change to already-working code. Moved to Phase 1. |
| `gridgraph-row-height-scaling.md` | same file territory (`composeMeasureConfig.js`), different lever (row height) | No direct conflict, adjacent |
| `src/dms/planning/tasks/completed/avlgraph-theme-integration.md`, `graph-axis-font-theming.md` | DONE 2026-06-03 | First pass at theme-driven fonts/axis colors/gridlines in `graph_new/theme.js` — Item 4's font/axis/spacing ask is a **continuation of submodule work**, not greenfield. Because the target file (`src/dms/packages/dms/src/ui/components/graph_new/theme.js`) lives inside the `@availabs/dms` submodule, that piece of Item 4 should ultimately get its own entry under `src/dms/planning/` (per root `CLAUDE.md`'s task-routing rule), not live only here. Not creating that file yet since nothing is being implemented this pass — flagging so whoever picks up Phase 1 routes it correctly. |
| `routes-reports-users-mesh.md` | broader `reports_snap_2` context | Background for Item 5's write-path option |

No `todo.md` entries exist yet for any of these 5 items — this is genuinely fresh feedback, not a
duplicate of something already queued.

## Proposed triage order

Grouped by dependency/risk rather than by Ryan's original item numbers — quick isolated wins first,
then a contained fix that reopens a known deprioritized gap, then decisions that need Ryan's input
before more code gets built on a conflicted lever, then the one architecturally large item, then
open-ended polish last (so we're not tuning padding twice).

### Phase 1 — Quick, isolated, no open decisions

Small, self-contained diffs with no design ambiguity. Good first batch.

**Deferred out of this pass (2026-09-04, Ryan's call, made when starting implementation):**
- Map TMC line-width increase — pushed to as late as possible in the overall sequence. Reason: hard
  to verify visually, and re-validating a map change is costly if something else later touches map
  code; better to do it last so nothing after it forces a re-check. Still Item 4, still belongs in
  a Phase-1-shaped bucket whenever it's picked up — see `src/dms/skills/editing-map-symbologies.md`.
- Default graph theme visual tuning in `graph_new/theme.js` (submodule) — pulled out entirely. Ryan
  wants to tackle this as its own dedicated piece of work with more thought, not bundled into this
  quick-wins batch. Still needs its own task file under `src/dms/planning/` when picked up (per the
  routing note originally here).

Remaining four items, implemented this pass:

- [x] **[Item 3]** Remove the "Data source · complete through…" line from the Report Header — **DONE
  2026-09-04**. Removed both the `canEdit` edit-row and read-only `freshnessWrapper` block from
  `ReportPageHeader.jsx`, the now-unused `freshness*` style keys from `ReportPageHeader.theme.js`,
  and the `freshnessLabel/Complete/Partial/Since` fields from the default state
  (`ReportPageHeader/index.jsx`) and the master template spec (`page_template_specs/report_page.json`
  + `report_page_template_build.mjs`) so new reports stop seeding the dead fields at all — confirmed
  via DB query that no existing report had ever populated them, so this was a pure no-op removal, not
  a data-loss risk. **Expanded scope, Ryan's call while implementing:** also removed the "Data" link
  button + "Data Link" edit-row (`dataHref`) from the same header — confirmed via DB query no
  existing report had a populated `dataHref` either, so same zero-data-loss removal. Rebuilt the live
  master "Report Page" template row (id 2187021) via
  `node scripts/npmrds-reports/report_page_template_build.mjs --apply` so new reports stop carrying
  either dead field. Live-verified in edit mode on `reports/beacon_9_d_jan_25_vs_26`: header now shows
  kicker/title/purpose → Share/Print/Done → tags only, no freshness row, no Data button/link row;
  "NO CHANGES" indicator confirmed nothing was mutated by the check. New utility script written
  during this: `scripts/npmrds-reports/check_page_exists.py` (lists/filters real `npmrds_sub|page`
  url_slugs from the DB, since `/edit/<slug>` and `/<slug>` both silently fall through to an unrelated
  page instead of 404ing on a bad guess).
- [x] **[Item 1]** Button copy: `derive from…` → `use fixed dates` / `use relative dates` — **DONE
  2026-09-04**. Only one button actually needed renaming — `RouteRow.jsx`'s "Use fixed dates instead"
  (fixed→derived escape hatch) already matched; "Derive from another route instead" (the
  fixed-mode button that switches TO derived dates) is now "Use relative dates instead", matching
  its sibling's phrasing. Live-verified on a fresh scratch page (`reports/page_25`, created and
  deleted this session, never published): added 2 routes, confirmed both buttons render with the new
  copy, clicked "Use relative dates instead" and confirmed it correctly opens the derive-controls
  panel (Derive From/Pattern/Span/etc.) with "Use fixed dates instead" to switch back — the label
  rename didn't touch the mode-switch logic, `onClick={startDeriveMode}` unchanged.
- [x] **[Item 4]** Rounded corners on graph/section cards to match the rest of the theme — **DONE
  2026-09-04, future-default only (Ryan's explicit call, not a retroactive backfill)**. The theme
  already fully supports this per-section (`border: 'full'` → `themev2.js`'s
  `pages.sectionArray.styles[0].border.full`, `rounded-[8px] border ... bg-white shadow-sm` — same
  recipe as `ReportPageHeader`'s wrapper) via the section-menu's own Border control; the gap was
  that neither place that MINTS a brand-new graph/map/info-box section set it, so new sections
  defaulted to `border: 'none'` (square, no card). Both mint points fixed, sharing one real constant
  (Ryan's call, not two hardcoded literals) via a new file,
  `src/themes/transportny/components/ReportRouteList/reportSectionDefaults.js`
  (`DEFAULT_GRAPH_SECTION_BORDER = 'full'`):
  - `useAddGraphSection.js` (UI "+ Add Graph" flow) — plain import.
  - `report_build.mjs`'s `graphSectionData()` (CLI spec-driven builder) — loaded through the same
    `server.ssrLoadModule` Vite-SSR bridge the script already uses for `composeMeasureConfig.js`,
    not a re-hardcoded string.
  Live-verified: built a scratch report (`report_build.mjs` against a throwaway spec, since deleted)
  and confirmed both in the raw DB row (`"border":"full"` on the AVL Graph section) and visually in
  edit mode — the graph card now renders with the same rounded/white/shadow chrome as the header.
  Existing reports are untouched and keep their current (square) chrome until an author edits the
  section's Border control themselves or a future `--update` run regenerates it.
- [x] **[Item 4]** Legend default position + title/legend alignment — **DONE 2026-09-04**.

  **Legend default position flip** — `DEFAULT_LEGEND_POSITION_BY_GRAPH_TYPE` in
  `composeMeasureConfig.js` flipped `bottom`→`top` (BarGraph/LineGraph) and `bottom-right`→`top-right`
  (GridGraph). Same "seeded once, at real section-creation time only" mechanism as before (3 JS mint
  sites + 1 hand-synced Python dict) — also updated the 4th, easy-to-miss sync point:
  `convert_old_reports_lib/template_specs.py`'s `_DEFAULT_LEGEND_POSITION` dict (Python can't import
  the JS map, kept in sync BY HAND per that file's own header comment — would have silently drifted
  back to `bottom` for the 2 hand-built template categories otherwise).

  **Title/legend inline row** — genuinely shares one row (title left, legend right) instead of
  stacking, but **opt-in and theme-scoped**, not a blanket change to shared `graph_new` code (Ryan's
  explicit ask mid-implementation: many other sites use these components, and other NPMRDS graphs —
  Macro View, MAP-21 PM3 — may still want the old stacked look). Design, in order of "where does this
  live":
  1. **New avlGraph theme style**, `src/themes/transportny/themev2.js`'s `avlGraph.styles[1]`,
     name `"reportInlineTitle"` — inherits every key from `styles[0]` ("default") except one new key,
     `titleInlineWithLegend: true`. The site-wide default (`options.activeStyle: 0`) is untouched.
  2. **Selected per-section**, not site-wide — a section's own top-level `activeStyle` field (same
     level as `border`; traced via `section.jsx:329` → `ComponentContext` →
     `graph_new/index.jsx`'s `getComponentTheme(contextTheme, 'avlGraph', activeStyle)`) is set to
     `'reportInlineTitle'` **only** by the two places that mint a brand-new Report-page `'AVL Graph'`
     section — `report_build.mjs`'s `graphSectionData()` and `ReportRouteList/useAddGraphSection.js`
     (both gated on `elementType === 'AVL Graph'`; Map/Spreadsheet-backed InfoBox/RouteCompare never
     get it, they have no avlGraph theme to select). Every other NPMRDS graph, and every other site,
     never sets `activeStyle` → stays on `"default"`, completely untouched.
  3. **Rendering logic** — `graph_new/GraphComponent.jsx` reads `theme.titleInlineWithLegend`; when
     true AND `legend.show` AND `legend.position` starts with `"top"`, it passes the already-built
     `<GraphTitle>` element down as a new `titleNode` prop instead of rendering it standalone above
     the chart. **Safety net:** any other combination (legend hidden, or positioned left/right/
     bottom/bottom-*) falls back to the normal standalone title — the title can never be silently
     dropped. `LineGraph.jsx`/`BarGraph.jsx`/`GridGraph.jsx` (the 3 chart types NPMRDS's own
     vocabulary uses) each render `{props.titleNode}` as a sibling of the legend inside their
     existing top-legend-row block, switching that row's `justify-center` (or GridGraph's
     corner-specific `justify-end`) to `justify-between` only when a `titleNode` is actually passed —
     byte-identical layout otherwise. GridGraph's top-left/top-right corner distinction is
     deliberately superseded by plain title-left/legend-right once a title is sharing the row (see
     that file's own comment for why this is a reasonable simplification, not an oversight).

  **Live-verified**, both mint points, both with real ClickHouse data:
  - `useAddGraphSection.js` (UI "+ Add Graph"): built a scratch page (`page_25`, real "+ Create
    Report" → "+ Add Route" → "+ Add Graph" flow, since deleted) with a real route/date range —
    confirmed visually: "TRAVEL TIME (MIN)" title and "■ Route 5 Part" legend swatch render side by
    side, title left / legend right, one row, on a rounded card.
  - `report_build.mjs` (CLI): built a scratch report from a spec (since deleted) — confirmed via raw
    DB read that the section row carries `activeStyle: "reportInlineTitle"`, `border: "full"`,
    `legend.position: "top"` together, and via DOM inspection that the new
    `flex items-center shrink-0 justify-between gap-3` wrapper renders with exactly 2 children
    (title node + legend node) — this particular scratch report's own chart had no visible data
    (CLI-materialized sections don't self-bind to RRL's routes — a known, pre-existing, unrelated
    gotcha, not a defect in this change), but the structural proof is the same either way.
  - **Backward compatibility**: re-checked the existing, unrelated `reports/beacon_9_d_jan_25_vs_26`
    report (real, published, pre-existing) — renders exactly as before: square/borderless cards, no
    legend row, standalone title. Confirms the opt-in scoping actually works, not just in theory.

### Phase 2 — RRL panel restructure (Item 1, remaining pieces)

`src/themes/transportny/components/ReportRouteList/{ReportRouteList,RouteRow}.jsx`. Bundle these
together since they're the same component and same interaction surface:

- Collapsed-row layout: move `(N TMCs · X mi)` up under the route title onto its own prominent line;
  drop the graph-count info from the collapsed view.
- Combine the expand (+) and edit toggles into one control; edit mode replaces the normal
  title+dates view in place (both become editable) instead of appending an expansion panel.
- Remove the duplicate delete button at the bottom of expanded/edit mode, keep only the one next to
  save/edit.

**Do this together with reopening `report-route-ui-parity-gaps.md` gap #7** (RRL rename control,
deprioritized 2026-08-24 on an input-commit bug) — it's the same edit-toggle surface Ryan is asking
to rework here, so solving the old bug as part of this rebuild avoids re-diagnosing it later.

**Also fold in [Item 5]'s resolution (decided 2026-09-04: write-path, not column removal):** scope RRL
to write route/graph counts into `reports_snap_2` whenever a route or graph is added/removed, so
`npmrds-all-reports-list-page.md`'s routes/graphs column stays live instead of only being set by
json-spec-generated reports. Piggyback on the persistence path already documented in
`reportroutelist.md`; likely touches the add/remove-route flow in `ReportRouteList.jsx`/`RouteRow.jsx`
plus the graph-assignment hooks (`useAddGraphSection.js`, `useGraphPublish.js`). Bundling with the rest
of Phase 2 since it's the same component family already being opened up — and this unblocks publishing
the otherwise-finished list page.

### Phase 3 — Decisions (RESOLVED 2026-09-04)

Originally two spots needing Ryan's input before more code landed. Both answered same-day; kept here
as a decision log rather than deleted, per the "date everything, don't rewrite history" convention.

- **[Item 5]** Reports List route/graph-count column — **decided: write-path**, not column removal.
  Work moved to Phase 2 (bundled with the RRL restructure, same component family).
- **[Item 4]** Title/legend placement strategy — **decided: smaller lift for now.** Keep titles
  graph-native (not migrating to section titles); just improve the graph title and align it inline
  with the legend to reduce vertical space. Work moved to Phase 1 (bundled with the legend-default
  flip). The full "sections own all titles" migration (touching
  `composeMeasureConfig.js`'s title-on-measure-change logic, the section-title padding complaint, and
  the Spreadsheet title-only-at-section-level asymmetry) is explicitly deferred — Ryan: "if we want to
  do a broad pass on titles later on, we can." Not scheduled; revisit only if requested. Noted as
  backlog in Phase 5.

### Phase 4 — Dynamic Reports (Item 2)

The single biggest item by architectural complexity — all four sub-asks are new work on top of a
"core mechanism DONE" state, with no prior scoping anywhere for the static↔dynamic conversion piece.
Given `dynamic-reports-and-route-tags.md` is already large, this should get its **own new task file**
(cross-linking back to it) once picked up, rather than being appended there. Sequence within the item,
smallest/least-coupled first:

1. `%n` / `%y` route-slot name variable substitution (template-name resolution only); default a new
   slot's name to `%n`.
2. Add Route Slot UI: let an author mark a slot as "reuse an already-selected route, different dates"
   vs. "distinct route," instead of always creating a distinct route. Ryan notes the json-spec layer
   can already express this — likely a UI-only gap, but confirm during scoping.
3. Header button (view + edit) that reopens the routes-picker modal to swap the current query-param
   routes for preview purposes only (no persistence for a dynamic report).
4. Bidirectional static↔dynamic conversion — the 1:1 mapping Ryan describes (routes ⇄ route slots +
   URL params) so switching modes preserves what's displayed instead of leaving stale hardcoded
   routes or empty slots. Biggest unknown, do last within this item and expect it to need its own
   design pass before implementation.

### Phase 5 — Open-ended graph/section polish (Item 4, remainder)

Deliberately last — these are "spend time and use judgment" asks rather than bounded fixes, and some
overlap with Phase 1/3 levers (padding, legends), so doing them after those land avoids re-tuning the
same knobs twice.

- General graph-card padding: still enough to avoid clipping unpredictable content, but tighter than
  today's default.
- Legend implementation/design quality pass, especially GridGraph.
- **Backlog, not scheduled:** a broad pass migrating titles from graph-native to section-level
  everywhere (see Phase 3 decision log) — explicitly deferred by Ryan 2026-09-04, revisit only if he
  asks for it.

## Open questions

None outstanding from this batch — all three resolved 2026-09-04 (see Phase 3 decision log for the
list-column and title-placement calls; the legend-default call is in the cross-reference table above).
