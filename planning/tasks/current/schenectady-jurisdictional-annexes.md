# Schenectady Jurisdictional Annexes → Jurisdictions dataset (MitigateNY 2.0)

## Objective
Load the 9 Schenectady jurisdictional annexes (source markdown in
`references/mny-transcribe/schenectady/schenectady-alex/annexes/`) into the **Jurisdictions
dataset** (source `1346449`, view `1346450`) that drives the filtered **Jurisdictional Annex
template page** (`2304232`) on the Schenectady 2.0 pattern (`2304223`, app `mitigat-ny-prod`,
host `https://dmsserver.availabs.org`, front-end `schenectady_draft.devmny.org`).

This is the deferred "7 jurisdictional annexes = form pages" piece from
`schenectady-hmp-migration.md`. **New mechanism:** annex content lives in *dataset row columns*,
not lexical page components. Each dataset row = one jurisdiction; certain lexical (rich-text)
columns populate the annex page's rich-text boxes when the page is filtered to that jurisdiction's geoid.

## Deliverable 1 — Crosswalk (DONE)
`references/mny-transcribe/schenectady/jurisdictional_annex_crosswalk.csv` — authoritative
title→column map, derived from the annex page's Card components (each Card binds a Jurisdictions
column via the `show:true` flag in its `element-data.columns`). 26 titled rich-text boxes → columns.
Notes: page label ≠ column display_name in several cases (Risk→Overview, Complete Actions→Completed
Actions, Jurisdictional Profile→Municipality Profile, Action Development→Strategy Development);
"Local Context" appears twice (Built Environment→`lhmp_buildings_local_context`, Mitigation
Strategy→`lhmp_prioritization`). Four lexical columns are NOT surfaced as titled boxes on the annex
page: `demographics_description`, `nfip`, `lhmp_dams`, `historic_prop_dist`.

## Data model (verified this session)
- Source `1346449` type `test_meta_forms_env|jurisdictions:source`; column config in `data.config`
  (`config.attributes[]`). ~30 lexical columns + text/calculated/meta columns.
- Data-row type: `jurisdictions|1346450:data` (split table). Query via the falcor `options` route
  with `filter: {"data->>'county_geoid'":["36093"]}` — returns **15 rows** for Schenectady county.
  (9 real jurisdictions expected: County + City of Schenectady + Towns Duanesburg/Glenville/
  Niskayuna/Princetown/Rotterdam + Villages Delanson/Scotia. The extra 6 need identifying — likely
  invalid/dup rows or census subdivisions.)
- **Row data is auth-gated:** anonymous `byId`/`options byIndex` return null/empty atoms. Reading the
  9 row IDs + current content requires an auth token (`Authorization: Bearer <userToken>`).
  (Components were readable anonymously; dataset rows are not.) Writes reportedly work anonymously
  and shallow-merge top-level keys (so sending only the filled lexical columns preserves the rest).

## Source content model (verified from Delanson annex)
Most of each annex is **shared boilerplate + data tables** (Capabilities, Proposed Actions, NFIP
claims, Mitigation Reps, Problem Statements, Presidential Disaster Declarations, Events map) — these
are auto-populated by 2.0 data components and must NOT be transcribed. The **jurisdiction-specific
prose** lives in light-blue "blue box" blocks marked `<Jurisdiction> Jurisdictional Annex`, plus
per-hazard "Local Impacts - <Hazard>" boxes.

Reliable blue-box → column mapping (Delanson example lines):
- Built Environment blue box (L441-442) → `lhmp_buildings_local_context` ("Local Context", Built Env)
- Critical Infrastructure blue box (L452-464) → `lhmp_criticial_infrastructure`
- What Changed blue box (L489-491) → `growth_and_development_trends`
- Previous Action Status blue box (L496-497) → `lhmp_previous_actions_evaluation`
- (per-hazard Local Impacts boxes: Coldwave/Drought/Flooding for Delanson — mapping TBD; likely
  hazard-page content, not jurisdictions columns.)

Ambiguous / owner-decision columns: `description` (Executive Summary — source has no jurisdiction-
specific exec summary), `lhmp_municipality_profile` (Home/Context is demographic stats = data),
per-hazard impacts, and the various `*_additional` "Additional Context" columns (no source prose).

## Recon tooling (in context/)
- `probe_juris*.mjs`, `probe_page.mjs`, `probe_components.mjs`, `scan_annex_components.mjs`
  (→ `annex_components.json`, 1198 comps parented to page 2304232),
  `query_juris_rows.mjs` (options-route filtered query), `gen_crosswalk_csv.mjs`.
