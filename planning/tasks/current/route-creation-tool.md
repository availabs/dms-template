# Route creation tool — current status

Route Creation is the tool that feeds `Route`s (named, saved collections of TMCs) into the NPMRDS
Reports feature. This file is a short orientation pointer, not a new history — the arc has two
substantial existing documents that stay authoritative:

- [`research/route-creation/findings.md`](../../../research/route-creation/findings.md) — the full
  investigative trail (Parts 1-8): the map-properties root cause, the old-tool feature-gap
  inventory, the auto-routing endpoint investigation, architecture decisions, and later bug triage.
  Long, but already well-organized and self-correcting in place — read it directly rather than
  expecting a summary here to substitute.
- `src/dms/planning/tasks/current/routecreation-marker-placement-autorouting.md` (the `dms`
  submodule) — the marker-placement/auto-routing feature's phased plan and decisions. Its own
  top-of-file status note (added 2026-07-30) explains how it relates to the port below.

## Where the code lives

As of 2026-07-29, `routecreation` and `macroview` (a second map plugin, geography-level PM3
choropleth viewer) were **ported natively into dms-template** —
[`planning/tasks/completed/port-transportny-map-plugins.md`](../completed/port-transportny-map-plugins.md).
dms-template's own dev server (`src/themes/transportny/components/{routecreation,macroview}/`) is
where both are now developed and tested. transportNY still has its original copies (that's where
all the research and early feature work below happened), but they are no longer the develop/test
target — this file does not track whether transportNY's copies still match.

## Current status by phase

| Phase | What | Status |
|---|---|---|
| Map-properties bug (findings.md Part 1) | Map clicks returned empty `.properties`, so no TMC could ever be selected | **FIXED**, plugin-local `data-column: 'tmc'` fix, carried into the dms-template port |
| Marker placement / auto-routing Phase 1 (dms-server proxy) | Wrap the external `routing2.availabs.org` map-matching service behind a swappable dms-server module | **NOT STARTED** — the plugin still uses a temporary direct client call (`hooks/resolveRoute.js`), by design, swappable later |
| Marker placement Phase 2 (marker UI) | Drop/drag markers, auto-resolve to a TMC path, gradient-by-sequence coloring | **DONE**, live-verified, carried into the dms-template port |
| Marker placement Phase 3 (year selector) | Pick a network vintage, swapping both the routing call's year param and the visible shapefile layer | **NOT STARTED** — blocked on re-verifying the actually-routable year range (see below) |
| Save/load `points` persistence | Reloading a marker-made route back into editable markers (not just a flat TMC list) | **NOT DONE** — a marker-made route saves/reloads as a flat TMC list today |
| Search-to-add TMC + route_id update/overwrite labeling | Type a TMC and add it without clicking the map; clear "Update" vs "Save" labeling when editing an existing route via URL | **DONE** (built 2026-07-27 in transportNY, carried into the dms-template port) |
| macroview Data Downloader (GIS export) | Needs a `MapEditorContext.DAMA_HOST` equivalent that doesn't exist upstream yet | **NOT DONE**, falls back to a published-page-only context field |

## Known, closed loose ends (corrects stale claims found elsewhere)

- **The "Routes Data" table fetchMode gap is CLOSED**, not open — a prior memory index entry
  described it as unfixed; it was fixed and verified 2026-07-24 (both the live page and its
  page/section templates got `display.fetchMode: "force"` + an `updated_at` sort column). See
  findings.md Part 7 for the full trace.
- **A stale-sidebar-mileage bug in `useRouteData.js`** (cleared TMCs left the old mileage list
  showing) was found and fixed 2026-07-24 in transportNY, before the port — confirmed present in
  dms-template's ported copy today (the `else { setTmcData([]) }` branch exists).

## Open items worth flagging before picking this arc back up

- **The routing service's actually-usable year range is unconfirmed beyond one test location.**
  A DB-metadata-based claim that years 2016-2026 all work was directly tested and found **wrong** —
  only 2020-2022 resolved for a real corridor near Albany; every other tested year (2016, 2018,
  2023-2026) returned no match. Phase 3's year selector can't be designed around the full
  2016-2026 range until this is checked against more locations.
- **Phase 1 (the dms-server proxy) is the next real blocker** before the temporary direct
  `routing2.availabs.org` client call can be retired.
- **CSV bulk import, a folder field in save/move, and a full permissions model** were all
  deliberately deferred (not gaps to close opportunistically) — see findings.md Part 4 for why.

## Cross-references

- `research/route-creation/findings.md` — full investigative trail
- `src/dms/planning/tasks/current/routecreation-marker-placement-autorouting.md` — marker-placement phased plan
- `planning/tasks/completed/port-transportny-map-plugins.md` — the port itself, including full macroview crash root-cause detail
- `src/dms/planning/tasks/completed/map-plugins-theme-registration.md` — the generic `theme.mapPlugins` registration mechanism the port relies on
- `src/dms/planning/research/map-stack-architecture.md` — background on the mapeditor/map/map_dama split
