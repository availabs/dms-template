# The county template and its duplicate patterns

How `county_template` relates to the per-county patterns copied from it, which
differences between them are **correct and must not be "fixed"**, and which are
the duplicate simply lagging behind.

Read this before comparing two MitigateNY page patterns, and before reporting a
difference between them as a defect.

**This is the "what does a difference mean" half.** The mechanics of matching rows
and pushing a fix across are already covered by
[`propagating-county-template-changes-to-duplicates.md`](./propagating-county-template-changes-to-duplicates.md)
— its **three-tier matching ladder** is the canonical matcher, and this file does
not replace it. Use that skill to align rows and apply changes; use this one to
decide whether an aligned difference should be changed at all.

**Status:** written 2026-09-01 from a full draft-section scan of `county_template`
(1300890), `schenectady_draft_test` (2447995) and `nassautest` (2436065). Figures
below are from that scan.

---

## 1. The model

`county_template` is the **master**. Every county pattern is a copy of it taken at
some point in time, after which the two diverge in three different ways that must
be told apart:

| Kind of divergence | Direction | Action |
|---|---|---|
| **Localisation** — geoid scoping, county narrative | by design | **leave alone** |
| **Lag** — the template has since been fixed | template is ahead | propagate template → duplicate |
| **Drift** — the duplicate was edited in a way the template wasn't | duplicate is ahead or wrong | judgement call; ask the owner |

The template is always the newest. **A duplicate showing an issue the template no
longer has is lag, not a new finding** — it is the same issue, already diagnosed,
awaiting propagation.

## 2. Finding the patterns

Pattern rows are `prod|<key>:pattern`. List them all with:

```bash
node src/dms/packages/dms/cli/bin/dms.js pattern list --format json
```

Pages and components live under types derived from the pattern's key:

```
<key>|page          <key>|component
```

| Pattern | id | key | subdomain |
|---|---|---|---|
| MitigateNY_County_Template_V3 | 1300890 | `mitigateny_county_template` | `county_template` |
| MitigateNY_Schenectady_Draft_Update_Test | 2447995 | `mitigateny_schenectady_draft_v2_copy` | `schenectady_draft_test` |
| MitigateNY_County_Template_Suffolk_copy | 2249247 | `mitigateny_county_template_suffolk_copy` | `suffolk_draft` |
| MitigateNY_Schenectady_Draft_V2 | 2304223 | `mitigateny_county_template_v1_copy` | `schenectady_draft` |
| MitigateNY_Delaware_Draft | 2323808 | `mitigateny_county_template_v2_copy` | `delaware_draft` |
| MitigateNY_Nassau_V2 | 2407262 | `mitigateny_county_template_v3_copy` | `nassau` |
| MitigateNY_Nassau_Update_Test | 2436065 | `mitigateny_nassau_v2_copy` | `nassautest` |

> **The key does not name the county.** `mitigateny_county_template_v1_copy` is
> Schenectady; `_v2_copy` is Delaware. Always resolve by pattern id or subdomain,
> never by reading the key.

> **Two patterns can share one key.** `mitigateny_county_template_copy` is used by
> both **2231616** (`westchester`) and **2275239** (`schenectady-draft-old`), so
> their pages and components share a type namespace. Scanning that key returns
> both patterns' rows mixed together. Check for this before scanning.

## 3. Only drafts matter

Work exclusively from `page.draft_sections`. In the template, draft and published
sections are **entirely separate rows with no id overlap** (1,767 draft vs 1,801
published, 0 shared ids) — publishing mints new component rows. Auditing both
double-counts everything and makes every trackingId look duplicated.

## 4. Pairing siblings

**Use the three-tier ladder in the propagation skill** (tier A `trackingId`,
tier B neighbour alignment, tier C page structure). What this scan adds is *why*
tier A alone is not enough, with numbers:

*Figures in this section were measured on the template ↔ `schenectady_draft_test`
pair; they characterise the key itself, not that particular duplicate.*

