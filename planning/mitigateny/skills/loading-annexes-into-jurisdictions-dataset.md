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

## 5c. Westchester 2026 / IEM (2026-09-04) — annexes authored against the page

**The easiest model so far, and a third distinct shape.** Pattern `2448336`
(`Westchester-2026`, **v3** instance `mitigateny_county_template_v3_copy_2`), county geoid
**36119**, annex page **2448345** (91 components; its canonical parent is `2448361`), same
statewide Jurisdictions source `1346449` / view `1346450`. Full record:
[`../tasks/current/westchester-annex-crosswalk.md`](../tasks/current/westchester-annex-crosswalk.md);
scripts in `references/mny-transcribe/westchester/annex-work/scripts/` (git-ignored).

- **The `.docx` is a verbatim walk of the annex page's component order.** Every heading is a Card
  title, in page order, with the jurisdiction's prose underneath. So the mapping is **positional
  alignment, not judgment** — walk the doc's paragraph stream and the page's ordered section titles
  together and attribute the prose between headings. All 674 mappings came out High confidence.
  **Neither the §3 (Schenectady) nor the §5b (Delaware) mapping table has a single applicable row**
  — inventory the model first, every time.
- **Result: 45/45 rows, 675 column writes, 634k chars, read-back verified.** 15 columns:
  `description`, `lhmp_planning_process`, `lhmp_buildings_local_context`, `lhmp_critical_buildings`,
  `historic_prop_dist`, `lhmp_criticial_infrastructure`, `lhmp_risk_overview`,
  `lhmp_historic_occurances`, `lhmp_declared_disasters`, `lhmp_problem_areas`,
  `lhmp_previous_actions_evaluation`, `lhmp`, `lhmp_prioritization`,
  `lhmp_capacity_to_implement`, `lhmp_integration`.
- **⚠ Writes need no token on this source.** `dms dataset update 1346449 <row> --data <file>`
  succeeded **anonymously** — §4's auth note applies to pattern/page writes, not to these rows.
  Don't go hunting for a prod token before trying.
- **⚠ Trap 1 — no heading styles.** Every paragraph in every IEM annex is style `Normal`.
  python-docx gives you nothing to key on; you *must* detect sections by title match in page order.
- **⚠ Trap 2 — heading spellings drift from the Card titles, and a miss is silent.** An unmatched
  short paragraph falls into the *preceding* section, so the damage is invisible unless you look.
  Westchester had four variants: the page slot is misspelled `Historic Occurances`, while 11 annexes
  write `Historic Occurrences`, Port Chester `Historic Occurences`, Tarrytown `Historic OccurEnces`;
  Pound Ridge writes `BUILDINGS BY LAND USE`; Westchester County writes `Historic
  Properties/Districts` for `…/District`. **Always sweep the corpus** — collect every short
  paragraph that matched no title, normalize (lowercase, strip non-alphanumerics) and `difflib`
  it against the page titles. That found all four in one pass, and turned three apparent per-annex
  gaps plus two "stray section" folds into non-issues.
- **Boilerplate rule bites hard here.** IEM re-typed the shared **LHMP_IA** (1441680) card text,
  lightly reworded per jurisdiction, under four headings — `Buildings`, `Prioritization`,
  `Actions Database`, `Progress` (85,457 ch across 180 sections). Skip all of it. Detect it by
  paragraph-frequency across jurisdictions: near-identical prose in 45 of 45 annexes is not local
  content. **The exception that matters:** `Disaster and Local Emergencies` mixes two reworded
  boilerplate paragraphs with a genuinely local third — 12 and 6 distinct variants for paragraphs
  `[0]`/`[1]` versus 43 distinct for `[2]`. Split by paragraph position, not by section.
- **Prose under a shared or header-only component needs an owner call.** Two cases here, both
  resolved by folding into the adjacent writable box with an h3 lead-in: the local
  `Disaster and Local Emergencies` paragraphs → `lhmp_historic_occurances` (ord 37 immediately
  precedes ord 38, so the page still reads in document order), and `Strategy` (ord 54 is a bare
  lexical header with no Card) → prepended to `lhmp`.
