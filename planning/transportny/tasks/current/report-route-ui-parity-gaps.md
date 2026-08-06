# NPMRDS route/report UI parity gaps (Phase C)

**Project:** TransportNY

**Status:** IN PROGRESS — 5 of 15 gaps fixed so far (#4 `route_id` overwrite labeling,
#5 TMC Search-to-add, both live-verified 2026-07-27 in transportNY; #11 peak-hour filtering,
both spec and UI halves, live-verified 2026-07-28 in dms-template AND ported + re-verified
in transportNY the same day — see its entry below, including a correction to the "inert for
Map/Info Box" claim made earlier the same day; #10 weekdays UI control, live-verified
2026-07-30 in dms-template only, not yet ported to transportNY; #8 difference-graph anchor
UI affordance, live-verified 2026-07-30 in dms-template only, not yet ported to transportNY).
Gap #2 (TMC search `-` code bug) was investigated live 2026-07-27
and dropped — could not reproduce, see its entry below. This is Phase C of the
three-phase arc in
`report-spec-and-build-script.md` (Phase A: skill split, DONE 2026-07-27 — this file is
one of its outputs, moved out of `src/dms/skills/creating-routes-and-reports.md`'s old
"Known UI gaps" section. Phase B: spec format + `report_build.mjs`, DONE).

## Objective

Close the gap between what the report spec format can already express/guarantee and
what the route-creation and report-building **UI** can do, one item at a time. The spec
format (`research/npmrds-reports/report-spec.md`) makes this list enumerable in a way
it wasn't before: every spec field is a control that either exists in the UI or
doesn't, and every silent-failure class the spec avoids "by construction" is a UI bug
that could be fixed instead of routed around.

**Not in scope, permanently:** folders, report discovery/browsing, permissions — these
fold into DMS native primitives later, per user direction 2026-07-27 (memory
`project_reports_folders_discovery_permissions_out_of_scope`). Don't add them here even
opportunistically.

**Amended 2026-07-31:** route organization/tagging is back in scope — see
`dynamic-reports-and-route-tags.md`. Report discovery/browsing and permissions are still out of
scope here; this list stays about route-creation and report-building UI parity, not route
organization.

**Amended 2026-08-06:** report discovery/browsing is back in scope too. Ryan, asked directly
whether to reopen it given the new design set's `npmrds-reports.html` report-library page: "we
dont have one built yet but we will want one." See `npmrds-design-v2-implementation.md` for the
scoping. Permissions/ACL is now the only piece of the original 2026-07-27 ruling still standing.

## Gaps

### Route creation (`creating-routes.md`)

> Gaps below were found and fixed against transportNY's copy of the routecreation
> plugin (2026-07-27, before the port). As of 2026-07-29 the plugin is native to
> dms-template (`planning/transportny/tasks/completed/port-transportny-map-plugins.md`) and these
> fixes are already part of the ported copy — transportNY is no longer needed to work
> on or verify any of this.

1. **Map scroll-zoom is disabled.** Confirmed live (pixel-identical before/after a
   scroll). Workaround: double-click zoom, on-screen `+`/`-` buttons. Cosmetic/low
   priority — not spec-avoidable, route creation only exists in the UI.
2. **TMC Search bar unreliable for `-` (one-direction) codes** — reproducibly zooms to
   a wrong/unrelated location; `+` codes are fine. Real bug in the search/zoom-to-code
   logic, worth fixing directly rather than working around with TMC Click mode.
   **2026-07-27: attempted live repro, could not reproduce.** Tried searching
   `120-29713` (a real SB TMC near Beacon) three ways against `sandbox.localhost:5173/
   edit/demo_reports` — bulk paste-style type, and character-by-character key presses
   from an empty box — and manually replayed the exact `fetchBoundsForFilter` falcor
   request server-side (`uda/npmrds2/viewsById/3058/options/{filter:{tmc:[...]}}`) for
   both the `+` and `-` codes; server returned the geometrically-correct bextent for
   each, and the UI zoomed to the correct spot each time (one screenshot that looked
   "zoomed way out" turned out to be mid-flyTo-animation, not a settled wrong position).
   User decided to drop this one rather than keep chasing a repro. Leaving the
   description above as-is in case it resurfaces with a more specific trigger (a
   particular page/view_id, a particular TMC) — don't re-attempt without new
   information.
3. **Hover popovers show TMC code only, no street name** — sometimes a click is needed
   instead of hover to identify a segment. Minor; a tooltip enrichment.
