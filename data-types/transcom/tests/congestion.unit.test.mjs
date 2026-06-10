/**
 * Unit tests for the congestion machinery (pure parts).
 * No DB / no ClickHouse — fixture inputs only.
 *
 * The load-bearing contract here is the per-event congestion_data JSON shape,
 * ported EXACTLY from the legacy transcom/processIncidents.js:
 *   { dates, delay, rawDelay, vehicleDelay, rawVehicleDelay, eventTmcs,
 *     tmcDelayData, rawTmcDelayData, branches, startTime, endTime, node_id,
 *     way_id, tmcBounds }
 */
import { describe, it, expect } from 'vitest';
import * as cg from '../congestion.js';

const EXPECTED_KEYS = [
  'branches', 'dates', 'delay', 'endTime', 'eventTmcs', 'node_id',
  'probe', 'rawDelay', 'rawTmcDelayData', 'rawVehicleDelay', 'startTime',
  'tmcBounds', 'tmcDelayData', 'vehicleDelay', 'way_id',
].sort();

describe('timeStringToEpoch', () => {
  it('converts HH:mm to a 5-minute epoch (down by default, up on demand)', () => {
    expect(cg.timeStringToEpoch('06:32')).toBe(78);
    expect(cg.timeStringToEpoch('06:32', 'up')).toBe(79);
    expect(cg.timeStringToEpoch('00:00')).toBe(0);
    expect(cg.timeStringToEpoch('10:10', 'up')).toBe(122);
  });
});

describe('buildEventTimes', () => {
  it('pads the event window by 30 epochs and records the event start/end indices', () => {
    const { times, eventStart, eventEnd } = cg.buildEventTimes({
      dates: ['2024-03-01'], startTime: 100, endTime: 110,
    });
    expect(times).toHaveLength(71);                       // epochs 70..140
    expect(times[0]).toEqual(['2024-03-01', 70]);
    expect(times[70]).toEqual(['2024-03-01', 140]);
    expect(eventStart).toBe(30);                          // index of epoch 100
    expect(eventEnd).toBe(40);                            // index of epoch 110
  });
});

describe('getDist', () => {
  const attrs = { congestion_level: 'NO2LOW_CONGESTION', directionality: 'AM_PEAK', f_system: 1 };
  it('weekend keys ignore congestion level/peak', () => {
    expect(cg.getDist(attrs, 0)).toBe('WEEKEND_FREEWAY');
    expect(cg.getDist(attrs, 6)).toBe('WEEKEND_FREEWAY');
  });
  it('weekday keys include congestion level and peak; f_system >= 3 is NONFREEWAY', () => {
    expect(cg.getDist(attrs, 2)).toBe('WEEKDAY_NO2LOW_CONGESTION_AM_PEAK_FREEWAY');
    expect(cg.getDist({ ...attrs, f_system: 3 }, 2)).toBe('WEEKDAY_NO2LOW_CONGESTION_AM_PEAK_NONFREEWAY');
  });
});

describe('calcDelay', () => {
  it('computes hours of delay vs max(yearly avg, threshold), vehicle delay via AADT distribution', () => {
    const attributes = {
      miles: 1, avg_speedlimit: 60, threshold: 90, avg_tt: 60,
      congestion_level: 'NO2LOW_CONGESTION', directionality: 'AM_PEAK',
      f_system: 1, faciltype: 1, aadt: 24000,
    };
    const row = { tmc: 'A', dow: 2, epoch: 100, year: 2024, tt: 200 };
    const avgTtMap = { 2024: { A: { 100: 100 } } };
    const d = cg.calcDelay(row, attributes, avgTtMap);
    expect(d.delay).toBeCloseTo(100 / 3600, 6);
    expect(d.speed).toBeCloseTo(0.5, 6);                  // |(36-18)/36|
    expect(d.vehicleDelay).toBeGreaterThan(0);
  });
  it('returns 0 when the tmc has no attributes', () => {
    expect(cg.calcDelay({ tmc: 'A', dow: 2, epoch: 1 }, undefined, {})).toBe(0);
  });
});

