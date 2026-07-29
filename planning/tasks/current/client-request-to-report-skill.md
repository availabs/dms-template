# Client request → report: the skill arc

**Status:** all four gaps DONE as of 2026-07-28 (started 2026-07-27). Remaining work is
follow-on, tracked in "Next steps" below (route-date cleanup, `--ui-guide` generator, Route
Map's color_range, Route Compare Component wiring). #11's UI half (Route Info Box wiring and
spec half were already DONE, see items 8 and 11) is now ALSO DONE, 2026-07-28 later session —
see `report-route-ui-parity-gaps.md` gap #11 for the full writeup, including a correction to
this file's own item 8/1018 framing below (Route Map/Info Box needed no graph-type-specific
wiring at all — only a UI preset control, which is graph-type-agnostic). Supersedes the framing in
`report-spec-and-build-script.md` ("Phase C is the whole remainder"): four gaps sit between
where the report-spec work landed and the actual goal, and the ranked UI-parity list is only
one of them.

**Objective (user direction 2026-07-27):** make Claude good at reading a literal *client
request* and turning it into a real, showable report — routes, labels, titles, descriptions
included. Then let AVAIL reviewers paste feedback and have the report revised cheaply, with
recurring corrections graduating into durable rules so the skill improves. Claude drives this
via the **CLI** (code-driving the UI is flaky); the **UI must stay able to express the same
report**, so CLI capability without a UI equivalent is a tracked gap, not a shortcut.

## The four gaps (beyond Phase C)

1. **DONE 2026-07-27 — the builder can now revise, not just create.** See "Gap 1 —
   `--update`/`--from-page`" below for the full writeup (design, a real CLI bug found and
   worked around, and live verification).
2. **Routes were outside the CLI path** — contradicted "including making any Routes".
   **CLOSED 2026-07-27**, see below.
3. **DONE 2026-07-27 — the spec can now say what a client-showable report needs to say.**
   See "Gap 3 — prose sections" below for the full writeup. `description` still goes to the
   snap row (nowhere visible) and `why` is still builder-facing only — both left as-is,
   superseded by `intro`/`caption` for anything that needs to be seen.
4. **DONE 2026-07-28 — intake checklist, rules, feedback loop, and a real confidence
   marker.** See "Gap 4 — rules file + intake checklist" below for the full writeup.

## Storage decisions (user, 2026-07-27) — NO specs in git

The old tool has ~1k reports; versioned per-report JSON would be a graveyard on `current`.

| tier | home | bound |
|---|---|---|
| Per-report spec + revision log | **not git** — on the report's data row, or a new internal DMS dataset | sanity cap ~100–500 revisions |
| Report templates (archetypes) | **not git** — internal DMS dataset, human-authorable in the UI | uncapped (no cap needed once out of code) |
| Rules distilled from corrections | `creating-reports.md` prose | grows, and should — knowledge, not data |
| Feedback intake | AVAIL reviewer pastes into Claude chat → spec diff for approval → apply | — |

Open sub-decision: full spec snapshots per revision (~3 KB each) vs `{note, changed_paths}`
per revision plus the current spec in full. The latter keeps 100 revisions in single-digit KB
and is better rule-distilling material. Not yet chosen.

## Template library — investigate the old tool first (user direction)

The old tool's templates **live in the DB**: 216 rows in `admin2.templates`, already surveyed
read-only 2026-07-13 → `scratchpad/npmrds-sub/old-reports/templates_survey.json` (pointer from
`src/dms/planning/tasks/current/old-reports-conversion.md:179-188`).

What that survey found, and the nuance: it evaluated the 216 as **graph-instance training
data** — 2,466 instances across 144 distinct (type × measure × resolution × dataColumn) cells,
**134 of which already occur** among the 869 reports' 261 cells, so only 10 template-only
cells. Conclusion there was "no pivot warranted." But that answers a *different* question than
ours. Structurally the templates are ordinary report shells with real `routeId` strings (1,723
comps) and a `routes` field that is a **slot count, 1–9, mode 1** — i.e. the old tool already
modeled "N route slots + a set of graphs," which is exactly a Claude Report Template's
parameterization. The survey explicitly deferred that value to "whenever full-template
conversion becomes relevant (**authoring UI era**)" — which is now.

So: the 216 are a **human-curated** answer to "what archetypes matter"; census clustering
would be the **frequency-based** answer. Investigate the 216 first; clustering is probably
unnecessary. Confirm, don't assume.

### INVESTIGATED 2026-07-27 — conclusion: there are no report archetypes; the reusable unit is the PANEL

`admin2.templates` schema: `id, name, description, routes` (slot count), `route_comps`,
`graph_comps` (jsonb array), `stations`/`station_comps` (unused — 0 templates), `color_range`,
`default_type`, timestamps, `thumbnail`/`pic`. Each `graph_comps` element is
`{type, state:{title, displayData:[measures], activeRouteComponents:[comp-N]}, layout:{h,w,x,y}}`
— so templates carry **12-column grid layout** as well as measures and per-graph route scoping.

Corpus: 216 templates, 193 distinct names, 1–9 route slots, 2,466 graph instances, 0 stations.
**146/216 are single-route-slot**, so the dominant case is a one-route report; the big
multi-route templates are the minority.

**Whole-report shapes do not cluster — at either granularity:**

| signature | distinct shapes | singletons | top shape |
|---|---|---|---|
| expanded (multiset of graph types) | 121 / 216 | 81 | 8 tpl = 3.7% |
| normalized (set of (type, measure) panel kinds) | 132 / 216 | 96 | 8 tpl = 3.7% |

Top 20 expanded shapes reach only **43%** of templates. **A hypothesis tested and refuted:** the
big multiplicities (`Route Bar Graph x19`, `x21`) are a genuine **(route slot × measure) cross
product** — template 64 "MHV - CMP 7-Route Comparison" is 7 routes × 3 measures, titled "1st
Route – Hours of Delay by Time of Day", "1st Route – Planning Time Index", … — and corpus-wide,
among repeated same-type graph groups `activeRouteComponents` varies in 82%, `title` 65%,
`displayData` 52%, `resolution` only 4%. So I expected normalizing the cross product to collapse
the shape count. **It went up** (121→132 distinct, 81→96 singletons): the measure dimension
splits shapes faster than route-multiplicity merges them. Don't retry this normalization.

**Panels, by contrast, are highly concentrated:** 107 distinct (type, measure) panel kinds, and
the **top 12 cover 49% of all panel usage**. Route Line Graph appears in 157/216 templates,
Route Map 147, Route Info Box/speed 87, Route Bar Graph/hoursOfDelay 78, TMC Grid Graph 68,
Route Compare Component/speed 67.

**Therefore:**
1. **Do not port the 216 as report templates.** They are mostly bespoke one-offs — no set of 20
   covers a meaningful fraction, and ~45% are shapes used exactly once.
2. **A "Claude Report Template" should be a composition rule over a panel vocabulary,
   parameterized by route slots** — "for each route, emit these (type × measure) panels" — not a
   fixed section list. That is essentially what the report spec already is (`graphs[]` +
   `routes[].graphs`), so the separate "template" concept may reduce to a handful of starting
   points plus good defaults, rather than a library to curate.
3. **The panel vocabulary largely already exists**: the conversion work's graph-template catalog
   is keyed on exactly (type × measure × resolution × dataColumn) via its ~30 `ensure_*_template`
   functions. What's missing is the **composition layer** — how many panels, in what order and
   layout, for a given client ask. That, not a template library, is the real gap.
4. **Census clustering of the 869 reports is very unlikely to help** — if 216 *curated* templates
   (someone thought each was worth saving) don't cluster, ad-hoc reports won't either. Not
   measured directly; if it ever matters, the cheap confirmation is the same signature count over
   `census.json`. Recommend skipping it.
5. Layout is a dimension the spec currently under-models: templates carry `{h,w,x,y}` on a
   12-column grid, the spec has only per-graph `size` (colspan). Note for the prose/layout work.

### The 869 reports, re-analyzed with a PURPOSE lens — 2026-07-27, strong positive result

**First, a correction to conclusion (1) above:** the 216 templates are a **biased sample**. They
are what someone chose to save as reusable, which selects *for* bespoke one-offs. So "no
archetypes exist" was over-generalized. Re-running *shape* clustering on the 869 would have
reproduced the same negative — but that was the wrong question.

