// Mechanism B (`relativeDate`/`isRelativeDateBase`) live recompute — see
// dynamic-reports-and-route-tags.md item 3 and
// research/npmrds-reports/info-box-speed-and-relative-dates-scoping.md Part 2
// for the full investigation. A route/slot entry converted from an old
// template's relativeDate comp (convert_old_reports.py's resolve_relative_dates)
// carries `dateFormula` (the old tool's own formula string) + `derivedFromRoute`
// (the base route's `route_comp_id`) alongside a frozen literal startDate/endDate
// computed at conversion time. This resolves the formula LIVE against whichever
// route currently holds that route_comp_id in the same array — never persisted,
// same "recompute on every read, never persist a stale value" architecture as
// applyDerivedPageVariables (derived-page-variable.md) — so editing the base
// route's own date via RouteRow's normal date editor recomputes every derived
// row immediately, with no rebuild.
//
// Exact port of transportNY's reports/store/utils/relativedates.utils.js,
// verified against real corpus data (templates 278/279) before implementation —
// see convert_old_reports.py's Python port (resolve_relative_dates et al.) for
// the conversion-time half of this same spec.

// Exported for relativeDatePresets.js — the authoring-side preset/validation module needs the
// exact same grammar this resolver reads, not a hand-copied duplicate that could drift from it.
export const RELATIVE_DATE_REGEX = /^(?<anchor>startDate|endDate)=>(?<span>day|week|month|year)(?<isof>of)?(?:(?<sign>[+-])(?<amount>\d+)\k<span>->(?<duration>\d+)\k<span>)?$/;

// "Fixed calendar position within the anchor's year" — a second, independent formula shape (not an
// extension of RELATIVE_DATE_REGEX above) for things like "January" or "Winter": a literal
// month/day range that isn't an offset from the anchor's own current position, but tied to whatever
// CALENDAR YEAR the anchor falls in. Added 2026-08-10 to replace Monthly Congestion's 12
// individual-month rows / Seasonality's 5 seasonal-window rows, which were frozen static literals
// because the offset grammar above has no way to express "the Nth calendar month/season inside
// whatever year is current" — see dynamic-reports-and-route-tags.md item 3's "NEXT" follow-up for
// the full reasoning. `day2` may be a literal day-of-month or `L` for "last day of month2" (so a
// whole-month range stays correct across Feb 28/29 without the caller needing to know which).
export const CALENDAR_POSITION_REGEX = /^(?<anchor>startDate|endDate)=>calendar:(?<month1>\d{1,2})-(?<day1>\d{1,2})\.\.(?<month2>\d{1,2})-(?<day2>\d{1,2}|L)$/;

// Sentinel route_comp_id for the synthetic "Today (view time)" base a route can derive from
// instead of a real sibling route — see ReportRouteList.jsx's todayAnchorEntry(). Never a real
// persisted route; ReportRouteList.jsx injects one entry with this id into the array passed to
// resolveRouteDates() (below) and strips it back out afterward, so this module's own resolution
// logic needs zero awareness of the concept — a virtual base is indistinguishable from a real one
// once it's just an object with route_comp_id/startDate/endDate in the same array.
export const TODAY_ANCHOR_COMP_ID = '__TODAY__';

// NPMRDS's own ClickHouse speed table (npmrds.s583_v982_NPMRDS_V6) publishes on a lag — confirmed
// live 2026-08-10 (real wall-clock "today"): `SELECT max(date)` returned 2026-07-26, a hard cliff
// (full row counts up to that date, zero after), not a gradual falloff. A "Today (view time)"
// anchor using the LITERAL current date would silently query a date range with no data at all —
// found the hard way: an automated check that only counted rendered SVG paths (chart axis chrome)
// read as "has content" even though the underlying query returned zero rows. 21 days is a
// deliberately conservative buffer above the observed ~15-day gap (pipeline lag isn't perfectly
// constant day to day) — tune this single constant if the real lag measurably changes; there's
// nothing else to update. Only applies to the DEFAULT anchor (no viewer `?asOf=` override) — an
// explicit override is the viewer's own deliberate choice, same "a chosen historical
// date/route/measure combination might have a real data-coverage gap" territory already accepted
// elsewhere in this codebase, not something this constant should paper over.
export const NPMRDS_DATA_LAG_DAYS = 21;

