# Applying report fixes to a live MitigateNY site

How to take a row out of a QA report in
[`src/themes/mny/design/reports/`](../../../src/themes/mny/design/reports/) and turn it into a
verified edit on the live site, via the [`dms` CLI](../../../src/dms/packages/dms/cli/).

The reports are generated *about* the site; this skill is the write-back path. It exists because the
dangerous part of applying a report is never the write itself — it is (a) writing to the **wrong
row**, and (b) a write that quietly changes **more than the one setting** you meant to change. The
loop below makes both failures visible instead of silent.

> **Applying a county_template fix to the county drafts?** The duplicates' section ids are all
> different, so the report does not address them. Build the mapping first with
> [`propagating-county-template-changes-to-duplicates.md`](./propagating-county-template-changes-to-duplicates.md),
> then run this loop per pattern.

> **TL;DR** — freeze the report tab into a run folder, `baseline.mjs` it, `apply.mjs --dry-run`,
> `apply.mjs`, `mark_page_changed.mjs`, `validate.mjs`. Validation passes only when the intended
> attribute moved and every other leaf in the row is byte-identical.

```bash
export DMS_HOST=https://dmsserver.availabs.org DMS_APP=mitigat-ny-prod DMS_TYPE=prod
export DMS_AUTH_TOKEN=<mint per ../../../src/dms/skills/authenticating-the-dms-cli.md>

cd planning/mitigateny/skills/scripts/report_fixes
RUN=scratchpad/mny-admin-status/fix-runs/<date>-<what>

python export_tab.py <report>.xlsx "<Worksheet tab>" $RUN/rows.csv   # 0. freeze
node   baseline.mjs  $RUN/baseline --from-csv $RUN/rows.csv          # 1. scan
node   apply.mjs     $RUN --set-from "tags=Requirement" --dry-run    # 2. preview
node   apply.mjs     $RUN --set-from "tags=Requirement"              #    write
node   mark_page_changed.mjs $RUN                                    # 2b. page flag
node   validate.mjs  $RUN --attr tags                                # 3. verify
```

---

## Before you start: the report must address DRAFT sections

**Only ever write to a draft section id.** Publishing a page *clones* every draft section into a
fresh set of `|component` rows and swaps them into the page's `sections` array; the clones keep the
draft's `trackingId` but get new ids. So a published section id is a snapshot that goes stale the
next time anyone publishes — and writing to one edits a row no author will ever see, because the
next publish overwrites it.

This is not theoretical. Comparing two scans of the county template a day apart: **7 of 55 pages had
their published section ids churn; only 1 page's draft ids changed.**

A report is safe to drive this loop only if it addresses draft ids. In the county-template T5 series
that means **V2 or later** — `county-template-qa-t5-requirements-v2.xlsx` has a `Draft section ID`
column; V1 had `Component ID`, which held published ids. If your report only has published ids,
re-run its build with the draft-id resolution first (see
`scratchpad/mny-admin-status/resolve_draft_ids.py`) rather than mapping ids by hand.

`baseline.mjs` enforces this anyway — it prints `PUBLISHED-ONLY` or `ORPHAN` and exits non-zero for
any id that is not in the owning page's `draft_sections`, and `apply.mjs` refuses to write it.

**Writes land in the draft, not on the public site.** Nothing you do here changes what a visitor
sees until a human runs `dms page publish` (or hits Publish in the admin). That is deliberate: this
loop stages changes for review. Publishing is never part of the loop.

---

## 0. Freeze the report tab

Reports are multi-tab workbooks and get regenerated. Copy the **one tab** you are acting on into the
run folder so the run stays reproducible:

```bash
python export_tab.py --list county-template-qa-t5-requirements-v2.xlsx
python export_tab.py county-template-qa-t5-requirements-v2.xlsx \
       "Capabilities Assessment" $RUN/rows.csv
```

> **Don't filter the full-report CSV instead.** A `--where "Page=..."` over the whole report pulls
> in every row on that page, not the rows the tab selected — the tabs are curated subsets, and the
> page column does not reconstruct them. Exporting the tab is the only faithful way to say "these
> rows and no others". (Caught live: filtering by page returned 13 sections where the tab had 3.)

Give the run folder a dated, descriptive name — `2026-08-27-caps-tags`. Run folders live under
`scratchpad/mny-admin-status/fix-runs/` (git-ignored); they are the audit trail for the edit.

