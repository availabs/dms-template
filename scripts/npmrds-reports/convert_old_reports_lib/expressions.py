from .config import GRAPH_VOCAB

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
SPEED_EXPR = GRAPH_VOCAB["measures"]["speed"]["expr"]
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
SPEED_EXPR_TRUCK = GRAPH_VOCAB["measures"]["speedTruck"]["expr"]
# Old-faithful route travel time (round 35): same two-level shape — the old
# travelTime measure is the ROUTE TRAVERSAL time in MINUTES (sum over TMCs of
# each TMC's mean tt, / 60), not the mean single-segment time in seconds that
# rounds 1-34 rendered (avg(tt) — wrong quantity AND scale; round 34 measured
# 103.5s vs the old tool's 4.58min on the report-520 fixture). Same avgMapIf
# 0-as-missing skip as SPEED_EXPR (subsumes round 23's nullIf fix).
TRAVEL_TIME_EXPR = GRAPH_VOCAB["measures"]["travelTime"]["expr"]
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
DELAY_EXPR = GRAPH_VOCAB["measures"]["hoursOfDelay"]["expr"]
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
AVG_DELAY_EXPR = GRAPH_VOCAB["measures"]["avgHoursOfDelay"]["expr"]

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
META_JOIN = GRAPH_VOCAB["joins"]["META_JOIN"]
AADT_DIST_JOIN = GRAPH_VOCAB["joins"]["AADT_DIST_JOIN"]
# dist_key mirrors old getDist(): WEEKEND collapses to [weekdayType, roadType],
# WEEKDAY needs congestion_level + directionality + roadType — all only
# available on table1 (NPMRDS_V6_tmc_meta, META_JOIN above), joined as a calculated dsColumn
# expression (the platform fix verified in the round-3 notes) rather than a
# plain column so it can reference an already-joined alias. Read off
# AADT_DIST_JOIN's own joinColumns rather than duplicated separately, so it
# can never drift from the join that actually uses it.
DIST_KEY_EXPR = AADT_DIST_JOIN["joinColumns"][0]["dsColumn"]
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
# CO2_EXPR_PASSENGER/CO2_EXPR_TRUCK are read from the shared vocabulary (both
# co2Emissions_passenger/truck and avgCo2Emissions_passenger/truck share the
# exact same "expr" — only the aggregation "fn" differs, which TEMPLATE_SPECS
# entries below set independently). The _CO2_*_FACTOR/_SPEED_*_EXPR/
# _AADT_*_EXPR fragments above stay Python-only: they're never composed into
# these two constants anymore, but AADT_OVERRIDE_SUBS below still needs
# _AADT_CAR_EXPR/_AADT_TRUCK_EXPR's exact substrings to find and replace
# inside whichever of these two expressions a report actually uses.
CO2_EXPR_PASSENGER = GRAPH_VOCAB["measures"]["co2Emissions_passenger"]["expr"]
CO2_EXPR_TRUCK = GRAPH_VOCAB["measures"]["co2Emissions_truck"]["expr"]

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
# DELAY_EXPR/CO2_EXPR_PASSENGER/CO2_EXPR_TRUCK now come from the shared
# vocabulary JSON (not composed from these same fragments in this file
# anymore), so these three assertions are the only thing still tying the
# fragments to the vocabulary's expression strings.
assert _AADT_DELAY_FRAGMENT in DELAY_EXPR
assert _AADT_CAR_EXPR in CO2_EXPR_PASSENGER
assert _AADT_TRUCK_EXPR in CO2_EXPR_TRUCK


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
WEEKDAY_EXPR = GRAPH_VOCAB["resolutions"]["weekday"]["xAxis"]["expr"]

# "Hours of Delay Graph" per-resolution xAxis buckets beyond 5-minutes/day
# (round 12, 2026-07-09) — same queryHelpers.js getResolution() switch as
# WEEKDAY_EXPR above: hour buckets epoch into 0-23 (`(epoch/12)::integer`, 12
# 5-minute epochs per hour); 15-minutes buckets epoch into 0-95
# (`(epoch/3)::integer`); month truncates the date to its first-of-month
# (`npmrds_month(date)`). All aggregate across the WHOLE date range into that
# bucket (e.g. hour bucket 7 sums every 7:00-7:55 epoch on every date in
# range) — same "bounded, not per-timestamp" shape as the 5-minutes/epoch
# template, just a coarser bucket.
HOUR_EXPR = GRAPH_VOCAB["resolutions"]["hour"]["xAxis"]["expr"]
QUARTER_HOUR_EXPR = GRAPH_VOCAB["resolutions"]["15-minutes"]["xAxis"]["expr"]
MONTH_EXPR = GRAPH_VOCAB["resolutions"]["month"]["xAxis"]["expr"]

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
