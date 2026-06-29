/**
 * Unit tests for npmrds ClickHouse DDL + SQL builders.
 *
 * These strings are load-bearing: the prod travel-time table, the CH meta
 * table, the raw→prod column mapping (incl. the view_id stamp), the
 * FULL OUTER JOIN meta insert (avg_vehicle_occupancy / is_interstate
 * formulas), and the directionality binned-data query are all consumed
 * verbatim by downstream tooling (pm3, map21, excessive_delay).
 * Ported from legacy avail-falcor npmrds publish.route.js / queries.js /
 * add.worker.mjs / map21 calcTtrMeasure.js — semantics pinned here.
 */
import { describe, it, expect } from 'vitest';
import * as ch from '../ch-sql.js';

const squish = (s) => s.replace(/\s+/g, ' ').trim();

describe('prodTableDDL (the production npmrds travel-time table)', () => {
  const ddl = squish(ch.prodTableDDL('npmrds.s1_v2_test'));
  it('targets the given fully-qualified table', () => {
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS npmrds.s1_v2_test');
  });
  it('is a ReplacingMergeTree keyed (tmc, epoch, date), partitioned by month', () => {
    expect(ddl).toContain('ENGINE = ReplacingMergeTree()');
    expect(ddl).toContain('PRIMARY KEY(tmc, epoch, date)');
    expect(ddl).toContain('ORDER BY(tmc, epoch, date)');
    expect(ddl).toContain('PARTITION BY toYYYYMM(date)');
  });
  it('has the 3 travel_time + 3 data_density columns, state, and the view_id stamp', () => {
    for (const k of ['all_vehicles', 'passenger_vehicles', 'freight_trucks']) {
      expect(ddl).toContain(`travel_time_${k} Float64`);
      expect(ddl).toContain(`data_density_${k} String`);
    }
    expect(ddl).toContain('state String');
    expect(ddl).toContain('view_id Int64');
  });
});

describe('metaTableDDL (the CH all-years tmc_meta table)', () => {
  const ddl = squish(ch.metaTableDDL('npmrds_meta.s9_v10_t_tmc_meta'));
  it('is a ReplacingMergeTree keyed/ordered by (year, tmc)', () => {
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS npmrds_meta.s9_v10_t_tmc_meta');
    expect(ddl).toContain('ENGINE = ReplacingMergeTree()');
    expect(ddl).toContain('ORDER BY (year, tmc)');
    expect(ddl).toContain('PRIMARY KEY(year, tmc)');
  });
  it('carries the tmc_identification columns + enrichment columns + wkb_geometry String', () => {
    for (const col of [
      'tmc String', 'f_system Int8', 'aadt Int64', 'isprimary Int8',
      'congestion_level String', 'year Int64', 'avg_speedlimit Float64',
      'directionality String', 'avg_vehicle_occupancy Float64',
      'state_code String', 'county_code String', 'region_code String',
      'mpo_code String', 'ua_code String', 'state_name String',
      'county_name String', 'ua_name String', 'is_interstate Bool',
      'wkb_geometry String',
    ]) expect(ddl).toContain(col);
  });
  it('does NOT have an mpo_name column (legacy CH meta drops it; PG keeps it)', () => {
    expect(ddl).not.toContain('mpo_name');
  });
});

describe('tempChMetaTableDDL (temp.meta_{tmcIdViewId}_{year})', () => {
  const ddl = squish(ch.tempChMetaTableDDL('meta_55_2023'));
  it('creates temp.meta_55_2023 keyed by (tmc, year, state_name)', () => {
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS temp.meta_55_2023');
    expect(ddl).toContain('ENGINE = ReplacingMergeTree()');
    expect(ddl).toContain('PRIMARY KEY (tmc, year, state_name)');
    expect(ddl).toContain('ORDER BY (tmc, year, state_name)');
  });
  it('has exactly the enrichment columns', () => {
    for (const col of [
      'tmc String', 'congestion_level String', 'year Int64',
      'avg_speedlimit Float64', 'directionality String',
      'avg_vehicle_occupancy Float64', 'state_code String',
      'county_code String', 'region_code String', 'mpo_code String',
      'ua_code String', 'state_name String', 'county_name String',
      'ua_name String',
    ]) expect(ddl).toContain(col);
  });
});