- **Place vs MCD: use the row whose `census_type` matches the real census entity.** Cousub for
  towns, Place for villages **and cities**. Westchester is the first county where the dataset
  carries *both* a Place and a lowercase-`cousub` MCD row for the same city (5 cities + Harrison),
  and the picker shows them as near-duplicates. Precedent checked across every prior load:
  Schenectady's City of Schenectady → Place `1348106`; Delaware and Suffolk have no cities. The
  MCD twins stay empty.
- **Coterminous town-villages resolve to one row.** Harrison, Mount Kisco and Scarsdale each get one
  annex; their twin rows stay empty. Confirm the count arithmetic against the base plan's stated
  jurisdiction total — that is how Westchester's one genuinely missing annex (**Mount Pleasant**)
  surfaced.
- **Check for prior-cycle content before writing.** Bedford `1346571` held 1.0-era prose in 11
  columns; 7 were overwritten and 4 survived because nothing incoming targeted them, leaving the row
  mixing cycles. Diff, don't assume empty.
- **Lexical value is a bare root**, as in §3 — `{"root":{…}}`, not `{text:{root}}`. IEM prose has
  **no list markers at all**, so plain paragraph nodes plus h3 lead-ins where two sources merge.

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

## 7. Extraction: headings without prose, and columns without Cards

Two failure modes that both look like "the annex has content for this column" when it does not.
Both surfaced on Westchester/IEM (2026-09-08) and both cost real time.

### 7a. The zero-char heading trap — **check `chars`, never the heading list**

When a consultant authors annexes **against the page** (§5c), the document mirrors the page's
component order *including the components that are data or shared*. The heading is present; the prose
underneath is **empty**, because the platform renders that content itself.

On Westchester, **14 of the 36 distinct annex section headings carried 0 characters in all 45
files** — `NFIP Loss`, `Floodplain Map`, `Buildings in The Floodplain`, `Critical Buildings in The
Floodplain`, `Hazards of Concern`, `Hazards Excluded`, `BUILDINGS BY LANDUSE`, `Infrastructure`,
`Critical Buildings` (the second, table one), `Local Actions Database`, `Capabilities Inventory`, and
the three Actions tables. Every one is `kind: data` or `kind: shared`.

**So `21::NFIP Loss` exists in all 45 annexes and contains nothing.** A section inventory that lists
titles will tell you NFIP content is present. It is not.

**Do this before mapping anything:**

```bash
# per-section, across every annex: n files, summed chars, how many are non-empty
python - <<'EOF'
import json, collections
sec = json.load(open('out/annex_sections.json', encoding='utf-8'))
agg = collections.defaultdict(lambda: [0, 0, 0])
for j, v in sec.items():
    for k, raw in (v.get('sections') or {}).items():
        d = json.loads(raw) if isinstance(raw, str) else raw
        a = agg[k]; a[0] += 1; a[1] += d.get('chars', 0) or 0
        a[2] += 1 if (d.get('chars') or 0) > 0 else 0
for k in sorted(agg, key=lambda x: -agg[x][1]):
    n, tc, nz = agg[k]
    print('%-46s n=%-3d chars=%-7d nonzero=%d' % (k, n, tc, nz))
EOF
```

Anything with `nonzero=0` is a heading, not a source. **Drop it from the crosswalk before the owner
sees a mapping proposal for it** — otherwise you will propose a home for prose that does not exist,
and the owner will reasonably assume it does.

### 7b. Orphan columns — a Jurisdictions column with no Card on the annex page

Three lexical columns exist on the Jurisdictions source but have **no Card on either annex page**
(`2448345` *Jurisdictional Annex Form* or `2448361` *Select Jurisdiction*), so anything written to
them is invisible: **`nfip`**, **`lhmp_dams`**, **`demographics_description`**.

Adding Cards is a **`county_template`** change. When the owner has ruled that out, **do not write to
the orphan column** — route the content to where it renders. Owner direction of 2026-09-08:

| Column | Where the content actually belongs |
|---|---|
| **`demographics_description`** | The annex page's **Jurisdictional Profile** box — column **`lhmp_municipality_profile`** (ord 13). That is the most prominent box on the annex page and is usually empty. |
| **`nfip`** | **Depends on the shape of the prose** — see below. |
| **`lhmp_dams`** | **Not the Jurisdictions dataset at all** — the NYS_Dams source, per dam. See §7c. |

