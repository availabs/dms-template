# Suffolk Volume II jurisdictional annexes — load report

**All 38 annexes loaded and reconciled, 2026-08-19.** Sections below are in the order the
work happened: the Islip proving slice, the Patchogue village slice, then the full batch.

**Jurisdiction:** Islip (Town), geoid `3610338000`, Suffolk County (`36103`)
**Source:** `Chapter 15 - Islip (T).docx` (Volume II) + Volume III Appendix B + Volume I
**Date:** 2026-08-17 · **Host:** `https://dmsserver.availabs.org`, app `mitigat-ny-prod`, type `prod`
**Status:** all five datasets loaded and read-back verified. Draft data; not published.

This is the proving run for the remaining 37 annexes. The method and the traps are written up in
[`../skills/transcribing-a-consultant-plan.md`](../transcribing-a-consultant-plan.md) (Layer 1)
and [`../skills/profiles/tetratech.md`](../profiles/tetratech.md) (Layer 2). This file records
what happened and where the artifacts are.

## Result

| Dataset | Source / view | Before | After | Operation |
|---|---|---:|---:|---|
| Jurisdictions | `1346449` / `1346450` | row `1347347`, 8 identity columns | +10 lexical columns | update |
| Capabilities | `1068273` / `1172519` | 0 | **60** | insert |
| Roles | `1473295` / `1473296` | 0 | **18** | insert |
| Participation | `1473468` / `1473469` | 0 | **5** | insert |
| Hazards of Concern | `1473470` / `1473471` | 17, all `Not Reported` | **22** (17 Yes / 5 No) | 17 update + 5 insert |

Verification: every written row read back and diffed field-for-field, structurally and
key-order-insensitively, matched by row id. Zero diffs. For the HOC updates, also asserted that no
field outside the payload changed on any of the 17 pre-existing rows.

## Artifacts

```
suffolk/context/scripts/
  lexical.mjs                 lexical root builder (bold runs, nested lists)
  build_jurisdictions.mjs     annex tables -> Jurisdictions lexical columns
  write_jurisdictions.mjs     backup, write, read-back diff
  build_capabilities.mjs      Tables B/P/Q/R/S/T -> 60 Capabilities rows
  build_roles.mjs             Table A (+ Table O, + Appendix B) -> 18 Roles rows
  build_participation.py      Volume III Appendix B matrix -> 5 Participation rows
  build_hoc.py                Tables F/I -> 17 updates + 5 Other inserts
  insert_rows.mjs             generic create-then-fill loader (capabilities|roles|participation)
  write_hoc.mjs               HOC update-in-place + Other inserts

suffolk/context/payloads/      payload JSON + generated review markdown, per dataset
suffolk/context/backups/       pre-write state: juris_3610338000_PRE.json, hoc_3610338000_PRE.json
suffolk/context/created/       every inserted row id, written BEFORE its fill (rollback list)
```

Rollback: `dms raw delete mitigat-ny-prod "<dataType>|<viewId>:data" <id>` over the `created/` lists;
restore the two `backups/` files for the update-in-place rows.

## What was loaded

**Jurisdictions (10 columns)** — `lhmp_declared_disasters` (Table C, 6 declarations),
`lhmp_historic_occurances` (Table D, 1 of 16 rows — the other 15 repeat one boilerplate sentence),
`lhmp_critical_buildings` (Table E, 29 of 65 facilities protected to the 0.2% level),
`growth_and_development_trends` (Tables L+M, 6 recent + 7 anticipated), `nfip` (Table O, 21 topics),
`lhmp_problem_areas` (23 problem statements + a 19-item nested facility list), `lhmp_dams`,
`lhmp_completed_actions` ("None"), `lhmp_cascading_impacts` (Table G, 20 assets),
`lhmp_previous_actions_evaluation` (status tally of the 21 prior actions).

Left empty: `lhmp_municipality_profile` (no authored prose exists in a Tetra Tech annex),
`lhmp_capacity_to_implement` and `lhmp_prioritization` (would be composed roll-ups with no verbatim
source — owner decision).

