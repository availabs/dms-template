/**
 * Unit tests for npmrds Postgres DDL + SQL builders.
 *
 * The spatial-join INSERT (generateInsertIntoPgMetaQuery in the legacy code)
 * is the most load-bearing SQL in the whole data-type: it assigns
 * avg_speedlimit (tmc_speed LEFT JOIN + year-dependent fallback) and
 * mpo_code/mpo_name (LATERAL longest-intersection join). Semantics are pinned
 * verbatim from legacy avail-falcor npmrds/queries.js + publish.route.js +
 * metadata.worker.mjs.
 */
import { describe, it, expect } from 'vitest';
import * as pg from '../pg-sql.js';

const squish = (s) => s.replace(/\s+/g, ' ').trim();

describe('TEMP_META_COLUMNS (the ORDER MATTERS 58-column contract)', () => {
  it('has exactly 58 columns in the legacy declared order', () => {
    expect(pg.TEMP_META_COLUMNS.length).toBe(58);
    expect(pg.TEMP_META_COLUMNS[0]).toBe('tmc');
    expect(pg.TEMP_META_COLUMNS[43]).toBe('congestion_level');
    expect(pg.TEMP_META_COLUMNS[56]).toBe('is_interstate');
    expect(pg.TEMP_META_COLUMNS[57]).toBe('wkb_geometry');
  });
  it('does NOT include mpo_name (only the all-years geometry table has it)', () => {
    expect(pg.TEMP_META_COLUMNS).not.toContain('mpo_name');
    expect(pg.TEMP_META_COLUMNS).toContain('mpo_code');
  });
});

describe('geometryTableDDL (PG all-years npmrds_geometry table)', () => {
  const ddl = squish(pg.geometryTableDDL({
    schema: 'npmrds_geometry',
    tableName: 's9_v11_t_geometry',
    viewId: 11,
  }));
  it('creates the table with serial PK, MultiLineString geometry, unique (tmc, year)', () => {
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS npmrds_geometry.s9_v11_t_geometry');
    expect(ddl).toContain('ogc_fid serial PRIMARY KEY');
    expect(ddl).toContain('wkb_geometry GEOMETRY(MultiLineString)');
    expect(ddl).toContain('CONSTRAINT s9_v11_t_geometry_11_unique_tmc_year UNIQUE (tmc, year)');
  });
  it('has mpo_name AND is_interstate (the all-years table keeps both)', () => {
    expect(ddl).toContain('mpo_name VARCHAR');
    expect(ddl).toContain('is_interstate BOOLEAN');
  });
});

describe('geometryIndexDDL', () => {
  it('creates the GIST index on wkb_geometry', () => {
    const ddl = squish(pg.geometryIndexDDL({
      schema: 'npmrds_geometry', tableName: 's9_v11_t_geometry', viewId: 11,
    }));
    expect(ddl).toContain('CREATE INDEX IF NOT EXISTS s9_v11_t_geometry_11_wkb_geometry_idx');
    expect(ddl).toContain('ON npmrds_geometry.s9_v11_t_geometry');
    expect(ddl).toContain('USING GIST (wkb_geometry)');
  });
});

describe('tempPgMetaTableDDL', () => {
  const ddl = squish(pg.tempPgMetaTableDDL({ table_name: 's9_v10_t_tmc_meta' }));
  it('creates temp.<meta table_name> with the 58 columns', () => {
    expect(ddl).toContain('CREATE TABLE temp.s9_v10_t_tmc_meta');
    expect(ddl).toContain('tmc VARCHAR');
    expect(ddl).toContain('f_system SMALLINT');
    expect(ddl).toContain('is_interstate BOOLEAN');
    expect(ddl).toContain('wkb_geometry GEOMETRY(MultiLineString)');
    expect(ddl).not.toContain('mpo_name');
    expect(ddl).not.toContain('ogc_fid');
  });
});

describe('toPgRowValues (CH JSONEachRow → 55-value PG row; ORDER MATTERS)', () => {
  it('coerces numerics with the legacy Number(x) || null semantics and keeps order', () => {
    const vals = pg.toPgRowValues({
      tmc: '104+04099', road: 'I-87', state: 'NEW YORK',
      start_latitude: '42.5', aadt: '120000', f_system: '1',
      year: '2023', avg_speedlimit: '0', is_interstate: true,
      wkb_geometry: '0105...',
    });
    expect(vals.length).toBe(58);
    expect(vals[0]).toBe('104+04099');                  // tmc
    expect(vals[1]).toBe('I-87');                       // road
    expect(vals[7]).toBe(42.5);                         // start_latitude → Number
    expect(vals[19]).toBe(1);                           // f_system
    expect(vals[28]).toBe(120000);                      // aadt
    expect(vals[44]).toBe(2023);                        // year
    expect(vals[45]).toBe(null);                        // avg_speedlimit: Number('0') || null → null (legacy quirk)
    expect(vals[56]).toBe(true);                        // is_interstate
    expect(vals[57]).toBe('0105...');                   // wkb_geometry
  });
  it('maps missing fields to null (never undefined — parameterized insert safety)', () => {
    const vals = pg.toPgRowValues({ tmc: 't' });
    expect(vals.every((v) => v !== undefined)).toBe(true);
  });
});

