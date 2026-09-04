from .expressions import AADT_DIST_JOIN, DELAY_EXPR, HOUR_EXPR, META_JOIN, MONTH_EXPR, QUARTER_HOUR_EXPR, SPEED_EXPR, TRAVEL_TIME_EXPR

# Round 77 (2026-08-27): every LineGraph/BarGraph/Bar Graph Summary/Route
# Difference entry that USED to live here as a hand-built dict (same shape as
# the pre-round-76 GridGraph entries) has been migrated to BRIDGE_GRAPH_SPECS
# below — see that dict's own header comment for the full "why" (two
# independent reimplementations drifting, round 76's architectural fix).
# Only two categories of entry are still hand-built, both for real structural
# reasons, not inertia:
#
# 1. `tmc_travel_time_line_graph` (TEMPLATE_BASE_NAME) — every mint branch in
#    this file AND graph_templates.py's ensure_bridge_graph_templates sources
#    row-envelope fields (layoutJson/includesLayout/includesSource/createdBy/
#    updatedBy) from whichever row THIS name currently resolves to in the DB.
#    Migrating its own SPEC to the bridge would replace its OWN stateJson
#    with a from-scratch bridge-composed shape — untested as a base for the
#    remaining hand-built mint path below (which reads structural assumptions
#    off the base's `state["columns"]`/`state["externalSource"]` that were
#    never verified against a bridge-composed shape). Kept hand-built
#    deliberately, not migrated by omission — a follow-up could verify the
#    bridge shape is a safe base and fold this in too.
# 2. The 5 "Hours of Delay Graph" `categorize: "tmc"` entries below — a real,
#    newly-found gap: composeMeasureConfig.js has NO mechanism to add a
#    per-TMC breakdown column to a BarGraph (only GridGraph's yAxis-targeted
#    breakdown, via buildGridBreakdownColumn). This is a genuinely different
#    old component (Hours of Delay Graph: one bar per TMC, not one bar per
#    route) from "Route Bar Graph"'s route-wide shape — same class of gap as
#    avgHoursOfDelay-summary was before this round (a small, scoped
#    composeMeasureConfig.js capability that doesn't exist yet), flagged for
#    a follow-up round rather than built here.
# Default `display.legend.position` for the templates below — kept in sync BY HAND with
# `composeMeasureConfig.js`'s `DEFAULT_LEGEND_POSITION_BY_GRAPH_TYPE` (2026-09-01, Ryan's call:
# bottom for now, may change/differ per graph type later; flipped to top 2026-09-04 — see that
# map's own comment). These two hand-built categories
# (this base LineGraph template + the 5 per-TMC BarGraph entries below) are the only templates
# NOT composed via the real JS through `compose_bridge.py` (see this file's own header comment for
# why) — every other template already inherits the JS-side default for free. If you change one
# side, change the other.
_DEFAULT_LEGEND_POSITION = {"LineGraph": "top", "BarGraph": "top"}