describe('insertRawIntoProdSQL (raw CH → prod CH, the add step)', () => {
  const sql = squish(ch.insertRawIntoProdSQL({
    prodTable: 'npmrds.s1_v2_t',
    rawTable: 'npmrds_raw.s3_v4_raw',
    rawViewId: 4,
  }));
  it('uses the exact legacy column mapping in order, stamping the raw view_id', () => {
    expect(sql).toContain(
      'SELECT tmc, date, epoch, travel_time_all_vehicles, travel_time_passenger_vehicles, '
      + 'travel_time_freight_trucks, data_density_all_vehicles, data_density_passenger_vehicles, '
      + 'data_density_freight_trucks, state, 4 AS view_id FROM npmrds_raw.s3_v4_raw'
    );
  });
  it('inserts into the prod table with unlimited memory (legacy SETTINGS)', () => {
    expect(sql).toContain('INSERT INTO npmrds.s1_v2_t');
    expect(sql).toContain('SETTINGS max_memory_usage = 0');
  });
});

describe('optimizeProdSQL', () => {
  it('deduplicates by (tmc, date, epoch) FINAL — verbatim legacy', () => {
    expect(squish(ch.optimizeProdSQL('npmrds.s1_v2_t')))
      .toBe('OPTIMIZE TABLE npmrds.s1_v2_t FINAL DEDUPLICATE BY tmc, date, epoch');
  });
});

describe('deleteMetaYearSQL / deleteProdViewIdSQL / dropPartitionSQL / dropTableSQL', () => {
  it('deletes a year from the meta table', () => {
    expect(squish(ch.deleteMetaYearSQL('npmrds_meta.m', 2023)))
      .toContain('ALTER TABLE npmrds_meta.m DELETE WHERE year = 2023');
  });
  it('deletes prod rows by view_id with the legacy mutation settings', () => {
    const sql = squish(ch.deleteProdViewIdSQL('npmrds.p', 42));
    expect(sql).toContain('ALTER TABLE npmrds.p DELETE WHERE view_id = 42');
    expect(sql).toContain('SETTINGS max_memory_usage = 0, max_execution_time = 0, mutations_sync = 2');
  });
  it('drops a month partition (replace flow)', () => {
    expect(squish(ch.dropPartitionSQL('npmrds.p', '202301')))
      .toBe("ALTER TABLE npmrds.p DROP PARTITION '202301'");
  });
  it('drops a table if exists', () => {
    expect(squish(ch.dropTableSQL('temp.meta_55_2023')))
      .toBe('DROP TABLE IF EXISTS temp.meta_55_2023');
  });
});

describe('insertIntoChMetaSQL (tmc_identification FULL OUTER JOIN temp enrichment)', () => {
  const sql = squish(ch.insertIntoChMetaSQL({
    metaTableName: 'npmrds_meta.s9_v10_t_tmc_meta',
    metaTName: 'npmrds_raw_tmc_identification.s3_v5_tmcid',
    tempMetaViewTable: 'meta_5_2023',
  }));
  it('inserts DISTINCT rows from the FULL OUTER JOIN of tmc_id and temp tables', () => {
    expect(sql).toContain('INSERT INTO npmrds_meta.s9_v10_t_tmc_meta');
    expect(sql).toContain('SELECT DISTINCT *');
    expect(sql).toContain('FROM npmrds_raw_tmc_identification.s3_v5_tmcid t1');
    expect(sql).toContain('FULL OUTER JOIN temp.meta_5_2023 t2 ON t1.tmc = t2.tmc');
    expect(sql).toContain('COALESCE(t1.tmc, t2.tmc) AS tmc');
  });
  it('computes avg_vehicle_occupancy with the FHWA factors incl. the NYC ua 63217 special case', () => {
    expect(sql).toContain("1.7 * (t1.aadt - (COALESCE(t1.aadt_combi, 0) + COALESCE(t1.aadt_singl, 0)))");
    expect(sql).toContain("CASE ua_code WHEN '63217' THEN 16.8::DOUBLE PRECISION ELSE 10.7::DOUBLE PRECISION END");
    expect(sql).toContain('1 * COALESCE(t1.aadt_combi, 0)');
  });
  it('leaves avg_speedlimit and mpo_code NULL at this stage', () => {
    expect(sql).toContain('NULL AS avg_speedlimit');
    expect(sql).toContain('NULL as mpo_code');
  });
  it('computes is_interstate exactly as legacy (f_system 1 + faciltype + nhs + urban_code)', () => {
    expect(sql).toContain(
      'case when ((t1.f_system = 1) AND (t1.faciltype::int IN (1, 2, 6)) AND '
      + '(t1.nhs::int IN (1, 2, 3, 4, 5, 6, 7, 8, 9)) AND (t1.urban_code::int > 0)) then true else false end'
    );
  });
  it('keeps the legacy WHERE filter (non-null state/county/country/tmc, year > 2000)', () => {
    expect(sql).toContain(
      "WHERE state IS NOT NULL AND county IS NOT NULL AND country IS NOT NULL AND tmc IS NOT NULL AND tmc != '' AND year > 2000"
    );
  });
});

