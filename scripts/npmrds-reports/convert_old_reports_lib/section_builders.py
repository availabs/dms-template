import json

from .config import COMPONENT_TYPE, PAGE_TEMPLATE_ID, PAGE_TYPE
from .vocab import COLOR_RANGE_GRAPH_TYPES, DEFAULT_DISPLAY_DATA, DIFFERENCE_GRAPH_TYPES, INFO_BOX_GRAIN, MEASURE_NAMES, PM3_VIEW_BY_YEAR, RELIABILITY_BIN_LABELS, SINGLE_ACTIVE_COMP_TYPES
from .expressions import AADT_OVERRIDE_SUBS, ROUTE_MAP_AVGDELAY_RESOLUTION_SLUG, ROUTE_MAP_AVGDELAY_VALUE_EXPR_BY_RESOLUTION
from .template_specs import MEASURE_EXPR
from .db import dms, now_iso, old_falcor_get
from .info_box_templates import build_route_info_box_section_state_multi, ensure_info_box_aadt_template, ensure_info_box_delay_template, ensure_info_box_length_template, ensure_info_box_speed_template, ensure_info_box_traveltime_template, ensure_pm3_join_template
from .route_compare_template import build_route_compare_section_state_multi, ensure_route_compare_template
from .route_map import GEOMETRY_TILE_VIEWS, REVERSE_COLORS_MEASURES, ROUTE_MAP_MEASURES, ensure_route_map_avghoursofdelay_template, ensure_route_map_hoursofdelay_template, ensure_route_map_none_template, ensure_route_map_speed_template, ensure_route_map_traveltime_template

def build_route_map_section_state(measure, year, templates, dry_run,
                                  resolution=None, tmcs=None,
                                  start_date=None, end_date=None,
                                  color_range=None):
    """Build a ready-to-embed Route Map section state for the spec-driven
    `report_build.mjs` path (2026-07-27). `report_build.mjs` has NO Map-section
    code of its own — verified by grep; it only ever emits RRL/AVL Graph/
    Spreadsheet sections. This is the single entrypoint it shells out to (see
    `--route-map-section` in main() below) so a spec-built report's Map section
    reuses the exact same tested template-minting (`ensure_route_map_*_template`)
    machinery `convert_report` already uses for old-report conversion, rather
    than a second implementation in JS that could drift from it. Mirrors
    `convert_report`'s `route_map_tmpl_name` pre-pass dispatch exactly (same
    year-clamping, same ensure_* dispatch by measure) — see that pre-pass, a
    few hundred lines below, for the reference this intentionally shadows.

    Round 80 (2026-08-27): no per-report choropleth bake anymore — every
    route_map_*_template already carries PERMANENT static breaks from the
    shared colorBreaks.json, so this now just mints/fetches the template and
    returns its state as-is. `tmcs`/`start_date`/`end_date`/`color_range`
    kept as accepted-but-unused params purely so callers (the CLI, and
    report_build.mjs's `--route-map-section` invocation) don't need updating;
    always returns gap=None now (nothing left that can go unbaked).

    Returns (element_type, state, gap) for compatibility with existing
    callers — gap is always None now."""
    if measure not in ROUTE_MAP_MEASURES:
        raise ValueError(f"unknown Route Map measure {measure!r} — known: {ROUTE_MAP_MEASURES}")
    if measure == "avgHoursOfDelay" and resolution not in ROUTE_MAP_AVGDELAY_VALUE_EXPR_BY_RESOLUTION:
        raise ValueError(f"avgHoursOfDelay needs a resolution in "
                         f"{list(ROUTE_MAP_AVGDELAY_VALUE_EXPR_BY_RESOLUTION)}, got {resolution!r}")
    # Same clamp convert_report's pre-pass applies: pre-2017 dates fall back to
    # the oldest provisioned geometry network rather than erroring.
    year = min(max(year, min(GEOMETRY_TILE_VIEWS)), max(GEOMETRY_TILE_VIEWS))

    if measure == "none":
        templates = ensure_route_map_none_template(year, templates, dry_run)
        tmpl_name = f"route_map_none_{year}"
    elif measure == "speed":
        templates = ensure_route_map_speed_template(year, templates, dry_run)
        tmpl_name = f"route_map_speed_{year}"
    elif measure == "travelTime":
        templates = ensure_route_map_traveltime_template(year, templates, dry_run)
        tmpl_name = f"route_map_travelTime_{year}"
    elif measure == "hoursOfDelay":
        templates = ensure_route_map_hoursofdelay_template(year, templates, dry_run)
        tmpl_name = f"route_map_hoursOfDelay_{year}"
    else:
        templates = ensure_route_map_avghoursofdelay_template(year, resolution, templates, dry_run)
        slug = ROUTE_MAP_AVGDELAY_RESOLUTION_SLUG[resolution]
        tmpl_name = f"route_map_avgHoursOfDelay_{slug}_{year}"

    tmpl = templates[tmpl_name]
    state = json.loads(tmpl["data"]["stateJson"])
    element_type = tmpl["data"].get("elementType", "Map")
    return element_type, state, None