Copies preserve `trackingId`; component ids do not. **923 of the duplicate's 926
distinct trackingIds had a template counterpart — 99.7%.** But `trackingId`
identifies a **template slot, not a component instance** — one id is reused across
every page that clones the same slot:

```
e501e808  ×15   every hazard page, position #1
b5e7c5ed  ×15   every hazard page, position #3
b50f6b90  ×32   twice on each hazard page
```

So **`trackingId` alone pairs only 26 of 923 buckets unambiguously.** Qualify it
with the page `url_slug` — which the propagation skill already identifies as *"the
reliable join between patterns"* — and it becomes unique for **844 of 866** template
draft trackingIds (97.5%). The remaining 22 appear twice on the same page and need
the draft order rank, which is tier C's key by another name.

Restating the ladder in those terms: **tier A is `trackingId` + `url_slug`, not
`trackingId` alone.** Anything the pair still cannot separate falls to B and C.

## 5. Expected deviations — do NOT correct these

### 5a. Geoid scoping

**Almost every geoid filter leaf carries `usePageFilters: true`.** The stored value
is a seed the page/URL overrides at runtime, so **a stored geoid difference between
template and duplicate is meaningless where that flag is set.**

Values actually seen in storage:

```
template  : 36, 36105, 3610506310, 3610516661, 3610520104, 3610573627, 3699999
duplicate : 36, 36093, 3609321006, 3609351264, 36105, 3610506310, 3610573627, 3699999
```

