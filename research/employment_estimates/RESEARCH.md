# Best-available NY employment, wages, and establishments by industry

A research / proposal document for adding a third "best-estimate" value (employment, wages, establishments) by NAICS industry at block / block-group / tract / county geographies for New York State, using the data already in the NPMRDS DaMa environment (`pgEnv = npmrds2`) plus a small set of well-justified supplements.

Authored: 2026-05-15
Status: draft — research + proposed methodology, not yet implemented.

---

## 1. Background and what already exists in the system

The `business_and_employment_reports` page (DMS page `1677469`, slug `/business_and_employment_reports`, app `npmrdsv5`, pattern `Sandbox`) is a hub that links to:

**Core single-source dataset pages**
| Page id  | Title                  | Slug                       | DaMa source (view) | What it shows |
|----------|------------------------|----------------------------|--------------------|----|
| 1677169  | LEHD WAC               | `/lehd_wac`                | 1999 (3390, 3393)  | LEHD WAC blocks with geometry — CNS01–CNS20 NAICS-sector employment per census block. |
| 1977333  | Business Points        | `/business_points`         | 1885 (3178), 1998 (3387) | Infogroup BP processed; one row per establishment; columns include `infogroup_id`, name, address, NAICS, `actual_employees`, `actual_sales`, `corporate_sales_revenue`, HQ relationships, suppression flags, parent and ultimate HQ refs. |
| 2053120  | QCEW                   | `/qcew`                    | 1895 (3211)        | `qcew_processed_v2` — county × industry × ownership × quarter; `total_annual_wages`, employment levels, `agglvl_code`, region rollups. |
| 2064117  | County Business Pattern | `/county_business_pattern` | 1941 (3289)        | `County Business Pattern RAW` — `geo_id`, `county`, `naics_2017`, `emp_n`, `payann_n`, `payqtr_1_n`, `estab`, `empszes`. |

**Cross-source comparison pages**
| Page id  | Title                  | Slug                  | DaMa source (view) | What it shows |
|----------|------------------------|------------------------|--------------------|---|
| 1676446  | QCEW Vs CBP            | `/qcew_vs_cbp`         | 1960 (3329)        | `CBP VS QCEW` — county × NAICS-2 join with `*_estabs`, `*_employees`, `*_payroll`, diff/pct-diff columns. |
| 1676988  | CBP Vs BP              | `/cbp_vs_bp`           | 1963 (3344)        | `bp vs cbp` — county × NAICS-2 join. |
| 2059576  | Business Points vs QCEW | `/business_points_vs_qcew` | 1909 (3260)   | `qcew vs bp simple` — region × county × industry. |
| 2060963  | QCEW Vs BP             | `/qcew_vs_bp`          | (sibling of 1909)  | Same join, different presentation. |
| 2100010  | BP vs WAC              | `/bp_vs_wac` (+ `tracts`, `blockgroups`, `blocks`, `information`, `join_test`) | 2009 (3415/3416/3417), 2012 (3422) | The most analytically advanced page — block / blockgroup / tract joins with `bp_employment`, `wac_employment`, signed/absolute/percent diffs, magnitude ranks, and a final 5-band "score_combined_all" priority score; NAICS-aware join at the block level in 2012/3422 (which the user pointed at). |

**Findings already documented** (from page `2100959 /bp_vs_wac/information`):

- WAC consistently reports higher employment than BP across all geographies — BP underestimates the workforce.
- BP and WAC align strongly once aggregated to county; the disagreement is overwhelmingly at sub-county geographies.
- Sparse-employment block-percent differences are noisy; absolute differences plus a "workforce magnitude" rank produce a more honest priority score.
- Even with high percent volatility, the majority of GEOIDs (≈71% of blocks, 29% of blockgroups, 22% of tracts) score "Very Strong Employment Alignment" on the combined score.
- Top sectors driving block-level absolute gaps statewide: NAICS 62 (Health Care, 17.6%), 61 (Education, 10.9%), 44-45 (Retail, 7.6%), 92 (Public Admin, 7.5%), 54 (Professional Services, 7.2%), 81 (Other Services, 6.0%), 56 (Admin Support, 5.8%), 31-33 (Manufacturing, 5.7%).
- Combined county-level totals across NY: BP = 8.82 M jobs, WAC = 9.41 M jobs — a 594 k net gap, with 3.07 M absolute gap once sign cancellation is removed (i.e., a lot of within-county redistribution).

