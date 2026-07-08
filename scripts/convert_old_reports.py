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
}

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
SPEED_EXPR = "((table1.miles * 3600)/ ds.travel_time_all_vehicles) as speed"
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
_SPEED_CAR_EXPR = ("(table1.miles * (3600.0 / "
                    "coalesce(ds.travel_time_passenger_vehicles, ds.travel_time_all_vehicles)))")
_SPEED_TRUCK_EXPR = ("(table1.miles * (3600.0 / "
                      "coalesce(ds.travel_time_freight_trucks, ds.travel_time_all_vehicles)))")
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

TEMPLATE_SPECS = {
    "tmc_speed_bar_graph_day": {
        "graphType": "BarGraph", "xAxis": "date",
        "yAxis": {"type": "calculated", "show": True, "name": SPEED_EXPR,
                  "target": "yAxis", "fn": "avg"},
    },
    "tmc_travel_time_bar_graph_day": {
        "graphType": "BarGraph", "xAxis": "date",
        "yAxis": {"name": "travel_time_all_vehicles", "type": "number",
                  "source_id": 583, "show": True, "target": "yAxis", "fn": "avg"},
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
}
TEMPLATE_BASE_NAME = "tmc_travel_time_line_graph"


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
    if settings.get("overrides"):
        gaps.append({"kind": "overrides", "route": comp_name,
                     "detail": settings["overrides"]})
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
    base template's stateJson so externalSource/display stay UI-consistent."""
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
        series_col = next(c for c in state["columns"]
                          if c.get("name") == "__series")
        state["columns"] = [spec["yAxis"], x_col, series_col]
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
    (default: every comp); state.resolution overrides the comps' own."""
    state = g.get("state") or {}
    gtype = g.get("type")
    assigned = [c for c in (state.get("activeRouteComponents") or [])
                if c in comps_by_id] or list(comps_by_id)
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
    resolutions = {(comps_by_id[c].get("settings") or {}).get("resolution")
                   for c in assigned}
    if state.get("resolution"):
        resolution = state["resolution"]
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
                             color_range=None):
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
              for _, i in analyzed} - {None}
    graph_templates = ensure_graph_templates(needed, graph_templates, dry_run)

    convertible, skipped = [], []
    for g, info in analyzed:
        key = (info["type"], info["measure"], info["resolution"],
               info["data_column"])
        tmpl_name = GRAPH_TEMPLATE_MAP.get(key)
        if tmpl_name and tmpl_name in graph_templates:
            convertible.append((g, info, graph_templates[tmpl_name]))
        else:
            skipped.append(g)
            gaps.append({"kind": "unmapped_graph", "detail": {
                "graph": g.get("id"), "graph_type": info["type"],
                "measure": info["measure"], "resolution": info["resolution"],
                "dataColumn": info["data_column"],
                "reason": ("no template mapping" if not tmpl_name
                           else f"template '{tmpl_name}' not found in DB")}})

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
    for (g, info, tmpl), tid in zip(convertible, graph_tracking_ids):
        section_datas.append(
            build_graph_section_data(page_id, tmpl, tid, info, gaps, g,
                                     color_range=old.get("color_range")))
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
