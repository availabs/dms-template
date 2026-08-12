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
| 3. Dynamic Reports | **Core mechanism DONE.** Old-template porting: 12 catalog templates converted (`converted_reports/reports`). Mechanism B (route-relative dates) DONE. **Relative-dates-relative-to-today: DONE 2026-08-10/11 — all 12 catalog templates now have zero fixed dates**, including the calendar-position grammar enrichment. **`report_build.mjs` Dynamic Report spec support: DONE 2026-08-11 — all 12 catalog templates are now spec-built** (git-committed JSON under `scripts/npmrds-reports/dynamic_report_specs/`, no old-DB dependency) and live-verified for real, superseding the earlier direct-DB-patch round whose comp-date fixes had silently failed to persist. See `report-spec-and-build-script.md`'s "Follow-on: Dynamic Report spec support" for the full record. |

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
  template-default vs. per-page vs. a real Settings-pane control.

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

### "No fixed dates in Dynamic Reports, ever" — the other 7 catalog templates, DONE 2026-08-11

Ryan's own hard rule, stated directly: **a Dynamic Report should never ship with a silently-frozen
date.** Anything genuinely fixed gets prompted for via the existing entry-gate "Viewing as of" field
(already built, defaults to today) — never baked in. This closed out the last "flagged, not decided"
item from the prior round (the other 7 catalog pages with no pre-existing relative-date structure)
and folded in a scope correction: **this only ever applies to `admin2.templates` → `convert_template.py
--template-id` conversions** (the reusable Dynamic Report catalog). `admin2.reports` →
`convert_report.py --report-id` conversions (one-off historical-incident analyses like "Bridge Hits
Impact — BIN2075837") are frozen BY DESIGN and are explicitly out of scope — a category distinction,
confirmed by Ryan, not a per-page judgment call. Check the `_converted_from_old_template_id` vs.
`_converted_from_old_report_id` marker before assuming a frozen date anywhere else is a bug.

**Design decisions made this round, in order:**
1. **`Single Day (Advanced)`** (previously thought to be an exception, anchored to a real incident
   date) folds into the SAME treatment — its base comp derives from `__TODAY__` too, and the viewer
   picks the actual incident date they want via the existing "Viewing as of" prompt (default today).
2. **`Single Route`** is NOT a two-independent-anchor case — old description confirmed it's "before
   and after a certain time frame," but Ryan reframed it as Year-Over-Year's exact mechanism with the
   middle years cut out (Current Year vs. "N Years Ago" only, skipping what's in between).
3. **"3 years" is the shared default span** for every "how far back" comp across all 7 — replacing
   whatever bespoke number (5, 6, 7) each old template happened to freeze. Chosen for being cheap to
   bump later (a parameterized generator, not a redesign), not because 3 is uniquely correct.
4. **Detection criteria for which old templates get this treatment: no reliable automatic one
   exists.** Old `route_comps`/`graph_comps` carry no semantic tag — comp count is just whatever the
   old author's own JSON happened to hold (confirmed via a targeted architecture read of
   `convert_old_reports_lib`: `db.py`'s `fetch_old_report`/`fetch_old_template` read the row's own
   JSON verbatim, no generating loop to hook). A structural heuristic (≥2 whole-calendar-year comps
   in one routeId group, no existing `dateFormula`) can flag CANDIDATES but can't safely auto-decide
   — `Single Route`'s real comps don't even cleanly match that shape, and its actual intent only
   surfaced from its old free-text `description` field, which is inconsistent across the corpus.
   Recommended (not built): route candidates through the existing gap-log mechanism (a new gap kind,
   surfaced on every `--dry-run`) for human confirmation, plus an explicit hand-maintained opt-in
   list (same convention as `TEMPLATE_SPECS`/`GRAPH_TEMPLATE_MAP`) for templates already confirmed —
   never silent auto-conversion.
5. **Where the fix should live — reversed mid-session.** Initially scoped as a `convert_old_reports_
   lib`/`dates.py` change (cap `route_comps`/`graph_comps` count, re-run `--replace`) — see the
   architecture mapping below. **Ryan then reframed the bigger goal**: relying on the old DB as the
   input for these 12 templates "kinda sucks" — the better end state is each template specced out as
   git-committed JSON, so this class of edit never needs the old DB again. Checked concretely:
   `report_build.mjs`'s spec format **cannot express a Dynamic Report today** — no route-slot
   concept, no `dateFormula`/`derivedFromRoute` fields (confirmed: its `routes[]` requires a real,
   already-picked `route_id` and literal dates; this is exactly why the golden-corpus manifest's own
   `dynamic_report_one_week_study` entry is marked `"NOT spec-built"`). Getting to "spec files, no old
   DB" requires extending `report_build.mjs` first — real, separately-scoped work (see "Not done"
   below) — so **this round's fix was applied as a direct data edit instead, and the `convert_old_
   reports_lib` change was abandoned, not built** (would have been the wrong investment given where
   this is headed).
6. **A considered "snapshot the final result to git" middle step was proposed, then retracted.**
   On inspection it would've been a dead JSON dump nothing could rebuild from or verify against —
   not a real source of truth, just another thing that could silently drift from the live DB (the
   exact "chasing ghosts" failure Ryan flagged). Dropped in favor of: the patch script itself
   (git-committed) as the honest record until `report_build.mjs` is genuinely extended.
7. **`report_build.mjs` (Node/`.mjs`) vs. `convert_old_reports.py` (Python) — not actually
   duplicative**, despite looking similar (both end up writing report page/section data).
   `convert_old_reports.py`'s real complexity is legacy-quirk TRANSLATION (`vocab.py`,
   `info_box_templates.py`, `route_map.py` — thousands of lines of "what did the old author mean");
   `report_build.mjs` INSTANTIATES an already-clean spec with no translation involved. They cleanly
   split along the same `--template-id`/`--report-id` boundary as point 5 above: one-off report
   conversions keep needing Python forever (old DB never goes away for those); template/Dynamic-Report
   building migrates entirely to `report_build.mjs` once extended — no permanent overlap.

**Architecture mapping done for the (abandoned) converter-lib approach**, kept here since it's still
useful ground truth for the `report_build.mjs` extension later: `route_comps` count = `len()` of the
old row's own JSON array, no generating loop (`db.py`'s `fetch_old_report`/`fetch_old_template`).
Sections are one-per-old-`graph_comp`, not one-per-`route_comp` — whether a graph_comp covers ALL
comps (comparisonSeries, safe to resize) or just one (`state.activeRouteComponents` pinned) is old
author data, not converter logic (`section_builders.py:403-447`'s `analyze_graph`). `--replace` is
delete-then-recreate, not in-place update, but the slug converges deterministically from title alone
so a live URL survives a reconversion (`pages.py`'s `compute_report_slug`/`delete_converted_page`).

**Section-count reality check, found while auditing before deleting anything:** trimming a template's
year-comp count is NOT always just "fewer series in one open-ended graph" — `Year Over Year` turned
out to have BOTH shapes at once: some sections (`Route Compare Component`, `Route Line Graph`) already
list every year as a named series (safe, just resizes), but 6 years each had their OWN dedicated
"Avg. Hours of Delay"/"Travel Time" section PAIR (12 separate sections, not series in one graph) —
confirming, live, exactly the risk flagged when Ryan first asked about a viewer-prompted year-range
picker: that idea is genuinely harder than "add more series," since some templates would need to
generate/delete whole SECTIONS at view time, which DMS's authored section-list model doesn't support
today. Deferred, not built (see "Not done" below).

**The actual retrofit, applied as a direct data edit** (`scratchpad/npmrds-sub/apply_today_relative_
patches.py`, one consolidated script instead of an 8th one-off — dry-run-then-apply, same convention
as the prior two migrations):

| Template | Comps kept (all deriving from `__TODAY__` directly, never chained) | Comps/sections dropped |
|---|---|---|
| `Single Day (Advanced)` | Incident Day (`day+0day->1day`) + its 6 existing derived comps, all repointed straight at `__TODAY__` instead of chaining through Incident Day (the single-hop rule below is why) | none |
| `Year Over Year` | Current Year, 1/2 Years Ago, Trailing 3 Years (`year-2year->3year`) | 6 individual-year comps + 24 orphaned sections (12 published + 12 draft — the per-year pairs found above) |
| `Bi-directional` | Same 4, ×2 directions (NB/SB) | 8 comps (2016–2019) + 8 orphaned sections (only 2016 had dedicated NB/SB sections; 2017–2019 were series-only, no orphans) |
| `Single Route` | Current Year, "3 Years Ago" (was "Before"/"After"), Trailing 3 Years (was the 7yr span) | none — every section already named its comp directly, none duplicated |
| `This Month vs. Last Month vs. Last Year` | This Month (`monthof`), Last Month (`month-1month->1month`), Same Month Last Year (`month-12month->1month` — a plain offset, NOT the calendar-position grammar; "same floating month, whole years back" was already expressible), Trailing 3 Years | none |
| `Weekly Average` | Current Year, 1/2 Years Ago (already had exactly 3 comps) | none |
| `Snapshot` | 3× Current Year, "All-time Average" folded into Trailing 3 Years (a real semantic change — flagged explicitly, Ryan didn't object) | none |

**Single-hop constraint, found while converting `Single Day (Advanced)`:** `resolveRouteDates()`
refuses to resolve a comp whose OWN base is itself derived (`base.dateFormula` truthy → no-op) — no
2-hop chaining, by design. So repointing a "current period" base onto `__TODAY__` isn't enough if
other comps derive FROM that base — they all have to be repointed to derive from `__TODAY__`
directly too (translating the base's old formula onto Today; the base's old value effectively
equaled Today/the prompted override anyway, so the math is identical). Documented in
`traversing-report-pages.md`'s new "A derive-from base can never itself be derived" section.

**Live-verified 2026-08-11**, all 7, via `report_probe.mjs` against a real route (`2207838`): 0
console/page/SQL errors on every one. `probe_corpus.mjs` full suite re-run clean (7/7 pass) — one
entry (`dynamic_report_one_week_study`) needed a routine re-baseline first, unrelated to this round's
changes (its Today-anchored dates had simply drifted a day between baseline-capture and this
verification, the expected behavior for anything Today-anchored, not a regression). No new
golden-corpus entries added for these 7 — they exercise the exact same `dateFormula`/
`derivedFromRoute`/`__TODAY__` mechanism `dynamic_report_one_week_study` already covers, not new code
(unlike the calendar-position grammar, which was).

### GridGraph per-TMC breakdown FIXED 2026-08-12 — found during Ryan's hand-by-hand old-tool comparison

Ryan started comparing each of the 12 spec-built catalog templates against the old tool live,
one by one, and caught `one_week_study`'s TMC Grid Graph showing only 1 TMC's worth of data
when its test route has 3. Root cause: `composeMeasureConfig.js` (the picker both the live
Measure Picker UI and `report_build.mjs` call) never built a per-row breakdown column for
GridGraph at all — only `xAxis` (time) + `color` (value) — so `GridGraph.jsx`'s row axis
(which reads a column targeted `"yAxis"`, never `"categorize"`) had nothing to key rows off
and silently collapsed every TMC into one aggregate row. This is the exact same bug the old
Python converter hit and fixed on report 914 back in round 42 (see
[[graph-new-single-categorize-limit]]/[[gridgraph-yaxis-not-categorize]] memories) — the new
picker never got that fix ported over, so **every GridGraph built via `report_build.mjs`
since the 2026-08-11 spec-rebuild round regressed to this collapse**, affecting 7 of the 12
catalog templates (`annual_average_study`, `monthly_speed_comparisons`, `one_week_study`,
`seasonality` [8 GridGraph panels], `single_day_advanced`, `single_route`, `snapshot`).

**Fixed**: `composeMeasureConfig.js` now unconditionally emits a `tmc`-named column targeted
`yAxis` for any `graphType: 'GridGraph'` pick (`buildGridBreakdownColumn`) — `SPEED_EXPR`/etc.
already degrade correctly to a true per-TMC value once grouped by `(epoch, tmc)`, so no
measure-level change was needed. **A second bug surfaced by the fix, fixed alongside**: a
fresh AVL Graph section's inherited `display.yAxis.format` default (`"integer"`, meant for a
LineGraph/BarGraph's real numeric y-axis) was dormant dead config on every prior GridGraph
pick (nothing read it, since there was no yAxis column) — now that GridGraph has a real yAxis
column, that stale numeric format ran the tmc string through `d3-format` and rendered every
row label as literal `"NaN"`. Fixed by force-clearing `display.yAxis.format` to `null` for
every GridGraph pick, matching the existing "re-picking must fully determine every display
field it touches" convention the xAxis-format-clearing code next to it already follows.

All 7 affected templates rebuilt + republished via `report_build.mjs --update --publish`.
Live-verified on `one_week_study` against Ryan's own exact repro URL
(`?routes=2195804&asOf=2026-07-22`) — grid now shows 3 correctly-labeled rows
(`120-29713`/`120-29712`/`120-29711`) instead of 1. `probe_corpus.mjs` full suite re-run
clean after re-baselining `dynamic_report_one_week_study`/`dynamic_report_seasonality` (their
GridGraph query shape intentionally changed — added the `tmc` groupBy dimension — so their old
baselines' exact `/graph` query URLs no longer match; hand-inspected the new dumps first: 0
console/page/SQL errors, real per-TMC content on every panel with in-range data, the 2 blank
Fall panels on `seasonality` are a pre-existing ClickHouse data-coverage gap unrelated to this
fix). `dynamic_report_monthly_congestion`'s unrelated diff (a `Today`-anchored date window
shifting by a day) and a one-off cold-load LineGraph blank on `one_week_study` right after
publish were both investigated and are pre-existing/expected, not caused by this fix — see
`traversing-report-pages.md`'s new GridGraph subsection (§5) for both, added this session.

The Route Info Box question from the same review pass (old tool shows a combined speed+TT
box on `one_week_study`, new page has none) was investigated but NOT fixed — it's the
already-documented "Route Info Box speed bin-ambiguity data-coverage wall" above, not a new
bug: the old graph_comp's `displayData: ["speed", "travelTime"]` only kept its first measure
(`extra_measures_dropped: ["travelTime"]`, per the original conversion's gap log at
`scratchpad/npmrds-sub/old-reports/gaps/template_276.json`), and the survivor ("speed" =
internally the reliability/LOTTR-TTTR measure) needs the assigned comp(s) to land on one of
the 4 FHWA bins (AM/Midday/PM/Weekend) — this template's comps are all-day with no peak flag
set, so `comp_reliability_bin()` can't pick one (`info_box_bin_undetermined`, gap-logged, panel
skipped). No fallback bin exists in source 1410 for "all day." A `travelTime`-only Info Box
(no bin needed) is cheaply buildable if wanted; the reliability/speed half needs a design call
from Ryan first (pick a bin as a lossy default? show all 4? leave out?).

**CORRECTION on the Route Info Box explanation above, same session**: the "reliability
bin-ambiguity" framing was wrong — verified by reading the actual old tool source
(`transportNY/src/sites/npmrds/pages/analysis/components/tmc_graphs/`), not just the Python
converter's own comment. The old tool's Info Box "Speed" measure is plain `miles / travel_time`
(`dataTypes.js`'s `toSpeed`/`speedReducer`) — **zero LOTTR/TTTR/pm3/1410 involvement anywhere**;
that terminology lives in a completely separate, unrelated module (`pm3Map21/`). The Python
converter's `INFO_BOX_BUCKET = ("speed", "travel_time_all")` → new spec's `reliability` measure
is a wrong mapping that was never checked against the real source. Ryan's screenshot
(`npmrds.devtny.org/template/edit/276/...`) confirms the real shape: ONE box titled "Route Info
Box, Speed, Travel Time" with 2 measure columns, one row per assigned route/comp (Monday through
Friday, then Average for Week/Month/Year), each row computed over its own date window, "No Data"
rendered gracefully for out-of-range rows.

**Scoped follow-on work (Ryan's direction, small → large):**
1. **A real plain "speed" Info Box measure — DONE + live-verified 2026-08-12.** `ensure_info_box_speed_template`
   (`info_box_templates.py`) reuses the exact `SPEED_EXPR` the AVL Graph speed measure already has
   (no new join beyond the base template's existing TMC Identification default, no pm3/reliability
   anything) — same shape as `ensure_info_box_traveltime_template`, `fn: "exempt"` at both grains
   (SPEED_EXPR is self-aggregating, degrades correctly to TMC grain same as round 35's proof).
   `INFO_BOX_SPEC_MEASURES` (Python) and `INFO_BOX_MEASURES` (`report_build.mjs`) both updated.
2. **Multi-measure Info Box + Route Compare support — DONE + live-verified 2026-08-12, implemented
   exactly as scoped, no design input needed (unlike item 3 below).** Ryan's question: unlike the per-route-
   window item, is there an open UX decision blocking this? No — there's no existing authoring UI
   to redesign at all (gap #16, `report-route-ui-parity-gaps.md`, added this session — checked
   `AddGraphModal.jsx`, confirmed zero references to either Info Box or Route Compare; both types
   are only reachable via `report_build.mjs`'s spec grammar or the old Python converter), and the
   target shape is already fully determined by the old tool's own real behavior (Ryan's screenshot:
   N columns, one per measure, in one table) — nothing here is a product judgment call.

   - **Spec grammar**: `measure` (currently a single string on both `InfoBox` and `RouteCompare`
     graph entries) needs to accept a list. Cheapest, non-breaking option: accept either a bare
     string (today's shape, unchanged) or an array — normalize to a list internally, no rename, no
     migration of existing specs needed.
   - **Backend composition — real shift, not a UI toggle**: every existing Info Box/Route Compare
     template (`ensure_info_box_traveltime_template`, `ensure_route_compare_template`, etc.) mints
     ONE canonical row per single measure, shared and reused by name across every report needing
     that exact measure. That model doesn't scale to measure SETS (Info Box has 5 measures → up to
     31 non-empty subsets) — cloning one shared template per combination is the wrong direction.
     Right fix: compose the Spreadsheet's columns list directly per report from the N selected
     measures (one value column per measure, reusing each measure's already-defined expression —
     `LENGTH_EXPR`/`AADT_EXPR`/`DELAY_EXPR`/`TRAVEL_TIME_EXPR`/the new plain speed expression from
     item 1/the pm3 reliability columns — plus, for Route Compare, one `type:'delta'` column per
     measure too, matching the old tool's actual per-measure "% vs Main" shape) — the same
     compose-fresh-per-report shape `composeMeasureConfig.js` already uses for AVL Graph, not
     template-cloning. Given both types already need zero per-report baking (resolve live at view
     time per their own docstrings), moving off shared-template-reuse costs nothing functionally —
     just a few more DB rows instead of one canonical row reused everywhere.
   - **Real technical constraint found while scoping (engineering, not design) — join-slot
     collisions**: joins bind to named slots (`table1`, `table2`, ...; `composeMeasureConfig.js`'s
     `buildJoin` already builds these dynamically per `requiresJoin` length, so the MECHANISM isn't
     capped at 2 — but each measure's SQL expression is hardcoded to a specific slot name, e.g.
     `LENGTH_EXPR`/`AADT_EXPR`/the new speed measure all read `table1.miles`/`table1.aadt` assuming
     `table1` = `TMC_IDENTIFICATION_JOIN`, while `DELAY_EXPR` needs `table1` = `META_JOIN` +
     `table2` = `AADT_DIST_JOIN`. Combining any of {speed, length, aadt} with {hoursOfDelay} would
     need BOTH wanting `table1` to mean two different joins at once — a real conflict, not yet
     safe. Checked concretely: {speed, length, aadt, travelTime} — the entire safe cluster — never
     conflict with each other (travelTime needs no join at all; the other three all agree
     `table1` = `TMC_IDENTIFICATION_JOIN`). `reliability`'s pm3 join is a different mechanism
     entirely (pgFederated, its own per-year/bin template) and likely can't combine with anything.
     **The actual combo Ryan needs right now — Speed + Travel Time — has zero conflict** (confirmed
     safe). Recommended: build multi-measure generally, but hard-fail at build time (loud error, not
     silent wrong SQL) for any measure combination whose join requirements collide, rather than
     solving general N-way join-slot remapping for combos nobody's asked for yet.
   - Author-facing UI: Ryan's own proposed shape once an authoring surface exists — `measure`
     becomes a multiselect. Not blocking today (no such surface exists at all, gap #16). Medium.

   **Broader direction flagged by Ryan, explicitly NOT in scope now, revisit soon**: column/measure
   definitions that are load-bearing for the app running should live in git (change-tracked), not
   only as rows sitting in the DB with no source-of-truth file backing them — "we should avoid
   having load bearing pieces in the DB only, if possible." Cloning a DB row is DMS's native
   reusable-component mechanism (Page templates work the same way, e.g. the Report Page template
   row `2187021`), not a one-off mistake specific to Info Box — `composeMeasureConfig.js` (git-tracked
   `vocabulary.json`, computed fresh per pick, no DB row ever the source of truth) is a deliberate,
   narrower exception built for AVL Graph charts specifically, not a system-wide policy. Concrete
   inventory of where the same DB-row-cloning pattern still lives, for whenever this gets picked up:
   Route Map (`ensure_route_map_*_template`); the reliability/pm3 join templates
   (`ensure_pm3_join_template`, already combinatorial — one row per grain × year × bin — which is why
   it already needed a bolted-on drift-detection/reconciliation mechanism, the exact risk Ryan is
   naming); regular AVL Graph charts built via the OLDER one-off report-conversion path
   (`convert_report.py`'s `TEMPLATE_SPECS`/`ensure_graph_templates`, as opposed to the newer
   `composeMeasureConfig.js` path) — that older mechanism was bypassed for new work, not retired;
   and Info Box/Route Compare, this item.

   **Implemented + live-verified 2026-08-12, exactly matching the scope above:**
   - `info_box_templates.py`: `build_route_info_box_section_state_multi(measures, grain, templates,
     dry_run)` — calls each measure's own `ensure_*` function (zero duplicated expression logic),
     pulls its value column, checks join compatibility (`check_info_box_measure_combo` —
     `INFO_BOX_MULTI_JOIN_GROUP` table, rejects `reliability`-plus-anything and any
     `tmc_identification`/`meta_aadt_dist` mix), assembles one fresh Spreadsheet state. Never
     mints/persists a combo-named template row.
   - `route_compare_template.py`: `build_route_compare_section_state_multi(measures, templates,
     dry_run)` — same shape, simpler (only 2 possible measures, already join-compatible, no
     compatibility check needed).
   - `section_builders.py`: `build_route_info_box_section_state`/`build_route_compare_section_state`
     now accept `measure` as a string (unchanged path) or a list (dispatches to the multi builders
     above when length >= 2).
   - `cli.py`: `--info-box-measure`/`--compare-measure` accept comma-separated values; Python
     `ValueError`s from a bad combo surface as a clean `ap.error()` (usage + one-line reason), not a
     stack trace.
   - `report_build.mjs`: `INFO_BOX_MEASURES` includes `speed`; both `InfoBox`/`RouteCompare`
     validation blocks accept `measure` as string or array (`measureList()` helper); the
     join-compatibility matrix is deliberately NOT duplicated in JS — Python
     (`INFO_BOX_MULTI_JOIN_GROUP`) stays the single source of truth, `composeInfoBoxGraphState`/
     `composeRouteCompareGraphState` just catch the Python rejection and surface it as a clean build
     failure instead of a raw `execFileSync` stack trace.
   - **Verified**: dry-run confirmed `speed,travelTime` composes correctly for both Info Box (2
     columns, correct join) and Route Compare (`__series` + 2× value/delta pairs); confirmed
     `speed,hoursOfDelay` and `reliability,speed` both fail loudly with the exact intended message,
     pre-DB-write. Applied for real to `annual_average_study`'s `compare_years` panel
     (`measure: ["speed", "travelTime"]`) — live-verified: the table now shows all 4 columns (Speed,
     % vs Main, Travel Time, % vs Main) with real, physically-sensible values (speed up ↔ travel
     time down across all 3 prior years). `probe_corpus.mjs` full suite re-run clean (only the
     pre-existing, unrelated `monthly_congestion` Today-anchor date drift already identified earlier
     this session; two other transient findings — `one_week_study` cold-load pending-requests,
     `monthly_congestion` one-off 404 console error — both did not reproduce on a second probe,
     confirmed unrelated to this change).

### Metadata-unification arc — DONE + live-verified 2026-08-12, spawned by scoping the join-compatibility check above

While scoping item 2's join-compatibility matrix, Ryan asked why `speed`/`length`/`aadt` and
`hoursOfDelay` used two different `table1` sources in the first place — that question led to a
much bigger, valuable fix than the original multi-measure work.

**The investigation**: `TMC_IDENTIFICATION_JOIN` (source 455/view 3464, "NPMRDS TMC
Identification V5/V6") is a single static snapshot per TMC — joined on `tmc` only, no year
dimension — while `META_JOIN` (source 582/view 983, "NPMRDS_V6_tmc_meta," Ryan's own table) is
joined on `(tmc, year)`. I initially asserted (wrongly, from `vocabulary.json`'s own cached
11-column list for `META_JOIN`) that the two tables had mostly-disjoint columns. **Ryan pushed
back with his own direct DB investigation** (`SELECT * FROM data_manager."views" WHERE
source_id = 582` — 12 views: 983 ClickHouse all-years, 984 Postgres all-years, 10 single-year PG
views) — his numbers didn't match my claim. Checked the REAL live table directly
(`DESCRIBE TABLE npmrds_meta.s582_v983_NPMRDS_V6_tmc_meta`): **58 columns**, not 11 —
`vocabulary.json`'s old `META_JOIN` entry was itself a stale, hand-trimmed cache (only the 4
columns `hoursOfDelay`'s expression happened to reference), not the real schema. The real table
is a confirmed **strict superset** of `TMC_IDENTIFICATION_JOIN`'s ~43 columns (every column,
verbatim names) plus geometry (`wkb_geometry`) and admin codes TMC_IDENTIFICATION_JOIN never had.

**Ryan's direction, in order**: (1) "every query should pull tmc metadata for its actual year" —
confirmed this matters for real, not hypothetically: `miles`/`aadt` genuinely differ by year for
most TMCs (~96% for `miles`, not rounding noise — real TMC-network-vintage step-changes, e.g. a
20% jump for one sampled TMC between 2018→2019; `aadt` drifts most years for nearly every TMC,
expected since it's an annual traffic count by design). (2) confirmed year coverage is complete
(2016–2026, all 11 years, no gaps) before touching anything shared. (3) "should prob just have 1
entry/constant for this correct multi year table, and nothing else" — consolidate fully, don't
leave two overlapping join definitions.

**Fixed, in full — not a partial patch**:
- `vocabulary.json`: `META_JOIN`'s column list corrected to the real 58 columns;
  `measures.speed`/`speedTruck.requiresJoin` repointed from `TMC_IDENTIFICATION_JOIN` to
  `META_JOIN`; `TMC_IDENTIFICATION_JOIN` entry **removed entirely**.
- `info_box_templates.py`: `ensure_info_box_speed_template` and `_ensure_static_info_box_template`
  (length/aadt) now set `join` explicitly to `META_JOIN` instead of inheriting the base
  template's default. Added real drift detection to `_ensure_static_info_box_template` (it used
  to short-circuit unconditionally on any existing row — same latent gap round 59 already fixed
  for `ensure_info_box_delay_template` — caught here because `route_info_box_length`/
  `tmc_info_box_length`/`tmc_info_box_aadt` already existed live from an earlier round and would
  otherwise have silently kept the old join forever). Also fixed a real bug found while adding
  this: `value_col` never had a `customName` (harmless as the only column in a single-measure
  box, invisible/blank-header once multi-measure put it next to other columns).
- `route_compare_template.py`: same fix — `ensure_route_compare_template`'s `join` now explicit
  `META_JOIN` (was inheriting the base's default too), added join-drift detection alongside the
  existing column-drift check.
- **The shared base template itself** (`tmc_travel_time_line_graph`, row `2187310` — the row
  EVERY fresh AVL Graph/Info Box/Route Compare section in the whole system clones its own
  default `join`/`externalSource` from) — its own `join` updated to `META_JOIN` directly in the
  DB, so nothing new can silently inherit the wrong table again, not just the specific functions
  touched above.
- **`fetchTmcMiles.js`** (RRL's route-length display, the one remaining consumer outside
  report-building) migrated too. This one needed real design thought, not just a join swap: it
  has no date context at all (used while an author is still picking a route, before any date
  range exists), and `META_JOIN` is per-`(tmc, year)` — a bare tmc filter now returns ~11 rows
  per TMC instead of 1. **Ryan caught this needed more than a naive fix**: hardcoding "today's
  calendar year" would silently break for any TMC the metadata table hasn't been updated for yet
  (e.g. a January run before the new year's batch lands). Fixed: fetch every year on file per
  TMC, take the most recent. **Ryan caught a second, deeper gap**: the actual caller
  (`useRouteMileage.js`) processes a WHOLE report's routes in one batched query, and different
  routes in the same report commonly have different years (e.g. `annual_average_study`'s Current
  Year vs. 3 Years Ago) — collapsing to one global "most recent year" would show every route's
  TMC length using the same year's segmentation regardless of that route's own date. Fixed
  properly: `fetchTmcMiles` now returns `Map<tmc, Map<year, miles>>` (every year, uncollapsed),
  and `useRouteMileage` picks the right year per route from `route.startDate`, falling back to
  most-recent only when a route has no resolvable date (e.g. an unresolved Dynamic Report slot).
- Applied the drift fix for real to every pre-existing live row: `route_info_box_length`
  (`2196575`), `tmc_info_box_length` (`2190604`), `tmc_info_box_aadt` (`2190645`),
  `route_compare_speed` (`2189364`), `route_compare_travelTime` (`2197807`), plus the base
  template (`2187310`) — confirmed via `dms raw list` these were the only pre-existing rows in
  the affected shape; no `route_info_box_aadt`/`route_info_box_speed`/`tmc_info_box_speed` existed
  yet, so those will simply mint correctly on first real use.
- `MeasurePicker/README.md` rewritten (`### joins` section) to document `META_JOIN` as the one
  canonical TMC-metadata join and the full correction history; `composeMeasureConfig.js`'s one
  stray comment reference updated.