**Source 2012 (`/datasources/source/2012` in `npmrds2`)** — the dataset the user identified as the new starting point — is *already* a precomputed block × NAICS join, named **"WAC vs BP (groupped by naics and blocks) upload"**, view 3422. Its columns:

```
geoid           naics_code         bp_establishments    bp_employment
bp_payroll_lower  bp_payroll_upper  bp_sales_volume   wac_employment
wac_estimated_payroll  employment_diff  employment_diff_abs
employment_diff_pct  employment_diff_pct_abs   ogc_fid
+ LEFT(geoid, 5)  AS county_geoid
+ LEFT(geoid, 11) AS tract_geoid
+ LEFT(geoid, 12) AS blockgroup_geoid
```

Because it carries both BP and WAC at block × NAICS plus payroll bounds and rollup keys, it is the natural backbone for a unified best-estimate.

**Supporting / utility sources in `npmrds2`**:

| Source | View(s) | Purpose |
|--------|---------|---------|
| 1894   | 3210    | NAICS code crosswalk (2- through 6-digit, sector, supersector, domain titles) |
| 2010   | 3418    | TIGER county polygons |
| 1993   | 3376    | "LEHD wac naics and county" — county × NAICS-code rollup with `employment`, `estimated_payroll`, `estimated_establishments`. Already provides a WAC-derived payroll proxy. |
| 1999   | 3390 / 3393 | WAC blocks with full LODES CNS01–CNS20, CA, CE, CR, CT, CD breakdowns + geometry |
| 1998   | 3387    | Business points joined to census blocks |
| 1885   | 3178    | Business Points "Processed v3" |

So the system already has: (a) every BLS/Census public source, (b) a block-level LEHD join, (c) a block-level BP join, and (d) precomputed block × NAICS rows with both sources side by side.

---

## 2. What the existing analyses do *not* yet do

1. **No reconciled "best estimate" value.** Every dataset is presented in isolation or in pairwise comparison. There is no single column that says "given everything we know, our best guess for employment in NAICS X in block Y is N."
2. **No formal treatment of CBP / QCEW suppression.** CBP cells are increasingly null (post-2017 the `D` flag was replaced by `S` and ≥3-establishment minimums), and QCEW cells are suppressed under BLS primary/complement rules. Both are usable but require imputation before they can be benchmarks.
3. **No anomaly detection layer on Business Points.** The system shows where BP and WAC disagree, but does not classify *why* — mis-geocoded record, missing establishment, plausible BP-only record (sole proprietor / very small), suppressed-records BP gap, etc.
4. **No bias-corrected universe alignment.** WAC and QCEW exclude different things (federal civilians, military, sole proprietors, religious orgs, rail) — comparisons currently treat raw totals as if they were measuring the same universe, which inflates apparent disagreement.
5. **No wage / payroll best estimate.** The DMS has QCEW total wages, CBP payann_n, BP payroll bounds, and WAC `estimated_payroll` separately, with no fused number.
6. **No establishment best estimate.** Same problem — BP `bp_establishments`, QCEW `qcew_estabs`, CBP `estab` are all present but not reconciled.

---

## 3. Per-source biases that any fusion has to respect

(*Full citations in §10.*)

**LEHD WAC.** UI-derived job records geocoded via the Employer Characteristics File. Excludes uniformed military, most self-employed and sole proprietors, informal workers, some agricultural and domestic positions, and elected officials. Federal civilians were absent until 2010 and fully phased in only by 2012. Confidentiality protection is **partially-synthetic disaggregation**: each establishment receives a fixed multiplicative "noise factor" and is then redistributed to blocks by a Dirichlet allocator, so a single-block × single-NAICS cell is *partially synthetic by design*. Public LODES is typically ~2 years behind reference year. *Implication for fusion:* WAC is the right anchor for **block-level spatial allocation patterns** and for **total workplace employment**, but a single block × NAICS cell is not a reliable point estimate; it is a sample from a posterior. Block totals collapsed over NAICS are far more reliable than the individual CNS bins.