The right question: **does client purpose predict the panel set?** Classified all 869 by
regex over `name` + `description` (single label, most-specific-first), then measured mean
pairwise Jaccard of panel-kind sets within each class against a corpus baseline.

**Baseline: 0.114** — two random reports share ~11% of their panel kinds.

| class | n | in-class Jaccard | lift |
|---|---|---|---|
| before_after | 12 | 0.770 | **6.8×** |
| cmp | 6 | 0.684 | 6.0× |
| reliability | 7 | 0.580 | 5.1× |
| travel_time | 21 | 0.516 | 4.5× |
| speed_study | 21 | 0.503 | 4.4× |
| road_diet | 4 | 0.467 | 4.1× |
| signal_timing | 7 | 0.326 | 2.9× |
| toll_change | 18 | 0.307 | 2.7× |
| work_zone | 7 | 0.256 | 2.3× |
| route_comparison | 110 | 0.248 | 2.2× |
| congestion | 76 | 0.241 | 2.1× |
| trend_periodic | 9 | 0.232 | 2.0× |
| *incident_impact* | 60 | 0.128 | *1.13×* |
| *intersection* | 24 | 0.119 | *1.04×* |
| *unclassified* | 420 | 0.115 | *1.01×* |
| *test_scratch* | 60 | 0.091 | *0.80×* |

**The controls validate the signal:** `unclassified` sits at exactly baseline, and
`test_scratch` comes in **below** baseline — scratch reports are less mutually consistent than
random pairs, which is what a real signal should show.

**Two more predictions refuted.** `incident_impact` is only 1.13× — the bulk-produced "Bridge
Hits Impact - BIN… - timestamp" family is **not** a shared-panel archetype, contra the guess
that motivated this re-analysis. And `intersection` is 1.04×. The pattern: classes naming an
**analysis type** predict panels; classes naming a **place** or a **triggering event** do not.

**Honest limits:** the highest lifts sit on the smallest samples (before_after n=12,
reliability n=7, cmp n=6, road_diet n=4), so those specific panel lists are strong hints, not
laws. The trustworthy-sample classes (route_comparison n=110, congestion n=76) show a solid but
more modest 2.1–2.2×. And **48% of the corpus is unclassified** by a crude keyword list —
sharpening the classifier (including using the per-graph `state.title` text, which is
purpose-rich and currently unused for classification) would tighten all of this.

### The composition rules this yields (panel present in ≥50% of the class)

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

### Prose lives in TWO places, and archetypes are NAMED — 2026-07-27

Prompted by the user asking whether I had looked at per-graph descriptions. I had not — I only
tested whether repeated panels' titles *differ*, never mined them as content. Doing so found
the prose layer and, through it, the archetype list.

**`graph_comps[].state` key inventory** (7,103 report graphs / 2,466 template graphs): `title`
100%, `activeRouteComponents` 69.5%, `displayData` 58.4%, `resolution` 3.9%, **`message` 3.0%**,
`reverseTMCs` 2.8%, `showCompare` 2.3%, `text` 0.3%, then a long tail. No separate per-graph
`description` field exists.

**Layer 1 — report-level `description`:** 327/869 (38%), median only 40 chars, max 652.

**Layer 2 — per-panel caption, `state.message`** — this is the "additional text on some
components" whose home was unclear. It is a **dict, not a string** (which is why a first pass
filtering for strings found only 5 of them):

```json
{"text": "Red is the March 10 data and Blue is the March 24 data. We can see that the
          March 24 speeds are nearly constant throughout the day with no slow downs
          during the morning and afternoon peak periods.",
 "width": "100%", "height": 125, "location": "bottom"}
```

**213 captions across 43 reports (4.9% of corpus), median 318 chars**, `location` is `bottom`
in 213/213. By panel type: Route Bar Graph 56, Route Map 53, TMC Grid Graph 26, Route Compare
23, Route Line Graph 22, TMC Difference Grid 18. Roughly 5 captions per captioned report, and
the captioned reports are the flagships/teaching examples ("Year Over Year (Beginner)",
"Recurrent/Non-Recurrent Congestion Inspection Template", "I-190 NB COVID Comparison").
So only ~5% of old reports were ever written up as readable documents — the exemplars are
identifiable and worth reading in full as the model for what good looks like.

The caption voice is exactly what a client-facing report needs — explain what you're looking at
and why it matters: *"The line graph above displays the travel time for the incident year,
incident month, and against the entire time period. This allows the analyst to put the incident
in context."* / *"The route map above and the grid graphs that follow interact. Purple indicates
the slowest average speeds."* **These 213 captions are a ready-made style corpus for gap 3.**

**A third mechanism, minor:** a standalone `Text Box` panel type exists but only **5 instances**
corpus-wide, versus 213 captions — captions win by ~40×. (`Text Box` never appeared in the
earlier type census because that census was **templates-only**; the reports corpus has 23 graph
types including `Stacked Transcom Graph`, `Transcom Pie Chart`, `Radial Bar Graph`,
`Distribution Graph`, `HDS Bar/Line Graph`, `Monthly Hours Graph`.)

**Titles: `{type}, {data}` is the DEFAULT, but authoring is the norm** (an earlier version of
this file said "interpolated, not hand-written" — wrong, corrected on user challenge). Across
9,569 graphs:

| | count | share |
|---|---|---|
| empty | 3,174 | 33.2% |
| placeholder (`{type}, {data}` / `{name}, {data}`) | 1,623 | 17.0% |
| **human authored** | **4,772** | **49.9%** |

1,400 distinct authored strings, median 26 chars. **Half of all panels got a real title.**

**The authored-title style rule, from 4,772 examples** — name the *period*, the *direction*, the
*resolution/binning*, and when comparing periods, the *color mapping*:

```
2019 Weekday 5-minute resolution
2019 Weekday Monthly - EB
Avg Day Hours of Delay by Epoch: April 2021 (Grey) vs April 2019 (brown) vs. Average Day for all of 2021 (orange)
K Bridge NB, 24 hour Wkday Spds (5 minute Bins) Jan 1 through June 30; Red = 2016 Grey = 2020
Chart 1: Route 55 EB - 2016-2019 Travel Time (solid lines) and Hours of Delay (dashed lines)
```

Two observations worth acting on:
- **Authors hand-wrote the color→series legend into titles** ("Red = 2016 Grey = 2020",
  "(solid lines)"/"(dashed lines)"). That is a **legend affordance gap**, not a style preference —
  if the chart legend were adequate nobody would retype it into the title. Log it as a UI gap.
- **Figure numbering** ("Chart 1:") appears — reports were read as documents with referenceable
  exhibits, which reinforces the prose/caption work.

Rationale vocabulary in authored titles is thinner: `(measure of congestion)` 148×,
`(measure of reliability)` 74×, "by Day of Week" 119×, "by Time of Day" 74×, direction wording
23.1%, year-range comparison 5.7%.

### ARCHETYPES DO EXIST — they are named and documented (corrects the conclusion above)

Reused description texts: **327 reports carry a description → 164 distinct texts → 51 texts
reused by more than one report, covering 214 reports.** A canned description repeated across
reports *is* an archetype definition, authored by a human:

| ×reports | archetype | authored definition (excerpt) |
|---|---|---|
| 15 | **Snapshot (Beginner)** | "compares an average day for a year against weekday and monthly averages as well as against AM or PM peak and Off-peak… intended to give the analyst a snapshot" |
| 23 | **Compares Three Routes** (May 31 2017 ×13 / Jan 5 2017 ×10) | Skyway comparison family |
| 11 | **Single route default template** | — |
| 9 | **Single Route Before and After (Beginner)** | "compares a single route before and after a certain time frame. The report looks at average speeds and congestion" |
| 7 | **CMP PM Peak Period Performance and Reliability Analysis 2016-2018** | — |
| 20 | *Route Bar Graph tests* | test family, exclude |