describe('expandEpochs', () => {
  it('fills all 288 epochs per (date, tmc) with interpolated synthetic rows', () => {
    const rows = [{ tmc: 'A', date: '2024-03-01', epoch: 100, tt: 60 }];
    const out = cg.expandEpochs(rows, ['2024-03-01'], ['A'], { A: {} }, { A: 30 });
    expect(out).toHaveLength(288);
    const e50 = out.find((r) => r.epoch === 50);
    expect(e50.synthetic).toBe(true);
    expect(e50.tt).toBeCloseTo(45, 6);                    // linear between (0,30) and (100,60)
  });
});

describe('assembleCongestionData — construction events', () => {
  it('sums delays flat per tmc and bounds every tmc by the whole event window', () => {
    const incident = {
      event_id: 'E1', node_id: 5, way_id: 'w9',
      dates: ['2024-03-01'], startTime: 100, endTime: 110,
    };
    const out = cg.assembleCongestionData({
      incident,
      isConstruction: true,
      tmcDelayData: [
        { tmc: 'A', synthetic: false, delayData: { delay: 1, vehicleDelay: 10 } },
        { tmc: 'A', synthetic: true, delayData: { delay: 2, vehicleDelay: 20 } },
      ],
      branches: [{ branch: ['A'], ways: ['w9'], direction: 'down-stream', length: 1 }],
      eventTmcs: ['A'],
      times: [], eventStart: 0, eventEnd: 0,
      tmcAttributes: { A: { f_system: 1 } },
    });

    expect(Object.keys(out).sort()).toEqual(EXPECTED_KEYS);
    expect(out.delay).toBe(3);
    expect(out.vehicleDelay).toBe(30);
    expect(out.rawDelay).toBe(1);                          // synthetic rows excluded from raw
    expect(out.rawVehicleDelay).toBe(10);
    expect(out.tmcDelayData).toEqual({ A: 30 });
    expect(out.rawTmcDelayData).toEqual({ A: 10 });
    expect(out.tmcBounds).toEqual({ A: [['2024-03-01', 100], ['2024-03-01', 110]] });
    expect(out.node_id).toBe(5);
    expect(out.startTime).toBe(100);
    expect(out.endTime).toBe(110);
    // M6: probe coverage — 1 observed of 2 cells
    expect(out.probe).toEqual({ observedCells: 1, totalCells: 2, coverage: 0.5 });
  });

  it('M6: probe coverage is 0 with no rows (no NaN)', () => {
    const out = cg.assembleCongestionData({
      incident: { event_id: 'E2', node_id: 1, dates: ['2024-03-01'], startTime: 0, endTime: 1 },
      isConstruction: true, tmcDelayData: [], branches: [], eventTmcs: [],
      times: [], eventStart: 0, eventEnd: 0, tmcAttributes: {},
    });
    expect(out.probe).toEqual({ observedCells: 0, totalCells: 0, coverage: 0 });
  });
});

