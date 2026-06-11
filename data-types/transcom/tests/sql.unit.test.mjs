/**
 * Unit tests for the transcom pure SQL builders.
 * No DB — asserts the load-bearing parts of the generated SQL text.
 */
import { describe, it, expect } from 'vitest';
import * as sql from '../sql.js';
import { normalizeEvent } from '../events.js';

describe('eventsTableDDL', () => {
  const ddl = sql.eventsTableDDL('transcom', 's1_v2_test');

  it('ports the legacy column set', () => {
    for (const frag of [
      'event_id TEXT UNIQUE',
      'event_class TEXT',
      'start_date_time TIMESTAMP',
      'nysdot_general_category TEXT',
      'nysdot_sub_category TEXT',
      'congestion_data JSONB',
      'vehicle_delay NUMERIC',
      'cost BIGINT',
      'tmclist TEXT',
      'f_system SMALLINT',
      'wkb_geometry geometry(Point, 3857)',
    ]) {
      expect(ddl).toContain(frag);
    }
  });

  it('creates the schema, the event_id index, the GIST index and the geometry trigger', () => {
    expect(ddl).toContain('CREATE SCHEMA IF NOT EXISTS transcom');
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS transcom.s1_v2_test');
    expect(ddl).toMatch(/USING GIST \(wkb_geometry\)/);
    expect(ddl).toContain('ST_MakePoint(NEW.point_long, NEW.point_lat)');
  });
});

describe('insertEventsSQL', () => {
  const row = normalizeEvent({
    ID: 'E1',
    Description: "O'Brien crash",
    'Start DateTime': '03/15/2024 02:30:45 PM',
    InjuryInvolved: true,
  });
  const text = sql.insertEventsSQL('transcom', 'tbl', [row]);

  it('inserts every EVENT_COLUMNS column and is idempotent on event_id', () => {
    expect(text).toContain('INSERT INTO transcom.tbl');
    expect(text).toContain('ON CONFLICT (event_id) DO NOTHING');
    for (const col of ['event_id', 'event_class', 'month_year', 'tmc_geometry']) {
      expect(text).toContain(col);
    }
  });

  it('escapes single quotes and renders nulls/booleans as SQL literals', () => {
    expect(text).toContain("'O''Brien crash'");
    expect(text).toContain('NULL');
    expect(text).toContain('TRUE');
  });
});

describe('nysdotCategoryUpdateSQL', () => {
  it('joins the classification table on event_type within the window', () => {
    const text = sql.nysdotCategoryUpdateSQL({
      schema: 'transcom', table: 'tbl',
      startTimestamp: '2024-03-01 00:00:00', endTimestamp: '2024-03-31 23:59:59',
    });
    expect(text).toContain('datasets.s479_v835_nysdot_transcom_event_classification');
    expect(text).toContain('LOWER(a.event_type) = LOWER(b.event_type)');
    expect(text).toContain('nysdot_general_category');
    expect(text).toContain("'2024-03-01 00:00:00'");
  });
});

describe('tmcMatchUpdateSQL (publish variant: tmclist + roadway metadata)', () => {
  const text = sql.tmcMatchUpdateSQL({
    schema: 'transcom', table: 'tbl', geomDataTable: 'ny.npmrds_geom', year: 2024,
  });
  it('spatially matches within 18m with direction-then-similarity ranking', () => {
    expect(text).toContain('ST_DWithin(e.point, g.geometry, 18)');
    expect(text).toContain('similarity(e.facility, g.road)');
    expect(text).toContain('ROW_NUMBER() OVER');
    expect(text).toContain('WHERE rn = 1');
  });
  it('sets tmclist and the denormalized roadway fields', () => {
    for (const f of ['tmclist = s.tmc', 'f_system = s.f_system', 'county_code = s.county_code', 'region_code = s.region_code']) {
      expect(text).toContain(f);
    }
    expect(text).toContain('FROM ny.npmrds_geom');
    expect(text).toContain('year = 2024');
  });
});

describe('tmcMatchFillMissingSQL + tmcMetaFromTmclistSQL (add variant)', () => {
  it('only fills rows with NULL tmclist', () => {
    const text = sql.tmcMatchFillMissingSQL({ schema: 'transcom', table: 'tbl', geomDataTable: 'g.t', year: 2024 });
    expect(text).toContain('tmclist IS NULL');
    expect(text).toContain('tmclist = s.tmc');
  });
  it('backfills roadway metadata from the first tmc of tmclist', () => {
    const text = sql.tmcMetaFromTmclistSQL({ schema: 'transcom', table: 'tbl', geomDataTable: 'g.t', year: 2024 });
    expect(text).toContain("(string_to_array(tmclist, ','))[1]");
    expect(text).toContain('county_name = g.county_name');
  });
});

