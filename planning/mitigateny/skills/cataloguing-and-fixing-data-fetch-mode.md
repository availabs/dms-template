# Cataloguing and fixing Data Fetch Mode across the county template

The third skill in the county-template fix family, and the first one where the **finding itself has to
be built** before anything can be fixed. Its siblings:

| Skill | Role |
|---|---|
| [`applying-report-fixes-to-a-live-site.md`](./applying-report-fixes-to-a-live-site.md) | the write-back loop — freeze → baseline → apply → validate. **Use it unchanged for the fix half of this work.** |
| [`propagating-county-template-changes-to-duplicates.md`](./propagating-county-template-changes-to-duplicates.md) | how a `county_template` fix reaches `suffolk_draft` / `schenectady_draft` / `delaware_draft`. **Use it unchanged for the propagation half.** |
| **this file** | how to inventory a *component setting* pattern-wide, decide what each component should hold, and turn that into a trackable report |

> **TL;DR** — `scan_fetchmode.mjs <patternId>` inventories every data component's stored fetch mode
> and its source; `build_fetchmode_report.py` renders the CSV / XLSX / HTML tracking report with a
> per-row recommended fix; then `apply_element_data_key.mjs --key display.fetchMode` writes it and
> `validate.mjs --attr element.element-data.display.fetchMode` proves nothing else moved.
>
> **Read §2b first.** A data component binds its source under `externalSource` (v2) *or*
> `sourceInfo` (v1), and half this template is v1. Selecting on one key cost a whole sweep its
> meaning — it reported "0 outstanding" over the half it could see.

```bash
export DMS_HOST=https://dmsserver.availabs.org DMS_APP=mitigat-ny-prod DMS_TYPE=prod
export DMS_AUTH_TOKEN=<mint per ../../../src/dms/skills/authenticating-the-dms-cli.md>

cd planning/mitigateny/skills/scripts/report_fixes
node scan_fetchmode.mjs 1300890 $W/scan_1300890.json          # every page of the pattern
python build_fetchmode_report.py --scan $W/scan_1300890.json \
       --out-dir ../../../../src/themes/mny/design/reports \
       --slug county-template-qa-t6-fetchmode \
       --subdomain-map 1300890=county_template,2249247=suffolk_draft,2304223=schenectady_draft,2323808=delaware_draft
```

---

## 1. What the setting is, and where it lives

`Section Settings > Data Fetch Mode` is a three-option select registered by the component's own
config:

| Stored value | UI label |
|---|---|
| `cache` | Cache (use preloaded data) |
| `smart` | Smart (fetch on change) |
| `force` | Force (always re-fetch) |

In the row it sits at **`data.element['element-data'].display.fetchMode`** — inside the
JSON-string payload, not beside `tags` at the top of `data`. That single fact changes how the fix
loop must be driven; see §6.

**Only four component configs register it**:
`ComponentRegistry/Card.config.jsx`, `spreadsheet/config.jsx`, `graph/config.jsx`,
`graph_new/config.jsx` — i.e. **Card, Spreadsheet and Graph**. `FilterComponent.config.js` and
`header.config.js` do not, and neither do the theme-registered `Header: MNY Data` and
`Footer: MNY Footer` (`ComponentRegistry/index.jsx:37-38`). So a Filter, a header or a footer can
bind a data source and still have no fetch-mode setting an author could ever change. They are **not** out of scope because someone
chose to exclude them; they are out of scope because the control does not exist. Report them
separately rather than dropping them, so "not in the catalog" and "cannot be set" don't look the
same.

### The fallback is the whole reason this finding exists

`dataWrapper/useDataLoader.js:245-249` — **read the current source, not this quote's earlier form**
(see the box below):

```js
const fetchMode =
    // isEditMode ? 'smart' : // doesn't fetch in edit mode and shows stale cached data
    (state?.display?.fetchMode ?? (state?.display?.readyToLoad === true ? 'smart' : 'cache'));
const readyToLoad = isEditMode || (isValidState && (fetchMode !== 'cache' || state?.display?.allowEditInView));
const bypassDedup = fetchMode === 'force';
```

> **The `isEditMode ? 'smart'` short-circuit is COMMENTED OUT** (checked 2026-09-01). Earlier
> versions of this skill and of the T6 task file quoted it as live, and concluded that the setting
> was inert in the admin's edit view. It is not: **edit mode honours the stored `fetchMode` like any
> other mode.** That strengthens the owner's rule rather than weakening it — the authors who edit
> these six datasets are working *in* edit mode, which is exactly where they must see their own
> change. Two follow-ons: `readyToLoad` is now *derived* (`:248`) rather than read raw, so
> `fetchMode: 'cache'` no longer suppresses loading when `allowEditInView` is set; and a stale quote
> of a one-line policy is enough to invert a conclusion, so re-read `:245-249` before reasoning from
> either document.

With `fetchMode` absent the behaviour is decided by **`readyToLoad`**, a different setting entirely.
So an unset component is already behaving as Smart wherever `readyToLoad` is true — invisibly, and
only by accident. Two consequences:

- **Always report the stored value and the resolved behaviour as separate columns.** A row can read
  "not set" and still behave correctly; a row can read "not set" and silently never re-query. Judge
  a *fix* against the stored value (that is the thing missing) and *risk* against the resolved one.
- `readyToLoad` also gates loading entirely (`:248`), so it is not safe to treat as noise. The scan
  captures it.

### What `force` actually changes at runtime — and why navigating cannot show it

