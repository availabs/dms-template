import json

from .config import GRAPH_TEMPLATE_TYPE
from .vocab import AADT_EXPR, AADT_TMC_EXPR, INFO_BOX_AADT_TITLES, INFO_BOX_DELAY_TITLES, INFO_BOX_LENGTH_TITLES, INFO_BOX_SPEED_TITLES, INFO_BOX_TITLES, INFO_BOX_TRAVELTIME_TITLES, LENGTH_EXPR, LENGTH_TMC_EXPR, PM3_VIEW_BY_YEAR, RELIABILITY_BIN_LABELS
from .expressions import AADT_DIST_JOIN, DELAY_EXPR, META_JOIN, SPEED_EXPR, TRAVEL_TIME_EXPR
from .template_specs import TEMPLATE_BASE_NAME
from .db import dms, now_iso

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
        series_col.setdefault("customName", "Route")
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
        series_col.setdefault("customName", "Route")
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


def ensure_info_box_speed_template(grain, templates, dry_run):
    """Mint (or reuse) `{grain}_info_box_speed` — the real plain speed measure
    (`miles / travel_time`, SPEED_EXPR, same expression the AVL Graph "speed"
    measure uses), added 2026-08-12. NOT the same thing as INFO_BOX_BUCKET's
    "speed"-keyed reliability bucket above (see this module's header comment
    and INFO_BOX_SPEED_TITLES's) — verified against the actual old tool source
    (`dataTypes.js`'s `toSpeed`/`speedReducer`) that Route Info Box's real
    "Speed" column was always this plain calculation, never LOTTR/TTTR.

    Same shape as ensure_info_box_traveltime_template (self-aggregating
    expression, `fn: "exempt"` at BOTH grains — SPEED_EXPR's `arraySum(mapValues(...))`
    combinator already degrades correctly to a single-TMC value at "tmc" grain,
    same proof round 35 established for the AVL Graph GridGraph per-TMC fix,
    so no separate non-aggregating _TMC_EXPR variant is needed here unlike
    length/aadt). Unlike travelTime, SPEED_EXPR DOES read `table1.miles` for
    real, so the base template's default join (TMC Identification, 455/3464)
    is load-bearing here, not just carried along to avoid the joinless-`ds`-alias
    bug."""
    name = f"{grain}_info_box_speed"
    speed_col = {"type": "calculated", "show": True,
                 "name": SPEED_EXPR, "fn": "exempt", "customName": "Speed (mph)"}
    speed_idx = 1 if grain == "route" else 0

    existing = templates.get(name)
    if existing is not None:
        existing_state = json.loads(existing["data"]["stateJson"])
        existing_cols = existing_state.get("columns") or []
        if len(existing_cols) == 2 and existing_cols[speed_idx] == speed_col:
            return templates  # no drift
        new_cols = list(existing_cols)
        new_cols[speed_idx] = speed_col
        existing_state["columns"] = new_cols
        new_data = {**existing["data"], "stateJson": json.dumps(existing_state),
                    "updatedAt": now_iso()}
        if dry_run:
            print(f"[dry-run] would update drifted template '{name}' "
                  f"id={existing['id']} (expr drift)")
        else:
            dms(["raw", "update", str(existing["id"])], data=new_data)
            print(f"updated template '{name}' id={existing['id']} (expr drift fix)")
        templates[name] = {"id": existing["id"], "data": new_data}
        return templates

    base = templates.get(TEMPLATE_BASE_NAME)
    if not base:
        raise RuntimeError(f"base template '{TEMPLATE_BASE_NAME}' not found")
    base_state = json.loads(base["data"]["stateJson"])

    if grain == "route":
        series_col = next(c for c in base_state["columns"]
                          if c.get("name") == "__series")
        series_col.setdefault("customName", "Route")
        columns = [series_col, speed_col]
    else:  # "tmc"
        tmc_src = next(c for c in base_state["externalSource"]["columns"]
                       if c.get("name") == "tmc" and c.get("source_id") == 583)
        tmc_col = {**tmc_src, "show": True, "target": "categorize", "group": True}
        columns = [speed_col, tmc_col]

    state = {
        "externalSource": base_state["externalSource"],
        "columns": columns,
        "filters": base_state.get("filters") or {"op": "AND", "groups": []},
        "display": {
            "usePagination": True, "pageSize": 50, "hideExternalToggle": True,
            "title": {"title": INFO_BOX_SPEED_TITLES[grain]},
            "showAttribution": True, "fetchMode": "force",
            "_functions": base_state["display"]["_functions"],
        },
        # META_JOIN explicitly, NOT the base's default (TMC Identification,
        # 455/3464) — 2026-08-12 fix: SPEED_EXPR reads `table1.miles` for real,
        # and TMC Identification is a single static snapshot (joined on `tmc`
        # only, no year) while META_JOIN is joined on `(tmc, year)`, so every
        # query correctly gets the TMC's actual metadata for the year it's
        # actually querying (real, verified via ClickHouse: ~96% of TMCs have
        # `miles` that legitimately changes across years, not rounding noise —
        # see dynamic-reports-and-route-tags.md's metadata-unification note).
        # Also what makes `speed` join-compatible with `length`/`aadt`/
        # `hoursOfDelay` for Info Box multi-measure, since they now all agree
        # table1 = META_JOIN.
        "join": {"sources": {"table1": META_JOIN}},
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
                                      custom_name, templates, dry_run):
    """Shared shape for the round-40 static (no year/bin/pm3 dependency)
    Info Box templates — `length`/`aadt`. Route grain groups by the
    comparisonSeries `__series` discriminator with a self-aggregating
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
    keeping self-contained).

    2026-08-12: two fixes, both needing real drift detection added (this
    function used to short-circuit unconditionally on any existing row —
    same latent gap round 59 already fixed for ensure_info_box_delay_template,
    caught here because `route_info_box_length`/`tmc_info_box_length`/
    `tmc_info_box_aadt` already existed live from an earlier round and would
    otherwise have silently kept the old shape forever): (1) `join` now reads
    META_JOIN explicitly, not the base template's default (TMC Identification,
    455/3464) — `route_expr`/`tmc_expr` read `table1.miles`/`table1.aadt` for
    real, and only META_JOIN's `(tmc, year)` join key gets every query the
    TMC's actual metadata for the year it's actually querying, unlike TMC
    Identification's single static (tmc-only) snapshot. (2) `value_col` never
    had a `customName` — harmless as the only value column in a single-measure
    box, but shows a blank/raw-SQL header once multi-measure Info Box support
    puts it next to other measures' columns."""
    value_col_shape = lambda expr, fn: {"type": "calculated", "show": True, "name": expr, "fn": fn, "customName": custom_name}
    expected_join = {"sources": {"table1": META_JOIN}}
    value_idx = 1 if grain == "route" else 0
    expected_value_col = value_col_shape(route_expr, "exempt") if grain == "route" else value_col_shape(tmc_expr, "avg")

    existing = templates.get(name)
    if existing is not None:
        existing_state = json.loads(existing["data"]["stateJson"])
        existing_cols = existing_state.get("columns") or []
        col_drift = not (len(existing_cols) == 2 and existing_cols[value_idx] == expected_value_col)
        join_drift = existing_state.get("join") != expected_join
        if not (col_drift or join_drift):
            return templates  # no drift
        new_cols = list(existing_cols)
        if col_drift:
            new_cols[value_idx] = expected_value_col
            existing_state["columns"] = new_cols
        if join_drift:
            existing_state["join"] = json.loads(json.dumps(expected_join))
        new_data = {**existing["data"], "stateJson": json.dumps(existing_state),
                    "updatedAt": now_iso()}
        note = ", ".join(k for k, fired in (("column", col_drift), ("join", join_drift)) if fired)
        if dry_run:
            print(f"[dry-run] would update drifted template '{name}' "
                  f"id={existing['id']} ({note} changed)")
        else:
            dms(["raw", "update", str(existing["id"])], data=new_data)
            print(f"updated template '{name}' id={existing['id']} ({note} drift fix)")
        templates[name] = {"id": existing["id"], "data": new_data}
        return templates

    base = templates.get(TEMPLATE_BASE_NAME)
    if not base:
        raise RuntimeError(f"base template '{TEMPLATE_BASE_NAME}' not found")
    base_state = json.loads(base["data"]["stateJson"])

    if grain == "route":
        series_col = next(c for c in base_state["columns"]
                          if c.get("name") == "__series")
        series_col.setdefault("customName", "Route")
        columns = [series_col, expected_value_col]
    else:  # "tmc"
        tmc_src = next(c for c in base_state["externalSource"]["columns"]
                       if c.get("name") == "tmc" and c.get("source_id") == 583)
        tmc_col = {**tmc_src, "show": True, "target": "categorize", "group": True}
        columns = [expected_value_col, tmc_col]

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


