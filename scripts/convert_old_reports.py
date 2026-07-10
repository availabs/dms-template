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
import subprocess
import sys
import uuid
from datetime import datetime, timezone

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

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
    ("Route Line Graph", "speed", "5-minutes", "travel_time_all"): "tmc_speed_line_graph",
    ("Route Line Graph", "travelTime", "5-minutes", "travel_time_all"): "tmc_travel_time_line_graph",
    ("TMC Grid Graph", "speed", "5-minutes", "travel_time_all"): "tmc_speed_grid_graph",
    ("Route Bar Graph", "speed", "day", "travel_time_all"): "tmc_speed_bar_graph_day",
    ("Route Bar Graph", "travelTime", "day", "travel_time_all"): "tmc_travel_time_bar_graph_day",
    ("Route Bar Graph", "hoursOfDelay", "day", "travel_time_all"): "tmc_delay_bar_graph_day",
    ("TMC Grid Graph", "avgCo2Emissions", "5-minutes", "travel_time_passenger"): "tmc_co2_grid_graph_passenger",
    ("TMC Grid Graph", "avgCo2Emissions", "5-minutes", "travel_time_truck"): "tmc_co2_grid_graph_truck",
    ("Route Bar Graph", "hoursOfDelay", "weekday", "travel_time_all"): "tmc_delay_bar_graph_weekday",
    ("Hours of Delay Graph", "hoursOfDelay", "5-minutes", "travel_time_all"): "tmc_delay_bar_graph_5min",
    ("Hours of Delay Graph", "hoursOfDelay", "day", "travel_time_all"): "tmc_delay_bar_graph_day_tmc",
    ("Hours of Delay Graph", "hoursOfDelay", "hour", "travel_time_all"): "tmc_delay_bar_graph_hour_tmc",
    ("Hours of Delay Graph", "hoursOfDelay", "15-minutes", "travel_time_all"): "tmc_delay_bar_graph_15min_tmc",
    ("Hours of Delay Graph", "hoursOfDelay", "month", "travel_time_all"): "tmc_delay_bar_graph_month_tmc",
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
# The one (measure, resolution, dataColumn) bucket the join currently
# supports (round 18's two demo reports both fell in this bucket) — a graph
# outside it still gap-logs as unmapped, same as any uncovered
# GRAPH_TEMPLATE_MAP combination.
INFO_BOX_BUCKET = ("speed", "5-minutes", "travel_time_all")
# source 1410's per-year pm3 views (documentation/npmrds-data-sources.md,
# table names confirmed 2026-07-09 via data_manager.views) — no coverage
# outside 2021-2025.
PM3_VIEW_BY_YEAR = {2021: 2587, 2022: 2575, 2023: 2567, 2024: 2568, 2025: 3425}
INFO_BOX_TITLES = {"route": "Route Reliability (LOTTR / TTTR / Freeflow, {bin}, {year})",
                    "tmc": "TMC Reliability (LOTTR / TTTR / Freeflow, {bin}, {year})"}

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

ALL_WEEKDAYS = {"monday", "tuesday", "wednesday", "thursday", "friday",
                "saturday", "sunday"}

# ── Template auto-creation specs ─────────────────────────────────────────────
# Templates the converter can mint if missing. Each is built from the existing
# `tmc_travel_time_line_graph` row's stateJson (externalSource/display/etc.
# stay consistent with what the UI produced) with targeted mutations.
# nullIf(col, 0) — same 0-as-missing fix as _SPEED_CAR_EXPR/_SPEED_TRUCK_EXPR
# below (round 9), applied here to close round 9's own "noticed, NOT fixed"
# follow-up (round 23): the CH fact table stores 0 (not NULL) for missing
# travel_time_all_vehicles readings, so the bare division poisons avg() with
# inf wherever a 0-row exists (ClickHouse serializes the resulting inf as JSON
# null). No car/truck fallback column to coalesce into here (this expr's own
# source IS travel_time_all_vehicles) — nullIf alone restores the old
# NULL-skipping Postgres semantic.
SPEED_EXPR = ("((table1.miles * 3600) / nullIf(ds.travel_time_all_vehicles, 0)) "
              "as speed")
