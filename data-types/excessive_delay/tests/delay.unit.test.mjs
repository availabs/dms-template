/**
 * Unit tests for the excessive_delay bucket math (delay.js).
 *
 * This is the highest-value test target in the plugin: these pure functions
 * back the /congestion dashboard. The recurrent-baseline vs non_recurrent
 * formulas mirror the ClickHouse SQL (pinned separately in sql.unit.test.mjs);
 * the transcom attribution (construction/accident/other) runs IN these
 * functions in production.
 *
 * All fixtures are hand-computed. No DB, no ClickHouse.
 */
import { describe, it, expect } from 'vitest';
import {
  toNullableNumber,
  roundCents,
  categorizeEvent,
  aggregateTranscomDelays,
  attributionRows,
  thresholdTravelTime,
  normalizedAadt,
  distributionKey,
  delayContribution,
  roadInformation,
  normalizeDelayRow,
  expandPeriods,
} from '../delay.js';

describe('toNullableNumber (legacy-faithful coercion)', () => {
  it('parses numeric strings', () => {
    expect(toNullableNumber('12.5')).toBe(12.5);
    expect(toNullableNumber(7)).toBe(7);
  });
  it('returns null for non-numeric values', () => {
    expect(toNullableNumber('abc')).toBe(null);
    expect(toNullableNumber(undefined)).toBe(null);
    expect(toNullableNumber({})).toBe(null);
  });
  it('keeps the legacy quirk: null coerces to 0 (Number(null) === 0)', () => {
    expect(toNullableNumber(null)).toBe(0);
  });
});

describe('roundCents (2-decimal rounding used on every delay value)', () => {
  it('rounds to cents', () => {
    expect(roundCents(1.234)).toBe(1.23);
    expect(roundCents(1.235)).toBe(1.24);
    expect(roundCents('2.005')).toBe(2.01);
  });
  it('is null-safe (no NaN leaks into SQL)', () => {
    expect(roundCents(undefined)).toBe(null);
    expect(roundCents('not-a-number')).toBe(null);
  });
});

describe('categorizeEvent (NYSDOT general category → delay bucket)', () => {
  it('maps the three attributed categories', () => {
    expect(categorizeEvent('Construction')).toBe('construction');
    expect(categorizeEvent('Incident')).toBe('accident');
    expect(categorizeEvent('Other')).toBe('other');
  });
  it('returns null for anything else', () => {
    expect(categorizeEvent('Weather')).toBe(null);
    expect(categorizeEvent('construction')).toBe(null); // case-sensitive, as in the legacy SQL CASE
    expect(categorizeEvent(undefined)).toBe(null);
  });
});

describe('aggregateTranscomDelays (congestion_data → per-TMC bucket sums)', () => {
  const year = 2023, month = 5;
  it('sums tmcDelayData blobs per TMC per category', () => {
    const rows = [
      { event_category: 'construction', delay_data: { '120+1001': '10.5', '120+1002': '2' } },
      { event_category: 'construction', delay_data: { '120+1001': 4.5 } },
      { event_category: 'accident', delay_data: { '120+1001': '1.25' } },
      { event_category: 'other', delay_data: { '120+1002': '3' } },
    ];
    const map = aggregateTranscomDelays(rows, { year, month });
    expect(map['120+1001']).toEqual({ year, month, construction: 15, accident: 1.25, other: 0 });
    expect(map['120+1002']).toEqual({ year, month, construction: 2, accident: 0, other: 3 });
  });
  it('parses JSON-string delay_data blobs (sqlite/text transport)', () => {
    const rows = [{ event_category: 'other', delay_data: '{"120+1003": "7.5"}' }];
    const map = aggregateTranscomDelays(rows, { year, month });
    expect(map['120+1003'].other).toBe(7.5);
  });
  it('skips NaN delays, null blobs, and unattributed categories', () => {
    const rows = [
      { event_category: 'construction', delay_data: { '120+1001': 'garbage', '120+1002': '1' } },
      { event_category: 'construction', delay_data: null },
      { event_category: null, delay_data: { '120+1009': '99' } },
      { event_category: 'weather', delay_data: { '120+1009': '99' } },
    ];
    const map = aggregateTranscomDelays(rows, { year, month });
    expect(map['120+1001']).toBeUndefined();
    expect(map['120+1002'].construction).toBe(1);
    expect(map['120+1009']).toBeUndefined();
  });
});

describe('attributionRows (tmcMap → ordered insert tuples, rounded)', () => {
  it('emits [year, month, tmc, construction, accident, other] with cent rounding', () => {
    const rows = attributionRows({
      '120+1001': { year: 2023, month: 5, construction: 15.005, accident: 1.254, other: 0 },
    });
    expect(rows).toEqual([[2023, 5, '120+1001', 15.01, 1.25, 0]]);
  });
  it('returns [] for an empty map', () => {
    expect(attributionRows({})).toEqual([]);
  });
});