`36105` is Sullivan (the template's seed county); `36093` is Schenectady. The
duplicate contains **both** — its own geoids where they were replaced, and template
leftovers where they were not.

**Owner ruling, 2026-09-01:** a stored geoid *should* reflect the county it sits
in, so a leftover `36105` in a Schenectady pattern is a real if latent
inconsistency — **but it is deferred, not accepted.** Practically:

- **Do not report it as a QA finding.** `usePageFilters` overrides the seed at
  render time, so nothing a reader sees is affected today.
- **Do not fix it ad hoc.** A one-off correction adds churn without closing the
  class, and the class spans every duplicate.
- **Do keep it visible.** The catalogue's `Geoid filters (tmpl)` / `(dup)` columns
  carry the stored values so the eventual sweep has its inventory ready.

Treat it the way the snapshot-drift class is treated: recorded, understood,
scheduled for its own pass.

Filter **column** signatures are identical on the overwhelming majority of
components (1,390 have no geoid leaf at all; the next 6 largest groups match
exactly). Only **42 of 1,730 (2.4%)** differ across the three patterns, in three
shapes — counts below are template ↔ `schenectady_draft_test`:

| Template | Duplicate | Rows | Reading |
|---|---|---|---|
| `substring(geoid,1,2) as state` | + adds `geoid[page]` | 15 | duplicate scopes tighter |
| `geoid_juris[page]` | `geoid_county[page]` | 9 | different granularity — **worth a look** |
| `geoid_juris[page]` | *(none)* | 6 | duplicate lost its scoping — **worth a look** |

The first is benign. The last two are structural and should be reviewed, because
they change which rows come back rather than just the seed.

### 5b. County-specific narrative — two types, in two different places

County words live in **two mechanically different places**, and conflating them
produces a detector that is mostly noise. Split them before comparing anything.

> **Neither type is ever a deviation.** A county filling its own narrative slot is
> the system working as designed. The catalogue reports both through
> `County-authored` / `County-specific text type` / `Authored text status` and
> **excludes them from `Deviation count` and `Deviations across patterns`
> entirely.** A component whose only difference is county narrative reads
> `identical`.

#### Type 1 — authored rich text (`element-data.text`)

A **titled** `lexical` component the template ships **empty**, for the county to
fill. The words belong to the component.

> Worked example: **`2438759`** "Executive Summary" on
> `schenectady_draft_test/the_local_environment` carries *"This is an executive
> summary specific to the county."* Its template sibling **`1458921`** is empty.

**281 slots** in the template match this shape; Schenectady has filled **46** of
them. Real county narrative shows up here — Hoffman's Fault on `earthquake`, the
Mohawk River on `natural_environment`, winter-storm frequency on `snowstorm`.

Two exclusions make this a slot test rather than a text test:

- **371 lexicals the template fills** are shared boilerplate, not slots.
- **42 untitled empty lexicals** are contentless shells, not slots.

Only **2 pairs** have authored text on both sides that differs, and both are
trivial drift in a shared "Page Guidance" block.

#### Type 2 — dataset-backed card (`element-data.data`)

A `Card` bound to **`Jurisdictions` — the county's own dataset** — rendering a
prose column (`description`). The words belong to the dataset row selected by the
page's `geoid_juris`, not to the component.

> Worked example: **`2439187`** "Executive Summary" on
> `select_jurisdiction?geoid_juris=3609363935` renders *"Here is some
> Rotterdam-specific text."* Its template sibling **`1348552`** is configured
> identically; only the cached row differs.

**54 components** match. Detect this **structurally — source plus column — never
from the cached text**, for the reason in the next section.

> **`LHMP_IA` is not county-authored.** It carries prose columns too
> (`narrative_or_reference`) on 149 components, and it is **state** narrative,
> permission-locked to `LHMP Template Editor` precisely so counties cannot edit
> it. A rule of "source-bound and has text" marks all 149 as county content and
> inverts the meaning. The discriminator is **which dataset owns the row.**

#### Cached dataset text is not evidence

`element-data.data` holds whatever rows were **last fetched and saved**, so it goes
stale and it does not track the page. Do not read a difference there as a content
defect. Demonstrated: searching for the sentence *"View MitigateNY's complete
&lt;hazard&gt; profile"* across the cached rows gives

```
page                  template cached   duplicate cached
earthquake            Earthquake        Avalanche
extreme_heat          Earthquake        Avalanche
hail                  Hail              Avalanche
snowstorm             Snowstorm         Snowstorm
```

The template's own `extreme_heat` page has an *Earthquake* sentence cached. That is
a stale cache, not a mislabelled hazard. **To judge dataset content, query the
dataset — never the component's cached copy.**

### 5c. Extra pages in the duplicate

The duplicate has pages the template does not, and this is normal:
`auth_test_page`, `the_risk/natural_hazards/flooding_dup`. 55 slugs are shared;
the template has no page the duplicate lacks.

### 5d. Page-filter ordering

`geoid|geoid_juris|hazard` vs `geoid|hazard|geoid_juris` — same set, different
order. Not a deviation.

## 6. Expected lag — propagate template → duplicate

These are the template's completed QA fixes that the duplicate has not received.
**Do not re-diagnose them; they are already understood.**

| Deviation | Rows | What it is |
|---|---|---|
| tags | 131 | 44 CFR 201.6 requirement tags applied on the template |
| config shape | 122 | v1 → v2 migration, a side effect of saving on the template |
| permissions | 100 | `LHMP Template Editor` lock on SHMP narrative |
| fetch mode | 81 | the Data Fetch Mode sweep |
| non-geoid filter | 68 | mixed — includes the Measures Inventory rebuild |
| column set | 52 | includes the deprecated-column removals |
| snapshot generation | 44 | source re-binds; ruled a non-issue by the owner |
| title | 45 | mixed localisation and lag |

Catalogue verdicts over the 2,011 logical components (three patterns):

| Verdict | Rows |
|---|---|
| identical | 1,336 |
| lag — propagate from template | 386 |
| not in every pattern | 281 |
| **review** | **7** |
| expected — localisation | 1 |

**Only 7 need a human decision** — 6 `non-geoid filter` differences on the hazard
pages and 1 `hidden-from-view` flip.

Note the deviation counts above **rise as patterns are added**, because a
deviation fires when *any* scanned pattern disagrees. Going from two patterns to
three took Tags 131 → 162, fetch mode 81 → 113, non-geoid filter 68 → 83.
A count is only comparable against a run over the same pattern set.

`expected — localisation` is nearly empty *because county narrative is not counted
as a deviation at all* (§5b). The 2 left are a geoid-filter or title difference
with nothing else alongside. **233 rows are `County-authored = TRUE` with zero
deviations** — county slots behaving exactly as designed, filled or waiting.

## 7. Scanning gotchas

- **`no-access` means a stale token, not a permission problem.** A duplicate's page
  rows returned the literal string `"no-access"` for `data` while its components
  read fine. Re-minting the token fixed it immediately. Re-mint before concluding
  anything about access — see
  [`authenticating-the-dms-cli.md`](../../../src/dms/skills/authenticating-the-dms-cli.md).
- **`data.parent` is not authoritative.** Cloned pages keep the *template's* page
  id. One duplicate "page" resolved to 6,111 components, and duplicate components
  still carry template page id `1450290`. Derive placement from the page's
  `draft_sections`, never from `parent`.
- **The `|page` length route can return 0 while rows exist.** That was the stale
  token. If it recurs with a fresh token, derive the page set from component
  `parent` refs — but treat the result as unreliable per the point above.
- **One malformed id 500s a whole `byId` chunk** (`Cannot read properties of null`).
  Filter ids to `/^\d+$/` and retry failures individually.
- **Source snapshots are per component.** Resolve columns against the live source
  row, never against the component's embedded copy.

## 8. Scan figures, 2026-09-01

| | `county_template` 1300890 | `schenectady_draft_test` 2447995 | `nassautest` 2436065 |
|---|---|---|---|
| pages | 58 | 58 | 55 |
| draft-attached components | 1,805 | 1,927 | 1,867 |
| buckets (trackingId + slug) | 1,660 | 1,772 | 1,716 |
| components carrying authored text | 371 | 424 | 372 |

Logical components after grouping: **2,011**

| Present in | Rows |
|---|---|
| all three | 1,730 |
| schenectady only | 109 |
| schenectady + nassautest | 88 |
| template + nassautest | 40 |
| template only | 35 |
| nassautest only | 9 |

**County authoring progress.** Of the 1,359 template-blank slots present in all
three patterns, **Schenectady has filled 46 and Nassau 0.** Nassau carries 372
authored-text components against the template's 371 — effectively untouched
boilerplate. The slot inventory is the same for both; only the fill rate differs.
Filter on `County-authored` + `Authored text status` to see it per county.

Full row-level catalogue:
[`src/themes/mny/design/reports/pattern-component-catalog.csv`](../../../src/themes/mny/design/reports/pattern-component-catalog.csv)

Its shape is built to take more duplicates without redesign:

- **one `Section ID (<subdomain>)` column per pattern** — add a pattern, add a column
- **every comparable setting is a single column**, holding the shared value if all
  patterns agree or the literal `DEVIATION` if not
- `Domain` = `all` when every scanned pattern has the component, else the ones that do
- `Page URL` is relative (`/edit/<slug>`), so it resolves against any subdomain
- `County-authored` is a boolean slot test, not a text comparison (§5b)

## 9. Open questions

1. **The `geoid_juris` → `geoid_county` and `geoid_juris` → *(none)*** shapes
   (15 pairs) — deliberate re-scoping in the duplicate, or lost scoping?
2. **Propagation order.** The T5 and T6 task docs track 465 tag writes and 189
   removals outstanding across three other duplicates; this scan covers only
   `schenectady_draft_test`, which is not one of them.
3. **The 9 `review` rows** — 8 are `non-geoid filter` differences on the hazard
   pages and `disaster_template`; 1 is a `hidden-from-view` flip. Each needs a
   look to say whether the template or the duplicate is right.
4. **Backburner: align stored geoid seeds to their county.** Deferred 2026-09-01
   (§5a). No user-facing effect while `usePageFilters` is set, but the stored
   values in every duplicate should eventually match the county they belong to.
   Needs its own pass across all duplicates, not per-component fixes.