`force` does exactly one thing beyond `smart`: `bypassDedup = fetchMode === 'force'` (`:249`), which
skips the load effect's dedup guard `if (!bypassDedup && fetchKey === lastFetchKeyRef.current) return;`
(`:265`). So it re-queries where `smart` would reuse what it already has.

**`lastFetchKeyRef` is a per-mount `useRef`.** A freshly mounted component's ref is empty, so the
first load always happens — under `smart` exactly as under `force`. The dedup guard therefore only
bites when the effect *re-runs inside one mount* with an unchanged `fetchKey`, driven by its own
dep array (`:306`: `fetchKey, readyToLoad, bypassDedup, isValidState, hasLocalFilters, localFilters,
gatedOnRequiredFilter`).

The consequence for verification is the part worth knowing before you design the check: **no amount
of navigating between pages distinguishes `force` from `smart`**, because every arrival is a fresh
mount and both fetch. Measured on `county_template` 2026-09-01, `the_plan/jurisdictional_annexes`
in `/edit/` with its Spreadsheet stored `force` (falcor `POST /graph`, XHR — **wrap
`XMLHttpRequest.prototype.send`, not `fetch`**, or you will count only analytics beacons and
conclude nothing loads):

| | falcor `/graph` calls |
|---|---|
| idle 10 s on the page, settled | **0** |
| SPA-navigate away to `capabilities_assessment` | 30 |
| SPA-navigate back — components remount | 11 |

Two results, one negative and one positive:

- **`force` is not a re-query storm.** Zero calls in ten idle seconds, so the effect is not
  re-running on every render, and the page-load cost of `force` is one query per mount — which is
  what the owner's narrowing (§3) already priced in.
- **Mount-level observation cannot certify the setting.** It shows the component queries and renders,
  not that it queries *where smart would not have*. Isolating that needs a controlled A/B — flip one
  component `force → smart`, re-measure, flip back (the write path is minimal and `rollback.mjs`
  makes it reversible) — or a synthetic harness that re-runs the effect with a fixed `fetchKey`.
  **Do not report a remount count as proof the fix works.**

---

## 2. What makes a source "external" or "internal"

The author-facing signal is the bracketed suffix in the source picker. It is composed at
`useDataSource.js:438-443`:

```js
const envLabel = srcEnv?.includes('+') ? srcEnv.split('+')[1] : envs[srcEnv]?.label;
return { key: source_id, label: `${name}${envLabel ? ` [${envLabel}]` : ''}` };
```

and the two datasource kinds come from `render/spa/utils/index.js:208-246`:

| | `type` | `isDms` | `srcEnv` shape | picker suffix |
|---|---|---|---|---|
| DAMA source via a pgEnv | `external` | absent/false | `hazmit_dama` | **`[external]`** |
| DMS-managed dataset in the app | `internal` | `true` | `<app>+<instance>` | **`[<instance slug>]`** |

> **The asymmetry is a trap.** External components really do read `… [external]`. Internal ones read
> the **instance slug** — on `county_template` that is `[test_meta_forms]`, `[test-meta-forms]` or
> `[prod]`, never the literal word `[internal]`. Anyone eyeballing the picker for `[internal]` will
> conclude there are none. **Classify on `externalSource.isDms`, not on the label text**, and print
> the composed label alongside so a human can still recognise what they see on screen.

Two more things the scan exposes that are worth reading before deciding anything:

- **The same datasets are reached through three different env strings** — `test_meta_forms` (273
  components), `test-meta-forms` (71) and `prod` (10) all resolve to internal sources. Underscore and
  hyphen variants of one instance. Harmless for classification (`isDms` is true in all three) but a
  real inconsistency in the template.
- **`hideInView: true` components still bind sources.** 61 of the in-scope 486 never render, so their
  fetch mode has no runtime effect today. Whether to set them anyway is an owner decision, not a
  derivable one — flag the column and ask.

---

## 2b. Two config shapes — the mistake that cost this sweep its denominator

`migrateToV2.js:203-226` is the authority, and it is the first thing to read before writing any script
that inspects `element-data`:

| Shape | Marker in the stored row | Migrated at mount by |
|---|---|---|
| **v2** (canonical) | `externalSource` | returned as-is |
| **v1** (legacy) | `sourceInfo`, or `dataRequest` | `migrateV1ToV2` — `sourceInfo` → `externalSource`, `dataRequest.filterGroups` → `filters` |
| **v0** (pre-2024) | `attributes[]`, or `format` | v0 → v1 → v2 |

`dataWrapper/index.jsx:220` runs `migrateToV2` on every mount, so **all three render correctly and
none of them is broken**. That is exactly why the split is invisible until a script goes looking for
one key.

**What went wrong.** The first `scan_fetchmode.mjs` selected data components with
`if (!edObj.externalSource) return;`. On pattern 1300890 that dropped **584 of 1,125** components
before any rule was applied, and the sweep it drove closed as *"99 in scope, 99 correct, 0
outstanding"* — a true statement about the v2 half and a silent one about the other. The finding came
from a parallel QA read (`county-template-qa-draft.html`, Tier 1 finding 1, 2026-08-31); the scanner
now selects on `externalSource || sourceInfo` and stamps `configShape` on every record.

Four things worth carrying forward:

- **`display.fetchMode` is shape-independent.** `migrateV1ToV2` copies `display` across verbatim,
  stripping only `RUNTIME_DISPLAY_FIELDS` (`filteredLength`, `invalidState`, `hideSection`). So a v1
  component honours the setting exactly as a v2 one does, `apply_element_data_key.mjs` writes it
  without caring, and **the rule, targets and write path all survive the correction unchanged**. Only
  the census was wrong. Say that plainly when reporting it, or the rebuild reads as a re-litigation
  of the fix.
