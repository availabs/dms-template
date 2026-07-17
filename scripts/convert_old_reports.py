#!/usr/bin/env python3
"""
Convert old NPMRDS reports (npmrds_production admin2.reports) into new DMS
report pages (npmrdsv5+npmrds_sub), preserving as much old data as possible.

See src/dms/planning/tasks/current/old-reports-conversion.md for the full
design, data-shape mapping, and known gaps.

Reads:
  - OLD system: direct Postgres (admin2.reports / admin2.routes) — the old
    falcor API is not needed; creds come from avail-falcor's db config.
  - NEW system: shape checks read Postgres directly (read-only); ALL writes go
    through the DMS CLI (`dms raw create`, `dms section create`, ...) so
    dmsDataEditor semantics (split-table routing, id allocation) are preserved.

Per converted report this creates:
  - one npmrds_sub|page (child of the "Converted Reports" parent page),
    published (draft + published section copies sharing trackingIds, like the UI)
  - one ReportRouteList section + one AVL Graph section per convertible old
    graph_comp + one "Add a Route" Spreadsheet section (all cloned from the
    Report Page template row, graphs from npmrds_sub|avl_graph_template rows)
  - one reports_snap_2 row (report_id = new page id) holding the converted
    routes; unconvertible old settings are preserved verbatim on each route
    entry under _old_settings (the :data row is schema-free)
  - missing routes are upserted into the Routes Data catalog
  - a gap report (stdout + scratchpad/npmrds-sub/old-reports/gaps/)

Usage:
  python3 scripts/convert_old_reports.py --report-id 1070 [--dry-run]
"""

import argparse
import json
import os
import re
import subprocess
import sys
import uuid
from datetime import datetime, timezone

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dbq  # noqa: E402 — sibling scripts/ module, read-only CH/PG query runner

# ── New-system constants (npmrdsv5/dev2 dev site) ──────────────────────────
DMS_ENV = {
    "DMS_HOST": os.environ.get("DMS_HOST", "http://localhost:3001"),
    "DMS_APP": "npmrdsv5",
    "DMS_TYPE": "dev2",
}
TOKEN_FILE = os.path.join(REPO, "scratchpad/npmrds-sub/.dms-auth-token")
PATTERN = "npmrds_sub"
PAGE_TYPE = "npmrds_sub|page"
COMPONENT_TYPE = "npmrds_sub|component"
GRAPH_TEMPLATE_TYPE = "npmrds_sub|avl_graph_template"
PAGE_TEMPLATE_ID = 2187021          # "Report Page" page template row
REPORTS_SNAP_TYPE = "reports_snap_2|2177440:data"
ROUTES_CATALOG_TYPE = "routes_data|2107427:data"
# Direct-read split tables (read-only checks; writes go through the CLI)
REPORTS_SNAP_TABLE = "dms_npmrdsv5.data_items__s2177438_v2177440_reports_snap_2"
ROUTES_CATALOG_TABLE = "dms_npmrdsv5.data_items__s2107426_v2107427_routes_data"
CONVERTED_PARENT_SLUG = "converted_reports"
CONVERTED_PARENT_TITLE = "Converted Reports"

NEW_DB_CONFIG = os.path.join(
    REPO, "src/dms/packages/dms-server/src/db/configs/dms-mercury-3.config.json")
OLD_DB_CONFIG = "/home/ryan/code/avail-falcor/db_service/npmrds.config.json"

GAPS_DIR = os.path.join(REPO, "scratchpad/npmrds-sub/old-reports/gaps")

# ── Old graph_comp → new avl_graph_template mapping ─────────────────────────
# Keyed (old graph type, displayData measure, resolution, dataColumn).
# `dataColumn` picks the raw travel-time column; the MEASURE a graph displays is
# per-graph `state.displayData` (defaults per graph type below) — see the old
# tmc_graphs/utils/dataTypes.js registry. Grows as templates are added; every
# unmapped combination lands in the gap report.
GRAPH_TEMPLATE_MAP = {
    # Round 52: Route Difference Graph / TMC Difference Grid — the last two
    # major unbuilt old graph types (old tool: exactly 2 comps, Main +
    # Compare — same physical route, same resolution — inner-joined per
    # x-bucket (and per TMC for the grid), rendering Main − Compare). The
    # heavy lifting is the platform's comparisonSeries "difference" combine
    # mode (library task comparison-series-difference-mode.md); these specs
    # are their plain bar/grid siblings plus the combine key + diverging
    # colors. Increment A = the two headline speed×5-min×all buckets
    # (106+94 corpus instances); remaining measures/resolutions/dataColumns
    # follow once this shape is live-proven (same phasing as Route Map M2→M3).
    ("Route Difference Graph", "speed", "5-minutes", "travel_time_all"):
        "route_diff_speed_5min",
    ("TMC Difference Grid", "speed", "5-minutes", "travel_time_all"):
        "tmc_diff_grid_speed_5min",
    # Round 52 increment B: every remaining diff bucket whose measure
    # expression ALREADY exists and is proven (travelTime/hoursOfDelay/
    # avgHoursOfDelay/CO₂ passenger+truck/speed at 15-min+day), plus the
    # truck-SPEED column swap (same canonical formula on
    # travel_time_freight_trucks — the old server computed speed from the
    # comp's own dataColumn column directly). Deliberately NOT built (real
    # formula questions, gap-log stays): hoursOfDelay×truck (the volume term
    # — total AADT distribution vs truck-share — needs the old server's delay
    # route read before minting) and avgCo2Emissions×travel_time_all (a
    # combined-fleet CO₂ expression exists for no graph type yet).
    ("Route Difference Graph", "travelTime", "5-minutes", "travel_time_all"):
        "route_diff_travel_time_5min",
    ("Route Difference Graph", "hoursOfDelay", "5-minutes", "travel_time_all"):
        "route_diff_delay_5min",
    ("Route Difference Graph", "avgHoursOfDelay", "5-minutes", "travel_time_all"):
        "route_diff_avg_delay_5min",
    ("Route Difference Graph", "speed", "15-minutes", "travel_time_all"):
        "route_diff_speed_15min",
    ("Route Difference Graph", "speed", "day", "travel_time_all"):
        "route_diff_speed_day",
    ("Route Difference Graph", "speed", "5-minutes", "travel_time_truck"):
        "route_diff_speed_5min_truck",
    ("Route Difference Graph", "avgCo2Emissions", "5-minutes", "travel_time_passenger"):
        "route_diff_avg_co2_5min_passenger",
    ("Route Difference Graph", "avgCo2Emissions", "5-minutes", "travel_time_truck"):
        "route_diff_avg_co2_5min_truck",
    ("Route Difference Graph", "co2Emissions", "5-minutes", "travel_time_passenger"):
        "route_diff_co2_5min_passenger",
    ("TMC Difference Grid", "travelTime", "5-minutes", "travel_time_all"):
        "tmc_diff_grid_travel_time_5min",
    ("TMC Difference Grid", "hoursOfDelay", "5-minutes", "travel_time_all"):
        "tmc_diff_grid_delay_5min",
    ("TMC Difference Grid", "avgHoursOfDelay", "5-minutes", "travel_time_all"):
        "tmc_diff_grid_avg_delay_5min",
    ("TMC Difference Grid", "avgCo2Emissions", "5-minutes", "travel_time_passenger"):
        "tmc_diff_grid_avg_co2_5min_passenger",
    ("TMC Difference Grid", "avgCo2Emissions", "5-minutes", "travel_time_truck"):
        "tmc_diff_grid_avg_co2_5min_truck",
    ("TMC Difference Grid", "speed", "5-minutes", "travel_time_truck"):
        "tmc_diff_grid_speed_5min_truck",
    ("TMC Difference Grid", "speed", "15-minutes", "travel_time_all"):
        "tmc_diff_grid_speed_15min",
    ("Route Line Graph", "speed", "5-minutes", "travel_time_all"): "tmc_speed_line_graph",
    ("Route Line Graph", "travelTime", "5-minutes", "travel_time_all"): "tmc_travel_time_line_graph",
    ("TMC Grid Graph", "speed", "5-minutes", "travel_time_all"): "tmc_speed_grid_graph_tmc",
    ("Route Bar Graph", "speed", "day", "travel_time_all"): "tmc_speed_bar_graph_day",
    ("Route Bar Graph", "travelTime", "day", "travel_time_all"): "tmc_travel_time_bar_graph_day",
    ("Route Bar Graph", "hoursOfDelay", "day", "travel_time_all"): "tmc_delay_bar_graph_day",
    ("TMC Grid Graph", "avgCo2Emissions", "5-minutes", "travel_time_passenger"): "tmc_co2_grid_graph_passenger_tmc",
    ("TMC Grid Graph", "avgCo2Emissions", "5-minutes", "travel_time_truck"): "tmc_co2_grid_graph_truck_tmc",
    ("Route Bar Graph", "hoursOfDelay", "weekday", "travel_time_all"): "tmc_delay_bar_graph_weekday",
    ("Hours of Delay Graph", "hoursOfDelay", "5-minutes", "travel_time_all"): "tmc_delay_bar_graph_5min",
    ("Hours of Delay Graph", "hoursOfDelay", "day", "travel_time_all"): "tmc_delay_bar_graph_day_tmc",
    ("Hours of Delay Graph", "hoursOfDelay", "hour", "travel_time_all"): "tmc_delay_bar_graph_hour_tmc",
    ("Hours of Delay Graph", "hoursOfDelay", "15-minutes", "travel_time_all"): "tmc_delay_bar_graph_15min_tmc",
    ("Hours of Delay Graph", "hoursOfDelay", "month", "travel_time_all"): "tmc_delay_bar_graph_month_tmc",
    # Round 29: Route Bar Graph speed/travelTime at the resolutions beyond
    # `day` (round-27 census's #1 buildable lever — same measures already
    # proven, just missing resolution coverage). Same route-wide (`__series`)
    # categorize shape as the existing day templates; xAxis bucketing exprs
    # (HOUR_EXPR/QUARTER_HOUR_EXPR/MONTH_EXPR/WEEKDAY_EXPR) already exist from
    # round 12's Hours-of-Delay-Graph work, reused verbatim — see TEMPLATE_SPECS.
    ("Route Bar Graph", "speed", "5-minutes", "travel_time_all"): "tmc_speed_bar_graph_5min",
    ("Route Bar Graph", "speed", "hour", "travel_time_all"): "tmc_speed_bar_graph_hour",
    ("Route Bar Graph", "speed", "15-minutes", "travel_time_all"): "tmc_speed_bar_graph_15min",
    ("Route Bar Graph", "speed", "month", "travel_time_all"): "tmc_speed_bar_graph_month",
    ("Route Bar Graph", "speed", "weekday", "travel_time_all"): "tmc_speed_bar_graph_weekday",
    ("Route Bar Graph", "travelTime", "5-minutes", "travel_time_all"): "tmc_travel_time_bar_graph_5min",
    ("Route Bar Graph", "travelTime", "hour", "travel_time_all"): "tmc_travel_time_bar_graph_hour",
    ("Route Bar Graph", "travelTime", "month", "travel_time_all"): "tmc_travel_time_bar_graph_month",
    ("Route Bar Graph", "travelTime", "weekday", "travel_time_all"): "tmc_travel_time_bar_graph_weekday",
    # TMC Grid Graph already has speed/5-minutes (tmc_speed_grid_graph, one of
    # the 3 hand-built originals) — this is the same resolution, the other
    # already-proven measure (TRAVEL_TIME_EXPR), same GridGraph shape as the
    # CO2 grid templates below.
    ("TMC Grid Graph", "travelTime", "5-minutes", "travel_time_all"): "tmc_travel_time_grid_graph_tmc",
    # Round 32 (2026-07-10): avgHoursOfDelay — see AVG_DELAY_EXPR/TEMPLATE_SPECS
    # comments for the formula and shape. Covers every buildable
    # (Route Line/Bar Graph, TMC Grid Graph) bucket from the round-27 census;
    # `resolution: None` (~9 instances) stays gap-logged, same
    # mixed-resolution-ambiguity treatment as everywhere else.
    ("Route Line Graph", "avgHoursOfDelay", "5-minutes", "travel_time_all"): "tmc_avg_delay_line_graph",
    ("Route Bar Graph", "avgHoursOfDelay", "day", "travel_time_all"): "tmc_avg_delay_bar_graph_day",
    ("Route Bar Graph", "avgHoursOfDelay", "weekday", "travel_time_all"): "tmc_avg_delay_bar_graph_weekday",
    ("Route Bar Graph", "avgHoursOfDelay", "5-minutes", "travel_time_all"): "tmc_avg_delay_bar_graph_5min",
    ("Route Bar Graph", "avgHoursOfDelay", "hour", "travel_time_all"): "tmc_avg_delay_bar_graph_hour",
    ("Route Bar Graph", "avgHoursOfDelay", "month", "travel_time_all"): "tmc_avg_delay_bar_graph_month",
    ("TMC Grid Graph", "avgHoursOfDelay", "5-minutes", "travel_time_all"): "tmc_avg_delay_grid_graph_tmc",
    # Round 34 (2026-07-13): Bar Graph Summary — one bar per route comp, each
    # bar ONE whole-date-range aggregate (old allReducer semantics; see
    # SPEED_SUMMARY_EXPR). Resolution never affects a whole-range aggregate
    # (same class as Info Box, round 31), so every real resolution key maps
    # to the ONE summary template. None-resolution keys (the mixed-resolution
    # ambiguity sentinel) still gap-log — a resolution-agnostic lookup bypass
    # is a follow-up; static keys only for now. Speed only this round; the
    # other Phase A measures (travelTime/hoursOfDelay/avgHoursOfDelay) follow
    # the scoped plan in the task file.
    ("Bar Graph Summary", "speed", "5-minutes", "travel_time_all"): "tmc_speed_summary_bar_graph",
    ("Bar Graph Summary", "speed", "day", "travel_time_all"): "tmc_speed_summary_bar_graph",
    ("Bar Graph Summary", "speed", "15-minutes", "travel_time_all"): "tmc_speed_summary_bar_graph",
    # Round 36: the remaining Phase A summary measures. travelTime and
    # hoursOfDelay are whole-range aggregates (resolution-irrelevant) — every
    # real resolution key the corpus uses maps to the one template, same as
    # speed above. avgHoursOfDelay is the bucket-grain-dependent exception:
    # one template per real resolution; its mixed-resolution (None) keys are a
    # REAL ambiguity (the value genuinely differs by resolution) and stay
    # gap-logged.
    ("Bar Graph Summary", "travelTime", "5-minutes", "travel_time_all"): "tmc_travel_time_summary_bar_graph",
    ("Bar Graph Summary", "travelTime", "15-minutes", "travel_time_all"): "tmc_travel_time_summary_bar_graph",
    ("Bar Graph Summary", "travelTime", "day", "travel_time_all"): "tmc_travel_time_summary_bar_graph",
    ("Bar Graph Summary", "travelTime", "weekday", "travel_time_all"): "tmc_travel_time_summary_bar_graph",
    ("Bar Graph Summary", "hoursOfDelay", "5-minutes", "travel_time_all"): "tmc_delay_summary_bar_graph",
    ("Bar Graph Summary", "hoursOfDelay", "day", "travel_time_all"): "tmc_delay_summary_bar_graph",
    ("Bar Graph Summary", "avgHoursOfDelay", "5-minutes", "travel_time_all"): "tmc_avg_delay_summary_bar_graph_5min",
    ("Bar Graph Summary", "avgHoursOfDelay", "day", "travel_time_all"): "tmc_avg_delay_summary_bar_graph_day",
    ("Bar Graph Summary", "avgHoursOfDelay", "weekday", "travel_time_all"): "tmc_avg_delay_summary_bar_graph_weekday",
    # Route Info Box / TMC Info Box deliberately have NO entries here — see
    # INFO_BOX_GRAIN below, they can't use one static template name.
}

# ── Route/TMC Info Box: LOTTR/TTTR via the pgFederated cross-engine join
# (round 16) ─────────────────────────────────────────────────────────────
# Unlike every entry above, these two graph types can't use one static
# template name: the join must be period-matched to the report's own max
# year (round 17 product decision — never substitute a different year's
# data), and source 1410 publishes one Postgres view per year. Round 18
# proved the mechanism by hand-building one template per grain
# (route_info_box_reliability_2021 / tmc_info_box_reliability_2023) for two
# demo reports; graph_max_year() + ensure_pm3_join_template() below
# generalize that to any year in 1410's real coverage so a new report
# doesn't need a human to notice its year and hand-build a template first.
#
# Route Info Box groups by the comparison-series discriminator (__series,
# not tmc) — the dynamic per-route fan-out bundles each assigned route
# comp's whole TMC list into ONE arm, so this produces one row per ROUTE
# (its real grain). TMC Info Box only ever renders one route at a time
# (analyze_graph's single-comp default above, matching Hours of Delay
# Graph's real old semantics) — so it groups by a plain, real `tmc` column
# instead; comparisonSeries stays enabled purely for its dynamic per-route
# filter scoping (real tmc+date WHERE clause), not to produce multiple
# series/rows.
INFO_BOX_GRAIN = {"Route Info Box": "route", "TMC Info Box": "tmc"}
# The one (measure, dataColumn) bucket the join currently supports (round 18's
# two demo reports both fell in this bucket) — a graph outside it still
# gap-logs as unmapped, same as any uncovered GRAPH_TEMPLATE_MAP combination.
# Deliberately NOT resolution (round 30, 2026-07-10, user-caught): confirmed by
# reading transportNY's real RouteInfoBox.jsx/TmcInfoBox.jsx directly —
# generateGraphData never reads `resolution` at all (each row's value comes
# from `reducer(data, tmcGraph, year)`/`allReducer(...)`, keyed on route/tmc +
# year only). Unlike a real chart, an Info Box has no shared x-axis to
# reconcile, so the assigned comps disagreeing on resolution was never a real
# ambiguity for these two graph types — gating on it here was applying a
# genuine chart-only concern (analyze_graph's mixed-resolution guard, correct
# for Route Line/Bar Graph etc.) to a component that doesn't consume the
# value at all.
INFO_BOX_BUCKET = ("speed", "travel_time_all")
# source 1410's per-year pm3 views (documentation/npmrds-data-sources.md,
# table names confirmed 2026-07-09 via data_manager.views) — no coverage
# outside 2021-2025.
PM3_VIEW_BY_YEAR = {2021: 2587, 2022: 2575, 2023: 2567, 2024: 2568, 2025: 3425}
INFO_BOX_TITLES = {"route": "Route Reliability (LOTTR / TTTR / Freeflow, {bin}, {year})",
                    "tmc": "TMC Reliability (LOTTR / TTTR / Freeflow, {bin}, {year})"}
# Round 38 (Phase B, item (c)): Info Box `avgTT-byDateRange` — checked 1410's
# live schema (`s1410_v3425_pm_3`, 121 columns) directly: NO avg-travel-time
# column exists there at all (only speed percentiles, LOTTR/TTTR ratios,
# PHED/TED) — this measure has nothing to do with the pm3 join. It's the same
# flat TRAVEL_TIME_EXPR already live-verified for Bar Graph Summary/Route Bar
# Graph. Deliberately a SEPARATE bucket/template from INFO_BOX_BUCKET's
# reliability one, with NO year or bin dependency — old RouteInfoBox.jsx never
# gated travel time on a time-of-day bin either, so requiring one here would
# needlessly forfeit flips (see ensure_info_box_traveltime_template).
INFO_BOX_TRAVELTIME_BUCKET = ("avgTT-byDateRange", "travel_time_all")
# Round 40: old dataTypes.js's plain `travelTime` key (BASE_DATA_TYPES, no
# `group`) falls into RouteInfoBox.jsx's `default` switch case, which calls
# `allReducer` — the exact same two-level per-tmc-mean-then-sum-across-tmcs
# semantics as `avgTT-byDateRange`'s aliased-to `allReducer` above (round 38
# already established that alias per the "current/correct, not old-math
# replica" precedent). Genuinely the same computation under a different old
# key name — no new template needed, just another bucket key pointing at the
# same `{grain}_info_box_traveltime` template.
INFO_BOX_TRAVELTIME_BUCKETS = {INFO_BOX_TRAVELTIME_BUCKET, ("travelTime", "travel_time_all")}
INFO_BOX_TRAVELTIME_TITLES = {"route": "Route Travel Time", "tmc": "TMC Travel Time"}
# Round 40: TMC_ATTRIBUTES' `length` key (group 'tmcAttribute', reducer
# sumReducer) — the route's total length in miles, summed once per DISTINCT
# assigned TMC (not per fetched row/epoch — the underlying CH rows are still
# per-(tmc,epoch), so summing table1.miles directly would multiply-count each
# TMC by however many epochs it has). Same arraySum/maxMap distinct-tmc
# combinator already proven in SPEED_EXPR's numerator. No year/bin/override
# dependency — a TMC's `miles` is a static join column, not a per-epoch fact.
INFO_BOX_LENGTH_BUCKET = ("length", "travel_time_all")
LENGTH_EXPR = "arraySum(mapValues(maxMap(map(ds.tmc, table1.miles)))) as length"
# TMC grain groups by a real `tmc` column (round-33/round-38 categorize
# convention), so each CH group is already scoped to one TMC — the
# distinct-tmc map combinator above would be a redundant (and, live-verified
# 2026-07-14, illegal — ClickHouse rejects an aggregate function nested
# inside the outer `fn: "avg"` wrapper) no-op. Read the join column directly.
LENGTH_TMC_EXPR = "table1.miles as length"
# Round 40: TMC_ATTRIBUTES' `aadt` key (group 'tmcAttribute', reducer
# meanReducer) — unweighted mean AADT across the route's DISTINCT assigned
# TMCs (old meanReducer over a route's already-one-row-per-tmc `data.aadt`
# array). Same distinct-tmc dedup as LENGTH_EXPR (arrayAvg instead of
# arraySum) so epoch-count differences across TMCs can't skew the average.
# overrides.aadt: old TMC_ATTRIBUTES.aadt has its own override mechanism
# (aadtDataOverride/aadtValueOverride), separate from the
# delay/CO₂-consuming AADT_OVERRIDE_SUBS fragments — not wired here (no real
# corpus report combines overrides.aadt with an Info Box aadt graph); the
# existing generic "table1.aadt in stateJson" detection will still fire and
# correctly gap-log `aadt_override_not_applied` in that case rather than
# silently drop the override, same as any other unmatched fragment.
INFO_BOX_AADT_BUCKET = ("aadt", "travel_time_all")
AADT_EXPR = "arrayAvg(mapValues(maxMap(map(ds.tmc, table1.aadt)))) as aadt"
# See LENGTH_TMC_EXPR above — same reasoning, same live-verified fix.
AADT_TMC_EXPR = "table1.aadt as aadt"
# Round 40: BASE_DATA_TYPES' `hoursOfDelay` key (reducer/tmcReducer both
# sumReducer) — plain SUM of the same per-epoch weighted DELAY_EXPR every
# other Hours-of-Delay template already uses, across the whole route/date
# range (old JS ignores `year` for this measure — sumReducer takes no such
# param). Needs the same META_JOIN + AADT_DIST_JOIN pair as those
# templates (DELAY_EXPR reads `table1.avg_speedlimit`/`faciltype`, which the
# base template's own default join, TMC Identification 455/3464, doesn't
# carry — confirmed directly against its column list).
INFO_BOX_DELAY_BUCKET = ("hoursOfDelay", "travel_time_all")
INFO_BOX_LENGTH_TITLES = {"route": "Route Length", "tmc": "TMC Length"}
INFO_BOX_AADT_TITLES = {"route": "Route AADT", "tmc": "TMC AADT"}
INFO_BOX_DELAY_TITLES = {"route": "Route Hours of Delay", "tmc": "TMC Hours of Delay"}

# ── Round 21: per-report/per-comp reliability BIN selection ─────────────────
# Every Info Box template hardcoded the pm3 join's reliability bin to 'amp'
# (AM peak), regardless of what the report's own comps actually asked for.
# 1410's real schema (confirmed 2026-07-10, direct `information_schema.columns`
# read against `gis_datasets.s1410_v3425_pm_3`) only carries FOUR precomputed
# LOTTR bins — amp/midd/pmp/we — plus a 5th, ovn, for TTTR ONLY (no
# `lottr_ovn_lottr` column exists at all). There is no "all hours"/"no time
# filter" bin and no live way to compute one (round 14: LOTTR/TTTR's real
# two-stage bin-average-then-percentile math can't run in the platform's
# single-query pipeline) — so a comp whose peak setting doesn't land on
# EXACTLY one of these four named periods has no real data to show, and gets
# gap-logged rather than approximated. User-confirmed (2026-07-10): this
# includes the old tool's own "all three peaks on" setting (07:00-19:00, no
# time-of-day restriction) — genuinely no precomputed value exists for that,
# not just an unbuilt query — and any other custom/arbitrary time window for
# the same reason. Only two shapes map unambiguously to a real bin:
#   - exactly one of amPeak/offPeak/pmPeak true (others false) → amp/midd/pmp
#   - weekdays flagged weekend-only (no weekday day true) → we
# Everything else (0 or 2-3 peak flags true, mixed weekday+weekend, a custom
# startTime/endTime with no peak flag at all) resolves to None — never
# curve-fit to the "closest" bin, since that would silently show one time
# period's real number as if it were computed for a different one.
RELIABILITY_BIN_BY_PEAK_FLAG = {"amPeak": "amp", "offPeak": "midd", "pmPeak": "pmp"}
RELIABILITY_BIN_LABELS = {"amp": "AM Peak", "midd": "Midday", "pmp": "PM Peak",
                          "we": "Weekend"}
WEEKDAY_NAMES = ("monday", "tuesday", "wednesday", "thursday", "friday")
WEEKEND_NAMES = ("saturday", "sunday")

# ── Route Compare Component: base + N compare rows, %-diff-from-base via a
# `delta` column (round 24) ─────────────────────────────────────────────────
# Old RouteCompareComponent.jsx (transportNY): getActiveRouteComponents()
# reads state.activeRouteComponents as [main, ...rest] — first entry is the
# base/"Main" row, the rest are compare rows. analyze_graph doesn't special-
# case this type (unlike Hours of Delay Graph/TMC Info Box), so info["assigned"]
# already preserves that exact order — first assigned comp = base.
# Scope: only the ("speed", "5-minutes", "travel_time_all") bucket this round
# (178 of the corpus's 226 instances, 95 reports) — the same
# "prove one capability, then generalize" pattern as every other measure in
# this task. Other measure/resolution/dataColumn combos stay gap-logged.
ROUTE_COMPARE_BUCKET = ("speed", "5-minutes", "travel_time_all")
# MEASURE_EXPR is defined below, after SPEED_EXPR (see TEMPLATE_BASE_NAME
# region) — it references that constant.
# "Good" direction per measure for the delta column's arrow/color (mirrors old
# tmc_graphs/utils/dataTypes.js's `reverseColors` flag: reverseColors False ->
# higher is good -> deltaGoodDirection 'up'; True -> lower is good -> 'down').
# Only measures actually in MEASURE_EXPR need an entry; unknown measures
# default to 'up' in ensure_route_compare_template.
# NOTE (2026-07-10): old dataTypes.js has NO entry at all for LOTTR/TTTR/PHED/
# truck travel-time-reliability-index — those aren't part of this catalog
# (they only ever appear as free-text InfoBox displayData labels, see round
# 13/18). Every analogous "index" measure that IS in dataTypes.js
# (bufferTime/planningTime/miseryIndex/travelTimeIndex/percentile95/97/avgTT)
# is reverseColors: True (lower is better) — consistent with LOTTR/TTTR's own
# FHWA definition (a ratio near 1.0 = reliable; live-captured values in this
# task file, e.g. round 18's 1.05-1.63, are ratios, not percentages) and with
# what round 20's DAMA-side pm3/map21 code assumes. This conflicts with a
# verbal note that higher-LOTTR-is-good — flagged, not resolved; not needed
# until Route Compare Component covers the "indices" bucket (out of scope
# this round; LOTTR/TTTR aren't in ROUTE_COMPARE_BUCKET at all).
GOOD_DIRECTION_BY_MEASURE = {"speed": "up", "travelTime": "down",
                             "hoursOfDelay": "down", "co2Emissions": "down",
                             "dataQuality": "up", "freeflow": "up"}

# Old per-graph-type displayData defaults (old graph components fall back to
# these when state.displayData is absent — see e.g. HybridGraphComp line ~100).
DEFAULT_DISPLAY_DATA = {
    "Route Line Graph": "speed",
    "Route Bar Graph": "speed",
    "TMC Grid Graph": "speed",
    "Route Map": "speed",
    "Route Info Box": "speed",
    # TrafficVolumeGraph.jsx:50 — `get(this.props, 'state.displayData', ["vmt"])`
    "Traffic Volume Graph": "vmt",
}

# Display names for title-template substitution ("{data}" / "{type}" in old
# graph state.title) — from old dataTypes.js `name` fields.
MEASURE_NAMES = {
    "speed": "Speed", "travelTime": "Travel Time",
    "hoursOfDelay": "Hours of Delay", "avgHoursOfDelay": "Avg. Hours of Delay",
    "co2Emissions": "CO₂ Emissions", "avgCo2Emissions": "Avg. CO₂ Emissions",
    "dataQuality": "Data Quality", "length": "Length",
    "avg_speedlimit": "Average Speed Limit", "aadt": "AADT", "vmt": "VMT",
}

# Old graph types whose renderer actually reads `report.colorRange` (the
# `isColorfull: true` flag in transportNY's tmc_graphs/index.jsx GRAPH_TYPES
# registry — confirmed against each component's own source, not just the
# flag: RouteBarGraph.jsx/RouteMap.jsx/TmcGridGraph.jsx/RouteDifferenceGraph.jsx/
# TmcDifferenceGrid.jsx all build a d3 color scale from it). A report can carry
# a non-empty `color_range` while having zero graphs of these types (e.g.
# report 1070's lone "Route Line Graph", which never reads colorRange at all)
# — same false-positive-gap class as round 3's peak_flags/month_setting fix.
COLOR_RANGE_GRAPH_TYPES = {"Route Bar Graph", "Route Map", "TMC Grid Graph",
                           "Route Difference Graph", "TMC Difference Grid"}

# The two difference graph types (round 52). Old components
# (RouteDifferenceGraph.jsx / TmcDifferenceGrid.jsx) share their 2-comp
# selection logic verbatim — see resolve_difference_pair.
DIFFERENCE_GRAPH_TYPES = {"Route Difference Graph", "TMC Difference Grid"}

# Old GeneralGraphComp.getActiveRouteComponents()'s default (no explicit
# state.activeRouteComponents) is `[routes[0].compId]` — ONE comp, the first
# in the report's own route_comps order — never "every comp". Hours of Delay
# Graph / TMC Info Box were already known to behave this way. Route Bar Graph
# (RouteBarGraph.jsx: generateGraphData([route], ...), generateHeaderData()
# -> single-select-route) and TMC Grid Graph (TmcGridGraph.comp.jsx's `Graph
# extends GeneralGraphComp` with NO getActiveRouteComponents/getResolution
# override at all) are the exact same case — confirmed 2026-07-17 by reading
# each component directly. Treating their absent-activeRouteComponents
# default as "every comp" (the generic branch in analyze_graph) was the
# actual root cause of the report-1061/graph-comp-60 non-determinism bug
# (see the BUG FIX comment below): only ONE comp is ever really rendered, so
# there's no real ambiguity to arbitrarily resolve.
SINGLE_ACTIVE_COMP_TYPES = {"Hours of Delay Graph", "TMC Info Box",
                            "Route Bar Graph", "TMC Grid Graph"}

# Old RouteDifferenceGraph.jsx's default ramp when a report carries no
# color_range of its own: getColorRange(5, "RdYlGn") (colorbrewer RdYlGn-5,
# red at the negative end, green positive — speed is reverseColors:false).
# Reports with a real color_range get it wired by the generic
# COLOR_RANGE_GRAPH_TYPES branch in build_graph_section_data instead.
DEFAULT_DIFF_COLOR_RANGE = ["#d7191c", "#fdae61", "#ffffbf", "#a6d96a", "#1a9641"]


def _diff_colors(bar, reverse):
    """Display patch for a difference template's default diverging colors:
    zero-centered (byValueSymmetric, the R52 platform toggle — old
    d3.scaleQuantize([-max, +max]) parity); bars also need byValue (grids
    always color by value). reverse=True mirrors old getColorRange()'s
    reverseColors handling for the REVERSE_COLORS_MEASURES set — applied to
    the template's own DEFAULT ramp here; reports carrying a real color_range
    get the same reversal from the generic wiring in
    build_graph_section_data."""
    value = (list(reversed(DEFAULT_DIFF_COLOR_RANGE)) if reverse
             else list(DEFAULT_DIFF_COLOR_RANGE))
    cfg = {"type": "palette", "value": value, "byValueSymmetric": True}
    if bar:
        cfg["byValue"] = True
    return {"colors": cfg}

ALL_WEEKDAYS = {"monday", "tuesday", "wednesday", "thursday", "friday",
                "saturday", "sunday"}

