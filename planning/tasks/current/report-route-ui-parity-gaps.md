# NPMRDS route/report UI parity gaps (Phase C)

**Status:** IN PROGRESS — 3 of 12 gaps fixed so far (#4 `route_id` overwrite labeling,
#5 TMC Search-to-add, both live-verified 2026-07-27 in transportNY; #11 peak-hour filtering,
both spec and UI halves, live-verified 2026-07-28 in dms-template AND ported + re-verified
in transportNY the same day — see its entry below, including a correction to the "inert for
Map/Info Box" claim made earlier the same day).
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

## Gaps

### Route creation (transportNY, `creating-routes.md`)

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
   needed). UI fix would be an explicit "Main" affordance on the RRL graph-pill instead
   of implicit ordering.
9. **A Measure Picker pick is unsaved (local draft only) until the floppy Save icon is
   explicitly clicked** — reload without saving silently discards it, no warning. The
   spec path has no equivalent draft state at all. UI fix: warn on navigate-away with
   unsaved changes, or auto-save.
10. **`weekdays` day-mask has zero UI control** despite the runtime already honoring it
   (`useGraphPublish.js:34`) — the spec can express "exclude weekends" today and the UI
   cannot. **Cheapest available win**: pure UI addition, no backend/runtime change
   needed at all.
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

## Suggested priority order

Ranked by (fix cost) × (how often it bites someone), not file order above. #4, #5, and
#11 are already done (struck through, left in place so the ranking rationale below
still reads coherently) — pick up at #10 next.

1. ~~#4 route_id overwrite guard~~ — **DONE 2026-07-27** (clear Update/Save labeling;
   not a confirm dialog, see gap #4's entry above).
2. ~~#5 TMC search-to-add~~ — **DONE 2026-07-27** (Add button/Enter next to the search
   box, see gap #5's entry above).
3. **#10 weekdays UI control** — cheapest of what's left, purely additive, runtime
   already correct.
4. **#8 difference-graph anchor UI affordance** — moderate, closes a coin-flip footgun
   the spec already proves is fixable (just needs a UI equivalent of the `anchor`
   field).
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
- [ ] Gap #2 investigated 2026-07-27 (could not reproduce, dropped) — remaining gaps
      (#1, #3, #6-#10, #12, #11's UI half) not started. Pick one gap per session per
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
