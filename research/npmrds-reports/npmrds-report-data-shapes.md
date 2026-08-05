# NPMRDS report data shapes and inspection gotchas

Field notes for reading/writing NPMRDS report pages (`npmrds_sub|page` + `npmrds_sub|component`
sections + the `reports_snap_2` route snapshot). Every item here cost real time to rediscover at
least once. Verified live against the dev DB on 2026-07-27 unless noted.

Companion docs: `planning/transportny/tasks/current/report-spec-and-build-script.md` (the spec/build-script
task), `reportroutelist-cross-repo-sync.md` (dms-template ↔ transportNY porting).

---

## 1. A section's state is a *stringified* JSON, and there is no `state` wrapper

`data->'element'->'element-data'` is a **JSON string**, not nested JSON. Every jsonb path
expression through it silently returns `NULL` — which reads exactly like "this section has no
state" rather than "you used the wrong operator".

```sql
-- WRONG: returns NULL for every row, no error
SELECT data->'element'->'element-data'->'display'->>'graphType' FROM ...;

-- RIGHT: ->> to get the text, then cast
SELECT (data->'element'->>'element-data')::jsonb->'display'->>'graphType' FROM ...;
```

And the decoded object **is** the state — there is no `.state` key. Its top-level keys are exactly:

```
columns, comparisonSeries, data, display, externalSource, filters, join
```

So it's `element-data`→`display`, not `element-data`→`state`→`display`. This is the same family as
the `stateJson` corruption footgun in `dms raw update --set` (memory
`feedback_dms_raw_update_set_json_string_footgun`): stringified-JSON fields do not behave like
jsonb columns for either reads or writes.

## 2. You cannot enumerate a page's sections via `parent`

`data->>'parent'` on a section is unreliable:

- UI-cloned sections keep the **template page's** parent id, not the page they now live on.
  On report page `2195810`, the ReportRouteList and Spreadsheet sections both had
  `parent = {"id":"2187164",...}` — the template page.
- Some sections have an **empty** `parent` altogether (the overview AVL Graph, `2195807`).

Consequence: `WHERE data->>'parent' LIKE '%<pageId>%'` found 4 of the page's 5 sections *and* 2
orphans that aren't on the page at all — wrong in both directions.

**Use the page row's `draft_sections` array as the source of truth** (and `sections` for the
published set). Note those arrays hold refs carrying only `id`; the section bodies are separate rows:

```sql
SELECT ord, s->>'id' AS section_id
FROM dms_npmrdsv5.data_items p,
     jsonb_array_elements((p.data->'draft_sections')::jsonb) WITH ORDINALITY AS t(s, ord)
WHERE p.id = <pageId> ORDER BY ord;
```

## 3. `reports_snap_2.graphIds` keys on a section's `trackingId`, not its row id

Route instances name their graphs by the section's `trackingId` UUID. Nothing in the section's
`element-data` contains that UUID, so searching the state for it finds nothing.

**Duplicate trackingIds across rows are possible and do occur.** On page `2195810`, orphan sections
`2195819`/`2195820` carry trackingIds byte-identical to in-page sections `2195815`/`2195816`. Since
route wiring keys on trackingId, an orphan is indistinguishable from the live section on the exact
field that matters. Related: memory `project_reportroutelist_graphids_wiped_bug` ("stray dup rows
need cleanup").

When auditing a report, resolve trackingId → row id through `draft_sections` and confirm the row
count per trackingId is 1.

## 4. Two `display` key vocabularies exist — old `graph` vs current `graph_new`

`ui/components/graph/` (legacy) and `ui/components/graph_new/` (current, what AVL Graph sections
render through) read **different display keys for the same visual property**:

| property | legacy `graph` reads | current `graph_new` reads |
|---|---|---|
| margins | `display.margins.marginTop/Right/Bottom/Left` | `display.margin.{top,right,bottom,left}` (`graph_new/theme.js:17`) |
| y value format | `display.yAxis.tickFormat` (`"Integer"`) | `display.yAxis.format` (`"integer"`) (`graph_new/GraphComponent.jsx:209`) |
| x tick thinning | `display.xAxis.tickSpacing` | `display.xAxis.tickDensity` (`graph_new/GraphComponent.jsx:171`) |

Note `yAxis.tickSpacing` **is** still read by `graph_new` (:213) — only the *xAxis* one is dead.

The legacy keys are **inert** on an AVL Graph section: nothing reads them, and their presence looks
like meaningful config. They originate from the **page template's** stateJson (and
`ui/pageTemplates.js:117`, `patterns/page/.../ComponentRegistry/graph/config.jsx:43`), so any
section *cloned from the template* inherits them, while sections composed fresh from
`defaultState` do not.

