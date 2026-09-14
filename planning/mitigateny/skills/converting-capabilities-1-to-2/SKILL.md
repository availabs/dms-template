---
name: converting-capabilities-1-to-2
description: Convert New York State hazard mitigation "Capabilities" data from the legacy 1.0 spreadsheet format into the 2.0 workbook format, and reconcile it with existing 2.0 catalog/DMS exports. Use this skill whenever the user mentions Capabilities data, capability catalog, converting capability data between format versions, jurisdiction capability adoption records, populating a Capabilities sheet in a 2.0 MNY-style workbook, or working with a "geoid-crosswalk" sheet alongside capability data. Also use it whenever assigning Primary/Secondary/Tertiary Hazard Type or Capability Type fields from boolean hazard/category flags, or reconciling a capability catalog CSV (e.g. "capcat") with a raw per-jurisdiction 1.0 export.
---

# Converting NY Capabilities Data: 1.0 → 2.0

This skill captures the workflow for taking legacy "1.0" per-jurisdiction Capabilities data, converting
it to the "2.0" schema used in MNY-style workbooks, and reconciling it with whatever 2.0 data already
exists (which is often itself a partial, uncleaned migration — not a blank slate). It was built from a
real conversion of ~2,400 jurisdiction capability records across 7 NY counties, reconciled against a
649-row in-progress DMS catalog export.

Work through this as a sequence of stages, but **ask clarifying questions before writing any conversion
code** — this domain is full of judgment calls that materially change the output, and guessing wrong
means redoing expensive work. See "Before starting" below.

## Before starting: identify what you actually have

Don't assume file names tell you the whole story. In the real run this skill is based on, three files
were uploaded and none of them were what their names implied at first glance:

1. **A raw 1.0 CSV** (e.g. `combined_capa.csv`) — one row per jurisdiction × capability instance.
   Typical columns: County, Jurisdiction, Capability Type (a coarse 4-ish category), Capability (a
   standardized generic name, e.g. "Floodplain Ordinance"), Capability Name (a more specific title,
   e.g. "Sixth Lake Dam Emergency Action Plan"), Capability Description, Description of Status,
   Utilization/Integration narrative fields, Date of adoption, Adopting/Responsible/Supporting
   Authority, Affiliated Agency, a URL, Regulatory Name.
2. **A CSV that looks like a second "1.0" file but isn't** (e.g. `capcat.csv`) — profile it before
   assuming. In the real run this was actually the **current in-progress 2.0 data**, exported straight
   from the DMS: a mix of statewide/agency catalog programs (no jurisdiction attached) plus a handful
   of jurisdiction-specific rows, still carrying legacy `(Delete)` columns and partially-computed
   rollup fields. Check for County/Jurisdiction GeoID columns, `(Delete)`-suffixed columns, and
   JSON-wrapped fields (`{"value": ..., "originalValue": ...}`) — these are signs it's a DMS export,
   not a clean 1.0 source.
3. **The target workbook** (`.xlsb` or `.xlsx`) — almost always arrives as a **blank template**, not
   populated 2.0 data. Don't assume the "existing 2.0 data" lives here; it more likely lives in file #2.
   Read its `Capabilities Dictionary` sheet (full column-by-column spec) and `Validations` sheet
   (defines the actual valid value lists — critical, see "Capability Type" below) before mapping
   anything. Also check for a `geoid-crosswalk` sheet — you'll need it for Stage 3.

**`.xlsb` files can't be read or written by standard libraries** — `pip install pyxlsb --break-system-packages`
to read them (read-only; it cannot write `.xlsb`). Plan to deliver the final file as `.xlsx` with the
same sheet set, and say so up front rather than after the fact.

## Clarifying questions to ask before converting

Surface these with concrete row counts, not abstractly — e.g. "649 existing rows, ~270 of which are
jurisdiction-specific but only 2 actually overlap with your 7 counties" is decision-useful; "there's some
overlap" is not.

- **Which field becomes the 2.0 "Capability Name"?** 1.0 usually has both a generic standardized name
  (`Capability`) and a more specific per-instance title (`Capability Name`). These can disagree, and
  whichever you pick changes how reconciliation matching works later.
