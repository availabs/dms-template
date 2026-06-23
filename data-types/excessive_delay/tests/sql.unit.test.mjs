/**
 * Unit tests for the excessive_delay SQL builders (sql.js).
 *
 * These strings are load-bearing: the ClickHouse monthly delay query carries
 * the entire bucket computation (thresholds, normalized AADT, distribution
 * keys), and the PG DDL pins the output table contract
 * (UNIQUE(tmc,year,month), GIST on wkb_geometry). Pure string builders —
 * no DB connections.
 */
import { describe, it, expect } from 'vitest';
import * as sql from '../sql.js';

const squish = (s) => s.replace(/\s+/g, ' ').trim();

describe('escapeLiteral', () => {
  it('quotes strings and doubles embedded quotes', () => {
    expect(sql.escapeLiteral("O'Hare Rd")).toBe("'O''Hare Rd'");
  });
  it('passes numbers through and renders null/undefined as NULL', () => {
    expect(sql.escapeLiteral(12.5)).toBe('12.5');
    expect(sql.escapeLiteral(null)).toBe('NULL');
    expect(sql.escapeLiteral(undefined)).toBe('NULL');
  });
  it('refuses NaN/Infinity (no bare NaN ever reaches SQL)', () => {
    expect(sql.escapeLiteral(NaN)).toBe('NULL');
    expect(sql.escapeLiteral(Infinity)).toBe('NULL');
  });
});

describe('viewTableName', () => {
  it('builds the legacy s{source}_v{view}_{name} lowercase identifier', () => {
    expect(sql.viewTableName(12, 34, 'Excessive Delay (NY)')).toBe('s12_v34_excessive_delay_ny_');
  });
});

describe('outputTableDDL (the excessive_delay output table)', () => {
  const pg = sql.outputTableDDL({ table: 'excessive_delay.s1_v2_ed', dialect: 'postgres' });
  const pgAll = squish(pg.join(';\n'));
  it('postgres: 23-column table with serial pk, year/month checks, UNIQUE(tmc,year,month)', () => {
    expect(pgAll).toContain('CREATE TABLE IF NOT EXISTS excessive_delay.s1_v2_ed');
    expect(pgAll).toContain('ogc_fid SERIAL PRIMARY KEY');
    expect(pgAll).toContain('tmc VARCHAR(9) NOT NULL');
    expect(pgAll).toContain('year SMALLINT NOT NULL CHECK (year > 2015)');
    expect(pgAll).toContain('month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12)');
    expect(pgAll).toContain('UNIQUE (tmc, year, month)');
    for (const col of ['total', 'non_recurrent', 'construction', 'accident', 'other', 'vot_eff', 'cost']) {
      expect(pgAll).toContain(`${col} DOUBLE PRECISION`);
    }
    expect(pgAll).toContain('wkb_geometry GEOMETRY(MultiLineString)');
    expect(pgAll).toContain('road_information VARCHAR');
  });
  it('postgres: ships a GIST index on wkb_geometry', () => {
    expect(pgAll).toMatch(/CREATE INDEX IF NOT EXISTS \S+ ON excessive_delay\.s1_v2_ed USING GIST \(wkb_geometry\)/);
  });
  it('sqlite: same logical shape, no GEOMETRY type, no GIST', () => {
    const lite = squish(sql.outputTableDDL({ table: 's1_v2_ed', dialect: 'sqlite' }).join(';\n'));
    expect(lite).toContain('CREATE TABLE IF NOT EXISTS s1_v2_ed');
    expect(lite).toContain('ogc_fid INTEGER PRIMARY KEY AUTOINCREMENT');
    expect(lite).toContain('UNIQUE (tmc, year, month)');
    expect(lite).toContain('wkb_geometry TEXT');
    expect(lite).not.toMatch(/GIST/);
  });
});

