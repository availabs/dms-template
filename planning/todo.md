# DMS Template Todo

## themes

- [ ] [MNY — Action Prioritize (list view) redesign in the design system](./tasks/current/mny-actions-prioritize-list-design.md) — new `pages/actions-prioritize.html` + DS additions (tier pills, linked stat strip, filter bar). Flags two platform gaps needed for a later live build: an active-when-search-param-matches cell hint, and an is-empty filter leaf.
- [ ] [MNY — build "Prioritize Actions (List)" live in the county-template pattern](./tasks/current/mny-action-prioritize-v2-live-build.md) — 3-phase: (1) working interactive page next to `action_prioritize` from existing primitives, (2) style via mny theme `activeStyle`s, (3) new platform features (active stat cell, empty-filter op, tier-pill column type, progress metric — escalated to `src/dms/planning/`).
- [ ] [Report route color assignment — per-route identity color in graphs](./tasks/current/report-route-color-assignment.md) — Gap 02 of the report-page redesign audit. Confirmed genuine gap (no per-route color exists today; series color is purely positional). Architecture confirmed 2026-07-22 (library-side, Option A); full render-path plan split into `src/dms/planning/tasks/current/comparison-series-explicit-color.md`. Plan finalized, implementation not started.

## data-types

## deployment

## content

- [ ] [Set up tessera.so landing, features, and docs pages on design_system_v6](./tasks/current/tessera-v6-landing-pages.md) — all 3 pages built as drafts on `test|pages:pattern` (`app=tessera-test`, id 3) with `tessera_v6` theme applied, verified live in both light and dark. Left unchecked pending human review + `dms page publish`; also flags a docs SideNav follow-up and 2-3 minor content-fidelity gaps (editor illustration, invite form, one CTA-button-row layout nit).