- **Prefer `externalSource` when a row has both.** `getData.js:226` does
  (`state.externalSource ? state : legacyStateToBuildInput(state)`), so a scanner that picks the other
  one would classify against a snapshot the runtime ignores.
- **One comment in the library says the opposite and is wrong.**
  `patterns/admin/.../pagesEditor.utils.js:142` reads *"sourceInfo is canonical in live data;
  externalSource is the v1/legacy field"*. Its `sourceInfo || externalSource` fallback still reads
  both, so nothing downstream of it is wrong — but do not take it as the definition. `migrateToV2.js`
  and `getData.js` are.
- **A count that does not name the shapes it covered is not yet a count.** Every artefact this skill
  produces now carries a `Config shape` column, and the report's provenance block marks any scan taken
  before 2026-09-01 as v2-only.

Two side effects of looking properly, both real rather than regressions:

- **The no-control set grew 11 → 69.** `Header: MNY Data` (36) and `Footer: MNY Footer` (22) bind
  sources, 58 of the 69 in v1. They are theme components registered at
  `ComponentRegistry/index.jsx:37-38` and expose no `Data Fetch Mode` control, so they stay in the
  appendix — visible, not fixable by an author.
- **The deferred sheet grew 409 → 915.** Same narrowing, a much larger population. Deferred still
  means deferred.

## 3. The rule, and why it is directional

Owner direction (2026-08-28):

| Source class | Target | Reasoning |
|---|---|---|
| external | `smart` | DAMA content changes on a publication cycle. Smart re-fetches when the query changes and otherwise reuses the cache — cheap, and stale only within a cycle. |
| internal | `force` | A DMS dataset is edited by the same authors browsing the site. They must see their own edit, so re-query every mount. |

This means a **stored `smart` on an internal source is still a fix**, not a pass. Encode
"already correct" as *stored value equals the target for this row's class*, never as "stored value is
not null" — 46 of `county_template`'s internal components were explicitly `smart` and all 46 need
changing.

### The rule is not the scope — `force` costs a query per mount

Applied to every internal component, the rule produced **457 outstanding writes**. That is not a
finish line to sprint at: `force` re-queries on **every mount**, so each component set to it is
page-load cost, and a page carrying thirty of them pays thirty times. The owner narrowed it on
2026-08-28 to the datasets an author actually edits and expects to see change — six of the ten
internal sources, on the pages already under review. **63 writes.**

`build_fetchmode_report.py` takes two **opt-in** filters, so an old command line still reproduces the
old whole-pattern document:

```bash
--source-allow Actions_Revised,Hazards_of_Concern,Jurisdictions,Roles,Participation,Capabilities_Catalogue
--page-allow-from ../../../../../src/themes/mny/design/reports/county-template-qa-t5-requirements-v2.xlsx
--page-allow-sheet 'T5 fixes (draft IDs)'     # + --page-allow-column / --page-allow-value
```

Three things to get right when you narrow a catalog:

- **Defer, don't drop.** An excluded component keeps its `Fix ID` and gains a `Scope reason`, in its
  own XLSX sheet and an HTML appendix grouped by reason. "We chose not to fix this" and "we never
  looked at it" must not read the same — the same principle §4 already applies to components with no
  control at all. It also means widening the scope later is a rebuild, not a renumbering.
- **Silence in an allow-list means out, not in.** The page allow-list here covers 42 of the pattern's
  59 pages. Defaulting the unlisted 17 *in* would quietly re-admit exactly the pages the narrowing
  excluded. Record it as a policy in the task file, because it is one — those pages were not assessed
  and found irrelevant, they were not assessed.
- **Narrowing does not un-write what is already written.** Eight components written before this
  narrowing fall outside it. The owner's call was to leave them; the report says so in the machine-
  owned `Recommended fix`, never in `Notes`, which is carried forward across rebuilds and belongs to
  the owner.

---

## 4. Building the catalog

`scan_fetchmode.mjs` is a sibling of `scan_pattern.mjs`, not a replacement:

| | `scan_pattern.mjs` | `scan_fetchmode.mjs` |
|---|---|---|
| reads `element-data` | **no** — identity and order only | **yes** — that is where the setting is |
| output shape | `{pages: {slug: {sections: [...]}}}`, for the alignment ladder | flat, one record per component, for a report |
| default scope | the slugs a report tab names | **every page in the pattern** |
| selects a data component by | n/a — it takes every section | `externalSource` **or** `sourceInfo` — both config shapes (§2b) |

The default scope differs because T6 is a *pattern-wide* finding: the setting exists on every data
component, not only on the pages some earlier report happened to list. Omit `--kinds` on a first run
and read the `elementTypeCensus` **and `configShapeCensus`** in the output — that is how you learn
what kinds and what shapes actually exist before deciding what is in scope. A scan whose output has
no `configShapeCensus` was taken with the pre-2026-09-01 scanner and covers v2 only; rescan rather
than reason from it.

Then `build_fetchmode_report.py` writes three artefacts into
`src/themes/mny/design/reports/`:

- **`.csv`** — the machine-readable catalog, `utf-8-sig` so Excel opens it cleanly.
- **`.xlsx`** — two sheets (`Fetch mode - fixable`, `No fetch-mode control`), frozen header,
  auto-filter, and empty `Status` / `Assigned to` / `Date fixed` / `Notes` columns. This is the one
  the owner triages in, exactly as with the T5 tab.
- **`.html`** — a self-contained report with the rule stated up front, per-pattern summary tiles, a
  client-side filter (search / class / kind / fix / hide-hidden), rows grouped under page headings
  that collapse when a filter empties them, and the out-of-scope appendix.