---

## 1. Baseline — scan before you touch anything

```bash
node baseline.mjs $RUN/baseline --from-csv $RUN/rows.csv
```

Writes one `<id>.json` per section plus a `_manifest.json`. Each snapshot holds **the whole row**,
not a summary:

- `data` — every attribute: `title`, `level`, `group`, `tags`, `is_draft`, `authPermissions`,
  `trackingId`, `parent`, and the full `element` payload (`element-type` + `element-data`, the
  JSON-string body carrying a lexical document or a Card's columns/filters/display config).
- `placement` — the facts that make the id meaningful, and which a diff of the row alone would
  miss: which page owns it, `inDraftSections`, `draftIndex` / `draftSectionCount`,
  `inPublishedSections`, `sectionGroupId`, and `sectionGroupInDraftGroups`.

Read the output before continuing. Every line should say `draft` and a group that resolves:

```
1447521  draft  group=default  tags=null  Education / Outreach
```

`PUBLISHED-ONLY` or `ORPHAN`, or `sectionGroupInDraftGroups=false`, means the report row is
addressing something an author cannot edit — fix the report, don't work around it here. Two things
qualify that verdict, both below: placement is only meaningful when resolved against the **right
page** (`data.parent` can lie, and a `parent≠page` marker on the line is normal on a cloned page),
and a *genuine* orphan still needs the ghost proof before you conclude anything.

**Why capture content when the fix is only a setting?** Because "only the setting changed" is a
claim you cannot make in step 3 without a before-image of everything else. The CLI's update path is
a read-modify-write of the entire `data` object; a serialisation bug anywhere in it would land
silently. The baseline is what turns that from a hope into an assertion.

---

## 2. Apply — one attribute, from one report column

```bash
node apply.mjs $RUN --set-from "tags=Requirement" --dry-run   # always dry-run first
node apply.mjs $RUN --set-from "tags=Requirement"
```

`--set-from "<sectionAttr>=<csvColumn>"` maps a report column onto a section attribute. Under the
hood each row becomes exactly one CLI call:

```bash
dms section update 1447521 --set tags=C1-a
```

`section update --set` is a read-modify-write: it re-fetches the row, lodash-`merge`s your keys into
the current `data`, and PUTs the whole object back. `parseData` only parses the top-level `data`, so
`element['element-data']` stays the string it was in the database — the content is passed through
untouched, not re-serialised.

`apply.mjs` refuses to write when:

| Refusal | Meaning |
|---|---|
| `no baseline` | step 1 was skipped for that id |
| `not a draft section in a draft section group` | the report is pointing at an uneditable row |
| `live row drifted since baseline` | someone edited between your scan and your write — re-baseline and re-review, never force |
| `NO-OP` | the attribute already holds the requested value (common after a partial earlier run) |

> **`--set` merges; it does not always replace.** lodash `merge` assigns scalars cleanly, but for an
> **array-valued** attribute it merges *by index* — `["a","b"]` merged over `["x","y","z"]` leaves
> `["a","b","z"]`, not `["a","b"]`. For any array attribute, send the whole object with
> `--data` instead of `--set`, and let step 3 catch you if you forget.

### 2b. Flip the owning page's `has_changes`

`dms section update` writes the section row and stops there. The admin UI's equivalent edit does
more: a section attribute change bubbles `updateAttribute` → `onChange` → `updateSections`
([`sectionGroup.jsx:187,201`](../../../src/dms/packages/dms/src/patterns/page/components/sections/sectionGroup.jsx)),
which also PUTs `has_changes: true` onto the **page** row.

That flag is what marks a page as having unpublished changes — the pattern editor and the edit pane
both read `page.published === 'draft' || !!page.has_changes`
([`pagesEditor.jsx:40`](../../../src/dms/packages/dms/src/patterns/admin/pages/patternEditor/pages/pagesEditor.jsx),
[`editPane/index.jsx:55`](../../../src/dms/packages/dms/src/patterns/page/pages/edit/editPane/index.jsx)).
**Skip this and your draft edit is real but invisible to whoever decides what to publish** — the page
looks clean, so it never gets published and the fix never ships.

```bash
node mark_page_changed.mjs $RUN --dry-run
node mark_page_changed.mjs $RUN
```

It touches only `has_changes`, then reads the page back and asserts every other attribute —
`draft_sections`, `sections`, `theme`, `history`, … — is unchanged.

### Attribute reference: `tags`

The section `tags` attribute is a **comma-joined string**, not an array — `"C1-a"`,
`"B2-a,B2-b"`. That is what the admin's tag control produces:
[`section_components.jsx:149,176`](../../../src/dms/packages/dms/src/patterns/page/components/sections/section_components.jsx)
reads `Array.isArray(value) ? value : value?.split(',')` and writes
`onChange([...arrayValue, newTag].join(','))`. Writing a JSON array here would render but would not
match the 900-odd sections already tagged. `--set tags=C1-a` produces the right shape:
`parseSetPairs` tries `JSON.parse` first, fails on `C1-a`, and keeps the string.

`dms section show` prints `"tags":[]` for an untagged section — that is the command's own
`d.tags || []` default, not the stored value. The stored value is absent/`null`. Trust
`section dump` / the baseline, not `show`, when the distinction matters.

**Never pipe a `Requirement` column straight into `--set-from`.** The reports write multi-value
requirements as `"B1-d, B1-e, B2-b"` — comma *and space*. The site's own values have no spaces
(`B1-d,B1-e,B2-b`, as on flooding section 1682899, tagged before any of this). A tag written with the
space becomes `" B1-e"`, which will not match a filter or the tag control's split. Add a computed
column in step 0 and map *that*:

```python
r['Tags'] = ','.join(t.strip() for t in r['Requirement'].split(',') if t.strip())
```

An untagged section may also hold `""` rather than `null` (flooding 1682933 did). `apply.mjs`
compares `String(live ?? '')`, so `""` reads as "no tag" and is written normally — but it is not a
`NO-OP`, and the validator's before-image will show `"" -> "B1-d"` instead of `undefined -> …`.

---

## 2c. Removals shift every later index — so validate knows about them

Run removals **after** the tag writes and validate last. Taking a section out of `draft_sections`
moves every surviving section after it down one, so a naive placement check fails on rows that are
perfectly fine. The answer is not to stop checking placement: `validate.mjs` reads the run's
`removed.json` and computes where each id *should* now be —

```
draft index 27 -> 25 of 69, exactly the shift this run's 4 removal(s) imply
```

— then asserts that exact index and count. A row whose index moved by anything other than the number
of removals below it still fails.

---

## 3. Validate — assert *only* the requested change happened

```bash
node validate.mjs $RUN --attr tags
```

Re-snapshots each section, then diffs it against the baseline **leaf by leaf**. `element-data` is
JSON-parsed before the diff, so a stray re-serialisation of a lexical body or a Card config surfaces
as the specific node that moved rather than as one opaque changed string.

A section PASSES only when all three hold:

1. `data.<attr>` moved to exactly the value the report asked for;
2. the only other differing leaf is `updated_at` (extend with `--allow <path>` if a fix legitimately
   touches more — and say so in the run notes);
3. placement is unchanged — same page, same `draftIndex`, same section group.

```
T5-242   1447521   PASS        2 leaf change(s), 0 unexpected
         data.tags: undefined -> "C1-a"
```

Two leaf changes is the expected floor: the attribute plus `updated_at`. Any `UNEXPECTED` line is a
failed run — restore from `baseline/<id>.json` before doing anything else.

**Independent confirmation is cheap; do it.** The validator and the writer share a code path, so
also read the row back through the plain CLI and hash the content payload:

```bash
dms section show 1447521          # -> "tags":"C1-a"
sha256(baseline element-data) == sha256(after element-data)
```

### Rolling back

The baseline is a full row image, so a rollback needs no reconstruction — it is one `--data` write
of the saved `data` object per section:

```bash
node rollback.mjs $RUN --dry-run     # shows every attribute it would put back
node rollback.mjs $RUN
```

It refuses any section whose live row no longer matches what `validate.mjs` recorded in `after/` —
that means something changed *after* your run, and restoring the baseline would discard someone
else's edit. `--force` overrides, and should be a deliberate, stated decision. Each restore is read
back and confirmed against the baseline before it is reported as `RESTORED`.

---

## When the author's `Notes` column drives the run

Once a person has triaged a report tab, the row's `Notes` is the instruction and the generated
`Recommended fix` is only a suggestion. The vocabulary in use on the county-template T5 tabs:

| Note | Means | Action |
|---|---|---|
| `Needs Tag` | tag it as the `Requirement` column says | one `tags` write |
| `Fixed` | already done, in the admin UI | nothing — re-reading it will show a `NO-OP` |
| `Unnecessary` | no CFR element applies to this component; leave it untagged | **nothing** |
| `Deleted` | the component should not be on the page | remove from `draft_sections` (below) |

Encode that split in step 0 rather than in your head: build **one** `rows.csv` holding every row of
the page, and fill the computed value column **only** for the rows the write applies to. `apply.mjs`
then reports `SKIPPED  report column <X> is empty` for the rest, so the run's `applied.json` records
the whole triage — including the deliberate non-writes — instead of silently omitting them.

### Propagating one triaged page's notes to its clones

When a family of pages is cloned from one template — the 16 hazard pages from
`natural_hazards/flooding` — triaging **one** page by hand is enough. Propagate by `trackingId`, which
survives cloning and publishing, and fall back through progressively weaker keys, recording which key
each row was matched by. On the hazard pages, 194 rows resolved as:

| Tier | Key | Rows | Why it is sound |
|---|---|---|---|
| A | `trackingId` == a triaged row's `trackingId` | 131 | the *same component*, not merely a similar one |
| B | (`LHMP_IA section`, `LHMP_IA component`, base kind, title-or-`UNTITLED`, `Requirement`) | 56 | same template slot; needed because hazard-bound components (the Hazard-of-Concern card, Local Hazard Summary, the declarations card) get a fresh `trackingId` per page |
| C | `trackingId` twin on the reference page **is already tagged** | 6 | the reference page settled the same component's requirement before the report existed |
| D | title + kind | 1 | last resort — say so in the provenance column |

Two checks make this trustworthy rather than plausible:

- **Run tiers A and B independently and compare.** Every row matched by both must get the same note.
  183 rows overlapped with **0 conflicts**, which is the evidence that the two keys describe the same
  structure.
- **Reject ambiguous source keys.** If two rows on the reference page share a tier-B key but carry
  different notes, that key cannot map anything. (None did here: 12 distinct keys, no ambiguity.)

Then **verify the destructive class before writing a single note.** All 44 rows that tier A mapped to
`Deleted` were fetched live and checked against the deletable test: untitled, no `level`, untagged,
and blank-body or no `element-data` — 44/44. That check is what separates "the mapping says delete"
from "it is safe to delete", and it belongs *before* the notes go in the workbook, not after.

Write the note in the report's `Notes` column and the tier in a **new** provenance column
(`Notes basis`) — never overload `Notes` itself with the basis, because the loop reads it as the
vocabulary. Back the workbook up into the run folder first, refuse to overwrite any cell a human has
already filled, and after saving re-export the tab and diff every other cell to prove nothing else
moved. `openpyxl` round-trips this workbook safely (no images, charts, pivots or tables to drop —
check before trusting that).

### `hideInView` and level-1 headings are permanently out of scope

Not every untagged section is a gap. Two classes never need a requirement tag, and both are
mechanically identifiable — so a scan should exclude them rather than report them:

| Rule | What it is |
|---|---|
| `data.hideInView === true` | the section is hidden from the rendered page (inline guidance cards, boilerplate blocks the author has switched off) |
| `data.level === '1'` with a title and a blank body | a section-delimiter heading that exists to build the left-hand nav rail |

On the 16 hazard pages those two rules accounted for **235 of the 236** untagged sections outside the
report — 219 `hideInView`, 16 level-1 headings — leaving exactly one real finding (a section with no
element type at all). Check these before presenting a coverage gap; most of a raw "untagged" count is
these two classes.

### Two pages can share the same section row

A section id can sit in **more than one page's** `draft_sections`. On the hazard pages nine do — the
`wind` page reuses seven of `lightning`'s sections and two of `tornado`'s. Consequences worth knowing
before a bulk write:

- an edit through one page changes the other page too;
- a report built per-page produces **two rows for one section**, and `baseline.mjs` (which dedupes by
  id) records placement for whichever row came last;
- within a single run, the first row writes and the second is **REFUSED as drift** — the guard firing
  correctly, because the row genuinely changed after its baseline. Check the refusal's `want` against
  what landed; if they match, nothing is missing.

Find them by intersecting the `draft_sections` of every page in the family before you start.

### The tab is not the population — check it against a live scan

A "needs tags" tab can only list a section the report could attach a requirement to. In the T5 build
that requirement comes from LHMP_IA, so **a section whose LHMP_IA row carries a null requirement, or
has no row at all, is invisible to the report** no matter how untagged it is. The three
`… - Local Risk Summary` slots on every hazard page are exactly that: real LHMP_IA components
(1957824 / 1686455 / 1957825) marked `mny_required: "Optional"` with no requirement of their own.

Before calling a tagging sweep complete, diff the tab against a live scan of the pages:

```bash
node page_scan.mjs <pageId> --json    # per page; untagged = tags null/'' and not a Header/Footer
```

On the 16 hazard pages that diff found **236 untagged sections the tab never listed** — 176 untitled
lexicals holding real narrative text, 43 untitled Cards, 16 level-1 `Local Risk Assessment` headings,
and one section with no element type at all. Report the count and the classes; do not quietly treat
"every row in the tab is triaged" as "every section is tagged".

### Deriving a requirement value the report could not

When a slot has no requirement of its own, the value is inherited — and it is worth corroborating from
more than one direction before writing it. For the `… - Local Risk Summary` slots, `B2-a, B2-b` was
confirmed three ways: the **parent card on the same page** already carried it (on all 16 pages); the
parent component's **LHMP_IA rows carried it for all 16 hazards** with zero variation (48 rows); and
the page's **other local-narrative heading slots were all already tagged** by the block they sit in
(`County Assessment` B2-a, `Featured Strategy` C4-a, …), making the untagged three the outliers rather
than the rule.

Also resist inferring absence from a hazard's nature. "Avalanches don't damage buildings, so that page
won't have a Built Environment block" sounds right and is wrong — all 16 pages carry the block, and
avalanche's LHMP_IA row is populated with *"According to the National Risk Index, Avalanches do not
pose any risk to buildings in New York State."* The component exists; it states the risk is nil. Check
`draft_sections` and the LHMP_IA rows rather than reasoning from the hazard.

### Adding rows to a report tab

Clone a hand-authored row rather than composing one: copy every column *except* the per-row identity
(`Page URL`, `Page`, `Page ID`, `Section title`, `Draft section ID`, `Fix ID`, and the provenance
columns), and copy the source cell's font/fill/border/alignment so the new rows do not read as
foreign. **Append at the bottom** — inserting mid-sheet shifts rows for no benefit, since `Page` and
`Draft section ID` carry the ordering. Allocate `Fix ID`s above the current maximum across *every*
tab; they are identifiers, not sort keys.

Leave a column empty rather than filling it with something adjacent-but-false: `V1 published section
ID` stayed blank on the appended rows because published ids churn, and writing a *current* published id
into a column labelled V1 would mislead the next reader. Set `Draft ID basis` to the key you actually
used (`trackingId`), which may be stronger than the generated rows' `positional`.

Then verify by re-export: row count moved by exactly the number added, **zero** changes to any
pre-existing row, no duplicate `Draft section ID`, and none of the new ids already tagged.

**Exclude what the author says is source-specific.** Flooding's `Special Flood Hazard Areas`,
`Floodplain Map` and the two untitled rows beside them describe a flood-only block; their notes must
not propagate. Excluding them cost nothing here — no other page had an untagged row in that block —
but the exclusion has to be explicit in the mapping code, not left to the key to get right by luck.

`Unnecessary` is a judgement call the author owns, and it is not predictable from the row: on
`the_risk/natural_hazards` two components of identical shape were triaged `Unnecessary` (2413407,
2413408, left in place) and `Deleted` (2413432). Do not infer the rule and apply it to untriaged
rows — carry those rows back to the report owner.

---

## Deleting a section: match what the admin UI actually does

The UI's delete **does not delete the row**. `remove` in
[`sectionArray.jsx:240`](../../../src/dms/packages/dms/src/patterns/page/components/sections/sectionArray.jsx)
splices the entry out of the array and hands it to `updateSections`, which PUTs three attributes onto
the **page** — `draft_sections`, `has_changes: true`, and a `history` entry (`"removed section …"`)
— and nothing onto the section. The section row survives as an orphan: still fetchable, still
carrying its `parent`, just no longer referenced. That is exactly the state of 1426501 / 1426465
after the author deleted them from `the_plan/capabilities_assessment`.

So **`dms section delete <id> --page <page>` is not the UI-equivalent** — it does the page-side
splice *and* issues `dms data delete` on the row. To mirror an author's delete, write only the page:

```
draft_sections: <baseline draft_sections minus the id>
has_changes:    true
```

`remove_from_page.mjs` does exactly this, driven by the same `rows.csv` (`Notes == "Deleted"` by
default, `--extra <pageId>:<sectionId>` for a target the report never listed). It writes through
`dms page update <id> --data '{"draft_sections":…,"has_changes":true}'` — **`--data` and not `--set`,
because `--set` lodash-merges arrays by index and a shorter array merged over a longer one leaves the
tail behind.** It filters the *original* array entries so their `{id, ref}` shape survives verbatim,
does one write per page with all of that page's targets at once, and then asserts four things:
`draft_sections` is exactly the expected array, every other page attribute is unchanged,
`has_changes` is true, and each removed section's **row is byte-identical and no longer referenced**.

Leave the section row alone. It costs nothing, and it makes the delete reversible by re-inserting the
id at its old `draftIndex` (which the baseline recorded). Skip the `history` entry: `history` is a
separate DMS row addressed through `updateDMSAttrs`' `_dirty` protocol, and forging one through the
CLI's flat `data edit` risks writing a ref to a row that does not exist. Note the omission in the run
notes — `has_changes` is the flag that actually gates publishing.

### "Empty" is not the same as "deletable"

On the county template, a blank-body lexical that has a **title, a `level` and a tag** is an
*authoring slot* — the heading a county writes its narrative under, empty only because nobody has
written it yet. The flooding page has 13 of them (`Featured Event`, `County Assessment`,
`Jurisdictional Assessment`, `Local Capabilities`, …). Deleting those deletes the template.

A deletable empty component is **untitled, untagged and has no content** — ideally
`element-data` absent entirely. Check all three before removing anything, and check them against the
live row, not the report's description of it.

---

## A report row can name a component that no longer exists

`baseline.mjs` printing `ORPHAN` has two very different causes, and they need opposite responses:

1. **the id was mis-resolved** — the component is on the page under a different id, and the report
   needs re-resolving; or
2. **the component is genuinely gone** — someone removed it before the report was built, and the row
   is a ghost.

`trackingId` tells them apart, because it is the one key that survives both a publish and a re-clone.
Pull the orphan's `trackingId` out of its baseline and look for it in **both** of the page's arrays:

```
orphan 1682930 trackingId=ad66ba54-…   -> no live draft section with that trackingId
                                       -> not in `sections` either
```

No match in `draft_sections` and none in `sections` = ghost. Confirm the page itself is healthy by
diffing the two arrays' trackingId sets: flooding's were an exact 75↔75 correspondence with zero
divergence, which rules out "the draft lost a component the published page still has". Then take no
action and report the row back — a ghost is a defect in the report, not a fix to force through.

Ghosts cluster on **age**, not on page kind: 3 of flooding's 18 rows were ghosts (its sections were
created 2026-01-14 and restructured 2026-03-04) while the other 15 hazard pages in the same tab
produced **0 ghosts in 194 rows**.