4. **`route_id` in the map-tool URL means "editing this route"** — reusing an existing
   route's URL as a scratch pad silently overwrites it on Save, with no confirmation
   dialog. Real footgun; the fix is cheap (a confirm-before-overwrite guard when
   `route_id` is present) and worth doing regardless of spec parity.
   **FIXED 2026-07-27** (transportNY only, `comp.jsx`/`RouteEditor.jsx`/
   `SaveRouteModal.jsx`): `routeIdFilterValue` (already derived from the URL's
   `route_id` page filter) now drives an `isEditingRoute` flag threaded down to both
   components — "Save Route"/"Save New Route" become "Update Route" when editing, plus
   a red "You are updating an existing route. Saving will overwrite it, not create a
   new one." banner in the modal. Live-verified both on the post-save navigation and on
   a cold page load with `?route_id=...` already in the URL. Not a confirm dialog (user
   asked for labels/wording specifically, not a blocking prompt) — revisit if the
   silent-overwrite footgun itself still bites someone.
5. **TMC Search box could only zoom, not add** — adding a segment always required a
   map click, even after the search box had already located it exactly. **FIXED
   2026-07-27** (transportNY only): the search effect now also tracks whether the
   typed TMC resolved to a real geometry (`searchTmcValid`, from the same
   `fetchBoundsForFilter` call already used for the zoom), and an "Add" button next to
   the search box (or Enter in the field) calls the same `toggleTmc` the map-click
   handler uses — same paint highlighting, same `tmc_array` update, no separate code
   path. Disabled (with a "TMC not found" hint) for non-existent codes. Live-verified:
   typed `120+29713`, clicked Add, segment highlighted and appeared in the TMC list
   with correct mileage/intersection with zero map clicks; typed a fake code
   (`999+99999`) and confirmed Add stayed disabled. This was explicitly called out by
   the user as making the tool driveable by claude-in-chrome without needing pixel-
   accurate map clicks.

### Report building (`creating-reports.md`)

6. **RRL's per-instance "ON: Graph N" pill can silently fail to persist** — no error
   shown either way; only detectable by querying `data->'route_comps'` afterward. The
   spec path avoids this by construction (`routes[].graphs` is declarative, `graphIds`
   is computed) but the UI bug itself is still live and worth root-causing.
7. **RRL has no reliable per-instance rename** — two instances of the same route can't
   be given distinct display labels, only distinct dates/colors. Cheapest workaround
   today is naming the underlying route sensibly up front; a real fix needs the rename
   control's input-commit bug found (typed text doesn't reliably commit).
