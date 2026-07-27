# Report spec format

The declarative input to `scripts/npmrds-reports/report_build.mjs`: one JSON file describing an NPMRDS report page
— its routes, its graphs, and which routes feed which graphs — that the script turns into a live
DMS page plus a `reports_snap_2` route-snapshot row.

Companion docs: `npmrds-report-data-shapes.md` (how the resulting rows are shaped, and the
inspection gotchas), `../../planning/tasks/current/report-spec-and-build-script.md` (the design
record and progress log).

---

## Why a spec

**The parity guarantee.** Graph state is composed by calling the same `applyMeasurePick`
(`src/themes/transportny/components/MeasurePicker/index.js`) that the UI's Measure Picker calls —
the script is a third caller, not a reimplementation. So CLI-built and UI-built sections are
identical by construction, and "does the UI have feature parity?" reduces to the checkable question
"is there a control for each spec field?" rather than a comparison of two implementations.

Verified 2026-07-27: all three AVL Graph rows written by the first live build were byte-identical to
the `--dry-run` composed states, and a composed state diffed cleanly against a live UI-built section.

**Turning silent failures into declared data.** Three of the UI click-path's failure modes are
invisible when they happen — a graph-assignment pill that doesn't register, a measure pick lost
because Save wasn't clicked, and a difference graph whose anchor arm is whichever route instance
happened to be added first. In a spec these are all explicit fields, and `graphIds` is *computed*
from `routes[].graphs`, so the assignment class cannot silently fail.

**A reviewable intermediate representation.** `request` and per-graph `why` record the client ask
and the reasoning that turned it into these particular graphs, so an inferred report can be
corrected before anything is built.

---

## Top-level fields

| field | required | meaning |
|---|---|---|
| `title` | yes | Page title, and the `name` on the `reports_snap_2` row. |
| `slug` | no | Full page slug. Defaults to `<parent>/<title slugified>`. |
| `parent` | no | Slug of the parent page. Defaults to `converted_reports`. Must already exist. |
| `description` | no | Written to the snap row's `description`. |
| `request` | no | The literal client ask, verbatim. Printed by `--summary`, stored on the snap row as `_client_request`. |
| `graphs` | yes | Non-empty array — see below. |
| `routes` | yes | Non-empty array — see below. |

