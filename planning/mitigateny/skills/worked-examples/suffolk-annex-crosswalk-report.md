# Suffolk jurisdictional annex → MitigateNY 2.0 forms datasets

**Reference annex analyzed:** `Volume-II-Jurisdictional-Annexes/Chapter 15 - Islip (T).docx`
**Structure verified against:** Poquott (V), Suffolk County Water Authority, Shinnecock Tribal Nation
**Crosswalk:** [`suffolk-annex-crosswalk.csv`](references/mny-transcribe/suffolk/suffolk-annex-crosswalk.csv) — 109 field-level mappings
**Date:** 2026-08-14

---

## 1. The headline finding

**The annex is not a prose document. It is a structured survey instrument.**

This is the single most important fact for planning the load, and it inverts the assumption
carried over from Schenectady and Delaware. Those were MitigateNY 1.0 sites whose per-jurisdiction
content was authored *prose* in light-blue boxes, which mapped naturally onto the Jurisdictions
dataset's ~30 lexical (rich-text) columns.

A TetraTech annex is ~30 **tables** and almost no free prose. Its content is overwhelmingly
row-structured data that belongs in the *flat* forms datasets, not in rich-text columns:

| Target dataset | Mappings | What lands there |
|---|---:|---|
| **Actions** | 28 | Proposed actions (already delivered) + **prior-cycle actions (not delivered)** |
| **Capabilities** | 22 | Tables P/Q/R/S/T — ordinances, plans, staffing, fiscal, outreach |
| **Jurisdictions** | 15 | The lexical columns — NFIP summary, problem areas, growth trends, disaster losses |
| **Roles** | 9 | Table A planning team |
| **Hazards of Concern** | 9 | Tables F + I — per-hazard impacts, occurrence, future occurrence |
| **Participation** | 1 | Not derivable from the annex — see §4 |

**Only 15 of 109 mappings target the Jurisdictions dataset.** Filling just the `Jurisdictions-Data`
tab would capture roughly a seventh of the annex and would leave the Capabilities, Roles, and
Hazards-of-Concern content — the bulk of it — on the floor.

### Disposition breakdown

| Disposition | Count | Meaning |
|---|---:|---|
| `dataset-fill` | 56 | Transcribe into a forms dataset |
| `auto-populated` | 11 | MNY 2.0 generates it (census, NFIP claims, dams, disaster declarations). **Do not transcribe.** |
| `already-delivered` | 10 | Covered by TetraTech's Actions workbook |
| `lossy` | 8 | Annex has content the Actions workbook dropped |
| `boilerplate` | 6 | Identical across all 38 chapters; template supplies it |
| `gap-no-target` | 6 | Extractable, but no column exists — **owner decision** |
| `constant` | 5 | Set a fixed boolean per source table (e.g. `plan_guidance=TRUE` for all Table Q rows) |
| `derived` | 3 | Must be inferred, not copied — flag rather than guess |
| `gap-partial` / `gap-empty` / `gap-weak` | 3 | Content exists but the fit is poor or the source is empty |
| `filter` | 1 | Use as an include/exclude filter, not a value |

---

## 2. What the Actions workbook already covers — and what it dropped

`Suffolk_County_Actions_2.0_reconciled v2.xlsx` (523 rows, 38 jurisdictions, 76 columns) is a
complete, field-level transcription of each annex's **Proposed Hazard Mitigation Actions** tables.
Verified 1:1 for Islip: 22 action tables in the docx → 22 workbook rows. **Do not re-extract that
section.**

Two things it does *not* cover, both of which are real work:

**a. Prior-cycle actions are missing entirely.** The annex's *Status of Previous Mitigation Actions*
section carries a 13-field table per 2020-cycle action (Islip: 21 of them). The workbook holds only
the 2026 proposed actions. Across 38 jurisdictions this is several hundred action records with
status, lead agency, original problem, solution, and an include/discontinue decision — all
extractable, none delivered.

**b. Eight fields of authored prose were reduced to booleans or dropped.** Per proposed action, the
annex carries `Impact on Socially Vulnerable Populations`, `Impact on Future Development`,
`Impact on Critical Facilities/Lifelines`, `Impact on Capabilities`, and `Climate Change
Considerations` as written paragraphs. The workbook kept the corresponding yes/no flags and
discarded the text. Also lossy: `FEMA Mitigation Category` and `CRS Mitigation Category` (checkbox
sets → one mapped value), and **alternatives 2+** (the annex lists 3–4 per action; the workbook has
one slot).

