# Client request → report: the skill arc

**Project:** TransportNY

**Objective (user direction 2026-07-27):** make Claude good at reading a literal *client
request* and turning it into a real, showable report — routes, labels, titles, descriptions
included. Then let AVAIL reviewers paste feedback and have the report revised cheaply, with
recurring corrections graduating into durable rules so the skill improves. Claude drives this
via the **CLI** (code-driving the UI is flaky); the **UI must stay able to express the same
report**, so CLI capability without a UI equivalent is a tracked gap, not a shortcut.

## Status

All four original gaps plus every follow-on wiring gap found along the way are done as of
2026-07-29. Two real end-to-end client-request case studies (NY-9D Beacon, Poughkeepsie road
diet) exercised the skill against real AVAIL-shipped reports and found most of the open items
below. Full implementation detail, code traces, and live-verification walkthroughs for
everything marked DONE have moved to
[`client-request-to-report-skill-archive.md`](./client-request-to-report-skill-archive.md) —
this file tracks only current status, open items, and the operational reference (intake
posture, rules library, storage decisions) that's still actively used when building a report.
Supersedes the framing in `report-spec-and-build-script.md` ("Phase C is the whole remainder") —
four gaps sat between where the report-spec work landed and the actual goal, and the ranked
UI-parity list (`report-route-ui-parity-gaps.md`) is only one of them.

### Done

| item | what | done |
|---|---|---|
| Gap 1 | `--update`/`--from-page` reconcile (spec-on-the-row storage, diff-only revision log) | 2026-07-27 |
| Gap 2 | Routes creatable via CLI (`route_build.py`), no map-tool dependency for the CLI path | 2026-07-27 |
| Gap 3 | Prose sections — title block, intro, per-graph captions | 2026-07-27 |
| Gap 4 | Rules file + intake checklist + confidence marker landed in `creating-reports.md` | 2026-07-28 |
| Template library investigation | Old tool's 216 templates + 869 reports analyzed; no report archetypes exist, the panel is the reusable unit | 2026-07-27 |
| Route Map wiring | `report_build.mjs` can emit a Route Map graph (shells to `convert_old_reports.py --route-map-section`) | 2026-07-27 |
| Route Info Box wiring | Same reuse pattern for Info Box (`--route-info-box-section`), 5 measure buckets | 2026-07-28 |
| Route Compare wiring | Same reuse pattern for Route Compare (`--route-compare-section`) | 2026-07-29 |
| Drop route dates from plugin | Route is geometry-only now; dates never affected any query, `route_build.py` already refused them | 2026-07-29 |
| Peak-hour sub-window | `routes[].startTime`/`endTime` (spec) + a labeled preset row in `RouteRow.jsx` (UI) | 2026-07-28 |
| `creating-reports.md` stale table | Composition-hints "not yet" cells fixed now that Info Box/Compare are wired | 2026-07-29 |

### Open

| item | what | note |
|---|---|---|
| `--ui-guide` generator | Emits the human click-path for a given spec; doubles as the Phase C parity harness (any spec field with no UI control emits a flagged gap instead of silently omitting) | not started |
| Route Map `color_range` default | `report_build.mjs` only honors a literal `g.colorRange` array, no default-per-measure palette | not started |
| `--verify-routing` | Experimental map-matching route validator — the service appears to ignore the request body (returns a byte-identical wrong-county TMC list regardless of input), and is arguably the wrong oracle anyway since it's bound to one conflation-map vintage while a report queries a different TMC universe. The better fix is a per-year TMC-vintage membership check (data already exists, source 582) — not built. See archive's Gap 2 for full detail | flagged 2026-07-27, not fixed |
| `--from-page` route-field drift | Drift check compares graph-section content (title/`_measurePick`/caption) but never the snap row's own `routes[]` — a route hand-edited live (dates, weekdays, peak windows) goes undetected as drift | found 2026-07-28, not fixed |
| Measure-queryable-for-year check | Intake checklist doesn't yet ask "is this measure bucket even covered for the requested year" (e.g. pm3 `reliability` coverage 2018-2025 vs. raw NPMRDS coverage 2017-present) | found 2026-07-28 on the Poughkeepsie case study, worth a checklist line if it recurs |