**Live-verified**: rebuilt `annual_average_study` (`--update --publish`) twice (once after the
join swap, once after Route Compare's own fix) — every section's attribution line now correctly
reads `NPMRDS_V6_TMC_META (983)` instead of `NPMRDS TMC IDENTIFICATION V5/V6 (3464)`, including
the Route Compare panel, with 0 console/page/SQL errors and physically-sensible values unchanged
(speed ~23–24 mph, deltas consistent). `probe_corpus.mjs` full suite re-baselined (this is a real,
platform-wide query-shape change — every corpus entry's `fetchTmcMiles` lookup query changed from
targeting view 3464 to view 983, confirmed by checking the actual old baseline's captured URL
before re-capturing) and re-run clean: 6/7 pass, the 7th (`one_week_study`) shows only
probabilistic map-tile-loading pending-request noise (reproduced intermittently across three
separate probes of the identical page/moment, confirmed unrelated to anything touched this
session — real map-tile timing, not a query bug).

**Scope note**: this went beyond the originally-scoped multi-measure join-compatibility check —
it's now a platform-wide correctness fix (every `speed`/`speedTruck` chart across the whole app,
not just the 12 Dynamic Report templates, now reads year-correct TMC metadata) plus a genuine
architecture cleanup (one canonical metadata join, not two overlapping ones). Ryan's explicit
direction covered this ("idc how stale things are... just scope and fix it... test/validate").
3. **Per-route-usage weekday/time-window override — applies to ANY graph type with multiple
   assigned routes, not just row-per-route shapes.** Corrected twice during scoping, final shape:
   - **Generalized beyond Bar Graph Summary/Info Box** — Ryan's own counter-example: a plain
     LineGraph legitimately wants two overlaid lines, "Travel Time, all day, no weekday filter" vs.
     "Travel Time, all day, Mondays only" — same shared x-axis/resolution, different weekday FILTER
     per line. Confirmed this isn't hypothetical or scoped to axis-less graphs: `report_build.mjs`'s
     `uniform(weekdaysList)` check (`:1224-1247`) runs for every graph type with no type gate, and
     its own comment already flags the gap ("weekdays/startTime/endTime are still spec'd per-route
     ... best-effort ... otherwise warn and leave unset"). **Not hypothetical** — it already fired
     for real, mid-session, on `annual_average_study`/`monthly_speed_comparisons`/`snapshot` while
     rebuilding the GridGraph fix above. Resolution/bucket-width correctly stays graph-level (it's
     the shared axis every overlaid route must agree on); weekdays/start/end are filter criteria on
     each route's own query and should be per-route-usage for any graph type.
   - **Storage stays graph-side, keyed by route — not moved back onto the route object.** Ryan's
     correction: reading `route.weekdays` directly would be wrong precisely because Design Push #2
     existed to fix this same class of fragility — the OLD model (`route.graphIds`, an array ON THE
     ROUTE describing which graphs consume it) went stale easily, which is why routing flipped to
     `graph._measurePick.routeIds` (an array ON THE GRAPH). A route's own top-level `weekdays` has
     the identical problem: the same route commonly feeds several graphs at once (`one_week_study`'s
     "Today" route feeds 4 sections), so a value stored on the route can't express "graph A wants
     this route filtered to Mondays, graph B wants it unfiltered" — it'd be forced uniform again,
     recreating exactly what Design Push #2 eliminated. Corrected shape: a new map on the GRAPH's own
     `_measurePick`, e.g. `routeWindows: { [key]: { weekdays, start, end } }`, read by
     `useGraphPublish.js` in place of today's single graph-wide `{weekdays, start, end}`.
   - **The "same route, twice, different filters, as two series on one graph" case — Ryan's call:
     EITHER mechanism is acceptable, composite-key path preferred as cleaner.** Two ways to represent
     it: (a) add the same route to the report a second time as a fully separate route-comp instance
     (the "intended way" per Ryan, same UX as adding any route today, just pointed at the same
     TMCs/dates again) — no new key shape needed, `routeWindows` stays keyed by plain
     `route_comp_id`; or (b) reference the SAME `route_comp_id` twice within one graph's `routeIds`,
     disambiguated by a composite key (route_comp_id + variant) — Ryan's stated preference, "probably
     a cleaner implementation in terms of how we think about routes overall... a composite key
     doesn't seem like a big lift" — avoids minting a duplicate reports_snap_2 route-comp row (with
     its own name/color/dates) just to express a filter variant; one canonical route entry, the
     graph's own `routeWindows` map carries each variant. `routeIds`/comparisonSeries's `__series`
     series-identity mechanism would need to accept a composite key, not just a bare
     `route_comp_id`, for this path — not yet checked how large that touches
     `useGraphPublish.js`/`applyMeasurePick`'s series-keying.
   - Author-facing UI still undecided either way (RouteRow sidebar explicitly excluded — Ryan: users
     should not configure this per-route in the sidebar; some new surface on the graph's own settings
     is implied) — **Ryan is checking with Alex (doing design work) before any of this gets built.**
     Medium-large regardless of which representation wins: new storage field, a
     `useGraphPublish.js` read-path change, and new settings UI with no existing analog to build from.