describe('thresholdTravelTime (recurrent-delay threshold, seconds)', () => {
  // (miles / GREATEST(20, COALESCE(avg_speedlimit, 0) * 0.6)) * 3600
  it('uses 60% of the speed limit when that beats the 20mph floor', () => {
    expect(thresholdTravelTime({ miles: 1, avgSpeedlimit: 60 })).toBeCloseTo(100, 10); // 1/36*3600
  });
  it('floors the divisor speed at 20mph', () => {
    expect(thresholdTravelTime({ miles: 1, avgSpeedlimit: 30 })).toBeCloseTo(180, 10); // 0.6*30=18 < 20
    expect(thresholdTravelTime({ miles: 1, avgSpeedlimit: null })).toBeCloseTo(180, 10);
  });
});

describe('normalizedAadt (directional AADT normalization)', () => {
  // COALESCE(aadt, 0) / LEAST(COALESCE(faciltype, 2), 2)
  it('divides by faciltype capped at 2', () => {
    expect(normalizedAadt({ aadt: 1000, faciltype: 1 })).toBe(1000);
    expect(normalizedAadt({ aadt: 1000, faciltype: 2 })).toBe(500);
    expect(normalizedAadt({ aadt: 1000, faciltype: 6 })).toBe(500);
  });
  it('defaults: null faciltype → 2, null aadt → 0', () => {
    expect(normalizedAadt({ aadt: 1000, faciltype: null })).toBe(500);
    expect(normalizedAadt({ aadt: null, faciltype: 1 })).toBe(0);
  });
});

describe('distributionKey (which aadt_distributions row applies)', () => {
  it('weekend keys split only on freeway/nonfreeway', () => {
    expect(distributionKey({ isWeekend: true, fSystem: 1 })).toBe('WEEKEND_FREEWAY');
    expect(distributionKey({ isWeekend: true, fSystem: 3 })).toBe('WEEKEND_NONFREEWAY');
    expect(distributionKey({ isWeekend: true, fSystem: null })).toBe('WEEKEND_NONFREEWAY'); // COALESCE(f_system,3)
  });
  it('weekday keys carry congestion level and directionality with legacy defaults', () => {
    expect(distributionKey({ isWeekend: false, fSystem: 2 }))
      .toBe('WEEKDAY_NO2LOW_CONGESTION_EVEN_DIST_FREEWAY');
    expect(distributionKey({
      isWeekend: false, fSystem: 4, congestionLevel: 'HIGH_CONGESTION', directionality: 'AM_PEAK',
    })).toBe('WEEKDAY_HIGH_CONGESTION_AM_PEAK_NONFREEWAY');
  });
});

describe('delayContribution (the core bucket math: total vs non_recurrent)', () => {
  // total        = GREATEST(0, tt - threshold_tt) / 3600 * aadt * dist
  // non_recurrent = GREATEST(0, tt - GREATEST(threshold_tt, COALESCE(avg_tt, 0))) / 3600 * aadt * dist
  it('total measures excess over the free-flow threshold; non_recurrent over the recurrent baseline', () => {
    const r = delayContribution({ travelTime: 200, thresholdTT: 100, avgTT: 150, aadt: 1000, distribution: 0.05 });
    expect(r.total).toBeCloseTo((200 - 100) / 3600 * 1000 * 0.05, 10);
    expect(r.nonRecurrent).toBeCloseTo((200 - 150) / 3600 * 1000 * 0.05, 10);
  });
  it('clamps both buckets at zero when traffic flows freely', () => {
    const r = delayContribution({ travelTime: 90, thresholdTT: 100, avgTT: 150, aadt: 1000, distribution: 0.05 });
    expect(r.total).toBe(0);
    expect(r.nonRecurrent).toBe(0);
  });
  it('with no recurrent baseline (avg_tt null → 0) non_recurrent equals total', () => {
    const r = delayContribution({ travelTime: 200, thresholdTT: 100, avgTT: null, aadt: 1000, distribution: 0.05 });
    expect(r.nonRecurrent).toBeCloseTo(r.total, 10);
  });
  it('a congested-on-average segment (avg_tt above tt) contributes total but zero non_recurrent', () => {
    const r = delayContribution({ travelTime: 200, thresholdTT: 100, avgTT: 300, aadt: 1000, distribution: 0.05 });
    expect(r.total).toBeGreaterThan(0);
    expect(r.nonRecurrent).toBe(0);
  });
});