// The default "Today (view time)" anchor date — real wall-clock today minus the publish-lag
// buffer above, formatted the same "YYYY-MM-DD" way every route's startDate/endDate already is.
export function defaultAnchorDate() {
  const d = new Date();
  d.setDate(d.getDate() - NPMRDS_DATA_LAG_DAYS);
  return formatDateOnly(d);
}

// A freshly-added route's default date range (2026-08-20, Ryan's call: "across the whole report
// we should require a date filter... when a user adds a route, use a default date range" —
// every route added without one today silently produces an UNBOUNDED (all-history) query on any
// Graph/Table/Map self-bound to it; see useReportRow.js's addRoutes, the one place this gets
// applied). "The most recent full month of data" — anchored off `defaultAnchorDate`'s own
// publish-lag-adjusted "today", not literal wall-clock today, for the exact reason that constant
// exists: NPMRDS's ClickHouse table has a hard ~15-21 day publish cliff, and a calendar month
// computed from literal "today" could easily be a month with zero real rows. Always steps back
// one full calendar month from the (lag-adjusted) anchor's own month — the anchor's own current
// month is never guaranteed complete (missing at least however many days remain in it), so the
// prior month is the latest one that's always safely whole.
export function defaultRouteDateRange() {
  const anchor = new Date();
  anchor.setDate(anchor.getDate() - NPMRDS_DATA_LAG_DAYS);
  const priorMonthStart = shiftSpans(startOfSpan(anchor, 'month'), 'month', -1);
  const priorMonthEnd = endOfSpan(priorMonthStart, 'month');
  return { startDate: formatDateOnly(priorMonthStart), endDate: formatDateOnly(priorMonthEnd) };
}