# The measure buckets convert_report's real classifier maps for Route/TMC
# Info Box (see INFO_BOX_GRAIN/INFO_BOX_*_BUCKET above), named for the
# spec-driven path below. "reliability" is the LOTTR/TTTR/Freeflow pm3 join —
# INFO_BOX_BUCKET's old internal key is the confusingly-reused `("speed",
# "travel_time_all")`, but calling it "speed" here would collide with AVL
# Graph's real speed-in-mph measure, so the spec-facing name is a deliberate
# rename, not a new bucket. "speed" (added 2026-08-12) is that real plain
# speed-in-mph measure (SPEED_EXPR) — verified against the actual old tool
# source that Route Info Box's "Speed" column was always this, never
# reliability; see ensure_info_box_speed_template's own docstring.
INFO_BOX_SPEC_MEASURES = ("speed", "reliability", "travelTime", "length", "aadt", "hoursOfDelay")


def build_route_info_box_section_state(measure, grain, templates, dry_run,
                                       year=None, bin_=None):
    """Build a ready-to-embed Route/TMC Info Box section state for the
    spec-driven `report_build.mjs` path (2026-07-28) — the same reuse pattern
    as `build_route_map_section_state` immediately above: report_build.mjs has
    NO Info Box section code of its own (verified by grep — see the task
    file's "SECOND CORRECTION" on Route Info Box), so this is the single
    entrypoint it shells out to (`--route-info-box-section` in main() below),
    reusing the exact template-minting machinery (`ensure_pm3_join_template`/
    `ensure_info_box_traveltime_template`/`ensure_info_box_length_template`/
    `ensure_info_box_aadt_template`/`ensure_info_box_delay_template`)
    `convert_report` already uses for old-report conversion.

    Unlike Route Map, an Info Box section needs NO per-report baking step at
    build time: every one of its five buckets queries live at render time via
    the cloned template's own join (pgFederated for reliability, a plain CH
    join for the other four) — the same fetchMode:"force"/comparisonSeries
    mechanism an AVL Graph section already uses. So this function only ever
    mints-or-reuses a template and clones its state; it never touches
    ClickHouse itself, and there is no tmcs/start_date/end_date parameter to
    thread through.

    That also means there is no placeholder-paint fallback the way Route
    Map's geometry-only "none" template gives every measure something to
    render even when tmcs/dates are missing. "reliability" hard-depends on
    `year` resolving into source 1410's actual per-year coverage
    (PM3_VIEW_BY_YEAR) and `bin` landing on one of the four periods it
    precomputes (RELIABILITY_BIN_LABELS) — there's no fallback year or bin to
    substitute, so both raise ValueError rather than gap-log. Callers (i.e.
    report_build.mjs) are expected to validate year/bin themselves before
    ever shelling out here, exactly as they already validate Route Map's
    measure/resolution first — these raises are a defense-in-depth backstop,
    not the intended failure path.

    Returns (element_type, state) — no `gap` in the return, unlike
    build_route_map_section_state, since there is nothing to leave unbaked.

    `measure` may be a single string (original, single-measure shape, unchanged
    below) or a list of >= 2 measures (2026-08-12: multi-measure — one column
    per measure in one box, matching the old tool's real Route Info Box shape;
    see build_route_info_box_section_state_multi's own header comment for why
    this composes fresh instead of cloning a template like the single-measure
    path below still does)."""
    if isinstance(measure, list):
        if len(measure) == 1:
            measure = measure[0]  # falls through to the single-measure path below
        else:
            for m in measure:
                if m not in INFO_BOX_SPEC_MEASURES:
                    raise ValueError(f"unknown Info Box measure {m!r} — known: {INFO_BOX_SPEC_MEASURES}")
            if grain not in ("route", "tmc"):
                raise ValueError(f"unknown Info Box grain {grain!r} — must be 'route' or 'tmc'")
            return build_route_info_box_section_state_multi(measure, grain, templates, dry_run)
    if measure not in INFO_BOX_SPEC_MEASURES:
        raise ValueError(f"unknown Info Box measure {measure!r} — known: {INFO_BOX_SPEC_MEASURES}")
    if grain not in ("route", "tmc"):
        raise ValueError(f"unknown Info Box grain {grain!r} — must be 'route' or 'tmc'")

    if measure == "reliability":
        if year is None or bin_ is None:
            raise ValueError("Info Box measure 'reliability' needs both `year` and `bin`")
        if year not in PM3_VIEW_BY_YEAR:
            raise ValueError(f"year {year} is outside source 1410's "
                             f"{min(PM3_VIEW_BY_YEAR)}-{max(PM3_VIEW_BY_YEAR)} coverage — "
                             f"no fallback exists (unlike Route Map's geometry-year clamp); "
                             f"pick a measure with no year dependency (travelTime/length/"
                             f"aadt/hoursOfDelay) or a route inside that window instead")
        if bin_ not in RELIABILITY_BIN_LABELS:
            raise ValueError(f"unknown bin {bin_!r} — known: {sorted(RELIABILITY_BIN_LABELS)}")
        templates = ensure_pm3_join_template(grain, year, bin_, templates, dry_run)
        tmpl_name = f"{grain}_info_box_reliability_{year}_{bin_}"
    elif measure == "speed":
        templates = ensure_info_box_speed_template(grain, templates, dry_run)
        tmpl_name = f"{grain}_info_box_speed"
    elif measure == "travelTime":
        templates = ensure_info_box_traveltime_template(grain, templates, dry_run)
        tmpl_name = f"{grain}_info_box_traveltime"
    elif measure == "length":
        templates = ensure_info_box_length_template(grain, templates, dry_run)
        tmpl_name = f"{grain}_info_box_length"
    elif measure == "aadt":
        templates = ensure_info_box_aadt_template(grain, templates, dry_run)
        tmpl_name = f"{grain}_info_box_aadt"
    else:  # hoursOfDelay
        templates = ensure_info_box_delay_template(grain, templates, dry_run)
        tmpl_name = f"{grain}_info_box_delay"

    tmpl = templates[tmpl_name]
    state = json.loads(tmpl["data"]["stateJson"])
    # Same BarGraph-crashes-without-state.data footgun build_graph_section_data
    # guards against for every old-report graph (including this exact template
    # type) — cheap to carry over even though Spreadsheet may not need it.
    state.setdefault("data", [])
    element_type = tmpl["data"].get("elementType", "Spreadsheet")
    return element_type, state