describe('monthDelayQuery (the ClickHouse bucket computation)', () => {
  const q = squish(sql.monthDelayQuery({
    prodTable: 'npmrds.s10_v20_prod',
    metaTable: 'npmrds_meta.s11_v21_meta',
    year: 2023,
    startDate: '2023-05-01',
    endDate: '2023-05-31',
  }));
  it('reads the prod travel-time table over the month window', () => {
    expect(q).toContain('FROM npmrds.s10_v20_prod AS a');
    expect(q).toContain("a.date >= '2023-05-01' AND a.date <= '2023-05-31'");
  });
  it('computes total vs non_recurrent with the recurrent baseline GREATEST', () => {
    expect(q).toContain('GREATEST( 0, a.travel_time_all_vehicles - GREATEST( c.threshold_tt, COALESCE(b.avg_tt, 0) ) ) / 3600 * c.aadt');
    expect(q).toContain('* d.distributions[a.epoch + 1] ) AS non_recurrent');
    expect(q).toContain('GREATEST( 0, a.travel_time_all_vehicles - c.threshold_tt ) / 3600 * c.aadt * d.distributions[a.epoch + 1] ) AS total');
  });
  it('builds the weekday-average recurrent baseline (weekdays, 288 epochs, same year)', () => {
    expect(q).toContain('toDayOfWeek(date) IN (1, 2, 3, 4, 5)');
    expect(q).toContain('epoch >= 0 AND epoch < 288 AND toYear(date) = 2023');
    expect(q).toContain('ON a.tmc = b.tmc AND a.epoch = b.epoch');
  });
  it('P2: joins a materialized baseline table instead of the inline subquery when given', () => {
    const fast = squish(sql.monthDelayQuery({
      prodTable: 'npmrds.s10_v20_prod', metaTable: 'npmrds_meta.s11_v21_meta',
      year: 2023, startDate: '2023-05-01', endDate: '2023-05-31',
      baselineTable: 'temp.avl_avg_tt_v20_2023',
    }));
    expect(fast).toContain('INNER JOIN temp.avl_avg_tt_v20_2023 AS b ON a.tmc = b.tmc AND a.epoch = b.epoch');
    expect(fast).not.toContain('AVG(travel_time_all_vehicles)'); // no inline recompute
  });
  it('exposes raw undirected AADT (aadt_unnorm/aadt_raw) so JS can class-weight VOT_eff', () => {
    expect(q).toContain('COALESCE(aadt, 0) AS aadt_unnorm');
    expect(q).toContain('any(c.aadt_unnorm) AS aadt_raw');
  });
  it('embeds the threshold / normalized-AADT / distribution-key expressions', () => {
    expect(q).toContain('COALESCE(aadt, 0) / LEAST(COALESCE(faciltype, 2), 2) AS aadt');
    expect(q).toContain('(miles / GREATEST(20, COALESCE(avg_speedlimit, 0) * 0.6)) * 3600 AS threshold_tt');
    expect(q).toContain("concat('WEEKEND_', IF(COALESCE(f_system, 3) < 3, 'FREEWAY', 'NONFREEWAY')) AS weekend_dist");
    expect(q).toContain("concat( 'WEEKDAY_', COALESCE(congestion_level, 'NO2LOW_CONGESTION'), '_', COALESCE(directionality, 'EVEN_DIST'), '_', IF(COALESCE(f_system, 3) < 3, 'FREEWAY', 'NONFREEWAY') ) AS weekday_dist");
  });
  it('joins aadt_distributions on the weekend/weekday key', () => {
    expect(q).toContain('INNER JOIN aadt_distributions AS d');
    expect(q).toContain('ON d.key = IF(toDayOfWeek(a.date) IN (6, 7), c.weekend_dist, c.weekday_dist)');
  });
  it('filters meta rows to aadt IS NOT NULL for the requested year (both CTE and join)', () => {
    expect(q.match(/WHERE aadt IS NOT NULL AND year = 2023/g)?.length).toBe(2);
  });
  it('aggregates per tmc/year/month with the county-road-miles lookup', () => {
    expect(q).toContain('WITH county_road_dir_miles AS');
    expect(q).toContain('GROUP BY road, county_code, direction');
    expect(q).toContain('GROUP BY a.tmc, toYear(a.date), toMonth(a.date)');
    expect(q).toContain('any(m.total_road_miles) AS total_road_miles');
  });
  it('P3: groups only by tmc/year/month — per-TMC constants via any(), no geometry in GROUP BY', () => {
    expect(q).toContain('any(c.wkb_geometry) AS wkb_geometry');
    expect(q).toContain('any(c.f_system) AS f_system');
    expect(q).toContain('any(c.region_code) AS region_code');
    // grouping list ends at toMonth — none of the metadata columns appear after it
    const groupIdx = q.indexOf('GROUP BY a.tmc, toYear(a.date), toMonth(a.date)');
    expect(groupIdx).toBeGreaterThan(-1);
    const tail = q.slice(groupIdx + 'GROUP BY a.tmc, toYear(a.date), toMonth(a.date)'.length);
    expect(tail.trim()).toBe('');
  });
  it('supports an optional region scope and a custom distributions table', () => {
    const scoped = squish(sql.monthDelayQuery({
      prodTable: 'p', metaTable: 'm', year: 2023,
      startDate: '2023-05-01', endDate: '2023-05-31',
      region: ['1', '2'], distributionsTable: 'temp.aadt_distributions',
    }));
    expect(scoped).toContain("region_code IN ('1', '2')");
    expect(scoped).toContain('INNER JOIN temp.aadt_distributions AS d');
    expect(q).not.toContain('region_code IN'); // unscoped by default
  });
});

