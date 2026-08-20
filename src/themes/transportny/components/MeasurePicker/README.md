# npmrds_graph_vocabulary

> **Location note (moved 2026-07-29).** This lived in `data-types/npmrds_graph_vocabulary/` until the
> theme folder was synced into transportNY and the build failed: `composeMeasureConfig.js` reached five
> levels up and out of `src/` for the JSON, which no downstream project can resolve. The theme folder
> is the unit that gets synced (`planning/skills/sync-transportnyv2-theme`), so the vocabulary now
> lives inside it, beside its JS consumer. **Do not move it back out of the synced tree.** The Python
> consumer points here too.

Shared, plain-data vocabulary for NPMRDS AVL Graph section generation. Not a DMS dataType plugin
(no server routes/worker, not registered in `register-datatypes.js`) — just a JSON file two
independent consumers read:

- **`scripts/npmrds-reports/convert_old_reports.py`** (Python, old-reports-conversion tool) — sources its
  `SPEED_EXPR`/`TRAVEL_TIME_EXPR`/`DELAY_EXPR`/`AVG_DELAY_EXPR`/`CO2_EXPR_PASSENGER`/
  `CO2_EXPR_TRUCK`/`META_JOIN`/`AADT_DIST_JOIN`/`WEEKDAY_EXPR`/`HOUR_EXPR`/`QUARTER_HOUR_EXPR`/
  `MONTH_EXPR`/`DEFAULT_DIFF_COLOR_RANGE` constants from here instead of hardcoding them.
- **The NPMRDS "Measure" picker** (JS, planned in `src/themes/transportny/` — see
  `src/dms/planning/tasks/current/report-graph-vocabulary-picker.md`, Workstream 2, not yet
  built) — an author-facing control that generates a Graph/AVL Graph section's `columns`/`join`/
  `comparisonSeries.combine`/`display` config live, without a pre-minted DB template row.

This is the "one canonical implementation" for the part of `TEMPLATE_SPECS` that actually causes
silent cross-language drift — the underlying SQL formulas and join definitions — while the
*composition* logic (how these ingredients combine into a final section config for a given graph
type) stays implemented natively and independently in each language. That composition step is
close to mechanical (lookup + shallow-merge a handful of fragments), so duplicating it is low
regression-risk, unlike duplicating the formulas themselves would be.

## Structure

```
{
  "measures": { "<measureKey>": { label, expr, fn, requiresJoin, reverseColors }, ... },
  "baseSource": { source, view, sourceInfo },
  "joins": { "<JOIN_KEY>": { source, view, sourceInfo, joinColumns, mergeStrategy, type }, ... },
  "resolutions": { "<resolutionKey>": { xAxis }, ... },
  "comparisonModes": { "plain": {}, "difference": { comparisonSeriesCombine, defaultColorRange } }
}
```

### `measures`

Measure keys reuse the exact strings already used elsewhere in `convert_old_reports.py`
(`REVERSE_COLORS_MEASURES`, `GOOD_DIRECTION_BY_MEASURE`, `ROUTE_MAP_VALUE_EXPR`: `speed`,
`travelTime`, `hoursOfDelay`, `avgHoursOfDelay`, `co2Emissions`, `avgCo2Emissions`), with `_truck`/
`_passenger` suffixes added where the CO2 measure needs to split by vehicle class. `speedTruck` is
new vocabulary (no `TEMPLATE_SPECS` entry uses it outside the `route_diff_speed_5min_truck`
difference template) but reuses `SPEED_EXPR_TRUCK` verbatim.

- `expr` — the full calculated-column SQL string, **including its own `as <alias>` suffix** —
  copy verbatim into a section's `columns` entry's `name` field (matching `TEMPLATE_SPECS`'
  `yAxis.name` convention). **The trailing alias must be unique across every measure in this
  file** — see "A measure's trailing `AS <alias>` must be globally unique" under Regenerating/
  verifying below for why.