# ── Template auto-creation specs ─────────────────────────────────────────────
# Templates the converter can mint if missing. Each is built from the existing
# `tmc_travel_time_line_graph` row's stateJson (externalSource/display/etc.
# stay consistent with what the UI produced) with targeted mutations.
# Old-faithful two-level route speed (round 34/35): the old tool's
# speedReducer family (transportNY tmc_graphs/utils/dataTypes.js) is a
# TWO-LEVEL aggregate — mean travel time per TMC first, then compose across
# the route's TMCs: route speed = total miles * 3600 / sum over TMCs of
# (mean tt per TMC). Expressed flat via ClickHouse map combinators: avgMapIf
# computes the per-TMC means inside a single aggregate pass (the -If leg
# reproduces nullIf(tt,0)'s 0-as-missing skip — Map values can't be Nullable,
# avgMap over nullIf() 500s, confirmed live; the CH fact table stores 0, not
# NULL, for missing readings — round 9/23), maxMap picks each TMC's
# (constant) joined miles, arraySum composes across TMCs. fn:"exempt"
# (self-aggregating, round 25/32 precedent). The SAME expression is correct
# at every grouping (round 35, verified against two-step ground truth SQL:
# whole-range, per-date and per-epoch GROUP BY all match exactly): per
# x-bucket it equals the old per-bin speedReducer; a single-TMC group
# degrades to miles*3600/avg(tt) = the old speedTmcReducer. Replaces the
# per-row approximation avg(miles*3600/nullIf(tt,0)) used in rounds 1-34,
# which round 34 measured at +13% off the old UI's displayed value
# (26.02 vs 23.03 on report 520 comp-1, "WB Arterial Weave 2018").
SPEED_EXPR = (
    "(arraySum(mapValues(maxMap(map(ds.tmc, table1.miles)))) * 3600) / "
    "arraySum(mapValues(avgMapIf(map(ds.tmc, toFloat64(ds.travel_time_all_vehicles)), "
    "ds.travel_time_all_vehicles != 0))) as speed")
# Bar Graph Summary (round 34) proved this expression live first (one
# whole-range value per arm, old allReducer semantics); round 35 unified the
# constants — keeping the summary's own name so its TEMPLATE_SPECS entry
# reads naturally and, load-bearing, stays byte-identical (no spurious drift
# on the already-live-verified summary template).
SPEED_SUMMARY_EXPR = SPEED_EXPR
# Route Map speed choropleth (M2, 2026-07-15): SPEED_EXPR's own two-level
# map-combinator degenerates to the correct PER-TMC value under an explicit
# GROUP BY tmc — round-35's own documented finding ("a single-TMC group
# degrades to miles*3600/avg(tt) = the old speedTmcReducer") — so the exact
# same expression text is reused for the Map-layer join's per-TMC query, just
# realiased "value" (the tile-property name a Map choropleth column is
# conventionally called) instead of "speed".
SPEED_VALUE_EXPR = SPEED_EXPR.rsplit(" as ", 1)[0] + " as value"
# Round 52 (difference graphs, truck dataColumn): the same canonical
# two-level speed formula on travel_time_freight_trucks — the old server
# computed speed directly from the comp's own dataColumn column, so the
# column swap IS the old semantics, not an approximation. (Truck
# hoursOfDelay is NOT built the same way: its volume term — total AADT
# distribution vs the truck share — needs the old server's delay route read
# first; see the round-52 GRAPH_TEMPLATE_MAP comment.)
SPEED_EXPR_TRUCK = SPEED_EXPR.replace("travel_time_all_vehicles",
                                      "travel_time_freight_trucks")
# Old-faithful route travel time (round 35): same two-level shape — the old
# travelTime measure is the ROUTE TRAVERSAL time in MINUTES (sum over TMCs of
# each TMC's mean tt, / 60), not the mean single-segment time in seconds that
# rounds 1-34 rendered (avg(tt) — wrong quantity AND scale; round 34 measured
# 103.5s vs the old tool's 4.58min on the report-520 fixture). Same avgMapIf
# 0-as-missing skip as SPEED_EXPR (subsumes round 23's nullIf fix).
TRAVEL_TIME_EXPR = (
    "arraySum(mapValues(avgMapIf(map(ds.tmc, toFloat64(ds.travel_time_all_vehicles)), "
    "ds.travel_time_all_vehicles != 0))) / 60 "
    "as travel_time_all_vehicles")
# Route Map travelTime choropleth (M3): same "value" realiasing SPEED_VALUE_EXPR
# already uses for its own Map-layer tile-property column — TRAVEL_TIME_EXPR is
# already self-aggregating/per-TMC under a bare GROUP BY tmc (same round-35 proof
# as SPEED_EXPR), so this is otherwise the SAME "easy" shape as speed.
TRAVEL_TIME_VALUE_EXPR = TRAVEL_TIME_EXPR.rsplit(" as ", 1)[0] + " as value"
# Old hoursOfDelay (avail-falcor getHoursOfDelay.js's calcDelay/getAADT): per
# epoch, raw_delay = max(0, tt - miles/max(20, 0.6*speedlimit)*3600)/3600,
# weighted by AADT/facil * the epoch's AADT-distribution share, summed. The
# threshold part joins the year-matched NPMRDS_V6_tmc_meta ClickHouse view
# (source 582/view 983, see the META_JOIN comment below — miles,
# avg_speedlimit, aadt, faciltype, congestion_level, directionality,
# f_system); the weighting joins aadt_distributions (source
# 2056/view 3524 — see calculated-join-key notes in
# planning/tasks/current/old-reports-conversion.md) via a computed dist_key.
# This is the "travel_time_all" dataColumn variant (AADT = table1.aadt
# directly, no truck/passenger split, no overrides.aadt — that override is
# still a gap).
# nullIf(col, 0) — same 0-as-missing fix as SPEED_EXPR/TRAVEL_TIME_EXPR (round
# 23), closing that round's own "noticed, NOT fixed" follow-up: greatest(0, x)
# floors a NEGATIVE result to 0 but does nothing for x already computed FROM a
# 0-valued travel_time_all_vehicles (the CH fact table's missing-reading
# sentinel) — that silently produced a real, non-null "0 hours of delay" for
# an epoch with no data, indistinguishable from a genuinely congestion-free
# epoch. With nullIf, a missing epoch's whole hours_of_delay expression
# becomes NULL (greatest()/arithmetic all propagate NULL in ClickHouse), which
# the downstream sum() aggregate correctly skips — same NULL-skipping
# semantic as the old Postgres-backed tool, restored.
# nullIf(table1.aadt, 0) (round 59): guards the NEW year-matched META_JOIN's
# own join-miss case (2017, the one year 582/983 doesn't carry -- see the
# comment above META_JOIN) the same way the line above guards the fact
# table's 0-as-missing sentinel. A ClickHouse LEFT JOIN with no matching
# table1 row fills every table1.* column with its type default (0/''), not
# NULL -- table1.aadt is never legitimately 0 for a real TMC (same "0 =
# missing" convention this AADT column already carries elsewhere, e.g.
# AADT_EXPR), so it's the single reliable "did the meta join actually match"
# signal to gate on here. Every other table1.* reference in this expression
# (miles, avg_speedlimit, faciltype) comes from the SAME row, so a join miss
# zeroes them all together -- gating on aadt alone is sufficient.
DELAY_EXPR = ("(greatest(0, nullIf(ds.travel_time_all_vehicles, 0) - ((table1.miles / "
              "greatest(20, table1.avg_speedlimit * 0.6)) * 3600)) / 3600) "
              "* (nullIf(table1.aadt, 0) / (if(table1.faciltype > 1, 2, 1))) "
              "* arrayElement(table2.distributions, ds.epoch + 1) "
              "as hours_of_delay")
# Route Map hoursOfDelay (M3): unlike avgHoursOfDelay, this measure's old
# tmcReducer is a plain SUM across per-bucket values (dataTypes.js:
# `tmcReducer: sumReducer`), and each bucket's own "hoursOfDelay" value is
# ALREADY that bucket's raw, unmodified delay total (getHoursOfDelay.js's
# `hoursOfDelay: sum` field, no per-resolution normalization at all -- only
# avgHoursOfDelay applies getAvgHoursOfDelay()). Sum-of-bucket-sums over any
# partition of the same date range telescopes to the SAME grand total
# regardless of bucket size, so this measure is genuinely resolution-
# INVARIANT for the Map -- one template per YEAR, no resolution keying
# needed (unlike avgHoursOfDelay).
HOURS_OF_DELAY_VALUE_EXPR = f"(sum({DELAY_EXPR.rsplit(' as ', 1)[0]})) as value"
# avgHoursOfDelay (round 32, 2026-07-10): old dataTypes.js's `avgHoursOfDelay`
# is NOT a different per-epoch value — traced to avail-falcor's own
# getHoursOfDelay.js (routeDataRetrievers/getHoursOfDelay.js:70-103): both
# measures start from the exact same per-(tmc,resolution-bucket) SUM of the
# per-epoch weighted delay (the identical DELAY_EXPR computation); `avgHoursOfDelay`
# then divides that sum by `getAvgHoursOfDelay(sum, numEpochs, epochsInTimeRange,
# resolution)` — a resolution-specific normalization
# (numEpochs/numEpochs, numEpochs/12, numEpochs/3, numEpochs/epochsInTimeRange,
# or a day-resolution no-op) that in every case reduces to "the count of
# DISTINCT CALENDAR DATES that contributed rows to this bucket" (verified by
# hand for all 5 resolution branches — day trivially divides by 1 since a
# day-bucket already IS one date, matching the old code's own `case "day":
# return sum` special case for free). So the whole thing collapses to one
# formula that needs no per-resolution branching in SQL:
#   avg_hours_of_delay = sum(<same per-row delay expr as DELAY_EXPR>) / count(DISTINCT ds.date)
# `fn: "exempt"` (round 25's Route Compare delta column already established
# this as the real, author-facing "already aggregated server-side" option) —
# the expression is self-aggregating (contains its own sum()/count()), so no
# extra wrapping fn is needed or correct.
AVG_DELAY_EXPR = (f"(sum({DELAY_EXPR.rsplit(' as ', 1)[0]}) "
                  "/ count(DISTINCT ds.date)) as avg_hours_of_delay")

# Route Map avgHoursOfDelay (M3, 2026-07-15): unlike speed/travelTime/
# hoursOfDelay, this measure is GENUINELY resolution-dependent for the Map,
# not just cosmetically -- old dataTypes.js gives avgHoursOfDelay
# `tmcReducer: meanReducer` (the Map takes the MEAN of per-bucket
# avgHoursOfDelay values, one bucket per whatever resolution the report
# used), and mean-of-bucket-averages is NOT scale-invariant across bucket
# sizes the way sum-of-sums is. Traced against the old
# avail-falcor getHoursOfDelay.js: for "day" resolution each bucket already
# IS one calendar day (getAvgHoursOfDelay's "day" case returns the bucket's
# own sum unchanged), so the mean-across-days telescopes to exactly
# AVG_DELAY_EXPR above (sum(delay)/count(DISTINCT date), the SAME
# resolution-invariant whole-range formula every other consumer of
# AVG_DELAY_EXPR already uses). For "5-minutes" resolution each bucket is a
# single raw epoch (getAvgHoursOfDelay's own default numEpochs=1 case, since
# the bucket key IS the epoch), so the mean-across-epochs is a PER-EPOCH
# rate: sum(delay)/count(*) -- a different, much smaller-scale quantity than
# the per-day rate (not just a relabeling). Only "day" and "5-minutes" occur
# in the real corpus for Route Map avgHoursOfDelay (round-49/50 census: 12
# and 9 instances respectively, 0 single-blocker flips either way -- pure
# vocabulary-breadth, user-endorsed to scope to just these two); the other
# JS branches (15-minutes/hour/month-or-larger) need a genuinely harder
# nested bucket-then-mean-of-buckets subquery and have ZERO corpus
# instances, so they stay unbuilt/gap-logged rather than built speculatively.
AVG_DELAY_VALUE_EXPR_DAY = AVG_DELAY_EXPR.rsplit(" as ", 1)[0] + " as value"
AVG_DELAY_VALUE_EXPR_5MIN = (f"(sum({DELAY_EXPR.rsplit(' as ', 1)[0]}) "
                             "/ count(*)) as value")
ROUTE_MAP_AVGDELAY_VALUE_EXPR_BY_RESOLUTION = {
    "day": AVG_DELAY_VALUE_EXPR_DAY, "5-minutes": AVG_DELAY_VALUE_EXPR_5MIN}
ROUTE_MAP_AVGDELAY_RESOLUTION_SLUG = {"day": "day", "5-minutes": "5min"}


# Bar Graph Summary avgHoursOfDelay (round 36): the summary bar is the old
# meanReducer over the SAME per-(tmc, resolution-bucket) rows AVG_DELAY_EXPR
# models per bucket — i.e. a TWO-LEVEL fold (per-bucket sum ÷ per-bucket
# distinct-date count, then a plain mean across buckets) whose inner grouping
# key is resolution-dependent (queryHelpers.getResolution: 5-minutes → epoch
# across dates, day → date, weekday → day-of-week). Same map-combinator
# strategy as SPEED_EXPR/TRAVEL_TIME_EXPR, with a composite (tmc|bucket)
# String key so ONE parameterized expression covers every resolution; the
# element-wise mapValues division pairs each bucket's delay sum with its
# distinct-date count. coalesce(...,0) is load-bearing twice: (1) it keeps
# sumMap/uniqExactMap key sets aligned (Map values can't be Nullable — round
# 34; an all-missing bucket dropped from one map but not the other would
# misalign the division), and (2) it reproduces the old tool's semantics —
# missing-reading rows (tt=0) contributed 0 delay AND counted toward the
# bucket's divisor there too. Divisor is DISTINCT DATES, not the old
# numEpochs/epochsInTimeRange rowcount: identical at 5-minutes/day grain
# (proven offline on report 787's arms, worst rel err 1.6e-15 vs two-step
# ground truth), deliberately more correct at weekday grain where the old
# rowcount divisor overstates sparse-data averages by up to +283% on the same
# fixture — the round-32/round-17 "surface correct" choice, documented in the
# task file. fn:"exempt" (self-aggregating).
def _avg_delay_summary_expr(bucket_expr):
    key = f"concat(ds.tmc, '|', toString({bucket_expr}))"
    inner = DELAY_EXPR.rsplit(" as ", 1)[0]
    return ("arrayAvg(arrayMap((s, d) -> s / d, "
            f"mapValues(sumMap(map({key}, coalesce({inner}, 0)))), "
            f"mapValues(uniqExactMap(map({key}, ds.date))))) "
            "as avg_hours_of_delay")


AVG_DELAY_SUMMARY_5MIN_EXPR = _avg_delay_summary_expr("ds.epoch")
AVG_DELAY_SUMMARY_DAY_EXPR = _avg_delay_summary_expr("ds.date")
AVG_DELAY_SUMMARY_WEEKDAY_EXPR = _avg_delay_summary_expr("toDayOfWeek(ds.date)")
# Round 59 (2026-07-17): swapped off source 1946/view 3298 ("ny_2025_tmc_meta")
# onto source 582/view 983 ("NPMRDS_V6_tmc_meta") -- 1946/3298 is a FROZEN
# 2025-only snapshot, joined identically for every report regardless of the
# report's own year (no year-matching existed at all). Confirmed live
# (2026-07-17): 582/983 is byte-identical in schema (same 58 columns) but
# carries one row per (tmc, year) for 2016/2018-2026 -- checked against 1946's
# frozen 2025 values on a real report year (2019): 46.5% of TMCs have a
# different aadt, 31% a different congestion_level (which itself feeds
# DIST_KEY_EXPR below -- a wrong congestion_level can pick the wrong AADT
# distribution profile too), and 146 TMCs present in 2019 are entirely absent
# from the 2025 snapshot. Every report using hoursOfDelay/avgHoursOfDelay/
# co2Emissions/avgCo2Emissions (all built rounds 5-36) has been running its
# delay/CO2 math against wrong-year TMC attributes whenever that report's
# dates aren't 2025.
#
# The join key is now COMPOUND: tmc=tmc AND a calculated dsColumn matching
# ds.date's own year against table1.year -- same calculated-dsColumn
# mechanism DIST_KEY_EXPR below already uses (confirmed live:
# buildJoinOnClause's accessor()/isCalculatedCol() and this file's own
# _ch_join_accessor already detect ANY joinColumns entry containing ' as ' and
# use it as a raw expression with no alias prefix, and both client and
# build_ch_join_wire already AND-join multiple joinColumns entries per
# source -- no platform change needed). This resolves each fact-table ROW
# against ITS OWN date's year, not a single per-report "max year" pick like
# the pm3/1410 reliability join uses -- correctly handling a report whose date
# range spans a year boundary, and needing no per-year template proliferation
# at all (unlike ensure_pm3_join_template).
#
# Known gap (not fixed): 582/983 has no 2017 row (2016, then 2018-2026) --
# confirmed live. A ClickHouse LEFT JOIN fills a non-matching row's columns
# with type defaults (0/''), not NULL, so an unguarded 2017 date would
# silently produce hours_of_delay/avg_co2_emissions = 0 (indistinguishable
# from a genuinely congestion-free/emission-free reading) -- the exact same
# class of bug round 9 found and fixed for the fact table's own 0-as-missing
# sentinel. Guarded below via nullIf() on the one column each formula
# multiplies by last (table1.aadt for delay, table1.miles for CO2) so a
# missing-year join miss nulls the whole expression instead (verified live,
# greatest()/division/subtraction on a ClickHouse Nullable all propagate NULL
# as expected). 2017-dated hoursOfDelay/CO2 reports are gap-logged, not
# unblocked -- out of scope per the standing "data issues, not code" ruling.
META_JOIN = {
    "source": 582, "view": 983,
    "sourceInfo": {
        "name": "NPMRDS_V6_tmc_meta",
        "columns": [{"name": n, "type": "string"} for n in
                    ["tmc", "miles", "avg_speedlimit", "aadt", "aadt_singl",
                     "aadt_combi", "congestion_level", "directionality",
                     "f_system", "faciltype", "year"]],
        "source_id": 582, "env": "npmrds2", "srcEnv": "npmrds2",
        "isDms": False, "baseUrl": "", "type": "NPMRDS_V6_tmc_meta",
        "view_id": 983,
    },
    "joinColumns": [
        {"dsColumn": "tmc", "joinSourceColumn": "tmc"},
        {"dsColumn": "toYear(ds.date) as meta_year", "joinSourceColumn": "year"},
    ],
    "mergeStrategy": "join", "type": "left",
}
# dist_key mirrors old getDist(): WEEKEND collapses to [weekdayType, roadType],
# WEEKDAY needs congestion_level + directionality + roadType — all only
# available on table1 (NPMRDS_V6_tmc_meta, META_JOIN above), joined as a calculated dsColumn
# expression (the platform fix verified in the round-3 notes) rather than a
# plain column so it can reference an already-joined alias.
DIST_KEY_EXPR = (
    "if(toDayOfWeek(ds.date, 2) IN (6,7), "
    "concat('WEEKEND_', if(table1.f_system < 3, 'FREEWAY', 'NONFREEWAY')), "
    "concat('WEEKDAY_', table1.congestion_level, '_', table1.directionality, '_', "
    "if(table1.f_system < 3, 'FREEWAY', 'NONFREEWAY'))) as dist_key"
)
AADT_DIST_JOIN = {
    "source": 2056, "view": 3524,
    "sourceInfo": {
        "name": "aadt_distributions",
        "columns": [{"name": "key", "type": "string"},
                    {"name": "distributions", "type": "array"}],
        "source_id": 2056, "env": "npmrds2", "srcEnv": "npmrds2",
        "isDms": False, "baseUrl": "", "type": "aadt_distributions",
        "view_id": 3524,
    },
    "joinColumns": [{"dsColumn": DIST_KEY_EXPR, "joinSourceColumn": "key"}],
    "mergeStrategy": "join", "type": "left",
}
# CO2 emissions (avail-falcor getCo2Emissions.js's calcEmissions/getCo2/
# forCars/forTrucks): per epoch, split AADT into car
# (table1.aadt - (aadt_singl + aadt_combi)) vs truck (aadt_singl + aadt_combi),
# weight by the same AADT-distribution share as Hours-of-Delay
# (table2.distributions via the dist_key join, see DELAY_EXPR/DIST_KEY_EXPR
# above), convert to VMT, then run VMT through a 15-bucket piecewise-linear
# speed→emission-factor regression (separate car/truck coefficient tables) and
# divide by 1e6 (matches getCo2Emissions.js's `sum / 1000000`). No
# overrides.aadt or overrides.baseSpeed support yet — both still-open gaps
# (see planning/tasks/current/old-reports-conversion.md), same treatment as
# the weighted-delay column's overrides.aadt gap. Report 751 only exercises
# the travel_time_truck/travel_time_passenger variants (its 4 route comps are
# 2 passenger + 2 truck, no travel_time_all comps) — a travel_time_all variant
# (car+truck summed, per getCo2()'s 'travel_time_all' case) is not built since
# nothing needs it yet.
_CO2_CAR_FACTOR = ("multiIf("
    "{s} < 5, ({s} * -335.3) + 2756, "
    "{s} < 10, ({s} * -83.73) + 1498, "
    "{s} < 15, ({s} * -28.08) + 942, "
    "{s} < 20, ({s} * -14.25) + 734, "
    "{s} < 25, ({s} * -9.466) + 639, "
    "{s} < 30, ({s} * -8.471) + 614, "
    "{s} < 35, ({s} * -3.775) + 473, "
    "{s} < 40, ({s} * -2.259) + 420, "
    "{s} < 45, ({s} * -1.685) + 397, "
    "{s} < 50, ({s} * -1.131) + 372, "
    "{s} < 55, ({s} * -0.473) + 339, "
    "{s} < 60, ({s} * 0.0686) + 309, "
    "{s} < 65, ({s} * 0.7814) + 267, "
    "{s} < 70, ({s} * 2.3722) + 163, "
    "({s} * 3.7348) + 68)")
_CO2_TRUCK_FACTOR = ("multiIf("
    "{s} < 5, ({s} * -1508.86) + 11551.62, "
    "{s} < 10, ({s} * -312) + 5567.34, "
    "{s} < 15, ({s} * -78.35) + 3230.75, "
    "{s} < 20, ({s} * -56.38) + 2901.32, "
    "{s} < 25, ({s} * -34.75) + 2468.71, "
    "{s} < 30, ({s} * -12.02) + 1900.28, "
    "{s} < 35, ({s} * -48.01) + 2980.11, "
    "{s} < 40, ({s} * -13.48) + 1771.60, "
    "{s} < 45, ({s} * -10.71) + 1660.88, "
    "{s} < 50, ({s} * -13.84) + 1801.47, "
    "{s} < 55, ({s} * -12.68) + 1743.63, "
    "{s} < 60, ({s} * 7.60) + 1464.06, "
    "{s} < 65, ({s} * 11.17) + 337.87, "
    "{s} < 70, ({s} * 10.35) + 391.40, "
    "({s} * 15.37) + 40.07)")
# The CH fact table's travel-time columns are plain Float64 (NOT Nullable) —
# missing readings are stored as 0, not NULL (confirmed on TMC 120P05153/2019:
# 71,009 of 103,856 rows have travel_time_freight_trucks = 0, touching all 288
# epochs). A bare coalesce() therefore never fires, and 3600/0 = inf poisons
# every epoch's avg (ClickHouse serializes inf as JSON null → blank graphs).
# nullIf(col, 0) restores the old Postgres semantic, where missing values were
# real NULLs and COALESCE(truck, all_vehicles) fell back per-row (old
# getCo2Emissions.js makeQuery). Both 0 → NULL result → avg skips the row.
_SPEED_CAR_EXPR = ("(table1.miles * (3600.0 / "
                    "coalesce(nullIf(ds.travel_time_passenger_vehicles, 0), "
                    "nullIf(ds.travel_time_all_vehicles, 0))))")
_SPEED_TRUCK_EXPR = ("(table1.miles * (3600.0 / "
                      "coalesce(nullIf(ds.travel_time_freight_trucks, 0), "
                      "nullIf(ds.travel_time_all_vehicles, 0))))")
_AADT_CAR_EXPR = ("((table1.aadt - (table1.aadt_singl + table1.aadt_combi)) "
                   "/ if(table1.faciltype > 1, 2, 1) "
                   "* arrayElement(table2.distributions, ds.epoch + 1))")
_AADT_TRUCK_EXPR = ("((table1.aadt_singl + table1.aadt_combi) "
                     "/ if(table1.faciltype > 1, 2, 1) "
                     "* arrayElement(table2.distributions, ds.epoch + 1))")
# nullIf(table1.miles, 0) (round 59): same META_JOIN join-miss guard as
# DELAY_EXPR's nullIf(table1.aadt, 0) above, gating on the LAST table1.miles
# reference (the one multiplying the whole per-epoch result) so a 2017
# join-miss nulls the whole expression rather than silently zeroing it — the
# earlier table1.miles inside _SPEED_CAR_EXPR/_SPEED_TRUCK_EXPR needs no
# guard of its own since this outer one already nulls the final product
# regardless of what that inner (possibly wrong-on-a-miss) speed computed.
CO2_EXPR_PASSENGER = (
    f"(({_CO2_CAR_FACTOR.format(s=_SPEED_CAR_EXPR)}) "
    f"* ({_AADT_CAR_EXPR} * nullIf(table1.miles, 0)) / 1000000) as avg_co2_emissions")
CO2_EXPR_TRUCK = (
    f"(({_CO2_TRUCK_FACTOR.format(s=_SPEED_TRUCK_EXPR)}) "
    f"* ({_AADT_TRUCK_EXPR} * nullIf(table1.miles, 0)) / 1000000) as avg_co2_emissions")

# ── overrides.aadt (old getHoursOfDelay.js getAADT / getCo2Emissions.js
# calcEmissions) ─────────────────────────────────────────────────────────────
# Old semantics, confirmed against the source:
#   - delay (getAADT): a TRUTHY override replaces the AADT wholesale
#     (`if (aadtOverride) return aadtOverride;` — before the facil /
#     distribution weighting); falsy ('0', '', null) falls through to the real
#     column, i.e. a '0' override is query-inert (same class as the peak
#     flags — see report 1061 comp-7).
#   - CO₂ (calcEmissions): the override is a TOTAL AADT redistributed by the
#     real car/truck proportions: `(aadt_override * (aadt_car / aadt_total))
#     || aadt_car` — the JS `||` falls back to the real value when the product
#     is 0 or NaN (aadt_total = aadt_car + aadt_truck = table1.aadt, so
#     NaN ⇔ table1.aadt = 0; we only substitute overrides > 0, so the SQL
#     `if(table1.aadt > 0, ...)` guard reproduces every reachable branch).
# The override lives per route comp, but the calculated column is shared by
# every comparison-series arm of a graph — so it's applied per GRAPH, and only
# when every assigned comp agrees on one truthy value (disagreement →
# `aadt_override_mixed` gap, same treatment as mixed resolution/dataColumn).
# Substitution happens on the section's CLONED template stateJson (the same
# place color_range is wired), so the template rows themselves stay
# override-free.
# Round 59: fragment updated to match DELAY_EXPR's new nullIf(table1.aadt, 0)
# guard (see the META_JOIN comment) -- the override, once present, is always
# a validated positive value (aadt_override_of below), never the 0 that
# guard exists to catch, so substituting it straight in for the whole
# nullIf(...) subexpression is exactly as safe as substituting for the bare
# column was before.
_AADT_DELAY_FRAGMENT = "(nullIf(table1.aadt, 0) / (if(table1.faciltype > 1, 2, 1)))"
_AADT_DELAY_OVERRIDE = "({ov} / (if(table1.faciltype > 1, 2, 1)))"
_AADT_CAR_OVERRIDE = (
    "(if(table1.aadt > 0, "
    "{ov} * ((table1.aadt - (table1.aadt_singl + table1.aadt_combi)) / table1.aadt), "
    "(table1.aadt - (table1.aadt_singl + table1.aadt_combi))) "
    "/ if(table1.faciltype > 1, 2, 1) "
    "* arrayElement(table2.distributions, ds.epoch + 1))")
_AADT_TRUCK_OVERRIDE = (
    "(if(table1.aadt > 0, "
    "{ov} * ((table1.aadt_singl + table1.aadt_combi) / table1.aadt), "
    "(table1.aadt_singl + table1.aadt_combi)) "
    "/ if(table1.faciltype > 1, 2, 1) "
    "* arrayElement(table2.distributions, ds.epoch + 1))")
AADT_OVERRIDE_SUBS = [
    (_AADT_DELAY_FRAGMENT, _AADT_DELAY_OVERRIDE),
    (_AADT_CAR_EXPR, _AADT_CAR_OVERRIDE),
    (_AADT_TRUCK_EXPR, _AADT_TRUCK_OVERRIDE),
]
# Guard against the fragments drifting out of sync with the expressions they
# must match inside live template rows (which were written from these same
# constants) — a silent mismatch would convert the graph WITHOUT the override.
assert _AADT_DELAY_FRAGMENT in DELAY_EXPR


def aadt_override_of(rc):
    """A comp's effective overrides.aadt: a positive number, or None.
    Falsy values ('0', '', null) are query-inert in the old tool (getAADT's
    `if (aadtOverride)`), so they are treated as no-override, not a gap."""
    v = ((rc.get("settings") or {}).get("overrides") or {}).get("aadt")
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if not (f > 0):
        return None
    return int(f) if f == int(f) else f

# "weekday" resolution (old getResolution(): `trim(to_char(date, 'day'))`) groups
# rows by day-of-week name instead of calendar date — e.g. "Hours of Delay by
# weekday" sums delay across every Monday in the range into one bar, every
# Tuesday into another, etc. Same DELAY_EXPR/join as the day-resolution
# template; only the grouping column differs. Uses ISO day-of-week (1=Monday..
# 7=Sunday, ClickHouse `toDayOfWeek(date, 1)`) as a plain sortable integer
# rather than a name string, so "sort": "asc" orders Monday->Sunday correctly
# (a future author-facing label lookup for 1-7 -> day name is a display
# refinement, not attempted here — conversion correctness over pixel parity).
WEEKDAY_EXPR = "toDayOfWeek(ds.date, 1) as weekday"

# "Hours of Delay Graph" per-resolution xAxis buckets beyond 5-minutes/day
# (round 12, 2026-07-09) — same queryHelpers.js getResolution() switch as
# WEEKDAY_EXPR above: hour buckets epoch into 0-23 (`(epoch/12)::integer`, 12
# 5-minute epochs per hour); 15-minutes buckets epoch into 0-95
# (`(epoch/3)::integer`); month truncates the date to its first-of-month
# (`npmrds_month(date)`). All aggregate across the WHOLE date range into that
# bucket (e.g. hour bucket 7 sums every 7:00-7:55 epoch on every date in
# range) — same "bounded, not per-timestamp" shape as the 5-minutes/epoch
# template, just a coarser bucket.
HOUR_EXPR = "intDiv(ds.epoch, 12) as hour"
QUARTER_HOUR_EXPR = "intDiv(ds.epoch, 3) as quarter_hour"
MONTH_EXPR = "toStartOfMonth(ds.date) as month"