describe('transcomDelayQuery (PG congestion blobs for one month)', () => {
  const q = squish(sql.transcomDelayQuery({ transcomTable: 'transcom.s5_v6_events', year: 2023, month: 5 }));
  it('maps NYSDOT categories to buckets via CASE', () => {
    expect(q).toContain("WHEN nysdot_general_category = 'Other' THEN 'other'");
    expect(q).toContain("WHEN nysdot_general_category = 'Construction' THEN 'construction'");
    expect(q).toContain("WHEN nysdot_general_category = 'Incident' THEN 'accident'");
  });
  it('selects the tmcDelayData blob for the month, attributed categories only', () => {
    expect(q).toContain("congestion_data->'tmcDelayData' AS delay_data");
    expect(q).toContain('FROM transcom.s5_v6_events');
    expect(q).toContain("congestion_data->'tmcDelayData' IS NOT NULL");
    expect(q).toContain("nysdot_general_category IN ('Other', 'Construction', 'Incident')");
  });
  it('P4: uses a sargable date-range predicate (no EXTRACT) incl. year rollover', () => {
    expect(q).toContain("start_date_time >= '2023-05-01'");
    expect(q).toContain("start_date_time < '2023-06-01'");
    expect(q).not.toContain('EXTRACT(');
    const dec = squish(sql.transcomDelayQuery({ transcomTable: 't', year: 2023, month: 12 }));
    expect(dec).toContain("start_date_time >= '2023-12-01'");
    expect(dec).toContain("start_date_time < '2024-01-01'");
  });
});

describe('baseline builders (P1/P2 — shared materialized yearly baseline)', () => {
  it('baselineCreateSQL: CTAS of the weekday-average per (tmc, epoch) for the year', () => {
    const s = squish(sql.baselineCreateSQL({
      table: 'temp.avl_avg_tt_v20_2023', prodTable: 'npmrds.s10_v20_prod', year: 2023,
    }));
    expect(s).toContain('CREATE TABLE IF NOT EXISTS temp.avl_avg_tt_v20_2023');
    expect(s).toContain('ENGINE = MergeTree()');
    expect(s).toContain('ORDER BY (tmc, epoch)');
    expect(s).toContain('AVG(travel_time_all_vehicles) AS avg_tt');
    expect(s).toContain('toDayOfWeek(date) IN (1, 2, 3, 4, 5)');
    expect(s).toContain('toYear(date) = 2023');
    expect(s).toContain('GROUP BY tmc, epoch');
  });
  it('baselineDropSQL drops it', () => {
    expect(sql.baselineDropSQL({ table: 'temp.x' })).toBe('DROP TABLE IF EXISTS temp.x');
  });
  it('baselineTableName is deterministic per (prod view tag, year)', () => {
    expect(sql.baselineTableName({ prodTable: 'npmrds.s10_v20_prod', year: 2023 }))
      .toBe('temp.avl_avg_tt_s10_v20_prod_2023');
  });
});