describe('tmcIdEnrichmentSelectSQL (feed for the temp enrichment table)', () => {
  it('selects tmc, year-from-active_start_date, state/county/ua aliases', () => {
    const sql = squish(ch.tmcIdEnrichmentSelectSQL('npmrds_raw_tmc_identification.s3_v5_t'));
    expect(sql).toContain('substring(active_start_date, 1, 4) as year');
    expect(sql).toContain('state as state_name');
    expect(sql).toContain('county as county_name');
    expect(sql).toContain('urban_code as ua_code');
    expect(sql).toContain('FROM npmrds_raw_tmc_identification.s3_v5_t');
  });
});

describe('selectMetaYearSQL / tmcListSQL / tmcMetaQuerySQL', () => {
  it('selects all meta rows for one year', () => {
    expect(squish(ch.selectMetaYearSQL('npmrds_meta.m', 2023)))
      .toBe('SELECT * FROM npmrds_meta.m WHERE year = 2023');
  });
  it('lists distinct tmcs in the prod table for the year', () => {
    const sql = squish(ch.tmcListSQL({ dataTable: 'npmrds.p', year: 2023 }));
    expect(sql).toContain('distinct(tmc)');
    expect(sql).toContain('FROM npmrds.p');
    expect(sql).toContain('EXTRACT(YEAR from date) = 2023');
  });
  it('fetches miles + FREEWAY/NONFREEWAY class for one tmc (f_system <= 2 boundary)', () => {
    const sql = squish(ch.tmcMetaQuerySQL({ metaTName: 'tmcid.t', tmc: '104+04099' }));
    expect(sql).toContain("(CASE WHEN f_system <= 2 THEN 'FREEWAY' ELSE 'NONFREEWAY' END) as functionalClass");
    expect(sql).toContain('miles');
    expect(sql).toContain("tmc = '104+04099'");
  });
});

describe('binnedDataSQL (15-min binned travel times — directionality input)', () => {
  const sql = squish(ch.binnedDataSQL({
    dataTable: 'npmrds.s1_v2_t',
    year: 2023,
    tmc: '104+04099',
    npmrdsDataKey: 'travel_time_all_vehicles',
    hours: [6, 7, 8, 9],
    dow: [1, 2, 3, 4, 5],
    timeBinSize: 15,
  }));
  it('bins epochs into 15-minute buckets (3 epochs per bin, 12 epochs per hour)', () => {
    expect(sql).toContain('FLOOR(epoch::NUMERIC / 3::NUMERIC)::SMALLINT AS "timeBinNum"');
    expect(sql).toContain('FLOOR(epoch::NUMERIC / 12::NUMERIC)::SMALLINT in (6,7,8,9)');
  });
  it('averages only positive values (legacy NULL-out of zeros)', () => {
    expect(sql).toContain('AVG(CASE WHEN travel_time_all_vehicles > 0 THEN travel_time_all_vehicles ELSE NULL END)');
  });
  it('filters by ISO day-of-week and year', () => {
    expect(sql).toContain('toDayOfWeek(date, 2) in (1,2,3,4,5)');
    expect(sql).toContain('EXTRACT(YEAR from date) = 2023');
    expect(sql).toContain("tmc = '104+04099'");
  });
  it('groups by tmc, date, bin', () => {
    expect(sql).toContain('GROUP BY tmc, date, FLOOR(epoch::NUMERIC / 3::NUMERIC)::SMALLINT');
  });
});

describe('confirmRemovedSQL (replace flow double-check)', () => {
  it('selects distinct view_id for the removed ids', () => {
    const sql = squish(ch.confirmRemovedSQL({ prodTable: 'npmrds.p', viewIds: [7, 9] }));
    expect(sql).toContain('SELECT DISTINCT view_id FROM npmrds.p WHERE view_id IN (7,9)');
  });
});
