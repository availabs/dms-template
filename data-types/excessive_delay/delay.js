/**
 * excessive_delay bucket math — pure functions, no I/O.
 *
 * Ported faithfully from the legacy avail-falcor route
 * (dama/routes/data_types/npmrds/excessivedelay.route.js). Two halves:
 *
 * 1. The delay-bucket formulas (threshold travel time, normalized AADT,
 *    distribution keys, total vs non_recurrent contribution). In production
 *    these run inside the ClickHouse monthly query (sql.js#monthDelayQuery);
 *    the JS versions here are the executable spec the SQL strings are pinned
 *    against, and the unit-test target for the math itself.
 *
 * 2. The transcom attribution (construction / accident / other from
 *    congestion_data->tmcDelayData blobs). This half runs IN the worker in
 *    production — it is the same JS the legacy route ran inline.
 */

// Legacy coercion, quirk included: Number(null) === 0, so null → 0 (not null).
function toNullableNumber(value) {
  const num = Number(value);
  return isNaN(num) ? null : num;
}

// 2-decimal rounding applied to every delay value before insert. Null-safe so
// a missing CH column can never leak NaN into a SQL literal.
function roundCents(value) {
  const num = toNullableNumber(value);
  return num == null ? null : Math.round(num * 100) / 100;
}

// NYSDOT general category → attribution bucket (the legacy SQL CASE, verbatim
// — case-sensitive, everything else unattributed).
function categorizeEvent(nysdotGeneralCategory) {
  switch (nysdotGeneralCategory) {
    case 'Construction': return 'construction';
    case 'Incident': return 'accident';
    case 'Other': return 'other';
    default: return null;
  }
}

const ATTRIBUTION_BUCKETS = ['construction', 'accident', 'other'];

// congestion_data->'tmcDelayData' arrives as an object from pg JSONB or a JSON
// string from text transports (sqlite harness). Either way → object or null.
function parseDelayData(delayData) {
  if (delayData == null) return null;
  if (typeof delayData === 'string') {
    try { return JSON.parse(delayData); } catch (e) { return null; }
  }
  return typeof delayData === 'object' ? delayData : null;
}

/**
 * One month of transcom congestion rows → per-TMC attribution sums.
 * rows: [{ event_category: 'construction'|'accident'|'other'|null, delay_data }]
 * (event_category is pre-mapped by sql.js#transcomDelayQuery's CASE; rows
 * coming from fixtures may also carry raw NYSDOT names — categorizeEvent is
 * applied as a fallback.)
 */
function aggregateTranscomDelays(rows, { year, month }) {
  const tmcMap = {};
  for (const { event_category, delay_data } of rows || []) {
    const category = ATTRIBUTION_BUCKETS.includes(event_category)
      ? event_category
      : categorizeEvent(event_category);
    if (!category) continue;
    const delayData = parseDelayData(delay_data);
    if (!delayData) continue;
    for (const tmc in delayData) {
      const delay = parseFloat(delayData[tmc]);
      if (isNaN(delay)) continue;
      if (!tmcMap[tmc]) tmcMap[tmc] = { year, month, construction: 0, accident: 0, other: 0 };
      tmcMap[tmc][category] += delay;
    }
  }
  return tmcMap;
}

// tmcMap → ordered tuples for the attribution UPDATE: [year, month, tmc, c, a, o].
function attributionRows(tmcMap) {
  return Object.entries(tmcMap).map(([tmc, data]) => [
    Number(data.year),
    Number(data.month),
    tmc,
    roundCents(data.construction),
    roundCents(data.accident),
    roundCents(data.other),
  ]);
}

// ── Bucket formulas (the executable spec of the CH SQL expressions) ─────────

// (miles / GREATEST(20, COALESCE(avg_speedlimit, 0) * 0.6)) * 3600 — seconds a
// vehicle "should" take at 60% of the posted limit, floored at 20mph.
function thresholdTravelTime({ miles, avgSpeedlimit }) {
  return (miles / Math.max(20, (avgSpeedlimit || 0) * 0.6)) * 3600;
}

// COALESCE(aadt, 0) / LEAST(COALESCE(faciltype, 2), 2) — directional AADT.
function normalizedAadt({ aadt, faciltype }) {
  return (aadt || 0) / Math.min(faciltype == null ? 2 : faciltype, 2);
}

// Which aadt_distributions row applies for this segment/day.
function distributionKey({ isWeekend, fSystem, congestionLevel, directionality }) {
  const roadClass = (fSystem == null ? 3 : fSystem) < 3 ? 'FREEWAY' : 'NONFREEWAY';
  if (isWeekend) return `WEEKEND_${roadClass}`;
  return `WEEKDAY_${congestionLevel || 'NO2LOW_CONGESTION'}_${directionality || 'EVEN_DIST'}_${roadClass}`;
}