describe('insertRowsSQL (computed rows → output table)', () => {
  const row = {
    tmc: '120+1001', year: 2023, month: 5, region_code: '1',
    total: 12.35, f_system: 1, non_recurrent: 4.57, vot_eff: 52.95, cost: 653.7,
    aadt: 1000, aadt_combi: 50, aadt_singl: 30, length: 0.5,
    roadname: "O'Hare Access", tmclinear: 11, road_order: 2,
    county_code: '36001', direction: 'EASTBOUND',
    wkb_geometry: '{"type":"MultiLineString","coordinates":[[[0,0],[1,1]]]}',
    road_information: "O'Hare Access EASTBOUND 10.12",
  };
  it('postgres: wraps geometry in ST_SetSRID(ST_GeomFromGeoJSON(...), 4326) and escapes literals', () => {
    const q = squish(sql.insertRowsSQL({ table: 'excessive_delay.t', rows: [row], dialect: 'postgres' }));
    expect(q).toContain('INSERT INTO excessive_delay.t (tmc, year, month, region_code, total, f_system, non_recurrent, vot_eff, cost, aadt, aadt_combi, aadt_singl, length, roadname, tmclinear, road_order, county_code, direction, wkb_geometry, road_information)');
    expect(q).toContain("ST_SetSRID(ST_GeomFromGeoJSON('{\"type\":\"MultiLineString\",\"coordinates\":[[[0,0],[1,1]]]}'), 4326)");
    expect(q).toContain("'O''Hare Access'");
  });
  it('postgres: upsert adds ON CONFLICT (tmc, year, month) DO UPDATE over every data column', () => {
    const q = squish(sql.insertRowsSQL({ table: 't', rows: [row], dialect: 'postgres', upsert: true }));
    expect(q).toContain('ON CONFLICT (tmc, year, month) DO UPDATE SET');
    for (const c of ['total', 'non_recurrent', 'region_code', 'wkb_geometry', 'road_information']) {
      expect(q).toContain(`${c} = EXCLUDED.${c}`);
    }
  });
  it('sqlite: stores the GeoJSON string verbatim (no PostGIS)', () => {
    const q = squish(sql.insertRowsSQL({ table: 't', rows: [row], dialect: 'sqlite' }));
    expect(q).not.toContain('ST_SetSRID');
    expect(q).toContain("'{\"type\":\"MultiLineString\",\"coordinates\":[[[0,0],[1,1]]]}'");
  });
  it('renders NULL geometry as NULL and requires rows', () => {
    const q = squish(sql.insertRowsSQL({ table: 't', rows: [{ ...row, wkb_geometry: null }], dialect: 'postgres' }));
    expect(q).not.toContain('ST_GeomFromGeoJSON');
    expect(() => sql.insertRowsSQL({ table: 't', rows: [], dialect: 'postgres' })).toThrow(/rows/i);
  });
});

describe('attributionUpdateSQL (transcom buckets → UPDATE ... FROM, pg+sqlite portable)', () => {
  const rows = [
    [2023, 5, '120+1001', 15.01, 1.25, 0],
    [2023, 5, "120'1002", 2, 0, 3],
  ];
  const q = squish(sql.attributionUpdateSQL({ table: 'excessive_delay.t', rows }));
  it('updates the three attribution buckets from an inline derived table', () => {
    expect(q).toContain('UPDATE excessive_delay.t SET construction = v.construction, accident = v.accident, other = v.other FROM (');
    expect(q).toContain("SELECT 2023 AS year, 5 AS month, '120+1001' AS tmc, 15.01 AS construction, 1.25 AS accident, 0 AS other");
    expect(q).toContain('UNION ALL SELECT 2023, 5,');
    expect(q).toContain('WHERE excessive_delay.t.year = v.year AND excessive_delay.t.month = v.month AND excessive_delay.t.tmc = v.tmc');
  });
  it('escapes TMC literals', () => {
    expect(q).toContain("'120''1002'");
  });
  it('requires rows', () => {
    expect(() => sql.attributionUpdateSQL({ table: 't', rows: [] })).toThrow(/rows/i);
  });
});