4. **Audit the other 11 templates for other dropped Info Box measures** (same `extra_measures_dropped`
   class as `one_week_study`'s). Ryan's direction: do this LAST, and it may not need live
   browser comparison at all — every one of the original conversions wrote a gap log to
   `scratchpad/npmrds-sub/old-reports/gaps/template_<old_id>.json` (see `template_276.json`,
   found this session), so a mechanical grep for `extra_measures_dropped` scoped to Info Box graphs
   across all 12 logs may answer this without any UI work. Ryan is doing his own hand-by-hand
   comparison regardless and can take this himself if scripting it proves not worth it.

### `annual_average_study` — FIXED and live-verified 2026-08-12, two real bugs, one systemic

Ryan's report: the whole template only shows 1 year, should show current + 3 prior. Two distinct
causes found:

1. **Line Graph/Bar Graphs/Grid Graph correctly show only "Current Year"** — confirmed against the
   old template's raw `admin2.templates.graph_comps` (id 278): their 4 old comps (AM Peak/PM Peak/
   Off Peak/all-day, all sub-views of ONE calendar year) already collapsed into a single physical
   route (`route_comps_merged` gap, calendar range 2024) before this session touched anything —
   Design Push #2 removed the ability to store a time-of-day sub-view as its own route. Not a bug;
   re-scoped per Ryan's own call: Line Graph now shows 1 line per year (Current + 1/2/3 Years Ago,
   no peak filter) instead of just Current Year — strictly better than the unbuildable peak-based
   original.
