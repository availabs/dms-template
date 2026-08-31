/**
 * One view per year, and every view of the source column-identical.
 *
 * `metadata.columns` lives on the SOURCE, so a single column list describes every view of it (see
 * data-types/CLAUDE.md § "ALL VIEWS OF A SOURCE MUST HAVE EXACTLY THE SAME COLUMNS"). A source is
 * the unit of schema; a view is the unit of vintage. That is what makes one-view-per-year legal in
 * the first place, and it is only true if the generator cannot produce two different column lists.
 *
 * These tests pin that as a property of the GENERATOR rather than of one output: the column list is
 * asserted to be independent of the year, of the number of years, of which metrics a run computes,
 * and of anything read from a database. worker.integration.js asserts the same thing against the SQL
 * two real per-year publishes emit; here it is asserted where it is decided.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const worker = require('../worker.js');
const {
  META_COLUMNS,
  ERA_COLUMNS,
  buildPm3ViewSql,
  buildPm3UnionViewSql,
  pm3ViewColumnNames,
} = require('../helpers.js');

const {
  pm3MetricColumnNames,
  buildPm3SourceColumns,
  buildMetricConfigs,
  metricsTableName,
  yearTableName,
  unionTableName,
  pickUnionMemberViews,
  UNION_VERSION,
} = worker;

const CFG = buildMetricConfigs({ chMetaTableName: 'npmrds_meta.tmc_meta' });
const YEARS = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

/**
 * The output column names of a pm3 view's SQL, in relation order, parsed back out of the DDL.
 *
 * Parsed rather than taken from pm3ViewColumnNames on purpose: the point is to check what the
 * builder EMITS, not what it advertises. (view-sql.unit.test.mjs checks the two agree in arity;
 * this checks they agree name by name, across years.)
 */
function emittedColumns(sql) {
  const branch = sql.slice(sql.indexOf('SELECT') + 6, sql.indexOf('FROM pm3.'));
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of branch) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
  }
  parts.push(cur);
  return parts.map((part) => {
    const aliased = /\sAS\s+"([^"]+)"\s*$/i.exec(part);
    if (aliased) return aliased[1];
    const bare = /"([^"]+)"\s*$/.exec(part);
    return bare ? bare[1] : part.trim();
  });
}

const viewSqlFor = (year, metricColumns = pm3MetricColumnNames(CFG)) => buildPm3ViewSql({
  viewName: `pm3.s2135_v9000_pm3_${year}`,
  metricsTable: `pm3.s2135_v9000_pm3_${year}_metrics`,
  metaTableByYear: { [year]: `npmrds_geometry.s582_v${year}_geo` },
  metricColumns,
});

describe('the column list is a pure function of the metric registry', () => {
  it('does not depend on the year: nine years, one identical ordered column list', () => {
    const lists = YEARS.map((y) => emittedColumns(viewSqlFor(y)));
    for (const list of lists) expect(list).toEqual(lists[0]);
  });

  it('emits exactly what pm3ViewColumnNames advertises, name for name', () => {
    // view-sql.unit.test.mjs pins the ARITY; this pins the names and their positions, which is what
    // a positional UNION ALL and the source's single metadata.columns both depend on.
    const declared = pm3ViewColumnNames({ metricColumns: pm3MetricColumnNames(CFG) });
    expect(emittedColumns(viewSqlFor(2025))).toEqual(declared);
  });

  it('is ogc_fid, the meta columns, the metric columns, then the era tags', () => {
    expect(emittedColumns(viewSqlFor(2025))).toEqual([
      'ogc_fid', ...META_COLUMNS, ...pm3MetricColumnNames(CFG), ...ERA_COLUMNS.map((c) => c.name),
    ]);
  });

  it('declares ogc_fid as the index column — map popups resolve attributes by it', () => {
    const ogc = buildPm3SourceColumns(CFG).find((c) => c.name === 'ogc_fid');
    expect(ogc, 'ogc_fid must be declared or dataById falls back to a non-existent "id" column').toBeTruthy();
    expect(ogc.isIndex).toBe(true);
    // First, so the declared order matches the view's own column order.
    expect(buildPm3SourceColumns(CFG)[0].name).toBe('ogc_fid');
  });

  it('matches the SOURCE metadata.columns the runner writes, position by position', () => {
    // The one list every column-aware consumer reads. If the view and this disagree, columns render
    // empty or vanish — silently, with no error anywhere.
    const declared = buildPm3SourceColumns(CFG).map((c) => c.name);
    // Now a FULL match including ogc_fid, which metadata.columns previously omitted as "the physical
    // row id, not published data". It has to be declared: the published relation is a VIEW, so it has
    // no PRIMARY KEY, and uda's resolvePrimaryKey falls back to 'id' — a column no pm3 view has —
    // which broke every map popup's attribute fetch. `isIndex` on ogc_fid is what overrides that.
    expect(emittedColumns(viewSqlFor(2025))).toEqual(declared);
  });

  it('is deduplicated and free of the join key and meta columns', () => {
    const metricCols = pm3MetricColumnNames(CFG);
    expect(new Set(metricCols).size).toBe(metricCols.length);
    for (const c of ['ogc_fid', ...META_COLUMNS]) expect(metricCols).not.toContain(c);
  });

  it('does not change when a run SKIPS a metric — skipping computes less, not fewer columns', () => {
    // skipSpeedPctl narrows the COMPUTE set only. Dropping the 8 speed_pctl columns from that year's
    // view would give it a different column set from every other year's, and because
    // metadata.columns lives on the source the Table page would still apply the full list to it.
    const full = pm3MetricColumnNames(CFG);
    const withChMetaMissing = pm3MetricColumnNames(buildMetricConfigs({ chMetaTableName: null }));
    expect(withChMetaMissing).toEqual(full);
    for (const p of [5, 50, 95]) expect(withChMetaMissing).toContain(`speed_pctl_${p}`);
  });

  it('grows only by APPENDING when a metric is added — existing positions never shift', () => {
    // A source is the unit of schema, so adding a metric means a NEW SOURCE. This asserts the
    // weaker, still useful property that the generator is stable under addition: the diff against
    // an older registry is a suffix, so a live view's columns cannot be silently renumbered by a
    // registry edit that was meant to be additive.
    const { ted_truck_freeflow_relative, ...withoutOne } = CFG;
    const shorter = pm3MetricColumnNames(withoutOne);
    const full = pm3MetricColumnNames(CFG);
    expect(full.slice(0, shorter.length)).toEqual(shorter);
  });
});