**QCEW.** Covers establishments subject to state UI laws — about 97% of NY nonfarm wage-and-salary employment. Excludes the unincorporated self-employed and partners, most railroad employment (railroad UI is federal, separate), elected officials, some farm/domestic, and most workers for religious organizations. Suppression is column-stop primary/complement at county × NAICS6. Ownership codes 1–5 split federal/state/local/private. *Implication:* the **most trustworthy county-level industry total** for the UI-covered universe; the natural mass constraint for downscaling.

**CBP.** Federal payroll-tax universe (Form 941 / Business Register). Excludes most government, the self-employed (covered separately by Nonemployer Statistics), private households, rail transportation, and crop/animal production. From reference-year 2007 CBP swapped "D" cell suppression for **noise infusion** with `G/H/J` flags (<2%, 2–5%, ≥5% perturbation); from 2017 onward "D" was retired in favour of `S` and a ≥3-establishment minimum, so fine NAICS × small county cells dropped out heavily. Census has filed for **formal differential privacy on CBP** (2023 FR notice). *Implication:* CBP needs the **Eckert–Fort–Schott–Yang LP imputation** (or equivalent) before it can be a benchmark; raw CBP cells are not directly comparable to QCEW or WAC.

**Infogroup / Data Axle Business Points.** Phone / web / Yellow Pages / Secretary-of-State derived establishment list. Rooftop geocoding for current records but only ~32% of historic records had pre-existing lat/lng. Multi-unit firms are coded with HQ vs branch flags, but chain employment is occasionally rolled up to HQ — that is the standard explanation for BP under-counts at the block level. Employee counts for the long tail of small firms are imputed from NAICS sales-per-employee tables. The canonical assessment (Barnatchez–Crane–Decker, FEDS 2017-110) finds NETS (D&B, similar methodology) tracks Census totals in aggregate but materially mis-counts at the smallest size class and has 2–3 year lag on births/deaths. *Implication:* BP is the **best spatial signal** (point coordinates, names, addresses) but not a reliable count signal at the long tail; treat BP as an *informative prior on location*, not a *count benchmark*.

**Universe-alignment table (what each source includes):**

| Population segment              | QCEW | CBP | LEHD WAC | Infogroup |
|---------------------------------|:----:|:---:|:--------:|:---------:|
| Private wage & salary           | ✓    | ✓   | ✓        | partial   |
| Federal civilian                | own=1 | ✗  | ✓ (post-2012) | partial |
| State/local government          | own=2,3 | ✗ | ✓     | partial   |
| Self-employed / nonemployer     | ✗    | ✗   | ✗        | ✓ (listed) |
| Railroad employment             | ✗    | ✗   | ✗        | partial   |
| Religious organisations         | mostly ✗ | ✗ | partial | ✓         |
| Agriculture (crop/animal)       | partial | ✗ | partial | ✓         |
| Military                        | ✗    | ✗   | ✗        | ✗         |

Without normalizing for this, BP – QCEW > 0 in a tract can mean "BP has spurious points" *or* "BP is correctly counting nonemployer/religious/ag/railroad that QCEW excludes". The fusion has to decompose those.

---

## 4. Proposed methodology for "best-estimate employment by industry"

### 4.1 Design goals

1. **One number per (geography, NAICS, year)** that is the system's best guess.
2. **Mass-preserving at the most trustworthy aggregation.** County × NAICS rollups should reproduce QCEW (UI-covered) plus a clearly-attributed delta for the non-UI components.
3. **Honest uncertainty.** Each cell should carry a `low / mid / high` band, not just a point value.
4. **Transparent provenance.** Each cell should expose which source contributed what weight.
5. **Don't lose what the existing layered comparisons already give us.** Source 2012's columns (bp_*, wac_*, *_diff_*) stay; the new estimate is an additional column family `est_*`.

### 4.2 Universe to estimate

Define the target universe as **"workplace jobs, full + part time, all ownership, including self-employed-with-physical-establishment"** — the union that LEHD WAC mostly captures plus the BP-only nonemployer segment.