function parseDateOnly(dateStr) {
  const [y, m, d] = (dateStr || '').split('T')[0].split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

// Exported so ReportRouteList.jsx can format the real wall-clock date (or a picked ?asOf=
// override) into the same "YYYY-MM-DD" shape a route's startDate/endDate already use, for the
// synthetic Today anchor entry.
export function formatDateOnly(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfSpan(d, span) {
  const c = new Date(d);
  if (span === 'day') return c;
  if (span === 'week') { c.setDate(c.getDate() - c.getDay()); return c; } // Sunday-start
  if (span === 'month') { c.setDate(1); return c; }
  return new Date(c.getFullYear(), 0, 1); // year
}

function endOfSpan(d, span) {
  if (span === 'day') return new Date(d);
  if (span === 'week') { const s = startOfSpan(d, 'week'); s.setDate(s.getDate() + 6); return s; }
  if (span === 'month') return new Date(d.getFullYear(), d.getMonth() + 1, 0); // last day of month
  return new Date(d.getFullYear(), 11, 31); // year
}

// `d` must already be a start-of-`span` date (day-of-month is always valid —
// 1 for month/year spans, an exact Sunday for week) — mirrors moment's
// .add()/.subtract() called immediately after .startOf().
function shiftSpans(d, span, n) {
  if (span === 'day') { const c = new Date(d); c.setDate(c.getDate() + n); return c; }
  if (span === 'week') { const c = new Date(d); c.setDate(c.getDate() + n * 7); return c; }
  if (span === 'month') {
    const total = d.getFullYear() * 12 + d.getMonth() + n;
    return new Date(Math.floor(total / 12), ((total % 12) + 12) % 12, 1);
  }
  return new Date(d.getFullYear() + n, 0, 1); // year
}

// report-authoring-ux-overhaul.md Tier 6C (2026-08-20): Ryan's own flagged idea — when deriving a
// route's dates via "Same period, aligned" (the `snap`/`isof` formula shape above), default the
// Span picker (day/week/month/year) to whatever span the BASE route's own [startDate, endDate]
// actually spans, so re-picking the base route doesn't leave a stale span selected against it.
// Deliberately a SINGLE-anchor check (does `startOfSpan(start, span)` land exactly on `start`, AND
// does one whole `span` period from THAT SAME point land exactly on `end`) rather than the
// `isof` resolution branch's own two-anchor shape (which independently snaps `start`'s period and
// `end`'s period) — a two-anchor check would also call a Jan-1-to-Feb-28 base range an exact
// "month" match (re-resolving `startDate=>monthof` against it really would reproduce that exact
// range), which isn't what "the base is exactly one calendar month" means. Returns null when no
// span matches exactly (e.g. a 37-day range) — the caller leaves the span picker exactly as it was
// in that case, no closest-match guessing (Ryan's explicit call).
const SPAN_KEYS = ['day', 'week', 'month', 'year'];
export function inferExactSpan(startDate, endDate) {
    const start = parseDateOnly(startDate);
    const end = parseDateOnly(endDate);
    if (!start || !end) return null;
    return SPAN_KEYS.find((span) => {
        const spanStart = startOfSpan(start, span);
        return spanStart.getTime() === start.getTime() && endOfSpan(spanStart, span).getTime() === end.getTime();
    }) || null;
}

// Special form (`yearof`/`monthof`/`weekof`/`dayof`): start/end snap
// INDEPENDENTLY from the base's own startDate/endDate (moment's
// calculateTimespanOf — if the base's start/end fall in different
// weeks/months/years, the result spans start-of-startDate's-period to
// end-of-endDate's-period, not one single period).
//
// General form (e.g. `year-2year->1year`): the leading `startDate|endDate`
// token picks which of the base's own two fields is the anchor and hard-codes
// direction (startDate anchor -> subtract `amount`, endDate anchor -> add
// `amount` — the sign character in the string is cosmetic only, matching the
// real old-tool implementation). `duration` extends forward `duration` spans
// from the (already-offset) start, inclusive (minus 1 day).
// `month1-day1` may fall in the same year as `month2-day2` (a plain month, or a non-wrapping
// season like Spring) or the PRIOR year (a season like Winter that starts in December of "last
// year" and ends in March of "this year") — decided by comparing month numbers only, never by
// looking at the anchor's own day-of-month, matching every real case this grammar was built for
// (retrofit_today_anchor.py's old static Winter/Spring/Summer/Fall/month literals).
function resolveCalendarPositionFormula({ anchor, month1, day1, month2, day2 }, baseStartDate, baseEndDate) {
  const anchorDate = parseDateOnly(anchor === 'startDate' ? baseStartDate : baseEndDate);
  if (!anchorDate) return null;
  const year = anchorDate.getFullYear();
  const m1 = Number(month1);
  const m2 = Number(month2);
  const end = day2 === 'L' ? new Date(year, m2, 0) : new Date(year, m2 - 1, Number(day2));
  const start = new Date(m1 <= m2 ? year : year - 1, m1 - 1, Number(day1));
  return { start: formatDateOnly(start), end: formatDateOnly(end) };
}

// Exported so the authoring UI can preview a candidate formula's resolved range against the
// picked base's live dates, before the author saves anything.
export function resolveRelativeDateFormula(formula, baseStartDate, baseEndDate) {
  const cal = CALENDAR_POSITION_REGEX.exec(formula || '');
  if (cal) return resolveCalendarPositionFormula(cal.groups, baseStartDate, baseEndDate);
  const m = RELATIVE_DATE_REGEX.exec(formula || '');
  if (!m) return null;
  const { anchor, span, isof, amount, duration } = m.groups;
  const baseStart = parseDateOnly(baseStartDate);
  const baseEnd = parseDateOnly(baseEndDate);
  if (isof) {
    if (!baseStart || !baseEnd) return null;
    return { start: formatDateOnly(startOfSpan(baseStart, span)), end: formatDateOnly(endOfSpan(baseEnd, span)) };
  }
  const anchorDate = anchor === 'startDate' ? baseStart : baseEnd;
  if (!anchorDate) return null;
  const amt = Number(amount);
  const dur = Number(duration);
  const start = shiftSpans(startOfSpan(anchorDate, span), span, anchor === 'startDate' ? -amt : amt);
  const end = shiftSpans(start, span, dur);
  end.setDate(end.getDate() - 1);
  return { start: formatDateOnly(start), end: formatDateOnly(end) };
}

// A route named "Current Year"/"1 Year Ago"/"Trailing 3 Years" is only meaningful during
// authoring — once `resolveRouteDates` has resolved its formula against a real (possibly
// viewer-`?asOf=`-picked) anchor date, the actual calendar year(s) it landed on is strictly more
// informative for a chart legend than the relative phrase, and report-spec.md's "route names are
// the only series discriminator" means that legend has nowhere else to get it from. Only fires
// for a `year`-span formula (`yearof` or `year±Nyear->Myear`) — day/week/month/calendar-span
// derived routes ("Yesterday", "This Month", "Winter (Avg Day)") already carry a literal,
// non-relative name and are left alone. A trailing non-relative annotation on the authored name
// (bi_directional's "(NB)"/"(SB)") is preserved by reattaching it after the computed label, since
// nothing about the year-ness of a formula says anything about a direction suffix.
export function yearRangeForDateFormula(dateFormula, startDate, endDate) {
  const m = RELATIVE_DATE_REGEX.exec(dateFormula || '');
  if (!m || m.groups.span !== 'year') return null;
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  if (!start || !end) return null;
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  return startYear === endYear ? String(startYear) : `${startYear}–${endYear}`;
}

// Convenience over `yearRangeForDateFormula` for the common call site (a resolved route object) —
// falls back to the route's own authored `name` when the formula isn't year-span, or has none.
export function resolvedRouteLabel(route) {
  const yearRange = route?.dateFormula ? yearRangeForDateFormula(route.dateFormula, route.startDate, route.endDate) : null;
  if (!yearRange) return route?.name;
  const suffix = /(\s*\([^)]*\))\s*$/.exec(route.name || '');
  return suffix ? `${yearRange}${suffix[1]}` : yearRange;
}

// Resolves every formula-bearing route entry against its base (found by
// `derivedFromRoute` === some sibling's `route_comp_id`, in the SAME array)
// and returns a new array with fresh startDate/endDate. Entries without a
// formula, or whose base can't be resolved, pass through unchanged; returns
// the SAME array reference when nothing changed (mirrors
// applyDerivedPageVariables' no-render-churn guarantee).
//
// Design push #2 (2026-08-06): used to also preserve each row's own time-of-day
// suffix on the resolved date (peak-window settings were independent per-comp
// data) — dropped along with the rest of a route's time-of-day fields, which
// moved to the graph (see useGraphPublish.js). A route's startDate/endDate are
// plain "YYYY-MM-DD" now, no `T`-suffix to preserve.
export function resolveRouteDates(routes) {
  if (!routes?.length) return routes;
  const byCompId = new Map(routes.map((r) => [r.route_comp_id, r]));
  let changed = false;
  const next = routes.map((route) => {
    if (!route?.dateFormula || !route?.derivedFromRoute) return route;
    const base = byCompId.get(route.derivedFromRoute);
    // Single-hop only (mirrors applyDerivedPageVariables' own cycle guard) — a
    // base is never itself derived by construction (conversion-time gap-logs
    // any group with zero/multiple isRelativeDateBase comps instead of
    // resolving), but this keeps a malformed/hand-edited row from resolving
    // against a moving target.
    if (!base?.startDate || !base?.endDate || base.dateFormula) return route;
    const resolved = resolveRelativeDateFormula(route.dateFormula, base.startDate, base.endDate);
    if (!resolved) return route;
    if (resolved.start === route.startDate && resolved.end === route.endDate) return route;
    changed = true;
    return { ...route, startDate: resolved.start, endDate: resolved.end };
  });
  return changed ? next : routes;
}
