import calendar
import re
from collections import defaultdict
from datetime import date, timedelta

# ── Relative dates, Mechanism B (`relativeDate`/`isRelativeDateBase`) ───────
# See dynamic-reports-and-route-tags.md item 3 and
# research/npmrds-reports/info-box-speed-and-relative-dates-scoping.md Part 2
# for the full investigation. This is a line-for-line port of transportNY's
# reports/store/utils/relativedates.utils.js, verified against real corpus
# data (templates 278/279) before implementation, not just read.

RELATIVE_DATE_RE = re.compile(
    r'^(?P<anchor>startDate|endDate)=>'
    r'(?P<span>day|week|month|year)(?P<isof>of)?'
    r'(?:(?P<sign>[+-])(?P<amount>\d+)(?P=span)->(?P<duration>\d+)(?P=span))?$')


def _parse_yyyymmdd(v):
    s = str(v)
    if len(s) != 8 or not s.isdigit():
        return None
    return date(int(s[0:4]), int(s[4:6]), int(s[6:8]))


def _format_yyyymmdd(d):
    return int(d.strftime("%Y%m%d"))


def _start_of_span(d, span):
    if span == "day":
        return d
    if span == "week":
        return d - timedelta(days=(d.weekday() + 1) % 7)  # Sunday-start (moment's default "en" locale)
    if span == "month":
        return d.replace(day=1)
    return d.replace(month=1, day=1)  # year


def _end_of_span(d, span):
    if span == "day":
        return d
    if span == "week":
        return _start_of_span(d, "week") + timedelta(days=6)
    if span == "month":
        return d.replace(day=calendar.monthrange(d.year, d.month)[1])
    return d.replace(month=12, day=31)  # year


def _shift_spans(d, span, n):
    """`d` must already be a start-of-`span` date (day-of-month is always
    valid — 1 for month/year spans, an exact Sunday for week) — mirrors
    moment's .add()/.subtract() called immediately after .startOf()."""
    if span == "day":
        return d + timedelta(days=n)
    if span == "week":
        return d + timedelta(weeks=n)
    if span == "month":
        total = d.year * 12 + (d.month - 1) + n
        return date(total // 12, total % 12 + 1, 1)
    return date(d.year + n, 1, 1)  # year


def _resolve_relative_date_formula(formula, base_settings):
    """Returns (start_int, end_int) YYYYMMDD, or None if the formula doesn't
    parse or the base's own dates aren't concrete 8-digit values.

    Special form (`yearof`/`monthof`/`weekof`/`dayof`): start/end snap
    INDEPENDENTLY from the base's own startDate/endDate (moment's
    calculateTimespanOf — confirmed by reading relativedates.utils.js
    directly, not inferred: if the base's start/end fall in different
    weeks/months/years, the result spans start-of-startDate's-period to
    end-of-endDate's-period, not one single period).

    General form (e.g. `year-2year->1year`): the leading `startDate|endDate`
    token picks which of the BASE's own two fields is the anchor and hard-
    codes direction (startDate anchor -> subtract `amount`, endDate anchor ->
    add `amount` — the sign character in the string is cosmetic only, per
    the real implementation). `duration` extends forward `duration` spans
    from the (already-offset) start, inclusive (minus 1 day)."""
    m = RELATIVE_DATE_RE.match(formula or "")
    if not m:
        return None
    anchor_field, span, is_of = m.group("anchor"), m.group("span"), m.group("isof")
    base_start, base_end = base_settings.get("startDate"), base_settings.get("endDate")
    if is_of:
        s, e = _parse_yyyymmdd(base_start), _parse_yyyymmdd(base_end)
        if not s or not e:
            return None
        return (_format_yyyymmdd(_start_of_span(s, span)),
                _format_yyyymmdd(_end_of_span(e, span)))
    anchor = _parse_yyyymmdd(base_start if anchor_field == "startDate" else base_end)
    if not anchor:
        return None
    amount, duration = int(m.group("amount")), int(m.group("duration"))
    start = _start_of_span(anchor, span)
    start = _shift_spans(start, span, -amount if anchor_field == "startDate" else amount)
    end = _shift_spans(start, span, duration) - timedelta(days=1)
    return (_format_yyyymmdd(start), _format_yyyymmdd(end))


def resolve_relative_dates(route_comps, gaps):
    """Resolves Mechanism B comps in place. Confirmed against real corpus
    data (templates 278/279) that a comp's base is always the OTHER comp
    sharing its own `routeId` flagged `isRelativeDateBase` — holds even
    across nested `route_comps[].type=='group'` entries (279's two
    independent NB/SB bases each pair only with their own group's derived
    comp, under the same routeId — `$0`/`$1` respectively) — so grouping by
    routeId alone captures the correct scope; flatten_route_comps already
    preserves each comp's own routeId, so no separate nesting-awareness is
    needed here.

    Mutates each resolved comp's `settings` in place: overwrites
    startDate/endDate with the freshly-computed concrete literal (the same
    write-back convention the old tool itself used — every existing
    downstream consumer, e.g. graph_max_year/to_datetime_str, keeps reading
    a concrete date completely unchanged) and stamps a private
    `_relative_date_resolved` marker (same leading-underscore convention as
    `_old_settings`/`_old_color`) so build_route_entry/build_slot_entry can
    surface `dateFormula`/`derivedFromRoute` for the JS-side live-recompute
    mechanism, and so route_settings_gaps knows not to gap-log an
    already-resolved comp. A group with zero or >1 `isRelativeDateBase`
    comps, or a formula that fails to parse/resolve, is left untouched —
    route_settings_gaps still gap-logs those as before."""
    by_route_id = defaultdict(list)
    for rc in route_comps:
        by_route_id[str(rc.get("routeId"))].append(rc)
    for group in by_route_id.values():
        bases = [rc for rc in group if (rc.get("settings") or {}).get("isRelativeDateBase")]
        derived = [rc for rc in group if (rc.get("settings") or {}).get("relativeDate")]
        if not derived or len(bases) != 1:
            continue
        base_settings = bases[0].get("settings") or {}
        base_comp_id = bases[0].get("compId")
        for rc in derived:
            settings = rc.get("settings") or {}
            resolved = _resolve_relative_date_formula(settings["relativeDate"], base_settings)
            if resolved is None:
                continue
            settings["startDate"], settings["endDate"] = resolved
            settings["_relative_date_resolved"] = {
                "formula": settings["relativeDate"],
                "derivedFromCompId": base_comp_id,
            }


PRE_2017_CUTOFF = 20170101


def route_comp_is_pre_2017(settings):
    """True only when both startDate/endDate are present and the whole
    range falls before 2017-01-01 (npmrds.s583_v982_NPMRDS_V6 starts 2017,
    round 13) — comps missing either date are left as 'unknown, not
    pre-2017' rather than assumed broken (14/5154 corpus route_comps)."""
    start, end = settings.get("startDate"), settings.get("endDate")
    if not start or not end:
        return False
    try:
        return int(str(start)) < PRE_2017_CUTOFF and int(str(end)) < PRE_2017_CUTOFF
    except ValueError:
        return False


def report_is_pre_2017_only(route_comps):
    """True iff EVERY route_comp in the report is pre-2017-only (round 39) —
    mirrors the report-level no_valid_routes skip below: this data predates
    npmrds.s583_v982_NPMRDS_V6's 2017 start and is never coming back, so a
    report entirely inside that range would only ever produce a
    permanently-blank page regardless of template completeness."""
    return bool(route_comps) and all(
        route_comp_is_pre_2017(rc.get("settings") or {}) for rc in route_comps)


