# MNY County Template — 44 CFR 201.6 requirement tags on every section

**Project:** MitigateNY · **Topic:** content · **Status:** IN PROGRESS · **Started:** 2026-08-27

## Objective

Give every content section of the county template (`county_template.devmny.org`, app
`mitigat-ny-prod`, type `prod`) a `Section Settings > Tags` value naming the 44 CFR 201.6 element it
satisfies, so the plan can be audited element-by-element from the site itself. Delete the untitled,
untagged, contentless components the tagging sweep exposes.

Work list: `src/themes/mny/design/reports/county-template-qa-t5-requirements-v2.xlsx`, tab **Likely
Needing Tags** — 244 rows on 26 pages, the sections a fix-type-5 scan found with no tag. The author
(Eric) triages each row in the `Notes` column; the notes, not the generated `Recommended fix`, are
the instruction.

| Note | Meaning | Action |
|---|---|---|
| `Needs Tag` | tag it as the `Requirement` column says | one `tags` write |
| `Fixed` | already done in the admin UI | none |
| `Unnecessary` | no CFR element applies | none (deliberate non-write) |
| `Deleted` | component should not be on the page | remove from `draft_sections` |

## Method

[`planning/mitigateny/skills/applying-report-fixes-to-a-live-site.md`](../../skills/applying-report-fixes-to-a-live-site.md)
— freeze the tab → baseline → apply → mark page `has_changes` → validate leaf-by-leaf. Runs live in
`scratchpad/mny-admin-status/fix-runs/<date>-<what>/`, each with a `NOTES.md`.

**Writes land in the draft only. Publishing is a separate human decision and is not part of this task.**

## Progress

- [x] **Capabilities Assessment tab (3 rows)** — 2026-08-27, run `2026-08-27-caps-tags`. 3/3 PASS.
      Established the loop and the skill.
- [x] **Non-hazard pages of the Likely Needing Tags tab** — done by Eric in the admin UI (19 `Fixed`,
      7 `Unnecessary`, 4 `Deleted`). Verified live 2026-08-27: 30 of 32 landed correctly. Two
      exceptions, both still open below.
- [x] **`the_risk/natural_hazards/flooding` (18 rows)** — 2026-08-27, run `2026-08-27-flooding-tags`.
      12 `Needs Tag` written and validated (12/12 PASS, 0 unexpected leaf changes, all 12
      `element-data` payloads byte-identical); 3 `Unnecessary` skipped; 3 `Deleted` turned out to be
      **ghosts** — components removed from the page on 2026-03-04, absent from `draft_sections`,
      `sections`, and any `trackingId`. Page 1450290 `has_changes: false → true`.
- [x] **Triage of the remaining 15 hazard pages (194 rows)** — 2026-08-27. Flooding's triage
      propagated into the tab's `Notes` column by `trackingId` (131 rows), template slot (56), an
      already-tagged flooding twin (6) and title+kind (1); tiers A and B overlapped on 183 rows with
      **0 conflicts**. **107 `Needs Tag`, 44 `Deleted`, 43 `Unnecessary`** — the tab is now 244/244
      triaged. A `Notes basis` column records each row's provenance. Eric's 4 flood-specific rows were
      excluded as sources. All 44 `Deleted` targets verified live as untitled / no level / untagged /
      empty before the notes went in. Ghost check: **0 ghosts in the 194**.
- [x] **Four NRI rows the scan never listed, plus their 60 counterparts** — 2026-08-27. Eric added
      flooding's three `… - Local Risk Summary` slots (`Needs Tag` / `B2-a, B2-b`) and the untitled
      empty beside them (`Deleted`); the trackingId twins on the other 15 pages were appended as
      T5-876…T5-935 (45 `Needs Tag` + 15 `Deleted`). Tab 248 → **308 rows**, 0 pre-existing rows
      touched. The "some hazards lack the NRI components" concern was checked and does not hold — all
      four sections, and their already-tagged parent cards, are on 16/16 pages, and LHMP_IA carries an
      Overview row per component per hazard (48 rows, all `B2-a, B2-b`). What varies is the narrative:
      avalanche's says the NRI risk to buildings is nil.
