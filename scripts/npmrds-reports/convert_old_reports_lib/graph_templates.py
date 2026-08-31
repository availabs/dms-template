import json

from .config import GRAPH_TEMPLATE_TYPE, GRAPH_VOCAB
from .vocab import RELIABILITY_BIN_BY_PEAK_FLAG, WEEKDAY_NAMES, WEEKEND_NAMES
from .expressions import WEEKDAY_EXPR
from .template_specs import BRIDGE_GRAPH_SPECS, TEMPLATE_BASE_NAME, TEMPLATE_SPECS
from .compose_bridge import call_compose_bridge
from .db import dms, now_iso

# ── New-side building blocks ─────────────────────────────────────────────────

# GridGraph's default color scale (round 2026-08-26, live-reported): every
# GridGraph spec's yAxis column (target "color", see y_target below) inherits
# the base LineGraph template's ~20-swatch route-identity palette verbatim —
# correct for distinguishing routes by hue, meaningless for a single
# continuous VALUE gradient, and visually reads as "confetti" (reported
# live). `composeMeasureConfig.js` (the live in-app Measure Picker,
# report_build.mjs's Dynamic Report generator via ssrLoadModule) already
# fixed this exact bug 2026-08-12 (`planning/transportny/tasks/current/
# dynamic-reports-and-route-tags.md`, "GridGraph/BarGraph magnitude color
# scale") — a red/yellow/green `scheme` scale respecting each measure's own
# `reverseColors` polarity — but that fix lives in JS compose-time code, a
# parallel, independent reimplementation of this Python converter's own
# template-minting logic (that doc's own root-cause pattern B), so it never
# propagated here. Port of the exact same fix, keyed the exact same way
# (`vocabulary.json`'s own `measures[key].reverseColors`, the single source
# of truth both sides already read from — GRAPH_VOCAB here, `vocab.measures`
# there) rather than a second, driftable REVERSE_COLORS_MEASURES-style set.
_MEASURE_COLOR_REVERSE_BY_EXPR = {
    m["expr"]: bool(m.get("reverseColors"))
    for m in GRAPH_VOCAB["measures"].values() if m.get("expr")
}


def _grid_default_colors(spec):
    """The {type:"scheme", scheme:"rdylgn", reverse} display.colors patch for
    a plain (non-difference) GridGraph spec's own value column, or None if
    this spec doesn't need one (not GridGraph-shaped, or it already carries
    its own colors override — e.g. a difference-mode spec's `_diff_colors()`
    palette, which must win over this default, not get overwritten by it)."""
    if spec["yAxis"].get("target", "yAxis") == "yAxis":
        return None
    if "colors" in (spec.get("display") or {}):
        return None
    reverse = _MEASURE_COLOR_REVERSE_BY_EXPR.get(spec["yAxis"].get("name"), False)
    return {"type": "scheme", "scheme": "rdylgn", "reverse": reverse}