**Capabilities (60)** — B 2, P 16, Q 8, R 18, S 7, T 9.
**Roles (18)** — 1 primary POC, 2 alternate POCs, 1 FPA, 13 contributors, + 1 Appendix-B-only.
**Participation (5)** — of 9 tracked meetings; Islip skipped both 11/18 kickoffs and the second day
of each two-day session.
**HOC (22)** — 12 named hazards with content, 5 explicit `No`, 5 `Other` inserts.

## Owner decisions taken during the run (2026-08-17)

| Decision | Choice |
|---|---|
| Review gate | generate → show → write, per step |
| Participation source | Volume III Appendix B attendance matrix |
| Table G placement | `lhmp_cascading_impacts` |
| Composed roll-ups | only `lhmp_previous_actions_evaluation`, as a factual tally |
| Capabilities row-kind flags | set them **in addition to** `primary_capability_type` |
| Roles `role` vocabulary | declared options; ambiguous titles resolved individually |
| Ambiguous role titles | Planning & Development Engineering→Civil Engineer; Senior Account Clerk→Fiscal Staff; Parks & Recreation→Public Works Professional; Airport→Stakeholder - Critical Facility Manager |
| Method-of-Participation text | verbatim into Roles `comments`, + `meeting_participation = Jurisdictional Team` |
| Appendix-B-only participants | create a Roles row, provenance in `comments` |
| Name spelling conflicts | Roles keeps the annex spelling; attendance text keeps Appendix B's |
| Derived HOC booleans | infer + flag in `other_comments`, per the Allegany precedent |
| Unassessed hazards | `hazard_of_concern = No` **plus** a factual `reason_for_exclusion` |

## Corrections to the pre-load crosswalk and report

Found by calibrating against stored rows rather than the declared schema. All are recorded in the
skill; listed here because they change the crosswalk CSV itself.

| Crosswalk said | Reality |
|---|---|
| `administering_agency_organization` | dead column (0 of 2,000 rows); use `administering_agency` (1,313) |
| *(not mentioned)* | `primary_capability_type` is set on 1,544 / 1,621 jurisdiction rows |
| `supports_crs_points` | actual name `supports_community_rating_system_crs_points` |
| address → `gap-no-target` | `address_optional` exists and 49 live rows use it |
| HOC prose needs lexical roots | stored as **plain strings** (140/140, 334/334) |
| `hazard` select has no `Other` | it does, and 10 `Other` rows already exist statewide |
| checkbox = Boolean | `"x"` in Capabilities, `"Yes"`/`"No"` in HOC |
| Table Q ≈ 10 plans, Table S ≈ 8 fiscal | **8** and **7** |
| Identified Issues ≈ 19 bullets | **23** top-level + **19** nested = 42 |
| flat-dataset import path unknown | `dms raw create` + `dms dataset update`; no workbook needed |

## Still open

- **`CPT` and `GIS Kickoff`** are expanded nowhere in Volumes I or III. Islip attended neither, so
  this did not block the slice — it will block any jurisdiction that did attend.
- **`appendix_b_label` column** should be added to `suffolk-jurisdiction-aliases.csv`. Appendix B uses
  a fifth naming form (`Islip, Town of`); the name transform will not hold for `Village of the Branch`
  or the two non-census entities.
- **Actions** was out of scope for this slice. The 2026 proposed actions are already delivered in
  `Suffolk_County_Actions_2.0_reconciled v2.xlsx`; the **471 prior-cycle actions are not** and remain
  the largest unfilled gap.
- **Michael Andre's `role`** (`Community Planner`) is inferred from a department name, not stated.
- **Table U** (per-hazard adaptive capacity) and **Table V** (14 prioritization scores) remain
  `gap-no-target` — extractable, no column to hold them, schema decision pending.
- **Shinnecock** needs its 17 HOC rows created; **Suffolk County Water Authority** needs a
  Jurisdictions row on synthetic geoid `3610390001` plus 17 HOC rows.