2. **The template's actual year-over-year comparison panel — a distinct "Route Compare Component"
   graph type — was completely missing, and it's a systemic `report_build.mjs` bug, not
   template-specific.** `isGraphSectionElement()` only recognized a Route Compare/Info Box section
   if it carried a `_routeComparePick`/`_infoBoxPick` marker — a convention `report_build.mjs`
   invented itself; `convert_old_reports.py` (confirmed via grep: zero hits anywhere in
   `convert_old_reports_lib`) never stamps it. So any such section the Python converter successfully
   built was silently invisible to `--from-page`, dropped from the spec with **no warning at all**
   (worse than the AVL Graph case, which at least gets `_needsReview`). Confirmed via the old
   template's own gap log that its original 2026-08-07 conversion DID build 2 real Route Compare
   panels (`extra_measures_dropped` activity for both) — neither survived into the spec.
   - **Fixed** `isGraphSectionElement()` to match structure instead: the same self-bound
     `comparison_series`/`$self` subscriber the live runtime's own `findSelfBoundGraphs` uses (rules
     out the Add-a-Route section, which never has one), plus a `type: 'delta'` column
     (`route_compare_template.py:53`) as the Route-Compare-vs-Info-Box tell. Sections recovered this
     way get `_needsReview` for the measure (can't recover it without the marker) rather than a
     guess — same honesty rule the AVL Graph fallback already follows.
   - **Recovered the missing panel per Ryan's suggested workflow**: ran
     `convert_old_reports.py --template-id 278` fresh (still works unmodified) against a throwaway
     scratch page (separate slug, deleted after use, never touched the live page), then re-ran the
     now-fixed `--from-page` against it — confirmed it now recovers BOTH Route Compare panels
     (previously totally invisible). Added the buildable one to the spec: `compare_years` (Current
     Year vs 1/2/3 Years Ago, real distinct routes, `RouteCompare` graphType, `measure: "speed"`,
     Current Year as anchor). The other (Current Year vs its own peak-filtered sub-views) is NOT
     buildable — its 3 compare arms are the same orphaned peak comps that already collapsed into
     "Current Year," so today it would compare one route to itself; blocked on the same not-yet-built
     per-route-window-override architecture as the peak-based Bar Graph Summary (item 3 above). Both
     old Route Compare panels' 2nd measure (Travel Time) is also dropped — `ROUTE_COMPARE_MEASURES`
     is single-measure-per-graph today, same not-yet-built multi-measure gap already scoped for Info
     Box (item 2 above).
   - **This bug is very likely systemic across the other 11 templates**, not
     annual-average-study-specific — same reconstruction pipeline, same marker blindness, for any
     template that had a working Route Compare or Info Box panel originally. **Audit explicitly
     deferred, not run** — Ryan's direction: finish finding every issue on THIS template first, since
     anything found here likely recurs elsewhere, rather than re-running all 12 per bug found.

Both fixes made via the spec (`scripts/npmrds-reports/dynamic_report_specs/annual_average_study.json`)
+ `report_build.mjs --update --publish` — no direct page edits, per Ryan's explicit requirement that
the correct Dynamic Template must be reproducible solely from the spec JSON. Live-verified against
Ryan's own repro URL: Line Graph shows 4 overlaid year-lines; the new Route Compare table shows real
percent-vs-Current-Year deltas (1 Year Ago +3.05%, 2 Years Ago +3.8%, 3 Years Ago +1.82%) exactly
matching the old tool's shape. `probe_corpus.mjs` full suite re-run clean (only the pre-existing,
unrelated `monthly_congestion` Today-anchor date drift, already identified earlier this session).