def ensure_info_box_length_template(grain, templates, dry_run):
    """Mint (or reuse) `{grain}_info_box_length` — round 40, see
    INFO_BOX_LENGTH_BUCKET/LENGTH_EXPR above."""
    return _ensure_static_info_box_template(
        f"{grain}_info_box_length", grain, LENGTH_EXPR, LENGTH_TMC_EXPR,
        INFO_BOX_LENGTH_TITLES, "Length", templates, dry_run)


def ensure_info_box_aadt_template(grain, templates, dry_run):
    """Mint (or reuse) `{grain}_info_box_aadt` — round 40, see
    INFO_BOX_AADT_BUCKET/AADT_EXPR above."""
    return _ensure_static_info_box_template(
        f"{grain}_info_box_aadt", grain, AADT_EXPR, AADT_TMC_EXPR,
        INFO_BOX_AADT_TITLES, "AADT", templates, dry_run)


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
        series_col.setdefault("customName", "Route")
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
    series_col.setdefault("customName", "Route")
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


# ── Multi-measure Info Box composition (2026-08-12) ──────────────────────────
# Ryan's old-tool comparison found the real Route Info Box shows N measures as
# N columns in ONE box (e.g. "Speed, Travel Time" — see the screenshot cited in
# dynamic-reports-and-route-tags.md). The single-measure functions above each
# mint/reuse ONE shared, canonical template row per measure — that model
# doesn't scale to measure SETS (5 measures -> up to 31 combinations), so this
# does NOT mint a new combo-named template. Instead it calls each measure's own
# ensure_* function (reusing 100% of the already-drift-checked expression
# definitions above, zero duplication), pulls just that measure's own value
# column out of the resulting single-measure template, and assembles a BRAND
# NEW state private to this one report — composed fresh every time, the same
# "no shared row is the source of truth" shape composeMeasureConfig.js already
# uses for AVL Graph (see the "column definitions should live in git, not
# DB-only" direction Ryan flagged the same session).
#
# `reliability` is deliberately excluded from combination with anything else:
# its join is a named `pm3` pgFederated source, a fundamentally different
# query mechanism from the plain ClickHouse `table1`/`table2` joins every
# other measure uses — untested whether the two coexist in one query, and
# nobody has asked for that combo. Fails loud rather than guessing.
INFO_BOX_MULTI_ENSURE_FN = {
    "speed": ensure_info_box_speed_template,
    "travelTime": ensure_info_box_traveltime_template,
    "length": ensure_info_box_length_template,
    "aadt": ensure_info_box_aadt_template,
    "hoursOfDelay": ensure_info_box_delay_template,
}
INFO_BOX_MULTI_TEMPLATE_NAME = {
    "speed": "speed", "travelTime": "traveltime", "length": "length",
    "aadt": "aadt", "hoursOfDelay": "delay",
}
INFO_BOX_MULTI_TITLE_WORD = {
    "speed": "Speed", "travelTime": "Travel Time", "length": "Length",
    "aadt": "AADT", "hoursOfDelay": "Hours of Delay",
}
# Which named join slot (as used in `join.sources`) each measure's expression
# hardcodes: None = joinless (compatible with anything, since it never reads
# table1/table2 at all — travelTime's TRAVEL_TIME_EXPR references no join
# column). Two measures combine safely only if their groups are equal or one
# is None.
#
# UPDATED 2026-08-12: speed/length/aadt used to assume table1 =
# TMC_IDENTIFICATION_JOIN (a static, tmc-only-keyed snapshot), which collided
# with hoursOfDelay's table1 = META_JOIN — that's the conflict this dict
# originally existed to catch. Root-caused and fixed instead of worked around:
# TMC_IDENTIFICATION_JOIN was ALWAYS the wrong choice — a query needs the
# TMC's metadata for the year it's actually querying (Ryan's direction), and
# only META_JOIN's `(tmc, year)` join key can give that; TMC_IDENTIFICATION_JOIN
# is one static row per TMC regardless of year (confirmed live via ClickHouse:
# ~96% of TMCs have `miles` that genuinely differs by year, not rounding
# noise — real TMC-network-vintage changes, not measurement error). Checked
# directly against the live table (`npmrds_meta.s582_v983_NPMRDS_V6_tmc_meta`,
# 58 columns): it's a strict superset of TMC_IDENTIFICATION_JOIN's columns
# (vocabulary.json's old META_JOIN entry only listed 11 — a stale, hand-trimmed
# cache of the real schema, not the real schema itself). So speed/length/aadt
# now read `table1.miles`/`table1.aadt` from META_JOIN too (see
# ensure_info_box_speed_template's/`_ensure_static_info_box_template`'s own
# comments, and `vocabulary.json`'s `measures.speed/speedTruck.requiresJoin`)
# — every measure below except `hoursOfDelay`'s own extra `table2` requirement
# now agrees on the same table1, so the only combination this dict still needs
# to catch is `reliability` (a completely different join mechanism, handled
# separately below).
INFO_BOX_MULTI_JOIN_GROUP = {
    "speed": "meta_join", "length": "meta_join", "aadt": "meta_join", "hoursOfDelay": "meta_join",
    "travelTime": None,
}