describe('regionNameUpdateSQL', () => {
  it('maps region_code -> region_name via ny.nysdot_region_names', () => {
    const text = sql.regionNameUpdateSQL({ schema: 'transcom', table: 'tbl' });
    expect(text).toContain('ny.nysdot_region_names');
    expect(text).toContain('region_name = n.name');
  });
  it('can restrict to rows still missing region_name (add variant)', () => {
    const text = sql.regionNameUpdateSQL({ schema: 'transcom', table: 'tbl', onlyNull: true });
    expect(text).toContain('region_name IS NULL');
  });
});

describe('eventTmcTableDDL', () => {
  const ddl = sql.eventTmcTableDDL('transcom', 'evt_tmc');
  it('ports the event->TMC expansion table', () => {
    for (const frag of [
      'event_id            TEXT NOT NULL',
      'tmc                 TEXT NOT NULL',
      'bound_start_date    DATE',
      'bound_start_time    INT',
      'bound_end_date      DATE',
      'bound_end_time      INT',
      'delay               DOUBLE PRECISION',
      'raw_delay           DOUBLE PRECISION',
      'wkb_geometry        geometry(MultiLineString, 4326)',
      'UNIQUE (event_id, tmc)',
    ]) {
      expect(ddl).toContain(frag);
    }
  });
  it('does not hardcode the legacy npmrds_admin table owner', () => {
    expect(ddl).not.toContain('OWNER TO');
  });
});

describe('eventTmcInsertSQL', () => {
  const text = sql.eventTmcInsertSQL({
    eventTmcTable: 'transcom.evt_tmc',
    transcomTable: 'transcom.events',
    geomTable: 'ny.npmrds_geom_y2024',
    startDate: '2024-03-01',
    endDate: '2024-03-31',
  });
  it('expands congestion_data tmcBounds/tmcDelayData per (event, tmc)', () => {
    expect(text).toContain("jsonb_each(t.congestion_data->'tmcBounds')");
    expect(text).toContain("jsonb_each(t.congestion_data->'tmcDelayData')");
    expect(text).toContain("(t.congestion_data->'tmcDelayData'->>tmc_keys.tmc_key)::float AS delay");
    expect(text).toContain("(t.congestion_data->'rawTmcDelayData'->>tmc_keys.tmc_key)::float AS raw_delay");
  });
  it('upserts on (event_id, tmc) and joins the year geometry', () => {
    expect(text).toContain('ON CONFLICT (event_id, tmc) DO UPDATE');
    expect(text).toContain("g.year = EXTRACT(YEAR FROM '2024-03-01'::date)");
    expect(text).toContain('transcom.events');
  });
});

describe('congestion table builders', () => {
  it('congestionTableDDL is (event_id TEXT PRIMARY KEY, congestion_data JSONB)', () => {
    const ddl = sql.congestionTableDDL('transcom_congestion', 'cg');
    expect(ddl).toContain('CREATE SCHEMA IF NOT EXISTS transcom_congestion');
    expect(ddl).toContain('event_id TEXT PRIMARY KEY');
    expect(ddl).toContain('congestion_data JSONB');
  });
  it('congestionUpsertSQL upserts by event_id with $1/$2 params', () => {
    const text = sql.congestionUpsertSQL('transcom_congestion', 'cg');
    expect(text).toContain('VALUES ($1, $2)');
    expect(text).toContain('ON CONFLICT (event_id)');
    expect(text).toMatch(/DO UPDATE/i);
  });
  it('updateEventsCongestionSQL writes congestion_data, vehicle_delay and cost = 20x raw', () => {
    const text = sql.updateEventsCongestionSQL({
      eventsTable: 'transcom.events', congestionTable: 'transcom_congestion.cg',
    });
    expect(text).toContain("vehicle_delay = (m.congestion_data->>'vehicleDelay')::NUMERIC");
    expect(text).toContain("cost = 20 * (m.congestion_data->>'rawVehicleDelay')::NUMERIC");
    expect(text).toContain('t.event_id = m.event_id');
  });
});