**Root-cause pattern behind this and several other findings this session (Ryan's own question,
mid-investigation)**: not one single cause, but two distinct recurring ones. (A) Design Push #2's
routing-contract migration (moving route↔graph relationships and weekday/time-of-day windows off the
route, onto the graph) was never fully retrofitted onto content the Python converter had already
built — this bug, the AVL-Graph `_measurePick`-wiped-on-retrofit gap, and the per-route-vs-per-graph
weekday mismatch (item 3 above) are all the same migration, unreconciled a different way each time.
(B) `composeMeasureConfig.js` is a separate, parallel reimplementation of graph-column composition,
independent of the Python converter's `template_specs.py`/`ensure_graph_templates` — the GridGraph
per-TMC bug is this class: fixed in Python in round 42, never ported to the JS picker, because
nothing shares a fix between the two by construction.

**Not done — real follow-ups, explicitly deferred, not started:**
- **Extend `report_build.mjs`** to support route slots (unfilled, resolved later via `?routes=`) and
  the relative-date formula grammar (`dateFormula`/`derivedFromRoute`, including `calendar:`) as
  first-class spec inputs — the actual prerequisite for "these 12 templates live as git-committed
  specs, no old-DB dependency." **Core mechanism DONE + live-verified 2026-08-11.** `one_week_study`
  is now fully spec-driven for real — the old `convert_old_reports.py`-built page (id `2210438`) was
  deleted and rebuilt from `scripts/npmrds-reports/dynamic_report_specs/one_week_study.json` under
  the identical slug (Ryan's call: no `--update`-bootstrap capability for a pre-existing page, manual
  delete+rebuild instead). Catalog metadata (`tags`/`difficulty`/`page_path`/`graph_count`/
  `counts_label`, needed for `/reports`'s category tiles — `tags` is load-bearing for the catalog's
  own row filter, not just display) is now a spec-derived field too, not a side-channel patch. See
  `report-spec-and-build-script.md`'s "Follow-on: Dynamic Report spec support" for the full record,
  three pre-existing bugs found+fixed along the way. **"Bar Graph Summary" (one bar per route, no
  time bucketing) — initially flagged as a real platform gap, then BUILT the same day**: a new
  `resolution: "summary"` value, once checking the actual render/query code showed both already
  fully supported this shape — see the same doc's "'Bar Graph Summary' built" section. `one_week_study`
  now has all 7 real panels, nothing dropped. Two remaining open items: route/comp names ("Today", "4
  Days Ago") not reflecting a viewer-picked base date (flagged by Ryan, cosmetic/low-priority, likely
  affects all 12 templates) plus a scoped-not-built follow-up to show the resolved base date in
  `ReportPageHeader.jsx`.
  **Not done**: the other 11 catalog templates (untried).
