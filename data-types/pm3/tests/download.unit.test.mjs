/**
 * pm3's download adapter, and the three capabilities it needs from the SHARED worker.
 *
 * Two halves, both driven without a database, a task queue or ogr2ogr:
 *
 *   1. `data-types/pm3/download.js` — the pure translation: geography chips → SQL, selection →
 *      file name, request → cache key.
 *   2. `dama/upload/workers/create-download.js` — the contract pm3 now depends on: `where` is
 *      validated before ogr2ogr runs, `downloadKey` decides the `metadata.download` key, and the
 *      metadata write MERGES rather than replaces. These are asserted here (with a stub `db`)
 *      rather than in the dms-server suite because this is the suite that runs in the default
 *      `npx vitest run data-types` bar, and pm3 is what breaks if any of the three regress.
 *
 * The route-level behaviour (descriptor shape, 400s/404s, the task row) lives in
 * tests/download.integration.js, which needs the sqlite harness.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  buildGeographyWhere,
  geographyToken,
  buildDownloadFileNameBase,
  deriveDownloadKey,
  SUPPORTED_FILE_TYPES,
  WORKER_PATH,
} = require('../download.js');
const createDownload = require('@availabs/dms-server/src/dama/upload/workers/create-download');
const { sanitizeFileName, downloadKeyFor, writeExtraFiles, runZip } = createDownload;
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

// A macroview geography chip: `type` IS the source column, `value` the raw column value.
const chip = (type, value) => ({ name: `${type} ${value}`, label: `${type} ${value}`, value, type });

const DECLARED = new Set([
  'ogc_fid', 'tmc', 'county', 'region_code', 'mpo_name', 'urban_code', 'wkb_geometry', 'year',
  'lottr_amp_lottr',
]);

describe('buildGeographyWhere — the chips the map is filtered by, as SQL', () => {
  it('statewide is no clause at all', () => {
    expect(buildGeographyWhere([], DECLARED)).toBe(null);
    expect(buildGeographyWhere(undefined, DECLARED)).toBe(null);
    expect(buildGeographyWhere(null, DECLARED)).toBe(null);
  });

  it('one family is an IN list on that column', () => {
    expect(buildGeographyWhere([chip('region_code', '8')], DECLARED))
      .toBe(`"region_code" IN ('8')`);
    expect(buildGeographyWhere([chip('county', 'ALBANY'), chip('county', 'ERIE')], DECLARED))
      .toBe(`"county" IN ('ALBANY', 'ERIE')`);
  });

  it('duplicate chips do not duplicate values', () => {
    expect(buildGeographyWhere([chip('county', 'ALBANY'), chip('county', 'ALBANY')], DECLARED))
      .toBe(`"county" IN ('ALBANY')`);
  });

  it('two families are OR-ed, matching the map\'s filterMode "any"', () => {
    // buildLayerUdaFilterOptions turns filterMode "any" into {op:'OR'}, and the panel row count
    // the builder prints on its own button comes from that same envelope. Measured on view 3740:
    // region 8 = 8,016 rows, Albany County = 1,274, the OR = 9,290. ANDing would give 0.
    expect(buildGeographyWhere([chip('region_code', '8'), chip('county', 'ALBANY')], DECLARED))
      .toBe(`("region_code" IN ('8') OR "county" IN ('ALBANY'))`);
  });

  it('quotes in a value are doubled, not injected', () => {
    expect(buildGeographyWhere([chip('county', "ST MARY'S")], DECLARED))
      .toBe(`"county" IN ('ST MARY''S')`);
  });

  it('keeps spaces — "Ulster County Transportation Council" is a real mpo_name', () => {
    expect(buildGeographyWhere([chip('mpo_name', 'Ulster County Transportation Council')], DECLARED))
      .toBe(`"mpo_name" IN ('Ulster County Transportation Council')`);
  });

  it('refuses a column the source does not declare', () => {
    expect(() => buildGeographyWhere([chip('drop_table', 'x')], DECLARED))
      .toThrow(/not a column of this source/);
  });

  it('refuses a chip with no type or no value', () => {
    expect(() => buildGeographyWhere([{ value: 'x' }], DECLARED)).toThrow(/missing `type`/);
    expect(() => buildGeographyWhere([chip('county', '')], DECLARED)).toThrow(/has no value/);
  });

  it('a NUL byte is refused rather than smuggled into a literal', () => {
    expect(() => buildGeographyWhere([chip('county', `A\u0000B`)], DECLARED)).toThrow(/NUL/);
  });
});

describe('the file name carries the selection', () => {
  const base = {
    sourceName: 'pm3_v6_e6anchor_2017_2025', source_id: 2135, view_id: 3740, version: '2025',
  };

  it('statewide says so', () => {
    expect(buildDownloadFileNameBase({ ...base, geographyFilter: [] }))
      .toBe('pm3_v6_e6anchor_2017_2025_s2135_v3740_2025_statewide');
  });

  it('measure, year and geography all appear', () => {
    const name = buildDownloadFileNameBase({
      ...base,
      measure: 'lottr_amp_lottr',
      geographyFilter: [chip('region_code', '8')],
      downloadKey: 'deadbeefcafe',
    });
    expect(name).toContain('2025');
    expect(name).toContain('lottr_amp_lottr');
    expect(name).toContain('region_code-8');
    // …plus a short hash, so two subsets of one view are two files rather than one.
    expect(name.endsWith('_deadbeef')).toBe(true);
  });

  it('a long geography selection is counted, not listed', () => {
    expect(geographyToken(['A', 'B', 'C', 'D'].map((v) => chip('county', v)))).toBe('county-4sel');
    expect(geographyToken([chip('county', 'ALBANY'), chip('region_code', '8')]))
      .toBe('county-ALBANY_region_code-8');
    expect(geographyToken([])).toBe('statewide');
  });
});

describe('deriveDownloadKey — the fallback when a caller sends no hash', () => {
  const req = { view_id: 3740, columns: ['tmc', 'county'], where: null, fileType: 'CSV' };

  it('is a stable sha256 over the request', () => {
    expect(deriveDownloadKey(req)).toMatch(/^[0-9a-f]{64}$/);
    expect(deriveDownloadKey(req)).toBe(deriveDownloadKey(req));
  });

  it('does not depend on the order the columns arrive in', () => {
    expect(deriveDownloadKey({ ...req, columns: ['county', 'tmc'] })).toBe(deriveDownloadKey(req));
  });

  it('a different subset, geography or format is a different key', () => {
    expect(deriveDownloadKey({ ...req, columns: ['tmc'] })).not.toBe(deriveDownloadKey(req));
    expect(deriveDownloadKey({ ...req, where: `"county" IN ('ALBANY')` })).not.toBe(deriveDownloadKey(req));
    expect(deriveDownloadKey({ ...req, fileType: 'GPKG' })).not.toBe(deriveDownloadKey(req));
  });
});

describe('the pm3 route delegates rather than forking the pipeline', () => {
  it('names the shared worker', () => {
    expect(WORKER_PATH).toBe('gis/create-download');
  });

  it('offers CSV · GPKG · Shapefile, and nothing else', () => {
    expect(SUPPORTED_FILE_TYPES).toEqual(['CSV', 'GPKG', 'ESRI Shapefile']);
  });

  it('refuses GeoJSON — pm3 policy, enforced at pm3\'s route', () => {
    // Stated by Alex 2026-08-24. The SHARED worker still lists GeoJSON in OUTPUT_TYPES and other
    // datatypes may use it; this is a pm3 rule, so it lives here and not in the pipeline. Pinned
    // so it cannot drift back in as a "harmless" addition to the array above.
    expect(SUPPORTED_FILE_TYPES).not.toContain('GeoJSON');
    expect(createDownload).toBeTruthy();
  });

  it('refuses json — nothing produces it', () => {
    // ogr2ogr has no plain-JSON driver, so `json` would need a second writer in the worker. The
    // download builder no longer draws the control at all, so this is the backstop for a
    // hand-written request rather than a UI that can reach it.
    expect(SUPPORTED_FILE_TYPES).not.toContain('json');
    expect(SUPPORTED_FILE_TYPES).not.toContain('JSON');
  });
});

// ── the three capabilities the shared worker gained ──────────────────────────────────────
const viewRow = {
  source_name: 'pm3_v6', version: '2025',
  data_table: 'pm3.s2135_v3740_pm3_v6_2025',
  table_schema: 'pm3', table_name: 's2135_v3740_pm3_v6_2025',
};

/** A `db` that answers the view lookup and records everything else. */
function stubDb({ failWhere = false } = {}) {
  const queries = [];
  return {
    type: 'postgres',
    queries,
    async query(sql, params) {
      queries.push({ sql, params });
      if (/FROM data_manager\.sources/.test(sql)) return { rows: [viewRow] };
      if (failWhere && / WHERE /.test(sql)) throw new Error('column "nope" does not exist');
      return { rows: [] };
    },
  };
}
const noopCtx = (db, descriptor) => ({
  task: { descriptor }, pgEnv: 'npmrds2', db,
  dispatchEvent: async () => {}, updateProgress: async () => {},
});