Proof: template-derived section `2195807` has both `tickFormat` and `marginTop`; Measure-Picker-era
sections `2195815`/`2195816` have neither.

**So a spec-composed section legitimately differs from a template-cloned one by these keys, and the
composed one is the more correct of the two.** Do not "fix" composed output to match.

## 5. `state.data` is a persisted cache of fetched rows — expect thousands

Live section `2195807` had **1,149 rows** of real query results saved into `state.data`, plus a
matching `display.totalLength: 1148`. A freshly composed section must set `state.data = []`
(required — BarGraph does `d3groups(undefined)` and crashes on "values is not iterable"; see
`scripts/npmrds-reports/convert_old_reports.py:4150-4152`).

**Always exclude `data` when diffing a composed state against a live one**, or the diff is ~3,500
noise keys deep. Same for:

- `comparisonSeries.config` — recomputed live from `pageState.filters` by `usePageFilterSync.js`
  every render. The persisted value is a **stale cache**, not what drives a query (memory
  `project_ny9d_difference_graphs_and_epoch_axis_bug`). Absent from composed output by design.
- `externalSource.columns` — the full source column catalog, ~dozens of entries, not report config.

With those three excluded, a real composed-vs-live diff is ~25 keys per side and readable.

## 6. Column *order* differs between UI-built and composed sections

Live UI-built: `[categorize(__series), yAxis(measure), xAxis(epoch)]`.
Composed via `applyMeasurePick`: `[yAxis(measure), xAxis(epoch), categorize(__series)]`.

The set is identical; only order differs. Consumers resolve columns by `target`
(`find(c => c.target === ...)`), so this is believed harmless — but see memory
`graph-new-single-categorize-limit`: charts use `find(categorize)` and silently drop a *second*
categorize column, so anything that starts depending on positional order is a latent hazard.

## 7. `scripts/npmrds-reports/dbq.py` returns **text**, not rows

`dbq.pg(target, sql)` shells out with `-t -A` and returns `stdout` as a string. `r['data']` raises
`TypeError: string indices must be integers`.

Do the shaping **in SQL**, not in Python:

```python
# single column, single row -> parse directly
live = json.loads(dbq.pg('new', "SELECT data->'element'->>'element-data' FROM ... WHERE id=2195807"))

# many rows -> jsonb_pretty / string_agg / json_agg in the query itself
print(dbq.pg('new', "SELECT jsonb_pretty(data::jsonb) FROM ... WHERE ..."))
```

## 8. The DMS CLI writes warnings to stderr on every invocation

Every `dms` call emits `MODULE_TYPELESS_PACKAGE_JSON` warnings (missing `"type": "module"` in
`src/dms/packages/dms/package.json`). Harmless, but **never `2>&1` a `dms ... --format json` call
you intend to parse** — merge the streams and the JSON parse fails on the warning preamble.

Working invocation for the Routes Data catalog, newest first:

```bash
dms dataset query 2107426 --view 2107427 --order id:desc --limit 5 --format json
```

## 9. `preflight.py`'s dms-server-log check false-FAILs on a deprecation warning

`scripts/npmrds-reports/preflight.py` greps the last 200 log lines for `error` and reports FAIL. Node's
`[DEP0169] DeprecationWarning: url.parse() ... prone to errors` contains the substring `errors`, so
a perfectly healthy stack reports:

```
[FAIL] dms-server log   1 error line(s) in last 200: (node:NNNNN) [DEP0169] DeprecationWarning: ...
FAILED: dms-server log
```

Read the quoted line before believing the FAIL. (Also check the log's mtime — memory
`feedback_check_log_staleness_before_citing`.)

## 10. `report_build.mjs --dry-run` stdout is valid JSON (as of 2026-07-27)

It used to print `(--dry-run: nothing written)` on stdout after the JSON array, which broke `jq`
and `json.load`. That trailer now goes to **stderr**. So this works:

```bash
node scripts/npmrds-reports/report_build.mjs <spec>.json --dry-run 2>/dev/null | jq '.[].key'
```

Keep it that way: any future human-facing line in a machine-readable mode belongs on stderr.
