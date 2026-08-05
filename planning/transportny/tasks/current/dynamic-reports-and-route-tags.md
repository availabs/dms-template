# Dynamic Reports, Route Tags & Add-Route Flow — next-phase scoping

**Project:** TransportNY

## Status: IN PROGRESS — core architecture decided for all 3 items (2026-07-31, across three rounds of same-day follow-up). Item 2 (Route Tags) Phase 1 — manual tag storage + editing UI — is DONE and live-verified (2026-07-31, see item 2's "Implementation Plan" section). The shared tag-folder-browsing modal (items 1+2, "RouteTagBrowserModal") is DONE and live-verified (2026-07-31, see item 1's new "Shared modal — implementation" section) — wired into RRL's add-route flow now; Dynamic Reports' consumption of it (item 3) waits on that system existing at all. **Add-Graph modal (item 1's sub-item) is DONE and live-verified, 2026-08-03** — see item 1's "Implementation plan, 2026-08-03" section, including a real platform bug (`useGraphPublish.js` orphan-cleanup race) found and fixed along the way. **Dynamic Reports (item 3) — Ryan picked this as the next thread, 2026-08-03, with old-template porting explicitly carved out as a separate task. Core mechanism DONE + live-verified, 2026-08-03** — route slots filled via URL param, a "Dynamic Report" toggle in RRL, view-time resolution against the route catalog, all built and proven end-to-end (two different real routes rendering on the same shared page via different `?routes=` values). See item 3's "Implementation plan, 2026-08-03" section, including a pre-existing/unrelated platform finding (one LineGraph section that never renders a line, isolated away from Dynamic Reports and left for separate investigation) and old-template porting still deliberately out of scope. **Ryan then manually tested the mechanism and found a real bug, fixed same day, 2026-08-03**: an unresolved route (no `tmc_array`) made its graph run a full unfiltered network-wide query instead of showing nothing — see item 3's new manual-testing section. One related UX question (slot-count/URL-count mismatch re-triggering the blocking picker over already-rendered content) is flagged but not fixed, pending Ryan's steer — see "Open questions" item 2b. **Old-template porting — scoping DONE, 2026-08-03 (nothing built yet):** Ryan steered toward reusing the existing `convert_old_reports.py` pipeline against a curated, most-used subset of the 216 `admin2.templates` rows. Found real usage signal via `admin2.stuff_in_folders`'s `type='group'` (shared agency-account) folders — 28 deduped candidates (17 from the vendor's own AVAIL-account starter series, 11 real NYSDOT operational templates). `TEMPLATE_SPECS` coverage cross-checked (reused `analyze_report()` directly): 4 fully mapped today, 1 cheap, 23 hit a concentrated gap (mostly Route/TMC Info Box missing a "speed" measure bucket, plus Route Map/Info Box failing to resolve relative-date placeholders like `{recent-0}`). Mechanism design **unified 2026-08-03 per Ryan's own steer** ("treat all templates as if they have no routes, pull from `graph_comps` only") — all 28 build the same way via `convert_old_reports.py`'s existing `build_graph_section_data()` (confirmed already route-data-independent) + today's route-slot mechanism, no path split; the 4 candidates with real example routes become verification fixtures, not a different build path. Relative-date support explicitly deferred by Ryan ("eventually, not right now") — fixed author-set dates for this pass. **Template 244 ("Year Over Year (Beginner)") built + live-verified, 2026-08-03** — new `--template-id` mode in `convert_old_reports.py` (`convert_template()`, deliberately duplicated not refactored from `convert_report()`), plus a backward-compatible `route_slot_group` extension to the already-shipped `useDynamicReportRoutes.js`/`ReportRouteList.jsx` so 244's 11 date-window route rows (all one conceptual route) resolve against a single real route pick instead of 11. Full picker→resolve→render flow live-verified with real data (17/19 panels; Route Map deferred by design). See item 3's "Template 244 built + live-verified" section for the full record, including a live-caught correction (an old `admin2.routes` id is NOT a valid `?routes=` value — wrong id space from the new catalog) and two non-bugs recorded so they aren't re-investigated. **5 more candidates converted + live-verified, 2026-08-04** (`238`/`265`/`90`/`221`/`204`), picked by real dry-run gap reports rather than the static coverage table — which caught `278` silently failing the deferred-relative-dates check despite scoring "fully mapped." One small proven-shape `TEMPLATE_SPECS` addition made along the way (truck-speed Line Graph, unlocking `90`). 22 candidates remain, most now blocked on either the deferred relative-date feature or the (separately flagged, not started) Route Info Box "speed" measure gap. See item 3's "5 more candidates converted + live-verified" section. **Slot/URL-count mismatch UX (open question 2b) — resolved and built, 2026-08-04**: the entry-gate picker now pre-populates already-resolved routes and only asks for the still-missing slot(s), instead of discarding what the URL already resolved. See item 3's "Slot/URL-count mismatch — pre-populate fix" section. **TMC-linear auto-generation (item 2) — reconciled 2026-08-03: 2024 pilot DONE.** Found and reproduced the old tool's real 2022 generator (`avail-falcor/tasks/folders/create_and_load_corridors.py`, a one-off 2023 batch script, never run for any other year), ported it against the year-matched ClickHouse source `582/983` (new script `scripts/npmrds-reports/route_gen_corridors.py` + a `--tmc-year` extension to `route_build.py`), and generated+verified 2024: **8,660 auto-generated corridor routes, correctly tagged (`auto_generated`/`region:N`/`county:{Name}`), independently confirmed via direct SQL.** Along the way: confirmed the legacy migration is both incomplete (34% of the old 49,218 routes missing) and duplicated (32,194 inserted twice) — not fixed, flagged for a separate decision; confirmed a real, inherited-from-the-old-tool county-boundary gap in corridor continuity — shipped matching old behavior per Ryan's call, flagged for future revisit; caught and fixed a real county-tag casing bug (wrote lowercase, UI's `tagCategories.js` needs Title Case) that had already let 813 mistagged routes through — all deleted and regenerated clean. The other 10 years (2016, 2018-2026 excluding 2024) are not yet generated; the scripts are already generic over year, no further code work expected. See item 2's "Generation mechanism found" section onward for the full trace. **Both remaining-candidate blockers scoped, 2026-08-04 (nothing built yet)** — see item 3's new "Both flagged items scoped, 2026-08-04" note and `research/npmrds-reports/info-box-speed-and-relative-dates-scoping.md`: the Route Info Box "speed" gap is mostly the already-known bin-ambiguity data-coverage wall (round 21/40), not a missing bucket — only 1 candidate (`110`) has a genuine (and cheap) gap; relative dates are the bigger lever, blocking 13 of the 22 remaining candidates (not ~9), and should ride the existing `derived-page-variable` mechanism rather than a new one. **Mechanism B (`relativeDate`/`isRelativeDateBase`) — built + live-verified, 2026-08-04** (Ryan's build-order call: B before A): a shared Python resolver (`convert_old_reports.py`) plus a live-recompute JS module (`relativeDateResolution.js`, wired into `ReportRouteList.jsx`) unblocks all 7 Mechanism-B-blocked candidates (`246, 276, 278, 279, 281, 283, 291`) — verified via dry-run (zero `relative_date` gaps) and a real build of `278` with full live rendering. A real, unrelated pre-existing bug (`build_slot_entry` double-applying `compTitle` substitution) was found and fixed along the way. Mechanism A (`{recent-N}`) remains unbuilt — separate follow-up. See item 3's "Mechanism B — built + live-verified" section.

**Priority directive (2026-07-31):** this arc (all items below) takes priority over every other
currently-tracked gap/bug in the reports/routes space — `report-route-ui-parity-gaps.md`,
`report-page-template-editorial-slots.md`, `cold-open-ux-findings.md`'s recommendations, etc. —
until re-triaged. Nothing below has been broken into an implementation plan yet; this file exists
to get three related, somewhat-rambly ideas into one coherent, cross-referenced shape before the
next round of back-and-forth on scope/priority/detail.

## Context that applies to all three items

- Ryan's coworker is doing visual/design work across these repos (still under construction). Don't
  block on it, don't tightly couple anything below to it, don't treat current in-progress design
  work as settled — it'll get applied on top of whatever gets built here, later.
- Old-tool reference point Ryan gave: `https://npmrds.devtny.org/report/edit/1071` — intended as an
  `admin2.templates` row ("template" in the old tool's vocabulary), the direct conceptual ancestor
  of "Dynamic Report" below. **Corrected 2026-08-04: this specific id/URL combination was wrong.**
  `1071` is actually an `admin2.reports` id ("WB East-West Arterial Poughkeepsie"), not a template —
  confirmed directly, it doesn't exist in `admin2.templates` at all. Also traced the real old-tool
  routing (reading `pages/analysis/reports/edit/index.js` + `ReportBase.jsx` directly): `/report/edit/:id`
  ONLY ever loads from `admin2.reports` (via the `reports2` falcor collection), with no fallback to
  templates. Templates have entirely separate routes that always require an additional route/
  station/tmcs context — `/template/edit/:templateId/route/:routeId` (or `/station/:stationId`, or
  `/tmcs/:tmcArray/dates/:dates`) — **there is no bare `/template/edit/:templateId` route at all**,
  so a template can never be opened by id alone; it must be instantiated against a real route (or
  station) id. The conceptual point ("templates are the ancestor of Dynamic Report") still stands —
  just the URL/id example was inaccurate. See item 3's "Mechanism B" section for a real working
  example (`/template/edit/278/route/163181`) and the live cross-check it enabled.
- Starting point Ryan gave for old-tool/DB spelunking: `src/dms/planning/tasks/current/old-reports-conversion.md`.
- **These three items are not independent.** Item 2 (Route Tags) is infrastructure that items 1 and
  3 both consume — it is not a parallel third track, it's closer to a dependency underneath the
  other two. **Confirmed 2026-07-31: items 1 and 3 also share one UI component** — the tag-folder
  route-picker modal — not just the tags underneath it. See "Open questions" below.

---

## 1. Add Route Flow (RRL)

**The problem, in Ryan's words:** adding a route to a report today is "overwhelming / confusing /
IDK where to look."

**Current state.** Per `reportroutelist.md`, the RRL add-flow is currently a flat inline box: empty
input shows recently-created routes, typing 2+ characters searches by name, clicking a result adds
immediately. This is itself the result of a rebuild (2026-07-29) that replaced an earlier
separate-catalog-section-plus-confirm-banner flow, and it held up fine in the 2026-07-31 cold-open
UX walkthrough (`cold-open-ux-findings.md`) — "worked immediately, no confirm-dialog friction." That
walkthrough was against a small number of routes, though. A flat recent-list + name search doesn't
scale as an organizing principle once there are hundreds of routes on the books, which is exactly
what item 2 below is about to produce.

**Direction:** mirror the *organizing effect* of the old tool's folder browser — not its literal
folders-under-the-hood model — so a user can narrow down to a manageable subset before
searching/scanning, the way folder navigation did in the old tool. Explicitly **not** real folders
in the data model; the actual mechanism is tags (item 2). `research/route-creation/findings.md`'s
"Route organization (folders)" section (~line 296 on) already has a thorough writeup of exactly how
the old tool's folder browser worked and behaved, sourced directly from the transportNY code — good
inspiration material, already on file.

**Sub-item — Add Graph/Section flow.** A related but distinct pain point Ryan raised in the same
breath: adding a graph/section to a report by hand is "hard/ambiguous" today. Proposed direction:
move this into the RRL too, via a modal that shows a live preview of the graph plus descriptive
prose about what it's for / what it displays. Stated benefits: control over defaults, sibling-section
wiring, auto-assigning routes to the new graph. This is a concrete, buildable instance of the gap
`guidance-layer-findings.md` (2026-07-31) already identified in the abstract — the reports/routes
tools currently have no "guidance layer" at all (nothing tells the user what a thing is for or how
to use it) — worth reading that doc's framing before designing this modal's copy/behavior.

**Confirmed, 2026-07-31: part of this arc**, not a peer item — tracked here alongside Add Route
Flow, even though mechanically it's about adding graphs, not routes.

**Decided, 2026-07-31: shared modal.** The same tag-folder-browsing modal used for Dynamic
Reports' route-slot-fill (item 3's no-URL-param case) will also replace the inline box for
*normal* reports' add-route flow — one shared modal component, not two separate builds. It differs
only in selection constraints (normal reports: any number, uncapped; Dynamic Reports: exactly N,
gated by route-slot count) and in what happens after selection (normal: RRL adds the route(s)
directly; Dynamic Report: sets the URL param via the page-variable system, see item 3). This makes
item 2 (tags) even more clearly the thing to build first — both item 1 and item 3's actual UI work
now route through the same component.

**Shared modal — implementation, DONE + live-verified 2026-07-31.** Built
`src/themes/transportny/components/RouteTagBrowserModal/` (`RouteTagBrowserModal.jsx` +
`.theme.js`, `useTagBrowser.js`, `tagCategories.js`). Single-pane drill-down (root → category →
value, breadcrumb-navigated), mirroring the old tool's folder-browser organizing effect per
`research/route-creation/findings.md`, not its literal multi-type listing. Root view: name search
(lifted from the old `AddRouteSearch.jsx`/`useRouteSearch.js`, now deleted — superseded) +
category tiles (County/Region/Agency/Auto-generated/Other tags). County/Region/Agency drill into a
**hardcoded fixed value list** (`tagCategories.js`) rather than a live-discovered one — see finding
below for why. Selecting a value queries routes via the proven `array_contains` filter
(`uda-array-contains-filter.md`); "Other tags" (open-ended `project:`/custom tags, no fixed
vocabulary) instead does a `like` substring match against the raw `tags` JSON text. Props are
generic (`selectionMode: 'any'|'exact'`, `requiredCount`, `excludeRouteIds`, `onConfirm`) so a
future Dynamic Reports consumer needs zero changes to this file — only RRL is actually wired to it
today. `useReportRow.js` gained a batched `addRoutes(array)` (replacing the old single-item
`addRoute`) so a multi-select confirm persists in one `persistRoutes` call instead of racing
several single-item calls against a stale `routes` closure.

