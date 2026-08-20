# Transcribing a consultant HMP into the MitigateNY 2.0 county template

How to take a Hazard Mitigation Plan authored by an outside consultant (Tetra Tech, and whoever
comes next) and land its content in the MitigateNY 2.0 forms datasets.

**Scope:** this covers the *jurisdictional annexes* → **forms datasets** path (Jurisdictions,
Actions, Roles, Participation, Hazards of Concern, Capabilities). For county *content pages*
(lexical page components) see [`loading-a-plan-into-a-2.0-pattern.md`](./loading-a-plan-into-a-2.0-pattern.md). For 1.0-site annexes see
[`loading-annexes-into-jurisdictions-dataset.md`](./loading-annexes-into-jurisdictions-dataset.md).

> **The one rule:** the source plan's *content model* — not its subject matter — decides what is
> mappable. Two plans can cover the same county and the same hazards and still need completely
> different transcription work. Inventory the model before mapping anything. **Invent nothing.**

---

## The consultant-profile pattern

Everything in this skill splits into two layers. Keep them separate or the next plan will be
painful.

**Layer 1 — invariant (this file).** The MNY target side and the method. The six forms datasets,
their columns and types, what the platform auto-populates, the disposition vocabulary, the load
paths, the review gates. This does not change when the consultant changes.

**Layer 2 — the consultant profile (`profiles/<consultant>.md`).** How *that* firm structures a
plan: section spine, table inventory, where authored content hides, extraction quirks, taxonomy
deviations. One file per firm. Written once, reused for every county that firm delivers.

When a new consultant appears, you write a new Layer-2 profile and reuse all of Layer 1. When you
find yourself editing Layer 1 for a consultant-specific reason, you've put something in the wrong
layer.

Existing profiles:
- [`profiles/tetratech.md`](./profiles/tetratech.md) — Tetra Tech / FEMA-style. Suffolk (2026), Nassau.

---

## Phase 0 — Classify the source (do this first, always)

Three questions, in order. The answers determine whether the rest of the work is hours or weeks.

**1. Is the plan prose-shaped or survey-shaped?**

- **Prose-shaped** — authored narrative per jurisdiction (MitigateNY 1.0 sites; Schenectady,
  Delaware). Maps onto the Jurisdictions dataset's ~30 **lexical** columns. Extraction is about
  finding the authored blocks and preserving their structure.
- **Survey-shaped** — a structured instrument of filled-in tables (Tetra Tech). Maps mostly onto the
  **flat** datasets: Capabilities, Actions, Roles, Hazards of Concern. The Jurisdictions lexical
  columns are a *minority* target.

Getting this wrong is the expensive mistake. On Suffolk, only **15 of 109** field mappings landed in
Jurisdictions; assuming the Schenectady playbook transferred would have missed ~86% of the annex.

**2. Was any of it already delivered in another format?**

Consultants often ship structured workbooks alongside the document. Check before extracting
anything. On Suffolk, `references/mny-transcribe/suffolk/Suffolk_County_Actions_2.0_reconciled v2.xlsx` (git-ignored) already held all 523 proposed
actions — re-extracting them would have been pure waste. **But verify coverage rather than assuming
it:** that same workbook omitted every *prior-cycle* action, several hundred records that were still
sitting in the annexes.

Verify by counting: pick one jurisdiction, count the source records in the document, count the rows
in the workbook, and confirm they match.

**3. Does the plan's hazard taxonomy match MNY's?**

It usually doesn't. Resolve this before touching Hazards of Concern or Actions — it is a
data-modelling decision with an owner in the loop, not something to settle mid-extraction.

---

## Phase 1 — Inventory the source structure

Produce a heading + table outline for **one representative annex**, then confirm the spine holds
across the variant types (a town, a village, a special district / authority, a tribal nation).

```bash
python scripts/suffolk/docx_outline2.py "<annex>.docx" --headings > outline.txt   # spine
python scripts/suffolk/docx_outline2.py "<annex>.docx" --maxchars 300 > full.txt  # + table content
```

You are looking for: the section spine, the table inventory (with shapes — a `15x2` recurring in
every chapter is a fixed instrument), and **where the authored content actually is**. In a
survey-shaped plan the authored content is specific table *columns*, not sections.

Record which sections are omitted per jurisdiction type. In a well-run consultant plan sections are
omitted but never renamed or reordered — that stability is what lets one parser handle all chapters.

### Then pre-flight the whole corpus before batch-extracting

A structural scan of **every** chapter — shapes and counts only, no content mapping — is cheap and
repeatedly catches things one deep sample cannot. On Suffolk it found, in a single run: one chapter
with a shorter hazard list (breaking row math extrapolated from samples), one with numbered
headings, nine using a second bullet style (a 113-item undercount), an action-table classifier that
silently dropped rows, and two chapters internally inconsistent between their action tables and
their prioritization table.

Three of those five were bugs in my own parser. Batch-extracting first would have produced 38
chapters of quietly wrong output.