describe('per-year view and metrics table naming', () => {
  it('puts the year in the table name — createDamaView names every view of a source the same', () => {
    expect(yearTableName('s2135_v3739_pm3_v6', 2024)).toBe('s2135_v3739_pm3_v6_2024');
  });

  it('keeps <table>_metrics inside Postgres’s 63-char identifier limit', () => {
    // Postgres truncates silently, which would collapse two years into one table name. The base can
    // legitimately reach 58 chars (18-char s/v prefix + createDamaView’s 40-char slug cap).
    const base = 's9999999_v9999999_' + 'x'.repeat(40);
    expect(base.length).toBe(58);
    for (const year of YEARS) {
      const t = yearTableName(base, year);
      expect(metricsTableName(t).length).toBeLessThanOrEqual(63);
      expect(t.endsWith(`_${year}`)).toBe(true);
    }
    expect(metricsTableName(unionTableName(base)).length).toBeLessThanOrEqual(63);
  });

  it('gives different years different names even after truncation', () => {
    const base = 's9999999_v9999999_' + 'x'.repeat(40);
    const names = new Set(YEARS.map((y) => yearTableName(base, y)));
    expect(names.size).toBe(YEARS.length);
  });
});

describe('all_years union view membership', () => {
  // The 4-digit-version filter is what keeps non-year views out of the union automatically.
  const VIEWS = [
    { view_id: 3731, version: '' },                 // legacy multi-year view, redundant since the split
    { view_id: 3732, version: '2017' },
    { view_id: 3739, version: '2024' },
    { view_id: 3740, version: '2025' },
    { view_id: 3741, version: UNION_VERSION },      // the union view itself
    { view_id: 3750, version: '2025' },             // a republished 2025
    { view_id: 3751, version: null },
  ];

  it('takes one view per year, newest wins, ascending', () => {
    expect(pickUnionMemberViews(VIEWS)).toEqual([
      { view_id: 3732, version: '2017' },
      { view_id: 3739, version: '2024' },
      { view_id: 3750, version: '2025' },
    ]);
  });

  it('excludes the union view itself and every non-year version, with no hand-maintained list', () => {
    const ids = pickUnionMemberViews(VIEWS).map((v) => v.view_id);
    expect(ids).not.toContain(3741); // all_years
    expect(ids).not.toContain(3731); // legacy multi-year
    expect(ids).not.toContain(3751); // null version
  });

  it('is empty rather than throwing when a source has no per-year views', () => {
    expect(pickUnionMemberViews([])).toEqual([]);
    expect(pickUnionMemberViews([{ view_id: 1, version: UNION_VERSION }])).toEqual([]);
  });

  it('unions members positionally, one branch each, in the order given', () => {
    const sql = buildPm3UnionViewSql({
      viewName: 'pm3.s2135_v3741_all_years',
      memberTables: ['pm3.a_2023', 'pm3.b_2024', 'pm3.c_2025'],
    });
    expect(sql.match(/UNION ALL/g)).toHaveLength(2);
    expect(sql.indexOf('a_2023')).toBeLessThan(sql.indexOf('b_2024'));
    expect(sql.indexOf('b_2024')).toBeLessThan(sql.indexOf('c_2025'));
    // SELECT * deliberately: the members are column-identical by construction, so re-listing the
    // columns here would be a second place for the contract to live and drift from.
    expect(sql).not.toMatch(/"/);
  });

  it('refuses to emit a union with no members', () => {
    expect(() => buildPm3UnionViewSql({ viewName: 'pm3.u', memberTables: [] }))
      .toThrow(/memberTables is empty/);
  });
});

describe('the append path is gone from the runner', () => {
  const src = require('fs').readFileSync(new URL('../worker.js', import.meta.url), 'utf8');

  it('never DELETEs from a metrics table', () => {
    // The append path opened every run with `DELETE FROM <shared metrics table> WHERE year in (...)`.
    // Its absence is what makes a failed publish unable to damage a year that already succeeded.
    expect(src).not.toMatch(/DELETE\s+FROM/i);
    expect(src).not.toMatch(/year in \(\$\{years/);
  });

  it('never merges the per-year provenance maps — the bug class that only append had', () => {
    // Both 2026-08-24 bugs were merge bugs: `metadata.year` was not merged (view 3731 advertised
    // [2024, 2025] over a table holding 2017-2025) and npmrds_meta_layer_table was REPLACED while
    // the view is REBUILT from it, which would have silently dropped published years. A view now
    // holds exactly one year, so there is nothing to merge and no fix to keep in sync.
    expect(src).not.toMatch(/mergedMetaByYear/);
    expect(src).not.toMatch(/mergedYears/);
    expect(src).not.toMatch(/existingMeta\.npmrds_meta_layer_table/);
  });

  it('refuses a descriptor that still carries view_id', () => {
    expect(src).toMatch(/task\.descriptor \|\| \{\}\)\.view_id != null/);
    expect(src).toMatch(/append path \(descriptor\.view_id\) was removed/);
  });
});