None of this is a defect in the workbook — it's the MNY Actions schema having no home for the prose.
It is flagged so the owner can decide whether to widen the schema or accept the loss.

---

## 3. A correction worth recording: the checkboxes are recoverable

My first extraction pass suggested that checkbox fields — hazards addressed, current status,
FEMA/CRS category, priority, adaptive-capacity ratings — were unrecoverable, because they came out
as run-on strings listing every option with no indication of which was ticked.

That was a tooling artifact, not a property of the documents. Every checkbox is a Word content
control (`w:sdt` / `w14:checkbox`) carrying an explicit checked state — **387 checked, 760 unchecked
in the Islip annex alone**. `python-docx` drops them silently because `Paragraph.text` only walks
`w:r` elements that are *direct* children of `w:p`, and content-control runs are nested one level
deeper.

`context/scripts/docx_outline2.py` walks the XML directly and emits `[x]` / `[ ]`. With it:

```
r8:  Current Status – Please select one: || [x] Proposed – Not Started [ ] In-Progress …
r15: FEMA Mitigation Category: || [ ] LPR  [x] SIP  [x] NSP  [ ] EAP
r17: Priority: || [x] High  [ ] Medium  [ ] Low
```

A second bug in the same tool was collapsing adjacent identical checkbox cells (`[ ] || [ ]` → one
cell), because it de-duplicated horizontally merged cells by comparing *text*. Merged cells must be
de-duplicated by comparing the underlying `w:tc` element identity. With that fixed, Table V's full
14-criteria scoring grid extracts correctly.

**Consequence:** the four `gap-no-target` items involving checkboxes are *not* extraction problems.
The data is fully available; only the target column is missing. That is an owner decision, not an
engineering one.

---

## 4. Gaps requiring an owner decision

| # | Content | Volume | Issue |
|---|---|---|---|
| 1 | **Table U — Adaptive Capacity** (14 hazards × Strong/Moderate/Weak/None/N/A) | 14 rows × 38 jurisdictions | Fully extractable. HOC has `associated_capabilities` (a join) but no per-hazard capacity *rating* column. |
| 2 | **Table G — Vulnerable Community Assets** (20 asset types × impact prose) | ~20 paragraphs × 38 | Substantial authored content with no natural home. Candidates: `lhmp_cascading_impacts`, `lhmp_critical_buildings`. |
| 3 | **Table V — 14 prioritization scores** | 22 actions × 14 scores | Extractable. Actions has no per-criterion score columns; only the derived High/Med/Low survives. |
| 4 | **Table I — Hazard Ranking** (High/Medium/Low per hazard) | 14 × 38 | HOC stores `hazard_of_concern` as a **boolean**. The three-level ranking has nowhere to go. |
| 5 | **Per-action impact prose** (5 fields) | 5 × ~523 actions | See §2b. |
| 6 | **Table R — # of Staff** | 24 rows × 38 | Capabilities has no staff-count column. |
| 7 | **Participation dataset** | — | The annex names participation *types*, not dated meetings. Rows must come from **Volume I**, not the annexes. |
| 8 | ~~**Hazard taxonomy**~~ | all | **RESOLVED — see below.** |

Gaps 1–4 are the ones that block a clean load. In keeping with the author-empowerment
principle, the preferred fix for 1, 3, and 4 is **adding columns to the forms schema** rather than
flattening the content into prose — the data is structured, and structured is how it should land.

### Resolved: hazard taxonomy (owner decision, 2026-08-14)

The nine standard hazards map 1:1. The five non-standard ones — **Nor'easter, Cyber Security,
Disease Outbreak, Groundwater Contamination, Infestation & Invasive Species** — are set to
`Hazard = Other`, with the verbatim Suffolk name carried in **`Hazard Name, If Other`**. This
mirrors how the Actions workbook already handled the same five.

One correction to this report's earlier draft: that column **already exists** on the Hazards of
Concern data tab (column 7). It is simply absent from the *HOC Dictionary* tab, which is what I had
read — so this was never a schema gap. **Where the two disagree, trust the data tab.**

Still to confirm before loading: that the live HOC source carries the column too, since the
dictionary omission suggests the workbook and the live schema may have drifted.

### Resolved: the full 14 → 18 hazard mapping (owner decision, 2026-08-14)

MNY has **18 hazard types** — 17 named plus `Other`. Suffolk's 14 do *not* map 1:1; four are
combined profiles. Per the **Volume I precedent** already recorded in `../CLAUDE.md`, combined
profiles are **split** so Volume I and Volume II stay consistent.

