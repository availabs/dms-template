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
> Run checks A, B, C on any data-bound component; D, H, E and F additionally on
> any `Map` section — **H before F**, since F's findings are usually H's blast
> radius; G as a cheap add-on. Report as specified. **Do not modify any DMS
> row.**
>
> If the scope contains two components of the same type and title — one usually
> a draft beside a published one — diff that pair **before** running any check.
> A corrected copy sitting next to a broken one is a specification of the fix;
> see "First, look for a fixed twin" under Reporting.
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

### C2 — variant divergence in shared assets

The same "which generation am I on?" defect applies to any **shared, versioned
asset a component references by id** — symbologies, saved filter sets, templates
— not just columns. The detector is the name, exactly as above.

**Do:** collect every referenced asset's name across the pattern, strip
qualifier suffixes (`v2`, `v3`, `(LHMP)`, `(copy)`, `(2)`, trailing years), and
group. **Any base name resolving to more than one asset id is a family.** For
each family, report the ids, the full names, and the consumer count of each.

Two cautions, both learned the hard way:

- **A version suffix does not tell you which member is current.** A `v2`
  variant can be the abandoned experiment and the unsuffixed one the
  maintained original. Determine currency from consumer behavior and from
  which member a known-good component uses — never from the name alone.
- Same for consumer counts: during an in-flight migration the majority sits on
  the old member. Counts corroborate; they don't decide.

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
4. **Confirm the renderer actually *registers* a handler for any non-HTTP
   protocol** the layer declares. Two distinct things must be true, and the
   second is the one that fails: a handler must **exist**, and it must be
   **wired at the call site**. Find the registration (`addProtocol`) *and*
   follow it to where it is passed to the map — a vendored handler whose import
   and wiring are commented out is exactly as dead as no handler at all, and a
   codebase search alone will tell you it's supported.
   Probing the artifact URL is *not* sufficient evidence either: an artifact can
   return 200/206 and still be unreadable because nothing is registered to read
   it. Also check the URL *form* the handler expects — some protocols require
   the full inner scheme (`pmtiles://https://host/…`), and a URL missing it
   fails even under a correctly registered handler.
5. **Cross-check paint against `data-column`** — collect every `["get", prop]`
   in each sublayer's paint and confirm each is in the comma-joined
   `data-column`. Missing ones fall out of the rebuilt `?cols=` and the feature
   draws in the fallback color.
6. **Verify every requested column actually exists on the view.** The tile
   route answers `?cols=<name>` for an unknown column with **204 and a zero-byte
   body — the entire tile, not just that column**. So one stale name anywhere in
   the rebuilt `?cols=` (a `data-column`, or any dynamic-filter column that
   currently has values) blanks the whole layer, silently and completely. This
   is a high-frequency cause of "the layer just stopped drawing after someone
   renamed a field."

### The 204 schema probe

That same behavior is the cheapest way to enumerate a view's real schema, and
it needs no metadata endpoint or database access — useful because the DaMa
metadata routes are not reliably reachable:

> Request one candidate column at a time. **200 = the column exists; 204 with 0
> bytes = it does not.** Never batch candidates: a single unknown name 204s the
> whole request and tells you nothing about the others.

Use it to confirm a filter column before calling a binding correct, and to
compare two candidate sources — **disjoint schemas prove they are different
datasets rather than two versions of one.**

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

## Check F — wired to the wrong layer, or to the wrong key

**Defect class:** the component is fully configured and passes Checks D and E —
tiles load, bindings exist — and still misbehaves, because the wiring points at
the wrong *member*. Nothing is missing, so nothing looks wrong in the editor.

Two independent detectors. Both are pure structure comparisons and both are
decided by distribution across the pattern.

> **Run Check H first.** Both detectors below fire reliably on layers bound to
> an ungoverned source, because a one-off upload brings its own key vocabulary
> and gets designated as the active layer while someone is wiring it up. If an
> F1 or F2 finding lands on a layer that Check H flagged, **report it as blast
> radius of that binding, not as an independent defect** — otherwise the fix
> gets applied to the symptom and the source stays wrong.

### F1 — the designated layer is a context layer, not the thematic one

Multi-layer components nominate one layer as the one that drives behavior
(`symbology.activeLayer`). In this codebase that nomination controls **two**
things, and both silently follow it to the wrong place:

- **Page-filter sync** reads only the designated layer's `dynamic-filters`
  ([`map/index.jsx:707`](../../src/dms/packages/dms/src/patterns/page/components/sections/components/ComponentRegistry/map/index.jsx)).