- **Where do free-text fields with no direct 2.0 column go** (e.g. 1.0's "Description of Status",
  "Utilization", "Integration")? Check the 2.0 Dictionary for a close conceptual match (in the real run,
  "Mitigation Connection"'s definition matched 1.0's Utilization/Integration fields almost exactly) before
  assuming a field is unmappable.
- **What's the reconciliation matching key**, and does real overlap even exist? Check county/jurisdiction
  GeoID overlap between the 1.0 source and existing 2.0 data *before* assuming heavy conflict-resolution
  logic is needed — in the real run, apparent overlap (270 jurisdiction rows in the "existing 2.0" file)
  turned out to be almost entirely a different county not present in the 1.0 source at all, leaving only
  2 rows that genuinely needed field-level reconciliation.
- **Which of multiple valid-looking taxonomies should populate a rollup field?** See "Capability Type"
  below — this bit the real run hard enough to warrant its own section.

## Stage 1: Map 1.0 columns to the 2.0 schema

Typical mapping (confirm exact column names against the actual target workbook — they shift):

| 1.0 concept | 2.0 destination |
|---|---|
| County / Jurisdiction | County/Jurisdiction + looked-up geoids (Stage 2) |
| Capability Name (specific) or Capability (generic) | Capability Name — ask which, see above |
| Capability Description + Description of Status + Regulatory Name | Description (concatenate with labeled line breaks so nothing is silently lost) |
| Utilization + Integration narrative | Mitigation Connection, if the 2.0 Dictionary defines a field with a matching purpose |
| Adopting/Responsible/Supporting Authority, Affiliated Agency | Administering Agency/Organization (pick one, e.g. Responsible Authority falling back to Adopting) + Partner Agency(ies) for the rest, joined with "; " |
| Capability Type (coarse) | see "Capability Type" section below — do not assume this maps to a single obvious 2.0 field |
| Date of adoption | Date added |
| URL for the link | Web URL |

Fields with genuinely no 1.0 source (contact info, training details, funding-source breakdowns,
eligible-entity flags) are left blank — don't invent values.

## Stage 2: Jurisdiction geoid lookup via the crosswalk sheet

Same crosswalk mechanics as the companion HoC skill (`converting-hoc-1-to-2`) — see that skill's
gotchas if you haven't read them. Capability-specific quirks on top of that:

- **1.0 Jurisdiction values are messier than hazard data**: expect comma-separated multi-jurisdiction
  lists (a capability — e.g. a joint plan — covering several towns at once), a literal "Countywide"
  value, minor punctuation mismatches against the crosswalk's `Jurisdiction Title` (e.g.
  `"Gloversville city ( City)"` vs `"Gloversville (City)"`), and occasionally a raw GeoID number pasted
  into the Jurisdiction text field by data-entry error. Normalize punctuation/spacing, split on commas,
  and check numeric-looking values against the crosswalk's GeoID column directly before giving up on a
  match.
- **Multi-jurisdiction rows should be exploded**, not concatenated into one row with an unresolvable
  jurisdiction field — duplicate the capability's data once per matched jurisdiction.
- **"Countywide" needs a real jurisdiction row, not a blank one.** The crosswalk almost always has a
  dedicated county-level jurisdiction entry (e.g. `"Chenango (County)"`) whose GeoID Number *equals* the
  county geoid itself. Look it up by title (`f"{county} (County)"`) rather than leaving geoid_juris blank
  — a blank jurisdiction geoid on a county-scoped capability will look like a data gap to anyone
  reviewing the output later. Apply this to *both* your 1.0 conversion and any existing 2.0 data that
  has a County GeoID but no Jurisdiction GeoID — that's the same "countywide" case wearing a different
  hat.

## Stage 3: Hazard Type assignment (Primary/Secondary/Tertiary)

1.0 capability data usually has no hazard information at all (jurisdiction-level plans/ordinances/staff
roles apply generally, not to a specific hazard) — leave hazard fields blank for those rows rather than
guessing. Existing 2.0 catalog data, on the other hand, often has one boolean column per hazard (plus a
"MOST or ALL formal hazards" flag) that needs collapsing into three rollup fields. A reasonable
rule-based approach, built from real client-specified rules:

1. If "MOST or ALL formal hazards" is set, that becomes the sole Primary value; leave Secondary/Tertiary
   blank and skip everything else for that row.