### `data.parent` is not authoritative — the page's `draft_sections` is

**A section's `parent` attribute can name a page the section is not on.** The 16 hazard pages were
created by cloning `natural_hazards/flooding`, and the clones' sections still carry
`parent = 1450290` (flooding) years later. Drought's section 1898211 is at draft index 20 of page
1545217 and reads `parent -> 1450290`, where it appears in neither array.

So there are two questions, and only one of them matters:

| Question | Answered by | Verdict |
|---|---|---|
| "which page's `draft_sections` references this id?" | the page row | **authoritative** — this is what an author sees and what a delete removes |
| "what does the section's `parent` say?" | the section row | a historical breadcrumb; may point at the page it was cloned from |

`snapshot()` used to derive placement from `parent` alone, which reported live sections as `ORPHAN`
and made `apply.mjs` refuse them — **8 of 13 drought rows, and most rows on every cloned page.** It
now takes the page the report names:

```js
snapshot(falcor, c, sectionId, expectedPageId)   // placement resolved against expectedPageId
```

`baseline.mjs --from-csv` passes the report's `Page ID` column automatically (`--page-column` to
override), and `apply.mjs` / `validate.mjs` / `rollback.mjs` reuse the page the baseline recorded, so
before/after placements are compared against the same page. Baseline prints `parent≠page` next to any
id where the two disagree — expected on a cloned page, and *not* a reason to stop.