**Finding: no live "distinct tag values + counts" query exists in the UDA engine.** Checked whether
`groupBy` on a `multiselect` column unnests into per-value counts (the way scalar-column filter
UIs do via `ConditionValueInput.jsx`'s `useColumnOptions`) — it doesn't. The actual row/count-fetch
path (`buildSimpleFilterSql`/`simpleFilter`,
`src/dms/packages/dms-server/src/routes/uda/query_sets/postgres.js:216-319`) calls
`handleGroupBy(groupBy)`, a dumb pass-through with no multiselect awareness. The one place that
does unnest (`jsonb_array_elements_text`/`hasArrayElements`, same file lines 109-198) only exists
inside `simpleFilterLength`'s CTE-wrapped count path, for author-typed calculated columns — not
reachable from a normal multiselect groupBy request. Building that server-side primitive isn't
justified yet at current near-zero tag volume, so County/Region/Agency are hardcoded enumerable
folder shells instead (62 NY counties, NYSDOT's 11 regions verbatim from `admin2.folders`
type='AVAIL', and a grounded ~18-code agency list from `admin2.folders` type='group' filtered to
real agency/MPO codes — see `dbq.py old` queries run 2026-07-31). Revisit if `project:`/custom tag
volume grows enough that "Other tags" free-text search stops being adequate.

**Finding: join-source bindings snapshot their column list at author-configure time and never
refresh — a real, pre-existing platform gap, not specific to this feature.** `ReportRouteList.jsx`'s
`routeSourceInfo` (the "Add Join Source" binding backing route search/browse) is a frozen JSON
snapshot baked into each section's stored `element-data` when the join was configured — the "Report
Page" template's own RRL section (row 2187646, template page 2187021) was last configured
2026-05-13, so its `sourceInfo.columns` snapshot has only the original 11 `routes_data` attributes
and is missing `tags` (added 2026-07-31) entirely. Confirmed via `dms raw list
npmrdsv5+npmrds_sub|component` that dozens of already-created reports share this same stale
snapshot (they were all created from this template). Querying `array_contains` on `tags` through
the normal `buildUdaConfig` column-type lookup silently produced `WHERE tags = ANY($3)` (a bare,
unresolved column reference — Postgres error "column tags does not exist") instead of the correct
`EXISTS (SELECT 1 FROM jsonb_array_elements_text(...))` conversion, because `getColumn('tags')`
found nothing to resolve against. **Fix applied in `useTagBrowser.js`'s `fetchCatalogRows`**: don't
trust `routeSourceInfo.columns` for the `tags` column at all — strip any stale/absent entry and
inject an authoritative `{name:'tags', type:'multiselect'}` definition explicitly before calling
`buildUdaConfig`. This makes tag filtering work on every report regardless of when its join was
last configured, without touching the broader (out-of-scope) problem of the template's/every
existing report's frozen snapshot never refreshing for any other future schema change.

**Fix, same day: already-added routes were being hidden everywhere, not just the default
suggestion list.** Ryan caught this live-testing: the old `AddRouteSearch.jsx`'s own comment said
re-adding a catalog route already on the report is legitimate ("a different date range is a
legitimate use case"), but my first cut applied `excludeRouteIds` to every view (recent, name
search, tag-browse) uniformly, so a route already on the report became unfindable anywhere in the
new modal — the opposite of that stated intent. Fixed in `RouteTagBrowserModal.jsx`: exclusion now
only applies to the fully-unscoped root "recent" list (the passive default-suggestion view, where
hiding dupes reduces noise); any deliberate lookup — a name search, a tag-browsed folder, "Other
tags" free text — always shows already-added routes too, flagged with an "Already on report" badge
rather than hidden, so re-adding for a different date/time window stays a normal, easy action.
`addRoutes`/`persistRoutes` already handled a repeated catalog `id` correctly (fresh
`route_comp_id`, name auto-suffixed via the existing dedupe-against-growing-set logic) — this was
purely a display-layer bug.

**Verification (2026-07-31):** scratch report `converted_reports/claude_scratch_tag_browser`
(built via `report_build.mjs`, one pre-existing route already on it to test `excludeRouteIds`).
Live-clicked through in Chrome: root search + recent list (regression-checked against the old
inline box's behavior), County → Albany (real match, a second test route
`id 2198216`/`tags:["county:Albany"]` created for this pass), Agency → NYSDOT (empty-state
render, no crash), cross-view multi-select (selected one route at root, drilled into Agency,
selection count survived the navigation), and a final confirm that persisted 2 routes in one
`reports_snap_2` write (verified via `dbq.py new` against `data_items__s2177438_v2177440_reports_snap_2`).
Scratch report and two scratch test routes (`id 2198206` from Phase 1, `id 2198216` from this
pass) left in place — harmless disposable dev data, per existing convention, safe to delete
opportunistically.

**Verify URL:** `http://npmrds.localhost:5173/edit/converted_reports/claude_scratch_tag_browser` —
click "+ Add Route", expect the tag-browser modal (search + County/Region/Agency/Auto-generated/
Other tags tiles); County → Albany should show "Claude Tags Test Route 2 (county browse)".

**Add-Graph modal — scoping findings, 2026-07-31.** Ryan's prompt: "a long while ago we used to add
graphs via the RRL, but switched for several reasons" — check whether `old-reports-conversion.md`
has the pertinent history before designing this modal.

**`old-reports-conversion.md` checked, not the relevant source.** Its `graph_comps` references
(~lines 775-784) are the *legacy* `admin2.reports` schema field from the pre-2017
`npmrds.devtny.org` tool — an unrelated concept that happens to share a name with the thing below.

**The actual prior art: `ReportRouteList`'s own rejected design iteration**, documented in its
README's "Design iterations during development" + git log `cf6d81a`/`62fdf05`/`381a3ae`
(2026-06-25) → `9208c14`/`33e445f` (2026-07-06). An early iteration of this same component modeled
a report as a separate `reports_snap_2` row carrying both `routes` **and a `graph_comps` array of
section-shaped graph objects**, injected into the live page via a bespoke `setItem` escape hatch
added to `view.jsx`/`edit/index.jsx` specifically for this. **Why it was abandoned:** the injected
graph objects lived only in transient in-memory page state, invisible to DMS's real section-CRUD
path — so any *unrelated* generic section operation (e.g. drag-reorder) would serialize them as if
real, double-storing them (leaked dev-DB rows `2186931`/`2186932` from that iteration). The fix,
landed 2026-07-06, made graphs **ordinary page sections** discovered via a `$self`-bound
`comparison_series` subscriber, with a hard rule still in force today: **RRL never writes into a
graph section's row — only reads siblings, one-way** (README: "a cross-section write was considered
and rejected — the same class of coupling that caused the original `graph_comps` leak"). This rule
is why the shared route-picker modal above, and every other RRL mutation, only ever touches RRL's
own `reports_snap_2` row.

**This doesn't block the proposed Add-Graph modal — it only constrains *how* the new section gets
created.** The generic, already-in-production mechanism for creating a real section (confirmed
2026-07-31 by reading `sectionArray.jsx`'s `save()` → `sectionGroup.jsx`'s `updateSections()` →
`apiUpdate` → `api/updateDMSAttrs.js`): splice a plain inline object with no numeric `id` into the
page's `draft_sections` array and call `apiUpdate({data: {id: pageId, draft_sections: [...],
has_changes: true}})`. `updateDMSAttrs` sees the missing `id` and calls `falcor.call(['dms','data',
'create'], ...)` synchronously — a *real*, immediately-persisted row, not a transient injected one.
This is the same primitive the normal "+ Add Component" button and `editFunctions.jsx`'s `newPage()`
(template section cloning) already use — no new `setItem`-style hatch — and critically, **the
object pushed in can carry fully pre-populated `element-data`** (`columns`/`join`/`comparisonSeries`/
`display`), not just a blank default. `dms section create` (CLI) converges on the same underlying
`dms.data.create` call via separate orchestration code.

**Config composition needs zero new code — reuse `composeMeasureConfig` wholesale.**
`MeasurePicker/composeMeasureConfig.js` already builds a *complete*, from-scratch `columns`/`join`/
`comparisonSeriesCombine`/`displayPatch` object from a `{graphType, measureKey, resolutionKey,
comparisonModeKey, anchorInvert}` pick — built exactly for the "no base template to clone from"
case, i.e. this modal's exact scenario. `MeasurePicker/index.js`'s `REPORT_SUBSCRIBER_ARGS`/
`selfParamKey`/`BASE_SOURCE` supply the `$self`-bound subscriber shape and the default Dataset
(`BASE_SOURCE.sourceInfo`) — the same defaulting Measure Picker already does the first time an
author applies a pick to a blank section. `GRAPH_TYPE_OPTIONS`/`MEASURE_OPTIONS`/
`RESOLUTION_OPTIONS`/`COMPARISON_MODE_OPTIONS` are already exported and directly reusable as the
modal's picker vocabulary. So: the modal collapses today's two-step author flow (+Add Component →
blank "AVL Graph" → open sectionMenu → Measure Picker → configure) into one guided action — gather
the same 4 picks, call `composeMeasureConfig` to get the full state *before* creating anything, push
one fully-configured inline section object into `draft_sections`. The new graph is "as report-ready
as the Report Page template's own pre-wired starter graph" (Measure Picker's own stated goal) from
the moment it's created, with zero duplicated composition logic.

**Auto-assigning routes needs no new mechanism either — it rides the existing one-way publish,
doesn't reintroduce cross-section writes.** Once the new section exists with its `$self` subscriber
enabled, RRL's own `useGraphPublish.js` (`findSelfBoundGraphs` + the publish effect) discovers it
automatically on next render, same as any sibling AVL Graph section. "Auto-assign" is just: after
creating the section, set `graphIds` (to include the new graph's identity) on whichever routes
should be assigned — a write to RRL's *own* `reports_snap_2` row, the one row it already legitimately
owns, never a write into the new graph's row. The existing publish effect then does the normal
`setActionParam` publish. The graph section's row gets written exactly once — at creation, by the
modal, an author-initiated action no different in kind from today's "+ Add Component" — never again
from RRL afterward. Rule intact.

**`avl_graph_template` rows are a red herring — confirmed 2026-07-31 not a live UI mechanism.**
These are 3 hand-built rows `convert_old_reports.py` (the batch Python converter) clones/
drift-checks against; no live JS reads them (`report-graph-vocabulary-picker.md`'s own record: "a
from-scratch picker has no base template to clone from" — Measure Picker was deliberately built to
*not* depend on them). Don't couple the new modal to this concept.

**Open design questions this scoping surfaced — resolved by Ryan, 2026-08-03:**
- Section placement: **appended to the main content group after existing AVL Graph sections.**
- Auto-assign scope: **only routes selected in the same modal interaction** (not every route
  currently on the report) — so the modal needs its own route-selection step, not just a
  vocabulary picker.
- Live preview: **static illustrative preview per Graph Type/Measure combo** (no live `/graph`
  fetch).
- Vocabulary scope: **full cartesian** (every Graph Type × Measure × Resolution × Comparison Mode
  Measure Picker itself already offers), matching the author-empowerment stance over a curated
  preset list.

**Implementation plan, 2026-08-03 (not yet built).** New component
`src/themes/transportny/components/AddGraphModal/` (`AddGraphModal.jsx` + `.theme.js`), same
file-layout convention as `RouteTagBrowserModal/`. Trigger: a new "+ Add Graph" button in
`ReportRouteList.jsx`, next to "+ Add Route" (same `isEdit`-gated wrapper, ~line 122-137 of that
file today).

1. **Workstream 0 — extract two pieces of Measure Picker's mutation logic into pure,
   draft-or-plain-object functions (prep, no behavior change).** `applyMeasurePick`
   (`MeasurePicker/index.js` lines ~94-195) and `reconcileComparisonSeriesColumn`
   (`useDataWrapperAPI.js` lines ~132-172ish) both currently only run against an immer `draft`
   reached via `dwAPI.setState`. The Add-Graph modal has no mounted dataWrapper/`dwAPI` for a
   section that doesn't exist yet — it needs byte-identical merge logic to run against a plain
   in-memory object instead, before that object is ever persisted. Both bodies already only use
   plain mutation syntax (`draft.columns = ...`, `draft.columns.push(...)`) — no immer-specific API
   is used inside either, so the exact same function body works unmodified against a plain mutable
   object. Extract:
   - `applyMeasurePickToState(state, pick, { externalSourceColumns, defaultColors })` — the body
     currently inside `dwAPI.setState(draft => {...})` in `applyMeasurePick`. `applyMeasurePick`
     becomes a thin wrapper: resolve `nextPick`/`composed`, then
     `dwAPI.setState(draft => applyMeasurePickToState(draft, nextPick, {...}))`.
   - `reconcileComparisonSeriesColumnOnState(state)` — the body currently inside
     `setState(draft => {...})` in `reconcileComparisonSeriesColumn`. That function becomes
     `() => setState(draft => reconcileComparisonSeriesColumnOnState(draft))`.
   This is the "real abstraction, not a 1-2 line wrapper" case (root CLAUDE.md's no-wrapper rule) —
   non-trivial merge logic, two genuinely independent call sites that need to produce byte-identical
   section shape (a graph edited live via the picker vs. a graph composed from scratch by this
   modal) — drift between them would silently produce a differently-shaped section depending on
   which path created it.
2. **Workstream 1 — route-selection step.** Not a reuse of `RouteTagBrowserModal` — that modal
   browses the full route *catalog*; this step only ever lists routes **already on this report**
   (`ReportRouteList`'s own `routes` array, passed down as a prop), since auto-assign is scoped to
   routes selected in this same modal. A plain checklist (checkbox + name + existing color swatch
   per row) is enough — no tag/category browsing needed at report-route volumes.
3. **Workstream 2 — vocabulary picker + static preview.** Reuse `GRAPH_TYPE_OPTIONS`/
   `MEASURE_OPTIONS`/`RESOLUTION_OPTIONS`/`COMPARISON_MODE_OPTIONS`/`DEFAULT_PICK` from
   `composeMeasureConfig.js` directly (the same four controls `npmrdsMeasureMenu` already renders,
   laid out as modal form controls instead of a sectionMenu item-group). Anchor-route control only
   appears once exactly 2 routes are checked in Workstream 1 AND `comparisonMode === 'difference'`
   (mirrors `getAnchorRouteOptions`'s own two-arm-only constraint, keyed off the modal's in-progress
   selection rather than a live page-state read, since nothing is published yet). Static preview: a
   small local `GRAPH_TYPE_GLYPHS` (3 canned icons/SVGs — Bar/Line/Grid) + a new local
   `MEASURE_DESCRIPTIONS` copy map (one sentence per measure key — guidance-layer prose that
   belongs in this component, not `vocabulary.json`, since that file is a cross-language SQL/
   composition contract the Python converter also reads, not a UI-copy store). Resolution/
   Comparison Mode render as a plain summary sentence, not a separate illustration per combo (keeps
   the static-asset count to 3 × ~9 measures, not 3 × 9 × 6 × 2 full combos).
4. **Workstream 3 — on-confirm section creation.**
   1. Read one real "AVL Graph" section row (`dms raw get`) to confirm the exact top-level wrapper
      keys a pushed section object needs beyond `element`/`trackingId`/`group`/`is_draft`/`parent`
      (`sectionArray.jsx`'s `save()`, ~line 184-212, already shows these five — need to confirm
      `title`/span-type keys too).
   2. Build `state = cloneDeep(RegisteredComponents['AVL Graph'].defaultState)` — confirmed shape
      `{ filters, columns: [], data: [], display: graphOptions, externalSource: { columns: [] } }`
      (`graph_new/config.jsx` lines ~146-152) — then unconditionally set
      `state.externalSource = { ...BASE_SOURCE.sourceInfo }` (a brand-new section never has an
      existing Dataset to preserve, unlike `applyMeasurePickToState`'s
      `if (!draft.externalSource?.source_id)` guard, which exists only for the already-configured-
      graph case).
   3. `applyMeasurePickToState(state, pick, { externalSourceColumns: BASE_SOURCE.sourceInfo.columns,
      defaultColors: graphOptions.colors })`, then `reconcileComparisonSeriesColumnOnState(state)` —
      the same two calls the picker's own apply path makes, now against a plain object.
   4. Push `{ trackingId: crypto.randomUUID(), group: <the AVL-Graph sections' own group name>,
      is_draft: true, parent: JSON.stringify({id: item.id, ref: `${item.app}+${item.type}`}),
      element: { 'element-type': 'AVL Graph', 'element-data': JSON.stringify(state) },
      ...<title/other wrapper keys from step 4.1> }` into a clone of `item.draft_sections`,
      positioned after the last existing section whose `element['element-type'] === 'AVL Graph'`
      (or at the end of that group if none exist yet). Exact splice-index mechanics need tracing
      `sectionArray.jsx`'s group-filtering logic during implementation — `sectionGroup.jsx` passes
      every `SectionArray` instance the FULL flat `draft_sections` array (not pre-filtered by
      group), so a naive last-AVL-Graph-index over the raw array may not be correct; not yet
      confirmed.
   5. `apiUpdate({ data: { id: item.id, draft_sections: <spliced array>, has_changes: true } })` —
      the same generic primitive "+ Add Component" already uses (`updateDMSAttrs.js` →
      `dms.data.create` for the id-less new entry).
   6. If routes were checked in Workstream 1: a new batched `assignRoutesToGraph(routeIndexes,
      newSectionTrackingId)` in `useReportRow.js` (mirrors `addRoutes`' one-`persistRoutes`-call-
      for-the-whole-batch pattern, rather than looping `toggleRouteGraph` per route — which would
      race against a stale `routes` closure the same way a looped single-item add would have) — sets
      `graphIds` to include the new section's `trackingId` on each selected route in one write.

**Risks/unknowns flagged for implementation, not blocking this plan:** exact section-wrapper keys
beyond the five `sectionArray.jsx` already shows; exact splice-index computation given
`sectionGroup.jsx`'s full-flat-array-per-group passing; `assignRoutesToGraph` is genuinely new code
in `useReportRow.js`, not a reuse of `toggleRouteGraph`.

**Built + live-verified, 2026-08-03.** All of Workstreams 0-3 above shipped as planned, with two
findings from implementation/live-testing worth recording:

- **Section-wrapper keys resolved empirically, simpler than expected.** A live `dms raw get` on a
  real persisted "AVL Graph" section row showed the stored `data` shape includes `title`/`level`/
  `type` fields beyond the five `sectionArray.jsx`'s `save()` sets client-side — but these turned
  out to be **server-side defaults** (`updateDMSAttrs`/`dms.data.create` normalization for every
  "component" row), not something the client must supply. Confirmed by grep: `sectionArray.jsx`'s
  own `edit.value` for a brand-new section starts as `{}` and is never given `title`/`level`/`type`
  before `save()` pushes it. So `useAddGraphSection.js`'s pushed object needing only `trackingId`/
  `group`/`is_draft`/`parent`/`element` (per the plan) was exactly right — no additional keys
  needed.
- **Splice-index question resolved: no index math needed at all.** Traced `sectionArray.jsx`'s
  render path (~line 423): every `SectionArray` instance renders `value.filter(v => v.group ===
  group.name || (!v.group && group.name === 'default'))` in **array order** — `sectionGroup.jsx`
  passes the full flat `draft_sections` array to every group's instance, and each instance filters
  it down client-side. Appending the new section to the **end** of the full array is therefore
  sufficient to render it last within whichever group it's tagged with (no later array entry can
  belong to the same group once it's the final element) — confirmed live, new graphs render
  directly below the existing AVL Graph section(s), never needing a computed splice position.
- **Real bug found and fixed: `useGraphPublish.js`'s orphan-cleanup effect raced against a
  freshly-created section and silently stripped the very route assignment this modal had just
  made.** Live-tested by watching a route's `graphIds` in the actual DB (`dms dataset query`)
  immediately after confirming the modal: the write landed correctly, then within ~2 seconds
  reverted to empty. Root cause: `findSelfBoundGraphs`'s discovery gate and `knownSectionIds`'s
  build (both in `useGraphPublish.js`) required `section?.id != null` before counting a section as
  real — but a section pushed via `updateAttribute`'s optimistic patch (see `useAddGraphSection.js`)
  carries a real `trackingId` immediately, and gets a real numeric `id` only later, once
  `apiUpdate`'s `revalidate()` round-trip lands (`wrapper.jsx` — the earlier `dataSnapshot`+`merge`
  restore only restores the pre-persist rich shape, still id-less; the real id arrives on a
  separate, later refetch). In the window between those two, `knownSectionIds` didn't contain the
  new graph's trackingId at all, so the orphan-cleanup effect (correctly, by its own logic) treated
  the just-assigned `graphIds` entry as pointing at a since-removed graph and stripped it. Fixed by
  changing both gates from `id != null` to `trackingId != null || id != null` (`useGraphPublish.js`)
  — trackingId alone is sufficient identity (it's *why* trackingId exists, per this component's own
  README: "assigned once at creation, survives publish"); existing sections are unaffected (they
  always have an `id`), only a same-render-cycle create-then-assign flow (previously unreachable
  before this modal) benefits. This is a real, previously-latent platform bug in NPMRDS-specific
  code (not core `@availabs/dms`), exposed because this modal is the first feature to create a
  section and assign routes to it in the same user action.
- **Verification (2026-08-03):** live-tested against `converted_reports/claude_scratch_tag_browser`
  (same scratch report used for item 1/2's shared-modal verification). Opened "+ Add Graph",
  confirmed the route checklist (report's own routes, not the catalog), the vocabulary picker
  (Graph Type/Measure/Resolution/Comparison Mode reusing Measure Picker's own option lists
  verbatim), the Anchor Route control appearing only once exactly 2 routes are checked AND
  Comparison Mode is Difference, and the static preview (glyph + measure/graph-type prose + a
  resolution/mode summary sentence) updating live per pick. Confirmed via `dms raw get` on the
  newly-created section row that composed state was byte-correct (columns/join/comparisonSeries/
  `_measurePick` all matching the modal's picks) for both a Plain Bar-Graph/Speed pick and a
  Difference Bar-Graph/Speed pick (comparisonSeriesCombine.mode=difference, anchorInvert=false).
  Confirmed via `dms dataset query` against the report's `reports_snap_2` row that
  `assignRoutesToGraph` persists the correct route→graphId mapping and — after the orphan-cleanup
  fix — that it **stays** persisted 6+ seconds later (past the race window). Four extra scratch AVL
  Graph sections now exist on this scratch report from repeated test runs — harmless disposable dev
  data, same convention as the scratch routes already left on this report, safe to delete
  opportunistically.
- **Verify URL:** `http://npmrds.localhost:5173/edit/converted_reports/claude_scratch_tag_browser`
  — click "+ Add Graph" next to "+ Add Route", pick routes + a Graph Type/Measure/Resolution/
  Comparison Mode combo, confirm a new graph section appears below the existing ones and the picked
  routes show as assigned (expand a route row to see its "Graph N" chips).

---

## 2. Route Tags ("folder approximation")

**Explicit non-goal:** real folders in the data model. **Goal:** tags on routes, plus a UI built
over those tags that *looks and feels* like folder browsing.

**Auto-generated routes + tagging scheme.** The old tool auto-generates a large number of routes
for continuous TMC-linear chains; the plan is to port or replicate that generation. Ryan's
`auto_generated`/`tmc_linear`/`county:{county_fips}` scheme was **illustrative only, not a spec.**

**Tag taxonomy — start from the old DB, don't invent from scratch (2026-07-31 clarification).**
Next concrete step: infer a starting tag vocabulary by inspecting how the old tool's folders were
actually structured — names/hierarchy/categories used in the `folders2` tree (see
`research/route-creation/findings.md`'s folder findings, ~line 296). The folder *structure* is real
signal even though the old tool had no tagging system of its own.

**Old-DB tag-taxonomy inspection — DONE 2026-07-31.** Queried the old Postgres directly
(`dbq.py old`, schema `admin2`) rather than relying on the `findings.md` code-read, since
`folders2Controller.js` lives in a server repo not present on this machine. Actual tables:
`admin2.folders` (395 rows: id/name/description/**type**/owner/icon/color/editable — no
`parent_id`) + `admin2.stuff_in_folders` (junction: folder_id/stuff_type/stuff_id; nesting is
folder-rows where `stuff_type='folder'`, not a parent-id column).

- **`type='AVAIL'` (11 rows) = NYSDOT's own Region 1–11 taxonomy, verbatim** ("Region 1 - Capital
  District" … "Region 11 - New York City"). These hold **routes only** — 2,973 distinct routes
  total across all 11 — real signal, but sparse: only ~6% of all 49,218 routes in the DB are
  filed under a region folder.
- **`type='group'` (40 rows) = a real agency/ownership axis, distinct from geography.** Two kinds
  mixed together: NYSDOT's own internal divisions (`WLD`, `SDD`, `TDD`, `MDD`, all owned by
  `NYSDOT`) and MPO/external-partner accounts (`CDTC`, `GBNRTC`, `NYMTC`, `OCTC`, `SMTC`, `UCTC`,
  `PDCTC`, `BMTS`, `HOCTS`, etc. — each owned by itself). These hold 2,689 distinct routes plus
  reports (186 under `NYSDOT` alone) and even templates (26 under `NYSDOT`) — genuinely
  cross-content-type organization, unlike region.
- **`type='user'` (344 rows) is overwhelmingly noise, not signal.** ~245 of the 344 are literally
  named `"My Stuff"` — an auto-created default container, one per user account — and together
  they hold 43,553 of the 49,215 total route-folder assignments (88%). This is personal dumping,
  not an applied taxonomy; most of it isn't worth mining.