Build the scan to report **per-chapter counts plus warnings**, and give it cross-checks that can
disagree with each other — comparing the action-table count against the prioritization-table row
count localized two real document defects immediately. Reconcile the totals against any
consultant-delivered workbook while you're there. The scan's output is also your work estimate.

**Classify tables by section + shape, not by header text.** Header wording drifts between chapters
and the failure is silent.

### Extraction traps

**`python-docx` silently drops content controls.** `Paragraph.text` only walks `w:r` elements that
are *direct* children of `w:p`. Every Word checkbox lives inside a `w:sdt` content control one level
deeper, so checkbox state vanishes and a checkbox row extracts as a run-on list of every option with
no indication of which is ticked. This looks exactly like "the data isn't in the document." It is.
`docx_outline2.py` walks the XML and emits `[x]` / `[ ]`.

Before concluding any field is unrecoverable, check:

```bash
python -c "import zipfile,re; x=zipfile.ZipFile('<annex>.docx').read('word/document.xml').decode('utf8','replace'); \
print('checked', len(re.findall(r'w14:checked w14:val=\"1\"', x)), \
      'unchecked', len(re.findall(r'w14:checked w14:val=\"0\"', x)))"
```

**Merged cells must be de-duplicated by element identity, not by text.** `python-docx` returns a
horizontally merged cell once per grid column. De-duplicating on cell *text* also collapses adjacent
distinct cells that happen to share text — which silently destroys every checkbox grid (`[ ] || [ ]`
becomes one cell) and misaligns scoring tables. Compare `cell._tc is previous_tc` instead.

**Pull-quote and text-box paragraphs are emitted 2–4×**, and `body.iter()` double-counts paragraphs
inside tables. De-dupe before transcribing.

---

## Phase 2 — Build the crosswalk

One row per **source field**, not per section. This is the deliverable that governs everything
downstream, and it is where judgement gets recorded so it doesn't have to be re-litigated.

```
annex_section, annex_subsection, annex_table, source_field,
target_dataset, target_column, column_type, disposition, notes
```

Get the target side from the **live source config**, never from a workbook header — display names
and column names differ, and types matter:

```bash
node src/dms/packages/dms/cli/bin/dms.js raw get <source-id> --format json \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
      const c=JSON.parse(JSON.parse(s).data.config);
      c.attributes.forEach(a=>console.log([a.name,a.type,a.display||'',a.display_name].join(' | ')))})"
```

Jurisdictions source is `1346449` (view `1346450`), type `test_meta_forms_env|jurisdictions:source`
— statewide, one row per NY municipality, 42 attributes of which **30 are `lexical`**.

**The workbook `* Dictionary` tabs are not exhaustive.** Before declaring a column missing, check
the **data tab's header row**, not just the dictionary. `Hazard Name, If Other` is column 7 of the
Hazards of Concern data tab but absent from the HOC Dictionary — reading only the dictionary
produced a phantom "schema gap" in the Suffolk crosswalk. Where the two disagree, trust the data
tab, then confirm against the live source: the discrepancy may mean the workbook and live schema
have drifted.

**Trust only the live source for *types* and *option values*.** The workbook dictionaries describe
intent, not the schema. On the live HOC source, columns the dictionary called "Rich Text" are
actually `lexical` (they need a lexical root payload, not a string), "Boolean" columns are
`checkbox` with `Yes`/`No` values, and `likelihood` turned out to be a **probability band**
(*Minimum/Low/Medium/High/Maximum Likelihood*), not the increase/decrease **trend** the dictionary
name suggested — a mapping I had to correct after checking. **Dump every select/radio's options
before mapping a value onto it**, and confirm the vocabulary the *stored rows* actually use, which
can differ from the declared options.

### Disposition vocabulary

| Value | Meaning |
|---|---|
| `dataset-fill` | Transcribe into a forms dataset |
| `auto-populated` | The platform generates it — **do not transcribe** |
| `already-delivered` | Covered by a consultant workbook; cross-check only |
| `boilerplate` | Identical across chapters; the template supplies it |
| `constant` | Set a fixed value per source table (e.g. `plan_guidance=TRUE` for all "Plans" rows) |
| `filter` | An include/exclude condition, not a value (e.g. "In Place? = No" → no row) |
| `derived` | Must be inferred from other content — flag the rule, never guess silently |
| `lossy` | Target exists but is narrower than the source (prose → boolean) |
| `gap-no-target` | Extractable, but no column exists — **owner decision** |
| `gap-partial` / `gap-empty` / `gap-weak` | Source thin, absent, or a poor fit |

Distinguish `gap-no-target` (schema problem, owner decides) from an extraction problem (tooling, you
fix it). Conflating them gets content wrongly written off — see the checkbox trap above.

### Do not transcribe what the platform already knows

MNY 2.0 auto-populates census demographics, building-stock replacement values, NFIP policy/claim
statistics, presidential disaster declarations, NYSDEC dam inventory, critical-facility inventories,
and hazard maps. Consultant plans reproduce all of these as tables. Transcribing them creates
divergent duplicates of authoritative data.

