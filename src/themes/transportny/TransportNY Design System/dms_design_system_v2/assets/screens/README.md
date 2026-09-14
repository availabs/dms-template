# Screenshots — capture convention

The design system had no image assets before 2026-08-27. These are the first, and this file is the
convention so a later capture matches.

**Where they are used:** `pages/docs/npmrds--macro_view.html` (6 figures) and `pages/docs/_seed--npmrds-measures.html`
(1 figure).

## Rules

1. **Real tool only.** Every image is a capture of the running application. A mocked-up screenshot of
   a tool that exists is a fabrication, and these pages exist to be trustworthy about how numbers are
   made.
2. **Every figure names the state that produced it** — in the visible `<figcaption>` and in an HTML
   comment carrying the capture date and URL. That makes a screenshot reproducible *and*
   self-invalidating: paste the state, see whether the tool still looks like that, re-shoot if not.
3. **Annotate with HTML/CSS overlays, never baked into the PNG.** A callout positioned over the image
   survives a re-capture; one burned into the pixels does not.
4. **Relative paths, no base64.** These pages must open by double-clicking from the file system, and
   inlining would make already-large files un-diffable.
5. **Viewport 1920x1150, deviceScaleFactor 1.** Keeps files ~600-800 KB while staying readable at the
   ~700-900 px the pages display them at.

## How these were captured (2026-08-27)

The macro view is auth-gated, so a Playwright storage state is minted first. The token must be minted
against the API host the app actually talks to (`VITE_API_HOST`, `https://dmsserver.availabs.org`) —
minting against `localhost:3001` produces a token the app rejects, and every shot lands on the sign-in
page.

```bash
# a throwaway dev server for npmrdsv5 on a spare port, so the default-mode servers are untouched.
# a mode-specific env file is used because .env wins over a shell VITE_DMS_APP.
npx vite --mode npmrdsshot --port 5231 --strictPort

node src/dms/packages/dms/cli/bin/mint-token.mjs \
  --host https://dmsserver.availabs.org --project npmrdsv5 \
  --email availabs@gmail.com --password test123 \
  --origin http://npmrds.localhost:5231 \
  --out scratchpad/npmrdsv5-dev2/auth-shots.json
```

Then drive the UI with Playwright and shoot. **Do not try to set state through URL parameters** — the
first attempt did, and produced seven byte-identical files, because the params did not apply and every
shot was the default view. Click the controls, and verify the captures differ (`md5sum *.png`) before
trusting them.