TEMPLATE_SPECS = {
    "tmc_travel_time_line_graph": {
        "graphType": "LineGraph", "xAxis": "epoch",
        "yAxis": {"type": "calculated", "show": True, "name": TRAVEL_TIME_EXPR,
                  "target": "yAxis", "fn": "exempt",
                  "customName": "Travel Time (min)"},
        "display": {"legend": {"position": _DEFAULT_LEGEND_POSITION["LineGraph"]}},
    },
    # Round-29-family per-TMC breakdown ("Hours of Delay Graph" — a different
    # old component from "Route Bar Graph"'s route-wide __series default):
    # categorize: "tmc" fans the bar graph out into one series per TMC.
    # composeMeasureConfig.js has no equivalent of this for BarGraph today
    # (see the module header comment above) — stays hand-built.
    "tmc_delay_bar_graph_5min": {
        "graphType": "BarGraph", "xAxis": "epoch", "categorize": "tmc",
        "yAxis": {"type": "calculated", "show": True, "name": DELAY_EXPR,
                  "target": "yAxis", "fn": "sum"},
        "join": {"table1": META_JOIN, "table2": AADT_DIST_JOIN},
        "display": {"legend": {"position": _DEFAULT_LEGEND_POSITION["BarGraph"]}},
    },
    # Same per-TMC shape as tmc_delay_bar_graph_5min above, at day resolution.
    # Named distinctly from the (now bridge-composed) route-wide day template
    # since both would otherwise collide.
    "tmc_delay_bar_graph_day_tmc": {
        "graphType": "BarGraph", "xAxis": "date", "categorize": "tmc",
        "yAxis": {"type": "calculated", "show": True, "name": DELAY_EXPR,
                  "target": "yAxis", "fn": "sum"},
        "join": {"table1": META_JOIN, "table2": AADT_DIST_JOIN},
        "display": {"legend": {"position": _DEFAULT_LEGEND_POSITION["BarGraph"]}},
    },
    "tmc_delay_bar_graph_hour_tmc": {
        "graphType": "BarGraph",
        "xAxis": {"type": "calculated", "show": True, "name": HOUR_EXPR,
                  "target": "xAxis", "group": True, "sort": "asc"},
        "categorize": "tmc",
        "yAxis": {"type": "calculated", "show": True, "name": DELAY_EXPR,
                  "target": "yAxis", "fn": "sum"},
        "join": {"table1": META_JOIN, "table2": AADT_DIST_JOIN},
        "display": {"legend": {"position": _DEFAULT_LEGEND_POSITION["BarGraph"]}},
    },
    "tmc_delay_bar_graph_15min_tmc": {
        "graphType": "BarGraph",
        "xAxis": {"type": "calculated", "show": True, "name": QUARTER_HOUR_EXPR,
                  "target": "xAxis", "group": True, "sort": "asc"},
        "categorize": "tmc",
        "yAxis": {"type": "calculated", "show": True, "name": DELAY_EXPR,
                  "target": "yAxis", "fn": "sum"},
        "join": {"table1": META_JOIN, "table2": AADT_DIST_JOIN},
        "display": {"legend": {"position": _DEFAULT_LEGEND_POSITION["BarGraph"]}},
    },
    "tmc_delay_bar_graph_month_tmc": {
        "graphType": "BarGraph",
        "xAxis": {"type": "calculated", "show": True, "name": MONTH_EXPR,
                  "target": "xAxis", "group": True, "sort": "asc"},
        "categorize": "tmc",
        "yAxis": {"type": "calculated", "show": True, "name": DELAY_EXPR,
                  "target": "yAxis", "fn": "sum"},
        "join": {"table1": META_JOIN, "table2": AADT_DIST_JOIN},
        "display": {"legend": {"position": _DEFAULT_LEGEND_POSITION["BarGraph"]}},
    },
}
TEMPLATE_BASE_NAME = "tmc_travel_time_line_graph"
# Route Compare Component's per-measure raw expression (see ROUTE_COMPARE_BUCKET
# above). speed + travelTime cover the signal_timing composition class (71%
# each) — the rest of ROUTE_COMPARE_BUCKET's corpus scope.
#
# travelTime does NOT reuse TRAVEL_TIME_EXPR verbatim — it needs its own
# ds.-qualified copy, for a real reason found live (2026-07-29), not
# theoretical: round 35 (2026-07-13) originally set TRAVEL_TIME_EXPR to
# `ds.`-qualified columns (mirrors SPEED_EXPR exactly), verified correct for
# every WITH-JOIN template that uses it (this one, and Route Map's choropleth
# via TRAVEL_TIME_VALUE_EXPR). The 2026-07-24 vocabulary.json fix (see
# research/npmrds-reports/reportroutelist-cross-repo-sync.md) then stripped
# the `ds.` prefix from GRAPH_VOCAB's travelTime expr — correctly, for THAT
# fix's own context (AVL Graph's no-join vocabulary path, where `ds.` is
# unresolvable) — but TRAVEL_TIME_EXPR is defined as
# `GRAPH_VOCAB["measures"]["travelTime"]["expr"]`, so that fix silently
# regressed every WITH-JOIN caller too. Live-caught here: bare columns make
# `build_route_compare_section_state`'s delta query fail with ClickHouse
# error "Aggregate function avgMapIf(...) is found inside another aggregate
# function" — with the `ds.` prefix restored (this constant), the exact same
# query returns correct values (cross-checked against Info Box's travelTime
# numbers for the same routes: 5.3729/4.5079 min, exact match). Route Map's
# travelTime choropleth likely has this same live regression today (also
# WITH-JOIN, also derives from TRAVEL_TIME_EXPR) — flagged, not fixed here;
# out of this task's scope, and Route Map's failure mode may differ (a
# choropleth bake rather than a live query, so it might not error the same
# way — needs its own check before assuming the fix is identical).
ROUTE_COMPARE_TRAVELTIME_EXPR = (
    "arraySum(mapValues(avgMapIf(map(ds.tmc, toFloat64(ds.travel_time_all_vehicles)), "
    "ds.travel_time_all_vehicles != 0))) / 60 as travel_time_all_vehicles"
)
MEASURE_EXPR = {"speed": SPEED_EXPR, "travelTime": ROUTE_COMPARE_TRAVELTIME_EXPR}