- **Zoom-to-filter-bounds** resolves its view from the designated layer and
  queries `ST_Extent` on *that* view
  ([`map/index.jsx:726`](../../src/dms/packages/dms/src/patterns/page/components/sections/components/ComponentRegistry/map/index.jsx)).
  The fallback to other layers only considers layers with
  `zoomToFilterBounds: true`, so where that flag is unused the designated layer
  is the *only* source of bounds — and a filter matching nothing yields no zoom
  at all, not a default zoom.

**Do:** for every symbology, identify the **thematic** layer — the one carrying
`data-column` (equivalently: the layer the legend describes and the component is
named after) — and check whether it is the designated layer. Boundary/context
layers are typically `layer-type: "simple"` with no `data-column`; a `simple`
layer as the designation is the signature.

Report as a table and, critically, as a **rate**: the norm establishes that the
exceptions are errors rather than intent.

| Component | Page | Symbology | Designated layer | Its type | Thematic layer | Designated == thematic? |
|---|---|---|---|---|---|---|

Flag as a stronger finding any case where **the same symbology is designated
differently across components** — that is drift, not a deliberate choice.

### F2 — one page variable, several key vocabularies

A single page variable can legitimately drive several layers. It is **not**
legitimate for those layers to identify the same real-world entity through
different tile columns, because each column is a separate vocabulary that must
match the page value byte-for-byte. One of them is usually wrong, and the wrong
one fails silently — a client-side `["in", …]` that matches nothing renders an
empty layer, not an error.

**Do:** for each symbology, collect the set of
`dynamic-filters[].column_name` across all layers, grouped by the page variable
(`searchParamKey || column_name`) they bind to. **More than one column name
serving one page variable is the finding.**

| Component | Symbology | Page variable | Columns claiming it | Layers | Verdict |
|---|---|---|---|---|---|

Rank by how divergent the vocabularies are. Columns from a governed source
(a standard FIPS/GEOID column) versus columns from a locally uploaded dataset
are the highest-risk pairing — the latter often carry **truncated shapefile
field names** (10 characters, e.g. `county_fip`, `census_geo`, `county_nam`),
which is itself a reliable tell that the layer came from an ad-hoc upload rather
than the governed pipeline. Note also when the two columns bind to *different*
page variables (e.g. `geoid` and `geoid_juris`), since that requires the page to
actually publish both.

---

## Check H — is every layer bound to a *governed* source?

**Defect class:** a layer bound to an ad-hoc, hand-uploaded dataset instead of
the governed source that the rest of the platform uses. This is the **root
cause** that most often manifests as the symptoms in Checks E and F — a
one-off upload brings its own column vocabulary, its own key semantics and its
own idea of what a "jurisdiction" is, and every downstream wiring problem
follows from that one binding.

**Run this check before F, and treat an F finding on the same layer as a
symptom of it.**

### Detection — the source-object id carries provenance

Each layer's `sources[0].id` is minted at bind time in the form:

```
{pgEnv}_{datasetName}_{epochMs}_{layerId}
    e.g.  hazmit_dama_NRI Tracts Geospatial_1727442020144_hcqeans
```

The `{datasetName}` slot is the tell. A governed binding embeds a real dataset
name. An ad-hoc one embeds a placeholder.

**Do:**

1. Parse every layer's `sources[0].id` into its four parts.
2. Flag layers whose `{datasetName}` is a **placeholder** — `comp`, `tmp`,
   `temp`, `test`, `new`, `untitled`, `copy`, an empty string, or a bare
   `s{source_id}_v{view_id}` fallback (that fallback means no name was
   available at bind time).
3. Tabulate `{datasetName}` across the whole pattern. As everywhere in this
   document, **the outlier is the finding** — a placeholder-named source among
   hundreds of properly named ones is not a naming style, it is an upload that
   bypassed the catalog.
4. Read the **`{epochMs}` timestamp**. Ad-hoc sources are usually much newer
   than the governed ones around them; a binding minted months after every
   sibling is a strong corroborating signal.
5. For each flagged source, look for the **governed alternative**: other
   sources in the same pattern serving the same real-world entity. Report them
   as candidate replacements with their ids, names, and mint dates.
6. Probe the flagged view's schema (see Check D's 204 technique) and compare
   its columns to the governed alternative's. **Disjoint schemas confirm they
   are different datasets, not versions of one** — which means switching
   sources also requires rewriting every filter column that referenced it.

### Output

| Component | Symbology | Layer | source/view | `{datasetName}` | Minted | Governed? | Columns | Candidate replacement |
|---|---|---|---|---|---|---|---|---|

Follow every flagged layer downstream and say so explicitly: is it the
designated layer (F1)? does it introduce a second key vocabulary (F2)? is it
present only in one variant of a shared symbology (C2)? Those are the blast
radius of this one binding, and reporting them as separate findings invites
three separate partial fixes.

---

## Check G — cached and dangling state

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
by-column rollup → Check D table → Check E table + tier counts → Check F tables
→ Check G notes → Source-side recommendations → Coverage.**