# "Hours of Delay Graph" (old HoursOfDelayGraph.jsx) is NOT the same shape as
# the Route-Bar-Graph delay templates above: generateGraphData([route], ...)
# destructures only the FIRST active route comp (getActiveRouteComponents()
# defaults to [routes[0].compId], never "every comp" — see analyze_graph's
# special case below), and renders ONE BAR SERIES PER TMC in that route
# (`keys: route.tmcArray`), not a route-wide sum. Same DELAY_EXPR/join as the
# day/weekday templates; only the grouping differs — group by TMC as well as
# by resolution, via a real `tmc` categorize column instead of the
# comparison-series `__series` discriminator every other template uses (this
# graph type never fans out across routes, so there's nothing to discriminate
# by route — `tmc` is the real per-series dimension). Built at 5-minutes (round
# 11) and day/hour/15-minutes/month (round 12) — every real resolution value
# the corpus actually uses. `resolution: 'NONE'` (3 ancient "version 2"
# reports, ids 269/270/271) is deliberately NOT one of these: confirmed
# against the old client (`utils/resolutionFormats.js`'s RESOLUTIONS map,
# `'NONE': {name: 'None (data download only)', ...}`, and explicitly filtered
# out of the real UI dropdown's `resolutions` export) — it's a genuine
# "no chart, raw data download only" sentinel in the old tool itself, not a
# malformed/ambiguous value to fix. Correctly stays gap-logged as
# `unmapped_graph` (same "no chart equivalent" treatment as Route Map/Bar
# Graph Summary), same as every other graph type with no chart equivalent.
TEMPLATE_SPECS = {
    # Round 35: the 3 hand-built originals (the pre-converter, UI-authored
    # rows every other template is minted from) brought under spec governance
    # so ensure_graph_templates' drift detection reaches them — they were the
    # only live speed/TT templates NOT updated by round 23's nullIf fix
    # (confirmed by dumping the rows: both speed ones still carried the bare
    # `(table1.miles * 3600)/ ds.travel_time_all_vehicles` division, and the
    # travel-time one averaged the plain non-calculated column). Their
    # xAxis/categorize/join stay whatever the live rows already have (drift
    # replaces only the yAxis dict); the spec shapes below match the live
    # rows so a from-scratch mint would also be correct.
    "tmc_speed_line_graph": {
        "graphType": "LineGraph", "xAxis": "epoch",
        "yAxis": {"type": "calculated", "show": True, "name": SPEED_EXPR,
                  "target": "yAxis", "fn": "exempt", "customName": "Speed (mph)"},
    },
    "tmc_travel_time_line_graph": {
        "graphType": "LineGraph", "xAxis": "epoch",
        "yAxis": {"type": "calculated", "show": True, "name": TRAVEL_TIME_EXPR,
                  "target": "yAxis", "fn": "exempt",
                  "customName": "Travel Time (min)"},
    },
    "tmc_speed_grid_graph": {
        "graphType": "GridGraph", "xAxis": "epoch",
        "yAxis": {"type": "calculated", "show": True, "name": SPEED_EXPR,
                  "target": "color", "fn": "exempt", "customName": "Speed (mph)"},
    },
    "tmc_speed_bar_graph_day": {
        "graphType": "BarGraph", "xAxis": "date",
        "yAxis": {"type": "calculated", "show": True, "name": SPEED_EXPR,
                  "target": "yAxis", "fn": "exempt", "customName": "Speed (mph)"},
    },
    "tmc_travel_time_bar_graph_day": {
        "graphType": "BarGraph", "xAxis": "date",
        "yAxis": {"type": "calculated", "show": True, "name": TRAVEL_TIME_EXPR,
                  "target": "yAxis", "fn": "exempt",
                  "customName": "Travel Time (min)"},
    },
    "tmc_delay_bar_graph_day": {
        "graphType": "BarGraph", "xAxis": "date",
        "yAxis": {"type": "calculated", "show": True, "name": DELAY_EXPR,
                  "target": "yAxis", "fn": "sum"},
        "join": {"table1": META_JOIN, "table2": AADT_DIST_JOIN},
    },
    # GridGraph shape (xAxis=epoch, target=color) mirroring the existing
    # tmc_speed_grid_graph — "avg" fn averages each epoch's value across the
    # dates in range, same convention already verified live for speed.
    "tmc_co2_grid_graph_passenger": {
        "graphType": "GridGraph", "xAxis": "epoch",
        "yAxis": {"type": "calculated", "show": True, "name": CO2_EXPR_PASSENGER,
                  "target": "color", "fn": "avg"},
        "join": {"table1": META_JOIN, "table2": AADT_DIST_JOIN},
    },
    "tmc_co2_grid_graph_truck": {
        "graphType": "GridGraph", "xAxis": "epoch",
        "yAxis": {"type": "calculated", "show": True, "name": CO2_EXPR_TRUCK,
                  "target": "color", "fn": "avg"},
        "join": {"table1": META_JOIN, "table2": AADT_DIST_JOIN},
    },
    # Round 52: the difference pair — see the GRAPH_TEMPLATE_MAP comment.
    # Byte-identical to their plain bar/grid siblings except: (a)
    # comparisonSeriesCombine asks the server to inner-join each non-anchor
    # comparison-series arm to the anchor arm on the group-by columns and
    # return anchor − variant ("Main minus Compare") under the same alias —
    # per-epoch for the bar, per (tmc, epoch) for the grid, no
    # graph-type-specific code; (b) diverging default colors via
    # _diff_colors(), zero-centered (byValueSymmetric — the R52 platform
    # toggle) so "no change" sits on the neutral middle color, mirroring old
    # d3.scaleQuantize([-max, +max]); reverse=True for the
    # REVERSE_COLORS_MEASURES set (travelTime/delay/CO₂ — old
    # getColorRange() reversed those ramps before any graph saw them).
    # Every measure expression is reused verbatim (self-aggregating forms
    # degrade correctly at both grains — round 35/42's own proofs); the
    # subtraction happens AFTER each arm computes its ordinary value, so no
    # new measure math exists in any of these.
    "route_diff_speed_5min": {
        "graphType": "BarGraph", "xAxis": "epoch",
        "yAxis": {"type": "calculated", "show": True, "name": SPEED_EXPR,
                  "target": "yAxis", "fn": "exempt",
                  "customName": "Speed Difference (mph)"},
        "comparisonSeriesCombine": {"mode": "difference"},
        "display": _diff_colors(bar=True, reverse=False),
    },
    "route_diff_speed_15min": {
        "graphType": "BarGraph",
        "xAxis": {"type": "calculated", "show": True, "name": QUARTER_HOUR_EXPR,
                  "target": "xAxis", "group": True, "sort": "asc"},
        "yAxis": {"type": "calculated", "show": True, "name": SPEED_EXPR,
                  "target": "yAxis", "fn": "exempt",
                  "customName": "Speed Difference (mph)"},
        "comparisonSeriesCombine": {"mode": "difference"},
        "display": _diff_colors(bar=True, reverse=False),
    },
    "route_diff_speed_day": {
        "graphType": "BarGraph", "xAxis": "date",
        "yAxis": {"type": "calculated", "show": True, "name": SPEED_EXPR,
                  "target": "yAxis", "fn": "exempt",
                  "customName": "Speed Difference (mph)"},
        "comparisonSeriesCombine": {"mode": "difference"},
        "display": _diff_colors(bar=True, reverse=False),
    },
    "route_diff_speed_5min_truck": {
        "graphType": "BarGraph", "xAxis": "epoch",
        "yAxis": {"type": "calculated", "show": True, "name": SPEED_EXPR_TRUCK,
                  "target": "yAxis", "fn": "exempt",
                  "customName": "Truck Speed Difference (mph)"},
        "comparisonSeriesCombine": {"mode": "difference"},
        "display": _diff_colors(bar=True, reverse=False),
    },
    "route_diff_travel_time_5min": {
        "graphType": "BarGraph", "xAxis": "epoch",
        "yAxis": {"type": "calculated", "show": True, "name": TRAVEL_TIME_EXPR,
                  "target": "yAxis", "fn": "exempt",
                  "customName": "Travel Time Difference (min)"},
        "comparisonSeriesCombine": {"mode": "difference"},
        "display": _diff_colors(bar=True, reverse=True),
    },
    # Route-level hoursOfDelay: old reducer = sumReducer (dataTypes.js) —
    # per-bucket route total, the tmc_delay_bar_graph_day family's shape
    # minus the per-TMC categorize.
    "route_diff_delay_5min": {
        "graphType": "BarGraph", "xAxis": "epoch",
        "yAxis": {"type": "calculated", "show": True, "name": DELAY_EXPR,
                  "target": "yAxis", "fn": "sum",
                  "customName": "Hours of Delay Difference"},
        "join": {"table1": META_JOIN, "table2": AADT_DIST_JOIN},
        "comparisonSeriesCombine": {"mode": "difference"},
        "display": _diff_colors(bar=True, reverse=True),
    },
    # Route-level avgHoursOfDelay: old reducer is ALSO sumReducer at route
    # level (meanReducer is only its tmcReducer/Map grain) — AVG_DELAY_EXPR
    # grouped by epoch = sum over TMCs of per-TMC per-epoch avg, exactly
    # tmc_avg_delay_bar_graph_5min's proven shape.
    "route_diff_avg_delay_5min": {
        "graphType": "BarGraph", "xAxis": "epoch",
        "yAxis": {"type": "calculated", "show": True, "name": AVG_DELAY_EXPR,
                  "target": "yAxis", "fn": "exempt",
                  "customName": "Avg. Hours of Delay Difference"},
        "join": {"table1": META_JOIN, "table2": AADT_DIST_JOIN},
        "comparisonSeriesCombine": {"mode": "difference"},
        "display": _diff_colors(bar=True, reverse=True),
    },
    # Route-level CO₂: avgCo2Emissions reducer = meanReducer → fn "avg";
    # co2Emissions = sumReducer → fn "sum" (dataTypes.js).
    "route_diff_avg_co2_5min_passenger": {
        "graphType": "BarGraph", "xAxis": "epoch",
        "yAxis": {"type": "calculated", "show": True, "name": CO2_EXPR_PASSENGER,
                  "target": "yAxis", "fn": "avg",
                  "customName": "Avg. CO2 Difference (tonnes)"},
        "join": {"table1": META_JOIN, "table2": AADT_DIST_JOIN},
        "comparisonSeriesCombine": {"mode": "difference"},
        "display": _diff_colors(bar=True, reverse=True),
    },
    "route_diff_avg_co2_5min_truck": {
        "graphType": "BarGraph", "xAxis": "epoch",
        "yAxis": {"type": "calculated", "show": True, "name": CO2_EXPR_TRUCK,
                  "target": "yAxis", "fn": "avg",
                  "customName": "Avg. CO2 Difference (tonnes)"},
        "join": {"table1": META_JOIN, "table2": AADT_DIST_JOIN},
        "comparisonSeriesCombine": {"mode": "difference"},
        "display": _diff_colors(bar=True, reverse=True),
    },
    "route_diff_co2_5min_passenger": {
        "graphType": "BarGraph", "xAxis": "epoch",
        "yAxis": {"type": "calculated", "show": True, "name": CO2_EXPR_PASSENGER,
                  "target": "yAxis", "fn": "sum",
                  "customName": "CO2 Difference (tonnes)"},
        "join": {"table1": META_JOIN, "table2": AADT_DIST_JOIN},
        "comparisonSeriesCombine": {"mode": "difference"},
        "display": _diff_colors(bar=True, reverse=True),
    },
    "tmc_diff_grid_speed_5min": {
        "graphType": "GridGraph", "xAxis": "epoch",
        "categorize": {"desc": None, "name": "tmc", "type": "string", "source_id": 583,
                  "show": True, "target": "yAxis", "group": True, "sort": "asc"},
        "yAxis": {"type": "calculated", "show": True, "name": SPEED_EXPR,
                  "target": "color", "fn": "exempt",
                  "customName": "Speed Difference (mph)"},
        "comparisonSeriesCombine": {"mode": "difference"},
        "display": _diff_colors(bar=False, reverse=False),
    },
    "tmc_diff_grid_speed_15min": {
        "graphType": "GridGraph",
        "xAxis": {"type": "calculated", "show": True, "name": QUARTER_HOUR_EXPR,
                  "target": "xAxis", "group": True, "sort": "asc"},
        "categorize": {"desc": None, "name": "tmc", "type": "string", "source_id": 583,
                  "show": True, "target": "yAxis", "group": True, "sort": "asc"},
        "yAxis": {"type": "calculated", "show": True, "name": SPEED_EXPR,
                  "target": "color", "fn": "exempt",
                  "customName": "Speed Difference (mph)"},
        "comparisonSeriesCombine": {"mode": "difference"},
        "display": _diff_colors(bar=False, reverse=False),
    },
    "tmc_diff_grid_speed_5min_truck": {
        "graphType": "GridGraph", "xAxis": "epoch",
        "categorize": {"desc": None, "name": "tmc", "type": "string", "source_id": 583,
                  "show": True, "target": "yAxis", "group": True, "sort": "asc"},
        "yAxis": {"type": "calculated", "show": True, "name": SPEED_EXPR_TRUCK,
                  "target": "color", "fn": "exempt",
                  "customName": "Truck Speed Difference (mph)"},
        "comparisonSeriesCombine": {"mode": "difference"},
        "display": _diff_colors(bar=False, reverse=False),
    },
    "tmc_diff_grid_travel_time_5min": {
        "graphType": "GridGraph", "xAxis": "epoch",
        "categorize": {"desc": None, "name": "tmc", "type": "string", "source_id": 583,
                  "show": True, "target": "yAxis", "group": True, "sort": "asc"},
        "yAxis": {"type": "calculated", "show": True, "name": TRAVEL_TIME_EXPR,
                  "target": "color", "fn": "exempt",
                  "customName": "Travel Time Difference (min)"},
        "comparisonSeriesCombine": {"mode": "difference"},
        "display": _diff_colors(bar=False, reverse=True),
    },
    "tmc_diff_grid_delay_5min": {
        "graphType": "GridGraph", "xAxis": "epoch",
        "categorize": {"desc": None, "name": "tmc", "type": "string", "source_id": 583,
                  "show": True, "target": "yAxis", "group": True, "sort": "asc"},
        "yAxis": {"type": "calculated", "show": True, "name": DELAY_EXPR,
                  "target": "color", "fn": "sum",
                  "customName": "Hours of Delay Difference"},
        "join": {"table1": META_JOIN, "table2": AADT_DIST_JOIN},
        "comparisonSeriesCombine": {"mode": "difference"},
        "display": _diff_colors(bar=False, reverse=True),
    },
    "tmc_diff_grid_avg_delay_5min": {
        "graphType": "GridGraph", "xAxis": "epoch",
        "categorize": {"desc": None, "name": "tmc", "type": "string", "source_id": 583,
                  "show": True, "target": "yAxis", "group": True, "sort": "asc"},
        "yAxis": {"type": "calculated", "show": True, "name": AVG_DELAY_EXPR,
                  "target": "color", "fn": "exempt",
                  "customName": "Avg. Hours of Delay Difference"},
        "join": {"table1": META_JOIN, "table2": AADT_DIST_JOIN},
        "comparisonSeriesCombine": {"mode": "difference"},
        "display": _diff_colors(bar=False, reverse=True),
    },
    "tmc_diff_grid_avg_co2_5min_passenger": {
        "graphType": "GridGraph", "xAxis": "epoch",
        "categorize": {"desc": None, "name": "tmc", "type": "string", "source_id": 583,
                  "show": True, "target": "yAxis", "group": True, "sort": "asc"},
        "yAxis": {"type": "calculated", "show": True, "name": CO2_EXPR_PASSENGER,
                  "target": "color", "fn": "avg",
                  "customName": "Avg. CO2 Difference (tonnes)"},
        "join": {"table1": META_JOIN, "table2": AADT_DIST_JOIN},
        "comparisonSeriesCombine": {"mode": "difference"},
        "display": _diff_colors(bar=False, reverse=True),
    },
    "tmc_diff_grid_avg_co2_5min_truck": {
        "graphType": "GridGraph", "xAxis": "epoch",
        "categorize": {"desc": None, "name": "tmc", "type": "string", "source_id": 583,
                  "show": True, "target": "yAxis", "group": True, "sort": "asc"},
        "yAxis": {"type": "calculated", "show": True, "name": CO2_EXPR_TRUCK,
                  "target": "color", "fn": "avg",
                  "customName": "Avg. CO2 Difference (tonnes)"},
        "join": {"table1": META_JOIN, "table2": AADT_DIST_JOIN},
        "comparisonSeriesCombine": {"mode": "difference"},
        "display": _diff_colors(bar=False, reverse=True),
    },
    # Round 42 (2026-07-14, user-caught on report 914's "Winter Average Day"):
    # TMC Grid Graph's per-TMC breakdown is NOT a comparison-series artifact.
    # The round-32 comment on tmc_avg_delay_line_graph assumed a report's
    # multiple assigned route comps were what produced grid rows ("TMC Grid
    # Graph's per-TMC rows come from each assigned route-comp being its own
    # comparison-series arm") — report 914 disproved that: ONE assigned comp
    # (a genuinely multi-TMC route) rendered as a single aggregate color strip
    # in the new tool, where the old tool broke it into ~10 TMC rows × time-
    # of-day columns (live old-UI screenshot). The 5 templates above
    # (tmc_speed_grid_graph/tmc_travel_time_grid_graph/tmc_avg_delay_grid_graph/
    # tmc_co2_grid_graph_passenger/tmc_co2_grid_graph_truck) never had a
    # `categorize` at all, so a single-comp graph (the common case) always
    # collapsed every TMC in the route into one value. Real semantic: same as
    # TMC Info Box (INFO_BOX_GRAIN's "tmc" grain) and Hours of Delay Graph's
    # tmc_delay_bar_graph_* templates — comparisonSeries arms stay isolated
    # per-route queries (round 25), `categorize: "tmc"` groups WITHIN each
    # arm's own query. SPEED_EXPR/TRAVEL_TIME_EXPR (fn:"exempt", self-
    # aggregating map combinators) algebraically degrade to the correct
    # per-TMC value once grouped by (epoch, tmc) — round 35's own comment
    # already proved this ("a single-TMC group degrades to miles*3600/avg(tt)
    # = the old speedTmcReducer"); the CO2/avgHoursOfDelay expressions are
    # already plain per-row/per-tmc formulas (no combinator), so `categorize`
    # is a pure additive change for them. GRAPH_TEMPLATE_MAP above repointed
    # to these; the 5 route-aggregate originals are kept (nothing else
    # references them, no proactive cleanup — [[feedback_dont_over_engineer_against_orphaning]]).
    # GridGraph's own component (GridGraphWrapper) reads its per-row dimension
    # from a column targeted "yAxis" (paired with xAxis=columns, color=value),
    # never "categorize" — that's BarGraph's convention (Hours of Delay
    # Graph's tmc_delay_bar_graph_* above), and it's silently ignored here.
    # First cut of this fix used categorize:"tmc" (built correctly server-side
    # per ensure_graph_templates' generic mechanism) and still rendered a
    # single aggregate strip on report 914 — caught live via Playwright/visual
    # diff, not assumed. The `categorize` spec key accepts a raw column dict
    # (ensure_graph_templates: `isinstance(cat_spec, dict)` bypasses its
    # default target:"categorize" construction), so the tmc column is
    # supplied pre-targeted at "yAxis" instead of the bare string "tmc".
    "tmc_speed_grid_graph_tmc": {
        "graphType": "GridGraph", "xAxis": "epoch",
        "categorize": {"desc": None, "name": "tmc", "type": "string", "source_id": 583,
                  "show": True, "target": "yAxis", "group": True, "sort": "asc"},
        "yAxis": {"type": "calculated", "show": True, "name": SPEED_EXPR,
                  "target": "color", "fn": "exempt", "customName": "Speed (mph)"},
    },
    "tmc_travel_time_grid_graph_tmc": {
        "graphType": "GridGraph", "xAxis": "epoch",
        "categorize": {"desc": None, "name": "tmc", "type": "string", "source_id": 583,
                  "show": True, "target": "yAxis", "group": True, "sort": "asc"},
        "yAxis": {"type": "calculated", "show": True, "name": TRAVEL_TIME_EXPR,
                  "target": "color", "fn": "exempt",
                  "customName": "Travel Time (min)"},
        # Round 51 (user-reported): sub-70-second travel times rendered as
        # unreadable minute decimals (e.g. "0.045"). minutesAutoSeconds tells
        # GridGraph's legend to auto-switch the whole scale to seconds when
        # its own domain max is under ~70sec (formatMinutesAuto) — the
        # underlying TRAVEL_TIME_EXPR value stays in minutes, display-only.
        # Existing tooltip keys preserved verbatim (see round 35's original
        # UI-authored shape) — this dict REPLACES display.tooltip wholesale
        # in ensure_graph_templates, it doesn't deep-merge.
        "display": {"tooltip": {"show": True, "fontSize": 12, "yFormat": "float1",
                                 "showTotal": False, "minutesAutoSeconds": True}},
    },
    "tmc_avg_delay_grid_graph_tmc": {
        "graphType": "GridGraph", "xAxis": "epoch",
        "categorize": {"desc": None, "name": "tmc", "type": "string", "source_id": 583,
                  "show": True, "target": "yAxis", "group": True, "sort": "asc"},
        "yAxis": {"type": "calculated", "show": True, "name": AVG_DELAY_EXPR,
                  "target": "color", "fn": "exempt"},
        "join": {"table1": META_JOIN, "table2": AADT_DIST_JOIN},
    },
    "tmc_co2_grid_graph_passenger_tmc": {
        "graphType": "GridGraph", "xAxis": "epoch",
        "categorize": {"desc": None, "name": "tmc", "type": "string", "source_id": 583,
                  "show": True, "target": "yAxis", "group": True, "sort": "asc"},
        "yAxis": {"type": "calculated", "show": True, "name": CO2_EXPR_PASSENGER,
                  "target": "color", "fn": "avg"},
        "join": {"table1": META_JOIN, "table2": AADT_DIST_JOIN},
    },
    "tmc_co2_grid_graph_truck_tmc": {
        "graphType": "GridGraph", "xAxis": "epoch",
        "categorize": {"desc": None, "name": "tmc", "type": "string", "source_id": 583,
                  "show": True, "target": "yAxis", "group": True, "sort": "asc"},
        "yAxis": {"type": "calculated", "show": True, "name": CO2_EXPR_TRUCK,
                  "target": "color", "fn": "avg"},
        "join": {"table1": META_JOIN, "table2": AADT_DIST_JOIN},
    },
    "tmc_delay_bar_graph_weekday": {
        "graphType": "BarGraph",
        "xAxis": {"type": "calculated", "show": True, "name": WEEKDAY_EXPR,
                  "target": "xAxis", "group": True, "sort": "asc"},
        "yAxis": {"type": "calculated", "show": True, "name": DELAY_EXPR,
                  "target": "yAxis", "fn": "sum"},
        "join": {"table1": META_JOIN, "table2": AADT_DIST_JOIN},
    },
    "tmc_delay_bar_graph_5min": {
        "graphType": "BarGraph", "xAxis": "epoch", "categorize": "tmc",
        "yAxis": {"type": "calculated", "show": True, "name": DELAY_EXPR,
                  "target": "yAxis", "fn": "sum"},
        "join": {"table1": META_JOIN, "table2": AADT_DIST_JOIN},
    },
    # Same per-TMC shape as tmc_delay_bar_graph_5min above, at day resolution.
    # Named distinctly from tmc_delay_bar_graph_day (Route Bar Graph's
    # route-wide-sum/__series shape) since both would otherwise collide.
    "tmc_delay_bar_graph_day_tmc": {
        "graphType": "BarGraph", "xAxis": "date", "categorize": "tmc",
        "yAxis": {"type": "calculated", "show": True, "name": DELAY_EXPR,
                  "target": "yAxis", "fn": "sum"},
        "join": {"table1": META_JOIN, "table2": AADT_DIST_JOIN},
    },
    "tmc_delay_bar_graph_hour_tmc": {
        "graphType": "BarGraph",
        "xAxis": {"type": "calculated", "show": True, "name": HOUR_EXPR,
                  "target": "xAxis", "group": True, "sort": "asc"},
        "categorize": "tmc",
        "yAxis": {"type": "calculated", "show": True, "name": DELAY_EXPR,
                  "target": "yAxis", "fn": "sum"},
        "join": {"table1": META_JOIN, "table2": AADT_DIST_JOIN},
    },
    "tmc_delay_bar_graph_15min_tmc": {
        "graphType": "BarGraph",
        "xAxis": {"type": "calculated", "show": True, "name": QUARTER_HOUR_EXPR,
                  "target": "xAxis", "group": True, "sort": "asc"},
        "categorize": "tmc",
        "yAxis": {"type": "calculated", "show": True, "name": DELAY_EXPR,
                  "target": "yAxis", "fn": "sum"},
        "join": {"table1": META_JOIN, "table2": AADT_DIST_JOIN},
    },
    "tmc_delay_bar_graph_month_tmc": {
        "graphType": "BarGraph",
        "xAxis": {"type": "calculated", "show": True, "name": MONTH_EXPR,
                  "target": "xAxis", "group": True, "sort": "asc"},
        "categorize": "tmc",
        "yAxis": {"type": "calculated", "show": True, "name": DELAY_EXPR,
                  "target": "yAxis", "fn": "sum"},
        "join": {"table1": META_JOIN, "table2": AADT_DIST_JOIN},
    },
    # Round 29 (2026-07-10): Route Bar Graph speed/travelTime at every
    # resolution beyond `day` — round 27 census's #1 buildable lever. Same
    # route-wide (no `categorize`, defaults to `__series`) shape as
    # tmc_speed_bar_graph_day/tmc_travel_time_bar_graph_day above; only the
    # xAxis bucketing expression differs, reusing HOUR_EXPR/QUARTER_HOUR_EXPR/
    # MONTH_EXPR/WEEKDAY_EXPR verbatim from round 12's Hours-of-Delay-Graph
    # work (already proven live there) — no new SQL, no new join, no new
    # measure semantics, purely a resolution clone.
    "tmc_speed_bar_graph_5min": {
        "graphType": "BarGraph", "xAxis": "epoch",
        "yAxis": {"type": "calculated", "show": True, "name": SPEED_EXPR,
                  "target": "yAxis", "fn": "exempt", "customName": "Speed (mph)"},
    },
    "tmc_speed_bar_graph_hour": {
        "graphType": "BarGraph",
        "xAxis": {"type": "calculated", "show": True, "name": HOUR_EXPR,
                  "target": "xAxis", "group": True, "sort": "asc"},
        "yAxis": {"type": "calculated", "show": True, "name": SPEED_EXPR,
                  "target": "yAxis", "fn": "exempt", "customName": "Speed (mph)"},
    },
    "tmc_speed_bar_graph_15min": {
        "graphType": "BarGraph",
        "xAxis": {"type": "calculated", "show": True, "name": QUARTER_HOUR_EXPR,
                  "target": "xAxis", "group": True, "sort": "asc"},
        "yAxis": {"type": "calculated", "show": True, "name": SPEED_EXPR,
                  "target": "yAxis", "fn": "exempt", "customName": "Speed (mph)"},
    },
    "tmc_speed_bar_graph_month": {
        "graphType": "BarGraph",
        "xAxis": {"type": "calculated", "show": True, "name": MONTH_EXPR,
                  "target": "xAxis", "group": True, "sort": "asc"},
        "yAxis": {"type": "calculated", "show": True, "name": SPEED_EXPR,
                  "target": "yAxis", "fn": "exempt", "customName": "Speed (mph)"},
    },
    "tmc_speed_bar_graph_weekday": {
        "graphType": "BarGraph",
        "xAxis": {"type": "calculated", "show": True, "name": WEEKDAY_EXPR,
                  "target": "xAxis", "group": True, "sort": "asc"},
        "yAxis": {"type": "calculated", "show": True, "name": SPEED_EXPR,
                  "target": "yAxis", "fn": "exempt", "customName": "Speed (mph)"},
    },
    "tmc_travel_time_bar_graph_5min": {
        "graphType": "BarGraph", "xAxis": "epoch",
        "yAxis": {"type": "calculated", "show": True, "name": TRAVEL_TIME_EXPR,
                  "target": "yAxis", "fn": "exempt",
                  "customName": "Travel Time (min)"},
    },
    "tmc_travel_time_bar_graph_hour": {
        "graphType": "BarGraph",
        "xAxis": {"type": "calculated", "show": True, "name": HOUR_EXPR,
                  "target": "xAxis", "group": True, "sort": "asc"},
        "yAxis": {"type": "calculated", "show": True, "name": TRAVEL_TIME_EXPR,
                  "target": "yAxis", "fn": "exempt",
                  "customName": "Travel Time (min)"},
    },
    "tmc_travel_time_bar_graph_month": {
        "graphType": "BarGraph",
        "xAxis": {"type": "calculated", "show": True, "name": MONTH_EXPR,
                  "target": "xAxis", "group": True, "sort": "asc"},
        "yAxis": {"type": "calculated", "show": True, "name": TRAVEL_TIME_EXPR,
                  "target": "yAxis", "fn": "exempt",
                  "customName": "Travel Time (min)"},
    },
    "tmc_travel_time_bar_graph_weekday": {
        "graphType": "BarGraph",
        "xAxis": {"type": "calculated", "show": True, "name": WEEKDAY_EXPR,
                  "target": "xAxis", "group": True, "sort": "asc"},
        "yAxis": {"type": "calculated", "show": True, "name": TRAVEL_TIME_EXPR,
                  "target": "yAxis", "fn": "exempt",
                  "customName": "Travel Time (min)"},
    },
    # TMC Grid Graph shape (xAxis=epoch, target=color) mirroring
    # tmc_speed_grid_graph/the CO2 grid templates above — travelTime is the
    # other already-proven measure at this graph type's one supported
    # resolution (5-minutes).
    "tmc_travel_time_grid_graph": {
        "graphType": "GridGraph", "xAxis": "epoch",
        "yAxis": {"type": "calculated", "show": True, "name": TRAVEL_TIME_EXPR,
                  "target": "color", "fn": "exempt",
                  "customName": "Travel Time (min)"},
        # Round 51: see tmc_travel_time_grid_graph_tmc's comment — same fix,
        # same preserved tooltip shape (confirmed identical live, both
        # descend from the same round-35 UI-authored base).
        "display": {"tooltip": {"show": True, "fontSize": 12, "yFormat": "float1",
                                 "showTotal": False, "minutesAutoSeconds": True}},
    },
    # Round 32 (2026-07-10): avgHoursOfDelay — see AVG_DELAY_EXPR's own comment
    # for the formula derivation. `fn: "exempt"` throughout since the
    # expression already contains its own sum()/count(DISTINCT). Same
    # route-wide (no `categorize`, defaults to `__series`) shape as every
    # other Route Bar/Line/TMC Grid Graph template above — "TMC Grid Graph"'s
    # per-TMC rows come from each assigned route-comp being its own
    # comparison-series arm (the report's own route-comps are already
    # per-TMC), same mechanism as tmc_travel_time_grid_graph, not a literal
    # `tmc` categorize column (that's only "Hours of Delay Graph"'s own
    # distinct shape, a different old component). Route Line Graph is
    # single-measure regardless of graph type (analyze_graph always reduces
    # displayData to measures[0], gap-logging the rest as
    # extra_measures_dropped) — no dual-axis capability needed for this
    # bucket, despite Route Line Graph elsewhere being flagged (round 29) as
    # needing a dual-axis read first for its day-resolution hoursOfDelay
    # bucket, a separate, still-open question about a different resolution.
    "tmc_avg_delay_line_graph": {
        "graphType": "LineGraph", "xAxis": "epoch",
        "yAxis": {"type": "calculated", "show": True, "name": AVG_DELAY_EXPR,
                  "target": "yAxis", "fn": "exempt",
                  "customName": "Avg. Hours of Delay"},
        "join": {"table1": META_JOIN, "table2": AADT_DIST_JOIN},
    },
    "tmc_avg_delay_bar_graph_day": {
        "graphType": "BarGraph", "xAxis": "date",
        "yAxis": {"type": "calculated", "show": True, "name": AVG_DELAY_EXPR,
                  "target": "yAxis", "fn": "exempt",
                  "customName": "Avg. Hours of Delay"},
        "join": {"table1": META_JOIN, "table2": AADT_DIST_JOIN},
    },
    "tmc_avg_delay_bar_graph_weekday": {
        "graphType": "BarGraph",
        "xAxis": {"type": "calculated", "show": True, "name": WEEKDAY_EXPR,
                  "target": "xAxis", "group": True, "sort": "asc"},
        "yAxis": {"type": "calculated", "show": True, "name": AVG_DELAY_EXPR,
                  "target": "yAxis", "fn": "exempt",
                  "customName": "Avg. Hours of Delay"},
        "join": {"table1": META_JOIN, "table2": AADT_DIST_JOIN},
    },
    "tmc_avg_delay_bar_graph_5min": {
        "graphType": "BarGraph", "xAxis": "epoch",
        "yAxis": {"type": "calculated", "show": True, "name": AVG_DELAY_EXPR,
                  "target": "yAxis", "fn": "exempt",
                  "customName": "Avg. Hours of Delay"},
        "join": {"table1": META_JOIN, "table2": AADT_DIST_JOIN},
    },
    "tmc_avg_delay_bar_graph_hour": {
        "graphType": "BarGraph",
        "xAxis": {"type": "calculated", "show": True, "name": HOUR_EXPR,
                  "target": "xAxis", "group": True, "sort": "asc"},
        "yAxis": {"type": "calculated", "show": True, "name": AVG_DELAY_EXPR,
                  "target": "yAxis", "fn": "exempt",
                  "customName": "Avg. Hours of Delay"},
        "join": {"table1": META_JOIN, "table2": AADT_DIST_JOIN},
    },
    "tmc_avg_delay_bar_graph_month": {
        "graphType": "BarGraph",
        "xAxis": {"type": "calculated", "show": True, "name": MONTH_EXPR,
                  "target": "xAxis", "group": True, "sort": "asc"},
        "yAxis": {"type": "calculated", "show": True, "name": AVG_DELAY_EXPR,
                  "target": "yAxis", "fn": "exempt",
                  "customName": "Avg. Hours of Delay"},
        "join": {"table1": META_JOIN, "table2": AADT_DIST_JOIN},
    },
    "tmc_avg_delay_grid_graph": {
        "graphType": "GridGraph", "xAxis": "epoch",
        "yAxis": {"type": "calculated", "show": True, "name": AVG_DELAY_EXPR,
                  "target": "color", "fn": "exempt"},
        "join": {"table1": META_JOIN, "table2": AADT_DIST_JOIN},
    },
    # Round 34 (2026-07-13): Bar Graph Summary — the comparison-series
    # discriminator itself is the x axis (one bar per arm, one whole-range
    # aggregate each; groupBy __series only — the proven Info Box query
    # shape). "categorize": False (not None/absent) tells
    # ensure_graph_templates to OMIT the base's __series categorize column
    # instead of inheriting it — the same column can't be both axes, and a
    # duplicate "__series" entry would collide in every name-keyed column map
    # downstream. Old per-route bar colors are NOT reproduced yet (bars render
    # in a single palette color; same treatment as converted line graphs,
    # which use the template palette rather than the old comps' saved colors).
    # display.legend.show=False: old Bar Graph Summary has no legend (the
    # x-axis labels already name each bar) — and, load-bearing, not cosmetic:
    # BarGraph.jsx lays the legend out as an unconstrained flex sibling of the
    # flex-1 chart, so a legend label as long as this raw expression (the
    # legend key falls back to the column's full name) takes the entire row
    # and squeezes the chart to 0 width — confirmed live on report 520's
    # first render (3 bars present in the SVG, container 0px wide). Same
    # mechanism class as the parked round-9 "bar-graph width squeeze".
    # customName covers any remaining label fallbacks (tooltips etc.).
    "tmc_speed_summary_bar_graph": {
        "graphType": "BarGraph", "xAxis": "__series", "categorize": False,
        "yAxis": {"type": "calculated", "show": True, "name": SPEED_SUMMARY_EXPR,
                  "target": "yAxis", "fn": "exempt", "customName": "Speed (mph)"},
        "join": {"table1": META_JOIN},
        "display": {"legend": {"show": False}},
    },
    # Round 36: the remaining Phase A summary measures — same round-34 summary
    # shape (one bar per comparison-series arm, whole-range aggregate, legend
    # hidden). travelTime is TRAVEL_TIME_EXPR verbatim (the old
    # travelTimeAllReducer IS the same two-level fold — round 35's unification
    # argument applies unchanged; no join override needed, the expression only
    # touches ds columns). hoursOfDelay is sum(DELAY_EXPR) — the old
    # sumReducer over bucket sums collapses to one plain sum, so the ordinary
    # fn:"sum" path applies and resolution cancels out entirely.
    "tmc_travel_time_summary_bar_graph": {
        "graphType": "BarGraph", "xAxis": "__series", "categorize": False,
        "yAxis": {"type": "calculated", "show": True, "name": TRAVEL_TIME_EXPR,
                  "target": "yAxis", "fn": "exempt",
                  "customName": "Travel Time (min)"},
        "display": {"legend": {"show": False}},
    },
    "tmc_delay_summary_bar_graph": {
        "graphType": "BarGraph", "xAxis": "__series", "categorize": False,
        "yAxis": {"type": "calculated", "show": True, "name": DELAY_EXPR,
                  "target": "yAxis", "fn": "sum",
                  "customName": "Hours of Delay"},
        "join": {"table1": META_JOIN, "table2": AADT_DIST_JOIN},
        "display": {"legend": {"show": False}},
    },
    # avgHoursOfDelay is the one summary measure where resolution changes the
    # value (bucket-grain-dependent mean) — one template per resolution the
    # corpus actually uses (survey in the round-36 task-file notes: 63×5-min,
    # 12×day, 1×weekday); see _avg_delay_summary_expr above for the formula.
    "tmc_avg_delay_summary_bar_graph_5min": {
        "graphType": "BarGraph", "xAxis": "__series", "categorize": False,
        "yAxis": {"type": "calculated", "show": True,
                  "name": AVG_DELAY_SUMMARY_5MIN_EXPR,
                  "target": "yAxis", "fn": "exempt",
                  "customName": "Avg. Hours of Delay"},
        "join": {"table1": META_JOIN, "table2": AADT_DIST_JOIN},
        "display": {"legend": {"show": False}},
    },
    "tmc_avg_delay_summary_bar_graph_day": {
        "graphType": "BarGraph", "xAxis": "__series", "categorize": False,
        "yAxis": {"type": "calculated", "show": True,
                  "name": AVG_DELAY_SUMMARY_DAY_EXPR,
                  "target": "yAxis", "fn": "exempt",
                  "customName": "Avg. Hours of Delay"},
        "join": {"table1": META_JOIN, "table2": AADT_DIST_JOIN},
        "display": {"legend": {"show": False}},
    },
    "tmc_avg_delay_summary_bar_graph_weekday": {
        "graphType": "BarGraph", "xAxis": "__series", "categorize": False,
        "yAxis": {"type": "calculated", "show": True,
                  "name": AVG_DELAY_SUMMARY_WEEKDAY_EXPR,
                  "target": "yAxis", "fn": "exempt",
                  "customName": "Avg. Hours of Delay"},
        "join": {"table1": META_JOIN, "table2": AADT_DIST_JOIN},
        "display": {"legend": {"show": False}},
    },
}
TEMPLATE_BASE_NAME = "tmc_travel_time_line_graph"
# Route Compare Component's per-measure raw expression (see ROUTE_COMPARE_BUCKET
# above) — only speed is in scope this round.
MEASURE_EXPR = {"speed": SPEED_EXPR}


