import json

from .vocab import ALL_WEEKDAYS

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
    # `aadt` is handled per-graph now (baked into the cloned calculated column
    # when every assigned comp agrees — see graph_aadt_overrides in
    # convert_report; disagreement gets its own aadt_override_mixed gap, and a
    # falsy '0' override is query-inert in the old tool, getAADT's
    # `if (aadtOverride)`). Other override keys (baseSpeed, thresholdSpeed, …)
    # remain unimplemented and still gap-log here.
    other_overrides = {k: v for k, v in (settings.get("overrides") or {}).items()
                       if k != "aadt"}
    if other_overrides:
        gaps.append({"kind": "overrides", "route": comp_name,
                     "detail": other_overrides})
    if settings.get("relativeDate") and not settings.get("_relative_date_resolved"):
        gaps.append({"kind": "relative_date", "route": comp_name,
                     "detail": settings["relativeDate"]})


_MONTH_NAMES = {"01": "January", "02": "February", "03": "March",
                "04": "April", "05": "May", "06": "June", "07": "July",
                "08": "August", "09": "September", "10": "October",
                "11": "November", "12": "December"}


def _comp_year_string(s):
    # transportNY reports/store/index.js getYearString — including its quirky
    # `${end}-${start}` order for multi-year advanced ranges, kept verbatim.
    if s.get("year") != "advanced" and not s.get("useRelativeDateControls"):
        return str(s.get("year"))
    start, end = str(s.get("startDate"))[:4], str(s.get("endDate"))[:4]
    return start if start == end else f"{end}-{start}"


def _comp_month_string(s):
    month = s.get("month")
    if month == "all":
        return f"Jan-Dec, {s.get('year')}"
    if month != "advanced" and not s.get("useRelativeDateControls"):
        name = _MONTH_NAMES.get(str(month).zfill(2))
        return f"{name[:3]}, {s.get('year')}" if name else str(month)
    start, end = str(s.get("startDate")), str(s.get("endDate"))
    m1, m2, y1, y2 = start[4:6], end[4:6], start[:4], end[:4]
    if y1 == y2:
        if m1 == m2:
            return f"{_MONTH_NAMES[m1][:3]}, {y1}"
        return f"{_MONTH_NAMES[m1][:3]}-{_MONTH_NAMES[m2][:3]}, {y1}"
    return _comp_year_string(s)


def _comp_date_string(s):
    start, end = str(s.get("startDate")), str(s.get("endDate"))
    if start == end:
        return f"{_MONTH_NAMES[start[4:6]][:3]} {int(start[6:])}, {start[:4]}"
    return _comp_month_string(s)


def route_comp_display_name(rc, old_route):
    """Old client's getRouteCompName (transportNY reports/store/index.js:2703):
    a comp's display name is settings.compTitle with {name}/{year}/{month}/
    {date} substituted (getYearString/getMonthString/getDateString ported
    above); plain route name when compTitle is empty. Without this, sibling
    comps of the same route (e.g. report 520's five "WB Arterial Weave" comps
    differing only in year/time window) all get the bare route name — and
    since comp names become comparison-series `__series` labels, every graph
    visually merges them into one series (caught live by the user on the
    first report_520 conversion, 2026-07-13)."""
    name = rc.get("name") or (old_route or {}).get("name") or ""
    s = rc.get("settings") or {}
    if not s.get("compTitle"):
        return name
    try:
        return (s["compTitle"].replace("{name}", name)
                .replace("{year}", _comp_year_string(s))
                .replace("{month}", _comp_month_string(s))
                .replace("{date}", _comp_date_string(s)))
    except Exception:
        return name  # malformed settings — keep converting on the plain name


def route_comp_merge_key(rc, old_route=None, tmc_override=None):
    """Groups route_comps that represent the SAME real route + calendar date
    range. Design Push #2 (2026-08-06) moved weekday-mask/time-of-day off the
    route and onto each GRAPH's own display._measurePick — so comps sharing
    (routeId, calendar startDate, calendar endDate) that differ only in the
    old tool's own peak/weekday/resolution slicing are redundant at the
    route level now (`build_route_entry`/`build_slot_entry` callers collapse
    them into one entry). Calendar date range stays a real route-level fact
    (before/after, year-over-year) and is never part of the collapse.
    Deliberately EXCLUDES startTime/endTime/weekdays/resolution.

    Resolved tmc_array is included as a defensive tie-breaker for the case
    where a routeId's underlying TMC set changed between two comps' own
    creation — in practice always identical for comps sharing routeId+dates
    (resolved_tmcs is itself derived from those same dates), so this closes
    that edge case by construction rather than needing a corpus sweep. On
    the template/slot path (no old_route, no tmc_override) this always
    resolves to an empty tuple, so it's a no-op there — an equivalent
    3-part key.

    flatten_route_comps + resolve_relative_dates already ran before this is
    called, so settings["startDate"]/["endDate"] are always concrete
    YYYYMMDD ints here — safe to compare directly, no rounding concerns."""
    settings = rc.get("settings") or {}
    tmc = tmc_override or (old_route or {}).get("tmc_array") or []
    return (str(rc.get("routeId")), settings.get("startDate"),
            settings.get("endDate"), tuple(sorted(map(str, tmc))))