**A bare `node baseline.mjs <dir> <id> <id>` has no page to resolve against** and falls back to
`parent`, so it will still mislabel a cloned page's sections. Prefer `--from-csv`.

An `ORPHAN` verdict is only trustworthy once it is measured against the right page — check that
before running the ghost proof above.

### Trusting a `positional` draft-id basis

V2's `Draft ID basis` column says how each draft id was found. `trackingId` is sound. **`positional`
means the id was matched by array index** — cheap, and wrong whenever the two arrays have drifted;
it is how the three dead flooding ids reached the tab. It does not invalidate the whole page: cross-
check each row you are about to write against the live draft scan on **section title + component
kind**, which is independent of both the id and the position. All 12 flooding writes matched; the
three that did not match anything were the ghosts.

---

## Worked example — T5 requirement tags, Capabilities Assessment (2026-08-27)

Report: `county-template-qa-t5-requirements-v2.xlsx`, tab **Capabilities Assessment** (3 rows).
Fix: `Section Settings > Tags` — assign the 44 CFR 201.6 element each section satisfies.
Run folder: `scratchpad/mny-admin-status/fix-runs/2026-08-27-caps-tags/`.

| Fix | Draft section | Kind | Change |
|---|---|---|---|
| T5-242 | 1447521 | `Card` on LHMP_IA, "Education / Outreach" | `tags: null → "C1-a"` |
| T5-247 | 1426501 | `lexical` (untitled, empty body) | `tags: null → "C1-a"` |
| T5-248 | 1426465 | `lexical` (untitled, empty body) | `tags: null → "C1-a"` |

