# Loading jurisdictional-annex content into a MitigateNY 2.0 Jurisdictions dataset

How to transcribe per-jurisdiction Hazard Mitigation Plan **annex** prose from scraped
markdown into the **Jurisdictions dataset** that drives a county template's *Jurisdictional
Annex* page. This is the **dataset-column** fill path — distinct from the lexical-page-component
fill used for county content pages (see the county-content-page path in
[`../tasks/current/schenectady-hmp-migration.md`](../tasks/current/schenectady-hmp-migration.md)). First done for **Schenectady** (2026-07-30); scripts live in
[`scripts/schenectady/`](./scripts/schenectady/).

> TL;DR: the annex page's rich-text boxes are `Card` components bound to **lexical columns of a
> Jurisdictions dataset row** (one row per jurisdiction, filtered by geoid). Fill those columns.
> Reads are auth-gated and split-table; writes go through a new `dms dataset update` CLI command.

## 1. The model (verified)

- **Annex page** (e.g. Schenectady page `2304232`, type `…_v1_copy|page`) is a *filtered template*:
  select a jurisdiction (geoid) and its dataset row's columns render into titled rich-text boxes.
- **Jurisdictions source** (Schenectady: id `1346449`, type `test_meta_forms_env|jurisdictions:source`).
  Column config is in `source.data.config` → `config.attributes[]`. ~30 columns are `type:"lexical"`
  (rich text) — those are the fill targets. It is a **statewide** dataset (one row per NY municipality),
  so filter to your county.
- **Data rows** live in a split table, type `jurisdictions|{viewId}:data` (Schenectady view `1346450`).
  Each row = one jurisdiction. Identify your county's rows with `county_geoid` = the county geoid
  (Schenectady `36093`). Real plan jurisdictions have `census_type` ∈ {County, Cousub, Place};
  rows with `census_type = CDP` are census artifacts — **skip them**.

## 2. Crosswalk: page section title → dataset column

The binding is authoritative from the page's `Card` components, not guesswork. Each Card's
`element-data.columns[]` has exactly one entry with `show:true` — that's the column it renders.
`scan_annex_components.mjs` dumps all components parented to the annex page; `gen_crosswalk_csv.mjs`
filters Cards → Jurisdictions lexical columns → `jurisdictional_annex_crosswalk.csv`.
Page label ≠ column display_name in several cases (Risk→Overview, Complete Actions→Completed
Actions, Jurisdictional Profile→Municipality Profile, Action Development→Strategy Development);
"Local Context" is reused (Built Environment→`lhmp_buildings_local_context`, Mitigation
Strategy→`lhmp_prioritization`).

## 3. Source → column mapping (the blue boxes)

Scraped annex markdown (`references/mny-transcribe/schenectady/schenectady-alex/annexes/schenectady-lhmp-v1-annex-<juris>.md`, git-ignored) is mostly
**shared boilerplate + data tables** (Capabilities, Proposed Actions, NFIP claims, Problem
Statements, Disaster Declarations) — 2.0 auto-populates those; do **not** transcribe them. The
jurisdiction-specific prose is in light-blue "blue box" blocks marked `<Juris> (Type) Jurisdictional
Annex`, under a section header. `build_payloads.mjs` parses each blue box, keys it by its
(chapter :: section), and maps the **confident** ones to columns:

| Source section (chapter :: section) | Column | display_name |
|---|---|---|
| Home / Plan Overview :: *…Context* | `lhmp_municipality_profile` | Municipality Profile |
| Risk :: Built Environment | `lhmp_buildings_local_context` | Buildings Local Context |
| Risk :: Critical Infrastructure | `lhmp_criticial_infrastructure` | Critical Infrastructure |
| Risk :: What Changed | `growth_and_development_trends` | Growth and Development Trends |
| Risk :: Previous Action Status | `lhmp_previous_actions_evaluation` | Previous Actions Evaluation |
| Risk :: Problem Areas | `lhmp_problem_areas` | Problem Areas |
| Strategies :: Capacity To Address Risk | `lhmp_capacity_to_implement` | Capacity To Implement |
| Strategies :: NFIP Continued Compliance & Repetitive Loss Strategy | `nfip` | NFIP Local Context |

**Unmapped source sections (flagged, not loaded):** Natural Environment, Open Space, Social
Vulnerability, Displaced Residents, Evacuation Procedures, Shelters, Strategies Overview — the
Jurisdictions schema has no matching column and the annex page surfaces no per-jurisdiction box for
them. Per-hazard "Local Impacts" blue boxes are also skipped: they belong on hazard pages, not the
jurisdictions dataset. If the owner wants these, add a column + Card box first (author-empowerment),
then extend the mapping. **Invent nothing.**

