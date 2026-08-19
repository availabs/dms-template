# MNY — State Actions Dashboard design page (`state-dashboard.html`)

**Project:** MitigateNY

**Status:** BUILT (2026-08-19), pending owner visual pass · **Type:** design-system page, real data
**Scope:** `src/themes/mny/design/pages/county-actions/state-dashboard.html` (new),
`assets/mny/data/ny_counties_actions.geojson` (new), `ds-nav.js` (one entry),
`references/actions/scripts/18_*.mjs` + `19_*.mjs` (pipeline).

## Goal

The statewide sibling of the county Actions Dashboard (`dashboard.html`): same chrome, same
section grammar, **every number real**, drawn from the **Actions Cleaned** derived source
(`hazmit_dama` source `12453` / view `13192`, published 2026-08-14) — and more analysis than the
county page, with the added cuts all being **county × another variable**.

## What was built

Sections, in page order (all `data-dms`-annotated like the county page):

1. **State identity** — breadcrumb, H1, intro copy adapted from the county page's approved intro;
   one outlined CTA "Open a County Dashboard" (the county page's two amber CTAs are editing routes
   and stay county-scoped).
2. **Status strip** — same six linked cells: 16,948 / Proposed 15,378 (91%) / In-Progress 537 /
   Completed 446 / Discontinued 105 / Not Reported 482 (dashed missing-data treatment).
3. **Page filters** — three groups: Find & Filter (Search · **County** · Hazard · Status),
   Plan & Priority (Plan Scope · Local Priority · Type of Work), and **Data Quality** attribute
   checkboxes that AND Actions Cleaned columns (Located on site = `precision IN (1,2)`,
   Cost reported, Shared template = `is_boilerplate`, Merged duplicates = `merged_action_ids`).
4. **Map (col-7, rowspan-2)** — NY **county choropleth** of action counts, sequential mny ramp
   stepped at 1/100/250/500/1,000; hover readout (count · in progress · completed · jurisdictions);
   click → county dashboard. NYC's five boroughs are shaded as one citywide figure (1,293).
   Caption: 88 'Statewide'-county actions + 513 no-county actions aren't on the map.
   Asset: `ny_counties_actions.geojson` (simplified TIGER polygons, counts baked).
5. **Hazards identified** (col-5) — statewide slim bars; gray Other and dashed Not Reported pinned
   last per the DS missing-data rule.
6. **Local priority** (col-5) — the normalized priority column (High 8,631 / Medium 3,641 /
   Low 1,492 / Not Yet Prioritized 1,671 / *Needs plan legend* 1,513) — only expressible on
   Actions Cleaned.
7. **County × progress** — top-12 counties by actions moved beyond Proposed, stacked
   In-Progress + Completed with each county's own-share %. (Monroe 34%, NYC 255 actions, …)
8. **County × local priority** — 100%-stacked amber ramp + gray "not prioritized / needs legend"
   per county, High-share % on the right; caption calls out Allegany's 11–16 scoring rubric.
9. **County × hazard matrix** — 12 counties × 8 hazard columns, row-normalized % heatmap on the
   sequential ramp, native tooltips carrying the counts.
10. **County × location quality** — 100%-stacked site / town centroid / county centroid / no point,
    with the on-site % and a side panel explaining the centroid caveat (745 site-located statewide).
11. **County leaderboard** — all 58 county-plan units (57 counties + NYC), scrollable, sticky
    header: Actions · Jurisdictions · Beyond Proposed · High Priority % · Cost Reported % ·
    Site-Located · Template % · Top Hazard. The table view backing (and a11y fallback for) the
    charts above.
12. **Action inventory** — six real rows; row 1 (Bronxville "Alder Lane", In-Progress, $2–10M)
    expanded, its side panel showing the Actions Cleaned provenance columns (recovered location
    "35 Alder Lane · 0.85 km off the centroid"; priority-as-written) instead of the county page's
    readiness/maturity pair; an Ontario row carries the amber **Shared template** chip; a statewide
    NYPA row shows the no-county/statewide shape. Pagination 1–6 of 16,948.
13. **Page index** — workflow footer with this page as "0 · State Dashboard"; provenance line
    (source 12453 / view 13192 · data as of 2026-08-14). Also added to `ds-nav.js`'s County
    Actions Workflow section.

## Rebuild pipeline (numbers are baked, not fetched)

```bash
node references/actions/scripts/18_state_dashboard_stats.mjs   # DB → stats JSON + choropleth asset
node references/actions/scripts/19_state_dashboard_build.mjs   # JSON → the page
```

Charts follow the dataviz-skill procedure: sequential = one mny hue light→dark; stacked segments
get 2px surface gaps + native tooltips + the leaderboard table view as relief for the
low-contrast legend tints; missing data always gray/dashed and last.

## Verified

- [x] Renders over `python3 -m http.server` in `design/` — zero console errors, zero horizontal
      overflow at 1440px (Playwright full-page screenshot, 2026-08-19).
- [x] All numbers cross-checked against view 13192 (status strip sums to 16,948; heatmap rows are
      row-normalized on each county's total; leaderboard = 58 units + footer note for 88
      statewide + 513 no-county).
- [x] Choropleth asset joins all 62 TIGER county polygons (5 boroughs → one NYC figure).

## Open / follow-ups

- Owner visual pass (this session verified DOM/render, not pixel judgment).
- The other six county-actions pages' static page-index footers don't list the state page
  (only `ds-nav.js` and this page's own footer do) — add "0 · State Dashboard" to them if the
  owner wants it, left untouched to avoid churning client-reviewed pages.
- Live build (separate task when scheduled): every section binds to Actions Cleaned via
  `externalSource` (`hazmit_dama`, source 12453); the filter bar is the standard page-variables
  wiring; county click passes `?county=` into the county-template pattern. **Platform gaps to
  scope:** a heatmap/matrix primitive and a 100%-stacked bar cell don't exist as Card/Graph
  primitives yet; the choropleth needs the Map primitive fed by the source's own tiles
  (view 13192 has tiles metadata) plus a county-polygon layer.
- 530 newer actions carry NULL precision until `actions_location` re-runs and Actions Cleaned is
  re-published (see `mny-actions-cleaned-source.md`) — re-run scripts 18/19 after that to refresh.

## Log
- 2026-08-19: built + verified; registered in ds-nav; pipeline parked at
  `references/actions/scripts/18|19_*.mjs`.