| Suffolk hazard | MNY hazard type(s) | Kind |
|---|---|---|
| Coastal Erosion | Coastal Hazards | 1:1 |
| Drought | Drought | 1:1 |
| Flood *(incl. shallow groundwater flooding)* | Flooding | 1:1 |
| Hurricane | Hurricane | 1:1 |
| Wildfire | Wildfire | 1:1 |
| Extreme Temperature | **Extreme Cold + Extreme Heat** | split |
| Geologic Hazards *(incl. expansive soils)* | **Earthquake + Landslide** | split |
| Severe Winter Storm | **Ice storm + Snowstorm** | split |
| Severe Storm | **Wind** | split (see caveat) |
| Cyber Security | Other | non-standard |
| Disease Outbreak | Other | non-standard |
| Groundwater Contamination | Other | non-standard |
| Infestation & Invasive Species | Other | non-standard |
| Nor'easter | Other | non-standard |
| *(not assessed)* | Avalanche, Hail, Lightning, Tornado, Tsunami/Seiche | `hazard_of_concern = No` |

**Split mechanics.** Table F's single prose block is duplicated to both child rows and marked
`derived`, so a reviewer can see the text was not authored per-child. Table I's ranking and
occurrence values duplicate the same way. **Expansive Soils** (inside Geologic Hazards) has no MNY
type and is dropped.

**Caveat on Severe Storm.** Volume I mapped it to *Wind + cross-reference*. Only Wind is taken here.
Suffolk's severe-storm narrative also describes hail, lightning and tornado impacts, which stay
folded into the Wind row rather than seeding Hail / Lightning / Tornado rows. Revisit if the owner
wants those surfaced separately.

**Unassessed hazards.** Avalanche, Hail, Lightning, Tornado and Tsunami/Seiche get an explicit
`hazard_of_concern = No` rather than being left *not-reported* — DHSES is asking counties to confirm
omissions, and that confirmation is tracked statewide.

### ⚠ The HOC load is an UPDATE, not an insert

**Every jurisdiction already has a row for all 18 MNY hazard types in the live database**, most
currently set to *not-reported*. The load therefore matches and updates existing rows; it must not
create a parallel set. This is different from the Jurisdictions path and needs its own row-matching
step (jurisdiction geoid + hazard type).

**Resolved (owner, 2026-08-14): multiple `Other` rows per jurisdiction are allowed**, keyed on
**`(geoid_juris, hazard='Other', hazard_name_if_other)`**.

### ✅ Live HOC schema verified (2026-08-14) — source `1473470`, view `1473471`

Read anonymously via `dms dataset query`. Four corrections to what this report previously assumed:

**1. There are 17 pre-existing rows per jurisdiction, not 18 — there is no `Other` row.**
748 Suffolk rows / 44 jurisdictions = exactly 17 each, one per *named* hazard. **All `Other` rows are
inserts**, five per jurisdiction, not "update one and insert four."

| | Rows | Operation |
|---|---:|---|
| Named hazards with content | 12 | update |
| Named hazards not assessed → `hazard_of_concern = "No"` | 5 | update |
| `Other` — all five non-standard hazards | 5 | **insert** |
| **Total after load** | **22** | from 17 pre-existing |

Across the 36 joinable jurisdictions: **612 updates, ~180 inserts**. Every one of the 748 existing
rows is currently `hazard_of_concern = "Not Reported"`, confirming nothing has been reported yet.

**2. Join on `geoid_juris`, never on jurisdiction name.** Name matching gives 34 of 38; geoid gives
**36 of 38**. Two are pure name variants with identical geoids — *Suffolk County* ↔ *Suffolk
(County)* (`36103`) and *The Branch (Village)* ↔ *Village of the Branch (Village)* (`3677519`).

**3. Two annex jurisdictions have no HOC rows at all** — **Shinnecock** (`3610367059`) and
**Suffolk County Water Authority**. Both are non-census entities. Handling is settled below;
scope is pending a question to the contractor, and we proceed as though both are in.

Conversely, **8 HOC jurisdictions have no annex** — Babylon (V), Brightwaters, Greenport, Islandia,
Mastic Beach, Ocean Beach, Sagaponack, Southampton (V). These didn't participate in the plan; leave
them *Not Reported* and don't invent content.

**4. `hazard_of_concern` accepts `Yes` / `No` / `Not Reported`** — so the owner's "confirm omissions
with an explicit No" decision is directly expressible.

### ⚠ Two live-schema issues that block a clean HOC load