All three sit on page 1425510 (`the_plan/capabilities_assessment`) in draft section group `default`
("Group 1") at draft indices 14, 26 and 27 of 30. Validation: **3/3 PASS, 0 unexpected leaf
changes**; the Card's 8,619-character `element-data` hashed identically before and after. Page 1425510
went `has_changes: false → true` with every other page attribute unchanged.

Two things the baseline surfaced that the report did not say:

- **1426501 and 1426465 have no `element-data` at all** — they are empty rich-text sections. Tagging
  an empty section is harmless but probably not what the requirement intended; the underlying
  question ("should these sections exist?") belongs back in the report, not in this loop. Flag
  findings like this to the report owner rather than acting on them here.
- V2's `Draft ID basis` column said `trackingId` for all three — i.e. the V1 published ids
  (2374599 / 2374611 / 2374612) were **already stale**, from a superseded publish. Writing to the
  V1 ids would have edited three rows nobody would ever see.

The changes are staged in the draft. Publishing `the_plan/capabilities_assessment` is a separate,
human decision.

---

## Worked example — T5 requirement tags, flooding hazard page (2026-08-27)

Report: `county-template-qa-t5-requirements-v2.xlsx`, tab **Likely Needing Tags**, the 18 rows for
`the_risk/natural_hazards/flooding` (page 1450290). Driver: the author's `Notes` column.
Run folder: `scratchpad/mny-admin-status/fix-runs/2026-08-27-flooding-tags/`.