Both scripts take several `--scan` arguments, so once the duplicates are scanned the same command
produces one document covering all four patterns, keyed by `Pattern ID` — the same column the T5 tab
uses, for the same reason.

### Reconciling against the parent finding

`County Template QA`'s `T6-001` says **609** data components; the first T6 scan found **497** (486 in
scope + 11 with no control); the both-shapes rescan of 2026-09-01 finds **1,125**. Do not assume any
of them is wrong. The 609 was taken on 2026-08-19 against **published** section ids with a wider
element-type net, and the template has been edited since — including the 61 removals from the T5
sweep. The 497 is draft ids, **v2 only** (§2b). The 1,125 is draft ids, both shapes. Restate the
numbers and say which population each one counts, rather than silently replacing one with another —
that habit is what made the v1 gap findable at all.

---

## 5. Fix ID scheme

The parent finding already owns `T6-001` in the QA workbook, so the per-component rows must not reuse
that series:

- `T6-C001` … `T6-C486` — in scope, fixable.
- `T6-X001` … `T6-X011` — binds a source, no control.
- A `Parent finding` column carries `T6-001`, so the report joins back to the QA workbook.

Row key across patterns is `(Fix ID, Pattern ID)`, and the `Fix ID` is **reused verbatim** for a
duplicate's matching row — same convention as the T5 tab, same reason (see the propagation skill).

---

## 6. Applying it: the nested-key write path

`apply.mjs` drives `dms section update <id> --set <attr>=<value>`, which merges into the **top level**
of `data`. `fetchMode` is not there — it is inside `element['element-data']`, which the CLI passes
through as an opaque string precisely so that content is never re-serialised. So
`--set-from "tags=Requirement"` has no equivalent for this setting, and

> **`--set element-data=…` would rewrite the whole payload.** Every Card config, lexical body and
> column list in it would be re-serialised by a different writer than the one that produced it. That
> is exactly the failure the T5 loop was built to prove *didn't* happen (all 165 payloads
> byte-identical). Do not do it.

The write path therefore needs a **targeted nested-key update**: parse `element-data`, set
`display.fetchMode`, re-serialise, and assert in validation that the only leaf that moved is
`data.element.element-data.display.fetchMode` (plus `updated_at`). `validate.mjs` already parses
`element-data` before diffing (`fix_lib.diffLeaves`), so it can express that assertion today — the
gap is on the apply side only.

That script now exists: **`apply_element_data_key.mjs`**, alongside the rest of the loop. Nothing was
added to `src/dms`.

```bash
node baseline.mjs $RUN/baseline --from-csv $RUN/rows.csv
node apply_element_data_key.mjs $RUN --key display.fetchMode      --value-from "Target fetch mode" --dry-run
node apply_element_data_key.mjs $RUN --key display.fetchMode --value-from "Target fetch mode"
node mark_page_changed.mjs $RUN
node validate.mjs $RUN --attr element.element-data.display.fetchMode
```

It carries every refusal `apply.mjs` has (no baseline, not a draft section, live drift, no-op) plus
three of its own, and writes the **full current `data` object** through
`dms section update --data <file>` — a file, not inline JSON, because these payloads run to 30k
characters. Whether `dms data edit` replaces or merges is irrelevant for that shape: the object
supplied *is* the row's current `data` with one key changed, so replace and merge land the same
result.

### What makes it provable rather than merely careful

These payloads are `JSON.stringify` output, so **`JSON.stringify(JSON.parse(s)) === s` holds
byte-for-byte**. The script asserts that canonicality *before* writing and **refuses the row if it
fails**. That refusal is the whole safety story: without it, re-serialising could silently reformat
30,000 characters and no leaf-level diff of the parsed form would ever reveal it. Then it strips the
key back out of the new string and requires the result to equal the original exactly — which catches
a reordered key, a re-encoded unicode escape, a number that round-tripped to a different literal.
After the write it re-reads and asserts the stored string is byte-identical to the one it computed,
and that the attribute is **still a string**.

A useful sanity signal: setting `display.fetchMode` to `force` on a payload that lacks the key adds
**exactly 20 characters** (`,"fetchMode":"force"`) every time. A different delta means something else
moved.

### `validate.mjs` needed no change

Its `--attr` is interpolated as `data.<attr>`, so a **dotted path addresses a nested leaf directly**:

```bash
node validate.mjs $RUN --attr element.element-data.display.fetchMode
```

`fix_lib.diffLeaves` already parses `element-data` before diffing, so the leaf shows up as
`data.element.element-data.display.fetchMode` and the PASS criterion — that leaf plus `updated_at`,
nothing else — works unmodified. The loop always supported nested *assertions*; only the write side
was missing. Passing the bare `--attr element-data` fails with `data.element-data did not change`,
which is confusing but correct: it is looking for a top-level attribute of that name.

---

## 6b. The report is a snapshot of a moving pattern — pin the Fix IDs

`Fix ID`s are assigned by enumeration order. That is fine for one build and dangerous for the second,
because **other staff add and remove components between scans**. Measured on 2026-08-28: a rescan
taken a couple of hours after the first found the pattern had grown from 58 pages / 497 data
components to **59 / 519**, and rebuilding would have **renumbered 193 of 497 rows** — after the owner
had already begun working from those ids.

`build_fetchmode_report.py` therefore does three things on every rebuild:

- **`--id-ledger <file>`** maps `"<patternId>:<sectionId>" → Fix ID` and is read before assigning and
  rewritten after. Ids become append-only: a component keeps its id forever, and new components get
  the next free number. **Always pass it.** The ledger for this report lives at
  `scripts/report_fixes/ledgers/t6-fetchmode-ids.json`.
- **Refuses to overwrite** if any `Fix ID` in the existing CSV now points at a different
  `Draft section ID`, listing the remaps. `--no-carry` overrides, and should be a stated decision.
- **Carries `Assigned to` and `Notes` forward** from the existing CSV, so a rebuild refreshes the
  machine-derived columns without discarding triage.

Two traps found while building this, both worth knowing before you seed a ledger from an existing
report:

- **Reserve ids from the report, not just from the ledger's values.** A component shared between two
  pages occupies **two report rows but one ledger entry**, so seeding the reserve set from ledger
  values alone frees those ids and hands them to newly-added components. That is exactly what
  happened — 4 ids were re-minted on the first attempt (`county_template` shares four data components
  between `lightning` and `wind`; see the T5 task's shared-section item).
- **A shared component legitimately yields one Fix ID on two rows.** That is the truthful reading —
  one component, one fix, listed under each page it appears on — so the builder *reports* the
  duplicates rather than treating them as an error. The row is still uniquely addressable by
  `(Fix ID, Pattern ID, Page)`.

  **But that key is the report's, not the loop's** — and the distinction is worth reading in full at
  [`applying-report-fixes-to-a-live-site.md` §0b](./applying-report-fixes-to-a-live-site.md).
  `Draft section ID` *is* the database row id and there is exactly one such row; `Pattern ID` is
  identical on both report rows, so no extra key column disambiguates a write target. A write targets
  a **row**, so the loop must collapse to the row: dedupe `rows.csv` by `Draft section ID` and assert
  `rows == distinct ids`. Letting the pair through means the second row is `REFUSED` as drift — the
  write is fine, but the run has then raised its own stop-everything alarm against itself.

---

## 6c. Pairing a duplicate's components with the template's

The T6 report covers all four patterns in one document keyed by `Pattern ID`, and a duplicate's row
**reuses the template's `Fix ID`** (§5) so the review sheet joins across patterns. That pairing is
`match_fetchmode_patterns.py`, which emits an id-ledger fragment
(`{"<patternId>:<sectionId>": "T6-Cnnn"}`) to merge into `ledgers/t6-fetchmode-ids.json` before
building.

**It is not `match_patterns.py`.** That one reads `scan_pattern.mjs` output, which lists every
section on a page — what the T5 alignment ladder needs. `scan_fetchmode.mjs` lists only *data
components*, so the anchors for neighbour alignment are sparser. Same three tiers, plus two this
work forced:

| Tier | Key | 2026-09-01, per duplicate |
|---|---|---|
| **A** | `trackingId`, scoped to the page | 756 / 841 / 842 |
| **A2** | `trackingId` + `elementType` + `title` + `sourceId` | 123 / 130 / 130 |
| **B** | neighbour alignment, single candidate each side | 56 / 56 / 56 |
| **C** | identical page structure — same `(elementType, sourceId)` sequence | 14 / 13 / 13 |
| **D** | `elementType` + `title` + `sourceId`, ignoring `trackingId` | 4 / 2 / 1 |
| — | page absent from the template | 86 / 44 / 44 |
| — | unresolved | 18 / 7 / 8 |

### `trackingId` is NOT unique within a page — the propagation skill's primary key is weaker than stated

The sibling skill says *"`trackingId` is the primary key, and it is not sufficient"* because
duplication sometimes mints a fresh one. That understates it. Measured on `county_template`:
**208 data components across 25 pages share a `trackingId` with a sibling on the same page.**
`the_plan/about_the_process` has **five** Cards — `Overview`, `The Planning Process`,
`Local Resources`, `Adoption`, `Maintenance` — all on `bc9f47b0-63f2-46ac-b1d0-5e6b361942b4`.
Verified against the live rows, not inferred from the scan. Duplicating a section in the admin UI
copies its `trackingId`.

So a naive `trackingId` → component map resolves those five arbitrarily. Scope the lookup to the
page, and when a group has more than one candidate, **disambiguate on
`(elementType, title, sourceId)` rather than picking one** — those line up across patterns
(template 1515010 `Overview` → suffolk 2381013 `Overview`). That converted ~200 collisions per
pattern into 123–130 tier-A2 matches and left only 15–18 genuinely ambiguous.

**Worth re-checking the T5 propagation against this.** Its tier A matched 874 rows on `trackingId`;
if it used a page-wide or pattern-wide map without a tie-break, some of those 874 could be
mis-paired. Not verified here — flagged, not claimed.

### Element type is not enough for tier B or C — match the source too

Both tiers originally accepted a candidate on `elementType` alone, which is what the T5 ladder does
because it is matching *identity*. A fetch-mode report is matching *a fix*, and the bound source
decides both the recommended value and whether the row is in scope. On
`the_risk/natural_hazards/hurricane` the page order had diverged, and the ladder paired the
template's `Hazards_of_Concern` Card with the duplicates' `AVAIL - Fusion Events V2` Card —
**one `Fix ID` meaning two different fixes in two patterns** (T6-C289 / T6-C290).

It was 3 of 1,037 cross-pattern pairings, so the audit is what found it, not the symptom:

```
Fix IDs spanning >1 pattern : 1034
  with mismatched sources   : 0      # was 3
  with mismatched kinds     : 0
```

**Run that audit every time** — group the built CSV by `Fix ID` and assert one source name and one
component kind per group. A 99.7%-correct join is still a review document with three wrong rows in it.

### Close the identity before you trust the inventory

Per-pattern in-scope counts legitimately differ. What must reconcile is *why*:

```
suffolk     139 = 141 template - 5 absent + 3 duplicate-only   OK
schenectady 139 = 141 template - 4 absent + 2 duplicate-only   OK
delaware    140 = 141 template - 4 absent + 3 duplicate-only   OK
```

If that does not close, the matcher is wrong, not the patterns. Enumerate the absent and
duplicate-only rows and read them: a mirror-image pair (the same title showing as "absent from the
duplicate" *and* "no template counterpart") is a matcher near-miss, and tier D exists because of
exactly that signature.

---

## 7. Order of work

1. **Scan and report** `county_template` — done 2026-08-28.
2. **Owner confirms the rule *and separately* the scope.** Do not treat agreeing the rule as
   agreeing to apply it everywhere — see §3. Here the narrowing arrived after the first page was
   already written.
3. ~~**Agree the write path** (§6).~~ Done — `apply_element_data_key.mjs`.
4. **Apply to `county_template`**, a page or two first, then widen. Confirm in the browser that a
   Force component really re-queries — the setting is only worth writing if the behaviour changes.
4b. **Before calling a pattern complete, prove the catalog covered it.** Re-scan and check the shape
   census, not just the outstanding count. On 2026-09-01 `county_template` went from "0 outstanding"
   back to **41** on exactly this check (§2b). A sweep is done when the *population* is settled, not
   when the rows in hand are all green.
5. **Scan the three duplicates**, match with the propagation skill's ladder, recompute each row's
   recommended fix **against the duplicate's own stored value** (an internal component may already be
   `force` there), append to the report keyed by `Pattern ID`.
6. **Apply per duplicate**, one pattern at a time.

Steps 5–6 are the T5 propagation, unchanged. Nothing about fetch mode makes the mapping problem
different — `trackingId` is still the primary key and still insufficient.

---

## 8. Worked example — `county_template` (pattern 1300890), 2026-08-28

> **Every number in this section is v2-only** — it is the build that missed the v1 half (§2b). Kept
> as written, because the runs it describes are still correct and their doctrine still holds; see
> §8d for the corrected population.

Scan: 58 of 58 pages, 1,338 sections carrying no `externalSource` (not data components), **497 data
components**.

| | Count |
|---|---|
| in scope (Card 347, Spreadsheet 102, Graph 37) | **486** |
| no fetch-mode control (Filter 10, `Header: MNY Data` 1) | 11 |
| external → Smart | 142 |
| internal → Force | 344 |
| **writes needed** | **445** — 399 where nothing is stored, 46 changing a stored `smart` |
| already correct | 41 (39 internal `force`, 2 external `smart`) |
| hidden from view | 61, all internal |

Stored versus resolved, which is the point of the finding:

```
stored    : not set 410 · smart 48 · force 39      (of 497, incl. the 11 with no control)
resolved  : smart  451 · force 39 · cache  7
```

**All 7 that resolve to `cache` are Filters or the Header** — none of the 486 fixable components is
actively stuck on cache today. That is the good news worth stating plainly: this sweep is about
making the template's intent explicit and correcting 46 wrong-but-deliberate values, not about
repairing 445 broken components. Saying so is what stops the number being read as an outage.

Seven distinct external sources (`AVAIL - Fusion Events V2` alone accounts for 107 components) and
ten internal ones (`LHMP_IA` 140, `Actions_Revised` 99). A per-source view is therefore a much
shorter work-list than a per-component one, if the owner prefers to sweep by source.

### First application — `the_local_environment/built_environment`, 2026-08-28

Run `2026-08-28-t6-built-env`. Scope: the nine rows the owner named (`T6-C002`…`T6-C010`), restricted
to **internally sourced** components, target `force`.

**8 writes, 8/8 verified, 0 unexpected leaf changes** — every write moved exactly
`data.element.element-data.display.fetchMode` and `updated_at`, every payload came out **+20
characters**, and an independent audit re-derived the verdict from the live site at **9 of 9 correct**
(including the held row confirmed untouched).

Three things this run established that are now doctrine:

- **A named row can contradict the rule it arrives with.** `T6-C009` (2011202, `Historic Buildings`)
  is on that page and was in the owner's list, but its source is `BILD 2026 Simplified Draft V1
  **[external]**` — so the rule makes it Smart, and the run's own scope excluded it. It was **held,
  not written**: left in `rows.csv` with an empty value column so the run records a deliberate
  non-write instead of a silent omission. Check every named row's class against the rule before
  writing; do not let an enumeration override a policy.
- **Prove a new write path on one row first.** `T6-C002` was applied and validated alone in a
  `proof/` sub-run before the other seven. The main run then `REFUSED` it as drift — correctly, since
  the drift was the proof write. Expect that, and read it as the guard working rather than a problem
  to force past.
- **Re-scan before rebuilding, and expect the pattern to have moved.** See §6b.

### Second application — the three planning-process pages, 2026-08-28

Run `2026-08-28-t6-plan-process`, and the first under the narrowed scope.
`the_plan/about_the_process`, `the_plan/capabilities_assessment`,
`the_plan/jurisdictional_annexes/select_jurisdiction`: **14 writes (10 SET, 4 CHANGE), 14/14 PASS, 0
unexpected leaf changes**, 4 rows held as already correct, **independent audit 18 of 18**.

Two things it added to doctrine:

- **The `+20 chars` signature only applies to a SET.** `,"fetchMode":"force"` is what an *absent* key
  costs. A `smart → force` change is **+0** — the two strings are the same length — which looks like
  a missing write and is not. Read the delta against the *shape* of the change, not against a
  constant.
- **An audit that has only seen one shape of change will mis-report the first new one.** The
  built-env `audit.mjs` flagged **8 of 18 WRONG** here, and all 8 were its own bugs: it hard-coded
  that run's single shape, expecting a held row to read `null` (these were held *because already
  `force`*) and proving minimality by **deleting** the key (correct for a SET; impossible for a
  CHANGE, where the baseline *has* the key). Both now read the pre-run state from
  `baseline/<id>.json` instead of assuming it: minimality means **restore the key exactly as the
  baseline had it** — absent if absent, its old value if it had one — and require the payload back
  byte-for-byte. Copy forward `fix-runs/2026-08-28-t6-plan-process/audit.mjs`, not the built-env one.

  The failure was loud, which is the right direction — but a false alarm and a bad write cost the
  same verification cycle to tell apart. When a run introduces a change *shape* the audit has never
  seen, generalise it before running it, not after.

- **Verify the run against the whole pattern, not just its own rows.** A rescan diffed against the
  pre-run scan showed **exactly the 14 sections moved, none added, none removed**. The per-row proof
  says each write was minimal; only a whole-pattern diff says the run did not touch anything it never
  mentioned.

### Third application — the 17 natural-hazards pages, 2026-08-28 (closes `county_template`)

Run `2026-08-28-t6-natural-hazards`. 81 in-scope components, **49 writes (16 SET, 33 CHANGE), 49/49
PASS, 0 unexpected leaf changes**, 32 held as already correct, **independent audit 81 of 81**, and a
whole-pattern rescan whose moved set was **identical to the run's target set**. That leaves
`county_template` at 99 in scope / 99 correct / 0 outstanding.

The run added no new failure mode, which is itself the point: the corrected `audit.mjs` handled all
three shapes (SET, CHANGE, held-because-already-correct) unchanged, because it derives the pre-run
state from `baseline/<id>.json` instead of assuming the run's shape.

One check to repeat every time, though:

- **Dedupe the run's rows by section id before baselining.** A section shared between two pages
  legitimately produces **two report rows and one `Fix ID`** (§6b). The loop keys on section, so the
  second row would write, then hit the drift refusal its own first write caused. Here `81 rows / 81
  distinct ids` came out clean only because every shared section on those pages is `LHMP_IA` and the
  narrowing excluded it. That was luck. Assert the counts match before you baseline.

### Fourth application — the 41 v1/v2 remainder, 2026-09-01 (closes it over both shapes)

Run `2026-09-01-t6-v1-remainder`. Every row the rebuilt report marked `Yes - set` — **41 components
on 4 pages, 38 v1 · 3 v2**, all internal, all stored `(not set)`, target `force`. **41 writes, 41/41
PASS, 0 unexpected leaf changes**, all **+20 chars** (no CHANGEs in this run), 19 held as already
correct, whole-pattern rescan moved **exactly the 41 targeted sections**. The report now reads
**141 in scope / 141 correct / 0 outstanding** — the first time that is true of both shapes.

- **The v1 write path is proven, and needed no code change.** T6-C568 / 2380934 went alone through a
  `proof/` sub-run first: a genuine v1 payload (`sourceInfo` + `dataRequest`, no `externalSource`,
  8,342 chars, `display` ending in the runtime-only `hideSection`). Canonical before the write,
  byte-identical read-back, minimality proven by stripping the key out and getting all 8,342
  characters back. Exactly what `migrateV1ToV2` copying `display` verbatim predicted — now measured.
- **A better way to handle the proof row than eating a drift refusal.** The built-env run left its
  proof row in the main `rows.csv` and let apply `REFUSE` it as self-inflicted drift. Cleaner: clear
  its `Target fetch mode` and write the reason into the **run's** `Notes`. Apply says `SKIPPED`,
  validate says `NOT WRITTEN`, the row stays visible instead of vanishing. The cost is that
  `audit.mjs` reports it `WRONG` — it expects `target || baseline value`, and for a held row that is
  the *pre-proof* value. **Leave that un-special-cased**: an audit taught about a run's bookkeeping
  is no longer independent of it. Report it as `59/60 main + 1/1 proof = 60 of 60`.
- **A cross-check that contradicts two live re-reads is the cross-check's bug.** The whole-pattern
  diff was first written against `fetchMode`; `scan_fetchmode.mjs` emits **`storedFetchMode`**. Every
  record read `undefined`, and the diff reported the precise inverse of the truth — *122 components
  moved off `force`, none of the 41 targets moved* — while `validate.mjs` and `audit.mjs`, both
  re-reading live rows, said 41/41. The scan's own census (`v1/force: 38`) was the tell. Read one
  record's field names before diffing a scan.
- **Excel holds an exclusive write lock on an open `.csv`.** The rebuild died with `PermissionError`
  on the CSV while the `.xlsx` and `.html` wrote fine. Copy the existing trio to a temp dir and build
  *there* — building into an empty dir would silently lose the `Assigned to` / `Notes` carry-forward
  and the Fix-ID stability check, which both read the previous CSV in `--out-dir`.
- **`hideInView` grew from 1 row to 8 with the v1 correction.** Open item 4 dismissed it as "one row
  is not worth an owner decision"; eight is still not a blocker, but the dismissal was made about a
  different number. Re-put a moot-ed item to the owner when the correction that reopened the census
  changes its size.

### The duplicate inventory — 2026-09-01, all four patterns in one document

Scanned `suffolk_draft` 2249247, `schenectady_draft` 2304223 and `delaware_draft` 2323808 with the
both-shapes scanner, paired them to the template with §6c, and rebuilt the report over all four
patterns. **4,326 rows; 319 writes outstanding across the three duplicates** (`county_template` 0).

| Pattern | rows | in scope | already correct | SET | CHANGE | **writes** |
|---|---|---|---|---|---|---|
| `county_template` 1300890 | 1,082 | 141 | 141 | 0 | 0 | **0** |
| `suffolk_draft` 2249247 | 1,057 | 139 | 34 | 69 | 36 | **105** |
| `schenectady_draft` 2304223 | 1,093 | 139 | 33 | 70 | 36 | **106** |
| `delaware_draft` 2323808 | 1,094 | 140 | 32 | 73 | 35 | **108** |

**114 distinct fixes, 99 of them on all three duplicates** — the cross-pattern `Fix ID` is what makes
that readable. Writes split v1 197 / v2 122; sources `Jurisdictions` 109, `Hazards_of_Concern` 106,
`Capabilities_Catalogue` 81, `Actions_Revised` 11, `Roles` 6, `Participation` 6; 23 are hidden from
view; **0 are external** (the narrowing excludes them, so every write is internal → `force`).

Four things this inventory established:

- **A duplicate is not behind by the number of writes the template took.** Each needs ~105 where the
  template took 41 today and 63 in August. They were forked when the template held ~35 `force` and
  ~36 `smart`, so they carry that snapshot: **every stored value in all three duplicates is v2, and
  every v1 component is unset** (suffolk `v1/not set` 913 of 913). The v1 blind spot was not a
  template-only problem — it is the shape most of the fleet is stored in.
- **`CHANGE`s reappear.** The template's remainder run was 41 SETs; the duplicates carry 107
  `smart → force` changes between them. Those are **+0 chars**, not +20 — the signature trap from the
  plan-process run, which the audit must derive from `baseline/<id>.json` rather than assume.
- **The template's defects were duplicated, as the propagation skill predicts.** All three have their
  own shared `lightning`/`wind`/`tornado` sections (33 `Fix ID`s now appear on two pages), and all
  three still have `flooding_dup` (43 components each) that the template no longer has. **Dedupe by
  section id before baselining each run.**
- **There is a fourth duplicate nobody has mentioned.** `MitigateNY_Nassau_V2` **2407262**
  (subdomain `nassau`, type `mitigateny_county_template_v3_copy`) is a fork off the same template:
  1,055 data components, **141 in narrowed scope, 36 already `force`, 105 writes** (68 SET, 37
  CHANGE; v1 65 / v2 40). Deliberately left out of the report — the owner scoped this to three — but
  the number is here so admitting it is a decision, not a discovery. **Check `dms pattern list` for
  new forks before calling a fleet-wide sweep complete**; the registry in the propagation skill was
  written before this one existed.

### The rebuild that reopened it — 2026-09-01, both config shapes

`county_template` was closed on 2026-08-28 at *99 in scope / 99 correct / 0 outstanding*. A parallel
QA read (`src/themes/mny/design/reports/county-template-qa-draft.html`, Tier 1 finding 1) reproduced
that figure exactly and then showed what it was a figure *of*: the v2 half of the pattern. Rescanning
with `externalSource || sourceInfo` (§2b) gives the corrected population.

| | v2-only build (28 Aug) | both shapes (1 Sep) |
|---|---|---|
| data components in the pattern | 519 | **1,125** — v1 584 · v2 541 |
| in scope after the narrowing | 99 | **141** — v1 38 · v2 103 |
| already correct | 99 | **100** — all v2 |
| **writes outstanding** | **0** | **41** — v1 38 · v2 3, every one a SET |
| deferred out of scope | 409 | 915 |
| bind a source, no control | 11 | 69 — Header 36, Footer 22, Filter 11 |

The outstanding 41 sit on four pages: `the_plan/jurisdictional_annexes/select_jurisdiction` (34),
`the_plan/capabilities_assessment` (5), `the_plan/jurisdictional_annexes` (1),
`the_risk/natural_hazards/hurricane` (1). Rebuild was clean — **515 prior rows matched, Fix IDs
stable**, ledger 515 → 1,120 assignments — because the ledger had been there since 6b.

Four things this rebuild established:

- **The split is near-total, and that is the evidence.** All 100 already-correct rows are v2; 38 of
  the 41 outstanding are v1. If the gap were authoring recency you would expect a date signature
  instead, and the QA pass checked: `created_at` on the unset components spans the same
  June 2025 – August 2026 range as the fixed ones. A near-perfect correlation with a *storage shape*
  is a tooling artefact, not a content story.
- **Say plainly what did and did not change.** The rule, the targets, the write path and all three
  applied runs survive untouched; only the census was wrong. A rebuild that does not say so reads as
  a re-litigation of work that was in fact correct.
- **Expect the pattern to have moved, again.** The QA read of 31 Aug counted the same in-scope 143
  but split it 99/42; this build reads 100/41. Twenty-two in-scope sections were edited on
  31 Aug – 1 Sep, and three of the outstanding rows (2418307, 2418422, 2418453,
  `Local Capabilities Table`) are **new v2** components that did not exist on 28 Aug. Reconcile
  against `updated_at` before assuming a discrepancy is a method difference (§6b).
- **The v1 write path is untested.** `apply_element_data_key.mjs` sets `display.fetchMode` without
  branching on shape, and its canonicality assertions are shape-agnostic in principle — but no v1
  payload has ever been through it, and `audit.mjs` has never read a `sourceInfo` baseline. Prove one
  v1 row in a `proof/` sub-run before the other 37, exactly as the built-env run did for v2.