**`hazard` has no `Other` option.** Its select options are internal codes — `avalanche, coastal,
coldwave, drought, earthquake, hail, heatwave, hurricane, icestorm, landslide, lightning, riverine,
tornado, tsunami, volcano, wildfire, wind, winterweat` — while the **stored row values are display
labels** (`Avalanche`, `Coastal Hazards`, `Extreme Cold`…). The two vocabularies disagree, neither
contains `Other`, and `secondary_hazards` uses the display-label set. Inserting `hazard = "Other"`
may not validate. **Resolve before loading**; matching *existing* rows is unaffected, since we match
on the stored label.

**`likelihood` is a probability band, not a trend** — its options are *Minimum / Low / Medium / High
/ Maximum Likelihood* with percentage ranges. This report previously mapped Table I's
*"Frequency (2021–present): Increased/Decreased/Stayed the Same"* onto it. **That was wrong.** Table
I's *future* column maps cleanly to `future_occurrence_assessment` (*Increased / Decreased / No
Change*); the *past-frequency trend* has no target and should go to `other_comments`. The annex does
not state probability bands, so **`likelihood` has no annex source** and should be left alone.

### Handling the two non-census entities (2026-08-14)

Proceeding as though both are in scope, pending the contractor's answer. They are **not** the same
problem — one is nearly free, the other needs a new entity class.

**Shinnecock — already exists. No new row, no generated geoid.**
It is in the Jurisdictions dataset today as **`Shinnecock (Reservation)`**, geoid **`3610367059`**,
`municipality_type = Reservation`, `census_type = cousub`, county Suffolk — and that is the *exact*
geoid the actions workbook already uses, so Actions joins correctly with no work. **Nine Reservation
rows exist statewide** (Allegany, Cattaraugus, Oil Springs, Onondaga Nation, Poospatuck…), so this
is an established, precedented entity class, not an anomaly.

The only thing missing is its **17 HOC rows**, which were simply never generated. Create them in the
standard shape (one per named hazard, `hazard_of_concern = "Not Reported"`), then load exactly like
any other jurisdiction. Treat it as fully normal in extraction.

*The only trap is naming* — it appears as *Shinnecock Tribal Nation* (annex), *Shinnecock (Tribal
Nation)* (actions workbook) and *Shinnecock (Reservation)* (dataset). All resolve via geoid.

**Suffolk County Water Authority — genuinely new; needs a synthetic geoid.**
No Jurisdictions row, no geoid anywhere (the actions workbook leaves it blank), and **no precedent
statewide** — `municipality_type` has no authority/district value in any of its 2,326 rows.

Recommended:

| Field | Value | Why |
|---|---|---|
| `geoid` | **`3610390001`** | County prefix `36103` + suffix `90001`. **Verified collision-free:** zero of the 970 cousub-format geoids statewide use a `9`-prefixed suffix. Reserves `3610390001–3610399999` for future non-census entities. |
| `municipality_type` | `Authority` | New value; parallels the existing `Reservation` class. |
| `census_type` | `Non-Census` | Explicit and filterable, so it is never mistaken for real census geography. |

Two properties matter and drove the choice. **Keep it numeric and 10 digits** — matching the cousub
format Reservations already use — because `GeoID (Number Only)` and `geoid_num` are *calculated
numeric casts*, and HOC's `geoid_juris` is a string array; a key like `36103-SCWA` risks breaking
both. And **keep the county prefix**, so every existing `county_geoid`/geoid-prefix filter picks it
up with no special-casing.

Work required: 1 new Jurisdictions row + 17 new HOC rows. Everything downstream is then identical
to a normal jurisdiction.

### Jurisdiction identity comes from the alias table, never from names

[`suffolk-jurisdiction-aliases.csv`](references/mny-transcribe/suffolk/suffolk-jurisdiction-aliases.csv) maps all **38 chapters →
38 distinct geoids, zero collisions**, and is the single source of jurisdiction identity for
extraction. Names disagree across every source — for one place we have *Shinnecock Tribal Nation*
(file), *Shinnecock (Tribal Nation)* (workbook) and *Shinnecock (Reservation)* (dataset); likewise
*The Branch (V)* ↔ *Village of the Branch (Village)* and *Suffolk County* ↔ *Suffolk (County)*.
Keying on parsed names files content under the wrong jurisdiction; keying on this table cannot.

Chapter numbers are a Tetra Tech organizational relic and are **not** tracked in MNY. They are
retained in the alias table purely as a provenance breadcrumb.

