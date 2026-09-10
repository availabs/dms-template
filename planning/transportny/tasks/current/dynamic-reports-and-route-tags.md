# Dynamic Reports, Route Tags & Add-Route Flow

**Project:** TransportNY

Full historical detail for all three items below (code traces, every dated round, live-verification
walkthroughs, bugs found along the way) has moved to
[`dynamic-reports-and-route-tags-archive.md`](./dynamic-reports-and-route-tags-archive.md) — this
file tracks only current status and open items, per `planning-rules.md`'s "task that grows too long
to read" rule (same pattern as `report-page-redesign.md`/`-archive.md`).

## Current status

| Item | Status |
|---|---|
| 1. Add Route Flow (RRL) | **DONE.** Tag-browser modal, Add-Graph modal, Route Row visual redesign all built + live-verified. One prototyped lever (sidebar width) stashed by Ryan, not merged. |
| 2. Route Tags ("folder approximation") | **DONE** (tag taxonomy + manual editing UI). TMC-linear auto-generation: **2024 pilot DONE** (8,660 routes); 10 other years not yet generated (scripts are already generic over year). |
| 3. Dynamic Reports | **Core mechanism DONE.** Old-template porting: 12 catalog templates converted (`converted_reports/reports`). Mechanism B (route-relative dates) DONE. **Relative-dates-relative-to-today: DONE 2026-08-10/11 — all 12 catalog templates now have zero fixed dates**, including the calendar-position grammar enrichment. **`report_build.mjs` Dynamic Report spec support: DONE 2026-08-11 — all 12 catalog templates are now spec-built** (git-committed JSON under `scripts/npmrds-reports/dynamic_report_specs/`, no old-DB dependency) and live-verified for real, superseding the earlier direct-DB-patch round whose comp-date fixes had silently failed to persist. See `report-spec-and-build-script.md`'s "Follow-on: Dynamic Report spec support" for the full record. **Per-route window overrides (`routeWindows`): DONE 2026-08-14 — weekdays/startTime/endTime moved off `routes[]` onto `graphs[]`/`routeWindows` platform-wide, all 12 catalog templates confirmed consistent (8 migrated, 4 never needed it), `snapshot`'s 5-gap hand-by-hand review fully closed.** See "Per-route window overrides" section below for the mechanism build and `snapshot` review write-up for the applied fixes. **2026-08-17: `ReportPageHeader` routes disclosure + duplicate-title-block removal, `--replace` flag for `report_build.mjs`, `travelTime` tooltip duration formatting.** See "Report header routes disclosure..." section below. **2026-09-03: persistent "Viewing as of" control added to `ReportPageHeader`** — the Today-anchor `?asOf=` override is no longer only settable via RRL's one-time entry gate. See "Persistent 'Viewing as of' header control" section below. |

**Context that applies to all three items:** Ryan's coworker (Alex) did separate visual/design work
across these repos (`dms_design_system_v2` NPMRDS category) — see
[`npmrds-design-v2-implementation.md`](./npmrds-design-v2-implementation.md) before starting new
route/report UI work, it may supersede in-flight plans. Old-tool reference point:
`https://npmrds.devtny.org/report/edit/1071` is an `admin2.reports` id, NOT a template — templates
have no bare `/template/edit/:id` route, they only ever load instantiated against a real
route/station (`/template/edit/:templateId/route/:routeId`). These three items are not
independent — item 2 (tags) is infrastructure items 1 and 3 both consume; items 1 and 3 also share
one UI component (`RouteTagBrowserModal`).

---

## 1. Add Route Flow (RRL) — DONE

The old flat inline "+ Add Route" box was replaced with `RouteTagBrowserModal`
(`src/themes/transportny/components/RouteTagBrowserModal/`) — a single-pane drill-down (root →
category → value) mirroring the old tool's folder-browser *organizing effect*, not real folders.
Root view: name search + County/Region/Agency/Auto-generated/Other-tags category tiles. Shared by
both the normal "+ Add Route" flow (`selectionMode="any"`) and Dynamic Reports' entry gate
(`selectionMode="exact"` + `requiredCount`). Live-verified 2026-07-31.

- **Add-Graph modal** (`AddGraphModal/`) — DONE + live-verified 2026-08-03. Reuses Measure Picker's
  vocabulary/`composeMeasureConfig` wholesale; found + fixed a real platform bug along the way
  (`useGraphPublish.js`'s orphan-cleanup effect raced against a freshly-created section, gate fixed
  from `id != null` to `trackingId != null || id != null`).
- **Route Row visual redesign** — DONE + live-verified 2026-08-05. `RouteRow.jsx` restructured into
  collapsed-by-default subsections (Date Range, Base-for-N-routes, Appearance, Graphs) + a "⋮"
  overflow menu (Rename/Remove). Found + fixed a real architecture bug: `hideInView` doesn't work
  for Dynamic Reports (it swallowed the entry-gate modal along with the rest of RRL) — fixed by
  moving the hide-in-view decision into `ReportRouteList.jsx` itself, keyed off `editPageMode`.
- **Not merged**: a per-page sidebar-width lever (`sidebarGroup.width` in core `sectionGroup.jsx`)
  was prototyped and live-demoed, then **stashed by Ryan 2026-08-05** — no decision made on
  template-default vs. per-page vs. a real Settings-pane control. **Reviewed 2026-08-24: Ryan
  considers this done/irrelevant now**, not independently re-verified.

See the archive's "## 1. Add Route Flow (RRL)" section for full code traces and verification records.

## 2. Route Tags ("folder approximation") — DONE (core); auto-generation partial

Tags on routes (`multiselect` column, `array_contains` UDA filter) with a folder-browsing UI built
over them — explicit non-goal: real folders in the data model. Tag taxonomy (County/Region/Agency/
Auto-generated/Other) derived from the old DB's real `admin2.folders`/`stuff_in_folders` structure,
confirmed by Ryan 2026-07-31.

- **TMC-linear auto-generation, 2024 pilot DONE 2026-08-03**: reproduced the old tool's real 2022
  corridor generator, ported against year-matched ClickHouse source 582/983
  (`scripts/npmrds-reports/route_gen_corridors.py` + `route_build.py --tmc-year`) — **8,660
  auto-generated corridor routes for 2024**, independently confirmed via direct SQL. The other 10
  years (2016, 2018–2026 excluding 2024) are **not yet generated** — scripts are already generic
  over year, no further code work expected, just running them.