2. Check for hazard combinations the client cares about explicitly (e.g. Flooding + Wind + Hurricane all
   set → Hurricane as Primary, since a named storm is the more specific/actionable framing than its
   component hazards).
3. Apply a default "most consequential hazard becomes Primary" rule (e.g. Flooding, if set) — but leave
   room for a text-based override when the description clearly emphasizes a different hazard. Keep this
   override conservative (require an explicit emphasis phrase like "primarily" or "focuses on" within a
   short window of the hazard name in the description) and log every row where it fires, rather than
   silently trusting a fuzzy heuristic — call out to the user how often it actually triggered.
4. If a hazard the client considers important (e.g. Coastal Hazards) is set but didn't naturally land in
   one of the three slots, only force it in if a slot is actually open — and flag rows where it couldn't
   fit anywhere so a human can review them, rather than silently dropping it.

Always report the rule-trigger counts (how many rows hit each rule) back to the user — it's the fastest
way for them to sanity-check the logic actually matches their intent.

## Stage 4: Capability Type assignment — read this before touching it

This is the single biggest place the real run went sideways, twice, so read carefully.

**There can be more than one plausible taxonomy in play, and the target workbook's `Validations` sheet
is the tiebreaker — but the client may still override it.** In the real run:
- The trimmed target workbook's `Capabilities` sheet had 3 rollup slots (Primary/Secondary/Tertiary
  Capability Type), and its `Validations` sheet defined a 5-value list for this field (Planning and
  Regulatory, Administrative and Technical, Financial, Education and Outreach, Asset) — the standard
  FEMA capability categories.