describe('create-download worker: `where`', () => {
  it('is validated against the relation before ogr2ogr is spawned', async () => {
    // ogr2ogr pushes `-where` down to Postgres verbatim and `-skipfailures` swallows the error:
    // measured on view 3740, `-where '"region_code" IN (8)'` exits 0 and leaves a header-only
    // CSV. A download that is silently empty is worse than a task that failed.
    const db = stubDb();
    await createDownload(noopCtx(db, {
      source_id: 2135, view_id: 3740, fileTypes: ['NOT_A_FORMAT'], columns: ['tmc'],
      where: `"region_code" IN ('8')`,
    }));
    const probe = db.queries.find((q) => /SELECT 1 FROM pm3\./.test(q.sql));
    expect(probe).toBeTruthy();
    expect(probe.sql).toContain(`WHERE "region_code" IN ('8')`);
    expect(probe.sql).toContain('LIMIT 1');
  });

  it('makes the task fail loudly when the database rejects it', async () => {
    await expect(createDownload(noopCtx(stubDb({ failWhere: true }), {
      source_id: 2135, view_id: 3740, fileTypes: ['CSV'], columns: ['tmc'],
      where: `"nope" IN ('x')`,
    }))).rejects.toThrow(/invalid `where`/);
  });

  it('is not probed at all when absent', async () => {
    const db = stubDb();
    await createDownload(noopCtx(db, {
      source_id: 2135, view_id: 3740, fileTypes: ['NOT_A_FORMAT'], columns: ['tmc'],
    }));
    expect(db.queries.some((q) => /SELECT 1 FROM/.test(q.sql))).toBe(false);
  });
});