This universe = WAC ⊕ (BP-only nonemployer establishments). It is *not* QCEW (which is a strict subset) but QCEW is the cleanest *internal* mass constraint for the UI-covered subset.

### 4.3 The pipeline

**Stage A — Build the county × NAICS6 reference table.**

1. Pull QCEW at county × NAICS6 × ownership × year × quarter (source 1895). Annualize to year averages.
2. Pull CBP at county × NAICS6 × year (source 1941). Run the Eckert–Fort–Schott–Yang LP imputation to fill `S`/`G`/`H`/`J` cells (open-source code exists; see fpeckert.me). The output: a complete imputed-CBP table for NY counties.
3. Reconcile QCEW vs imputed-CBP for the UI-covered universe (`own_code = 5` private only, since CBP has no government). Where the two agree within ±5%, accept QCEW. Where they diverge, retain QCEW as the anchor but record the imputed-CBP delta as a "nonemployer / sole-proprietor candidate" reservoir.
4. Add the **Nonemployer Statistics** county × NAICS table to capture self-employed who never appear in QCEW/CBP. (External source — small fetch from `census.gov/programs-surveys/nonemployer-statistics`.)
5. Result: a *complete, mass-balanced* county × NAICS6 universe with three columns — `ui_covered_jobs`, `nonemployer_jobs`, `total_workplace_jobs`.

**Stage B — Build the block-level spatial prior.**

1. Start from source 2012 (block × NAICS) — `bp_employment` and `wac_employment` already aligned to block. Carry `bp_establishments` separately.
2. For each county × NAICS, compute the *spatial allocation weights*:
   - `w_wac(block) = wac_employment(block) / sum(wac_employment, county)`
   - `w_bp(block)  = bp_employment(block)  / sum(bp_employment,  county)`
3. **Blend the two weight vectors** by a NAICS-aware mixing parameter α(NAICS):
   - α large where BP is a stronger spatial signal (long tail of small firms — retail, food service, professional services, personal services) — α ≈ 0.7–0.8.
   - α small where WAC dominates because chains and large employers concentrate jobs at one geocode (manufacturing, hospitals, schools, public admin) — α ≈ 0.2–0.3.
   - Initial α from the existing BP vs WAC NAICS gap table (e.g., NAICS 81 BP/WAC = 1.73 → BP overshoots, so trust WAC; NAICS 55 BP/WAC = 0.19 → BP undershoots, trust WAC; NAICS 44-45 BP/WAC ≈ 1.08 → blend).
4. **Combined weight** `w(block) = α · w_bp + (1−α) · w_wac`, normalized so Σ over county = 1.

**Stage C — Allocate the county total to blocks.**

For each county × NAICS × year:
- `est_employment(block) = total_workplace_jobs(county, NAICS) · w(block)`.

**Stage D — Iterative proportional fitting (IPF) to reconcile multi-way marginals.**

Constraints to satisfy simultaneously:
- Σ over blocks in county = QCEW + nonemployer total (county × NAICS).
- Σ over NAICS in block = WAC block total × (1 + nonemployer share).
- Tract × NAICS-2 ≈ rollup of imputed-CBP (within tolerance).
- Block × NAICS-broad ≈ LODES CNS bins (treating LODES as a soft constraint because it is partially synthetic).

Run IPF/raking until all marginals converge within tolerance. This is mass-preserving by construction at the county-NAICS6 level, soft at the block level. Standard convergence is 10–30 iterations.

**Stage E — Uncertainty band.**

For each cell, generate `est_low` and `est_high` from:
- LODES noise factor (publicly documented) propagated through `w_wac`.
- BP imputation flag (records where Infogroup imputed employees from sales) propagated through `w_bp`.
- IPF residual disagreement (the gap between `w_bp` and `w_wac` is itself a proxy for cell uncertainty — high disagreement → wider band).

Add a final column `est_confidence` ∈ {high, medium, low} mapped from the existing `score_combined_all` framework in source 2009 (low score = high confidence).

### 4.4 What this gives users

Each block × NAICS row gains:

```
est_employment, est_employment_low, est_employment_high, est_confidence,
est_provenance = {qcew_share, cbp_share, wac_share, bp_share, nonemployer_share},
est_universe   = 'workplace_jobs_with_nonemployer'
```