Route Map's travelTime choropleth was checked against this same regression concern and ruled out
(VERIFIED 2026-07-30, see `planning/todo.md` and `report-spec.md`'s "Route Compare graphs" section) —
no fix needed, removed from this table.

## Template library — what the old tool's 216 templates and 869 reports actually show

Full statistical investigation (Jaccard analysis, panel-frequency tables, the archetype-naming
correction cascade) is in the archive. The conclusions that are still operationally load-bearing:

1. **No report archetypes exist as a library** — 216 templates and 869 reports both fail to
   cluster by shape. Only 2-3 genuine canned starters exist (the `(Beginner)` reports); their
   apparent higher reuse counts were mostly QA/demo duplication, not adoption. **Do not port the
   216 as report templates.**
2. **The reusable unit is the panel** — a `(type, measure)` pair. 107 distinct panel kinds exist;
   the top 12 cover 49% of all panel usage. The report spec's `graphs[]` + `routes[].graphs`
   shape already models "for each route, emit these panels," which is the right level.
3. **Client purpose predicts the panel set, at a real (if modest) effect size** — mean in-class
   Jaccard similarity runs 1.4×-4.7× the corpus baseline once duplicate reports are collapsed out
   (`travel_time` 4.4× and `signal_timing` 2.9× are the cleanest evidence; `unclassified` and
   `test_scratch` sit at/below baseline, which validates the signal rather than just being noise).
4. **Prose lives in two places**: report-level `description` (38% of reports, short) and
   per-panel caption via `state.message` (4.9% of reports, median 318 chars — the flagship/
   teaching reports). Titles are hand-authored half the time, and authors hand-wrote color→series
   legends into titles when the chart legend itself couldn't express it (a legend affordance gap,
   still open, not tracked as its own item above since no client request has hit it yet).
5. **The composition-rules table below is the practical output** — for a given client-purpose
   class, which panels appear in ≥50% of real reports in that class. Route Map (100% of
   `before_after`/`signal_timing`, 78-87% elsewhere) and Route Info Box (86-100% of measure-heavy
   classes) are the two panels that most drove the wiring work above.

```
before_after   (n=12, median 10 route comps)
  100%  Route Info Box/speed · Route Info Box/travelTime · Route Map · Route Line Graph · Route Bar Graph
   83%  TMC Grid Graph · Bar Graph Summary/speed · Route Info Box/avgHoursOfDelay · Bar Graph Summary/avgHoursOfDelay
signal_timing  (n=7, median 4 route comps)
  100%  Route Map
   71%  Route Compare Component/speed · Route Compare Component/travelTime · Route Bar Graph
   57%  Route Compare Component/avgHoursOfDelay        43%  Route Line Graph · Bar Graph Summary/hoursOfDelay · co2Emissions
road_diet      (n=4)  100%  Route Map · Route Info Box/freeflow-byDateRange · Route Info Box/speed · Route Line Graph
reliability    (n=7)   86%  Route Info Box/speed · Route Bar Graph/travelTime · Bar Graph Summary · TMC Grid Graph · Route Info Box/percentile95-byDateRange
route_comparison (n=110) 78% Route Map · 73% Route Line Graph · 67% TMC Grid Graph · 56% Route Info Box/speed
congestion     (n=76)  67%  Route Line Graph/avgHoursOfDelay · 63% Route Line Graph · 61% Route Map · 61% Route Bar Graph/hoursOfDelay
cmp            (n=6)  100%  Route Line Graph · 83% Route Map · Route Bar Graph/hoursOfDelay · Route Bar Graph/planningTime
```

(Percentages above are pre-dedup and run somewhat inflated per the archive's correction — treat
as directional, not exact, except where the archive notes a class was re-measured post-dedup.)

## Storage decisions (user, 2026-07-27) — NO specs in git

The old tool has ~1k reports; versioned per-report JSON would be a graveyard on `current`.

| tier | home | bound |
|---|---|---|
| Per-report spec + revision log | **not git** — on the report's data row (`reports_snap_2`) | sanity cap ~100–500 revisions |
| Report templates (archetypes) | **not git** — internal DMS dataset, human-authorable in the UI | uncapped (no cap needed once out of code) |
| Rules distilled from corrections | `creating-reports.md` prose | grows, and should — knowledge, not data |
| Feedback intake | AVAIL reviewer pastes into Claude chat → spec diff for approval → apply | — |

**Resolved 2026-07-27, diff-only**: the revision log is `_specRevisions`, an append-only
`{at, note, changed_paths}` list capped at 200 entries, plus the current spec in full (`_spec`) —
not a full snapshot per revision. Implemented as part of Gap 1; see the archive's Gap 1 section
for the full mechanism (`_specKeyMap`, the split-row `raw update` no-op bug it surfaced, and the
`--update`/`--from-page` reconcile logic).

## Intake contract (user ask 2026-07-27): what the skill should require up front

"I want it to be able to ask / request / require certain data (like, is a map screenshot
required?)"

**A first draft of this made every key input "required". That was wrong** (user correction,
2026-07-27): a blocking checklist stalls on exactly the requests that actually arrive. Real
examples from the Beacon request, both underspecified:

- *"peak travel times on 9D, including the intersections of Verplank Ave and Beekman St. See
  map below."* — names 1–2 intersections but says nothing about how many segments, or how much
  distance around each intersection, the client wants.
- *"The City of Beacon is interested in documenting how new actuated signals have helped
  traffic congestion on Route 9D (also known as North Ave/Wolcott Ave)."* — a road name, a
  purpose, and a screenshot. Nothing else.