| Notes | Rows | Result |
|---|---|---|
| `Needs Tag` | 12 | **12/12 PASS**, 0 unexpected leaf changes |
| `Unnecessary` | 3 | no write, recorded as `SKIPPED` |
| `Deleted` | 3 | no write — all three were **ghosts** |

Values written: `B1-d,B1-e,B2-b` ×3 (the Hazard-of-Concern / Modeled Risk / Historical Risk cards,
matching sibling 1682899 which was already tagged that way), `B2-a,B2-b` ×6, `B1-d` ×3. Page 1450290
went `has_changes: false → true`, every other page attribute unchanged. Each row was also re-read
with plain `dms section show` and its `element-data` hashed before/after — 12/12 byte-identical, the
largest 29,559 chars.

What the run surfaced that the report did not say:

- **3 of 18 rows were ghosts** (1682930 / 1682935 / 1683000) — see the ORPHAN section above. Their V1
  published ids were stale too. Nothing to delete; reported back rather than forced.
- **1682987 needs deleting and is not in the report** — draft index 58, untitled lexical, no
  `element-data`, the same shape as the two the author deleted on capabilities_assessment. It has no
  requirement match, so the "needs tags" tab never listed it. Deleting untitled empties is a
  *different* sweep from tagging, and it needs its own work-list.
