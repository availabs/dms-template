# NPMRDS Reports/Routes tools — 2026-09-04 feedback batch: triage

**Project:** TransportNY · **Topic:** themes · **Status:** IN PROGRESS — **Phase 1 CLOSED**
(all 4 non-deferred items shipped + live-verified 2026-09-04; map TMC line-width and submodule
graph-theme tuning remain deferred per Ryan's call, see below). **Phase 2 CLOSED 2026-09-05**
(RRL panel restructure, DONE + live-verified 2026-09-04, plus a same-day-after-ship Save/Discard +
collapsed-row-reweight follow-up 2026-09-05 — see "Phase 2 follow-up" and "Phase 2 — CLOSED" below).
Phase 3 resolved (decision log). **Remaining: Phase 4** (Dynamic Reports, Item 2) **and Phase 5**
(open-ended polish, Item 4 remainder) — neither started. · **Started:** 2026-09-04

## Phase 2 follow-up (2026-09-05): explicit Save/Discard replaces auto-save row editing

Ryan's live feedback after using the 2026-09-04 ship, in order:

1. The combined toggle's "X + Done editing" pairing was misleading, and — the deeper ask — RRL
   should have a real Save/Discard flow for a route's edit, not autosave-on-blur/debounce. This
   **reverses** the 2026-08-19 item-4A decision ("always live, no Save/Cancel" for dates), which
   the 2026-09-04 restructure had itself just extended to the name field. Explicitly flagging the
   reversal rather than treating it as a bug: this is a deliberate, Ryan-directed design change to
   a previously deliberate decision, not a correction of something that was built wrong.
2. The date-range line should be the most prominent collapsed-row sub-text — moved above TMC/mileage
   and bolded (was the reverse: TMC/mileage prominent, dates muted, below).
3. (Live follow-up after the first fix shipped) The header's "X" is redundant with a bottom
   Discard button — consolidate: move Save up into the header row too, delete the bottom action
   row entirely.

**What changed, `RouteRow.jsx`:**
- Every field (name, dates, derive-mode picks) now lives in a **pure local buffer** that persists
  nothing until Save. All the debounce/instant-flush machinery (`scheduleFlush`/`flushDates`/
  `pendingRef`/`timerRef`/the echo-vs-external-change diffing effect) is gone — replaced by one
  effect that reinitializes the buffer on the **rising edge** of `isExpanded` only (collapsed →
  editing), so an external change to the route while a row is mid-edit no longer risks a
  complicated "was this my own echo" check; it simply doesn't touch the buffer until the row is
  next opened or discarded.
- `nameError`/`dateReady`/`canSave` are **computed live from current buffer state**, not stored —
  always in sync, no stale-error risk. `dateReady` mirrors the exact 3-way condition the derive UI
  already displays inline (no base picked / invalid formula / real resolved preview).
- Header row, editing state: **Discard (X)** + **Save (floppy disk, green-tinted bordered — a
  solid blue fill was tried first and called "heinous," reverted to the softer bordered-tint style
  `expanderOpen` already uses)** side by side, replacing both the old single ambiguous toggle and
  the (briefly-shipped-then-removed) bottom action row.
- Per-row Copy now reads the **buffer** (`localStart`/`localEnd`), not the persisted route — copies
  what's on screen if mid-edit. Per-row Paste writes into the buffer instead of persisting
  immediately. The separate "paste into all" clipboard-strip bulk action is **unchanged** — it
  still persists immediately and applies regardless of any row's edit-mode state; it's a distinct
  bulk tool, not part of this per-row Save/Discard session.
- Collapsed-row summary: `dateMeta` now renders first using the `metaProminent` token (bold,
  `font-semibold text-slate-700`); `tmcMileageMeta` renders second using the muted `meta` token —
  a straight swap of which content gets which existing style, no new tokens needed for this part.
- Escape (in the name field) now triggers Discard; Enter triggers Save — both call the same
  handlers the buttons do.

**Theme (`ReportRouteList.theme.js`):** added `saveIconBtn` (bordered green-tint, matches
`expanderOpen`'s shape); removed `editActionsRow`/`discardBtn`/text-`saveBtn` (shipped then
retired same day once the header consolidated both actions); `metaProminent` bolded.

**Live-verified** on a rebuilt scratch report (new page id 2218560, same recipe as the first pass
— `report_build.mjs`, 2 real-TMC routes + 1 graph, deleted after use):
- Collapsed rows: bold date-range line on top, muted TMC/mileage below — confirmed both routes.
- Entering edit mode shows the header's [X][Save] pair; typing a colliding name shows the inline
  error live (before any Save attempt) and visibly disables Save (confirmed the greyed-out state);
  clicking disabled Save is a no-op (row stays open, nothing persisted, catalog chip list
  unchanged).
- Fixing the name to a valid one re-enables Save; clicking it persisted the rename AND closed the
  row in one action — confirmed via the header catalog-chip list and the graph legend both
  updating in the same render.
- Discard on an untouched-but-then-edited row (typed a new name, didn't save) correctly reverted
  to the original persisted name and closed the row — confirmed the DB-backing chip list never
  changed.
- Save icon color iterated live per Ryan's in-the-moment feedback ("heinous") from a solid blue
  fill to the current bordered green tint — confirmed visually after the fix.
- Scratch page + its 3 sections + `reports_snap_2` row deleted after verification, same cleanup
  discipline as the first pass.

**Not re-verified this round** (unchanged from the first pass, still true): the derive-mode
(relative dates) Save path — switching to Derived, picking a base + pattern, and Save persisting
`dateFormula`/`derivedFromRoute` together — was exercised by code-reading, not a fresh live click
-through, since the underlying derive UI itself wasn't touched (only its commit timing moved from
per-keystroke-debounce to buffer-until-Save). **Accepted 2026-09-05 (Ryan): "its prob fine" —
not blocking, revisit only if it actually misbehaves in practice.**

## Phase 2 — CLOSED 2026-09-05

Both rounds (2026-09-04 initial restructure, 2026-09-05 Save/Discard + reweight follow-up) shipped
and live-verified; the one open item above (derive-mode Save, untouched logic, code-reviewed not
click-tested) was explicitly accepted as low-risk by Ryan rather than closed via a third live pass.
Nothing else outstanding for this phase. Next up whenever picked up: Phase 4 (Dynamic Reports) or
Phase 5 (open-ended graph/section polish) — see their sections above.

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

## Phase 2 implementation plan (scoped 2026-09-04, not yet built)

**2026-09-05 note: 2B's "auto-save, no Save/Cancel" design (below) was shipped, then reversed the
same evening per Ryan's live feedback — see "Phase 2 follow-up" above for the current, correct
design (explicit Save/Discard). 2A's collapsed-row content below is also superseded — the
prominent/muted assignment was swapped (dates prominent, TMC/mileage muted), also per that
follow-up.** Left as-written rather than rewritten, per this file's own "date everything, don't
rewrite history" convention — it's still an accurate record of what was originally planned and
why, just no longer what's live. 2C/2D below are unaffected and remain current.

Read before implementing: `RouteRow.jsx`, `ReportRouteList.jsx`, `ReportRouteList.theme.js`,
`useReportRow.js`, `useGraphPublish.js` — all re-read in full this session. Two design calls below
are flagged for Ryan's confirmation before coding starts (see "Open questions for this plan" at the
bottom); everything else is fully specified.