/**
 * The core bucket math for one (tmc, epoch, day) observation:
 *   total         = GREATEST(0, tt - threshold_tt) / 3600 * aadt * dist
 *   non_recurrent = GREATEST(0, tt - GREATEST(threshold_tt, COALESCE(avg_tt, 0))) / 3600 * aadt * dist
 * total measures all excess over free-flow; non_recurrent only the excess over
 * the recurrent (weekday-average) baseline. Units: vehicle-hours of delay.
 */
function delayContribution({ travelTime, thresholdTT, avgTT, aadt, distribution }) {
  const total = Math.max(0, travelTime - thresholdTT) / 3600 * aadt * distribution;
  const nonRecurrent =
    Math.max(0, travelTime - Math.max(thresholdTT, avgTT || 0)) / 3600 * aadt * distribution;
  return { total, nonRecurrent };
}

// ── Row shaping ──────────────────────────────────────────────────────────────

// Legacy display label: `${roadname || ''} ${direction || ''} ${miles || ''}`
// (0/null miles → empty third segment, spaces preserved — pinned by tests).
function roadInformation({ roadname, direction, totalRoadMiles }) {
  const miles = toNullableNumber(totalRoadMiles);
  return `${roadname || ''} ${direction || ''} ${miles ? Math.round(miles * 100) / 100 : ''}`;
}

// One CH result row → the cleaned record insertRowsSQL consumes.
function normalizeDelayRow(row) {
  return {
    tmc: row.tmc,
    year: toNullableNumber(row.year),
    month: toNullableNumber(row.month),
    region_code: row.region_code || null,
    total: roundCents(row.total),
    f_system: toNullableNumber(row.f_system),
    non_recurrent: roundCents(row.non_recurrent),
    aadt: toNullableNumber(row.aadt),
    aadt_combi: toNullableNumber(row.aadt_combi),
    aadt_singl: toNullableNumber(row.aadt_singl),
    length: toNullableNumber(row.length),
    roadname: row.roadname || null,
    tmclinear: toNullableNumber(row.tmclinear),
    road_order: toNullableNumber(row.road_order),
    county_code: row.county_code || null,
    direction: row.direction || null,
    wkb_geometry: row.wkb_geometry == null
      ? null
      : (typeof row.wkb_geometry === 'string' ? row.wkb_geometry : JSON.stringify(row.wkb_geometry)),
    road_information: roadInformation({
      roadname: row.roadname,
      direction: row.direction,
      totalRoadMiles: row.total_road_miles,
    }),
  };
}

// ── Period expansion ─────────────────────────────────────────────────────────

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * { years: [2019, 2021], months?: [1..12] } → monthly periods with date
 * bounds. years is an arbitrary list on purpose: backfill runs must be able to
 * fill gaps (e.g. the known 2019-2020 hole) without recomputing everything.
 */
function expandPeriods({ years, months }) {
  if (!Array.isArray(years) || years.length === 0 || years.some((y) => !Number.isInteger(Number(y)))) {
    throw new Error('years must be a non-empty array of integers');
  }
  const monthList = (Array.isArray(months) && months.length > 0)
    ? months.map(Number)
    : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  if (monthList.some((m) => !Number.isInteger(m) || m < 1 || m > 12)) {
    throw new Error('months must be integers between 1 and 12');
  }
  const periods = [];
  for (const y of years.map(Number)) {
    for (const m of monthList) {
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      periods.push({
        year: y,
        month: m,
        startDate: `${y}-${pad2(m)}-01`,
        endDate: `${y}-${pad2(m)}-${pad2(lastDay)}`,
      });
    }
  }
  return periods;
}

/**
 * M3 (methodology v2): overlapping events each claim the full excess delay, so
 * per-TMC bucket sums can exceed the independently computed non_recurrent
 * total. Cap them: when construction+accident+other > non_recurrent for a
 * (tmc, month), scale all three proportionally so the sum equals it.
 * nonRecByTmc: { tmc -> non_recurrent veh-hrs }; missing/zero cap → buckets → 0.
 * Pure — returns a new map, input untouched.
 */
function capAttribution(tmcMap, nonRecByTmc) {
  const out = {};
  for (const [tmc, data] of Object.entries(tmcMap || {})) {
    const sum = (data.construction || 0) + (data.accident || 0) + (data.other || 0);
    const cap = Number(nonRecByTmc && nonRecByTmc[tmc]) || 0;
    const scale = sum > cap ? (sum > 0 ? cap / sum : 0) : 1;
    out[tmc] = {
      ...data,
      construction: (data.construction || 0) * scale,
      accident: (data.accident || 0) * scale,
      other: (data.other || 0) * scale,
    };
  }
  return out;
}

module.exports = {
  toNullableNumber,
  roundCents,
  categorizeEvent,
  parseDelayData,
  aggregateTranscomDelays,
  attributionRows,
  capAttribution,
  thresholdTravelTime,
  normalizedAadt,
  distributionKey,
  delayContribution,
  roadInformation,
  normalizeDelayRow,
  expandPeriods,
};
