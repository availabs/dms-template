import json

from .config import GRAPH_TEMPLATE_TYPE
from .vocab import GOOD_DIRECTION_BY_MEASURE, MEASURE_NAMES
from .template_specs import MEASURE_EXPR, TEMPLATE_BASE_NAME
from .db import dms, now_iso

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
    series_col.setdefault("customName", "Route")
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


