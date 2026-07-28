# NPMRDS route/report UI parity gaps (Phase C)

**Status:** IN PROGRESS — 2 of 12 gaps fixed so far: #4 (`route_id` overwrite labeling)
and #5 (TMC Search-to-add), both live-verified 2026-07-27 in transportNY. Gap #2 (TMC
search `-` code bug) was investigated live the same day and dropped — could not
reproduce, see its entry below. This is Phase C of the three-phase arc in
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
11. **Peak-hour-only filtering isn't a first-class Resolution/control** — a client ask
    for "just the AM/PM peak" currently needs a manual Filters entry (epoch range) via
    the generic Filters menu. Affects both the spec and the UI equally (the spec has no
    shorthand for it either) — this one needs a real design decision (new resolution
    values? a `peakWindow` spec field?) before it's a quick add, unlike #9.
12. **RRL wiring changes to an existing difference-graph section sometimes need a
    manual re-open + re-save before the query fires** — root cause unclear (possibly
    fetchMode not re-triggering on route-assignment change vs. on Measure-pick apply).
    The spec path doesn't hit this (fires correctly on first load, verified 2026-07-27
    on page `2195822`) but a live UI author still can. Needs investigation, not yet
    root-caused.

## Suggested priority order

Ranked by (fix cost) × (how often it bites someone), not file order above. #4 and #5
are already done (struck through, left in place so the ranking rationale below still
reads coherently) — pick up at #10 next.

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
8. **#11 peak-hour filtering** — real gap but needs a design decision first, not just
   an implementation.

## Testing checklist

- [x] Gap #4 (`route_id` overwrite labeling) — DONE + live-verified 2026-07-27, both on
      post-save navigation and on a cold page load with `?route_id=...` already present.
- [x] Gap #5 (TMC Search-to-add) — DONE + live-verified 2026-07-27: real TMC added with
      zero map clicks, fake TMC correctly left the Add button disabled.
- [ ] Gap #2 investigated 2026-07-27 (could not reproduce, dropped) — remaining gaps
      (#1, #3, #6-#12) not started. Pick one gap per session per
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