The exception is the **jurisdiction-authored column inside an otherwise auto-populated table** —
e.g. a disaster-declaration table where every column is federal data except *"Summary of Damage and
Losses in <Jurisdiction>"*. That column is the valuable part. Read table-by-table, not row-by-row.

---

## Phase 3 — Owner decisions before extraction

Batch the `gap-*` and `derived` rows into one decision list and get answers **before** building
extractors. Each answer changes what the extractor emits.

Recurring decisions:

- **Hazard taxonomy.** MNY has **18 types** (17 named + `Other`); consultant taxonomies rarely match.
  Build the full source→MNY table before extracting, and expect three kinds of row.
  **Established defaults (owner, 2026-08-14):**
  - *Non-standard* hazards → `Hazard = Other`, verbatim name in `Hazard Name, If Other`,
    consistently across Actions *and* Hazards of Concern.
  - *Combined* profiles (one source hazard spanning several MNY types) → **split into one row per
    MNY type**, duplicating the shared prose to each child and marking it `derived`. Check whether
    the county's content pages already made this call — matching them keeps the volumes consistent.
  - *Unassessed* MNY hazards → explicit `hazard_of_concern = No`, not *not-reported*.

  Sub-hazards with no MNY type at all (e.g. expansive soils) are dropped — record that, don't
  silently lose it.
- **Structured content with no column.** Per-hazard capacity ratings, per-criterion prioritization
  scores, three-level hazard rankings where the schema stores a boolean. Per the author-empowerment
  principle, prefer **adding a column** over flattening structured content into prose.
- **Placement of homeless prose.** Where does a large authored block go when no column matches? This
  is a per-county call. Delaware aggregated per-hazard narratives into `lhmp_risk_overview` under H3
  headings — that was a decision for Delaware, not a precedent to apply silently.

---

## Phase 3b — Build the jurisdiction alias table first

**Resolve jurisdiction identity from one explicit table, never from parsed names.** Build it before
extracting anything; it is the cheapest guard against the worst failure mode — content filed under
the wrong jurisdiction, which is silent and only found by a human reading the wrong annex.

Names disagree across *every* source. One Suffolk place appears as `Shinnecock Tribal Nation`
(annex file), `Shinnecock Tribal Nation` (document H1), `Shinnecock (Tribal Nation)` (consultant
workbook) and `Shinnecock (Reservation)` (Jurisdictions dataset) — all geoid `3610367059`. Same for
`The Branch (Village)` ↔ `Village of the Branch (Village)`.

Emit one row per source chapter: `chapter_file, annex_name, geoid, jurisdictions_title,
municipality_type, census_type, <consultant workbook label>, in_jurisdictions, in_hoc, note`. Then
assert **distinct geoids == chapter count** and no empty geoid. The `in_*` flags double as the
pre-load checklist — they are how you discover which entities need rows created. See
`scripts/suffolk/build_alias_table.py`.

Consultant chapter numbers are an organizational relic — MNY tracks none of them. Keep them only as
a provenance breadcrumb.

### Non-census entities (tribal nations, authorities, special districts)

Consultant plans include participants with no census geography. **Check whether the entity already
exists before inventing anything** — Shinnecock looked like a gap but was already present with the
right geoid and an established `Reservation` class (9 statewide). Only its HOC rows were missing.

When one genuinely is new, mint a synthetic geoid that behaves like a real one:

- **Numeric, and the same length as the real ones** (10-digit cousub format in NY). `GeoID (Number
  Only)` and `geoid_num` are *calculated numeric casts*, and HOC's `geoid_juris` is a string array —
  a key like `36103-SCWA` risks breaking both.
- **Keep the county prefix** so existing county filters pick it up with no special-casing.
- **Use a verified-unused suffix block** and reserve it for future non-census entities. In NY,
  `<county>` + `9xxxx` is free — zero of 970 cousub geoids statewide use a 9-prefixed suffix.
  Verify before assuming; don't reuse this without re-checking.
- **Mark it explicitly** — a distinct `municipality_type` (e.g. `Authority`) and a `census_type`
  like `Non-Census`, so it is never mistaken for real census geography and stays filterable.

## Phase 4 — Extract to structured JSON

One pass over all chapters → one JSON file per jurisdiction, keyed by section and table. Extract
faithfully; do not map yet. Keeping extraction and mapping separate means a changed owner decision
costs a re-map, not a re-extract.

Carry a `_provenance` field (chapter file, table label, row index) on every record. When a reviewer
disputes a value you need to point at the cell it came from.

**Keep every table verbatim alongside the parsed instruments.** The parsed view is a convenience;
the raw rows are the insurance. A changed owner decision should cost a re-map, not a re-extract.

**Prove the extractor on one jurisdiction whose numbers you already know before running the batch.**
On Suffolk that caught four real bugs in one pass — including prior actions silently extracting as
zero because a heading sat at H4 instead of H3.

**Where identity can't be parsed, recover it — but only when it's provably safe.** 26 of 522 Suffolk
action tables had no caption and therefore no ID; they were recovered positionally from the
prioritization table, *only* for chapters where the two counts agree, and tagged as derived.
Refusing to guess elsewhere is what surfaced a genuine source defect instead of burying it.