8. **Difference-graph anchor is "whichever instance was added to the report first"**
   (`route_comp_id` order) — invisible in the UI, so getting the sign right is a
   coin-flip unless you already know the add-order convention. The spec's `anchor`
   field fixes this outright (names the arm explicitly, sets `combine.invert` as
   needed). **IMPLEMENTED + LIVE-VERIFIED 2026-07-30** — decided (with user input) to
   put the control in the graph's own Measure Picker rather than on the RRL
   graph-pill as originally suggested above: an "Anchor Route" item was added to
   `MeasurePicker/index.js`'s `npmrdsMeasureMenu`, shown only when Comparison Mode is
   `difference` AND exactly two routes are currently assigned to that graph (the
   server only supports the 2-arm case — see report-spec.md's "Difference graphs:
   anchor and sign"). It lists the two routes by their live label and lets the author
   pick which is the anchor ("Main"); picking sets `comparisonSeries.combine.invert`
   (`true` when the second-assigned route is chosen, absent when the first is).
   `anchorInvert` was added to the Measure Picker's persisted pick state
   (`display._measurePick`), the same "smart default generator" mechanism
   graphType/measure/resolution/comparisonMode already use — so it survives any
   *other* Measure Picker field changing (re-composition preserves it, doesn't
   silently reset it back to the default anchor), confirmed live below.

   **Reads the same resolved, ordered route list the query itself uses**: RRL
   publishes each graph's assigned+transformed routes to its own self-derived action
   param (`useGraphPublish.js`'s `transformReportRoutes`) at
   `pageState.filters[...].values`, keyed by `selfParamKey(trackingId||id)` — the
   anchor selector reads that same array, so it can't independently drift from what
   the graph actually queries. Needed threading `pageState` through
   `getSectionMenuItems`/the `sectionMenuExtensions` builder call (`section.jsx`,
   `sectionMenu.jsx`) since extensions previously only received `sectionState`, not
   page-level state — a small, generically-useful plumbing addition, not
   NPMRDS-specific.

   **Known limitation, inherent to the underlying mechanism, not this UI**:
   `combine.invert` is positional (first-vs-second assigned route), not identity-based
   — if an author later reorders which route is assigned first to a difference graph
   (RRL supports route reordering), a previously-set anchor pick's *meaning* can
   silently flip without the stored `invert` value changing. This is a property of
   `comparisonSeries.combine` itself (the runtime has no route-identity concept for
   the anchor, just array position), not something this fix could have avoided short
   of a deeper runtime change — flagged here for whoever eventually touches that area,
   not a follow-up item for this gap.

   **Deliberately NOT added to QuickControls** (the header-pill entry point,
   `QuickControls/index.jsx`) — that surface already deliberately excludes Graph
   Type/Resolution as out of scope for a one-click pill row (see
   `avl-graph-quick-controls.md`'s "Scope"); Anchor Route is narrower still, so it
   stays Settings-drawer-only.

   **Live verification (2026-07-30)**: built a scratch page
   (`converted_reports/claude_scratch_gap8_anchor`, one difference-mode Bar Graph fed
   by two route instances — "Before"/"After" windows on the same single-TMC route,
   deleted after use) via `report_build.mjs`. Via a headless Playwright script driving
   the real Settings drawer: (1) with no anchor pick made, the item is absent from the
   route list until Comparison Mode is `difference` and exactly 2 routes resolve —
   confirmed present with both route labels the moment both were true; (2) picking
   "After" then clicking the section's Save icon persisted
   `comparisonSeries.combine = {mode:"difference", invert:true}` and
   `_measurePick.anchorInvert:true` on the draft section row (confirmed via `dms raw
   get`) — captured live `/graph` traffic also showed the resulting per-bucket
   difference values with mixed signs, confirming the flip reached the actual query,
   not just stored state; (3) separately changing Resolution (day → hour) afterward
   left `invert:true` untouched — confirms the anchor pick survives unrelated
   Measure Picker re-composition; (4) picking "Before" again correctly cleared
   `invert` entirely (not left as `false`) — `combine` reverted to `{mode:
   "difference"}` byte-for-byte.
9. **A Measure Picker pick is unsaved (local draft only) until the floppy Save icon is
   explicitly clicked** — reload without saving silently discards it, no warning. The
   spec path has no equivalent draft state at all. UI fix: warn on navigate-away with
   unsaved changes, or auto-save.
10. **`weekdays` day-mask has zero UI control** despite the runtime already honoring it
   (`useGraphPublish.js:34`) — the spec can express "exclude weekends" today and the UI
   cannot. **Cheapest available win**: pure UI addition, no backend/runtime change
   needed at all. **IMPLEMENTED 2026-07-30** — a "Days of Week" 7-button toggle row
   (Su–Sa) plus Weekdays/Weekends/All Days presets, added to `RouteRow.jsx`'s existing
   date-edit block (same `isEditingDates` gating as the peak-hour presets from gap #11,
   since a weekday mask is a natural companion to a date range, not its own edit mode).
   `isDayOn`/toggle semantics mirror `useGraphPublish.js`'s "only an explicit `false`
   excludes" rule exactly. On save (`ReportRouteList.jsx`'s `onSaveEditDates`), the local
   edit state (a full 7-key boolean object, easiest to toggle) is normalized down to
   only its `false` entries before persisting — matching the existing storage
   convention (e.g. converted old reports' `{saturday:false,sunday:false}`) and
   collapsing to `undefined` (all days) when every toggle is back on, rather than
   persisting a same-meaning-but-verbose object. Also added a read-only summary line
   ("Weekdays only" / "Weekends only" / "Excludes Tu, We") shown next to the date range
   whenever a route has an active exclusion, so the mask is visible without entering
   edit mode — renders as nothing when unrestricted, so unaffected routes look
   unchanged. **DONE + live-verified 2026-07-30** on a scratch page
   (`converted_reports/claude_scratch_weekdays_gap10`, deleted after). Confirmed via
   `report_probe.mjs --auth --eval`: toggling Sat/Sun off and Saving persisted
   `weekdays":{"saturday":false,"sunday":false}` on the `reports_snap_2` row (only the
   `false` entries, not a full 7-key object); the graph's next live query captured by
   the probe carried exactly 9 dates (the 11-day `2026-04-20`→`30` range minus
   `2026-04-25`/`26`), with the InfoBox `travelTime` value changing accordingly
   (8.6559→8.6798 min). The "Weekends" preset correctly excluded Mon-Fri and showed a
   "Weekends only" summary; "All Days" cleared every exclusion and the follow-up query
   returned the exact original value (8.6559 min) byte-for-byte, confirming a clean
   round trip back to "no restriction." The read-only summary line
   ("Weekdays only"/"Weekends only") also survived a full page reload, confirming it
   reads the persisted shape correctly, not just client-side edit state.
11. **Peak-hour-only filtering isn't a first-class Resolution/control.** **DONE 2026-07-28**
    (both halves, same day). **Spec half**: `routes[].startTime`/`endTime` (`"HH:mm"`) expresses
    it, composed by `report_build.mjs` into the same combined date+time string `useGraphPublish.js`
    already turns into a real `epoch` filter — no runtime change needed, see `report-spec.md`'s
    `startTime`/`endTime` section for the design and live verification. **UI half**: a labeled
    peak-hour preset row (AM Peak/PM Peak/PM Peak (alt)/Midday/All Day, matching the non-wrapping
    windows in `data-types/map21/constants.js`'s `REPORTING_BINS`) was added next to
    `RouteRow.jsx`'s existing date+time `<Input>`s. Deliberately no named shorthand
    (`"peak":"am"/"pm"`) on the spec side — AM/PM windows vary by study, and the old tool's own
    peak checkboxes were dead code, so there's no real precedent to match; the UI presets are a
    convenience layer only, not a new spec concept.

    **Correction found while starting this work (2026-07-28, later session):** the framing above
    — and `report-spec.md`'s own text — claimed the time window was "inert" for Route Map and Info
    Box graphs specifically, implying gap #11 needed per-graph-type wiring beyond AVL Graph. Empirically
    false: both ride the same `comparisonSeries`/`useGraphPublish` mechanism as AVL Graph, which is
    element-type-agnostic (`findSelfBoundGraphs` never checks element-type). Live-verified with a
    real build: an Info Box `travelTime` graph and two Route Map `speed` graphs, each fed a route
    differing only by `startTime`/`endTime`, returned genuinely different values per arm over the
    identical TMC/date range (Info Box 8.615 vs 8.498 min; Route Map's live `colorDomain` re-break
    71.67 vs 70.69 mph) — with zero code changes. So the *only* real gap was the UI preset control,
    and because a route's date/time window is graph-type-agnostic, building it once in `RouteRow.jsx`
    closes gap #11 for AVL Graph, Route Map, AND Info Box simultaneously. See `report-spec.md`'s
    `startTime`/`endTime` section for the full correction and citations.

    **One narrower, separate gap found and left open:** Route Map's *build-time* choropleth bake
    (`pooled_route_map_values` in `convert_old_reports.py`, called from `composeMapGraphState`) has
    no epoch predicate — so a freshly-built report's initial/placeholder color breaks and first paint
    are whole-date-range, corrected only once the live `comparisonSeries` re-break runs client-side
    after page load. Not fixed in this pass (the page a viewer actually sees is already correct;
    this only affects the very first paint frame / a static export before the live re-break settles).
12. **RRL wiring changes to an existing difference-graph section sometimes need a
    manual re-open + re-save before the query fires** — root cause unclear (possibly
    fetchMode not re-triggering on route-assignment change vs. on Measure-pick apply).
    The spec path doesn't hit this (fires correctly on first load, verified 2026-07-27
    on page `2195822`) but a live UI author still can. Needs investigation, not yet
    root-caused.

### Cold-open gaps (found 2026-07-31)

A different axis from the gaps above: not measure/graph-composition parity, but the
first 60 seconds of using the tool cold, before a route or measure is ever touched.
Found via a live fresh-eyes walkthrough, not spec-vs-UI comparison — full writeup and
rationale in `research/npmrds-reports/cold-open-ux-findings.md`. Root cause for both is
DMS's generic page/section-editing chrome, not NPMRDS-specific code, but both land
directly in this workflow's first-run experience.

13. **Creating a report page gives no feedback or redirect.** "+ Add Page" → "Your
    Templates" → "Report Page" → "Create Page" creates the row and closes the dialog
    with zero visible change — the author is left on whatever page they were already
    on. The only way to find the new page is to already know to reopen the Pages tree
    or query the DB directly (which `creating-reports.md` documents as the workaround,
    not a bug). The new page also defaults to a generic, un-prompted title ("Page N").
    **Live-confirmed twice** 2026-07-31: once by reproducing it directly (page id
    `2197866`, slug `converted_reports/page_40`), once by Ryan hitting it independently
    mid-session before it was reported. Fix: redirect straight into the new page's
    `/edit/<slug>` on creation, ideally with an inline title prompt.
14. **The section Settings gear shows a reduced menu (Type/Dataset/Layout/Delete only)
    until an easy-to-miss pencil "Edit" icon is clicked** — only then do Measure,
    Columns, Filters, Display, and the Quick Controls pill row appear, with no visual
    cue beforehand that any of it exists. Already documented as expected behavior in
    `creating-reports.md` ("Click the gear, then the pencil...") but never tracked as a
    gap. Fix: either show the full menu by default in edit mode, or give the pencil an
    obvious "more settings" affordance.

### Graph display polish (found 2026-07-31)

15. **Measure Picker never composes Title/Description, unlike every other field it
    owns.** `composeMeasureConfig()` auto-sets `xAxis.label`/`format`/`epochMinutesPerUnit`,
    `yAxis.label` (units baked into the text, e.g. `"Speed (mph)"`), the yAxis column's
    `customName`, `fetchMode`, `join`, and all the ReportRouteList self-binding wiring on
    every Graph Type/Measure/Resolution/Comparison Mode pick (`composeMeasureConfig.js:142-199`)
    — but never touches `display.title.title` or `display.description`. An author who builds
    a report entirely through the Measure Picker (the intended, no-CLI path) still ends up with
    a chart that has no heading and no caption; title/description are the one part of "nicely
    formatted by default" that stays fully manual. Found 2026-07-31, user's stated position:
    for reports specifically, these should "automatically work nicely," not need a manual
    polish pass after every pick.

    **Not yet implemented** — no fix attempted this session, flagged for a future pass.
    Proposed direction (not designed in detail): default `title.title` from `measure.label`
    (reusing the same string already used for `yAxis.label`/`customName`), optionally folding
    in Resolution/Comparison Mode when non-default, mirroring the auto-generated base/comparison
    subtitle difference graphs already get on `display.description` (see memory
    `project_diff_graph_axis_and_label_clarity_fixed`). The real design problem: every other
    composed field is structured/derived data with exactly one correct value, so
    `applyMeasurePick` safely blind-overwrites it on every re-pick — title text is different,
    since an author is likely to have deliberately renamed it (e.g. to something route-specific),
    so a blind overwrite would clobber real authoring. Needs either (a) only set a default while
    the title is still empty, or (b) track "is this still the auto-generated title" the same way
    `display._measurePick` already tracks the last pick, so re-composition can tell a stale
    default apart from an intentional edit.

    **Related, already fixed 2026-07-31 (narrower, separate issue, not a substitute for this
    gap)**: the Report Page template's own baked-in starter graph — the static state a brand
    new report starts from, before any Measure Picker interaction at all — shipped with no
    axis labels, no units anywhere, and no title. Fixed directly on the DB template row
    (`2187021`) and on the one live page already open at the time (`page_40`/section `2197864`),
    by hand-setting `xAxis.label`/`yAxis.label`/`customName`/`title.title` to match the Measure
    Picker's own conventions. That fix only corrects the one-time starting point; it does nothing
    for the *ongoing* Measure Picker flow going forward, which is what this gap (#15) is about.

## Suggested priority order

Ranked by (fix cost) × (how often it bites someone), not file order above. #4, #5,
#8, #10, and #11 are already done (struck through, left in place so the ranking
rationale below still reads coherently) — pick up at #7 next.

1. ~~#4 route_id overwrite guard~~ — **DONE 2026-07-27** (clear Update/Save labeling;
   not a confirm dialog, see gap #4's entry above).
2. ~~#5 TMC search-to-add~~ — **DONE 2026-07-27** (Add button/Enter next to the search
   box, see gap #5's entry above).
3. ~~#10 weekdays UI control~~ — **DONE + live-verified 2026-07-30** (see gap #10's
   entry above).
4. ~~#8 difference-graph anchor UI affordance~~ — **DONE + live-verified 2026-07-30**
   (an "Anchor Route" item in the graph's own Measure Picker; see gap #8's entry
   above).
5. **#7 RRL rename control** — needs the existing fragile input-commit bug root-caused
   first.
6. **#6 RRL pill silent-fail** and **#12 re-save-needed** — both need investigation
   before a fix is even scoped; group them since they may share a root cause (some
   RRL/graph-state update not propagating to the query layer without an explicit
   Measure-pick save).
7. **#2 TMC search `-` code bug** (investigated 2026-07-27, could not reproduce,
   dropped per user), **#3 hover popover** — route-creation polish, lower traffic than
   the report-building gaps.
8. ~~#11 peak-hour filtering~~ — **DONE 2026-07-28** (both halves; see gap #11's entry
   above, including the "inert for Map/Info Box" correction).
9. **#13 Add Page no-redirect** and **#14 Settings-gear discoverability** — not ranked
   against #1-#12 above on the same (fix cost) × (frequency) basis; they're cold-open
   friction, hit once per new page/section rather than repeatedly during authoring, but
   both are cheap and high-visibility since they're the very first thing a fresh author
   sees. See `research/npmrds-reports/cold-open-ux-findings.md` for why this is a
   separate axis from the rest of this list.
10. **#15 Measure Picker title/description auto-fill** — high visibility (every report
    graph built through the UI shows it) but needs a real design decision first (the
    don't-clobber-a-custom-title problem, see gap #15's entry above) before it's cheap to
    build — not a same-session fix.