**CORRECTION (same session, user challenge: "they are prob per instance, but you just found one
that someone reused a few times"). The user was right, and it moved the numbers.**

Look at the group members: `Snapshot (Beginner)#131`, `Testing and Acceptance - Single Route
Before and After (Beginner)` — **QA/demo duplicates**. And "Compares Three Routes, **on May 31st,
2017**" ×13 is date-specific text copied across one batch of Skyway comparisons — a batch, not an
archetype. So reuse counts measure copy-paste, not adoption.

Worse, it threatened the headline statistic: if most `before_after` members are copies of one
demo, its 0.770 Jaccard was measuring self-similarity of duplicates. **Re-measured after
collapsing reports with an identical panel set AND identical description:**

| class | raw lift | dedup lift | collapsed |
|---|---|---|---|
| travel_time | 4.5× | **4.4×** | 1 of 21 |
| before_after | 6.8× | **4.7×** | 7 of 12 |
| cmp | 6.0× | **3.2×** | 3 of 6 |
| signal_timing | 2.9× | **2.9×** | **0 of 7** |
| reliability | 5.1× | **2.9×** | 3 of 7 |
| congestion | 2.1× | **2.0×** | 38 of 76 |
| road_diet | 4.1× | **1.8×** | 2 of 4 |
| toll_change | 2.7× | **1.8×** | 6 of 18 |
| speed_study | 4.4× | **1.6×** | 13 of 21 |
| route_comparison | 2.1× | **1.4×** | 48 of 110 |

**Three consequences:**
1. **The corpus is heavily duplicated.** 869 reports is NOT 869 independent data points
   (route_comparison 110→62, congestion 76→38, speed_study 21→8). Relevant to any analysis over
   this corpus, including coverage math.
2. **The "two independent methods converge" claim is WITHDRAWN** — the archetype groups *were*
   the duplicates, so both methods were partly detecting the same copy-paste.
3. **The effect is real but smaller: ~1.4×–4.4×, not 2×–6.8×**, and the trustworthy classes are
   different from the ones first highlighted. Best evidence: **`travel_time` 4.4× (n=20, 1
   duplicate)**; cleanest: **`signal_timing` 2.9× (n=7, ZERO duplicates)** — which is the class
   NY-9D belongs to. `speed_study` and `route_comparison` were largely duplication artifacts.

**Also: the per-class panel-frequency tables above were computed PRE-dedup and are inflated.**
Recompute before leaning on the specific percentages. Route Map's dominance has independent
support (87% of the 216 templates, a separate corpus); the per-class figures do not.

**Revised archetype conclusion:** the old tool had **2–3 genuine canned starters** — the
`(Beginner)` reports, whose descriptions describe a report *type* ("This report compares a single
route before and after a certain time frame… intended to give the analyst a view of…") rather
than a corridor. Their ×15/×9 counts are QA duplication, not adoption. So conclusion (1) above
("no archetypes") is **partly** rehabilitated: a handful of authored starters existed, but there
is no evidence of a large archetype library in use.

### The sharp consequence: the composition rules demand panels the spec builder cannot emit

**CORRECTION 2026-07-27 (user challenge):** the paragraph below originally claimed Route Map "has
never been built" and "sits in the census's `no_equivalent` bucket (no new-side shape exists)".
That was wrong. Route Map — a live choropleth Map section with dms-server ClickHouse tile-join
support — was fully built and live-verified in `old-reports-conversion.md` rounds 47–50
(2026-07-14/15): M0a/M0b (comparison_series-driven symbology + geometry-only maps), M1 (the
dms-server tile/colorDomain CH-join API), M2 (speed choropleth), M3 (travelTime/hoursOfDelay/
avgHoursOfDelay choropleths). The `no_equivalent` citation was reading a **stale comment** in
`census_old_reports.py`'s `NO_EQUIVALENT_TYPES` set/docstring, which still said "no built
new-side shape yet" for Route Map after that shape had shipped — the classifier code right below
it actually maps `none`/`speed`/`travelTime`/`hoursOfDelay`/`avgHoursOfDelay` Route Map instances
correctly; only residual measures (e.g. `co2Emissions`) or year-undetermined instances still fall
into that bucket. Comment fixed in the census script itself.

**The real gap, narrower than originally stated:** `report_build.mjs` — the spec-driven builder
this task's CLI path uses — has **zero** Map-section code (verified by grep: no Map-related logic
anywhere in the file). The Route Map choropleth machinery (`ensure_route_map_*_template` and
friends) lives entirely in `convert_old_reports.py` (Python), invoked only when converting an
*old* `admin2.reports` row. It was never wired into the spec/report_build.mjs path that builds
reports from a client request. So a spec-driven report cannot get a Route Map today — not because
the shape doesn't exist, but because the JS builder was never taught to reference it. This is a
wiring/reuse task, much smaller than building the shape from scratch.

**Route Info Box** is the backbone of every measure-heavy class (100% of before_after at two
measures; 86% of reliability and speed_study) — and it is the census's **#1 unmapped key**, 246
instances across 212 reports. `TMC Info Box` is #2 (160/106).

**SECOND CORRECTION 2026-07-28 (user challenge — "i think i already did route info box"):** the
paragraph above made the *identical* stale-comment mistake the Route Map correction two
paragraphs up explicitly warns against, one section later in the same file. Route Info Box does
**not** genuinely lack a shape outside reliability. `census_old_reports.py`'s real classifier
(the `grain = INFO_BOX_GRAIN.get(...)` branches in `analyze_report`) maps FIVE measure buckets,
built across rounds 19/38/40/49/58: reliability (the pm3 LOTTR/TTTR/freeflow join,
`INFO_BOX_BUCKET`), travel time (`INFO_BOX_TRAVELTIME_BUCKETS`), length (`INFO_BOX_LENGTH_
BUCKET`), AADT (`INFO_BOX_AADT_BUCKET`), and hours of delay (`INFO_BOX_DELAY_BUCKET`) — each
minted as a DMS **Spreadsheet** section (an existing platform primitive, not a bespoke
component). All five have real converted-page proof: `route_info_box_traveltime` (page section
`2190555`), `tmc_info_box_traveltime` (`2190591`), `tmc_info_box_length` (`2190604`),
`tmc_info_box_aadt` (`2190645`), `route_info_box_delay` (`2190664`), `tmc_info_box_delay`
(`2190677`) — see `old-reports-conversion.md` rounds 40/49. The stale comment I read instead of
this code lived in `census_old_reports.py`'s `NO_EQUIVALENT_TYPES` docstring, saying "shape ONLY
for the reliability bucket" — now fixed in the script itself, same treatment as the Route Map fix.

**What's actually still missing, narrower than either version of this claim:** (1) a residual
measure genuinely has no template at all — e.g. `percentile95-byDateRange`, which shows up at
86% in the `reliability` composition class above and matches none of the five buckets; some
fraction of the 246/160 unmapped instances are also plain data-coverage gaps (year outside
`PM3_VIEW_BY_YEAR`, or year/bin genuinely undetermined) rather than missing shapes at all — not
re-measured this session, so treat "246/160" as the old, not-yet-reclassified unmapped count; and
(2) **exactly like Route Map, `report_build.mjs` has zero Info Box wiring** (verified by
grep — no `info_box`/`InfoBox`/"Info Box" anywhere in the file or in `report-spec.md`, and
`convert_old_reports.py`'s CLI only has a `--route-map-section` mode, no Info Box equivalent).
The five built buckets live entirely in the Python old-report converter; nothing shells out to
them from the spec path. So a spec-driven report cannot get a Route Info Box today for the same
reason it couldn't get a Route Map before that gap closed — not because the shape doesn't exist,
but because the JS builder was never taught to reference it.

So the vocabulary hole that's real and blocks correct composition is, for both Route Map (now
closed) and Route Info Box: **wiring, not a new shape.** Building a genuinely new Info Box
measure bucket (if one is ever needed beyond the five that exist) is a separate, smaller
question from getting the existing five buckets callable from `report_build.mjs`.

**And it grades our own NY-9D Beacon report.** That is a `signal_timing` study. We built 3
panels: one LineGraph overview plus two difference BarGraphs, over 4 route instances. The
historical signal_timing archetype is **100% Route Map** plus Route Compare Component on speed
and travelTime at 71% each. We shipped none of those three — not because Route Map couldn't be
built, but because the spec builder had no way to emit one. Separately, `Route Difference Graph`
appears in only 30/216 templates and does not reach the ≥43% cut for signal_timing at all — so
the difference-graph-centric shape we built is *less* typical than it felt, though it was
explicitly what the client asked for, so this is a note about defaults, not that report.

## Gap 2 — routes via CLI: DONE 2026-07-27

`scripts/npmrds-reports/route_build.py`. Removes the transportNY map-tool dependency for route
creation while leaving the map tool as the human path (CLI and UI write the same 7-key row).

**Go/no-go, verified live before writing anything:** a Routes Data row is 7 keys (`name`,
`description`, `tmc_array`, `metadata`, `id`, `created_at`, `updated_at`); `dms raw create`
writes split `:data` rows (that is how `report_build.mjs` makes the snap row); test row
`2195846` created and read back through the exact UDA path `report_build.mjs` uses for route
resolution (`dms dataset query 2107426 --view 2107427 --filter id=…` → `total: 1`, data inline).

**Modes:** `find` (read-only TMC-chain discovery by road/direction/county, with optional
`--from-intersection`/`--to-intersection` slicing) and `build` (validate a route spec, create
rows, print a ready-to-paste report-spec `routes[]` fragment).

**Two design corrections found by testing, not by reasoning:**

1. **`road_order` contiguity is NOT a valid gate.** tmclinear 12003803 NORTHBOUND has **no
   road_order 9 at all**, yet `120+29711` ends at exactly `(41.49934, -73.97048)` where
   `120+29712` starts. Erroring on the numbering hole would reject a valid Teller Ave → Main
   St route. Demoted to a note.
2. **Neither is coordinate abutment** (user, mid-session: "I bet coordinate continuity has gaps
   too… getting the exact road segments that are exactly touching is a problem as old as GIS
   itself"). Correct. Divided highways and interchanges leave genuine metre-scale gaps between
   segments a driver experiences as continuous. So validation is now **three tiers**: hard
   errors only for unambiguous data errors (TMC doesn't exist, mixed directions, missing
   name/tmcs, a date field present); everything geometric is advisory with the gap reported in
   metres; `--strict` promotes warnings to errors for callers who want the gate.

**Also better than the map tool:** input `tmcs` order doesn't matter — the build sorts to true
along-road order and reports the reorder. The shipped NY-9D route's array is `29713, 29712,
29714`, i.e. map-click order, geographically out of order.

**Verified:** `find` on NY-9D Dutchess (15 NB segments, road_order hole surfaced correctly);
out-of-order 4-segment chain reordered + numbering hole noted; three negative cases each
error with an actionable message and exit 1 (disconnected chain, mixed directions, nonexistent
TMC); valid spec exits 0; real route created (`2195847`); `tmc_array` uses compact separators
so it is byte-identical to plugin-written rows.

### OPEN — `--verify-routing` is EXPERIMENTAL and currently does not work

The intent (user's "borrow from old routing APIs" instinct) is real map-matching instead of a
coordinate heuristic, via the same contract the plugin's `resolveRoute.js` uses:
`POST routing2.availabs.org/route?conflation_map_version={year}_v0_6_0&return_tmcs=1`, body
`{locations:[{lat,lon},…]}` → `{ways:[tmc,…]}`.

**Observed 2026-07-27: the service appears to ignore the `locations` body.** Two completely
different waypoint arrays for the same NY-9D chain (endpoints-only, then a waypoint per
segment) returned a **byte-identical** 22-TMC list, and those TMCs are **I-84 / US-9W in Orange
County** — about 4 km west, across the Newburgh-Beacon bridge — including SOUTHBOUND codes.
That is not a routing preference, it is a request that isn't landing. Left in place behind the
flag, marked experimental, so the next session starts from the symptom rather than rediscovering
it. Do not describe this check as working.

Year constraint is separately confirmed and encoded: only **2020, 2021, 2022** return TMCs
(`research/route-creation/findings.md:696-708`, `:863-868`); DB metadata claims 2016-2026.
`--routing-year` outside that window is a hard error, because an unsupported vintage returns an
empty list rather than an error and therefore looks exactly like a bad chain. Empirical from one
location — known-good, not proven exhaustive.

**Second, deeper reason not to trust the router (user, 2026-07-27): "the TMCs change."** The
service is vintage-bound, so validating a chain against a 2022 conflation map says nothing
reliable about a report that queries 2025 data — it is a different TMC universe. Even a
*working* router is the wrong oracle for this job. Two independent failure reasons now, so the
flag stays experimental and unused by default.

### The better validator this points at (not built yet)

The question a route validator should actually answer is **not** "is this chain geometrically
continuous" but **"does every TMC in this chain exist in the TMC vintage of each year this
report queries?"** That is precise, cheap, non-heuristic, and catches a real silent failure
class: a before/after report uses ONE `tmc_array` for both arms, so if the TMC set changed
between the two windows, one arm can quietly lose segments and render a partial corridor with
no error. Per-year TMC geometry views already exist for 2016-2026 (source 582, table in
`research/route-creation/findings.md:687-688`), so this is a set-membership check against data
we already have. Prefer building this over fixing the router.

**User direction:** "we eventually need to either update that old code or port it to a new
router." The seam already exists: `resolveRoute.js` is deliberately the only place in the UI
that knows the routing contract, pending a **dms-server proxy** (Phase 1, dms-template). Point
`route_build.py` at that proxy when it lands, so the router can be replaced in one place for
both CLI and UI.

## Gap: route dates are dead weight — drop them from the plugin

Verified chain, 2026-07-27:
- **Write:** the plugin writes `metadata: {dates:[start,end]}` on save (`comp.jsx:166`).
- **Read, tool-local:** re-opening a route repopulates its own date pickers from
  `metadata.dates` (`comp.jsx:213-233`). Round-trips only inside the map tool's form.
- **Report side reads nothing:** `ReportRouteList/` has **zero** references to `metadata`
  across all 8 files; `addRoute` (`useReportRow.js:276-281`) spreads the catalog row wholesale
  so `metadata` rides in as inert baggage and is never mapped to `startDate`/`endDate`; the
  query's date/epoch arrays come strictly from the route_comp's own dates
  (`useGraphPublish.js:71-72`).

So **route dates have zero effect on any graph.** NY-9D proves they are actively misleading:
route `2195805` is named `"… - Jan-Feb 2025"` and carries matching `metadata.dates`, yet the
spec correctly uses that same route for **both** the 2025 and 2026 arms.

**Decision (user delegated):** drop dates from the plugin's save payload and form. A route is a
geometry; the window belongs to the report's route instance. Existing rows keep their
`metadata.dates` harmlessly. transportNY-only change (plugins must live there), isolated — not
bundled with anything else. `route_build.py` already refuses a date field with a message
explaining why.

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
choice produces an explicit question to the reviewer rather than a silent guess.

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

This **corrects an earlier claim in this file** that a screenshot is "never a substitute for
cross-streets." For an alias-named road it can be the *primary* signal: cross-streets are the
best input when the client gives them, but when the road name itself is unresolvable, the
screenshot plus geographic reasoning is what's left. Requesting a screenshot is therefore
justified whenever the road name doesn't resolve, not merely "helpful".

## Rules library — seeded, not empty

Earned corrections available to write down today:
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

## Gap 1 — `--update`/`--from-page` reconcile: DONE 2026-07-27

**Storage** (settles the "not yet chosen" sub-decision above, diff-only per user pick): three
new fields on the `reports_snap_2` row — `_spec` (current full spec, `_`-prefixed working
fields like `r._name`/`g._assigned` stripped before persisting), `_specKeyMap` (spec `key` →
section `trackingId`, the natural-key mapping `--update` needs to find sections again), and
`_specRevisions` (append-only `{at, note, changed_paths}` log, capped at 200 entries — no
full-snapshot-per-revision).

**`--update <page> [--note "..."]`:** reconciles graph sections by `key`→`trackingId` from the
stored map — existing keys get `dms section update` (same trackingId, so it edits in place, not
a duplicate); new keys mint a section; keys the new spec dropped get their section deleted.
RRL/Spreadsheet are found live by `element-type` each time rather than tracked in the map (a
Report Page always has exactly one of each — self-healing if the map predates them). Page title
updates if `spec.title` changed; **slug is deliberately never touched**, even then, so a
revision can't silently move the live URL.

**`--from-page <page> [--out <path>]`:** if the page's live sections still match the stored
`_spec` (checked both structurally — trackingId sets — AND at the content level — per-graph
title and `_measurePick`, see the bug below), it just echoes the stored spec back. Otherwise it
reconstructs from live state: AVL Graph sections recover `graphType`/`measure`/`resolution`/
`comparisonMode` **exactly** from `state.display._measurePick` (already written by
`applyMeasurePick`, so no guessing). Route Map sections get the same treatment going forward via
a new `_routeMapPick` marker stamped onto every Map build; Map sections built before this change
are flagged `_needsReview` rather than guessed. Verified against a real production old-report-
conversion page (2191502, "Route 20 WB Skaneateles") — reconstructed 14 graphs + 5 routes
correctly, including which of two Route Map sections needed the `_needsReview` flag.

**Real CLI bug found and worked around, live:** `dms raw update <id> --data {...}` **silently
no-ops on split (`:data`) rows** — confirms the same gap already logged in
`reference_dms_section_create_cli_gaps.md` (found 2026-07-21 on this exact table), now hit again
independently. It echoes a success response but a follow-up read shows the row byte-unchanged.
Caught by live-testing a 3-revision update chain: revision #2's writes (`_spec`, `_specKeyMap`,
title, routes) never landed, so revision #3's reconcile read the STALE (v1) key map, thought
every graph was new, and recreated+orphaned two sections instead of updating one in place —
no data loss (both stale sections were still correctly deleted), just wasted churn. Fix: replace
the row (`raw delete` + `raw create`, both proven to work on split rows) instead of updating it.
Nothing else references the snap row's own id — ReportRouteList discovers it by `report_id` at
render time — so a new row id per revision is transparent to the page. Re-verified the full
3-revision chain afterward: correct create/update/delete counts, correct revision log,
byte-identical `--from-page` round-trip, and correct drift detection after a live hand-edit
(retitling a section outside this tool) — the first version of the drift check only compared
trackingId sets and missed a same-section content edit; fixed to also diff title and
`_measurePick`/`_routeMapPick` per graph.

All test pages/sections/snap rows deleted after verification (page `2195990` + 3 sections +
snap row `2195997`; the mid-test churned page `2195968` + orphaned sections `2195969`/`2195971`/
`2195974` + snap row `2195972` from before the bug fix).

## Gap 3 — prose sections (title block, intro, per-graph captions): DONE 2026-07-27

**First correction, from the user, before any code:** my initial plan added a Rich Text sibling
section after every graph for its caption. The user pointed at two things that shrank it a lot —
(1) every section already has a generic `title` field ("is either gap better served in that
menu?"), and (2) a coworker's recent Map21/transportNY work on "tight-knit sibling sections" might
already be relevant. Checking (1) directly found that **`display.description` on an AVL Graph
section already renders** — `GraphComponent.jsx:133-135`'s `GraphTitle` shows it as a subtitle
under the chart title, and `convert_old_reports.py:4203/4234` already writes old reports' captions
into exactly this field. I'd grepped for the literal string `display.description` earlier and
missed it because the actual code says `graphFormat.description` (`graphFormat` being the local
name for the `display` prop) — a real research error the user's question caught. So the per-graph
caption gap wasn't "no mechanism", it was "no write path from a fresh spec, and no UI control" —
much smaller than a new section per graph. Checking (2), the coworker's mechanism
(`d8bc9821`, `gap0-section-grid-compound-cards-migration.md`, `compound-visual-units-grid-gap.md`)
is real and shared-library (`gap-0` grid + per-section padding/border/radius, so two adjacent
sections can sit flush) — but turned out not needed here, since captions ended up living inside
the graph's own section rather than as a sibling.

**What shipped, in the shared submodule (`src/dms`) plus the script:**
- `graph_new/config.jsx`: one new "Description" control (a plain textarea via the `type: <function>`
  escape hatch — `InputControl` only ever renders a literal `<input>`, so `inputType: 'textarea'`
  would NOT have produced a real multi-line field). Confirmed platform code, not just authoring —
  asked the user before touching it, since it's the one change with blast radius beyond this
  script (any site using `graph_new` inherits the control).
- `report_build.mjs`: `state.display.description = g.caption` in the compose step, right next to
  the existing title-setting line. `applyMeasurePick` never touches `description` (confirmed by
  reading `composeMeasureConfig.js`/`MeasurePicker/index.js` — it only merges `graphType`,
  `fetchMode`, `xAxis`, `yAxis`, `colors`, `_functions`), so a caption survives a later measure
  change untouched. Map graphs have no title/description render path at all (`map/index.jsx` has
  no `GraphTitle`-equivalent), so setting `caption` on a `Map` graph is a hard build error, not a
  silent no-op.
- **Title block** (the one part that did need a new section — no existing primitive fits a real
  paragraph; `item.title`/`item.description` are never rendered anywhere in `view.jsx`, and the
  one registered "Header" component is a MitigateNY hero banner with a fixed single-line subtitle,
  wrong shape and wrong look here). One "lexical" (Rich Text) section, always built, first in the
  main content column: `title: spec.title` + body from a new `intro` field. **Real gotcha found by
  checking, not assuming:** `RichtextView` (the read-only render) requires `element-data.text` to
  already be a Lexical tree object — it checks `text?.root` directly and renders **nothing** for a
  bare string. Only the *edit* component auto-upgrades a plain string via its own
  `textToLexicalJSON`. So `report_build.mjs` builds the tree itself (`textToLexicalTree`, mirroring
  that exact node shape, extended to split blank-line-separated paragraphs — the existing helper
  only ever makes one paragraph).
- Tracked in `_specKeyMap` under a reserved `title_block` key alongside per-graph keys, so
  `--update` edits it in place (confirmed live: `0 created, 2 updated, 0 deleted` on a revision
  that changed both `intro` and dropped a caption — no duplicate section). Orphan-delete safety
  extended carefully: a `lexical` section is only ever auto-deleted during `--update` if its
  trackingId was previously minted under a tracked key — never a blanket "any untracked lexical
  section", which would risk deleting a Rich Text block an author added by hand elsewhere on the
  page (much more likely for Rich Text than for AVL Graph/Map, given it's the platform's generic
  authoring primitive).
- `--from-page` drift detection extended: title-block heading + intro text compared
  (`lexicalTreeToText`, the inverse flatten), per-graph caption compared alongside the existing
  `_measurePick` check. **Caught a real bug in my own first pass**: I added the intro-text compare
  but forgot to also compare the title-block section's own `title` field, so a hand-edit to just
  the heading wasn't detected — found by testing the hand-edit live, not by review, fixed before
  calling it done.

**Live-verified end-to-end** on a real (draft, unpublished) test page (`2196071`): build showed
the title-block heading + two-paragraph intro and the caption rendering as a subtitle under
"Travel Time Overview"; a hand-edit to the title-block section's title correctly tripped
`--from-page` drift detection and reconstructed `intro`/`caption` correctly; an `--update` revision
that changed the intro and dropped the caption updated both sections in place (`0 created, 2
updated, 0 deleted`) and the live page reflected both changes with no orphaned section. All test
sections/page/snap rows deleted after (page `2196071` + sections `2196072`-`2196075` + snap rows
`2196076`/`2196077`, the latter already superseded by the `--update` replace-row mechanism).

One thing noticed but not chased further (out of scope for this gap, and covered by this task's
own documented layer-3 boundary): the test graph's chart body rendered visually blank in the probe
screenshot on the first build despite the structural checks passing; a later probe after the
`--update` revision showed the same section's network capture returning real non-empty values,
so this reads as a screenshot-timing artifact rather than a data or config problem — not
investigated further per the "unfiltered CH query" caution already on file for this task.

## Gap 4 — rules file + intake checklist, feedback loop, confidence marker: DONE 2026-07-28

Landed as prose additions to `creating-reports.md` (not a new file — the storage
decision above already said rules live there) plus one small real mechanism, since the
intake contract's guess-and-flag posture needs to actually survive into review, not
just be a documented intention.

**What shipped:**
- **Intake checklist** — the posture table from "Intake contract" above (infer /
  guess-and-flag / ask per input), plus the two corollaries earned by user correction
  (nothing is hard-required; road aliases don't resolve from `altrtename`).
- **Rules (earned corrections)** — the 8-rule list above, moved into the skill file
  verbatim in spirit (geometry-not-period, same-season year-over-year, post-2017 only,
  legend-ready route names, explicit difference anchors, don't gate on GIS heuristics,
  guess-and-flag, ask for a screenshot on unresolvable aliases).
- **Feedback loop** — paste-in-chat → `--from-page`/edit → `--update --note` → promote
  to a Rule if it recurs, closing the loop the storage-decisions table promised
  (`_specRevisions` already had the `{at, note, changed_paths}` log from Gap 1; this
  just documents the human process around it).
- **A real `confidence` marker** — not just documentation. `routes[].confidence:
  {level: "low"|"medium"|"high", note}` in the report spec (`report-spec.md` updated).
  `level: "low"` prints a "⚠ NEEDS REVIEW" banner in **both** `--summary` and a real
  build (the latter so the flag survives even if someone skips `--summary` and builds
  directly) — but never blocks the build, matching the "guess and flag, don't gate"
  rule exactly. Malformed `confidence.level` is a hard validation error (same treatment
  as every other spec enum typo). `confidence` isn't `_`-prefixed, so it survives
  `stripInternal` into `_spec` and is picked up by the existing coarse `diffSpecs` —
  a reviewer resolving the ambiguity later shows as "route X modified" in the revision
  log, for free.

**Also found and fixed, while checking this against the actual skill files rather than
just the task file:** `creating-routes.md` had never been updated for Gap 2 — it
documented only the transportNY map tool, with zero mention of `route_build.py`
despite that CLI path being done and verified 2026-07-27. Restructured it the same way
`creating-reports.md` treats the UI column: CLI (`route_build.py find`/`build`, the
three-tier validation, the `--verify-routing` experimental caveat) as the primary path,
map tool kept as the documented human path. Necessary groundwork, not a tangent — the
intake checklist's "guess and flag" posture is meaningless if the skill file a reader
follows for segment-extent discovery only points at the slower, human-only path.

**Live-verified 2026-07-28:** a real draft report built from a spec with one
low-confidence route (`report_build.mjs`, no flag — the actual build path, not just
`--summary`) printed the NEEDS REVIEW banner and completed structural checks
successfully; `--summary` on the same spec showed the banner plus the per-route
`confidence:` line; a malformed `confidence.level` failed loudly with `exit 1` before
any writes. Test page `2196561` + sections `2196562`-`2196565` + snap row `2196566`
deleted after, confirmed gone via `dms_npmrdsv5.data_items`/the split-table dataset
query (not `raw get`, per the established gotcha).

## Second real client request, run end-to-end through the actual skill — 2026-07-28

A second real AVAIL/client email thread (Poughkeepsie road diet: sidewalk reconstruction
closed 1 lane of westbound US-44/NY-55 near Garden St, City of Poughkeepsie, for "several
days in late April 2026… around April 20-30"; client gave TMC 120-11332 directly). Built a
full spec through `route_build.py` + `report_build.mjs` from the raw correspondence, without
looking at AVAIL's real answer first, then compared against the real report they shipped
(old-tool `admin2.reports` id 1071, "WB East-West Arterial Poughkeepsie") to check the skill
against ground truth. **User caution, mid-session, worth keeping attached to every claim
below: AVAIL's own report is a good reference, not an oracle — it has its own real
imperfections (see the stale-caption finding below), so a difference from it is a data
point, not automatically a defect in either report.**

**A real CLI bug hit immediately: `route_build.py find` crashed on every call.**
`cmd_find`'s contiguity-check printed `<-- BREAK` using an undefined `COORD_TOLERANCE`
(leftover from before the `build` command's gap check was refactored to
`endpoint_gap_meters`/`GAP_WARN_METERS` — `find` was never updated to match, so it
`NameError`'d on the first multi-segment road). Fixed by reusing the same
`endpoint_gap_meters` helper `build` already uses. This had been silently broken since
whenever that refactor landed — `find` is the very first command the skill tells a reader
to run, so this would have blocked step one of `creating-routes.md` for anyone hitting a
road with more than one segment.

**The route resolved cleanly, high confidence, no guess needed.** TMC 120-11332 is
US-44 WESTBOUND, DUTCHESS county, ending at "MARKET ST/CIVIC CENTER PLZ" — exactly the
client's named extent ("mainly between Catherine St and Civic Center Plaza"). Client-given
TMC, not an inference, so no `confidence` flag on the route itself.

**A real, load-bearing data-availability check the spec format doesn't automate: is the
study period even inside data coverage?** April 2026 is inside raw NPMRDS coverage
(`npmrds.s583_v982_NPMRDS_V6` runs 2017-01-01 through 2026-07-12 live) but **outside**
source 1410's pm3 coverage (2018-2025) — so the InfoBox `reliability` bucket (LOTTR/TTTR/
Freeflow — the old tool's road_diet-typical "Route Info Box/freeflow, speed" panel) hard-fails
for this report's entire study window. Substituted `travelTime`/`hoursOfDelay` InfoBox
buckets instead and said so in the graph's `why`, same pattern as NY-9D's signal_timing
substitution. This is a case the intake checklist doesn't yet name explicitly (it covers
segment-extent and date-window guesses, not "is my chosen measure bucket even queryable for
this year") — worth a checklist line if this recurs.

**A genuinely valuable analytical step the client's own request invited, and the skill
doesn't currently prompt for: checking the raw data BEFORE trusting the client's date
guess.** The client explicitly said they couldn't recall exact closure dates ("around April
20-30"). Querying `npmrds.s583_v982_NPMRDS_V6` directly for this TMC before writing the
spec found a clean, physically-sensible signal: **daytime (8am-4pm) travel time was
consistently elevated Monday-Thursday, April 27-30, 2026, and *not* April 20-26** — bounded
by normal travel times on both sides (April 24 and earlier, May 1 and later). Built the
report's before/during windows on that finding (`confidence: medium` on the during-instance,
with the reasoning spelled out) rather than the client's literal, self-described-uncertain
range.

**Then AVAIL's real report showed this "precise" narrowing was itself too narrow, along a
different axis I hadn't checked: peak-hour vs. all-day.** Report 1071's `route_comps` split
every 2026 instance into **AM Peak (7-10am) and PM Peak (4-7pm)** sub-windows and compared
each against **the same calendar dates one year earlier (April 20-30, 2025)** — year-over-year,
not adjacent-weeks-same-year. Re-running the raw-data check restricted to those exact peak
windows changed the substantive conclusion: **AM peak travel time was ~11-25% higher in 2026
than the same 2025 dates across the *entire* April 20-30 window, including April 20-24** (the
days my all-day-average check had called "normal baseline") — **but PM peak was *lower* in
2026 than 2025**, opposite direction. The all-day, single-baseline average I built genuinely
washed out a real AM/PM divergence; it wasn't just a less-detailed cut, it supported a
different headline claim ("only the last 4 days were affected") than the peak-split,
year-over-year cut supports ("AM peak was worse basically the whole time; PM peak wasn't").
Neither cut is obviously wrong, but they answer "was there an impact" differently, and a
client-facing report should surface that instead of picking one silently.

**This traces to a real, now twice-confirmed capability gap, not a modeling choice I could
have made differently within today's spec format**: there is no way to express a peak-hour
(or any time-of-day) sub-window on a route instance. `routes[].startDate`/`endDate` are dates
only; there is no `startTime`/`endTime` (the old tool's `route_comps` carry exactly this —
`startTime`/`endTime` alongside `amPeak`/`pmPeak` flags), and `report_build.mjs` sets every
graph's `filters` to a hardcoded empty `{op: "AND", groups: []}` with no spec field feeding
it — confirmed by grep, zero hits for `filters` as a spec-consumed key anywhere in the
script. The intake checklist already lists "Peak-only vs all-day: **ask**" for exactly this
reason (`report-route-ui-parity-gaps.md` gap #11) — the right move per that posture was to
ask or flag this explicitly in the spec's `why`, and this attempt didn't; noted here so the
gap in *my own process*, not just the tool, is on record.

**AVAIL's actual composition, for the record** (13 sections over 9 route instances, all one
`route_id`): Route Map (full width, geometry) · Route Info Box combining all 4 peak/year
comps across 5 measures (speed, travelTime, hoursOfDelay, length, avg_speedlimit) in one
table · a ~2-year daily hoursOfDelay trend Bar Graph (`comp-7`, April 2024 - April 2026) for
long-range context — a panel type with no equivalent in this session's report at all · AM
Peak and PM Peak Line Graphs (2026 vs. 2025 overlay, `plain` mode, 5-minute resolution) · six
Bar Graphs breaking AM/PM-by-day 2026 and 2025 out separately by measure. **No difference/
subtraction panel anywhere** — the comparison is entirely overlay-and-eyeball, relying on
day-resolution bars across the client's full stated range to let the viewer spot which days
moved, rather than a computed delta. My report's explicit `comparisonMode: "difference"` Bar
Graph is a real, useful addition beyond AVAIL's typical house style here, not a mistake — but
it's a difference over the *wrong* baseline (adjacent-weeks-same-year, all-day) given what the
peak-split check above found.

**AVAIL's report has its own real flaw, per the caution above — not held up as the answer
key.** The AM Peak Line Graph's caption is generic boilerplate that doesn't match this
report's own layout: "Hours of Excessive Delay (the graph on the right, below) shows…" when
no such graph is positioned to the right of it in this report's actual grid — almost
certainly copy-pasted from a template and never edited for this specific build. Good
reminder that a human-authored caption can go stale exactly the way an inferred one can.

**Stale doc found while writing the spec**: `creating-reports.md`'s composition-hints table
(the "spec-buildable today?" column) still says "Route Info Box **not yet**" for
before/after, road_diet, reliability, and route_comparison — written before Gap 8 (Info Box
wiring) shipped 2026-07-28, same file, and never updated after. Needs a pass to flip those
cells now that InfoBox is real, and probably to add a "peak-hour scoping: not yet, see gap
below" row given what this session found.

**What shipped**: route `2196581` ("US-44/NY-55 Westbound - Garden St, Poughkeepsie"), report
page `2196582` (`converted_reports/poughkeepsie_garden_st_road_diet`), 6 graphs (LineGraph
overview, difference BarGraph, two Route Map choropleths, two InfoBox summaries), left as a
draft pending the user's call on whether to revise toward AVAIL's peak-split/year-over-year
framing or ship the current within-2026 all-day cut with the gap noted. Real, non-placeholder
data confirmed via `report_probe.mjs --wait 15000` (first probe at the default wait showed
0/13 SVGs with content — same screenshot-timing artifact already on file from Gap 3's
verification, not a build bug; the longer wait rendered both charts and both InfoBox tables
with real, directionally-sensible values — baseline 2:47 avg travel time / 25.0 mph vs.
during-window 3:06 / 22.6 mph).

## Next steps

1. ~~Template-library investigation~~ — **DONE 2026-07-27**, see above. Outcome: no report
   archetypes exist; the reusable unit is the panel; skip census clustering; the real gap is a
   **composition layer** over the existing panel vocabulary.
2. ~~Wire Route Map into `report_build.mjs`~~ — **DONE 2026-07-27** (same session as the
   correction above). `spec.graphs[]` now accepts `{graphType: "Map", measure: "none"|"speed"|
   "travelTime"|"hoursOfDelay"|"avgHoursOfDelay", resolution?}` (resolution only required for
   avgHoursOfDelay: `"day"`|`"5-minutes"`). `report_build.mjs` shells out to a new
   `convert_old_reports.py --route-map-section` CLI mode (new function
   `build_route_map_section_state`) rather than reimplementing template-minting/CH-baking in JS —
   same reuse principle the file's own PARITY GUARANTEE docstring already uses for AVL Graph via
   `applyMeasurePick`. That Python entrypoint dispatches to the exact same `ensure_route_map_*_
   template` functions and (for speed/travelTime/hoursOfDelay/avgHoursOfDelay) bakes a real
   per-report choropleth from the graph's assigned routes' pooled TMCs/date range, via two
   helpers extracted from the existing bake functions (`pooled_route_map_values`,
   `apply_route_map_paint` — pure extraction, verified byte-identical behavior against reports
   1056 (avgHoursOfDelay, two-source join) and directly against live CH data for speed/none, all
   dry-run, zero tracebacks). "none" measure skips baking (geometry-only, matches
   `build_graph_section_data`'s existing `is_map` no-op case). A graph with no resolvable
   tmcs/dates (or a query returning no values) still builds — placeholder paint renders, a
   warning prints, the build isn't failed (matches this task's "guess and flag, don't block" rule).
   **Live-verified end-to-end**: built a real (unpublished) test page from a one-route,
   one-Map-graph spec (`route_id` 2126095, measure `speed`) — `report_probe.mjs --auth` showed
   the section's own `colorDomain` UDA call returning a real value (`min=69.06 max=69.06 count=1`,
   matching a direct CH query against the same TMC/date range) and the screenshot shows a real
   MapLibre map with a populated legend ("Test Route: 69.06 - 69.06"), zero console/page errors.
   Test page `2195928` (+ sections `2195929`-`2195931`, snap row `2195932`) deleted 2026-07-27
   via `scratchpad/npmrds-sub/mint_token.sh` on user go-ahead ("i think u have a valid token,
   if not, make ur own and cleanup") — same pre-authorized flow as the round-64 cleanup.
3. ~~Gap 1 — spec-on-the-row + `--update`/`--from-page` reconcile~~ — **DONE 2026-07-27**, see above.
4. ~~Gap 3 — prose sections (title block, intro, per-graph captions)~~ — **DONE 2026-07-27**, see above.
5. ~~Gap 4 — rules file + intake checklist into `creating-reports.md`~~ — **DONE 2026-07-28**,
   see above. All four gaps are now closed; remaining items below are follow-on work, not part
   of the original four-gap arc.
6. Drop plugin route dates (isolated transportNY change).
7. `--ui-guide` generator — emits the human click-path for a given spec, and doubles as the
   Phase C parity harness (any spec field with no UI control emits a flagged gap instead of
   silently omitting).
8. ~~Wire Route Info Box into `report_build.mjs`~~ — **DONE 2026-07-28.** `spec.graphs[]` now
   accepts `{graphType: "InfoBox", measure: "reliability"|"travelTime"|"length"|"aadt"|
   "hoursOfDelay", grain?: "route"|"tmc", bin?: "amp"|"midd"|"pmp"|"we"}` — see "Route/TMC Info
   Box graphs" in `report-spec.md` for the full writeup. Exactly the wiring task item 2 predicted:
   a new Python `build_route_info_box_section_state` (mirrors `build_route_map_section_state`)
   dispatches to the five already-built `ensure_*` template functions
   (`ensure_pm3_join_template`/`ensure_info_box_traveltime_template`/`ensure_info_box_length_
   template`/`ensure_info_box_aadt_template`/`ensure_info_box_delay_template`), exposed via a new
   `--route-info-box-section` CLI mode; `report_build.mjs` shells out to it via a new
   `composeInfoBoxGraphState`, same reuse principle as Route Map's `composeMapGraphState`.

   **Simpler than Route Map in one respect:** an Info Box section needs no per-report baking step
   — every bucket queries live via the cloned template's own join (pgFederated for `reliability`,
   plain CH join for the other four), so it composes in a single pass before route resolution,
   with no placeholder-vs-baked distinction. `reliability`'s year is derived automatically from
   the assigned routes' dates (same idiom as Route Map's network-year resolution) and, unlike
   Route Map's geometry-year clamp, has no fallback if outside source 1410's 2018-2025 coverage —
   a hard build error, checked in JS before ever shelling out to Python.

   **A real correctness bug found and fixed while wiring this, not by reasoning:** an Info Box
   graph and the page's own Add-a-Route section both have element-type `Spreadsheet` (Route Map
   and AVL Graph each have their own unambiguous element-type), but `--update`'s reconcile logic
   identified the Add-a-Route section, and swept orphaned graph sections, by element-type alone.
   Left unfixed, a page with an Info Box graph could have `--update` mistake the Add-a-Route
   section for a tracked graph (or vice versa) and — more concretely, live-caught by testing the
   swap, not by review — silently leave a dropped Info Box graph's old section as a permanent
   orphan, since the orphan-sweep's `['AVL Graph', 'Map'].includes(elementType)` check never
   matched `Spreadsheet` at all. Fixed by having both checks consult the stored key map's tracked
   trackingIds instead of raw element-type for the `Spreadsheet` case only (AVL Graph/Map keep
   their existing element-type-only behavior, unchanged). `--from-page` needed the same
   disambiguation for its own graph-section filter; fixed via a new `_infoBoxPick` marker
   (mirrors `_routeMapPick`) stamped onto every Info Box build, letting both `isGraphSectionElement`
   (tell an Info Box section apart from Add-a-Route) and reconstruction (recover
   `measure`/`grain`/`bin` exactly, `_needsReview`-flagging pre-marker sections) work off the
   section's own state rather than needing the key map to be present.

   **Live-verified 2026-07-28** end-to-end on a real (draft, unpublished) test page: a one-route
   spec with a `reliability` (`bin: "amp"`) and a `travelTime` Info Box graph built successfully
   (structural checks passed); `report_probe.mjs --auth` confirmed both sections queried live and
   rendered real values (LOTTR≈1.30, TTTR≈2.29, freeflow≈31 mph; travel time 5:34), visually
   distinct from the real Add-a-Route table below them. An `--update` revision swapping the
   `travelTime` graph for a `length` graph, then swapping back, exercised both the create+update
   path (`1 created, 2 updated, 0 deleted` — the 0-deleted case caught the auth-requires-a-token
   gap in `dms section delete`, unrelated to this wiring, worked around the same way prior
   cleanup steps in this task file did) and the delete path in a single clean pass (`1 created, 2
   updated, 1 deleted`), leaving exactly 5 sections with no duplicates or orphans each time.
   `--from-page` round-tripped byte-identical (`matches its stored spec exactly`) after every
   revision. Test page `2196568` + sections `2196569`-`2196573`/`2196577`/`2196579` (including one
   stray section from the auth-interrupted first `--update` attempt) + snap rows
   `2196574`/`2196578`/`2196580` all deleted after, confirmed gone via `page show`/the split
   reports_snap_2 dataset query (not `raw get`).

   Only a genuinely uncovered measure (e.g. `percentile95-byDateRange`) would need new Python, and
   only if a client ask actually needs it — out of scope here.
9. Route Map's other buildable-but-unwired-here corner: `report_build.mjs` doesn't yet resolve a
   Map graph's `color_range` from anything spec-level (only a literal `g.colorRange` array is
   honored, no default-per-measure palette).
10. **Wire Route Compare Component into `report_build.mjs`** — found 2026-07-28 while
    correcting item 8, same class of gap, tracked immediately rather than left to go stale
    again: a base + N-compare-rows %-diff-from-base shape (`ensure_route_compare_template`,
    round 25) already exists in `convert_old_reports.py`, minted as a DMS Spreadsheet section,
    and is classified `BUILDABLE_TYPES` (not `NO_EQUIVALENT_TYPES`) by `census_old_reports.py`.
    Zero references in `report_build.mjs`/`report-spec.md`. Needed for the `signal_timing`
    composition class (71% Route Compare Component on speed and travelTime) — the class
    NY-9D belongs to.
11. **No peak-hour (or any time-of-day) sub-window on a route instance** — found 2026-07-28
    on the second real client-request test (Poughkeepsie road diet, see write-up above), and
    it substantively mattered, not just cosmetically: AVAIL's real answer to that request
    split every route instance into AM Peak (7-10am) / PM Peak (4-7pm), and a peak-restricted
    check of the raw data found AM peak got measurably worse while PM peak didn't — an
    all-day average genuinely hides that split, it doesn't just resolve it less precisely.

    **Spec half DONE 2026-07-28**, same day: `routes[].startTime`/`endTime` (`"HH:mm"`,
    both-or-neither, requires `startDate`/`endDate`). Turned out not to need a new runtime
    mechanism at all — `useGraphPublish.js`'s `transformReportRoutes` has parsed a time
    component on `startDate`/`endDate` into a real ClickHouse `epoch` filter since
    2026-06-23 (predates this task entirely; the earlier claim above that this "needs a
    route-instance-level… field that composes into the AVL Graph section's `filters`" was
    half wrong — the mechanism already existed, `report_build.mjs` just never had a spec
    field to feed it). `report_build.mjs` now combines `startTime`/`endTime` into the exact
    combined date+time string that hook already parses, only at the `reports_snap_2` route-
    entry composition step — `spec.routes[].startDate`/`endDate` stay pure dates everywhere
    else, since Route Map/Info Box read those same fields directly for an unrelated
    Python-side path that has never been taught to parse a time suffix (deliberately not
    touched — scope boundary, not an oversight). Full design, the "no named AM/PM shorthand
    on purpose" rationale, and validation rules are in `report-spec.md`'s `startTime`/
    `endTime` section.

    **Live-verified**: a two-instance (`AM Peak`/`PM Peak`, one shared `route_id`) LineGraph
    build produced a live query whose two `seriesVariants` carried identical `tmc`/`date`
    filters and distinct `epoch` filter lists (`[84..120]` vs `[192..228]`), captured via
    `report_probe.mjs`'s decoded `/graph` request — not just a structural check. The two
    series' rendered means (8.5179 / 8.4455 minutes) matched a direct ClickHouse query over
    the same TMC/window/epoch-range to 5 decimal places. `--from-page` round-tripped
    correctly in both the no-drift echo path and, after forcing drift with a hand-edited
    section title, the live-reconstruction path (verified the reconstruction actually splits
    the persisted combined string back into clean `startTime`/`endTime`, not just that dates
    survive). Test page `2196692` + sections `2196693`-`2196696` + snap row `2196698`
    deleted after, confirmed gone via `page show` and the split-table dataset query.

    **Found, not fixed, while doing this**: `--from-page`'s drift check only inspects graph-
    section content (title/`_measurePick`/caption) — it has never compared the snap row's
    own `routes` field against the stored spec's `routes[]`, so a route hand-edited live via
    `ReportRouteList` (dates, weekdays, and now peak windows) can go undetected as drift, and
    `--from-page` will echo back a stale stored spec instead of reconstructing. Pre-existing
    since routes first got a comparison surface, not introduced here — just more likely to
    bite now that peak windows are a spec-buildable, plausibly-hand-tweaked route field.
    Logged here rather than fixed, since it touches the shared drift check broadly, not just
    this feature (`feedback_isolate_shared_code_changes`).

    **UI half — DONE 2026-07-28, later session.** `ReportRouteList`'s date/time inputs already
    existed and already wrote the same combined format; a labeled peak-hour preset row (AM
    Peak/PM Peak/PM Peak (alt)/Midday/All Day, from `data-types/map21/constants.js`'s
    `REPORTING_BINS`) was added in `RouteRow.jsx`. Before building it, live-tested the premise
    that Route Map/Info Box needed separate wiring — they didn't: both already applied the
    epoch filter live with zero code changes (see `report-route-ui-parity-gaps.md` gap #11 for
    the full correction and verification). Full writeup there.
12. `creating-reports.md`'s composition-hints table needs a pass — the "spec-buildable
    today?" column still says "Route Info Box not yet" in four rows, stale since Gap 8
    shipped 2026-07-28 in the same file it's contradicting. Found 2026-07-28, not yet fixed.

## Cleanup owed

**DONE 2026-07-27.** Test rows `2195846`, `2195847`, `2195829` deleted via `dms raw delete
npmrdsv5 "routes_data|2107427:data" <id>` (needs `DMS_HOST=http://localhost:3001
DMS_APP=npmrdsv5 DMS_TYPE=dev2` + the token from `scratchpad/npmrds-sub/.dms-auth-token` — `dms
raw delete` alone doesn't pick up a `.dmsrc`). Verified gone via `dms dataset query 2107426
--view 2107427 --filter id=<id>` → `total: 0` for all three (`raw get` on a split `:data` row
returns an ambiguous "empty" error, not proof of deletion — use the dataset query instead).

**DONE 2026-07-28.** Gap 4's live-verification test page `2196561` + sections
`2196562`-`2196565` + snap row `2196566` deleted the same way (mint a fresh token via
`scratchpad/npmrds-sub/mint_token.sh`, `DMS_AUTH_TOKEN=$(cat .dms-auth-token) dms raw delete
npmrdsv5 <type> <id>`). Verified gone via a direct count against `dms_npmrdsv5.data_items` /
the split reports_snap_2 table.