def group_route_comps(route_comps, key_fn):
    """Stable grouping (first-seen order preserved, both across groups and
    within each group) — the first rc in a group becomes its representative
    in the merge callers below."""
    groups, order = {}, []
    for rc in route_comps:
        k = key_fn(rc)
        if k not in groups:
            groups[k] = []
            order.append(k)
        groups[k].append(rc)
    return [groups[k] for k in order]


def generic_comp_label(rc, gaps=None):
    """Template (Dynamic Report) route slots are filled with ANY
    (name + tmc_array) a viewer later supplies — the DATE stays fixed,
    known, and saved on the slot itself (unchanged by this function; see
    build_slot_entry's own startDate/endDate, always set from the comp's
    real settings regardless of naming). Only the ROUTE-NAME portion of an
    old comp's label is what must never leak through generically — a
    slot's own name, and any graph title that would otherwise substitute
    it in via {name}, must never bake in a specific old route name.

    compTitle's {name} token marks exactly the route-specific portion;
    blanking just that (while substituting {year}/{month}/{date} with
    their real computed values, same helpers route_comp_display_name
    itself uses) recovers a label like "{year} - AM - {name}" -> "2023 -
    AM" — date kept, route name dropped.

    When compTitle has NONE of {name}/{year}/{month}/{date} at all, it's
    pure literal text an analyst typed directly for one specific real
    route (e.g. "I-490 36055 EB AM Peak") — there's no structural signal to
    separate a reusable peak/dow/date label from the route-specific words
    in that string, so this returns "" rather than guess and leak the
    route name through."""
    settings = rc.get("settings") or {}
    compTitle = settings.get("compTitle") or ""
    tokens = ("{name}", "{year}", "{month}", "{date}")
    if not any(t in compTitle for t in tokens):
        if compTitle and gaps is not None:
            gaps.append({"kind": "template_comp_title_not_generic",
                         "route": rc.get("compId"),
                         "detail": f"compTitle {compTitle!r} has no "
                                   "{name}/{year}/{month}/{date} token to "
                                   "strip — no reusable peak/dow/date label "
                                   "could be recovered; slot/graph title "
                                   "left blank for this comp rather than "
                                   "keep the route-specific literal text"})
        return ""
    try:
        residue = (compTitle.replace("{name}", "")
                   .replace("{year}", _comp_year_string(settings))
                   .replace("{month}", _comp_month_string(settings))
                   .replace("{date}", _comp_date_string(settings)))
    except Exception:
        return ""
    return residue.strip(" -–—,·|/").strip()


def merged_group_date_label(settings):
    """The date-only label for a MERGED route slot entry (>1 comp
    collapsed into one) — deliberately does NOT reuse generic_comp_label's
    per-comp compTitle residue, since a merge group's members differ
    precisely in their peak/weekday/resolution suffix (that's the whole
    reason they merged); showing any ONE member's suffix on the shared
    entry would misrepresent it as "the AM one" when it now feeds every
    merged member's graphs. The calendar date range IS shared across the
    whole group by construction (part of the merge key) — safe to show."""
    year = settings.get("year")
    if year and year != "advanced":
        return str(year)
    start, end = settings.get("startDate"), settings.get("endDate")
    if start and end:
        s, e = str(start), str(end)
        return s[:4] if s[:4] == e[:4] else f"{s[:4]}-{e[:4]}"
    return ""


