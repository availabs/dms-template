import json
import os
import re

from .config import APPLY_STATIC_BREAKS_TO_MAP, COLOR_BREAKS, GRAPH_TEMPLATE_TYPE
from .expressions import AADT_DIST_JOIN, HOURS_OF_DELAY_VALUE_EXPR, META_JOIN, ROUTE_MAP_AVGDELAY_RESOLUTION_SLUG, ROUTE_MAP_AVGDELAY_VALUE_EXPR_BY_RESOLUTION, SPEED_VALUE_EXPR, TRAVEL_TIME_VALUE_EXPR
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

# See config.py's APPLY_STATIC_BREAKS_TO_MAP for the toggle this drives — "custom" (round 80: fixed
# breaks, no live recompute) when True, "quantile" (pre-round-80, semi-reverted 2026-09-02: the
# live Map runtime recomputes breaks from real data every render) when False. Every
# ensure_route_map_*_template choropleth builder below mints this same value.
CHOROPLETH_BIN_METHOD = "custom" if APPLY_STATIC_BREAKS_TO_MAP else "quantile"


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
        # Round C (2026-08-31): TMC-only hover — no joined measure column on
        # this template (see route_map_hover_columns's own docstring).
        "hover": "hover",
        "hover-columns": route_map_hover_columns(),
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