- `juris_source.json` = full source column config.

## Access resolved (2026-07-30)
Auth via `POST /login {availabs@gmail.com/test123, project:mitigat-ny-prod}` → JWT (dev creds from
skill `src/dms/skills/authenticating-the-dms-cli.md`; group AVAIL + LHMP Template Editor, authLevel 10).
- **Reads:** dataset rows are split-table + gated. `byId` never resolves them (not in main table).
  Enumerate ids via the **`opts`** route (byIndex refs carry ids); read row content via a no-op
  empty-merge `edit` (the only route returning split-row data). Both in `context/annex_lib.mjs`.
- **Writes:** added a **`dms dataset update <source> <row> --data <file>`** CLI command
  (`src/dms/packages/dms/cli/src/commands/dataset.js` + `bin/dms.js`) — passes the data-row `type`
  as the 4th `edit` arg (split-table routing), which plain `raw update` omits. **Library change —
  see escalation note below.**

## Row identification (2026-07-30) — 15 county rows, 9 real jurisdictions
Non-CDP rows are the plan jurisdictions; the 6 `census_type=CDP` rows are census artifacts (skipped).
County `1679778` · Duanesburg(T) `1346939` · Glenville(T) `1347151` · Niskayuna(T) `1347727` ·
Princetown(T) `1347971` · Rotterdam(T) `1348052` · Delanson(V) `1346909` · Schenectady City `1348106` ·
Scotia(V) `1348122`. Backup of pre-write state: `context/../backups/juris_rows_PRE.json` (all empty).

## Scope decision (conservative / faithful — matches prior migration)
Filled only columns with a clear jurisdiction-specific blue-box source AND a matching dataset column
(8-column map, see skill §3). Skipped: source sections with no matching column (Natural Environment,
Open Space, Social Vulnerability, Displaced Residents, Evacuation, Shelters, Strategies Overview),
per-hazard Local Impacts (belong on hazard pages), Executive Summary (`description` — no jurisdiction-
specific source; left empty), and all `*_additional` columns. Invent nothing.

## Progress
- [x] Identify host/app/type for dataset, page, pattern (dmsserver.availabs.org, mitigat-ny-prod)
- [x] Extract full Jurisdictions column config (30 lexical cols)
- [x] Scan annex page components → title↔column bindings via show:true
- [x] Build crosswalk CSV (deliverable 1) → `jurisdictional_annex_crosswalk.csv`
- [x] Understand source markdown content model (blue-box prose vs data tables)
- [x] Resolve auth (login token) + read path (opts + empty-merge) + write path (dms dataset update)
- [x] Identify 9 jurisdiction rows; back up current (all empty)
- [x] Extract per-jurisdiction blue-box prose → lexical payloads (`build_payloads.mjs` → payloads.json)
- [x] Write to dataset rows + read-back verify: **7 rows, 38 columns written, 38 verified**
      (`write_annexes.mjs` → write_results.json). Draft data; nothing published.
- [x] Create reusable skill → `references/mny-transcribe/loading-annexes-into-jurisdictions-dataset.md`
- [x] **City of Schenectady recovered + loaded (2026-07-30).** Diagnosed: original scrape skipped the
      malformed `Schenectady city ( City)` dropdown token (older toolchain; the `( City)` bug the
      `mny_*` toolchain later fixed). Wrote `mny-1.0-scraper/scrape_city.js` (single-jurisdiction full
      annex scraper) → `schenectady-lhmp-v1-annex-schenectady-city.md` (Risk 7 boxes, Strategies 3,
      4 hazards). Loaded row `1348106`: **6 columns** (buildings/critical_infra/growth/prev_actions/
      capacity/nfip), read-back verified via the CLI UDA path. Scraper README + skill + memory updated.
- [x] Re-added `dms dataset update` (owner's CLI refactor had dropped it while adding the UDA read path)
- **Now 8 of 9 jurisdictions filled (44 columns).** County (`1679778`) intentionally empty (county
  context lives in the main plan / content pages, not a per-municipality annex box).
- [ ] Owner: visually verify render on annex page per jurisdiction; decide on unmapped sections/hazards

## Library escalation
The `dms dataset update` command is a change to the `@availabs/dms` submodule CLI. Per repo rules,
track that under `src/dms/planning/` if it is to be committed upstream (currently uncommitted).