# Same fix, for the plain (non-calculated) travel_time_all_vehicles column
# tmc_travel_time_bar_graph_day averages directly — round 9 flagged that
# averaging raw 0-rows silently drags the mean down vs. the old NULL-skipping
# behavior, without the inf/null symptom (no division involved here, just a
# direct avg). Recast as a calculated column so nullIf can apply.
TRAVEL_TIME_EXPR = ("nullIf(ds.travel_time_all_vehicles, 0) "
                     "as travel_time_all_vehicles")
# Old hoursOfDelay (avail-falcor getHoursOfDelay.js's calcDelay/getAADT): per
# epoch, raw_delay = max(0, tt - miles/max(20, 0.6*speedlimit)*3600)/3600,
# weighted by AADT/facil * the epoch's AADT-distribution share, summed. The
# threshold part joins the ny_2025_tmc_meta ClickHouse view (source 1946/view
# 3298 — miles, avg_speedlimit, aadt, faciltype, congestion_level,
# directionality, f_system); the weighting joins aadt_distributions (source
# 2056/view 3524 — see calculated-join-key notes in
# planning/tasks/current/old-reports-conversion.md) via a computed dist_key.
# This is the "travel_time_all" dataColumn variant (AADT = table1.aadt
# directly, no truck/passenger split, no overrides.aadt — that override is
# still a gap).
DELAY_EXPR = ("(greatest(0, ds.travel_time_all_vehicles - ((table1.miles / "
              "greatest(20, table1.avg_speedlimit * 0.6)) * 3600)) / 3600) "
              "* (table1.aadt / (if(table1.faciltype > 1, 2, 1))) "
              "* arrayElement(table2.distributions, ds.epoch + 1) "
              "as hours_of_delay")
META_1946_JOIN = {
    "source": 1946, "view": 3298,
    "sourceInfo": {
        "name": "ny_2025_tmc_meta",
        "columns": [{"name": n, "type": "string"} for n in
                    ["tmc", "miles", "avg_speedlimit", "aadt", "aadt_singl",
                     "aadt_combi", "congestion_level", "directionality",
                     "f_system", "faciltype"]],
        "source_id": 1946, "env": "npmrds2", "srcEnv": "npmrds2",
        "isDms": False, "baseUrl": "", "type": "ny_2025_tmc_meta",
        "view_id": 3298,
    },
    "joinColumns": [{"dsColumn": "tmc", "joinSourceColumn": "tmc"}],
    "mergeStrategy": "join", "type": "left",
}
# dist_key mirrors old getDist(): WEEKEND collapses to [weekdayType, roadType],
# WEEKDAY needs congestion_level + directionality + roadType — all only
# available on table1 (ny_2025_tmc_meta), joined as a calculated dsColumn
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
CO2_EXPR_PASSENGER = (
    f"(({_CO2_CAR_FACTOR.format(s=_SPEED_CAR_EXPR)}) "
    f"* ({_AADT_CAR_EXPR} * table1.miles) / 1000000) as avg_co2_emissions")