**First, look for a fixed twin.** Before auditing anything, group the page's
components by `(element-type, title)` and flag any group larger than one —
typically one published component and one `is_draft` beside it. That is the
"fixed it by adding a corrected copy next to the broken one" pattern, and it
changes the whole approach: production still renders the broken one, editors
can't tell which is live, and **the corrected copy is the best available
specification of the fix**. Diff the pair first and lead the report with it —
every difference is either the fix or noise, and sorting those two is far
cheaper than deriving the defect from scratch. Then generalize each real
difference through the checks below to find the other components carrying it.

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
`DEPRECATED_COLUMN`, `ASSET_VARIANT_DIVERGENCE`, `SOURCE_HYGIENE`,
`STALE_TRANSPORT`, `SOURCE_LAYER_MISMATCH`, `UNGOVERNED_SOURCE`,
`MISSING_TILE_COLUMN`, `UNWIRED_PAGE_VARIABLE`, `WRONG_DESIGNATED_LAYER`,
`MIXED_KEY_VOCABULARY`, `SUPERSEDING_DUPLICATE`, `CACHED_STATE`, `DEAD_FACET`.

Always end with **Source-side recommendations**. Several classes here are only
permanently fixable at the source — retiring superseded columns, deleting
scratch columns, resolving duplicate aliases. Component-level fixes alone
guarantee recurrence.

Always separate **isolated** from **systemic**. A finding on one component is a
bug; the same finding on thirty is a process problem, and the remediation and
the audience differ.

