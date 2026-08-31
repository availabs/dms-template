# Propagating a county_template change to its duplicate patterns

`county_template` is the source of truth for the MitigateNY 2.0 county site. Each county draft is a
**duplicate of that pattern**, made at some point in the past and then edited independently. So every
time the template is fixed, the same fix has to be applied retroactively to each live duplicate — and
the duplicate's section ids are all different, so no report about the template addresses them.

This skill is the mapping layer. It ends where
[`applying-report-fixes-to-a-live-site.md`](./applying-report-fixes-to-a-live-site.md) begins: once
each duplicate's rows are in the report tab with their own `Draft section ID` and `Page ID`, that
loop applies them unchanged.

> **TL;DR** — scan the source and each target pattern, match row-by-row with the three-tier ladder,
> **recompute the note against the target's own state**, write the rows into the report tab with a
> `Pattern ID` column, verify the counts, and only then run the fix loop per pattern.

```bash
cd planning/mitigateny/skills/scripts/report_fixes
python export_tab.py <report>.xlsx "<tab>" $W/tab.csv          # the source pattern's rows
node   scan_pattern.mjs 1300890 $W/scan_1300890.json --slugs $W/slugs.json
node   scan_pattern.mjs 2249247 $W/scan_2249247.json --slugs $W/slugs.json
python match_patterns.py --tab $W/tab.csv --source $W/scan_1300890.json --trk $W/tab_trk.json \
       --target 2249247=$W/scan_2249247.json --out $W/dup_rows.json
```

`--slugs` is a JSON array of the `url_slug`s the tab references — derive it from the tab's `Page`
column, so a 50-page pattern costs 26 page scans instead of 50.

---

## The pattern registry

`dms pattern list` is authoritative; these are the four that matter as of 2026-08-28.

| Pattern | Id | Subdomain | Role |
|---|---|---|---|
| `MitigateNY_County_Template_V3` | **1300890** | `county_template` | the source |
| `MitigateNY_County_Template_Suffolk_copy` | **2249247** | `suffolk_draft` | duplicate |
| `MitigateNY_Schenectady_Draft_V2` | **2304223** | `schenectady_draft` | duplicate |
| `MitigateNY_Delaware_Draft` | **2323808** | `delaware_draft` | duplicate |

Others share these prefixes (`MitigateNY_County_Template_Westchester`, `…_Suffolk` without `_copy`,
`MitigateNY Schenectady Draft` at 2275239, `MitigateNY_suffolkold`) — **match on the subdomain, not
the display name**, and confirm the id with the requester before writing anything. Page URLs are
`https://<subdomain>.devmny.org/<url_slug>`.

---

## What duplication does and does not preserve

Duplicating a pattern clones its pages and sections with **new ids**. Everything else about the
alignment problem follows from what survives that clone:

| | Survives duplication? |
|---|---|
| `url_slug` of each page | **yes** — this is the reliable join between patterns |
| section `trackingId` | **mostly** — 874 of 918 rows matched on it |
| section `trackingId`, some components | **no** — a fresh one is minted (e.g. the "County Level" Spreadsheet on every hazard page) |
| section `trackingId`, some whole pages | **no** — `the_risk/disasters/disaster_template` shares *none* with the source |
| section order within a page | yes in practice, and that is what makes tiers B and C safe |
| `data.parent` | irrelevant — it points at whatever page the section was cloned from; see the main skill |

So `trackingId` is the primary key, and it is not sufficient. Hence the ladder.

---

## The three-tier matching ladder

`match_patterns.py` implements all three and labels every row with the tier that matched it, so the
weaker matches are reviewable rather than invisible.

| Tier | Key | Why it is needed | Count in the 2026-08-28 run |
|---|---|---|---|
| **A** | `trackingId` identical | the same component, not a similar one | 874 |
| **B** | neighbour alignment — align the two pages on the ids that matched by trackingId, then accept the **single** candidate in the corresponding gap **if its element type matches** | duplication mints a fresh trackingId for some components | 42 |
| **C** | page structure identical — same section count **and** same element-type sequence → match by index | some pages lose every trackingId, leaving B no anchors | 2 |
| — | unresolved | the component does not exist in that pattern | 6 |

Two properties make this trustworthy rather than merely plausible:

- **Tier B never guesses.** It requires exactly one candidate in the gap between two anchored
  neighbours, and that candidate's element type must match. A gap with two Spreadsheets in it is left
  unresolved, not resolved arbitrarily.
- **Tier A works for dereferenced rows too.** A `Deleted` row's source section is no longer on its
  page, so there is no index to align from — but the row still exists and still has its
  `trackingId`. Pass `--trk` with a `{sectionId: {trk}}` map (fetch it in one batched pass) and those
  rows match on tier A like any other. Without it, every `Deleted` row goes unresolved: that is the
  single easiest way to get this wrong.

### An unresolved row is usually real

Verify one before assuming the matcher failed. In the 2026-08-28 run all 6 unresolved rows were the
same two components — `The Last 5 Years - Events` and `- Fusion Damage`, Graphs on
`the_risk/natural_hazards` — and the source page has **6 Graphs where every duplicate has 4**. They
were added to `county_template` after the duplicates were made. Their section ids (2413430/2413431)
are in a much later id range than the duplicates' pages, which is the quickest tell.

The mirror image also happens: a component may be **already fixed** in a duplicate. 12–13 rows per
pattern already carried the right tag, including the very component whose fresh trackingId forced
tier B into existence.

---

## The trap: a note describes the pattern it was written about

**The source row's `Notes` is not the target's note.** `Fixed` on a `county_template` row means *Eric
fixed it on county_template* — the duplicate may still be untagged. Copy it verbatim and you silently
drop real work: in this run **17 rows per pattern** were `Fixed` on the template and still untagged in
every duplicate.

Recompute each target row's note from the target's own live state, keeping the source row's
`Requirement` as the intent:

| Source note | Target state | Target note |
|---|---|---|
| `Needs Tag` or `Fixed` | untagged | **`Needs Tag`** |
| `Needs Tag` or `Fixed` | already carries exactly the requested tag | `Fixed` |
| `Needs Tag` or `Fixed` | carries a **different** tag | `Needs Tag`, and say so in the basis column — a human should look |
| `Deleted` | still in `draft_sections` | **`Deleted`** |
| `Deleted` | already off the page | `Fixed` |
| `Unnecessary` | — | `Unnecessary` (a judgement about the component, not the pattern) |

**And recompute again if the source row is retriaged after the rows are appended.** The notes in the
tab are a snapshot of the source's triage at append time, not a live view of it. On 2026-08-28 the
author changed T5-043 from `Fixed` to `Unnecessary` *after* the 918 duplicate rows were written; the
three duplicate rows still said `Needs Tag` and would have put a tag on a component the author had
just ruled out. Diff the source rows against the pre-append backup before a run — one
`export_tab.py` of the backup `.xlsx` and a key-by-key compare is enough, and it is the only way to
see an author edit that the row's own columns cannot show.

Then check the arithmetic in the direction that is invariant. Per-note counts differ between patterns
and that is fine; what should reconcile is the **number of components that ought to carry a tag**:

```
county_template   186 = 167 Needs Tag + 19 Fixed-with-a-requirement
each duplicate    184 = 171/172 Needs Tag + 12/13 Fixed
                  186 - 184 = the 2 components that do not exist in the duplicates  ✓
```

That identity is the check that the propagation is complete. If it does not close, something is
mismatched, not merely different.

---

## Writing the rows into the report tab

Follow "Adding rows to a report tab" in the
[main skill](./applying-report-fixes-to-a-live-site.md) — clone a real row, append at the bottom,
back up first, verify by re-export — plus:

- **Add a `Pattern ID` column and stamp every pre-existing row** with the source pattern id. Without
  it the tab silently means "county_template" and stops being self-describing the moment a second
  pattern is in it.
- **Reuse the source `Fix ID`.** `T5-539` in pattern 2249247 *is* the same fix as `T5-539` in
  county_template; the row key is `(Fix ID, Pattern ID)`. This keeps the tab joinable back to the
  source and avoids inventing several hundred identifiers. Nothing in the fix loop needs a unique
  `Fix ID` — `baseline.mjs` keys on `Draft section ID`, which *is* unique across patterns.