CO2_EXPR_TRUCK = (
    f"(({_CO2_TRUCK_FACTOR.format(s=_SPEED_TRUCK_EXPR)}) "
    f"* ({_AADT_TRUCK_EXPR} * table1.miles) / 1000000) as avg_co2_emissions")

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
_AADT_DELAY_FRAGMENT = "(table1.aadt / (if(table1.faciltype > 1, 2, 1)))"
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
    "tmc_speed_bar_graph_day": {
        "graphType": "BarGraph", "xAxis": "date",
        "yAxis": {"type": "calculated", "show": True, "name": SPEED_EXPR,
                  "target": "yAxis", "fn": "avg"},
    },
    "tmc_travel_time_bar_graph_day": {
        "graphType": "BarGraph", "xAxis": "date",
        "yAxis": {"type": "calculated", "show": True, "name": TRAVEL_TIME_EXPR,
                  "target": "yAxis", "fn": "avg"},
    },
    "tmc_delay_bar_graph_day": {
        "graphType": "BarGraph", "xAxis": "date",
        "yAxis": {"type": "calculated", "show": True, "name": DELAY_EXPR,
                  "target": "yAxis", "fn": "sum"},
        "join": {"table1": META_1946_JOIN, "table2": AADT_DIST_JOIN},
    },
    # GridGraph shape (xAxis=epoch, target=color) mirroring the existing
    # tmc_speed_grid_graph — "avg" fn averages each epoch's value across the
    # dates in range, same convention already verified live for speed.
    "tmc_co2_grid_graph_passenger": {
        "graphType": "GridGraph", "xAxis": "epoch",
        "yAxis": {"type": "calculated", "show": True, "name": CO2_EXPR_PASSENGER,
                  "target": "color", "fn": "avg"},
        "join": {"table1": META_1946_JOIN, "table2": AADT_DIST_JOIN},
    },
    "tmc_co2_grid_graph_truck": {
        "graphType": "GridGraph", "xAxis": "epoch",
        "yAxis": {"type": "calculated", "show": True, "name": CO2_EXPR_TRUCK,
                  "target": "color", "fn": "avg"},
        "join": {"table1": META_1946_JOIN, "table2": AADT_DIST_JOIN},
    },
    "tmc_delay_bar_graph_weekday": {
        "graphType": "BarGraph",
        "xAxis": {"type": "calculated", "show": True, "name": WEEKDAY_EXPR,
                  "target": "xAxis", "group": True, "sort": "asc"},
        "yAxis": {"type": "calculated", "show": True, "name": DELAY_EXPR,
                  "target": "yAxis", "fn": "sum"},
        "join": {"table1": META_1946_JOIN, "table2": AADT_DIST_JOIN},
    },
    "tmc_delay_bar_graph_5min": {
        "graphType": "BarGraph", "xAxis": "epoch", "categorize": "tmc",
        "yAxis": {"type": "calculated", "show": True, "name": DELAY_EXPR,
                  "target": "yAxis", "fn": "sum"},
        "join": {"table1": META_1946_JOIN, "table2": AADT_DIST_JOIN},
    },
    # Same per-TMC shape as tmc_delay_bar_graph_5min above, at day resolution.
    # Named distinctly from tmc_delay_bar_graph_day (Route Bar Graph's
    # route-wide-sum/__series shape) since both would otherwise collide.
    "tmc_delay_bar_graph_day_tmc": {
        "graphType": "BarGraph", "xAxis": "date", "categorize": "tmc",
        "yAxis": {"type": "calculated", "show": True, "name": DELAY_EXPR,
                  "target": "yAxis", "fn": "sum"},
        "join": {"table1": META_1946_JOIN, "table2": AADT_DIST_JOIN},
    },
    "tmc_delay_bar_graph_hour_tmc": {
        "graphType": "BarGraph",
        "xAxis": {"type": "calculated", "show": True, "name": HOUR_EXPR,
                  "target": "xAxis", "group": True, "sort": "asc"},
        "categorize": "tmc",
        "yAxis": {"type": "calculated", "show": True, "name": DELAY_EXPR,
                  "target": "yAxis", "fn": "sum"},
        "join": {"table1": META_1946_JOIN, "table2": AADT_DIST_JOIN},
    },
    "tmc_delay_bar_graph_15min_tmc": {
        "graphType": "BarGraph",
        "xAxis": {"type": "calculated", "show": True, "name": QUARTER_HOUR_EXPR,
                  "target": "xAxis", "group": True, "sort": "asc"},
        "categorize": "tmc",
        "yAxis": {"type": "calculated", "show": True, "name": DELAY_EXPR,
                  "target": "yAxis", "fn": "sum"},
        "join": {"table1": META_1946_JOIN, "table2": AADT_DIST_JOIN},
    },
    "tmc_delay_bar_graph_month_tmc": {
        "graphType": "BarGraph",
        "xAxis": {"type": "calculated", "show": True, "name": MONTH_EXPR,
                  "target": "xAxis", "group": True, "sort": "asc"},
        "categorize": "tmc",
        "yAxis": {"type": "calculated", "show": True, "name": DELAY_EXPR,
                  "target": "yAxis", "fn": "sum"},
        "join": {"table1": META_1946_JOIN, "table2": AADT_DIST_JOIN},
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


def build_route_entry(rc, old_route, graph_tracking_ids, old_report_id, gaps,
                      tmc_override=None):
    settings = rc.get("settings") or {}
    route_settings_gaps(settings, rc.get("name"), gaps)
    start = to_datetime_str(settings.get("startDate"), settings.get("startTime"))
    end = to_datetime_str(settings.get("endDate"), settings.get("endTime"))
    entry = {
        "name": rc.get("name") or (old_route or {}).get("name") or "",
        "route_id": str(rc.get("routeId")),
        "tmc_array": js(tmc_override
                        or (old_route or {}).get("tmc_array") or []),
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
        # state.activeRouteComponents (absent → the graph showed every comp)
        "graphIds": list(graph_tracking_ids),
        # Preserve the old comp verbatim — schema-free row, nothing is lost
        "_old_settings": settings,
        "_old_color": rc.get("color"),
        "_old_report_id": old_report_id,
    }
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
    rows = dms(["raw", "list", f"npmrdsv5+{GRAPH_TEMPLATE_TYPE}"])
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
        y_idx = next((i for i, c in enumerate(cols) if c.get("target") == "yAxis"), None)
        if y_idx is None or cols[y_idx].get("name") == spec["yAxis"]["name"]:
            continue  # no drift
        cols[y_idx] = dict(spec["yAxis"])
        new_data = {**existing["data"], "stateJson": json.dumps(existing_state),
                    "updatedAt": now_iso()}
        if dry_run:
            print(f"[dry-run] would update drifted template '{name}' "
                  f"id={existing['id']} (yAxis expr changed)")
        else:
            dms(["raw", "update", str(existing["id"])], data=new_data)
            print(f"updated template '{name}' id={existing['id']} "
                  f"(yAxis expr drift fix)")
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
        # xAxis above.
        cat_spec = spec.get("categorize")
        if cat_spec is None:
            cat_col = next(c for c in state["columns"]
                           if c.get("name") == "__series")
        elif isinstance(cat_spec, dict):
            cat_col = cat_spec
        else:
            cat_src = next(c for c in state["externalSource"]["columns"]
                           if c.get("name") == cat_spec)
            cat_col = {**cat_src, "show": True, "target": "categorize",
                       "group": True}
        state["columns"] = [spec["yAxis"], x_col, cat_col]
        state["display"]["graphType"] = spec["graphType"]
        if spec.get("join"):
            state["join"] = {"sources": spec["join"]}
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
    if existing is not None:
        return templates
    base = templates.get(TEMPLATE_BASE_NAME)
    if not base:
        raise RuntimeError(f"base template '{TEMPLATE_BASE_NAME}' not found")
    base_state = json.loads(base["data"]["stateJson"])
    series_col = next(c for c in base_state["columns"]
                      if c.get("name") == "__series")
    value_col = {"type": "calculated", "show": True,
                 "name": f"{raw_expr} as {alias}", "fn": "avg"}
    agg_expr = f"avg({raw_expr})"
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
        # `avg(expr)` twice — once inline, once inside __ANCHOR__'s subquery —
        # and ClickHouse's two evaluations aren't bit-identical, leaving a
        # ~1e-14 floating-point residual instead of exact 0. DeltaView's
        # neutral/gray "no change" state (ui/columnTypes/delta.jsx) is a
        # strict `n === 0` check, so that residual fell through to the
        # colored arrow branch — flipping red/green at random (whichever way
        # the noise happened to round) and making the anchor row impossible
        # to visually distinguish (found live, 2026-07-10). Rounding to 2
        # decimals is far coarser than the noise floor, so the anchor always
        # comes back as a clean, exact 0.
        "name": f"round(({agg_expr} - {anchor}) / {anchor} * 100, 2) as {alias}_delta",
    }
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


