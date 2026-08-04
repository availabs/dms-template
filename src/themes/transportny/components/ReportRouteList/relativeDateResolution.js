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

const RELATIVE_DATE_REGEX = /^(?<anchor>startDate|endDate)=>(?<span>day|week|month|year)(?<isof>of)?(?:(?<sign>[+-])(?<amount>\d+)\k<span>->(?<duration>\d+)\k<span>)?$/;

function parseDateOnly(dateStr) {
  const [y, m, d] = (dateStr || '').split('T')[0].split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatDateOnly(d) {
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
function resolveRelativeDateFormula(formula, baseStartDate, baseEndDate) {
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

function getTimeSuffix(dateStr) {
  return (dateStr || '').split('T')[1] || '';
}

// Resolves every formula-bearing route entry against its base (found by
// `derivedFromRoute` === some sibling's `route_comp_id`, in the SAME array)
// and returns a new array with fresh startDate/endDate — preserving each
// row's OWN time-of-day suffix (peak-window settings are independent
// per-comp data, untouched by this mechanism — see relativedates.utils.js's
// own setTimes=false default). Entries without a formula, or whose base
// can't be resolved, pass through unchanged; returns the SAME array
// reference when nothing changed (mirrors applyDerivedPageVariables'
// no-render-churn guarantee).
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
    const startTime = getTimeSuffix(route.startDate);
    const endTime = getTimeSuffix(route.endDate);
    const nextStart = startTime ? `${resolved.start}T${startTime}` : resolved.start;
    const nextEnd = endTime ? `${resolved.end}T${endTime}` : resolved.end;
    if (nextStart === route.startDate && nextEnd === route.endDate) return route;
    changed = true;
    return { ...route, startDate: nextStart, endDate: nextEnd };
  });
  return changed ? next : routes;
}