**Column value format:** a lexical *root* object, `{"root":{"children":[…nodes…],"type":"root",
"version":1,…}}` — NOT the `{text:{root}}` wrapper used by page components. `lexical.mjs`
(`buildRootBlocks2`) builds it; consecutive `- ` lines become a bullet list, `N)`/`N.` a number list.

## 4. Auth + read + write path

- **Auth: handled by the CLI, not by these scripts.** Mint a session token per
  [`src/dms/skills/authenticating-the-dms-cli.md`](../../../src/dms/skills/authenticating-the-dms-cli.md)
  and export it as `DMS_AUTH_TOKEN`; `annex_lib.mjs` reads it from the environment and throws if it is
  unset. No credentials live in this tree — don't add any.
- **Reads: ⚠ this section is obsolete as of 2026-08-17.** `dms dataset query <source> --view <view>`
  now resolves split rows **anonymously, including lexical columns** — verified by reading Delaware's
  `lhmp_risk_overview` back with no token. Use that. Add `--filter <col>=<val>` to scope, but note the
  filter compiles to `data->>'col'` and therefore **cannot match array-valued columns** (it returns
  zero rows with no error); for those, fetch and match client-side.

  *Historical, for reading the older scripts:* anonymous reads used to return null, `byId` never
  resolved split rows, ids came from the **`opts`** route
  (`dms.data[app+type].opts[optionsKey].byIndex` — `opts`, not `options`, for byIndex; returns `$ref`s
  carrying the id), and the only route returning split-row content was the `edit` call's RETURNING, so
  `annex_lib.readRow()` did a **no-op empty merge** (`edit [app,id,{},type]`). That bumped
  `updated_at` and wrote a changelog entry per read. Don't do this any more.
- **Writes:** `dms dataset update <source-id> <row-id> --data <file>` — a command added to the CLI
  for this work. It resolves the data-row type and calls `edit [app,id,data,type]`; the 4th `type`
  arg is what triggers split-table routing (plain `raw update` omits it and silently no-ops). The
  server shallow-merges into the row's `data` JSONB, so send only the columns you fill — the rest
  are preserved. Pass `--data` as a **file path** (lexical payloads blow the Windows arg-length limit).

## 5. Pipeline (scripts in [`scripts/schenectady/`](./scripts/schenectady/))

```
node read_rows.mjs        # identify county rows, back up current content → backups/juris_rows_PRE.json
node build_payloads.mjs   # blue-box prose → payloads.json (per row: {column: lexicalRoot})
node write_annexes.mjs    # dms dataset update per row, then read-back verify → write_results.json
```
`annex_lib.mjs` = shared helpers (login, readRow, schenectadyRowIds, cliUpdate). `login()` reads
`DMS_AUTH_TOKEN` from the environment — see [Auth](#4-auth--read--write-path); nothing is stored on disk.
Host/app/type came from a `.dmsrc` in the original working folder; set them as env vars instead.

## 5b. Delaware (2026-08-03) — a different source-plan model

Delaware County (pattern `2323808` / `MitigateNY_Delaware_Draft`, subdomain `delaware_draft`,
**v2** template instance `mitigateny_county_template_v2_copy`, annex page `2323817`, county geoid
`36025`) loaded off the **same statewide Jurisdictions dataset** (source `1346449` / view `1346450`)
— same columns, same write path. But the **source-plan content model is different from Schenectady**,
which changes what's mappable:

- **Delaware's 1.0 annexes** (scraped by `mny-1.0-scraper`, not the older `schenectady-alex` scrape)
  contain only two kinds of *authored* per-jurisdiction prose: **per-hazard "Local Impacts"
  narratives** (the light-blue boxes) and terse **"Location Description"** notes in the Hazards-of-
  Concern table. **None** of Schenectady's chapter blue boxes (Municipality Profile, Built
  Environment, Critical Infrastructure, What Changed, Capacity, NFIP…) exist. So the §3 mapping table
  had **zero applicable rows** — do not assume it transfers.
- **Blue boxes are pre-scraped to structured JSON:** `delaware/_raw-scrape/blue/blue_<Juris>.json` =
  `{ jurisdiction: "<Name> (<Type>)", boxes: { <Hazard>: <verbatim text> } }`. This is a cleaner
  source than re-parsing the annex markdown (and identical to it) — `build_payloads.mjs` reads it
  directly. **The blue boxes were already scraped (Jul 2021); re-running the live Puppeteer scrape is
  redundant** unless refreshing.
