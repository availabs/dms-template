# Dynamic Reports, Route Tags & Add-Route Flow — next-phase scoping

## Status: IN PROGRESS — core architecture decided for all 3 items (2026-07-31, across three rounds of same-day follow-up). Item 2 (Route Tags) Phase 1 — manual tag storage + editing UI — is DONE and live-verified (2026-07-31, see item 2's "Implementation Plan" section). The shared tag-folder-browsing modal (items 1+2, "RouteTagBrowserModal") is DONE and live-verified (2026-07-31, see item 1's new "Shared modal — implementation" section) — wired into RRL's add-route flow now; Dynamic Reports' consumption of it (item 3) waits on that system existing at all. **Add-Graph modal (item 1's sub-item) is DONE and live-verified, 2026-08-03** — see item 1's "Implementation plan, 2026-08-03" section, including a real platform bug (`useGraphPublish.js` orphan-cleanup race) found and fixed along the way. **Dynamic Reports (item 3) — Ryan picked this as the next thread, 2026-08-03, with old-template porting explicitly carved out as a separate task. Core mechanism DONE + live-verified, 2026-08-03** — route slots filled via URL param, a "Dynamic Report" toggle in RRL, view-time resolution against the route catalog, all built and proven end-to-end (two different real routes rendering on the same shared page via different `?routes=` values). See item 3's "Implementation plan, 2026-08-03" section, including a pre-existing/unrelated platform finding (one LineGraph section that never renders a line, isolated away from Dynamic Reports and left for separate investigation) and old-template porting still deliberately out of scope. TMC-linear auto-generation remains unstarted.

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
- Old-tool reference point Ryan gave: `https://npmrds.devtny.org/report/edit/1071` — an
  `admin2.templates` row ("template" in the old tool's vocabulary), which is the direct conceptual
  ancestor of "Dynamic Report" below.
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
`planning/tasks/current/client-request-to-report-skill-archive.md` (~lines 20-90).

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

---

## Open questions for triage

Still open:

1. ~~Priority order across the three items~~ — Ryan picked the Add-Graph modal, then Dynamic
   Reports (core mechanism, old-template porting carved out separately), as the next threads to
   build, 2026-08-03. TMC-linear auto-generation remains unstarted.
2. ~~The proposed tag taxonomy~~ — confirmed by Ryan 2026-07-31, proceed as proposed. See item 2's
   "Proposed starting tag categories" section.
3. Since Dynamic Report template pages are shared/reused (not per-instance), does editing a
   template's structure need any special draft/publish handling beyond what DMS pages already do,
   to avoid disrupting a concurrent viewer? Probably already covered by the existing
   draft-vs-published model — not confirmed. (Note: the `routeSlots` page-filter registration
   itself is NOT part of the draft/publish content model at all — `apiUpdate({data:{filters:...}}})`
   writes immediately, no separate publish step, confirmed live 2026-08-03 toggling the new
   "Dynamic Report" switch.)
4. How many of the old tool's 216 templates actually get ported as real Dynamic Report pages — all
   216, or a curated subset following panel-frequency concentration (see item 3's architecture
   note)? Still deferred — a separate task per Ryan's 2026-08-03 steer, not part of the mechanism
   build.
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
- `planning/tasks/current/route-creation-tool.md` — route creation tool current status; folder
  field explicitly deferred 2026-07-23
- `planning/tasks/current/reportroutelist.md` — RRL add-flow history (3 rounds so far)
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
- `planning/tasks/current/client-request-to-report-skill-archive.md` (~lines 20-90) — old tool's
  216-template route-slot analysis
- `planning/tasks/current/report-spec-and-build-script.md`,
  `research/npmrds-reports/report-spec.md` — declarative report spec, relevant to how Dynamic
  Report templates might get authored
- `planning/tasks/current/report-route-ui-parity-gaps.md` — has the same folders-out-of-scope
  ruling restated (line ~26)
- `planning/tasks/current/report-page-template-editorial-slots.md` — the other, unrelated sense of
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
