# ReportRouteList — UX, add-flow, and persistence history

## Current status

`ReportRouteList` (RRL) is the sidebar panel that manages a report's routes and publishes each
one's assignment to the graph sections on the page. For how it's architected (storage model,
`$self` graph binding, edit-mode gating) see the `dms` submodule's
[`reportroutelist-page-templates.md`](../../../src/dms/planning/tasks/current/reportroutelist-page-templates.md)
— that's the living reference doc, not duplicated here. This file tracks the UX/feature history:
hooks refactor, visual polish, and the add-route flow's evolution through three rounds.

| Round | What | Status |
|---|---|---|
| graphIds persistence fix (2026-07-20) | route→graph chip assignments didn't survive refresh/publish | **FIXED**, tracked separately in the `dms` submodule's [`reportroutelist-graphids-wiped-on-refresh.md`](../../../src/dms/planning/tasks/current/reportroutelist-graphids-wiped-on-refresh.md) |
| add-by-DMS-id fix (2026-07-24) | catalog click silently failed for routecreation-tool-made routes (keyed on a legacy `route_id` field they never had) | **FIXED**, historical — see archive; the click-publish mechanism this fixed was later replaced entirely by the 2026-07-29 rebuild below |
| UX polish + hooks refactor (2026-07-21) | split into hooks/subcomponents, visual polish, first round of add-flow improvements | **DONE**, live-verified |
| Add-route flow rebuild (2026-07-29) | replaced the separate catalog-section + confirm-banner flow with an inline recent/search box in RRL itself | **DONE**, live-verified end-to-end |

Full implementation detail (code traces, file tables, live-verification walkthroughs) for the
2026-07-21 and 2026-07-29 rounds is in
[`reportroutelist-archive.md`](./reportroutelist-archive.md) — this file merges what used to be
two separate task files (`reportroutelist-ux-polish.md`, `add-route-flow-improvements.md`).

## Hooks refactor + visual polish (2026-07-21)

Split the original ~772-line `ReportRouteList.jsx` into `useReportRow.js` (persistence),
`useGraphPublish.js` (graph discovery/publish), and `RouteRow.jsx`/`AddRouteBanner.jsx`
(presentation) — a no-op refactor verified against existing behavior before adding anything.
Visual polish: route-count header, "unassigned to any graph" badge, TMC-list truncation past 6
with a "+N more" toggle, loading skeleton, empty-state copy.

First round of add-flow improvements (superseded by the 2026-07-29 rebuild below, kept here for
history): moved the pending-add confirm banner to the top of the panel with a route preview and a
soft "already in this report" duplicate notice; a local client-side search box over the
already-added route list (unrelated to the catalog search added in 2026-07-29 — this one only
filters what's already on the report). Config-only: enabled `serverFilter`/raised `pageSize` on
the catalog Spreadsheet's template.

**Bringing route browse/search/add fully inline into RRL itself** was identified as the better
long-term direction but deliberately deferred this round as too big a lift — this is exactly what
the 2026-07-29 rebuild below did.

## Add-by-DMS-id fix (2026-07-24, historical)

The catalog's click-to-add mechanism (at the time: a `click_publish` Spreadsheet section +
confirm banner) was keyed on a legacy `route_id` field that only old-imported routes ever had —
routes created via the routecreation tool had no `route_id`, so clicking them did nothing, silently.
Fixed by switching to the route's real DMS `id`. Required a DB migration across 79 live section
copies on 40 existing report pages (the `click_publish` config is frozen per-page, not shared from
the template). Full detail in the archive — kept here as history since the mechanism it patched
(`fetchDynamicRoute`, `click_publish`, `AddRouteBanner`) was itself replaced entirely five days
later by the round below.

## Add-route flow rebuild (2026-07-29)

Replaced the two-piece flow (separate catalog Spreadsheet section + `click_publish` + confirm
banner) with a single inline "Add a route" box directly in RRL: empty input shows the most
recently created routes; typing 2+ characters searches by name; clicking a result adds
immediately, no confirm step. The standalone catalog section was removed from the Report Page
template entirely.

Two real bugs found and fixed during verification:
- **Postgres `NULLS FIRST` on `ORDER BY created_at DESC`** — undated legacy rows (no `created_at`)
  sorted ahead of genuinely recent ones; fixed with a `notempty` filter on that column.
- **Two independent report-building tools** (`report_build.mjs` and the production
  `convert_old_reports.py` conversion pipeline) each had their own hardcoded assumption that a
  template Spreadsheet section named "Add a Route to Your Report" exists, and unconditionally
  cloned it into every new/converted page. Both fixed to stop expecting it — the
  `convert_old_reports.py` instance was the more consequential one, since it would have broken the
  very next production conversion run, not just a hypothetical.

## Open items

- **Stray duplicate `reports_snap_2` rows** from the pre-2026-07-20 graphIds bug are still in the
  DB (page 13 confirmed, likely others) — cleanup needs explicit user authorization before any
  deletes, per standing policy. Inert garbage, not an active bug (only the latest row per
  `report_id` is ever read).
- **The graphIds fix's "ghost routes from another report" symptom** — the task file that shipped
  the fix left this explicitly unvalidated. It was later re-tested informally (a fresh report from
  the template showed no ghost routes) and appears resolved on its own, but was never re-verified
  against the original repro steps. Treat as probably-fine, not formally closed.
- **Publish-path (not just refresh) for the graphIds fix** was never separately re-tested — same
  read mechanism as refresh, expected to work, not explicitly re-checked.
- A separate, unrelated dev-server crash (`buildJoin`/`getJoinedTileData`, a map-tile-join
  `TypeError`) recurred twice during the graphIds investigation — flag if it recurs again, not
  otherwise tracked here.

## Cross-repo note

transportNY has its own separate copy of this component (`src/dms_themes/transportny/components/ReportRouteList/`),
introduced by a straight copy in 2026-07-08 with no ongoing sync mechanism. Whether that copy's
code currently matches dms-template's is **not tracked here and not a live concern** — see
[`research/npmrds-reports/reportroutelist-cross-repo-sync.md`](../../../research/npmrds-reports/reportroutelist-cross-repo-sync.md)
for the historical record of how and why the two diverged, kept for reference, not as a sync
tracker.

## Cross-references

- `src/dms/planning/tasks/current/reportroutelist-page-templates.md` — architecture (storage,
  `$self` graph binding, edit-mode gating), still current
- `src/dms/planning/tasks/current/reportroutelist-graphids-wiped-on-refresh.md` — the persistence
  bug fix, open items noted above
- `research/npmrds-reports/reportroutelist-cross-repo-sync.md` — cross-repo history (historical
  record only)
- `src/themes/transportny/components/ReportRouteList/README.md` — component-level usage/storage
  doc, co-located with the code
- [`reportroutelist-archive.md`](./reportroutelist-archive.md) — full historical detail
