# Component QA prompt — data-binding hygiene

A reusable prompt for auditing configured DMS data components (`Spreadsheet`,
`Card`, `Graph`, `FilterComponent` — anything consuming `dataWrapper`) against
the source they are bound to.

**Scope:** binding hygiene only — is this component asking the source the right
question, using current columns, with filters that make sense where it sits?
Not layout, theming, copy, or accessibility.

**Design principle:** every check below is a *detector*, not a judgment. Checks
A and C are mechanical and should be run as sweeps producing tables — the tool
finds and tabulates, a human decides. Check B is the only one requiring
interpretation, and it is scoped to producing ranked suspicion, not verdicts.

**Status:** drafted 2026-08-17, validated against MitigateNY (app
`mitigat-ny-prod`, pattern 985070). Calibration numbers in the appendix.
Promote to `src/dms/skills/` after a second site.

---

## The prompt

> Audit the DMS components in **`<SCOPE>`** — a single component id, a page, or
> an entire pattern — for data-binding defects. App `<APP>`.
>
> If the scope is a page or a single component, state its editorial intent in
> one sentence (e.g. *"an all-hazards overview; no hazard is privileged or
> excluded"*). Check B needs it; A and C do not.
>
> Work from the **stored configuration**, and resolve every column against the
> **live source row** — never against the copy of the source embedded in the
> component. The component's embedded snapshot is frozen at bind time and is
> routinely years stale; trusting it is the single most common way this audit
> returns a false clean.
>
> Run checks A, B, C on any data-bound component; D and E additionally on any
> `Map` section; F as a cheap add-on. Report as specified. **Do not modify any
> DMS row.**
>
> Checks A, C, D and E are decided by **distribution across the pattern**, not
> by inspecting one component in isolation. Where a check says "the outlier is
> the finding", sweep first and read the outliers — a single component gives you
> no baseline to judge against.

---

## Setup

```bash
# Token: POST {API_HOST}/login {email, password, project: <APP>} -> user.token
# See src/dms/skills/authenticating-the-dms-cli.md (~6h TTL)

dms raw get <COMPONENT_ID>    # component
dms raw get <SOURCE_ID>       # LIVE source — the reference for A and C
```

For a pattern-wide sweep, enumerate `{app}+{patternInstance}|component`, then
batch-fetch the distinct `sourceInfo.source_id` values.

### Where things live

Component payload is `data.element["element-data"]`, a **JSON string** — parse it.

| Key | What it holds |
|---|---|
| `columns[]` | this component's columns: `name`, `type`, `show`, `display_name`, `customName`, `filters[]` |
| `sourceInfo` | **frozen snapshot** of the source: `columns[]`, `source_id`, `view_id` |
| `dataRequest` | compiled query: `filter`, `exclude`, `groupBy`, `orderBy`, `fn` |
| `display` | `pageSize`, `totalLength` (cached count), `usePagination` |
| `data` | cached page of rows |

Live source columns are at `data.config.attributes` — sometimes a JSON string
nested inside a JSON string; parse until you have an array. Each entry has
`name` (the raw column or full SQL expression), `type`, and `display_name`
(the human title shown in the columns menu).

**Matching columns:** normalize whitespace before comparing
(`String(name).replace(/\s+/g,' ').trim()`). Calculated columns are long SQL
expressions where incidental whitespace differs freely; naive equality fails.
Match on the full normalized name, not the trailing `as <alias>` — aliases are
not unique in practice.

**Three column lists, kept distinct:**

```
live source .config.attributes    ← the truth; resolve against this
        │  (frozen at bind time)
        ▼
element-data.sourceInfo.columns   ← the snapshot the editor UI diffs against
        │  (author-selected subset + overrides)
        ▼
element-data.columns              ← what this component renders
```

---

## Check A — metadata out-of-date flag

**Detect and tabulate. Do not classify severity and do not recommend fixes.**

The admin columns menu shows an amber "Metadata out of date" badge per column.
It is computed in
[`ColumnManager.jsx:346`](../../src/dms/packages/dms/src/patterns/page/components/sections/ColumnManager.jsx):
for each source column having a same-named state column, the badge appears if
any of these nine attributes differ:

```js
['type', 'required', 'display', 'defaultFn', 'dataType',
 'trueValue', 'options', 'mapped_options', 'meta_lookup']
```

**Do:** reproduce that comparison across the scope and output a table of every
component and column carrying the flag, with the drifted attribute names and
both values. One row per flagged column.

| Component | Title | Page / location | Source | Column | Drifted attrs | Stored → Live |
|---|---|---|---|---|---|---|

Run it twice and report both, because they answer different questions:

- **`element-data.columns[]` vs live source** — the columns actually rendered.
  This is what the badge in the UI reflects.
- **`element-data.sourceInfo.columns[]` vs live source** — the snapshot the UI
  *diffs against*. When this is stale the UI can under-report drift, so a
  component with no visible badges is not necessarily clean. Report the
  snapshot's column count vs the live count, columns present in one and not the
  other, and the total attribute-drift count.

Roll up at the end: components flagged / components scanned, and a
flagged-column frequency count by column name (a column flagged on many
components is a source-level change that never propagated).

**Explicitly out of scope for this check:** deciding whether a drift matters,
or whether to refresh. Note only that the admin's "Refresh Meta" action
overwrites author overrides on those same nine keys, so refreshing is not
unconditionally safe — that decision belongs to whoever reads the table.

---

## Check B — filters that don't fit their context

**Defect class:** a filter that made sense somewhere else. This is the dominant
failure mode of the copy-a-configured-component workflow: the filter travels
with the component and outlives the reason for it.

The goal is to surface **filters suspect of being relics** and rank them by
suspicion. Read both representations — the editor keeps them in sync, but a
stale row can disagree:

- `element-data.columns[i].filters[]` — `{ type: 'internal' | 'external',
  operation: 'filter' | 'exclude' | 'like', values: [...] }`
- `element-data.dataRequest.filter` / `.exclude` — compiled, keyed by full
  column name.

`type: 'internal'` filters render **only in edit mode**
([`RenderFilters.jsx:269`](../../src/dms/packages/dms/src/patterns/page/components/sections/components/dataWrapper/components/filters/RenderFilters.jsx)) —
they constrain what the public sees with no UI affordance and no way for a
visitor to notice or undo them. Every internal filter is an unstated editorial
assertion, so internal filters carry a higher burden of justification than
external ones by default.

### Relic heuristics

Ranked roughly by how reliably each has indicated a relic. Apply all; a filter
tripping several is high suspicion.

1. **Hard-coded literal row values.** The filter enumerates individual record
   labels (specific record names, place names, years) rather than constraining a
   category, type, or status column. Legitimate scoping is nearly always
   expressed against a classifying column; a list of individual rows is almost
   always someone patching a specific page's output by hand.
2. **Contradicts the page's stated intent.** An exclusion that removes a subset
   the page exists to present. Requires the one-sentence intent; this is the
   only heuristic that does.
3. **Propagated with informative exceptions.** The identical filter appears on
   many components bound to the same source — *and* the components lacking it
   share a property that explains why. The exceptions identify where the filter
   was authored and therefore where it legitimately belongs; everywhere else is
   copy residue. Report the exception set explicitly; it is the diagnosis, not
   a footnote.
4. **Dead column reference.** The filter's column no longer exists in the live
   source (renamed or dropped). The editor marks these with a red `stale` badge
   ([`ComplexFilters.jsx:261`](../../src/dms/packages/dms/src/patterns/page/components/sections/ComplexFilters.jsx)).
   Always a defect; only the cleanup priority is in question.
5. **Dead literal values.** The filter's values match nothing in the current
   data. Query the source and report the row count each value actually matches.
   Zero-match values mean the filter is either obsolete or was always wrong.
6. **Redundant against a sibling filter.** Another filter already constrains the
   result set such that this one removes nothing. Harmless today, but it is the
   fingerprint of a copy and it will be copied forward again.
7. **Variant drift.** Near-identical filters on sibling components that
   disagree in their value lists. Indicates independent hand-edits; there is no
   single correct value to restore, so these need an author decision rather
   than a mechanical fix. Flag as such.
8. **Empty stubs.** `values: []` or an empty `dataRequest.exclude` entry —
   inert, but records that a filter was once configured and then emptied.

### Output

One row per filter, across the scope:

| Component | Page / location | Column | Type | Op | Values | Heuristics tripped | Suspicion | Rows removed |
|---|---|---|---|---|---|---|---|---|

Suspicion: `high` / `medium` / `low`. State rows-removed as a number wherever
it can be computed — a filter that removes zero rows and one that removes half
the table warrant very different attention.

---

## Check C — deprecation-marked columns

**Rule: no component should be bound to a column whose title carries a
deprecation indicator. Any that is, flag for update.**

This is the most generalizable of the three checks because it needs no schema
knowledge and no page context — data stewards mark superseded columns in the
column title, and that marker is machine-readable.

**The mechanism that makes this non-obvious:** the marker lives on the **live
source's** `display_name`. The component stores its own copy of `display_name`,
captured at bind time, which still holds the *pre-deprecation* title. A
component bound to a column titled `"Category-Deprecated"` in the source will
show `"Category"` in its own config and in the rendered header. **Detection
must resolve every column against the live source row.** Scanning component
config alone misses nearly all of these.

**Do:**

1. For every column in `element-data.columns[]`, resolve the matching live
   source column by normalized name.
2. Test the live `display_name` against the marker patterns below.
3. Flag every match. No exceptions — a deprecation marker is the steward's
   explicit instruction, and the audit's job is to surface it, not to weigh it.

### Marker patterns

**Strong** — treat as confirmed, no human check needed:

```
deprecat        (matches "Deprecated", "-deprecated", " - deprecated", "(deprecated)", "Deprecate")
do not use / don't use
obsolete
retired
superseded
(delete)
```

**Soft** — flag separately as needing confirmation; these produce false
positives on legitimate column names:

```
\btest\b   \btmp\b   \bscratch\b   \blegacy\b   \bold\b   _v1\b
```

Markers are written inconsistently by hand — expect `-Deprecated`,
`-deprecated`, ` - deprecated`, `(deprecated)` on the same source. Match
case-insensitively on the substring, never on an exact format.

### Output

| Component | Title | Page / location | Section type | Source | Column | Live title | Stored title | Visible? | In a filter? | Marker tier |
|---|---|---|---|---|---|---|---|---|---|---|

Then roll up **by column**, sorted by usage count — this is the actionable view,
because one deprecated column typically has many consumers and they should be
migrated together:

```
<source> :: <column> ("<live title>")
  used by N components | rendered visible: N | used in a filter: N
  | stored title still shows the old name: N
  component ids: …
```

`Visible?` (`show === true`) and `In a filter?` are worth separating: a
deprecated column that is hidden and unfiltered is dead config to clean up,
while one that is rendered or drives a facet is actively serving wrong values
to users.

**Also report, as source-side findings** — these cause the recurrence and
cannot be fixed component-side:

- **Duplicate aliases** — two source columns emitting the same `as <alias>`,
  especially if their titles disagree (one marked deprecated, one not). Makes
  alias-based resolution ambiguous for every consumer.
- **Unmarked scratch columns** still in `config.attributes`. They leak into
  every component's column picker.
- **Deprecated columns with zero consumers** — safe to remove from the source.

### Coverage caveat

Report how many bound sources actually resolved to a parseable
`config.attributes`. Not every `sourceInfo.source_id` points at a DMS source
row with that shape (DaMa-backed and joined sources differ). Components on
unresolved sources are **unaudited, not clean** — list them.

---

## Check D — layers and views that render nothing

**Defect class:** the component is bound to the right data and still draws
nothing, because rendering depends on a chain of independently-stored settings
that can each drift out from under a correct binding.

Applies to `Map` sections most sharply, but the reasoning generalizes to any
component whose output depends on an asset fetched by URL.

**The signature to recognize:** *only the context layer draws.* A map that shows
county boundaries and nothing else has already proven that the container, the
basemap, the symbology wrapper and the render loop all work — so the thematic
layer's failure is isolated, and it is almost never the paint expression.
Suspect the transport first.

Rendering requires four things to agree, each stored separately:

1. **Transport** — `layer.sources[0].source`: either `tiles: ["…/{z}/{x}/{y}…"]`
   (a live tile route) or `url: "<protocol>://…"` (a pre-baked artifact), plus
   an optional `protocol` field.
2. **Renderer support for that transport** — a non-HTTP protocol only works if
   the renderer registers a handler for it.
3. **`source-layer`** on every sublayer, matching the layer name the transport
   actually emits.
4. **Paint columns present in the tile** — the runtime rebuilds `?cols=` from
   `data-column`, so every property a paint expression reads via `["get", …]`
   must be named there
   ([`SymbologyViewLayer.jsx:1592`](../../src/dms/packages/dms/src/patterns/page/components/sections/components/ComponentRegistry/map/SymbologyViewLayer.jsx)).

### Detection — all mechanical, no rendering required

1. **Tabulate transport kind across every layer in the pattern.** Group by
   `tiles` / `url`-with-protocol / neither. **The outlier is the finding.** A
   transport used by a handful of layers out of hundreds is a stale artifact
   from an older build convention, not a design decision. This single
   distribution is the highest-yield check in this section.
2. **Tabulate `source-layer` against the dominant convention** (here
   `view_{view_id}`). Same logic: outliers are findings. A mismatched
   `source-layer` renders nothing and emits no error.
3. **Probe the live tile route for the layer's `view_id`** —
   `…/tiles/{view_id}/{z}/{x}/{y}/t.pbf`, then again with
   `?cols=<data-column>`. Record status, byte size, and whether the paint
   column's name appears in the response. **This is the decisive split:** a 200
   with bytes and the column present means the data is fine and the defect is
   purely in the binding. A 204 means the view has no geometry and the problem
   is upstream. Never report "the map is broken" without this probe — the two
   cases have completely different owners.
4. **Confirm the renderer supports any non-HTTP protocol** the layer declares —
   search the codebase for a protocol registration (`addProtocol`) and for the
   protocol's client library in `package.json`. Absent both, the source can
   never load, no matter how healthy the artifact is. Probing the artifact URL
   is *not* sufficient evidence: an artifact can return 200 and still be
   unreadable because nothing is registered to read it.
5. **Cross-check paint against `data-column`** — collect every `["get", prop]`
   in each sublayer's paint and confirm each is in the comma-joined
   `data-column`. Missing ones fall out of the rebuilt `?cols=` and the feature
   draws in the fallback color.

### Output

| Component | Page | Layer | View | Transport | Live route probe | `source-layer` | Convention OK | Paint cols in `data-column` | Verdict |
|---|---|---|---|---|---|---|---|---|---|

Verdict: `renders` / `no data upstream` / `binding defect — data available`.
Call out any layer that is the sole site-wide user of a transport or naming
convention; that is a migration that was never finished.

---

## Check E — page-variable wiring completeness

**Defect class:** an interactive component that looks configured but doesn't
react, because its binding to the page's variables is half-written. The keys are
individually optional, so a partial binding saves cleanly and fails silently.

**Do not check against the documented spec.** Check against the **most complete
instance of the same component type in the same pattern** — that is the
platform's real convention, and it gives any fix a concrete template.

### Procedure

1. Enumerate every component of the type in the pattern and extract its binding
   config.
2. Rank by number of binding keys populated. The maximal instance is the
   reference; record its id.
3. Score every component against the reference and bucket into **fully wired /
   partially wired / unwired**.
4. Report the tier distribution. A large partial tier is a platform-level
   finding, not a per-component one.

### For `Map` sections, the binding keys are

| Key | Where | Effect when missing |
|---|---|---|
| `dynamic-filters[].column_name` | layer | no binding at all |
| `.searchParamKey` | layer | **binds to a page variable named after the tile column instead** — usually a variable that doesn't exist, so the filter never receives a value |
| `.values` / `.defaultValue` | layer | no fallback when the page var is empty |
| `.dataType: "numeric"` | layer | numeric tile properties don't coerce and never match |
| `.zoomToFilterBounds` | layer | no zoom-to-selection |
| `usePageFilters: true` | layer | authored and scripted layers disagree in the Map settings UI |
| `symbology.activeLayer` | symbology | zoom-to-filter is **active-layer scoped** — it reads only the active layer's `dynamic-filters`, so pointing it at the wrong layer disables zoom silently |
| `zoomToFitBounds` | component | map doesn't refit |

Two mechanisms worth stating explicitly in any report, because they explain most
partials:

- The binding key is **`searchParamKey || column_name`**. Omitting
  `searchParamKey` is not "use the default" — it silently rebinds the filter to
  a page variable named after the tile column. This is the single most common
  way a map appears wired and isn't.
- The Map **ignores `type: 'action'` page params** by design
  ([`map/index.jsx`](../../src/dms/packages/dms/src/patterns/page/components/sections/components/ComponentRegistry/map/index.jsx)),
  so a binding to a value published by another section's `_functions` can never
  fire. Bind to a URL/page-filter variable instead.

### Output

| Component | Page | Layers | Binding column | `searchParamKey` | `dataType` | `usePageFilters` | Active layer bound? | `zoomToFilterBounds` | `zoomToFitBounds` | Tier |
|---|---|---|---|---|---|---|---|---|---|---|

Close with the reference component id and the tier counts.

---

## Check F — cached and dangling state

Cheap add-ons, each of which has broken a live page.

- `sourceInfo.view_id` vs the source's `data.views[]` — pinned to a superseded
  view? A pin can be deliberate; flag *inconsistency* between components on the
  same page rather than pinning itself.
- `display.totalLength` — cached row count, wrong whenever filters changed
  without a refetch. Recompute; report the delta.
- `element-data.data` — cached rows inconsistent with the current `dataRequest`
  means the page renders pre-change values before the fetch resolves.
- `display.pageSize` missing while `usePagination` is on → renders blank.
- Columns in `element-data.columns[]` with **no** live source match at all (not
  drift — absent). These render empty.
- External filters whose column is null for every row remaining after internal
  filters → a dead facet control.
- Persisted editor state in saved config (`isEdit: true` on a published
  component). Harmless individually, useful as a tell that the row was saved
  from an editing session rather than a deliberate publish.

---

## Reporting

Structure the report as: **Check A table → Check B table → Check C table +
by-column rollup → Check D table → Check E table + tier counts → Check F notes
→ Source-side recommendations → Coverage.**

For any individual finding needing narrative:

```
[CLASS] short title                                    confidence: high|medium|low
  where     : component <id> → element-data.<json.path>
  observed  : <value>
  expected  : <value, grounded in — live source / sibling column / page intent>
  impact    : <what a site visitor sees or doesn't see>
  systemic  : <N of M components; the exceptions are …>
  fix (not applied) : <one line>
```

Classes: `META_DRIFT`, `SNAPSHOT_STALE`, `RELIC_FILTER`, `DEAD_FILTER`,
`DEPRECATED_COLUMN`, `SOURCE_HYGIENE`, `STALE_TRANSPORT`, `SOURCE_LAYER_MISMATCH`,
`UNWIRED_PAGE_VARIABLE`, `CACHED_STATE`, `DEAD_FACET`.

Always end with **Source-side recommendations**. Several classes here are only
permanently fixable at the source — retiring superseded columns, deleting
scratch columns, resolving duplicate aliases. Component-level fixes alone
guarantee recurrence.

Always separate **isolated** from **systemic**. A finding on one component is a
bug; the same finding on thirty is a process problem, and the remediation and
the audience differ.

---

## Calibration appendix — reference run

MitigateNY, app `mitigat-ny-prod`, pattern 985070, 6,831 components (936 with a
bound source, 26 distinct sources, 7 resolving to a parseable
`config.attributes` — so **19 sources went unaudited**, exactly the caveat
Check C requires reporting).

Triggering report: component **1167446** ("Measures Inventory", page 1009858
`plan_to_act/develop_strategies`, source `Mitigation_Measures` 1068274, view
1155800), reported as three bugs on one component. Intent: all-hazards overview.

**Check A** flagged two rendered columns on 1167446 — `description`
(`type` stored `text`, live `lexical`) and `coastal` (`text` vs `checkbox`).
The `sourceInfo` snapshot was far staler than the badges implied: 46 columns vs
the source's 53, still listing `flood` (renamed `flooding`), missing nine
columns, disagreeing on `type` for 35 — demonstrating why the snapshot must be
diffed separately.

**Check B** on 1167446 found an internal `exclude` on
`program_action_measure_name` listing four individual measure names —
heuristic 1 (hard-coded row literals) and heuristic 2 (contradicts an
all-hazards page). Heuristic 3 supplied the diagnosis: 29 of 32 components on
this source carry the identical exclusion, and the two that don't are precisely
those whose hazard filter is `["drought"]` — so the exclusion was authored to
keep drought rows off non-drought pages and copied everywhere, including the
overview. Two further components carried a *different* four-item list
(heuristic 7, variant drift → author decision). Two more excluded on `flood`,
a column that no longer exists (heuristic 4).

**Check C** found the deprecation marker in the live title: the component's
category facet resolves to a source column titled **`"Category-Deprecated"`**,
while its own stored `display_name` reads `"Category"` — the stale-title
mechanism, in one case. Site-wide the mechanical detector returned **183
deprecated-column usages across 113 components on 4 sources**, none of which
would have been found by reading component config alone:

```
R_and_V_Matrix      :: hazards_string  ("Hazards-Deprecated")     61 components (28 visible, 30 filtered)
Mitigation_Measures :: mm_category     ("Category-Deprecated")    32 components (32 visible, 10 filtered)
Mitigation_Measures :: hazards         ("Hazards-deprecated")     28 components ( 0 visible,  0 filtered)
Mitigation_Measures :: mm_type         ("Type - deprecated")      28 components (28 visible, 28 filtered)
Actions_Revised     :: num_proposed    ("# Proposed - deprecated") 10 components
Actions_Revised     :: num_not_started ("# Not Started - deprecated (dep)") 10 components
Actions_Revised     :: hazards_json    ("Hazards - (no flood, deprecated)") 5 components
… plus (Delete)/tmp-marked columns on Capabilities_Catalogue and Actions_Revised
```

In every group but one, the stored title showed no marker on *all* consumers —
confirming live-source resolution is mandatory, not an optimization. The
`hazards`/`num_proposed`/`num_not_started` rows are hidden and unfiltered
(dead config to clean up); `mm_type` is rendered *and* driving a facet on all 28
(actively serving superseded values). Source-side: `Mitigation_Measures`
defines `mm_category_json` **twice** under one alias with contradictory titles
(`"Category"` and `"Category-Deprecated"`) and carries a `test cat` scratch
column.

**What the sweep changed.** Three bugs on one component were, at the data
level, one duplication process reproducing three defect classes across 32
components — with the deprecated-column class reaching 113 components
site-wide. Fixing 1167446 alone leaves every other carrier and the source-side
ambiguity that produced them.

### Map checks (D, E) — reference run

Second triggering report: component **1216015** (page 1009948), a map that
should show FEMA floodplain zones but renders only county boundaries, and that
lacks the county-zoom filter other platform maps have. Sweep scope: 184 `Map`
components, 342 layers.

**Check D.** The signature held — the context layer drew, the thematic layer
didn't. The transport distribution settled it immediately:

```
tiles   340 layers      ← live dama tile route, source-layer view_{view_id}
pmtiles   2 layers      ← BOTH are "NYS Floodplains Merged - Flood Zones"
                          on components 1216015 and 1607599 (a duplicate pair)
```

Those same two layers are also the **only** two of 342 whose `source-layer`
(`s379_v841`) departs from the `view_{view_id}` convention — two independent
outlier tests landing on the same two layers. The live tile route for the
layer's view is healthy: `tiles/841/8/74/94/t.pbf` → **200, 875 KB**, and
`?cols=fld_zone` returns the paint column, so the floodplain data is fine and
available. Verdict: `binding defect — data available`.

The protocol check (step 4) supplied the mechanism and corrected a wrong first
read. The `pmtiles://` artifact **exists** — it answers a range request with
`206`. But there is no `pmtiles` package in `package.json` and no `addProtocol`
registration anywhere in the codebase; the only pmtiles code is the datasets
admin UI that *generates* these artifacts. MapLibre therefore has no handler for
the `pmtiles://` scheme, the source never loads, and nothing draws — silently.
This is exactly why step 4 warns that probing the artifact is not sufficient
evidence: a healthy 206 would have read as "the tiles are fine, look elsewhere."
Compounding it, the runtime `?cols=` rebuild is applied to `source.url` too, so
it appends a query string to a `pmtiles://` URL — meaningless for that transport.

**Check E.** Binding-key completeness across the 342 layers:

```
layers with a dynamic-filter        255 / 342   — all on column `stcofips`
  … with searchParamKey: "geoid"      3         ← fully wired
  … with searchParamKey absent      252         ← partially wired
layers with no dynamic-filter        87
map components with none at all      29 / 184   ← includes 1216015 + twin 1607599
```

The reference instance is **1395341**: `{values: [], dataType: "numeric",
column_name: "stcofips", display_name: "State-County FIPS Code", searchParamKey:
"geoid"}` on the active layer, plus `usePageFilters: true` and component-level
`zoomToFitBounds: true`. The 252 partials carry only
`{column_name, display_name}` — no `searchParamKey`, so each binds to a page
variable literally named `stcofips` rather than to `geoid`. That is the
`searchParamKey || column_name` mechanism producing a whole tier of maps that
look wired and aren't. 1216015 is below even that: no `dynamic-filters` on
either layer, `usePageFilters` unset, `zoomToFitBounds: false`.

One platform-level finding fell out that no single-component review would
surface: **`zoomToFilterBounds` is true on 0 of 255** dynamic filters. The
documented zoom-to-selection mechanism is unused pattern-wide, so "zoom to the
county" is not currently implemented by any map here — worth confirming with an
author before treating it as a per-component regression.

**What the sweep changed.** Two reported symptoms on one map resolved to: a
two-layer unfinished migration to a transport the renderer cannot read (with the
data itself healthy), and a three-tier wiring inconsistency spanning every map on
the pattern. Both are invisible from a single component; both are unmistakable
from the distribution.
