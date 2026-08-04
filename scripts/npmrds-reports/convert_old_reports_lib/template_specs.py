from .vocab import _diff_colors
from .expressions import AADT_DIST_JOIN, AVG_DELAY_EXPR, AVG_DELAY_SUMMARY_5MIN_EXPR, AVG_DELAY_SUMMARY_DAY_EXPR, AVG_DELAY_SUMMARY_WEEKDAY_EXPR, CO2_EXPR_PASSENGER, CO2_EXPR_TRUCK, DELAY_EXPR, HOUR_EXPR, META_JOIN, MONTH_EXPR, QUARTER_HOUR_EXPR, SPEED_EXPR, SPEED_EXPR_TRUCK, SPEED_SUMMARY_EXPR, TRAVEL_TIME_EXPR, WEEKDAY_EXPR

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
    "tmc_speed_line_graph_truck": {
        "graphType": "LineGraph", "xAxis": "epoch",
        "yAxis": {"type": "calculated", "show": True, "name": SPEED_EXPR_TRUCK,
                  "target": "yAxis", "fn": "exempt", "customName": "Truck Speed (mph)"},
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