Rolled-up tract / blockgroup / county rows are derived deterministically.

---

## 5. Extension to wages by industry

QCEW carries `total_annual_wages` at county × NAICS6 × ownership and is the authoritative source for the UI-covered universe. CBP carries `payann_n` at county × NAICS6. WAC has no native payroll (the system already derives `wac_estimated_payroll` heuristically — see source 1993). BP carries a `payroll_lower`/`payroll_upper` band.

**Proposed approach:**

1. Anchor: QCEW `total_annual_wages` at county × NAICS6 + nonemployer earnings proxy from IRS SOI county-level wage data (county × industry) for the nonemployer share.
2. Spatial allocation: same blended `w_bp / w_wac` weight surface from §4, but with an additional **wage-per-job adjustment by NAICS** so blocks heavy on chain HQ (high wages per job) don't get the same average as blocks of branch retail.
3. Use BP `payroll_lower / payroll_upper` only as a *bound* — if `est_wages(block)` falls outside the BP-derived band by >2×, flag the cell.
4. CBP `payann_n` after suppression imputation serves as a second cross-check at county × NAICS-2 / NAICS-3.

Output columns mirror §4.4: `est_wages, est_wages_low, est_wages_high, est_avg_wage`.

---

## 6. Extension to number of establishments

The cleanest establishment story:

- **County × NAICS6 anchor:** prefer `qcew_estabs`; fall back to imputed-CBP `estab` when QCEW is suppressed. Add Nonemployer Statistics establishment counts where present (Nonemployer Stats reports the number of nonemployer firms, which is a reasonable proxy for self-employed "establishments").
- **Block-level allocation:** because Business Points is a *listing*, `bp_establishments(block)` is the natural spatial signal — but it needs the anomaly-detection layer (§7) to strip duplicates, mis-geocodes, and out-of-business records before being used as the weight.
- **Reconciliation:** very low — `bp_establishments` summed to county should be within ±15% of `qcew_estabs + nonemployer_count` after anomaly filtering. Persistent overshoot at the BP side is a quality signal that the cleaning pipeline needs more work.

Output: `est_establishments, est_establishments_low, est_establishments_high, est_establishments_breakdown = {employers, nonemployers}`.

---

## 7. Business-points anomaly detection: misplaced points + missing establishments

This is essentially two complementary classifiers run over BP source 1885.

### 7.1 Likely **misplaced or incorrect** business points

Signals (computed per BP record):

| Signal | Definition | Suggests |
|---|---|---|
| `addr_geocode_quality` | USPS DPV match level + parcel-centroid vs rooftop indicator | Low quality → spatial error |
| `parcel_landuse_match` | Spatial join of BP point to NYS GIS Program Office statewide building footprints + MapPLUTO (NYC) / county tax parcel layers; check if `naics_code` is plausible for the parcel land-use code | Manufacturer in single-family parcel → likely wrong |
| `building_footprint_present` | BP point falls inside or within 30 m of an actual building polygon | If no, point is in water/road/parking — suspect |
| `name_duplicate_within_radius` | Levenshtein-distance fuzzy-match on normalized name within 250 m radius | High → duplicate listing |
| `naics_residential_mismatch` | NAICS code in {{72, 44-45, 31-33, 22, 23}} but parcel zoned residential, no business permit on file | Likely "work-from-home" registration with HQ rooftop coords |
| `bp_block_zero_wac_block_high` | `bp_employment=0` (or very small) in a block where `wac_employment` is large for the same NAICS | BP missed an establishment; flag the WAC block for follow-up |
| `bp_block_high_wac_block_zero` | Reverse of above | BP point likely belongs in a different block |
| `out_of_business_signals` | `out_of_business_on` non-null, `verified_on` stale, `in_business` flag low, `local_listings_claimed_at` stale | Suspect listing is dead |
| `chain_hq_attribution` | `headquarters_id` non-null AND BP employment > 3× sector median for the parcel | Chain reporting all jobs at HQ — needs branch redistribution |
| `cross_source_absent` | Not present in SafeGraph/Advan POI, OSM, EPA FRS, NYS Sales Tax Vendor Registry | If BP-only across multiple panels, lower confidence |