def analyze_graph(g, comps_by_id, gaps):
    """Extract the conversion-relevant facts from an old graph_comp:
    measure (displayData), resolution, dataColumn, assigned comps, title,
    description. Old semantics: a graph shows state.activeRouteComponents
    (default: every comp); state.resolution overrides the comps' own.
    "Hours of Delay Graph" and "TMC Info Box" are documented exceptions
    (HoursOfDelayGraph.jsx/TmcInfoBox.jsx, confirmed against
    GeneralGraphComp.jsx): generateGraphData([route], ...) destructures only
    the FIRST matching active comp — getActiveRouteComponents() defaults to
    [routes[0].compId], never "every comp" like the general case below. Only
    "Hours of Delay Graph" also hardcodes its measure ('hoursOfDelay',
    ignoring state.displayData) — TMC Info Box keeps the normal
    displayData[0] measure resolution, it's single-route-only, not
    single-measure-only."""
    state = g.get("state") or {}
    gtype = g.get("type")
    if gtype in ("Hours of Delay Graph", "TMC Info Box"):
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
    else:
        resolution = None
        gaps.append({"kind": "mixed_resolutions_on_graph", "graph": g.get("id"),
                     "detail": sorted(map(str, resolutions))})
    data_columns = {(comps_by_id[c].get("settings") or {}).get("dataColumn")
                    for c in assigned}
    if len(data_columns) == 1:
        data_column = next(iter(data_columns))
    else:
        data_column = None
        gaps.append({"kind": "mixed_data_columns_on_graph", "graph": g.get("id"),
                     "detail": sorted(map(str, data_columns))})
    # "{data} AM Peak" / "{type}, {data}" / "{data} {name}" title templates →
    # literal text ({name} = the assigned route comp's display name)
    title = (state.get("title") or "")
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
                             color_range=None, aadt_override=None):
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
    if color_range and old_graph.get("type") in COLOR_RANGE_GRAPH_TYPES:
        colors_cfg = {"type": "palette", "value": color_range}
        # BarGraph colors by series by default (one color per route) — these
        # converted reports are single-series magnitude charts (the old
        # client colored each bar by its own value: "more delay = darker"),
        # so opt into BarGraph's byValue coloring mode to match.
        if state.get("display", {}).get("graphType") == "BarGraph":
            colors_cfg["byValue"] = True
        state.setdefault("display", {})["colors"] = colors_cfg
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
    old_routes = fetch_old_routes([rc["routeId"] for rc in route_comps
                                   if rc.get("routeId")])
    if old.get("station_comps"):
        gaps.append({"kind": "station_comps",
                     "detail": f"{len(old['station_comps'])} station comps not converted"})
    # -- per-graph analysis + template mapping
    comps_by_id = {rc.get("compId"): rc for rc in route_comps if rc.get("compId")}
    graph_templates = load_graph_templates()
    page_template = load_page_template()
    analyzed = [(g, analyze_graph(g, comps_by_id, gaps))
                for g in old.get("graph_comps") or []]
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
        if (info["measure"], info["resolution"], info["data_column"]) != INFO_BOX_BUCKET:
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

    convertible, skipped = [], []
    for g, info in analyzed:
        gid = g.get("id")
        is_info_box = info["type"] in INFO_BOX_GRAIN
        is_route_compare = info["type"] == "Route Compare Component"
        key = (info["type"], info["measure"], info["resolution"],
               info["data_column"])
        tmpl_name = (info_box_tmpl_name.get(gid) if is_info_box
                    else route_compare_tmpl_name.get(gid) if is_route_compare
                    else GRAPH_TEMPLATE_MAP.get(key))
        if tmpl_name and tmpl_name in graph_templates:
            convertible.append((g, info, graph_templates[tmpl_name]))
            continue
        skipped.append(g)
        if gid in info_box_gap_logged or gid in route_compare_gap_logged:
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
                                     aadt_override=aadt_ov))
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