### 2A. Collapsed-row layout

Today `RouteRow.jsx`'s `metaText` (~line 234-251) is ONE combined mono line rendered unconditionally
(collapsed AND expanded): `N TMCs · X.X mi · start → end · N graphs`. Split it:

- **New prominent line**, directly under the title: `N TMCs · X.X mi` only — larger/darker than
  today's tiny all-caps mono meta style (new theme token, e.g. `metaProminent`, ~12-13px
  `text-slate-600`, not mono/uppercase — visually a step above `t.meta`/`t.metaIndent`).
- **Kept, still muted**: the date-range line (`start → end` / "No dates set"), same `t.meta` style
  as today — nothing in the feedback asked to remove this, only graph-count.
- **Removed entirely** (decided 2026-09-04, Ryan): graph count. Not relocated into edit-mode either
  — dropped from `RouteRow.jsx` altogether, collapsed or expanded. The `graphCount` prop threading
  from `ReportRouteList.jsx` (`graphCountByCompId`) and the `useGraphPublish`-derived `graphs` count
  discovery stay (still needed for Item 5's write-path, 2D below) — only this per-route DISPLAY of
  it goes away.

Files: `RouteRow.jsx` (metaText split + JSX), `ReportRouteList.theme.js` (new token).

### 2B. Combine expand + edit into one control (bundles gap #7's rename-input-commit bug)

**Root-cause fix for gap #7, by construction, not a patch**: today's rename mechanism
(`editingRouteNameIndex`/`editNameValue`/`onStartEditName`/`onSaveEditName`/`onCancelEditName`,
parent-owned, single-flight — only one row's name can be mid-edit across the whole list) is
architecturally the same shape date-editing had BEFORE the 2026-08-19 item-4A rebuild that gave each
row its own local live buffer + debounced auto-save (`localStart`/`localEnd`/`lastFlushedRef` in
`RouteRow.jsx`). Applying that same proven pattern to the name field removes the parent-owned
shared-slot mechanism the old bug lived in, rather than debugging the old mechanism further:

- Add `localName` + a `lastFlushedNameRef` to `RouteRow.jsx`, mirroring `localStart`/`localEnd`
  exactly (external-change-vs-echo distinction included).
- Commit on blur/Enter — **discrete, not per-keystroke debounce** (unlike dates): a rename needs a
  synchronous uniqueness check against sibling route names (existing rule, `useReportRow.js`'s
  dedupe comment) before persisting, so it needs a clear commit point. On collision, show an inline
  error under the input (reuse the `deriveFormulaError` visual pattern already used for invalid
  derive-formulas) and keep the local buffer showing the attempted text — do not persist, do not
  silently revert.
- Delete `isEditingName`/`editNameValue`/`onStartEditName`/`onSaveEditName`/`onCancelEditName` and
  the entire `if (isEditingName) {...}` early-return branch in `RouteRow.jsx`, plus the corresponding
  parent state (`editingRouteNameIndex`, `editNameValue`) and props in `ReportRouteList.jsx`.

**One combined toggle, `canMutateRow` rows only** (a real viewer with no edit permission keeps the
existing simple +/− expand-for-read-only-dates control untouched — there's no separate "edit"
concept to merge with for a viewer):

- Reuse the existing `expandedRoutes` boolean-map state (already supports several rows open at
  once) as the single source of truth for "this row is in edit mode" — no new state shape needed.
- Delete the separate "Edit name" pencil button; the expander button becomes the one toggle for
  both expand-to-see-details AND enter-name/date-editing, for an author.
- Icon: **decided 2026-09-04 (Ryan): `PencilSquare`** when off (signals "click to edit", not just
  "expand"); toggles to a "close/done" affordance (e.g. `CancelCircle` or a filled/active
  `PencilSquare` state, matching the existing `expanderOpen` active styling) when the row is in
  edit mode.

**Header row**: title becomes an `<input>` in place (not a full row-markup swap) when the row is in
edit mode — color dot/picker, reorder buttons, and the trash/remove icon (`dangerBtn`) all stay
exactly where they are, visible regardless of edit-mode state (this is also 2C's "one remove
button," see below).

**Body — this is the "replaces in place, not appended" part**: today, `isExpanded` wraps an
**appended** block (`expandedContainer`) below the collapsed summary lines, which stay visible too —
so an expanded row shows the compact meta line AND the full date editor stacked, redundantly. New
behavior: the two collapsed summary lines from 2A are **replaced** by the existing dates-editor JSX
(unchanged internally — `facetBlockFirst`/`deriveControlsWrapper`/the whole Fixed/Derived block) the
moment the row enters edit mode, occupying the exact same visual slot rather than adding a second
block beneath it. The "base for N routes" dependents disclosure stays inside this same edit-mode
body. The relocated per-route graph-count note (2A) also lives here, as a small line near the
dependents disclosure.

Files: `RouteRow.jsx` (the biggest single diff in this phase — restructures the collapsed/edit-mode
branching), `ReportRouteList.jsx` (drop the 5 rename-related props/state), `ReportRouteList.theme.js`
(retire `editContainer`/`renameInput`/`saveBtn`/`cancelBtn`/`rowRenaming` if nothing else in this
file still uses them — confirm during implementation, they're `reportRouteListTheme`-local).

### 2C. Remove the duplicate bottom delete button

Delete the `openOutRemoveRow`/`openOutRemoveBtn`/`openOutRemoveLabel` block entirely (currently at
the bottom of `expandedContainer`) — the header row's `dangerBtn` trash icon (already unconditional
under `canMutateRow`, untouched by 2B) is the one surviving remove control. Retire the three
now-unused theme tokens.

### 2D. Item 5 — live route/graph-count write-path

Target columns on `reports_snap_2`, confirmed from `build_npmrds_reports_list.mjs`/
`report_build.mjs`: `graph_count` (number) and `counts_label` (text, exact existing format
`` `${n} routes · ${m} graphs}` `` — always-plural, no singular special-casing, matching every
spec-built row already in the DB for consistency).

- **`useReportRow.js`**: extend `loadReportRow`'s forced-include column list (same pattern already
  used for `tags`/`id`) with `graph_count`/`counts_label`; store as `reportRow.graphCount`/
  `reportRow.countsLabel` so the new effect below can skip a no-op write.
- **`useReportRow.js`**: add `persistCounts({ routeCount, graphCount })`, same guard/payload shape as
  the existing `persistTags` (`{report_id, graph_count, counts_label, name, page_path, id?}`).
  **Never creates the row itself** — gated on `reportRowIdRef.current` already being set (silently
  no-op if the row doesn't exist yet); row creation stays exclusively owned by `persistRoutes`'s
  existing `ensuringForRef` sequence, so this can't race a first-ever-row creation into a duplicate.
- **`ReportRouteList.jsx`**: new effect (mirrors the `isEqual`-guarded publish effects already in
  `useGraphPublish.js`) computing `nextRouteCount = routes.length` (the raw authored/slot count —
  **not** `effectiveRoutes.length**; for a Dynamic Report the slot count is the meaningful catalog
  number, matching what a spec-built report's own `routes.length` means) and `nextGraphCount =
  graphs.length` (already discovered live by `useGraphPublish`, so this catches a graph SECTION
  being deleted via the normal section-menu too, not just RRL's own Add Graph flow). Calls
  `persistCounts` only when `canMutate && reportRow?.id != null` and the computed values differ from
  `reportRow.graphCount`/`reportRow.countsLabel`.

Files: `useReportRow.js`, `ReportRouteList.jsx`.

Both open questions from the initial plan draft **resolved 2026-09-04** (Ryan): graph-count dropped
entirely (not relocated), combined toggle uses `PencilSquare`.

### Phase 2 — IMPLEMENTED 2026-09-04, not yet live-verified

All four sub-items (2A/2B/2C/2D above) coded per the plan:

- `RouteRow.jsx` — rewritten: two-line collapsed summary (prominent TMC/mileage line + muted
  date-range line, graph-count dropped entirely); one combined `PencilSquare`/`CancelCircle` toggle
  per row (author rows only — a real viewer keeps the plain +/− expand); name editing moved to a
  local live buffer (`localName`/`lastFlushedNameRef`) committing on blur/Enter with an inline
  uniqueness error, same architecture as the existing per-row date buffer — this is the gap #7 fix,
  by construction; the old `isEditingName` branch and its Save/Cancel buttons are gone; the bottom
  `openOutRemoveRow` duplicate delete button is gone (header's `dangerBtn` trash icon is now the only
  remove control).
- `ReportRouteList.jsx` — dropped `editingRouteNameIndex`/`editNameValue` state and the 5
  rename-related props; dropped the now-unused `graphCountByCompId` memo; renamed the
  `onUpdateDates` prop to `onUpdateRoute` (now serves both name and date commits); added
  `siblingNames` prop (uniqueness check moved into `RouteRow`); added the Item 5 live count-sync
  effect (`lastPersistedCountsRef` + `persistCounts`), gated on `canMutate && reportRow?.id`.
- `useReportRow.js` — `loadReportRow` now force-includes `graph_count`/`counts_label` in its column
  fetch (same pattern as `tags`/`id`); `reportRow` carries `graphCount`/`countsLabel`; added
  `persistCounts({ graphCount, countsLabel })` (never creates the row itself — mirrors `persistTags`'s
  shape); `persistRoutes`/`persistTags` now carry `graphCount`/`countsLabel` through their own
  `setReportRow` calls so a route/tag edit doesn't drop the counts from local state.
- `ReportRouteList.theme.js` — added `metaProminent`; renamed `renameInput` → `titleInput`; retired
  `rowRenaming`, `editContainer`, `saveBtn`, `cancelBtn`, `openOutRemoveRow`, `openOutRemoveBtn`,
  `openOutRemoveLabel` (grepped repo-wide first — all six were `reportRouteListTheme`-local, no other
  consumer).
- `README.md` (this component's own) — rewrote the stale "Expanded route row" section (it still
  described an even-older 2026-08-05 overflow-menu design, already invalidated by the 2026-08-06/
  2026-08-19 rebuilds without ever being updated) to describe the current design, and added a
  `graph_count`/`counts_label` write-path note to the Storage section.
- All four syntax-checked with `esbuild` (no full typecheck/build run yet).

### Phase 2 — LIVE-VERIFIED 2026-09-04, DONE

Built a scratch report via `report_build.mjs` (page id 2218554, 2 real TMC routes + 1 BarGraph,
`/reports/claude_scratch_rrl_phase2`, draft only) and drove it live via `claude-in-chrome` in
`/edit/...` (auth via a freshly minted dev token in `localStorage.userToken`). Deleted afterward
(page + 4 draft-section components + the `reports_snap_2` row) — nothing left behind.

- **Collapsed-row layout (2A)**: confirmed on both the scratch report and the real, published
  `reports/beacon_9_d_jan_25_vs_26` (existing report, unmodified) — `"1 TMC · 0.6 mi"` /
  `"2 TMCs · 0.0 mi"` prominent line + a muted date-range line under the title, no graph-count
  anywhere. `beacon_9_d`'s "NO CHANGES" indicator after load confirms viewing an existing report
  doesn't spuriously mutate it.
- **Combined toggle + edit-in-place (2B)**: clicking the header pencil correctly **replaced** the
  two summary lines with the editable title input + Fixed/Derived date editor in the same slot (not
  appended) — screenshotted both states. Renamed "Route A" → "Route A Renamed": committed on Enter,
  the graph legend and the page's own routes-disclosure chip updated live in the same render.
  Renaming to "Route B" (an existing sibling name) showed the inline
  `A route named "Route B" already exists.` error under the input and did **not** persist (confirmed
  the input kept the attempted text) — this is gap #7's old input-commit bug, exercised directly and
  working correctly under the new local-buffer architecture.
- **Single remove button (2C)**: confirmed visually in both expanded and collapsed states, both
  rows — one trash icon in the header, nothing at the bottom of the edit-mode body.
  Removed "Route B" via it; the RRL panel's own "N routes in this report" counter and the graph
  (which had both routes assigned) both updated live to reflect only "Route A Renamed" remaining.
- **Item 5 write-path (2D)**, confirmed via two separate live DB reads (`dms dataset query` against
  `reports_snap_2`, source 2177438/view 2177440):
  1. On initial load, `graph_count: 1` / `counts_label: "2 routes · 1 graphs"` (report_build.mjs's
     own build-time values) — my new effect read these back and correctly made **no** write, since
     they already matched (confirms the no-op-write guard works, not just the write path).
  2. After adding a 2nd graph via "+ Add Graph": `graph_count: 2`, `counts_label: "2 routes ·
     2 graphs"` — a live section-count change, unrelated to RRL's own route-mutation flow, still
     caught (confirms `useGraphPublish`'s live section discovery is what's actually feeding this,
     not just RRL's own Add Graph modal).
  3. After removing "Route B" via RRL: `counts_label: "1 routes · 2 graphs"` (`graph_count`
     correctly unchanged — removing a route doesn't remove a graph section), and the persisted
     `routes` array correctly down to one entry, "Route A Renamed".
- **Not independently live-tested**: the real-viewer (`!canMutateRow`) branch inside `RouteRow.jsx`
  (the plain +/− expand, read-only date row). Turns out to be **unreachable in practice** — found
  while trying to test it: `ReportRouteList`'s own parent component returns an invisible marker
  entirely before rendering any `RouteRow` at all whenever `!isEdit` (a real viewer never sees this
  panel — pre-existing, documented behavior), and `RouteRow`'s own `isEdit` prop is literally the
  same `canMutate` value the parent gates on. So `RouteRow` only ever mounts when `canMutateRow` is
  already true — the `!canMutateRow` branches are dead code, **pre-existing** (true before this
  session's changes too, not something introduced here). Confirmed correct by inspection (the branch
  is untouched, byte-identical logic to before); flagging here rather than fixing, since removing
  dead code unrelated to Ryan's ask is out of scope for this pass.
- `traversing-report-pages.md` updated (living-document convention) — its "RRL row mutation needs
  RRL's own SectionEdit" section described a 2026-08-07 finding already superseded by the
  2026-08-19 item-3 change; re-verified live today that page-level `/edit/` alone unlocks every
  mutation control, rewrote that section to match, and updated it for the new combined-toggle shape.

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