## Testing checklist

- [x] Gap #4 (`route_id` overwrite labeling) — DONE + live-verified 2026-07-27, both on
      post-save navigation and on a cold page load with `?route_id=...` already present.
- [x] Gap #5 (TMC Search-to-add) — DONE + live-verified 2026-07-27: real TMC added with
      zero map clicks, fake TMC correctly left the Add button disabled.
- [x] Gap #11 spec half (`startTime`/`endTime`) — DONE + live-verified 2026-07-28: two
      route instances sharing one route_id, distinct AM/PM windows, live query capture
      showed distinct `epoch` filter lists per series and rendered values matching a
      direct ClickHouse query to 5 decimal places.
- [x] Gap #11 UI half (peak-hour preset control) — DONE + live-verified 2026-07-28: a
      dedicated build confirmed both Route Map and Info Box already apply the epoch
      filter live with zero code changes (corrects the earlier "inert" claim); the new
      `RouteRow.jsx` preset row was verified end-to-end via a real edit/save cycle —
      preset buttons disabled with no dates set, enabled once set, each preset writes
      the correct `HH:mm` pair, "All Day" clears both, and Save persists + triggers a
      live re-query reflecting the new window (Info Box travel time value changed
      after save, matching the applied AM Peak window).
- [x] Gap #10 (weekdays UI control) — DONE + live-verified 2026-07-30: toggle buttons,
      the "Weekends"/"All Days" presets, the persisted storage shape (`false`-only
      keys), the live re-query's date-list shrinkage, and the read-only summary
      line's survival across a page reload all confirmed on a scratch page (deleted
      after). Not yet ported to transportNY's divergent `ReportRouteList` copy — do
      that as a separate step if/when transportNY needs it (see
      `project_reportroutelist_dms_template_transportny_divergence`).