describe('assembleCongestionData — incident events (branch walk + checkTmc bounds)', () => {
  it('accumulates edge-expanded delay per branch tmc and records the tmc bounds', () => {
    const incident = {
      event_id: 'E2', node_id: 7, way_id: 'w1',
      dates: ['2024-03-01'], startTime: 100, endTime: 110,
    };
    const { times, eventStart, eventEnd } = cg.buildEventTimes(incident);

    // Full 288-epoch delay series for tmc A: congested for epochs 95..115.
    const tmcDelayData = [];
    for (let e = 0; e < 288; e++) {
      const congested = e >= 95 && e <= 115;
      tmcDelayData.push({
        tmc: 'A', date: '2024-03-01', epoch: e, synthetic: false,
        delayData: { delay: congested ? 1 : 0, vehicleDelay: congested ? 2 : 0, speed: congested ? 0.5 : 0 },
      });
    }

    const out = cg.assembleCongestionData({
      incident,
      isConstruction: false,
      tmcDelayData,
      branches: [{ branch: ['A'], ways: ['w1'], direction: 'down-stream', length: 0.5 }],
      eventTmcs: ['A'],
      times, eventStart, eventEnd,
      tmcAttributes: { A: { f_system: 1 } },
    });

    expect(Object.keys(out).sort()).toEqual(EXPECTED_KEYS);
    // checkTmc accumulates outward from the event boundary fringes (legacy behavior):
    // left edge visits epochs 99..92 (5 congested), right edge 111..118 (5 congested).
    expect(out.delay).toBe(10);
    expect(out.vehicleDelay).toBe(20);
    expect(out.rawDelay).toBe(10);
    expect(out.rawVehicleDelay).toBe(20);
    expect(out.tmcDelayData).toEqual({ A: 20 });
    expect(out.tmcBounds.A).toEqual([['2024-03-01', 95], ['2024-03-01', 115]]);
    expect(out.branches).toHaveLength(1);
    expect(out.eventTmcs).toEqual(['A']);
  });
});

describe('postProcessIncidentRows', () => {
  it('derives epochs and per-day dates from open/close times', () => {
    const [inc] = cg.postProcessIncidentRows([{
      event_id: 'E1', node_id: '5', is_construction: false, bad_dates: false,
      open_time: '2024-03-01 08:20:00', close_time: '2024-03-01 10:10:00', duration: null,
    }]);
    expect(inc.startTime).toBe(100);
    expect(inc.endTime).toBe(122);
    expect(inc.dates).toEqual(['2024-03-01']);
  });

  it('falls back to the duration string when open > close (bad dates)', () => {
    const [inc] = cg.postProcessIncidentRows([{
      event_id: 'E2', node_id: '5', is_construction: false, bad_dates: true,
      open_time: '2024-03-05 10:00:00', close_time: '2024-03-01 00:00:00', duration: '0 - 1:30',
    }]);
    expect(inc.startTime).toBe(120);                       // 10:00
    expect(inc.endTime).toBe(138);                         // 11:30, rounded up
    expect(inc.dates).toEqual(['2024-03-05']);
  });

  it('fudges a 15-minute window for sub-15-minute events', () => {
    const [inc] = cg.postProcessIncidentRows([{
      event_id: 'E3', node_id: '5', is_construction: false, bad_dates: false,
      open_time: '2024-03-01 08:00:00', close_time: '2024-03-01 08:05:00', duration: null,
    }]);
    expect(inc.startTime).toBe(96);                        // 08:00
    expect(inc.endTime).toBe(99);                          // 08:15, rounded up
  });

  it('drops rows whose dates cannot be repaired', () => {
    const out = cg.postProcessIncidentRows([{
      event_id: 'E4', node_id: '5', is_construction: false, bad_dates: true,
      open_time: '2024-03-05 10:00:00', close_time: '2024-03-01 00:00:00', duration: 'not parsable',
    }]);
    // unparsable duration falls back to open_time + 15 minutes -> still usable
    expect(out).toHaveLength(1);
    expect(out[0].endTime).toBeGreaterThan(out[0].startTime);
  });
});

describe('getYearToConflationTableNamesFromViews', () => {
  it('maps versions to per-year nodes/ways/v0 tables and backfills missing years', () => {
    const rows = [
      { data_table: 'conflation.nodes_2022', version: 'conflation_map_2022_nodes_v0_6_0' },
      { data_table: 'conflation.ways_2022', version: 'conflation_map_2022_ways_v0_6_0' },
      { data_table: 'conflation.v0_2022', version: 'conflation_map_2022_v0_v0_6_0' },
      { data_table: 'conflation.n2w_2022', version: 'conflation_map_2022_nodes_to_ways_v0_6_0' },
    ];
    const byYear = cg.getYearToConflationTableNamesFromViews(rows);
    expect(byYear[2022]).toEqual({
      nodes: 'conflation.nodes_2022', ways: 'conflation.ways_2022', v0: 'conflation.v0_2022',
    });
    // later years fall back to the most recent earlier year
    expect(byYear[2023].nodes).toBe('conflation.nodes_2022');
    // earlier years fall forward
    expect(byYear[2020].ways).toBe('conflation.ways_2022');
  });
});