- **A gap-logged "year-comparison candidate" heuristic** in the old-report analysis pass (point 4
  above) — flagged as the right shape for future candidate discovery, not built.
- **Section-title text** across all 7 still shows stale labels baked in at conversion time (e.g.
  Single Route's sections say "Before 2018"/"After 2023" even though the underlying dates are now
  live) — deliberately NOT touched this pass; a real pre-existing comp-name/title mismatch was found
  on `Single Day (Advanced)` (its comp was named "2024" but its own section already said "2023 Avg
  Day" even before this round), so blind find-replace risked compounding a stale mismatch rather than
  fixing it. Comp NAMES themselves (author-facing, shown in RouteRow's Derive-From dropdown) WERE
  renamed correctly.
- The viewer-prompted year-range picker (Ryan's own earlier idea) — confirmed harder than "add more
  series" for at least `Year Over Year`'s shape (per the section-count finding above); not scoped
  further.

**CORRECTION, 2026-08-11: the "Live-verified" claim above (and the whole comp_patches table) was
false for 6 of the 7 templates.** `apply_today_relative_patches.py`'s `dms raw update` calls
silently no-op on `reports_snap_2` split rows regardless of `--row-type` (see
`reference_dms_section_create_cli_gaps` memory) — the *sections* got deleted correctly (a working
CLI path), but the *comp date patches* never persisted. Root-caused while converting `Year Over
Year` for real: its live route array still had all 10 original frozen-year routes, zero
`dateFormula` anywhere, despite this section claiming otherwise. **The actual, verified fix for all
11 remaining catalog templates is the spec-file rebuild documented in `report-spec-and-build-script.md`**
("Follow-on: Dynamic Report spec support" → the per-template subsections) — each old page was
deleted and rebuilt fresh from a git-committed spec under `scripts/npmrds-reports/dynamic_report_specs/`,
not patched in place. **All 12 catalog templates are now spec-built and live-verified for real** —
the "Not done: the other 11 catalog templates (untried)" bullet above is stale; nothing is untried
anymore.

---

## Open questions for triage

Mostly resolved — see the archive's own "Open questions" section for the full resolved list. Still
live:

- The multi-year query-size platform limit (`Monthly Speed Comparisons`'s 6-year comp).
- **`report_build.mjs`'s Dynamic Report support: all 12 catalog templates now spec-built, DONE
  2026-08-11** — see item 3's table entry above and `report-spec-and-build-script.md`. Two real
  gaps surfaced along the way, still unbuilt (not hypothetical — each now blocks 2-3 real templates):
  the `avgHoursOfDelay`+`summary` combo (needs a bucket-grain-parameterized expression; blocks
  `Single Route`, `This Month vs. Last Month vs. Last Year`, `Seasonality`) and
  `startTime`/`endTime` on a `dateFormula`-driven slot route (confirmed genuinely blocking by reading
  `report_build.mjs`'s own validation, not just unverified; blocks `Monthly Speed Comparisons`'s and
  `Snapshot`'s AM/PM/Off-Peak panels).
- Route/comp labels ("Today", "4 Days Ago") don't reflect a viewer-picked base date — flagged by
  Ryan 2026-08-11, likely affects all 12 templates, not risky but not top priority. A related, scoped-
  not-built follow-up: show the resolved base date in `ReportPageHeader.jsx` so a viewer isn't stuck
  inferring it from route labels alone. Both detailed in `report-spec-and-build-script.md`.
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
- `planning/transportny/tasks/current/client-request-to-report-skill-archive.md` (~lines 20-90) —
  old tool's 216-template route-slot analysis
- `research/npmrds-reports/info-box-speed-and-relative-dates-scoping.md` — Mechanism A/B scoping,
  relative-date grammar grounding
- `planning/transportny/tasks/current/reports-page-template-catalog.md` — the 12-catalog-template
  conversion task (item 3's old-template porting, catalog build specifics)
- `src/dms/skills/traversing-report-pages.md` — living skill doc, updated with the Today-anchor
  mechanism, both URL-param bugs, and the publish-lag gotcha found this arc
- memory [[project_npmrds_data_publish_lag]], [[project_dynamic_reports_relative_dates_next_steps]]
  — durable facts/next-step pointer for the publish-lag finding