**Flag duplicate identifiers; never silently dedupe.** Two Suffolk chapters reuse an action ID
across genuinely different actions. Collapsing them loses one action outright.

**Trust the extraction over the scan when they disagree — after finding out why.** The Suffolk
pre-flight reported 450 prior actions and the extractor 471. The extractor was right: the scan's
`^\d{4}-` ID pattern skipped 21 actions numbered `SBU-###`/`SBSH-###`. Reconcile every count
difference to a cause; don't average them or assume the earlier number was the careful one.

---

## Phase 5 — Generate review artifacts, then load

Choose the intermediate by dataset shape. This is not a stylistic preference — it follows from how
each dataset is written.

**Flat datasets** (Roles, Capabilities, Hazards of Concern, Actions) → **a JSON payload file per
dataset plus a generated markdown review sheet**, then load via the CLI. Workbook tabs are *not*
needed: the flat-dataset load path turned out to be the same CLI the Jurisdictions load uses (see
below), so a spreadsheet is a detour. Emit tabs only if DHSES or the consultant specifically wants
a workbook to review.

**Jurisdictions lexical columns** → **per-jurisdiction markdown**, reviewed, then compiled to
lexical JSON. Never hand-author lexical JSON into spreadsheet cells: a cell holding a serialized
node tree cannot be reviewed, and the write path takes JSON files anyway.

**Have each builder emit its own review markdown next to the payload.** One file per dataset per
jurisdiction, listing every row and field it will write, the counts per source table, and the
reasoning behind each judgement call. It costs a few lines in the builder and it is what makes a
generate → review → write gate actually reviewable. Put the owner decisions *in* it, dated, so the
next person doesn't relitigate them.

Note `pyxlsb` is **read-only** — writing means emitting `.xlsx` or driving Excel. Check for `~$`
lock files before writing anywhere near a workbook someone has open.

### The Jurisdictions write path (proven twice)

```bash
dms dataset update <source-id> <row-id> --data <file.json>
```

- Auth: mint a JWT (`POST {host}/login`) → export `DMS_AUTH_TOKEN`. See
  [`src/dms/skills/authenticating-the-dms-cli.md`](../../../src/dms/skills/authenticating-the-dms-cli.md).
- Column values are a lexical **root** object — `{"root":{"children":[…],"type":"root",…}}` — not
  the `{text:{root}}` wrapper used by page components.
- The server **shallow-merges** into the row's `data` JSONB, so send only the columns you fill.
- Pass `--data` as a **file path**; lexical payloads blow the Windows arg-length limit.
- Filter to your county via `county_geoid`, and **skip `census_type = CDP` rows** — census
  artifacts, not plan participants. Suffolk: 172 rows for `36103`, but only ~38 real jurisdictions.

**Reads no longer need the empty-merge trick** (2026-08-17). `dms dataset query <src> --view <v>`
resolves split rows anonymously *including* lexical columns — verified by reading back Delaware's
`lhmp_risk_overview`. Earlier guidance here and in [`loading-annexes-into-jurisdictions-dataset.md`](./loading-annexes-into-jurisdictions-dataset.md)
said `byId` never resolves split rows and you must do a no-op empty merge and read the RETURNING.
That is obsolete; don't bump `updated_at` and burn a changelog entry just to read a row.

### The flat-dataset load path — inserting rows (established 2026-08-17)

This was the last open unknown in the Suffolk plan. There is no import path to discover: **you
create rows with the same CLI**, and no submodule change is needed.

```bash
dms raw create <app> "<sourceInstance>|<viewId>:data"        # -> new empty row id
dms dataset update <source-id> <newId> --data <file.json>    # fill it
```

- `dms.data.create` honours a **split-table** type — the `:data` suffix routes it to the split
  table exactly as `dataset update` does (see dms-server `tests/test-table-splitting.js`).
- **Two calls, not one.** `raw create --data` parses inline JSON only, which blows the Windows
  arg-length limit on prose columns; `dataset update --data` takes a path. Create empty, then fill.
- `dms raw delete <app> "<type>" <id>` removes a row, so the whole load is reversible.
- **Prove the path with one throwaway row before generating the full set** — create, fill, query it
  back through the filter you intend to use, then delete it.

**Record every created id to a file BEFORE filling it.** If the run dies between create and fill you
have an orphan empty row with no record of it. Write the id, then write the data.

**Guard against double-insert, and don't trust `--filter` to do it.** Re-running an insert loader
silently doubles a jurisdiction, and the read-back still reports success because every row it wrote
is present. See the filter trap below — a guard built on `--filter` over an array-valued column
reports zero existing rows *always*, which is exactly the case where the guard matters.

### Dry-run every builder over the WHOLE corpus before loading the second jurisdiction

The vertical slice proves the *method*. It does not prove the *code*, because one
jurisdiction exercises one shape. Run every builder over all chapters — build only, no
writes — and count failures per builder. On Suffolk this took minutes and turned up five
bugs after a fully verified single-jurisdiction load, two of them silent:

**A jurisdiction geoid's first five digits are NOT the county geoid.** NY village geoids are
7 digits (`36` + a 5-digit place code), so Amityville `3602044` slices to `36020`, not
`36103`. Only 10-digit cousub geoids and the 5-digit county geoid slice correctly — which is
exactly why a slice built on a *Town* looked fine. **25 of 38** jurisdictions would have been
written with a wrong county, silently, becoming invisible to every county-level filter.

Never derive one geographic identifier from another by string surgery. Build an index from
the authoritative dataset once (`build_index.py` → `juris_index.json`, keyed by geoid,
carrying `county_geoid` / `county` / `census_type` / the Jurisdictions row id) and have every
builder read it. It also gives you a free assertion: any annex geoid missing from the index
is an entity with no Jurisdictions row.

**Per-jurisdiction exceptions must be keyed by geoid.** A hand-added row recorded as a flat
list — one participant found in the attendance log but not the annex — was appended to
*every* jurisdiction, putting one town's planner into all 38. Any override, alias or
exception table needs the geoid as its key, and the dry run over the corpus is what exposes
it: the same name appearing in all 38 payloads is obvious in aggregate and invisible in one.

**Subprocess pipes need an explicit encoding on Windows.** `subprocess.run(..., text=True)`
decodes as cp1252 and dies on the first smart quote, leaving `stdout` as `None` — which
surfaces as a baffling `AttributeError: 'NoneType' object has no attribute 'index'`. Pass
`encoding="utf-8"`. This is the same trap as the extractor's `PYTHONIOENCODING`, in a new place.

**Missing tables are normal, not exceptional.** Special districts, tribal nations and the
county chapter omit whole sections. Have the table accessor return empty rather than throw,
skip each section when its table is absent, and *record which were absent* in the review
sheet so a reviewer can tell "omitted by the consultant" from "dropped by the parser."

**An unfiltered dump can overrun the exec buffer.** The Jurisdictions dataset is ~67 MB
because it carries every filled row's lexical content. Use a filtered query where the
question is narrow (does this geoid exist?), and write to a file rather than a pipe when you
genuinely need the whole thing.

### The county's own chapter may use a different instrument

Consultant plans usually include the county as one more chapter, and it is easy to assume it
shares the jurisdiction template. Check per chapter, by **header text**, not by position.

On Suffolk, Table F (hazard narratives) is identical across all 38 chapters, but Table I is
two different instruments:

| | Columns | Nature |
|---|---|---|
| 37 jurisdiction chapters | 7: *2020 Ranking · Frequency trend · Impacts trend · Description · Future Events · Ranking* | a **trend** instrument |
| the county chapter | 6: *Preliminary Ranking · Agree/Disagree · If Disagree, New Ranking · Justification · Final Ranking* | a **ranking-validation** instrument |

The consequence is not cosmetic: the county instrument has **no trend and no future-events
data**, so any column derived from those (`future_occurrence_assessment`, `climate_change`)
has *no county source* and must be left unset rather than defaulted. Detect the variant by
header text so the same code handles the next county, and make the "these fields were
inferred" disclaimer conditional — a note claiming a field was inferred when it was actually
left null is worse than no note.

### `--filter` cannot match array-valued columns

`--filter col=value` compiles to `data->>'col' = 'value'`. For an array-valued column that yields
the **JSON text** `["3610338000"]`, which never equals the bare geoid. So:

- `--filter geoid_juris=<geoid>` works on Capabilities (stores a bare string) and returns **zero**
  on Roles and Participation (store an array) — with no error.
- `--filter geoid_county=<county>` works on HOC (bare int) and fails on Roles (array).

Fetch the county's rows with a filter you have verified against that dataset's actual storage, or
fetch all rows and match client-side. This bit twice in one session: once as a false "17 missing
rows" alarm, and once as a duplicate guard that would have silently permitted a double load.

### Idempotency and blast radius

- **Inserts:** refuse to run when the jurisdiction already has rows; require an explicit `--force`.
- **Updates in place:** refuse when a target field already holds non-default content (for HOC,
  "default" includes `hazard_of_concern = "Not Reported"`), so you never clobber someone's hand edit.
- **Back up before any update-in-place**, and afterwards **assert that no field you did not send
  changed** on any touched row. A shallow merge should guarantee that; the assertion is what proves
  the payload didn't carry a stray key.
- Make builders **deterministic** so re-running one to append a row cannot perturb rows already
  loaded — then diff the regenerated prefix against what you inserted before appending.

### Size a query before you run it — always

**Rule (owner, 2026-08-18): never issue a large or unbounded query blind. Probe with a small
limit first, estimate the full size, and if it is large, say so and check in before running it.**

This is a shared production server. `dms dataset query` has no server-side column projection,
so a dataset with lexical columns returns *all* of the prose on *every* row. Row counts are a
terrible proxy for response size:

| Query | Rows | Response |
|---|---:|---:|
| `dataset query 1346449 --limit 5000` (Jurisdictions) | 2,345 | **~67 MB** |
| `dataset query 1473470 --limit 20000` (HOC) | 27,567 | ~15 MB |
| `dataset query 1346449 --filter geoid=<one>` | 1 | ~1 KB |