- Nothing is published. Data is draft.

## Second slice: Patchogue (Village), geoid 3656660 — 2026-08-18

Run because every earlier load was a **Town**; villages have 7-digit geoids, the shape that hid
the worst bug. Result: loaded and verified, and it caught four more defects.

| Dataset | Before | After |
|---|---|---|
| Jurisdictions row `1347867` | 8 identity columns | +9 lexical columns |
| Capabilities | 0 | 42 |
| Roles | 0 | 3 |
| Participation | 0 | 4 |
| Hazards of Concern | 17 `Not Reported` | 22 (17 Yes / 5 No) |

`geoid_county` is `36103` on every written row — the slicing bug is genuinely fixed.

**Defects the village slice caught that the Town slice could not:**

1. **`write_hoc.mjs` still sliced the county geoid.** Fixed in the *builder* but not the *writer*.
   `'3656660'.slice(0,5)` = `36566`, so the pre-existing-row query returned nothing and the writer
   refused. Loud failure, no damage — but it proves one fix per bug class is not enough; grep for
   the pattern across every script.
2. **Hardcoded "Town of Islip" in generated prose.** `lhmp_critical_buildings`,
   `lhmp_cascading_impacts` and `lhmp_previous_actions_evaluation` each embedded Islip's name in a
   sentence, which would have been written into all 38 jurisdictions' content, silently.
3. **The Table D boilerplate regex was Islip-specific.** Islip's repeated sentence is *"This event
   had minimal impact on the TOI…"*; Patchogue's is *"No impact reported."* — 16 of 19 rows. The
   hardcoded regex deduped nothing for the other 37. Now detected from the data: the single
   most-repeated answer is treated as boilerplate when it covers ≥40% of rows and repeats ≥3 times.
4. **Empty lexical values were being written.** `lhmp_critical_buildings` asserted "…0 are already
   protected:" over an empty bullet list on **37 of 38** jurisdictions (Islip had 29 of 65, masking
   it), and `lhmp_historic_occurances` came out entirely empty on 17 where every Table D row is
   boilerplate. A column holding an empty root renders as a populated-but-blank box. Both now
   omit the column instead; a general post-filter drops any column whose rendered text is empty.

## Query-sizing rule (owner, 2026-08-18)

Never issue a large or unbounded query blind: probe with `--limit 1`, project the full size, and
check in above ~10 MB. `dataset query` has no column projection, so a lexical-heavy dataset returns
all prose on every row — the Jurisdictions dump is **~67 MB** for 2,345 rows. Measured per dataset:

| Dataset | Rows | ~Bytes/row | Full fetch |
|---|---:|---:|---:|
| Capabilities | 3,078 | 1,817 | ~5.3 MB |
| Roles | 373 | 101 | ~0.04 MB |
| Participation | 216 | 510 | ~0.1 MB |
| Hazards of Concern | 27,567 | 572 | ~15.0 MB |

`insert_rows.mjs` now filters where `geoid_juris` is scalar (Capabilities, Participation) and
full-fetches only Roles, where the array storage forces it but the dataset is 40 KB. That removes
~390 MB of transfer across the batch.

## Full batch — all 38 annexes complete (2026-08-19)

Loaded via `run_batch.mjs`, sequential, with every step's guards active. **30 jurisdictions in the
final run, 0 hard failures**, after 8 loaded during the slices and an earlier run that was stopped
after 5 (see "Interruption" below).

### Reconciled against the live database

| Dataset | Rows | Detail |
|---|---:|---|
| Jurisdictions lexical columns | **330** | 7–12 per jurisdiction |
| Capabilities | **1,943** | 0–76 per jurisdiction |
| Roles | **160** | 148 with a mapped `role` (92%) |
| Participation | **108** | 0–6 meetings attended per jurisdiction |
| Hazards of Concern | **836** | 646 Yes / 190 No / **0 Not Reported** |