- **Two recurring patterns did surface inside the user-folder noise**, worth carrying forward as
  tag categories even though the folders themselves are throwaway: (a) **county-name
  subfolders** — e.g. a `CMAQ` folder with 19 direct children each named for a NY county
  (Albany, Chautauqua, Dutchess, Erie1/Erie2, Genesee, Greene, Jefferson, Livingston, Monroe1/
  Monroe2, Montgomery, Niagara, Onondaga, Ontario, Orleans, Rensselaer, Saratoga, Schenectady,
  Schoharie, Wayne); (b) **project/PIN-number root folders** — e.g. `"980689 -
  ProjectInfo_forBatchReport_20240613"`, `"X02505 - ProjectInfo_forBatchReport_20240613"`,
  `"PIN3"` — routes/reports organized by a specific DOT project identifier.
- **Route *names* (not folders) turned out to be the real generation-provenance signal.** Of all
  49,218 routes: only **2,962 (6%)** match a clean auto-generated corridor pattern —
  `{road name} {5-digit county FIPS} {N/S/E/W}`, e.g. `"NY-32 36001 S"` — and every single one of
  them was created by the same account (`created_by=1`), and is exactly the set filed under the
  Region folders above. This is the real, DB-grounded version of the original illustrative
  `auto_generated`/`tmc_linear`/`county:{fips}` scheme. The other **38,412 routes (78% of the
  entire table)** were created by one *different* account (`created_by=652`) with heterogeneous,
  machine-looking names — TMC-code+timestamp (`N11678IX5M11072N_20250415_004804`, ~14,666 of
  them), asset-id_project-id_name (`5500150_4538_MILL ROAD-CO RD82`, ~6,024), bare numbers
  (`"161"`, `"339"`, ~4,997), and more — reading like an automated per-incident/per-event
  ingestion feed, not anything a human organized. The remaining ~7,800 or so are genuinely
  human-typed one-offs (e.g. `"I90 NB Buffalo Incident Long Route"`,
  `"787 traffic study area"`).

**Generation mechanism found, 2026-08-03 — the old tool's corridor-route generator.** Not part of
avail-falcor's live API (no route/endpoint does this on demand) — it's a one-off batch script,
`/home/ryan/code/avail-falcor/tasks/folders/create_and_load_corridors.py` (sibling repo, last run
per its own git history Jan 2023). Exact methodology:

1. Source table: `tmc_metadata_2022` in the old NPMRDS production DB (`dbq.py old` — NYSDOT's own
   enrichment of FHWA TMC identification, columns include `roadname`, `county_code`, `region_code`,
   `road_order`, `tmclinear`; confirmed still present and matching the script's query verbatim).
2. Per NYSDOT region (1–11): `SELECT DISTINCT tmclinear, roadname, county_code, direction,
   road_order, tmc FROM tmc_metadata_2022 WHERE region_code = %s AND tmclinear IS NOT NULL AND
   roadname IS NOT NULL`.
3. Group rows by composite key `tmclinear|roadname|county_code|direction` — i.e. one route per
   (linear-corridor id, road name, county, direction-of-travel) combination.
4. Within each group, sort member TMCs by `road_order` and use that order as the route's
   `tmc_array`.
5. Insert one `admin2.routes` row per group: `name = "{roadname} {county_code} {direction}"` (e.g.
   `"NY-32 36001 S"` — exactly the 2,962-route pattern found above), `description =
   "Auto-generated route from TMC Linear: {tmclinear}"`, `created_by` = the `availabs@gmail.com`
   account (id=1 — matches the `created_by=1` finding above exactly).
6. Create one `admin2.folders` row per region (`type='AVAIL'`, description "Collection of
   auto-generated routes created using TMC Linears from 2022") and file that region's routes into
   it via `admin2.stuff_in_folders`. This is the origin of the 11 `AVAIL`-type region folders found
   above.

**Confirmed the old generator only ever ran once, 2022 data only (2026-08-03).** The script hardcodes
`tmc_metadata_2022` and was only ever edited in Nov 2022/Jan 2023 (git history) — never touched again
for a later year. DB timestamps confirm a single generation event: all 2,983 auto-generated routes
were created on `2023-03-01` (2,970 of them) with a tiny `2023-08-15` follow-up batch (13 more,
likely a rerun/patch for stragglers) — there is no evidence it was ever run for 2016/2017/.../2021/2023+.

**Porting vs. regenerating — regenerating per-year is not just feasible, it's close to a drop-in
replacement (checked 2026-08-03 against `src/dms/documentation/npmrds-data-sources.md`).**
`tmc_metadata_2022`'s Postgres schema (roadname/county_code/region_code/road_order/tmclinear
together) doesn't exist as-is in the current stack, BUT the already-registered ClickHouse DAMA
source **582/983 (`clickhouse.npmrds_meta.s582_v983_NPMRDS_V6_tmc_meta`, aka `META_JOIN` — see the
data-sources doc's measure-swap table)** carries the exact same enrichment columns
(`tmclinear`, `road_order`, `county_code`, `region_code`, `direction`) **plus a `year` column** —
one row per (tmc, year), confirmed live for 2016, 2018–2026 (no 2017 row, a known pre-existing gap
in this source). Verified by running the old script's actual query against it (just `roadname` →
`road`, `WHERE year = %s` added, Postgres → ClickHouse dialect): clean 0-blank `region_code`/
`county_code` for 2020–2023, some blank rows in 2016–2019 and 2024–2026 (191–529 rows, small
fraction of ~20–50k), `road_order` never null in any year. **Net: the new per-year generator script
is close to a line-for-line port of `create_and_load_corridors.py`'s query, run once per year
2016/2018–2026 instead of once against a frozen 2022 snapshot** — the real new work is where to
insert the output (there's no `admin2.routes`/`admin2.folders` equivalent in the new system; routes
now live as DMS dataset rows per the routecreation tool's `routes_data` convention above) and
deciding the `auto_generated`/`tmc_linear`/`county`/`region`/`year` tag values at insert time rather
than raw SQL folders.

**Sanity check: reproduced the real 2022 run almost exactly (2026-08-03).** Ran the old script's
grouping logic verbatim against 582/983 `WHERE year=2022`, all 11 regions, no changes to the
algorithm. Per-region corridor-group counts vs. the old DB's actual 2022 output (`admin2.folders`
type=`AVAIL`, joined through `stuff_in_folders`):

| region | new (582/983, 2022) | old (real DB) |
|---|---|---|
| 1 | 268 | 265 |
| 2 | 134 | 132 |
| 3 | 171 | 161 |
| 4 | 170 | 168 |
| 5 | 451 | 440 |
| 6 | 50 | 50 |
| 7 | 105 | 105 |
| 8 | 379 | 367 |
| 9 | 104 | 98 |
| 10 | 264 | 251 |
| 11 | 1001 | 936 |
| **total** | **3097** | **~2973** |

Same shape everywhere (region 11/NYC dominant in both, region 6 smallest in both), two regions
exact, the rest within ~4-7%. The small consistent overcount is expected network-vintage drift
(the old script hit a bare `tmc_metadata_2022` table that itself got silently refreshed over time —
confirmed **62 different versioned snapshots** of `tmc_metadata_2022_v...` exist in the old DB,
Nov 2022 through mid-2024 — not a methodology bug.

**Legacy migration confirmed incomplete AND duplicated (2026-08-03) — Ryan's recollection was a
manual DB-dump-and-upload of "all" old routes; the real data doesn't match that.** Checked directly
against the real storage table (`dms_npmrdsv5.data_items__s2107426_v2107427_routes_data`, Postgres):
old `admin2.routes` has 49,218 rows; the new dataset has 64,803 total, of which 64,762 carry a
legacy `route_id` field (41 are genuinely new, map-tool-created rows with no legacy id) — but those
64,762 resolve to only **32,568 distinct old route_ids**. Breakdown: 32,194 old routes got inserted
**twice** (spot-checked — byte-identical `name`+`tmc_array` pairs under two different new ids, i.e.
the same upload batch ran twice, not a fix-and-rerun), 374 came over exactly once, and **16,650 of
the old 49,218 (34%) never made it over at all**. No tags/folders came with it either way (expected
— this dataset has no tags column, confirmed earlier from `route_build.py`'s 7-key row shape).
Not fixed, not being fixed as part of this — a separate dedupe-and-backfill decision whenever
Ryan wants it; flagged here so this task doesn't quietly build on top of an assumed-clean migration.

**Real gap found in `route_build.py`'s existing TMC validator, worth knowing before reusing it
as-is (2026-08-03).** `route_build.py build` validates every TMC against
`npmrds_raw_tmc_identification.s455_v3464_NPMRDS_TMC_Identification_V5_V6` — a single frozen
vintage, not year-matched. Checked how many of a given year's 582/983 corridor TMCs that frozen
table actually contains: **2022 → 22,286/22,306 (99.9%)**, **2018 → 18,113/18,983 (95.4%)**. Recent
years are fine; for 2016-2019 a real (if modest) slice of historical TMCs would hard-error as
"does not exist" if fed through `route_build.py`'s validator unmodified — needs either a
year-matched validation source or an acceptance that some older-year corridors get dropped/flagged
rather than blocking the whole batch.

**Built and validated the 2024 pilot (2026-08-03).** `scripts/npmrds-reports/route_gen_corridors.py`
(new) generates the spec; `route_build.py` gained `--tmc-year` (validates against the correct
vintage of `582/983` instead of the frozen table) and a TMC-fetch batching fix (a single `IN (...)`
list for a full year's TMCs — tens of thousands — exceeds ClickHouse's 256 KiB `max_query_size`;
now batches in chunks of 4000). 2024 → 8,660 corridor routes, dry-run through the full validator:
zero hard errors, zero duplicate names, zero mixed-direction/multi-road issues.

**Known limitation, confirmed inherited from the old tool, NOT fixed — flagged for a future
decision (2026-08-03).** Grouping by `county_code` (both the old tool's key and this port's) means
a `tmclinear` that crosses a county line gets artificially truncated at the boundary, even when the
physical road is continuous — the corridor just stops, skips the other county's segments, and (if
the linear re-enters the original county further on) resumes with a large phantom gap. Confirmed
**byte-for-byte** against a real old-DB route: the 2024 pilot's `I-87 NORTHBOUND, ALBANY county`
corridor and the real old-DB route `id 6055` (`I-87 36001 N`, TMC Linear 209, created by the
original 2023 generator) have the **identical** TMC chain, same exact skip across the Greene/Albany
county line. Ryan's call (2026-08-03): **ship it matching the old tool's behavior for now** (a
county-scoped-agency use case genuinely wants "stop at the county line" as a feature, not a bug),
but revisit later — dropping `county_code` from the grouping key would give geometrically continuous
corridors at the cost of changing the naming/count shape from what's now the established baseline.
Not scheduled; just don't let this get silently forgotten if `route_gen_corridors.py` gets reused
for another year without revisiting it.

**Real bug found and fixed, 2026-08-03: county tag casing.** First live run tagged routes
`county:albany` (lowercase, derived from the source data's `county_name` column) — but
`tagCategories.js`'s `NY_COUNTIES` list (the UI's hardcoded county-folder taxonomy) is Title Case
(`county:Albany`), and the `array_contains` tag-match is case-sensitive with no normalization
anywhere in the path (confirmed by tracing `useTagBrowser.js` → `buildUdaConfig.js` →
`dms-server/src/routes/uda/utils.js`/`query_sets/helpers.js`) — so every county folder silently
matched zero of the new routes even though the tag was technically present. Caught live: Ryan
browsed County → Albany and saw only an old leftover test route. 813 routes had already been
created with the bad casing before the batch was killed; all 813 deleted (0 failures) and
regenerated. Fix: `route_gen_corridors.py` now maps the source `county_name` onto the exact
`NY_COUNTIES` list (case/punctuation-normalized comparison, e.g. "ST LAWRENCE" → "St. Lawrence"),
verified against all 62 real county values in the 2024 data with zero unmapped. **Lesson for reuse:
any future write path into `tags` must match `tagCategories.js`'s exact casing — there's no
tolerant matching to fall back on.**

**2024 pilot — DONE, verified clean, 2026-08-03.** Corrected batch re-run to completion:
**8,660 routes created, 0 errors.** Verified independently via direct SQL against the real storage
table (not just trusting the script's own log): dataset total 64,804 → 73,464 (exactly +8,660);
count of rows matching this batch's description = 8,660 (exact match); count still carrying the old
broken `county:albany` casing = 0; spot-checked 239 rows with the correct `county:Albany` tag.
Ryan live-confirmed region and `auto_generated` folders working from the start, and (after the
casing fix) is expected to re-check County → Albany. Two operational notes for reuse on other
years: (1) the first launch attempt used `nohup ... & disown`, which orphaned the real job from the
harness's own completion tracking — its "done" notification was for the wrapper script, not the
8,660-route job, which was still genuinely running when reported complete. Launch the real long
command directly under a tracked background invocation instead, no self-backgrounding wrapper.
(2) `route_build.py`'s TMC-fetch batching fix (4000/chunk, added this round) is required at this
volume — a single `IN (...)` list for a full year's TMCs exceeds ClickHouse's 256 KiB
`max_query_size`.

**Not yet done: the other 10 years (2016, 2018-2026 excluding 2024).** `route_gen_corridors.py`
and `route_build.py --tmc-year` are both generic over year already — running another year is
`route_gen_corridors.py <year> --out spec.json` + `route_build.py build spec.json --tmc-year <year>`,
no code changes expected. Also not yet done: any cleanup of the legacy migration's 16,650 missing /
32,194 duplicated routes (see "Legacy migration confirmed incomplete AND duplicated" above) — a
separate decision, not blocking further-year generation.

**Naming: year embedded in the name, not just the description.** Since each (corridor, year) is a
separate row by design, `route_gen_corridors.py` names routes `"{road} {county_code} {direction}
({year})"` (e.g. `"I-87 36001 NORTHBOUND (2024)"`) — otherwise every year's regeneration of the same
real-world corridor would collide on one ambiguous name in every search/picker. Open to revisiting
if Ryan wants a different convention once tags exist and can carry the year instead.

**Proposed starting tag categories, each grounded in one of the findings above** (not yet built —
this is the vocabulary proposal the taxonomy inspection was for; confirm with Ryan before wiring):

**Confirmed by Ryan, 2026-07-31: proceed with this taxonomy as proposed**, no changes — safe to
wire into `SaveRouteModal.jsx`'s tag autocomplete/suggestion list and the shared modal's
folder-derivation logic (see item 1/3's shared modal, now in progress).

1. **`county:{name}`** — the strongest, most complete geographic signal. Directly derivable from
   the route name for the clean corridor-generator pattern, and independently corroborated by the
   ad hoc `CMAQ`-style per-county user folders. Should be the primary geography tag.
2. **`region:{1-11}`** — NYSDOT's own fixed 11-value enum (the `AVAIL` folders, verbatim). Every NY
   county maps deterministically to exactly one region, so this could be a *derived* tag computed
   from `county:` rather than one an author assigns by hand — worth deciding at build time, not
   re-litigating here.
3. **`agency:{code}`** — the NYSDOT-division / MPO-partner axis from the `group` folders
   (`WLD`/`SDD`/`TDD`/`MDD`, `CDTC`/`GBNRTC`/`NYMTC`/`OCTC`/`SMTC`/`UCTC`/`PDCTC`/etc.) — a real
   organizational dimension, orthogonal to geography.
4. **`project:{pin}`** — ad hoc in the old system but a recurring, real pattern (routes tied to a
   specific DOT project/study number).
5. **`auto_generated`** (provenance flag, not a value-pair) — for routes produced by the new
   TMC-linear chain generator this arc still wants to build, mirroring the real
   `created_by=1`-vs-`created_by=652`-vs-human-typed distinction found above.

**Explicit non-goal, reconfirmed by this inspection:** no retroactive tag backfill onto the 49,218
legacy old-DB routes is implied here — this was vocabulary research to inform the *new* system's
tag categories, not a migration task. Consistent with the scope limiter already on record below
("don't over-invest in a lossless migration").

**Users can add their own tags too (2026-07-31 clarification).** Tags aren't only system-applied
(generation provenance, geography). Authors need to be able to add custom tags to routes as well —
needs its own UI (tag entry/management, likely on the route save/edit flow or a dedicated
manager), not just a fixed backend taxonomy.

**Technical grounding, checked 2026-07-31 — this is likely cheaper than it sounds.** Two things
looked into on Ryan's "something to look into" prompt:

- **Storage.** Routes made by the new (dms-template-native) routecreation tool are already DMS
  *dataset* rows — `INTERNAL_ROUTES_TYPE = 'routes_data'` in
  `src/themes/transportny/components/routecreation/constants.js`, stored as a split type
  (`{sourceType}|{viewId}:data`, `comp.jsx:174`). `SaveRouteModal.jsx` today only has **Name** and
  **Description** fields — no Folder field (consistent with the 2026-07-23 deferral), no tags
  field yet. So a `tags` field would be a genuinely new column on this dataset, not a repurpose of
  something existing.
- **Filtering.** DMS already has a generic, production-proven, fully-tested UDA filter operation
  for exactly this shape: `array_contains`/`array_not_contains`
  (`src/dms/planning/tasks/completed/uda-array-contains-filter.md`, DONE), built for `multiselect`
  JSON-array columns (real examples in production: `county: ["Greene"]`, `role: ["Planner",
  "Stakeholder"]`). Querying "routes tagged `county:36001`" is `WHERE data->'tags' @>
  '["county:36001"]'::jsonb` — already-supported SQL, no new query engineering. This means the
  "should tags be a generic DMS primitive or an NPMRDS-bespoke field" question mostly answers
  itself: give the routes dataset a `tags` column typed `multiselect`, and the existing generic
  filter machinery just works.

**Decided, 2026-07-31: tag editing lives in `SaveRouteModal.jsx`.** A Tags field goes in the same
place as today's Name/Description fields — no separate tag-management surface for now.

**Scope limiter (2026-07-31 clarification):** whether all old reports/routes/templates map cleanly
into the new tag system is TBD, and how much that's worth caring about is *also* TBD — per Ryan,
don't over-invest in a lossless migration; a partial/lossy mapping is fine to start with, revisit
if it turns out to matter.

Note this "auto-generate by following a continuous TMC-linear chain" mechanism is a **different**
thing from the marker-placement/auto-*routing* work tracked in `route-creation-tool.md` (which
resolves a road-network path between user-dropped map markers via the external
`routing2.availabs.org` service). This item is a batch, data-driven process over TMC network
metadata, not an interactive map-drawing feature.

**TMC linear/sequence field — Ryan recalls this already exists (2026-07-31), not yet independently
verified.** "Already on the table" — i.e. the TMC metadata is believed to already carry a
linear/sequence field the auto-generation can chain on directly, no new derivation logic needed.
Worth a quick confirm-against-the-actual-schema pass before building on it (likely
`TMC_IDENTIFICATION_JOIN` or similar, per `src/dms/documentation/npmrds-data-sources.md`'s
measure→source mapping), but not re-litigating the question itself.

**Standing ruling — confirmed superseded, 2026-07-31 (not just "doesn't conflict").** Memory
`project_reports_folders_discovery_permissions_out_of_scope` (2026-07-27) had put "folders,
discovery/browsing, and permissions" **permanently out of scope** for the reports/routes arc — DMS
natives would supply that later. I'd initially guessed today's ask was scoped narrowly enough not
to actually conflict with that ruling (system-applied route tags vs. the old ruling's report
discovery/manual-folder-field target). Ryan corrected this directly: it *was* a real, accurate
scope-out at the time, but "things change" and folders — as a user-facing organizing concept, still
backed by tags rather than the old data model — are now explicitly **back in scope** for route
organization, and porting similar functionality from the old tool is wanted. Ryan confirmed asking
was the right call rather than assuming either way (see memory
`feedback_flag_standing_decision_reversals`). The memory has been amended to reflect this.

**Confirmed, 2026-07-31:** the reversal covers route organization/tagging specifically (this item)
only. Report discovery/index page work and the permissions/ACL model remain out of scope — that
part of the original ruling still stands.

**Implementation Plan — Phase 1: manual tag storage + editing UI — DONE, live-verified
2026-07-31.** Scope: get `tags` working end-to-end for manual/custom tagging on the existing
routecreation tool — schema, save/load wiring, and an editing UI. Does **not** include the shared
tag-folder-browsing modal (item 1/3's UI, consumes this later), the old-DB folder-taxonomy
inspection, or TMC-linear auto-generation — those stay separately scheduled (see "Open questions").

**Verification (2026-07-31):** live-tested against `converted_reports/route_creation_demo`
(subdomain `npmrds`, `http://npmrds.localhost:5173/converted_reports/route_creation_demo`).
Created a route (TMC `104N04120`) with tags `test_tag_one` + `county:albany` via the new Tags
chip field → saved → confirmed via `dms dataset query "Routes Data" --view 2107427 --filter
id=<new-id>` that `data.tags` is a real JSON array string, `["test_tag_one","county:albany"]`,
stored exactly like `tmc_array`. Reloaded the page fresh at `?route_id=<new-id>` → both tags
round-tripped correctly into the "Update Route" modal as removable chips. Separately loaded a
pre-existing route with no `tags` data at all (id 2122037) → no crash, Tags field renders empty,
confirming `curRouteFromApi[TAGS_COL] ? JSON.parse(...) : []` handles the missing-field case. One
leftover test row exists in the live dataset from this pass (route "Claude Tags Test Route",
id in the 2198xxx range) — harmless scratch data, not cleaned up (per the dataset being disposable
dev data), safe to delete opportunistically.

1. **Add a `tags` column to the `routes_data` dataset — on the SOURCE row, not the view.**
   Column-type config for DMS's generic multiselect/`array_contains` filtering lives on the
   source row's `data.config` (a JSON-*encoded string*) → `.attributes[]`, keyed by `name`.
   Confirmed via `buildUdaConfig.js`'s `columnsWithSettingsByName` merge chain
   (`src/dms/packages/dms/src/patterns/page/components/sections/components/dataWrapper/buildUdaConfig.js`,
   `buildColumnsWithSettings` ~line 765, merge ~lines 1326-1328) and `useDataSource.js`'s
   `getSources()` (`attr === "config"` case, ~lines 64-69: `columns = JSON.parse(source.config).attributes`).
   Target row: source id `2107426` (type `datasets_env|routes_data:source`, app `npmrdsv5`).
   Current `config.attributes` has 11 entries, **all `type: "text"`** (route_id, name,
   description, tmc_array, points, conflation_array, conflation_version, created_by, created_at,
   updated_at, metadata) — confirmed live via `dms raw get 2107426`, 2026-07-31. No column in this
   app has ever used `multiselect` (checked all 15 internal-table sources in `npmrdsv5`/`dev2` —
   `text`/`textarea`/`number`/`integer`/`date`/`select` only), so there's no live example to copy;
   template comes from `RenderField.jsx`'s `fieldTypes` list (`multiselect` = "dropdown (multiple
   choice)") and `buildUdaConfig.test.js`'s fixtures (`{name, type: "multiselect"}`) instead. New
   attribute entry to append:
   ```json
   {"name": "tags", "display_name": "tags", "options": null, "type": "multiselect", "required": false}
   ```
   `options: null` is fine for free-form tag entry (no fixed vocabulary yet); the array-contains
   filter engine only checks `col.type === "multiselect"`, it doesn't require `options` populated.
   **Mechanics — full `data` replace, not a dotted `--set`.** `config` is itself a JSON-encoded
   string; per `feedback_dms_raw_update_set_json_string_footgun`, a dotted `--set
   config.attributes=...` would corrupt it by re-nesting into `{"attributes": [...]}` and dropping
   sibling keys. Instead: fetch the row, `JSON.parse(data.config)`, append the new attribute
   object, `JSON.stringify` the whole thing back, then do a full `--data` replace of the row's
   entire `data` object (preserving `is_dirty` etc.) — same pattern as `convert_old_reports.py`'s
   `dms()` helper. Purely additive: every existing column and row is untouched, so this can't
   affect anything currently reading `routes_data` (e.g. the routes behind the shipped NY-9D
   Beacon report).

2. **Wire the routecreation tool itself to read/write `tags`.** `comp.jsx` bypasses
   `buildUdaConfig` entirely for this dataset — it reads/writes via ad-hoc raw `data->>'col' as
   col` SQL — so step 1 alone won't make the tool show or save tags; needs explicit wiring, same
   pattern as the existing fields:
   - `INITIAL_MODAL_STATE` (`comp.jsx` ~line 30-35): add `tags: []`.
   - `addItem` (~line 153-170): add `tags: JSON.stringify(modalState.tags || [])` to `payload` —
     same explicit-stringify treatment as `tmc_array`, unlike `name`/`description` which are
     plain strings.
   - Load effect (~line 206-236): add `const TAGS_COL = "data->>'tags' as tags"` to the falcor
     get's column list; `JSON.parse(curRouteFromApi[TAGS_COL] || "[]")` into `modalState.tags`
     alongside `name`/`description`.

3. **Tags field in `SaveRouteModal.jsx`.** Per the 2026-07-31 decision, goes alongside
   Name/Description, no separate tag-manager surface. No fixed taxonomy exists yet (old-DB
   inspection not done), so this is a free-form multi-tag chip input, not a `<select multiple>`:
   type text, Enter/comma commits a tag as a removable chip, reports the full array back via
   `setRouteMeta({ tags: [...] })`. New small component alongside the existing `ModalInputField`
   in the same file, following its controlled-input/`path`/`onChange` pattern.

4. **Live-verify.** Create a route via the routecreation tool, add 2+ tags, save; confirm via
   `dms raw get` that `data->>'tags'` is a real JSON array on the new row. Re-open that route for
   editing; confirm tags round-trip into the modal. Confirm an existing pre-tags route still
   loads fine with an empty tags list (no crash on missing/null `tags`).

**Old-tool reference material already on file.** `research/route-creation/findings.md` documents
the old tool's folder system in real detail — folder types `user`/`group`/`AVAIL`, arbitrary nesting
via a `folders2 user tree` falcor call, metadata of name/type/owner/icon/color, Fuse.js search over
name+description only — and states plainly: **the old tool has no tagging system anywhere**
(checked `RouteSaveModal`, `FolderModal`, `StuffInfoModal`). So "tags instead of folders" is new
design work, not a port of something the old tool already had. The old UI is inspiration for the
*organizing effect* only, per Ryan's own framing.

**Continuity note.** A "folder field in save/move" for routes was already flagged and deliberately
deferred once before, 2026-07-23 (`research/route-creation/findings.md` Part 4, also noted in
`route-creation-tool.md`'s "Open items"). This item is that deferred thread, picked back up, now
shaped as tags instead of folders.

---

## 3. Dynamic Reports

**Core idea.** A new report-template kind, using the existing generic Page Templates system
(`src/dms/planning/tasks/current/page-templates.md`, Phases 1-5 already coded) as a starting point
— but with a behavior Page Templates doesn't currently have: routes aren't permanently assigned to
the page. Instead the template defines N "route slots," filled **at view time** via a URL param
(e.g. `?routes=123456`), the same way the old tool's page templates worked.

**Architecture confirmed, 2026-07-31: one shared page per template, not one row per use.** A
Dynamic Report template is a single DMS page that gets reused/shared across every use — e.g. one
"Single Route Year by Year Beginner Template" page exists, ever, and everyone reaches it with a
different `?routes=` value. Nobody "creates" a Dynamic Report the way they create a normal report
today; they just navigate to an existing template page. Follow-on implications, not yet resolved:

- **Editing the template's own structure** (which graphs/panels it has) now touches a page that's
  live for whoever else is viewing it at the time. DMS's existing draft-vs-published page model
  (`draft_sections` vs. published `sections`, per `page-templates.md`) likely already covers this,
  but it's worth confirming explicitly rather than assuming — a shared page is a different
  edit-safety situation than a normal report page nobody else is looking at.
- **How many template pages actually get created?** This item's "Old-template porting" decision
  below says port the old tool's 216 templates as content — does that mean up to 216 actual Dynamic
  Report pages, or a curated subset? The 2026-07-27 investigation this doc already cites found real
  structure here worth reusing for that decision: only 43% coverage in the top 20 shapes by
  whole-template signature, but panels are highly concentrated (top 12 panel kinds cover 49% of
  usage) — so "which ones get ported" may want to follow panel frequency rather than porting all
  216 uniformly.

**Terminology flag.** "Slot" is already used elsewhere in this same arc for a different concept —
`report-page-template-editorial-slots.md` uses "slot" for editorial/content placeholders (a hero
stat callout, etc.), unrelated to routes. Worth deliberately saying "route slot" throughout and
never bare "slot," so the two don't get conflated in future docs/conversation.

**No-URL-param behavior.** Navigating to a Dynamic Report without the URL param should pop a modal
letting the user pick routes by browsing the tag-derived "folders" from item 2, capped/required to
exactly the number of route slots the template needs. Ryan's reference point: this is how the old
public landing page (`npmrds.transportny.org`) worked, and it's the model for how his coworker's
new landing page (in progress, separately, out of scope here) will eventually link into these
reports.

**Likely existing mechanism to build on, not invent.** DMS already has an established architecture
for exactly "a URL param drives page behavior": the page-variable system described in the
`creating-interactive-pages.md` skill and `src/dms/planning/tasks/current/derived-page-variable.md`.
The rule there: **the page is the single owner of URL params; any URL param is a page variable;
components connect to it through the existing filters/actions system, never by reading the URL
directly.** "Route slots filled via URL param" is very likely a new consumer of that existing
system, not new URL-parsing plumbing — worth reading those two docs before designing this, not
after.

**Old-tool mechanism this is closest to (already investigated).** The old tool's `admin2.templates`
table already models almost exactly this: a `routes` column that's a **slot count (1-9, mode 1)**,
plus `route_comps`/`graph_comps` referencing `comp-N` placeholders resolved against whichever real
route IDs get supplied at use time. The old folder browser's bulk "Open in Template" action only
enables when the number of selected routes exactly matches a template's slot count — i.e. exactly
the cap/require behavior Ryan described for the picker modal. Full investigation:
`planning/transportny/tasks/current/client-request-to-report-skill-archive.md` (~lines 20-90).

**Old-template porting — confirmed superseded, 2026-07-31 (not a mechanism-vs-content split).**
Ryan flagged this tension himself: "may be in conflict with earlier guidance I gave you." The
earlier guidance (2026-07-27 investigation, `client-request-to-report-skill-archive.md` ~lines
20-90) concluded **do not port the old tool's 216 `admin2.templates` rows as our report-template
library** — they don't cluster into reusable archetypes (top 20 shapes cover only 43% of
templates), and the better model is a composition rule over a panel vocabulary parameterized by
route-slot count. Related: memory `feedback_template_catalog_end_goal` (vocabulary breadth over
numeric/content fidelity, same spirit).

My first guess was that today's ask only wanted the *mechanism* (route-slot count, URL-param fill),
not the template *content*, and so didn't really conflict with the 2026-07-27 finding. Ryan
corrected this, same pattern as the folders ruling above: that decision was right *at the time*
("it was easier to consider them out of scope"), but now the old templates should actually be
**ported into the new system as content**, not just referenced for their mechanism — while
**keeping the dynamic (route-slot/URL-param) behavior intact**, i.e. a ported template must not
collapse into a statically-route-bound report. So: port the old templates for real, into the new
Dynamic Report system, dynamic behavior preserved. See memory
`feedback_flag_standing_decision_reversals` for the general pattern (this is the second instance of
the same correction in the same conversation).

**Dynamic naming.** The old tool's dynamic reports have names with bracket placeholders (e.g.
`{type}`) filled in dynamically in various places. Needs its own pass once implementation starts —
not scoped further here.

**Out of scope here:** the landing page itself — that's the coworker's design work, applied later.
Dynamic Reports just needs to end up linkable-into from wherever that lands.

**Old-template porting — scoping pass, 2026-08-03 (candidate selection only, nothing built).**
Ryan's steer: don't port all 216, use the existing `convert_old_reports.py` pipeline (per
`old-reports-conversion.md`'s 2026-07-13 strategic frame, which explicitly deferred converting
`admin2.templates` the same way it converts `admin2.reports` until "full-template conversion
becomes relevant (authoring UI era)" — arguably now), and **pick the most-used templates**, the
same way only a curated subset of the 869 old reports (36 so far) has been converted, not all of
them.

**"Most used" resolved via real usage signal, not statistics.** `admin2.templates` carries no
usage-count column, and no `admin2.reports` row links back to the template it was created from —
so adoption can't be counted directly. But `admin2.stuff_in_folders`/`admin2.folders` (the same
tables item 2's tag-taxonomy inspection queried for routes) has a `stuff_type='template'` axis:
207/216 templates (96%) are filed somewhere, and — same noise pattern item 2 found for routes —
133 of those are under personal `type='user'` "My Stuff" folders (not signal). The other **74 are
filed under real `type='group'` (shared agency-account) folders** — someone besides the creator,
or the creator acting deliberately rather than just saving, chose to keep it somewhere shared.
Queried 2026-08-03 (`dbq.py old`):

| folder (owner) | n templates | character |
|---|---|---|
| AVAIL (the vendor's own account) | 24 | a deliberate, maintained Beginner/Intermediate/Advanced starter series |
| NYSDOT | 26 | real agency operational templates, mixed with some one-off/incident-named saves |
| MHV | 13 | almost entirely test-named noise ("Bar Graph tests", "Route Bar Graph tests…") |
| OCTC/CDTC/MDD/TDD/WLD/SDD/123/NPMRDS New Users | 11 total | 1-3 each, mixed |

No `type='AVAIL'` (NYSDOT region) folder holds any templates at all — unlike routes/reports,
templates were never organized by geography, only by account/agency.

**Recommended candidate set — the AVAIL series + real NYSDOT operational templates, deduped.**
Within both groups, several names recur as near-identical iterations (same-day "v1"/"v2"/"vT1"
saves, or explicit test/QA saves) — picked one canonical row per name-family, favoring the version
with the longest post-creation edit history (a real `updated_at` well after `created_at` signals
active refinement, not a one-off save) or the most complete `graph_comps` panel count:

- **AVAIL series (17, deduped from 24):** Single Route Default (`id 77`), Single Route Before and
  After (Beginner) (`221` — edited as recently as 2026-05-11, still actively maintained), Year Over
  Year (Beginner) (`244`), Monthly Congestion (Beginner) (`207`), Monthly Hours of Delay Comparisons
  (Beginner) (`260`), Seasonality Report (Intermediate) (`247`), This Month vs. Last Month vs. Last
  Year (Advanced) (`239`), Change Over Time Analysis - Month (`238`, the "v1" iteration), Single Day
  (`252`), Single Day Incident (Advanced) (`245`), Two Route Comparison or Bi-Directional Route
  Comparison (`211`), Bi-Directional Route Analysis (Intermediate)-V2 (`228`), Weekly Averages
  (`265`), Recurrent/Non-Recurrent Congestion Inspection Template (`210`), Project 5 Report - Erie
  Blvd/Empire State Trail Template (`165`), Project Review Report Template 5 - State Fair (`164`).
  **Excluded outright:** `256`/`257`/`258`/`259` ("Snapshot v2 (Test Save)" / "(Testing Save As)" /
  "(Beginner) (Testing Saves)" ×2) — a QA session's saves, all created within 35 minutes of each
  other 2023-03-08, not real content.
- **NYSDOT operational (11, deduped from 26):** Bottleneck Examples (`204`, 6 route slots), Freight
  Bottlenecks (`110`), TSMO CMAQ Lane Closures (`131`, the 2-slot/11-panel final iteration),
  COVID Comparison (`90`), Experiential Travel Time (`132`), Floating Car - Average Day (`278`),
  Floating Car - Week (`276`), Incident Analysis (`291`), Batch Report - Two Route x Two Times
  (`279`), Two Deployment Template (`283`), Two Routes x Two Dates (V2) (`281`). **Excluded**:
  incident/corridor-specific one-offs that read as reports mistakenly saved into the templates
  table rather than genuine reusable shapes (`I-687 SB Bottleneck`, `I-87 Northbound, April 11, 2019
  Sign Comparison`, `K Bridge Comparison`, `NYC 5th Ave_New Report_MI`, `NYC Outage Congestion mtg
  Version`, `LIE EB Francis Lewis…`, `Van Wyck CO2 Test`) and internal-division admin saves
  (`SDD`/`WLD`/`TDD Template`).
- **One folded-in special case: `Rochester Inner Loop` (`id 246`, NYSDOT, 3 slots) is not its own
  archetype** — its `description` is a verbatim copy of the "Snapshot" report description ("The
  Snapshot report compares an average day for a year against weekday and monthly averages…"),
  i.e. it's a real client instance of the **Snapshot (Beginner)** archetype the *other*
  investigation (`client-request-to-report-skill-archive.md`) already found independently via
  reused report-description text (15 reports, before that count was partly walked back as
  QA-duplication). Cross-checked: **no clean "Snapshot (Beginner)" template row exists at all** —
  every row actually named that is one of the excluded 2023-03-08 test saves above. So this
  archetype is real (two independent signals now point at it) but has no ready-to-convert template
  row; it would need to be seeded from a real report instead (e.g. `246` itself, or one of the 15
  description-sharing reports) rather than from `admin2.templates` directly. Flagged, not resolved.

**TEMPLATE_SPECS coverage cross-check — DONE, 2026-08-03.** Reused `census_old_reports.py`'s real
`analyze_report()` (imported, not reimplemented) against the 28 candidates' actual
`route_comps`/`graph_comps` — same function the corpus census runs over the 869 `admin2.reports`
rows, just pointed at `admin2.templates` rows instead. Read-only, no writes. Script:
`/home/ryan/.claude/jobs/57a760cb/tmp/template_coverage_check.py` (job scratch dir — copy out if
this needs to survive past this session).

- **4 of 28 fully mapped today, zero new work**: `238` (Change Over Time Analysis - Month v1),
  `244` (Year Over Year (Beginner)), `265` (Weekly Averages), `278` (Floating Car - Average Day).
- **1 more needs only cheap, proven-shape spec additions**: `90` (COVID Comparison).
- **23 of 28 hit at least one "no_equivalent"/"tail" gap** — sounds worse than it is: it's
  overwhelmingly **one concentrated root cause**, not 23 separate problems. Per-candidate real-gap
  graph types: `Route Info Box` in 14/23, `TMC Info Box` in 7/23, `Route Map` in 6/23 (two rare
  one-offs: `Traffic Volume Graph`/`vmt` and a literal `Experiential Travel Time` old graph type,
  1/23 each, tail/never-examined).
- **Root-caused, not just observed:** checked template `207`'s actual comp settings directly.
  `Route Info Box`'s "speed" measure is a genuine, real gap — the 5 built Info Box buckets
  (reliability/travelTime/length/AADT/delay, per `old-reports-conversion-archive.md`'s round
  19/38/40/49/58 history) never included plain `speed` as its own bucket. But `Route Map`'s "speed"
  gap is **not** a missing-shape gap — Route Map's speed choropleth was fully built in rounds 47-50
  (confirmed earlier in this same file). It's failing here because `graph_max_year()` requires an
  8-digit `YYYYMMDD` in a comp's `startDate`/`endDate`, and template `207`'s actual settings carry
  **`"startDate": "{recent-0}0101"`** — a relative-date placeholder meant to resolve to "this year"
  at use time, never taught to the old-reports converter (which only ever saw concrete dates on
  real `admin2.reports` rows). This is the same class of dynamism this doc's own "Dynamic naming"
  note already flagged for report *titles* (`{type}` placeholders) — turns out it applies to
  *dates* too, and is a distinct, real, currently-unhandled gap, not a template-vocabulary gap.

**A bigger structural finding that changes the mechanism design: most candidates have no real route
data to convert at all.** Checked every candidate's `route_comps[].routeId` values directly:

| routeId shape | candidates | which |
|---|---|---|
| real numeric (resolves in `admin2.routes`) | **4** | `221`, `244`, `246`, `278` |
| `$0`/`$1`/… placeholder (never a real route) | **23** | everything else |
| `synthetic:<tmc-key>` (point-drawn, never saved) | **1** | `291` (Incident Analysis) |

So only 4 of the 28 candidates are actually "ordinary report shells with real example routes" (the
`old-reports-conversion.md` durable-facts framing that motivated reusing the converter pipeline
literally) — the other 24 are **already parametric** in the old system, using `$N` as a route-slot
placeholder the exact same way `graph_comps[].activeRouteComponents` already uses `comp-N` to
reference them. Running the existing `convert_report()` pipeline against a `$N`-placeholder
template would correctly detect `no_valid_routes` and refuse to build a page (`fetch_old_routes`
would resolve nothing) — same as the 213 already-documented unproducible `admin2.reports` shells.
**This means "convert via the pipeline, then flip to dynamic" is only viable for 4 of the 28
candidates; the other 24 need a different, direct-to-dynamic authoring path.** Good news buried in
this: `activeRouteComponents`'s `comp-N` referencing is **independent of whether the underlying
`routeId` is `$0` or a real number** — the graph→route linkage is by `compId`, not by the route
value — so the comp-N ↔ route-slot-N mapping this arc's Dynamic Reports mechanism already uses
carries over cleanly to both groups with no special-casing needed.

**Unified mechanism design — REVISED 2026-08-03 per Ryan's steer.** Ryan's call, reading the two-path
split above: treat every candidate uniformly as graph_comps-only, ignoring whether it happens to
carry a real routeId — since every candidate ends up as a route-slot page regardless, building a
real converted page first (Path A) only to immediately strip its routes back out was doing work
that gets thrown away. Confirmed this holds: `analyze_report()`'s classification (the coverage
cross-check above) is driven entirely by comp **settings** (dates/resolution/dataColumn), not by
whether `routeId` is real — so collapsing to one path changes nothing about the coverage numbers
above, only the build mechanism.

**A better technical vehicle than originally drafted, found while designing this.** The first draft
of this section proposed reusing this arc's own JS `composeMeasureConfig`/`applyMeasurePickToState`
(built today for the Add-Graph modal). Checked that against what candidates actually need before
committing: `composeMeasureConfig.js` only covers Measure Picker's 4-control vocabulary — plain/
difference Bar/Line graphs — and can't build Route Map, Route/TMC Info Box, Bar Graph Summary, or
TMC Difference Grid at all. Fourteen of the 23 "real-gap" candidates need Route Info Box; most
candidates' *mapped* panels also lean on Map/Info Box/Bar Graph Summary. So the JS path was too
narrow. `convert_old_reports.py` already has the right function:
**`build_graph_section_data(page_id, tmpl, tracking_id, info, gaps, old_graph, ...)`** (line 4365) —
the same function `convert_report()` already calls for every real report's graph, covering every
graph type this pipeline knows. Read its body: it clones the shared graph-template row's
`stateJson` (already minted by `ensure_graph_templates()` from `TEMPLATE_SPECS`, independent of any
specific report) and patches in report-level cosmetics — `color_range`, `description`, layout
`size`, AADT override, Route Map choropleth baking — **never touching real per-route `tmc_array`/
date data**. It's already separable from route resolution; nothing needs extracting or reimplementing
the way the JS side would have.

**Unified build steps, all 28 candidates, no path split:**
1. New `fetch_old_template(id)` (mirrors `fetch_old_report()`, reads `admin2.templates` — identical
   row shape plus the `routes` slot-count field).
2. Run the existing classification (`analyze_graph()` per `graph_comp`) — already proven by the
   coverage cross-check above, zero new code.
3. For each **mapped** graph_comp: `ensure_graph_templates()` + `build_graph_section_data()` —
   the exact same two calls `convert_report()` already makes for real reports, completely
   unmodified.
4. Instead of resolving real per-route `comparisonSeries` data (meaningless for `$N`/synthetic
   placeholders), create the page with **N route slots** (today's built Dynamic Report mechanism)
   and wire each slot's `graphIds` per that graph's `activeRouteComponents` (`comp-N`) → slot-N —
   the same `comp-N` convention RRL's `route_comp_id` already uses, confirmed independent of
   whether the underlying `routeId` was real or a placeholder.
5. Toggle "Dynamic Report" on (the `routeSlots` page-filter built earlier today).

**Verification, using the 4 real-routeId candidates as fixtures, not a separate path.** `221`/`244`/
`246`/`278` each already reference one real, resolvable route — after building all 28 uniformly via
the steps above, those 4 specifically get a free, ready-made `?routes=<real id>` test value, so
they're the cheapest to verify with actual rendered data first (and `244` is also already 100%
TEMPLATE_SPECS-mapped — the natural first candidate to build end-to-end as proof). The other 24
verify structurally (panel count/types/slot count match the old template) plus one live smoke-test
per candidate against any real catalog route. This also fully retires the earlier draft's Path-A
`graphIds`-preservation problem — no concrete-route page is ever created, so there's nothing to
remove or preserve.

**Relative dates (`{recent-N}`) — explicitly deferred by Ryan, 2026-08-03: "will need to be done
eventually, but not right now."** For this pass, every route slot gets one fixed, author-set date
range (today's real, already-built capability) — no attempt to resolve `{recent-0}`/`{recent-1}`-
style placeholders. Not an open question anymore; a deliberate scope cut, revisit later.

**Not yet done:** final candidate-list confirmation from Ryan (the 28 above are a proposal, not a
commitment), the actual `--from-template` CLI mode + slot/graphIds wiring code, and any real
pages — this whole section is scoping only, per the standing "show plan, get confirmation before
large implementation" rule.

**Template 244 built + live-verified, 2026-08-03.** Ryan's call: build 244 for real now (not the
whole 28-candidate list yet). New `--template-id` CLI mode in `convert_old_reports.py`:
`fetch_old_template()`, `find_page_by_old_template_id()`, `build_slot_entry()` (route-slot twin of
`build_route_entry()`, see its docstring for the `route_slot_group` grouping mechanism), and
`convert_template()` — a deliberately **duplicated**, not refactored, copy of `convert_report()`'s
analysis/section-building body (convert_report() is a single proven ~550-line function backing 36
real conversions; forking it mid-body risked destabilizing it for a one-time curated port — accepted
drift is the cost of that call). Route Map and Route Difference Graph/TMC Difference Grid are
deliberately **not converted** (gap-logged, not built) — Route Map's per-report choropleth
color-break baking needs real per-TMC data pooled across the report's actual routes, which doesn't
exist for an unfilled slot; Difference-pair resolution needs real route facts (tmc_key equality)
this mode never fetches. Neither gap blocks 244 (it has 2 Route Map instances, correctly skipped;
0 Difference instances).

**JS side: extended (not forked) the already-shipped Dynamic Report resolution to support many
route-ROWS sharing one real route.** Template 244's `routes: 1` (one conceptual route) has **11
route_comps** — all referencing the same old routeId, each a different date-window VIEW of that one
route ("2024", "2023", … "2016", an avg-day rollup, a by-day rollup). The originally-shipped
`useDynamicReportRoutes.js` was strictly positional (`routeIds[i]` fills `slots[i]`) — wrong for
this shape, since it would ask a viewer for 11 different real routes instead of 1. Added
`route_slot_group` (a new optional field on each persisted route/slot row) +
`distinctRouteSlotGroups()`/`routeSlotGroupKey()` (exported from `useDynamicReportRoutes.js`, reused
by `ReportRouteList.jsx` so both sides agree on one grouping, not two driftable copies): slots
sharing a group resolve against the *same* URL-supplied real route; `requiredCount`/
`needsRouteSelection` key off the distinct-group count, not raw route-row count. **Backward
compatible by construction**: a slot with no `route_slot_group` falls back to grouping by its own
`route_comp_id` (always unique per slot), reproducing the original positional behavior byte-for-byte
for every Dynamic Report authored before this field existed (the `claude_scratch_dynamic_report_demo`
built earlier today is unaffected). `build_slot_entry()`'s `route_slot_group` value is simply the old
system's own `routeId` string (real, `$N`, or `synthetic:...`) — reused as a grouping key, not a new
concept ported from the old tool (the old tool's actual `route_comps[].type === 'group'` nested-route
feature is unrelated and still just flattened away, unchanged, exactly as before).

**Verification finding — the real routeId "free fixture" assumption from the earlier scoping pass
was wrong, caught by live-testing, not assumed.** `221`/`244`/`246`/`278`'s old routeId lives in
`admin2.routes` (the OLD system) — a completely different id space from the NEW `routes_data`
catalog `?routes=` resolves against. Confirmed live: old routeId `163181` (244's real route) doesn't
exist in the new catalog at all. Fixed by calling the existing `ensure_route_in_catalog()` (already
built for real-report conversion, just not part of `convert_template()`'s own mechanism) once,
by hand, to upsert that one real old route ("Rochester Inner Loop 2") into the new catalog —
producing new catalog id `2198772`, the actual valid `?routes=` test value. This is a one-time
verification step, not part of the ported page's mechanism; a future viewer of this page picks
*any* real catalog route via the picker, same as any other Dynamic Report.

**Full mechanism live-verified** on `converted_reports/year_over_year_beginner_0` (page id
`2198445`): no `?routes=` param → blocking picker correctly shows "Select 1 more (0/1)" (not 11,
confirming `distinctRouteSlotGroups` collapsed 11 rows to 1 required pick); searched "Rochester Inner
Loop 2" in the tag-browser modal, selected, confirmed → URL became `?routes=2198772` → all 11 RRL
rows resolved to the same real route ("Rochester Inner Loop 2") with real per-row date windows
intact; 17 of 19 converted panels render real data (TMC Info Box/Length, Route Compare Component/
Speed with real per-year deltas, Route Bar Graph/Travel Time for 2016-2022, Route Line Graph/Travel
Time, two By-Day rollup bar graphs) — confirmed visually via screenshot, not just network-response
counts. Zero console errors.

**Two things NOT wrong with the conversion, worth recording so they aren't re-investigated:**
- **`report_probe.mjs` reported "0/19 sections with svg content" — a false negative, not a real
  bug.** Its SVG-emptiness heuristic ran before this page's unusually large resolution-fetch chain
  (68 `/graph` API calls, this page's `--wait 4000` wasn't enough) finished painting; a manual
  browser screenshot moments later showed the same panels fully rendered with real data. Not
  chased further (the manual verification is conclusive) — flagged in case a future probe run
  against a Dynamic Report needs a longer `--wait`.
- **Some "Avg. Hours of Delay" panels (2020/2021/2022) render blank while the same measure for 2017
  renders real data, and "Travel Time" renders for every year including 2020-2022.** Looks like a
  genuine, real per-year AADT-data-coverage gap specific to this one test route/measure (not a
  Dynamic-Report- or conversion-specific bug — the exact same blank panel would very likely occur
  for a *normal*, non-dynamic converted report using this same real route) — consistent with the
  standing "data issues are out of scope" directive. Not investigated further.

**Verify URL:** `http://npmrds.localhost:5173/converted_reports/year_over_year_beginner_0` (no
param) → blocking picker, "Select 1 more (0/1)"; pick any real route (e.g. search "Rochester Inner
Loop 2") → confirms to `?routes=2198772`, 17/19 panels render real data across 11 date-range RRL
rows all bound to the one picked route. Edit at `.../edit/converted_reports/year_over_year_beginner_0`
to see the raw 11 slot placeholders and the "Dynamic Report" toggle.

**Not yet done:** the other 27 candidates (this pass built only 244, per Ryan's steer); any
generalization of the one-off `ensure_route_in_catalog()` verification step into the mechanism
itself (deliberately not needed — real viewers already have real catalog routes to pick from via the
normal picker).

**5 more candidates converted + live-verified, 2026-08-04 (Ryan's steer: "convert another 5, good
candidates").** Picked by actually running `convert_template(..., dry_run=True)` per candidate and
reading its real gap report — NOT by trusting the 2026-08-03 static `analyze_report()` coverage
table alone. That table's "fully mapped" class only checks graph-type/measure/resolution/dataColumn
coverage; it says nothing about whether the candidate's route_comps use concrete or relative
(`{recent-N}`) dates — a completely separate, per-route-comp check `convert_template()` only surfaces
at actual dry-run time.

- **Real finding: `278` (Floating Car - Average Day) turned out NOT clean despite scoring
  "fully mapped" (9/9) in the static table.** Its dry-run gap report showed **9 `relative_date`
  items** across route_comps I hadn't checked (my earlier manual per-candidate date spot-check only
  sampled a few route_comps, not all of them) — e.g. `"Day of Week - 2023..." startDate=>yearof`,
  `"2022 - Rochester Inner Loop 2" startDate=>year-2year->1year`. Relative dates are explicitly
  deferred (Ryan, 2026-08-03: "eventually, not right now"), so **278 was dropped from this round** —
  it needs the same deferred feature as `207`/`247`/`260` before it can convert cleanly. Re-picked a
  replacement instead of forcing it through with broken dates.
- **Final 5, each confirmed clean via actual dry-run** (not the static table): `238` (Change Over
  Time Analysis - Month v1, 0 gap items), `265` (Weekly Averages, 0 gap items), `90` (COVID
  Comparison, 1 cosmetic gap item), `221` (Single Route Before and After (Beginner), 1 graph
  skipped — Route Info Box, the known deferred gap — + 2 cosmetic gap items, real old routeId
  available as a bonus), `204` (Bottleneck Examples, 1 graph skipped — Route Info Box — + 2 cosmetic
  gap items, 6 route slots/no shared `route_slot_group` since its 6 slots are 6 different real
  bottleneck locations, not 6 views of one route).
- **Real, small platform addition made along the way: `90`'s one gap was genuinely cheap, as the
  2026-08-03 scoping predicted.** Its single unmapped combo was `("Route Line Graph", "speed",
  "5-minutes", "travel_time_truck")` — the truck-column speed expression (`SPEED_EXPR_TRUCK`) was
  already proven elsewhere (`route_diff_speed_5min_truck`'s truck-swap), just never wired for a
  plain (non-diff) Line Graph. Added one `TEMPLATE_SPECS` entry (`tmc_speed_line_graph_truck`,
  mirroring `tmc_speed_line_graph` with `SPEED_EXPR_TRUCK` swapped in) + the matching
  `GRAPH_TEMPLATE_MAP` key — `90` went from 5/6 to 6/6 mapped. **Explicitly NOT the Route Info Box
  "speed" bucket** (the 14/23-candidate concentrated gap) — that one is a real `no_equivalent`
  platform gap (a genuine new join/expression, same class as the LOTTR/TTTR reliability join), not a
  cheap spec addition, and doing it wasn't part of this ask — flagged as a separate, higher-leverage
  future task (see below), not attempted here.
- **Live-verified all 5** via `report_probe.mjs` (Chrome extension unavailable this session). Each:
  entry gate opens with the correct required-selection count (`90`'s 4 route_comps collapsed to
  "Select 1 more (0/1)" via `route_slot_group`, confirming that grouping mechanism generalizes past
  template 244; `204`'s 6 ungrouped slots correctly required 6 distinct picks). After confirming real
  catalog route(s): zero console errors, zero page errors, zero pending/hung requests across all 5
  once given enough settle time (see next finding), and real SVG-rendered data in most sections
  (`238`: 17/21 then 19/21 on repeat; `265`: 19/21; `90`: 5/6, including the **new truck-speed Line
  Graph section itself** rendering real data — the clearest proof the new template mint actually
  works, not just passes dry-run; `221`: 7/10 with 1 likely per-route data-coverage blank, same
  known "Avg Hours of Delay" non-bug pattern already documented earlier in this file; `204`: 1/4 with
  SVG, the other 3 being 2 Route Map instances (canvas, not SVG — known non-bug) + 1 likely
  data-coverage blank). Route Map sections correctly show no SVG in every candidate (expected,
  canvas-based, same non-bug already documented for 244).
- **New finding: heavier converted pages (lots of graphs, several Difference-Graph pairs) need a
  MUCH longer probe `--wait` than the default, or `report_probe.mjs` reports a false "hung/pending"
  state that isn't real.** `265` (Weekly Averages, 21 graphs including 7 day-of-week Route/TMC
  Difference Graph pairs) showed `pending-at-close: 22` and only 7/21 SVG at `--wait 6000` AND
  `--wait 12000` (identical request counts both times — genuinely still loading, not flaky) but
  fully settled (0 pending, 19/21 SVG) at `--wait 45000` — real network timestamps in the capture
  show its last `/graph` response landing past 75 seconds after navigation. Same class of finding as
  244's own "--wait 4000 wasn't enough, false 0/19" note, more extreme here — worth remembering
  before concluding a heavy Dynamic Report page is actually broken from a probe run alone.
- **Verify URLs** (no `?routes=` param → blocking picker; example real-route URLs shown are just one
  of many valid catalog picks):
  - `http://npmrds.localhost:5173/converted_reports/change_over_time_analysis_month_v1`
  - `http://npmrds.localhost:5173/converted_reports/weekly_averages` (give it 30-45s to fully settle
    once a route is picked — see finding above)
  - `http://npmrds.localhost:5173/converted_reports/covid_comparison` (includes the new truck-speed
    Line Graph section, labeled "Trucks Only")
  - `http://npmrds.localhost:5173/converted_reports/single_route_before_and_after_beginner_0`
  - `http://npmrds.localhost:5173/converted_reports/bottleneck_examples` (needs 6 distinct route
    picks, not grouped)

**Not yet done: the remaining 22 candidates** (28 total − 244 − these 5 = 22 left: `77`, `110`,
`131`, `132`, `164`, `165`, `207`†, `210`, `211`, `228`, `239`, `245`, `246`, `247`†, `252`, `260`†,
`276`‡, `278`‡, `279`‡, `281`‡, `283`‡, `291`‡ — † blocked on the deferred relative-date feature same
as `278`; ‡ also relative-date-blocked, confirmed via dry-run this round). **Flagged, not started:
the Route Info Box "speed" measure bucket** (`no_equivalent`, appears in 14/23 of the original
real-work candidates) would be genuinely high-leverage future platform work — unlike `90`'s cheap
fix, it's a real new join/expression addition, but a single well-scoped addition could newly unlock
several more of the remaining candidates whose only real gap is Route Info Box (e.g. `110`, `165`,
`211`, `228`, `279`\*, `281`\*, `283`\* — \*also relative-date-blocked, so wouldn't fully unlock
without that too). Worth its own scoping pass rather than folding into a future "convert N more"
round.

**Both flagged items scoped, 2026-08-04 — see
`research/npmrds-reports/info-box-speed-and-relative-dates-scoping.md` for the full trace.**
Correcting the record above: a live dry-run recheck against all 22 remaining candidates (not the
static coverage table) found the "Route Info Box speed" gap is mostly **not** a missing-bucket
problem — `165`/`211`/`228` (and 3 more: `164`/`210`/`252`) hit `info_box_bin_undetermined`
(every comp uses the old tool's "all three peaks on" whole-day setting, which round 21/round 40
already found has no precomputed 1410 bin — a data-coverage wall, not fixable by a new join).
**Ryan's steer, 2026-08-04: this bin-ambiguity gap is real and eventually fixable at the data layer
(1410 publishing an all-hours bin), so keep the thread alive — but it's explicitly parked as its
own separate, non-priority thread, not to be bundled into report-conversion prioritization.** Only
`110` has the genuine missing-bucket gap (`("speed", "travel_time_truck")`), and it's cheap — a
plain average-truck-speed template via the already-proven `SPEED_EXPR_TRUCK` (same shape as `90`'s
fix), not "a real new join/expression addition" as characterized above; source 1410 has no
truck-specific LOTTR/TTTR columns to build the expensive version from even if wanted.

Relative dates turned out to be the bigger lever: **13 of the 22 remaining candidates (not ~9)**
are blocked wholly or partly by one of two distinct old-tool mechanisms — and **Ryan caught a real
gap in the first pass of this scoping**: the second mechanism (`relativeDate`/
`useRelativeDateControls`) is NOT "relative to today" the way the first one is — it's relative to
whichever OTHER route/comp in the report is flagged `isRelativeDateBase` (a plain author toggle,
`transportNY/.../AdvancedControls.jsx:273-281`; the base's own literal date propagates to every
other comp's formula, `store/index.js:485-546`). That reframes it as a strong fit for Dynamic
Reports specifically — deriving other slots' dates from whatever the viewer picks for one "base"
slot, not from wall-clock time — rather than a rare, skippable legacy feature. Build-order between
the two relative-date mechanisms is now an open question for Ryan (see the doc's revised
Recommendation), not settled here.

**Mechanism B (`relativeDate`/`isRelativeDateBase`) — built + live-verified, 2026-08-04. Ryan's
build-order call: Mechanism B first.** Grounded the exact date-math semantics by reading
transportNY's `reports/store/utils/relativedates.utils.js` directly (not inferred) and verifying
against real corpus data (templates 278/279) before writing any code — see
`research/npmrds-reports/info-box-speed-and-relative-dates-scoping.md` for the grounding trail.
Two structural facts, confirmed against real data, that simplified the design:

- **A comp's base is always the OTHER comp sharing its own `routeId`** flagged
  `isRelativeDateBase` — true even across nested `route_comps[].type=='group'` entries (279's two
  independent NB/SB bases each pair only with their own group's derived comp, under the SAME
  routeId, `$0`/`$1` respectively). So "base scope" is exactly "same `route_slot_group`" — no
  separate group-nesting-awareness needed; `flatten_route_comps` already preserves each comp's own
  `routeId` through flattening.
- **The old tool's `relativeDate` comps already carry a frozen, pre-computed literal date** (last
  computed whenever the report was saved in the old tool), not just a bare formula — so every
  existing Python consumer that needs a concrete date at CONVERSION time (`graph_max_year` for
  Route Map/Info Box/Bar Graph Summary year selection) keeps working completely unchanged; only the
  JS side needs the live formula for RE-computing if a base's date is edited later.

**Exact date math** (verified byte-for-byte against real output before implementation, e.g.
template 279's comp-0: `startDate=>day-7day->1day` off a base of `2023-02-01` → `2023-01-25`):
special form (`yearof`/`monthof`/`weekof`) snaps `startOf(span)` on the base's own `startDate` and
`endOf(span)` on the base's own `endDate` INDEPENDENTLY (moment's `calculateTimespanOf` — if the
base's start/end fall in different periods, the result spans start-of-startDate's-period to
end-of-endDate's-period, not one single period); general form's anchor is the base's `startDate`
(amount subtracted) or `endDate` (amount added) — direction is hardcoded by which field, the
`+`/`-` character in the string is cosmetic only; `duration` extends forward `duration` spans from
the offset start, inclusive (minus 1 day). Week is Sunday-start (no moment locale override anywhere
in the old repo). Time-of-day (`startTime`/`endTime`) is never touched by this mechanism.

**Python (`scripts/npmrds-reports/convert_old_reports.py`).** New `resolve_relative_dates()` (with
helpers `_resolve_relative_date_formula`/`_start_of_span`/`_end_of_span`/`_shift_spans`), called
right after `flatten_route_comps` in both `convert_report` and `convert_template`: groups
`route_comps` by `routeId`, finds each group's `isRelativeDateBase` comp, computes every sibling's
concrete resolved date (mutating `settings["startDate"]`/`settings["endDate"]` in place — the same
write-back convention the old tool itself used) and stamps a private `_relative_date_resolved`
marker (`{formula, derivedFromCompId}`). `route_settings_gaps` now only gap-logs `relativeDate`
when NOT resolved (ambiguous/missing base, or an unparseable formula, still gap-log exactly as
before). `build_route_entry`/`build_slot_entry` surface `dateFormula`/`derivedFromRoute` on the
built entry when resolved, alongside the still-present concrete literal date (a safe fallback).
Unit-verified the formula math directly against hand-computed values from templates 278/279 before
running any real conversion; then confirmed via live dry-run that **all 7 Mechanism-B-blocked
candidates now show ZERO `relative_date` gaps** (`246, 276, 278, 279, 281, 283, 291` — the 279/281/283
nested-group cases specifically confirmed each group's derived comp resolves against its OWN
group's local base, not the other group's); confirmed Mechanism A candidates (`77, 132, 207, 245,
247, 260`) are unaffected (still gap-log `route_map_no_year`/`info_box_year_undetermined` exactly as
before — this pass only touches Mechanism B).

**Real, pre-existing bug found and fixed along the way, unrelated to Mechanism B itself.**
`build_slot_entry` recomputed a comp's display name via `route_comp_display_name(rc, None)` even
though `convert_template`'s own per-rc loop had already set `rc["name"]` to the substituted value —
applying `compTitle` substitution a SECOND time. Invisible until now because template 244 (the only
template built via this path before today) happens to use `compTitle: "{year}"` everywhere — a
pattern that never references `{name}`, so the redundant second pass was a no-op. Template 278's
`compTitle: "{year} - {name}"` (which DOES reference `{name}`) exposed it immediately: comp-15 came
out `"2024 - 2024 - 2024 - Rochester Inner Loop 2"` instead of `"2024 - Rochester Inner Loop 2"`.
Fixed to mirror `build_route_entry`'s own pattern (`rc.get("name") or ...`, never recomputing).
Rebuilding after the fix reduced it to `"2024 - 2024 - Rochester Inner Loop 2"` — the REMAINING
double is not a bug: the old template author's own raw name already had "2024" baked in AND set a
redundant `compTitle` on top of it (confirmed directly against the raw old settings) — old-content
authoring artifact, out of scope, not chased further.

**JS (`src/themes/transportny/components/ReportRouteList/`).** New pure module
`relativeDateResolution.js` — exact port of the same date-math spec (`RELATIVE_DATE_REGEX` +
`startOf`/`endOf`/`shiftSpans`, hand-rolled `Date` arithmetic matching `useGraphPublish.js`'s own
existing style, no new dependency) exporting `resolveRouteDates(routes)`: for any entry with
`dateFormula`+`derivedFromRoute`, looks up the referenced base by `route_comp_id` in the SAME array,
recomputes the span, and preserves the entry's OWN time-of-day suffix (peak-window settings are
independent per-comp data). Entries without a formula pass through unchanged; returns the SAME
array reference when nothing changed (mirrors `applyDerivedPageVariables`' no-render-churn
guarantee — `derived-page-variable.md`). Never persists — resolved live, on every read, same
"recompute, don't persist a stale value" architecture as that primitive, so editing a base route's
date later (via `RouteRow`'s normal date editor) recomputes every derived row immediately with no
rebuild. Wired into `ReportRouteList.jsx`'s single `effectiveRoutes` choke point (the one place that
already feeds both `RouteRow` rendering and `useGraphPublish`'s `routes` prop), so both edit-mode
display and view-mode publish see live-computed dates uniformly. `RouteRow.jsx` gained a small
guard: a row with `dateFormula` renders its date range read-only (pencil hidden, inputs disabled)
with a "Derived from {base route name}" note, instead of an editable control that would just get
silently overwritten on the next render — `ReportRouteList.jsx` resolves the friendly base name and
passes it down, keeping `RouteRow.jsx` itself purely presentational per its existing convention.

**Unit-verified in isolation before wiring in**: a Node script directly exercising
`resolveRouteDates` against template 278's real shape confirmed initial values match the
hand-computed table exactly, confirmed time-of-day suffixes survive the recompute, confirmed
bumping the base route's date to a different year correctly cascades to every derived row, and
confirmed array-identity stability (re-resolving an already-resolved array returns the SAME
reference, not a new one) — before ever touching `ReportRouteList.jsx`.

**Live-verified, 2026-08-04**: built template 278 for real
(`converted_reports/floating_car_average_day`, page id 2208008), confirmed via direct DB read
(`dms_npmrdsv5.data_items__s2177438_v2177440_reports_snap_2`) that all 10 route-slot entries carry
the exact expected `dateFormula`/`derivedFromRoute`/computed-date values from the hand-verification
above. Loaded `?routes=2198772` (the same real "Rochester Inner Loop 2" catalog route template 244
already established) via `report_probe.mjs --wait 20000`: zero console errors, zero page errors,
zero pending requests at close, 6/9 sections rendered real SVG data (Route Map is canvas not SVG —
known non-bug; the two Route Compare Components render as data tables, not SVG, also not a bug).
Screenshot confirms a real interactive map with the actual route drawn, and — the clearest proof the
per-row dates are genuinely distinct, not all collapsed to one — the two Route Compare tables each
show 4 rows of real, DIFFERENT speed values with different "% vs main" deltas, matching a real
year-over-year comparison across the resolved 2024/2023/2022/2021 (etc.) date windows. Edit-mode
live base-recompute (editing the base route's date immediately updates every derived row's displayed
date with no reload) is code-path-identical to the unit-tested `resolveRouteDates` behavior above
(the same call, unconditional on `isEdit`) and was proven at the unit level, not separately
click-verified interactively in the browser this round — flagged in case a future pass wants that
specific interactive confirmation.

**Verify URL:** `http://npmrds.localhost:5173/converted_reports/floating_car_average_day?routes=2198772`
— Route Map, Route Line Graph, Bar Graph Summary, three Route Bar Graphs, TMC Grid Graph, and two
Route Compare Components should all render real data; expand any RRL route row to see its resolved
date range (10 rows: 2024 whole-year/AM Peak/PM Peak/Off Peak/Avg-Speed-by-Day/Avg-Speed-by-Month,
plus 2023/2022/2021 whole-year comps). Edit at
`.../edit/converted_reports/floating_car_average_day` to see the raw slot placeholders — 9 of the
10 rows show their date range read-only with a "Derived from 2024 - 2024 - Rochester Inner Loop 2"
note instead of an edit pencil.

**Real, separate bug found and fixed via Ryan's live-testing, 2026-08-04: a Dynamic Report's
resolved-view name merge was clobbering every row's own name with the bare catalog route name.**
Ryan caught this by expanding route rows on `floating_car_average_day` in VIEW mode and asking why
several showed identical start/end dates — the dates were actually correct (confirmed live via
direct `<input>` DOM values: rows 0-6 all `2024-01-01→2024-12-31`, row 7 `2023`, row 8 `2022`, row 9
`2021`, exactly matching the hand-computed table above), but ALL 10 rows displayed the identical
bare name "Rochester Inner Loop 2" — erasing the very per-row label (`"2024 - AM Peak..."`, `"Day
of Week - 2024..."`, etc.) that would have told a viewer why there were 10 rows in the first place.
Root cause, unrelated to Mechanism B itself: `useDynamicReportRoutes.js`'s `resolvedRoutes` merge
(`{...slot, ...catalogRow}`) let the resolved catalog route's `name` unconditionally override the
slot's own — a 2026-08-03 design choice made for the single-slot demo case only (an
auto-generated `"Route Slot N"` placeholder IS meaningless until resolved, so showing the real
route's name there was the right call), never scoped to just that case. Ryan's own framing solved
it: track whether a slot's name is still a meaningless auto-generated default, not whether the
report happens to be a ported template — no porting-specific logic belongs in RRL at all.

**Fixed with one boolean flag, not a synced two-field system.** `isPlaceholderName: true`, set only
by `handleAddRouteSlot` (the one code path that generates a name with nothing real behind it yet);
cleared the moment a human renames a route (`onSaveEditName` now sends `isPlaceholderName: false`
alongside the new name — a deliberate rename, even to something generic, is a real decision from
then on). `useDynamicReportRoutes.js`'s merge only lets `catalogRow.name` win when
`slot.isPlaceholderName` is still true; otherwise the slot's own `name` is authoritative — covering
a ported template's descriptive per-comp name (never sets the flag, safe by default) and any human
rename uniformly, with zero changes needed on the Python conversion side. **Known, accepted
consequence:** the original single-slot demo's slot (`claude_scratch_dynamic_report_demo`'s
"Primary Route") was renamed via the UI before this flag existed, so it now permanently shows
"Primary Route" in view mode instead of the resolved catalog route's real name — the correct
outcome under this model (a deliberate rename is authoritative), a deliberate behavior change from
what that demo's own verification recorded 2026-08-03, flagged here rather than silently changed.
**Live-verified**: reloaded `floating_car_average_day?routes=2198772`, confirmed via screenshot all
10 rows now show their correct distinct descriptive names (not "Rochester Inner Loop 2" repeated);
noticed as a bonus that the Route Line Graph's legend also picked up the correct distinct labels
(comparisonSeries labels are keyed off the same `name` field) — previously would have shown 4
identical legend entries for that graph's 4 assigned rows.

**Old-tool cross-check, 2026-08-04 — real, working URL found and it independently confirms the
AM/PM/Off-Peak finding above.** Ryan tried `https://npmrds.devtny.org/report/edit/278` to compare
against the port and got a blank page — not a soft-delete/hidden-row issue (`admin2.templates` has
no such column at all, confirmed against `information_schema.columns`), but a wrong URL entirely
(see the corrected note in "Context that applies to all three items" above for the full routing
trace). **The real working URL for viewing a template requires a route id in the path itself:**
`https://npmrds.devtny.org/template/edit/278/route/163181` (163181 = this template's own real old
routeId, the same one `ensure_route_in_catalog()` upserted into the new catalog as `2198772` for
244). Loaded live: the old tool's own Bar Graph Summary shows all 4 bars ("2024", "AM Peak", "PM
Peak", "Off Peak") at the **identical** height (~45mph) — independent, direct visual confirmation
(not just inferred from raw settings) that the AM/PM/Off-Peak comparison in this specific template
was never actually configured with distinct time windows, and that the converted port faithfully
reproduces the old tool's own live behavior, flaw included.

**Ryan's follow-up ask, 2026-08-05: fix the AM/PM/Off-Peak authoring bug on this one live page for
real** (not just document it) — "I want to see this feature really in action, so I want a nice
dynamic report," explicitly OK with departing from a literal old-tool translation. Two content-level
fixes applied directly to `floating_car_average_day` (page 2208008, `reports_snap_2` row 2208029):

1. **Time-of-day fix.** comp-17/18/19 ("AM Peak"/"PM Peak"/"Off Peak") had `amPeak`/`pmPeak`/
   `offPeak` all `false` and the same `06:00–20:00` window as the whole-year baseline row — the old
   author never actually applied a peak filter, just named the rows as if they had (independently
   confirmed against the real old tool, `npmrds.devtny.org/template/edit/278/route/163181`, which
   shows the same 4-bars-identical-height flaw live). Fixed by editing each row's own time-of-day
   suffix to `06:00–10:00` (AM)/`16:00–20:00` (PM)/`10:00–16:00` (Off, i.e. Midday) — matching
   `RouteRow.jsx`'s own already-shipped peak presets, and summing cleanly to the report's existing
   6am–8pm "whole day" window. This works because `relativeDateResolution.js`'s `resolveRouteDates`
   recomputes only the **date** portion of a derived row from its base, always preserving that row's
   **own** persisted time-of-day suffix (verified directly in code, not assumed) — so patching just
   the time suffix on the stored row is sufficient; no JS changes were needed. Live-verified via
   `report_probe.mjs` against `?routes=2198772`: the Bar Graph Summary now returns 4 genuinely
   distinct speed values (whole-day 45.28, AM 45.57, PM 45.11, off-peak 45.69 mph) instead of 4
   identical ones — a sensible ordering (off-peak fastest, PM peak slowest) for this real route.
2. **Route-slot name fix, same day, Ryan caught it live-testing the first fix.** Several slot names
   showed two *different* years, e.g. `"2024 - AM Peak - 2023 - AM Peak - Rochester Inner Loop 2"` —
   confusing, not just redundant. Root cause: the old template's `compTitle` format
   (`"{year} - AM Peak - {name}"`) concatenates the freshly-resolved `{year}` with the row's own raw
   `name` field — and that raw name field was itself stale in the old author's data (still said
   "2023" even though the row's actual configured window, and Mechanism B's resolved date, is 2024).
   `build_slot_entry`'s earlier double-substitution fix (2026-08-04, see above) had already reduced a
   *triple*-year case (comp-15) down to a same-year double (`"2024 - 2024 - ..."`) — genuinely
   redundant but not misleading — but never touched the cases where the stale fragment held a
   *different* year, which is the confusing case Ryan hit. Fixed by renaming all 10 slots directly
   (e.g. `"2024 - AM Peak - Rochester Inner Loop 2"`, `"2023 - Rochester Inner Loop 2"`) — one clean
   year per name, individually cross-checked against each row's own actual resolved
   `startDate`/`endDate` before writing (not assumed from the label). Only the `name` field changed;
   `dateFormula`/`derivedFromRoute`/`graphIds`/`_old_settings` etc. untouched. Live-verified via
   `report_probe.mjs`: Bar Graph Summary x-axis now reads e.g. `"2024 - AM Peak - Rochester Inner
   Loop 2"` — single year, unambiguous.
   Checked whether this same double-different-year pattern exists on the other 5 already-converted
   candidates (`238, 265, 90, 221, 204`) or elsewhere in the 216-template corpus — **Ryan's call:
   don't check/fix the others, this one page was the only ask.**

Both fixes were applied as direct data edits (not a Python-converter change) since this is a
one-off correction of *this specific old template's* authoring error, not a systemic conversion gap.
**Real CLI gap found and fixed along the way:** `dms raw update` silently no-ops on this app's split
(`:data`-suffixed) dataset rows (already flagged in
`reference_dms_section_create_cli_gaps` memory) — `dms.data.edit`'s server route only resolves the
split table when given a 4th `type` arg (`dms.controller.js`'s `setDataById`), but the CLI's
`raw update` never passed one. Added a `--row-type <type>` option (`cli/src/commands/raw.js` +
`cli/bin/dms.js`) threading it through as that 4th arg — verified end-to-end via independent
`dbq.py new` reads (not trusting the CLI's own echoed response) that both fixes above actually
persisted. Only the `--data` (full-replacement) path is fixed; `--set` on a split row still can't
read-before-merging (a deeper gap, `fetchById`/`dms.data.byId` has the same missing-type problem on
the read side) — not fixed, not needed for this task.

**Verify URL:** `http://npmrds.localhost:5173/converted_reports/floating_car_average_day?routes=2198772`
— Bar Graph Summary's 4 bars ("2024", "AM Peak", "PM Peak", "Off Peak") now show distinct values and
single-year labels; expand any RRL route row to see its clean name and (for AM/PM/Off Peak) the
narrowed time-of-day range.

**Not yet done:** Mechanism A (`{recent-N}` wall-clock substitution) — separate follow-up, per
Ryan's own build-order pick; converting the other 6 Mechanism-B-unblocked candidates
(`246, 276, 279, 281, 283, 291`) into real pages (this pass built only 278, to prove the mechanism);
any new authoring UI to CREATE a base/derived relationship from scratch for a brand-new,
hand-authored Dynamic Report — v1 only surfaces relationships ported from old templates/reports.
**Ryan flagged separately, worth keeping in mind for later (not investigated this round, explicitly
deferred):** the "13 of 22 remaining template candidates" count only reflects the curated
28-candidate template subset — the relative-date gap (either mechanism) very likely also explains
some of the already-attempted `admin2.reports` conversions marked unproducible/gap-logged in the
main 869-report corpus, not just templates. The corpus census already found 13 real reports with a
literal `{recent-N}` string sitting in a date field (Mechanism A) and 0 with `relativeDate`
(Mechanism B) — but that count was taken before either mechanism was resolvable, so a fresh
recheck once both axes are built could plausibly unlock additional already-attempted real reports,
not just new template conversions. Not chased now, per Ryan's explicit steer.

**Mechanism A (`{recent-N}` wall-clock substitution) — scoped 2026-08-04, Ryan's call: document
findings and leave as a gap/TODO, don't build.** Before drafting an implementation plan, pulled the
real `route_comps` for all 6 candidates (`77, 132, 207, 245, 247, 260`) directly (`dbq.py old`)
rather than working from the earlier scoping doc's summary alone — the real shape turned out richer
than that doc implied:

- `{recent-N}` is a pure text substitution (`{recent-N}` → `currentYear - N`), always immediately
  followed by a literal 4-digit MMDD suffix (e.g. `"{recent-0}0101"`). `N` ranges 0-6 in the real
  corpus.
- `startDate` and `endDate` can carry **different** `N` values on the same comp — e.g. template
  `77` comp-2: `startDate={recent-5}0101, endDate={recent-0}1231` (a rolling 6-year window);
  template `247` comp-13 spans a New Year's boundary (`{recent-1}1219` → `{recent-0}0319`). Any fix
  needs to resolve each field independently — no shared per-comp offset can be assumed.
- **New finding, not in the original scoping doc:** the placeholder also appears bare in
  `settings.year` (no date, no suffix) — e.g. template `77`'s `year: "{recent-0}"`, which feeds the
  `{year}` token in `compTitle` substitution (`route_comp_display_name`/`_comp_year_string`). Left
  unresolved, this bakes a literal `"{recent-0}"` string into the display name forever. Checked how
  widespread this is: **33 of 216 templates** (not just the 6 Mechanism-A candidates) carry this
  pattern in `settings.year` — a real, separate, corpus-wide instance of the same underlying
  placeholder, distinct from the startDate/endDate cases.

Sketched (not built) a fix mirroring Mechanism B's architecture: Python-side conversion-time
resolution using the real wall-clock `now`, feeding `graph_max_year()`/display-name substitution
the same way `resolve_relative_dates` already does for Mechanism B; a new pair of fields —
`startDateRecentYearOffset`/`endDateRecentYearOffset` — surfaced on the route/slot entry so the JS
side (`relativeDateResolution.js`) could live-recompute against the *viewer's* real `now()` on every
render, instead of freezing "current year" at whatever year conversion happened to run in. One
accepted-by-precedent limitation this design would carry, flagged but not resolved: a comp's baked
display *name* and any Info-Box/Route-Map graph-template year are conversion-time bakes (the same
category of staleness already accepted elsewhere in this pipeline for those two graph types) — only
the live-query graph types' actual dates would genuinely stay current under this design.

**Ryan's call, 2026-08-04: not worth building right now — leave as a documented gap/TODO.** No code
changes made. The 6 candidates (`77, 132, 207, 245, 247, 260`) remain unconverted, blocked on this
mechanism; the 33-template `year`-field finding is also unactioned. Revisit if/when the relative-date
lever becomes worth prioritizing again — this note plus the scoping doc
(`research/npmrds-reports/info-box-speed-and-relative-dates-scoping.md`) should be enough to pick
back up without re-deriving the corpus shape from scratch.

**Route Map + Route Difference Graph support added, 2026-08-03 (same day, Ryan's follow-up ask).**
Both turned out cheaper than the original deferral assumed — re-reading the relevant functions
found the real data dependency was narrower than first thought in each case:

- **Route Map.** `ensure_route_map_speed_template()`'s own docstring says the shared per-year
  template it mints already carries a real, working **placeholder** color range (a generic quantile
  scale over typical values) precisely so a fresh conversion has something correct before its own
  per-report bake (`bake_route_map_choropleth_paint`/`bake_route_map_delay_paint`) customizes it.
  Skipping that bake (`route_map_value_ctx=None`) isn't a degraded fallback for a Dynamic Report —
  it's the *actually correct* behavior, since there's no single "this report's routes" to bake
  against when a different real route can fill the slot on every view. `convert_template()` now
  runs the same year-resolution + `ensure_route_map_*_template` minting loop `convert_report()` uses,
  unchanged, then builds the section with the bake intentionally skipped. **Live-verified**: rebuilt
  244 (`--replace`, new page id `2199131`, 22 sections, 0 skipped — both Route Map instances now
  convert) and loaded `?routes=2198772` in a real browser. The Map section rendered a real,
  interactive base map (after the known map-in-automation "needs a repaint" quirk — zooming once
  fixed it, not a real bug) with a **live-computed legend value** ("0.36 - 0.36" travel time) for the
  picked route — confirming the live CH tile-join pipeline computes its own value scale at view time
  regardless of any server-side bake, exactly as the "skip the bake" design assumed. Zero console
  errors.
- **Route Difference Graph / TMC Difference Grid.** `resolve_difference_pair()`'s own `is_partner()`
  check has two paths: same `routeId` string (needs zero real data) or, only as a fallback, matching
  real `tmc_array`s across two *different* routeIds (the case that genuinely needs data this mode
  doesn't fetch — two differently-`routeId`'d rows that happen to be the same physical route).
  `convert_template()` now runs the same pair-resolution pre-pass `convert_report()` uses, with
  `old_routes={}` instead of a real fetched dict — the common "before/after one route" pattern
  matches via the same-routeId path, needing nothing new. **Not exercised by any of the 28
  candidates** (none use this graph type), so verified instead with a standalone synthetic test
  (two comps sharing one routeId, different date settings — the exact before/after shape): confirmed
  auto-pick (no explicit `activeRouteComponents`) correctly resolves Main/Compare via the same-routeId
  path, explicit `activeRouteComponents` ordering is honored, and a single-comp case correctly
  reports "no partner" rather than crashing. No live page exercises this yet — flagged for whichever
  future candidate does use this graph type.

Both fixes are in the same `convert_template()` function (Route Map's minting loop, the
difference-pair pre-pass, and the `convertible` classification all restored to mirror
`convert_report()` almost exactly, minus the real-route-fetching steps) — see the function's
updated docstring for the full reasoning trail.

**Implementation plan, 2026-08-03 (mechanism only — Ryan's steer: old-template porting is a
separate task, not this pass).** Full plan-mode design session; grounding and rationale below,
condensed from the approved plan file. Not yet built.

**Core problem.** A report is a page whose `ReportRouteList` (RRL) panel owns one persisted row
(`reports_snap_2`, keyed by `report_id = page.id`) holding concrete routes, published per-graph via
`useGraphPublish.js`. A Dynamic Report is **one page, reused by everyone** — that per-page storage
row can't hold concrete per-viewer routes (every visitor would collide on the same row). Routes
instead come from the URL, resolved against the route catalog at render time, never persisted back.

**Grounding confirmed before designing:**
- `RouteRow.jsx` already renders a route with no `tmc_array`/dates gracefully (empty TMC section,
  blank dates, graph-chip section works off `graphIds` alone) — a "slot" placeholder needs zero
  changes there.
- `useGraphPublish.js` is provenance-agnostic — it just filters/transforms whatever `routes` array
  it's handed. Feeding it a resolved array instead of `useReportRow`'s persisted one needs no
  changes to that file either.
- The page-variable system already has precedent for tagging a `page.filters` entry with a role
  marker beyond `searchKey`/`useSearchParams`/`values`: `type: 'action'` (`view.jsx:108`,
  `edit/index.jsx:157`, read by `useGraphPublish.js`) and `type: 'map_share'`
  (`_utils/index.js:492/504`) both exist today; `derived-page-variable.md` confirms unknown keys on
  a filter row round-trip unchanged. So `type: 'routeSlots'` on a registered, URL-bound
  (`useSearchParams: true`) entry follows an established pattern.
- `updatePageStateFiltersOnSearchParamChange` (`_utils/index.js:571`) writes the live URL value
  onto `pageState.filters[i].values` for any `useSearchParams: true` entry — same place
  `useGraphPublish.js` already reads a resolved action-param value from.
- Multi-value URL params use `|||` as the delimiter (`convertToUrlParams`, `_utils/index.js:8`) —
  reused as-is for `?routes=2107650|||2107812`.
- `RouteTagBrowserModal` already supports `selectionMode="exact"` + `requiredCount` (built
  2026-07-31 for exactly this future consumer) and its `onConfirm` already hands back full resolved
  route rows, not bare ids.
- The shared `Modal` UI (`ui/components/Modal.jsx`) renders via `createPortal(..., document.body)`
  with `fixed inset-0` — a true full-viewport overlay regardless of mount position; passing a no-op
  `setOpen` makes it a blocking gate (no dismiss path other than confirming a selection).
- Old-tool ground truth (`client-request-to-report-skill-archive.md`, "INVESTIGATED 2026-07-27"):
  `admin2.templates.routes` is literally a **slot count (1–9, mode 1)**, and
  `graph_comps[].state.activeRouteComponents` reference **`comp-N` placeholders** — the exact same
  `comp-N` convention RRL's own `route_comp_id` already uses. A "slot" as a placeholder route
  object (`route_comp_id: 'comp-N'`, no concrete data yet) mirrors the old tool's real mechanism.
- **Page Templates system needs no changes.** "One shared page per template" means an admin
  hand-configures the one Dynamic Report page (can start from the existing "Report Page" template
  for its base layout, same as any normal report), then flips it into dynamic mode. No new entry in
  the template picker for this pass.
- **Checked whether the generic Settings-pane Filters editor (`settingsPane.jsx`'s
  `FilterSettings`) could register the `routeSlots` entry — it can't**: its `FieldSet`s only expose
  `searchKey`/`values`/`useSearchParams` (+ `Derived From`/`Derive` on existing rows), no `type`
  field anywhere. Adding one would be a core `@availabs/dms` change for an NPMRDS-specific concept,
  against this repo's own "NPMRDS-specific code lives in `src/themes/transportny`" convention. So
  the toggle (see below) lives in `ReportRouteList.jsx` itself, not core Settings.

**Design.**
1. **"Dynamic Report" toggle, in RRL itself (edit-mode only).** A `Switch` + one-line explanation.
   Toggling calls a handler reusing the exact optimistic-patch-then-persist pattern
   `useAddGraphSection.js` already uses for `draft_sections`:
   ```js
   const toggleDynamicReport = async (enabled) => {
     const withoutRouteSlots = (item.filters || []).filter(f => f.type !== 'routeSlots');
     const nextFilters = enabled
       ? [...withoutRouteSlots, { id: 'dyn-report-routes', searchKey: 'routes',
                                   useSearchParams: true, values: '', type: 'routeSlots' }]
       : withoutRouteSlots;
     updateAttribute?.('', '', { filters: nextFilters });
     await apiUpdate({ data: { id: item.id, filters: nextFilters }, skipNavigate: true });
   };
   ```
   `updateAttribute`/`apiUpdate` are already destructured from `PageContext` in
   `ReportRouteList.jsx` today. Slot **add** is new (below); slot **remove** already works via the
   existing per-route "Remove Route from Report" button, no change needed. Caveat, not engineered
   around: toggling ON doesn't retroactively convert existing concrete routes into slots — build a
   Dynamic Report starting from a blank routes list.
2. **Detect dynamic mode:** `const routeSlotFilter = pageState?.filters?.find(f => f.type ===
   'routeSlots'); const isDynamicReport = !!routeSlotFilter;` `routeIds` from
   `routeSlotFilter.values` (array-normalized). `routes` (from `useReportRow`, unchanged) stays the
   persisted slot placeholders in dynamic mode — never concrete data.
3. **New hook `useDynamicReportRoutes.js`** (`ReportRouteList/`):
   `useDynamicReportRoutes({ apiLoad, routeSourceInfo, slots, routeIds, enabled }) →
   { resolvedRoutes, isResolving }`. `enabled = isDynamicReport && !isEdit && routeIds.length > 0`.
   Fetches catalog rows for `routeIds` via the shared `fetchCatalogRows` helper (extracted below),
   filtering `{ col: 'id', op: 'filter', value: routeIds }`. Merges **positionally**:
   `resolvedRoutes[i] = { ...slots[i], ...catalogRow[i], route_comp_id: slots[i].route_comp_id,
   graphIds: slots[i].graphIds, color: slots[i].color }` — concrete fields (name/tmc_array/dates)
   from the catalog row, identity/authoring fields stay from the slot. Never persists.
4. **Extract `fetchCatalogRows`** out of `RouteTagBrowserModal/useTagBrowser.js` (currently
   private) into `RouteTagBrowserModal/fetchCatalogRows.js`, exported, imported by both
   `useTagBrowser.js` and the new hook — one canonical catalog-fetch instead of a third
   near-duplicate. **Risk flagged, not blocking:** confirm `{ col: 'id', op: 'filter', value: [...] }`
   actually resolves against the systemCol `id` (existing code only shows `id` used as a systemCol
   **SELECT** column, never a filter target) — fall back to adding `{ name: 'id', systemCol: true,
   show: true }` to the fetch's `columns` list (mirrors `useReportRow.js`'s own row-by-id read) if
   not.
5. **Effective routes for render + publish:** `const effectiveRoutes = (isDynamicReport && !isEdit)
   ? resolvedRoutes : routes;` — used both for the RRL list render and as `useGraphPublish`'s
   `routes` input (unchanged hook). Edit mode always shows raw placeholders.
6. **Edit-mode slot authoring — one new button, zero new persistence code.** Replace "+ Add Route"
   with "+ Add Route Slot" only when `isDynamicReport && isEdit`:
   `onClick={() => addRoutes([{ name: \`Route Slot ${routes.length + 1}\` }])}` — reuses
   `useReportRow.js`'s existing `addRoutes` verbatim (already assigns `route_comp_id`/color/deduped
   name to an arbitrary object). No modal, no catalog lookup.
7. **No-URL-param entry gate.** When `isDynamicReport && !isEdit && routeIds.length === 0` (or
   mismatched count), render `RouteTagBrowserModal` open with a no-op `setOpen` (blocking — no
   dismiss path), `selectionMode="exact"`, `requiredCount={routes.length}`, `onConfirm` navigates
   (via `useNavigate`/`useLocation` from `react-router` — never `window.location`) to
   `${pathname}?${convertToUrlParams({ [routeSlotFilter.searchKey]: selectedRoutes.map(r => r.id) })}`.
   Deliberately re-resolves via the URL round-trip rather than short-circuiting with the modal's
   already-resolved rows, keeping exactly one resolution path (mirrors why the Add-Graph modal work
   extracted `applyMeasurePickToState` instead of duplicating merge logic at a second call site).
   **Flagged, not blocking:** selection order becomes slot order, no per-slot labeled picking UI —
   moot for the single-slot demo below; revisit once a real multi-slot template needs it (e.g. an
   anchor/primary vs. comparison route where identity matters).

**Scope boundaries for this pass:** old-template porting untouched (separate task, per Ryan);
slot *count* stays implicit (# of persisted placeholder routes, no separate numeric setting); no
changes to the Page Templates system; no sequential per-slot picker UX (one N-way "pick exactly N"
selection, order = slot order).

**Workstreams:** (1) extract `fetchCatalogRows`; (2) build `useDynamicReportRoutes.js`, confirm the
id-filter mechanics empirically; (3) wire the toggle + detection + `effectiveRoutes` + slot button
+ entry gate into `ReportRouteList.jsx`, all gated on `isDynamicReport` so normal reports are
untouched; (4) build one hand-built single-route-slot demo page (e.g. "Route Year by Year," one or
two AVL Graph sections) proving the mechanism end-to-end; (5) live-verify + update this doc.

**Verification plan:** no-param → blocking picker, `requiredCount` matches slot count; confirm
selection → URL gets `?routes=<id>`, panel shows the real route name, graph(s) render real data;
reload with the same param → same state, no modal (URL is durable/shareable); different `?routes=`
value → same page, different route's data (the core "one shared page, many uses" point); `/edit/...`
shows the raw placeholder + "+ Add Route Slot" + working graph-chip assignment; a normal
(non-dynamic) report regression-checked unaffected; `dms raw get`/`dms dataset query` confirms
nothing persists to `reports_snap_2` from a viewer's selection.

**Built + live-verified, 2026-08-03.** All 5 workstreams shipped as planned. New files:
`RouteTagBrowserModal/fetchCatalogRows.js` (extracted, exported), `ReportRouteList/useDynamicReportRoutes.js`.
Modified: `useTagBrowser.js` (imports the extracted helper), `ReportRouteList.jsx` (toggle, detection,
`effectiveRoutes`, slot button, entry gate), `ReportRouteList.theme.js` (two new theme keys).

- **`id`-filter risk (Design §4) resolved clean, no fallback needed.** `fetchCatalogRows`'s
  `columns` list already declares `{name:'id', systemCol:true}` unconditionally, so
  `buildUdaConfig.js`'s `sourceColumnsByName`/`getFilterColumn` resolves a `{col:'id', op:'filter'}`
  leaf against it directly, and `attributeAccessorStr` returns the bare column (not a `data->>`
  accessor) for a systemCol — `WHERE id = ANY(...)` works exactly like any other filter, first try.
- **Toggle mechanism verified live**: flipping "Dynamic Report" on `converted_reports/claude_scratch_tag_browser`
  (a normal report) correctly swapped "+ Add Route" → "+ Add Route Slot" and back, with zero
  persisted side effects after toggling off again (regression-safe).
- **Demo page built**: `converted_reports/claude_scratch_dynamic_report_demo` (page id `2198224`),
  scaffolded via `report_build.mjs` with one real route (id `2195805`, "NY-9D Northbound...", real
  Jan–Feb 2025 data) then converted in the UI — toggled Dynamic Report on, added one Route Slot,
  assigned it to the graph via the existing chip UI, removed the scaffold route, renamed the slot
  to "Primary Route", set its date window (01/01/2025–02/28/2025, an authored/persisted slot field
  that survives regardless of which real route fills the slot later).
- **Full mechanism live-verified**: no `?routes=` param → blocking `RouteTagBrowserModal` gate
  (`selectionMode="exact"`, `requiredCount=1`, no dismiss path); confirming a route writes
  `?routes=<id>` via `convertToUrlParams` and closes the gate; the panel and graph immediately show
  the *real* resolved route (name, real data) — not the slot's placeholder label; reloading the same
  URL directly re-resolves with no gate (proves the URL is the durable/shareable state, not a
  one-time redirect); navigating to a **different** `?routes=<otherId>` on the same page rendered a
  **different** route's real data (the core "one shared page, many uses" point) — confirmed with
  two distinct real catalog routes (`2195805` NB, `2195804` SB), each producing visibly different
  speed profiles on the same Bar Graph section. `dms dataset query`/`dms raw get` after both
  navigations confirmed `reports_snap_2` still holds only the one authored slot placeholder — zero
  persistence from either viewer session.
- **Real bug found and fixed during resolution debugging: `RouteRow.jsx` and `useReportRow.js`
  needed no changes** — confirmed empirically, not just by reading: a slot placeholder (no
  `tmc_array`/dates) renders and round-trips through rename/reorder/remove/date-edit/color-edit
  exactly like a concrete route, no special-casing anywhere in that file.
- **Non-bug, a self-inflicted test-sequencing trap worth recording:** mid-verification, toggling
  "Dynamic Report" OFF (to A/B-test a concrete route added via the normal catalog flow against the
  same graph) removes the `routeSlots` page-filter entry — obvious in hindsight, but forgetting to
  toggle it back ON before re-testing the view-time URL flow produced a confusing symptom (`console`
  showed `useGraphPublish.js`'s own pre-existing `"Failed to parse tmc_array for route undefined"`
  warning, and the graph rendered an unconstrained network-wide aggregate instead of the one
  route's real data) that looked exactly like a resolution bug but was just the toggle being off.
  Cost real debugging time before a `console.log` dump of `{isDynamicReport, isEdit, routeIds,
  effectiveRoutes}` in `ReportRouteList.jsx` showed `isDynamicReport:false` and made it obvious.
- **Real, pre-existing, platform bug found AND FIXED, 2026-08-03: the demo's original "Travel Time
  by Day" section (LineGraph, `day` resolution) never rendered a visible line, for ANY route,
  Dynamic Reports or not.** Root-caused down to `avl-graph/LineGraph.jsx`'s line/area generators
  gating `.defined()` on `!strictNaN(d.x)` — `strictNaN` coerces through `isNaN()`, so a
  categorical/date x value (`day`/`weekday`/`month` resolution's `"2025-01-01"`-style string) is
  "NaN" by that check, so `.defined()` silently excluded every point in the series (axis rendered
  fine from the same domain; only the line path came out empty). Confirmed via `report_probe.mjs`
  the server-side query was always 100% correct; confirmed via live instrumentation that
  `XScale(d.x)`/`YScale(d.y)` resolved to valid pixel positions for every point — only the d3 line
  generator's own `.defined()` predicate was wrong. Reproduced on a **plain, un-scripted page**
  (`+ Add Page → Your Templates → Report Page`, a normal UI-added route, the stock Measure Picker) —
  proving it was never about Dynamic Reports, `report_build.mjs`, or this arc's own code at all.
  Fixed by replacing the three `.defined(d => !strictNaN(d.x))` call sites with a presence-only
  check (`d.x !== null && d.x !== undefined && d.x !== ""`); `strictNaN` itself untouched (its other
  call sites correctly pre-coerce with `+value` first). Live-verified across all six resolutions
  (5-minutes/15-minutes/hour/day/weekday/month) × two measures on the reproduction page; Bar Graph
  was never affected (different code path, no `.defined()` gate). Full write-up:
  `src/dms/planning/tasks/completed/linegraph-day-resolution-invisible-line.md`. The demo's own
  "Travel Time by Day" section now works too — re-verified live on the actual demo page (not just
  the isolated `page_13` reproduction): both sections (LineGraph/Day and Bar Graph/Speed) render
  real data for the resolved route, same page, same navigation.
- **Verify URL:** `http://npmrds.localhost:5173/converted_reports/claude_scratch_dynamic_report_demo`
  (no param) → blocking route picker, exactly 1 selection required; pick any route → both the
  "Travel Time by Day" line graph and the "Speed (mph)" bar graph show that route's real data; try
  `?routes=2195805` vs `?routes=2195804` directly to see two different real NY-9D routes render on
  the same page. Edit at `.../edit/converted_reports/claude_scratch_dynamic_report_demo` to see the
  raw "Primary Route" slot, the "Dynamic Report" toggle, and "+ Add Route Slot".

**Real bug found and fixed, 2026-08-03 (Ryan's manual testing): an unresolved route (any route with
no known `tmc_array` — a Dynamic Report slot placeholder, or a manually-added one mid-edit) made its
assigned graph(s) run a full, UNFILTERED, network-wide ClickHouse query instead of showing nothing,
mislabeled with that route's name/color.** Ryan hit this by hand on the live demo (adding a second
"Route Slot 2", assigning it to the Speed graph, then editing with no `?routes=` param) and reported
three linked symptoms: (1) the URL's `?routes=` param persisting into edit mode "makes adding graphs
and stuff not work very well"; (2) `useGraphPublish.js:67`'s `Failed to parse tmc_array for route
undefined` console error when a graph is limited to routes with no real TMCs; (3) a graph that still
"had route data" while editing with no routes selected, even though view mode looked correct.
Root-caused live (not just from reading code) on `converted_reports/claude_scratch_dynamic_report_demo`,
which Ryan had left with 2 persisted route slots ("Primary Route" assigned to both graphs, "Route
Slot 2" newly assigned to the Speed graph only) from his own testing:

- **(2) and (3) are the same bug, and it's worse than "stale."** `transformReportRoutes`
  (`useGraphPublish.js`) always emitted a `{col:'tmc', op:'filter', value: parsedTmcArray}` leaf even
  when `parsedTmcArray` was `[]` (a route with no `tmc_array` at all — the normal state of an
  unfilled slot). `mapFilterGroupCols` in core `buildUdaConfig.js` (lines ~200-212) *by design* drops
  any `filter`/`exclude` leaf whose value list is empty, on the theory that an unset filter should
  WIDEN the query rather than blank it (correct for its actual use case — an unset page-filter
  control). For a route's `tmc` leaf this is exactly backwards: dropping it means the "Travel Time by
  Day" graph ran a real, unfiltered, whole-network ClickHouse query for the route's date range and
  rendered it labeled "Primary Route" — confirmed live via `read_network_requests` (the decoded
  `seriesVariants` request had a `date` group but no `tmc` group at all) and via the section's own
  persisted `element-data.data` (59 rows, ~75,053 "minutes" of travel time — an obvious network-wide
  sum, not one corridor). This is not a caching/staleness issue; it's a real query silently running
  over the wrong (unbounded) scope every time a route lacks TMCs, in edit mode AND (had the demo's
  URL param round-trip ever landed on an empty-tmc route) in view mode too.
- **Fixed in `transformReportRoutes`** (`useGraphPublish.js`): a route with no `tmc_array`, or one
  that fails to parse, is now excluded from the published comparison-series list entirely — no
  variant is published for it — rather than publishing a variant with an empty `tmc` filter. The core
  `buildUdaConfig.js` empty-leaf-drop guard is untouched (it's correct for its real, load-bearing use
  case; the fix belongs in NPMRDS-specific code producing a leaf that should never be empty in the
  first place, per `feedback_isolate_shared_code_changes`). Also fixes (2): the console error is gone
  because a route with no `tmc_array` is now skipped before the `JSON.parse` call, not just
  try/caught after it fails.
  Live-reverified post-fix: reloading the edit page (no `?routes=` param) now shows both graphs
  correctly empty, zero console errors, and — confirmed via `read_network_requests` — no query is
  issued for either graph at all (nothing to fetch, since no route publishes a variant). View mode
  with a real route (`?routes=2195805`) still renders correctly, confirming the fix doesn't affect
  the resolved-route path.
- **(1) — Ryan's steer, 2026-08-04: pre-populate rather than discard.** Built + live-verified.
  See "Slot/URL-count mismatch — pre-populate fix, 2026-08-04" below.
- Scratch report state: `claude_scratch_dynamic_report_demo` grew a **third** persisted slot
  ("Route Slot 3") at some point between the 2026-08-03 session and this fix (Ryan's own further
  manual testing, per his own note above about re-testing the mismatch case) — 3 slots total now
  ("Primary Route"/comp-1, "Route Slot 2"/comp-2, "Route Slot 3"/comp-3), left as-is, harmless
  scratch data, and incidentally a *better* fixture than 2 slots for verifying the fix (exercises a
  "2 still missing, not just 1" case).

**Slot/URL-count mismatch — pre-populate fix, 2026-08-04.** Resolves open question 2b. Ryan's
call: pre-populate the picker with whatever's already resolved from the URL and only ask for the
still-missing slot(s), rather than the gate popping over an already-rendered partial view and
discarding it.

- **`useDynamicReportRoutes.js`** gained `resolvedGroupRoutes` — one real catalog row per
  DISTINCT slot group that already has a resolved URL id, in group order (deliberately not
  deduped from the existing `resolvedRoutes`, which repeats a group's row once per slot sharing
  it — this is the one-row-per-group form needed to seed a picker's selection, not to render RRL
  rows).
- **`RouteTagBrowserModal.jsx`** gained an `initialSelectedRoutes` prop — seeds `selected` at the
  open transition (not tracked as a dep on every render, so a parent re-render producing a
  new-by-reference-but-same-content array can't wipe an in-progress selection while the modal
  stays open) — plus a visible chip row (name + remove ×) above the breadcrumb whenever
  `selected.size > 0`, so the pre-population is legible rather than only implied by the footer's
  count text. New theme keys: `selectedChips`/`selectedChip`/`selectedChipLabel`/
  `selectedChipRemove`.
- **`ReportRouteList.jsx`**'s entry gate passes `initialSelectedRoutes={resolvedGroupRoutes}`, and
  its `onConfirm` no longer trusts the modal's Map-insertion-order array directly — a missing
  group isn't always the trailing one, so a naive concat would silently misplace a mid-list pick.
  Rebuilds by explicit group position instead: `routeSlotGroups.map((_, j) => routeIds[j] ??
  stillNeededIds[cursor++])`, where `stillNeededIds` is whatever the user picked that wasn't
  already in `routeIds`, consumed in selection order to fill the gaps left by `??`.
- **Live-verified** via `report_probe.mjs` (Playwright — the Chrome extension wasn't connected in
  this session) against `claude_scratch_dynamic_report_demo` (3 slots) with a 1-of-3 URL
  (`?routes=2195805`): gate opened pre-populated with a chip for the already-resolved route
  ("NY-9D Northbound (I-84 to Main St/Beekman, via Verplanck) - Jan-Feb 2025"), footer correctly
  read "Select 2 more (1/3)" (not "Select 3 more (0/3)"). Scripted picking 2 more real routes and
  confirming produced `?routes=2195805|||2207838|||2207837` — the original id preserved in
  position 0, new picks filling positions 1-2 in pick order. Reloading that full URL: zero console
  errors, zero page errors, zero pending/hung requests, 2/3 sections rendered real SVG content
  (the third is the page-title container, not a graph). `dms_npmrdsv5.data_items__..._reports_snap_2`
  confirmed unchanged (still exactly the 3 authored slot placeholders) after the whole flow — no
  viewer-side persistence, same guarantee as the original mechanism.
- **Verify URL:** `http://npmrds.localhost:5173/converted_reports/claude_scratch_dynamic_report_demo?routes=2195805`
  — blocking gate should show a pre-filled chip for the NY-9D route and read "Select 2 more (1/3)".

---

## Open questions for triage

Still open:

1. ~~Priority order across the three items~~ — Ryan picked the Add-Graph modal, then Dynamic
   Reports (core mechanism, old-template porting carved out separately), as the next threads to
   build, 2026-08-03. TMC-linear auto-generation remains unstarted.
2. ~~The proposed tag taxonomy~~ — confirmed by Ryan 2026-07-31, proceed as proposed. See item 2's
   "Proposed starting tag categories" section.
2b. ~~What should happen when a Dynamic Report's persisted slot count and its URL's route-id count
   disagree~~ — Ryan's call, 2026-08-04: pre-populate the picker with whatever's already resolved,
   only ask for the still-missing slot(s). Built + live-verified. See item 3's "Slot/URL-count
   mismatch — pre-populate fix, 2026-08-04" section.
3. Since Dynamic Report template pages are shared/reused (not per-instance), does editing a
   template's structure need any special draft/publish handling beyond what DMS pages already do,
   to avoid disrupting a concurrent viewer? Probably already covered by the existing
   draft-vs-published model — not confirmed. (Note: the `routeSlots` page-filter registration
   itself is NOT part of the draft/publish content model at all — `apiUpdate({data:{filters:...}}})`
   writes immediately, no separate publish step, confirmed live 2026-08-03 toggling the new
   "Dynamic Report" switch.)
4. ~~How many of the old tool's 216 templates actually get ported~~ — Ryan confirmed 2026-08-03: not
   all 216, a curated most-used subset via the existing conversion pipeline. Candidate selection
   done (28 deduped candidates via `stuff_in_folders` group-folder signal); `TEMPLATE_SPECS`
   coverage cross-check done (4 fully mapped, 1 cheap, 23 hit a concentrated Info Box/Route Map gap);
   mechanism unified 2026-08-03 (all 28 built the same way, via `build_graph_section_data()` +
   route slots, no path split — see item 3's "Unified mechanism design" section). `--template-id`
   CLI mode built 2026-08-03 (`convert_template()`); 6/28 candidates converted so far (`244`
   2026-08-03; `238`/`265`/`90`/`221`/`204` 2026-08-04, see item 3's "5 more candidates converted"
   section) — 22 remain, most now blocked on either the deferred relative-date feature or the
   separately-flagged (not started) Route Info Box "speed" gap.
   ~~Relative-date (`{recent-N}`) handling~~ — Ryan explicitly deferred 2026-08-03 ("needed
   eventually, not right now"); fixed author-set dates for this pass, not an open question anymore.
5. ~~Add-Graph modal~~ — design questions resolved by Ryan 2026-08-03 (placement, auto-assign
   scope, preview mechanism, vocabulary scope); built and live-verified the same day, including a
   platform bug fix (`useGraphPublish.js` orphan-cleanup race). See item 1's "Implementation plan,
   2026-08-03" section.
6. ~~Dynamic Reports core mechanism~~ — designed, approved, built, and live-verified 2026-08-03. See
   item 3's "Implementation plan, 2026-08-03" section, including a real pre-existing/unrelated
   platform finding (one LineGraph section that never renders) isolated and left for separate
   investigation, and a multi-slot picker UX nuance (selection order = slot order, no per-slot
   labeled picking) flagged as a follow-up once a real multi-slot template needs it.

Resolved 2026-07-31 (same-day, across two follow-up rounds):

- ~~The folders-out-of-scope boundary check under item 2~~ — confirmed superseded, not just
  non-conflicting, and confirmed scoped to route organization only. See item 2's "Standing ruling"
  section.
- ~~The old-template-porting tension under item 3~~ — confirmed superseded: port the old templates
  as content, keep them dynamic. See item 3's "Old-template porting" section.
- ~~Generic DMS tags primitive vs. NPMRDS-bespoke~~ — moot: the routes dataset gets a `multiselect`
  `tags` column and rides the existing generic `array_contains` UDA filter. See item 2's
  "Technical grounding" section.
- ~~Where does tag-editing UI live~~ — `SaveRouteModal.jsx`, alongside Name/Description.
- ~~Shared modal for normal + Dynamic Report route-picking~~ — yes, one shared component; built and
  live-verified 2026-07-31 (`RouteTagBrowserModal`), wired into RRL. See item 1's "Shared modal —
  implementation" section. Dynamic Reports' own consumption of it still waits on that system
  existing.
- ~~Dynamic Report page model: shared vs. per-instance~~ — one shared page per template. See item
  3's "Architecture confirmed" section for follow-on implications.
- ~~Is the Add-Graph modal part of this arc or a peer item~~ — part of this arc.
- ~~Does TMC metadata already carry a linear/sequence field to chain on~~ — Ryan recalls yes, not
  yet independently verified against the schema. See item 2's tagging-scheme section.
- ~~Old-DB folder-structure inspection to derive a starting tag taxonomy~~ — done 2026-07-31,
  queried `admin2.folders`/`admin2.stuff_in_folders` directly. See item 2's "Old-DB tag-taxonomy
  inspection" section for findings and the resulting proposed tag categories.

## Cross-references

- `research/route-creation/findings.md` — old tool's folder system (Part 4 area, "Route
  organization (folders)"), and the marker-placement/auto-routing work (a different "auto" than
  item 2's)
- `planning/transportny/tasks/current/route-creation-tool.md` — route creation tool current status; folder
  field explicitly deferred 2026-07-23
- `planning/transportny/tasks/current/reportroutelist.md` — RRL add-flow history (3 rounds so far)
- `src/themes/transportny/components/ReportRouteList/README.md` ("Design iterations during
  development") + git log `cf6d81a`/`62fdf05`/`381a3ae` → `9208c14`/`33e445f` — the real prior-art
  for "we used to add graphs via the RRL": the rejected `graph_comps`/`setItem` injection approach
  and why it was replaced by self-binding. See item 1's "Add-Graph modal — scoping findings"
  section.
- `src/themes/transportny/components/MeasurePicker/composeMeasureConfig.js` + `index.js` — the
  from-scratch graph-config composer the Add-Graph modal should reuse wholesale, not reimplement
- `src/dms/packages/dms/src/patterns/page/components/sections/sectionArray.jsx`,
  `sectionGroup.jsx`, `src/dms/packages/dms/src/api/updateDMSAttrs.js` — the real, generic
  section-creation primitive (`draft_sections` push → `apiUpdate` → `dms.data.create`) the
  Add-Graph modal should create its new section through
- `research/npmrds-reports/cold-open-ux-findings.md` — first-60-seconds friction findings,
  motivates item 1
- `research/npmrds-reports/guidance-layer-findings.md` — "does the tool tell the user anything"
  axis, motivates item 1's Add-Graph sub-item
- `src/dms/planning/tasks/current/page-templates.md` — generic Page Templates system, baseline for
  item 3
- `src/dms/planning/tasks/current/derived-page-variable.md`, skill `creating-interactive-pages.md`
  — page-variable/URL-param architecture, likely mechanism for item 3
- `planning/transportny/tasks/current/client-request-to-report-skill-archive.md` (~lines 20-90) — old tool's
  216-template route-slot analysis
- `planning/transportny/tasks/current/report-spec-and-build-script.md`,
  `research/npmrds-reports/report-spec.md` — declarative report spec, relevant to how Dynamic
  Report templates might get authored
- `planning/transportny/tasks/current/report-route-ui-parity-gaps.md` — has the same folders-out-of-scope
  ruling restated (line ~26)
- `planning/transportny/tasks/current/report-page-template-editorial-slots.md` — the other, unrelated sense of
  "slot" in this arc
- memory `project_reports_folders_discovery_permissions_out_of_scope` — the prior ruling item 2
  partially supersedes (amended 2026-07-31); report discovery/index page and permissions/ACL
  pieces of that ruling still stand
- `src/dms/planning/tasks/completed/uda-array-contains-filter.md` — the generic multiselect
  array-contains filter item 2's tag filtering can ride on directly
- `src/themes/transportny/components/routecreation/constants.js`,
  `components/SaveRouteModal.jsx` — current route storage shape (`routes_data` dataset, split
  type) and current save-modal fields (Name/Description only)
- `src/themes/transportny/components/RouteTagBrowserModal/` — the shared tag-folder-browsing modal
  itself (`RouteTagBrowserModal.jsx`, `useTagBrowser.js`, `tagCategories.js`), built 2026-07-31; see
  item 1's "Shared modal — implementation" section for the two platform findings hit while building
  it (no live tag-discovery query; join-source snapshot staleness)
- `src/themes/transportny/components/AddGraphModal/` — the Add-Graph modal itself
  (`AddGraphModal.jsx`, `graphGuidanceCopy.js`), built 2026-08-03; reuses Measure Picker's
  vocabulary and `composeMeasureConfig` wholesale, no duplicated composition logic
- `src/themes/transportny/components/ReportRouteList/useAddGraphSection.js` — composes a
  from-scratch "AVL Graph" section state and pushes it into `draft_sections`, the Add-Graph modal's
  section-creation primitive (built 2026-08-03)
- `MeasurePicker/index.js`'s `applyMeasurePickToState` and
  `dataWrapper/useDataWrapperAPI.js`'s `reconcileComparisonSeriesColumnOnState` — pure
  draft-or-plain-object mutation functions extracted 2026-08-03 so the Add-Graph modal can compose
  a section's config before any dwAPI/dataWrapper exists for it, byte-identical to the live-editing
  path
- `src/themes/transportny/components/RouteTagBrowserModal/fetchCatalogRows.js` — the routes-catalog
  fetch, extracted 2026-08-03 from `useTagBrowser.js` (now imports it) so
  `useDynamicReportRoutes.js` can reuse the identical implementation rather than a third
  near-duplicate
- `src/themes/transportny/components/ReportRouteList/useDynamicReportRoutes.js` — Dynamic Reports'
  view-time route resolution (URL ids → catalog fetch → merge over the persisted slot
  placeholders), built 2026-08-03; never persists, pure in-memory overlay
- `converted_reports/claude_scratch_dynamic_report_demo` (page id `2198224`) — the live single-slot
  Dynamic Report proof built 2026-08-03; see item 3's "Built + live-verified" section for the full
  verification record and a real pre-existing/unrelated LineGraph rendering finding surfaced while
  debugging it
- `src/themes/transportny/components/ReportRouteList/useGraphPublish.js` — `findSelfBoundGraphs`/
  `knownSectionIds`'s discovery gate fixed 2026-08-03 (trackingId-or-id, not id-only) after a real
  orphan-cleanup race was found live-testing the Add-Graph modal; see item 1's implementation
  record for the full root-cause writeup