Combine signals into a per-record `bp_anomaly_score` with explicit reason codes, write back to a new view alongside source 1885. Run a simple supervised model (gradient-boosted trees) on the small fraction of human-reviewed records (the QCEW vs BP comparison pages already surface candidate review samples; the BP vs WAC `score_combined_all` ranking gives a priority queue).

### 7.2 Likely **missing** business points

This is the dual problem: blocks where BP under-counts relative to WAC and supplemental signals.

For each block × NAICS:

- `wac_employment − est_employment_from_BP_only > k · σ_NAICS_block` → mark as candidate missing-establishment block.
- Cross-check with SafeGraph/Advan POIs in the block matching that NAICS — if SafeGraph has a POI that does not link to any BP record, propose a draft "missing establishment" record.
- Cross-check with EPA FRS (for industrial NAICS), IRS BMF Form 990 (for nonprofit NAICS 81), OSHA establishment lists, NYS Active Corporations registry, and the Sales Tax Vendor Registry.
- Score each candidate by the number of corroborating sources.

Output: a new derived view `bp_block_gap_candidates` with columns `block_geoid, naics_code, suspected_missing_count, corroborating_sources, priority_score`.

---

## 8. Recommended additional datasets

| Dataset | What it adds | Why |
|---|---|---|
| **Census Nonemployer Statistics** (county × NAICS, annual) | Self-employed without payroll — the gap QCEW/CBP/WAC all miss | Closes the universe; small fetch, public, mass-balanced. |
| **BLS CES** (state monthly) | High-frequency control total | Cross-check current QCEW vintage; useful for nowcasting. |
| **Census SUSB** (firm × estab × size × NAICS6 × county/state) | Establishment size distribution | Validates BP small-firm imputation and clarifies HQ vs branch employment. |
| **Census ABS** (Annual Business Survey, demographic breakdowns) | Owner demographics, R&D, age | Useful sociodemographic overlay; not core to fusion but enriches outputs. |
| **NYS DOL QCEW micro / ES-202** | Finer than BLS public release (~97% NY nonfarm) | Removes most QCEW suppression at the NY level if access is available. |
| **IRS SOI county-level wages** | Wage anchor for nonemployer share | Closes the wages gap for the self-employed segment. |
| **NYS GIS Program Office statewide building footprints + MapPLUTO (NYC) / county tax parcels** | Parcel land-use, building polygons | Drives the BP anomaly detection (parcel/footprint join). |
| **NYS Sales Tax Vendor Registry** (public) | Active-business registry | Cross-source presence check for BP records. |
| **NYS Active Corporations registry** (Department of State, public Open Data) | Firm-level legal entity records | Cross-source presence check; HQ resolution. |
| **EPA FRS, OSHA Establishment Search, IRS BMF (nonprofit)** | Sector-specific admin lists | Anomaly-detection cross-sources for sectors weakly covered by QCEW. |
| **OpenStreetMap amenity / shop tags** | Free POI panel | Cross-source presence check, especially for retail/food service. |
| **SafeGraph / Advan / Veraset Places** (commercial) | POI panel with monthly foot-traffic | Stronger BP anomaly detection; activity signal for "is this BP still operating?" |
| **Revelio Labs / LinkedIn Economic Graph** (commercial) | Worker-side panel | Sanity-check WAC headcount and occupational mix; biased to white-collar — use as a relative signal. |
| **SEC EDGAR** | Public-company HQs and segment employment | Resolves the chain-HQ attribution problem for large publicly traded firms. |

Free public sources (Nonemployer, CES, SUSB, ABS, NYS GIS, NYS Active Corp, EPA FRS, OSHA, IRS BMF, OSM) should be brought in first — they cover ≥80% of the gain at zero acquisition cost. Commercial panels (SafeGraph, Revelio) are second-stage upgrades.

---

## 9. Implementation roadmap