def load_graph_templates():
    # `dms raw list` defaults to --limit 20; this type has grown past that
    # (37 as of round 32) so the default page silently drops whichever
    # templates sort outside it — confirmed live 2026-07-10: the two oldest
    # base templates (tmc_speed_line_graph/tmc_travel_time_line_graph, the
    # originals every other template is minted from) fell off the page,
    # making every report using them spuriously gap-log as "template ... not
    # found in DB". A generous fixed limit is simpler than round-tripping for
    # the real total first.
    rows = dms(["raw", "list", f"npmrdsv5+{GRAPH_TEMPLATE_TYPE}", "--limit", "1000"])
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
        # Match the value column by the spec's own target — GridGraph value
        # columns are target "color", not "yAxis" (round 35: the hardcoded
        # "yAxis" lookup made every grid template silently invisible to
        # drift detection; caught in the backport dry-run when both grid
        # specs failed to fire).
        y_target = spec["yAxis"].get("target", "yAxis")
        y_idx = next((i for i, c in enumerate(cols)
                      if c.get("target") == y_target), None)
        # Drift = the whole yAxis column dict (not just the expression name —
        # fn/customName changes matter too, e.g. round 34's summary legend
        # fix) or any spec display patch key the live row doesn't match, or
        # (round 52) a comparisonSeries.combine the live row doesn't carry.
        display_patch = spec.get("display") or {}
        existing_display = existing_state.get("display") or {}
        display_drift = any(existing_display.get(k) != v
                            for k, v in display_patch.items())
        combine_spec = spec.get("comparisonSeriesCombine")
        combine_drift = (combine_spec is not None and
                         (existing_state.get("comparisonSeries") or {})
                         .get("combine") != combine_spec)
        # Round 59: join drift -- the mint branch below (spec.get("join"))
        # was never mirrored here, so a spec whose JOIN changed (not just its
        # expression text, e.g. this round's META_JOIN source swap) silently
        # never propagated to an already-existing row -- the yAxis-expr
        # check above caught the expression text change but left the row's
        # stored join pointed at the old source forever. Same live-caught
        # bug class this whole drift-detection idiom exists to prevent.
        join_spec = spec.get("join")
        expected_join = {"sources": join_spec} if join_spec else None
        join_drift = (expected_join is not None and
                     existing_state.get("join") != expected_join)
        # Round 61: any "xAxis": "epoch" spec's x column is the raw 5-min-of-
        # day index (ds.epoch) -- ticks render as "80" instead of "6:40"
        # without a named formatFn. Derived off the spec's own xAxis shorthand
        # rather than hand-added to all ~40 TEMPLATE_SPECS entries, so it
        # covers every current and future one uniformly.
        existing_xaxis_format = (existing_display.get("xAxis") or {}).get("format")
        epoch_format_drift = (spec["xAxis"] == "epoch" and
                              existing_xaxis_format != "epoch_time")
        # Round 62: same lazy-drift idiom as epoch_format_drift, for the two
        # axis-caption fields (see the mint-branch comment above for the
        # root cause / rationale — the render path already works, these
        # fields were just never populated).
        existing_xaxis_label = (existing_display.get("xAxis") or {}).get("label")
        epoch_label_drift = (spec["xAxis"] == "epoch" and
                             existing_xaxis_label != "Time of Day")
        # Same lazy-drift idiom as epoch_format_drift/epoch_label_drift, for the
        # "weekday" resolution's raw ISO 1-7 xAxis (live-reported bug 2026-08-04:
        # ticks show "0 1 2" instead of day names).
        is_weekday_xaxis = (isinstance(spec["xAxis"], dict) and
                            spec["xAxis"].get("name") == WEEKDAY_EXPR)
        weekday_format_drift = (is_weekday_xaxis and
                                existing_xaxis_format != "day_of_week")
        weekday_label_drift = (is_weekday_xaxis and
                               existing_xaxis_label != "Day of Week")
        expected_yaxis_label = (spec["yAxis"].get("customName")
                                if spec["yAxis"].get("target", "yAxis") == "yAxis" else None)
        existing_yaxis_label = (existing_display.get("yAxis") or {}).get("label")
        yaxis_label_drift = bool(expected_yaxis_label) and existing_yaxis_label != expected_yaxis_label
        # GridGraph shape (y_target == "color"): the "yAxis" AXIS POSITION is
        # occupied by the categorize column (a TMC identifier string, see
        # tmc_speed_grid_graph_tmc's own "categorize" dict pre-targeted at
        # "yAxis"), not this spec's own measure. display.yAxis.tickFormat/
        # format/label are all inherited unchanged from TEMPLATE_BASE_NAME (a
        # LineGraph whose yAxis IS the numeric measure) since nothing above
        # ever clears them for this shape — a numeric formatFn (e.g.
        # "Integer") applied to a TMC string renders "NaN" on every tick
        # (live-reported 2026-08-26, confirmed on 15/15 existing GridGraph
        # templates carrying tickFormat="Integer", 1/15 also carrying a
        # leftover "Travel Time (min)" label). Any of the three present is
        # drift for this shape — there is no correct non-empty value for a
        # categorical axis, so the fix is always "clear it."
        existing_yaxis_display = existing_display.get("yAxis") or {}
        yaxis_categorical_drift = y_target != "yAxis" and bool(
            existing_yaxis_display.get("tickFormat")
            or existing_yaxis_display.get("format")
            or existing_yaxis_display.get("label"))
        # GridGraph's own default VALUE color scale (see _grid_default_colors'
        # own comment) — None for every non-GridGraph spec and every spec
        # that already carries its own colors override (difference specs),
        # so this drift check only ever fires for the plain GridGraph rows
        # that inherited the base's route-identity palette verbatim.
        expected_grid_colors = _grid_default_colors(spec)
        grid_colors_drift = (expected_grid_colors is not None and
                             existing_display.get("colors") != expected_grid_colors)
        if y_idx is None:
            continue  # no yAxis-target column to compare against at all
        yaxis_drift = cols[y_idx] != dict(spec["yAxis"])
        if not (yaxis_drift or display_drift or combine_drift or join_drift
                or epoch_format_drift or epoch_label_drift or yaxis_label_drift
                or weekday_format_drift or weekday_label_drift
                or yaxis_categorical_drift or grid_colors_drift):
            continue  # no drift
        cols[y_idx] = dict(spec["yAxis"])
        for k, v in display_patch.items():
            existing_state.setdefault("display", {})[k] = v
        if combine_spec is not None:
            existing_state.setdefault("comparisonSeries", {})["combine"] = \
                dict(combine_spec)
        if join_drift:
            existing_state["join"] = json.loads(json.dumps(expected_join))
        if epoch_format_drift:
            existing_state.setdefault("display", {}) \
                .setdefault("xAxis", {})["format"] = "epoch_time"
        if epoch_label_drift:
            existing_state.setdefault("display", {}) \
                .setdefault("xAxis", {})["label"] = "Time of Day"
        if weekday_format_drift:
            existing_state.setdefault("display", {}) \
                .setdefault("xAxis", {})["format"] = "day_of_week"
        if weekday_label_drift:
            existing_state.setdefault("display", {}) \
                .setdefault("xAxis", {})["label"] = "Day of Week"
        if yaxis_label_drift:
            existing_state.setdefault("display", {}) \
                .setdefault("yAxis", {})["label"] = expected_yaxis_label
        if yaxis_categorical_drift:
            yb = existing_state.setdefault("display", {}).setdefault("yAxis", {})
            yb.pop("tickFormat", None)
            yb.pop("format", None)
            yb["label"] = ""
        if grid_colors_drift:
            existing_state.setdefault("display", {})["colors"] = expected_grid_colors
        new_data = {**existing["data"], "stateJson": json.dumps(existing_state),
                    "updatedAt": now_iso()}
        note = ", ".join(k for k, fired in (
            ("yAxis expr", yaxis_drift), ("display", display_drift),
            ("comparisonSeries.combine", combine_drift), ("join", join_drift),
            ("xAxis format", epoch_format_drift), ("xAxis label", epoch_label_drift),
            ("weekday xAxis format", weekday_format_drift),
            ("weekday xAxis label", weekday_label_drift),
            ("yAxis label", yaxis_label_drift),
            ("yAxis categorical format/label", yaxis_categorical_drift),
            ("GridGraph value color scale", grid_colors_drift),
        ) if fired)
        if dry_run:
            print(f"[dry-run] would update drifted template '{name}' "
                  f"id={existing['id']} ({note} changed)")
        else:
            dms(["raw", "update", str(existing["id"])], data=new_data)
            print(f"updated template '{name}' id={existing['id']} "
                  f"({note} drift fix)")
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
        elif spec["xAxis"] == "__series":
            # Bar Graph Summary shape (round 34): the comparison-series
            # discriminator IS the x axis — one bar per arm. `__series` isn't
            # in externalSource.columns (it's the base stateJson's own
            # synthesized comparison-series column), so retarget that one.
            # No "sort": arms should keep their comparisonSeries order, not
            # re-sort alphabetically (BarGraph only sorts when the index
            # column carries a sort key).
            x_src = next(c for c in state["columns"]
                         if c.get("name") == "__series")
            x_src.setdefault("customName", "Route")
            x_col = {**x_src, "target": "xAxis"}
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
        # xAxis above. `categorize: False` omits the column entirely (Bar
        # Graph Summary — __series is already the x axis; a duplicate entry
        # of the same name would collide in every name-keyed column map).
        cat_spec = spec.get("categorize")
        if cat_spec is False:
            cat_col = None
        elif cat_spec is None:
            cat_col = next(c for c in state["columns"]
                           if c.get("name") == "__series")
            cat_col.setdefault("customName", "Route")
        elif isinstance(cat_spec, dict):
            cat_col = cat_spec
        else:
            cat_src = next(c for c in state["externalSource"]["columns"]
                           if c.get("name") == cat_spec)
            cat_col = {**cat_src, "show": True, "target": "categorize",
                       "group": True}
        state["columns"] = [spec["yAxis"], x_col] + (
            [cat_col] if cat_col else [])
        state["display"]["graphType"] = spec["graphType"]
        for k, v in (spec.get("display") or {}).items():
            state["display"][k] = v
        if spec["xAxis"] == "epoch":
            state["display"].setdefault("xAxis", {})["format"] = "epoch_time"
            state["display"]["xAxis"]["label"] = "Time of Day"
        # "weekday" resolution's xAxis is WEEKDAY_EXPR (a raw ISO 1-7 day-of-week
        # integer, see WEEKDAY_EXPR's comment) — same "ticks render as a raw
        # integer without a named formatFn" issue as epoch above, fixed the same
        # way (live-reported bug 2026-08-04: "0 1 2" instead of day names).
        elif isinstance(spec["xAxis"], dict) and spec["xAxis"].get("name") == WEEKDAY_EXPR:
            state["display"].setdefault("xAxis", {})["format"] = "day_of_week"
            state["display"]["xAxis"]["label"] = "Day of Week"
        # Round 62: y-axis caption (user-reported 2026-07-13, "no axis label on
        # any report" — distinct from tick labels, which already render fine;
        # this is the axis TITLE describing what's plotted, e.g. "Hours of
        # Delay"). GraphComponent.jsx/AxisLeft.jsx already read+render
        # display.yAxis.label when set — the rendering path was never broken,
        # display.yAxis.label was simply never populated by this converter.
        # Reuses the yAxis column's own customName (already a human-readable
        # measure description on ~40 TEMPLATE_SPECS entries, e.g. "Speed
        # (mph)") rather than a second, parallel measure-name table that could
        # drift from it. Only for actual y-axis-plotted measures (target
        # "yAxis", BarGraph/LineGraph/Bar Graph Summary shapes) — GridGraph's
        # value column targets "color", not a literal y-axis, so it's excluded.
        if spec["yAxis"].get("target", "yAxis") == "yAxis" and spec["yAxis"].get("customName"):
            state["display"].setdefault("yAxis", {})["label"] = spec["yAxis"]["customName"]
        # Same GridGraph exclusion as above, other direction: the deep-copied
        # base's display.yAxis.tickFormat/label (a LineGraph's NUMERIC measure
        # axis, e.g. "Integer" / "Travel Time (min)") is inherited unchanged
        # by every mint, including GridGraph specs whose yAxis AXIS POSITION
        # actually holds the categorize column (a TMC identifier string) —
        # applying a numeric formatFn to that string renders "NaN" on every
        # tick (live-reported 2026-08-26). Clear it at mint time so new
        # GridGraph templates never inherit a bogus numeric format/label; the
        # drift-detection branch above self-heals already-minted ones.
        if spec["yAxis"].get("target", "yAxis") != "yAxis":
            yb = state["display"].setdefault("yAxis", {})
            yb.pop("tickFormat", None)
            yb.pop("format", None)
            yb["label"] = ""
        # GridGraph's own default VALUE color scale (see _grid_default_colors'
        # own comment for the full root-cause) — None (no-op) for every
        # non-GridGraph spec and every GridGraph spec that already set its
        # own colors override above (difference specs).
        grid_colors = _grid_default_colors(spec)
        if grid_colors is not None:
            state["display"]["colors"] = grid_colors
        if spec.get("join"):
            state["join"] = {"sources": spec["join"]}
        # Round 52: difference combine mode — the base template's own
        # comparisonSeries block (subscriber config etc.) is already in the
        # deep-copied state; this only adds the combine key the server's
        # difference branch reads (buildUdaConfig forwards it verbatim as
        # options.seriesCombine).
        if spec.get("comparisonSeriesCombine"):
            state.setdefault("comparisonSeries", {})["combine"] = \
                dict(spec["comparisonSeriesCombine"])
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