def build_route_compare_section_state(measure, templates, dry_run):
    """Build a ready-to-embed Route Compare Component section state for the
    spec-driven `report_build.mjs` path (2026-07-29) — same reuse pattern as
    `build_route_info_box_section_state` immediately above: report_build.mjs
    has no Route Compare section code of its own, so this is the single
    entrypoint it shells out to (`--route-compare-section` in main() below),
    reusing `ensure_route_compare_template`'s shared, generic, per-measure
    template (round 25) rather than a second implementation.

    Like Info Box and unlike Route Map, this needs NO per-report baking step:
    `ensure_route_compare_template`'s own docstring explains why — nothing
    report-specific is baked into the SQL (no base route, no literal label);
    every row's anchor and %-diff resolve live at render time via
    `comparisonSeries` + dms-server's `__ANCHOR__(<expr>)` mechanism, reading
    whichever route the page's own route list currently has first. So this
    function only ever mints-or-reuses a template and clones its state, the
    same as `build_route_info_box_section_state` — one shared template per
    measure, reused across every report.

    Returns (element_type, state) — no `gap`, since there is nothing to leave
    unbaked (mirrors Info Box's return shape, not Route Map's).

    `measure` may be a single string (unchanged below) or a list of >= 2
    measures (2026-08-12: multi-measure, e.g. Speed + Travel Time — matching
    the old tool's real Route Compare Component shape, see
    build_route_compare_section_state_multi's header comment). Only 2 measures
    exist for Route Compare (ROUTE_COMPARE_MEASURES) and both already share
    the same join, so unlike Info Box there's no combination to reject."""
    if isinstance(measure, list):
        if len(measure) == 1:
            measure = measure[0]
        else:
            for m in measure:
                if m not in MEASURE_EXPR:
                    raise ValueError(f"unknown Route Compare measure {m!r} — known: {sorted(MEASURE_EXPR)}")
            return build_route_compare_section_state_multi(measure, templates, dry_run)
    if measure not in MEASURE_EXPR:
        raise ValueError(f"unknown Route Compare measure {measure!r} — known: {sorted(MEASURE_EXPR)}")
    templates = ensure_route_compare_template(measure, templates, dry_run)
    tmpl = templates[f"route_compare_{measure}"]
    state = json.loads(tmpl["data"]["stateJson"])
    # Same BarGraph-crashes-without-state.data footgun Info Box already carries over.
    state.setdefault("data", [])
    element_type = tmpl["data"].get("elementType", "Spreadsheet")
    return element_type, state


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


def template_framework_sections(page_template):
    """Every Report Page template draft_section flagged templateRole=='framework'
    (ReportRouteList, ReportPageHeader, and whatever else the template picks up
    later), in template order — cloned verbatim into every programmatically-created
    report. A new structural component joins this list by flagging its own
    section on the template row; this function (and its two callers) never
    needs to change again."""
    sections = [s for s in page_template.get("draft_sections") or []
                if s.get("templateRole") == "framework"]
    if not sections:
        raise RuntimeError("Report Page template has no section flagged "
                            "templateRole=='framework' (expected at least ReportRouteList)")
    return sections


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