The Jurisdictions dump overran a 64 MB client buffer. Two of those ran shortly before a
production 502 — the outage was almost certainly unrelated (upstream IT), but the practice was
indefensible regardless, and "it probably wasn't me" is not a reason to keep doing it.

The procedure:

```bash
# 1. probe: how big is ONE row?
dms dataset query <src> --view <v> --limit 1 --format json | wc -c
# 2. multiply by the row count you need. Over ~10 MB, stop and check in first.
# 3. prefer a filter that answers the actual question
dms dataset query <src> --view <v> --filter geoid=<one> --limit 5    # "does this row exist?"
```

- **Ask the narrow question.** A collision check needs `--filter geoid=<x>`, not the whole table.
- **Write to a file, not a pipe,** when you genuinely need everything — a pipe hits the exec buffer.
- **Cache it.** One dump reused from disk beats the same dump re-fetched per jurisdiction. Schema
  calibration is a *once-per-county* activity, not a per-annex one.
- **Watch loops.** A per-jurisdiction builder that queries live costs 38× whatever it asks for.
  Prefer one cached index (see `build_index.py`) over 38 live reads.

### Calibrate every column against the STORED rows, not the declared schema

Phase 2 says to build the crosswalk from the live source config rather than a workbook. That is
necessary but **not sufficient**. The declared config tells you what a column is *supposed* to be;
only the stored rows tell you what the platform and its authors actually do. Before writing a single
row, dump the whole target dataset and measure. On the Islip slice this changed the payload in eight
distinct ways — a crosswalk built purely from the declared config would have been wrong in all of
them.

```bash
dms dataset query <source> --view <view> --limit 20000 --format json > all.json
# then, per column: non-empty count, python type of the stored value, and value vocabulary
```

**1. Dead duplicate columns.** Capabilities has both `administering_agency` and
`administering_agency_organization`, with the *same* display name "Administering Agency/Organization".
Populated on **1,313** and **0** rows respectively. The crosswalk named the dead one. Where two
columns share a display name, the row counts decide.

**2. Columns the crosswalk missed that nearly every row sets.** `primary_capability_type` is set on
**1,544 of 1,621** jurisdiction-level Capabilities rows and appears nowhere in the crosswalk. Check
for high-population columns you have no mapping for and ask why.

**3. Declared `lexical` does not mean lexical is stored.** Per dataset:

| Dataset | Column | Declared | Actually stored |
|---|---|---|---|
| Jurisdictions | `lhmp_*`, `nfip`, … | lexical | **lexical root** (verified on Delaware) |
| Hazards of Concern | `general_vulnerability`, `other_comments` | lexical | **plain string** (140/140, 334/334) |
| Participation | `narrative`, `agenda_minutes` | lexical | **plain string** (209/212, 183/184) |

Match the dataset's own convention. The earlier conclusion "HOC is not a flat dataset, its prose
columns need lexical roots like Jurisdictions" was reasoning from the declared type and is wrong.

**4. Checkbox vocabularies differ per dataset.** Capabilities checkboxes store the string `"x"`;
HOC's vulnerability checkboxes store `"Yes"` / `"No"`. Neither stores a boolean.

**5. So does geoid storage — in the same app, across datasets that join on it.**

| Dataset | `geoid_juris` | `geoid_county` |
|---|---|---|
| Capabilities | bare string | bare string |
| Roles | **array** of strings | **array** |
| Participation | bare string | **array** |
| Hazards of Concern | **array** of strings | bare **int** |

There is no house convention to infer. Measure per dataset, and prefer the **most recent** rows
where older ones disagree.

**6. Declared select options drift from the stored vocabulary.** Roles' `role` declares 52
fine-grained options; the single most-used stored value, `Government - Staff or Technical` (186 of
345 rows), **is not one of them**. Capabilities' `primary_capability_type` stores
`Codes/ Ordinance/ Zoning/ Policy/ Law/ Governance` — with a space after each slash — where the
declared option has none. Copy the stored string byte-for-byte; a near-miss is a new vocabulary
value nobody will find.

**7. One dataset can hold two populations with different conventions.** Capabilities is 1,621
jurisdiction rows (with `geoid_juris`) plus 379 state/DHSES catalogue rows (without). The row-kind
checkboxes `plan_guidance` / `tool` / `funding_source` / `program` are a *catalogue* convention —
41/95/118/180 there versus 2/0/0/1 among jurisdiction rows. Split the population before computing
any "what do rows normally do" statistic, or you will import the wrong half's conventions.

**8. Some stored values are bugs worth not propagating.** Participation's 40 most recent rows hold
**Excel serial integers** in a `date`-typed column (`46133` = 2026-04-21), an artifact of a
spreadsheet import. 65 older rows hold ISO strings. Follow the declared type, not the freshest
mistake — but say so in the review sheet, because "most recent" is normally the right tiebreak.