describe('makeGraph + walkGraph', () => {
  it('walks outward from the start node collecting event tmcs and branches', async () => {
    const graph = cg.makeGraph();
    graph.addNode(1, { coords: [0, 0] });
    graph.addNode(2, { coords: [0.01, 0] });
    graph.addNode(3, { coords: [0.02, 0] });
    graph.addLink(1, 2, { wayId: 'w1', tmc: 'A' });
    graph.addLink(2, 3, { wayId: 'w2', tmc: 'B' });
    // closing non-tmc link: walking it overruns the 0.5 distance budget, which
    // is what completes (records) the ['A','B'] branch — legacy semantics.
    graph.addLink(3, 1, { wayId: 'w3', tmc: null });

    const incident = { event_id: 'E1', dates: ['2024-03-01'], startTime: 100, endTime: 110 };
    const { times, eventStart, eventEnd } = cg.buildEventTimes(incident);

    // hoursOfDelay seam: every tmc congested across the whole day.
    const fetchDelayRows = async (inc, tmcs) => {
      const rows = [];
      for (const tmc of tmcs) {
        for (let e = 0; e < 288; e++) {
          rows.push({
            tmc, date: '2024-03-01', epoch: e, synthetic: false,
            delayData: { delay: 1, vehicleDelay: 10, speed: 0.5 },
          });
        }
      }
      return rows;
    };

    const tmcAttributes = {
      A: { f_system: 1, tmclinear: 101, direction: 'E' },
      B: { f_system: 1, tmclinear: 101, direction: 'E' },
    };

    const [eventTmcs, branches] = await cg.walkGraph(1, graph, tmcAttributes, {
      times, eventStart, eventEnd,
      eventMid: Math.floor((eventStart + eventEnd) * 0.5),
      incident,
      fetchDelayRows,
    });

    expect(eventTmcs).toContain('A');
    expect(branches.length).toBeGreaterThan(0);
    const allTmcs = branches.flatMap((b) => b.branch);
    expect(allTmcs).toContain('A');
    expect(allTmcs).toContain('B');
  });
});

// ── perf: walk prefetch + fetch caching (bench 2026-06-10: per-TMC walk fetches
//    were ~10x the per-event cost; batch + cache collapses them) ──────────────

describe('walkGraph prefetch (batched fetches)', () => {
  it('prefetches the reachable TMC neighborhood in one batched call before walking', async () => {
    const graph = cg.makeGraph();
    graph.addNode(1, { coords: [0, 0] });
    graph.addNode(2, { coords: [0.01, 0] });
    graph.addNode(3, { coords: [0.02, 0] });
    graph.addLink(1, 2, { wayId: 'w1', tmc: 'A' });
    graph.addLink(2, 3, { wayId: 'w2', tmc: 'B' });
    graph.addLink(3, 1, { wayId: 'w3', tmc: null });

    const incident = { event_id: 'E1', dates: ['2024-03-01'], startTime: 100, endTime: 110 };
    const { times, eventStart, eventEnd } = cg.buildEventTimes(incident);
    const calls = [];
    const fetchDelayRows = async (inc, tmcs) => {
      calls.push([...tmcs]);
      return tmcs.flatMap((tmc) => Array.from({ length: 288 }, (_, e) => ({
        tmc, date: '2024-03-01', epoch: e, synthetic: false,
        delayData: { delay: 1, vehicleDelay: 10, speed: 0.5 },
      })));
    };
    await cg.walkGraph(1, graph, {
      A: { f_system: 1, tmclinear: 101, direction: 'E' },
      B: { f_system: 1, tmclinear: 101, direction: 'E' },
    }, { times, eventStart, eventEnd, eventMid: Math.floor((eventStart + eventEnd) * 0.5), incident, fetchDelayRows });

    // first call is the batched neighborhood prefetch carrying BOTH reachable tmcs
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0].sort()).toEqual(['A', 'B']);
  });
});