- One writable row held `tags: ""` rather than `null` (1682933).

---

## Worked example — the 16 hazard pages, end to end (2026-08-28)

Four runs under `scratchpad/mny-admin-status/fix-runs/`: `2026-08-28-drought-tags` (one page, as a
proof run) then `-hazards-batch1/2/3` at five pages each. Source: the same **Likely Needing Tags**
tab, 276 hazard rows, triaged `Needs Tag` / `Unnecessary` / `Deleted`.

| | Result |
|---|---|
| tag writes | **165 across all runs, 165 PASS, 0 unexpected leaf changes** |
| `element-data` byte-identical before/after | **165 / 165** (largest payload 32,164 chars) |
| removals | **61 sections across 16 page writes, 0 failures** |
| `has_changes` | true on all 16 pages |
| final audit of every row against live state | **276 / 276 correct, 0 problems** |

Batching five pages per run worked well: `baseline` / `apply` / `remove_from_page` /
`mark_page_changed` / `validate` are all row-driven and group by page themselves, and every step is
idempotent (`NO-OP` on an already-set tag, `NO-OP` on an already-dereferenced section), so a re-run
after any interruption is safe.

What the runs surfaced that the report did not say:

- **Nine sections are shared between pages** (see above), which produced one `REFUSED` — correctly.
- The three flooding rows that were ghosts stayed `NO-OP` in every step, as they should.
- One removal target (`avalanche/2176929`) was never in the report at all — a row with **no element
  type**, only `{type: null}`. It went through as `--extra 1544721:2176929`.