def _mint_or_update_bridge_template(name, bridge_state, is_table, templates, dry_run):
    """Shared mint-or-drift-fix body for ONE bridge-composed template row,
    given its already-composed `bridge_state` — factored out of
    `ensure_bridge_graph_templates`'s per-name loop (round 79) so
    `ensure_dynamic_bridge_template` below (dynamically-NAMED templates whose
    spec depends on a runtime-resolved value, e.g. Info Box's
    per-(year,bin) reliability buckets — not expressible as a static
    BRIDGE_GRAPH_SPECS entry) can reuse the identical create/drift logic
    instead of a second copy that could drift from this one."""
    existing = templates.get(name)
    if existing is None:
        base = templates.get(TEMPLATE_BASE_NAME)
        if not base:
            raise RuntimeError(f"base template '{TEMPLATE_BASE_NAME}' not found")
        # Round 78: Table-shaped specs (Route Compare, Info Box) mint a
        # Spreadsheet row, not an AVL Graph one. layoutJson/includesLayout/etc.
        # still come from TEMPLATE_BASE_NAME regardless of element type
        # (row-envelope-only fields, no element-type-specific content — same
        # convention ensure_route_compare_template's own old mint branch used).
        element_type = "Spreadsheet" if is_table else "AVL Graph"
        data = {
            "name": name, "slug": name,
            "stateJson": json.dumps(bridge_state),
            "layoutJson": base["data"].get("layoutJson"),
            "elementType": element_type, "componentType": element_type,
            "includesLayout": base["data"].get("includesLayout", False),
            "includesSource": base["data"].get("includesSource", True),
            "createdAt": now_iso(), "createdBy": base["data"].get("createdBy"),
            "updatedAt": now_iso(), "updatedBy": base["data"].get("updatedBy"),
        }
        if dry_run:
            print(f"[dry-run] would create bridge-composed template '{name}'")
            templates[name] = {"id": None, "data": data}
            return templates
        r = dms(["raw", "create", "npmrdsv5", GRAPH_TEMPLATE_TYPE], data=data)
        templates[name] = {"id": r["id"], "data": data}
        print(f"created bridge-composed template '{name}' id={r['id']}")
        return templates

    existing_state = json.loads(existing["data"]["stateJson"])
    if existing_state == bridge_state:
        return templates  # no drift
    new_data = {**existing["data"], "stateJson": json.dumps(bridge_state),
                "updatedAt": now_iso()}
    if dry_run:
        print(f"[dry-run] would recompose drifted bridge template '{name}' "
              f"id={existing['id']}")
    else:
        dms(["raw", "update", str(existing["id"])], data=new_data)
        print(f"recomposed bridge template '{name}' id={existing['id']} "
              f"(drift fix)")
    templates[name] = {"id": existing["id"], "data": new_data}
    return templates