- **Per-row columns to re-derive:** `Pattern ID`, `Page URL` (the target's subdomain), `Page ID`,
  `Draft section ID`, `Section title` (the target's own title — they do drift: suffolk's
  `Total Assessed Loss` is county_template's `Total Loss by Program`), `Draft tags (current)`,
  `Notes`, `Status`, `Draft ID basis` (put the matching tier here), and the provenance column.
  Blank `V1 published section ID` — there is no V1 of a duplicate.
- **Record the source id in the provenance column**: `from county_template T5-539 (section 1682901)
  via trackingId; draft index 3`. That is what makes a wrong row diagnosable later.

---

## Expect the source's defects to have been duplicated too

Anything structurally wrong with `county_template` was copied. Both defects known on the template as
of 2026-08-28 are present in all three duplicates:

- **Shared sections.** `county_template`'s section 1545717 sits in both `lightning` and `wind`'s
  `draft_sections`, and 1545840 in both `tornado` and `wind`. Each duplicate has its own shared pair
  (suffolk 2250911 / 2251031, schenectady 2307340 / 2307400, delaware 2326923 / 2326986). The tab
  therefore has two rows for one section, which is correct bookkeeping — and the fix loop handles it
  the same way it did on the template: the first row writes, the second is `REFUSED` as drift.
- **Untitled contentless components.** The 67 removals per duplicate are the same components the
  template's sweep removed, plus the ones the template had already lost before the sweep.

---

## Worked example — county_template → 3 county drafts (2026-08-28)

Source: `county-template-qa-t5-requirements-v2.xlsx` → **Likely Needing Tags**, 308 rows over 26
pages, fully triaged and fully applied on `county_template`.

| | Result |
|---|---|
| rows matched | **918 of 924** (308 × 3) — tier A 874, tier B 42, tier C 2 |
| unresolved | 6 — two components absent from every duplicate |
| appended to the tab | 918 rows, tab 308 → **1,226 rows**, new `Pattern ID` column |
| work per duplicate | **suffolk 171 tags + 67 removals**, **schenectady 172 + 67**, **delaware 172 + 67** |
| already correct | 12–13 tag rows per pattern |
| no action | 55 `Unnecessary` per pattern |

Verified after writing: **0 unexpected changes** to any pre-existing county_template cell (only
`Pattern ID`, `Status` and `Date fixed` moved, all intentionally), and the 186 ↔ 184 + 2 identity
above closes.

### Applying it — the non-hazard half, 2026-08-28

The ordinary fix loop, run three times, one run folder per pattern; the rows were filtered out of
`rows_all.csv` by `Pattern ID` rather than with `--where`, which amounts to the same freeze.

| | Result |
|---|---|
| tag writes | **44** (suffolk 14, schenectady 15, delaware 15) — **44/44 PASS**, 0 unexpected leaves |
| removals | **12** over 9 page writes, all `REMOVED` |
| independent re-read | **90 of 90** rows correct (a second script that reads neither `baseline/` nor `applied.json`) |
| held | T5-214 × 3 — see below |

Three things this half taught that the inventory half could not:

- **A source-side note can go stale between the append and the run** — see the recompute warning
  above (T5-043).
- **A half-fixed source row is worse than an unfixed one.** T5-214 was marked `Fixed` on
  `county_template` and the component *was* tagged — with `B1-a`, where the report says `B2-a`. The
  recompute rule for "carries a different tag" is *`Needs Tag`, and a human should look*; in practice
  the useful move is to **hold** the row: set its note to something the tooling does not act on
  (`Hold`, with the `Tags` column empty) so `apply.mjs` reports SKIPPED and `remove_from_page.mjs`
  ignores it, and leave the workbook row `Open`. Guessing either value writes a wrong tag to three
  live sites at once.
- **The removal guard will refuse components the author has already deleted from the source.**
  `remove_from_page.mjs` treats a `level` as evidence of authoring. Two of the four `Deleted` rows
  per pattern (T5-247, T5-248) are untitled, contentless lexicals that carry `level` 1 and 2 — and
  their `county_template` twins (1426501, 1426465) are already dereferenced, i.e. the author deleted
  exactly that shape by hand. `--allow-nonempty` is right there, and the justification is the source
  pattern's own state, not a judgement of your own. Dry-run first: the flag is per-run, so confirm
  the other targets pass the guard unaided before you set it.

**The hazard half is still outstanding** — 471 tag writes + 189 removals across the three patterns.