describe('updateEventsCongestionSQL county scoping (crash-resumability of resume markers)', () => {
  it('geoid-scoped variant updates only that county (cheap per-county writeback)', () => {
    const scoped = sql.updateEventsCongestionSQL({ eventsTable: 'e', congestionTable: 'c', geoid: '36047' });
    expect(scoped).toContain("t.county_code = '36047'");
    const full = sql.updateEventsCongestionSQL({ eventsTable: 'e', congestionTable: 'c' });
    expect(full).not.toContain('county_code');
  });
});

describe('incidentsSQL', () => {
  const text = sql.incidentsSQL({
    transcomTable: 'transcom.events',
    v0Table: 'conflation.v0_2024',
    waysTable: 'conflation.ways_2024',
    geoid: '36001',
    startDate: '2024-03-01',
    endDate: '2024-03-31',
  });
  it('selects categorized, not-yet-congested events for the county window', () => {
    expect(text).toContain('nysdot_general_category IS NOT NULL');
    expect(text).toContain('congestion_data IS NULL');
    expect(text).toContain("county_code = '36001'");
    expect(text).toContain("(trans.nysdot_general_category = 'Construction') AS is_construction");
  });
  it('reprocess: true drops the congestion_data IS NULL guard (from-scratch recompute)', () => {
    const re = sql.incidentsSQL({
      transcomTable: 't', v0Table: 'v', waysTable: 'w', geoid: '36001',
      startDate: '2024-03-01', endDate: '2024-03-31', reprocess: true,
    });
    expect(re).not.toContain('congestion_data IS NULL');
    expect(re).toContain('nysdot_general_category IS NOT NULL');
  });
  it('determinism: way tie-break + ordered conflation streams (2026-06-10 fidelity-diff finding)', () => {
    expect(text).toContain('ORDER BY trans.event_id, cv0.tmc NULLS LAST, cv0.id');
    expect(sql.conflationNodesSQL({ nodesTable: 'n', waysTable: 'w', v0Table: 'v' })).toMatch(/ORDER BY id/);
    expect(sql.conflationWaysSQL({ waysTable: 'w', v0Table: 'v' })).toMatch(/ORDER BY id/);
  });
  it('reprocess + resumeV2: skips events already carrying a v2 blob (probe key) — mid-month resumable', () => {
    const re = sql.incidentsSQL({
      transcomTable: 't', v0Table: 'v', waysTable: 'w', geoid: '36001',
      startDate: '2024-03-01', endDate: '2024-03-31', reprocess: true, resumeV2: true,
    });
    expect(re).toContain("(congestion_data IS NULL OR NOT (congestion_data ? 'probe'))");
    expect(re).not.toMatch(/AND congestion_data IS NULL\s*$/m);
  });
  it('resolves the start node from the conflation ways (osm_fwd aware)', () => {
    expect(text).toContain('cv0.osm_fwd = 0');
    expect(text).toContain('cw.node_ids[1]');
    expect(text).toContain('cv0.n < 7');
  });
});

describe('metadata.columns descriptors', () => {
  it('exposes descriptor lists for all three tables with the contract shape', () => {
    for (const cols of [sql.EVENTS_TABLE_COLUMNS, sql.EVENT_TMC_TABLE_COLUMNS, sql.CONGESTION_TABLE_COLUMNS]) {
      expect(Array.isArray(cols)).toBe(true);
      expect(cols.length).toBeGreaterThan(0);
      for (const c of cols) {
        expect(typeof c.name).toBe('string');
        expect(typeof c.display_name).toBe('string');
        expect(typeof c.type).toBe('string');
      }
    }
    expect(sql.EVENTS_TABLE_COLUMNS.map((c) => c.name)).toContain('event_id');
    expect(sql.EVENT_TMC_TABLE_COLUMNS.map((c) => c.name)).toContain('tmc');
    expect(sql.CONGESTION_TABLE_COLUMNS.map((c) => c.name)).toEqual(['event_id', 'congestion_data']);
  });
});

describe('conflation defaults', () => {
  it('exposes the legacy hardcoded conflation source ids as documented defaults', () => {
    expect(sql.DEFAULT_CONFLATION_SOURCE_IDS).toEqual({
      conflation_nodes_source_id: 237,
      conflation_ways_source_id: 236,
      conflation_v0_source_id: 238,
    });
  });
});