def check_info_box_measure_combo(measures):
    """Raises ValueError with a clear message if `measures` (a list of >= 2
    INFO_BOX_SPEC_MEASURES values) can't safely share one query. Called before
    any DB work so a bad combo fails fast, not after minting/reusing templates
    for the ones that would have worked."""
    if "reliability" in measures:
        raise ValueError(
            "Info Box measure 'reliability' can't be combined with other measures yet "
            "— it needs a separate pm3 (pgFederated) join, a different mechanism from "
            "the plain joins every other measure uses, and combining the two hasn't "
            "been verified. Use 'reliability' alone, or drop it from this combination.")
    groups = {INFO_BOX_MULTI_JOIN_GROUP[m] for m in measures} - {None}
    if len(groups) > 1:
        raise ValueError(
            f"Info Box measures {measures} need incompatible joins to combine "
            f"({sorted(groups)} would collide on the same join slot) — not supported yet.")


def build_route_info_box_section_state_multi(measures, grain, templates, dry_run):
    """Multi-measure counterpart to build_route_info_box_section_state — see
    this section's header comment for why this composes fresh instead of
    cloning a template. `measures` must be >= 2 entries, already validated by
    check_info_box_measure_combo (reliability excluded, join-compatible)."""
    check_info_box_measure_combo(measures)
    value_col_by_measure = {}
    join_sources = {}
    for m in measures:
        templates = INFO_BOX_MULTI_ENSURE_FN[m](grain, templates, dry_run)
        name = f"{grain}_info_box_{INFO_BOX_MULTI_TEMPLATE_NAME[m]}"
        state = json.loads(templates[name]["data"]["stateJson"])
        cols = state["columns"]
        # Every single-measure template is exactly [series_col, value_col] (route
        # grain) or [value_col, tmc_col] (tmc grain) — pull out whichever one
        # isn't the series/tmc discriminator column.
        value_col = next(c for c in cols if c.get("name") != "__series" and c.get("target") != "categorize")
        value_col_by_measure[m] = value_col
        # Merge (union) each measure's own `join.sources`, not "last one wins" —
        # hoursOfDelay needs BOTH table1 AND table2 while speed/length/aadt only
        # need table1; if hoursOfDelay weren't last in `measures`, a naive
        # overwrite would silently drop its table2. check_info_box_measure_combo
        # already guarantees every measure here agrees on what table1 means, so
        # a plain dict union is safe — no measure's own join can clobber
        # another's with a conflicting value for the same key.
        join_sources.update((state.get("join") or {}).get("sources") or {})
    join = {"sources": join_sources} if join_sources else None

    base = templates.get(TEMPLATE_BASE_NAME)
    if not base:
        raise RuntimeError(f"base template '{TEMPLATE_BASE_NAME}' not found")
    base_state = json.loads(base["data"]["stateJson"])

    value_cols = [value_col_by_measure[m] for m in measures]
    if grain == "route":
        series_col = next(c for c in base_state["columns"] if c.get("name") == "__series")
        series_col.setdefault("customName", "Route")
        columns = [series_col, *value_cols]
    else:  # "tmc"
        tmc_src = next(c for c in base_state["externalSource"]["columns"]
                       if c.get("name") == "tmc" and c.get("source_id") == 583)
        tmc_col = {**tmc_src, "show": True, "target": "categorize", "group": True}
        columns = [*value_cols, tmc_col]

    title = " / ".join(INFO_BOX_MULTI_TITLE_WORD[m] for m in measures)
    state = {
        "externalSource": base_state["externalSource"],
        "columns": columns,
        "filters": base_state.get("filters") or {"op": "AND", "groups": []},
        "display": {
            "usePagination": True, "pageSize": 50, "hideExternalToggle": True,
            "title": {"title": f"{'Route' if grain == 'route' else 'TMC'} {title}"},
            "showAttribution": True, "fetchMode": "force",
            "_functions": base_state["display"]["_functions"],
        },
        "join": join or base_state.get("join"),
        "customBuckets": base_state.get("customBuckets"),
        "comparisonSeries": base_state.get("comparisonSeries"),
    }
    # Never persisted as a named/shared template — this is this report's own
    # private composed state (mirrors composeMeasureConfig.js's AVL Graph
    # shape). `report_build.mjs` writes it straight into the section row.
    return "Spreadsheet", state