The macro view lived at the **subdomain** origin `http://npmrds.localhost:<port>/macro` when these
were captured (2026-08-27); the bare `localhost:<port>/macro` path resolves to the platform landing
page instead. **Stale as of 2026-09-02**: npmrds_sub moved off the `npmrds` subdomain to a
`www:/npmrds` path-mount — re-running this recipe today needs `http://www.localhost:<port>/npmrds/macro`
instead (see `traversing-dms-pages.md`'s subdomain gotcha). The commands above are left as literally
run, for provenance; don't copy them verbatim for a new capture.

## Inventory

| file | state | captured |
|---|---|---|
| `macro-01-overview.png` | default — LOTTR, AM peak, statewide, PM3 year 2025 | 2026-08-27 |
| `macro-02-measure-menu.png` | measure select open, showing the 7 published measures in 4 groups | 2026-08-27 |
| `macro-03-phed-controls.png` | measure = PHED — 4 conditional controls, 30,918 segments no-data | 2026-08-27 |
| `macro-04-coverage.png` | measure = Coverage · data completeness | 2026-08-27 |
| `macro-05-worst-segments.png` | worst-25 ranking panel open | 2026-08-27 |
| `macro-06-download-builder.png` | download builder modal open | 2026-08-27 |
| `docs/start/navigating-01-landing.png` | landing page, signed out — side navigation and the three product panels | 2026-09-08 |
| `docs/tsmo/start-01-2025-home.png` | TSMO home, Year 2025 (page default) — headline cards and the Regional Dashboards band | 2026-09-08 |
| `docs/tsmo/congestion-01-2025-statewide.png` | Congestion, Year set to 2025, Region blank — delay composition by year and seasonality | 2026-09-08 |
| `docs/tsmo/incidents-01-2025-statewide.png` | Incidents, Year 2025, Region and Category blank — headline card and attributed delay by year | 2026-09-08 |
| `docs/tsmo/reliability-01-2025-statewide.png` | Reliability, Year 2025, Region blank — the three compliance cards and person-miles reliable by year | 2026-09-08 |
| `docs/tsmo/work_zones-01-2025-statewide.png` | Work Zones, Year set to 2025, Region and Type blank — headline card and work-zone delay by year | 2026-09-08 |
| `docs/freight_atlas/start-01-maritime-system.png` | Freight Atlas map opened from the Maps Gallery tile New York's Maritime System, signed out — Map layers and Legend panels | 2026-09-08 |
| `docs/npmrds/start-01-route-creation-4-tmcs.png` | Route Creation, TMC Click — four consecutive Grand Central Parkway segments, 1.748 mi, unsaved | 2026-09-08 |
| `docs/npmrds/start-02-report-edit-line-graph.png` | report 787 NB 5-12-2026 in edit mode — Routes rail with two windows of one route and a Line Graph card | 2026-09-08 |
| `docs/npmrds/routes-create-01-markers.png` | Route Creation on an existing route (2216791), Markers mode — three markers and the matched segments | 2026-09-08 |
| `docs/npmrds/reports-find-01-search-787.png` | Choose a report dialog, 787 typed — narrow-by chips, 2 reports, sort Best match | 2026-09-08 |
| `docs/npmrds/reports-build-01-before-after-edit.png` | Rexford Bridge before-and-after report in edit mode — three windows of one route and a bar-graph summary card | 2026-09-08 |
| `docs/npmrds/recipes-before-after-01-hourly-difference.png` | 87 NB report in edit mode — average hours of delay by hour, 2018 against 2021 | 2026-09-08 |
| `docs/npmrds/route_comparison-01-draft.png` | Route Comparison in its draft state — Build comparison rail with two route chips and the year-grouped matrix | 2026-09-08 |
| `docs/admin/map_editor-01-graduated-style.png` | Map Editor with the saved map FDI - NPRMDS Performance Measures 2022 open, its layer selected, layer panel on Style | 2026-09-08 |

## Porting to the live DMS build

Live docs pages embed images as lexical image nodes served from `/img/npmrdsv5/<sectionId>_<n>_<hash>.png`
(older ones sit on `avl-dms.s3.us-east-2.amazonaws.com`). The relative `<img src="../assets/screens/…">`
paths here swap to those on upload. They are kept together inside `<figure>` blocks so the swap is
mechanical.

## How the 2026-09-08 docs figures were captured

Fifteen figures for the `/docs` pages were shot from a throwaway `dms-template` dev server on port 5231
(`vite --port 5231 --strictPort`, the repo `.env` pointing at the production API), driven by Playwright at
1920x1150, deviceScaleFactor 1, one viewport shot per figure. The mounts on that build: the landing page at
`http://localhost:5231/`, TSMO at `/tsmo` and `/tsmo/<dashboard>_v2`, the Freight Atlas at `/freightatlas/...`,
the Map Editor at `/mapeditor`, and NPMRDS on its subdomain, `http://npmrds.localhost:5231/reports`,
`/route_creation`, `/route_comparison`, `/edit/reports/<slug>`. That build sets no
`VITE_DMS_MULTI_TENANT`, so the subdomain is decorative there and the same paths answer on the bare host;
the pattern records name `www:/npmrds`, `www:/tsmo` and `www:/freightatlas` as the deployed mounts.
Only the landing page and the Freight Atlas render signed out; the TSMO and NPMRDS patterns are
permissioned, so those figures are signed in and show the account chip in the side navigation.
Sign-in used a Playwright `storageState` minted per origin with
`src/dms/packages/dms/cli/bin/mint-token.mjs --host https://dmsserver.availabs.org --project npmrdsv5`,
written to a scratchpad file outside the repo and never committed; tokens expire in about six hours.
State was reached by clicking the named controls — year lists, gallery tiles, the report search bar, the
symbology selector, the map's own zoom buttons — not by typing URL parameters, except where a documented
address is the only way in (`route_creation?route_id=`). Nothing was saved: no route, report, map or
dataset was written, and the three report-edit figures are existing reports opened in edit mode and left alone.