- **Known, not fixed**: legacy migration is incomplete (34% of old 49,218 routes missing) and
  duplicated (32,194 inserted twice) — flagged for a separate decision. A county-boundary corridor
  continuity gap (linear TMCs truncate at county lines) — shipped matching old behavior per Ryan's
  call, flagged for future revisit.

See the archive's "## 2. Route Tags" section for the full old-DB inspection, generation-mechanism
trace, and validation tables.

## 3. Dynamic Reports

**Core mechanism DONE + live-verified 2026-08-03.** Route slots filled via URL param
(`?routes=id1|||id2`), a "Dynamic Report" toggle in RRL, view-time resolution against the route
catalog (`useDynamicReportRoutes.js`), a blocking entry-gate modal when routes aren't yet picked.
One shared page per template (not one row per use). See archive for the full design/build record,
including a real bug found by Ryan (an unresolved route ran a full unfiltered network-wide query
instead of showing nothing — fixed same day).

**Old-template porting** — 28 candidates identified from real old-DB usage signal
(`admin2.stuff_in_folders`), unified build mechanism (`convert_old_reports.py --template-id`, no
route-data dependency). 6 built individually 2026-08-03/04 (`244`, `238`/`265`/`90`/`221`/`204`);
separately, **all 12 `converted_reports/reports` catalog templates were converted** as part of the
`reports-page-template-catalog.md` task (2026-08-06) — see that task file for the catalog-specific
build record. 22 of the original 28 candidates remain unconverted individually, blocked on either
the Route Info Box "speed" bin-ambiguity data-coverage wall or (fewer than first thought) relative
dates.

**Mechanism B (`relativeDate`/`isRelativeDateBase`) — built + live-verified 2026-08-04.** A route's
date can derive from ANOTHER route/comp on the same report flagged as the base (not from wall-clock
time) — shared Python resolver (`convert_old_reports.py`) + live-recompute JS
(`relativeDateResolution.js`, `ReportRouteList.jsx`). **Relative-dates authoring UI built
2026-08-05** — `RouteRow.jsx` gained a Fixed/Derived mode switch so an author can create/edit/remove
a derive relationship by hand, not just via Python conversion.

**Mechanism A (`{recent-N}`, wall-clock-relative) — scoped 2026-08-04, left as a documented gap** at
the time (not built) — see "Relative dates relative to today" below, which superseded and resolved
this via a different, more general design.

### Relative dates relative to today — DONE 2026-08-10, including the calendar-position enrichment

Built 2026-08-10, per Ryan's own follow-up ask after noticing hardcoded years on shipped catalog
pages ("who would use `One Week Study`, hardcoded to Dec 2023") plus a request for viewers to pick
a "base date" when opening a Dynamic Report. Full build record, all findings, and every bug found
(including two caught only after the fact) are in the archive's "## Relative dates relative to
today" section — summary:

- **Design**: a synthetic **"Today (view time)"** virtual base
  (`TODAY_ANCHOR_COMP_ID`/`relativeDateResolution.js`) that plugs into the *existing* Mechanism B
  derive-from system wholesale — zero resolver changes, a route just picks "Today" in the same
  Derive-From dropdown it'd use to pick any other route. A viewer's `?asOf=` override is folded into
  the Dynamic Report entry gate (only shown when the report actually uses the Today anchor).
  Available on any report, not just Dynamic Reports.
- **Retrofitted 5 of the 12 catalog pages** that had any relative-date structure: `One Week Study`
  and `Annual Average Study` (re-pointed off frozen historical bases) are fully live;
  `Monthly Speed Comparisons`'s year-level comps are live; `Monthly Congestion`'s/`Seasonality`'s
  individual month/season comps could NOT be made live (grammar limitation, see below) and got
  concrete-for-now dates instead.
- **Two bugs caught only after initially reporting this done, both corrected same day:**
  1. The golden-corpus regression check (`probe_corpus.mjs`), run only after the fact, caught
     `One Week Study`'s Day-1..Day-5 chain running FORWARD from today into future (no-data) dates —
     fixed by anchoring the chain's LAST day on today and stepping backward instead.
  2. **Ryan directly caught the bigger one**: NPMRDS's live ClickHouse table
     (`npmrds.s583_v982_NPMRDS_V6`) publishes on a real ~15–21 day lag (confirmed live: hard cliff
     at `2026-07-26` vs. real-today `2026-08-10`) — a literal-today default was silently querying
     empty date ranges the whole time, invisible to every "does it render" check up to that point
     (SVG path counts are not proof of real data — see
     [[feedback_verify_the_actual_mechanism]]/[[project_npmrds_data_publish_lag]] memories).
     **Fixed**: `relativeDateResolution.js` gained `NPMRDS_DATA_LAG_DAYS` (`21`) and
     `defaultAnchorDate()` — the default anchor is now real-today-minus-the-buffer, not literal
     today. A viewer's explicit `?asOf=` override is never adjusted.
- **Real, still-open platform/grammar gaps found, not fixed:** a multi-year date-range filter can
  exceed ClickHouse's query-size limit (`Monthly Speed Comparisons`'s "Trailing 6-Year Average");
  the resolver's formula grammar has no way to express "the Nth calendar month/season inside
  whatever year is current" (why `Monthly Congestion`/`Seasonality`'s 14 rows are static, not live).

#### Calendar-position grammar enrichment — built, migrated, and live-verified 2026-08-10

