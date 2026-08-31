/**
 * Integration test: the pm3 /create-download route.
 *
 * The route is an ADAPTER — it queues the SHARED `gis/create-download` worker with a descriptor
 * the worker now understands. So what has to be true is a property of the DESCRIPTOR, and that is
 * exactly what these tests read back out of the task row:
 *
 *   - a geography-scoped request carries a `where` clause; statewide (`[]`) carries none.
 *     That single assertion is what defect 1 was: `downloadProps` was destructured away by the
 *     generic route and every export came back statewide, so "Region 8" and "statewide" produced
 *     byte-identical files;
 *   - the result is keyed by the CLIENT'S content hash (`uniqueFileNameBase`), because that is
 *     what `downloadAlreadyExists` / the polling effect look up — defect 2;
 *   - two different column subsets are two different keys AND two different file names, so they
 *     cannot collide on one artifact;
 *   - the descriptor names the SHARED worker — the pipeline is not forked;
 *   - the request is validated against the source's declared columns, and a refusal is a 400
 *     rather than a task that silently drops a column (`-select` on an unknown field warns and
 *     exits 0).
 *
 * Node/sqlite harness — no ClickHouse, no live DB, no ogr2ogr.
 * Run: node data-types/pm3/tests/download.integration.js
 */
const DAMA_TEST_DB = process.env.DAMA_TEST_DB || 'dama-sqlite-test';

let passed = 0, failed = 0;
function assert(c, m) { if (!c) throw new Error(`Assertion failed: ${m}`); }
async function test(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.log(`  ✗ ${name}: ${err.message}`); failed++; }
}

async function setup() {
  const { join } = require('path');
  const { unlinkSync, existsSync } = require('fs');
  const serverRoot = require('path').dirname(require.resolve('@availabs/dms-server/package.json'));
  const config = require(join(serverRoot, 'src', 'db', 'configs', `${DAMA_TEST_DB}.config.json`));
  if (config.type === 'sqlite' && config.filename) {
    const dbPath = join(serverRoot, 'src', 'db', 'configs', config.filename);
    if (existsSync(dbPath)) unlinkSync(dbPath);
  }
  const { getDb, awaitReady } = require('@availabs/dms-server/src/db');
  getDb(DAMA_TEST_DB);
  await awaitReady();
}

function getHandler(plugin, helpers, path) {
  let h = null;
  plugin.routes({ post(p, fn) { if (p === path) h = fn; }, get() {} }, helpers);
  return h;
}
function mockRes() {
  return { statusCode: 200, body: undefined,
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; } };
}
const parseJson = (v) => (typeof v === 'string' ? JSON.parse(v) : (v || {}));

// The four geography families the macroview's Geography control offers, in chip shape.
const chip = (type, value) => ({ name: `${type} ${value}`, label: `${type} ${value}`, value, type });