def resolve_difference_pair(state, route_comps, old_routes):
    """Port of the old tool's 2-comp selection for Route Difference Graph /
    TMC Difference Grid (getActiveRouteComponents, IDENTICAL in both
    components): exactly one Main + one Compare. Explicit
    state.activeRouteComponents = [mainCompId, compareCompId] is honored
    per-slot (74% of corpus instances carry it); any unresolved slot is
    filled with the first OTHER comp whose settings.resolution is equal
    (RAW equality, no 5-minutes default — old: `r.settings.resolution ===
    comp1.settings.resolution`) AND whose route is the same physical route;
    default Main = the report's first comp. Fewer than 2 comps, or no
    partner found → (None, reason) and the graph renders nothing, exactly
    like the old tool.

    Same-physical-route test: the old runtime deep-compared RESOLVED
    tmcArrays. At this point in the pipeline (pre point-resolution — which
    runs later in convert_report and not at all in the census) only the raw
    admin2.routes arrays exist, so: same routeId always matches (identical
    row); different routeIds match iff both raw tmc_arrays are non-empty and
    equal (duplicated routes are common in this corpus); two point-drawn
    routes (empty raw arrays) under different routeIds can't be safely
    matched here and fall to no_pair — a documented, deliberately-tiny
    deviation, chosen so the census (which never resolves points) predicts
    the converter exactly.

    Returns ((main_rc, compare_rc), None) or (None, reason)."""
    comps = [rc for rc in route_comps if rc.get("compId")]
    if len(comps) < 2:
        return None, f"fewer_than_2_comps ({len(comps)})"
    by_id = {rc["compId"]: rc for rc in comps}
    arc = state.get("activeRouteComponents") or []
    c1 = by_id.get(arc[0]) if len(arc) > 0 else None
    c2 = by_id.get(arc[1]) if len(arc) > 1 else None

    def res_of(rc):
        return (rc.get("settings") or {}).get("resolution")

    def raw_tmcs(rc):
        r = old_routes.get(str(rc.get("routeId"))) or {}
        return r.get("tmc_array") or None

    def is_partner(base, cand):
        if cand["compId"] == base["compId"]:
            return False
        if res_of(cand) != res_of(base):
            return False
        if str(cand.get("routeId")) == str(base.get("routeId")):
            return True
        ta, tb = raw_tmcs(base), raw_tmcs(cand)
        return bool(ta) and ta == tb

    def find_partner(base):
        return next((c for c in comps if is_partner(base, c)), None)

    if not c1 and not c2:
        c1 = comps[0]
        c2 = find_partner(c1)
    elif c1 and not c2:
        c2 = find_partner(c1)
    elif c2 and not c1:
        c1 = find_partner(c2)
    if c1 and c2:
        return (c1, c2), None
    anchor = c1 or c2 or comps[0]
    return None, (f"no partner comp for {anchor.get('compId')} (need same "
                  f"resolution {res_of(anchor)!r} + same physical route)")


_WEEKDAY_KEYS = ("sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday")


def _normalize_time(t):
    """Old settings.startTime/endTime appear in the corpus as both 'HH:mm' and
    'HH:mm:ss' (confirmed live on report 1045 — comp-0 series uses '07:00',
    comp-28/29/30/31 use '06:00:00') for the literal same time-of-day. Reduce
    to 'HH:mm' (QuickControls/AddGraphModal/PEAK_PRESETS' own convention)
    before comparing across comps or writing into _measurePick, so a format
    difference alone never causes a spurious measure_pick_window_mixed gap.
    Malformed input passes through verbatim rather than crashing — old data,
    don't assume it's well-formed."""
    if not t:
        return ""
    parts = t.split(":")
    try:
        return f"{int(parts[0]):02d}:{int(parts[1]):02d}"
    except (IndexError, ValueError):
        return t


def _window_signature(settings):
    """(days_on, startTime, endTime) as a hashable tuple, normalized per
    generateDateRange/isDayOn's own semantics (useGraphPublish.js /
    ReportRouteList/utils.js): only an explicit `false` excludes a day, a
    missing key means included. AM/PM/off-peak flags are deliberately excluded
    (proven query-inert in the old client — see old-reports-conversion.md's
    "AM/PM/off-peak flags" note); only weekdays/startTime/endTime have any
    real effect."""
    weekdays = settings.get("weekdays") or {}
    days_on = tuple(weekdays.get(day) is not False for day in _WEEKDAY_KEYS)
    return (days_on, _normalize_time(settings.get("startTime")), _normalize_time(settings.get("endTime")))


