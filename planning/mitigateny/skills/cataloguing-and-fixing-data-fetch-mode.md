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
> per-row recommended fix; then the ordinary fix loop applies it with
> `--set-from "display.fetchMode=..."`.

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

## 6. Applying it: one thing the fix loop cannot do yet

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

Until that exists, the honest options are: extend the fix-loop scripts with a nested-set flag, or
have the owner make the change in the admin UI and use the scan as verification. **Decide that with
the owner before writing anything** — a 445-write sweep is not the place to improvise a new write
path.

---

## 7. Order of work

1. **Scan and report** `county_template` — done 2026-08-28.
2. **Owner confirms the rule and the scope** — in particular the 61 `hideInView` components and the
   23 components on prototype/duplicate pages (`crit_infra_form_prototype`, `ho_c_form_prototype`,
   `actions_edit_list_dup`).
3. **Agree the write path** (§6).
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