The table also carries `in_jurisdictions` / `in_hoc` flags, which is how the two gaps above were
found — it doubles as the pre-load checklist.

### HOC is not a flat dataset

Four of its columns are **`lexical`**, not plain text: `general_vulnerability`, `other_comments`,
`reason_for_exclusion`, `associated_capabilities`. The workbook dictionary calls them "Rich Text",
which understates what's required — they need lexical root payloads exactly like the Jurisdictions
columns. **This changes the §5 recommendation:** HOC's prose columns follow the
markdown → lexical-JSON path, not the workbook-tab path. Its scalar columns can still be tabular.

---

## 5. Recommendation: what to produce next

**Short version: keep the crosswalk as the spec, fill the workbook tabs for the five flat datasets,
and use JSON payloads — not spreadsheet cells — for the Jurisdictions lexical columns.**

### Why not workbook-only

The `Jurisdictions-Data` tab's rich-text columns hold **lexical root JSON as a cell string** — that's
genuinely how the live dataset exports (the `Executive Summary` cell for Albany contains a full
`{"root":{...}}` object). So the workbook *can* technically round-trip lexical content. But:

- Hand-authoring lexical JSON into spreadsheet cells is unreviewable. Nobody can eyeball a cell
  containing a 4 KB serialized node tree and tell whether the bullets nested correctly.
- The tab is **statewide** — 2,345 rows, of which 172 are Suffolk and only ~38 are real plan
  participants. The rest are CDP census artifacts that must be skipped.
- The proven write path from the Schenectady and Delaware loads is
  `dms dataset update <source-id> <row-id> --data <file.json>`, which takes JSON payload files. A
  spreadsheet would have to be converted to exactly that on the way in, so the spreadsheet is a
  detour, not a destination.
- Practical: `pyxlsb` is **read-only**. Writing `.xlsb` from Python isn't possible — we'd have to
  emit `.xlsx` or drive Excel directly. (Both source workbooks also currently have Excel lock files
  open against them.)

### Why not markdown-only

Markdown is the right *review* surface for the lexical prose, but it's the wrong deliverable for the
other five datasets. Capabilities alone is ~50 structured rows per jurisdiction across 86 columns;
expressing that as prose and re-parsing it would throw away structure the annex already has.

### The recommended split

| Artifact | Covers | Format | Rationale |
|---|---|---|---|
| **Crosswalk CSV** ✅ done | everything | CSV | The spec. Every downstream script cites a row of it. |
| **Workbook tabs** | Roles, Capabilities, Hazards of Concern | `.xlsx` copy of the workbook | Native shape for flat data, human- and DHSES-reviewable, and matches how TetraTech already delivered Actions. |
| **Actions** | prior-cycle actions + recovered prose | append to the existing Actions tab | Same format as the delivered workbook, so the two merge cleanly. |
| **Per-jurisdiction markdown** | the 15 Jurisdictions lexical columns | `.md`, one file per jurisdiction | The owner-review surface. Readable, diffable, correctable before anything touches the database. |
| **Lexical JSON payloads** | same 15 columns | `.json`, one per row | Compiled *from* the markdown. Feeds the proven `dms dataset update` path directly. |

The markdown → JSON compile step is exactly what `build_payloads.mjs` / `lexical.mjs` already do in
`schenectady/context/` and `delaware/context/`; that code is reusable rather than new.

### Sequencing

1. **Owner decisions on §4** — gaps 1/3/4, which are schema questions. (Gap 8, the hazard taxonomy,
   is resolved: non-standard hazards → `Other` + `Hazard Name, If Other`.)
1b. ✅ **Pre-flight scan — done** (2026-08-14). All 39 chapters parsed, spine confirmed, five
   variances found and the real volumes measured: **450 prior-cycle actions, 522 proposed, 854
   identified issues**. See [`PREFLIGHT_REPORT.md`](./suffolk-preflight-report.md).
2. **Batch-extract all 38 annexes** to structured JSON using `docx_outline2.py` (one pass, checkbox-aware),
   with the five pre-flight variances encoded first.
3. **Generate the flat-dataset tabs** and the per-jurisdiction markdown from that JSON.
4. **Owner review** of the markdown and tabs.
5. **Compile and load** — Jurisdictions via `dms dataset update`; flat datasets via whatever import
   path DHSES uses for the Actions workbook (**this path is not yet confirmed and should be
   established before step 3**, since it may constrain the tab format).

Step 5's flat-dataset import path is the one genuine unknown in this plan. Everything else follows a
route that has already been walked twice.