def resolve_measure_pick_window(assigned, comps_by_id, gaps, graph_id):
    """Design push #2 (2026-08-06) moved a route's weekday mask / time-of-day
    window off the route entry and onto each GRAPH's own
    `display._measurePick` (see useGraphPublish.js's transformReportRoutes,
    which reads weekdays/start/end from the graph, never from the route).
    An old graph_comp's `assigned` route_comps each carried their own
    weekdays/startTime/endTime — when every assigned comp agrees, that's
    unambiguously the graph's own window; when they don't, there's no single
    correct answer (same shape of problem as the AADT-override
    agree-vs-mixed handling elsewhere in this file), so gap-log and leave the
    graph's window at the empty "all days, all day" default rather than
    guessing at one comp's values over another's."""
    signatures = {_window_signature(comps_by_id.get(c, {}).get("settings") or {}) for c in assigned}
    if len(signatures) > 1:
        gaps.append({"kind": "measure_pick_window_mixed", "graph": graph_id,
                     "detail": "assigned comps disagree on weekdays/startTime/"
                               "endTime; graph's _measurePick window left at "
                               "defaults (all days, all day)"})
        return {"weekdays": {}, "start": "", "end": ""}
    days_on, start, end = next(iter(signatures)) if signatures else (
        tuple(True for _ in _WEEKDAY_KEYS), "", "")
    # Sparse dict, only explicit exclusions (matches QuickControls' setWeekday
    # convention — "storage never carries a same-meaning-but-verbose all-true
    # object").
    weekdays = {} if all(days_on) else {
        day: False for day, on in zip(_WEEKDAY_KEYS, days_on) if not on
    }
    return {"weekdays": weekdays, "start": start, "end": end}