async function runTests() {
  console.log(`\n=== pm3 /create-download route (${DAMA_TEST_DB}) ===\n`);
  await setup();

  const tasks = require('@availabs/dms-server/src/dama/tasks');
  const metadata = require('@availabs/dms-server/src/dama/upload/metadata');
  const { getDb } = require('@availabs/dms-server/src/db');
  const helpers = {
    queueTask: tasks.queueTask,
    getTaskStatus: tasks.getTaskStatus,
    createDamaSource: metadata.createDamaSource,
    createDamaView: metadata.createDamaView,
    ensureSchema: metadata.ensureSchema,
    getDb,
  };
  const plugin = require('../index.js');
  const download = require('../download.js');
  const db = getDb(DAMA_TEST_DB);
  const handler = getHandler(plugin, helpers, '/create-download');

  // ── a pm3-shaped source + view: declared columns, and `version` = the 4-digit year ─────
  const DECLARED = [
    'ogc_fid', 'tmc', 'county', 'region_code', 'mpo_name', 'urban_code', 'wkb_geometry', 'year',
    'lottr_amp_lottr', 'phed_all_amp_xdelay_vhrs',
  ];
  const src = await metadata.createDamaSource({
    name: `pm3_download_test_${Date.now()}`, type: 'pm3', user_id: 1,
  }, DAMA_TEST_DB);
  await db.query(`UPDATE sources SET metadata = $1 WHERE source_id = $2`, [
    { columns: DECLARED.map((n) => ({ name: n, display_name: n, type: 'TEXT', desc: null })) },
    src.source_id,
  ]);
  const view = await metadata.createDamaView({ source_id: src.source_id, user_id: 1 }, DAMA_TEST_DB);
  await db.query(`UPDATE views SET version = '2025' WHERE view_id = $1`, [view.view_id]);

  const body = (over = {}) => ({
    source_id: src.source_id,
    view_id: view.view_id,
    columns: ['tmc', 'county', 'lottr_amp_lottr'],
    user_id: 1,
    email: 'x@y.z',
    fileTypes: ['CSV'],
    downloadProps: { geographyFilter: [], measure: 'lottr_amp_lottr' },
    uniqueFileNameBase: 'a'.repeat(64),
    ...over,
  });
  const descriptorFor = async (res) => {
    assert(res.statusCode === 200, `expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    const status = await tasks.getTaskStatus(res.body.etl_context_id, DAMA_TEST_DB);
    return parseJson(status.descriptor);
  };

  await test('the route is mounted and returns { etl_context_id, source_id }', async () => {
    assert(typeof handler === 'function', 'should register POST /create-download');
    const res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: body() }, res);
    assert(res.statusCode === 200, `should 200 (got ${res.statusCode}: ${JSON.stringify(res.body)})`);
    assert(res.body.etl_context_id != null, 'returns etl_context_id');
    assert(res.body.source_id === src.source_id, 'returns source_id');
  });

  await test('it DELEGATES to the shared gis/create-download worker — no forked pipeline', async () => {
    const res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: body() }, res);
    const desc = await descriptorFor(res);
    assert(desc.workerPath === 'gis/create-download',
      `descriptor should name the shared worker (got ${desc.workerPath})`);
    assert(plugin.workers['pm3/create-download'] === undefined,
      'pm3 must NOT register a download worker of its own');
  });

  await test('statewide (geographyFilter: []) carries NO where clause', async () => {
    const res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: body() }, res);
    const desc = await descriptorFor(res);
    assert(desc.where === null || desc.where === undefined,
      `statewide should not filter (got ${JSON.stringify(desc.where)})`);
  });

  await test('DEFECT 1 — a geography scope becomes a where clause on that column', async () => {
    const res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: body({
      downloadProps: { geographyFilter: [chip('region_code', '8')], measure: 'lottr_amp_lottr' },
    }) }, res);
    const desc = await descriptorFor(res);
    assert(desc.where === `"region_code" IN ('8')`,
      `expected a region_code clause, got ${JSON.stringify(desc.where)}`);
  });

  await test('several values of one family are one IN list', async () => {
    const res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: body({
      downloadProps: { geographyFilter: [chip('county', 'ALBANY'), chip('county', 'ERIE')] },
    }) }, res);
    const desc = await descriptorFor(res);
    assert(desc.where === `"county" IN ('ALBANY', 'ERIE')`,
      `expected one IN list, got ${JSON.stringify(desc.where)}`);
  });

  await test('two families are OR-ed — the map\'s filterMode "any", so the file matches the count', async () => {
    const res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: body({
      downloadProps: { geographyFilter: [chip('region_code', '8'), chip('county', 'ALBANY')] },
    }) }, res);
    const desc = await descriptorFor(res);
    assert(desc.where === `("region_code" IN ('8') OR "county" IN ('ALBANY'))`,
      `expected an OR of two families, got ${JSON.stringify(desc.where)}`);
  });

  await test('a value carrying a quote is escaped, not injected', async () => {
    const res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: body({
      downloadProps: { geographyFilter: [chip('county', "O'BRIEN'); DROP TABLE views; --")] },
    }) }, res);
    const desc = await descriptorFor(res);
    assert(desc.where === `"county" IN ('O''BRIEN''); DROP TABLE views; --')`,
      `quote should be doubled, got ${JSON.stringify(desc.where)}`);
  });

  await test('DEFECT 2 — the descriptor is keyed by the CLIENT\'S hash', async () => {
    const hash = 'b'.repeat(64);
    const res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: body({ uniqueFileNameBase: hash }) }, res);
    const desc = await descriptorFor(res);
    assert(desc.downloadKey === hash,
      `downloadKey should be the client hash verbatim (got ${desc.downloadKey})`);
    assert(desc.downloadKey !== 'CSV', 'and must not be the fileType — that is the bug');
  });

  await test('without a client hash the server derives a stable one from the request', async () => {
    const b = body({ uniqueFileNameBase: undefined });
    const res1 = mockRes(); await handler({ params: { pgEnv: DAMA_TEST_DB }, body: b }, res1);
    const res2 = mockRes(); await handler({ params: { pgEnv: DAMA_TEST_DB }, body: b }, res2);
    const [d1, d2] = [await descriptorFor(res1), await descriptorFor(res2)];
    assert(d1.downloadKey && /^[0-9a-f]{64}$/.test(d1.downloadKey), 'derives a sha256 hex key');
    assert(d1.downloadKey === d2.downloadKey, 'the same request derives the same key');
  });

  await test('two column subsets → two keys AND two file names', async () => {
    const mk = async (columns) => {
      const res = mockRes();
      await handler({ params: { pgEnv: DAMA_TEST_DB }, body: body({ columns, uniqueFileNameBase: undefined }) }, res);
      return descriptorFor(res);
    };
    const a = await mk(['tmc', 'county']);
    const b = await mk(['tmc', 'county', 'lottr_amp_lottr']);
    assert(a.downloadKey !== b.downloadKey, 'distinct subsets must be distinct keys');
    assert(a.fileNameBase !== b.fileNameBase,
      `distinct subsets must be distinct files (both were "${a.fileNameBase}")`);
  });

  await test('the file name carries the selection — year, measure, geography', async () => {
    const res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: body({
      downloadProps: { geographyFilter: [chip('region_code', '8')], measure: 'lottr_amp_lottr' },
    }) }, res);
    const desc = await descriptorFor(res);
    assert(/_2025_/.test(desc.fileNameBase), `name should carry the year: ${desc.fileNameBase}`);
    assert(desc.fileNameBase.includes('lottr_amp_lottr'), `name should carry the measure: ${desc.fileNameBase}`);
    assert(desc.fileNameBase.includes('region_code-8'), `name should carry the geography: ${desc.fileNameBase}`);
    assert(!/PM3_s\d+_v\d+_2025$/.test(desc.fileNameBase), 'and must not be the view-only generic name');
  });

  await test('statewide names itself "statewide" rather than saying nothing', async () => {
    const res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: body() }, res);
    const desc = await descriptorFor(res);
    assert(desc.fileNameBase.includes('statewide'), `got ${desc.fileNameBase}`);
  });

  await test('the columns asked for are forwarded verbatim', async () => {
    const res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: body({ columns: ['tmc', 'wkb_geometry'] }) }, res);
    const desc = await descriptorFor(res);
    assert(JSON.stringify(desc.columns) === JSON.stringify(['tmc', 'wkb_geometry']),
      `got ${JSON.stringify(desc.columns)}`);
  });

  // ── refusals: every one of these used to be a silently wrong download ────────────────
  await test('an unknown column is a 400, not a file quietly missing that column', async () => {
    const res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: body({ columns: ['tmc', 'not_a_column'] }) }, res);
    assert(res.statusCode === 400, `should 400 (got ${res.statusCode})`);
    assert(/not_a_column/.test(res.body.error), `error should name it (got ${res.body.error})`);
  });

  await test('an unknown geography column is a 400', async () => {
    const res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: body({
      downloadProps: { geographyFilter: [chip('nope', 'x')] },
    }) }, res);
    assert(res.statusCode === 400, `should 400 (got ${res.statusCode})`);
  });

  await test('an unsupported fileType is a 400 — `json` has no producer at all', async () => {
    const res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: body({ fileTypes: ['json'] }) }, res);
    assert(res.statusCode === 400, `should 400 (got ${res.statusCode})`);
    assert(/json/.test(res.body.error), `error should name it (got ${res.body.error})`);
  });

  await test('GeoJSON is a 400 — pm3 policy, even though the pipeline can emit it', async () => {
    // Stated by Alex 2026-08-24. The SHARED worker still has GeoJSON in OUTPUT_TYPES because other
    // datatypes may legitimately want it; pm3 refuses it at its own route. Pinned here as well as
    // in the unit suite because this is the layer a client actually hits.
    const res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: body({ fileTypes: ['GeoJSON'] }) }, res);
    assert(res.statusCode === 400, `should 400 (got ${res.statusCode})`);
    assert(/GeoJSON/.test(res.body.error), `error should name it (got ${res.body.error})`);
    assert(/CSV/.test(res.body.error) && /GPKG/.test(res.body.error),
      `and should say what IS supported (got ${res.body.error})`);
    // ...and it is still in the pipeline, so this really is a pm3 rule and not a capability loss.
    assert(download.SUPPORTED_FILE_TYPES.length === 3, 'pm3 offers exactly CSV, GPKG, Shapefile');
  });

  // ── PHASE 2: the caveat manifest travels with the file ───────────────────────────────
  await test('the descriptor carries a PM3_README.txt manifest', async () => {
    const res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: body() }, res);
    const desc = await descriptorFor(res);
    assert(Array.isArray(desc.extraFiles) && desc.extraFiles.length === 1,
      `expected one extraFile (got ${JSON.stringify(desc.extraFiles)})`);
    const [manifest] = desc.extraFiles;
    assert(manifest.name === 'PM3_README.txt', `named PM3_README.txt (got ${manifest.name})`);
    assert(typeof manifest.content === 'string' && manifest.content.length > 2000,
      `and carries real content (got ${(manifest.content || '').length} chars)`);
  });

  await test('the manifest describes THIS export — year, scope, columns, format', async () => {
    const res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: body({
      columns: ['tmc', 'county', 'phed_all_amp_xdelay_vhrs'],
      fileTypes: ['GPKG'],
      downloadProps: { geographyFilter: [chip('region_code', '8')], measure: 'phed_all_amp_xdelay_vhrs' },
    }) }, res);
    const { content } = (await descriptorFor(res)).extraFiles[0];
    for (const needle of [
      '2025', 'GPKG', `"region_code" IN ('8')`, 'phed_all_amp_xdelay_vhrs',
      `view_id ${view.view_id}`, 'THE 20 MPH FLOOR',
    ]) {
      assert(content.includes(needle), `manifest should mention ${needle}`);
    }
  });

  await test('a 2017 export and a 2025 export ship DIFFERENT manifests', async () => {
    // The whole point of building it from the request. Same source, same columns, same format —
    // different year, and therefore a different coverage era, a different anchor-fallback rate and
    // a metadata-family caveat that only 2017 carries.
    const v2017 = await metadata.createDamaView({ source_id: src.source_id, user_id: 1 }, DAMA_TEST_DB);
    await db.query(`UPDATE views SET version = '2017' WHERE view_id = $1`, [v2017.view_id]);

    const manifestFor = async (viewId) => {
      const res = mockRes();
      await handler({ params: { pgEnv: DAMA_TEST_DB }, body: body({ view_id: viewId }) }, res);
      return (await descriptorFor(res)).extraFiles[0].content;
    };
    const a = await manifestFor(v2017.view_id);
    const b = await manifestFor(view.view_id);
    assert(a !== b, 'the two manifests must differ');
    assert(/all-vehicle era E1/.test(a), `2017 should be era E1:\n${a.slice(0, 400)}`);
    assert(/all-vehicle era E8/.test(b), '2025 should be era E8');
    assert(/tmc_meta_geometry/.test(a), '2017 should carry the meta-family caveat');
    assert(!/tmc_meta_geometry/.test(b), '2025 should NOT carry it');
    assert(/ELEVATED fallback rate/.test(a), '2017 should carry the elevated anchor_fallback rate');
    assert(!/ELEVATED fallback rate/.test(b), '2025 should NOT');
  });

  await test('a REAL zip built by the shared worker contains the manifest', async () => {
    // The remaining link: the worker writes what the route sent into the actual archive. Driven
    // through the worker's own `writeExtraFiles` + `runZip` (no Postgres, no ogr2ogr — a dummy
    // export file stands in for the ogr2ogr output), then read back out with `unzip`.
    const { writeExtraFiles, runZip } = require('@availabs/dms-server/src/dama/upload/workers/create-download');
    const fs = require('fs'), os = require('os'), pathMod = require('path');
    const { execFileSync } = require('child_process');

    const res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: body() }, res);
    const desc = await descriptorFor(res);

    const dir = fs.mkdtempSync(pathMod.join(os.tmpdir(), 'pm3-zip-'));
    try {
      const exportFile = pathMod.join(dir, `${desc.fileNameBase}.csv`);
      fs.writeFileSync(exportFile, 'tmc,county\n104+04107,ALBANY\n');
      const extraPaths = writeExtraFiles(dir, desc.extraFiles);
      const zipPath = pathMod.join(dir, `${desc.fileNameBase}_CSV.zip`);
      await runZip(zipPath, [exportFile, ...extraPaths], desc.extraFiles);

      const listed = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' }).trim().split('\n');
      assert(listed.includes('PM3_README.txt'), `zip should contain PM3_README.txt (has ${listed})`);
      assert(listed.some((n) => n.endsWith('.csv')), `and the export (has ${listed})`);
      const read = execFileSync('unzip', ['-p', zipPath, 'PM3_README.txt'], { encoding: 'utf8' });
      assert(read === desc.extraFiles[0].content, 'the manifest must survive the round trip byte-for-byte');
      assert(/anchor era/.test(read), 'and still be the pm3 manifest');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  await test('missing source_id / view_id / columns / fileTypes are 400s', async () => {
    for (const over of [{ source_id: undefined }, { view_id: undefined }, { columns: [] }, { fileTypes: [] }]) {
      const res = mockRes();
      await handler({ params: { pgEnv: DAMA_TEST_DB }, body: body(over) }, res);
      assert(res.statusCode === 400, `should 400 for ${JSON.stringify(over)} (got ${res.statusCode})`);
    }
  });

  await test('a view that does not belong to the source is a 404', async () => {
    const other = await metadata.createDamaSource({
      name: `pm3_other_${Date.now()}`, type: 'pm3', user_id: 1,
    }, DAMA_TEST_DB);
    const res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: body({ source_id: other.source_id }) }, res);
    assert(res.statusCode === 404, `should 404 (got ${res.statusCode})`);
  });

  await test('a source with no declared columns is refused, not guessed at', async () => {
    const bare = await metadata.createDamaSource({
      name: `pm3_bare_${Date.now()}`, type: 'pm3', user_id: 1,
    }, DAMA_TEST_DB);
    const bareView = await metadata.createDamaView({ source_id: bare.source_id, user_id: 1 }, DAMA_TEST_DB);
    const res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: body({
      source_id: bare.source_id, view_id: bareView.view_id,
    }) }, res);
    assert(res.statusCode === 409, `should 409 (got ${res.statusCode}: ${JSON.stringify(res.body)})`);
  });

  console.log(`\n  ${passed} passing, ${failed} failing\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => { console.error('Test runner error:', err); process.exit(1); });
