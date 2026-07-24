# DMS Template Todo

## themes

- [ ] See [`documentation/reportroutelist-cross-repo-sync.md`](../documentation/reportroutelist-cross-repo-sync.md) — `ReportRouteList` is manually duplicated into transportNY (`src/dms_themes/transportny/components/ReportRouteList/`) with no sync mechanism; any change here must be manually ported there, including a submodule-path rewrite (`src/dms` → `src/modules/dms`). Last full sync 2026-07-24.
- [ ] [MNY — Action Prioritize (list view) redesign in the design system](./tasks/current/mny-actions-prioritize-list-design.md) — new `pages/actions-prioritize.html` + DS additions (tier pills, linked stat strip, filter bar). Flags two platform gaps needed for a later live build: an active-when-search-param-matches cell hint, and an is-empty filter leaf.
- [ ] [MNY — build "Prioritize Actions (List)" live in the county-template pattern](./tasks/current/mny-action-prioritize-v2-live-build.md) — 3-phase: (1) working interactive page next to `action_prioritize` from existing primitives, (2) style via mny theme `activeStyle`s, (3) new platform features (active stat cell, empty-filter op, tier-pill column type, progress metric — escalated to `src/dms/planning/`).
- [ ] [Report route color assignment — per-route identity color in graphs](./tasks/current/report-route-color-assignment.md) — Gap 02 of the report-page redesign audit. Implemented and live-verified end-to-end 2026-07-22 (LineGraph, real ClickHouse data, `claude_scratch_measure_picker`). Left unchecked only for remaining testing-checklist items: auto-assigned color on `addRoute` untested, cross-graph color consistency for the same route untested, Bar/Pie/Treemap rendering untested (LineGraph proven, same code path), GridGraph/SunburstGraph regression unprobed.
- [x] [Report card visual/density polish](./tasks/current/report-card-visual-density-polish.md) — Gap 03 of the report-page redesign audit. Settled 2026-07-23 after a scope review: shadow knob KEPT (restyled to match the checkmark-list convention used by Style/Width/Height/Rowspan, not Background's swatch-pill), header uppercase→normal-case FULLY REVERTED (site-wide reach was more than wanted — mechanism removed too, not just transportny's opt-in), attribution divider KEPT (capability-only, unused), whitespace `mt-auto` fix FULLY REVERTED (confirmed via DB query that zero live sections combine AVL Graph + `height:'fill'`, so it was provably inert everywhere — not worth carrying speculatively), legend/tooltip float-rounding fix KEPT. Also surfaced and fixed a real process bug: verification was initially done without rebuilding the `@availabs/dms` package's `dist/` output, producing false-positive "live verified" claims — see the task file's "dist-staleness saga" section.

## data-types

## deployment

## content

- [ ] [Set up tessera.so landing, features, and docs pages on design_system_v6](./tasks/current/tessera-v6-landing-pages.md) — all 3 pages built as drafts on `test|pages:pattern` (`app=tessera-test`, id 3) with `tessera_v6` theme applied, verified live in both light and dark. Left unchecked pending human review + `dms page publish`; also flags a docs SideNav follow-up and 2-3 minor content-fidelity gaps (editor illustration, invite form, one CTA-button-row layout nit).