# ── Low-level helpers ────────────────────────────────────────────────────────

def psql(config_path, sql):
    c = json.load(open(config_path))
    env = os.environ.copy()
    env["PGPASSWORD"] = c["password"]
    r = subprocess.run(
        ["psql", "-h", c["host"], "-p", str(c["port"]), "-U", c["user"],
         "-d", c["database"], "-t", "-A", "-c", sql],
        env=env, capture_output=True, text=True, timeout=60)
    if r.returncode:
        raise RuntimeError(f"psql failed: {r.stderr.strip()}\nSQL: {sql[:300]}")
    return r.stdout.strip()


def psql_old(sql):
    return psql(OLD_DB_CONFIG, sql)


def psql_new(sql):
    return psql(NEW_DB_CONFIG, sql)


def dms(args, data=None):
    """Run a dms CLI command, return parsed JSON stdout."""
    env = os.environ.copy()
    env.update(DMS_ENV)
    if os.path.exists(TOKEN_FILE):
        env["DMS_AUTH_TOKEN"] = open(TOKEN_FILE).read().strip()
    cmd = ["dms"] + args
    if data is not None:
        cmd += ["--data", json.dumps(data)]
    r = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=120)
    out = r.stdout.strip()
    if r.returncode or not out:
        raise RuntimeError(f"dms {' '.join(args[:3])} failed: {r.stderr.strip()[:500] or out[:500]}")
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        raise RuntimeError(f"dms {' '.join(args[:3])}: non-JSON output: {out[:500]}")


def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def old_falcor_get(paths):
    """GET against the old production falcor API (graph.availabs.org)."""
    import urllib.parse
    import urllib.request
    url = ("https://graph.availabs.org/graph?paths="
           + urllib.parse.quote(json.dumps(paths)) + "&method=get")
    return json.loads(urllib.request.urlopen(url, timeout=90).read())


# ── Old-side loading ─────────────────────────────────────────────────────────

def fetch_old_report(report_id):
    out = psql_old(f"SELECT row_to_json(r) FROM admin2.reports r WHERE id = {int(report_id)}")
    if not out:
        raise RuntimeError(f"Old report {report_id} not found in admin2.reports")
    return json.loads(out)


def fetch_old_routes(route_ids):
    if not route_ids:
        return {}
    ids = ",".join(str(int(r)) for r in route_ids)
    out = psql_old(f"SELECT json_agg(row_to_json(r)) FROM admin2.routes r WHERE id IN ({ids})")
    rows = json.loads(out) if out and out != "null" else []
    return {str(r["id"]): r for r in rows}


def flatten_route_comps(route_comps, gaps):
    """Old route_comps may contain type:'group' entries wrapping nested comps.
    Flatten them (only 13 group comps exist across all old reports); the group
    structure itself is recorded as a gap."""
    flat = []
    for rc in route_comps or []:
        if rc.get("type", "route") == "group":
            gaps.append({"kind": "route_group_flattened",
                         "detail": f"group '{rc.get('name')}' with "
                                   f"{len(rc.get('route_comps') or [])} routes flattened"})
            for inner in rc.get("route_comps") or []:
                flat.append(inner)
        else:
            flat.append(rc)
    return flat


PRE_2017_CUTOFF = 20170101


def route_comp_is_pre_2017(settings):
    """True only when both startDate/endDate are present and the whole
    range falls before 2017-01-01 (npmrds.s583_v982_NPMRDS_V6 starts 2017,
    round 13) — comps missing either date are left as 'unknown, not
    pre-2017' rather than assumed broken (14/5154 corpus route_comps)."""
    start, end = settings.get("startDate"), settings.get("endDate")
    if not start or not end:
        return False
    try:
        return int(str(start)) < PRE_2017_CUTOFF and int(str(end)) < PRE_2017_CUTOFF
    except ValueError:
        return False


def report_is_pre_2017_only(route_comps):
    """True iff EVERY route_comp in the report is pre-2017-only (round 39) —
    mirrors the report-level no_valid_routes skip below: this data predates
    npmrds.s583_v982_NPMRDS_V6's 2017 start and is never coming back, so a
    report entirely inside that range would only ever produce a
    permanently-blank page regardless of template completeness."""
    return bool(route_comps) and all(
        route_comp_is_pre_2017(rc.get("settings") or {}) for rc in route_comps)


# ── Old → new transforms ─────────────────────────────────────────────────────

def to_datetime_str(yyyymmdd, hhmm):
    """20250101 + '07:00' → '2025-01-01T07:00' (date-only when no time)."""
    if not yyyymmdd:
        return None
    s = str(yyyymmdd)
    if len(s) != 8 or not s.isdigit():
        return None
    date = f"{s[0:4]}-{s[4:6]}-{s[6:8]}"
    if hhmm and ":" in str(hhmm):
        return f"{date}T{hhmm}"
    return date


def js(v):
    """Old jsonb values arrive as parsed JSON; the new-catalog shape stores
    them as JSON-encoded strings ('' when empty) — see the Routes Data rows."""
    if v in (None, "", [], {}):
        return ""
    return json.dumps(v) if not isinstance(v, str) else v


def route_settings_gaps(settings, comp_name, gaps):
    """Everything transformReportRoutes cannot express yet → gap report."""
    # weekdays IS expressible (route entry carries the mask; transformReportRoutes
    # skips masked-out days when enumerating the date IN-list) — but only when a
    # date range exists for the enumeration to filter.
    wd = settings.get("weekdays") or {}
    off_days = sorted(d for d in ALL_WEEKDAYS if wd.get(d) is False)
    if off_days and not (settings.get("startDate") and settings.get("endDate")):
        gaps.append({"kind": "weekday_mask_without_date_range", "route": comp_name,
                     "detail": f"mask {off_days} has no date range to filter"})
    # NOT gaps: amPeak/pmPeak/offPeak and year/month==='advanced' are old-UI
    # bookkeeping only. Verified against transportNY's actual old report client
    # (RouteComponent.jsx `shouldReloadData()`/`togglePeaks()`/`updateSettings()`):
    # clicking a peak button computes an envelope (MIN start/MAX end across
    # enabled peaks — NOT disjoint subranges; all-three-true covers the whole
    # 7am-7pm span, off-peak middle included) and writes it straight into
    # settings.startTime/endTime, which is the only thing `shouldReloadData()`
    # (and hence the real query) reads. Confirmed on report 1071's actual data:
    # amPeak-only -> startTime/endTime '07:00'/'10:00' (== [7*12,10*12] epochs,
    # transportNY store/utils/general.utils.js's amPeakStart/End); all-three ->
    # '07:00'/'19:00'. settings.year/month are similarly query-inert — read only
    # by title-label helpers (store/index.js ~2719-2746), never by
    # shouldReloadData. Since startTime/endTime/startDate/endDate are already
    # converted into the route entry, no separate handling is needed.
    # `aadt` is handled per-graph now (baked into the cloned calculated column
    # when every assigned comp agrees — see graph_aadt_overrides in
    # convert_report; disagreement gets its own aadt_override_mixed gap, and a
    # falsy '0' override is query-inert in the old tool, getAADT's
    # `if (aadtOverride)`). Other override keys (baseSpeed, thresholdSpeed, …)
    # remain unimplemented and still gap-log here.
    other_overrides = {k: v for k, v in (settings.get("overrides") or {}).items()
                       if k != "aadt"}
    if other_overrides:
        gaps.append({"kind": "overrides", "route": comp_name,
                     "detail": other_overrides})
    if settings.get("relativeDate"):
        gaps.append({"kind": "relative_date", "route": comp_name,
                     "detail": settings["relativeDate"]})


_MONTH_NAMES = {"01": "January", "02": "February", "03": "March",
                "04": "April", "05": "May", "06": "June", "07": "July",
                "08": "August", "09": "September", "10": "October",
                "11": "November", "12": "December"}


def _comp_year_string(s):
    # transportNY reports/store/index.js getYearString — including its quirky
    # `${end}-${start}` order for multi-year advanced ranges, kept verbatim.
    if s.get("year") != "advanced" and not s.get("useRelativeDateControls"):
        return str(s.get("year"))
    start, end = str(s.get("startDate"))[:4], str(s.get("endDate"))[:4]
    return start if start == end else f"{end}-{start}"


def _comp_month_string(s):
    month = s.get("month")
    if month == "all":
        return f"Jan-Dec, {s.get('year')}"
    if month != "advanced" and not s.get("useRelativeDateControls"):
        name = _MONTH_NAMES.get(str(month).zfill(2))
        return f"{name[:3]}, {s.get('year')}" if name else str(month)
    start, end = str(s.get("startDate")), str(s.get("endDate"))
    m1, m2, y1, y2 = start[4:6], end[4:6], start[:4], end[:4]
    if y1 == y2:
        if m1 == m2:
            return f"{_MONTH_NAMES[m1][:3]}, {y1}"
        return f"{_MONTH_NAMES[m1][:3]}-{_MONTH_NAMES[m2][:3]}, {y1}"
    return _comp_year_string(s)


def _comp_date_string(s):
    start, end = str(s.get("startDate")), str(s.get("endDate"))
    if start == end:
        return f"{_MONTH_NAMES[start[4:6]][:3]} {int(start[6:])}, {start[:4]}"
    return _comp_month_string(s)


def route_comp_display_name(rc, old_route):
    """Old client's getRouteCompName (transportNY reports/store/index.js:2703):
    a comp's display name is settings.compTitle with {name}/{year}/{month}/
    {date} substituted (getYearString/getMonthString/getDateString ported
    above); plain route name when compTitle is empty. Without this, sibling
    comps of the same route (e.g. report 520's five "WB Arterial Weave" comps
    differing only in year/time window) all get the bare route name — and
    since comp names become comparison-series `__series` labels, every graph
    visually merges them into one series (caught live by the user on the
    first report_520 conversion, 2026-07-13)."""
    name = rc.get("name") or (old_route or {}).get("name") or ""
    s = rc.get("settings") or {}
    if not s.get("compTitle"):
        return name
    try:
        return (s["compTitle"].replace("{name}", name)
                .replace("{year}", _comp_year_string(s))
                .replace("{month}", _comp_month_string(s))
                .replace("{date}", _comp_date_string(s)))
    except Exception:
        return name  # malformed settings — keep converting on the plain name


def build_route_entry(rc, old_route, graph_tracking_ids, old_report_id, gaps,
                      tmc_override=None):
    settings = rc.get("settings") or {}
    route_settings_gaps(settings, rc.get("name"), gaps)
    start = to_datetime_str(settings.get("startDate"), settings.get("startTime"))
    end = to_datetime_str(settings.get("endDate"), settings.get("endTime"))
    resolved_tmc_array = tmc_override or (old_route or {}).get("tmc_array") or []
    # A route with no resolvable TMC identity (route_missing_everywhere) can
    # never contribute real data — every measure in this whole pipeline is
    # TMC-scoped. Worse than just useless: buildUdaConfig.js's filter-cleaning
    # WIDENS an empty-valued filter leaf to "no constraint" rather than
    # compiling it to `col IN ()` (a deliberate choice for a different,
    # legitimate case — an unset page-filter control). Wiring a tmc-less route
    # into a graph's comparisonSeries lets that arm run with NO tmc
    # restriction at all — on a `categorize:"tmc"` template (real `tmc` in
    # groupBy, not just `__series`) that's a genuine unfiltered-nationwide-TMC
    # scan, not just wasted work. Confirmed live 2026-07-10: report 1032's
    # Hours of Delay Graph arm for a missing route requested a 4.4M-row
    # dataByIndex range (every TMC in the table × 288 epochs), tripping
    # falcor-router's MAX_PATHS=9000 cap; the identical combination was
    # already live and unnoticed on report_392 since round 12. So: never
    # assign graphIds to a route with no real TMC array, regardless of what
    # the caller computed.
    graph_ids = list(graph_tracking_ids) if resolved_tmc_array else []
    entry = {
        "name": rc.get("name") or (old_route or {}).get("name") or "",
        "route_id": str(rc.get("routeId")),
        "tmc_array": js(resolved_tmc_array),
        "description": (old_route or {}).get("description") or "",
        "points": js((old_route or {}).get("points")),
        "metadata": js((old_route or {}).get("metadata")),
        "conflation_array": js((old_route or {}).get("conflation_array")),
        "conflation_version": (old_route or {}).get("conflation_version") or "none",
        "created_at": (old_route or {}).get("created_at") or "",
        "created_by": str((old_route or {}).get("created_by") or ""),
        "updated_at": (old_route or {}).get("updated_at") or "",
        "isValid": True,
        "route_comp_id": rc.get("compId") or "",
        # Which graphs this comp feeds — inverted from each old graph's
        # state.activeRouteComponents (absent → the graph showed every comp);
        # forced to [] above when there's no real TMC to scope a query with.
        "graphIds": graph_ids,
        # Preserve the old comp verbatim — schema-free row, nothing is lost
        "_old_settings": settings,
        "_old_color": rc.get("color"),
        "_old_report_id": old_report_id,
    }
    if not resolved_tmc_array and graph_tracking_ids:
        gaps.append({"kind": "route_excluded_from_graphs_no_tmc",
                     "route": rc.get("name"),
                     "detail": f"route_id {rc.get('routeId')} has no resolvable "
                               "tmc_array; excluded from "
                               f"{len(graph_tracking_ids)} assigned graph(s) "
                               "to avoid an unfiltered scan"})
    if start:
        entry["startDate"] = start
    if end:
        entry["endDate"] = end
    # First-class day-of-week mask (old settings shape kept verbatim:
    # {monday: bool, ..., sunday: bool}); transformReportRoutes drops
    # explicitly-false days from the enumerated date filter.
    if settings.get("weekdays"):
        entry["weekdays"] = settings["weekdays"]
    return entry


# ── New-side building blocks ─────────────────────────────────────────────────

def load_graph_templates():
    # `dms raw list` defaults to --limit 20; this type has grown past that
    # (37 as of round 32) so the default page silently drops whichever
    # templates sort outside it — confirmed live 2026-07-10: the two oldest
    # base templates (tmc_speed_line_graph/tmc_travel_time_line_graph, the
    # originals every other template is minted from) fell off the page,
    # making every report using them spuriously gap-log as "template ... not
    # found in DB". A generous fixed limit is simpler than round-tripping for
    # the real total first.
    rows = dms(["raw", "list", f"npmrdsv5+{GRAPH_TEMPLATE_TYPE}", "--limit", "1000"])
    items = rows if isinstance(rows, list) else rows.get("items", [])
    by_name = {}
    for r in items:
        d = r.get("data") or {}
        if isinstance(d, str):
            d = json.loads(d)
        by_name[d.get("name")] = {"id": r.get("id"), "data": d}
    return by_name


def ensure_graph_templates(needed_names, templates, dry_run):
    """Mint missing avl_graph_template rows from TEMPLATE_SPECS, built on the
    base template's stateJson so externalSource/display stay UI-consistent.
    Also detects yAxis-expression drift on already-existing rows (e.g. round
    23's SPEED_EXPR/TRAVEL_TIME_EXPR nullIf fix) and updates them in place —
    same update-in-place idiom ensure_pm3_join_template uses for the freeflow
    column, applied here so a live template never silently goes stale against
    its own TEMPLATE_SPECS entry."""
    for name in needed_names:
        if name not in templates or name not in TEMPLATE_SPECS:
            continue
        spec = TEMPLATE_SPECS[name]
        existing = templates[name]
        existing_state = json.loads(existing["data"]["stateJson"])
        cols = existing_state["columns"]
        # Match the value column by the spec's own target — GridGraph value
        # columns are target "color", not "yAxis" (round 35: the hardcoded
        # "yAxis" lookup made every grid template silently invisible to
        # drift detection; caught in the backport dry-run when both grid
        # specs failed to fire).
        y_target = spec["yAxis"].get("target", "yAxis")
        y_idx = next((i for i, c in enumerate(cols)
                      if c.get("target") == y_target), None)
        # Drift = the whole yAxis column dict (not just the expression name —
        # fn/customName changes matter too, e.g. round 34's summary legend
        # fix) or any spec display patch key the live row doesn't match, or
        # (round 52) a comparisonSeries.combine the live row doesn't carry.
        display_patch = spec.get("display") or {}
        existing_display = existing_state.get("display") or {}
        display_drift = any(existing_display.get(k) != v
                            for k, v in display_patch.items())
        combine_spec = spec.get("comparisonSeriesCombine")
        combine_drift = (combine_spec is not None and
                         (existing_state.get("comparisonSeries") or {})
                         .get("combine") != combine_spec)
        # Round 59: join drift -- the mint branch below (spec.get("join"))
        # was never mirrored here, so a spec whose JOIN changed (not just its
        # expression text, e.g. this round's META_JOIN source swap) silently
        # never propagated to an already-existing row -- the yAxis-expr
        # check above caught the expression text change but left the row's
        # stored join pointed at the old source forever. Same live-caught
        # bug class this whole drift-detection idiom exists to prevent.
        join_spec = spec.get("join")
        expected_join = {"sources": join_spec} if join_spec else None
        join_drift = (expected_join is not None and
                     existing_state.get("join") != expected_join)
        # Round 61: any "xAxis": "epoch" spec's x column is the raw 5-min-of-
        # day index (ds.epoch) -- ticks render as "80" instead of "6:40"
        # without a named formatFn. Derived off the spec's own xAxis shorthand
        # rather than hand-added to all ~40 TEMPLATE_SPECS entries, so it
        # covers every current and future one uniformly.
        existing_xaxis_format = (existing_display.get("xAxis") or {}).get("format")
        epoch_format_drift = (spec["xAxis"] == "epoch" and
                              existing_xaxis_format != "epoch_time")
        # Round 62: same lazy-drift idiom as epoch_format_drift, for the two
        # axis-caption fields (see the mint-branch comment above for the
        # root cause / rationale — the render path already works, these
        # fields were just never populated).
        existing_xaxis_label = (existing_display.get("xAxis") or {}).get("label")
        epoch_label_drift = (spec["xAxis"] == "epoch" and
                             existing_xaxis_label != "Time of Day")
        expected_yaxis_label = (spec["yAxis"].get("customName")
                                if spec["yAxis"].get("target", "yAxis") == "yAxis" else None)
        existing_yaxis_label = (existing_display.get("yAxis") or {}).get("label")
        yaxis_label_drift = bool(expected_yaxis_label) and existing_yaxis_label != expected_yaxis_label
        if y_idx is None:
            continue  # no yAxis-target column to compare against at all
        yaxis_drift = cols[y_idx] != dict(spec["yAxis"])
        if not (yaxis_drift or display_drift or combine_drift or join_drift
                or epoch_format_drift or epoch_label_drift or yaxis_label_drift):
            continue  # no drift
        cols[y_idx] = dict(spec["yAxis"])
        for k, v in display_patch.items():
            existing_state.setdefault("display", {})[k] = v
        if combine_spec is not None:
            existing_state.setdefault("comparisonSeries", {})["combine"] = \
                dict(combine_spec)
        if join_drift:
            existing_state["join"] = json.loads(json.dumps(expected_join))
        if epoch_format_drift:
            existing_state.setdefault("display", {}) \
                .setdefault("xAxis", {})["format"] = "epoch_time"
        if epoch_label_drift:
            existing_state.setdefault("display", {}) \
                .setdefault("xAxis", {})["label"] = "Time of Day"
        if yaxis_label_drift:
            existing_state.setdefault("display", {}) \
                .setdefault("yAxis", {})["label"] = expected_yaxis_label
        new_data = {**existing["data"], "stateJson": json.dumps(existing_state),
                    "updatedAt": now_iso()}
        note = ", ".join(k for k, fired in (
            ("yAxis expr", yaxis_drift), ("display", display_drift),
            ("comparisonSeries.combine", combine_drift), ("join", join_drift),
            ("xAxis format", epoch_format_drift), ("xAxis label", epoch_label_drift),
            ("yAxis label", yaxis_label_drift),
        ) if fired)
        if dry_run:
            print(f"[dry-run] would update drifted template '{name}' "
                  f"id={existing['id']} ({note} changed)")
        else:
            dms(["raw", "update", str(existing["id"])], data=new_data)
            print(f"updated template '{name}' id={existing['id']} "
                  f"({note} drift fix)")
        templates[name] = {"id": existing["id"], "data": new_data}

    missing = [n for n in needed_names if n not in templates and n in TEMPLATE_SPECS]
    if not missing:
        return templates
    base = templates.get(TEMPLATE_BASE_NAME)
    if not base:
        raise RuntimeError(f"base template '{TEMPLATE_BASE_NAME}' not found")
    base_state = json.loads(base["data"]["stateJson"])
    for name in missing:
        spec = TEMPLATE_SPECS[name]
        state = json.loads(json.dumps(base_state))  # deep copy
        # x-axis: either a plain existing-column name (e.g. "date") swapped in
        # from the base's epoch column, or (for a calculated grouping, e.g.
        # weekday-name buckets) a full column dict supplied as-is.
        if isinstance(spec["xAxis"], dict):
            x_col = spec["xAxis"]
        elif spec["xAxis"] == "__series":
            # Bar Graph Summary shape (round 34): the comparison-series
            # discriminator IS the x axis — one bar per arm. `__series` isn't
            # in externalSource.columns (it's the base stateJson's own
            # synthesized comparison-series column), so retarget that one.
            # No "sort": arms should keep their comparisonSeries order, not
            # re-sort alphabetically (BarGraph only sorts when the index
            # column carries a sort key).
            x_src = next(c for c in state["columns"]
                         if c.get("name") == "__series")
            x_col = {**x_src, "target": "xAxis"}
        else:
            x_src = next(c for c in state["externalSource"]["columns"]
                         if c.get("name") == spec["xAxis"])
            x_col = {**x_src, "show": True, "target": "xAxis", "group": True,
                     "sort": "asc"}
        # Categorize column: every existing template keeps the base's
        # comparison-series `__series` discriminator (none of them fan out
        # across routes on their own — comparison-series is a section-level
        # overlay). A spec-supplied `categorize` (e.g. "tmc", for a per-TMC
        # breakdown like Hours of Delay Graph) replaces it with a real,
        # grouped data column instead — same plain-name-or-full-dict shape as
        # xAxis above. `categorize: False` omits the column entirely (Bar
        # Graph Summary — __series is already the x axis; a duplicate entry
        # of the same name would collide in every name-keyed column map).
        cat_spec = spec.get("categorize")
        if cat_spec is False:
            cat_col = None
        elif cat_spec is None:
            cat_col = next(c for c in state["columns"]
                           if c.get("name") == "__series")
        elif isinstance(cat_spec, dict):
            cat_col = cat_spec
        else:
            cat_src = next(c for c in state["externalSource"]["columns"]
                           if c.get("name") == cat_spec)
            cat_col = {**cat_src, "show": True, "target": "categorize",
                       "group": True}
        state["columns"] = [spec["yAxis"], x_col] + (
            [cat_col] if cat_col else [])
        state["display"]["graphType"] = spec["graphType"]
        for k, v in (spec.get("display") or {}).items():
            state["display"][k] = v
        if spec["xAxis"] == "epoch":
            state["display"].setdefault("xAxis", {})["format"] = "epoch_time"
            state["display"]["xAxis"]["label"] = "Time of Day"
        # Round 62: y-axis caption (user-reported 2026-07-13, "no axis label on
        # any report" — distinct from tick labels, which already render fine;
        # this is the axis TITLE describing what's plotted, e.g. "Hours of
        # Delay"). GraphComponent.jsx/AxisLeft.jsx already read+render
        # display.yAxis.label when set — the rendering path was never broken,
        # display.yAxis.label was simply never populated by this converter.
        # Reuses the yAxis column's own customName (already a human-readable
        # measure description on ~40 TEMPLATE_SPECS entries, e.g. "Speed
        # (mph)") rather than a second, parallel measure-name table that could
        # drift from it. Only for actual y-axis-plotted measures (target
        # "yAxis", BarGraph/LineGraph/Bar Graph Summary shapes) — GridGraph's
        # value column targets "color", not a literal y-axis, so it's excluded.
        if spec["yAxis"].get("target", "yAxis") == "yAxis" and spec["yAxis"].get("customName"):
            state["display"].setdefault("yAxis", {})["label"] = spec["yAxis"]["customName"]
        if spec.get("join"):
            state["join"] = {"sources": spec["join"]}
        # Round 52: difference combine mode — the base template's own
        # comparisonSeries block (subscriber config etc.) is already in the
        # deep-copied state; this only adds the combine key the server's
        # difference branch reads (buildUdaConfig forwards it verbatim as
        # options.seriesCombine).
        if spec.get("comparisonSeriesCombine"):
            state.setdefault("comparisonSeries", {})["combine"] = \
                dict(spec["comparisonSeriesCombine"])
        if dry_run:
            print(f"[dry-run] would create template '{name}'")
            templates[name] = {"id": None, "data": {"name": name,
                               "stateJson": json.dumps(state),
                               "elementType": "AVL Graph",
                               "updatedAt": now_iso()}}
            continue
        data = {
            "name": name, "slug": name,
            "stateJson": json.dumps(state),
            "layoutJson": base["data"].get("layoutJson"),
            "elementType": "AVL Graph", "componentType": "AVL Graph",
            "includesLayout": base["data"].get("includesLayout", False),
            "includesSource": base["data"].get("includesSource", True),
            "createdAt": now_iso(), "createdBy": base["data"].get("createdBy"),
            "updatedAt": now_iso(), "updatedBy": base["data"].get("updatedBy"),
        }
        r = dms(["raw", "create", "npmrdsv5", GRAPH_TEMPLATE_TYPE], data=data)
        templates[name] = {"id": r["id"], "data": data}
        print(f"created template '{name}' id={r['id']}")
    return templates


def graph_max_year(info, comps_by_id):
    """Latest calendar year touched by this graph's assigned comps'
    startDate/endDate. Used to period-match the pm3 (1410) join to the
    report's own year, never a different one (round 17). Same yyyymmdd
    validation as to_datetime_str — ancient (~report ids 211-271) "version
    2" comps can carry a whole object under settings.startDate/endDate
    instead of a plain 8-digit int; skip those rather than crash."""
    years = set()
    for cid in info["assigned"]:
        settings = (comps_by_id.get(cid) or {}).get("settings") or {}
        for k in ("startDate", "endDate"):
            s = str(settings.get(k) or "")
            if len(s) == 8 and s.isdigit():
                years.add(int(s[:4]))
    return max(years) if years else None


def comp_reliability_bin(settings):
    """Resolve one route comp's FHWA reliability bin (amp/midd/pmp/we), or
    None if it doesn't land unambiguously on one of the four 1410 actually
    carries. See the RELIABILITY_BIN_BY_PEAK_FLAG comment above for why this
    never curve-fits an approximate answer."""
    weekdays = settings.get("weekdays") or {}
    has_weekday = any(weekdays.get(d) for d in WEEKDAY_NAMES)
    has_weekend = any(weekdays.get(d) for d in WEEKEND_NAMES)
    if has_weekend and not has_weekday:
        return "we"
    if has_weekend and has_weekday:
        return None  # spans both a weekday-scoped bin and WE — neither fits
    peaks_on = [f for f in ("amPeak", "offPeak", "pmPeak") if settings.get(f)]
    return RELIABILITY_BIN_BY_PEAK_FLAG[peaks_on[0]] if len(peaks_on) == 1 else None


def graph_reliability_bin(info, comps_by_id):
    """The single bin every one of a graph's assigned comps agrees on, or
    None if undetermined/mixed. Same consensus-set idiom as the
    resolution/dataColumn checks in analyze_graph — never guesses when
    comps disagree."""
    bins = {comp_reliability_bin((comps_by_id.get(cid) or {}).get("settings") or {})
            for cid in info["assigned"]}
    return next(iter(bins)) if len(bins) == 1 else None


