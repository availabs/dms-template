/**
 * Unit tests for M5 — the CLEAR crash typing and the crash ∩ work-zone join
 * as lib/crashes.js defines them.
 *
 * The decisions pinned here: the only work-zone attribution CLEAR carries is
 * the traffic-control field (three work-area codes) and the flagger code is
 * kept beside it; KABCO comes from MaxInjurySeverity with property damage
 * resolved to O; unknown counts are null, never zero; midnight is flagged as
 * an uncertain time; CLEAR's functional-class codes are mapped, not read;
 * the match SQL probes the crash index from the zone geometry and bounds by
 * the zone's own span; and the rate is only ever computed over zones whose
 * exposure is complete.
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CRASH_BUFFER_M, WZ_TRAFFIC_CONTROL, FLAGGER_TRAFFIC_CONTROL, CLEAR_FUNCTIONAL_CLASS,
  parseCrashTime, isoDate, kabco, severityClass, workZoneCode, shapeCrashRow, ratePer100mVmt,
  crashMatchSQL, rollupM5, rollupM5ByTier,
} from '../lib/crashes.js';

// Two real CY2024 rows from the extract (all 48 columns), one work-zone coded.
const NASSAU = {
  OBJECTID: '1', CaseNumber: '40185959', MaxInjurySeverity: 'C - POSSIBLE INJURY', CrashSeverity: 'INJURY',
  RoadwayAccessControlCde: '888', CaseYear: '2024', CollisionType: 'REAR END', CrashDate: '2024-01-02T00:00:00',
  CrashTimeFormatted: '10:06 AM', CrashType: 'COLLISION WITH MOTOR VEHICLE', LightCondition: 'DAYLIGHT',
  RoadwayCharacteristic: 'STRAIGHT AND LEVEL', RoadSurfaceCondition: 'DRY', TrafficControl: 'HIGHWAY WORK AREA',
  TrafficWay: 'NOT ENTERED', WeatherCondition: 'CLEAR', CommercialVehicleCrashInd: '0', DMVInsertDate: '2024-03-12T19:00:51',
  NumberOfFatalities: '0', NumberOfInjuries: '1', NumberOfOtherInjuries: '0', NumberOfSeriousInjuries: '0', NumberOfVehicles: '2',
  PoliceDept: '', NonReportable: '0', ReportingAgency: 'NASSAU CO PD', NonPublicWayCode: '0',
  UTMEasting: '609000.1', UTMNorthing: '4504000.2', IntersectionIndicator: '0', ClosestCrossStreet: 'SOUTHERN STATE PARKWAY',
  CountyName: 'Nassau', DirectionFromIntersection: '3', DistanceFromIntersection: '0.0', MasterIntersectionId: '',
  CityTownName: 'Hempstead', OnStreet: 'SERVICE ROAD', ReferenceMarker: '908M03011011', ACCESS_CONTROL: '', DIVIDED: '',
  FUNCTIONAL_CLASS: '', MAINT_JURISDICTION_TYPE_ID: '', OWNING_JURISDICTION_TYPE_ID: '', NAME: '', POSTED_SPEED: '',
  ApparentFactors: 'V1:(FOLLOWING TOO CLOSELY,NOT ENTERED) / V2:(NOT ENTERED,NOT ENTERED)', lon: '-73.707477', lat: '40.683253',
};
const QUEENS = {
  ...NASSAU, CaseNumber: '40141815', MaxInjurySeverity: 'K - FATAL', CrashSeverity: 'FATAL', CrashDate: '2024-01-01T00:00:00',
  CrashTimeFormatted: '5:52 AM', TrafficControl: 'NONE', NumberOfFatalities: '5', NumberOfInjuries: '1',
  OnStreet: 'CROSS ISLAND PARKWAY', ClosestCrossStreet: 'INTERSTATE 678', ReferenceMarker: '907AX5M21188',
  FUNCTIONAL_CLASS: '7', ACCESS_CONTROL: '88', POSTED_SPEED: '50', CountyName: 'Queens', lon: '-73.819287', lat: '40.789253',
};

describe('parseCrashTime', () => {
  it('reads h:mm AM/PM onto the five-minute grid', () => {
    expect(parseCrashTime('6:49 AM')).toEqual({ minutes: 409, epoch: 81, hour: 6, time_known: true, time_uncertain: false });
    expect(parseCrashTime('12:30 PM')).toEqual({ minutes: 750, epoch: 150, hour: 12, time_known: true, time_uncertain: false });
    expect(parseCrashTime('11:59 PM').epoch).toBe(287);
  });
  it('flags midnight as an uncertain time but keeps it at epoch 0', () => {
    const t = parseCrashTime('12:00 AM');
    expect(t.epoch).toBe(0); expect(t.time_known).toBe(true); expect(t.time_uncertain).toBe(true);
    expect(parseCrashTime('12:05 AM').time_uncertain).toBe(false);
  });
  it('is null, never zero, on anything unparseable', () => {
    for (const bad of ['', null, undefined, '25:00 AM', '7 PM', '13:05']) {
      const t = parseCrashTime(bad);
      expect(t.epoch).toBeNull(); expect(t.minutes).toBeNull(); expect(t.time_known).toBe(false);
    }
  });
  it('isoDate takes the date off the ISO timestamp', () => {
    expect(isoDate('2024-01-02T00:00:00')).toBe('2024-01-02');
    expect(isoDate('')).toBeNull();
  });
});

describe('severity', () => {
  it('KABCO from MaxInjurySeverity, O for property damage', () => {
    expect(kabco('K - FATAL', 'FATAL')).toBe('K');
    expect(kabco('A - SERIOUS INJURY', 'INJURY')).toBe('A');
    expect(kabco('B - INJURY', 'INJURY')).toBe('B');
    expect(kabco('C - POSSIBLE INJURY', 'INJURY')).toBe('C');
    expect(kabco('', 'PROPERTY DAMAGE')).toBe('O');
    expect(kabco('U - UNKNOWN', 'INJURY')).toBe('U');
    expect(kabco('', 'FATAL')).toBe('K');
    expect(kabco('', 'INJURY')).toBe('U');
    expect(kabco('', '')).toBeNull();
  });
  it('severity class from CrashSeverity', () => {
    expect(severityClass('FATAL')).toBe('fatal');
    expect(severityClass('INJURY')).toBe('injury');
    expect(severityClass('PROPERTY DAMAGE AND INJURY')).toBe('injury');
    expect(severityClass('PROPERTY DAMAGE')).toBe('pdo');
    expect(severityClass('NOT ENTERED')).toBe('unknown');
    expect(severityClass('')).toBe('unknown');
  });
});

describe('the work-zone attribution CLEAR carries', () => {
  it('is the three MV-104A work-area traffic-control codes, case-insensitive', () => {
    expect(Object.keys(WZ_TRAFFIC_CONTROL)).toEqual(['HIGHWAY WORK AREA', 'MAINTENANCE WORK AREA', 'UTILITY WORK AREA']);
    expect(workZoneCode('HIGHWAY WORK AREA')).toBe('highway');
    expect(workZoneCode('Maintenance Work Area')).toBe('maintenance');
    expect(workZoneCode('utility work area')).toBe('utility');
  });
  it('is not the flagger code, which is kept separately', () => {
    expect(workZoneCode(FLAGGER_TRAFFIC_CONTROL)).toBeNull();
    expect(shapeCrashRow({ ...NASSAU, TrafficControl: 'OFFICER/FLAGMAN/GUARD' })).toMatchObject({ wz_coded: false, wz_code: null, flagger_coded: true });
  });
  it('is not anything in the contributing factors', () => {
    // The factor vocabulary (61 values) has no work-zone entry; the shaper
    // must not invent one from the text.
    const r = shapeCrashRow({ ...QUEENS, ApparentFactors: 'V1:(OBSTRUCTION/DEBRIS,NOT ENTERED)' });
    expect(r.wz_coded).toBe(false);
    expect(r.apparent_factors).toContain('OBSTRUCTION/DEBRIS');
  });
});

describe('shapeCrashRow', () => {
  const n = shapeCrashRow(NASSAU); const q = shapeCrashRow(QUEENS);

  it('keys on the case number and dates the crash', () => {
    expect(n.crash_id).toBe('40185959'); expect(n.crash_date).toBe('2024-01-02'); expect(n.case_year).toBe(2024);
    expect(n.crash_ts).toBe('2024-01-02 10:06:00'); expect(n.epoch).toBe(121); expect(n.hour).toBe(10);
  });
  it('carries the work-zone code and KABCO', () => {
    expect(n).toMatchObject({ wz_coded: true, wz_code: 'highway', flagger_coded: false, severity_class: 'injury', severity_kabco: 'C' });
    expect(q).toMatchObject({ wz_coded: false, wz_code: null, severity_class: 'fatal', severity_kabco: 'K', n_fatalities: 5 });
  });
  it('leaves unknown counts and attributes NULL, never 0', () => {
    expect(n.posted_speed).toBeNull(); expect(n.functional_class_clear).toBeNull(); expect(n.functional_class_fhwa).toBeNull();
    expect(n.fc_interstate).toBeNull(); expect(n.access_control).toBeNull(); expect(n.police_dept).toBeNull();
    expect(n.master_intersection_id).toBeNull();
  });
  it("maps CLEAR's own functional-class code to the FHWA class", () => {
    // CLEAR code 7 is Urban Interstate — read raw it would look like a rural collector.
    expect(q.functional_class_clear).toBe(7); expect(q.functional_class_fhwa).toBe(11);
    expect(q.functional_class_desc).toBe('Urban Principal Arterial Interstate');
    expect(q.fc_interstate).toBe(true); expect(q.fc_urban).toBe(true);
    expect(CLEAR_FUNCTIONAL_CLASS[10].fhwa).toBe(16); expect(CLEAR_FUNCTIONAL_CLASS[1].interstate).toBe(true);
    expect(shapeCrashRow({ ...QUEENS, FUNCTIONAL_CLASS: '999' })).toMatchObject({ functional_class_clear: 999, functional_class_fhwa: null, functional_class_desc: 'Unknown' });
  });
  it('keeps the point and both coordinate systems', () => {
    expect(n.lon).toBeCloseTo(-73.707477, 6); expect(n.lat).toBeCloseTo(40.683253, 6); expect(n.has_point).toBe(true);
    expect(n.utm_easting).toBeCloseTo(609000.1, 1);
    expect(shapeCrashRow({ ...NASSAU, lon: '', lat: '' }).has_point).toBe(false);
  });
  it('reads the boolean indicators and the DMV clock', () => {
    expect(n.commercial_vehicle).toBe(false); expect(n.non_reportable).toBe(false); expect(n.intersection_ind).toBe(false);
    expect(n.dmv_insert_date).toBe('2024-03-12');
    expect(shapeCrashRow({ ...NASSAU, CommercialVehicleCrashInd: '' }).commercial_vehicle).toBeNull();
  });
});

describe('ratePer100mVmt', () => {
  it('is crashes per 100 million vehicle-miles', () => {
    expect(ratePer100mVmt(2, 1e6)).toBeCloseTo(200, 4);
    expect(ratePer100mVmt(0, 5e7)).toBe(0);
  });
  it('is null — never 0 — when the denominator is unknown or zero', () => {
    expect(ratePer100mVmt(3, null)).toBeNull(); expect(ratePer100mVmt(3, 0)).toBeNull(); expect(ratePer100mVmt(null, 1e6)).toBeNull();
  });
});

describe('crashMatchSQL', () => {
  const q = crashMatchSQL({ crashTable: 'work_zone.crashes', zoneTable: '_wz_crash_zones_x', activeTable: '_wz_crash_active_x' });

  it('probes the crash geography index from each zone geometry, in metres', () => {
    expect(q).toContain(`ST_DWithin(c.geog, z.probe_geog, ${DEFAULT_CRASH_BUFFER_M})`);
    expect(DEFAULT_CRASH_BUFFER_M).toBe(50);
    expect(crashMatchSQL({ crashTable: 'c', zoneTable: 'z', activeTable: 'a', bufferM: 75 })).toContain('ST_DWithin(c.geog, z.probe_geog, 75)');
  });
  it("bounds the candidates by the zone's own span of dates", () => {
    expect(q).toContain('c.crash_date >= z.first_start::date AND c.crash_date <= z.last_end::date');
  });
  it('decides the role by distance to the anchor, and tests the half-open active window', () => {
    expect(q).toContain(`CASE WHEN n.dist_anchor_m <= ${DEFAULT_CRASH_BUFFER_M} THEN 'work_extent' ELSE 'queue' END AS role`);
    expect(q).toContain('n.epoch >= a.epoch_from AND n.epoch < a.epoch_to');
    // a crash with no time can never be in a window
    expect(q).toContain('n.epoch IS NOT NULL AND');
  });
  it('reports how far outside the nearest window a same-day crash fell', () => {
    expect(q).toContain('a.epoch_from - n.epoch'); expect(q).toContain('n.epoch - a.epoch_to + 1');
    expect(q).toContain('AS active_that_day');
  });
  it('leaves the gap NULL on a day with no window, rather than letting ELSE 0 fire against NULL', () => {
    // The bug this pins: comparing to a NULL epoch_from is unknown, not false,
    // so 13,475 inactive-day matches in CY2024 first published a gap of 0.
    expect(q).toContain('WHEN n.epoch IS NULL OR a.epoch_from IS NULL THEN NULL');
  });
  it('validates its arguments', () => {
    expect(() => crashMatchSQL({ crashTable: 'c', zoneTable: 'z', activeTable: 'a', bufferM: 0 })).toThrow(/metres/);
    expect(() => crashMatchSQL({ crashTable: 'c', activeTable: 'a' })).toThrow(/required/);
  });
});

describe('rollupM5', () => {
  const rows = [
    { wz_event_id: 'A', crashes_total: 3, crashes_work_extent: 2, crashes_queue: 1, crashes_fatal: 1, crashes_injury: 1, crashes_pdo: 1, crashes_unknown: 0,
      kabco_k: 1, kabco_a: 0, kabco_b: 1, kabco_c: 0, kabco_o: 1, n_fatalities: 1, n_injuries: 2,
      crashes_wz_coded: 1, crashes_flagger: 0, crashes_time_uncertain: 1, crashes_off_window: 2,
      vmt_through_wz: 2e6, rate_measured: true, active_hours: 100 },
    { wz_event_id: 'B', crashes_total: 1, crashes_work_extent: 1, crashes_queue: 0, crashes_fatal: 0, crashes_injury: 0, crashes_pdo: 1, crashes_unknown: 0,
      kabco_k: 0, kabco_a: 0, kabco_b: 0, kabco_c: 0, kabco_o: 1, n_fatalities: 0, n_injuries: 0,
      crashes_wz_coded: 0, crashes_flagger: 1, crashes_time_uncertain: 0, crashes_off_window: 0,
      vmt_through_wz: null, rate_measured: false, active_hours: 50 },
    { wz_event_id: 'C', crashes_total: 0, crashes_work_extent: 0, crashes_queue: 0, crashes_fatal: 0, crashes_injury: 0, crashes_pdo: 0, crashes_unknown: 0,
      kabco_k: 0, kabco_a: 0, kabco_b: 0, kabco_c: 0, kabco_o: 0, n_fatalities: 0, n_injuries: 0,
      crashes_wz_coded: 0, crashes_flagger: 0, crashes_time_uncertain: 0, crashes_off_window: 0,
      vmt_through_wz: 1e6, rate_measured: true, active_hours: 10 },
  ];
  const r = rollupM5(rows);

  it('counts crashes and severities across zones', () => {
    expect(r.zones).toBe(3); expect(r.zones_with_crash).toBe(2); expect(r.crashes_total).toBe(4);
    expect(r.fatal).toBe(1); expect(r.injury).toBe(1); expect(r.pdo).toBe(2); expect(r.kabco_k).toBe(1); expect(r.n_injuries).toBe(2);
    expect(r.crashes_queue).toBe(1); expect(r.crashes_off_window).toBe(2);
  });
  it('computes the rate only over zones whose exposure is complete, numerator and denominator alike', () => {
    // A (3 crashes, 2e6 VMT) and C (0 crashes, 1e6 VMT); B has no exposure and is left out of BOTH sides.
    expect(r.zones_rate_measured).toBe(2); expect(r.crashes_in_rate).toBe(3); expect(r.vmt_through_wz).toBe(3e6);
    expect(r.rate_per_100m_vmt).toBeCloseTo(3 / 3e6 * 1e8, 3);
    expect(r.rate_work_extent_per_100m_vmt).toBeCloseTo(2 / 3e6 * 1e8, 3);
    expect(r.injury_rate_per_100m_vmt).toBeCloseTo(2 / 3e6 * 1e8, 3);
  });
  it('reports the coded share of located crashes — the under-coding measure', () => {
    expect(r.crashes_wz_coded).toBe(1); expect(r.pct_located_coded).toBeCloseTo(0.25, 4);
  });
  it('gives a time-based rate that needs no volume', () => {
    expect(r.active_hours).toBe(160); expect(r.crashes_per_1000_active_hours).toBeCloseTo(4 / 160 * 1000, 4);
  });
  it('is null, not zero, when nothing is measurable', () => {
    const e = rollupM5([{ wz_event_id: 'X', crashes_total: 2, rate_measured: false, vmt_through_wz: null, active_hours: 0 }]);
    expect(e.rate_per_100m_vmt).toBeNull(); expect(e.crashes_per_1000_active_hours).toBeNull(); expect(e.crashes_total).toBe(2);
  });
  it('rolls up per tier', () => {
    const meta = new Map([
      ['A', { is_significant_candidate: true, is_interstate: true, span_hours: 200 }],
      ['B', { is_significant_candidate: false, is_interstate: false, span_hours: 6 }],
      ['C', { is_significant_candidate: false, is_interstate: true, span_hours: 6 }],
    ]);
    const t = rollupM5ByTier(rows, meta);
    expect(t.significant.crashes_total).toBe(3); expect(t.interstate.zones).toBe(2); expect(t.not_interstate.rate_per_100m_vmt).toBeNull();
    expect(t.week_plus.zones).toBe(1);
  });
});