describe('insertIntoTempPgMetaSQL (parameterized batch insert)', () => {
  it('builds a multi-row VALUES insert with flattened params', () => {
    const rows = [pg.toPgRowValues({ tmc: 'a' }), pg.toPgRowValues({ tmc: 'b' })];
    const { text, values } = pg.insertIntoTempPgMetaSQL({ table_name: 'm', rows });
    expect(squish(text)).toContain('INSERT INTO temp.m (tmc, road,');
    expect(squish(text)).toContain('($1, $2,');
    expect(squish(text)).toContain(`($${58 + 1}, $${58 + 2},`);
    expect(values.length).toBe(116);
    expect(values[0]).toBe('a');
    expect(values[58]).toBe('b');
  });
});

describe('insertIntoPgMetaSQL (THE spatial-join insert — verbatim legacy semantics)', () => {
  const sql = squish(pg.insertIntoPgMetaSQL({
    data_table: 'npmrds_geometry.s9_v11_t_geometry',
    table_name: 's9_v10_t_tmc_meta',
    tmcSpeedDataTable: 'tmc_speed.s20_v21_speed',
    mpoBoundariesDataTable: 'mpo.s30_v31_bounds',
  }));
  it('inserts into the all-years geometry table from the temp table', () => {
    expect(sql).toContain('INSERT INTO npmrds_geometry.s9_v11_t_geometry');
    expect(sql).toContain('FROM temp.s9_v10_t_tmc_meta temp_meta');
  });
  it('includes mpo_name + is_interstate in the column list (59 cols: 58 + mpo_name)', () => {
    expect(sql).toContain('mpo_code, mpo_name,');
    expect(sql).toContain('is_interstate, wkb_geometry');
  });
  it('avg_speedlimit: prefer tmc_speed, fallback 20 pre-2024, f_system-based 2024+', () => {
    expect(sql).toContain(
      '(COALESCE(NULLIF(t3.avg_speedlimit, 0), (CASE WHEN temp_meta.year <= 2023 THEN 20 '
      + 'ELSE (CASE temp_meta.f_system WHEN 1 THEN 65 WHEN 2 THEN 55 WHEN 3 THEN 45 ELSE 35 END) END))) AS avg_speedlimit'
    );
  });
  it('tmc_speed join is LEFT OUTER on tmc + state_name ILIKE state', () => {
    expect(sql).toContain('LEFT OUTER JOIN tmc_speed.s20_v21_speed t3');
    expect(sql).toContain('temp_meta.tmc = t3.tmc');
    expect(sql).toContain('temp_meta.state_name ILIKE t3.state');
  });
  it('MPO join is LATERAL ON TRUE — longest geographic intersection wins', () => {
    expect(sql).toContain('JOIN LATERAL');
    expect(sql).toContain('mb.mpo_id as mpo_code');
    expect(sql).toContain('ST_length(geography( ST_intersection( mb.wkb_geometry, ST_SetSRID(temp_meta.wkb_geometry, 4326)');
    expect(sql).toContain('FROM mpo.s30_v31_bounds mb');
    expect(sql).toContain('ORDER BY mi_in_mpo desc LIMIT 1');
    expect(sql).toContain('ON TRUE');
  });
  it('keeps the legacy WHERE filter', () => {
    expect(sql).toContain('temp_meta.state IS NOT NULL');
    expect(sql).toContain("temp_meta.tmc != ''");
    expect(sql).toContain('year > 2000');
  });
});

describe('perYearLayerTableDDL (per-year tile table)', () => {
  const ddl = squish(pg.perYearLayerTableDDL({
    schema: 'npmrds_geometry',
    tableName: 's9_v40_meta_geometry',
    viewId: 40,
  }));
  it('mirrors the all-years table but WITHOUT is_interstate (legacy inconsistency, kept)', () => {
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS npmrds_geometry.s9_v40_meta_geometry');
    expect(ddl).toContain('mpo_name VARCHAR');
    expect(ddl).not.toContain('is_interstate');
    expect(ddl).toContain('CONSTRAINT s9_v40_meta_geometry_40_unique_tmc_year UNIQUE (tmc, year)');
    expect(ddl).toContain('CREATE INDEX IF NOT EXISTS s9_v40_meta_geometry_40_wkb_geometry_idx');
    expect(ddl).toContain('USING GIST (wkb_geometry)');
  });
});

describe('perYearInsertSQL (all-years → per-year copy)', () => {
  const sql = squish(pg.perYearInsertSQL({
    layerDataTable: 'npmrds_geometry.s9_v40_meta_geometry',
    geometryDataTable: 'npmrds_geometry.s9_v11_t_geometry',
    year: 2023,
  }));
  it('copies ogc_fid..wkb_geometry without is_interstate for the year', () => {
    expect(sql).toContain('INSERT INTO npmrds_geometry.s9_v40_meta_geometry');
    expect(sql).toContain('SELECT ogc_fid,');
    expect(sql).toContain('mpo_code, mpo_name,');
    expect(sql).not.toContain('is_interstate');
    expect(sql).toContain('FROM npmrds_geometry.s9_v11_t_geometry WHERE year = 2023');
  });
});

describe('setSridSQL / deleteYearSQL', () => {
  it('fixes the SRID to 4326 on the per-year table', () => {
    expect(squish(pg.setSridSQL('npmrds_geometry.x')))
      .toBe('UPDATE npmrds_geometry.x SET wkb_geometry = ST_SETSRID(wkb_geometry, 4326)');
  });
  it('deletes one year of rows', () => {
    expect(squish(pg.deleteYearSQL('npmrds_geometry.x', 2023)))
      .toBe('DELETE FROM npmrds_geometry.x WHERE year = 2023');
  });
});