describe('create-download worker: `downloadKey`', () => {
  it('one format files the run under the caller\'s key verbatim', () => {
    // The macroview polls `metadata.download[hash(fileNameBase)]`. Filing under the fileType —
    // the old behaviour — meant the poll could never resolve.
    expect(downloadKeyFor('a'.repeat(64), 'CSV', 1)).toBe('a'.repeat(64));
  });

  it('several formats in one run get one entry each', () => {
    expect(downloadKeyFor('hash', 'CSV', 2)).toBe('hash_CSV');
    expect(downloadKeyFor('hash', 'GPKG', 2)).toBe('hash_GPKG');
  });

  it('no key keeps the legacy fileType behaviour', () => {
    expect(downloadKeyFor(null, 'CSV', 1)).toBe('CSV');
    expect(downloadKeyFor(undefined, 'GPKG', 2)).toBe('GPKG');
  });
});

describe('create-download worker: metadata.download is MERGED, never replaced', () => {
  it('writes through jsonb_set onto the existing download object', async () => {
    const db = stubDb();
    await createDownload(noopCtx(db, {
      source_id: 2135, view_id: 3740, fileTypes: ['NOT_A_FORMAT'], columns: ['tmc'], downloadKey: 'k',
    }));
    const update = db.queries.find((q) => /^\s*UPDATE/.test(q.sql));
    expect(update).toBeTruthy();
    expect(update.sql).toMatch(/jsonb_set/);
    expect(update.sql).toMatch(/metadata\s*->\s*'download'/);
    // The bug: `metadata || '{"download": …}'` is a SHALLOW merge, so the whole download object
    // was replaced by one run's keys and every earlier file became unreachable.
    expect(update.sql).not.toMatch(/COALESCE\(metadata, '\{\}'::jsonb\) \|\| \$1/);
    expect(JSON.parse(update.params[0])).toEqual({});
  });
});