**Collapse co-located findings into their root cause.** When several findings on
one component all touch the same layer, source, or column, they are almost
never independent — they are one wrong binding and its blast radius. Before
reporting, group findings by the object they touch; if a group has a plausible
root (Check H's ungoverned source is the usual one), report the root as the
finding and the rest as consequences beneath it. A list of three peer findings
invites three partial fixes and leaves the cause in place.

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

The protocol check (step 4) supplied the mechanism, and it took two passes —
which is why the check is worded the way it is. The `pmtiles://` artifact
**exists**: it answers a range request with `206`. A pmtiles handler **also
exists** — vendored at
[`map/pmtiles/index.ts`](../../src/dms/packages/dms/src/patterns/page/components/sections/components/ComponentRegistry/map/pmtiles/index.ts),
exporting `PMTilesProtocol`, which calls `maplibre.addProtocol("pmtiles", …)`.
Either fact alone reads as "supported, look elsewhere."

The defect is at the **call site**: in
[`map/index.jsx`](../../src/dms/packages/dms/src/patterns/page/components/sections/components/ComponentRegistry/map/index.jsx)
both the import (line 5) and the wiring (`//protocols: [PMTilesProtocol],`,
line 1340) are **commented out**. Nothing registers the scheme, so MapLibre
cannot resolve `pmtiles://`, the source never loads, and nothing draws —
silently. Two secondary confirmations: the layer's URL is
`pmtiles://graph.availabs.org/…`, missing the inner `https://` the handler's own
README documents; and the runtime `?cols=` rebuild is applied to `source.url`
too, appending a query string to a `pmtiles://` URL, which is meaningless for
that transport.

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

### Check H — reference run (the wrong-source case, and how it hid)

Third triggering report, and the cleanest example of the fixed-twin shortcut:
page `the_risk/natural_hazards` on tenant `suffolk_draft` (pattern
`mitigateny_county_template_suffolk_copy`) carries **two** "County Level EAL Map"
components — **2249527** (published, known issues) and **2389090** (draft, the
fix). Diffing the pair took minutes and yielded three real differences plus two
red herrings. Sweep scope for generalization: 358 map components across both
MitigateNY patterns, 348 (component × symbology) records.

**Red herrings, worth naming so a reviewer doesn't chase them.** The fixed twin
populates `tabs[0].rows` with a symbology reference and sets
`display.layerPanel: "none"`; the broken one leaves `rows` empty. Neither
matters: `EMPTY_TABS` is the code default
([`map/index.jsx:61,366`](../../src/dms/packages/dms/src/patterns/page/components/sections/components/ComponentRegistry/map/index.jsx)),
the panel only renders when `layerPanel === 'library'`, and the distribution
confirms it — 336 of 348 records have empty `rows`. A difference present in a
known-good component is not automatically the fix.

**F1 — designated layer.** The broken component designates
`activeLayer: "Jurisdiction Boundary"` (`layer-type: simple`, no `data-column`);
the fixed twin designates the thematic layer (`data-column: eal_valt`). Across
the 342 records that have a thematic layer, **316 designate it and 26 do not** —
a 92% norm that makes the 26 errors rather than intent. Consequence is doubled
because both mechanisms follow the designation: page-filter sync reads only that
layer's `dynamic-filters`, and the zoom-bounds probe resolves `ST_Extent` from
that layer's view (2296, the jurisdictions upload) instead of the data view
(1410). The fallback can't rescue it — it only considers layers with
`zoomToFilterBounds: true`, and that flag is set on **zero** layers here. The
strongest form of the finding also appeared: symbology **2142106 is designated
differently across its own consumers** — `"Jurisdiction Boundary"` on 2249527
and 2323790, `"County Boundary"` on 2252947 — which is drift by definition.

**F2 — mixed key vocabulary.** The broken component's layers bind the single
page variable `geoid` through **two different columns**: `stcofips` (the
governed NRI views 1410/1416) and `county_fip` (view 2296, a locally uploaded
jurisdictions shapefile). The fixed twin uses `stcofips` alone. **32 of 348
records** show mixed vocabularies, and the worst are worse than this one:
`["stcofips","census_geo"]` split across two *different* page variables
(`geoid` and `geoid_juris`, 7 components), `["county_fip","stcnty","stcofips"]`
(2), `["state_id","stcofips"]` (5). The truncated-field tell held exactly as
described — view 2296's columns are `county_fip`, `county_nam`, `census_geo`,
`cis_comm_1`, all clipped to 10 characters, marking an ad-hoc upload rather than
the governed pipeline. Tile probes confirmed both vocabularies are individually
valid (view 2296 carries `county_fip = "36103"` for Suffolk), which is the point:
mixed keys fail by *divergence*, not by being individually broken, so probing one
column proves nothing.

**C2 — symbology variant divergence.** The broken component renders symbology
**2142106** "FEMA NRI … Total EAL **v2 (LHMP)**"; the fix renders **2142005**
"FEMA NRI … Total EAL" — identical paint and breaks, one fewer layer. Stripping
qualifier suffixes across the pattern surfaced **7 families**, all the same
shape: `Census Tract NRI Total EAL by Hazard` vs `… (LHMP)`, likewise
Building/Population/Crop EAL, `Fusion Events by Primary Hazard` vs `… (LHMP)`,
and `Jurisdictions (LHMP)` vs `Jurisdictions v2 (LHMP)`. **This run is the
counterexample that earns C2's first caution:** the `v2` member is the broken
one and the unsuffixed original is the fix. Had currency been inferred from the
name, the audit would have recommended migrating *toward* the defect.

**H — the root cause, and why the first pass missed it.** The three findings
above are **not three defects**. They are one wrong source binding and its blast
radius, and reporting them as peers was an error this section exists to prevent.

The broken component's extra layer binds source **1612 / view 2296**. Its
source-object id is `hazmit_dama_comp_1767815938875_xhzxhpy` — the
`{datasetName}` slot reads **`comp`**. Across **712 layers** in both patterns,
those 25 layers are the **only** ones whose source object carries no dataset
name; every other binding embeds a real one (`NRI Tracts Geospatial`,
`NRI Counties Geospatial`, `nys_counties`, `avail_merged_floodplains_2025`,
`cities_towns`, `SVI2022_NEWYORK_tract`, `NYS_DEC_Dams`, …). It is also the
newest binding in the corpus — minted **2026-01-07**, against 2023–2025 for
nearly everything around it. An ad-hoc upload that never went through the
catalog, in other words.

Two properly-named jurisdiction sources already exist as candidate
replacements: `cities_towns` (src 1559 / view 2074, minted 2025-11-04) and
`cl_2024_v01_openfemagdba…` (src 1579 / view 2219, minted 2025-11-21).
The 204 schema probe shows all three are **schema-disjoint** — 2296 exposes
`county_fip, census_geo, cis_comm_1, county_nam` (10-char truncated shapefile
fields), 2219 exposes `geoid`, 2074 exposes `name`, with no column in common —
so they are different datasets, not versions of one, and switching sources
forces every filter column that referenced 2296 to be rewritten too.

Everything else in this section follows from that one binding:

- **F1** — the ungoverned layer is the one designated `activeLayer`, so it
  captured page-filter sync and zoom-bounds resolution.
- **F2** — it could only introduce `county_fip` as a second vocabulary because
  its schema shares no column with the governed views.
- **C2** — the `v2 (LHMP)` symbology variant exists *because* it is the variant
  carrying this layer; the unsuffixed original doesn't have it, which is why
  dropping back to 2142005 fixed the map.

**The lesson, and why Check H now runs before F.** The first pass reported
F1, F2 and C2 as three independent classes. Each was individually correct and
each would have produced a partial fix that left source 1612 in place — the map
would keep "working" until the next author reused the same symbology. The
detector that finds the root is cheaper than all three: **parse the
source-object id and look at the `{datasetName}` slot.** One string comparison
over 712 layers isolates it.
