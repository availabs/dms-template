# MitigateNY HMP transcription skills

How-to guides for transcribing county Hazard Mitigation Plans into MitigateNY 2.0
(app `mitigat-ny-prod`).

> **Where these live and why.** They are committed here, alongside the MitigateNY project's task
> docs, rather than in [`src/dms/skills/`](../../../src/dms/skills/README.md) — that directory is the
> `@availabs/dms` **submodule**, and this work is site content, not library capability. They sit
> outside `tasks/` because a skill has no completion state; `planning/planning-rules.md` allows
> project material that isn't a task to live directly in the project folder.
>
> They were previously in `references/mny-transcribe/skills/`, which is git-ignored. Moved here
> 2026-08-19 so teammates can read them. The **working folder** — county source documents, per-county
> status, extraction output — is still `references/mny-transcribe/` and still git-ignored.

## The skills

| Skill | Use when |
|---|---|
| [`transcribing-a-consultant-plan.md`](./transcribing-a-consultant-plan.md) | Loading a consultant-authored HMP's **jurisdictional annexes** into the MNY forms datasets (Jurisdictions, Actions, Roles, Participation, Hazards of Concern, Capabilities). **Start here.** |
| [`profiles/tetratech.md`](./profiles/tetratech.md) | The source plan is a Tetra Tech / FEMA-style plan (Suffolk). |
| [`profiles/hagerty.md`](./profiles/hagerty.md) | The source plan is a Hagerty Consulting plan (Nassau) — short annexes, transposed tables, separate action worksheets. |
| [`profiles/independent-jurisdictional-plan.md`](./profiles/independent-jurisdictional-plan.md) | A jurisdiction wrote its **own standalone plan** instead of an annex. A **document-class** profile — it triages and warns rather than predicting a spine, because there is no shared author. |
| [`action-type-tiers.csv`](./action-type-tiers.csv) | You need to **infer** an action's Primary/Secondary/Tertiary Action Type. Consultant-invariant: no consultant states them. Tier scores for the live 17-option vocabulary; the method and guardrails are in the parent skill's Phase 3. |
| [`loading-annexes-into-jurisdictions-dataset.md`](./loading-annexes-into-jurisdictions-dataset.md) | MitigateNY **1.0-site** annexes → the Jurisdictions dataset columns; the write path in depth (Schenectady, Delaware). ⚠ its §4 read-path guidance is marked obsolete in-file — `dms dataset query` now reads split rows anonymously, lexical columns included. |
| [`loading-a-plan-into-a-2.0-pattern.md`](./loading-a-plan-into-a-2.0-pattern.md) | Loading a transcribed plan's **narrative** into a 2.0 county pattern's Annotation slots (enumerate → inventory → crosswalk → fill → verify). Established on Schenectady, applied to Delaware. |
| [`mny-1.0-scraper/README.md`](./mny-1.0-scraper/README.md) | The source is a live **MitigateNY 1.0** county site (`<county>.mitigateny.org`) that must be scraped to markdown first. |

## The two-layer structure

The consultant-plan skill is split so a new consultant costs one new file, not a rewrite:

- **Layer 1** — `transcribing-a-consultant-plan.md`: the MNY target side and the method. Invariant
  across consultants.
- **Layer 2** — `profiles/<consultant>.md`: how that firm structures a plan. One per firm.
  Layer 2 also holds **document-class** profiles (`independent-jurisdictional-plan.md`) for source
  types that have no firm behind them. The difference matters: a consultant profile *predicts* the
  next instance, a document-class profile can only *triage* it.

Adding a consultant: write a Layer-2 profile, reuse Layer 1. If you find yourself editing Layer 1
for a consultant-specific reason, it belongs in a profile instead.

## Worked examples

`worked-examples/` holds the reports from completed runs — read the relevant one before starting a
new county, they are more instructive than the skills alone:

- [`suffolk-annex-load-report.md`](./worked-examples/suffolk-annex-load-report.md) — **a completed
  Phase-5 load**: all 38 Suffolk annexes across five datasets, with the scripts, every owner
  decision, the crosswalk corrections, and the bugs each stage surfaced. The best single example.
- [`suffolk-annex-crosswalk-report.md`](./worked-examples/suffolk-annex-crosswalk-report.md) — a
  Phase-2 crosswalk (112 field mappings). Note the Islip load corrected 11 of its rows; the load
  report above is authoritative where they disagree.
- [`suffolk-preflight-report.md`](./worked-examples/suffolk-preflight-report.md) ·
  [`suffolk-extraction-report.md`](./worked-examples/suffolk-extraction-report.md) — the corpus scan
  and the extraction run that preceded it.