- [x] Gap #8 (difference-graph anchor UI affordance) — DONE + live-verified
      2026-07-30: "Anchor Route" item appears in the graph's Measure Picker only when
      Comparison Mode is `difference` and exactly 2 routes resolve for that graph;
      picking the second-assigned route persisted `combine.invert:true` (confirmed via
      `dms raw get`, plus live `/graph` traffic showing the flipped-sign values);
      changing an unrelated field (Resolution) afterward left `invert:true` untouched;
      reverting the pick correctly cleared `invert` entirely rather than leaving
      `false`. Not yet ported to transportNY (same divergence noted for gap #10).
- [ ] Gap #2 investigated 2026-07-27 (could not reproduce, dropped) — remaining gaps
      (#1, #3, #6, #7, #9, #12, #13, #14, #15) not started. Pick one gap per session per
      `feedback_isolate_shared_code_changes` if the fix touches shared theme/library
      code (most of these do: `ReportRouteList/`, `MeasurePicker/`, the routecreation
      map component).

## Progress log

- **2026-07-27** — File created as part of Phase A (skill split). Gaps extracted
  verbatim from `src/dms/skills/creating-routes-and-reports.md`'s "Known UI gaps"
  section plus the peak-hour and difference-graph-anchor notes embedded elsewhere in
  that file. No fixes attempted yet.
- **2026-07-27 (later session)** — First two fixes of Phase C. Gap #4 (`route_id`
  overwrite guard) closed via clear Update/Save labeling (no confirm dialog — user
  asked for wording, not a blocking prompt). Gap #5, a newly-noticed capability
  (TMC Search box could zoom but not add), added to this file and fixed same-session:
  an Add button/Enter next to the search box now adds the TMC directly, reusing the
  existing zoom-validation call so there's no duplicate query. Both live-verified in
  transportNY (`comp.jsx`, `RouteEditor.jsx`, `SaveRouteModal.jsx`). Gap #2 (TMC search
  `-` code bug) was investigated live the same session — three repro attempts and a
  direct server-side replay of the backing falcor query all came back correct — and
  dropped per user decision rather than kept open without a reproducible trigger.
  `src/dms/skills/creating-routes.md` updated to match all three outcomes. Report-
  building gaps renumbered #5-#11 → #6-#12 to make room for the new route-creation gap
  #5 (was colliding with the pre-existing report-building #5). See memory
  `project_routecreation_search_add_and_route_id_labels`.