describe('roadInformation (display label)', () => {
  it('joins roadname, direction, rounded total road miles', () => {
    expect(roadInformation({ roadname: 'I-90', direction: 'EASTBOUND', totalRoadMiles: 12.345 }))
      .toBe('I-90 EASTBOUND 12.35');
  });
  it('keeps the legacy blank-segment behavior', () => {
    expect(roadInformation({ roadname: null, direction: null, totalRoadMiles: null })).toBe('  ');
    expect(roadInformation({ roadname: 'I-90', direction: 'E', totalRoadMiles: 0 })).toBe('I-90 E ');
  });
});

describe('normalizeDelayRow (CH result row → insert record)', () => {
  const chRow = {
    tmc: '120+1001', year: '2023', month: '5',
    total: 12.3456, non_recurrent: 4.5678,
    region_code: '1', f_system: '1',
    aadt: '1000', aadt_combi: '50', aadt_singl: '30',
    length: '0.5', roadname: 'I-90', tmclinear: '11', road_order: '2',
    county_code: '36001', direction: 'EASTBOUND',
    wkb_geometry: { type: 'MultiLineString', coordinates: [[[0, 0], [1, 1]]] },
    total_road_miles: '10.123',
  };
  it('rounds the delay buckets and coerces numerics', () => {
    const r = normalizeDelayRow(chRow);
    expect(r.total).toBe(12.35);
    expect(r.non_recurrent).toBe(4.57);
    expect(r.year).toBe(2023);
    expect(r.month).toBe(5);
    expect(r.aadt).toBe(1000);
    expect(r.f_system).toBe(1);
  });
  it('stringifies object geometries and passes string geometries through', () => {
    expect(normalizeDelayRow(chRow).wkb_geometry).toBe(JSON.stringify(chRow.wkb_geometry));
    expect(normalizeDelayRow({ ...chRow, wkb_geometry: '{"type":"MultiLineString"}' }).wkb_geometry)
      .toBe('{"type":"MultiLineString"}');
  });
  it('builds road_information from roadname/direction/total_road_miles', () => {
    expect(normalizeDelayRow(chRow).road_information).toBe('I-90 EASTBOUND 10.12');
  });
});

describe('expandPeriods (arbitrary years[] — backfill must be able to fill gaps)', () => {
  it('expands non-contiguous years (the 2019-2020 gap case) to monthly periods', () => {
    const periods = expandPeriods({ years: [2019, 2021] });
    expect(periods.length).toBe(24);
    expect(periods[0]).toEqual({ year: 2019, month: 1, startDate: '2019-01-01', endDate: '2019-01-31' });
    expect(periods[12].year).toBe(2021);
  });
  it('honors a months subset', () => {
    const periods = expandPeriods({ years: [2024], months: [2, 3] });
    expect(periods).toEqual([
      { year: 2024, month: 2, startDate: '2024-02-01', endDate: '2024-02-29' }, // leap year
      { year: 2024, month: 3, startDate: '2024-03-01', endDate: '2024-03-31' },
    ]);
  });
  it('rejects empty/invalid years', () => {
    expect(() => expandPeriods({ years: [] })).toThrow(/years/i);
    expect(() => expandPeriods({ years: ['soon'] })).toThrow(/years/i);
  });
});

// ── M3 (methodology v2): cap attribution at non_recurrent per (tmc, month) ──
import { capAttribution } from '../delay.js';

describe('capAttribution (M3 — overlapping events may not exceed non_recurrent)', () => {
  const tmcMap = {
    '120+1001': { year: 2026, month: 4, construction: 60, accident: 30, other: 10 }, // sum 100
    '120+1002': { year: 2026, month: 4, construction: 5, accident: 0, other: 0 },    // sum 5
    '120+1003': { year: 2026, month: 4, construction: 8, accident: 2, other: 0 },    // sum 10, no nonrec entry
  };
  it('scales buckets proportionally when their sum exceeds non_recurrent', () => {
    const capped = capAttribution(tmcMap, { '120+1001': 50, '120+1002': 100, '120+1003': 0 });
    expect(capped['120+1001'].construction).toBeCloseTo(30, 6); // 60 × 50/100
    expect(capped['120+1001'].accident).toBeCloseTo(15, 6);
    expect(capped['120+1001'].other).toBeCloseTo(5, 6);
  });
  it('leaves buckets unchanged when under the cap', () => {
    const capped = capAttribution(tmcMap, { '120+1001': 50, '120+1002': 100, '120+1003': 0 });
    expect(capped['120+1002'].construction).toBe(5);
  });
  it('zero non_recurrent (or missing tmc in the map) → buckets collapse to 0', () => {
    const capped = capAttribution(tmcMap, { '120+1001': 50, '120+1002': 100 });
    expect(capped['120+1003'].construction).toBe(0);
    expect(capped['120+1003'].accident).toBe(0);
  });
  it('does not mutate the input map', () => {
    capAttribution(tmcMap, { '120+1001': 50 });
    expect(tmcMap['120+1001'].construction).toBe(60);
  });
});
