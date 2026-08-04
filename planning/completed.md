# DMS Template Completed Tasks

Grouped by project, same hierarchy as [`todo.md`](./todo.md). See
[`planning-rules.md`](./planning-rules.md) for the project registry.

## TransportNY

### themes

- [ReportRouteList: UX polish, add-flow, and persistence history](./transportny/tasks/current/reportroutelist.md) - hooks/subcomponent refactor (`useReportRow`, `useGraphPublish`, `RouteRow`), visual polish (route count, unassigned badges, TMC truncation), and the add-route flow's evolution through three rounds (2026-07-21 banner-to-top, 2026-07-24 add-by-DMS-id fix, 2026-07-29 full inline search/add rebuild). Merged 2026-07-30 from two task files (`reportroutelist-ux-polish.md`, `add-route-flow-improvements.md`) — full history in `reportroutelist-archive.md`. (2026-07-21 through 2026-07-29)
- [AVL Graph quick controls — inline Measure/Comparison Mode pills in the card header](./transportny/tasks/current/report-page-redesign.md) - report-page redesign Gap 01, Variant A: refactored `MeasurePicker` to share its apply-logic (`applyMeasurePick`/`isReportPage`) with a new header-row `QuickControls` component (Measure dropdown pill + Comparison Mode toggle pill), registered via the new `sectionHeaderExtensions` library primitive. Fully live-verified — pill/drawer state sync, non-report-section gating, and multi-card independence all confirmed on real report pages. (A claim made during this task, that the View-mode section Settings trigger is `display:none` at all desktop widths, was investigated further the same day and retracted — not a real bug.) (2026-07-22; merged 2026-07-30 with Gaps 02/03 into `report-page-redesign.md`, see that file's own status)
- [Port transportNY map plugins into dms-template via theme](./transportny/tasks/completed/port-transportny-map-plugins.md) - map plugins (`routecreation`, `macroview`) now load via a new `theme.mapPlugins` key instead of existing only in transportNY. Both ported to `src/themes/transportny/components/{routecreation,macroview}/` and live-verified 2026-07-29 (routecreation: full click-to-select pipeline including real falcor data fetch; macroview: crash fixed + map/legend/filters all render with real data). `rerouter` explicitly deferred until a coworker/client asks; `pointselector`/`routing` excluded (dead/unconfirmed usage). Known gaps: routecreation's marker/auto-route mode and save/load untested; macroview's Data Downloader (needs a `MapEditorContext.DAMA_HOST` upstream) and MapEditor-side controls untested. **This closes the last reason routes/reports development ever needed the transportNY repo** — see the update notes added the same day to `creating-routes.md`, `creating-reports.md`, and `research/npmrds-reports/reportroutelist-cross-repo-sync.md`.

## MitigateNY

### themes

- [MNY design-system `reports/` folder + Duplicate & Boilerplate action reports](./mitigateny/tasks/completed/mny-actions-analysis-reports.md) - introduced a `reports/` area in the MitigateNY design system for HTML analysis outputs that are *not* meant to migrate to DMS, moved the existing Actions QA report there, and added two data-backed reports (Duplicate Actions, Boilerplate Actions) plus their analysis scripts in `references/actions/`. (2026-07-16)

## Landbank

_(none yet)_

## Tessera

_(none yet)_

## Shared

_(none yet)_