def build_route_entry(rc, old_route, graph_tracking_ids, old_report_id, gaps,
                      tmc_override=None):
    settings = rc.get("settings") or {}
    route_settings_gaps(settings, rc.get("name"), gaps)
    start = to_datetime_str(settings.get("startDate"), settings.get("startTime"))
    end = to_datetime_str(settings.get("endDate"), settings.get("endTime"))
    resolved_tmc_array = tmc_override or (old_route or {}).get("tmc_array") or []
    # A route with no resolvable TMC identity (route_missing_everywhere) can
    # never contribute real data — every measure in this whole pipeline is
    # TMC-scoped. Worse than just useless: buildUdaConfig.js's filter-cleaning
    # WIDENS an empty-valued filter leaf to "no constraint" rather than
    # compiling it to `col IN ()` (a deliberate choice for a different,
    # legitimate case — an unset page-filter control). Wiring a tmc-less route
    # into a graph's comparisonSeries lets that arm run with NO tmc
    # restriction at all — on a `categorize:"tmc"` template (real `tmc` in
    # groupBy, not just `__series`) that's a genuine unfiltered-nationwide-TMC
    # scan, not just wasted work. Confirmed live 2026-07-10: report 1032's
    # Hours of Delay Graph arm for a missing route requested a 4.4M-row
    # dataByIndex range (every TMC in the table × 288 epochs), tripping
    # falcor-router's MAX_PATHS=9000 cap; the identical combination was
    # already live and unnoticed on report_392 since round 12. So: never
    # assign graphIds to a route with no real TMC array, regardless of what
    # the caller computed.
    graph_ids = list(graph_tracking_ids) if resolved_tmc_array else []
    entry = {
        "name": rc.get("name") or (old_route or {}).get("name") or "",
        "route_id": str(rc.get("routeId")),
        "route_slot_group": str(rc.get("routeId")),
        "tmc_array": js(resolved_tmc_array),
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
        # state.activeRouteComponents (absent → the graph showed every comp);
        # forced to [] above when there's no real TMC to scope a query with.
        "graphIds": graph_ids,
        "color": rc.get("color") or "",
        # Preserve the old comp verbatim — schema-free row, nothing is lost
        "_old_settings": settings,
        "_old_report_id": old_report_id,
    }
    if not resolved_tmc_array and graph_tracking_ids:
        gaps.append({"kind": "route_excluded_from_graphs_no_tmc",
                     "route": rc.get("name"),
                     "detail": f"route_id {rc.get('routeId')} has no resolvable "
                               "tmc_array; excluded from "
                               f"{len(graph_tracking_ids)} assigned graph(s) "
                               "to avoid an unfiltered scan"})
    if start:
        entry["startDate"] = start
    if end:
        entry["endDate"] = end
    # First-class day-of-week mask (old settings shape kept verbatim:
    # {monday: bool, ..., sunday: bool}); transformReportRoutes drops
    # explicitly-false days from the enumerated date filter.
    if settings.get("weekdays"):
        entry["weekdays"] = settings["weekdays"]
    # Mechanism B (resolve_relative_dates already ran over this report's full
    # route_comps list before this function was called) — startDate/endDate
    # above are still the concrete literal (safe fallback / unchanged for
    # every other consumer); dateFormula+derivedFromRoute let the JS side
    # live-recompute if the referenced base route's own date is edited later.
    resolved = settings.get("_relative_date_resolved")
    if resolved:
        entry["dateFormula"] = resolved["formula"]
        entry["derivedFromRoute"] = resolved["derivedFromCompId"]
    return entry


def build_slot_entry(rc, graph_tracking_ids, old_template_id):
    """build_route_entry's twin for template conversion (`convert_template`) —
    an unfilled ROUTE SLOT placeholder, not a resolved route. Per the unified
    mechanism design (dynamic-reports-and-route-tags.md item 3, revised
    2026-08-03 per Ryan: "treat all templates as if they have no routes,
    pull from graph_comps only"): every old comp's `routeId` is ignored as
    data (never fetched, never resolved to a real tmc_array) — it's reused
    ONLY as a grouping key (`route_slot_group`), because the old tool's own
    `routeId` value (a real id, a `$N` placeholder, or a `synthetic:...` key)
    already IS that comp's route-slot identity: several comps can share one
    value when they're different date/settings VIEWS of the conceptual same
    route (e.g. template 244 "Year Over Year"'s 11 comps, all routeId
    163181 — one route, 11 time windows). `useDynamicReportRoutes.js`
    resolves every slot sharing a group against the SAME real route a viewer
    supplies once.

    Unlike build_route_entry, `graphIds` is NEVER gated on tmc-resolvability
    — a slot never has a tmc_array by definition (that's what makes it a
    slot), and `useGraphPublish.js`'s `transformReportRoutes` (fixed
    2026-08-03, the same day this function was written) already excludes any
    route/slot with no real tmc_array from publishing — so an always-present
    graphIds assignment is safe: inert until a real route fills the slot,
    then works immediately, exactly like any other authored graph
    assignment."""
    settings = rc.get("settings") or {}
    start = to_datetime_str(settings.get("startDate"), settings.get("startTime"))
    end = to_datetime_str(settings.get("endDate"), settings.get("endTime"))
    entry = {
        # `rc["name"]` was already resolved to its final (generic,
        # route-/date-free) label by convert_template's own per-rc loop
        # before this function runs (see generic_comp_label) — no fallback
        # to route_comp_display_name here: that function's full rendering
        # bakes in a specific route name/date, which a template's own
        # unfilled route slot must never carry (a viewer can fill it with
        # ANY route later). An empty label is a correct outcome (see
        # generic_comp_label's own docstring for when/why), not a bug to
        # paper over with a route-specific fallback.
        "name": rc.get("name") or "",
        "route_comp_id": rc.get("compId") or "",
        "route_slot_group": str(rc.get("routeId")),
        "graphIds": list(graph_tracking_ids),
        "isValid": True,
        "color": rc.get("color") or "",
        "_old_settings": settings,
        "_old_template_id": old_template_id,
    }
    if start:
        entry["startDate"] = start
    if end:
        entry["endDate"] = end
    if settings.get("weekdays"):
        entry["weekdays"] = settings["weekdays"]
    resolved = settings.get("_relative_date_resolved")
    if resolved:
        entry["dateFormula"] = resolved["formula"]
        entry["derivedFromRoute"] = resolved["derivedFromCompId"]
    return entry