1. **Inventory + access** — confirm credentials for `npmrds2` reads/writes, document the source/view ids enumerated in §1, and verify update cadences for each.
2. **Wire in Nonemployer Statistics** as a new DaMa source in `npmrds2` (small CSV, county × NAICS6 × year). Lowest-effort, highest universe-completion gain.
3. **Implement CBP suppression imputation** (Eckert–Fort–Schott–Yang LP) as a derived view from source 1941. The Python reference code at `fpeckert.me/cbp` is small and re-implementable in plpgsql or run as an offline job.
4. **Build the county × NAICS6 reference table** (Stage A above) as a new DaMa view; store with explicit `ui_covered_jobs`, `nonemployer_jobs`, `total_workplace_jobs`.
5. **Compute the blended weight surface** (Stage B) as a derived view off source 2012, parameterized by α(NAICS). Initial α from §4.3 step 3; refine empirically on the existing BP vs WAC NAICS gap table.
6. **Allocate + IPF reconcile** (Stages C/D) as a stored procedure; output a new block × NAICS view `employment_best_estimate_v1` with the columns in §4.4. Roll up to tract / blockgroup / county.
7. **Wages and establishments pipelines** (§5, §6) — same skeleton, different anchors.
8. **BP anomaly detection** (§7.1) — add `bp_anomaly_score` columns to source 1885 (or a new derived view); start with the heuristic rule-set, layer a small supervised model once labeled data exists.
9. **Missing-BP candidate flow** (§7.2) — a new view `bp_block_gap_candidates`. Build the SafeGraph / OSM / FRS / BMF cross-source layer as separate DaMa sources, then join.
10. **DMS surface** — add a new top-level page `/best_estimates` under the `Business and Employment Reports` hub, with sub-pages for `employment`, `wages`, `establishments`, `bp_anomalies`, `bp_gap_candidates`. Reuse existing Filter / Spreadsheet / Graph / Map components.
11. **Versioning + reproducibility** — version each fusion as `_v1`, `_v2` so changes to α(NAICS) or the imputation are auditable.

---

## 10. Open questions and risks

- **WAC vintage drift.** The DMS pages cite WAC totals (8.8 M – 9.4 M) consistent with reference year ~2021–2022. The current best estimate should be tagged with both the WAC vintage and the QCEW vintage; mixing vintages silently is the most common failure mode.
- **NAICS revision mismatches.** QCEW uses NAICS revisions on a 5-year cycle (NAICS 2017 / 2022); CBP source 1941 already pins to NAICS 2017; LODES uses sector-level CNS bins that map cleanly to 2-digit NAICS but bury the 2017→2022 change. The reference NAICS crosswalk (source 1894) is in place; the pipeline must declare its NAICS revision explicitly.
- **Government employment.** WAC includes federal/state/local from 2012 onward; CBP excludes it; QCEW splits via ownership codes. The county-level anchor must include `own_code in (1,2,3,5)` and the BP allocation step must not redistribute government jobs onto BP private-establishment weights.
- **Chain HQ vs branch.** The single biggest known BP error mode; partial mitigation in §7.1 but the chain redistribution is a multi-step problem in its own right. Likely requires a parent-firm linkage step using `ultimate_headquarters_id`, then a SEC EDGAR / SUSB benchmark to redistribute headcount across known branch locations.
- **LODES partial-synthesis and disclosure.** Single block × single NAICS cells are not safe point estimates. The fusion should *acknowledge* this in the `est_confidence` field — for blocks where WAC contributes ≥50% of the weight and BP confirms ≤2 establishments, mark confidence "low" and widen the band.
- **Update cadence mismatch.** QCEW is quarterly with a 6-month lag; CBP annual with ~2-year lag; WAC annual with ~2-year lag; BP roughly continuous but a published snapshot is annual. The "best estimate" should be tied to a reference *year*, not a reference *date*, and recomputed annually.
- **Privacy.** Any block-level cell that joins admin records (e.g., NYS DOL QCEW micro) must respect BLS / NYS DOL confidentiality agreements; final published cells should pass the same primary/complement suppression rules QCEW already applies. The internal precomputed view can be richer; the publishable view must be redacted.

---

## 11. References

Numbers in [brackets] are the URLs verified during research; group them under the topic that cited them in the document above.