- `fn` — the aggregation wrapper the platform's calculated-column pipeline applies
  (`"exempt"` for self-aggregating expressions that already contain their own `sum()`/`avg()`/
  map-combinator fold, `"sum"`/`"avg"` otherwise).
- `requiresJoin` — ordered list of join keys (from `joins` below) this measure's expression
  references. Composition assigns them positionally: first entry → `join.sources.table1`, second
  → `table2`. **This is a full replace, not a merge** — a generated section's `join` key must be
  set to *exactly* `{"table1": joins.X, "table2": joins.Y}` (or a single-key `{"table1": joins.X}`
  when `requiresJoin` has one entry, or omitted when empty), never partially merged with whatever
  the section already had.
- `reverseColors` — mirrors old `dataTypes.js`'s per-measure `reverseColors` flag (`speed`/
  `speedTruck`: false; everything else here: true). Feeds the difference-mode color rule below.

### `baseSource`

The single DAMA source every measure expression's `ds.*` columns reference (`ds.epoch`,
`ds.date`, `ds.tmc`, `ds.travel_time_all_vehicles`, `ds.travel_time_freight_trucks`,
`ds.travel_time_passenger_vehicles`) — source 583/view 982, "NPMRDS Production V6". Same
`{source, view, sourceInfo}` shape as a `joins` entry (`sourceInfo` embeds the live column list
verbatim, captured from a real working report section's `externalSource`, so the JS picker can
write `state.externalSource` directly without an async live source/view lookup — see the
composition contract note below).

