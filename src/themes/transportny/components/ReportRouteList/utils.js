// Both the already-added route rows (RouteRow) and the inline catalog search
// results (AddRouteSearch) need to read a route/catalog-entry's TMC list —
// `tmc_array` arrives as a JSON string from most sources but can already be a
// real array depending on the query path it came through.
export function parseTmcArray(tmcArray) {
  if (!tmcArray) return [];
  if (Array.isArray(tmcArray)) return tmcArray;
  try {
    return JSON.parse(tmcArray);
  } catch (e) {
    console.error('Failed to parse tmc_array', e);
    return [];
  }
}

// Helper function to handle YYYY-MM-DD or YYYY-MM-DDTHH:mm strings safely
export function parseYMD(dateStr) {
  if (dateStr.includes('T')) {
    return new Date(dateStr);
  }
  const [year, month, day] = dateStr.split('-');
  // Month is 0-indexed in JS Dates (0 = January)
  return new Date(year, month - 1, day);
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// Generates an array of 'YYYY-MM-DD' dates. `weekdays` is an optional per-route
// mask ({monday: true, ..., sunday: false}) — only an explicit `false` excludes a
// day, so routes without the field keep every day (the shape converted old
// reports carry; see scripts/npmrds-reports/convert_old_reports.py). Extracted
// from useGraphPublish.js's transformReportRoutes (the actual query-building
// path) so the route rail's "N of M days" preview enumerates identically to what
// the engine really queries — a duplicated day-loop that drifted from this one
// would silently lie about the count.
export function generateDateRange(startStr, endStr, weekdays) {
  const startDate = parseYMD(startStr);
  const endDate = parseYMD(endStr);
  const dates = [];

  // Loop day-by-day from start to end
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    if (weekdays && weekdays[DAY_NAMES[d.getDay()]] === false) continue;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
  }
  return dates;
}

export function timeToEpoch(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 12 + Math.floor(minutes / 5);
}

export function generateEpochRange(startStr, endStr) {
  const startTime = startStr.includes('T') ? startStr.split('T')[1] : startStr;
  const endTime = endStr.includes('T') ? endStr.split('T')[1] : endStr;

  const startEpoch = timeToEpoch(startTime);
  const endEpoch = timeToEpoch(endTime);

  const epochs = [];
  for (let e = startEpoch; e <= endEpoch; e++) {
    epochs.push(e);
  }
  return epochs;
}

export const getDateValue = (val) => (val || '').split('T')[0];

// Plain string slicing rather than `new Date(...)` — these are naive "YYYY-MM-DD"
// values with no timezone, and a Date object would silently shift them a day near
// midnight in whatever TZ the browser runs in.
export const formatDateShort = (val) => {
  const d = getDateValue(val);
  const [y, m, day] = d.split('-');
  return (y && m && day) ? `${Number(m)}/${Number(day)}/${y}` : (d || null);
};

// Same day-key ordering/semantics as useGraphPublish.js's DAY_NAMES: only an
// explicit `false` excludes a day, an absent key means included.
export const DOW_DEFS = [
  { key: 'sunday', label: 'Su' },
  { key: 'monday', label: 'Mo' },
  { key: 'tuesday', label: 'Tu' },
  { key: 'wednesday', label: 'We' },
  { key: 'thursday', label: 'Th' },
  { key: 'friday', label: 'Fr' },
  { key: 'saturday', label: 'Sa' },
];
export const WEEKDAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
export const WEEKEND_KEYS = ['sunday', 'saturday'];
export const isDayOn = (weekdays, key) => weekdays?.[key] !== false;

// Renders as null (no summary line) when the mask has no exclusions, so an
// unrestricted route's date range block looks exactly as it did before this
// control existed. Shared between RouteRow (per-row summary) and ReportRouteList
// (the copy/paste clipboard strip's preview line).
export function summarizeWeekdays(weekdays) {
  const offLabels = DOW_DEFS.filter(({ key }) => weekdays?.[key] === false).map((d) => d.label);
  if (offLabels.length === 0) return null;
  const onKeys = DOW_DEFS.filter(({ key }) => isDayOn(weekdays, key)).map((d) => d.key);
  if (onKeys.length === WEEKDAY_KEYS.length && WEEKDAY_KEYS.every((k) => onKeys.includes(k))) return 'Weekdays only';
  if (onKeys.length === WEEKEND_KEYS.length && WEEKEND_KEYS.every((k) => onKeys.includes(k))) return 'Weekends only';
  return `Excludes ${offLabels.join(', ')}`;
}