Ryan picked **option 3** (of the three laid out in this doc's prior round) — build the actual
grammar enrichment, not a one-time data patch or leave-as-is. Added a second, independent formula
shape to Mechanism B: **`{startDate|endDate}=>calendar:{month1}-{day1}..{month2}-{day2}`**
(`CALENDAR_POSITION_REGEX` in `relativeDateResolution.js`) — a literal month/day range tied to
whatever CALENDAR YEAR the base it derives from falls in (via `getFullYear()` on the base's own
resolved date), not an offset from the base's own current position the way every existing formula
shape works. `day2` may be a literal day-of-month or `L` ("last day of month2"), so a whole-month
range stays correct across Feb 28/29 without the caller needing to know which. Year-wrap is decided
by comparing `month1`/`month2` only (`month1 > month2` → `month1`'s side is the PRIOR year) —
correctly reproduces `Winter`'s Dec-of-last-year → Mar-of-this-year shape with no special case.

- **`relativeDateResolution.js`**: new `CALENDAR_POSITION_REGEX` + `resolveCalendarPositionFormula()`,
  tried first in `resolveRelativeDateFormula()` before falling through to the existing offset/snap
  regex — zero changes to the existing grammar's own parsing/resolution path.
- **`relativeDatePresets.js`**: two new curated `PATTERN_OPTIONS` — `calendarMonth` (single month
  dropdown, builds `calendar:{m}-1..{m}-L`) and `calendarRange` (from-month/day → to-month/day, for
  seasons) — plus `MONTH_OPTIONS`, `buildFormula`/`parseFormula`/`isValidFormula` all extended to
  round-trip both shapes (verified directly: build → parse → rebuild is stable for both a plain
  month and a year-wrapping range).
- **`RouteRow.jsx`**: Derive-From UI gained controls for both new patterns (month dropdown; two
  month+day pickers for a range); the existing live-preview line needed no changes since it already
  calls the generic `resolveRelativeDateFormula()`.
- **Data migration**: `scratchpad/npmrds-sub/apply_calendar_position_formulas.py` (dry-run-then-apply,
  same convention as `retrofit_today_anchor.py`) re-pointed `Monthly Congestion`'s 12 individual
  months and `Seasonality`'s 5 seasonal windows (`comp-13/18/14/15/16`) from frozen static
  `startDate`/`endDate` literals onto `derivedFromRoute: __TODAY__` + the new `calendar:` formula —
  same `__TODAY__` base their own `Current Year`/`Compare Year` comps already used. Applied directly
  to both live rows (2210631, 2210699); DB read-back confirmed.
- **Not mirrored to `convert_old_reports_lib/dates.py`** — no other known conversion candidate has
  this static-calendar-month/season shape yet (only these two pages ever did), so there's nothing
  for the Python converter to benefit from today; cheap to port if a future candidate needs it (same
  regex + year-wrap logic, ~20 lines).

**Live-verified against real ClickHouse data, not just SVG render counts** (see
[[feedback_verify_the_actual_mechanism]]): `report_probe.mjs` against both pages with a real route
(`120P58011`, the same TMC used throughout this arc) showed 0 console/page/SQL errors on both; the
decoded query payloads confirm every one of the 12 month comps resolved to the mathematically
correct 2026 calendar-month range (`2026-01-01..2026-01-31` through `2026-12-01..2026-12-31`) and
all 5 season boundaries resolved correctly including Winter's year-wrap (`2025-12-19`/`2025-12-20`
→ `2026-03-19`). Cross-checked directly against ClickHouse row counts for the test TMC: June 2026 is
fully populated, July 2026 is populated through the real cliff (`2026-07-26`), August–December 2026
have zero rows — confirming the remaining blank months are the same **inherent, not fixed by this
enrichment** publish-lag tail every option in the prior round accepted (the enrichment's actual
payoff is that `Monthly Congestion`/`Seasonality` never again need a manual yearly re-patch — every
January the formulas automatically re-anchor on the new current year with no code or data change).

**Golden-corpus regression check run** (`node scripts/npmrds-reports/probe_corpus.mjs`, per
`regression-testing-npmrds-reports.md` — this touched `RouteRow.jsx`/RRL-adjacent code, so this was
mandatory, not optional): all 5 pre-existing entries still PASS unchanged (the new `calendar:`
regex is tried first but only matches its own new formula shape, zero effect on the existing
grammar's own parsing path — confirmed empirically, not just by inspection). **Manifest gap found
and fixed**: no entry was tagged for `dateFormula`/`derivedFromRoute`/`relativeDateResolution.*`
despite `dynamic_report_one_week_study` already exercising the Today-anchor mechanism — added those
`covers` tags to that entry, per the doc's own "reverse direction matters too" rule. **Two new
entries added and captured** (`dynamic_report_monthly_congestion`, `dynamic_report_seasonality`,
both `?routes=2207838`) — the first real golden-corpus coverage for either page, and the only
corpus examples of the new `calendar:` formula shape (including its year-wrap case, via Winter).
Baselines hand-inspected before trusting them (0 console/page/SQL errors on both, real chart content
on the panels that should have it). Full suite re-run after adding the new entries: **all 7 PASS**.

Skill doc `traversing-report-pages.md` updated with a new "Calendar-position formulas" subsection
(the formula shape, the `L`/year-wrap rules, the "blank tail past the cliff is expected, not a
regression" caveat, and a pointer to the new corpus entries) — done in this same session, per its
own living-document convention.

**Verify URLs**:
- `http://npmrds.localhost:5173/converted_reports/one_week_study` — no `?routes=` → entry gate with
  route picker + "Viewing as of" field (defaults to `defaultAnchorDate()`, NOT literal today).
- `http://npmrds.localhost:5173/converted_reports/annual_average_study` — same gate, "Current
  Year"/"1/2/3 Years Ago" resolve relative to the picked date.
- `http://npmrds.localhost:5173/converted_reports/monthly_congestion` and `.../seasonality` — every
  panel is now live, including the 12 individual months and 5 seasonal windows; months/seasons past
  the real ClickHouse data cliff (check `SELECT max(date) FROM npmrds.s583_v982_NPMRDS_V6` — it
  moves daily) will still show blank, by design (the underlying data doesn't exist yet), not a bug.

### 2026-08-11 through 2026-08-17 — hand-by-hand old-tool comparison round, condensed 2026-08-18

Full detail for everything in this section moved to the archive's new "Continuation: 2026-08-11
through 2026-08-17" section 2026-08-18 (~1035 lines of dated technical narrative — the same
"grows too long to read" trigger that spawned the original archive split, now applied to this
section too). What follows is a condensed pointer per round, matching items 1/2's style above —
read the archive for code traces, exact numbers, and live-verification detail.

**"No fixed dates in Dynamic Reports, ever" — the other 7 catalog templates, DONE 2026-08-11.**
Ryan's hard rule: a Dynamic Report should never ship with a silently-frozen date — anything fixed
gets prompted via the existing "Viewing as of" entry-gate field instead. Applied to
`Single Day (Advanced)`, `Year Over Year`, `Bi-directional`, `Single Route`, `This Month vs. Last
Month vs. Last Year`, `Weekly Average`, `Snapshot` (all now derive from a synthetic `__TODAY__`
base, single-hop only — no 2-hop chaining). Scope boundary set explicitly: this only applies to
`admin2.templates` → `--template-id` conversions (the reusable catalog), never `admin2.reports` →
`--report-id` one-off historical-incident pages, which stay frozen by design. Mid-round, the fix
strategy flipped from a Python-converter change to a direct data-edit patch, because the real goal
— these 12 templates living as git-committed specs, no old-DB dependency — needed
`report_build.mjs` extended first (see the next entry). Live-verified 2026-08-11, all 7, 0
console/page/SQL errors. **CORRECTION, same day**: the patch script's `dms raw update` calls
silently no-op'd on split rows — sections deleted correctly, but comp-date patches never
persisted. The actual, verified fix for all 12 templates ended up being the full spec-file
rebuild described next, not this round's direct-DB-patch approach.

**`report_build.mjs` extended for Dynamic Report specs — DONE + live-verified 2026-08-11.** Route
slots, `dateFormula`/`derivedFromRoute` (incl. `__TODAY__`), and the `--from-page` reverse
direction all landed, making all 12 catalog templates genuinely spec-built and git-committed under
`scripts/npmrds-reports/dynamic_report_specs/` — no old-DB dependency for this class of page
anymore. Full record, including 3 real prerequisite bugs found along the way, lives in
`report-spec-and-build-script.md`'s "Follow-on: Dynamic Report spec support" (that file was itself
consolidated into `completed/` 2026-08-18 — see `reports-docs-consolidation.md`).

**GridGraph per-TMC breakdown FIXED 2026-08-12.** `composeMeasureConfig.js` never built a
per-row breakdown column for GridGraph (only `xAxis`/`color`), so every TMC collapsed into one
aggregate row — a regression of a bug already fixed once in the Python converter (round 42) but
never ported to the JS picker (the two are separate, parallel implementations — see "Root-cause
pattern" below). Fixed by unconditionally emitting a `tmc`-targeted `yAxis` column for any
GridGraph pick; a second bug surfaced by the fix (stale numeric `yAxis.format` rendering every row
label as literal `"NaN"`) fixed alongside. Affected and rebuilt all 7 templates using GridGraph.

**Metadata-unification arc — DONE + live-verified 2026-08-12**, spawned by scoping a join-
compatibility question for multi-measure Info Box (below). Found `vocabulary.json`'s cached
`META_JOIN` column list was itself stale (11 columns hand-cached vs. 58 real columns, confirmed a
strict superset of the older `TMC_IDENTIFICATION_JOIN`) — consolidated to one canonical join
(`META_JOIN`, year-aware) across every consumer: `speed`/`speedTruck` measures, Info Box, Route
Compare, the shared base template every fresh chart clones from, and `fetchTmcMiles.js` (RRL's
route-length display, which needed real per-route-year resolution, not a single global year).
Platform-wide correctness fix — every `speed` chart in the whole app now reads year-correct TMC
metadata, not just the 12 Dynamic Report templates. Also shipped this round: a real plain "speed"
Info Box measure, and multi-measure Info Box/Route Compare support (a measure list instead of one
string, composing fresh Spreadsheet columns per report rather than cloning a shared template row —
join-slot collisions between measure combinations are a hard-fail at build time, not silently
wrong SQL).

**Per-route window overrides (`routeWindows`) — DONE + live-verified 2026-08-14.** Triggered by
the `snapshot` review (below) needing AM/PM/Off-Peak rows a graph-wide scalar `weekdays`/
`start`/`end` couldn't express. `weekdays`/`startTime`/`endTime` moved entirely off `routes[]`
onto `graphs[]`; a new optional `routeWindows: { [routeId]: [{weekdays, startTime, endTime,
color}, ...] }` lets one route expand into multiple filtered variants on a single graph (the "same
route, AM and PM as two bars" case) without a composite-key change anywhere else. `resolution`
was explicitly NOT given the same per-route treatment — it shapes the graph's shared x-axis COLUMN
at compose time, a fundamentally different kind of thing than a per-arm filter. A QuickControls
regression this broke (the "When" pill silently no-op'd) was fixed same session, applying one
uniform window to every route on the graph — genuine per-route override via that UI is a separate,
still-open gap (`report-route-ui-parity-gaps.md` gap #18). The color-consistency problem for a
future live-authoring UI (no single place "the AM variant" lives to default a color from, since
`routeWindows` is deliberately graph-scoped) is flagged, not solved.

**`annual_average_study` — FIXED and live-verified 2026-08-12, two real bugs, one systemic.**
(1) Line/Bar/Grid graphs correctly showed only "Current Year" — the old template's 4 peak-based
sub-comps had already collapsed into one physical route under Design Push #2; re-scoped to show
1 line per year instead. (2) The template's actual year-over-year Route Compare panel was
completely missing — a **systemic** `report_build.mjs` bug, not template-specific:
`isGraphSectionElement()` only recognized Route Compare/Info Box sections via a marker convention
`report_build.mjs` invented itself, which the Python converter never stamped, so any such section
built by the converter was silently dropped from `--from-page` with no warning. Fixed to match by
structure (the `$self` comparison_series subscriber + a `type:'delta'` column) instead. Recovered
and added `compare_years` (Current Year vs. 1/2/3 Years Ago). Flagged as very likely systemic
across the other 11 templates — **audit explicitly deferred, not run**, per Ryan's direction to
finish this template first. Root-cause pattern named this session: (A) Design Push #2's
route↔graph migration never fully retrofitted onto converter-built content, hit multiple times in
different forms; (B) `composeMeasureConfig.js` is a parallel, independent reimplementation of the
Python converter's own composition logic, so a fix in one never propagates to the other by
construction.

**GridGraph/BarGraph magnitude color scale + LineGraph tooltip — FIXED and live-verified
2026-08-12, on `annual_average_study` only.** GridGraph and single-series BarGraphs were
inheriting a ~20-swatch route-identity palette meant for multi-route legends, producing
"confetti" coloring for what's actually a value gradient — fixed to a red/yellow/green
`scheme` scale, respecting each measure's existing `reverseColors` polarity. Separately, LineGraph
tooltips showed full float precision plus a nonsensical "Line Total" for rate-like measures (fixed
via `getTooltipFormatFunc` and gating "Line Total" on the vocabulary's existing `fn:"sum"` flag).
Both fixes live in compose-time code, not the spec — **the other 11 catalog pages needed a plain
rebuild to pick them up** (see the correction in "Open questions" below: most have since been
rebuilt as a side effect of the `routeWindows` migration).

**`annual_average_study`'s missing "Bar Graph Summary" — ADDED 2026-08-13.** The old panel's
peak-hour sub-bars are unbuildable under Design Push #2 (same collapsed-route cause as above);
Ryan's call was to show the same 4 current+trailing-year routes as one bar per year instead,
reusing the already-proven `resolution:"summary"` shape. Same session: pinned `&asOf=2026-07-23`
into every Dynamic Report golden-corpus URL so Today-anchored baselines stop drifting a day
between runs.

**`one_week_study` hand-by-hand comparison — 3 fixes, 2 of them real pre-existing platform bugs
(2026-08-13).** Added a genuinely-missing Route Info Box (one row per weekday, first real usage of
the multi-measure Info Box mechanism) — which surfaced two real platform bugs: one sibling
Info-Box-template function had missed the 2026-08-12 join-drift-detection fix (silently
overwriting a correct join via last-measure-wins dict merge), and Info Box speed/length/aadt
columns had no `formatFn` at all (full float precision leaking to the cell — fixed by adding a new
shared `decimal_2` format, applied to speed only; length/aadt have the identical gap, flagged not
fixed, no live consumer yet). A suspected second missing panel was investigated and found to
already exist correctly — a false alarm, not a bug. Confetti GridGraph colors confirmed as simply
"never rebuilt since the 2026-08-12 fix," not a new issue.

**`single_route` — real formatFn gap plus a rebuild+caption fix (2026-08-13).** Same
never-rebuilt-since-08-12 symptom (static purple bars, stale `TMC_IDENTIFICATION_JOIN`
attribution). One real wrinkle: the graph's own author-facing caption described the OLD
purple/orange color scheme by name — updated the caption text alongside the rebuild rather than
leaving it stale. Documented a reliable 3-symptom tell for "this page hasn't picked up the
2026-08-12 round yet" (flat/confetti single-series color, stale join attribution, full-float
tooltip) for checking the remaining templates.

**`snapshot` hand-by-hand comparison — 5 gaps triaged, `routeWindows` built as a direct result,
all 5 closed (2026-08-14).** Grounded every gap directly in the old DB before triaging. One old
panel (a second-corridor Route Compare) was confirmed genuinely unbuildable as originally
authored — built an approved substitute instead. A genuinely-missing "Hours of Delay by Month"
bar and 4 missing TMC Info Boxes and 2 AM/PM/Off-Peak Bar Graph Summary panels were all built
using the new `routeWindows` array-expansion mechanism (the two Bar Graph Summary panels were the
direct trigger for building `routeWindows` this session, not separate unrelated work). A real,
previously-silent bug surfaced during migration: two graphs sharing Current Year + Trailing 3
Years had been silently dropping Trailing 3 Years' weekend exclusion the whole time (the exact
`routeWindows` failure mode, not hypothetical) — fixed as part of the same migration. **Migration
scope, confirmed consistent across all 12 catalog templates same session**: 8 templates migrated
off route-level `weekdays`/`startTime`/`endTime` (`snapshot`, `annual_average_study`,
`bi_directional`, `monthly_speed_comparisons`, `one_week_study`, `single_day_advanced`,
`weekly_average`, `year_over_year`), 4 confirmed to have never needed it at all
(`monthly_congestion`, `seasonality`, `single_route`, `this_month_vs_last_month_vs_last_year`).
Not done, flagged for separate scoping: `RouteRow.jsx`'s route-level weekday/peak-hour UI now
writes to a field nothing reads (dead write, not yet removed); no live UI exists yet for setting a
graph's own window/`routeWindows` at all (same missing-authoring-surface category as gap #16 in
`report-route-ui-parity-gaps.md`).

**Report header routes disclosure, duplicate-title removal, `--replace` build flag, tooltip fix —
2026-08-17.** See the dedicated section immediately below (kept at full detail, not condensed,
since it hasn't been through a live-verification pass yet as of this condensing).

---

### Report header routes disclosure, duplicate-title removal, `--replace` build flag, tooltip fix — 2026-08-17

Three commits (`3f1b986`, `68c8b06`, `9d61e58`), not yet live-verified as part of writing this
entry (reconstructed from the diffs and commit messages, not a fresh browser session) — flag
anything below that doesn't hold up under the next live pass.

**`ReportPageHeader` routes disclosure (`3f1b986`).** RRL (where a report's routes have always
been visible) is edit-mode-only, so a plain viewer had no way to see which routes/dates a report
was built on without opening edit mode — flagged as an open question below ("show the resolved
base date..."), now closed. `ReportPageHeader.jsx` reads the same `ROUTE_CATALOG_PARAM_KEY`
catalog `useGraphPublish.js` already publishes unconditionally (not edit-mode-gated) for the
per-graph QuickControls Routes pill, and renders a collapsible "N routes in this report" list:
- Grouped by `routeSlotGroupKey` (`useDynamicReportRoutes.js`) — several catalog entries can be
  date/settings VIEWS of one physical route a viewer picked once (`weekly_average`'s "Current
  Year"/"1 Year Ago"/"2 Years Ago" all share one group); each group gets one header naming the
  real corridor (`baseRouteName`, the resolved catalog row's own `name`) with its variants as
  pills underneath, so a multi-route report (`bi_directional`'s separate NB/SB groups) doesn't
  read as an undifferentiated pile of date pills.
- New `resolvedRouteLabel`/`yearRangeForDateFormula` (`relativeDateResolution.js`): a
  year-span-formula route ("Current Year", "1 Year Ago") now displays the actual resolved
  calendar year(s) ("2026", "2024–2026") instead of the relative phrase, once resolved against the
  real (possibly viewer `?asOf=`-picked) anchor date — a non-relative trailing suffix on the
  authored name (`bi_directional`'s "(NB)"/"(SB)") is preserved. Wired into BOTH the header pills
  and `useGraphPublish.js`'s `transformReportRoutes` chart-legend label, so the header and the
  chart underneath it never disagree. Day/week/month/calendar-span formulas ("Yesterday", "This
  Month") are untouched — already literal, non-relative names.
- **Resolves** the open question below about showing a resolved base date in the header instead
  of leaving a viewer to infer it from route labels alone.

**Duplicate-title removal (`3f1b986`, `report_build.mjs`).** Two separate sources of doubled
titles, both removed rather than patched:
1. The `title_block` mechanism (a generic lexical/rich-text section carrying `spec.title` +
   `spec.intro`, built by every spec-built page since the 2026-08-07 Gap-3 fix) duplicated the
   title `ReportPageHeader` already renders as the page's own h1. `spec.intro`, `titleBlockSectionData`,
   `textToLexicalTree`/`lexicalTreeToText`, and the `--from-page` title-block drift-detection branch
   were all deleted outright — no migration path back, `intro` is no longer a spec field at all.
2. A spec-built graph wrote its own title into BOTH `state.display.title` (rendered inside the
   chart card by `GraphComponent.jsx`'s `GraphTitle`) and the Section's own `title` (rendered by the
   generic section-header band above the card, the same band QuickControls attaches to) —
   doubling it once above the card and once inside it. `report_build.mjs` no longer writes
   `state.display.title` at all; the Section's own title is now the only title. `state.display.description`
   (a different field, the difference-mode subtitle) is unaffected and still renders inside the card.

**`--replace` flag for `report_build.mjs` (`9d61e58`).** `--update` reconciles a spec into an
existing page in place, but its section-deletion sweep only covers AVL Graph/Map/Spreadsheet
section types — it can't clean up a retired framework section (e.g. the title-block section just
removed above) left over from a page an older script version built. `--replace` instead deletes
the existing page at the spec's target slug and builds fresh (same mechanism `computeTargetSlug()`
shares with `--update`'s own preflight, so the two can never disagree on which page a given spec
targets). Mutually exclusive with `--update`; the rebuilt page gets a new id (anything that linked
to the old id, not the slug, breaks). **Real bug found and fixed the first time all 12 catalog
templates were `--replace`'d in one session:** `dms page delete` doesn't cascade to the page's own
`reports_snap_2` row (a separate dataset/type) — since `/reports`' catalog cards are populated by
querying `reports_snap_2` directly (by tag, not by page reference), the orphaned old row and the
fresh replacement row both rendered as separate cards for the same report. 16 orphaned rows had
accumulated (some templates 3-4 deep, predating `--replace`'s existence) before this was caught;
`--replace` now looks up and deletes the stale `reports_snap_2` row (via the same `findSnapRow`
`--update` uses) BEFORE deleting the page itself. `--dry-run` reports what `--replace` would
delete without deleting it. (2026-09-04: the underlying root cause — generic page delete not
cascading to `reports_snap_2` at all — was fixed platform-side, see
`src/dms/planning/tasks/current/page-delete-lifecycle-hook.md`; this script's own `findSnapRow`
workaround is now redundant-but-harmless defense in depth rather than the only mitigation, so it's
left as-is.) All 12 catalog templates' dynamic-report spec baselines
(`dynamic_report_annual_average_study`, `dynamic_report_monthly_congestion`,
`dynamic_report_one_week_study`, `dynamic_report_seasonality`) plus the golden-corpus fixtures
were regenerated against the post-title-block-removal build and committed
(`report_probe_fixtures/golden-corpus.json`, `baselines/golden_corpus_{bargraph,gridgraph,linegraph,routemap}.json`)
— presumed re-run clean given the baselines were committed alongside the code change (matching
this doc's established re-baseline convention), but not independently re-confirmed while writing
this entry.

**`travelTime` tooltip duration formatting (`68c8b06`, `composeMeasureConfig.js`).** Reported live:
a Travel Time chart's decimal-minutes tooltip ("0.3 min") was hard to read as a duration and prone
to two visibly different series rounding to the identical displayed value. Added
`valueFormat`/`yFormat: 'duration_mmss'` (`graph_new/utils.js`) specifically for `measureKey ===
'travelTime'`, formatting as "M:SS" with whole-second precision instead — `yFormat` covers
LineGraph's own tooltip read, `valueFormat` every other chart type. `showTotal` behavior (added
2026-08-12, see `annual_average_study` section above) is unchanged.

### Persistent "Viewing as of" header control — built + live-verified 2026-09-03

Ryan's ask: the Today-anchor `?asOf=` override (relative-dates-relative-to-today, above) was only
ever settable via `RouteTagBrowserModal`'s "Viewing as of" field inside RRL's blocking entry gate —
a one-time prompt shown only when a Dynamic Report's routes haven't resolved yet. Once past that
gate (or for an author who never saw it), there was no way to change the date without hand-editing
the URL, which most viewers won't do. Framed as the first case of a custom component letting a
viewer change page-view-mode state outside the existing `filters`/`pageFilters` pattern — turned
out to need no new mechanism at all, just porting RRL's existing plumbing to a persistent location.

**`ReportPageHeader.jsx`** (already reading the route catalog `useGraphPublish.js` broadcasts
unconditionally, in both edit and view mode, for its routes disclosure) gained a "Viewing as of"
date input, shown whenever the route catalog has any entry with `derivedFromRoute ===
TODAY_ANCHOR_COMP_ID` (i.e. the report actually uses the Today anchor) AND the report's `baseDate`-
typed page filter is registered (a Dynamic Report authored before that filter existed has nothing
to control). Writes the URL the same way RRL's entry gate does — `navigate` with an updated search-
params string — but built off the raw `location.search` (only the `asOf` key touched) rather than
reconstructing every `useSearchParams` filter's own value shape, so `?routes=` (already `|||`-
delimited) is preserved byte-for-byte with no risk of re-encoding it wrong.

**Reset-button wording fix, same day, Ryan caught it live**: the no-override default
(`defaultAnchorDate()`) is real wall-clock today MINUS `NPMRDS_DATA_LAG_DAYS` (21 days, the known
ClickHouse publish-lag buffer — see relative-dates-relative-to-today above), not literal today. A
"Reset to today" button would have been actively misleading about what date it resets to. Renamed
to "Use latest available (<resolved date>)" — puts the real date in the label so a viewer never has
to guess what "latest" means — plus a `title` tooltip repeating why data isn't real-time. When no
override is active, a plain "latest available" hint sits next to the date input for the same reason.

**Live-verified**: `report_probe.mjs` against `reports/one_week_study?routes=2207838&asOf=2026-07-23`
(`--auth`, since this pattern's pages 401 for an unauthenticated probe) — control renders pre-filled
with the URL's date; changing it via `fill`+`change` navigates to a new `?asOf=` value with `?routes=`
untouched; reset button reads "Use latest available (2026-08-13)" (the real resolved date, not
"today"); 0 console/page/SQL errors, all 9 sections still render. No golden-corpus baseline changes
needed — this is a new, additive, previously-absent control, not a change to any existing render
path a corpus entry already covers.

**Files changed**: `src/themes/transportny/components/ReportPageHeader/ReportPageHeader.jsx`,
`ReportPageHeader.theme.js`. No changes to `ReportRouteList.jsx`/`RouteTagBrowserModal.jsx` — the
entry gate's own "Viewing as of" field is untouched and still does its one-time job the same way.

---

## Open questions for triage

- **The remaining catalog pages need `--update <id> --publish` to pick up the 2026-08-12
  color-scale/tooltip/metadata-join fixes** (see the sections above) — **corrected 2026-08-18: not
  9 remaining, only 3.** `annual_average_study`, `one_week_study`, and `single_route` picked up the
  fixes directly; `bi_directional`, `monthly_speed_comparisons`, `single_day_advanced`,
  `weekly_average`, `year_over_year`, and `snapshot` all got rebuilt for the 2026-08-14
  `routeWindows` migration, which — since these compose-time fixes live in `composeMeasureConfig.js`,
  not the spec — means they picked up the 2026-08-12 fixes too, as a side effect, not by anyone
  checking for it directly (not independently re-verified here, but the mechanism guarantees it).
  Only `monthly_congestion`, `seasonality`, and `this_month_vs_last_month_vs_last_year` were
  confirmed to need no `routeWindows` migration and so never got rebuilt at all — those 3 are the
  ones still needing a plain `--update <id> --publish` to pick up the color/tooltip/join fixes.
  **Reviewed 2026-08-24: Ryan considers this done/irrelevant now**, not independently re-verified.
- **`length`/`aadt`'s Info Box columns have the same missing-`formatFn` gap `speed`'s did** (see the
  `one_week_study` section above) — flagged, not fixed, since neither has a live consumer yet. Cheap
  to fix the same way (`decimal_2` for length, likely `comma` for aadt) once one does.

Mostly resolved — see the archive's own "Open questions" section for the full resolved list. Still
live:

- The multi-year query-size platform limit (`Monthly Speed Comparisons`'s 6-year comp).
  **Reviewed 2026-08-24: Ryan considers this done/irrelevant now**, not independently re-verified.
- **`report_build.mjs`'s Dynamic Report support: all 12 catalog templates now spec-built, DONE
  2026-08-11** — see item 3's table entry above and `report-spec-and-build-script.md`. Two real
  gaps surfaced along the way:
  - `startTime`/`endTime` on a `dateFormula`-driven slot route — **RESOLVED as a side effect of the
    2026-08-14 `routeWindows` migration, not separately fixed.** The old blocker was specifically
    about `routes[]`-level `startTime`/`endTime` requiring a literal `startDate`/`endDate` on the
    SAME route, which a slot route never has at spec-write time. Now that `startTime`/`endTime` live
    on `graphs[]` instead, that coupling doesn't exist — confirmed by actually building it:
    `snapshot`'s `info_box_snapshot`/`bar_speed_peak_summary`/`bar_delay_peak_summary` all apply
    `startTime`/`endTime` to `current_year` (a `slot: true`, `dateFormula`-driven route with no
    literal date at spec-write time) without issue. `Monthly Speed Comparisons` hasn't been migrated
    off `routes[].weekdays`/`startTime`/`endTime` yet (only `snapshot.json` was this session, per
    Ryan's own scoping) — still blocked until that migration happens, but the underlying platform gap
    is gone.
  - The `avgHoursOfDelay`+`summary` combo (needs a bucket-grain-parameterized expression) is still
    real, hit again independently 2026-08-14 building `snapshot`'s delay Bar Graph Summary (the
    build's own pre-existing validation rejected it) — worked around there with `hoursOfDelay`
    (total) instead, same as `bar_delay_weekday` elsewhere on that page. Still blocks `Single Route`,
    `This Month vs. Last Month vs. Last Year`, `Seasonality` if they want a summary-resolution
    average (as opposed to total) delay bar.
- Route/comp labels ("Today", "4 Days Ago") don't reflect a viewer-picked base date — flagged by
  Ryan 2026-08-11, likely affects all 12 templates, not risky but not top priority. A related, scoped-
  not-built follow-up: show the resolved base date in `ReportPageHeader.jsx` so a viewer isn't stuck
  inferring it from route labels alone. Both detailed in `report-spec-and-build-script.md`.
  **The `ReportPageHeader.jsx` half RESOLVED 2026-08-17** — see "Report header routes disclosure..."
  section above (`resolvedRouteLabel`/`yearRangeForDateFormula` show the resolved calendar year(s)
  for year-relative routes, in both the header and the chart legend). The general
  "Today"/"4 Days Ago"-style day/week labels are day/week-span formulas, not year-span, and were
  flagged as untouched by that fix — **Ryan confirmed 2026-08-24 this is now fixed** (not
  independently re-verified against a live page this session).
- A gap-logged "year-comparison candidate" heuristic for future old-template conversions (2026-08-11
  finding — no reliable automatic detection exists, human-confirmed opt-in only).
- Section-title text across the 7 templates fixed 2026-08-11 still shows stale conversion-time
  labels (e.g. "Before 2018") — deliberately not touched, flagged as cosmetic-only follow-up.
- A viewer-prompted year-range picker — confirmed genuinely harder than "add more series" for at
  least `Year Over Year`'s shape (some old templates have one SECTION per year, not one series per
  year); not scoped further.
- A live interactive click-through of `annual_average_study`'s/`monthly_congestion`'s/
  `seasonality`'s entry gates (only `one_week_study`'s was interactively clicked through).
- Whether editing a shared Dynamic Report template's structure needs special draft/publish handling
  to avoid disrupting a concurrent viewer — probably already covered by DMS's existing
  draft-vs-published model, not confirmed.

**Surfaced while condensing the 2026-08-11→17 round into the archive 2026-08-18 — these were buried
in dated detail and never promoted up here at the time:**

- **The `isGraphSectionElement()` marker-blindness bug (found on `annual_average_study`, fixed
  2026-08-12) is flagged as "very likely systemic across the other 11 templates"** — any template
  whose old Route Compare/Info Box panel the Python converter successfully built once could have the
  same silent-drop-with-no-warning problem. **Audit explicitly deferred, not run**, per Ryan's
  direction to finish finding every issue on one template first. Worth checking the other 11's gap
  logs directly before assuming a rebuild alone would surface it — the bug is in `--from-page`'s
  reconstruction, not the live render, so a missing panel here wouldn't show up as a rendering error.
- `RouteRow.jsx`'s route-level weekday/peak-hour toggle UI now writes to a route field nothing reads
  (dead write, post-`routeWindows`) — flagged for removal, Ryan's own call to scope and test that
  separately, not done as part of the migration.
- No live authoring UI exists yet for setting a graph's own window or `routeWindows` at all — same
  missing-authoring-surface category as gap #16 (`report-route-ui-parity-gaps.md`); everything built
  so far is spec/CLI-only.
- `annual_average_study`'s second old Route Compare panel (Current Year vs. its own peak-filtered
  sub-views) was ruled unbuildable 2026-08-12 specifically because it needed per-route-window
  overrides that didn't exist yet — `routeWindows` shipped two days later (2026-08-14). **Not
  re-checked** whether this specific panel is now actually buildable; flagging rather than assuming
  either way.

**Folded in 2026-08-18 from `client-request-to-report-skill.md` and `catalog-page-slug-naming-fix.md`**
(both moved to `tasks/completed/` as part of the planning-doc consolidation — see
`reports-docs-consolidation.md` — these items were the only genuinely open content either file
still carried):

- `--ui-guide` generator — emits the human click-path for a given spec; would double as the
  Phase C UI-parity harness (any spec field with no UI control would emit a flagged gap instead of
  silently omitting it). Not started.
- Route Map `color_range` default — `report_build.mjs` only honors a literal `g.colorRange` array,
  no default-per-measure palette. Not started.
- `--verify-routing` — an experimental map-matching route validator; the service appears to ignore
  the request body (returns a byte-identical wrong-county TMC list regardless of input), and is
  arguably the wrong oracle anyway since it's bound to one conflation-map vintage while a report
  queries a different TMC universe. The better fix is a per-year TMC-vintage membership check (data
  already exists, source 582) — not built. Flagged 2026-07-27, still not fixed.
- `--from-page` route-field drift — the drift check compares graph-section content
  (title/`_measurePick`/caption) but never the snap row's own `routes[]`, so a route hand-edited
  live (dates, weekdays, peak windows) goes undetected as drift. Found 2026-07-28, not fixed.
- Measure-queryable-for-year check — the intake checklist doesn't yet ask "is this measure bucket
  even covered for the requested year" (e.g. pm3 `reliability` coverage 2018-2025 vs. raw NPMRDS
  coverage 2017-present). Found 2026-07-28 on the Poughkeepsie case study; worth a checklist line
  if it recurs.
- Header `purpose`/`metaLine` placeholder text — every converted page's `ReportPageHeader` section
  is cloned verbatim from the master "Report Page" template and still carries that template's own
  editor-instruction copy (`purpose`: "What question does this report answer?..."; `metaLine`:
  "region · county · agency") instead of real content, on all 12 catalog pages (and the 4
  non-catalog `--report-id` conversions from the same day). Confirmed still true as of the
  2026-08-17 `ReportPageHeader` work (routes disclosure/duplicate-title fixes touched this
  component but not these two fields). Fix is either author real per-template copy for the 12
  catalog rows, or explicitly blank both fields (`ReportPageHeader.jsx` already renders cleanly
  when empty) — recommend real copy for the 12 catalog templates since the effort is the same
  order as blanking and is more useful. The fix that shipped for this task's *sibling* bug
  (`catalog-page-slug-naming-fix.md`'s slug/title swap, DONE 2026-08-07) is itself now likely
  superseded infrastructure — all 12 catalog pages were later deleted and rebuilt via
  `report_build.mjs` from git-committed JSON specs (2026-08-11 onward, `--replace`'d again
  2026-08-17), a different code path than the `--title` override that fixed the slug swap.

## Cross-references

- `research/route-creation/findings.md` — old tool's folder system, marker-placement/auto-routing
- `planning/transportny/tasks/current/route-creation-tool.md` — route creation tool status
- `planning/transportny/tasks/current/reportroutelist.md` — RRL add-flow history
- `src/themes/transportny/components/ReportRouteList/README.md` — component's own design-iteration
  history, self-binding mechanism, gotchas
- `src/themes/transportny/components/RouteTagBrowserModal/` — shared tag-folder-browsing modal
- `src/themes/transportny/components/AddGraphModal/` — Add-Graph modal
- `src/dms/planning/tasks/current/page-templates.md` — generic Page Templates system, item 3's
  baseline
- `src/dms/planning/tasks/current/derived-page-variable.md`, skill `creating-interactive-pages.md`
  — page-variable/URL-param architecture item 3 builds on
- `planning/transportny/tasks/completed/client-request-to-report-skill-archive.md` (~lines 20-90) —
  old tool's 216-template route-slot analysis
- `research/npmrds-reports/info-box-speed-and-relative-dates-scoping.md` — Mechanism A/B scoping,
  relative-date grammar grounding
- `planning/transportny/tasks/completed/reports-page-template-catalog.md` — the 12-catalog-template
  conversion task (item 3's old-template porting, catalog build specifics)
- `src/dms/skills/traversing-report-pages.md` — living skill doc, updated with the Today-anchor
  mechanism, both URL-param bugs, and the publish-lag gotcha found this arc
- memory [[project_npmrds_data_publish_lag]], [[project_dynamic_reports_relative_dates_next_steps]]
  — durable facts/next-step pointer for the publish-lag finding