def analyze_graph(g, comps_by_id, gaps):
    """Extract the conversion-relevant facts from an old graph_comp:
    measure (displayData), resolution, dataColumn, assigned comps, title,
    description. Old semantics: a graph shows state.activeRouteComponents
    (default: every comp); state.resolution overrides the comps' own.
    SINGLE_ACTIVE_COMP_TYPES are documented exceptions (confirmed against
    each component's own source, not just GeneralGraphComp's base):
    generateGraphData([route], ...) destructures only the FIRST matching
    active comp — getActiveRouteComponents() defaults to [routes[0].compId],
    never "every comp" like the general case below. Only "Hours of Delay
    Graph" also hardcodes its measure ('hoursOfDelay', ignoring
    state.displayData) — the other three keep the normal displayData[0]
    measure, they're single-route-only, not single-measure-only."""
    state = g.get("state") or {}
    gtype = g.get("type")
    if gtype in SINGLE_ACTIVE_COMP_TYPES:
        order = list(comps_by_id)  # insertion order == old route_comps order
        active = state.get("activeRouteComponents") or []
        chosen = next((c for c in order if c in active), None) or (
            order[0] if order else None)
        assigned = [chosen] if chosen else []
    else:
        assigned = [c for c in (state.get("activeRouteComponents") or [])
                    if c in comps_by_id] or list(comps_by_id)
        if gtype == "Route Line Graph" and not (state.get("activeRouteComponents") or []):
            # RouteLineGraph.jsx (transportNY) overrides GeneralGraphComp's
            # getResolution()/getActiveRouteComponents(): with no explicit
            # comp selection it does NOT show every comp regardless of
            # resolution (unlike the generic `or list(comps_by_id)` fallback
            # above) — it shows only the comps matching ONE resolution group:
            # state.resolution if some comp actually has it, else routes[0]'s
            # (original report order) resolution. Comps in other resolution
            # groups are silently excluded from the graph by default (real
            # old-tool behavior, not a data loss bug) until an author flips
            # the "Resolution" selector it shows whenever >1 group exists —
            # not replicated here, so conversion always lands on the default
            # group, same as an unopened old report would render.
            order = list(comps_by_id)
            res_of = lambda c: (comps_by_id[c].get("settings") or {}).get("resolution") or "5-minutes"
            default_res = res_of(order[0]) if order else "5-minutes"
            state_res = state.get("resolution")
            state_res = state_res if isinstance(state_res, str) else None
            winning_res = state_res if state_res and any(
                res_of(c) == state_res for c in order) else default_res
            assigned = [c for c in order if res_of(c) == winning_res]

    if gtype == "Hours of Delay Graph":
        measure = "hoursOfDelay"
        cost_per_hour = state.get("costPerHour")
        if cost_per_hour:
            gaps.append({"kind": "cost_per_hour_not_applied", "graph": g.get("id"),
                         "detail": cost_per_hour})
    else:
        dd = state.get("displayData")
        measures = [m for m in dd if m != "none"] if isinstance(dd, list) else []
        # Route Map distinguishes an EXPLICIT displayData ["none"] (geometry-
        # only overview map, 97 corpus instances) from an absent displayData
        # (default: speed). The generic filter above erases that distinction —
        # restore it here so none-maps hit route_map_none_{year} instead of
        # silently converting as speed.
        if gtype == "Route Map" and isinstance(dd, list) and dd and not measures:
            measure = "none"
        else:
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
    # Absent/null comp resolution means 5-minutes, not "unknown" (verified
    # 2026-07-08 against the old client both ways: comps are CREATED with
    # resolution '5-minutes' — transportNY analysis/reports/store/index.js
    # ~1887 — and the graph layer's getResolution() falls back to '5-minutes'
    # when the setting is missing, graphClasses/GeneralGraphComp.jsx:306).
    resolutions = {(comps_by_id[c].get("settings") or {}).get("resolution")
                   or "5-minutes"
                   for c in assigned}
    # Ancient reports (ids ~211-271, a "version": 2 client shape) store a whole
    # route-comp OBJECT under state.resolution where every later report stores
    # a plain string — treat non-strings as absent (fall back to the comps' own
    # resolution) and gap-log, don't crash on the unhashable dict.
    state_resolution = state.get("resolution")
    if state_resolution and not isinstance(state_resolution, str):
        gaps.append({"kind": "malformed_state_resolution", "graph": g.get("id"),
                     "detail": f"non-string state.resolution "
                               f"({type(state_resolution).__name__}) ignored"})
        state_resolution = None
    if state_resolution:
        resolution = state_resolution
    elif len(resolutions) == 1:
        resolution = next(iter(resolutions))
    elif gtype == "Bar Graph Summary":
        # BarGraphSummary.jsx's own generateGraphData/renderGraph never
        # reference the `resolution` param at all (each bar is one comp's
        # whole-date-range allReducer aggregate, independent of any shared
        # axis — confirmed 2026-07-17) — but avgHoursOfDelay's per-resolution
        # calculated column still keys off info["resolution"] downstream
        # (round 32/36), so a concrete value is needed, not a gap. Resolve it
        # exactly the way the real (unmodified) GeneralGraphComp.getResolution()
        # would: the first assigned comp's own resolution, in the report's
        # original comp order (same rule as SINGLE_ACTIVE_COMP_TYPES above,
        # just without shrinking `assigned` itself — BarGraphSummary's own
        # getActiveRouteComponents() override genuinely renders every comp as
        # its own bar). For speed/travelTime/hoursOfDelay every real
        # resolution maps to the same template anyway (see GRAPH_TEMPLATE_MAP),
        # so which comp "wins" doesn't change the outcome there.
        order = list(comps_by_id)
        first = next((c for c in order if c in assigned), None)
        resolution = ((comps_by_id[first].get("settings") or {}).get("resolution")
                      or "5-minutes") if first else None
    else:
        resolution = None
        # Route/TMC Info Box never read `resolution` (see INFO_BOX_BUCKET's
        # comment) — a real ambiguity for a chart with one shared x-axis, but
        # not a real gap for these two, so don't clutter the report with it.
        # Difference graphs (round 52) re-derive resolution/dataColumn from
        # their resolved Main/Compare PAIR in convert_report's pre-pass — a
        # mixed full-comp set is expected there, not a gap. Route Map: only
        # its avgHoursOfDelay measure's calculated column is actually
        # resolution-dependent (round 32/41's ROUTE_MAP_AVGDELAY_VALUE_EXPR_
        # BY_RESOLUTION) — none/speed/travelTime/hoursOfDelay's
        # route_map_tmpl_name branch never reads info["resolution"] at all,
        # so a mixed set there is analyzer noise, not a real gap (confirmed
        # 2026-07-17: 145 of the corpus's 146 Route-Map mixed-resolution
        # instances are non-avgHoursOfDelay). Route Compare Component
        # (2026-07-20): RouteCompareComponent.jsx reduces each assigned comp
        # to ONE whole-date-range scalar independently (allReducer/reducer),
        # exactly like ensure_route_compare_template's self-aggregating
        # MEASURE_EXPR — the `resolution` parameter threaded through
        # generateGraphData/generateTableData/renderGraph is never actually
        # referenced in that component's body, confirmed by reading it
        # directly. A mixed resolution set across its base+compare rows is
        # analyzer noise, not a real gap (breakdown: 21 of the corpus's 159
        # mixed_resolutions_on_graph instances were this type).
        route_map_resolution_irrelevant = (
            gtype == "Route Map" and measure != "avgHoursOfDelay")
        resolution_irrelevant = (route_map_resolution_irrelevant
                                  or gtype == "Route Compare Component")
        if (gtype not in INFO_BOX_GRAIN and gtype not in DIFFERENCE_GRAPH_TYPES
                and not resolution_irrelevant):
            gaps.append({"kind": "mixed_resolutions_on_graph", "graph": g.get("id"),
                         "detail": sorted(map(str, resolutions))})
    data_columns = {(comps_by_id[c].get("settings") or {}).get("dataColumn")
                    for c in assigned}
    if len(data_columns) == 1:
        data_column = next(iter(data_columns))
    else:
        data_column = None
        if gtype not in DIFFERENCE_GRAPH_TYPES:
            gaps.append({"kind": "mixed_data_columns_on_graph", "graph": g.get("id"),
                         "detail": sorted(map(str, data_columns))})
    # "{data} AM Peak" / "{type}, {data}" / "{data} {name}" title templates →
    # literal text ({name} = the assigned route comp's display name).
    # Old client default (never customized in the common case, confirmed on
    # reports 520/179's raw graph_comps): an empty/missing state.title falls
    # back to "{type}, {data}", not a blank section title.
    title = state.get("title") or "{type}, {data}"
    title = title.replace("{data}", MEASURE_NAMES.get(measure, measure))
    title = title.replace("{type}", gtype or "")
    # Captured before the {name} replace below so callers can tell whether
    # THIS graph's own title template ever carried a name-derived
    # distinction at all — used by the route-comp-merge title-suffix fix
    # (a merged route's own name goes generic, so a graph whose title never
    # had {name} to begin with needs another way to keep showing which
    # peak/date window it represents).
    had_name_token = "{name}" in title
    # Filtered so a template's intentionally-empty comp labels (see
    # generic_comp_label) don't leave stray ", , " artifacts when joined
    # alongside comps that DO have a recoverable generic label — a no-op
    # for --report-id conversions, where a comp's name is never empty.
    comp_names = ", ".join(filter(None, ((comps_by_id[c].get("name") or "").strip()
                                         for c in assigned)))
    title = title.replace("{name}", comp_names)
    description = (state.get("message") or {}).get("text", "")
    return {"type": gtype, "measure": measure, "resolution": resolution,
            "data_column": data_column, "assigned": assigned,
            "title": title.strip(), "description": description,
            "had_name_token": had_name_token, "comp_names": comp_names}


