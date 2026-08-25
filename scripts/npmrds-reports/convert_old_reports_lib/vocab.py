from .config import GRAPH_VOCAB

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
    # Template 90 (COVID Comparison): same LineGraph/epoch shape as
    # tmc_speed_line_graph, truck-column swap already proven for this exact
    # measure by route_diff_speed_5min_truck (SPEED_EXPR_TRUCK) — no new
    # formula, just the existing truck expression on the un-diffed graph type.
    ("Route Line Graph", "speed", "5-minutes", "travel_time_truck"): "tmc_speed_line_graph_truck",
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
# table names confirmed 2026-07-09 via data_manager.views). 2018-2020 backfill
# confirmed 2026-07-20 directly against data_manager.views/gis_datasets: views
# 3563 (2018, 36,095 rows)/3559 (2019, 46,619 rows)/3555 (2020, 48,700 rows)
# all carry the full 121-column schema, byte-identical to the 2021-2025 views
# (speed_pctl_85/lottr_*/tttr_* 100% non-null). A 2017 view also exists
# (3566, 32,915 rows) but is NOT included here: its schema is only 113
# columns — missing all 8 speed_pctl_* columns entirely, so `pm3.speed_pctl_85
# as freeflow` (ensure_pm3_join_template/ensure_bar_graph_summary_pm3_template)
# would fail outright against it. Adding 2017 needs a no-freeflow template
# variant or a product decision first, not a drop-in dict entry.
PM3_VIEW_BY_YEAR = {2018: 3563, 2019: 3559, 2020: 3555,
                    2021: 2587, 2022: 2575, 2023: 2567, 2024: 2568, 2025: 3425}
INFO_BOX_TITLES = {"route": "Route Reliability (LOTTR / TTTR / Freeflow, {bin}, {year})",
                    "tmc": "TMC Reliability (LOTTR / TTTR / Freeflow, {bin}, {year})"}
# Bar Graph Summary's `freeflow-byDateRange` measure — same pm3-keyed join as
# INFO_BOX_BUCKET above (source 1410's speed_pctl_85), bin-independent (a Bar
# Graph Summary bar is a whole-date-range aggregate, and 1410's speed
# percentiles have no time-of-day dimension anyway), so only `year` needs
# resolving. Built round 38 (ensure_bar_graph_summary_pm3_template) but left
# UNWIRED — the real corpus's 62 instances were all pre-2019-dated, outside
# 1410's then-current 2021-2025 coverage, so wiring it in would have produced
# 0 real flips. The round-66 2018-2020 backfill made that reasoning stale (22
# instances newly feasible at 2018, +1 at 2019); wired in round 68 (2026-07-20).
BAR_SUMMARY_PM3_BUCKET = ("freeflow-byDateRange", "travel_time_all")
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
# 2026-08-12: the real plain speed measure (miles/time, SPEED_EXPR — same
# expression the AVL Graph "speed" measure uses) — NOT the same bucket as
# INFO_BOX_BUCKET/INFO_BOX_TITLES above, which is actually the pm3 LOTTR/TTTR/
# freeflow reliability join under a confusingly-reused old internal "speed" key
# (see section_builders.py's INFO_BOX_SPEC_MEASURES comment). This is the
# measure Ryan's old-tool comparison found genuinely missing: `one_week_study`/
# `annual_average_study`'s old Route Info Box panels showed this, not reliability.
INFO_BOX_SPEED_TITLES = {"route": "Route Speed", "tmc": "TMC Speed"}
# Round 40: TMC_ATTRIBUTES' `length` key (group 'tmcAttribute', reducer
# sumReducer) — the route's total length in miles, summed once per DISTINCT
# assigned TMC (not per fetched row/epoch — the underlying CH rows are still
# per-(tmc,epoch), so summing table1.miles directly would multiply-count each
# TMC by however many epochs it has). Same arraySum/maxMap distinct-tmc
# combinator already proven in SPEED_EXPR's numerator. No year/bin/override
# dependency — a TMC's `miles` is a static join column, not a per-epoch fact.
INFO_BOX_LENGTH_BUCKET = ("length", "travel_time_all")
# 2026-08-24: ported into vocabulary.json's `measures.length` (gap #16's Info Box length/aadt
# port to the live authoring path) — read back out of it now, same convention every other
# route-grain measure constant in this file follows (see this file's own header comment).
LENGTH_EXPR = GRAPH_VOCAB["measures"]["length"]["expr"]
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
# 2026-08-24: same port as LENGTH_EXPR above — see its comment.
AADT_EXPR = GRAPH_VOCAB["measures"]["aadt"]["expr"]
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

# The Spreadsheet-cell `formatFn` a measure's plain VALUE column should carry
# in ANY Spreadsheet-shaped section (Info Box, Route Compare) — a single
# source of truth so the two builders (info_box_templates.py,
# route_compare_template.py) can't independently drift, the same class of bug
# already found once for `join` (2026-08-13, ensure_info_box_traveltime_
# template missed a join-drift fix its siblings got). Chart sections (Line/
# Bar/Grid Graph, Route Map) format their axis/tooltip/legend values through
# a completely SEPARATE mechanism (GraphComponent.jsx's getTooltipFormatFunc,
# display.yAxis.format, Map's colorDomain quantile labels) that shares no code
# with this dict — fixing one never fixes the other, by construction. Only
# measures actually used in a live Spreadsheet-shaped column belong here;
# omit a measure rather than guessing a format for one nothing renders yet.
TABLE_FORMAT_BY_MEASURE = {"speed": "decimal_2", "travelTime": "minutes_clock"}

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
DEFAULT_DIFF_COLOR_RANGE = GRAPH_VOCAB["comparisonModes"]["difference"]["defaultColorRange"]


def _diff_colors(bar, reverse):
    """Display patch for a difference template's default diverging colors:
    zero-centered (byValueSymmetric, the R52 platform toggle — old
    d3.scaleQuantize([-max, +max]) parity); bars also need byValue (grids
    always color by value). `reverse` is the measure's RAW-VALUE
    REVERSE_COLORS_MEASURES membership (old getColorRange()'s reverseColors
    handling), validated correct for coloring a raw value (round 51: low/good
    travelTime -> green). A difference graph colors a before-minus-after
    DELTA, not a raw value, and going from "which raw value is good" to
    "which delta sign is good" inverts the polarity for every measure (a
    positive travelTime delta means time fell -- also good -- but sits at the
    opposite end of the domain from a low raw value). So the diff-mode ramp
    applies the NEGATION of `reverse`, not `reverse` itself -- fixed
    2026-07-30, mirrors composeMeasureConfig.js's buildDiffColors (see
    "Finding: difference-graph color scale reads backwards" in
    report-spec-and-build-script.md). Reports carrying a real color_range get
    the same (now-corrected) reversal from the generic wiring in
    build_graph_section_data."""
    value = (list(DEFAULT_DIFF_COLOR_RANGE) if reverse
             else list(reversed(DEFAULT_DIFF_COLOR_RANGE)))
    cfg = {"type": "palette", "value": value, "byValueSymmetric": True}
    if bar:
        cfg["byValue"] = True
    return {"colors": cfg}

ALL_WEEKDAYS = {"monday", "tuesday", "wednesday", "thursday", "friday",
                "saturday", "sunday"}