def ensure_pm3_join_template(grain, year, bin_, templates, dry_run):
    """Mint (or reuse) `{grain}_info_box_reliability_{year}_{bin_}` — a
    Spreadsheet template joining 1410's pm3 view for `year`/`bin_` via the
    pgFederated mechanism (round 16), grouped by route (the `__series`
    comparison-series discriminator) or by TMC (a plain `tmc` column) per
    `grain`. Built on TEMPLATE_BASE_NAME's stateJson for externalSource/
    filters/comparisonSeries/customBuckets/display._functions — the same
    base ensure_graph_templates() uses above. Round 18 found the hard way
    that building `display` from scratch instead of copying the base's
    silently drops fetchMode and the comparison_series subscriber, and the
    fetch never fires (no console error — usePageFilterSync just no-ops).
    `bin_` must be one of RELIABILITY_BIN_BY_PEAK_FLAG's values (amp/midd/
    pmp) or 'we' — the caller (graph_reliability_bin) never passes anything
    else.

    Round 22 adds a freeflow column (`pm3.speed_pctl_85`) alongside LOTTR/
    TTTR — unlike those two, 1410's speed percentiles are a plain per-TMC/
    per-route value with no bin dimension at all (round 21's schema check:
    121 columns, 52,127 rows = 52,127 distinct TMCs, one row per TMC), so it
    rides along on the same join regardless of `bin_`, same class of change
    as adding another column to an existing join (no new join, no new year/
    bin resolution). A template already minted before this round (round 21's
    two live `tmc_info_box_reliability_2023_amp`/`_pmp` rows) is missing the
    column — rather than mint a new name (which would orphan the row a live
    report already references), update it in place via `dms raw update`."""
    name = f"{grain}_info_box_reliability_{year}_{bin_}"
    base = templates.get(TEMPLATE_BASE_NAME)
    if not base:
        raise RuntimeError(f"base template '{TEMPLATE_BASE_NAME}' not found")
    base_state = json.loads(base["data"]["stateJson"])
    view_id = PM3_VIEW_BY_YEAR[year]

    lottr_col = {"type": "calculated", "show": True,
                 "name": f"pm3.lottr_{bin_}_lottr as lottr_{bin_}", "fn": "avg"}
    tttr_col = {"type": "calculated", "show": True,
                "name": f"pm3.tttr_{bin_}_tttr as tttr_{bin_}", "fn": "avg"}
    freeflow_col = {"type": "calculated", "show": True,
                    "name": "pm3.speed_pctl_85 as freeflow", "fn": "avg"}
    if grain == "route":
        series_col = next(c for c in base_state["columns"]
                          if c.get("name") == "__series")
        columns = [series_col, lottr_col, tttr_col, freeflow_col]
    else:  # "tmc"
        tmc_src = next(c for c in base_state["externalSource"]["columns"]
                       if c.get("name") == "tmc" and c.get("source_id") == 583)
        tmc_col = {**tmc_src, "show": True, "target": "categorize", "group": True}
        columns = [lottr_col, tttr_col, freeflow_col, tmc_col]

    existing = templates.get(name)
    if existing is not None:
        existing_state = json.loads(existing["data"]["stateJson"])
        if any(c.get("name") == freeflow_col["name"]
               for c in existing_state.get("columns", [])):
            return templates  # already upgraded
        existing_state["columns"] = columns
        new_data = {**existing["data"], "stateJson": json.dumps(existing_state),
                    "updatedAt": now_iso()}
        if dry_run:
            print(f"[dry-run] would add freeflow column to template '{name}'")
        else:
            dms(["raw", "update", str(existing["id"])], data=new_data)
            print(f"updated template '{name}' id={existing['id']} "
                  f"(added freeflow column)")
        templates[name] = {"id": existing["id"], "data": new_data}
        return templates

    state = {
        "externalSource": base_state["externalSource"],
        "columns": columns,
        "filters": base_state.get("filters") or {"op": "AND", "groups": []},
        "display": {
            "usePagination": True, "pageSize": 50, "hideExternalToggle": True,
            "title": {"title": INFO_BOX_TITLES[grain].format(
                year=year, bin=RELIABILITY_BIN_LABELS[bin_])},
            "showAttribution": True, "fetchMode": "force",
            "_functions": base_state["display"]["_functions"],
        },
        "join": {"sources": {"pm3": {
            "pgFederated": {"pgEnv": "npmrds2", "table": f"s1410_v{view_id}_pm_3",
                            "schema": "gis_datasets"},
            "joinColumns": [{"dsColumn": "tmc", "joinSourceColumn": "tmc"}],
            "mergeStrategy": "join", "type": "left",
        }}},
        "customBuckets": base_state.get("customBuckets"),
        "comparisonSeries": base_state.get("comparisonSeries"),
    }

    if dry_run:
        print(f"[dry-run] would create template '{name}'")
        templates[name] = {"id": None, "data": {"name": name,
                           "stateJson": json.dumps(state),
                           "elementType": "Spreadsheet",
                           "updatedAt": now_iso()}}
        return templates
    data = {
        "name": name, "slug": name,
        "stateJson": json.dumps(state),
        "layoutJson": base["data"].get("layoutJson"),
        "elementType": "Spreadsheet", "componentType": "Spreadsheet",
        "includesLayout": base["data"].get("includesLayout", False),
        "includesSource": base["data"].get("includesSource", True),
        "createdAt": now_iso(), "createdBy": base["data"].get("createdBy"),
        "updatedAt": now_iso(), "updatedBy": base["data"].get("updatedBy"),
    }
    r = dms(["raw", "create", "npmrdsv5", GRAPH_TEMPLATE_TYPE], data=data)
    templates[name] = {"id": r["id"], "data": data}
    print(f"created template '{name}' id={r['id']}")
    return templates


def ensure_info_box_traveltime_template(grain, templates, dry_run):
    """Mint (or reuse) `{grain}_info_box_traveltime` — a Spreadsheet template
    for Route/TMC Info Box's `avgTT-byDateRange` measure (round 38, Phase B
    item (c)). No pm3 join, no per-report year/bin resolution — see
    INFO_BOX_TRAVELTIME_BUCKET above for why (no 1410 column backs it, and
    old RouteInfoBox.jsx never gated travel time on a bin either). Same
    TRAVEL_TIME_EXPR already live-verified for Bar Graph Summary/Route Bar
    Graph, `fn: "exempt"` (self-aggregating). Same grain split as
    ensure_pm3_join_template: "route" groups by the comparisonSeries
    `__series` discriminator (one row per route), "tmc" by a plain `tmc`
    column — only "route" has real corpus instances this round, but the
    split costs nothing extra since the structure already carries it.

    `avgtt_col`'s `formatFn`/`customName` DO drift-check (round 58) — the
    expression itself doesn't (that's TRAVEL_TIME_EXPR's own shared drift
    detection), but this column's display treatment can still change
    independently, as it did round 58 (raw decimal minutes -> `minutes_clock`,
    the same M:SS format the old tool's `toMinutesWithSeconds` applies to
    every "Minutes"-labeled measure, not just this one)."""
    name = f"{grain}_info_box_traveltime"
    avgtt_col = {"type": "calculated", "show": True,
                 "name": TRAVEL_TIME_EXPR, "fn": "exempt",
                 "formatFn": "minutes_clock", "customName": "Travel Time"}
    avgtt_idx = 1 if grain == "route" else 0

    existing = templates.get(name)
    if existing is not None:
        existing_state = json.loads(existing["data"]["stateJson"])
        existing_cols = existing_state.get("columns") or []
        if len(existing_cols) == 2 and existing_cols[avgtt_idx] == avgtt_col:
            return templates  # no drift
        new_cols = list(existing_cols)
        new_cols[avgtt_idx] = avgtt_col
        existing_state["columns"] = new_cols
        new_data = {**existing["data"], "stateJson": json.dumps(existing_state),
                    "updatedAt": now_iso()}
        if dry_run:
            print(f"[dry-run] would update drifted template '{name}' "
                  f"id={existing['id']} (formatFn/customName drift)")
        else:
            dms(["raw", "update", str(existing["id"])], data=new_data)
            print(f"updated template '{name}' id={existing['id']} "
                  f"(formatFn/customName drift fix)")
        templates[name] = {"id": existing["id"], "data": new_data}
        return templates

    base = templates.get(TEMPLATE_BASE_NAME)
    if not base:
        raise RuntimeError(f"base template '{TEMPLATE_BASE_NAME}' not found")
    base_state = json.loads(base["data"]["stateJson"])

    if grain == "route":
        series_col = next(c for c in base_state["columns"]
                          if c.get("name") == "__series")
        columns = [series_col, avgtt_col]
    else:  # "tmc"
        tmc_src = next(c for c in base_state["externalSource"]["columns"]
                       if c.get("name") == "tmc" and c.get("source_id") == 583)
        tmc_col = {**tmc_src, "show": True, "target": "categorize", "group": True}
        columns = [avgtt_col, tmc_col]

    state = {
        "externalSource": base_state["externalSource"],
        "columns": columns,
        "filters": base_state.get("filters") or {"op": "AND", "groups": []},
        "display": {
            "usePagination": True, "pageSize": 50, "hideExternalToggle": True,
            "title": {"title": INFO_BOX_TRAVELTIME_TITLES[grain]},
            "showAttribution": True, "fetchMode": "force",
            "_functions": base_state["display"]["_functions"],
        },
        # Carry the base's own default join (TMC Identification, 455/3464)
        # forward even though TRAVEL_TIME_EXPR never references table1 — a
        # joinless query never aliases the base table as `ds` at all
        # (dms-server clickhouse.js's `hasJoin ? ' as ds ' : ''`), so without
        # this every `ds.`-qualified expression 500s with "Unknown expression
        # identifier 'ds.tmc'" (caught live on report 58's first attempt).
        # Every other template gets this for free via a full deep-copy of
        # base_state; this function builds state from scratch, so it must be
        # carried over explicitly.
        "join": base_state.get("join"),
        "customBuckets": base_state.get("customBuckets"),
        "comparisonSeries": base_state.get("comparisonSeries"),
    }

    if dry_run:
        print(f"[dry-run] would create template '{name}'")
        templates[name] = {"id": None, "data": {"name": name,
                           "stateJson": json.dumps(state),
                           "elementType": "Spreadsheet",
                           "updatedAt": now_iso()}}
        return templates
    data = {
        "name": name, "slug": name,
        "stateJson": json.dumps(state),
        "layoutJson": base["data"].get("layoutJson"),
        "elementType": "Spreadsheet", "componentType": "Spreadsheet",
        "includesLayout": base["data"].get("includesLayout", False),
        "includesSource": base["data"].get("includesSource", True),
        "createdAt": now_iso(), "createdBy": base["data"].get("createdBy"),
        "updatedAt": now_iso(), "updatedBy": base["data"].get("updatedBy"),
    }
    r = dms(["raw", "create", "npmrdsv5", GRAPH_TEMPLATE_TYPE], data=data)
    templates[name] = {"id": r["id"], "data": data}
    print(f"created template '{name}' id={r['id']}")
    return templates


def _ensure_static_info_box_template(name, grain, route_expr, tmc_expr, titles,
                                      templates, dry_run):
    """Shared shape for the round-40 static (no year/bin/pm3 dependency)
    Info Box templates — `length`/`aadt`, both single-column TMC-attribute
    reads off the base template's own default join (TMC Identification,
    455/3464), which already carries `miles`/`aadt`. Route grain groups by
    the comparisonSeries `__series` discriminator with a self-aggregating
    (`fn: "exempt"`) distinct-tmc combinator expression (`route_expr`); TMC
    grain groups by a real `tmc` categorize column with a plain per-tmc
    `fn: "avg"` read of the raw join column (`tmc_expr`) — NOT the route
    expression's combinator: each TMC-grain CH group is already scoped to
    one TMC, so wrapping the (already self-aggregating) combinator in an
    outer `fn: "avg"` is a redundant aggregate nested inside another one,
    which ClickHouse rejects outright (`ILLEGAL_AGGREGATION`, live-verified
    2026-07-14 on the `aadt` measure — caught via a real "Error fetching
    data" console error + confirming the exact ClickHouseError in
    dms-server.log, not assumed). `length`/`aadt` are genuinely identical in
    shape (single join-column read, no override/bin/year wrinkle) so this
    one shared builder covers both — unlike ensure_info_box_delay_template
    (different join entirely) or ensure_info_box_traveltime_template
    (pre-dates this helper, has its own join-carryover bug-fix history worth
    keeping self-contained)."""
    if templates.get(name) is not None:
        return templates
    base = templates.get(TEMPLATE_BASE_NAME)
    if not base:
        raise RuntimeError(f"base template '{TEMPLATE_BASE_NAME}' not found")
    base_state = json.loads(base["data"]["stateJson"])

    if grain == "route":
        value_col = {"type": "calculated", "show": True, "name": route_expr, "fn": "exempt"}
        series_col = next(c for c in base_state["columns"]
                          if c.get("name") == "__series")
        columns = [series_col, value_col]
    else:  # "tmc"
        value_col = {"type": "calculated", "show": True, "name": tmc_expr, "fn": "avg"}
        tmc_src = next(c for c in base_state["externalSource"]["columns"]
                       if c.get("name") == "tmc" and c.get("source_id") == 583)
        tmc_col = {**tmc_src, "show": True, "target": "categorize", "group": True}
        columns = [value_col, tmc_col]

    state = {
        "externalSource": base_state["externalSource"],
        "columns": columns,
        "filters": base_state.get("filters") or {"op": "AND", "groups": []},
        "display": {
            "usePagination": True, "pageSize": 50, "hideExternalToggle": True,
            "title": {"title": titles[grain]},
            "showAttribution": True, "fetchMode": "force",
            "_functions": base_state["display"]["_functions"],
        },
        "join": base_state.get("join"),
        "customBuckets": base_state.get("customBuckets"),
        "comparisonSeries": base_state.get("comparisonSeries"),
    }

    if dry_run:
        print(f"[dry-run] would create template '{name}'")
        templates[name] = {"id": None, "data": {"name": name,
                           "stateJson": json.dumps(state),
                           "elementType": "Spreadsheet",
                           "updatedAt": now_iso()}}
        return templates
    data = {
        "name": name, "slug": name,
        "stateJson": json.dumps(state),
        "layoutJson": base["data"].get("layoutJson"),
        "elementType": "Spreadsheet", "componentType": "Spreadsheet",
        "includesLayout": base["data"].get("includesLayout", False),
        "includesSource": base["data"].get("includesSource", True),
        "createdAt": now_iso(), "createdBy": base["data"].get("createdBy"),
        "updatedAt": now_iso(), "updatedBy": base["data"].get("updatedBy"),
    }
    r = dms(["raw", "create", "npmrdsv5", GRAPH_TEMPLATE_TYPE], data=data)
    templates[name] = {"id": r["id"], "data": data}
    print(f"created template '{name}' id={r['id']}")
    return templates


def ensure_info_box_length_template(grain, templates, dry_run):
    """Mint (or reuse) `{grain}_info_box_length` — round 40, see
    INFO_BOX_LENGTH_BUCKET/LENGTH_EXPR above."""
    return _ensure_static_info_box_template(
        f"{grain}_info_box_length", grain, LENGTH_EXPR, LENGTH_TMC_EXPR,
        INFO_BOX_LENGTH_TITLES, templates, dry_run)


def ensure_info_box_aadt_template(grain, templates, dry_run):
    """Mint (or reuse) `{grain}_info_box_aadt` — round 40, see
    INFO_BOX_AADT_BUCKET/AADT_EXPR above."""
    return _ensure_static_info_box_template(
        f"{grain}_info_box_aadt", grain, AADT_EXPR, AADT_TMC_EXPR,
        INFO_BOX_AADT_TITLES, templates, dry_run)


def ensure_info_box_delay_template(grain, templates, dry_run):
    """Mint (or reuse) `{grain}_info_box_delay` — round 40, see
    INFO_BOX_DELAY_BUCKET above. Unlike length/aadt, needs the full
    META_JOIN + AADT_DIST_JOIN pair (DELAY_EXPR reads
    `table1.avg_speedlimit`/`faciltype`, absent from the base template's own
    default join) and `fn: "sum"` (DELAY_EXPR is a per-epoch raw quantity,
    not self-aggregating like TRAVEL_TIME_EXPR/SPEED_EXPR)."""
    name = f"{grain}_info_box_delay"
    delay_col = {"type": "calculated", "show": True, "name": DELAY_EXPR,
                 "fn": "sum", "customName": "Hours of Delay"}
    delay_idx = 1 if grain == "route" else 0
    expected_join = {"sources": {"table1": META_JOIN, "table2": AADT_DIST_JOIN}}

    existing = templates.get(name)
    if existing is not None:
        # Round 59: this function used to short-circuit unconditionally on
        # any existing row (same latent gap round 38 found and fixed for
        # ensure_info_box_traveltime_template) — since DELAY_EXPR's own
        # expression text AND its META_JOIN can each drift independently of
        # each other, both need checking, or a join-source swap like this
        # round's silently never reaches an already-built delay Info Box.
        existing_state = json.loads(existing["data"]["stateJson"])
        existing_cols = existing_state.get("columns") or []
        col_drift = not (len(existing_cols) == 2
                         and existing_cols[delay_idx] == delay_col)
        join_drift = existing_state.get("join") != expected_join
        if not (col_drift or join_drift):
            return templates  # no drift
        new_cols = list(existing_cols)
        if col_drift:
            new_cols[delay_idx] = delay_col
            existing_state["columns"] = new_cols
        if join_drift:
            existing_state["join"] = json.loads(json.dumps(expected_join))
        new_data = {**existing["data"], "stateJson": json.dumps(existing_state),
                    "updatedAt": now_iso()}
        note = ", ".join(k for k, fired in
                        (("column", col_drift), ("join", join_drift)) if fired)
        if dry_run:
            print(f"[dry-run] would update drifted template '{name}' "
                  f"id={existing['id']} ({note} changed)")
        else:
            dms(["raw", "update", str(existing["id"])], data=new_data)
            print(f"updated template '{name}' id={existing['id']} "
                  f"({note} drift fix)")
        templates[name] = {"id": existing["id"], "data": new_data}
        return templates

    base = templates.get(TEMPLATE_BASE_NAME)
    if not base:
        raise RuntimeError(f"base template '{TEMPLATE_BASE_NAME}' not found")
    base_state = json.loads(base["data"]["stateJson"])

    if grain == "route":
        series_col = next(c for c in base_state["columns"]
                          if c.get("name") == "__series")
        columns = [series_col, delay_col]
    else:  # "tmc"
        tmc_src = next(c for c in base_state["externalSource"]["columns"]
                       if c.get("name") == "tmc" and c.get("source_id") == 583)
        tmc_col = {**tmc_src, "show": True, "target": "categorize", "group": True}
        columns = [delay_col, tmc_col]

    state = {
        "externalSource": base_state["externalSource"],
        "columns": columns,
        "filters": base_state.get("filters") or {"op": "AND", "groups": []},
        "display": {
            "usePagination": True, "pageSize": 50, "hideExternalToggle": True,
            "title": {"title": INFO_BOX_DELAY_TITLES[grain]},
            "showAttribution": True, "fetchMode": "force",
            "_functions": base_state["display"]["_functions"],
        },
        "join": expected_join,
        "customBuckets": base_state.get("customBuckets"),
        "comparisonSeries": base_state.get("comparisonSeries"),
    }

    if dry_run:
        print(f"[dry-run] would create template '{name}'")
        templates[name] = {"id": None, "data": {"name": name,
                           "stateJson": json.dumps(state),
                           "elementType": "Spreadsheet",
                           "updatedAt": now_iso()}}
        return templates
    data = {
        "name": name, "slug": name,
        "stateJson": json.dumps(state),
        "layoutJson": base["data"].get("layoutJson"),
        "elementType": "Spreadsheet", "componentType": "Spreadsheet",
        "includesLayout": base["data"].get("includesLayout", False),
        "includesSource": base["data"].get("includesSource", True),
        "createdAt": now_iso(), "createdBy": base["data"].get("createdBy"),
        "updatedAt": now_iso(), "updatedBy": base["data"].get("updatedBy"),
    }
    r = dms(["raw", "create", "npmrdsv5", GRAPH_TEMPLATE_TYPE], data=data)
    templates[name] = {"id": r["id"], "data": data}
    print(f"created template '{name}' id={r['id']}")
    return templates


def ensure_bar_graph_summary_pm3_template(year, templates, dry_run):
    """Mint (or reuse) `tmc_freeflow_summary_bar_graph_{year}` — Bar Graph
    Summary's `freeflow-byDateRange` measure (round 38, Phase B item (c)),
    one bar per route/comp via pm3's `speed_pctl_85` (same column Info Box's
    freeflow already uses, round 22's "current/correct pm3 value, not
    old-math replica" precedent — round 17 — extended here even though the
    old tool's own BarGraphSummary.jsx used a plain per-TMC speed mean for
    this key, not a percentile). Bin-independent (1410's speed percentiles
    have no time-of-day dimension) so only `year` needs resolving, same
    idiom as ensure_pm3_join_template but Bar-Graph-shaped (`xAxis:
    "__series"`, one calculated yAxis column) instead of a Spreadsheet."""
    name = f"tmc_freeflow_summary_bar_graph_{year}"
    if templates.get(name) is not None:
        return templates  # static per year — nothing further to drift-check
    base = templates.get(TEMPLATE_BASE_NAME)
    if not base:
        raise RuntimeError(f"base template '{TEMPLATE_BASE_NAME}' not found")
    base_state = json.loads(base["data"]["stateJson"])
    view_id = PM3_VIEW_BY_YEAR[year]

    series_col = next(c for c in base_state["columns"]
                      if c.get("name") == "__series")
    x_col = {**series_col, "target": "xAxis"}
    freeflow_col = {"type": "calculated", "show": True,
                    "name": "pm3.speed_pctl_85 as freeflow", "target": "yAxis",
                    "fn": "avg", "customName": "Freeflow (mph)"}

    state = {
        "externalSource": base_state["externalSource"],
        "columns": [freeflow_col, x_col],
        "filters": base_state.get("filters") or {"op": "AND", "groups": []},
        "display": {**base_state.get("display", {}), "graphType": "BarGraph",
                    "legend": {"show": False}},
        "join": {"sources": {"pm3": {
            "pgFederated": {"pgEnv": "npmrds2", "table": f"s1410_v{view_id}_pm_3",
                            "schema": "gis_datasets"},
            "joinColumns": [{"dsColumn": "tmc", "joinSourceColumn": "tmc"}],
            "mergeStrategy": "join", "type": "left",
        }}},
        "customBuckets": base_state.get("customBuckets"),
        "comparisonSeries": base_state.get("comparisonSeries"),
    }

    if dry_run:
        print(f"[dry-run] would create template '{name}'")
        templates[name] = {"id": None, "data": {"name": name,
                           "stateJson": json.dumps(state),
                           "elementType": "AVL Graph",
                           "updatedAt": now_iso()}}
        return templates
    data = {
        "name": name, "slug": name,
        "stateJson": json.dumps(state),
        "layoutJson": base["data"].get("layoutJson"),
        "elementType": "AVL Graph", "componentType": "AVL Graph",
        "includesLayout": base["data"].get("includesLayout", False),
        "includesSource": base["data"].get("includesSource", True),
        "createdAt": now_iso(), "createdBy": base["data"].get("createdBy"),
        "updatedAt": now_iso(), "updatedBy": base["data"].get("updatedBy"),
    }
    r = dms(["raw", "create", "npmrdsv5", GRAPH_TEMPLATE_TYPE], data=data)
    templates[name] = {"id": r["id"], "data": data}
    print(f"created template '{name}' id={r['id']}")
    return templates


def ensure_route_compare_template(measure, templates, dry_run):
    """Mint (or reuse) a SHARED, generic Route Compare Component Spreadsheet
    template for `measure` — one row per assigned comp via the same __series
    fan-out Route Info Box already uses (round 18), plus a delta column
    showing each row's %-difference from the ANCHOR (whichever comp is first
    in the page's own route list — dms-server's __ANCHOR__(<expr>) mechanism,
    see utils.js/query_sets/clickhouse.js, resolves this dynamically per
    request from seriesVariants[0], the same way comparisonSeries already
    resolves every other route dynamically from the page's own route list).

    Unlike ensure_pm3_join_template, this does NOT mint one template per
    report/graph: nothing report-specific is baked into the SQL (no base
    route, no literal label) — the anchor is resolved live from whichever
    route the page's author currently has first in their list, exactly
    mirroring the old tool's own "first selected route is Main" convention.
    So one template covers every report in this bucket, and stays correct if
    an author later changes which route is the anchor or adds/removes compare
    routes — no re-conversion needed. This is what makes the template usable
    from a future self-service "pick a template, add your routes" authoring
    UI rather than a conversion-pipeline-only artifact.

    Old RouteCompareComponent.jsx (transportNY) renders
    abs((compare-base)/base*100) plus a separate up/down arrow; here the
    `delta` column type's own arrow/color derive from the SIGNED value
    directly (DeltaView: arrow follows the value's own sign), so the raw
    (non-abs) diff is used instead — same information, a signed number
    instead of abs value + separate arrow glyph."""
    raw_expr, alias = MEASURE_EXPR[measure].rsplit(" as ", 1)
    name = f"route_compare_{measure}"
    existing = templates.get(name)
    # Round 35: MEASURE_EXPR entries are now SELF-AGGREGATING (the two-level
    # map-combinator route expressions, fn "exempt") — no avg() wrapping
    # anywhere in this template (avg(<aggregate>) is invalid SQL). The
    # whole-range single value per arm this component wants is exactly what
    # the expression computes — and it is now the old tool's real
    # route-level semantics (round 34's ground truth), not the
    # per-row-average approximation rounds 25-34 rendered. customName keeps
    # the ~200-char expression out of the table header (TableHeaderCell
    # falls back to the column's full name otherwise — same label-fallback
    # class as round 34's summary legend squeeze).
    value_col = {"type": "calculated", "show": True,
                 "name": f"{raw_expr} as {alias}", "fn": "exempt",
                 "customName": MEASURE_NAMES.get(measure, measure)}
    agg_expr = raw_expr
    anchor = f"__ANCHOR__({agg_expr})"
    delta_col = {
        "type": "delta", "display": "calculated", "show": True,
        "deltaGoodDirection": GOOD_DIRECTION_BY_MEASURE.get(measure, "up"),
        # fn: "exempt" ("already aggregated server-side", see graph_new/
        # components/utils.js's AggFuncs comment) — without it, getData.js's
        # groupNoFnCondition heuristic (every non-grouped column needs a
        # truthy .fn) treats this column as if it needed wrapping, marks the
        # whole section invalidState, and the row-data fetch never fires
        # (found live-verifying this section: __series/length loaded fine,
        # the actual data request silently never went out). "exempt" is a
        # real author-facing fn option (Spreadsheet/graph_new/graph/Card
        # column-fn dropdowns) whose SQL passthrough behavior in applyFn is
        # identical to leaving fn unset — it only changes this count.
        "fn": "exempt",
        # round(...) matters beyond cosmetics: the anchor's own row computes
        # the aggregate expression twice — once inline, once inside
        # __ANCHOR__'s subquery — and ClickHouse's two evaluations aren't
        # bit-identical, leaving a ~1e-14 floating-point residual instead of
        # exact 0. DeltaView's neutral/gray "no change" state
        # (ui/columnTypes/delta.jsx) is a strict `n === 0` check, so that
        # residual fell through to the colored arrow branch — flipping
        # red/green at random (whichever way the noise happened to round)
        # and making the anchor row impossible to visually distinguish
        # (found live, 2026-07-10). Rounding to 2 decimals is far coarser
        # than the noise floor, so the anchor always comes back as a clean,
        # exact 0.
        "name": f"round(({agg_expr} - {anchor}) / {anchor} * 100, 2) as {alias}_delta",
        "customName": "% vs Main",
    }
    if existing is not None:
        # Round 35 drift detection — same update-in-place idiom as
        # ensure_graph_templates. This function used to mint once and return
        # early, so a live route_compare_* row silently went stale whenever
        # MEASURE_EXPR changed (exactly what the round-35 speed/TT backport
        # does). Column 0 is the __series col this function itself minted;
        # only the value/delta columns are spec-derived.
        ex_state = json.loads(existing["data"]["stateJson"])
        ex_cols = ex_state.get("columns") or []
        if len(ex_cols) == 3 and ex_cols[1] == value_col and ex_cols[2] == delta_col:
            return templates  # no drift
        ex_state["columns"] = [ex_cols[0], value_col, delta_col]
        new_data = {**existing["data"],
                    "stateJson": json.dumps(ex_state),
                    "updatedAt": now_iso()}
        if dry_run:
            print(f"[dry-run] would update drifted template '{name}' "
                  f"id={existing['id']} (value/delta expr changed)")
        else:
            dms(["raw", "update", str(existing["id"])], data=new_data)
            print(f"updated template '{name}' id={existing['id']} "
                  f"(value/delta expr drift fix)")
        templates[name] = {"id": existing["id"], "data": new_data}
        return templates
    base = templates.get(TEMPLATE_BASE_NAME)
    if not base:
        raise RuntimeError(f"base template '{TEMPLATE_BASE_NAME}' not found")
    base_state = json.loads(base["data"]["stateJson"])
    series_col = next(c for c in base_state["columns"]
                      if c.get("name") == "__series")
    columns = [series_col, value_col, delta_col]
    state = {
        "externalSource": base_state["externalSource"],
        "columns": columns,
        "filters": base_state.get("filters") or {"op": "AND", "groups": []},
        "display": {
            "usePagination": True, "pageSize": 50, "hideExternalToggle": True,
            "title": {"title": f"Route Compare, {MEASURE_NAMES.get(measure, measure)}"},
            "showAttribution": True, "fetchMode": "force",
            "_functions": base_state["display"]["_functions"],
        },
        "join": base_state.get("join"),
        "customBuckets": base_state.get("customBuckets"),
        "comparisonSeries": base_state.get("comparisonSeries"),
    }
    if dry_run:
        print(f"[dry-run] would create template '{name}'")
        templates[name] = {"id": None, "data": {"name": name,
                           "stateJson": json.dumps(state),
                           "elementType": "Spreadsheet",
                           "updatedAt": now_iso()}}
        return templates
    data = {
        "name": name, "slug": name,
        "stateJson": json.dumps(state),
        "layoutJson": base["data"].get("layoutJson"),
        "elementType": "Spreadsheet", "componentType": "Spreadsheet",
        "includesLayout": base["data"].get("includesLayout", False),
        "includesSource": base["data"].get("includesSource", True),
        "createdAt": now_iso(), "createdBy": base["data"].get("createdBy"),
        "updatedAt": now_iso(), "updatedBy": base["data"].get("updatedBy"),
    }
    r = dms(["raw", "create", "npmrdsv5", GRAPH_TEMPLATE_TYPE], data=data)
    templates[name] = {"id": r["id"], "data": data}
    print(f"created template '{name}' id={r['id']}")
    return templates


# Per-year TMC geometry tile views (source 582, npmrds2 pgEnv; confirmed live
# 2026-07-14 — see src/dms/documentation/npmrds-data-sources.md "Per-year TMC
# geometry tile views"). The year filter is baked into each view's tile URL;
# the converter picks the report-year view so old-network TMCs render on the
# network they belonged to (round-44 overlap spot-check: 95.6-100%).
GEOMETRY_TILE_VIEWS = {2017: 985, 2018: 1015, 2019: 1027, 2020: 1033,
                       2021: 1035, 2022: 1041, 2023: 1052, 2024: 1232,
                       2025: 1312, 2026: 3058}
# dms-server tile host (implements the symbology join= param; the
# graph.availabs.org avail-falcor tile route does NOT — see
# src/dms/planning/research/references/map-joins.md).
#
# Round 51: this got baked to the wrong host (silently — 204s, no error) THREE
# times in one session because DMS_TILE_HOST has to be remembered on every
# single conversion command, not just the probe command. Auto-detect instead:
# if a local dev dms-server is actually listening, use it (that's where any
# server-side Map-join code under active local development actually lives,
# e.g. the M3 two-source join); otherwise fall back to production. DMS_TILE_HOST
# still wins if set explicitly (CI, or deliberately testing against prod).
# Once the local Map-join work is fully deployed to production, the
# auto-detected local host stops mattering and this can go back to being a
# bare hardcoded default -- not a rush to remove now.
def _resolve_tile_host():
    override = os.environ.get("DMS_TILE_HOST")
    if override:
        return override
    import socket
    try:
        with socket.create_connection(("localhost", 3001), timeout=0.3):
            return "http://localhost:3001"
    except OSError:
        return "https://dmsserver.availabs.org"


TILE_HOST = _resolve_tile_host()
print(f"[convert_old_reports] TILE_HOST resolved to {TILE_HOST}"
      f"{' (auto-detected local dev server)' if TILE_HOST.startswith('http://localhost') and not os.environ.get('DMS_TILE_HOST') else ''}")
# Raw ClickHouse schema.table names for M2's own pooled per-TMC bake query
# (executed directly via dbq.ch, bypassing the DMS query builder entirely —
# NOT the `clickhouse.`-prefixed data_manager.views.table_schema form; that
# prefix is a DMS routing marker getEssentials() strips server-side). See
# documentation/npmrds-data-sources.md's join-source table.
CH_FACT_TABLE = "npmrds.s583_v982_NPMRDS_V6"
CH_TMC_IDENT_TABLE = ("npmrds_raw_tmc_identification."
                      "s455_v3464_NPMRDS_TMC_Identification_V5_V6")
# Physical CH table names for META_JOIN/AADT_DIST_JOIN (see
# documentation/npmrds-data-sources.md's join-source table) -- needed for the
# Map's own raw ground-truth SQL (bake_route_map_delay_paint), same role
# CH_FACT_TABLE/CH_TMC_IDENT_TABLE play for the single-join speed/travelTime
# bake. aadt_distributions' table name is the literal "aadt_distributions",
# NOT the synthetic s{source}_v{view}_{name} pattern the other two use (see
# the doc's "Registering aadt_distributions" note).
# Round 59: swapped from the frozen s1946_v3298_ny_2025_tmc_meta onto the
# year-spanning s582_v983_NPMRDS_V6_tmc_meta (see the META_JOIN comment
# above) -- bake_route_map_delay_paint's own raw SQL join gets the matching
# "AND toYear(ds.date) = table1.year" added at its call site below.
CH_META_TABLE = "npmrds_meta.s582_v983_NPMRDS_V6_tmc_meta"
CH_AADT_DIST_TABLE = "avail.aadt_distributions"


