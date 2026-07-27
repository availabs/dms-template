# NPMRDS route/report UI parity gaps (Phase C)

**Status:** NOT STARTED. This is Phase C of the three-phase arc in
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
3. **Hover popovers show TMC code only, no street name** — sometimes a click is needed
   instead of hover to identify a segment. Minor; a tooltip enrichment.
4. **`route_id` in the map-tool URL means "editing this route"** — reusing an existing
   route's URL as a scratch pad silently overwrites it on Save, with no confirmation
   dialog. Real footgun; the fix is cheap (a confirm-before-overwrite guard when
   `route_id` is present) and worth doing regardless of spec parity.

### Report building (`creating-reports.md`)

5. **RRL's per-instance "ON: Graph N" pill can silently fail to persist** — no error
   shown either way; only detectable by querying `data->'route_comps'` afterward. The
   spec path avoids this by construction (`routes[].graphs` is declarative, `graphIds`
   is computed) but the UI bug itself is still live and worth root-causing.
6. **RRL has no reliable per-instance rename** — two instances of the same route can't
   be given distinct display labels, only distinct dates/colors. Cheapest workaround
   today is naming the underlying route sensibly up front; a real fix needs the rename
   control's input-commit bug found (typed text doesn't reliably commit).
7. **Difference-graph anchor is "whichever instance was added to the report first"**
   (`route_comp_id` order) — invisible in the UI, so getting the sign right is a
   coin-flip unless you already know the add-order convention. The spec's `anchor`
   field fixes this outright (names the arm explicitly, sets `combine.invert` as
   needed). UI fix would be an explicit "Main" affordance on the RRL graph-pill instead
   of implicit ordering.
8. **A Measure Picker pick is unsaved (local draft only) until the floppy Save icon is
   explicitly clicked** — reload without saving silently discards it, no warning. The
   spec path has no equivalent draft state at all. UI fix: warn on navigate-away with
   unsaved changes, or auto-save.
9. **`weekdays` day-mask has zero UI control** despite the runtime already honoring it
   (`useGraphPublish.js:34`) — the spec can express "exclude weekends" today and the UI
   cannot. **Cheapest available win**: pure UI addition, no backend/runtime change
   needed at all.
10. **Peak-hour-only filtering isn't a first-class Resolution/control** — a client ask
    for "just the AM/PM peak" currently needs a manual Filters entry (epoch range) via
    the generic Filters menu. Affects both the spec and the UI equally (the spec has no
    shorthand for it either) — this one needs a real design decision (new resolution
    values? a `peakWindow` spec field?) before it's a quick add, unlike #9.
11. **RRL wiring changes to an existing difference-graph section sometimes need a
    manual re-open + re-save before the query fires** — root cause unclear (possibly
    fetchMode not re-triggering on route-assignment change vs. on Measure-pick apply).
    The spec path doesn't hit this (fires correctly on first load, verified 2026-07-27
    on page `2195822`) but a live UI author still can. Needs investigation, not yet
    root-caused.

## Suggested priority order

Ranked by (fix cost) × (how often it bites someone), not file order above:

1. **#9 weekdays UI control** — cheapest, purely additive, runtime already correct.
2. **#4 route_id overwrite guard** — cheap, prevents real data loss.
3. **#7 difference-graph anchor UI affordance** — moderate, closes a coin-flip footgun
   the spec already proves is fixable (just needs a UI equivalent of the `anchor`
   field).
4. **#6 RRL rename control** — needs the existing fragile input-commit bug root-caused
   first.
5. **#5 RRL pill silent-fail** and **#11 re-save-needed** — both need investigation
   before a fix is even scoped; group them since they may share a root cause (some
   RRL/graph-state update not propagating to the query layer without an explicit
   Measure-pick save).
6. **#2 TMC search `-` code bug**, **#3 hover popover** — route-creation polish, lower
   traffic than the report-building gaps.
7. **#10 peak-hour filtering** — real gap but needs a design decision first, not just
   an implementation.

## Testing checklist

- [ ] Not started — pick one gap per session per `feedback_isolate_shared_code_changes`
      if the fix touches shared theme/library code (most of these do:
      `ReportRouteList/`, `MeasurePicker/`, the routecreation map component).

## Progress log

- **2026-07-27** — File created as part of Phase A (skill split). Gaps extracted
  verbatim from `src/dms/skills/creating-routes-and-reports.md`'s "Known UI gaps"
  section plus the peak-hour and difference-graph-anchor notes embedded elsewhere in
  that file. No fixes attempted yet.