- **2026-07-28** — Gap #11's spec half fixed: `routes[].startTime`/`endTime` added to
  `report_build.mjs`/`report-spec.md`, reusing `useGraphPublish.js`'s existing (since
  2026-06-23) epoch-filter mechanism verbatim — no runtime change. Live-verified with a
  two-instance AM/PM-peak LineGraph build; `report_probe.mjs`'s network capture showed
  the two series' `epoch` filter lists differing exactly as specified and rendered
  values matching a direct ClickHouse query to 5 decimal places. `--from-page` verified
  round-tripping correctly in both the no-drift echo path and, after forcing drift with
  a hand-edited section title, the live-reconstruction path. Also found, not fixed: the
  `--from-page` drift check has never compared the snap row's own `routes` field against
  the stored spec, so a route hand-edited live (date/time included) can go undetected —
  pre-existing, newly relevant now that peak windows make routes more likely to be
  hand-tweaked post-build. UI half of gap #11 (a labeled peak-hour control) untouched.
  Full design/verification writeup in `report-spec.md`'s `startTime`/`endTime` section.
- **2026-07-28 (later session)** — Gap #11's UI half, prompted by the user pointing at
  `data-types/map21/constants.js`'s `REPORTING_BINS` for real FHWA AM/PM window
  definitions. Before building anything, ran a live empirical test (not just code
  reading) to check the premise that Route Map/Info Box needed graph-type-specific
  wiring — built a real report with a route carrying `startTime`/`endTime` fed to an
  Info Box `travelTime` graph and two Route Map `speed` graphs, and captured the actual
  network traffic. Result: both already applied the epoch filter live and returned
  different, correct values per time window, with **zero code changes** — the "inert"
  claim this same file and `report-spec.md` made earlier the same day was wrong (see
  the correction now in both files). So the only real remaining gap was the UI control
  itself, and because `RouteRow.jsx`'s date+time inputs are graph-type-agnostic (one
  route object feeds whatever graphs it's assigned to), a single addition there closes
  gap #11 for AVL Graph, Route Map, and Info Box at once. Shipped: a peak-hour preset
  row (AM Peak 06:00–10:00, PM Peak 16:00–20:00, PM Peak (alt) 15:00–19:00, Midday
  10:00–16:00, All Day) in `RouteRow.jsx`/`ReportRouteList.theme.js`, mirroring
  `REPORTING_BINS`'s non-wrapping windows (`OVN`/`FREEFLOW` excluded per user decision —
  both wrap past midnight, which `generateEpochRange`'s plain `start<=end` loop can't
  express). User also declined pairing a `WE` preset with the `weekdays` mask (gap #10,
  separate and not yet built) to keep this control strictly time-of-day.

  **Live-verified end-to-end**, and only after discovering mid-verification that the
  browser's dev server on port 5173 was transportNY's (which carries its own divergent
  `RouteRow.jsx` copy per `project_reportroutelist_dms_template_transportny_divergence`)
  — started dms-template's own Vite dev server (came up on port 5174, 5173 already
  taken) and re-tested against that. Confirmed via a scripted edit/save cycle: preset
  buttons disabled with no dates set, enabled once a start/end date is present, each
  preset writes the correct `HH:mm` pair to both time inputs, "All Day" clears both, and
  clicking Save persists the change and triggers a live re-query whose returned value
  changed to match the newly-applied window. All test pages/sections/snap rows deleted
  after (page `2196804` + 6 sections + snap row `2196811` for the Map/Info Box wiring
  check; page `2196813` + 4 sections + snap row `2196818` for the UI test).

  **Ported to transportNY the same session, per user request.** `RouteRow.jsx` and
  `ReportRouteList.theme.js` copied as-is to transportNY's divergent copy
  (`src/dms_themes/transportny/components/ReportRouteList/`) — trivial this time since
  the diff added no new imports (nothing to rewrite for the `dms` submodule's
  different path in that repo) and both files were confirmed byte-identical to
  dms-template's pre-edit `git show HEAD` version before copying, so there was no
  drift to reconcile first. Live-verified again on transportNY's own running dev
  server (port 5173) via `report_probe.mjs --host http://npmrds.localhost:5173` —
  identical result to the dms-template test above. Not committed in either repo
  (working tree only, same as every other uncommitted fix in this file). Test page
  `2196819` + 4 sections + snap row `2196824` deleted after. See
  `project_reportroutelist_dms_template_transportny_divergence` memory for the port
  mechanics.