The snap row also records `_built_from_spec` (the spec's path) automatically.

## `graphs[]`

| field | required | meaning |
|---|---|---|
| `key` | yes | Spec-local identifier, unique. Referenced by `routes[].graphs` and `graphs[].anchor`. Never written to the DB. |
| `graphType` | yes | `BarGraph` \| `LineGraph` \| `GridGraph`. |
| `measure` | yes | A vocabulary measure — see the enum note below. |
| `resolution` | yes | `5-minutes` \| `15-minutes` \| `hour` \| `day` \| `weekday` \| `month`. |
| `title` | no | Sets both the section row's `title` and `display.title.title`. |
| `comparisonMode` | no | `plain` (default) — each assigned route renders as its own series — or `difference`. |
| `anchor` | difference only | A `routes[].id`. Names the arm the others are subtracted *from*. |
| `size` | no | Colspan, `"1"`–`"12"`, written as the section row's own `size` field. |
| `why` | no | Free text: why this graph answers part of the request. Printed by `--summary`, never written. |

**Enums are validated at runtime against the live vocabulary**, not against this table — a typo
fails loudly at compose time rather than producing a silently empty graph. Current measures:
`travelTime`, `speed`, `speedTruck`, `hoursOfDelay`, `avgHoursOfDelay`, `co2Emissions_passenger`,
`co2Emissions_truck`, `avgCo2Emissions_passenger`, `avgCo2Emissions_truck`. The authority is
`data-types/npmrds_graph_vocabulary/vocabulary.json` (measures, resolutions) and
`GRAPH_TYPE_OPTIONS` in `MeasurePicker/composeMeasureConfig.js`; if a build rejects a value, read
those rather than this list.

## `routes[]`

Each entry is a route **instance** — a catalog route plus a date window. Two instances routinely
share one `route_id` and differ only by window; that is how before/after comparisons are expressed.

| field | required | meaning |
|---|---|---|
| `id` | yes | Spec-local identifier, unique. Referenced by `routes[].graphs` targets and `graphs[].anchor`. Never written. |
| `route_id` | yes | The route's DMS id in the Routes Data catalog (source `2107426` / view `2107427`). Resolved at build time to pull its `tmc_array`. |
| `name` | yes | The series label. See the duplicate-name rule below. |
| `graphs` | yes in practice | Array of `graphs[].key`. Empty means this instance feeds nothing — the build warns and fails the structural check. |
| `startDate` | no | Inclusive window start. Omit both dates for all available data. |
| `endDate` | no | Window end. |
| `color` | no | Series color, hex. |
| `weekdays` | no | Day mask — see the semantics below. |

---

## Semantics that are easy to get wrong

### Route names are the only series discriminator

`name` is what becomes the server's SQL alias and the client's legend/color key. **Two instances
sharing a name collapse into one series.** The script auto-suffixes duplicates (`… (2)`) and warns,
matching what ReportRouteList does on add — but a report whose two arms silently merged is the
failure this prevents, so prefer distinct names in the spec.

### The weekday mask excludes only on an explicit `false`

Per `useGraphPublish.js:34`, an **absent** key means the day is *included*. So:

```json
"weekdays": { "saturday": false, "sunday": false }
```

means Monday–Friday, not "only Saturday and Sunday excluded from nothing". An empty or absent
`weekdays` means all seven days. (Easy to read backwards — it was, on the first pass.)

`weekdays` has **no UI control** today; the runtime honors it regardless, so a spec can express it
and the Measure Picker cannot. It is the cheapest available parity win.

### Difference graphs: anchor and sign

A difference graph returns **anchor − other**. The server treats `seriesVariants[0]` — the first
assigned route in `routes` array order — as the anchor, and the UI exposes no control for this at
all. Naming `anchor` explicitly lets the spec fix the sign without reordering:

- anchor is the **first** assigned route → nothing special, `combine.invert` stays unset (so the
  state stays byte-identical to what the UI would produce).
- anchor is the **second** of exactly two arms → the script sets `comparisonSeries.combine.invert:
  true`, flipping the subtraction rather than reordering the routes array.
- anchor is arm #3+ of more than two → hard error with a fix hint. Reorder `routes` so the anchor
  comes first.

Omitting `anchor` on a difference graph is allowed but warns, and defaults to the first assigned
route.

**Known wart, not a spec-build defect:** the default difference palette maps green→lowest and
red→highest, so for `before − after` on travel time a *positive* bar (travel time fell — the
improvement) renders **red**. Spec-built and hand-built sections are byte-identical here, so this is
a Measure Picker default, tracked in the task file. It needs a per-measure polarity hint in the
vocabulary — the same mechanism `duration-value-format-mm-ss.md` needs.

### `resolution` is per-graph today, and that is expected to change

In the old tool, resolution is a property of the *attached route*
(`GeneralGraphComp.getResolution()` reads `activeRouteComponents[0].settings.resolution`) and is
read at render time. Deriving it dynamically is explicitly deferred in the report-page-redesign
findings. So `graphs[].resolution` is the current shape, **not the settled one** — expect it to
migrate to `routes[]`. Don't build anything that depends on it staying where it is.

---

## Modes

```bash
node scripts/npmrds-reports/report_build.mjs <spec.json> --summary   # plain-language review; no writes, no Vite boot
node scripts/npmrds-reports/report_build.mjs <spec.json> --dry-run   # compose every graph's state and print it; no writes
node scripts/npmrds-reports/report_build.mjs <spec.json>             # build, draft only
node scripts/npmrds-reports/report_build.mjs <spec.json> --publish   # also create published section copies
```

`--summary` is the review step for an inferred report: it renders the request, every route instance
with its window and weekday mask, and every graph with its mode, arms and `why` — enough to catch a
wrong date window or a mis-assigned arm before anything is written.

`--dry-run`'s **stdout is valid JSON** (the human-facing trailer goes to stderr), so it pipes:

```bash
node scripts/npmrds-reports/report_build.mjs <spec>.json --dry-run 2>/dev/null | jq '.[].key'
```

Working specs live in `scratchpad/npmrds-sub/report-specs/`.

---

## What the build checks, and what it doesn't

Three layers, and only the first two are decided here.

1. **spec → composed state.** Guaranteed by construction (the real `applyMeasurePick`), and
   inspectable with `--dry-run`.
2. **composed state → written row.** The structural checks run on every build: no route instance
   with empty `graphIds`, no graph nothing feeds, and per graph `display.fetchMode: "force"`,
   `comparisonSeries.enabled`, and the `$self`-bound `comparison_series` subscriber — the three keys
   whose absence makes a section render empty rather than error. A build with problems exits `1`.
3. **written row → what the page renders.** *Not checked.* Deliberately: failures at this layer are
   platform bugs rather than build bugs — both prerequisites folded into this work
   (`epoch-time-format-bucket-width`, `length-query-calculated-groupby-alias`) had a correct
   composed state and a broken page.

For layer 3, run the probe:

```bash
node scripts/npmrds-reports/report_probe.mjs <slug>                  # published pages
node scripts/npmrds-reports/report_probe.mjs edit/<slug> --auth      # draft-only pages (a page with published='draft'
                                                      # legitimately renders nothing at its public URL)
```

A spec-aware assertion mode (`report_probe.mjs --expect <spec.json>` — asserting each graph fired a
`/graph` request and returned as many series as it has assigned route instances) is **deferred**, not
missing; see the task file for the trigger.

---

## Example

```json
{
  "title": "NY-9D Beacon Signal Study - Travel Time Comparison",
  "slug": "converted_reports/ny9d_beacon_spec_test",
  "request": "City of Beacon wants to document how the actuated signals installed ~March 2025 improved congestion on NY-9D through Beacon. Compare Jan/Feb 2025 (before) against Jan/Feb 2026 (after).",
  "graphs": [
    { "key": "overview", "title": "Travel Time - all periods",
      "graphType": "LineGraph", "measure": "travelTime", "resolution": "5-minutes",
      "comparisonMode": "plain",
      "why": "One overlaid trace per direction and period, so the client can see the peak shape shift." },
    { "key": "nb_diff", "title": "Northbound Travel Time Difference",
      "graphType": "BarGraph", "measure": "travelTime", "resolution": "5-minutes",
      "comparisonMode": "difference", "anchor": "nb_before",
      "why": "Before minus after per bucket. Positive bars mean travel time fell." }
  ],
  "routes": [
    { "id": "nb_before", "route_id": 2195805,
      "name": "NY-9D Northbound (I-84 to Main St) - Jan-Feb 2025",
      "startDate": "2025-01-01", "endDate": "2025-02-28",
      "color": "#D72638", "weekdays": { "saturday": false, "sunday": false },
      "graphs": ["overview", "nb_diff"] },
    { "id": "nb_after", "route_id": 2195805,
      "name": "NY-9D Northbound (I-84 to Main St) - Jan-Feb 2026",
      "startDate": "2026-01-01", "endDate": "2026-02-28",
      "color": "#007F5F", "weekdays": { "saturday": false, "sunday": false },
      "graphs": ["overview", "nb_diff"] }
  ]
}
```

Note both route instances share `route_id: 2195805` — same corridor, different window. That is the
before/after idiom.