def ensure_route_map_none_template(year, templates, dry_run):
    """Mint (or reuse) `route_map_none_{year}` — a MAP-section template (the
    first non-AVL-Graph template in the registry: elementType "Map") for the
    old "Route Map" graph with measure "none" (geometry-only route overview,
    97 corpus instances). The state is a Map-section element-data payload:

    - ONE symbology with ONE hidden layer flagged `series-template` over the
      year-matched TMC geometry tile view (GEOMETRY_TILE_VIEWS). Sub-layers
      follow the canonical [<lid>_case, <lid>] shape with main paint at [1].
    - display._functions carries the SAME comparison_series subscriber the
      graph templates use ($self + labelKey/valueKey) — ReportRouteList
      discovers the map exactly like a graph (findSelfBoundGraphs is
      element-type-agnostic) and publishes its assigned comps; the Map's
      useComparisonSeriesLayers runtime (library task
      map-comparison-series-layers.md) materializes one line layer per comp,
      filtered to that comp's TMCs, colored by the series palette (per user
      2026-07-14: palette by index, no color plumbing).

    Nothing report-specific is baked in (dates/TMCs arrive via the publish),
    so one template per YEAR covers every report on that network year —
    same shared-template philosophy as ensure_route_compare_template."""
    view_id = GEOMETRY_TILE_VIEWS.get(year)
    if view_id is None:
        raise RuntimeError(f"no geometry tile view for year {year}")
    name = f"route_map_none_{year}"
    lid = f"rm_none_{year}"
    src_id = f"npmrds2_s582_v{view_id}_{lid}"
    tiles_url = (f"{TILE_HOST}/dama-admin/npmrds2/tiles/{view_id}"
                 f"/{{z}}/{{x}}/{{y}}/t.pbf?cols=tmc&filter=year={year}")
    zoom_width = lambda base: ["interpolate", ["linear"], ["zoom"],
                               5, base, 10, base * 2, 14, base * 4]
    template_layer = {
        "id": lid, "name": f"Routes ({year} network)", "type": "line",
        "order": 1, "isVisible": True,
        "series-template": True,
        "series-feature-column": "tmc",
        # the template renders nothing itself (hidden) — keep it out of the
        # legend; materialized layers clear this key (useComparisonSeriesLayers)
        "legend-orientation": "none",
        "view_id": view_id, "source_id": 582,
        "sources": [{"id": src_id, "source": {
            "type": "vector", "tiles": [tiles_url], "format": "pbf"}}],
        "layers": [
            {"id": f"{lid}_case", "type": "line", "source": src_id,
             "source-layer": f"view_{view_id}",
             "paint": {"line-color": "#1e293b", "line-width": zoom_width(1.8)},
             "layout": {"visibility": "none",
                        "line-cap": "round", "line-join": "round"}},
            {"id": lid, "type": "line", "source": src_id,
             "source-layer": f"view_{view_id}",
             "paint": {"line-color": "#6D96AE", "line-width": zoom_width(1.2)},
             "layout": {"visibility": "none",
                        "line-cap": "round", "line-join": "round"}},
        ],
        "filter": {},
    }
    sym_id = f"route_map_none_{year}"
    state = {
        "symbologies": {sym_id: {
            "id": sym_id, "name": "Routes", "isVisible": True,
            "symbology": {"activeLayer": lid, "layers": {lid: template_layer}},
        }},
        "display": {"_functions": {"providers": [], "subscribers": [
            {"functionId": "comparison_series", "enabled": True,
             "paramKey": "$self",
             "args": {"labelKey": "label", "valueKey": "filters"}}]}},
        "height": "2/3",
        "zoomPan": True,
        "blankBaseMap": False,
        "basemapStyle": "Default",
        "hideControls": True,
    }
    existing = templates.get(name)
    if existing is not None:
        # Same drift idiom as every other minter: the template's whole state
        # derives from this function's constants, so any mismatch means the
        # code moved on — update in place, never mint a parallel name.
        ex_state = json.loads(existing["data"]["stateJson"])
        if ex_state == state:
            return templates
        new_data = {**existing["data"], "stateJson": json.dumps(state),
                    "updatedAt": now_iso()}
        if dry_run:
            print(f"[dry-run] would update drifted template '{name}' "
                  f"id={existing['id']}")
        else:
            dms(["raw", "update", str(existing["id"])], data=new_data)
            print(f"updated template '{name}' id={existing['id']} (drift fix)")
        templates[name] = {"id": existing["id"], "data": new_data}
        return templates
    if dry_run:
        print(f"[dry-run] would create template '{name}'")
        templates[name] = {"id": None, "data": {"name": name,
                           "stateJson": json.dumps(state),
                           "elementType": "Map",
                           "updatedAt": now_iso()}}
        return templates
    data = {
        "name": name, "slug": name,
        "stateJson": json.dumps(state),
        "elementType": "Map", "componentType": "Map",
        "includesLayout": False, "includesSource": True,
        "createdAt": now_iso(), "updatedAt": now_iso(),
    }
    r = dms(["raw", "create", "npmrdsv5", GRAPH_TEMPLATE_TYPE], data=data)
    templates[name] = {"id": r["id"], "data": data}
    print(f"created template '{name}' id={r['id']}")
    return templates


# colors.js's "seq1" 5-color ramp — a neutral default when an old report has
# no color_range (or a non-5-length one) of its own; most real reports carry
# a real 5-color color_range already (COLOR_RANGE_GRAPH_TYPES already
# includes Route Map), so this fallback is a defensive minority case.
DEFAULT_SPEED_COLOR_RANGE = ["#f7e76e", "#f3c048", "#ec962a", "#e1631a", "#ce141f"]


def choropleth_paint(column, colors, breaks, show_other="#ccc", max_value=None,
                     legend_orientation="vertical"):
    """Python port of the dms Map section's choroplethPaint()
    (packages/dms/src/patterns/page/components/sections/components/
    ComponentRegistry/map/utils.js) — ported index-arithmetic-for-index-
    arithmetic (not just the intent) so a converter-baked initial paint/
    legend is shaped identically to what the LIVE re-break mechanism (the
    same JS function, wired up this round — see
    map-join-nested-join-forward-and-live-repaint.md) produces on the first
    real filter change: no spurious "different" value for the client's
    paint-diff/legend-diff effects to react to on load. fnumIndex's >1000
    number formatting isn't ported — NPMRDS speed values never approach that
    range, so it would never fire for this measure."""
    if not breaks:
        return None
    paint = ["step", ["to-number", ["get", column]]]
    for i, b in enumerate(breaks):
        paint.append(colors[i])
        paint.append(b)
    paint.append(colors[len(colors) - 1])
    legend = []
    filtered = [d for i, d in enumerate(paint) if i > 2]
    for fi in range(len(filtered)):
        if fi % 2 == 1:
            lo = paint[fi + 2] if fi + 2 < len(paint) else None
            hi = paint[fi + 4] if fi + 4 < len(paint) else max_value
            label = (f"{lo} - {hi}" if legend_orientation == "vertical"
                     else f"{lo}")
            legend.append({"color": paint[fi + 1], "label": label})
    return {"paint": ["case", ["==", ["get", column], None], show_other, paint],
            "legend": legend}


def quantile_breaks(values, num_bins=5):
    """N-1 break boundaries for num_bins quantile bins over a value list —
    matches the old tool's scaleQuantile() semantics (round-41 scope note:
    "per-graph scaleQuantile() over the per-TMC values"). maplibre's `step`
    expression REQUIRES strictly ascending stops — it rejects the WHOLE paint
    property otherwise (live-caught on report 1071, a single-TMC report where
    every quantile position collapses to the same one value: "Input/output
    pairs for 'step' expressions must be arranged with input values in
    strictly ascending order"). Low-variance/degenerate inputs are common
    (single-TMC routes, short date ranges), so nudge any tie up by the
    rounding granularity rather than assume real-world breaks are always
    distinct — keeps the bin COUNT stable instead of silently collapsing it."""
    values = sorted(values)
    n = len(values)
    breaks = []
    for i in range(1, num_bins):
        pos = (n - 1) * i / num_bins
        lo, hi = int(pos), min(int(pos) + 1, n - 1)
        frac = pos - lo
        breaks.append(round(values[lo] + (values[hi] - values[lo]) * frac, 2))
    for i in range(1, len(breaks)):
        if breaks[i] <= breaks[i - 1]:
            breaks[i] = round(breaks[i - 1] + 0.01, 2)
    return breaks


_CH_JOIN_AS_SPLIT_RE = re.compile(r"\s+as\s+", re.IGNORECASE)


def _ch_join_accessor(alias, col):
    """Mirrors buildUdaConfig.js's accessor()/isCalculatedCol() inside
    buildJoinOnClause: a dsColumn/joinSourceColumn containing ' as '
    (case-insensitive) is a CALCULATED expression that already references
    other joined aliases directly in its own body (e.g. DIST_KEY_EXPR's
    `if(table1.f_system < 3, ...) as dist_key`) — use it AS-IS with the
    alias STRIPPED and NO `${alias}.` prefix (prefixing would corrupt the
    expression, e.g. turning `if(...)` into the invalid `ds.if(...)`, real
    bug live-caught 2026-07-15 building avgHoursOfDelay: report 1056/1033's
    Map choropleth silently rendered zero TMCs because this exact corruption
    made the AADT_DIST_JOIN's ON clause syntactically broken). A plain
    column name gets the ordinary `${alias}.${col}` prefix, unchanged."""
    if _CH_JOIN_AS_SPLIT_RE.search(col):
        return _CH_JOIN_AS_SPLIT_RE.split(col)[0].strip()
    return f"{alias}.{col}"


def build_ch_join_wire(sources):
    """Python port of buildUdaConfig.js's `buildJoin({join})` — the client-
    side transform every ordinary AVL-Graph query goes through before a join
    reaches the server, which the Map-layer join pipeline bypasses entirely
    (it sends a raw JSON blob straight through buildJoinParam, never through
    buildUdaConfig.js). Skipping this step crashed the dms-server process
    outright: the server's OWN `buildJoin` (routes/uda/utils.js:600) does
    `join.on.length` with no `on` array present at all when only the
    TEMPLATE_SPECS-style `{sources: {table1: {...}}}` shape is sent —
    uncaught TypeError, not a caught error response (live-caught 2026-07-15
    converting report 1071, crashed nodemon). `sources` is {alias: <the same
    descriptor shape AVL-Graph TEMPLATE_SPECS' "join" already uses, e.g.
    META_JOIN or the base template's own join.sources.table1>}. Handles
    the plain-column AND calculated-dsColumn cases (via `_ch_join_accessor`,
    needed for AADT_DIST_JOIN's computed `dist_key`), non-DMS, non-pgFederated
    — see the real buildJoinSources/buildJoinOnClause (buildUdaConfig.js:
    862-940) for the fuller original (DMS jsonb columns, pgFederated
    passthrough, neither needed by any Map-layer join built so far)."""
    wire_sources, on = {}, []
    for alias, src in sources.items():
        wire_sources[alias] = {"view_id": src.get("view", src.get("view_id")),
                               "env": src.get("env") or (src.get("sourceInfo") or {}).get("env")}
        conditions = [f"{_ch_join_accessor('ds', c['dsColumn'])} = "
                     f"{_ch_join_accessor(alias, c['joinSourceColumn'])}"
                     for c in src.get("joinColumns", [])]
        on.append({"type": src.get("type", "left"),
                  "mergeStrategy": src.get("mergeStrategy", "join"),
                  "table": alias, "on": " AND ".join(conditions)})
    return {"sources": wire_sources, "on": on}


def ensure_route_map_speed_template(year, templates, dry_run):
    """Mint (or reuse) `route_map_speed_{year}` — M2: the CH-joined
    choropleth Map-section template for the old "Route Map" graph's default/
    most-common measure, speed (256 corpus instances / 214 reports / 45
    single-blocker flips per the round-48 census — the single biggest lever
    in the whole corpus). Shares route_map_none's per-year/subscriber/
    series-template shape; the differences are the `data-column` flag (tells
    useComparisonSeriesLayers' materializeSeriesLayer to leave this layer's
    choropleth paint alone instead of overwriting it with a solid series
    color — see map-comparison-series-layers.md) and the `join` block that
    makes the tile a ClickHouse-joined choropleth (tile-join-clickhouse-
    source.md's M1 CH branch + this round's nested-join-forwarding fix, see
    map-join-nested-join-forward-and-live-repaint.md).

    The join's own `query.join` carries the SAME 455/3464 TMC-identification
    join descriptor every AVL-Graph speed/travelTime template already uses
    (deep-copied from the base template's own `join.sources.table1`, per the
    round-38 "carry the default join forward" fact) — SPEED_VALUE_EXPR needs
    `table1.miles`. `query.columns` groups by `ds.tmc` explicitly (not a bare
    `tmc`) to avoid the round-4-class ambiguous-identifier hazard once a join
    is present.

    Paint/legend/color-range here are PLACEHOLDERS (a neutral default ramp
    over generic speed thresholds) — every real conversion overwrites them
    with real per-report quantile breaks over the report's actual
    color_range (see bake_route_map_choropleth_paint), because those are
    per-report data the shared per-year template can't carry — same pattern
    build_graph_section_data already uses to customize color_range/aadt into
    every OTHER cloned template's copy, just Map-shaped instead of
    AVL-Graph-shaped."""
    view_id = GEOMETRY_TILE_VIEWS.get(year)
    if view_id is None:
        raise RuntimeError(f"no geometry tile view for year {year}")
    base = templates.get(TEMPLATE_BASE_NAME)
    if not base:
        raise RuntimeError(f"base template '{TEMPLATE_BASE_NAME}' not found")
    base_state = json.loads(base["data"]["stateJson"])
    table1_join = base_state["join"]["sources"]["table1"]

    name = f"route_map_speed_{year}"
    lid = f"rm_speed_{year}"
    src_id = f"npmrds2_s582_v{view_id}_{lid}"
    tiles_url = (f"{TILE_HOST}/dama-admin/npmrds2/tiles/{view_id}"
                 f"/{{z}}/{{x}}/{{y}}/t.pbf?cols=tmc&filter=year={year}")
    zoom_width = lambda base_w: ["interpolate", ["linear"], ["zoom"],
                                 5, base_w, 10, base_w * 2, 14, base_w * 4]
    placeholder = choropleth_paint("value", DEFAULT_SPEED_COLOR_RANGE,
                                   [15, 30, 45, 60], max_value=80)
    template_layer = {
        "id": lid, "name": f"Speed ({year} network)", "type": "line",
        "order": 1, "isVisible": True,
        "series-template": True,
        "series-feature-column": "tmc",
        # LegendPanel/LegendRow branches on 'layer-type' (not the maplibre
        # 'type' above) to pick StepLegend vs a bare title row — omitting it
        # silently degrades every choropleth Map's "legend" to a layer-name
        # list with no color scale at all (user-reported 2026-07-15; found by
        # tracing LegendRow's type===undefined fallthrough, never live-caught
        # in round 49 because that round's verification checked tile/paint
        # traffic, not the legend panel itself).
        "layer-type": "choropleth",
        "data-column": "value",
        "num-bins": 5, "bin-method": "quantile",
        "color-range": DEFAULT_SPEED_COLOR_RANGE,
        "legend-data": placeholder["legend"],
        # The runtime materializes one visible clone per comparison_series
        # variant (see useComparisonSeriesLayers.js); the template layer
        # itself must stay suppressed or it renders an extra, un-labeled
        # duplicate of the same legend (round 51, user-reported).
        "legend-orientation": "none",
        "view_id": view_id, "source_id": 582,
        "join": {
            "enabled": True, "featureKeyColumn": "tmc", "joinColumn": "tmc",
            "source": {"sourceId": 583, "viewId": 982, "env": "npmrds2"},
            "query": {
                "columns": [SPEED_VALUE_EXPR, "ds.tmc as tmc"],
                "groupBy": ["ds.tmc"],
                "join": build_ch_join_wire({"table1": table1_join}),
                "filters": {}, "filterRows": [], "filterMode": "all",
            },
            "tileColumns": ["value"],
        },
        "sources": [{"id": src_id, "source": {
            "type": "vector", "tiles": [tiles_url], "format": "pbf"}}],
        "layers": [
            {"id": f"{lid}_case", "type": "line", "source": src_id,
             "source-layer": f"view_{view_id}",
             "paint": {"line-color": "#1e293b", "line-width": zoom_width(1.8)},
             "layout": {"visibility": "none",
                        "line-cap": "round", "line-join": "round"}},
            {"id": lid, "type": "line", "source": src_id,
             "source-layer": f"view_{view_id}",
             "paint": {"line-color": placeholder["paint"],
                       "line-width": zoom_width(1.2)},
             "layout": {"visibility": "none",
                        "line-cap": "round", "line-join": "round"}},
        ],
        "filter": {},
    }
    sym_id = name
    state = {
        "symbologies": {sym_id: {
            "id": sym_id, "name": "Speed", "isVisible": True,
            "symbology": {"activeLayer": lid, "layers": {lid: template_layer}},
        }},
        "display": {"_functions": {"providers": [], "subscribers": [
            {"functionId": "comparison_series", "enabled": True,
             "paramKey": "$self",
             "args": {"labelKey": "label", "valueKey": "filters"}}]}},
        "height": "2/3",
        "zoomPan": True,
        "blankBaseMap": False,
        "basemapStyle": "Default",
        "hideControls": True,
    }
    existing = templates.get(name)
    if existing is not None:
        ex_state = json.loads(existing["data"]["stateJson"])
        if ex_state == state:
            return templates
        new_data = {**existing["data"], "stateJson": json.dumps(state),
                    "updatedAt": now_iso()}
        if dry_run:
            print(f"[dry-run] would update drifted template '{name}' "
                  f"id={existing['id']}")
        else:
            dms(["raw", "update", str(existing["id"])], data=new_data)
            print(f"updated template '{name}' id={existing['id']} (drift fix)")
        templates[name] = {"id": existing["id"], "data": new_data}
        return templates
    if dry_run:
        print(f"[dry-run] would create template '{name}'")
        templates[name] = {"id": None, "data": {"name": name,
                           "stateJson": json.dumps(state),
                           "elementType": "Map",
                           "updatedAt": now_iso()}}
        return templates
    data = {
        "name": name, "slug": name,
        "stateJson": json.dumps(state),
        "elementType": "Map", "componentType": "Map",
        "includesLayout": False, "includesSource": True,
        "createdAt": now_iso(), "updatedAt": now_iso(),
    }
    r = dms(["raw", "create", "npmrdsv5", GRAPH_TEMPLATE_TYPE], data=data)
    templates[name] = {"id": r["id"], "data": data}
    print(f"created template '{name}' id={r['id']}")
    return templates


def ensure_route_map_traveltime_template(year, templates, dry_run):
    """Mint (or reuse) `route_map_traveltime_{year}` — M3's "easy" measure
    (per the round-49 M3+ handoff: TRAVEL_TIME_EXPR is the same
    self-aggregating two-level shape as SPEED_EXPR, degrades correctly under
    a bare `GROUP BY ds.tmc`, and needs only the SAME single 455/3464
    TMC-identification join `ensure_route_map_speed_template` already
    carries forward from the base template — so this is a literal
    copy-adapt of that function: swap the value expression, name, and ids,
    nothing else differs structurally). Paint/legend/color-range are
    PLACEHOLDERS overwritten per-report by bake_route_map_choropleth_paint,
    same as speed."""
    view_id = GEOMETRY_TILE_VIEWS.get(year)
    if view_id is None:
        raise RuntimeError(f"no geometry tile view for year {year}")
    base = templates.get(TEMPLATE_BASE_NAME)
    if not base:
        raise RuntimeError(f"base template '{TEMPLATE_BASE_NAME}' not found")
    base_state = json.loads(base["data"]["stateJson"])
    table1_join = base_state["join"]["sources"]["table1"]

    # Template/layer ids embed the measure string VERBATIM ("travelTime", not
    # "traveltime") to match census_old_reports.py's generic
    # f"route_map_{info['measure']}_{year}" mirror formula -- "speed"/"none"
    # happen to be all-lowercase already so this case-matching requirement
    # was invisible until a camelCase measure (this one) came along.
    name = f"route_map_travelTime_{year}"
    lid = f"rm_travelTime_{year}"
    src_id = f"npmrds2_s582_v{view_id}_{lid}"
    tiles_url = (f"{TILE_HOST}/dama-admin/npmrds2/tiles/{view_id}"
                 f"/{{z}}/{{x}}/{{y}}/t.pbf?cols=tmc&filter=year={year}")
    zoom_width = lambda base_w: ["interpolate", ["linear"], ["zoom"],
                                 5, base_w, 10, base_w * 2, 14, base_w * 4]
    # Placeholder breaks in MINUTES (route-traversal travel time), unlike
    # speed's mph breaks — real per-report breaks (bake_route_map_choropleth_
    # paint) overwrite these immediately on any real conversion. travelTime is
    # a reverseColors:true measure (see REVERSE_COLORS_MEASURES) --
    # low/good values should render at the GREEN end, so the placeholder ramp
    # itself is reversed relative to speed's (unreversed) default.
    traveltime_default_colors = list(reversed(DEFAULT_SPEED_COLOR_RANGE))
    placeholder = choropleth_paint("value", traveltime_default_colors,
                                   [3, 7, 15, 30], max_value=45)
    template_layer = {
        "id": lid, "name": f"Travel Time ({year} network)", "type": "line",
        "order": 1, "isVisible": True,
        "series-template": True,
        "series-feature-column": "tmc",
        "layer-type": "choropleth",
        "data-column": "value",
        "num-bins": 5, "bin-method": "quantile",
        "color-range": traveltime_default_colors,
        "legend-data": placeholder["legend"],
        # The runtime materializes one visible clone per comparison_series
        # variant (see useComparisonSeriesLayers.js); the template layer
        # itself must stay suppressed or it renders an extra, un-labeled
        # duplicate of the same legend (round 51, user-reported).
        "legend-orientation": "none",
        "view_id": view_id, "source_id": 582,
        "join": {
            "enabled": True, "featureKeyColumn": "tmc", "joinColumn": "tmc",
            "source": {"sourceId": 583, "viewId": 982, "env": "npmrds2"},
            "query": {
                "columns": [TRAVEL_TIME_VALUE_EXPR, "ds.tmc as tmc"],
                "groupBy": ["ds.tmc"],
                "join": build_ch_join_wire({"table1": table1_join}),
                "filters": {}, "filterRows": [], "filterMode": "all",
            },
            "tileColumns": ["value"],
        },
        "sources": [{"id": src_id, "source": {
            "type": "vector", "tiles": [tiles_url], "format": "pbf"}}],
        "layers": [
            {"id": f"{lid}_case", "type": "line", "source": src_id,
             "source-layer": f"view_{view_id}",
             "paint": {"line-color": "#1e293b", "line-width": zoom_width(1.8)},
             "layout": {"visibility": "none",
                        "line-cap": "round", "line-join": "round"}},
            {"id": lid, "type": "line", "source": src_id,
             "source-layer": f"view_{view_id}",
             "paint": {"line-color": placeholder["paint"],
                       "line-width": zoom_width(1.2)},
             "layout": {"visibility": "none",
                        "line-cap": "round", "line-join": "round"}},
        ],
        "filter": {},
    }
    sym_id = name
    state = {
        "symbologies": {sym_id: {
            "id": sym_id, "name": "Travel Time", "isVisible": True,
            "symbology": {"activeLayer": lid, "layers": {lid: template_layer}},
        }},
        "display": {"_functions": {"providers": [], "subscribers": [
            {"functionId": "comparison_series", "enabled": True,
             "paramKey": "$self",
             "args": {"labelKey": "label", "valueKey": "filters"}}]}},
        "height": "2/3",
        "zoomPan": True,
        "blankBaseMap": False,
        "basemapStyle": "Default",
        "hideControls": True,
    }
    existing = templates.get(name)
    if existing is not None:
        ex_state = json.loads(existing["data"]["stateJson"])
        if ex_state == state:
            return templates
        new_data = {**existing["data"], "stateJson": json.dumps(state),
                    "updatedAt": now_iso()}
        if dry_run:
            print(f"[dry-run] would update drifted template '{name}' "
                  f"id={existing['id']}")
        else:
            dms(["raw", "update", str(existing["id"])], data=new_data)
            print(f"updated template '{name}' id={existing['id']} (drift fix)")
        templates[name] = {"id": existing["id"], "data": new_data}
        return templates
    if dry_run:
        print(f"[dry-run] would create template '{name}'")
        templates[name] = {"id": None, "data": {"name": name,
                           "stateJson": json.dumps(state),
                           "elementType": "Map",
                           "updatedAt": now_iso()}}
        return templates
    data = {
        "name": name, "slug": name,
        "stateJson": json.dumps(state),
        "elementType": "Map", "componentType": "Map",
        "includesLayout": False, "includesSource": True,
        "createdAt": now_iso(), "updatedAt": now_iso(),
    }
    r = dms(["raw", "create", "npmrdsv5", GRAPH_TEMPLATE_TYPE], data=data)
    templates[name] = {"id": r["id"], "data": data}
    print(f"created template '{name}' id={r['id']}")
    return templates


# Route Map choropleth measures whose CH query is a SINGLE join against
# CH_TMC_IDENT_TABLE (speed, travelTime — both self-aggregating, both
# degrade correctly under a bare GROUP BY ds.tmc). hoursOfDelay needs a
# different two-source join (META_JOIN + AADT_DIST_JOIN) and its own
# bake function — not folded in here, see the M3+ handoff notes in
# route_map_scope.md ("the FROM/JOIN clause itself differs, not just the
# SELECTed expression").
ROUTE_MAP_VALUE_EXPR = {"speed": SPEED_VALUE_EXPR, "travelTime": TRAVEL_TIME_VALUE_EXPR}
# Old dataTypes.js's per-measure `reverseColors` flag, GENERALIZED (round 51 —
# user-reported "many color scales are backwards ... other components [besides
# Map] have this issue still", confirmed live on report 1069's TMC Grid Graph:
# its color_range array was wired verbatim with no reversal, so short/good
# travel times rendered red and long/bad ones rendered green). Originally
# scoped Map-only as ROUTE_MAP_REVERSE_COLORS_MEASURES (speed: false,
# travelTime/hoursOfDelay/avgHoursOfDelay: true) after the M3 round found
# GeneralGraphComp.getColorRange() reverses the report's raw color_range array
# BEFORE it ever reaches ANY old graph component's own renderGraph() -- not
# just RouteMap.jsx, every old graph type (RouteBarGraph/TmcGridGraph/
# RouteDifferenceGraph/TmcDifferenceGrid) inherits the same reversal from the
# same shared base class. So the fix belongs at the generic
# COLOR_RANGE_GRAPH_TYPES wiring level (build_graph_section_data), not just
# Map's bake functions. Full set below is read directly off old dataTypes.js's
# BASE_DATA_TYPES/INDICES/INDICES_BY_DATE_RANGE reverseColors flags (speed/
# freeflow/dataQuality: false -- the only false-flagged measures -- everything
# else defaults true); the indices/byDateRange entries aren't reachable by any
# template built yet (M4 territory) but are included so this stays correct
# once they are.
REVERSE_COLORS_MEASURES = {
    "travelTime", "hoursOfDelay", "avgHoursOfDelay",
    "co2Emissions", "avgCo2Emissions",
    "avgTT", "percentile95", "percentile97",
    "bufferTime", "planningTime", "miseryIndex", "travelTimeIndex",
    "avgTT-byDateRange", "percentile95-byDateRange", "percentile97-byDateRange",
    "bufferTime-byDateRange", "planningTime-byDateRange",
    "miseryIndex-byDateRange", "travelTimeIndex-byDateRange",
}


def bake_route_map_choropleth_paint(state, info, route_map_value_ctx, color_range,
                                    gaps, old_graph, measure):
    """Per-report choropleth bake for a Route-Map Map-section clone whose
    series-template layer carries a single-source CH `join` against
    CH_TMC_IDENT_TABLE (speed M2, travelTime M3 -- `measure` picks the SELECT
    expression via ROUTE_MAP_VALUE_EXPR, everything else about the query
    shape is identical between them). Breaks/colors are per-report data
    (this report's actual routes' value distribution, this report's own
    color_range) the shared per-year template can't carry, so they're baked
    into THIS clone the same way build_graph_section_data already customizes
    color_range/aadt into every other cloned template's copy -- Map-shaped
    instead of AVL-Graph-shaped (Map has no `display.colors`; the paint
    itself IS the color).

    Pools per-TMC values across every comp assigned to THIS graph (one CH
    query, same infra as every other ground-truthing query in this script) —
    mirrors old RouteMap.jsx's own per-graph scaleQuantile() semantics
    (round-41 scope note), not a per-comp break set."""
    comps_by_id = route_map_value_ctx["comps_by_id"]
    old_routes = route_map_value_ctx["old_routes"]
    resolved_tmcs = route_map_value_ctx["resolved_tmcs"]

    tmcs = set()
    starts, ends = [], []
    for cid in info["assigned"]:
        rc = comps_by_id.get(cid)
        if not rc:
            continue
        rid = str(rc.get("routeId"))
        old_route = old_routes.get(rid)
        comp_tmcs = resolved_tmcs.get(cid) or (old_route or {}).get("tmc_array") or []
        tmcs.update(comp_tmcs)
        s = rc.get("settings") or {}
        if s.get("startDate"):
            starts.append(str(s["startDate"])[:8])
        if s.get("endDate"):
            ends.append(str(s["endDate"])[:8])

    if not tmcs or not starts or not ends:
        gaps.append({"kind": f"route_map_{measure}_no_values", "graph": old_graph.get("id"),
                     "detail": "no resolvable TMCs/date range across this graph's "
                               "assigned comps — choropleth left unbaked "
                               "(template placeholder default renders)"})
        return

    start_fmt = "-".join([min(starts)[:4], min(starts)[4:6], min(starts)[6:8]])
    end_fmt = "-".join([max(ends)[:4], max(ends)[4:6], max(ends)[6:8]])
    tmc_list = ",".join(f"'{t}'" for t in sorted(tmcs))
    value_expr = ROUTE_MAP_VALUE_EXPR[measure]
    sql = (f"SELECT ds.tmc AS tmc, {value_expr} "
           f"FROM {CH_FACT_TABLE} AS ds "
           f"JOIN {CH_TMC_IDENT_TABLE} AS table1 ON ds.tmc = table1.tmc "
           f"WHERE ds.tmc IN ({tmc_list}) "
           f"AND ds.date >= '{start_fmt}' AND ds.date <= '{end_fmt}' "
           f"GROUP BY ds.tmc")
    result = dbq.ch(sql)
    rows = result.get("data") or []
    values = [r[1] for r in rows if r[1] is not None]
    if not values:
        gaps.append({"kind": f"route_map_{measure}_no_values", "graph": old_graph.get("id"),
                     "detail": f"pooled CH query over {len(tmcs)} tmc(s), "
                               f"{start_fmt}..{end_fmt} returned no values — "
                               f"choropleth left unbaked (template placeholder "
                               f"default renders)"})
        return

    colors = (color_range if color_range and len(color_range) >= 2
             else DEFAULT_SPEED_COLOR_RANGE)
    # Match GeneralGraphComp.getColorRange()'s reverseColors flip (see
    # REVERSE_COLORS_MEASURES above) -- old reports' color_range is
    # authored assuming the DISPLAYED measure controls direction, and the old
    # tool reverses it upstream for "high is bad" measures before RouteMap.jsx
    # ever sees it.
    if measure in REVERSE_COLORS_MEASURES:
        colors = list(reversed(colors))
    breaks = quantile_breaks(values, num_bins=len(colors))
    paint_result = choropleth_paint("value", colors, breaks,
                                    max_value=round(max(values), 1))

    sym_id = next(iter(state["symbologies"]))
    sym = state["symbologies"][sym_id]["symbology"]
    lid = sym["activeLayer"]
    layer = sym["layers"][lid]
    layer["color-range"] = colors
    layer["num-bins"] = len(colors)
    layer["legend-data"] = paint_result["legend"]
    for l in layer["layers"]:
        if l["id"] == lid:
            l["paint"]["line-color"] = paint_result["paint"]


