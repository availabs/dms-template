# Route Info Box "speed" measure bucket + Relative date support — scoping (2026-08-04)

Scoping pass requested by Ryan against two items flagged (not started) in
`planning/transportny/tasks/current/dynamic-reports-and-route-tags.md`'s old-template-porting thread: the
Route Info Box "speed" measure gap (14/23 candidates in the original coverage cross-check) and
relative-date (`{recent-N}`) support (deferred 2026-08-03, "eventually, not right now"). Both
block a majority of the 22 old-template-porting candidates not yet converted. Read-only
investigation — direct source reading (`convert_old_reports.py`, transportNY's real old
components) + live dry-runs against all 22 remaining candidates via `convert_template(...,
dry_run=True)`. Nothing built.

**Headline finding for both:** the task file's existing characterization of each gap is partially
wrong in ways that change the recommended fix. Info Box's "speed" gap is mostly *not* a missing
measure bucket (it's the same bin-ambiguity data-coverage wall round 40 already diagnosed in July),
and the one genuine missing-bucket case is cheaper than assumed. Relative dates are two different
old-tool mechanisms, one of them (the common one) essentially unrecognized by today's converter, and
the fix should ride the existing `derived-page-variable` primitive rather than being built from
scratch.

---

## Part 1 — Route Info Box "speed" measure bucket

### What's built today

`convert_old_reports.py` maps `("Route Info Box"/"TMC Info Box", measure, dataColumn)` onto 5
buckets (`INFO_BOX_SPEC_MEASURES = ("reliability", "travelTime", "length", "aadt",
"hoursOfDelay")`, lines 4016-4023), each gated on `dataColumn == "travel_time_all"` specifically:
`INFO_BOX_BUCKET = ("speed", "travel_time_all")` → reliability (LOTTR/TTTR/Freeflow via the 1410
pgFederated join), plus 4 static buckets built round 40. Anything whose `(measure, dataColumn)`
doesn't match one of these 5 falls through to a generic `unmapped_graph`/"no template mapping" gap
(`convert_old_reports.py:4919-4922`).

### Ground truth: ran the real dry-run against all 22 remaining candidates

`python3 convert_old_reports.py --template-id <id> --dry-run` for every candidate not yet
converted (`77, 110, 131, 132, 164, 165, 207, 210, 211, 228, 239, 245, 246, 247, 252, 260, 276,
278, 279, 281, 283, 291`), reading the real `gap report` each run emits — not the static
`analyze_report()` coverage table the 2026-08-03 pass relied on. Full per-candidate gap-kind tally
in the Appendix. Result: **the "14/23 Route Info Box speed" gap is not one thing.** Across the 22:

- **Only 1 candidate (`110`, "Freight Bottlenecks") has the genuine missing-bucket gap**:
  `{"graph_type": "Route Info Box", "measure": "speed", "resolution": "5-minutes", "dataColumn":
  "travel_time_truck", "reason": "no template mapping"}`. `INFO_BOX_BUCKET` only covers
  `dataColumn == "travel_time_all"` — a comp configured for the truck-only data column has no
  bucket at all, same as `90`'s pre-fix Line Graph gap.
- **6 candidates (`164, 165, 210, 211, 228, 252`) hit `info_box_bin_undetermined`** — not a missing
  bucket at all. Pulled the real route_comps for `165` directly (`dbq.py old`): every assigned
  comp has `amPeak: true, offPeak: true, pmPeak: true, startTime: "07:00", endTime: "19:00"` — the
  old tool's "all three peaks on" / whole-day setting. This is **exactly** the case round 21
  already documented as having no precomputed 1410 bin at all (`RELIABILITY_BIN_BY_PEAK_FLAG`
  only has 3 entries; all-three-true isn't one of them) — and **exactly** the "permanent
  data-coverage wall, not a capability gap" round 40 already concluded when it checked this same
  lever in July (`old-reports-conversion-archive.md:1674-1683`: "Info Box `speed` is the
  ALREADY-BUILT LOTTR/TTTR/Freeflow reliability bucket... gated by 1410's real 2021-2025 coverage +
  4-bin granularity... That lever is a permanent data-coverage wall... not a capability gap"). The
  2026-08-03 scoping pass re-surfaced the same lever round 40 already ruled out, without
  re-checking it against real comp settings first. **No new join/expression fixes this** — the only
  paths are a data-pipeline change (does 1410 or a sibling source publish an all-day/no-restriction
  bin? — a DAMA/avail-falcor question, outside this codebase) or reversing round 21's explicit
  "never curve-fit an approximate answer" decision. Not recommended to chase in code.
- **5 of those 6 (`165, 210, 211, 228, 252`) also carry a separate, unrelated gap** — `Route Line
  Graph`/`travelTime`/`day` and `Bar Graph Summary`/`avgTT-byDateRange`/`5-minutes`, both
  "no template mapping." Different graph types, different measures — a third gap cluster, not
  examined further here (out of scope for this pass).
- **The remaining candidates' apparent "Info Box" involvement turned out to be the relative-date
  problem in disguise** — see Part 2. `77, 132, 207, 245, 247, 260` show `route_map_no_year` and/or
  `info_box_year_undetermined`, both symptoms of `graph_max_year()` finding zero parseable dates,
  which is what happens when every assigned comp's date is a `{recent-N}` placeholder string, not
  an 8-digit literal.
- **`131`'s 5 unmapped graphs are unrelated to both topics** (Traffic Volume Graph/`vmt`, TMC
  Difference Grid + Route Bar Graph ×2 + Route Difference Graph, all `avgCo2Emissions`) — a
  separate CO₂/VMT gap cluster.

**So: fixing the Info Box "speed"/truck gap cleanly unlocks exactly 1 of the 22 remaining
candidates (`110`) outright.** The other 6 "Info Box" candidates are blocked by a data-coverage
wall that more code can't fix, and several more candidates that *looked* like Info Box gaps are
really relative-date gaps.

### Is the "reliability" substitution itself correct? — a real, separate finding

Traced whether `("speed", "travel_time_all") → reliability` faithfully replicates what the old
tool actually showed. Read the real old source directly (not inferred):
`transportNY/.../tmc_graphs/RouteInfoBox.jsx` + its `utils/dataTypes.js`. Old `BASE_DATA_TYPES`'s
`speed` entry (`dataTypes.js:71-73`) has **no `group`** field, so `RouteInfoBox.jsx`'s
`generateGraphData` switch (line 73-84) routes it through `default` → `speedAllReducer` — a
**plain length-weighted average speed calculation** (`toSpeed(sum(byTmc travel times), totalMiles)`
), the same math `SPEED_EXPR` already implements. **Nothing in `dataTypes.js`, `RouteInfoBox.jsx`,
or `TmcInfoBox.jsx` references LOTTR/TTTR/1410/pm3 at all** — confirmed by grepping the entire old
`pages/analysis/` tree (the Report Builder) for `lottr`/`tttr`: zero hits. Those terms only appear
in a completely different, unrelated part of the old app (`pages/pm3Map21/`, `pages/TmcPage/` — a
separate PM3/MAP21 viewer and per-TMC detail page, never part of the Report Builder / Info Box
component).

Read the archive's own round-13/14/15/17/18 history (`old-reports-conversion-archive.md`) to
understand how the reliability substitution came to be keyed on "speed" anyway:
- **Round 13** (the original Info Box scoping) explicitly separated `speed`/`travelTime`
  (`BASE_DATA_TYPES`, "already have ClickHouse equivalents... no new data dependency") from the
  **`indices`/`indices-byDateRange`** group (bufferTime/planningTime/miseryIndex/travelTimeIndex/
  freeflow/percentile95/97 — genuine FHWA-style reliability indices, gated on a then-missing
  `pm3.authoritative_freeflow` table) — "speed" was never the hard part.
- **Round 15-17** investigated a fix for the `indices` group specifically, eventually landing on
  1410's LOTTR/TTTR/`speed_pctl_85` as a "surface current/correct" substitute (round 17's explicit
  **product decision**, deliberately *not* a faithful replica of the old ad hoc percentile math).
  This decision was scoped to the `indices` family.
- **Round 18** built the actual template and wired it into `GRAPH_TEMPLATE_MAP` under the key
  `("Route/TMC Info Box", "speed", ...)` — reusing "speed" (the `DEFAULT_DISPLAY_DATA` fallback
  measure for an Info Box with no explicit `displayData`) as a convenient trigger, without it being
  re-examined against round 13's own finding that literal "speed" was the *cheap, already-available*
  measure, not the one needing a new join.

Net: **the current reliability bucket is a deliberate, working, valued enrichment for reports
that want LOTTR/TTTR (round 18 verified real reports asking for exactly that) — but it's wired to
fire on the same key ("speed") that a real old Info Box configured with no explicit measure (or an
explicit "Speed" choice) would have shown as a plain average-speed number, not reliability ratios.**
Not raising this to argue for reverting round 17 — it's shipped, working, and valued — flagging it
because it directly changes the fix for `110`'s gap:

### Recommended fix for `110`'s genuine gap

Build `("speed", "travel_time_truck")` (and, if it ever appears, `"travel_time_passenger"`) as a
**plain average-truck-speed bucket via the already-proven `SPEED_EXPR_TRUCK`** (same expression
`90`'s Line Graph fix used, 2026-08-04) — matching what the real old code computes for this
measure, not a truck-specific LOTTR/TTTR join. This is the cheap path, consistent with round 13's
original (correct) analysis. Checked whether source 1410 even has a truck-specific LOTTR/TTTR
breakdown to build the "expensive" version if that were wanted instead:
`documentation/npmrds-data-sources.md` (line 147) confirms 1410 has all-vehicle-vs-truck PHED/TED
columns but **no truck-specific `lottr_*`/`tttr_*` columns** — so a truck-specific *reliability*
bucket isn't a "new join" so much as possibly not buildable from this source at all. The
plain-truck-speed fix sidesteps that question entirely and is the same shape as the one already-shipped
truck fix.

**Effort: small.** One new static template (mirroring `_ensure_static_info_box_template`'s existing
helper, same family as `length`/`aadt`), one new `GRAPH_TEMPLATE_MAP`-style bucket constant, wired
the same way as the 4 round-40 buckets. Unlocks `110` only (1 candidate) — the bin-ambiguity wall
(6 candidates) isn't fixed by this or any other code change on this side of the stack.

---

## Part 2 — Relative date support

### Two different old-tool mechanisms, not one

**Mechanism A — `{recent-N}` string substitution.** A literal placeholder embedded inside an
otherwise-fixed `YYYYMMDD` string on a route comp's `settings.startDate`/`endDate`, e.g. template
`207`'s real comps: `"startDate": "{recent-0}0101", "endDate": "{recent-0}1231"` (this year) and
`"startDate": "{recent-1}0101"` (last year, on its "Compare Year" comp). `N` ranges 0-6 in the real
corpus (confirmed via `regexp_matches` over all templates). No `relativeDate`/
`useRelativeDateControls` field is present alongside it — this looks like simple author/template
convenience text, resolved (in the old tool) by substituting the current year minus `N` for the
placeholder, then presumably reused as-is by whatever consumed the field.

**Mechanism B — `relativeDate` + `useRelativeDateControls`, a real UI feature with its own moment.js
DSL — relative to a designated *base route/comp*, not to wall-clock today.** Found the
authoritative implementation, verbatim: `transportNY/.../reports/store/utils/relativedates.utils.js`
for the date math, `store/index.js:485-546` (+ a parallel per-`route_group` version, `548-597`) for
how it's actually invoked, `components/Sidebar/components/AdvancedControls.jsx:270-282` for the
authoring UI. **Correcting my own first read of this** (caught by Ryan): I initially described this
as operating on "the comp's own currently-stored startDate/endDate" — wrong. The real mechanism:

1. Exactly one comp per report (or per nested route-group, independently) is flagged
   `settings.isRelativeDateBase: true` via a plain checkbox in the date-settings panel ("Set as
   relative date base," `AdvancedControls.jsx:273-281` — `onChange={v =>
   updateSettings("isRelativeDateBase", v)}`). That comp's own `startDate`/`endDate` are ordinary,
   author-set literal dates — no formula.
2. `store/index.js`'s reducer walks every comp, finds the one flagged as base, then recomputes
   **every other comp's** `startDate`/`endDate` via `calculateRelativeDates(otherComp.settings.
   relativeDate, baseComp.startDate, baseComp.endDate)` (`store/index.js:508-546`) — i.e., the
   formula input is the *base comp's* dates, not the comp's own prior value and not today's real
   date at all. This reruns live, in-app, whenever any comp's settings change — edit the base
   comp's date range once and every comp with a `relativeDate` formula recomputes automatically.
3. Full formula spec:
   `RELATIVE_DATE_REGEX = /^(startDate|endDate)=>(?<span>(?:day|week|month|year)(?:of)?)(?:([+-])(\d+)\k<span>->(\d+)\k<span>)?$/`
   — **"Special" form** (`dayof`/`weekof`/`monthof`/`yearof`, e.g. `"startDate=>yearof"`): snap the
   *base comp's* date range out to the full containing day/week/month/year. **General form** (e.g.
   `"startDate=>year-2year->1year"`): "the 1-year span starting 2 years before the year containing
   the *base comp's* startDate" — offset `amount` spans back from the base, then extend `duration`
   spans forward.

Real example confirmed on template `278`'s route comps: `"2023 - AM Peak..."` →
`relativeDate: "startDate=>year-0year->1year"`, `"Day of Week - 2023..."` →
`relativeDate: "startDate=>yearof"` — both computed against whichever *other* comp in `278` is
flagged as the base (its "2024 - Rochester Inner Loop 2" comp, the one with a plain literal date
and no `relativeDate` of its own).

**Why this matters more than the raw usage count suggests, for Dynamic Reports specifically.**
Ryan's point, and it's a real one: this mechanism isn't "relative to today" at all — it's "relative
to whatever date range one designated comp/route ends up with," and that base comp's date is just
an ordinary field an author (or, composed with Mechanism A, a `{recent-N}` placeholder) sets. For a
**Dynamic Report**, the base comp's date doesn't have to come from an author or from today —
it can come from **whatever the viewer picks when filling that route slot**, exactly the same
input Dynamic Reports already resolve at view time. A report shaped like "pick one route/period,
see it plus automatic prior-year / day-of-week breakdowns" — matching what `278`/`246`/`291` are
actually doing — is a first-class Dynamic Reports use case, not an edge case, regardless of how
rarely the old corpus used it. This reframes Mechanism B from "rare legacy feature, low ROI" to
"the more natural fit for how Dynamic Reports actually work" — see the revised recommendation
below.

### Real usage counts (queried directly, not estimated)

| | Mechanism A (`{recent-N}`) | Mechanism B (`relativeDate`) |
|---|---|---|
| `admin2.templates` (216 total) | **37** | **19** |
| `admin2.reports` (869 total, already fully converted) | **13** | **0** |

Mechanism B is real (round-trippable, has a whole dedicated old-tool UI component,
`RelativeDateControls.jsx`) but rare — used in fewer than 1 in 10 templates and **zero** already-shipped
real reports. Mechanism A is 3x more common in templates and also affects a real (if small) slice of
the main, already-"fully converted" report corpus — 13 of 869 reports have a `{recent-N}` string
sitting in a comp date field today, meaning those 13 reports' dates were never actually resolved by
the existing pipeline (see next section).

### Why today's converter doesn't clearly flag Mechanism A

`route_settings_gaps()` (`convert_old_reports.py:1803-1805`) explicitly gap-logs Mechanism B
(`if settings.get("relativeDate"): gaps.append({"kind": "relative_date", ...})`) — but has **no
equivalent check for a `{recent-N}` substring inside `startDate`/`endDate`.** Those strings instead
silently fail the generic 8-digit-numeric check every date consumer uses
(`graph_max_year()`: `len(s) == 8 and s.isdigit()`), leaving `years` empty → `None`, which cascades
into confusing, indirectly-labeled gaps depending on which graph type needed the year:
`route_map_no_year` ("no parseable comp dates to pick a geometry network year") or
`info_box_year_undetermined` ("no assigned comp has a startDate/endDate"). This is exactly why the
2026-08-03 pass mischaracterized `207`'s Route Map failure as a one-off and didn't connect it to a
broader pattern — the gap message never says "relative date," it says "no date at all."

### Systematic recheck: how many of the 22 remaining candidates are actually blocked by this

Cross-referencing the live dry-run tally (Appendix) against the two corpus queries above: **13 of
the 22 remaining candidates (59%) are blocked wholly or partly by one of these two mechanisms** —
more than the task file's own hand-sampled estimate of ~9:

- Mechanism A (via `route_map_no_year`/`info_box_year_undetermined`): `77, 132, 207, 245, 247, 260`
- Mechanism B (explicit `relative_date` gap): `246, 276, 278, 291`
- Mechanism B via a nested `type: "group"` route comp (grouped/multi-route entries flatten to
  individual comps — one of which carries `relativeDate` — confirmed live via dry-run, not yet
  traced to the exact nested JSON path): `279, 281, 283`

No candidate uses both mechanisms. This is the single highest-leverage item across the remaining
old-template-porting work — bigger than the Info Box gap in Part 1.

### Recommended architecture: extend `derived-page-variable`, don't build a parallel mechanism

The existing `applyDerivedPageVariables`/`PAGE_VARIABLE_DERIVATIONS` primitive
(`src/dms/planning/tasks/current/derived-page-variable.md`, shipped 2026-07-29, `_utils/index.js:
509-557`) is architecturally the right foundation:

- Already a **named, closed function registry** (`PAGE_VARIABLE_DERIVATIONS = {yyyy: v =>
  String(v).slice(0,4)}` today) resolved at **view time**, re-derived on every navigation
  (`updatePageStateFiltersOnSearchParamChange`) — not baked in at author/conversion time. This is
  exactly the "resolve live, never persist a stale value" property relative dates need (a Dynamic
  Report page is viewed indefinitely; a date frozen at conversion time would go stale the same way
  a hardcoded date does today).
- Deliberately **not an expression language** ("a small named registry... avoids inventing a
  formula language") — the right constraint for `{recent-N}`, which is itself just one function
  (`thisYear - N`) parameterized by an integer, not a general formula need.
- **What's missing today**: every derivation currently computes from *another page variable's
  current value* (`derivedFrom`). There is no "derive from the real wall-clock date" source at
  all — `{recent-N}` needs `now`, not another field.

**Revised: two orthogonal axes, not one tier ladder.** What varies between Mechanism A and
Mechanism B isn't just "how rich is the function" — it's **what the derivation's input is**:

|  | input source | function richness |
|---|---|---|
| Mechanism A (`{recent-N}`) | wall-clock "now" | one function: subtract N years |
| Mechanism B (`relativeDate`) | another comp's *resolved* date (the base) | full day/week/month/year snap + offset/duration |

Both need the same kind of plumbing extension (a new input source for `PAGE_VARIABLE_DERIVATIONS`-
style resolution) but they're serving different report shapes: A is for "always show the current
year, no matter who's viewing," B is for "derive from whatever date the viewer/author set on one
particular row." Given the Dynamic Reports finding above, **B is arguably the higher-value target
for this arc specifically**, independent of its lower historical usage count — it's the one that
composes with viewer-picked route slots. Which to build first (or whether both are worth building
now) is a real product call, not something to default on the old corpus's raw usage numbers alone:

- **"Now" as an input source** (serves Mechanism A): small addition — one function, one new input
  kind for the existing `derive` registry.
- **"Another row's resolved value" as an input source, with the fuller snap/offset function set**
  (serves Mechanism B): the input-source half is close to free — `derivedFrom` already means
  "another row's value" in the page-variable version, it would just need to point at an RRL route
  row instead of a page filter (the same NPMRDS-specific plumbing Part 2 already calls for either
  way). The function-set half (day/week/month/year snapping + offset/duration parsing, matching
  `RELATIVE_DATE_REGEX` exactly) is the genuinely bigger lift of the two axes, regardless of which
  input source it's paired with.

Recommend Ryan weigh in on which report shapes matter more before committing to a build order —
this doc found the mechanism and the fit, not which one to build first.

**The second, separate integration point: this doesn't live on `page.filters` at all.** NPMRDS
route dates live on `ReportRouteList`'s own per-route-row settings (confirmed:
`RouteRow.jsx:124-232` — plain `r.startDate`/`r.endDate` strings edited via `<input type="date">`,
no formula concept, not page-level filters). `applyDerivedPageVariables` operates on `page.filters`,
which is the wrong layer for this — RRL rows aren't page variables. The realistic shape: a route
row gains a formula mode instead of a literal `startDate`/`endDate` — either `{relativeYear: -N}`
(Mechanism A: derive from now) or `{derivedFromRow: <compId>, derive: "yearof"}` (Mechanism B:
derive from whichever row is the base, mirroring `derivedFrom`+`derive`'s existing shape one level
down) — and a new resolution step, conceptually identical to `applyDerivedPageVariables` but scoped
to RRL's row data, runs wherever `useDynamicReportRoutes.js`/`useReportRow.js` currently reads a
route's stored dates before they reach `comparisonSeries`. Resolving to a concrete `YYYYMMDD`
**before** `graph_max_year()`/`graph_reliability_bin()`/etc. ever run means none of those downstream
functions need to change at all — they already correctly consume a literal date, they just need to
be handed one instead of a placeholder string. `convert_template()` gets a matching Python-side
change: recognize `{recent-N}` and `isRelativeDateBase`/`relativeDate` and emit the corresponding
formula shape into a route slot's settings instead of gap-logging or silently failing.

**Effort: moderate for either axis, larger if both.** The view-time/named-registry/no-persistence
*architecture* already exists and is proven (11 unit tests, one live production consumer) — that
part doesn't need reinventing regardless of which axis gets built. What's genuinely new either way:
threading a resolution step through RRL's route-row data path (RRL rows aren't page filters, so
this is new NPMRDS-specific plumbing, not a direct reuse of `applyDerivedPageVariables`) plus the
matching `convert_template()` recognizer. Beyond that shared cost, Mechanism A adds one small
function; Mechanism B adds the fuller snap/offset function set (the bigger of the two deltas) and a
UI concept for designating which row is the base.

---

## Cross-cutting note

Both parts of this scoping pass converge on the same underlying mechanical fact:
`graph_max_year()`'s date-parsing is silent (returns `None` on anything that isn't an 8-digit
numeric string) rather than diagnostic. Resolving relative dates to a concrete `YYYYMMDD` earlier
in the pipeline — regardless of which axis (Mechanism A, B, or both) ends up built — would likely
also clear up several currently-confusing `route_map_no_year`/`info_box_year_undetermined` gaps
that today look unrelated to each other and to relative dates specifically, simply because the gap
message doesn't say what actually went wrong.

## Recommendation

**Updated after Ryan's correction on Mechanism B (see revised Part 2 sections above).** Still
confident on the shape of both problems and on relative dates being the bigger lever overall; not
settling the Mechanism A vs. B build order here — that's a real product call about which report
shapes matter more (always-current-year vs. derive-from-a-picked-row), not something the old
corpus's usage counts alone should decide now that Dynamic Reports change the calculus.

- **Relative dates are still the single highest-leverage item** (13 of 22 remaining candidates)
  and worth doing before `110`'s Info Box fix (1 candidate) — that ordering hasn't changed.
- **Within relative dates, get Ryan's steer on Mechanism A vs. B (or both) before implementing** —
  see the "two orthogonal axes" table above.
- `110`'s cheap truck-speed Info Box fix: still recommended, still small, still unlocks exactly 1
  candidate.
- **The Info Box bin-ambiguity wall (6 candidates) is explicitly parked, not dropped, per Ryan's
  steer (2026-08-04): it's a real, eventually-fixable data-layer gap** (1410 would need to publish
  a precomputed "all hours"/no-time-restriction reliability bin, or an equivalent, alongside its
  existing amp/midd/pmp/we bins) **but is its own separate thread from the rest of the reports
  work, not a priority, and shouldn't get bundled into report-conversion prioritization or
  re-investigated as if it were still an open question here.** Whoever eventually looks at 1410's
  publish pipeline (DAMA/avail-falcor side, not this codebase) should know the demand is real:
  every one of the 6 blocked candidates uses the old tool's "all three peaks on, 07:00-19:00"
  setting, so a single new bin would very likely clear most or all 6 at once.

## Appendix — full dry-run gap tally, all 22 remaining candidates (2026-08-04)

Ran `python3 convert_old_reports.py --template-id <id> --dry-run` for each; counts are real gap
items from that run's own gap report, not the static coverage table. Cosmetic-only kinds
(`extra_measures_dropped`, `color_range`, `route_group_flattened`) omitted below where a candidate
also has a blocking kind; blocking kinds only shown.

| id | blocking gap kinds (count) | primary blocker |
|---|---|---|
| 77 | info_box_year_undetermined(1), route_map_no_year(1), unmapped_graph(1, unrelated) | relative date (A) |
| 110 | unmapped_graph(2, both Info Box/speed/truck) | **Info Box truck bucket** |
| 131 | unmapped_graph(5, VMT/CO₂, unrelated) | other (out of scope) |
| 132 | route_map_no_year(1), unmapped_graph(1, unrelated) | relative date (A) |
| 164 | info_box_bin_undetermined(2) | bin ambiguity (wall) |
| 165 | info_box_bin_undetermined(2), unmapped_graph(2, unrelated) | bin ambiguity (wall) + other |
| 207 | route_map_no_year(1), unmapped_graph(2) | relative date (A) |
| 210 | info_box_bin_undetermined(3), unmapped_graph(2, unrelated) | bin ambiguity (wall) + other |
| 211 | info_box_bin_undetermined(2), unmapped_graph(2, unrelated) | bin ambiguity (wall) + other |
| 228 | info_box_bin_undetermined(2), unmapped_graph(2, unrelated) | bin ambiguity (wall) + other |
| 239 | info_box_bin_undetermined(1), unmapped_graph(3) | bin ambiguity (wall) + other |
| 245 | info_box_year_undetermined(4), route_map_no_year(2), unmapped_graph(2, unrelated) | relative date (A) |
| 246 | relative_date(5), info_box_bin_undetermined(2), unmapped_graph(1) | relative date (B) |
| 247 | route_map_no_year(3), unmapped_graph(1) | relative date (A) |
| 252 | info_box_bin_undetermined(3), unmapped_graph(2, unrelated) | bin ambiguity (wall) + other |
| 260 | route_map_no_year(1), unmapped_graph(1) | relative date (A) |
| 276 | relative_date(7), info_box_bin_undetermined(1) | relative date (B) |
| 278 | relative_date(9) | relative date (B) |
| 279 | relative_date(2), info_box_bin_undetermined(1) [route_group_flattened(2)] | relative date (B, nested) |
| 281 | relative_date(2), info_box_bin_undetermined(1) [route_group_flattened(2)] | relative date (B, nested) |
| 283 | relative_date(2), info_box_bin_undetermined(1) [route_group_flattened(2)] | relative date (B, nested) |
| 291 | relative_date(7), info_box_bin_undetermined(1) | relative date (B) |

Raw dry-run logs preserved this session at
`/home/ryan/.claude/jobs/f1cfc2a1/tmp/all22.log` (job scratch dir — copy out if this needs to
survive past this session).

## Cross-references

- `planning/transportny/tasks/current/dynamic-reports-and-route-tags.md` — item 3, old-template-porting thread;
  this doc resolves its "worth its own scoping pass" flag on the Info Box gap and its deferred
  relative-date item.
- `src/dms/planning/tasks/current/old-reports-conversion-archive.md` rounds 13/14/15/17/18/21/40 —
  full history of the Info Box reliability mechanism and the bin-ambiguity/data-coverage-wall
  finding this pass re-confirms.
- `src/dms/planning/tasks/current/derived-page-variable.md` — the existing view-time derivation
  primitive this pass recommends extending for relative dates.
- `transportNY/src/sites/npmrds/pages/analysis/components/tmc_graphs/RouteInfoBox.jsx`,
  `utils/dataTypes.js`, `reports/store/utils/relativedates.utils.js` — real old-tool source read
  directly for this pass; `relativedates.utils.js` is the authoritative Mechanism B date-math spec.
- `transportNY/src/sites/npmrds/pages/analysis/reports/store/index.js:485-546` (+ per-route-group
  version, `548-597`) and `components/Sidebar/components/AdvancedControls.jsx:95-282` — where
  Mechanism B actually gets invoked: the `isRelativeDateBase` toggle and the base-comp-relative
  recompute, the piece the first read of this doc's Part 2 missed (caught by Ryan).
- `src/dms/documentation/npmrds-data-sources.md` (source 1410 row) — confirms no truck-specific
  LOTTR/TTTR columns exist, informing the `110` fix recommendation.
