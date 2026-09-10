# Snap to County Template

Realign a duplicate pattern's **component settings** with `county_template`
(pattern **1300890**), which is the source of truth. Every setting that has
drifted is reset to the template's value; everything that is legitimately the
county's own is left alone.

> **DRAFT — not yet executed.** This document is the plan. No pattern has been
> snapped. Read [Open decisions](#10-open-decisions) before the first run.

**Read first:**
[`template-and-duplicate-patterns.md`](./template-and-duplicate-patterns.md) — the
relationship model, and which deviations are correct by design. This skill is the
*write* half of that document. Nothing here overrides it.

**Then:**
[`applying-report-fixes-to-a-live-site.md`](./applying-report-fixes-to-a-live-site.md)
— the freeze → baseline → apply → validate loop this uses unchanged.

---

## 1. The one rule that governs everything

> ### `county_template` (1300890) is **never written to** by this process.
>
> Not a tag, not a setting, not a page. It is read-only for the entire run. Every
> write targets a duplicate. A run that touches 1300890 has failed, regardless of
> what else it achieved — stop and roll back.

Guard it mechanically, not by intention: the apply step must refuse any target
whose pattern id is `1300890`, and the run's manifest must be asserted free of
template section ids **before** the first write.

## 2. What snaps, what is preserved, what is left alone

**The default is snap.** An earlier draft of this skill inverted that — it named
five settings to snap and left everything else alone. That was wrong, and the
symptom was visible: after a run that reported 474 successful writes, the hazard
hero cards on a duplicate still did not match the template, because `size`,
`border`, `rowspan`, `title` and section order were never in the set.

A duplicate is a *copy* of the template. Every setting that describes **how a
component is configured, bound, shaped and placed** comes from the template. The
preserve list is short, closed, and consists only of things the county itself owns.

### 2a. Snap — take the template's value

| Group | Settings |
|---|---|
| **Requirement / access** | `tags`, `authPermissions` |
| **Binding** | `element-type`, source binding, `columns[]` **and the source snapshot together** (§2d), `display.fetchMode`, `display.readyToLoad` |
| **Scoping** | non-geoid filter leaves; the *structure* of geoid leaves (§3) |
| **Shape** | `size`, `level`, `border`, `offset`, `rowspan`, `group` |
| **Presentation** | every `display.*` key except the cached ones in 2b — grid sizes and gaps, padding, borders, colours, `compactView`, `cardStyle`, `showAttribution`, `hideSection`, pagination |
| **Labelling** | `title`, `hideInView` |
| **Position** | the component's index in the page's `draft_sections` (§2e) |

### 2b. Preserve — the duplicate's value always wins

| Setting | Why |
|---|---|
| **Authored text** (`element-data.text`) | **Never altered under any circumstance.** The county's own narrative. Overwriting one destroys work that cannot be regenerated. |
| **Geoid filter values** | The duplicate must keep pointing at its own county. See §3. |
| **Cached dataset rows** (`element-data.data`) | Data, not config, and stale by nature. |
| `display.totalLength`, `display.loadMoreId` | Per-instance fetch bookkeeping, not settings. |

Everything not in 2b snaps. If a new `display.*` key appears that is genuinely
per-instance state, add it here — do not add exceptions to 2a.

### 2c. Nullish values are not deviations

`null`, `undefined`, `""` and `[]` all mean *unset* in this data, and the two
patterns disagree about which one they store. Comparing them raw reports work
that does not exist: on the first wide measurement, 43 of 43 `tags` "deviations"
were `"" vs null`, and 111 `display.hideSection` "deviations" were `null vs false`.

**Normalise nullish to a single sentinel before comparing.** `false` and `0` are
real values and must not be folded in. Skipping this step inflates the scope by
roughly 6× and produces a run full of no-op writes.

### 2d. `columns[]` and the source snapshot travel together

The admin's *metadata out of date* badge diffs `element-data.columns` against the
component's **own** source snapshot. Copying the template's `columns[]` into a
target whose snapshot is an older generation therefore **manufactures badges**.

This is not hypothetical: the 2026-09-01 Schenectady run healed drift on 40
components and *created* it on 26 (+37 columns) for exactly this reason.

**Snap the snapshot in the same write as the columns.** They are one setting.
`verify_snap.mjs` fails the run if columns move without it.

### 2e. Order is a page-level write

Section order lives in the **page's** `draft_sections` array, not in the
component row. Snapping it means rewriting that array — the only page-level write
in this skill, and the one with the widest blast radius. It is also what the hero
card complaint actually was: 942 of 1,737 paired components sat at a different
index than their template sibling.

**The rule.** Order the paired components as the template orders them. For a
component the duplicate has and the template does not (§4 exempt, but it still
needs a place), **re-anchor it after the paired component that currently precedes
it** in the duplicate. That keeps local additions next to the content they were
added to explain, rather than herding them to the end.

Local-only components on a reorder page are a real quantity — 118 of them across
18 pages on Schenectady — so this rule is load-bearing, not an edge case.

**Monotonic is not the same as correct.** Checking that the paired components,
read in the duplicate's order, are monotonic in the template's rank says nothing
about where the *unpaired* ones land between them. Hurricane passed that check
with its four rebuilt hero cards sitting below Overview instead of above it.
Verify the full rendered sequence, and spot-check a landmark — comparing the
Overview card's index across all 16 hazard pages caught it immediately.

**Measure reordering by rank, never by raw index.** Comparing a component's index
in the template against its index in the duplicate counts *offset* as
reordering: one extra component near the top of a page shifts every index below
it. That mistake inflated the first measurement of Schenectady from 5 genuine
moves on flooding to 55, and from a few dozen page-wide to 942. The honest test is
whether the paired components, read in the duplicate's order, are **monotonic in
the template's rank**. Flooding needed 5 moves, not 55.


## 3. The geoid rule

This is the subtlety that makes a naive snap wrong.

Almost every geoid filter leaf carries `usePageFilters: true`, so the stored value
is a **seed** the domain overrides at render time. But the seeds are not uniform,
and the owner's position (2026-09-01) is that a stored geoid *should* reflect its
own county — deferred, but not accepted as wrong.

So a geoid leaf has two separable parts:

```
{ "col": "geoid_juris",   <-- STRUCTURE: comes from the template
  "usePageFilters": true, <-- STRUCTURE
  "searchParamKey": "geoid", <-- STRUCTURE
  "value": ["36093"] }    <-- VALUE: stays the duplicate's
```

**Transplant the structure, keep the value.** Where the template filters on a
different column than the duplicate — 9 pairs are `geoid_juris` → `geoid_county`,
6 are `geoid_juris` → *no leaf at all* — the template's column is correct and the
duplicate's own geoid value must be carried across to it.

**If the duplicate has no value to carry** (the leaf does not exist there), write
the template's leaf **structure** and carry the template's value with it. The
owner ruled on 2026-09-01 that "the shape of that filter is what's important —
making sure sibling components have the same filter settings and search param
keys"; a stored geoid that names the wrong county is a known, accepted, deferred
condition, and almost every such leaf carries `usePageFilters: true` so the domain
overrides it at render time anyway.

**Flag every row where this happens.** It is the one case where the snap leaves a
value that is knowingly wrong, and the deferred "geoids should reflect their own
county" fix will need the list. 6 components on Schenectady took a `geoid_juris`
leaf this way on 2026-09-01.

**The mirror case: the template has no such leaf.** Where the duplicate filters
on a geoid column the template dropped, the leaf goes. Structure comes from the
template in both directions. Verified on flooding 2026-09-02: component 2439922
carried `geoid = ["36105"]` — Sullivan County, in a Schenectady pattern — against
a template sibling with no bare `geoid` leaf at all. The value was inherited at
duplication, never authored, and was scoping the component to the wrong county.

A post-write assertion must therefore compare geoid values **only for columns the
template still has**. Asserting that every geoid value survives will fail this
legitimate case.

## 4. Exemptions — never edited

- **Components not present in `county_template`.** 302 rows in the current
  catalogue. The template has no opinion about them, so there is nothing to snap to.
- **Pages not present in `county_template`** — e.g. `auth_test_page`,
  `the_risk/natural_hazards/flooding_dup`, and Nassau's two extra sections.
- **Anything the catalogue could not pair** (`Match tier = unmatched`, 185 rows).
- **Tier C — the leftovers.** Tiers A and B both fail when the template
  *rebuilds* a component: the rebuild mints a fresh trackingId (defeating A) and
  shifts draft order (defeating B). The duplicate is then left holding the
  previous generation with no link to its replacement, so the snap skips it and
  the reorder treats it as local. That is how Schenectady's rebuilt hurricane
  hero cards ended up rendering *above* the Overview card they belong under, on a
  run that otherwise verified clean.

  `pair_leftovers.mjs` pairs the leftovers on a page by **element type + source,
  in draft order**. It found 51 pairs on Schenectady, lifting paired components
  from 1,737 to 1,788. It is a weaker inference than A or B — on a page holding
  several components from one source it pairs by sequence alone — so **print the
  pairs and have them reviewed before writing.** In practice most were the only
  component of their source on their page.

- **`Match tier = B` rows require review before writing.** Matched by
  position rather than trackingId (132 rows); 13 of them carry deviations. Tier B is sound —
  it is what reconciles a component the template rebuilt — but it is an inference,
  and an inference should not write unattended. See §5 step 3.

## 5. Phase 1 — snap the settings

**One duplicate at a time, start to finish.** Do not run two counties in
parallel and do not interleave them. A duplicate is finished only when its
verification gate (Step 6) has passed; only then is the next one started, and
starting it is a decision the owner makes, not the run.

Within a duplicate, **run one page first and have the owner look at it.** The
wide snap rewrites the whole component row, so the first page is the proof that
the deny-list is right — not that the writes returned success. On Schenectady
that page was `the_risk/natural_hazards/flooding`, and it was the right choice
because it carries the hazard hero cards, the v1 components, and county
narrative all on one page.

### Step 1 — build the catalogue

The pattern set is user-defined: scan the template first, then each duplicate.
Every downstream column is derived from whatever scans you pass, so adding a
county is one more `scan_pattern.mjs` call and one more argument.

```bash
cd planning/mitigateny/skills/scripts/report_fixes
export DMS_HOST=https://dmsserver.availabs.org DMS_APP=mitigat-ny-prod DMS_TYPE=prod
export DMS_AUTH_TOKEN=...            # see authenticating-the-dms-cli.md

node scan_pattern.mjs 1300890 $W/scan_template.json    --settings --sub county_template
node scan_pattern.mjs 2447995 $W/scan_schenectady.json --settings --sub schenectady_draft_test
node scan_pattern.mjs 2436065 $W/scan_nassau.json      --settings --sub nassautest

node pair_patterns.mjs $W/groups.json \
     $W/scan_template.json $W/scan_schenectady.json $W/scan_nassau.json

# tier C — REQUIRED, and reviewed before anything is written (section 4)
node pair_leftovers.mjs $W/groups.json $W/groups_c.json \
     county_template schenectady_draft_test | tee $W/tierc_pairs.txt

node build_component_catalog.mjs $W/groups_c.json \
     ../../../../src/themes/mny/design/reports/pattern-component-catalog.csv
```

Placeholder set: `county_template` 1300890, `schenectady_draft_test` 2447995,
`nassautest` 2436065.

- **The template must be the first scan passed to `pair_patterns.mjs`** — that
  argument position is what makes it the source of truth.
- **`pair_leftovers.mjs` is not optional.** Skipping it does not fail loudly — it
  silently leaves the components the template rebuilt unpaired, so they are
  neither snapped nor positioned, and every later check still passes. That is how
  the Schenectady run reported clean while the hurricane hero cards rendered above
  Overview. Run it on every duplicate, and run it **before** the first apply, not
  after.
- Tier C pairs are an inference: **print them and have the owner review the list**
  before applying. `pair_leftovers.mjs` writes the pairs to stdout for exactly
  this. One pattern deserves particular attention — several components of the same
  source on one page, where the match is by sequence alone.
- Everything downstream (`apply_wide.mjs`, `verify_wide.mjs`,
  `build_component_catalog.mjs`) then runs against `groups_c.json`, not
  `groups.json`.
- `--settings` is opt-in on `scan_pattern.mjs`. Without it the output is exactly
  what `match_patterns.py` already consumes, so existing callers are unaffected.
- `--sub` stamps the subdomain, which becomes the catalogue's per-domain
  `Section ID (…)` / `Link (…)` columns.

### Step 2 — freeze the run

Copy the catalogue into the run folder. The run is driven by that frozen copy,
never by a regenerated one — the patterns move under you, and a mid-run rebuild
renumbers what you are working from.

### Step 3 — select and triage

Take rows where `Domain = all` **and** `Deviation count > 0` — 417 rows in the
current catalogue, 404 tier A and 13 tier B.

Then, per row, reduce the deviation list to the §2a set. A row whose only
deviations are `config shape` + `snapshot generation` has **nothing to snap** and
drops out.

Triage gates before anything is written:

1. **Tier B rows** — confirm each is the same slot. Its members share kind and
   source but not trackingId; that is the template-rebuild signature, and it is
   also what a coincidence would look like.
2. **Rows where `County-authored = TRUE`** — 93 of the deviating rows. Confirm the
   planned write touches no `text` key.
3. **Rows with a `geoid filter` deviation** — 41. Apply §3 by hand or with an
   explicit value-carry step; never by copying the template's leaf.

### Step 4 — baseline, apply, validate

`apply_wide.mjs` does one page at a time, dry run unless `--apply`:

```bash
node apply_wide.mjs $W/groups.json county_template schenectady_draft_test      the_risk/natural_hazards/flooding $W/wide-flooding          # dry run
node apply_wide.mjs ... --apply
```

Per component: baseline the row to disk → build the merged row (template
wholesale, §2b carried back over it) → write with `--data <file>` → read back →
assert authored text, cached rows, page ownership and template-present geoid
values are all unchanged. Then the page's `draft_sections` is reordered per §2e
and read back.

`run_all.mjs` drives it across every shared page and writes a per-page log plus a
`SUMMARY.txt`. Run it dry first; the dry run is a complete inventory of what will
change.

**Then flag the pages.** `apply_wide.mjs` writes sections, and a section write
does not mark its page dirty — 40 of 57 Schenectady pages still read
`has_changes: false` after 1,167 section writes, so the admin showed them as
clean with unpublished edits sitting in the draft. `set_haschanges.mjs` walks the
baselines the run wrote and sets the flag on every page it touched. It is part of
the run, not an afterthought.

**Watch for a large payload.** Two components on `home` carry ~1.8MB and ~1.4MB
of element-data. The write lands, but the read-back that follows it can fail and
be recorded as a failure. Confirm against a fresh read before treating one as
unwritten.

Order the run **one pattern at a time, one page first.** Do not open with a
54-page batch across three patterns.

### Step 5 — re-run the catalogue and diff

The proof is that the deviation disappeared from a **fresh** read, not that the
write returned success. `verify_wide.mjs` re-reads both patterns live and asserts
all four conditions of §8 at once:

```bash
node verify_wide.mjs $W/groups.json county_template schenectady_draft_test $W/wide-all
```

**Compare settings key by key.** Serialising a `display` object whole and
comparing the strings is key-order sensitive: two components with identical
settings stored in a different key order read as deviating. That produced 31
phantom findings on flooding before the verifier was fixed.

### Step 6 — verify the duplicate, then stop and prompt

A duplicate is not finished when its writes succeed. Before the next county is
started, confirm on the fresh catalogue that:

- every targeted row now reads `identical`, **and**
- **no row that read `identical` before now reads anything else** — this is the
  unanticipated-consequence check, and it is the one that matters;
- the counts for the untouched classes are unchanged: `config shape`,
  `snapshot generation`, `title`, `hidden-from-view`;
- `County-authored` rows still carry their `Authored text status`;
- no geoid value moved to another county's code;
- the pattern-level totals moved only in the expected direction.

Then **stop and ask the owner whether to start the next duplicate.** The run does
not roll on to the next county by itself. If anything above is off, report it and
hold — a second county compounds a mistake before it is understood.

## 6. Phase 2 — components the duplicate is missing

Phase 1 only touches components that exist on both sides. A component the
template has and the duplicate does not is a different kind of change: it is an
**insertion**, not a setting write, and placement cannot be inferred safely.

**Phase 2 never runs unattended.** For each missing component, present the owner
with:

- the component: title, kind, source, and its `Link (county_template)`;
- **where it would go** — the page, and the neighbours it would sit between in
  the duplicate's own draft order, named by title rather than index;
- what it would carry: the template's settings, with §2b preserved and §3 applied
  to any geoid leaf;
- whether the duplicate's page structure makes the position unambiguous, and if
  not, say so.

Then take an explicit decision per component: **insert here / insert elsewhere /
skip**. Do not batch a default.

Two reasons this cannot be automated from the catalogue alone:

- **A missing component may be deliberate.** The duplicate was made at a point in
  time and the county may have removed something on purpose.
- **Order is not a position.** The duplicate's draft order differs from the
  template's wherever sections were added or removed — hazard pages run 70 vs 74
  sections — so "insert at index N" is meaningless without the neighbour context.

Phase 2 is out of scope until Phase 1 has completed cleanly on at least one
duplicate.

## 7. Write mechanics

- **Use the CLI, not the admin UI.** An admin save does far more than change the
  setting: it migrates v1 → v2, re-binds the source snapshot, reseeds empty page
  filters from the editor's current URL, recomputes `totalLength`, and adds
  `join: {"sources":{}}`. All verified. For a snap you want the minimal write.
- **`element-data` is a JSON string** — parse, set one key, re-serialise.
  `apply_element_data_key.mjs` does exactly this and asserts the payload is
  stringify-canonical before writing.
- **`--set` breaks on large payloads.** A ~70 KB `element-data` exceeds the
  Windows command-line limit and fails with `ENAMETOOLONG` *before* spawning, so
  nothing is written. Use `--data <file>`, which is a **full replacement** of the
  row's `data` — round-trip every key verbatim and swap only what you intend.
- **`--set` runs `JSON.parse` on its value**, so a JSON-encoded string round-trips
  to a string. That is how `authPermissions` and `element-data` must be passed.
- **`authPermissions` and `tags` are row-level keys**, not inside `element-data`.
- **Re-derive scope from the server every run.** The patterns gain and lose
  components between sessions; a stale id list writes to dead rows.
- **`no-access` means a stale token**, not a permission problem. Re-mint before
  concluding anything — see the relationship doc §7.

## 8. Verification standard

A row is done when **all** of these hold:

- the targeted setting equals the template's value;
- `updated_at` is the only other leaf that moved;
- `element-data`'s every other node is byte-identical to the baseline;
- placement is unchanged — same page, same draft index, same section group;
- `element-data.text` is byte-identical to the baseline;
- any geoid leaf still carries the **duplicate's** value;
- pattern `1300890` appears nowhere in the run's write log.

A run is done when a fresh catalogue shows the targeted rows as `identical` and
no row that was `identical` before has become anything else.

## 9. Scale, as of 2026-09-02

Template vs `schenectady_draft_test`, **after** the 2026-09-01 settings run and
**with nullish normalised** (§2c). 2,027 logical components; 1,737 paired.

| Deviation | Rows | Note |
|---|---|---|
| **draft order** | 942 | page-level write, §2e — 21 of 55 pages |
| config shape (v1→v2) | 132 | now in the snap set |
| `display.*` shape keys | ~150 distinct rows | grid sizes, gaps, padding, borders, colours |
| `size` | 76 | |
| snapshot generation | 54 | travels with `columns[]`, §2d |
| `title` | 46 | 45 are the hazard hero cards the template blanked |
| `border` / `level` / `rowspan` | 30 / 16 / 16 | |
| filter shape | 15 | |
| `hideInView` | 5 | |
| `offset` | 2 | |

**Already at parity** after the settings run, and confirmed identical on all
1,737 pairs: `tags`, `authPermissions`, `display.fetchMode`, `columns[]`,
`element-type`, source binding, `group`, `bgColor`, `isCard`, and 48 further
`display.*` keys.

Netting out: **159 components need a row write** and **837 need only a
reposition**. 101 template-only components are Phase 2; 189 Schenectady-only
components are exempt, of which **118 sit on a page that needs reordering** and
must be re-anchored per §2e.

The headline number to carry into a run is therefore *not* the 996 components
that differ raw — it is 159 writes plus 21 page reorders.

### Outcome of the Schenectady run, 2026-09-02

54 pages plus flooding. **1,116 components needed a row write; 1,114 verified on
the spot and 2 confirmed by a later read; 75 repositioned; 0 reorder failures.**

Verified afterwards by `verify_wide.mjs` against live reads of both patterns:

| Assertion | Result |
|---|---|
| paired components still deviating | **4 of 1,737** |
| pages monotonic in template rank | **55 of 55** |
| authored text moved | **0** of 1,170 baselines |
| cached dataset rows moved | **0** |
| metadata-out-of-date, target | 280 components / 970 columns |
| metadata-out-of-date, template | **280 / 970 — exact parity** |
| components drifting worse than their template sibling | **0** |

The badge parity is the point of §2d. The earlier settings-only run had *created*
drift on 26 components by moving `columns[]` alone; snapping the snapshot with it
removed that entirely.

**The 4 stragglers are all one class:** a section that belongs to two pages with
different template siblings, so the second page's write overwrites the first.
Three are the `wind` / `lightning` / `tornado` shared sections (`fusion_category`
settles on `"wind"`); one is `Local Actions Database` (2437228) shared between two
`jurisdictional_annexes` pages. Not fixable by a per-page snap — the data model
allows one section to have two parents with conflicting truth. Report, do not
retry.

## 10. Decisions taken, and what is still open

**Settled 2026-09-01:**

| Question | Ruling |
|---|---|
| Components in the template but missing from a duplicate | **Phase 2** (§6). Prompt the owner per component with a proposed contextual location; never batch a default. |
| Per duplicate, or all at once? | **Per duplicate, sequentially** (§5). Verify the run, then prompt before starting the next. "For now" — revisit once the loop has proven itself. |
| Is `column set` safe to batch? | **Prove it on one page first** (§5), then batch within that duplicate. |
| What belongs in the snap set? | **Nearly everything.** 2026-09-02: "they absolutely join the snap set — I was actually under the impression that all or most component settings would be included." The set is now a deny-list (§2b), not an allow-list. Layout, `display.*`, `title`, `hideInView`, config shape, snapshot and section order are all in. |
| Does the snap reorder sections? | **Yes** (§2e), including the page-level `draft_sections` write. Local-only components re-anchor after the paired component that precedes them. |
| Geoid leaf the duplicate does not have | **Write the template's structure and value**, and flag it (§3). Shape matters; the value is a deferred fix. |
| Script location | **Committed** to `scripts/report_fixes/`: `scan_pattern.mjs --settings --sub`, `pair_patterns.mjs`, `pair_leftovers.mjs`, `build_component_catalog.mjs`, `apply_wide.mjs`, `verify_wide.mjs`. |
| Is tier C part of a run? | **Yes, always** (2026-09-02). It runs before the first apply, and its pairs are reviewed before writing. Discovering a rebuild after the fact means re-snapping and re-ordering pages that already verified clean. |

**Still open:**

1. **What closes a snap?** Publishing is a separate human decision and is not part
   of this process — every write lands in the draft.
2. **The 7 `review` rows** the catalogue cannot classify (6 `non-geoid filter` on
   hazard pages, 1 `hidden-from-view`). Each needs a ruling on whether the
   template or the duplicate is right before its class can be snapped.
3. **Whether a snapped duplicate should be re-snapped** after the template changes
   again, and on what trigger. The template is edited continuously; a duplicate
   drifts from the moment it is snapped.