def ensure_route_map_avghoursofdelay_template(year, resolution, templates, dry_run):
    """Mint (or reuse) `route_map_avgHoursOfDelay_{day|5min}_{year}` — M3's
    resolution-keyed sub-measure (see the comment above
    ROUTE_MAP_AVGDELAY_VALUE_EXPR_BY_RESOLUTION for why this one, alone among
    Route Map measures, needs (year, resolution) rather than just year).
    Structurally a copy-adapt of ensure_route_map_speed_template EXCEPT the
    join: this needs the SAME two-source META_JOIN + AADT_DIST_JOIN
    pair the AVL-Graph delay/CO2 templates use (DELAY_EXPR reads
    table1.avg_speedlimit/faciltype -- not on the base 455/3464 join -- and
    table2.distributions), not the base template's own single 455/3464
    join. Paint/legend/color-range are PLACEHOLDERS overwritten per-report
    by bake_route_map_delay_paint, same pattern as every other Route Map
    measure."""
    if resolution not in ROUTE_MAP_AVGDELAY_VALUE_EXPR_BY_RESOLUTION:
        raise ValueError(f"unsupported avgHoursOfDelay resolution: {resolution!r}")
    view_id = GEOMETRY_TILE_VIEWS.get(year)
    if view_id is None:
        raise RuntimeError(f"no geometry tile view for year {year}")
    slug = ROUTE_MAP_AVGDELAY_RESOLUTION_SLUG[resolution]
    value_expr = ROUTE_MAP_AVGDELAY_VALUE_EXPR_BY_RESOLUTION[resolution]

    name = f"route_map_avgHoursOfDelay_{slug}_{year}"
    lid = f"rm_avgdelay_{slug}_{year}"
    src_id = f"npmrds2_s582_v{view_id}_{lid}"
    tiles_url = (f"{TILE_HOST}/dama-admin/npmrds2/tiles/{view_id}"
                 f"/{{z}}/{{x}}/{{y}}/t.pbf?cols=tmc&filter=year={year}")
    zoom_width = lambda base_w: ["interpolate", ["linear"], ["zoom"],
                                 5, base_w, 10, base_w * 2, 14, base_w * 4]
    # Placeholder breaks in HOURS -- day resolution is a per-day rate (small
    # multi-hour range plausible), 5-minutes is a per-EPOCH rate (much
    # smaller scale, same measure/units, different granularity — see the
    # comment above ROUTE_MAP_AVGDELAY_VALUE_EXPR_BY_RESOLUTION). Both
    # reversed (reverseColors:true, see REVERSE_COLORS_MEASURES) —
    # real per-report breaks (bake_route_map_delay_paint) overwrite these
    # immediately on any real conversion.
    default_colors = list(reversed(DEFAULT_SPEED_COLOR_RANGE))
    placeholder_breaks = [0.1, 0.5, 1, 3] if resolution == "day" else [0.001, 0.003, 0.01, 0.03]
    placeholder = choropleth_paint("value", default_colors, placeholder_breaks,
                                   max_value=(5 if resolution == "day" else 0.05))
    template_layer = {
        "id": lid, "name": f"Avg. Hours of Delay ({resolution}, {year} network)",
        "type": "line",
        "order": 1, "isVisible": True,
        "series-template": True,
        "series-feature-column": "tmc",
        "layer-type": "choropleth",
        "data-column": "value",
        "num-bins": 5, "bin-method": "quantile",
        "color-range": default_colors,
        "legend-data": placeholder["legend"],
        # The runtime materializes one visible clone per comparison_series
        # variant (see useComparisonSeriesLayers.js); the template layer
        # itself must stay suppressed or it renders an extra, un-labeled
        # duplicate of the same legend (round 51, user-reported).
        "legend-orientation": "none",
        "view_id": view_id, "source_id": 582,
        "join": {
            "enabled": True, "featureKeyColumn": "tmc", "joinColumn": "tmc",
            "source": {"sourceId": 583, "viewId": 982, "env": "npmrds2"},
            "query": {
                "columns": [value_expr, "ds.tmc as tmc"],
                "groupBy": ["ds.tmc"],
                "join": build_ch_join_wire(
                    {"table1": META_JOIN, "table2": AADT_DIST_JOIN}),
                "filters": {}, "filterRows": [], "filterMode": "all",
            },
            "tileColumns": ["value"],
        },
        "sources": [{"id": src_id, "source": {
            "type": "vector", "tiles": [tiles_url], "format": "pbf"}}],
        "layers": [
            {"id": f"{lid}_case", "type": "line", "source": src_id,
             "source-layer": f"view_{view_id}",
             "paint": {"line-color": "#1e293b", "line-width": zoom_width(1.8)},
             "layout": {"visibility": "none",
                        "line-cap": "round", "line-join": "round"}},
            {"id": lid, "type": "line", "source": src_id,
             "source-layer": f"view_{view_id}",
             "paint": {"line-color": placeholder["paint"],
                       "line-width": zoom_width(1.2)},
             "layout": {"visibility": "none",
                        "line-cap": "round", "line-join": "round"}},
        ],
        "filter": {},
    }
    sym_id = name
    state = {
        "symbologies": {sym_id: {
            "id": sym_id, "name": "Avg. Hours of Delay", "isVisible": True,
            "symbology": {"activeLayer": lid, "layers": {lid: template_layer}},
        }},
        "display": {"_functions": {"providers": [], "subscribers": [
            {"functionId": "comparison_series", "enabled": True,
             "paramKey": "$self",
             "args": {"labelKey": "label", "valueKey": "filters"}}]}},
        "height": "2/3",
        "zoomPan": True,
        "blankBaseMap": False,
        "basemapStyle": "Default",
        "hideControls": True,
    }
    existing = templates.get(name)
    if existing is not None:
        ex_state = json.loads(existing["data"]["stateJson"])
        if ex_state == state:
            return templates
        new_data = {**existing["data"], "stateJson": json.dumps(state),
                    "updatedAt": now_iso()}
        if dry_run:
            print(f"[dry-run] would update drifted template '{name}' "
                  f"id={existing['id']}")
        else:
            dms(["raw", "update", str(existing["id"])], data=new_data)
            print(f"updated template '{name}' id={existing['id']} (drift fix)")
        templates[name] = {"id": existing["id"], "data": new_data}
        return templates
    if dry_run:
        print(f"[dry-run] would create template '{name}'")
        templates[name] = {"id": None, "data": {"name": name,
                           "stateJson": json.dumps(state),
                           "elementType": "Map",
                           "updatedAt": now_iso()}}
        return templates
    data = {
        "name": name, "slug": name,
        "stateJson": json.dumps(state),
        "elementType": "Map", "componentType": "Map",
        "includesLayout": False, "includesSource": True,
        "createdAt": now_iso(), "updatedAt": now_iso(),
    }
    r = dms(["raw", "create", "npmrdsv5", GRAPH_TEMPLATE_TYPE], data=data)
    templates[name] = {"id": r["id"], "data": data}
    print(f"created template '{name}' id={r['id']}")
    return templates


def ensure_route_map_hoursofdelay_template(year, templates, dry_run):
    """Mint (or reuse) `route_map_hoursOfDelay_{year}` — M3's last sub-measure.
    Unlike avgHoursOfDelay, this one is resolution-INVARIANT (see the comment
    above HOURS_OF_DELAY_VALUE_EXPR), so it's year-only keyed like speed/
    travelTime, just with the two-source META_JOIN + AADT_DIST_JOIN pair
    ensure_route_map_avghoursofdelay_template already established (DELAY_EXPR
    needs table1.avg_speedlimit/faciltype + table2.distributions, not the
    base 455/3464 join). Paint/legend/color-range are PLACEHOLDERS
    overwritten per-report by bake_route_map_delay_paint, same as every
    other Route Map measure."""
    view_id = GEOMETRY_TILE_VIEWS.get(year)
    if view_id is None:
        raise RuntimeError(f"no geometry tile view for year {year}")

    name = f"route_map_hoursOfDelay_{year}"
    lid = f"rm_hoursofdelay_{year}"
    src_id = f"npmrds2_s582_v{view_id}_{lid}"
    tiles_url = (f"{TILE_HOST}/dama-admin/npmrds2/tiles/{view_id}"
                 f"/{{z}}/{{x}}/{{y}}/t.pbf?cols=tmc&filter=year={year}")
    zoom_width = lambda base_w: ["interpolate", ["linear"], ["zoom"],
                                 5, base_w, 10, base_w * 2, 14, base_w * 4]
    # Placeholder breaks in HOURS (whole-range total delay, reverseColors:true
    # like every other delay-based measure) — real per-report breaks
    # (bake_route_map_delay_paint) overwrite these on any real conversion.
    default_colors = list(reversed(DEFAULT_SPEED_COLOR_RANGE))
    placeholder = choropleth_paint("value", default_colors,
                                   [5, 20, 50, 100], max_value=200)
    template_layer = {
        "id": lid, "name": f"Hours of Delay ({year} network)", "type": "line",
        "order": 1, "isVisible": True,
        "series-template": True,
        "series-feature-column": "tmc",
        "layer-type": "choropleth",
        "data-column": "value",
        "num-bins": 5, "bin-method": "quantile",
        "color-range": default_colors,
        "legend-data": placeholder["legend"],
        # The runtime materializes one visible clone per comparison_series
        # variant (see useComparisonSeriesLayers.js); the template layer
        # itself must stay suppressed or it renders an extra, un-labeled
        # duplicate of the same legend (round 51, user-reported).
        "legend-orientation": "none",
        "view_id": view_id, "source_id": 582,
        "join": {
            "enabled": True, "featureKeyColumn": "tmc", "joinColumn": "tmc",
            "source": {"sourceId": 583, "viewId": 982, "env": "npmrds2"},
            "query": {
                "columns": [HOURS_OF_DELAY_VALUE_EXPR, "ds.tmc as tmc"],
                "groupBy": ["ds.tmc"],
                "join": build_ch_join_wire(
                    {"table1": META_JOIN, "table2": AADT_DIST_JOIN}),
                "filters": {}, "filterRows": [], "filterMode": "all",
            },
            "tileColumns": ["value"],
        },
        "sources": [{"id": src_id, "source": {
            "type": "vector", "tiles": [tiles_url], "format": "pbf"}}],
        "layers": [
            {"id": f"{lid}_case", "type": "line", "source": src_id,
             "source-layer": f"view_{view_id}",
             "paint": {"line-color": "#1e293b", "line-width": zoom_width(1.8)},
             "layout": {"visibility": "none",
                        "line-cap": "round", "line-join": "round"}},
            {"id": lid, "type": "line", "source": src_id,
             "source-layer": f"view_{view_id}",
             "paint": {"line-color": placeholder["paint"],
                       "line-width": zoom_width(1.2)},
             "layout": {"visibility": "none",
                        "line-cap": "round", "line-join": "round"}},
        ],
        "filter": {},
    }
    sym_id = name
    state = {
        "symbologies": {sym_id: {
            "id": sym_id, "name": "Hours of Delay", "isVisible": True,
            "symbology": {"activeLayer": lid, "layers": {lid: template_layer}},
        }},
        "display": {"_functions": {"providers": [], "subscribers": [
            {"functionId": "comparison_series", "enabled": True,
             "paramKey": "$self",
             "args": {"labelKey": "label", "valueKey": "filters"}}]}},
        "height": "2/3",
        "zoomPan": True,
        "blankBaseMap": False,
        "basemapStyle": "Default",
        "hideControls": True,
    }
    existing = templates.get(name)
    if existing is not None:
        ex_state = json.loads(existing["data"]["stateJson"])
        if ex_state == state:
            return templates
        new_data = {**existing["data"], "stateJson": json.dumps(state),
                    "updatedAt": now_iso()}
        if dry_run:
            print(f"[dry-run] would update drifted template '{name}' "
                  f"id={existing['id']}")
        else:
            dms(["raw", "update", str(existing["id"])], data=new_data)
            print(f"updated template '{name}' id={existing['id']} (drift fix)")
        templates[name] = {"id": existing["id"], "data": new_data}
        return templates
    if dry_run:
        print(f"[dry-run] would create template '{name}'")
        templates[name] = {"id": None, "data": {"name": name,
                           "stateJson": json.dumps(state),
                           "elementType": "Map",
                           "updatedAt": now_iso()}}
        return templates
    data = {
        "name": name, "slug": name,
        "stateJson": json.dumps(state),
        "elementType": "Map", "componentType": "Map",
        "includesLayout": False, "includesSource": True,
        "createdAt": now_iso(), "updatedAt": now_iso(),
    }
    r = dms(["raw", "create", "npmrdsv5", GRAPH_TEMPLATE_TYPE], data=data)
    templates[name] = {"id": r["id"], "data": data}
    print(f"created template '{name}' id={r['id']}")
    return templates


def bake_route_map_delay_paint(state, info, route_map_value_ctx, color_range,
                               gaps, old_graph, measure, resolution=None):
    """Per-report choropleth bake for a Route-Map Map-section clone whose
    series-template layer carries the two-source META_JOIN +
    AADT_DIST_JOIN CH join (hoursOfDelay and avgHoursOfDelay, M3) — separate
    from bake_route_map_choropleth_paint because the FROM/JOIN clause itself
    differs (two joins, not one), not just the SELECTed expression, per the
    M3+ handoff notes in route_map_scope.md. `resolution` is only meaningful
    for avgHoursOfDelay (hoursOfDelay is resolution-invariant, see
    HOURS_OF_DELAY_VALUE_EXPR). Pools per-TMC values across every comp
    assigned to THIS graph, same infra/semantics as every other Route Map
    bake function."""
    comps_by_id = route_map_value_ctx["comps_by_id"]
    old_routes = route_map_value_ctx["old_routes"]
    resolved_tmcs = route_map_value_ctx["resolved_tmcs"]

    tmcs = set()
    starts, ends = [], []
    for cid in info["assigned"]:
        rc = comps_by_id.get(cid)
        if not rc:
            continue
        rid = str(rc.get("routeId"))
        old_route = old_routes.get(rid)
        comp_tmcs = resolved_tmcs.get(cid) or (old_route or {}).get("tmc_array") or []
        tmcs.update(comp_tmcs)
        s = rc.get("settings") or {}
        if s.get("startDate"):
            starts.append(str(s["startDate"])[:8])
        if s.get("endDate"):
            ends.append(str(s["endDate"])[:8])

    if not tmcs or not starts or not ends:
        gaps.append({"kind": f"route_map_{measure}_no_values", "graph": old_graph.get("id"),
                     "detail": "no resolvable TMCs/date range across this graph's "
                               "assigned comps — choropleth left unbaked "
                               "(template placeholder default renders)"})
        return

    start_fmt = "-".join([min(starts)[:4], min(starts)[4:6], min(starts)[6:8]])
    end_fmt = "-".join([max(ends)[:4], max(ends)[4:6], max(ends)[6:8]])
    tmc_list = ",".join(f"'{t}'" for t in sorted(tmcs))
    # hoursOfDelay is resolution-invariant (one expression, no resolution
    # dispatch needed); avgHoursOfDelay genuinely varies by resolution.
    value_expr = (HOURS_OF_DELAY_VALUE_EXPR if measure == "hoursOfDelay"
                 else ROUTE_MAP_AVGDELAY_VALUE_EXPR_BY_RESOLUTION[resolution])
    dist_key_body = DIST_KEY_EXPR.rsplit(" as ", 1)[0]
    # Round 59: CH_META_TABLE now spans multiple years (one row per (tmc,
    # year), see the META_JOIN comment above) -- without the toYear(ds.date)
    # match this INNER JOIN would fan out every fact row across every year
    # table1 carries for that tmc, silently multiplying the pooled value.
    # (An INNER join -- unlike the templated LEFT join -- just drops any
    # dates outside table1's year coverage, e.g. 2017, rather than zeroing
    # them, so no nullIf guard is needed here.)
    sql = (f"SELECT ds.tmc AS tmc, {value_expr} "
           f"FROM {CH_FACT_TABLE} AS ds "
           f"JOIN {CH_META_TABLE} AS table1 "
           f"ON ds.tmc = table1.tmc AND toYear(ds.date) = table1.year "
           f"JOIN {CH_AADT_DIST_TABLE} AS table2 ON {dist_key_body} = table2.key "
           f"WHERE ds.tmc IN ({tmc_list}) "
           f"AND ds.date >= '{start_fmt}' AND ds.date <= '{end_fmt}' "
           f"GROUP BY ds.tmc")
    result = dbq.ch(sql)
    rows = result.get("data") or []
    values = [r[1] for r in rows if r[1] is not None]
    if not values:
        gaps.append({"kind": f"route_map_{measure}_no_values", "graph": old_graph.get("id"),
                     "detail": f"pooled CH query over {len(tmcs)} tmc(s), "
                               f"{start_fmt}..{end_fmt} returned no values — "
                               f"choropleth left unbaked (template placeholder "
                               f"default renders)"})
        return

    colors = (color_range if color_range and len(color_range) >= 2
             else DEFAULT_SPEED_COLOR_RANGE)
    if measure in REVERSE_COLORS_MEASURES:
        colors = list(reversed(colors))
    breaks = quantile_breaks(values, num_bins=len(colors))
    paint_result = choropleth_paint("value", colors, breaks,
                                    max_value=round(max(values), 3))

    sym_id = next(iter(state["symbologies"]))
    sym = state["symbologies"][sym_id]["symbology"]
    lid = sym["activeLayer"]
    layer = sym["layers"][lid]
    layer["color-range"] = colors
    layer["num-bins"] = len(colors)
    layer["legend-data"] = paint_result["legend"]
    for l in layer["layers"]:
        if l["id"] == lid:
            l["paint"]["line-color"] = paint_result["paint"]


_TMC_RESOLVE_CACHE = {}


def resolve_tmc_array(route_id, years, gaps):
    """Resolve a point-drawn route (null tmc_array) to TMCs per year via the
    old production falcor API (routes2.id[id][year].tmc_array — the same
    server-side resolution the old client used). Returns the union across
    `years`; logs a gap if the per-year sets differ."""
    years = sorted(set(int(y) for y in years if y))
    key = (route_id, tuple(years))
    if key in _TMC_RESOLVE_CACHE:
        return _TMC_RESOLVE_CACHE[key]
    resp = old_falcor_get([["routes2", "id", [int(route_id)], years, "tmc_array"]])
    node = resp.get("jsonGraph", {}).get("routes2", {}).get("id", {}).get(str(route_id), {})
    per_year = {}
    for y in years:
        v = node.get(str(y), {}).get("tmc_array")
        if isinstance(v, dict):
            v = v.get("value")
        per_year[y] = list(v or [])
    sets = {tuple(sorted(v)) for v in per_year.values()}
    if len(sets) > 1:
        gaps.append({"kind": "tmc_array_varies_by_year", "route_id": route_id,
                     "detail": {str(y): v for y, v in per_year.items()}})
    union = sorted({t for v in per_year.values() for t in v})
    if not union:
        gaps.append({"kind": "tmc_resolution_empty", "route_id": route_id,
                     "detail": f"years {years}"})
    _TMC_RESOLVE_CACHE[key] = union
    return union


def load_page_template():
    row = dms(["raw", "get", str(PAGE_TEMPLATE_ID)])
    return row["data"]


def template_section_by_type(page_template, element_type):
    for s in page_template.get("draft_sections") or []:
        if (s.get("element") or {}).get("element-type") == element_type:
            return s
    raise RuntimeError(f"Report Page template has no '{element_type}' section")


def applied_template_stamp(tmpl):
    stamp_fields = ["type", "group", "level", "title", "state.join",
                    "state.columns", "state.display", "state.filters",
                    "state.customBuckets", "state.externalSource",
                    "state.comparisonSeries"]
    ref = {"appliedAt": now_iso(),
           "templateId": str(tmpl["id"]),
           "templateName": tmpl["data"].get("name"),
           "templateUpdatedAt": tmpl["data"].get("updatedAt")}
    return {"fields": {f: dict(ref) for f in stamp_fields}}


def resolve_difference_pair(state, route_comps, old_routes):
    """Port of the old tool's 2-comp selection for Route Difference Graph /
    TMC Difference Grid (getActiveRouteComponents, IDENTICAL in both
    components): exactly one Main + one Compare. Explicit
    state.activeRouteComponents = [mainCompId, compareCompId] is honored
    per-slot (74% of corpus instances carry it); any unresolved slot is
    filled with the first OTHER comp whose settings.resolution is equal
    (RAW equality, no 5-minutes default — old: `r.settings.resolution ===
    comp1.settings.resolution`) AND whose route is the same physical route;
    default Main = the report's first comp. Fewer than 2 comps, or no
    partner found → (None, reason) and the graph renders nothing, exactly
    like the old tool.

    Same-physical-route test: the old runtime deep-compared RESOLVED
    tmcArrays. At this point in the pipeline (pre point-resolution — which
    runs later in convert_report and not at all in the census) only the raw
    admin2.routes arrays exist, so: same routeId always matches (identical
    row); different routeIds match iff both raw tmc_arrays are non-empty and
    equal (duplicated routes are common in this corpus); two point-drawn
    routes (empty raw arrays) under different routeIds can't be safely
    matched here and fall to no_pair — a documented, deliberately-tiny
    deviation, chosen so the census (which never resolves points) predicts
    the converter exactly.

    Returns ((main_rc, compare_rc), None) or (None, reason)."""
    comps = [rc for rc in route_comps if rc.get("compId")]
    if len(comps) < 2:
        return None, f"fewer_than_2_comps ({len(comps)})"
    by_id = {rc["compId"]: rc for rc in comps}
    arc = state.get("activeRouteComponents") or []
    c1 = by_id.get(arc[0]) if len(arc) > 0 else None
    c2 = by_id.get(arc[1]) if len(arc) > 1 else None

    def res_of(rc):
        return (rc.get("settings") or {}).get("resolution")

    def raw_tmcs(rc):
        r = old_routes.get(str(rc.get("routeId"))) or {}
        return r.get("tmc_array") or None

    def is_partner(base, cand):
        if cand["compId"] == base["compId"]:
            return False
        if res_of(cand) != res_of(base):
            return False
        if str(cand.get("routeId")) == str(base.get("routeId")):
            return True
        ta, tb = raw_tmcs(base), raw_tmcs(cand)
        return bool(ta) and ta == tb

    def find_partner(base):
        return next((c for c in comps if is_partner(base, c)), None)

    if not c1 and not c2:
        c1 = comps[0]
        c2 = find_partner(c1)
    elif c1 and not c2:
        c2 = find_partner(c1)
    elif c2 and not c1:
        c1 = find_partner(c2)
    if c1 and c2:
        return (c1, c2), None
    anchor = c1 or c2 or comps[0]
    return None, (f"no partner comp for {anchor.get('compId')} (need same "
                  f"resolution {res_of(anchor)!r} + same physical route)")


def analyze_graph(g, comps_by_id, gaps):
    """Extract the conversion-relevant facts from an old graph_comp:
    measure (displayData), resolution, dataColumn, assigned comps, title,
    description. Old semantics: a graph shows state.activeRouteComponents
    (default: every comp); state.resolution overrides the comps' own.
    SINGLE_ACTIVE_COMP_TYPES are documented exceptions (confirmed against
    each component's own source, not just GeneralGraphComp's base):
    generateGraphData([route], ...) destructures only the FIRST matching
    active comp — getActiveRouteComponents() defaults to [routes[0].compId],
    never "every comp" like the general case below. Only "Hours of Delay
    Graph" also hardcodes its measure ('hoursOfDelay', ignoring
    state.displayData) — the other three keep the normal displayData[0]
    measure, they're single-route-only, not single-measure-only."""
    state = g.get("state") or {}
    gtype = g.get("type")
    if gtype in SINGLE_ACTIVE_COMP_TYPES:
        order = list(comps_by_id)  # insertion order == old route_comps order
        active = state.get("activeRouteComponents") or []
        chosen = next((c for c in order if c in active), None) or (
            order[0] if order else None)
        assigned = [chosen] if chosen else []
    else:
        assigned = [c for c in (state.get("activeRouteComponents") or [])
                    if c in comps_by_id] or list(comps_by_id)

    if gtype == "Hours of Delay Graph":
        measure = "hoursOfDelay"
        cost_per_hour = state.get("costPerHour")
        if cost_per_hour:
            gaps.append({"kind": "cost_per_hour_not_applied", "graph": g.get("id"),
                         "detail": cost_per_hour})
    else:
        dd = state.get("displayData")
        measures = [m for m in dd if m != "none"] if isinstance(dd, list) else []
        # Route Map distinguishes an EXPLICIT displayData ["none"] (geometry-
        # only overview map, 97 corpus instances) from an absent displayData
        # (default: speed). The generic filter above erases that distinction —
        # restore it here so none-maps hit route_map_none_{year} instead of
        # silently converting as speed.
        if gtype == "Route Map" and isinstance(dd, list) and dd and not measures:
            measure = "none"
        else:
            measure = measures[0] if measures else DEFAULT_DISPLAY_DATA.get(gtype, "speed")
        if len(measures) > 1:
            gaps.append({"kind": "extra_measures_dropped", "graph": g.get("id"),
                         "detail": measures[1:]})
    # BUG FIX (2026-07-08): when resolution/dataColumn is ambiguous across the
    # assigned comps (no explicit state override), this used to fall back to
    # `next(iter(some_set), None)` — Python set iteration order for strings is
    # hash-seed-dependent, so the "arbitrary" pick was actually NON-DETERMINISTIC
    # across runs. Caught live on report 1061's graph-comp-60 (TMC Grid Graph, 10
    # assigned comps at 5-minutes/day/hour): one run picked resolution
    # '5-minutes' and silently converted it (as if all 10 comps' routes were
    # meant to be queried at 5-min epochs, when several were day/hour); a
    # dry-run moments earlier had picked 'day' and correctly left it unmapped.
    # Same output, different code runs — that's a correctness bug, not just a
    # documentation gap. Fix: when ambiguous, resolve to None so template
    # lookup deterministically fails and the graph is skipped (gap-logged),
    # never silently converted on a guessed value.
    # Absent/null comp resolution means 5-minutes, not "unknown" (verified
    # 2026-07-08 against the old client both ways: comps are CREATED with
    # resolution '5-minutes' — transportNY analysis/reports/store/index.js
    # ~1887 — and the graph layer's getResolution() falls back to '5-minutes'
    # when the setting is missing, graphClasses/GeneralGraphComp.jsx:306).
    resolutions = {(comps_by_id[c].get("settings") or {}).get("resolution")
                   or "5-minutes"
                   for c in assigned}
    # Ancient reports (ids ~211-271, a "version": 2 client shape) store a whole
    # route-comp OBJECT under state.resolution where every later report stores
    # a plain string — treat non-strings as absent (fall back to the comps' own
    # resolution) and gap-log, don't crash on the unhashable dict.
    state_resolution = state.get("resolution")
    if state_resolution and not isinstance(state_resolution, str):
        gaps.append({"kind": "malformed_state_resolution", "graph": g.get("id"),
                     "detail": f"non-string state.resolution "
                               f"({type(state_resolution).__name__}) ignored"})
        state_resolution = None
    if state_resolution:
        resolution = state_resolution
    elif len(resolutions) == 1:
        resolution = next(iter(resolutions))
    elif gtype == "Bar Graph Summary":
        # BarGraphSummary.jsx's own generateGraphData/renderGraph never
        # reference the `resolution` param at all (each bar is one comp's
        # whole-date-range allReducer aggregate, independent of any shared
        # axis — confirmed 2026-07-17) — but avgHoursOfDelay's per-resolution
        # calculated column still keys off info["resolution"] downstream
        # (round 32/36), so a concrete value is needed, not a gap. Resolve it
        # exactly the way the real (unmodified) GeneralGraphComp.getResolution()
        # would: the first assigned comp's own resolution, in the report's
        # original comp order (same rule as SINGLE_ACTIVE_COMP_TYPES above,
        # just without shrinking `assigned` itself — BarGraphSummary's own
        # getActiveRouteComponents() override genuinely renders every comp as
        # its own bar). For speed/travelTime/hoursOfDelay every real
        # resolution maps to the same template anyway (see GRAPH_TEMPLATE_MAP),
        # so which comp "wins" doesn't change the outcome there.
        order = list(comps_by_id)
        first = next((c for c in order if c in assigned), None)
        resolution = ((comps_by_id[first].get("settings") or {}).get("resolution")
                      or "5-minutes") if first else None
    else:
        resolution = None
        # Route/TMC Info Box never read `resolution` (see INFO_BOX_BUCKET's
        # comment) — a real ambiguity for a chart with one shared x-axis, but
        # not a real gap for these two, so don't clutter the report with it.
        # Difference graphs (round 52) re-derive resolution/dataColumn from
        # their resolved Main/Compare PAIR in convert_report's pre-pass — a
        # mixed full-comp set is expected there, not a gap. Route Map: only
        # its avgHoursOfDelay measure's calculated column is actually
        # resolution-dependent (round 32/41's ROUTE_MAP_AVGDELAY_VALUE_EXPR_
        # BY_RESOLUTION) — none/speed/travelTime/hoursOfDelay's
        # route_map_tmpl_name branch never reads info["resolution"] at all,
        # so a mixed set there is analyzer noise, not a real gap (confirmed
        # 2026-07-17: 145 of the corpus's 146 Route-Map mixed-resolution
        # instances are non-avgHoursOfDelay).
        route_map_resolution_irrelevant = (
            gtype == "Route Map" and measure != "avgHoursOfDelay")
        if (gtype not in INFO_BOX_GRAIN and gtype not in DIFFERENCE_GRAPH_TYPES
                and not route_map_resolution_irrelevant):
            gaps.append({"kind": "mixed_resolutions_on_graph", "graph": g.get("id"),
                         "detail": sorted(map(str, resolutions))})
    data_columns = {(comps_by_id[c].get("settings") or {}).get("dataColumn")
                    for c in assigned}
    if len(data_columns) == 1:
        data_column = next(iter(data_columns))
    else:
        data_column = None
        if gtype not in DIFFERENCE_GRAPH_TYPES:
            gaps.append({"kind": "mixed_data_columns_on_graph", "graph": g.get("id"),
                         "detail": sorted(map(str, data_columns))})
    # "{data} AM Peak" / "{type}, {data}" / "{data} {name}" title templates →
    # literal text ({name} = the assigned route comp's display name).
    # Old client default (never customized in the common case, confirmed on
    # reports 520/179's raw graph_comps): an empty/missing state.title falls
    # back to "{type}, {data}", not a blank section title.
    title = state.get("title") or "{type}, {data}"
    title = title.replace("{data}", MEASURE_NAMES.get(measure, measure))
    title = title.replace("{type}", gtype or "")
    comp_names = ", ".join((comps_by_id[c].get("name") or "").strip()
                           for c in assigned)
    title = title.replace("{name}", comp_names)
    description = (state.get("message") or {}).get("text", "")
    return {"type": gtype, "measure": measure, "resolution": resolution,
            "data_column": data_column, "assigned": assigned,
            "title": title.strip(), "description": description}


def build_graph_section_data(page_id, tmpl, tracking_id, info, gaps, old_graph,
                             color_range=None, aadt_override=None,
                             route_map_value_ctx=None, diff_invert=False):
    # Old `layout.w` (react-grid-layout, 12-col) maps directly onto the
    # section's own `size` field (colspan) — confirmed the npmrds_sub pattern
    # (row 2100394) has `theme.selectedTheme: "transportnyv2"`, whose
    # `sectionArray` theme (transportNY's `dms_themes/transportny/themev2.js`)
    # ships the SAME 12-col numeric `sizes` scale ("1".."12", defaultSize
    # "12") — a 1:1 copy, no bucketing needed. `h`/`x`/`y` have no equivalent
    # (sections stack linearly; the theme's `rowspan` is a compound-card
    # span-behind-a-sibling concept, not a pixel/row height, so it's not a
    # faithful target for old `h`) and remain gap-logged.
    layout = old_graph.get("layout") or {}
    w = layout.get("w")
    size = str(w) if isinstance(w, int) and 1 <= w <= 12 else None
    remaining_layout = {k: v for k, v in layout.items() if k != "w"}
    if remaining_layout:
        gaps.append({"kind": "graph_layout", "graph": old_graph.get("id"),
                     "detail": remaining_layout})
    state = json.loads(tmpl["data"]["stateJson"])
    # UI-created sections always carry state.data (see page_10's sections);
    # template stateJson doesn't. BarGraph crashes on undefined viewData
    # (d3groups(undefined) — "values is not iterable"), so always include it.
    state.setdefault("data", [])
    if info["description"]:
        state.setdefault("display", {})["description"] = info["description"]
    # Old report.color_range → this graph's own color scale, for the graph
    # types that actually render one (see COLOR_RANGE_GRAPH_TYPES). Matches
    # the existing display.colors shape ({type: "palette", value: [...]}) —
    # useGenericPlotOptions (ui/components/graph/utils.js) consumes
    # colors.value directly as the D3 color-scale range, so this is a real,
    # already-wired primitive, not new capability.
    is_map = tmpl["data"].get("elementType") == "Map"
    # Map sections have no `display.colors` concept at all — the choropleth
    # paint itself IS the color (see bake_route_map_choropleth_paint below), so the
    # generic AVL-Graph color_range wiring is not just inert but the wrong
    # target entirely; skip it here rather than write a dead key.
    if color_range and old_graph.get("type") in COLOR_RANGE_GRAPH_TYPES and not is_map:
        # Round 51 fix: old GeneralGraphComp.getColorRange() reverses
        # report.color_range for reverseColors:true measures (see
        # REVERSE_COLORS_MEASURES) BEFORE any old graph component ever
        # renders it — this generic wiring skipped that step entirely,
        # so e.g. every converted TMC Grid Graph/travelTime page rendered
        # short/good travel times red and long/bad ones green (backwards).
        # Only the Map path (bake_route_map_choropleth_paint/
        # bake_route_map_delay_paint) had this applied, since round 50.
        colors = (list(reversed(color_range))
                  if info["measure"] in REVERSE_COLORS_MEASURES else color_range)
        colors_cfg = {"type": "palette", "value": colors}
        # BarGraph colors by series by default (one color per route) — these
        # converted reports are single-series magnitude charts (the old
        # client colored each bar by its own value: "more delay = darker"),
        # so opt into BarGraph's byValue coloring mode to match.
        if state.get("display", {}).get("graphType") == "BarGraph":
            colors_cfg["byValue"] = True
        # Round 52: this wholesale replace was silently dropping any color
        # FLAGS the template itself carries — the difference templates set
        # byValueSymmetric (zero-centered scale, old d3.scaleQuantize
        # ([-max, +max]) parity) on their default colors; carry it onto the
        # report's own palette too.
        tmpl_colors = (state.get("display") or {}).get("colors") or {}
        if tmpl_colors.get("byValueSymmetric"):
            colors_cfg["byValueSymmetric"] = True
        state.setdefault("display", {})["colors"] = colors_cfg
    # Route-Map choropleth bake (M2 speed / M3 travelTime): only the templates
    # whose series-template layer actually carries a `join` (single-source
    # CH_TMC_IDENT_TABLE joins per ROUTE_MAP_VALUE_EXPR, or the two-source
    # META_JOIN+AADT_DIST_JOIN pair for avgHoursOfDelay) need this — the
    # geometry-only "none" template has no `join` key at all, so this is a
    # no-op for it without needing a separate measure check here.
    if is_map and route_map_value_ctx is not None:
        sym_id = next(iter(state.get("symbologies") or {}), None)
        layer = (state["symbologies"][sym_id]["symbology"]["layers"]
                 [state["symbologies"][sym_id]["symbology"]["activeLayer"]]
                ) if sym_id else None
        if layer and layer.get("join"):
            if info["measure"] in ROUTE_MAP_VALUE_EXPR:
                bake_route_map_choropleth_paint(state, info, route_map_value_ctx,
                                                color_range, gaps, old_graph,
                                                info["measure"])
            elif info["measure"] in ("hoursOfDelay", "avgHoursOfDelay"):
                bake_route_map_delay_paint(state, info, route_map_value_ctx,
                                           color_range, gaps, old_graph,
                                           info["measure"], info["resolution"])
    # overrides.aadt → substitute the AADT term(s) inside the cloned calculated
    # column expression(s) (see AADT_OVERRIDE_SUBS above for the old-tool
    # semantics each replacement reproduces). Zero matches on a template that
    # was expected to consume AADT means the template row drifted from this
    # script's expression constants — gap-log loudly rather than silently
    # converting without the override.
    if aadt_override is not None:
        hits = 0
        for col in state.get("columns", []):
            name = col.get("name")
            if col.get("type") != "calculated" or not isinstance(name, str):
                continue
            for frag, repl in AADT_OVERRIDE_SUBS:
                if frag in name:
                    name = name.replace(frag, repl.format(ov=aadt_override))
                    hits += 1
            col["name"] = name
        if hits == 0:
            gaps.append({"kind": "aadt_override_not_applied",
                         "graph": old_graph.get("id"),
                         "detail": f"override {aadt_override}: no known AADT "
                                   f"fragment in template "
                                   f"'{tmpl['data'].get('name')}'"})
    # Round 52 (difference graphs): when the pair's Main sits after its
    # Compare in the page's shared route-list order, flip the server-side
    # subtraction so the rendered value stays Main − Compare (see the
    # route-diff pre-pass in convert_report). Per-SECTION patch on the cloned
    # state — the template row itself stays invert-free.
    if diff_invert:
        combine = dict((state.get("comparisonSeries") or {})
                       .get("combine") or {"mode": "difference"})
        combine["invert"] = True
        state.setdefault("comparisonSeries", {})["combine"] = combine
    state_json = json.dumps(state)
    return {
        "type": COMPONENT_TYPE,
        "group": "default",
        "level": "0",
        "title": info["title"],
        **({"size": size} if size else {}),
        "parent": json.dumps({"id": str(page_id), "ref": f"npmrdsv5+{PAGE_TYPE}"}),
        "trackingId": tracking_id,
        "element": {
            "element-type": tmpl["data"].get("elementType", "AVL Graph"),
            "element-data": state_json,
        },
        "_appliedTemplate": applied_template_stamp(tmpl),
    }