- [x] **Applied every triaged hazard row** — 2026-08-28, runs `2026-08-28-drought-tags` (proof run)
      and `-hazards-batch1/2/3`. **165 tag writes, 165 PASS, 0 unexpected leaf changes; 61 removals
      across 16 page writes, 0 failures; `has_changes` true on all 16 pages.** All 165 `element-data`
      payloads byte-identical before/after (largest 32,164 chars). Final audit re-read all **276**
      hazard rows from the live site: **276/276 correct**. `remove_from_page.mjs` was written for the
      delete path (page-side dereference only, row left intact, refuses anything that looks authored)
      and `validate.mjs` made removal-aware so index shifts are asserted exactly rather than ignored.
- [x] **The non-hazard pages, all three duplicates — 2026-08-28**, runs
      `2026-08-28-nonhazard-{suffolk,schenectady,delaware}` off the shared prep folder
      `2026-08-28-nonhazard-dups`. **44 tag writes (14 / 15 / 15), 44/44 PASS, 0 unexpected leaf
      changes; 12 removals over 9 page writes, 0 failures; `has_changes` true on all 21 pages
      touched.** An independent re-read (`audit.mjs`, which reads neither the baseline nor
      `applied.json`) found **90 of 90** duplicate non-hazard rows correct. Two rows needed a
      recomputed note rather than a copied one: **T5-043** → `Unnecessary` (the author retriaged
      the source row), **T5-214** → held, see Open items. The removals needed
      `--allow-nonempty`: T5-247 / T5-248 are untitled contentless lexicals carrying a `level`,
      the same two components the author had already deleted from `county_template` by hand.
- [x] **Eric's two problem rows, checked live 2026-08-28.** T5-043 is resolved — he retriaged it
      `Unnecessary`, and section 2380933 does sit in `draft_sections` of
      `the_plan/jurisdictional_annexes` (the earlier "dead row" reading was wrong; see Open
      items 1). T5-214 turned out **half-fixed**: 2011184 is now tagged, but `B1-a`, not the
      `B2-a` the report asks for. Still open.
- [x] **`county_template`'s own 32 non-hazard rows are now verified and closed** — all 32 were
      re-read live: 17 `Fixed` carry exactly the requested tag, the 4 `Deleted` are off their
      pages, the 10 `Unnecessary` are untagged and in place. Only T5-214 is left `Open`.
- [x] **The 236 sections outside the tab: resolved, 2026-08-28.** Eric confirmed 219 are hidden from
      view and 16 are level-1 section-delimiter headings that build the left nav — **none of those will
      ever need tags**, and both classes are mechanically identifiable (`data.hideInView === true`;
      `level === '1'` + title + blank body), so a future scan should exclude them rather than report
      them. That accounted for 235 of 236; the last one (avalanche/2176929, a row with no element type
      at all) was deleted as part of the 2026-08-28 sweep. **The hazard pages are now fully triaged and
      fully applied.**
- [ ] **Nine sections are shared between hazard pages** — `wind` reuses seven of `lightning`'s sections
      and two of `tornado`'s (1545715, 1545717, 1545728, 1545729, 1545734, 1545737, 1545744 with
      lightning; 1545840, 1545876 with tornado). An edit through one page changes the other. Harmless
      for tagging (both pages wanted the same values, and the drift guard caught the double write) but
      it is a page-integrity defect worth fixing separately.

## The three county duplicates

**Every fix in this task must also be applied to the three live county drafts**, which were duplicated
off `county_template` and therefore carry the same missing tags under different section ids:

| Pattern | Id | Subdomain |
|---|---|---|
| `MitigateNY_County_Template_Suffolk_copy` | 2249247 | `suffolk_draft` |
| `MitigateNY_Schenectady_Draft_V2` | 2304223 | `schenectady_draft` |
| `MitigateNY_Delaware_Draft` | 2323808 | `delaware_draft` |

**Inventory built 2026-08-28** and written into the tab (see
[`propagating-county-template-changes-to-duplicates.md`](../../skills/propagating-county-template-changes-to-duplicates.md)
for the method). 918 of 924 possible rows matched — tier A `trackingId` 874, tier B neighbour
alignment 42, tier C page-structure 2; the 6 unresolved are two Graphs that do not exist in any
duplicate. Tab went 308 → **1,226 rows** with a new `Pattern ID` column.

Work per duplicate. The **non-hazard** column was applied 2026-08-28; the hazard column is what
is left:

| Pattern | Tag writes | Removals | Already correct | No action | Non-hazard applied | Hazard tag writes left |
|---|---|---|---|---|---|---|
| suffolk_draft | 171 | 67 | 13 | 55 `Unnecessary` | 14 + 4 removals ✓ | 157 + 63 removals |
| schenectady_draft | 172 | 67 | 12 | 55 | 15 + 4 removals ✓ | 157 + 63 removals |
| delaware_draft | 172 | 67 | 12 | 55 | 15 + 4 removals ✓ | 157 + 63 removals |

Plus one held tag write per pattern (T5-214) once the author picks `B1-a` or `B2-a`.

Completeness check that closes: 186 components should carry a tag on county_template, 184 of those
exist in each duplicate, and 186 − 184 = the 2 absent components.

## Remaining scope

The hazard pages of `county_template` are done. What is left of the whole task:

1. **The hazard pages of the three duplicates** — 471 tag writes + 189 removals, the same loop the
   non-hazard runs used, one run folder per pattern. This is the next step, and it is now the only
   large piece left.
2. **T5-214** — one decision, four tag writes (Open item 1 below).
3. The **non-hazard** pages of county_template are swept and closed as of 2026-08-28. What has
   *not* been done is a fresh `hideInView` / level-1-aware **scan** of those 10 pages to say whether
   any section the original report never listed is still untagged — the equivalent of the NRI
   discovery that added 60 rows on the hazard side.
4. Publishing. Every change from this task is staged in drafts; nothing is on the public site.

## Open items

1. **T5-214 — the one row still open, and it needs a decision, not a write.** Section 2011184
   (`the_local_environment/built_environment`) now carries `tags: "B1-a"`. The report row's
   `Requirement` is **`B2-a`**, and every other tagged component on that page is `B2-a` (T5-207,
   T5-211, T5-221, T5-222) or `B2-b` (T5-226, T5-227). So either the author meant `B1-a` and the
   report's requirement is wrong for this row, or it was a mis-pick. Until that is settled the row
   is `Open` on all four patterns and the three duplicate sections (2249632, 2305455, 2325049) are
   deliberately untouched — `rows.csv` carries `Notes = Hold` for them so `apply.mjs` skips.
   Whichever value wins, it is four one-attribute writes.
2. **T5-043 — closed, and the earlier diagnosis was wrong.** The author retriaged it `Unnecessary`,
   which settles it either way, but for the record: section 2380933 *is* in `draft_sections` of
   `the_plan/jurisdictional_annexes` (verified 2026-08-28), so the report row named the right page
   and the "tag landed on a dead row / fix the twin 1515010" reading in the 2026-08-27 note does not
   hold. The lesson is the one in item 4 — placement must be read against the page the report names.
3. **`Unnecessary` vs `Deleted` is not derivable from the row.** On `the_risk/natural_hazards`, two
   components of identical shape were triaged `Unnecessary` (2413407, 2413408 — left in place) and
   `Deleted` (2413432). That is why the hazard-page notes were propagated from flooding's triage by
   identity (`trackingId`) rather than inferred from row shape.
4. **`data.parent` is not authoritative and the scripts had to be fixed for it.** The hazard pages are
   clones of flooding and their sections still carry `parent = 1450290`, so a parent-derived placement
   reported live sections as `ORPHAN` — 8 of 13 drought rows would have been refused. `snapshot()` now
   takes the page the report names; `baseline.mjs --from-csv` supplies it from the `Page ID` column and
   flags `parent≠page`. Anything that reads placement must go through a run's baseline, not `parent`.
5. **The sibling `county-template-qa-t5-requirements-v2.csv` is stale** — it predates even Eric's own
   triage. The `.xlsx` is the working document; regenerate the CSV from it rather than reading it.

## Verification standard

A row is only done when `validate.mjs` reports PASS: the `tags` leaf moved to exactly the requested
value, `updated_at` is the only other leaf that moved, and placement (page, `draftIndex`, section
group) is unchanged. Each run is additionally re-read through plain `dms section show` and its
`element-data` hashed before/after.

Two facts the tag values must respect:

- The vocabulary is a **comma-joined string with no spaces** — `B1-d,B1-e,B2-b`. The report's
  `Requirement` column uses `", "` and must be normalised before it is written.
- Requirement values are cross-checkable against already-tagged siblings on the same page: flooding's
  three untagged hazard cards were assigned `B1-d,B1-e,B2-b`, matching sibling 1682899, which carried
  that value before this task began.