- **Owner decision (2026-08-03):** the per-hazard narratives have **no per-hazard column** in the
  Jurisdictions schema and no "Local Impacts" card on the annex page. Rather than skip them (the
  Schenectady default), the owner chose to **aggregate each jurisdiction's narratives into
  `lhmp_risk_overview`** (the annex "Risk"/Overview box), one **H3 heading per hazard**, verbatim
  paragraphs. **Location Descriptions were SKIPPED** (2.0 auto-populates the Hazards-of-Concern
  table). This is a per-county placement call — confirm it with the owner; don't assume `lhmp_risk_overview`
  is the target for the next county.
- **Row set:** county geoid `36025` returns **34 rows** — 1 County + 19 Towns + 10 Villages (the 30
  real jurisdictions) + **4 `census_type=CDP` artifacts to skip** (Andes/Bloomville/Davenport
  Center/Downsville CDP). Blue JSON `jurisdiction` == `${municipality_name} (${municipality_type})`,
  which disambiguates Town vs CDP (`build_payloads.mjs` builds the row map from
  `references/mny-transcribe/schenectady/context/backups/juris_rows_PRE.json`, git-ignored).
- **Result: 27 of 30 rows filled** (`lhmp_risk_overview`), all read-back verified, draft only.
  **Masonville (Town, `1347556`)** has no blue boxes (none recorded in the source) and **Deposit
  Village (`1679808`)** was unavailable at scrape time (README caveat #2) — both legitimately empty.
  The **County row (`1679828`)** is empty (county context lives in the content pages).
- **Distinct from the earlier Delaware content-page load** ([`worked-examples/delaware-load-report.md`](./worked-examples/delaware-load-report.md), Jul 2021→2026-07-23):
  that filled 62 Annotation slots on the county *content* pages and **explicitly deferred the
  annexes**. This task completed that deferral. Full run: [`worked-examples/delaware-annex-load-report.md`](./worked-examples/delaware-annex-load-report.md); scripts +
  `write_results.json` in [`scripts/delaware/`](./scripts/delaware/).
- **Read note:** the annex page row's `data` is auth-gated (anonymous `byId` returns the string
  `"no-access"`), but its **component rows read fine anonymously** — so `discover.mjs` builds the
  crosswalk without a token; only the dataset row read/write needs auth.

## 6. Per-county gotchas

- **The source-plan model decides what's mappable — inventory it first.** Schenectady (chapter blue
  boxes → 8 columns) and Delaware (per-hazard boxes only → 1 aggregated column) are two different
  shapes off the *same* dataset. Before mapping, dump the annex's section structure and the scraped
  blue-box set, and confirm the target column(s) with the owner.
- **Not every jurisdiction has a scraped annex — check before declaring done.** Schenectady first
  loaded 7 town/village annex files; the **City of Schenectady** was initially missing because the
  original scrape skipped its malformed `Schenectady city ( City)` dropdown token. It was recovered
  with `mny-1.0-scraper/scrape_city.js` (see that README's "Recovering a MISSED jurisdiction"
  section) → `schenectady-lhmp-v1-annex-schenectady-city.md`, then loaded by adding it to
  `build_payloads.mjs`'s JURIS map (`{marker:'Schenectady city ( City)', rowId:1348106}`) and running
  `node write_annexes.mjs 1348106` (the writer takes an optional rowId to target one row). Result: 6
  columns. The **County** row (`1679778`) is legitimately empty — county-level context lives in the
  main plan / content pages, not a per-municipality blue box. **8 of 9 Schenectady jurisdictions
  filled.**
- **Section names vary by county/plan model.** Niagara/Allegany-style plans differ from Schenectady
  (see [`mny-1.0-scraper/README.md`](./mny-1.0-scraper/README.md)). Re-run `analyze_annex.mjs <juris>` to inventory (chapter :: section)
  blue boxes before trusting the mapping table above; extend `columnFor()` as needed.
- Verify render in-app by selecting the jurisdiction on the annex page (the SPA needs the geoid
  filter picked; read-back over the API is the authoritative content check).

Related: [`loading-a-plan-into-a-2.0-pattern.md`](./loading-a-plan-into-a-2.0-pattern.md) (county
content-page fill + write path), [`mny-1.0-scraper/README.md`](./mny-1.0-scraper/README.md) (how the
annex markdown was produced).