def build_cloned_section_data(page_id, tmpl_section, tracking_id):
    """Clone a Report Page template section (RRL / Add-a-Route Spreadsheet)."""
    return {
        "type": COMPONENT_TYPE,
        "group": tmpl_section.get("group", "default"),
        **({"level": tmpl_section["level"]} if tmpl_section.get("level") else {}),
        "title": tmpl_section.get("title", ""),
        "parent": json.dumps({"id": str(page_id), "ref": f"npmrdsv5+{PAGE_TYPE}"}),
        "trackingId": tracking_id,
        "element": {
            "element-type": tmpl_section["element"]["element-type"],
            "element-data": tmpl_section["element"]["element-data"],
        },
    }


# ── New-side operations (all writes via CLI) ────────────────────────────────

def find_page_by_slug(slug):
    out = psql_new(
        "SELECT id FROM dms_npmrdsv5.data_items "
        f"WHERE type = '{PAGE_TYPE}' AND data->>'url_slug' = '{slug}' LIMIT 1")
    return int(out) if out else None


def delete_converted_page(page_id):
    """Delete a previously converted page + its section rows + its snap rows.
    All deletes go through the CLI (requires the auth token)."""
    page = dms(["raw", "get", str(page_id)])
    d = page["data"]
    section_ids = {s["id"] for s in (d.get("draft_sections") or [])}
    section_ids |= {s["id"] for s in (d.get("sections") or [])}
    for sid in sorted(section_ids, key=int):
        dms(["raw", "delete", "npmrdsv5", COMPONENT_TYPE, str(sid)])
    snap_ids = psql_new(
        f"SELECT id FROM {REPORTS_SNAP_TABLE} "
        f"WHERE data->>'report_id' = '{int(page_id)}'").split()
    for sid in snap_ids:
        dms(["raw", "delete", "npmrdsv5", REPORTS_SNAP_TYPE, str(sid)])
    dms(["raw", "delete", "npmrdsv5", PAGE_TYPE, str(page_id)])
    print(f"replaced: deleted page {page_id}, {len(section_ids)} section row(s), "
          f"{len(snap_ids)} snap row(s)")


def ensure_parent_page(dry_run):
    pid = find_page_by_slug(CONVERTED_PARENT_SLUG)
    if pid:
        return pid
    if dry_run:
        print(f"[dry-run] would create parent page '{CONVERTED_PARENT_TITLE}'")
        return -1
    res = dms(["page", "create", "--pattern", PATTERN,
               "--title", CONVERTED_PARENT_TITLE,
               "--slug", CONVERTED_PARENT_SLUG],
              data={"index": "99", "sidebar": "left", "published": ""})
    pid = res["id"]
    print(f"created parent page '{CONVERTED_PARENT_TITLE}' id={pid}")
    return pid


def ensure_route_in_catalog(route_id, old_route, dry_run, gaps, tmc_override=None):
    out = psql_new(
        f"SELECT 1 FROM {ROUTES_CATALOG_TABLE} "
        f"WHERE data->>'route_id' = '{int(route_id)}' LIMIT 1")
    if out:
        return "present"
    if old_route is None:
        gaps.append({"kind": "route_missing_everywhere", "route_id": route_id,
                     "detail": "not in old admin2.routes nor the new catalog"})
        return "missing"
    row = {
        "name": old_route.get("name") or "",
        "description": old_route.get("description") or "",
        "route_id": str(old_route["id"]),
        "tmc_array": js(tmc_override or old_route.get("tmc_array") or []),
        "points": js(old_route.get("points")),
        "metadata": js(old_route.get("metadata")),
        "conflation_array": js(old_route.get("conflation_array")),
        "conflation_version": old_route.get("conflation_version") or "none",
        "created_at": old_route.get("created_at") or "",
        "created_by": str(old_route.get("created_by") or ""),
        "updated_at": old_route.get("updated_at") or "",
        "isValid": True,
    }
    if dry_run:
        print(f"[dry-run] would insert route {route_id} "
              f"('{row['name']}') into Routes Data catalog")
        return "would-insert"
    dms(["raw", "create", "npmrdsv5", ROUTES_CATALOG_TYPE], data=row)
    print(f"inserted route {route_id} ('{row['name']}') into Routes Data catalog")
    return "inserted"


# ── Main conversion ──────────────────────────────────────────────────────────

def convert_report(old_id, dry_run=False, replace=False):
    gaps = []
    old = fetch_old_report(old_id)
    print(f"\n=== old report {old_id}: '{old['name']}' ===")

    slug = f"report_{old_id}"
    existing = find_page_by_slug(slug)
    if existing:
        if not replace:
            raise RuntimeError(
                f"page '{slug}' already exists (id {existing}) — pass --replace")
        if dry_run:
            print(f"[dry-run] would delete existing page {existing} first")
        else:
            delete_converted_page(existing)

    # -- old-side pieces
    route_comps = flatten_route_comps(old.get("route_comps"), gaps)

    # A report where EVERY route_comp is pre-2017-only has nothing
    # recoverable to convert — npmrds.s583_v982_NPMRDS_V6 (the fact table
    # backing every measure in this pipeline) starts in 2017, so no amount
    # of template work will ever make it render real data. Checked before
    # any old-route fetch or graph analysis since it needs nothing else;
    # mirrors the no_valid_routes report-level skip below (round 39,
    # restored round 53 after rounds 41-52's rewrites silently dropped it).
    if report_is_pre_2017_only(route_comps):
        gaps.append({"kind": "pre_2017_only",
                     "detail": "every route_comp in this report predates "
                               "2017-01-01 (npmrds.s583_v982_NPMRDS_V6 starts "
                               "2017) — permanently unrecoverable, page not "
                               "created"})
        verb = "would skip" if dry_run else "skipped"
        print(f"[{verb}] creating page '{slug}' ('{old['name']}') — every "
              f"route_comp in this report predates 2017")
        return finish(old_id, old, None, gaps, dry_run)

    old_routes = fetch_old_routes([rc["routeId"] for rc in route_comps
                                   if rc.get("routeId")])
    if old.get("station_comps"):
        gaps.append({"kind": "station_comps",
                     "detail": f"{len(old['station_comps'])} station comps not converted"})
    # Stamp each comp with its old-client display name (settings.compTitle
    # substitution — see route_comp_display_name). These become the
    # comparison-series `__series` labels, so sibling comps of one route MUST
    # get distinct names or their arms visually merge into one series. Any
    # residual collision (two comps whose resolved titles are literally
    # identical) is deduped with the compId — the old client keyed rows by
    # compId and only DISPLAYED the name, so duplicates were harmless there;
    # here the label IS the series key.
    seen_names = {}
    for rc in route_comps:
        name = route_comp_display_name(rc, old_routes.get(str(rc.get("routeId"))))
        if name in seen_names:
            deduped = f"{name} ({rc.get('compId')})"
            gaps.append({"kind": "route_name_deduped", "route": name,
                         "detail": f"{rc.get('compId')} renamed to '{deduped}' "
                                   f"(same resolved title as {seen_names[name]})"})
            name = deduped
        else:
            seen_names[name] = rc.get("compId")
        rc["name"] = name
    # Round 40 bug fix: 817/854 corpus reports (96%) have at least one
    # graph_comp with no `id` field at all (the documented old shape,
    # `id: 'graph-comp-N'`, simply isn't there for most of the corpus —
    # confirmed directly, not just the handful of "ancient version 2"
    # reports the id-less case was previously assumed to be limited to).
    # Every dynamic per-graph decision below (Info Box template choice,
    # Route Compare, Bar Graph Summary pm3 year) is keyed by `g.get("id")`
    # in an in-memory dict — when multiple graphs in the same report share
    # `id: None`, they collide on that key and whichever is processed LAST
    # silently overwrites every earlier graph's template assignment, even
    # though the eventual new-side section/trackingId is unique and
    # unaffected. Live-caught 2026-07-14 on report 33: a `speed` reliability
    # graph and an `avgTT-byDateRange` graph were both silently overwritten
    # with the report's (unrelated) `aadt` graph's template. Fix: assign a
    # stable, unique-within-this-report synthetic id (array position) to
    # any graph_comp missing one, before any gid-keyed dict is built.
    for i, g in enumerate(old.get("graph_comps") or []):
        if g.get("id") is None:
            g["id"] = f"graph-idx-{i}"
    # -- per-graph analysis + template mapping
    comps_by_id = {rc.get("compId"): rc for rc in route_comps if rc.get("compId")}
    graph_templates = load_graph_templates()
    page_template = load_page_template()
    analyzed = [(g, analyze_graph(g, comps_by_id, gaps))
                for g in old.get("graph_comps") or []]

    # Route Difference Graph / TMC Difference Grid (round 52): resolve the old
    # tool's Main/Compare pair FIRST — before template selection — because the
    # graph renders at the PAIR's settings, not across every assigned comp
    # (analyze_graph's generic branch derives resolution/dataColumn from the
    # full assigned set, which on a multi-comp report can be "mixed" even
    # though the pair itself agrees). Runs before `needed` below so the
    # re-derived resolution participates in template minting.
    route_diff_invert = {}
    route_diff_gap_logged = set()
    comp_order = [rc.get("compId") for rc in route_comps]
    for g, info in analyzed:
        if info["type"] not in DIFFERENCE_GRAPH_TYPES:
            continue
        gid = g.get("id")
        pair, why = resolve_difference_pair(g.get("state") or {}, route_comps,
                                            old_routes)
        if not pair:
            gaps.append({"kind": "route_difference_no_pair", "graph": gid,
                         "detail": why})
            route_diff_gap_logged.add(gid)
            continue
        main_rc, compare_rc = pair
        info["assigned"] = [main_rc["compId"], compare_rc["compId"]]
        # Pair partners always share settings.resolution (matcher
        # requirement); a string state.resolution still overrides, exactly
        # as in analyze_graph (non-string malformations were already
        # gap-logged there).
        state_res = (g.get("state") or {}).get("resolution")
        info["resolution"] = (state_res if isinstance(state_res, str) and state_res
                              else (main_rc.get("settings") or {}).get("resolution")
                              or "5-minutes")
        pair_cols = {(rc.get("settings") or {}).get("dataColumn")
                     for rc in (main_rc, compare_rc)}
        if len(pair_cols) == 1:
            info["data_column"] = next(iter(pair_cols))
        else:
            info["data_column"] = None
            gaps.append({"kind": "route_difference_mixed_data_columns",
                         "graph": gid, "detail": sorted(map(str, pair_cols))})
        # Published variant order follows the page's shared route list (RRL
        # publishes routes filtered per graph, in list order) — when Main sits
        # AFTER Compare there (reversed explicit pairs are real, e.g. old
        # report 12's ['comp-1','comp-0']), the section's combine config gets
        # invert=true so the rendered subtraction stays Main − Compare.
        route_diff_invert[gid] = (comp_order.index(main_rc["compId"])
                                  > comp_order.index(compare_rc["compId"]))

    needed = {GRAPH_TEMPLATE_MAP.get((i["type"], i["measure"], i["resolution"],
                                      i["data_column"]))
              for _, i in analyzed if i["type"] not in INFO_BOX_GRAIN} - {None}
    graph_templates = ensure_graph_templates(needed, graph_templates, dry_run)

    # Route/TMC Info Box: resolve + mint the period-matched pm3 template per
    # graph (see INFO_BOX_GRAIN above) before the main mapping pass below, so
    # it can use the same graph_templates lookup as every other graph type.
    info_box_tmpl_name = {}
    info_box_bin_year = {}
    info_box_gap_logged = set()
    for g, info in analyzed:
        grain = INFO_BOX_GRAIN.get(info["type"])
        if not grain:
            continue
        gid = g.get("id")
        measure_col = (info["measure"], info["data_column"])
        if measure_col in INFO_BOX_TRAVELTIME_BUCKETS:
            # Round 38 (Phase B) + round 40 (plain `travelTime` alias): plain
            # CH travel time, no pm3/year/bin dependency — see
            # ensure_info_box_traveltime_template.
            graph_templates = ensure_info_box_traveltime_template(
                grain, graph_templates, dry_run)
            info_box_tmpl_name[gid] = f"{grain}_info_box_traveltime"
            continue
        if measure_col == INFO_BOX_LENGTH_BUCKET:
            graph_templates = ensure_info_box_length_template(
                grain, graph_templates, dry_run)
            info_box_tmpl_name[gid] = f"{grain}_info_box_length"
            continue
        if measure_col == INFO_BOX_AADT_BUCKET:
            graph_templates = ensure_info_box_aadt_template(
                grain, graph_templates, dry_run)
            info_box_tmpl_name[gid] = f"{grain}_info_box_aadt"
            continue
        if measure_col == INFO_BOX_DELAY_BUCKET:
            graph_templates = ensure_info_box_delay_template(
                grain, graph_templates, dry_run)
            info_box_tmpl_name[gid] = f"{grain}_info_box_delay"
            continue
        if measure_col != INFO_BOX_BUCKET:
            continue  # outside the join's bucket — falls through to the
                      # generic "no template mapping" gap below, same as any
                      # other uncovered GRAPH_TEMPLATE_MAP combination
        year = graph_max_year(info, comps_by_id)
        bin_ = graph_reliability_bin(info, comps_by_id)
        if year is None:
            gaps.append({"kind": "info_box_year_undetermined", "graph": gid,
                         "detail": "no assigned comp has a startDate/endDate "
                                   "to period-match the pm3 join"})
            info_box_gap_logged.add(gid)
        elif year not in PM3_VIEW_BY_YEAR:
            gaps.append({"kind": "info_box_year_outside_pm3_coverage", "graph": gid,
                         "detail": f"max year {year} outside 1410's "
                                   f"{min(PM3_VIEW_BY_YEAR)}-{max(PM3_VIEW_BY_YEAR)} coverage"})
            info_box_gap_logged.add(gid)
        elif bin_ is None:
            gaps.append({"kind": "info_box_bin_undetermined", "graph": gid,
                         "detail": "assigned comp(s) don't land unambiguously on "
                                   "exactly one of 1410's real bins (amp/midd/pmp/"
                                   "we) — e.g. 0 or 2-3 peak flags true, a mixed "
                                   "weekday+weekend selection, or a custom "
                                   "startTime/endTime with no peak flag; no "
                                   "precomputed value exists for any of those"})
            info_box_gap_logged.add(gid)
        else:
            graph_templates = ensure_pm3_join_template(grain, year, bin_, graph_templates, dry_run)
            info_box_tmpl_name[gid] = f"{grain}_info_box_reliability_{year}_{bin_}"
            info_box_bin_year[gid] = (year, bin_)

    # Route Compare Component: base (first assigned comp) + N compare rows,
    # %-diff-from-base via a delta column (round 24) — see
    # ensure_route_compare_template above. Only ROUTE_COMPARE_BUCKET is
    # supported this round; anything else falls through to the generic
    # unmapped_graph gap below, same as any other uncovered combination.
    route_compare_tmpl_name = {}
    route_compare_gap_logged = set()
    for g, info in analyzed:
        if info["type"] != "Route Compare Component":
            continue
        gid = g.get("id")
        if info["measure"] not in MEASURE_EXPR:
            continue  # outside this round's supported measure — generic gap below
        if (info["measure"], info["resolution"], info["data_column"]) != ROUTE_COMPARE_BUCKET:
            continue
        if len(info["assigned"]) < 2:
            gaps.append({"kind": "route_compare_insufficient_comps", "graph": gid,
                         "detail": f"{len(info['assigned'])} assigned comp(s), need >= 2 "
                                   f"(one base + at least one compare row)"})
            route_compare_gap_logged.add(gid)
            continue
        graph_templates = ensure_route_compare_template(
            info["measure"], graph_templates, dry_run)
        route_compare_tmpl_name[gid] = f"route_compare_{info['measure']}"

    # Route Map: "none" (geometry-only overview map, M0b), "speed" (CH-joined
    # choropleth, M2 — 256 corpus instances / 214 reports / 45 single-blocker
    # flips, the single biggest lever in the corpus), "travelTime" (M3 —
    # same shape as speed, see ensure_route_map_traveltime_template),
    # "hoursOfDelay" (M3 — two-source join, resolution-invariant, see
    # HOURS_OF_DELAY_VALUE_EXPR), "avgHoursOfDelay" (M3 — the one Route Map
    # measure that IS resolution-dependent, see
    # ROUTE_MAP_AVGDELAY_VALUE_EXPR_BY_RESOLUTION; scoped to day/5-minutes
    # only, the only resolutions the real corpus uses). One shared template
    # per network YEAR for each of the others (graph_max_year, same
    # period-matching idiom as the pm3 join above); resolution is irrelevant
    # to none/speed/travelTime/hoursOfDelay (round-41 scope note: whole-range
    # per-TMC aggregate).
    route_map_tmpl_name = {}
    route_map_gap_logged = set()
    for g, info in analyzed:
        if info["type"] != "Route Map" or info["measure"] not in (
                "none", "speed", "travelTime", "hoursOfDelay", "avgHoursOfDelay"):
            continue
        gid = g.get("id")
        if (info["measure"] == "avgHoursOfDelay"
                and info["resolution"] not in ROUTE_MAP_AVGDELAY_VALUE_EXPR_BY_RESOLUTION):
            gaps.append({"kind": "route_map_avghoursofdelay_unsupported_resolution",
                         "graph": gid,
                         "detail": f"resolution {info['resolution']!r} not built "
                                   f"(only day/5-minutes are — 0 corpus instances "
                                   f"at any other resolution as of round 50)"})
            route_map_gap_logged.add(gid)
            continue
        year = graph_max_year(info, comps_by_id)
        if year is not None:
            # Clamp into the provisioned geometry-view range: pre-2017 dates
            # only reach here on mixed reports (pre-2017-ONLY reports are
            # skipped upstream), and the oldest network is the best stand-in.
            year = min(max(year, min(GEOMETRY_TILE_VIEWS)),
                       max(GEOMETRY_TILE_VIEWS))
        if year is None:
            gaps.append({"kind": "route_map_no_year", "graph": gid,
                         "detail": "no parseable comp dates to pick a "
                                   "geometry network year"})
            route_map_gap_logged.add(gid)
            continue
        if info["measure"] == "none":
            graph_templates = ensure_route_map_none_template(
                year, graph_templates, dry_run)
            route_map_tmpl_name[gid] = f"route_map_none_{year}"
        elif info["measure"] == "speed":
            graph_templates = ensure_route_map_speed_template(
                year, graph_templates, dry_run)
            route_map_tmpl_name[gid] = f"route_map_speed_{year}"
        elif info["measure"] == "travelTime":
            graph_templates = ensure_route_map_traveltime_template(
                year, graph_templates, dry_run)
            route_map_tmpl_name[gid] = f"route_map_travelTime_{year}"
        elif info["measure"] == "hoursOfDelay":
            graph_templates = ensure_route_map_hoursofdelay_template(
                year, graph_templates, dry_run)
            route_map_tmpl_name[gid] = f"route_map_hoursOfDelay_{year}"
        else:
            # NOTE: deliberately-scoped local names (avgdelay_resolution/
            # avgdelay_slug), not `resolution`/`slug` -- this loop runs
            # inside convert_report(), which has its OWN function-level
            # `slug = f"report_{old_id}"` (the actual page slug) set earlier;
            # Python has no per-block scoping, so reusing either name here
            # would silently clobber that variable for the rest of the
            # function. Caught live: report 1056/1033 both got created with
            # slug "day"/"5min" instead of "report_1056"/"report_1033"
            # before this rename.
            avgdelay_resolution = info["resolution"]
            graph_templates = ensure_route_map_avghoursofdelay_template(
                year, avgdelay_resolution, graph_templates, dry_run)
            avgdelay_slug = ROUTE_MAP_AVGDELAY_RESOLUTION_SLUG[avgdelay_resolution]
            route_map_tmpl_name[gid] = f"route_map_avgHoursOfDelay_{avgdelay_slug}_{year}"

    convertible, skipped = [], []
    for g, info in analyzed:
        gid = g.get("id")
        is_info_box = info["type"] in INFO_BOX_GRAIN
        is_route_compare = info["type"] == "Route Compare Component"
        is_route_map = info["type"] == "Route Map"
        key = (info["type"], info["measure"], info["resolution"],
               info["data_column"])
        # A pairless difference graph must skip even though its bucket has a
        # template — the old tool renders nothing below 2 matched comps, and
        # a converted section with <2 assigned comps would just be an empty
        # placeholder wired to a real template.
        if gid in route_diff_gap_logged:
            skipped.append(g)
            continue  # specific reason already gap-logged in the pre-pass
        tmpl_name = (info_box_tmpl_name.get(gid) if is_info_box
                    else route_compare_tmpl_name.get(gid) if is_route_compare
                    else route_map_tmpl_name.get(gid) if is_route_map
                    else GRAPH_TEMPLATE_MAP.get(key))
        if tmpl_name and tmpl_name in graph_templates:
            convertible.append((g, info, graph_templates[tmpl_name]))
            continue
        skipped.append(g)
        if (gid in info_box_gap_logged or gid in route_compare_gap_logged
                or gid in route_map_gap_logged):
            continue  # specific reason already gap-logged above
        gaps.append({"kind": "unmapped_graph", "detail": {
            "graph": gid, "graph_type": info["type"],
            "measure": info["measure"], "resolution": info["resolution"],
            "dataColumn": info["data_column"],
            "reason": ("no template mapping" if not tmpl_name
                       else f"template '{tmpl_name}' not found in DB")}})

    # overrides.aadt — decide per convertible graph whether the override can
    # be baked into its cloned calculated column. Only templates whose
    # expressions read table1.aadt consume it (delay/CO₂) — on anything else
    # the override was query-inert in the old tool too (getAADT is only called
    # from the delay/CO₂ calcs), so nothing is lost or logged. Overrides on
    # comps feeding SKIPPED graphs are subsumed by those graphs' own
    # unmapped_graph gaps (the whole graph is lost, not just its override).
    graph_aadt_overrides = []
    for g, info, tmpl in convertible:
        per_comp = [aadt_override_of(comps_by_id[c]) for c in info["assigned"]]
        distinct = set(per_comp)
        consuming = "table1.aadt" in (tmpl["data"].get("stateJson") or "")
        value = None
        if consuming and distinct != {None}:
            if len(distinct) == 1:
                value = per_comp[0]
            else:
                # per-comp overrides diverge but the calculated column is
                # shared across every comparison-series arm — can't express
                gaps.append({"kind": "aadt_override_mixed",
                             "graph": g.get("id"),
                             "detail": sorted(str(x) for x in distinct)})
        graph_aadt_overrides.append(value)

    # `color_range` is only a real gap if a colorful-type graph (see
    # COLOR_RANGE_GRAPH_TYPES) actually failed to convert — for one that DID
    # convert, build_graph_section_data below wires the real color_range into
    # the new template's display.colors.value, so there's nothing lost.
    if old.get("color_range") and any(
            g.get("type") in COLOR_RANGE_GRAPH_TYPES for g in skipped):
        gaps.append({"kind": "color_range", "detail": old["color_range"]})

    graph_tracking_ids = [str(uuid.uuid4()) for _ in convertible]
    # invert per-graph comp assignment → per-comp graph tracking-id list
    graphs_for_comp = {cid: [tid for (g, info, _), tid
                             in zip(convertible, graph_tracking_ids)
                             if cid in info["assigned"]]
                       for cid in comps_by_id}

    # -- resolve point-drawn routes (null tmc_array) via the old prod API
    resolved_tmcs = {}
    for rc in route_comps:
        rid = str(rc.get("routeId"))
        old_route = old_routes.get(rid)
        if old_route is not None and not old_route.get("tmc_array"):
            s = rc.get("settings") or {}
            years = {str(s.get(k))[:4] for k in ("startDate", "endDate")
                     if s.get(k)}
            comp_years = range(int(min(years)), int(max(years)) + 1) if years else []
            tmcs = resolve_tmc_array(rid, comp_years, gaps)
            resolved_tmcs[rc.get("compId")] = tmcs
            print(f"resolved point-route {rid} ({rc.get('compId')}, "
                  f"years {sorted(years)}) -> {tmcs}")

    # -- route entries for the reports_snap_2 row
    route_entries = [
        build_route_entry(rc, old_routes.get(str(rc.get("routeId"))),
                          graphs_for_comp.get(rc.get("compId"), []),
                          old_id, gaps,
                          tmc_override=resolved_tmcs.get(rc.get("compId")))
        for rc in route_comps]

    # -- catalog upserts (with resolved TMCs for point-routes)
    seen_rids = set()
    for rc in route_comps:
        rid = rc.get("routeId")
        if rid and rid not in seen_rids:
            seen_rids.add(rid)
            ensure_route_in_catalog(rid, old_routes.get(str(rid)), dry_run, gaps,
                                    tmc_override=resolved_tmcs.get(rc.get("compId")))

    # A report where EVERY route_comp has no resolvable TMC array has nothing
    # to convert at all — every measure in this whole pipeline is TMC-scoped,
    # and build_route_entry above already excludes each of these routes from
    # every graph's graphIds (see the unfiltered-scan fix). Creating the page
    # anyway would produce a permanently-empty shell (real sections, zero
    # data, forever) — confirmed live on report_1032/report_392, both 100%
    # route_missing_everywhere. Skip page creation entirely and gap-log at
    # the report level instead.
    if route_entries and not any(e["tmc_array"] for e in route_entries):
        gaps.append({"kind": "no_valid_routes",
                     "detail": "every route_comp in this report has no "
                               "resolvable tmc_array (route_missing_everywhere) "
                               "— nothing to convert, page not created"})
        verb = "would skip" if dry_run else "skipped"
        print(f"[{verb}] creating page '{slug}' ('{old['name']}') — no route "
              f"in this report has real TMC data")
        return finish(old_id, old, None, gaps, dry_run)

    if dry_run:
        print(f"[dry-run] would create page '{slug}' ('{old['name']}') with "
              f"{len(convertible)} graph(s) (+RRL +Add-a-Route), "
              f"{len(route_entries)} route(s); {len(skipped)} graph(s) skipped")
        return finish(old_id, old, None, gaps, dry_run)

    # -- page
    parent_id = ensure_parent_page(dry_run)
    res = dms(["page", "create", "--pattern", PATTERN,
               "--title", old["name"] or slug, "--slug", slug],
              data={"index": "0", "parent": str(parent_id),
                    "sidebar": page_template.get("sidebar", "left"),
                    "published": "draft"})
    page_id = res["id"]
    print(f"created page id={page_id} slug={slug}")

    # -- draft sections (RRL first/sidebar, then graphs, then Add-a-Route)
    rrl_tmpl = template_section_by_type(page_template, "ReportRouteList")
    sheet_tmpl = template_section_by_type(page_template, "Spreadsheet")
    section_datas = [build_cloned_section_data(page_id, rrl_tmpl, str(uuid.uuid4()))]
    # Route-Map choropleth baking (M2) needs each graph's assigned comps'
    # TMCs/date ranges — all three pieces already computed above for the
    # reports_snap_2 route entries; bundle rather than widen every other
    # build_graph_section_data call with three more positional params.
    route_map_value_ctx = {"comps_by_id": comps_by_id, "old_routes": old_routes,
                           "resolved_tmcs": resolved_tmcs}
    for (g, info, tmpl), tid, aadt_ov in zip(convertible, graph_tracking_ids,
                                             graph_aadt_overrides):
        # Info Box sections all render an otherwise-identical "TMC/Route Info
        # Box, Speed" title (the old report's own title template — see
        # analyze_graph) with no year/bin in it at all; build_graph_section_data
        # always uses this title verbatim, so a template's own bin-aware title
        # (ensure_pm3_join_template's INFO_BOX_TITLES) never reaches the page.
        # Two sibling Info Box sections on one page can now show DIFFERENT
        # bins (round 21) — append the bin/year here so they're visually
        # distinguishable without reading raw column headers.
        bin_year = info_box_bin_year.get(g.get("id"))
        if bin_year:
            year_, bin_ = bin_year
            info["title"] = f"{info['title']} ({RELIABILITY_BIN_LABELS[bin_]}, {year_})"
        section_datas.append(
            build_graph_section_data(page_id, tmpl, tid, info, gaps, g,
                                     color_range=old.get("color_range"),
                                     aadt_override=aadt_ov,
                                     route_map_value_ctx=route_map_value_ctx,
                                     diff_invert=route_diff_invert.get(
                                         g.get("id"), False)))
    section_datas.append(build_cloned_section_data(page_id, sheet_tmpl, str(uuid.uuid4())))

    draft_ids = []
    for sd in section_datas:
        r = dms(["section", "create", str(page_id), "--pattern", PATTERN], data=sd)
        draft_ids.append(r["id"])
    print(f"created {len(draft_ids)} draft sections: {draft_ids}")

    # -- published copies (separate rows, same trackingIds — mirrors UI publish)
    published_refs = []
    for sd in section_datas:
        r = dms(["raw", "create", "npmrdsv5", COMPONENT_TYPE], data=sd)
        published_refs.append({"id": str(r["id"]),
                               "ref": f"npmrdsv5+{COMPONENT_TYPE}"})
    groups = page_template.get("draft_section_groups") or [
        {"name": "default", "index": 0, "theme": "content", "position": "content"}]
    dms(["raw", "update", str(page_id)],
        data={"sections": published_refs, "section_groups": groups,
              "draft_section_groups": groups, "published": "", "has_changes": False})
    print(f"published page (published section rows: "
          f"{[r['id'] for r in published_refs]})")

    # -- reports_snap_2 row
    snap = {
        "report_id": str(page_id),
        "routes": json.dumps(route_entries),
        "name": old.get("name") or "",
        "description": old.get("description") or "",
        "_converted_from_old_report_id": old_id,
        "_converted_at": now_iso(),
        "_old_created_by": old.get("created_by"),
        "_old_created_at": old.get("created_at"),
        "_old_updated_at": old.get("updated_at"),
    }
    r = dms(["raw", "create", "npmrdsv5", REPORTS_SNAP_TYPE], data=snap)
    print(f"created reports_snap_2 row id={r['id']} (report_id={page_id}, "
          f"{len(route_entries)} routes)")

    return finish(old_id, old, page_id, gaps, dry_run)


def finish(old_id, old, page_id, gaps, dry_run):
    os.makedirs(GAPS_DIR, exist_ok=True)
    report = {"old_report_id": old_id, "old_name": old.get("name"),
              "new_page_id": page_id, "dry_run": dry_run,
              "converted_at": now_iso(), "gaps": gaps}
    path = os.path.join(GAPS_DIR, f"report_{old_id}.json")
    with open(path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\n--- gap report ({len(gaps)} item(s)) → {path}")
    for g in gaps:
        print(f"  [{g['kind']}] " + json.dumps(
            {k: v for k, v in g.items() if k != 'kind'})[:200])
    if page_id and not dry_run:
        print(f"\nview it: http://npmrds.localhost:5173/report_{old_id} "
              f"(page id {page_id})")
    return report


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("--report-id", type=int, required=True,
                    help="old admin2.reports id to convert")
    ap.add_argument("--dry-run", action="store_true",
                    help="report what would happen without writing")
    ap.add_argument("--replace", action="store_true",
                    help="delete a previously converted page for this report first")
    args = ap.parse_args()
    convert_report(args.report_id, dry_run=args.dry_run, replace=args.replace)


if __name__ == "__main__":
    main()
