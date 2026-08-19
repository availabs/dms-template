# Delaware jurisdictional-annex load — Jurisdictions dataset

**Date:** 2026-08-03 · **App:** `mitigat-ny-prod` · **Host:** `https://dmsserver.availabs.org`
**Pattern:** 2323808 (`MitigateNY_Delaware_Draft`, subdomain `delaware_draft`, instance
`mitigateny_county_template_v2_copy`) · **Annex page:** 2323817 · **County geoid:** 36025.
**Dataset:** statewide **Jurisdictions** — source `1346449` / view `1346450` (data type
`jurisdictions|1346450:data`). **State:** written to the dataset rows (draft), **not published**.
Playbook: [`../loading-annexes-into-jurisdictions-dataset.md`](../loading-annexes-into-jurisdictions-dataset.md) §5b.

> Completes the annex work **deferred** by the earlier content-page load
> ([`LOAD_REPORT.md`](./delaware-load-report.md), which filled 62 county content-page Annotation slots and
> explicitly left the jurisdictional annexes for a later pass).

## What was loaded

- **27 of 30 real jurisdictions** filled (1 column each), **139 per-hazard narrative boxes**,
  ~233 KB of lexical JSON, **all read-back verified** (`context/write_results.json`).
- **Target column:** `lhmp_risk_overview` (annex page "Risk" / Overview box). Each jurisdiction's
  per-hazard **"Local Impacts" blue-box narratives** were aggregated into that one column, **one H3
  heading per hazard**, paragraphs **verbatim** from the source. No paraphrasing, no invented text.
- **Source of truth:** the pre-scraped blue-box JSON `_raw-scrape/blue/blue_<Juris>.json`
  (`{jurisdiction, boxes:{hazard:text}}`), produced by `mny-1.0-scraper` (Jul 2021) — identical to
  the `jurisdictional-annexes/*.md` "Local Impacts" sections but structured. Not re-scraped.

## Decisions applied (owner, 2026-08-03)

- Per-hazard "Local Impacts" narrative → **`lhmp_risk_overview`** (the Jurisdictions schema has no
  per-hazard column and the annex page has no per-hazard "Local Impacts" card; aggregating into the
  Risk overview box surfaces the authored prose without inventing a home).
- Hazards-of-Concern **"Location Description"** notes → **SKIPPED** (2.0 auto-populates the
  Hazards-of-Concern table from a dataset; loading them into a lexical column would duplicate).
- Auto-populated tables (Capabilities, Actions, NFIP, inventories) → **not transcribed** (platform
  renders them).

## Left empty (expected)

| Jurisdiction | Row | Why |
|---|---|---|
| Masonville (Town) | 1347556 | No blue boxes recorded in the source (README caveat #4). |
| Deposit (Village) | 1679808 | Not selectable in the 1.0 dropdown at scrape time — blue boxes unavailable (README caveat #2). |
| Delaware (County) | 1679828 | County-level context lives in the content pages, not a per-municipality box. |

4 `census_type=CDP` rows (Andes / Bloomville / Davenport Center / Downsville CDP) are census
artifacts and were skipped.

## Crosswalk

[`jurisdictional_annex_crosswalk.csv`](references/mny-transcribe/delaware/jurisdictional_annex_crosswalk.csv) — annex-page rich-text
box title → Jurisdictions dataset column (30 lexical columns; 26 surfaced as titled cards on page
2323817, 4 not). Generated from the page's `Card` components (`context/gen_crosswalk_csv.mjs`).

## Backups & rollback

- Pre-load state of all 34 county rows: [`context/backups/juris_rows_PRE.json`](references/mny-transcribe/delaware/context/backups/juris_rows_PRE.json)
  (every `lhmp_*` lexical column was empty before this load — clean first fill).
- To roll a row back, re-write `{lhmp_risk_overview: <PRE value>}` via `dms dataset update`
  (`context/write_annexes.mjs` pattern). The server shallow-merges, so only that column is touched;
  no other column was modified by this load.

## Reproduce / re-run

From `context/` (`.dmsrc` there sets host/app/type; token is minted per run from the dev login):

```
node read_rows.mjs        # enumerate the 34 Delaware rows, back up -> backups/juris_rows_PRE.json
node build_payloads.mjs   # blue JSON -> payloads.json (per row: {lhmp_risk_overview: lexicalRoot})
node write_annexes.mjs    # dms dataset update per row + read-back verify -> write_results.json
```

`discover.mjs` re-derives the annex-page component inventory + jurisdictions column config;
`gen_crosswalk_csv.mjs` rebuilds the crosswalk. `annex_lib.mjs` = shared login / readRow / cliUpdate
(county geoid `36025`). The blue boxes were already scraped — re-running the live scrape is only
needed to refresh source data.

## Next steps (owner)

1. **Review the draft** on the annex page (`https://delaware_draft.devmny.org/edit/the_plan/jurisdictional_annexes/select_jurisdiction`)
   — pick a jurisdiction in the dropdown; the narrative renders in the Risk / Overview box.
2. Decide whether the aggregated-per-hazard format in `lhmp_risk_overview` is the desired final
   placement, or whether a future schema change (a per-hazard local-impacts mechanism) should hold it.
3. **Publish** when approved (this load did not publish).