**Routing `nfip` by shape.** Decide from what the source actually says, and from what is *already*
mapped to the candidate targets:

1. **Per-jurisdiction narrative about local flood problems, repetitive-loss areas, or drainage
   complaints** → merge into **`lhmp_problem_areas`** (annex page ord 43), under an h3 *NFIP* lead-in.
   Check the load first: on Westchester that column is the **largest** at 50,713 ch across 45 rows,
   so an appended merge — not a replace.
2. **A roster or comparison across jurisdictions** (who participates, CRS class, effective FIRM
   date, policy/claim counts) → a **bulleted list by jurisdiction** on the county
   **NFIP – Floodplain Management** page `2448353`, in either:
   - **`2450152` NFIP Participation Summary** (ord 3), or
   - that page's **Local Context** boxes — `2450153` (ord 10, sits under *Floodplain Administrators*;
     note its Inline Guidance is stale, see the base-plan **D9**).

   **Pick by what is already there.** If the base-plan load has already filled the Participation
   Summary from the county document, put the per-jurisdiction list in Local Context and vice versa —
   do not write a second roster into a box that already has one.

### 7c. Dam content goes to the NYS_Dams source, per dam — not to a jurisdiction row

`lhmp_dams` is the wrong destination for High Hazard Potential Dam narrative. The platform keeps that
**per dam**, in the **`NYS_Dams`** internal source:

| | |
|---|---|
| Source / view | **1459525** / **1459528** — `test_meta_forms_env\|nys_dams:source`, name `NYS_Dams` |
| Attributes | 43, of which **5 are lexical**: `notes`, `hhpd_1`, `hhpd_2`, `hhpd_3`, `hhpd_4` |
| Row key | **`state_id`** (e.g. `163-1597`, `232-3369`) |
| Context page | `/edit/the_local_environment/high_hazard_dams/high_hazard_dams_view_card?state_id=<state_id>` |

The four `hhpd_*` columns carry generic display names in the source (`HHPD Question 1`…`4`). Their
real meanings:

| Column | Meaning |
|---|---|
| `hhpd_1` | **Risk Assessment Process** |
| `hhpd_2` | **Dam Risks and Failure Impact** |
| `hhpd_3` | **Mitigation Plan Goal** |
| `hhpd_4` | **Planned Mitigation Actions / Projects** |

**The rows already exist — this is an update-in-place, exactly like the Jurisdictions path (§4).**
Never create dam rows. Verified for Westchester (geoid 36119): **225 dam rows**, of which
**36 are `hazard_text = "High Hazard Dam"`** (41 Intermediate, 136 Low, 12 unassigned), and **all
four `hhpd_*` columns are empty on every one of them.** Query before writing:

```bash
node src/dms/packages/dms/cli/bin/dms.js dataset query 1459525 --view 1459528   --filter geoid=<geoid> --limit 500 --format json
```

Then match each dam the plan discusses to its row by **`state_id`** — not by name; `name_one` values
repeat and drift in spelling across sources. Write with the same
`dms dataset update 1459525 <row-id> --data <file>` call and the same bare-root lexical value as §4,
and read back.

**Surface it before you fill it — only `hhpd_2` currently renders.** On page `2448354`, the two
*Dam Risks and Failure Impact* Cards (`2460892`, `2450717`) bind only `hhpd_1` and `hhpd_2`, and
`hhpd_1` carries **`show: false`**. `hhpd_3` and `hhpd_4` are **not bound by any component**. So
loading all four repeats the orphan-column mistake one layer down: three of the four would be
invisible. **Confirm with the owner which of the four are surfaced before writing**, and record any
that are not.

**Scope note for Westchester specifically:** the 45 IEM annexes contain **no dam prose, no NFIP prose
and no demographics prose at all** (§7a — those headings are empty). §7b and §7c are guidance for the
*next* plan whose annexes do carry that content; nothing was lost on Westchester and nothing is
available to load.

Related: [`loading-a-plan-into-a-2.0-pattern.md`](./loading-a-plan-into-a-2.0-pattern.md) (county
content-page fill + write path), [`mny-1.0-scraper/README.md`](./mny-1.0-scraper/README.md) (how the
annex markdown was produced).