describe('regionNameUpdateSQL (ny.nysdot_region_names join, month-scoped)', () => {
  it('postgres: casts region codes to text like the legacy route', () => {
    const q = squish(sql.regionNameUpdateSQL({
      table: 'excessive_delay.t', regionNamesTable: 'ny.nysdot_region_names',
      year: 2023, month: 5, dialect: 'postgres',
    }));
    expect(q).toContain('UPDATE excessive_delay.t AS t SET region_name = n.name FROM ny.nysdot_region_names AS n');
    expect(q).toContain('t.region_code::text = n.region::text');
    expect(q).toContain('t.region_code IS NOT NULL AND t.year = 2023 AND t.month = 5');
  });
  it('sqlite: same statement without the ::text casts', () => {
    const q = squish(sql.regionNameUpdateSQL({
      table: 't', regionNamesTable: 'nysdot_region_names', year: 2023, month: 5, dialect: 'sqlite',
    }));
    expect(q).toContain('t.region_code = n.region');
    expect(q).not.toContain('::text');
  });
});

describe('delete + period introspection SQL', () => {
  it('deleteMonthSQL clears one (year, month) before recompute', () => {
    expect(squish(sql.deleteMonthSQL({ table: 't', year: 2023, month: 5 })))
      .toBe('DELETE FROM t WHERE year = 2023 AND month = 5');
  });
  it('deleteYearsSQL deletes whole years (the /remove contract — never TRUNCATE)', () => {
    const q = squish(sql.deleteYearsSQL({ table: 't', years: [2019, 2021] }));
    expect(q).toBe('DELETE FROM t WHERE year IN (2019, 2021)');
    expect(q).not.toMatch(/TRUNCATE/i);
    expect(() => sql.deleteYearsSQL({ table: 't', years: ['drop table'] })).toThrow(/years/i);
  });
  it('distinctPeriodsSQL lists remaining (year, month) pairs in order', () => {
    expect(squish(sql.distinctPeriodsSQL('t')))
      .toBe('SELECT DISTINCT year, month FROM t ORDER BY year, month');
  });
});

describe('M2 (methodology v2): median baseline option', () => {
  it("statistic: 'median' uses quantile(0.5), default stays AVG (v1 reproducible)", () => {
    const med = squish(sql.baselineCreateSQL({ table: 't.b', prodTable: 'p', year: 2026, statistic: 'median' }));
    expect(med).toContain('quantile(0.5)(travel_time_all_vehicles) AS avg_tt');
    expect(med).not.toContain('AVG(travel_time_all_vehicles)');
    const dflt = squish(sql.baselineCreateSQL({ table: 't.b', prodTable: 'p', year: 2026 }));
    expect(dflt).toContain('AVG(travel_time_all_vehicles) AS avg_tt');
  });
});

describe('geometry literal format sniffing (2026-06-10: CH meta mixes GeoJSON, WKB-hex, WKT by vintage)', () => {
  const row = (geom) => ({ tmc: 'A', year: 2026, month: 4, region_code: '1', total: 1, f_system: 1,
    non_recurrent: 1, aadt: 1, aadt_combi: 1, aadt_singl: 1, length: 1, roadname: 'I-90',
    tmclinear: 1, road_order: 1, county_code: '36001', direction: 'E', wkb_geometry: geom, road_information: 'x' });
  const ins = (geom) => squish(sql.insertRowsSQL({ table: 't', rows: [row(geom)], dialect: 'postgres' }));
  it('GeoJSON object/string → ST_GeomFromGeoJSON', () => {
    expect(ins({ type: 'MultiLineString', coordinates: [[[0, 0], [1, 1]]] })).toContain('ST_GeomFromGeoJSON');
    expect(ins('{"type":"MultiLineString","coordinates":[[[0,0],[1,1]]]}')).toContain('ST_GeomFromGeoJSON');
  });
  it('WKB hex → direct ::geometry cast', () => {
    const s = ins('01050000000100000001020000002C0000003A3B');
    expect(s).toContain("'01050000000100000001020000002C0000003A3B'::geometry");
    expect(s).not.toContain('ST_GeomFromGeoJSON');
  });
  it('WKT → ST_GeomFromText', () => {
    expect(ins('MULTILINESTRING((0 0,1 1))')).toContain('ST_GeomFromText');
  });
  it('empty / null / junk → NULL (no PostGIS error)', () => {
    expect(ins('')).toMatch(/NULL/);
    expect(ins(null)).toMatch(/NULL/);
    expect(ins('garbage!!')).toMatch(/NULL/);
  });
});
