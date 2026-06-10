/**
 * Integration test (Phase 4): the excessive_delay routes.
 *
 * Asserts the migration contract:
 *   - POST /publish creates the excessive_delay source if needed and queues an
 *     excessive_delay/publish task with a FULLY SELF-CONTAINED descriptor
 *     (npmrds prod/meta table refs, transcom table ref, years[]) — the legacy
 *     route ran the whole computation inline in the HTTP handler.
 *   - POST /add queues the same worker (mode 'add') against an existing view.
 *   - POST /remove deletes by year synchronously — and NEVER truncates
 *     (the legacy remove handler truncated the entire table; that bug is gone).
 *   - No etl_contexts anywhere (the sqlite harness has none).
 *
 * Node/sqlite harness — NO ClickHouse. Run:
 *   node data-types/excessive_delay/tests/route.integration.js
 */
const DAMA_TEST_DB = process.env.DAMA_TEST_DB || 'dama-sqlite-test';

let passed = 0, failed = 0;
function assert(c, m) { if (!c) throw new Error(`Assertion failed: ${m}`); }
async function test(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.log(`  ✗ ${name}: ${err.message}`); failed++; }
}
const parseMeta = (m) => (typeof m === 'string' ? JSON.parse(m) : (m || {}));

async function setup() {
  const { join } = require('path');
  const { unlinkSync, existsSync } = require('fs');
  const serverRoot = require('path').dirname(require.resolve('@availabs/dms-server/package.json'));
  const config = require(join(serverRoot, 'src', 'db', 'configs', `${DAMA_TEST_DB}.config.json`));
  if (config.type === 'sqlite' && config.filename) {
    const p = join(serverRoot, 'src', 'db', 'configs', config.filename);
    if (existsSync(p)) unlinkSync(p);
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

async function runTests() {
  console.log(`\n=== excessive_delay routes (${DAMA_TEST_DB}) ===\n`);
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
  const db = getDb(DAMA_TEST_DB);
  const stamp = Date.now();

  // ── Fixture: npmrds production + meta + transcom sources/views ────────────
  const npmrdsSrc = await metadata.createDamaSource({ name: `ed_npmrds_${stamp}`, type: 'npmrds', user_id: 1 }, DAMA_TEST_DB);
  const metaSrc = await metadata.createDamaSource({ name: `ed_npmrds_meta_${stamp}`, type: 'npmrds_meta', user_id: 1 }, DAMA_TEST_DB);
  const transcomSrc = await metadata.createDamaSource({ name: `ed_transcom_${stamp}`, type: 'transcom_congestion', user_id: 1 }, DAMA_TEST_DB);

  const metaView = await metadata.createDamaView({ source_id: metaSrc.source_id, user_id: 1 }, DAMA_TEST_DB);
  await db.query(
    `UPDATE views SET table_schema = $1, table_name = $2, data_table = $3 WHERE view_id = $4`,
    ['clickhouse.npmrds_meta', 's11_v21_meta', 'clickhouse.npmrds_meta.s11_v21_meta', metaView.view_id]
  );

  const prodView = await metadata.createDamaView({
    source_id: npmrdsSrc.source_id, user_id: 1,
    metadata: { is_clickhouse_table: 1, npmrds_meta_view_id: metaView.view_id },
  }, DAMA_TEST_DB);
  await db.query(
    `UPDATE views SET table_schema = $1, table_name = $2, data_table = $3 WHERE view_id = $4`,
    ['clickhouse.npmrds', 's10_v20_prod', 'clickhouse.npmrds.s10_v20_prod', prodView.view_id]
  );

  const transcomView = await metadata.createDamaView({ source_id: transcomSrc.source_id, user_id: 1 }, DAMA_TEST_DB);
  await db.query(
    `UPDATE views SET table_schema = $1, table_name = $2, data_table = $3 WHERE view_id = $4`,
    ['transcom', 's12_v22_events', 'transcom.s12_v22_events', transcomView.view_id]
  );

  // ── /publish ───────────────────────────────────────────────────────────────
  let publishedSourceId = null;
  await test('publish creates the excessive_delay source and queues a task with a self-contained descriptor', async () => {
    const handler = getHandler(plugin, helpers, '/publish');
    assert(typeof handler === 'function', 'should register POST /publish');
    const res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: {
      name: `excessive_delay_route_${stamp}`,
      user_id: 1, email: 'x@y.z',
      selectedNpmrdsSourceId: npmrdsSrc.source_id,
      selectedTranscomSourceId: transcomSrc.source_id,
      years: [2019, 2021],
      months: [1],
    } }, res);

    assert(res.statusCode !== 500, `should not 500 (got ${res.statusCode}: ${JSON.stringify(res.body)})`);
    assert(res.body && res.body.etl_context_id != null, 'returns etl_context_id');
    assert(res.body && res.body.source_id != null, 'returns source_id');
    publishedSourceId = res.body.source_id;

    const { rows: src } = await db.query(`SELECT type FROM sources WHERE source_id = $1`, [publishedSourceId]);
    assert(src[0] && src[0].type === 'excessive_delay', `source should be type excessive_delay (got ${src[0] && src[0].type})`);

    const status = await tasks.getTaskStatus(res.body.etl_context_id, DAMA_TEST_DB);
    assert(status && status.worker_path === 'excessive_delay/publish', 'queues an excessive_delay/publish task');
    const d = typeof status.descriptor === 'string' ? JSON.parse(status.descriptor) : status.descriptor;
    assert(d.mode === 'publish', 'descriptor mode is publish');
    assert(d.npmrds_prod_table === 'npmrds.s10_v20_prod', `descriptor carries the CH prod table sans clickhouse. prefix (got ${d.npmrds_prod_table})`);
    assert(d.npmrds_meta_table === 'npmrds_meta.s11_v21_meta', `descriptor carries the CH meta table (got ${d.npmrds_meta_table})`);
    assert(d.transcom_table === 'transcom.s12_v22_events', `descriptor carries the transcom table (got ${d.transcom_table})`);
    assert(d.transcom_source_id === transcomSrc.source_id, 'descriptor carries transcom_source_id');
    assert(d.npmrds_production_view_id === prodView.view_id, 'descriptor carries the prod view id');
    assert(JSON.stringify(d.years) === JSON.stringify([2019, 2021]), `descriptor carries years[] verbatim — gap allowed (got ${JSON.stringify(d.years)})`);
    assert(JSON.stringify(d.months) === JSON.stringify([1]), 'descriptor carries months');
  });

  await test('publish validates years / name / source pickers with 400s', async () => {
    const handler = getHandler(plugin, helpers, '/publish');
    const base = {
      name: 'x', user_id: 1,
      selectedNpmrdsSourceId: npmrdsSrc.source_id,
      selectedTranscomSourceId: transcomSrc.source_id,
      years: [2021],
    };
    for (const [bad, label] of [
      [{ ...base, years: [] }, 'empty years'],
      [{ ...base, years: ['soon'] }, 'non-integer years'],
      [{ ...base, name: undefined }, 'missing name'],
      [{ ...base, selectedNpmrdsSourceId: undefined }, 'missing npmrds source'],
      [{ ...base, selectedTranscomSourceId: undefined }, 'missing transcom source'],
    ]) {
      const res = mockRes();
      await handler({ params: { pgEnv: DAMA_TEST_DB }, body: bad }, res);
      assert(res.statusCode === 400, `should 400 on ${label} (got ${res.statusCode})`);
    }
  });

  await test('publish rejects an invalid npmrds source id', async () => {
    const handler = getHandler(plugin, helpers, '/publish');
    const res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: {
      name: 'bad', user_id: 1, years: [2021],
      selectedNpmrdsSourceId: 9999999, selectedTranscomSourceId: transcomSrc.source_id,
    } }, res);
    assert(res.statusCode >= 400, `should fail (got ${res.statusCode})`);
  });

  // ── /add ───────────────────────────────────────────────────────────────────
  await test('add queues the same worker against an existing view (backfill years)', async () => {
    // Simulate a view the publish worker produced (metadata carries the refs).
    const edView = await metadata.createDamaView({
      source_id: publishedSourceId, user_id: 1,
      metadata: {
        npmrds_production_source_id: npmrdsSrc.source_id,
        npmrds_production_view_id: prodView.view_id,
        npmrds_prod_table: 'npmrds.s10_v20_prod',
        npmrds_meta_view_id: metaView.view_id,
        npmrds_meta_table: 'npmrds_meta.s11_v21_meta',
        transcom_source_id: transcomSrc.source_id,
        transcom_table: 'transcom.s12_v22_events',
        years: [2019, 2021],
      },
    }, DAMA_TEST_DB);

    const handler = getHandler(plugin, helpers, '/add');
    assert(typeof handler === 'function', 'should register POST /add');
    const res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: {
      source_id: publishedSourceId, view_id: edView.view_id,
      years: [2020], user_id: 1,
    } }, res);

    assert(res.statusCode !== 500 && res.statusCode < 400, `should succeed (got ${res.statusCode}: ${JSON.stringify(res.body)})`);
    assert(res.body.etl_context_id != null && res.body.source_id === publishedSourceId, 'returns { etl_context_id, source_id }');

    const status = await tasks.getTaskStatus(res.body.etl_context_id, DAMA_TEST_DB);
    assert(status.worker_path === 'excessive_delay/publish', 'add reuses the publish worker');
    const d = typeof status.descriptor === 'string' ? JSON.parse(status.descriptor) : status.descriptor;
    assert(d.mode === 'add', 'descriptor mode is add');
    assert(d.view_id === edView.view_id, 'descriptor carries the existing view_id');
    assert(d.npmrds_prod_table === 'npmrds.s10_v20_prod', 'descriptor re-carries the prod table (self-contained)');
    assert(d.transcom_table === 'transcom.s12_v22_events', 'descriptor re-carries the transcom table');
    assert(JSON.stringify(d.years) === JSON.stringify([2020]), 'descriptor carries the backfill years (gap fill)');
  });

  await test('add 400s without years or a resolvable view', async () => {
    const handler = getHandler(plugin, helpers, '/add');
    let res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: { source_id: publishedSourceId } }, res);
    assert(res.statusCode === 400, `should 400 without years (got ${res.statusCode})`);
    res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: { source_id: 9999999, years: [2020] } }, res);
    assert(res.statusCode >= 400, `should fail without a view (got ${res.statusCode})`);
  });

  // ── /remove ────────────────────────────────────────────────────────────────
  await test('remove deletes by year(s) only — other years survive (no TRUNCATE)', async () => {
    // A real output table with two years of rows.
    const tbl = `ed_remove_${stamp}`;
    await db.query(`CREATE TABLE ${tbl} (
      ogc_fid INTEGER PRIMARY KEY AUTOINCREMENT,
      tmc VARCHAR(9) NOT NULL, year SMALLINT NOT NULL, month SMALLINT NOT NULL,
      total DOUBLE PRECISION, UNIQUE (tmc, year, month))`);
    await db.query(`INSERT INTO ${tbl} (tmc, year, month, total) VALUES
      ('120+1001', 2019, 1, 1.0), ('120+1002', 2019, 1, 2.0),
      ('120+1001', 2021, 2, 3.0), ('120+1002', 2021, 2, 4.0)`);

    const rmView = await metadata.createDamaView({
      source_id: publishedSourceId, user_id: 1,
      metadata: { years: [2019, 2021], start_date: '2019-01-01', end_date: '2021-02-28' },
    }, DAMA_TEST_DB);
    await db.query(
      `UPDATE views SET table_schema = $1, table_name = $2, data_table = $3 WHERE view_id = $4`,
      ['excessive_delay', tbl, tbl, rmView.view_id]
    );

    const handler = getHandler(plugin, helpers, '/remove');
    assert(typeof handler === 'function', 'should register POST /remove');
    const res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: {
      source_id: publishedSourceId, view_id: rmView.view_id, years: [2019],
    } }, res);

    assert(res.statusCode !== 500 && res.statusCode < 400, `should succeed (got ${res.statusCode}: ${JSON.stringify(res.body)})`);
    const { rows } = await db.query(`SELECT year, COUNT(*) AS n FROM ${tbl} GROUP BY year`);
    assert(rows.length === 1 && Number(rows[0].year) === 2021 && Number(rows[0].n) === 2,
      `2019 rows gone, 2021 rows intact (got ${JSON.stringify(rows)})`);

    const { rows: vr } = await db.query(`SELECT metadata FROM views WHERE view_id = $1`, [rmView.view_id]);
    const meta = parseMeta(vr[0].metadata);
    assert(JSON.stringify(meta.years) === JSON.stringify([2021]), `view metadata years recomputed (got ${JSON.stringify(meta.years)})`);
    assert(meta.start_date === '2021-02-01', `start_date recomputed (got ${meta.start_date})`);
    assert(meta.end_date === '2021-02-28', `end_date recomputed (got ${meta.end_date})`);
  });

  await test('remove 400s without years', async () => {
    const handler = getHandler(plugin, helpers, '/remove');
    const res = mockRes();
    await handler({ params: { pgEnv: DAMA_TEST_DB }, body: { source_id: publishedSourceId } }, res);
    assert(res.statusCode === 400, `should 400 (got ${res.statusCode})`);
  });

  console.log(`\n  ${passed} passing, ${failed} failing\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => { console.error('Test runner error:', err); process.exit(1); });
