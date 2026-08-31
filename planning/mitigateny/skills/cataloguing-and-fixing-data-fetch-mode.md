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
`header.config.js` do not. So a Filter or a `Header: MNY Data` can bind a data source and still have
no fetch-mode setting an author could ever change. They are **not** out of scope because someone
chose to exclude them; they are out of scope because the control does not exist. Report them
separately rather than dropping them, so "not in the catalog" and "cannot be set" don't look the
same.

### The fallback is the whole reason this finding exists

`dataWrapper/useDataLoader.js:245-247`:

```js
const fetchMode = isEditMode ? 'smart'
  : (state?.display?.fetchMode ?? (state?.display?.readyToLoad === true ? 'smart' : 'cache'));
```

With `fetchMode` absent the behaviour is decided by **`readyToLoad`**, a different setting entirely.
So an unset component is already behaving as Smart wherever `readyToLoad` is true — invisibly, and
only by accident. Two consequences:

- **Always report the stored value and the resolved behaviour as separate columns.** A row can read
  "not set" and still behave correctly; a row can read "not set" and silently never re-query. Judge
  a *fix* against the stored value (that is the thing missing) and *risk* against the resolved one.
- `readyToLoad` also gates loading entirely (`:248`), so it is not safe to treat as noise. The scan
  captures it.

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

The default scope differs because T6 is a *pattern-wide* finding: the setting exists on every data
component, not only on the pages some earlier report happened to list. Omit `--kinds` on a first run
and read the `elementTypeCensus` in the output — that is how you learn what kinds actually exist
before deciding what is in scope.

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

`County Template QA`'s `T6-001` says **609** data components; this scan finds **497** (486 in scope +
11 with no control). Do not assume either is wrong: the older count was taken on 2026-08-19 against
**published** section ids and a wider element-type net, and the template has been edited since —
including the 61 removals from the T5 sweep. Restate both numbers and say which one the report is
built from, rather than silently replacing one with the other.

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
  `(Fix ID, Pattern ID, Page)`, and the fix loop handles the pair the way it always has: the first
  writes, the second is `REFUSED` as drift.

---

## 7. Order of work

1. **Scan and report** `county_template` — done 2026-08-28.
2. **Owner confirms the rule *and separately* the scope.** Do not treat agreeing the rule as
   agreeing to apply it everywhere — see §3. Here the narrowing arrived after the first page was
   already written.
3. ~~**Agree the write path** (§6).~~ Done — `apply_element_data_key.mjs`.
4. **Apply to `county_template`**, a page or two first, then widen. Confirm in the browser that a
   Force component really re-queries — the setting is only worth writing if the behaviour changes.
5. **Scan the three duplicates**, match with the propagation skill's ladder, recompute each row's
   recommended fix **against the duplicate's own stored value** (an internal component may already be
   `force` there), append to the report keyed by `Pattern ID`.
6. **Apply per duplicate**, one pattern at a time.

Steps 5–6 are the T5 propagation, unchanged. Nothing about fetch mode makes the mapping problem
different — `trackingId` is still the primary key and still insufficient.

---

## 8. Worked example — `county_template` (pattern 1300890), 2026-08-28

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