describe('makeFetchDelayRows caching', () => {
  const chQueries = [];
  const fakeChDb = {
    async query({ query }) {
      chQueries.push(query);
      return { json: async () => [] }; // synthetic fill covers the data
    },
  };
  it('repeat TMCs hit the cache (no second CH round-trip); resetCache clears it', async () => {
    chQueries.length = 0;
    const fdr = cg.makeFetchDelayRows({
      chDb: fakeChDb, prodTableName: 'npmrds.p', tmcAttributes: { A: { avg_tt: 40 }, B: { avg_tt: 40 } },
      ffDataMap: { A: 35, B: 35 }, baselineTable: 'temp.b',
    });
    const incident = { dates: ['2024-03-01'] };
    await fdr(incident, ['A', 'B']);
    const after1 = chQueries.length;        // one TT + one baseline query
    expect(after1).toBe(2);
    const rows = await fdr(incident, ['A']); // cached — no new queries
    expect(chQueries.length).toBe(after1);
    expect(rows.every((r) => r.tmc === 'A')).toBe(true);
    expect(typeof fdr.resetCache).toBe('function');
    fdr.resetCache();
    await fdr(incident, ['A']);
    expect(chQueries.length).toBe(after1 + 2); // refetched after reset
  });
});

describe('processIncidents day-batched fetching (CH push-down: arrays in, JS semantics on memory)', () => {
  it('warms the cache once per date-group: 2 same-day clusters → exactly 1 TT + 1 baseline query', async () => {
    const chQueries = [];
    const fakeChDb = {
      async query({ query }) { chQueries.push(query); return { json: async () => [] }; },
    };
    const graph = cg.makeGraph();
    graph.addNode(1, { coords: [0, 0] });
    graph.addNode(2, { coords: [0.01, 0] });
    graph.addNode(10, { coords: [1, 1] });
    graph.addNode(11, { coords: [1.01, 1] });
    graph.addLink(1, 2, { wayId: 'w1', tmc: 'A' });
    graph.addLink(10, 11, { wayId: 'w2', tmc: 'B' });

    const tmcAttributes = {
      A: { miles: 0.5, avg_speedlimit: 55, threshold: 32, congestion_level: 'MODERATE_CONGESTION', directionality: 'EVEN_DIST', aadt: 1000, f_system: 1, faciltype: 1, avg_tt: 40, tmclinear: 1, direction: 'E' },
      B: { miles: 0.5, avg_speedlimit: 55, threshold: 32, congestion_level: 'MODERATE_CONGESTION', directionality: 'EVEN_DIST', aadt: 1000, f_system: 1, faciltype: 1, avg_tt: 40, tmclinear: 2, direction: 'E' },
    };
    const fetchDelayRows = cg.makeFetchDelayRows({
      chDb: fakeChDb, prodTableName: 'npmrds.p', tmcAttributes, ffDataMap: { A: 35, B: 35 },
      baselineTable: 'temp.b',
    });
    const upserts = [];
    const incidents = [
      { event_id: 'E1', node_id: 1, is_construction: false, duration: '0 - 01:00', open_time: '2024-03-05 08:00:00', close_time: '2024-03-05 09:00:00' },
      { event_id: 'E2', node_id: 10, is_construction: false, duration: '0 - 01:00', open_time: '2024-03-05 10:00:00', close_time: '2024-03-05 11:00:00' },
    ];
    const processed = cg.postProcessIncidentRows(incidents);
    await cg.processIncidents(
      { fetchDelayRows, upsertCongestion: async (id, data) => upserts.push([id, data]) },
      processed, graph, tmcAttributes
    );
    expect(upserts.length).toBe(2);
    // ONE warm pair for the shared 2024-03-05 date-group, not per cluster/incident
    expect(chQueries.length).toBe(2);
  });
});