def ensure_bridge_graph_templates(needed_names, templates, dry_run):
    """Sibling to ensure_graph_templates above, for the GridGraph templates
    listed in BRIDGE_GRAPH_SPECS (see that dict's own comment for the full
    rationale) — composed by calling compose_bridge.mjs, which runs the REAL
    `applyMeasurePick`/`composeMeasureConfig.js` the live in-app Measure
    Picker already uses, instead of a hand-built TEMPLATE_SPECS dict.

    A composed state ({filters, columns, data, display, externalSource,
    join, comparisonSeries}) is a COMPLETE section stateJson on its own —
    unlike ensure_graph_templates' base-template-deep-copy-then-patch
    approach, there's no partial merge here: a bridge-driven template's
    stateJson simply IS the bridge's output, wholesale. Drift detection is
    correspondingly simpler — one whole-object comparison against a fresh
    compose call, not ~10 individual field-level checks — since the bridge
    is now the single, complete source of truth for this shape, not
    Python's own reconstruction of pieces of it."""
    pending = [n for n in needed_names if n in BRIDGE_GRAPH_SPECS]
    if not pending:
        return templates
    requests = [{"key": n, **BRIDGE_GRAPH_SPECS[n]} for n in pending]
    composed = call_compose_bridge(requests)
    missing = [n for n in pending if n not in composed]
    if missing:
        raise RuntimeError(
            f"compose_bridge.mjs returned nothing for {missing} — check "
            f"BRIDGE_GRAPH_SPECS' measureKey/resolutionKey against "
            f"vocabulary.json's measures/resolutions")
    for name in pending:
        is_table = BRIDGE_GRAPH_SPECS[name].get("graphType") == "Table"
        templates = _mint_or_update_bridge_template(
            name, composed[name], is_table, templates, dry_run)
    return templates


def ensure_dynamic_bridge_template(name, spec, templates, dry_run):
    """Single-name counterpart to ensure_bridge_graph_templates, for a
    template whose NAME (and composition) depends on a runtime-resolved
    value not knowable as a static BRIDGE_GRAPH_SPECS entry — Info Box's
    reliability bucket, `{grain}_info_box_reliability_{year}_{bin}` (round
    79), the same "one shared template per (grain, year, bin), reused across
    every report matching that year/bin" model every other Info Box
    measure uses, just with the year/bin baked into the name at call time
    instead of fixed in the dict. `spec` is the same shape a BRIDGE_GRAPH_SPECS
    value would be (`{graphType, measureKeys, resolutionKey, ...}`)."""
    composed = call_compose_bridge([{"key": name, **spec}])
    if name not in composed:
        raise RuntimeError(
            f"compose_bridge.mjs returned nothing for '{name}' (spec {spec}) — "
            f"check its measureKeys/resolutionKey/reliabilityBin/reliabilityYear "
            f"against vocabulary.json/PM3_VIEW_BY_YEAR")
    return _mint_or_update_bridge_template(
        name, composed[name], spec.get("graphType") == "Table", templates, dry_run)


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


