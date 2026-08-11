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
| 3. Dynamic Reports | **Core mechanism DONE.** Old-template porting: 12 catalog templates converted (`converted_reports/reports`). Mechanism B (route-relative dates) DONE. **Relative-dates-relative-to-today: DONE 2026-08-10/11 — all 12 catalog templates now have zero fixed dates**, including the calendar-position grammar enrichment and the "no fixed dates in Dynamic Reports, ever" round covering the other 7. `report_build.mjs`'s lack of Dynamic Report spec support flagged as a real follow-up, not yet started. |

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

**Not done — real follow-ups, explicitly deferred, not started:**
- **Extend `report_build.mjs`** to support route slots (unfilled, resolved later via `?routes=`) and
  the relative-date formula grammar (`dateFormula`/`derivedFromRoute`, including `calendar:`) as
  first-class spec inputs. This is the actual prerequisite for "these 12 templates live as
  git-committed specs, no old-DB dependency" — a real, separately-scoped build, not something to
  start mid-fix. Once it exists, `convert_old_reports_lib` stops needing to know about template
  building at all (see point 7 above).
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

---

## Open questions for triage

Mostly resolved — see the archive's own "Open questions" section for the full resolved list. Still
live:

- The multi-year query-size platform limit (`Monthly Speed Comparisons`'s 6-year comp).
- **Extend `report_build.mjs`** for route slots + relative-date formulas as spec inputs — the real
  prerequisite for retiring old-DB dependence on the 12 catalog templates, scoped 2026-08-11, not
  started.
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