describe('create-download worker: `extraFiles` — the manifest reaches the zip', () => {
  const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pm3-extras-test-'));

  it('writes each entry into the temp dir and returns its path', () => {
    const dir = tmp();
    try {
      const [p] = writeExtraFiles(dir, [{ name: 'PM3_README.txt', content: 'hello' }]);
      expect(fs.readFileSync(p, 'utf8')).toBe('hello');
      // Its own subdirectory: `PM3_README.txt` must not be able to collide with the export file,
      // and must not land INSIDE the shapefile directory datastore that runZip zips whole.
      expect(path.basename(path.dirname(p))).toBe('_extras');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it('no extraFiles is not an error — every other datatype still works', () => {
    const dir = tmp();
    try {
      expect(writeExtraFiles(dir, undefined)).toEqual([]);
      expect(writeExtraFiles(dir, [])).toEqual([]);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it('refuses a name that is a path, and an empty body', () => {
    const dir = tmp();
    try {
      // `name` decides where the file lands and `content` arrives in a task descriptor, so a
      // traversal has to be a throw rather than a write.
      for (const name of ['../escape.txt', 'sub/dir.txt', '/abs.txt', '', '.hidden', null]) {
        expect(() => writeExtraFiles(dir, [{ name, content: 'x' }])).toThrow(/bare file name/);
      }
      // An empty manifest is a builder that returned "" — the exact failure this capability exists
      // to surface, so it must not be written silently.
      expect(() => writeExtraFiles(dir, [{ name: 'a.txt', content: '' }])).toThrow(/no string content/);
      expect(() => writeExtraFiles(dir, [{ name: 'a.txt' }])).toThrow(/no string content/);
      expect(() => writeExtraFiles(dir, { name: 'a.txt', content: 'x' })).toThrow(/must be an array/);
      expect(() => writeExtraFiles(dir, [
        { name: 'a.txt', content: 'x' }, { name: 'a.txt', content: 'y' },
      ])).toThrow(/two entries named/);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it('a REAL zip contains the export and the manifest side by side', async () => {
    const dir = tmp();
    try {
      const exportFile = path.join(dir, 'pm3_s2135_v3740_2025_statewide.csv');
      fs.writeFileSync(exportFile, 'tmc,county\n104+04107,ALBANY\n');
      const extras = [{ name: 'PM3_README.txt', content: 'anchor era E6\n' }];
      const paths = writeExtraFiles(dir, extras);
      const zipPath = path.join(dir, 'out.zip');
      await runZip(zipPath, [exportFile, ...paths], extras);
      const listed = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' }).trim().split('\n');
      // Both at the ROOT of the archive — `-j` junks the `_extras/` prefix back off.
      expect(listed.sort()).toEqual(['PM3_README.txt', 'pm3_s2135_v3740_2025_statewide.csv']);
      expect(execFileSync('unzip', ['-p', zipPath, 'PM3_README.txt'], { encoding: 'utf8' }))
        .toBe('anchor era E6\n');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it('fails LOUDLY if an expected entry did not make it in', async () => {
    // The whole history of this file is failures that exited 0 (ogr2ogr `-where` on a bad column,
    // `-select` on an unknown field, the ".esri shapefile" extension). A manifest that silently
    // did not make it into the archive would be the next one.
    const dir = tmp();
    try {
      const f = path.join(dir, 'only.csv');
      fs.writeFileSync(f, 'a\n');
      await expect(runZip(path.join(dir, 'x.zip'), [f], [{ name: 'MISSING.txt' }]))
        .rejects.toThrow(/MISSING\.txt did not make it into/);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('create-download worker: the file name may be overridden', () => {
  it('sanitizes whatever it is given and caps the length', () => {
    // The view `version` can carry a date like "02/27/2026", whose `/` makes ogr2ogr try to
    // mkdir nested directories; a caller-supplied name gets the same treatment.
    expect(sanitizeFileName('pm3 v6/2025 statewide')).toBe('pm3_v6_2025_statewide');
    expect(sanitizeFileName('__trim__')).toBe('trim');
    expect(sanitizeFileName('x'.repeat(400)).length).toBeLessThanOrEqual(160);
  });
});
