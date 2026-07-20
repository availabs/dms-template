# npmrds_graph_vocabulary

Shared, plain-data vocabulary for NPMRDS AVL Graph section generation. Not a DMS dataType plugin
(no server routes/worker, not registered in `register-datatypes.js`) — just a JSON file two
independent consumers read:

- **`scripts/convert_old_reports.py`** (Python, old-reports-conversion tool) — sources its
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
  `yAxis.name` convention).
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

### `joins`

Three registered DAMA sources, keyed by the same names `TEMPLATE_SPECS`/this file's measures use:

- **`TMC_IDENTIFICATION_JOIN`** (source 455/view 3464, "NPMRDS TMC Identification V5/V6") — backs
  `table1.miles` for `speed`/`speedTruck`. **Not a pre-existing Python constant** —
  `convert_old_reports.py` never declares this join explicitly for speed/travel-time
  `TEMPLATE_SPECS` entries because it inherits it "for free" by deep-copying
  `tmc_travel_time_line_graph`'s live `stateJson` (`TEMPLATE_BASE_NAME`, see `ensure_graph_templates`)
  — a hand-authored row that predates the converter and already carries this join. See
  `src/dms/documentation/npmrds-data-sources.md`'s "Which measures use which source" table for the
  full trace (confirmed live 2026-07-20 against `scratchpad/npmrds-sub/old-reports/
  avl_graph_templates.json`, a dump of the 3 hand-built base template rows). **A from-scratch
  picker has no base template to clone from and must wire this join explicitly** for any `speed`/
  `speedTruck` measure — this is the whole reason this join needed to become an explicit constant
  here rather than staying implicit.
- **`META_JOIN`** (source 582/view 983, "NPMRDS_V6_tmc_meta") — `table1` for
  `hoursOfDelay`/`avgHoursOfDelay`/`co2Emissions_*`/`avgCo2Emissions_*` (provides
  `avg_speedlimit`/`aadt`/`congestion_level`/`directionality`/`f_system`/`faciltype`, none of
  which `TMC_IDENTIFICATION_JOIN`'s source carries). Year-matched via a calculated `dsColumn`
  (`toYear(ds.date) as meta_year`) — every fact row resolves against its own date's year.
- **`AADT_DIST_JOIN`** (source 2056/view 3524, "aadt_distributions") — `table2` for the same
  delay/CO2 measure family; AADT-epoch-distribution weighting, joined via a computed `dist_key`
  calculated `dsColumn`.

Note that `speed`/`speedTruck` and the delay/CO2 family use **different** `table1` sources
(455/3464 vs. 582/983) — both happen to expose a `miles` column, but only 582/983 also carries
`avg_speedlimit`/`congestion_level`/etc.

### `resolutions`

One entry per author-facing resolution choice. `xAxis.type: "plain"` means swap in an existing
physical column by name (`epoch` or `date`, no calculated expression needed); `"calculated"` means
a full column dict with the given SQL `expr`, targeted `"xAxis"`, grouped, sorted ascending —
append `"as <alias>"` is already part of `expr`. These reuse `TEMPLATE_SPECS`' exact resolution
expressions (`WEEKDAY_EXPR`/`HOUR_EXPR`/`QUARTER_HOUR_EXPR`/`MONTH_EXPR`).

### `comparisonModes`

`"plain"` is a no-op (arms render independently, the default). `"difference"` supplies
`comparisonSeriesCombine` (the already-shipped anchor-minus-variant server mechanism — see
`comparison-series-difference-mode.md`) plus `defaultColorRange`, the diverging 5-stop ramp old
`_diff_colors()` uses. **The color-rule composition itself is NOT stored as data** (mirroring the
task's data/logic split) — both consumers independently build the same small `display.colors`
patch old `_diff_colors(bar, reverse)` builds:

```
{"colors": {"type": "palette",
            "value": reverseColors ? reverse(defaultColorRange) : defaultColorRange,
            "byValueSymmetric": true,
            ...(graphType === "BarGraph" ? {"byValue": true} : {})}}
```

where `reverseColors` comes from the selected measure's own `reverseColors` flag (not from the
comparison mode) and the `byValue` key is only added for `BarGraph` (GridGraph is inherently
colored by value already; no difference-mode Line/other graph type exists in the corpus).

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
  `sum()/count()`), out of scope for this round's ingredient extraction.
- **Route Map choropleth value-expressions** (`SPEED_VALUE_EXPR`, `TRAVEL_TIME_VALUE_EXPR`,
  `HOURS_OF_DELAY_VALUE_EXPR`, `ROUTE_MAP_AVGDELAY_VALUE_EXPR_BY_RESOLUTION`) — Map is a
  genuinely separate mechanism (per-year template, choropleth paint baking, no `display.colors`)
  from the Graph/AVL Graph sections this picker targets; out of scope.

## Regenerating / verifying

Do not hand-edit the `expr`/`join` values — retype risk on these SQL strings is high (deeply
nested parens, `multiIf` piecewise regressions). Regenerate from the live Python constants:

```python
import sys, json
sys.path.insert(0, "scripts")
import convert_old_reports as c
# read c.SPEED_EXPR, c.DELAY_EXPR, c.META_JOIN, etc. directly and diff against vocabulary.json
```

After any edit to either `vocabulary.json` or the corresponding `convert_old_reports.py`
constants, take a full module-level constant snapshot before and after
(`dir(c)`, skip callables/modules, `json.dumps` each serializable value) and diff — this catches
drift anywhere in the derived `TEMPLATE_SPECS`/`MEASURE_EXPR`/etc. tree, not just the ingredients
touched directly. See `src/dms/planning/tasks/current/report-graph-vocabulary-picker.md` for the
full procedure this task's Workstream 1 verification used.
