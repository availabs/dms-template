# RRL: relative-dates edit gate + missing graph count

**Project:** TransportNY · **Topic:** themes · **Status:** DONE, both live-verified 2026-08-07

Two of Ryan's original live-triage findings ("There is no way to change the relative dates for a
route" / "I don't see the number of graphs each route feeds, it should be in the RRL").

## 1. Relative-dates edit gate — FIXED

**Root cause**: `RouteRow.jsx` had a fully-built Fixed/Derived date-edit UI (presets, formula
editor, live "resolves to" preview, "Use fixed dates instead") — but the ONLY way to open it (the
pencil button, and click-anywhere-on-the-value) was gated `canMutateRow && !isDerivedDate`. Once a
route's dates were already in "derived" mode (`dateFormula` set — either from old-report conversion
or a prior live edit), there was **no way back in**: the row rendered a read-only
"Derived from X — edit that route's dates instead" note with zero interactive control. The
persistence/state-seeding side (`onStartEditDates` in `ReportRouteList.jsx`) already correctly
handled the derived case (`setEditDateMode(r.dateFormula ? 'derived' : 'fixed')`, seeded from the
live-resolved value) — this was purely a missing UI entry point, not a deeper bug.

**Fix**: `RouteRow.jsx` — a derived row now shows a single pencil ("Edit derived-date relationship")
instead of no control at all; clicking it opens the same edit UI (Fixed/Derived toggle, presets,
"Use fixed dates instead") already built for the non-derived case. Copy/paste stays Fixed-only
(a derived row's value isn't a literal span to copy). The click-anywhere-on-value shortcut stays
Fixed-only too — an easy miss-click into Derived mode with no visual pencil cue felt worse than
requiring the explicit pencil.

**Live-verified** on `converted_reports/snapshot`'s "2023 - AM" row (real `dateFormula:
"startDate=>yearof"`, `derivedFromRoute: "comp-0"`): the pencil now appears and opens correctly —
"DATES · DERIVED", "Derive From: 2023 - 5 min...", "Pattern: Same period, aligned", "Span: Year",
a live "Resolves to 2023-01-01 → 2023-12-31" preview, and "Use fixed dates instead". Cancelled
without saving; no data changed.

**Also found (and fixed) along the way**: entering a route's date-edit UI at all requires this
section's own `SectionEdit` state (`sectionEditorOpen`/`canMutate`), not just the page's
`/edit/<slug>` route — same "two different edit states" gotcha every custom component hits. Not a
bug, just easy to trip over live-testing (see `traversing-dms-pages.md`).

## 2. Graph count per route, missing from RRL — FIXED

**Root cause**: `ReportRouteList.jsx` already computes `useGraphPublish(...)`'s return value
(`{ graphs }` — every self-bound sibling graph, each with its own live `routeIds` from
`display._measurePick.routeIds`) but discarded it entirely (a bare, non-destructured call) — Design
Push #2 deliberately removed the OLD per-graph assignment CHIPS from `RouteRow`, and the count went
with them. `routes[].graphIds` (the field the Python converter still writes) is NOT a substitute:
it's write-once at conversion time and never updated when a graph's own Routes pill reassigns
anything — confirmed by reading `QuickControls`' `toggleRoute`, which only ever writes the graph's
`_measurePick.routeIds`, never the route's `graphIds`.

**Fix**: `ReportRouteList.jsx` now captures `{ graphs }` from `useGraphPublish` and derives
`graphCountByCompId` (a `route_comp_id → count` map, built from every graph's live `routeIds`),
passed to each `RouteRow` as a new `graphCount` prop. `RouteRow.jsx`'s one-line meta text gained a
trailing `"N graph(s)"` segment (singular-aware), right after the existing TMC/miles/dates facts.
`0 graphs` is shown, not omitted — a route feeding nothing is a real, useful signal.

**Live-verified** on `converted_reports/snapshot`: every row now shows a real count ("3 GRAPHS",
"4 GRAPHS", "1 GRAPH" singular, "5 GRAPHS", etc.) — cross-checked against each route's raw
`graphIds` array length in the DB and confirmed matching (expected here since nothing has touched
QuickControls since conversion; the point of the live computation is that it stays correct even
after someone does).

## A false alarm caught and ruled out along the way

While re-testing the `ReportRouteList.theme.js` `panelHead` fix from `compact-sidenav-margin-bug.md`
(bleeding the dark "ROUTES" header bar flush to the panel edges), first suspected it visually covered
the section's own hover-revealed Settings kebab (needed to enter `SectionEdit` at all) — confirmed via
`elementFromPoint()` that the kebab is **still fully clickable** at its exact coordinates (its icon
just has low visual contrast against the now-adjacent dark header, a minor discoverability nit, not a
functional break). No change needed; the `panelHead` fix stands as originally written.

## A real accidental mutation, caught and reverted

Mid-investigation, an imprecise coordinate click landed on a row's "Move up" reorder button instead
of its date-edit pencil, on the **live, published** Snapshot page — swapping "2023 - AM"/"2023 - PM"
in `reports_snap_2.routes[]`. Caught immediately by re-querying the DB, fixed via a direct, scoped
`dms raw update --data` write restoring the original order (verified: only the `routes` key changed,
every other field — `graphIds`, colors, `_old_settings`, `dateFormula` — byte-identical to before).
Lesson reinforced: use precise DOM-query-driven clicks (`element.click()`), not coordinate guesses,
once inside a live SectionEdit's row-mutation UI — coordinates shift the moment a Settings dropdown
or an expanded row changes the layout above the target.

## Files touched

- `src/themes/transportny/components/ReportRouteList/RouteRow.jsx` — derived-date pencil gate;
  `graphCount` prop + meta-text segment
- `src/themes/transportny/components/ReportRouteList/ReportRouteList.jsx` — capture `useGraphPublish`'s
  `graphs`, derive `graphCountByCompId`, pass `graphCount` to each row

## Testing checklist

- [x] A derived route's date section shows a pencil and opens the Fixed/Derived edit UI —
      confirmed live on `converted_reports/snapshot`'s "2023 - AM" row
- [x] The edit UI correctly seeds Derived mode (not blank/Fixed) when opened on an already-derived
      row — confirmed (showed the real formula/base, not defaults)
- [x] A non-derived route's date pencil/copy/paste are unaffected — confirmed (still 3 icons, same
      as before)
- [x] Every route row shows a live, correct graph count, singular-aware — confirmed live, all 11
      rows on `converted_reports/snapshot`
- [x] No regression to the settings kebab / SectionEdit entry — confirmed still clickable
- [x] No stray data changes left over from live-testing — confirmed via direct DB read
      (`dateFormula`/`derivedFromRoute`/order all intact)