**LEHD / LODES / WAC**
- LODES Technical Documentation v8.1 — <https://lehd.ces.census.gov/data/lodes/LODES8/LODESTechDoc8.1.pdf>
- Federal Employment in OnTheMap — <https://lehd.ces.census.gov/doc/help/onthemap/FederalEmploymentInOnTheMap.pdf>
- Abowd & McKinney, CES-WP-14-30, Noise Infusion — <https://www2.census.gov/ces/wp/2014/CES-WP-14-30.pdf>
- Abowd, Schneider, Vilhuber CES-WP-12-13, Partially Synthetic Data — <https://www2.census.gov/ces/wp/2012/CES-WP-12-13.pdf>
- LEHD Employer Characteristics File (ECF) — <https://lehd.ces.census.gov/data/lehd-snapshot-doc/latest/sections/employer_level/ecf.html>

**QCEW**
- BLS Handbook of Methods — QCEW Concepts — <https://www.bls.gov/opub/hom/cew/concepts.htm>
- BLS QCEW Overview — <https://www.bls.gov/cew/overview.htm>
- NYS DOL QCEW Technical Notes — <https://dol.ny.gov/qcew-technical-notes>
- Chmura, exclusions of railroad / religious / self-employed — <https://www.chmura.com/blog/2016/april/22/why-railroads-religious-organizations-and-self-employed-are-not-included-in-most-employment-estimates>

**CBP**
- Census CBP Methodology — <https://www.census.gov/programs-surveys/cbp/technical-documentation/methodology.html>
- Federal Register — Differential Privacy for CBP — <https://www.federalregister.gov/documents/2023/04/03/2023-06774/differential-privacy-methodology-for-county-business-patterns-data>
- Eckert, Fort, Schott, Yang — NBER w26632 (CBP imputation) — <https://www.nber.org/papers/w26632>
- fpeckert.me CBP imputation code & data — <https://www.fpeckert.me/cbp/>

**Infogroup / Data Axle / NETS**
- UVA Library, Data Axle / Infogroup — <https://library.virginia.edu/data/datasources/licensed/infogroup>
- WRDS Data Axle overview — <https://wrds-www.wharton.upenn.edu/pages/about/data-vendors/infogroup/>
- Barnatchez–Crane–Decker, FEDS 2017-110 (NETS assessment) — <https://www.federalreserve.gov/econres/feds/files/2017110pap.pdf>
- Walls, NETS Database Description — <https://msbfile03.usc.edu/digitalmeasures/cswenson/intellcont/NETS%20Database%20Description2008-1.pdf>

**Spatial allocation / dasymetric**
- USGS dasymetric toolbox tm11c2 — <https://pubs.usgs.gov/tm/tm11c2/tm11c2.pdf>
- HUD Cityscape, urban population analysis — <https://www.huduser.gov/portal/periodicals/cityscpe/vol17num1/ch9.pdf>
- Nature Sci. Data, dasymetric mapping with impervious surface — <https://www.nature.com/articles/s41597-022-01603-z>
- Downscaling occupational employment to tracts (CEUS) — <https://www.sciencedirect.com/science/article/abs/pii/S0143622824001541>

**Supplements**
- Nonemployer Statistics Methodology — <https://www.census.gov/programs-surveys/nonemployer-statistics/technical-documentation/methodology.html>
- SUSB Methodology — <https://www.census.gov/programs-surveys/susb/technical-documentation/methodology.html>
- ABS Methodology — <https://www.census.gov/programs-surveys/abs/technical-documentation/methodology.html>
- BLS CES FAQ — <https://www.bls.gov/web/empsit/cesfaq.htm>
- NYS DOL QCEW — <https://dol.ny.gov/quarterly-census-employment-and-wages>
- SafeGraph Places technical guide — <https://www.safegraph.com/guides/places-data-technical-guide>
- Revelio Public Labor Statistics — <https://www.reveliolabs.com/public-labor-statistics/>
- EPA Facility Registry Service — <https://www.epa.gov/frs/frs-description>

**Cross-source assessments**
- BLS, QCEW vs CBP harmonization — <https://www.bls.gov/osmr/research-papers/2008/pdf/st080020.pdf>
- Census Business Register overview — <https://www.census.gov/econ/overview/mu0600.html>
- OnTheMap — <https://lehd.ces.census.gov/applications/help/onthemap.html>
