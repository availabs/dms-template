/**
 * The metrics ⋈ geometry view is what `views.table_name` resolves to, so its
 * shape IS the public contract of a pm3 view. These tests pin the parts that
 * silently break consumers if they drift:
 *   - column order and set (the UDA table page and ogr2ogr surface relation order)
 *   - the derived AADT/AVO expressions coming from pm3/lib (forked from map21), not a second copy
 *   - one UNION ALL branch per year, each joined to that year's meta table
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { readFileSync } from 'fs';

const require = createRequire(import.meta.url);
const {
  META_COLUMNS,
  JOIN_KEY_COLUMNS,
  buildPm3ViewSql,
  buildMetaSelectParts,
  pm3ViewColumnNames,
  ERA_COLUMNS,
  metaColumnType,
} = require('../helpers.js');
const { dataKeyToQueryMap } = require('../lib/helpers.js');
const { stripSqlAlias } = require('../helpers.js');

const METRICS = ['lottr_amp_lottr', 'lottr_amp_lottr_80_pct', 'speed_pctl_5', 'phed_all_xdelay_phrs'];

const build = (metaTableByYear = { 2025: 'npmrds_geometry.s582_v1312_geo' }) =>
  buildPm3ViewSql({
    viewName: 'pm3.s1410_v9999_pm_3',
    metricsTable: 'pm3.s1410_v9999_pm_3_metrics',
    metaTableByYear,
    metricColumns: METRICS,
  });

describe('buildPm3ViewSql', () => {
  it('emits ogc_fid, the 25 meta columns in order, the metric columns, then the era tags', () => {
    // Order is load-bearing: it is the column order the pre-de-duplication pm3 table had, and
    // downstream consumers (the UDA table page, ogr2ogr downloads) surface columns in relation
    // order. R9's era tags are appended so nothing existing shifts position.
    expect(pm3ViewColumnNames({ metricColumns: METRICS })).toEqual([
      'ogc_fid', ...META_COLUMNS, ...METRICS, ...ERA_COLUMNS.map((c) => c.name),
    ]);
  });

  it('era tags are emitted per year branch, as literals, and flag boundary-crossing years', () => {
    // Era is a pure function of `year`, so it is a literal in each UNION branch rather than a
    // stored column: no duplication across 52,127 rows and it cannot drift from the row's year.
    const sql = buildPm3ViewSql({
      viewName: 'pm3.v', metricsTable: 'pm3.m',
      metaTableByYear: { 2024: 'g.m2024', 2025: 'g.m2025' }, metricColumns: METRICS,
    });
    const branches = sql.split('UNION ALL');
    expect(branches).toHaveLength(2);
    // 2024 spans E6 (step down), E7 (the Aug-2024 high regime) and E8 (settled) — three eras in
    // one calendar year, so an annual 2024 figure blends three coverage regimes.
    expect(branches[0]).toContain(`'E6|E7|E8'::TEXT AS "era_all_vehicles"`);
    expect(branches[0]).toContain('TRUE::BOOLEAN AS "era_all_vehicles_crosses_boundary"');
    // 2025 sits cleanly inside E8, which is why the CY2025 measure analysis is era-clean.
    expect(branches[1]).toContain(`'E8'::TEXT AS "era_all_vehicles"`);
    expect(branches[1]).toContain('FALSE::BOOLEAN AS "era_all_vehicles_crosses_boundary"');
    // The truck stream has its own calendar: 2024 crosses no truck boundary even though it
    // crosses two all-vehicle ones.
    expect(branches[0]).toContain(`'T3'::TEXT AS "era_truck"`);
    expect(branches[0]).toContain('FALSE::BOOLEAN AS "era_truck_crosses_boundary"');
  });

  it('SELECT list length matches the declared output columns', () => {
    // Guards the SQL builder against silently emitting a different arity than
    // pm3ViewColumnNames advertises.
    const declared = pm3ViewColumnNames({ metricColumns: METRICS });
    const firstBranch = build().split('FROM pm3.')[0];
    const selectList = firstBranch.slice(firstBranch.indexOf('SELECT') + 6);
    // top-level commas only — the derived expressions contain nested commas
    let depth = 0, parts = 1;
    for (const ch of selectList) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (ch === ',' && depth === 0) parts++;
    }
    expect(parts).toBe(declared.length);
  });

  it('reuses lib/helpers dataKeyToQueryMap arithmetic for the three derived columns', () => {
    const sql = build();
    for (const key of ['directionalAadt', 'directionalAadtTruck', 'avgVehicleOccupancyTruck']) {
      expect(dataKeyToQueryMap[key]).toBeTruthy();
      // alias stripped so the expression can be re-cast, arithmetic untouched
      expect(sql).toContain(stripSqlAlias(dataKeyToQueryMap[key]));
    }
  });

  it('routes EVERY numeric cast through TEXT (float8 shortest round-trip)', () => {
    // See NUMERIC_CAST_NOTE in helpers.js: a direct float8->numeric cast loses
    // the 16th significant digit, so the view would disagree with what the
    // legacy worker wrote. Applies to the derived columns AND to passthroughs
    // that are double precision upstream (miles, avg_vehicle_occupancy).
    const sql = build();
    for (const col of ['directionalaadt', 'directionalaadttruck', 'avgvehicleoccupancytruck',
                       'miles', 'avg_vehicle_occupancy', 'nhs_pct', 'f_system', 'nhs']) {
      expect(metaColumnType(col)).toBe('NUMERIC');
      expect(sql).toContain(`)::TEXT::NUMERIC AS "${col}"`);
    }
    // TEXT columns take a plain cast — no TEXT::TEXT noise
    expect(sql).not.toMatch(/::TEXT::TEXT/);
  });

  it('aliases the meta table t1 — those expressions require that alias', () => {
    // dataKeyToQueryMap's aadtTruck references t1.aadt_combi / t1.aadt_singl.
    expect(build()).toMatch(/JOIN npmrds_geometry\.s582_v1312_geo t1\b/);
  });

  it('joins on BOTH tmc and year so a multi-year meta table cannot fan out rows', () => {
    expect(build()).toMatch(/ON t1\.tmc = m\."tmc" AND t1\.year = m\."year"/);
  });

  it('passes wkb_geometry through uncast so PostGIS keeps the typmod', () => {
    const parts = buildMetaSelectParts();
    expect(parts).toContain('t1."wkb_geometry"');
    expect(build()).not.toMatch(/wkb_geometry"::GEOMETRY/);
  });

  it('types metricsource as TEXT, matching the legacy materialized table', () => {
    // It is NOT in NUMERIC_META_COLUMNS: the legacy table stored TEXT even
    // though the worker inserted the number 1. A NUMERIC constant here would
    // change what UDA filters see.
    expect(metaColumnType('metricsource')).toBe('TEXT');
    expect(build()).toContain(`('1')::TEXT AS "metricsource"`);
    expect(build()).toContain(`('')::TEXT AS "comments"`);
  });

  it('takes tmc and year from the metrics table, everything else from the join', () => {
    const parts = buildMetaSelectParts();
    for (const [i, col] of META_COLUMNS.entries()) {
      if (JOIN_KEY_COLUMNS.includes(col)) expect(parts[i]).toBe(`m."${col}"`);
      else expect(parts[i]).not.toMatch(/^m\./);
    }
  });

  it('emits one UNION ALL branch per year, each with its own meta table', () => {
    const sql = build({
      2024: 'npmrds_geometry.s582_v1232_geo',
      2025: 'npmrds_geometry.s582_v1312_geo',
    });
    expect(sql.match(/UNION ALL/g)).toHaveLength(1);
    expect(sql).toMatch(/JOIN npmrds_geometry\.s582_v1232_geo t1[\s\S]*WHERE m\."year" = 2024/);
    expect(sql).toMatch(/JOIN npmrds_geometry\.s582_v1312_geo t1[\s\S]*WHERE m\."year" = 2025/);
    // ascending year order, so branch order is deterministic across runs
    expect(sql.indexOf('= 2024')).toBeLessThan(sql.indexOf('= 2025'));
  });

  it('throws rather than emitting a view with no branches', () => {
    expect(() => build({})).toThrow(/metaTableByYear is empty/);
  });
});

describe('createDamaView call shape', () => {
  it('never passes etl_context_id — views_etl_ctx_id_fkey points at legacy etl_contexts', () => {
    // Regression guard for the live failure on npmrds2 (2026-08-07): a
    // new-runner task_id has no data_manager.etl_contexts row, so the view
    // INSERT fails the FK. The task id belongs in metadata instead.
    const src = readFileSync(new URL('../worker.js', import.meta.url), 'utf8');
    const call = src.slice(src.indexOf('deps.createDamaView('), src.indexOf('}, pgEnv);'));
    expect(call).not.toMatch(/^\s*etl_context_id:/m);
    expect(call).toMatch(/task_id: task\.task_id/);
  });
});