Where a value is genuinely ambiguous, look for **precedent rows doing the same job** before asking
or guessing. Matching an existing name statewide beats inventing a mapping: "Warning systems for
hazard events" resolved to `Preparedness & Response` because all 18 existing rows of that name agree.

### Assert cross-table agreement before mapping

Where two source tables describe the same list — a hazard list, an action list, a jurisdiction list —
**assert the two key sets are identical and print the difference before mapping anything.** In the
Islip annex this caught two defects that would each have silently dropped a whole record:

- Table F says `Flood (including Shallow Groundwater Flooding)`; Table I says `Flood`. Joining on the
  raw label loses Flooding's trend data entirely.
- `Nor'easter` uses a **curly apostrophe** (U+2019) in both tables. An ASCII `'` in the mapping table
  matches nothing — and because Nor'easter is an *insert*, nothing fails loudly; the row is just absent.

Normalise join keys deliberately: strip trailing footnote digits (`Flood1`, `Geologic Hazards2`),
fold curly quotes to ASCII, and drop trailing parentheticals that only one table carries. Then fail
loudly on anything still unmapped rather than skipping it.

### Verification traps

The read-back diff is the only thing standing between a bad payload and a silently wrong dataset, so
it is worth getting right. Three bugs, all found in one session:

- **`String(x)` comparison passes anything object-valued.** `String({...})` is `"[object Object]"` on
  both sides, so every lexical and array field "verifies" without being checked. Compare structurally.
- **`JSON.stringify` comparison reports false diffs.** The server returns objects with its own key
  ordering. Sort keys recursively before comparing.
- **Verify by row id over *all* rows**, not over the geoid-filtered subset. If a row's geoid failed to
  write, filtering makes it look *missing* rather than showing you the one field that's wrong.

Note the failure directions: the `String()` bug fails **silently open**, the other two fail **noisily
closed**. Prefer the noisy kind and never ship the quiet one.

### Hazards of Concern is mostly an update-in-place

HOC source `1473470` / view `1473471` (`test_meta_forms_env|hazards_of_concern:source`). **Reads
work anonymously** — `dms dataset query <src> --view <v> --filter geoid_county=<geoid> --limit 2000`.

**Every jurisdiction already has one row per *named* hazard** (17 in Suffolk), all
`hazard_of_concern = "Not Reported"`. Loading means matching and updating those; creating rows
instead produces a duplicate parallel set.

- **Join on `geoid_juris`, never on jurisdiction name.** Names drift between datasets — *Suffolk
  County* vs *Suffolk (County)*, *The Branch (Village)* vs *Village of the Branch (Village)*. On
  Suffolk, name matching found 34 of 38 jurisdictions; geoid found 36.
- **Reconcile the jurisdiction sets in both directions before loading.** Expect entities with an
  annex but no rows (non-census bodies — a tribal nation, a water authority) and rows with no annex
  (non-participating villages). The first needs an owner decision; the second must be left alone.
- **Confirm omissions explicitly.** For hazards the plan didn't assess, set `hazard_of_concern = "No"`
  rather than leaving them *Not Reported*. DHSES asks counties to confirm what they leave out and
  tracks it statewide. The radio accepts `Yes` / `No` / `Not Reported`.
- **`Other` rows are inserts.** There is **no** pre-existing `Other` row. Multiple are allowed
  (owner, 2026-08-14), keyed on `(geoid_juris, hazard='Other', hazard_name_if_other)` — one insert
  per non-standard hazard. This is the only part of the HOC load that inserts.
- **Write `hazard = "Other"`, capitalised** — the display-label form, matching how stored rows spell
  every other hazard. **Proven, not speculative:** 10 `Other` rows already exist (Allegany, Fulton
  ×5, Dolgeville, Hope, Inlet), all with `hazard_name_if_other` set. An earlier revision of this
  skill warned that neither the declared options nor the stored values contained `Other` and that
  inserting "may not validate" — the select does list `other` among its codes, and the capitalised
  label is what the existing rows use. Insert with confidence.
- **The mapping must reconcile to the pre-existing row count exactly.** For Islip: 5 one-to-one + 7
  from four split profiles = 12 with content, + 5 unassessed set to `No` = **17**, matching the 17
  pre-existing rows with none left over and none doubled. Assert this before writing; a mismatch
  means the taxonomy mapping is wrong, not that a row is missing.