def build_graph_section_data(page_id, tmpl, tracking_id, info, gaps, old_graph,
                             color_range=None, aadt_override=None,
                             diff_invert=False, comps_by_id=None):
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
    is_map = tmpl["data"].get("elementType") == "Map"
    # Map sections have no `display.colors` concept at all — the choropleth
    # paint itself IS the color (see bake_route_map_choropleth_paint below), so the
    # generic AVL-Graph color_range wiring is not just inert but the wrong
    # target entirely; skip it here rather than write a dead key.
    if color_range and old_graph.get("type") in COLOR_RANGE_GRAPH_TYPES and not is_map:
        # Round 51 fix: old GeneralGraphComp.getColorRange() reverses
        # report.color_range for reverseColors:true measures (see
        # REVERSE_COLORS_MEASURES) BEFORE any old graph component ever
        # renders it — this generic wiring skipped that step entirely,
        # so e.g. every converted TMC Grid Graph/travelTime page rendered
        # short/good travel times red and long/bad ones green (backwards).
        # Only the Map path (bake_route_map_choropleth_paint/
        # bake_route_map_delay_paint) had this applied, since round 50.
        #
        # 2026-07-30 fix: that reversal rule is validated correct for RAW
        # VALUE coloring (TMC Grid Graph, Route Bar Graph), but two of
        # COLOR_RANGE_GRAPH_TYPES — Route Difference Graph / TMC Difference
        # Grid — color a before-minus-after DELTA instead, and the polarity
        # inverts between those two cases (see _diff_colors' docstring for
        # the derivation; same bug, same fix, different call path — this one
        # fires when the OLD report carried its own custom color_range
        # instead of the template's default ramp).
        wants_reverse = info["measure"] in REVERSE_COLORS_MEASURES
        if old_graph.get("type") in DIFFERENCE_GRAPH_TYPES:
            wants_reverse = not wants_reverse
        colors = list(reversed(color_range)) if wants_reverse else color_range
        colors_cfg = {"type": "palette", "value": colors}
        # BarGraph colors by series by default (one color per route) — these
        # converted reports are single-series magnitude charts (the old
        # client colored each bar by its own value: "more delay = darker"),
        # so opt into BarGraph's byValue coloring mode to match.
        if state.get("display", {}).get("graphType") == "BarGraph":
            colors_cfg["byValue"] = True
        # Round 52: this wholesale replace was silently dropping any color
        # FLAGS the template itself carries — the difference templates set
        # byValueSymmetric (zero-centered scale, old d3.scaleQuantize
        # ([-max, +max]) parity) on their default colors; carry it onto the
        # report's own palette too.
        tmpl_colors = (state.get("display") or {}).get("colors") or {}
        if tmpl_colors.get("byValueSymmetric"):
            colors_cfg["byValueSymmetric"] = True
        state.setdefault("display", {})["colors"] = colors_cfg
    # Round 80 (2026-08-27, old-reports-conversion.md): Route Map choropleth
    # coloring used to be baked per-report here (a live ClickHouse quantile
    # query over this graph's assigned TMCs/dates, per bake_route_map_
    # choropleth_paint/bake_route_map_delay_paint) — retired outright, not
    # replaced. Every route_map_*_template now embeds PERMANENT static breaks
    # from the shared colorBreaks.json (same table composeMapConfig.js/
    # composeMeasureConfig.js read), so there is nothing left to bake — the
    # cloned template's own paint is already correct as-is. `is_map` above is
    # kept (still used by the color_range-wiring skip just above this comment).
    # overrides.aadt → substitute the AADT term(s) inside the cloned calculated
    # column expression(s) (see AADT_OVERRIDE_SUBS above for the old-tool
    # semantics each replacement reproduces). Zero matches on a template that
    # was expected to consume AADT means the template row drifted from this
    # script's expression constants — gap-log loudly rather than silently
    # converting without the override.
    if aadt_override is not None:
        hits = 0
        for col in state.get("columns", []):
            name = col.get("name")
            if col.get("type") != "calculated" or not isinstance(name, str):
                continue
            for frag, repl in AADT_OVERRIDE_SUBS:
                if frag in name:
                    name = name.replace(frag, repl.format(ov=aadt_override))
                    hits += 1
            col["name"] = name
        if hits == 0:
            gaps.append({"kind": "aadt_override_not_applied",
                         "graph": old_graph.get("id"),
                         "detail": f"override {aadt_override}: no known AADT "
                                   f"fragment in template "
                                   f"'{tmpl['data'].get('name')}'"})
    # Round 52 (difference graphs): when the pair's Main sits after its
    # Compare in the page's shared route-list order, flip the server-side
    # subtraction so the rendered value stays Main − Compare (see the
    # route-diff pre-pass in convert_report). Per-SECTION patch on the cloned
    # state — the template row itself stays invert-free.
    if diff_invert:
        combine = dict((state.get("comparisonSeries") or {})
                       .get("combine") or {"mode": "difference"})
        combine["invert"] = True
        state.setdefault("comparisonSeries", {})["combine"] = combine
    # Design push #2 (2026-08-06): a self-bound graph (`$self` comparison_series
    # subscriber — see useGraphPublish.js's findSelfBoundGraphs) reads its own routes
    # from `display._measurePick.routeIds`, not the route's own (now-dead) `graphIds`
    # — that inversion shipped for the live UI (QuickControls/AddGraphModal) the same
    # day this converter was last touched, and this function was never updated to
    # match, so every graph_template clone came out with `_measurePick` absent and
    # `routeIds` permanently empty: `useGraphPublish`'s publish effect always resolved
    # zero routes for it, regardless of what a Dynamic Report viewer picked via the
    # route-slot modal. `info["assigned"]` is already the exact inverse of the old
    # per-route `graphIds` computation two lines below in the caller (the same
    # route_comp_id space `build_route_entry`/`build_slot_entry` write as
    # `route_comp_id`) — only set when the template already wires the `$self`
    # subscriber, never invent that wiring here. `weekdays`/`start`/`end` come from
    # resolve_measure_pick_window: the per-graph window every assigned old route_comp
    # agreed on, or the empty "all days, all day" default when they disagreed
    # (gap-logged there). Computed here (only for self-bound graphs, gated the same
    # as routeIds below) rather than in analyze_graph, so graph types that don't
    # consume `_measurePick` yet (e.g. Route Map — see
    # dynamic-report-nongraph-section-binding.md item 1) never get a spurious
    # "comps disagree" gap logged for a window that was never going to be written
    # anyway. Before this, weekdays/start/end were hardcoded to the empty default
    # unconditionally, silently dropping any weekday mask / peak-hour window a
    # converted report used to have — the route entry's own (now-dead, per
    # useGraphPublish.js) `weekdays`/baked startTime/endTime were never actually read
    # by anything post design-push-#2.
    subscribers = (state.get("display") or {}).get("_functions", {}).get("subscribers") or []
    is_self_bound = any(s.get("functionId") == "comparison_series" and s.get("enabled")
                         and s.get("paramKey") == "$self" for s in subscribers)
    if is_self_bound:
        # Changing this field's shape? Every golden-corpus entry tagged
        # "display._measurePick.routeIds" (scripts/npmrds-reports/report_probe_fixtures/
        # golden-corpus.json) needs re-verifying — `node scripts/npmrds-reports/
        # probe_corpus.mjs --only <key>` before/after — see
        # src/dms/skills/regression-testing-npmrds-reports.md.
        window = resolve_measure_pick_window(info["assigned"], comps_by_id or {}, gaps,
                                              old_graph.get("id"))
        # 2026-08-25: `weekdays`/`start`/`end` here are DEAD — commit cff5318 (2026-08-14)
        # moved the live read (useGraphPublish.js's transformReportRoutes) onto
        # `routeWindows: {[route_comp_id]: [{weekdays,start,end}, ...]}` exclusively, two
        # days after this function started baking the flat fields in (round 70). Every
        # report converted since 2026-08-14 silently reverted to "all days, all hours"
        # again — same failure mode round 70 fixed, new mechanism. Fan the one
        # graph-level window (every assigned comp already agreed, or it's the gap-logged
        # empty default) out to each assigned comp's own routeWindows entry — this
        # converter has no per-comp variation to preserve (round 70 never captured that
        # granularity; see resolve_measure_pick_window's own "no single correct answer"
        # framing for the disagreement case), so one shared variant per comp is the
        # faithful translation of what round 70 already computed, not a new decision.
        state.setdefault("display", {})["_measurePick"] = {
            "weekdays": window["weekdays"], "start": window["start"], "end": window["end"],
            "routeIds": list(info["assigned"]),
            "routeWindows": {
                cid: [{"weekdays": window["weekdays"], "start": window["start"], "end": window["end"]}]
                for cid in info["assigned"]
            },
        }
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