**38 of 38** jurisdictions carry a complete 22-row HOC set (17 named + 5 `Other`) with zero rows left
*Not Reported*. Zero anomalies in the reconciliation sweep.

Two jurisdictions legitimately hold more than the loaded columns: **Bellport** (11) and **Village of
the Branch** (12) carry pre-existing town-authored content in `description`,
`lhmp_planning_process` and `lhmp_risk_overview`, which this load does not target. **Suffolk County
Water Authority** has 0 Capabilities rows — its annex omits Tables Q/R/S/T/U entirely and reports no
ordinances or participating programs, which is correct for a water authority.

### Interruption and recovery

The first batch run was stopped after 5 jurisdictions, mid-write on Brookhaven. Recovery was clean
because the `created/` id records are written **before** each fill:

- Brookhaven's Jurisdictions row had completed; 25 of 66 Capability rows existed, all filled, no
  created-but-unfilled orphans. `rollback.mjs` deleted the 25 and the jurisdiction re-ran clean.
- Every other step's guard did its job on resume: Brookhaven's Jurisdictions write reported
  `skip(guard)` rather than overwriting itself.

**This is the argument for recording ids before the fill.** Without it, identifying which 25 of 66
rows existed would have meant inferring from log output.

### One content-loss bug the batch surfaced

Brookhaven came through with **4** `Other` rows instead of 5. The builder keyed HOC rows off Table F
(local-impacts narratives), but Brookhaven **ranks Groundwater Contamination "Medium"** in Table I,
with a full trend description and no Table F paragraph. The hazard the plan explicitly assessed got
no row at all.

Fixed generally rather than by hand: rows now key off the **union of Tables F and I**. Where a hazard
is ranked but has no narrative, the row carries the ranking and trend in `other_comments`, and
`general_vulnerability` plus the four vulnerability booleans are left **unset** with a note saying
they have no source — rather than inferring from prose that does not exist. Corpus-wide check:
Brookhaven is the only affected jurisdiction of 38.

Two writer fixes came with it, both making re-runs idempotent: `Other` rows already present are now
**skipped** instead of refusing the whole insert set (which is what allowed adding just the one
missing row), and `--inserts-only` no longer applies the update-target and dirty checks, which had
made a re-run refuse purely because the earlier run had succeeded.

### Append mode (Village of the Branch)

`lhmp_historic_occurances` already held town-authored text. Owner decision: append, don't overwrite.
The merged column is the town's paragraph, then an `Added from the 2026 jurisdictional annex` H3
marker, then the annex content.

**One row per geoid.** Jurisdictions is keyed one row per municipality statewide and the annex page
renders by geoid selection, so a second row for the same geoid would make that selection ambiguous.
`write_jurisdictions.mjs` refuses before writing if it finds more than one.

Append mode is **idempotent on two conditions**, and both are needed: the marker is present, *or* the
existing text already contains this payload's text. The second is the one that bites — after a
successful append run *every* target column has text, so on a re-run the other eight columns look
like collisions and would be appended to themselves, doubling their content. Testing the re-run is
what caught it.

## Next

Volume II is done. Remaining Suffolk work, none of it blocking:

- **Volume I county content pages** — mapping spec written, execution pending (separate task doc).
- **Prior-cycle actions** — handled in parallel by another staff member; a skill for it will be
  written later and merged into this process. Actions are current in the system.
- **Table U** (per-hazard adaptive capacity) and **Table V** (14 prioritization scores) remain
  `gap-no-target` — extractable, no column to hold them. Schema decision.
- **`CPT` / `GIS Kickoff`** meeting abbreviations are still unexpanded in Volumes I and III. They are
  carried verbatim in `meeting_name` with a note; worth a question to the contractor.
- **Concurrent editors** — Bellport and Village of the Branch carried pre-existing content in
  `description` / `lhmp_planning_process` / `lhmp_risk_overview`, suggesting a parallel effort against
  source `1346449`. Nothing collided, but worth confirming who else writes there.
- Nothing is published. All data is draft.
