# Profile: IEM

**Layer-2 consultant profile.** Read [`../transcribing-a-consultant-plan.md`](../transcribing-a-consultant-plan.md)
first for the method and the MNY target side; this file only covers how IEM structures a plan.

Established on **Westchester County 2026** (`2026 Westchester County HMP Base Plan Draft.docx`
+ 45 `Westchester_Jurisdictional_Annex_*.docx`), loaded 2026-09-08.
Consultant identified by `www.iem.com` in the document footer.

---

## 1. What makes IEM different from every other profile

**IEM authors against the platform.** The Word document's heading tree *is* the MitigateNY 2.0
component order. This is the first and so far only consultant whose deliverable was written with the
target IA in hand, and it changes the whole job:

| | Tetra Tech (Suffolk) | Hagerty (Nassau) | **IEM (Westchester)** |
|---|---|---|---|
| Annex shape | **survey**-shaped | short, transposed tables | **prose**-shaped, page-ordered |
| Mapping basis | subjective judgment | table reshaping | **positional alignment** |
| Hazard taxonomy | hybrid, owner decision needed | renames | **1:1, no decision needed** |
| Base-plan headings | different template | different template | **mirror the platform's pages** |

Consequences, measured on Westchester:

- **183 of 197** content-bearing base-plan sections landed on a named Annotation slot.
- **173 of 183** were exact title-and-position matches.
- All **16** hazard profiles mapped 1:1 to the 16 platform hazard pages — no splits, merges or drops.
  **The first county needing no taxonomy decision.**
- The annexes are a **verbatim walk of the annex page's component order** — every heading is a Card
  title, in page order, with the jurisdiction's prose beneath. All annex mappings were High
  confidence.

**So the mapping is positional, not interpretive.** Walk the document's paragraph stream and the
page's ordered component titles together.

**Do not let that lull you.** The two traps in §2 and §3 are *created* by the mirroring, and both
produce silent, plausible-looking wrong answers.

---

## 2. Trap: headings with no prose beneath them

Because the document mirrors the page, it carries a heading for **every** component — including the
ones the platform fills itself. Those headings have **nothing under them**.

On Westchester, **14 of the 36 distinct annex section headings were 0 characters in all 45 files**:

| Heading | component kind |
|---|---|
| `NFIP Loss`, `Infrastructure`, `Capabilities Inventory` | shared (`LHMP_IA`) |
| `Floodplain Map`, `Buildings in The Floodplain`, `Critical Buildings in The Floodplain` | data |
| `Hazards of Concern`, `Hazards Excluded`, `BUILDINGS BY LANDUSE`, `Critical Buildings` (the table one) | data |
| `Local Actions Database`, `Completed / In-Progress / Proposed Actions Table` | data |

**A title-only inventory will tell you NFIP content exists. It does not.** This is how a whole
mapping proposal gets written for prose that was never delivered. Always measure characters:

```bash
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

`nonzero=0` means heading, not source. Drop it before proposing anything.

The corollary: **IEM delivers no dams, NFIP or demographics prose in the annexes** at all. If a
column needs that content, it is not in this deliverable.

---

## 3. Trap: heading spellings drift from the Card titles

Every paragraph in every IEM annex is style **`Normal`** — python-docx gives you nothing to key on,
so section detection has to be by **title match in page order**. Which means a misspelled heading
silently lands its content in the *preceding* section. This cost **16 mis-attributions** on
Westchester before aliases went in.

The full set of variants found by sweeping all 45 annexes with a normalised fuzzy match against the
page's Card titles — these four are the only ones that exist:

| Page Card title | Annex spellings seen |
|---|---|
| `Historic Occurances` *(the page itself is misspelled)* | `Historic Occurrences` ×11, `Historic Occurences` (Port Chester), `Historic OccurEnces` (Tarrytown) |
| `BUILDINGS BY LANDUSE` | `BUILDINGS BY LAND USE` (Pound Ridge) |
| `Historic Properties/District` | `Historic Properties/Districts` (Westchester County) |

**Always run the fuzzy sweep**, don't hand-collect aliases. Three of these four look correct to a
reader and only one is a true typo.

---

## 4. Base-plan structure

The document's own heading tree, and where it lands. On a hazard page:

| Doc heading | Platform component |
|---|---|
| H4 `Overview` | order 5 Card (**shared data**) — prose merges into Local Hazard Summary |
| — | order 9 **Annotation** "Local Hazard Summary" |
| H4 `General Vulnerability` | order 10 Card (**data**) — prose merges into Local Hazard Summary |
| H5 `Declarations and Their Effects on the County` | order 29 **Annotation**, same title |
| H5 `Featured Event` | order 34 **Annotation**, same title |
| H4 `County Assessment` | order 37 **Annotation**, same title |
| H4 `Jurisdictional Assessment` | order 40 **Annotation**, same title |
| H5 `Built Environment: Local Risk Summary` | order 47 **Annotation** (colon vs dash) |
| H5 `People and Communities: Local Risk Summary` | order 50 **Annotation** |
| H5 `Natural Environment: Local Risk Summary` | order 53 **Annotation** |
| H5 `Local Capabilities` / `Local Actions` / `Featured Strategy` | orders 58 / 63 / 68 **Annotations** |

On county pages the document uses a literal **`Local Context`** H4/H5 wherever the platform has an
Annotation of that name. Built Environment is the cleanest case: 8 doc `Local Context` sections, 8
page `Local Context` Annotations, same order, 1:1.

**Two per-hazard exceptions found on Westchester:**

- **Lightning** has no `County Assessment` heading; its county-level assessment prose sits under
  H4 `Local Risk Assessment` instead. Retarget to the `County Assessment` Annotation.
- **Drought** is the only hazard where both `Overview` and `General Vulnerability` merge into
  `Local Hazard Summary` as two distinct blocks needing their own h3 lead-ins.

### Where IEM's structure exceeds the template

Four kinds of content have no slot, and every one is an owner decision, not a mapping problem:

1. **Plan-wide Executive Summary** — chapter-shaped paragraphs that distribute across the landing
   pages' Executive Summary Annotations. Expect ~2 of 6 to duplicate richer county-specific prose
   that already has a slot; skip those.
2. **Background** — mixes county facts (area, jurisdiction counts, coterminous town-villages) with
   Stafford Act / DMA 2000 / 44 CFR framing. Split by paragraph; the framing is boilerplate.
3. **Formal Adoption / Letter from the Director** — the letter is typically a **drafting
   placeholder** ("will be inserted in the final Plan"). Nothing to load; punch-list it.
4. **Risk Assessment Terms** — a five-term glossary identical across all 62 counties. Belongs in a
   shared `LHMP_IA` card, not a county slot.

### Navigation prose masquerading as content

IEM writes page-opening overviews that **enumerate the page's own sections** — one sentence each.
Westchester's Capabilities Assessment `Overview` was 5 paragraphs: 1 of genuine framing, then 4
naming Planning and Regulatory / Administrative and Technical / Financial / Education and Outreach,
each of which the page **already renders as its own Card with its own Local Context box**.

**Transcribe the framing paragraph; drop the enumeration.** It duplicates the page's structure in
prose, and it reads absurd inside the very box it is announcing.

---

## 5. Annex → Jurisdictions column mapping (IEM)

15 columns, all 45/45. Full table and the load mechanics in
[`../loading-annexes-into-jurisdictions-dataset.md`](../loading-annexes-into-jurisdictions-dataset.md) §5c
and §7.

| Annex heading | Column |
|---|---|
| Executive Summary | `description` |
| Planning Process | `lhmp_planning_process` |
| Buildings → Local Context | `lhmp_buildings_local_context` |
| Critical Buildings | `lhmp_critical_buildings` |
| Historic Properties/District (if applicable) | `historic_prop_dist` |
| Critical Infrastructure | `lhmp_criticial_infrastructure` |
| Risk | `lhmp_risk_overview` |
| Historic Occurances | `lhmp_historic_occurances` |
| Declared Disasters | `lhmp_declared_disasters` |
| Problem Areas | `lhmp_problem_areas` |
| Evaluation of Previously Identified Actions | `lhmp_previous_actions_evaluation` |
| Action Development | `lhmp` |
| Prioritization → Local Context | `lhmp_prioritization` |
| Capacity To Implement | `lhmp_capacity_to_implement` |
| Integration | `lhmp_integration` |

**Four sections are re-typed shared text — skip them.** IEM reproduces the statewide `LHMP_IA` prose,
lightly reworded per jurisdiction, under `Buildings` (ord 14), `Prioritization` (ord 60),
`Actions Database` (ord 64) and `Progress` (ord 78). 85,457 ch on Westchester. Keep the shared card,
transcribe nothing.

**Two sections carry local prose with no slot of their own:**

- **`Disaster and Local Emergencies`** (page ord 38 is a shared card). Paragraphs `[0]` and `[1]` are
  reworded shared text; **`[2]`+ are genuinely local** — the jurisdiction's own emergency-management
  arrangements and local declarations. Append to `lhmp_historic_occurances` under an h3 lead-in
  (43 of 45 rows on Westchester).
- **`Strategy`** (page ord 54 is a bare lexical header, the only chapter opener without a Card).
  Prepend to `lhmp` under an h3 lead-in. On Westchester 28 of 45 annexes wrote one, and it closed the
  single gap in that column.

---

## 6. Jurisdiction identity

IEM delivers **one annex per participating municipality plus one for the county**. Join on geoid,
never names.

- **Coterminous town-villages get one annex each** (Harrison, Mount Kisco, Scarsdale on Westchester);
  their twin rows stay empty.
- **Check the arithmetic against the base plan's stated total.** Westchester's plan states 45
  jurisdictions (6 cities + 19 towns + 23 villages = 48, less the 3 coterminous counted once); the
  delivery was 44 municipal + 1 county. That is how the **one genuinely missing annex (Mount
  Pleasant)** surfaced. Always do this subtraction.
- **Cities resolve to the Census *Place* row**, not the lowercase `cousub` MCD twin. See the annex
  skill's D-A1 discussion — Westchester is the first county carrying both for the same city.

---

## 7. Scripts

[`../scripts/westchester/`](../scripts/westchester/) — `baseplan/` and `annexes/`, with a README
giving run order. `baseplan/docx_dump.py` is the extractor to use for an IEM document: it walks
`body.iterchildren()` rather than `body.iter()`, so table paragraphs are not double-counted and text
boxes are not emitted 2–4× the way `context/scripts/docx_extract.py` does.

Two extraction notes specific to IEM documents:

- **The `toc 1/2/3` styles mirror `Heading 2/3/4` almost exactly** (456 of each on Westchester).
  Filter on `Heading *` or every heading appears twice.
- **Author fills from the JSON, not a terminal transcript.** Windows consoles mangle the document's
  smart quotes and en dashes; `blocks.json` holds correct Unicode.