Not a Python-side concept at all: `convert_old_reports.py` never references this source
explicitly because every template it mints is a deep-copy of an existing `avl_graph_template`
row that already carries this `externalSource` (same "inherited for free" mechanism `META_JOIN`
used to have, before it became an explicit constant too — see that entry's note below). A
from-scratch JS picker has no template to clone from, so — same reasoning, same fix — this
needed to become an explicit, first-class vocabulary entry.

**Composition contract**: unlike `joins` (which only ever populate `join.sources.tableN`, a
namespace no other author control writes to), `externalSource` is also the generic "Dataset"
sectionMenu control's own target. A picker that writes `state.externalSource = {...baseSource}`
should only do so when no Dataset is set yet (`!state.externalSource?.source_id`) — never
overwrite an author's own, deliberately different Dataset pick. This is a *default*, not a
forced value.

### `joins`

Two registered DAMA sources, keyed by the same names `TEMPLATE_SPECS`/this file's measures use:

- **`META_JOIN`** (source 582/view 983, "NPMRDS_V6_tmc_meta") — `table1` for
  `speed`/`speedTruck`/`hoursOfDelay`/`avgHoursOfDelay`/`co2Emissions_*`/`avgCo2Emissions_*`, and
  (Python-side) Info Box's `speed`/`length`/`aadt`/`hoursOfDelay` and Route Compare's `speed`.
  Provides `miles`/`aadt`/`avg_speedlimit`/`congestion_level`/`directionality`/`f_system`/
  `faciltype` — everything every one of these measures reads. Year-matched via a calculated
  `dsColumn` (`toYear(ds.date) as meta_year`) — every fact row resolves against its own date's
  year, not a frozen snapshot.

  **The ONE canonical TMC-metadata join — corrected 2026-08-12, do not reintroduce a second
  one.** Used to be split across this join (delay/CO2 only) and a separate
  `TMC_IDENTIFICATION_JOIN` (source 455/view 3464, "NPMRDS TMC Identification V5/V6", static
  single-snapshot-per-TMC, no year dimension — `speed`/`speedTruck` and Info Box's
  `length`/`aadt` used to read this one instead). Found live 2026-08-12 (Ryan's own review):
  `vocabulary.json`'s old `TMC_IDENTIFICATION_JOIN` column list (11 columns) was itself a stale,
  hand-trimmed cache — the real live table (`DESCRIBE TABLE
  npmrds_meta.s582_v983_NPMRDS_V6_tmc_meta`) has 58 columns and is a confirmed **strict
  superset** of `TMC_IDENTIFICATION_JOIN`'s ~43 columns (literally every column, verbatim names),
  plus geometry (`wkb_geometry`) and administrative codes it never had. Coverage confirmed
  complete: 2016–2026, all 11 years, no gaps. So `TMC_IDENTIFICATION_JOIN` was never actually
  buying anything `META_JOIN` couldn't already provide, while its lack of a year dimension made
  every query that used it silently wrong for any year other than whatever vintage view 3464
  happens to be pinned to (confirmed real, not theoretical: ~96% of TMCs have `miles` that
  genuinely changes across years — real network-vintage changes, not rounding noise). Removed
  entirely — `speed`/`speedTruck`'s `requiresJoin` repointed to `META_JOIN`, the shared base
  template (`tmc_travel_time_line_graph`, row 2187310) that every fresh AVL Graph section clones
  from updated to carry `META_JOIN` as its own default, and `fetchTmcMiles.js` (the one
  non-report consumer, RRL's route-length display) migrated too — see its own header comment for
  how it picks a year with no report date-context available.
- **`AADT_DIST_JOIN`** (source 2056/view 3524, "aadt_distributions") — `table2` for the
  delay/CO2 measure family; AADT-epoch-distribution weighting, joined via a computed `dist_key`
  calculated `dsColumn`.

### `resolutions`

One entry per author-facing resolution choice. `xAxis.type: "plain"` means swap in an existing
physical column by name (`epoch` or `date`, no calculated expression needed); `"calculated"` means
a full column dict with the given SQL `expr`, targeted `"xAxis"`, grouped, sorted ascending —
append `"as <alias>"` is already part of `expr`. These reuse `TEMPLATE_SPECS`' exact resolution
expressions (`WEEKDAY_EXPR`/`HOUR_EXPR`/`QUARTER_HOUR_EXPR`/`MONTH_EXPR`).

A third shape, `xAxis.type: "series"` (`"summary"`, added 2026-08-11) — no time bucket at all; the
x-axis IS the comparisonSeries `__series` discriminator itself (one bar per route, a whole-range
aggregate each — the old tool's "Bar Graph Summary" panel). `buildXAxisColumn` in
`composeMeasureConfig.js` tags this column `origin: 'comparison-series'` rather than the usual
`MEASURE_PICKER_COLUMN_ORIGIN` — deliberately, so the reconcile step (origin-keyed, never touches
`target`) treats it as already-existing rather than adding a second, colliding `__series` column
targeted `categorize`. No `sort`, so bars keep comparisonSeries' own arm order. `composeMeasureConfig`
also force-sets `displayPatch.legend` (`show: false` for `summary`, `true` otherwise, always
explicit, never left stale) — a long raw-expression legend label was a real, live-observed bug in
the old converter's equivalent template (BarGraph.jsx's legend layout can squeeze the chart to 0
width).

### `comparisonModes`

`"plain"` is a no-op (arms render independently, the default). `"difference"` supplies
`comparisonSeriesCombine` (the already-shipped anchor-minus-variant server mechanism — see
`comparison-series-difference-mode.md`) plus `defaultColorRange`, the diverging 5-stop ramp old
`_diff_colors()` uses. **The color-rule composition itself is NOT stored as data** (mirroring the
task's data/logic split) — both consumers independently build the same small `display.colors`
patch old `_diff_colors(bar, reverse)` builds:

```
{"colors": {"type": "palette",
            "value": reverseColors ? defaultColorRange : reverse(defaultColorRange),
            "byValueSymmetric": true,
            ...(graphType === "BarGraph" ? {"byValue": true} : {})}}
```

where `reverseColors` comes from the selected measure's own `reverseColors` flag (not from the
comparison mode) and the `byValue` key is only added for `BarGraph` (GridGraph is inherently
colored by value already; no difference-mode Line/other graph type exists in the corpus).

**Note the polarity is inverted relative to `reverseColors`'s raw-value meaning, not passed through
verbatim.** `reverseColors` is validated correct for coloring a measure's *raw value* (lower
travelTime is good → green at the low end). A difference graph colors a before-minus-after *delta*,
not a raw value, and going from "which raw value is good" to "which delta sign is good" inverts the
polarity for every measure — a positive travelTime delta means time *fell* (good), the opposite end
of the domain from where a low raw travelTime value (also good) sits. So diff-mode reversal is the
negation of the raw flag. See "Finding: difference-graph color scale reads backwards" in
`planning/transportny/tasks/completed/report-spec-and-build-script.md` for the full derivation and live evidence.

## Explicitly NOT in this file (composition-layer or out-of-scope, not omitted by oversight)

- **`target`** (`"yAxis"` vs `"color"`) — graph-type-dependent (LineGraph/BarGraph → `"yAxis"`,
  GridGraph → `"color"`), decided by the composition layer per selected graph type, not a measure
  property.
- **AADT-override substring-swap fragments** (`_AADT_CAR_EXPR`/`_AADT_TRUCK_EXPR`/
  `_AADT_DELAY_FRAGMENT`/`AADT_OVERRIDE_SUBS` in `convert_old_reports.py`) — these must remain
  Python-private literals whose exact substrings still appear inside the `co2Emissions_*`/
  `hoursOfDelay` `expr` strings above (the override mechanism does a live string-replace against a
  report's cloned column expression, matched by exact substring). **Do not refactor these into
  JSON** — doing so risks breaking byte-identity between the substring and the composed expression
  it must be found inside. Report-level `overrides.aadt` application stays entirely out of scope
  for the live picker (v1 generates the plain, override-free expression only).
- **Bar Graph Summary's resolution-parameterized `avgHoursOfDelay` variants**
  (`_avg_delay_summary_expr`/`AVG_DELAY_SUMMARY_5MIN_EXPR`/`_DAY_EXPR`/`_WEEKDAY_EXPR`) — a
  genuinely different composition (map-combinator keyed by a per-resolution bucket, not a plain
  `sum()/count()`), out of scope. **Everything else about "Bar Graph Summary" IS now in this
  file** (added 2026-08-11, the `"summary"` resolution key) — every OTHER measure's summary value
  is a literal alias of its own normal `expr`/`fn` (confirmed by reading
  `convert_old_reports_lib/expressions.py`: `SPEED_SUMMARY_EXPR = SPEED_EXPR`, etc. — these are
  grain-agnostic ClickHouse map/array aggregates, correct whether they fold one 5-minute bucket or
  the whole date range into one row), so only `avgHoursOfDelay` needed the exclusion above.
  `composeMeasureConfig` returns `null` (composes nothing) for `resolution: "summary"` +
  `measure: "avgHoursOfDelay"` specifically, and `report_build.mjs` hard-fails that combo at spec
  validation time rather than silently building a broken section — see
  `report-spec-and-build-script.md`'s Dynamic Report follow-on for the full build/verification
  record.
- **Route Map choropleth value-expressions** (`SPEED_VALUE_EXPR`, `TRAVEL_TIME_VALUE_EXPR`,
  `HOURS_OF_DELAY_VALUE_EXPR`, `ROUTE_MAP_AVGDELAY_VALUE_EXPR_BY_RESOLUTION`) — Map is a
  genuinely separate mechanism (per-year template, choropleth paint baking, no `display.colors`)
  from the Graph/AVL Graph sections this picker targets; out of scope.

## Regenerating / verifying

**Corrected 2026-08-20 — the paragraph this replaced described data flowing the wrong direction.**
`vocabulary.json` **is** the source of truth today, not a generated artifact. The one-time
2026-07-20 extraction went Python → JSON; every constant `convert_old_reports_lib/expressions.py`
uses now reads straight back out of THIS SAME FILE (`SPEED_EXPR_TRUCK =
GRAPH_VOCAB["measures"]["speedTruck"]["expr"]`, etc. — `GRAPH_VOCAB` is just this JSON, loaded).
There is no independent Python literal left to "regenerate from" or diff against for the
expression text itself — hand-editing `vocabulary.json` directly, carefully, per-measure, IS the
correct and only way to fix an expression today. (Confirmed live 2026-08-20 fixing two real bugs
this way: a `travelTime` join-qualification issue and a `speed`/`speedTruck`/CO2-variant trailing
SQL-alias collision — see `report-authoring-ux-overhaul.md` Tier 5F/5G for both write-ups.)

Still worth doing after any edit — it catches drift in anything DERIVED from these constants
(`TEMPLATE_SPECS`, `GRAPH_TEMPLATE_MAP`), which is a real risk even though the base strings
themselves have nowhere else to drift from:

```python
import sys, json
sys.path.insert(0, "scripts/npmrds-reports")
import convert_old_reports as c
# snapshot every JSON-serializable module-level constant (dir(c), skip callables/modules,
# json.dumps each) before and after your edit, diff the two snapshots
```

See `src/dms/planning/tasks/current/report-graph-vocabulary-picker.md` for the full procedure
this task's Workstream 1 verification used.

### A measure's trailing `AS <alias>` must be globally unique across the whole file

Not previously documented, and not enforced anywhere — found live 2026-08-20 when `speed`/
`speedTruck` (and separately, all four `co2Emissions_passenger`/`avgCo2Emissions_passenger`/
`co2Emissions_truck`/`avgCo2Emissions_truck`) turned out to share the same trailing alias
(`as speed`, `as avg_co2_emissions`). Combining two such measures' `expr` strings in one query
(only possible once a Table section could hold N measures, 2026-08-20) makes ClickHouse reject
the query outright — `MULTIPLE_EXPRESSIONS_FOR_ALIAS`. Traced end-to-end (a research pass through
`buildUdaConfig.js`/`getData.js`/`clickhouse.js`/`uda.route.js`) and confirmed this alias is
entirely self-contained: request-building, response-column-name extraction, and the Falcor
storage path all re-derive it fresh from this SAME `expr` string every time, and nothing anywhere
else (JS or Python) hardcodes a specific alias's literal text — so renaming one is always safe,
with no context-dependent caveat (contrast the `ds.`-qualification note above the `measures`
section, which genuinely does depend on whether some OTHER selected measure forces a join into the
same query — alias uniqueness has no such duality). If you add a new measure, pick a trailing
alias no existing measure already uses.

### Composition-layer additions living in `composeMeasureConfig.js`, not this JSON (2026-08-20)

- **`composeTableMeasuresConfig({measureKeys, resolutionKey, externalSourceColumns})`** — the
  Table shape's own compose function: N measures -> N yAxis-target columns (reusing
  `buildMeasureYAxisColumn`, the same per-column builder the single-measure chart path uses) + one
  shared xAxis column + one `join` unioned across whatever the selected measures each need. A
  small, explicit `QUALIFIED_EXPR_WHEN_TABLE_HAS_JOIN` lookup inside this function (not in this
  JSON) substitutes a `ds.`-qualified form of `travelTime`'s expr ONLY when this table's own union
  join is non-empty — `travelTime` is the sole measure with `requiresJoin: []`, so it's the only
  one whose bare-column form (correct alone) becomes ambiguous once combined with a
  join-requiring measure in the same query.
- **`composeAutoTitle(pick)` / `isTitleDirty({currentTitle, priorPick})`** — auto-populates a
  graph's title from its current pick (join of measure labels for Table, single label otherwise)
  without a new "is this still auto-generated" tracking field: `isTitleDirty` recomputes what the
  PRIOR pick would have produced and compares against what's actually stored, so re-picking only
  overwrites the title when it still matches its own last auto-generated value.
- **`resolutionOptionsFor(graphType)`** — `RESOLUTION_OPTIONS` passthrough except it relabels the
  `"summary"` option to "Summary (one row per route)" for Table (the shared label's "one bar per
  route" wording doesn't fit a data grid).