**So: nothing is hard-required. Claude makes its best guess from whatever arrives, records the
inference with a confidence signal, and flags or asks the AVAIL user when confidence in the
segment choice is low.** AVAIL feedback is the correction mechanism, so optimise for *cheap
correction*, not for correct-first-time. Segment selection is expected to improve through the
feedback→rules loop, not through a validator — do NOT build more geometric verification for it
(user direction: explicitly don't rabbit-hole here).

What this needs mechanically, and it is small: a per-inference confidence marker in the spec
(alongside the existing `request`/`why` provenance) plus a rule that low confidence on segment
choice produces an explicit question to the reviewer rather than a silent guess. (Shipped as part
of Gap 4 — `routes[].confidence: {level, note}` — see the archive.)

| input | posture | why |
|---|---|---|
| Corridor / road name | infer, always | often an alias — see the gap below |
| Segment extent | **guess + flag confidence** | the ambiguous one; "around Verplank and Beekman" has no determinate answer |
| Direction(s) | infer, default both | cheap to correct, and both-directions is the common corridor-study shape |
| Study period(s) | infer, ask if absent | must sit post-2017; same-season year-over-year for before/after |
| The client's actual question | infer from purpose language | "how signals helped congestion" → travel time, before/after |
| Peak-only vs all-day | ask | fully expressible either way since parity gap #11 (DONE 2026-07-28) — the ask still needs asking, it just always builds now |
| Audience | assume client-facing | drives how much prose/labeling to generate |
| Map screenshot | request when the corridor is ambiguous | see below — sometimes the ONLY usable signal |

### Gap: segment extent around a named intersection

`find` supports endpoint-to-endpoint slicing (`--from-intersection`/`--to-intersection`), but
the real request shape was **intersection-centric** — "including the intersections of Verplank
Ave and Beekman St" means *coverage around* those points, with the radius unstated. There is no
determinate answer, so this is a guess-and-flag case by nature, not something to solve. A cheap
future affordance would be "N segments / X miles either side of intersection Y" in `find`.

### Gap: road aliases are not resolvable from the data

Clients name roads locally. "Route 9D (also known as North Ave/Wolcott Ave)" — and **the
`altrtename` column is EMPTY for every NY-9D segment in Dutchess county** (verified
2026-07-27; the column exists and is populated for some roads, just not this corridor). So an
alias-named road resolves to *nothing* in the TMC identification table.

This **corrects an earlier claim in this arc's history** that a screenshot is "never a
substitute for cross-streets." For an alias-named road it can be the *primary* signal:
cross-streets are the best input when the client gives them, but when the road name itself is
unresolvable, the screenshot plus geographic reasoning is what's left. Requesting a screenshot is
therefore justified whenever the road name doesn't resolve, not merely "helpful".

## Rules library — seeded, not empty

Earned corrections, landed verbatim in spirit in `creating-reports.md` as part of Gap 4:
1. A route is a **geometry, not a period** — never encode a date range in a route name or
   metadata (retroactively flags the `"- Jan-Feb 2025"` suffixes on the NY-9D routes).
2. Before/after windows must be **same-season year-over-year** (Jan/Feb 2025 vs Jan/Feb 2026,
   not winter vs spring).
3. Stay inside **post-2017** data coverage — 15.3% of old reports are pre-2017-only and
   permanently blank.
4. Name routes so they read as **chart legend entries**; per-instance rename is broken (gap #7).
5. Name a difference graph's **anchor explicitly**; add-order is invisible in the UI.
6. **Don't gate on GIS continuity heuristics** — report them.
7. **Guess and flag, don't block.** Client requests are routinely underspecified about segment
   extent; produce a best-guess route with an explicit confidence note and let AVAIL correct it.
   Never stall a report waiting for detail the client was never going to provide.
8. **Ask for a screenshot when the road name doesn't resolve** — local aliases ("North Ave" for
   NY-9D) are absent from `altrtename`, so there is no data path from alias to TMC.

## Cross-references

- [`creating-reports.md`](../../../../src/dms/skills/creating-reports.md) / [`creating-routes.md`](../../../../src/dms/skills/creating-routes.md) — the skill files themselves (intake checklist, rules, CLI-first workflow); read before running either CLI
- `report-spec.md` — full spec field reference (`graphs[]`, `routes[]`, `confidence`, `startTime`/`endTime`, Route Map/InfoBox/RouteCompare graph types)
- `report-route-ui-parity-gaps.md` gap #11 — peak-hour/weekday UI parity, the correction that Route Map/Info Box needed no separate wiring for epoch filters
- `report-spec-and-build-script.md` — the report-spec/`report_build.mjs` foundation this arc built on top of
- `scripts/npmrds-reports/route_build.py`, `report_build.mjs`, `convert_old_reports.py`, `census_old_reports.py` — the actual CLI/build code referenced throughout
- [`client-request-to-report-skill-archive.md`](./client-request-to-report-skill-archive.md) — full historical detail for everything above