- **2026-07-30** — Gap #10 (weekdays UI control) implemented in dms-template only so
  far (not yet ported to transportNY — that's a separate step once this is
  live-verified, per the divergence memory). Added a "Days of Week" toggle row
  (Su–Sa + Weekdays/Weekends/All Days presets) to `RouteRow.jsx`'s existing
  `isEditingDates` block, alongside the peak-hour presets from gap #11 — grouped
  there rather than as its own edit mode since a weekday mask is naturally a
  companion to the date range being edited, not a separate concept (and the user
  had already declined mixing a day-of-week preset into the *time-of-day* row
  specifically, back in gap #11 — this is a distinct control, not that one).
  `ReportRouteList.jsx`'s `onSaveEditDates` normalizes the local 7-key boolean edit
  state down to only its `false` entries before calling `updateRoute` (which already
  handled arbitrary fields generically, so no change needed there), matching the
  storage convention converted old reports already use and collapsing back to
  `undefined` when every day is re-enabled. Also added a read-only summary line
  next to the date range (outside edit mode) so an active exclusion is visible
  without opening the editor. Built a scratch verification page via
  `report_build.mjs` (`converted_reports/claude_scratch_weekdays_gap10`, page
  `2197817`, sections `2197818-20`, snap row `2197821` — one InfoBox `travelTime`
  graph, one route on known-good `route_id` 2126095, `2026-04-20`→`2026-04-30`, no
  weekend exclusion in the spec) to click through in the browser, but the first
  `report_probe.mjs --auth` run hung waiting for the route row's expand button —
  root cause: `scratchpad/npmrds-sub/.dms-auth-token` was >6h old (minted the
  previous day) and the dev site's JWTs expire at 6h, so the page silently
  rendered as anonymous (no edit UI at all) rather than erroring. Incorrectly
  asked the user to run `mint_token.sh` themselves instead of just running it — the
  user corrected this (again; see the updated [[feedback-mint-token-yourself]]
  memory) and minted it. Re-ran the probe with the fresh token and it worked
  immediately, confirming the earlier failure really was just token staleness, not
  a deeper browser-auth issue (the user separately clarified, correctly, that a
  minted token alone doesn't grant a real logged-in browser session in general —
  but this specific script's `--auth` flag sidesteps that by injecting the token
  straight into a fresh headless browser's `localStorage` before navigation, which
  doesn't need one). Two eval passes (`weekdays_gap10_eval.mjs` +
  `weekdays_gap10_eval2.mjs`, both under the job's tmp dir) confirmed everything in
  the entry above. Cleanup used `dms raw delete <app> <type> <id>` — first attempt
  passed the wrong positional args (extra bare ids where the CLI expects `<app>
  <type> <id>` per call) and silently "succeeded" against a non-existent app/type
  combo without actually deleting anything; re-ran with each row's real app/type
  (fetched via `dms raw get`, except the `:data` snap row whose type was already
  known from the captured network payload) and confirmed via a follow-up `raw get`
  that every row was actually gone.

- **2026-07-30, gap #8 (difference-graph anchor UI affordance):** asked the user
  whether the "Main" control should live on the RRL graph-pill (as the gap's
  original writeup suggested) or inside the graph's own Measure Picker — RRL's own
  README explicitly documents that a cross-section write from RRL into a graph's
  row was considered and rejected once already (the `graph_comps` leak), which
  would have been required for the RRL-pill option since RRL's `apiUpdate` is
  scoped only to its own row. User picked the Measure Picker option, consistent
  with that prior architectural decision. Implementation needed `pageState`
  threaded through `getSectionMenuItems`/the `sectionMenuExtensions` builder call
  (previously only `sectionState` reached extensions) so the picker could read the
  same resolved route order RRL publishes per graph, plus a new `anchorInvert`
  field in the Measure Picker's persisted `_measurePick` state (mirroring how
  graphType/measure/resolution/comparisonMode already survive re-composition) so
  picking an anchor doesn't get silently reset by an unrelated later pick. Built a
  scratch page via `report_build.mjs` (two route instances feeding one
  difference-mode Bar Graph) and drove the real Settings drawer with a headless
  Playwright script — see gap #8's entry above for the full verification writeup.
  Confirmed via `dms raw get` at each step rather than trusting on-screen labels
  alone, and confirmed real `/graph` traffic reflected the sign flip, not just
  stored config. Deleted the scratch page (page + 3 sections + draft-history row)
  via `dms raw delete` afterward; left the orphaned `reports_snap_2` row alone
  rather than risk a wrong delete on a split-table row (matches this project's
  existing caution around `reports_snap_2` row deletes).

- **2026-07-31** — Triggered by Ryan asking why the tool still "feels incomplete"
  despite this list steadily shrinking. Investigation (docs review + a live fresh-eyes
  walkthrough of the actual click-path, not the spec/script path) found a second,
  orthogonal axis of gaps — first-60-seconds cold-open friction, not measure/graph
  parity — added here as gaps #13/#14. Full writeup, live evidence, and the broader
  diagnosis (the team's real workflow moved to the spec/script path, so the UI stopped
  getting fresh-eyes dogfooding, which is *why* this category survived undetected) in
  `research/npmrds-reports/cold-open-ux-findings.md`. Scratch page
  `converted_reports/page_40` (id `2197866`) left live as a reproduction artifact.

- **2026-07-31 (later session)** — Ryan reported `page_40`'s default graph had raw
  epoch-index x-axis ticks (`20`, `63`...) instead of clock time. Traced to the
  "Report Page" DB template (`2187021`)'s baked-in starter AVL Graph section never
  having `xAxis.format: "epoch_time"` set — fixed directly on the template row and on
  `page_40`'s own section (`2197864`). Follow-up from the same screenshot: neither
  axis had a label, the graph had no title, and no units appeared anywhere. Traced to
  the same starter graph never having `xAxis.label`/`yAxis.label`/the yAxis column's
  `customName`/`title.title` set either — fixed the same way (template row +
  `page_40`), values (`"Time of Day"` / `"Speed (mph)"`) confirmed against a real,
  already-correct report (NY-9D Beacon, section `2197361`) rather than invented.
  Per user instruction, no other already-existing live pages were bulk-patched — only
  the template (so new pages inherit it) and the one page already open.

  Prompted a broader question from Ryan: does this level of polish (axis
  labels/units/epoch formatting) actually happen automatically for an author using the
  real UI + Measure Picker, or is it CLI/expert-only? Traced the actual code path
  (`MeasurePicker/index.js`'s `applyMeasurePick`/`npmrdsMeasureMenu`,
  `composeMeasureConfig.js`) — confirmed it's genuine, live-verified UI functionality:
  picking Graph Type/Measure/Resolution/Comparison Mode from the Settings-drawer
  Measure item auto-composes `xAxis`/`yAxis` label+format+units, `fetchMode`, `join`,
  and the ReportRouteList wiring, gated only on the page being a report (a
  `ReportRouteList` sibling section). But it never composes `title.title` or
  `description` — confirmed by reading `composeMeasureConfig.js` line-by-line, no
  patch touches either field. Ryan's response: that's a real gap and reports should
  auto-populate title/description too — added as gap #15 above (design not attempted
  this session: the "don't clobber an author's custom title" problem needs a decision
  before implementation, since title text isn't a single-correct-value field like the
  others this picker composes).