def route_map_hover_columns(value_label=None, value_format=" "):
    """Hover-popup field list for a Route Map layer (`layer['hover-columns']`,
    read by the map runtime's HoverComp — packages/dms/src/patterns/page/
    components/sections/components/ComponentRegistry/map/SymbologyViewLayer.jsx).
    Round 82 finding 6 / Round C: hover popups are an existing, working, generic
    Map capability (gated by `layer['hover']`/`layer['hover-columns']`, normally
    authored via the Map Editor's Popover tab) that route_map.py had simply
    never populated — not a missing platform feature. `tmc`/`value` are the
    SAME property names every Route Map layer already carries on its rendered
    tile feature (geometry tiles: `cols=tmc`; choropleth `join.tileColumns`:
    `["value"]`, server-baked via the tile's `join=` param), so the popup reads
    off the feature already sitting under the cursor — no extra join fetch.
    `value_label` is omitted for route_map_none (no joined measure column)."""
    columns = [{"column_name": "tmc", "display_name": "TMC", "formatFn": " ",
                "justify": "left"}]
    if value_label:
        columns.append({"column_name": "value", "display_name": value_label,
                         "formatFn": value_format, "justify": "right"})
    return columns


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

    Round 80 (2026-08-27): paint/legend/color-range come from the shared
    `colorBreaks.json` (same table composeMapConfig.js/composeMeasureConfig.js
    read) and are PERMANENT, not placeholders — no per-report bake overwrites
    them anymore (see this module's own header note on why: static breaks,
    same design as MacroView's breaks.js)."""
    view_id = GEOMETRY_TILE_VIEWS.get(year)
    if view_id is None:
        raise RuntimeError(f"no geometry tile view for year {year}")
    base = templates.get(TEMPLATE_BASE_NAME)
    if not base:
        raise RuntimeError(f"base template '{TEMPLATE_BASE_NAME}' not found")
    base_state = json.loads(base["data"]["stateJson"])
    table1_join = base_state["join"]["sources"]["table1"]
    breaks = COLOR_BREAKS["speed"]

    name = f"route_map_speed_{year}"
    lid = f"rm_speed_{year}"
    src_id = f"npmrds2_s582_v{view_id}_{lid}"
    tiles_url = (f"{TILE_HOST}/dama-admin/npmrds2/tiles/{view_id}"
                 f"/{{z}}/{{x}}/{{y}}/t.pbf?cols=tmc&filter=year={year}")
    zoom_width = lambda base_w: ["interpolate", ["linear"], ["zoom"],
                                 5, base_w, 10, base_w * 2, 14, base_w * 4]
    painted = choropleth_paint("value", breaks["colors"], breaks["breaks"],
                               max_value=breaks["maxValue"])
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
        "num-bins": len(breaks["colors"]),
        # Round 80: 'custom' (not 'quantile') — skips the live Map runtime's
        # colorDomain refetch entirely, same mechanism composeMapConfig.js
        # now uses; this is what makes the breaks above ACTUALLY permanent at
        # render time, not just at mint time. Semi-reverted 2026-09-02: see
        # CHOROPLETH_BIN_METHOD / config.py's APPLY_STATIC_BREAKS_TO_MAP.
        "bin-method": CHOROPLETH_BIN_METHOD,
        "color-range": breaks["colors"],
        "legend-data": painted["legend"],
        # The runtime materializes one visible clone per comparison_series
        # variant (see useComparisonSeriesLayers.js); the template layer
        # itself must stay suppressed or it renders an extra, un-labeled
        # duplicate of the same legend (round 51, user-reported).
        "legend-orientation": "none",
        # Round C (2026-08-31): see route_map_hover_columns's docstring.
        "hover": "hover",
        "hover-columns": route_map_hover_columns("Speed (mph)", "decimal_2"),
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
             "paint": {"line-color": painted["paint"],
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
    nothing else differs structurally). Round 80: paint/legend/color-range
    come from the shared colorBreaks.json and are PERMANENT, same as speed
    (see ensure_route_map_speed_template's own comment)."""
    view_id = GEOMETRY_TILE_VIEWS.get(year)
    if view_id is None:
        raise RuntimeError(f"no geometry tile view for year {year}")
    base = templates.get(TEMPLATE_BASE_NAME)
    if not base:
        raise RuntimeError(f"base template '{TEMPLATE_BASE_NAME}' not found")
    base_state = json.loads(base["data"]["stateJson"])
    table1_join = base_state["join"]["sources"]["table1"]
    breaks = COLOR_BREAKS["travelTime"]

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
    painted = choropleth_paint("value", breaks["colors"], breaks["breaks"],
                               max_value=breaks["maxValue"])
    template_layer = {
        "id": lid, "name": f"Travel Time ({year} network)", "type": "line",
        "order": 1, "isVisible": True,
        "series-template": True,
        "series-feature-column": "tmc",
        "layer-type": "choropleth",
        "data-column": "value",
        "num-bins": len(breaks["colors"]), "bin-method": CHOROPLETH_BIN_METHOD,
        "color-range": breaks["colors"],
        "legend-data": painted["legend"],
        # The runtime materializes one visible clone per comparison_series
        # variant (see useComparisonSeriesLayers.js); the template layer
        # itself must stay suppressed or it renders an extra, un-labeled
        # duplicate of the same legend (round 51, user-reported).
        "legend-orientation": "none",
        # Round C (2026-08-31): see route_map_hover_columns's docstring.
        # `minutes_clock` matches round 35's route-traversal-MINUTES unit.
        "hover": "hover",
        "hover-columns": route_map_hover_columns("Travel Time", "minutes_clock"),
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
             "paint": {"line-color": painted["paint"],
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


def ensure_route_map_avghoursofdelay_template(year, resolution, templates, dry_run):
    """Mint (or reuse) `route_map_avgHoursOfDelay_{day|5min}_{year}` — M3's
    resolution-keyed sub-measure (see the comment above
    ROUTE_MAP_AVGDELAY_VALUE_EXPR_BY_RESOLUTION for why this one, alone among
    Route Map measures, needs (year, resolution) rather than just year).
    Structurally a copy-adapt of ensure_route_map_speed_template EXCEPT the
    join: this needs the SAME two-source META_JOIN + AADT_DIST_JOIN
    pair the AVL-Graph delay/CO2 templates use (DELAY_EXPR reads
    table1.avg_speedlimit/faciltype -- not on the base 455/3464 join -- and
    table2.distributions), not the base template's own single 455/3464 join.

    Round 80: paint/legend/color-range are PERMANENT, not placeholders (see
    ensure_route_map_speed_template's own comment) — `day` resolution reads
    the shared colorBreaks.json (`avgHoursOfDelay`, the same resolution-
    invariant per-day rate composeMeasureConfig.js's GridGraph/BarGraph
    domain also uses); `5-minutes` has no JS/shared-table equivalent at all
    (a genuinely different, much-smaller-magnitude per-epoch rate expression
    — see ROUTE_MAP_AVGDELAY_VALUE_EXPR_BY_RESOLUTION's own comment) and
    stays a small Python-only constant below — a pre-existing JS/Python
    divergence for this one sub-measure, not something this round's static-
    breaks change fixes (Route Map's own template-minting hasn't been
    bridge-migrated yet, a separate follow-up)."""
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
    if resolution == "day":
        breaks = COLOR_BREAKS["avgHoursOfDelay"]
    else:
        # 5-minute (per-epoch) rate — three orders of magnitude smaller than
        # the day-grain rate, no shared colorBreaks.json entry (see the
        # docstring above). Same reversed-speed-ramp colors as the day-grain
        # entry (COLOR_BREAKS["avgHoursOfDelay"]["colors"]) — only the bin
        # thresholds differ. Same placeholder-quality provenance as every
        # other Route Map measure in colorBreaks.json — not independently
        # re-derived from a real distribution.
        breaks = {"colors": COLOR_BREAKS["avgHoursOfDelay"]["colors"],
                  "breaks": [0.001, 0.003, 0.01, 0.03], "maxValue": 0.05}
    painted = choropleth_paint("value", breaks["colors"], breaks["breaks"],
                               max_value=breaks["maxValue"])
    template_layer = {
        "id": lid, "name": f"Avg. Hours of Delay ({resolution}, {year} network)",
        "type": "line",
        "order": 1, "isVisible": True,
        "series-template": True,
        "series-feature-column": "tmc",
        "layer-type": "choropleth",
        "data-column": "value",
        "num-bins": len(breaks["colors"]), "bin-method": CHOROPLETH_BIN_METHOD,
        "color-range": breaks["colors"],
        "legend-data": painted["legend"],
        # The runtime materializes one visible clone per comparison_series
        # variant (see useComparisonSeriesLayers.js); the template layer
        # itself must stay suppressed or it renders an extra, un-labeled
        # duplicate of the same legend (round 51, user-reported).
        "legend-orientation": "none",
        # Round C (2026-08-31): see route_map_hover_columns's docstring.
        "hover": "hover",
        "hover-columns": route_map_hover_columns("Avg. Hours of Delay", "decimal_2"),
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
             "paint": {"line-color": painted["paint"],
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
    base 455/3464 join). Round 80: paint/legend/color-range are PERMANENT,
    not placeholders (see ensure_route_map_speed_template's own comment)."""
    view_id = GEOMETRY_TILE_VIEWS.get(year)
    if view_id is None:
        raise RuntimeError(f"no geometry tile view for year {year}")
    breaks = COLOR_BREAKS["hoursOfDelay"]

    name = f"route_map_hoursOfDelay_{year}"
    lid = f"rm_hoursofdelay_{year}"
    src_id = f"npmrds2_s582_v{view_id}_{lid}"
    tiles_url = (f"{TILE_HOST}/dama-admin/npmrds2/tiles/{view_id}"
                 f"/{{z}}/{{x}}/{{y}}/t.pbf?cols=tmc&filter=year={year}")
    zoom_width = lambda base_w: ["interpolate", ["linear"], ["zoom"],
                                 5, base_w, 10, base_w * 2, 14, base_w * 4]
    painted = choropleth_paint("value", breaks["colors"], breaks["breaks"],
                               max_value=breaks["maxValue"])
    template_layer = {
        "id": lid, "name": f"Hours of Delay ({year} network)", "type": "line",
        "order": 1, "isVisible": True,
        "series-template": True,
        "series-feature-column": "tmc",
        "layer-type": "choropleth",
        "data-column": "value",
        "num-bins": len(breaks["colors"]), "bin-method": CHOROPLETH_BIN_METHOD,
        "color-range": breaks["colors"],
        "legend-data": painted["legend"],
        # The runtime materializes one visible clone per comparison_series
        # variant (see useComparisonSeriesLayers.js); the template layer
        # itself must stay suppressed or it renders an extra, un-labeled
        # duplicate of the same legend (round 51, user-reported).
        "legend-orientation": "none",
        # Round C (2026-08-31): see route_map_hover_columns's docstring.
        "hover": "hover",
        "hover-columns": route_map_hover_columns("Hours of Delay", "decimal_2"),
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
             "paint": {"line-color": painted["paint"],
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


ROUTE_MAP_MEASURES = ("none", "speed", "travelTime", "hoursOfDelay", "avgHoursOfDelay")