- But the *full* `Capabilities Dictionary` sheet (a separate, more complete reference than the trimmed
  workbook's actual columns) also defined a much more granular ~16-item taxonomy of specific
  action/capability types (Planning, Codes/Ordinance, Dam Rehabilitation, Coastal Protection, Wetlands/
  Floodplains, etc.) as **individual boolean columns** — a totally different classification, used
  elsewhere for an "Actions" table, not originally intended for this Capability Type rollup at all.
- The client, after being shown this conflict, explicitly chose the granular 16-item taxonomy anyway —
  a legitimate business decision, but one that **overrides what the Validations sheet says is valid**.
  If this happens to you: implement what's asked, but say plainly that the result may not pass the
  workbook's own validation rules, and ask whether that's intentional or worth reconsidering.

**When adapting a client-supplied scoring methodology (tiers + keyword boosting + guardrails) to a new
field, check whether the input signal it expects actually exists in your data before running it:**
- If the client hands you a scoring prompt built for one field (e.g. an "Action Type" tiering system
  with per-type Yes/No boolean columns) and asks you to apply it to a *different* field, check whether
  the columns it expects are actually present, and whether the resulting values match the target
  field's valid-value domain. Don't assume "similar columns" claimed by the client means "the same
  columns" — verify column-by-column.
- 1.0 data often lacks the structured boolean flags the scoring system expects. In that case, build the
  "selected type" list via keyword matching against whatever narrative text is available instead
  (Capability/Capability Name for a weaker signal, Description/Status/Utilization/Integration for a
  stronger one) — but expect a meaningful fallback rate (in the real run, ~36% of 1.0 rows had no
  keyword match at all and needed a coarse fallback from the original category field). Report that
  fallback rate; it's a legitimate signal that the taxonomy may be a poor structural fit for the data
  (e.g. a 16-item taxonomy built for physical mitigation actions will always underperform on data that's
  mostly staff roles, ordinances, and funding mechanisms).
- Where a source *does* have direct per-type boolean flags (some 2.0 catalog data will, even if the 1.0
  data doesn't), treat a set flag as strong/confirmed evidence (best boost), and use keyword matching
  only as a supplement for types with no boolean column, or as a fallback when no flags are set at all.
- Watch for the client's target taxonomy combining two of the source's boolean columns into one (e.g.
  the real run's source data had one "Large Flood Control" checkbox covering both "Dam
  Rehabilitation/Removal" and "Other Large Flood Control" per the client's canonical 16-item list) —
  split them back out using a keyword check (e.g. does the description mention "dam"?) rather than
  picking one arbitrarily.
- **If you reprocess one part of the dataset (e.g. only the 1.0-derived rows) with a new taxonomy but
  leave another part (e.g. existing 2.0 rows) on the old one, say so explicitly.** A single rollup
  column silently containing two incompatible vocabularies across different rows is a real data-quality
  problem, not a cosmetic one — flag it as soon as you notice it, don't wait to be asked.
- See `scripts/tiered_type_assignment.py` for the reusable tier-score + keyword-boost + guardrail engine
  built for this — it's designed to be re-parameterized for a new taxonomy without rewriting the
  scoring/guardrail logic itself.

## Stage 5: Reconciliation

- Match on a composite key: county geoid + jurisdiction geoid + capability name (case-insensitive) is a
  reasonable default — confirm with the user, especially if the "Capability Name" ambiguity from Stage 1
  wasn't resolved yet, since that changes what actually counts as a match.
- Once you've confirmed which side "wins" (usually the existing 2.0 data, since it may carry manual
  edits/curation the 1.0 conversion can't know about), the usual approach is: keep the winning row's
  non-blank fields, and only fill in fields it left blank using the other source. Don't silently
  overwrite a non-blank 2.0 value with a freshly-converted 1.0 value unless told to.
- Non-matching rows from both sides pass through untouched / get appended as new rows.
- Report the match count plainly (e.g. "2 of 649 existing rows matched and were merged; 2,428 were
  appended as new") — it's often much smaller than either side expects, and that's worth surfacing
  rather than letting the user assume heavy overlap happened silently.

## Stage 6: Build the output workbook

Since the target is usually `.xlsb` but that format can't be written directly, build a fresh `.xlsx`
workbook with `openpyxl`: populate the Capabilities sheet with the reconciled rows, and carry over the
other reference sheets (Dictionary, Validations, geoid-crosswalk) unchanged so the deliverable is a
complete drop-in replacement, not just the one sheet. See `scripts/build_workbook.py` for the pattern.

Before presenting, spot-check a handful of rows across categories you touched (a rule-1 hazard row, a
freshly-added Asset-type row, a merged/reconciled row, a countywide row) rather than trusting aggregate
counts alone — several real bugs in this task were only caught by reading actual row contents.

## Reference

- `references/gotchas.md` — quick-scan checklist version of the above, for mid-task reference.
- `scripts/tiered_type_assignment.py` — reusable tier + keyword-boost + guardrail scoring engine.
- `scripts/build_workbook.py` — pattern for assembling the final multi-sheet .xlsx deliverable.

## In this repo (dms-template)

This bundle was written standalone; the notes below connect it to material already committed in
[`planning/mitigateny/skills/`](../README.md). Read them before Stage 4 — two of the artifacts the
skill describes generically already exist here concretely.

- **The "client-supplied scoring methodology built for a different field" is
  [`../action-type-tiers.csv`](../action-type-tiers.csv).** That is the Action Type tiering system
  Stage 4 warns you not to transplant blind: tier + within-tier rank + an `in_boolean_set` flag for
  the live 17-option Action Type vocabulary, with the method and guardrails written up in
  [`../transcribing-a-consultant-plan.md`](../transcribing-a-consultant-plan.md) (Phase 3). Read
  both before re-parameterizing `scripts/tiered_type_assignment.py` for Capability Type.
- **A Capability-Type mapping already exists: [`../capability-types.csv`](../capability-types.csv)**
  — `capability_name` → `primary_capability_type` / `secondary_capability_type` with a confidence
  and a note per row, keyed off the 1.0 source table (Legal and Regulatory, etc.). Check it for a
  direct hit before falling back to keyword matching; it will cut the ~36% no-match fallback rate
  the skill reports, and it encodes decisions an owner already made.
- **Scope boundary.** This is a **spreadsheet-side** skill: the deliverable is an `.xlsx` workbook.
  Getting Capabilities rows into the live DMS is a different job with a different write path —
  [`../transcribing-a-consultant-plan.md`](../transcribing-a-consultant-plan.md) plus
  [`../scripts/suffolk/build_capabilities.mjs`](../scripts/suffolk/build_capabilities.mjs) /
  [`../scripts/nassau/build_capabilities.py`](../scripts/nassau/build_capabilities.py). Don't mix
  the two in one run.
- **The companion HoC skill (`converting-hoc-1-to-2`) is not committed here** — it is installed as
  a managed skill. Stage 2 defers to it for crosswalk mechanics; invoke it if you need those.