- [`nassau-extraction-report.md`](./worked-examples/nassau-extraction-report.md) — the **Phase-6
  extraction run**: 51 annexes + 142 worksheets + the base plan, every total reconciled against the
  pre-flight, four silent parser bugs, and the 115-item QA punch-list. Read it for how a QA pass
  distinguishes a document defect from a parser bug.
- [`nassau-annex-crosswalk-report.md`](./worked-examples/nassau-annex-crosswalk-report.md) — a
  Phase-2 crosswalk (180 mappings) for a **second consultant**, Hagerty. Read it alongside the
  Suffolk one: same target schema, same subject matter, near-opposite content model. It also folds
  the corpus pre-flight in (all 52 Nassau annex folders) rather than splitting it into its own report.
- [`schenectady-crosswalk-report.md`](./worked-examples/schenectady-crosswalk-report.md) ·
  [`schenectady-pattern-pages-report.md`](./worked-examples/schenectady-pattern-pages-report.md) ·
  [`delaware-load-report.md`](./worked-examples/delaware-load-report.md) ·
  [`delaware-annex-load-report.md`](./worked-examples/delaware-annex-load-report.md) — the 1.0-site
  path, both counties.

## Running the scripts

`scripts/` holds the tooling the skills invoke by name, grouped by the county it was built for.
These are **working scripts from real runs, not maintained tooling** — read one before running it,
and expect county-specific constants inside.

| Folder | What's in it |
|---|---|
| [`scripts/suffolk/`](./scripts/suffolk/) | Tetra Tech extraction + the five dataset builders/writers (`docx_outline2.py`, `build_capabilities.mjs`, `write_jurisdictions.mjs`, `run_batch.mjs`, `rollback.mjs`, …) |
| [`scripts/schenectady/`](./scripts/schenectady/) | The 1.0-site pipeline: `enumerate.mjs`/`build_inventory.mjs`/`fill_slot.mjs`, annex tooling (`annex_lib.mjs`, `gen_crosswalk_csv.mjs`, `write_annexes.mjs`), `lexical.mjs`, `fq.js` |
| [`scripts/delaware/`](./scripts/delaware/) | The same pipeline, second application — the cleaner copy of several scripts |
| [`scripts/nassau/`](./scripts/nassau/) | The Hagerty pipeline, in run order: `preflight.py` (spine + table-shape scan) → `inventory.py` (every file, with docx content probes) → `build_manifest.py` (folder → authoritative files) → `build_aliases.py` (→ geoid, asserts collision-free) → `reconcile_matrix.py` (attendance matrix vs annexes) → `schema_dump.py` / `preload_flags.py` / `verify_hoc.py` (live schema + insert-vs-update census) → **`annex_lib.py` + `extract_annexes.py` + `extract_maws.py` + `extract_baseplan.py`** (Phase 6) → `qa_assertions.py` (punch-list). Plus `extract_independent_plan.py` — the labelled-prose parser for a standalone jurisdictional plan (Freeport), which shares none of the docx machinery. `annex_lib` adds `cell_lines()` and footnote-tolerant table classification on top of `scripts/suffolk/docx_outline2.py`. |
| [`mny-1.0-scraper/`](./mny-1.0-scraper/) | Puppeteer scraper for 1.0 county sites + its own `package.json` (`"type":"commonjs"`, deliberately overriding the repo root) |

**Auth is the CLI's job, not these skills'.** No credentials appear anywhere in this tree, and none
should be added. Mint a session token the one canonical way —
[`src/dms/skills/authenticating-the-dms-cli.md`](../../../src/dms/skills/authenticating-the-dms-cli.md)
— and export it; the scripts read `DMS_AUTH_TOKEN` from the environment and throw if it is unset.

```bash
export DMS_HOST=https://dmsserver.availabs.org DMS_APP=mitigat-ny-prod DMS_TYPE=prod
export DMS_AUTH_TOKEN=<mint per the CLI skill>     # tokens expire ~6h
```

If a script ever needs a credential the CLI doesn't already handle, that is a gap to fix in the CLI
— not a literal to add here.

**`node_modules/` is not committed** — run `npm install puppeteer-core` inside `mny-1.0-scraper/`
before using the scraper.

## The git-ignored working folder

Source documents (`.docx`/`.pdf`/`.xlsx`), extraction output, crosswalk CSVs, per-county backups and
the per-county status table stay in **`references/mny-transcribe/`**, which is git-ignored by design.
Any path in these skills that begins `references/mny-transcribe/` is **local-only — it will not exist
in a fresh clone.** Ask the plan owner for the source material.

`references/mny-transcribe/CLAUDE.md` in particular holds the per-county status table (which counties
are done, which pattern IDs, what's still open) and the environment notes.
