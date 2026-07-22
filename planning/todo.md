# DMS Template Todo

## themes

- [ ] [MNY — Action Prioritize (list view) redesign in the design system](./tasks/current/mny-actions-prioritize-list-design.md) — new `pages/actions-prioritize.html` + DS additions (tier pills, linked stat strip, filter bar). Flags two platform gaps needed for a later live build: an active-when-search-param-matches cell hint, and an is-empty filter leaf.
- [ ] [MNY — build "Prioritize Actions (List)" live in the county-template pattern](./tasks/current/mny-action-prioritize-v2-live-build.md) — 3-phase: (1) working interactive page next to `action_prioritize` from existing primitives, (2) style via mny theme `activeStyle`s, (3) new platform features (active stat cell, empty-filter op, tier-pill column type, progress metric — escalated to `src/dms/planning/`).
- [ ] [AVL Graph quick controls — inline Measure/Comparison Mode pills in the card header](./tasks/current/avl-graph-quick-controls.md) — report-page redesign Gap 01, Variant A (new row under the title) picked by the user from a design-audit artifact. Requires a new library primitive first — escalated to [`src/dms/planning/tasks/current/section-header-extensions.md`](../src/dms/planning/tasks/current/section-header-extensions.md). Scoped 2026-07-21, not started.

## data-types

## deployment

## content

- [ ] [Set up tessera.so landing, features, and docs pages on design_system_v6](./tasks/current/tessera-v6-landing-pages.md) — all 3 pages built as drafts on `test|pages:pattern` (`app=tessera-test`, id 3) with `tessera_v6` theme applied, verified live in both light and dark. Left unchecked pending human review + `dms page publish`; also flags a docs SideNav follow-up and 2-3 minor content-fidelity gaps (editor illustration, invite form, one CTA-button-row layout nit).