- **Stamp split provenance on the child rows.** Where one combined source profile fills two MNY
  hazards, the duplicated narrative should say so in `other_comments` ("authored for Suffolk's
  combined *Geologic Hazards* profile and applies to both Earthquake and Landslide; it was not
  authored per-hazard"). Otherwise a reviewer reads generic prose as a per-hazard assessment.
- **Record inferred fields in the row itself.** The four vulnerability checkboxes and
  `climate_change` have no direct source field. The established precedent (Allegany) is to infer
  them and append a note to `other_comments` naming exactly which fields were inferred and that they
  need review. Prefer an **evidence-based rule stated in the review sheet** — e.g. each category is
  `Yes` when that hazard's own narrative matches its keyword set — over inference by hazard type, so
  the derivation is reproducible and arguable.
- **`likelihood` has no annex source. Never touch it.** It is a probability band
  (*Minimum/Low/Medium/High/Maximum Likelihood* with percentage ranges), not a trend.

### Participation comes from the meeting documentation, not the annex

The Participation dataset wants **dated meetings**. A jurisdictional annex names participation
*types* per contributor ("plan participant meetings, provided impact data") with no dates, so the
annex cannot fill it — this is why the crosswalk marks Participation `gap-partial`.

The dated record lives in the plan's **meeting-documentation appendix**, usually as a
*person × meeting attendance matrix* with `X` marks. Find it before writing Participation off.

- **Parse the real table cells.** In flattened document text an `X` cannot be tied to its meeting
  column, so the matrix looks like an unusable run of marks. Walk the docx cells (`python-docx`
  `table.rows[i].cells`) and index by column.
- **The column headers carry the meeting names and dates** — expand the abbreviations against the
  plan's narrative volume rather than guessing, and leave unexpandable ones flagged. Suffolk's `MSW`
  was confirmed as *Mitigation Strategy Workshop* by a Volume I sentence naming the same two dates;
  `CPT` and `GIS Kickoff` are defined nowhere and remain open.
- **One row per (jurisdiction, meeting *attended*).** Create nothing for a meeting the jurisdiction
  skipped — absence is not participation. Islip attended 5 of 9.
- **Give each meeting a shared `meeting_unique_id`** (the live pattern is `<County><Year><NNN>`),
  keyed to column order, so all jurisdictions reference the same id for the same meeting. Retrofitting
  a shared key across 38 annexes afterwards is painful.
- **Leave `duration`, `format`, `invite_method` null** unless the source states them. An attendance
  matrix records attendance only. These are populated on ~185/216 live rows, which tempts you to fill
  them; resist.

### Person identity across the annex and the attendance log

The two disagree, and they disagree in two different ways. Reconcile explicitly:

- **Spelling variants for the same person** (*Dominique*/*Dominick*, *Hillebrand*/*Hillenbrand*).
  Keep the **annex's** spelling in Roles — the jurisdiction authored that list — and leave the
  attendance text verbatim. Note the variants in the review sheet so nobody reads them as two people.
- **People in the attendance log but absent from the annex's contributor table.** These are real
  participants the jurisdiction's own list omitted. Default to creating the Roles row with its
  provenance recorded in `comments` ("Source: Appendix B attendance matrix … not listed in Table A"),
  since DHSES tracks participants — but treat it as an owner call, and expect it across every annex.
- The reverse also happens: people in the contributor table with **no** attendance marks anywhere.
  That is legitimate — Islip's Primary POC and Floodplain Administrator both attended none of the
  tracked meetings. Roles row yes, Participation row no.

### Verify

Read back every row you wrote and diff against the payload — structurally, key-order-insensitively,
and by row id. See "Verification traps" above; the naive versions of this check pass bad data.

For updates in place, also assert that **no field you did not send changed**. In-app rendering is a
sanity check, not the authoritative one — the SPA needs the geoid filter selected before anything
appears.

---

## Checklist

- [ ] Phase 0 classification recorded; consultant profile read or written
- [ ] Coverage of any consultant-delivered workbook **verified by count**, not assumed
- [ ] Structure confirmed across all jurisdiction types (town / village / authority / tribal nation)
- [ ] Checkbox recoverability probed before declaring any field lost
- [ ] Alias table built; distinct geoids == chapter count; non-census entities resolved
- [ ] Crosswalk built from the **live** source config
- [ ] `auto-populated` rows identified so platform data isn't duplicated
- [ ] `gap-*` decisions answered by the owner before extractors are written
- [ ] Extraction separated from mapping; provenance carried
- [ ] CDP rows excluded; county filter applied
- [ ] **Target dataset dumped and every column calibrated against stored rows** — dead columns,
      high-population columns you have no mapping for, declared-vs-stored types, checkbox and geoid
      storage, select vocabularies, and any second population inside the dataset
- [ ] **Cross-table key sets asserted equal** before mapping; join keys normalised; unmapped keys fail loudly
- [ ] **Insert path proven with one throwaway row** (create → fill → query → delete) before the batch
- [ ] **Created ids recorded before each fill**; double-insert guard verified to actually fire
- [ ] Update-in-place targets backed up; non-default content refused; no-collateral-change asserted
- [ ] **Every query sized before running** — probe with `--limit 1`, estimate, check in above ~10 MB
- [ ] Read-back verification on every written row — structural, key-order-insensitive, by row id
- [ ] Inferred and derived values flagged **in the row**, with the rule stated in the review sheet
- [ ] Owner decisions recorded and dated in the review sheet
- [ ] Profile updated with anything new this county taught you

---

Related: [`loading-annexes-into-jurisdictions-dataset.md`](./loading-annexes-into-jurisdictions-dataset.md) (1.0-site annexes, write path in depth),
[`loading-a-plan-into-a-2.0-pattern.md`](./loading-a-plan-into-a-2.0-pattern.md) (county content pages), `references/mny-transcribe/CLAUDE.md` (per-county status; git-ignored working folder).