# ── Bridge-composed specs (2026-08-26, extended 2026-08-27) ─────────────────
# GridGraph's 18 templates used to be hand-built TEMPLATE_SPECS entries here,
# same shape as every LineGraph/BarGraph one above — see the archived
# old-reports-conversion.md rounds 74/75 for the two live-reported bugs that
# shape caused (y-axis "NaN", confetti color scale): the base LineGraph
# template's display.yAxis/colors got deep-copied verbatim into GridGraph
# specs, which have inverted axis semantics (yAxis holds the categorize
# column, not the measure) that hand-built TEMPLATE_SPECS entries had no
# mechanism to account for except one manually-added guard per bug found.
# `composeMeasureConfig.js` (the live in-app Measure Picker,
# `report_build.mjs`'s own compose path) already gets this right — round 75's
# fix was a hand port of ITS logic, immediately raising the obvious question
# (round 75 also flagged this to the user): why maintain two independent
# reimplementations of the same graph-composition logic at all? These entries
# are now built by calling the REAL `applyMeasurePick` through
# `compose_bridge.mjs` instead (`graph_templates.py`'s
# `ensure_bridge_graph_templates`, a sibling to `ensure_graph_templates`
# above) — one shared source of truth, not two that drift.
#
# Round 77 (2026-08-27) extended this from GridGraph-only to every
# LineGraph/BarGraph/Bar Graph Summary/Route Difference entry that
# composeMeasureConfig.js can compose directly — the SAME mechanism, just a
# different `graphType`/`resolutionKey` value; no bridge/compose code changed
# to do this, only moving dict entries (see old-reports-conversion.md round
# 77 for the full per-entry migration table). The `tmc_avg_delay_summary_
# bar_graph_*` entries below needed one small, real JS addition first —
# composeMeasureConfig.js had no equivalent of expressions.py's per-grain
# `_avg_delay_summary_expr` (avgHoursOfDelay's summary value is bucket-grain-
# dependent, unlike every other summary measure) — see that file's
# `avgDelaySummaryExpr`/`summaryDelayGrainKey` for the port. Two entries NOT
# migrated (Info Box, Route Compare Component) and one whole family NOT
# migrated (Route Map) stay out of scope — neither has a composeMeasureConfig.js
# equivalent to call at all, a materially bigger lift than a dict move (see
# old-reports-conversion.md's Tier 3/4 scoping).
#
# `measureKey`/`resolutionKey` are `vocabulary.json` measure/resolution keys
# (the same file `SPEED_EXPR` etc. above already derive from), not the raw
# SQL expr constants the removed entries used — composeMeasureConfig looks
# these up itself. The `avgCo2Emissions_*` diff entries use vocabulary's own
# dedicated avg-CO2 measure (a genuinely different expression, not just an
# `fn:"avg"` override on the sum-shaped `co2Emissions_*` expr the removed
# entries used) — per Ryan's own call (2026-08-26, reaffirmed for round 77's
# extension): CO2 numbers have never been human-verified end to end, low
# priority, so defer to vocabulary.json's canonical definition rather than
# preserve Python's own unverified prior construction. Flagged here for
# whenever that verification happens.
BRIDGE_GRAPH_SPECS = {
    "tmc_speed_grid_graph": {"graphType": "GridGraph", "measureKey": "speed", "resolutionKey": "5-minutes"},
    "tmc_speed_grid_graph_tmc": {"graphType": "GridGraph", "measureKey": "speed", "resolutionKey": "5-minutes"},
    "tmc_travel_time_grid_graph": {"graphType": "GridGraph", "measureKey": "travelTime", "resolutionKey": "5-minutes"},
    "tmc_travel_time_grid_graph_tmc": {"graphType": "GridGraph", "measureKey": "travelTime", "resolutionKey": "5-minutes"},
    "tmc_avg_delay_grid_graph": {"graphType": "GridGraph", "measureKey": "avgHoursOfDelay", "resolutionKey": "5-minutes"},
    "tmc_avg_delay_grid_graph_tmc": {"graphType": "GridGraph", "measureKey": "avgHoursOfDelay", "resolutionKey": "5-minutes"},
    "tmc_co2_grid_graph_passenger": {"graphType": "GridGraph", "measureKey": "avgCo2Emissions_passenger", "resolutionKey": "5-minutes"},
    "tmc_co2_grid_graph_passenger_tmc": {"graphType": "GridGraph", "measureKey": "avgCo2Emissions_passenger", "resolutionKey": "5-minutes"},
    "tmc_co2_grid_graph_truck": {"graphType": "GridGraph", "measureKey": "avgCo2Emissions_truck", "resolutionKey": "5-minutes"},
    "tmc_co2_grid_graph_truck_tmc": {"graphType": "GridGraph", "measureKey": "avgCo2Emissions_truck", "resolutionKey": "5-minutes"},
    "tmc_diff_grid_speed_5min": {"graphType": "GridGraph", "measureKey": "speed", "resolutionKey": "5-minutes", "comparisonModeKey": "difference"},
    "tmc_diff_grid_speed_15min": {"graphType": "GridGraph", "measureKey": "speed", "resolutionKey": "15-minutes", "comparisonModeKey": "difference"},
    "tmc_diff_grid_speed_5min_truck": {"graphType": "GridGraph", "measureKey": "speedTruck", "resolutionKey": "5-minutes", "comparisonModeKey": "difference"},
    "tmc_diff_grid_travel_time_5min": {"graphType": "GridGraph", "measureKey": "travelTime", "resolutionKey": "5-minutes", "comparisonModeKey": "difference"},
    "tmc_diff_grid_delay_5min": {"graphType": "GridGraph", "measureKey": "hoursOfDelay", "resolutionKey": "5-minutes", "comparisonModeKey": "difference"},
    "tmc_diff_grid_avg_delay_5min": {"graphType": "GridGraph", "measureKey": "avgHoursOfDelay", "resolutionKey": "5-minutes", "comparisonModeKey": "difference"},
    "tmc_diff_grid_avg_co2_5min_passenger": {"graphType": "GridGraph", "measureKey": "avgCo2Emissions_passenger", "resolutionKey": "5-minutes", "comparisonModeKey": "difference"},
    "tmc_diff_grid_avg_co2_5min_truck": {"graphType": "GridGraph", "measureKey": "avgCo2Emissions_truck", "resolutionKey": "5-minutes", "comparisonModeKey": "difference"},

    # Round 77 — LineGraph (2; tmc_travel_time_line_graph stays hand-built, see above)
    "tmc_speed_line_graph": {"graphType": "LineGraph", "measureKey": "speed", "resolutionKey": "5-minutes"},
    "tmc_speed_line_graph_truck": {"graphType": "LineGraph", "measureKey": "speedTruck", "resolutionKey": "5-minutes"},
    "tmc_avg_delay_line_graph": {"graphType": "LineGraph", "measureKey": "avgHoursOfDelay", "resolutionKey": "5-minutes"},

    # Round 77 — Route Bar Graph / route-wide Hours-of-Delay (18; the 5
    # categorize:"tmc" Hours-of-Delay-Graph siblings stay hand-built, see above)
    "tmc_speed_bar_graph_day": {"graphType": "BarGraph", "measureKey": "speed", "resolutionKey": "day"},
    "tmc_travel_time_bar_graph_day": {"graphType": "BarGraph", "measureKey": "travelTime", "resolutionKey": "day"},
    "tmc_delay_bar_graph_day": {"graphType": "BarGraph", "measureKey": "hoursOfDelay", "resolutionKey": "day"},
    "tmc_delay_bar_graph_weekday": {"graphType": "BarGraph", "measureKey": "hoursOfDelay", "resolutionKey": "weekday"},
    "tmc_speed_bar_graph_5min": {"graphType": "BarGraph", "measureKey": "speed", "resolutionKey": "5-minutes"},
    "tmc_speed_bar_graph_hour": {"graphType": "BarGraph", "measureKey": "speed", "resolutionKey": "hour"},
    "tmc_speed_bar_graph_15min": {"graphType": "BarGraph", "measureKey": "speed", "resolutionKey": "15-minutes"},
    "tmc_speed_bar_graph_month": {"graphType": "BarGraph", "measureKey": "speed", "resolutionKey": "month"},
    "tmc_speed_bar_graph_weekday": {"graphType": "BarGraph", "measureKey": "speed", "resolutionKey": "weekday"},
    "tmc_travel_time_bar_graph_5min": {"graphType": "BarGraph", "measureKey": "travelTime", "resolutionKey": "5-minutes"},
    "tmc_travel_time_bar_graph_hour": {"graphType": "BarGraph", "measureKey": "travelTime", "resolutionKey": "hour"},
    "tmc_travel_time_bar_graph_month": {"graphType": "BarGraph", "measureKey": "travelTime", "resolutionKey": "month"},
    "tmc_travel_time_bar_graph_weekday": {"graphType": "BarGraph", "measureKey": "travelTime", "resolutionKey": "weekday"},
    "tmc_avg_delay_bar_graph_day": {"graphType": "BarGraph", "measureKey": "avgHoursOfDelay", "resolutionKey": "day"},
    "tmc_avg_delay_bar_graph_weekday": {"graphType": "BarGraph", "measureKey": "avgHoursOfDelay", "resolutionKey": "weekday"},
    "tmc_avg_delay_bar_graph_5min": {"graphType": "BarGraph", "measureKey": "avgHoursOfDelay", "resolutionKey": "5-minutes"},
    "tmc_avg_delay_bar_graph_hour": {"graphType": "BarGraph", "measureKey": "avgHoursOfDelay", "resolutionKey": "hour"},
    "tmc_avg_delay_bar_graph_month": {"graphType": "BarGraph", "measureKey": "avgHoursOfDelay", "resolutionKey": "month"},

    # Round 77 — Route Difference Graph (10; the BarGraph counterpart of the
    # tmc_diff_grid_* GridGraph diff entries above, same comparisonModeKey
    # mechanism, already proven live by those).
    "route_diff_speed_5min": {"graphType": "BarGraph", "measureKey": "speed", "resolutionKey": "5-minutes", "comparisonModeKey": "difference"},
    "route_diff_speed_15min": {"graphType": "BarGraph", "measureKey": "speed", "resolutionKey": "15-minutes", "comparisonModeKey": "difference"},
    "route_diff_speed_day": {"graphType": "BarGraph", "measureKey": "speed", "resolutionKey": "day", "comparisonModeKey": "difference"},
    "route_diff_speed_5min_truck": {"graphType": "BarGraph", "measureKey": "speedTruck", "resolutionKey": "5-minutes", "comparisonModeKey": "difference"},
    "route_diff_travel_time_5min": {"graphType": "BarGraph", "measureKey": "travelTime", "resolutionKey": "5-minutes", "comparisonModeKey": "difference"},
    "route_diff_delay_5min": {"graphType": "BarGraph", "measureKey": "hoursOfDelay", "resolutionKey": "5-minutes", "comparisonModeKey": "difference"},
    "route_diff_avg_delay_5min": {"graphType": "BarGraph", "measureKey": "avgHoursOfDelay", "resolutionKey": "5-minutes", "comparisonModeKey": "difference"},
    "route_diff_avg_co2_5min_passenger": {"graphType": "BarGraph", "measureKey": "avgCo2Emissions_passenger", "resolutionKey": "5-minutes", "comparisonModeKey": "difference"},
    "route_diff_avg_co2_5min_truck": {"graphType": "BarGraph", "measureKey": "avgCo2Emissions_truck", "resolutionKey": "5-minutes", "comparisonModeKey": "difference"},
    "route_diff_co2_5min_passenger": {"graphType": "BarGraph", "measureKey": "co2Emissions_passenger", "resolutionKey": "5-minutes", "comparisonModeKey": "difference"},

    # Round 77 — Bar Graph Summary (6; 3 direct + 3 needing the new
    # summaryDelayGrainKey capability — see composeMeasureConfig.js).
    "tmc_speed_summary_bar_graph": {"graphType": "BarGraph", "measureKey": "speed", "resolutionKey": "summary"},
    "tmc_travel_time_summary_bar_graph": {"graphType": "BarGraph", "measureKey": "travelTime", "resolutionKey": "summary"},
    "tmc_delay_summary_bar_graph": {"graphType": "BarGraph", "measureKey": "hoursOfDelay", "resolutionKey": "summary"},
    "tmc_avg_delay_summary_bar_graph_5min": {"graphType": "BarGraph", "measureKey": "avgHoursOfDelay", "resolutionKey": "summary", "summaryDelayGrainKey": "5-minutes"},
    "tmc_avg_delay_summary_bar_graph_day": {"graphType": "BarGraph", "measureKey": "avgHoursOfDelay", "resolutionKey": "summary", "summaryDelayGrainKey": "day"},
    "tmc_avg_delay_summary_bar_graph_weekday": {"graphType": "BarGraph", "measureKey": "avgHoursOfDelay", "resolutionKey": "summary", "summaryDelayGrainKey": "weekday"},

    # Round 78 (2026-08-27) — Route Compare Component (2). Table-shaped, not
    # chart-shaped: `composeTableMeasuresConfig` (built 2026-08-21 for an
    # unrelated Table "Route Compare" checkbox feature) already produces the
    # exact same delta-column mechanism `route_compare_template.py` hand-built
    # — confirmed byte-identical `__ANCHOR__(...)`/rounding-residual/
    # deltaGoodDirection logic before migrating. `pageSize`/`showAttribution`
    # are bridge-only overrides (see compose_bridge.mjs's contract comment) —
    # Spreadsheet's own defaultState has no opinion on either; these match
    # route_compare_template.py's old hardcoded values so converted pages
    # don't change shape. Names preserved exactly (`route_compare_{measure}`)
    # for continuity with already-minted DB rows.
    "route_compare_speed": {"graphType": "Table", "measureKeys": ["speed"], "resolutionKey": "summary", "routeCompare": True, "pageSize": 50, "showAttribution": True},
    "route_compare_travelTime": {"graphType": "Table", "measureKeys": ["travelTime"], "resolutionKey": "summary", "routeCompare": True, "pageSize": 50, "showAttribution": True},

    # Round 79 (2026-08-27) — Info Box static (no year/bin dependency) measures
    # (10; 5 measures x 2 grains). The reliability bucket
    # (`{grain}_info_box_reliability_{year}_{bin}`) is NOT here — its name AND
    # composition depend on a per-report resolved year/bin, not expressible as
    # a static dict entry; see graph_templates.py's `ensure_dynamic_bridge_template`
    # and info_box_templates.py's `ensure_pm3_join_template`.
    "route_info_box_speed": {"graphType": "Table", "measureKeys": ["speed"], "resolutionKey": "summary", "grain": "route", "pageSize": 50, "showAttribution": True},
    "tmc_info_box_speed": {"graphType": "Table", "measureKeys": ["speed"], "resolutionKey": "summary", "grain": "tmc", "pageSize": 50, "showAttribution": True},
    "route_info_box_traveltime": {"graphType": "Table", "measureKeys": ["travelTime"], "resolutionKey": "summary", "grain": "route", "pageSize": 50, "showAttribution": True},
    "tmc_info_box_traveltime": {"graphType": "Table", "measureKeys": ["travelTime"], "resolutionKey": "summary", "grain": "tmc", "pageSize": 50, "showAttribution": True},
    "route_info_box_length": {"graphType": "Table", "measureKeys": ["length"], "resolutionKey": "summary", "grain": "route", "pageSize": 50, "showAttribution": True},
    "tmc_info_box_length": {"graphType": "Table", "measureKeys": ["length"], "resolutionKey": "summary", "grain": "tmc", "pageSize": 50, "showAttribution": True},
    "route_info_box_aadt": {"graphType": "Table", "measureKeys": ["aadt"], "resolutionKey": "summary", "grain": "route", "pageSize": 50, "showAttribution": True},
    "tmc_info_box_aadt": {"graphType": "Table", "measureKeys": ["aadt"], "resolutionKey": "summary", "grain": "tmc", "pageSize": 50, "showAttribution": True},
    "route_info_box_delay": {"graphType": "Table", "measureKeys": ["hoursOfDelay"], "resolutionKey": "summary", "grain": "route", "pageSize": 50, "showAttribution": True},
    "tmc_info_box_delay": {"graphType": "Table", "measureKeys": ["hoursOfDelay"], "resolutionKey": "summary", "grain": "tmc", "pageSize": 50, "showAttribution": True},
}
