import json
import os
import re

import os as _os
import sys as _sys

_sys.path.insert(0, _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))))
import dbq  # noqa: E402 — sibling scripts/npmrds-reports/ module, read-only CH/PG query runner

from .config import GRAPH_TEMPLATE_TYPE
from .expressions import AADT_DIST_JOIN, DIST_KEY_EXPR, HOURS_OF_DELAY_VALUE_EXPR, META_JOIN, ROUTE_MAP_AVGDELAY_RESOLUTION_SLUG, ROUTE_MAP_AVGDELAY_VALUE_EXPR_BY_RESOLUTION, SPEED_VALUE_EXPR, TRAVEL_TIME_VALUE_EXPR
from .template_specs import TEMPLATE_BASE_NAME
from .db import dms, now_iso

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


def pooled_route_map_values(measure, tmcs, start_date, end_date, resolution=None):
    """Run the pooled per-TMC CH query behind a Route Map choropleth bake and
    return the list of non-null values, one per TMC in `tmcs` with data in
    [start_date, end_date] ('YYYY-MM-DD' strings). Extracted 2026-07-27 so the
    query text is shared between bake_route_map_choropleth_paint/
    bake_route_map_delay_paint (old-report conversion path, tmcs/dates resolved
    from old comps below) and build_route_map_section_state (spec-driven
    report_build.mjs path, tmcs/dates come straight from the spec's routes) —
    one definition, so the two callers can't drift apart."""
    tmc_list = ",".join(f"'{t}'" for t in sorted(tmcs))
    if measure in ROUTE_MAP_VALUE_EXPR:
        value_expr = ROUTE_MAP_VALUE_EXPR[measure]
        sql = (f"SELECT ds.tmc AS tmc, {value_expr} "
               f"FROM {CH_FACT_TABLE} AS ds "
               f"JOIN {CH_TMC_IDENT_TABLE} AS table1 ON ds.tmc = table1.tmc "
               f"WHERE ds.tmc IN ({tmc_list}) "
               f"AND ds.date >= '{start_date}' AND ds.date <= '{end_date}' "
               f"GROUP BY ds.tmc")
    else:
        value_expr = (HOURS_OF_DELAY_VALUE_EXPR if measure == "hoursOfDelay"
                     else ROUTE_MAP_AVGDELAY_VALUE_EXPR_BY_RESOLUTION[resolution])
        dist_key_body = DIST_KEY_EXPR.rsplit(" as ", 1)[0]
        # Round 59: CH_META_TABLE spans multiple years (one row per (tmc,
        # year)) -- without the toYear(ds.date) match this INNER JOIN would
        # fan out every fact row across every year table1 carries for that
        # tmc, silently multiplying the pooled value.
        sql = (f"SELECT ds.tmc AS tmc, {value_expr} "
               f"FROM {CH_FACT_TABLE} AS ds "
               f"JOIN {CH_META_TABLE} AS table1 "
               f"ON ds.tmc = table1.tmc AND toYear(ds.date) = table1.year "
               f"JOIN {CH_AADT_DIST_TABLE} AS table2 ON {dist_key_body} = table2.key "
               f"WHERE ds.tmc IN ({tmc_list}) "
               f"AND ds.date >= '{start_date}' AND ds.date <= '{end_date}' "
               f"GROUP BY ds.tmc")
    result = dbq.ch(sql)
    rows = result.get("data") or []
    return [r[1] for r in rows if r[1] is not None]


def apply_route_map_paint(state, values, color_range, measure, max_round_digits=1):
    """Shared tail of every Route Map choropleth bake (extracted 2026-07-27):
    given pooled per-TMC values, compute colors/breaks/paint and mutate
    state's active choropleth layer in place. Returns False (state left as
    the template's placeholder paint) if `values` is empty, True otherwise."""
    if not values:
        return False
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
                                    max_value=round(max(values), max_round_digits))
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
    return True


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
    values = pooled_route_map_values(measure, tmcs, start_fmt, end_fmt)
    if not values:
        gaps.append({"kind": f"route_map_{measure}_no_values", "graph": old_graph.get("id"),
                     "detail": f"pooled CH query over {len(tmcs)} tmc(s), "
                               f"{start_fmt}..{end_fmt} returned no values — "
                               f"choropleth left unbaked (template placeholder "
                               f"default renders)"})
        return
    apply_route_map_paint(state, values, color_range, measure, max_round_digits=1)


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
    # hoursOfDelay is resolution-invariant (one expression, no resolution
    # dispatch needed); avgHoursOfDelay genuinely varies by resolution --
    # pooled_route_map_values branches on `resolution` internally.
    values = pooled_route_map_values(measure, tmcs, start_fmt, end_fmt,
                                     resolution=resolution)
    if not values:
        gaps.append({"kind": f"route_map_{measure}_no_values", "graph": old_graph.get("id"),
                     "detail": f"pooled CH query over {len(tmcs)} tmc(s), "
                               f"{start_fmt}..{end_fmt} returned no values — "
                               f"choropleth left unbaked (template placeholder "
                               f"default renders)"})
        return
    apply_route_map_paint(state, values, color_range, measure, max_round_digits=3)


ROUTE_MAP_MEASURES = ("none", "speed", "travelTime", "hoursOfDelay", "avgHoursOfDelay")