The final audit is worth writing for any sweep this size: re-read every row from the live site and
assert the triage, rather than trusting the sum of per-run reports —
`Needs Tag` → tagged with exactly the requested value **and** still on its page; `Deleted` → off the
page **but its row still fetchable**; `Unnecessary` → still on the page and still untagged.

---

## Scripts

In [`scripts/report_fixes/`](./scripts/report_fixes/):

| File | Role |
|---|---|
| `export_tab.py` | step 0 — freeze one report worksheet tab to `rows.csv` (`--list` to see the tabs) |
| `baseline.mjs` | step 1 — full row + placement snapshot per section; refuses non-draft ids. Resolves placement against the report's `Page ID` (`--page-column`), not `data.parent` |
| `page_scan.mjs` | live inventory of a page's draft sections (index / id / trackingId / type / title / tags / whether a lexical body is blank) + draft↔published trackingId correspondence, and `--find-trk` to place an orphan. The independent cross-check for a `positional` draft id, and the work-list for a delete sweep |
| `apply.mjs` | step 2 — `--set-from "<attr>=<column>"`, drift-checked, `--dry-run` supported |
| `remove_from_page.mjs` | the delete half — dereferences a section from the page's `draft_sections` the way the UI does (row left intact), refusing anything that looks authored |
| `mark_page_changed.mjs` | step 2b — set the owning page's `has_changes`, asserting nothing else on the page moved |
| `validate.mjs` | step 3 — leaf diff vs baseline; PASS requires zero unexpected changes |
| `scan_pattern.mjs` | inventory every draft section of every page in a PATTERN in one batched pass — the input to cross-pattern matching |
| `match_patterns.py` | match a report tab's rows from a source pattern into target patterns (trackingId → neighbour alignment → page-structure tiers) |
| `rollback.mjs` | undo a run from its baseline; refuses if the row moved after validation |
| `fix_lib.mjs` | shared: snapshot, canonical JSON, leaf flatten/diff — reads through the CLI's own falcor helpers so scripts and `dms` see identical rows |

These read `DMS_HOST` / `DMS_APP` / `DMS_AUTH_TOKEN` from the environment and throw if unset. No
credentials belong in this tree — mint a token the one canonical way, per
[`authenticating-the-dms-cli.md`](../../../src/dms/skills/authenticating-the-dms-cli.md).

Unlike the county-specific scripts elsewhere in `scripts/`, these carry **no site or report
constants** — the report tab supplies the ids and the values. A new report type usually needs only a
new `--set-from` mapping, and a new `--attr` reference section above.
