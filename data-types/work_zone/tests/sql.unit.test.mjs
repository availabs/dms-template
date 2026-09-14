/**
 * Unit tests for the work_zone SQL builders' two cross-cutting conventions.
 *
 * Both exist because they broke in production once:
 *
 *  - The **vintage label** was applied by a hand-run UPDATE, so a re-run
 *    published a view with `version = NULL`. Worse, the label's partial-year
 *    form is load-bearing: the phase-1 report's seasonality was computed with a
 *    `vintage <> 'CY2026'` filter that did not match
 *    `'CY2026 (partial to 2026-08-31)'`, and eight months of 2026 were averaged
 *    in against nine full years.
 *  - The **window delete** used `<= end::date`, which is midnight on the end
 *    day, so every row later than 00:00:00 on the last day survived a re-run
 *    and was then inserted again.
 *
 * Pure module: no DB, no CH, no network.
 */
import { describe, it, expect } from 'vitest';
import sql from '../sql.js';

const { vintageVersion, deleteWindowSQL } = sql;

describe('vintageVersion', () => {
  it('labels a full calendar year', () => {
    expect(vintageVersion({ startDate: '2024-01-01', endDate: '2024-12-31' })).toBe('CY2024');
  });

  it('names the cut-off when the window stops short of 31 December', () => {
    expect(vintageVersion({ startDate: '2026-01-01', endDate: '2026-08-31' }))
      .toBe('CY2026 (partial to 2026-08-31)');
  });

  it('takes the year from the START of the window', () => {
    // A window that runs into the next year is still that year's vintage; using
    // the end date would file it under the wrong year entirely.
    expect(vintageVersion({ startDate: '2024-01-01', endDate: '2025-01-15' })).toBe('CY2024');
  });

  it('tolerates full timestamps, not just dates', () => {
    expect(vintageVersion({ startDate: '2024-01-01 00:00:00', endDate: '2024-12-31 23:59:59' }))
      .toBe('CY2024');
  });

  it('is stable across repeated calls for the same window', () => {
    // The label is the view's identity in the series; it must not depend on when
    // the run happened.
    const a = vintageVersion({ startDate: '2022-01-01', endDate: '2022-12-31' });
    const b = vintageVersion({ startDate: '2022-01-01', endDate: '2022-12-31' });
    expect(a).toBe(b);
  });
});

describe('metadata.columns covers every physical column', () => {
  // The bug this catches: `window_source` was added to the DDL and to the insert
  // list but not to the descriptor list, so the physical column existed, carried
  // data, and was invisible to the Table page and every UDA surface. Two lists
  // describing one table will drift; this makes the drift a test failure.
  const cases = [
    ['wz_speed', sql.WZ_SPEED_COLUMNS, sql.WZ_SPEED_TABLE_COLUMNS],
    ['wz_delay', sql.WZ_DELAY_COLUMNS, sql.WZ_DELAY_TABLE_COLUMNS],
    ['wz_exposure', sql.WZ_EXPOSURE_COLUMNS, sql.WZ_EXPOSURE_TABLE_COLUMNS],
    ['wz_event_tmc', sql.WZ_EVENT_TMC_COLUMNS, sql.WZ_EVENT_TMC_TABLE_COLUMNS],
    ['wz_event', sql.WZ_EVENT_COLUMNS, sql.WZ_EVENT_TABLE_COLUMNS],
  ];

  for (const [name, insertCols, descriptors] of cases) {
    it(`${name}: every inserted column has a metadata descriptor`, () => {
      const described = new Set(descriptors.map((c) => c.name));
      const missing = insertCols.filter((c) => !described.has(c));
      expect(missing).toEqual([]);
    });

    it(`${name}: every descriptor names a real column, in insert order`, () => {
      // A descriptor for a column that does not exist renders an empty column.
      // Phase-6 placeholders on wz_speed are the deliberate exception — they are
      // in the DDL but not yet inserted — so they are named rather than skipped
      // wholesale.
      const phase6 = new Set(['approach_tmc', 'approach_speed', 'differential_approach',
                              'differential_baseline', 'exceeds_differential']);
      const inserted = new Set(insertCols);
      const orphans = descriptors.map((c) => c.name)
        .filter((n) => !inserted.has(n) && !phase6.has(n));
      expect(orphans).toEqual([]);
    });
  }
});

describe('deleteWindowSQL', () => {
  const stmt = deleteWindowSQL({
    table: 'wz_event', dateColumn: 'first_start',
    startDate: '2024-01-01', endDate: '2024-12-31',
  });

  it('is half-open to end + 1 day, not inclusive of the end date', () => {
    expect(stmt).toMatch(/first_start >= '2024-01-01'/);
    expect(stmt).toContain("+ INTERVAL '1 day'");
    // The bug: `<= '2024-12-31'::date` is midnight, so 31 December's rows stayed.
    expect(stmt).not.toMatch(/first_start <= '2024-12-31'::date/);
  });

  it('deletes from the schema-qualified table', () => {
    expect(stmt).toMatch(/DELETE FROM work_zone\.wz_event/);
  });
});

describe('SQL template literals contain no backticks', () => {
  // This bug shipped FOUR times in one phase: a backtick inside a `-- ...` SQL
  // comment closes the JavaScript template literal it lives in, and the module
  // stops parsing. It is invisible on review because the comment reads fine.
  // SQL comment lines only ever occur inside these template literals, so a
  // backtick on one is always this mistake.
  const files = ['sql.js', 'ch.js', 'lib/baseline.js'];

  for (const rel of files) {
    it(`${rel} has no backtick on a SQL comment line`, async () => {
      const { readFileSync } = await import('node:fs');
      const { fileURLToPath } = await import('node:url');
      const { dirname, join } = await import('node:path');
      const here = dirname(fileURLToPath(import.meta.url));
      const src = readFileSync(join(here, '..', rel), 'utf8');
      const offenders = src.split('\n')
        .map((line, i) => ({ line, n: i + 1 }))
        .filter(({ line }) => /^\s*--/.test(line) && line.includes('`'))
        .map(({ line, n }) => `${rel}:${n} ${line.trim()}`);
      expect(offenders).toEqual([]);
    });
  }
});
