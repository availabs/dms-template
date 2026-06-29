/**
 * Integration test: the transcom schedulables.
 *  - transcom/add        — daily ingest of "yesterday" into the existing view
 *                          (add, not publish: publish creates a NEW view per
 *                          run — the bulk/initial path, not the daily cadence)
 *  - transcom/congestion — previous-complete-month attribution window
 *
 * Node/sqlite harness — NO TRANSCOM API.
 * Run: node data-types/transcom/tests/schedule.integration.js
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
  const configPath = join(serverRoot, 'src', 'db', 'configs', `${DAMA_TEST_DB}.config.json`);
  const config = require(configPath);
  if (config.type === 'sqlite' && config.filename) {
    const dbPath = join(serverRoot, 'src', 'db', 'configs', config.filename);
    for (const suffix of ['', '-wal', '-shm']) {
      if (existsSync(dbPath + suffix)) unlinkSync(dbPath + suffix);
    }
  }
  const { getDb, awaitReady } = require('@availabs/dms-server/src/db');
  getDb(DAMA_TEST_DB);
  await awaitReady();
}

async function runTests() {
  console.log(`\n=== transcom schedulables (${DAMA_TEST_DB}) ===\n`);
  await setup();

  const metadata = require('@availabs/dms-server/src/dama/upload/metadata');
  const { getDb } = require('@availabs/dms-server/src/db');
  const db = getDb(DAMA_TEST_DB);
  const plugin = require('../index.js');
  const dates = require('../dates.js');

  // ── transcom/add (daily) ─────────────────────────────────────────────────

  const addSched = plugin.schedulables && plugin.schedulables['transcom/add'];

  await test('plugin exposes the transcom/add schedulable (daily ingest)', async () => {
    assert(addSched, 'schedulables["transcom/add"] should exist');
    assert(typeof addSched.buildDescriptor === 'function', 'has buildDescriptor');
    assert(addSched.label && addSched.defaultCron, 'has label + defaultCron');
  });

  const trSource = await metadata.createDamaSource(
    { name: `sched_transcom_${Date.now()}`, type: 'transcom' }, DAMA_TEST_DB);
  const trView = await metadata.createDamaView({ source_id: trSource.source_id }, DAMA_TEST_DB);

  await test('transcom/add buildDescriptor: yesterday window into the latest view', async () => {
    const d = await addSched.buildDescriptor({
      schedule: {
        schedule_id: 2,
        source_id: trSource.source_id,
        descriptor: { geom_source_id: 9, user_id: 3, email: 'a@b.c' },
      },
      db, pgEnv: DAMA_TEST_DB,
    });
    const expected = dates.computeNextWindow(); // yesterday 00:00:00 .. 23:59:59
    assert(d.start_timestamp === expected.start_timestamp,
      `start_timestamp should be ${expected.start_timestamp}, got ${d.start_timestamp}`);
    assert(d.end_timestamp === expected.end_timestamp,
      `end_timestamp should be ${expected.end_timestamp}, got ${d.end_timestamp}`);
    assert(+d.source_id === +trSource.source_id, 'source_id from schedule');
    assert(+d.view_id === +trView.view_id, 'resolves the latest view of the source');
    assert(+d.geom_source_id === 9, 'geom_source_id from params');
    assert(+d.user_id === 3, 'user_id carried');
  });

  await test('transcom/add buildDescriptor throws (→ BLOCKED) when the source has no view', async () => {
    const bare = await metadata.createDamaSource(
      { name: `sched_transcom_bare_${Date.now()}`, type: 'transcom' }, DAMA_TEST_DB);
    let threw = false;
    try {
      await addSched.buildDescriptor({
        schedule: { schedule_id: 2, source_id: bare.source_id, descriptor: {} },
        db, pgEnv: DAMA_TEST_DB,
      });
    } catch (e) { threw = true; }
    assert(threw, 'should throw without a view to add into');
  });

  // ── transcom/congestion (monthly) ────────────────────────────────────────

  const cgSched = plugin.schedulables && plugin.schedulables['transcom/congestion'];

  await test('plugin exposes the transcom/congestion schedulable (monthly)', async () => {
    assert(cgSched, 'schedulables["transcom/congestion"] should exist');
    assert(typeof cgSched.buildDescriptor === 'function', 'has buildDescriptor');
  });

  const cgSource = await metadata.createDamaSource({
    name: `sched_congestion_${Date.now()}`,
    type: 'transcom_congestion',
    metadata: { transcom_source_id: trSource.source_id },
  }, DAMA_TEST_DB);

  await test('transcom/congestion buildDescriptor: previous-complete-month window + refs', async () => {
    const d = await cgSched.buildDescriptor({
      schedule: {
        schedule_id: 3,
        source_id: cgSource.source_id,
        descriptor: {
          geom_source_id: 9,
          npmrds_production_source_id: 11,
          map21_source_id: 12,
          methodology: 'v2',
          user_id: 3,
        },
      },
      db, pgEnv: DAMA_TEST_DB,
    });
    const expected = dates.previousCompleteMonth();
    assert(d.start_date === expected.start_date, `start_date ${expected.start_date}, got ${d.start_date}`);
    assert(d.end_date === expected.end_date, `end_date ${expected.end_date}, got ${d.end_date}`);
    assert(+d.source_id === +cgSource.source_id, 'source_id from schedule');
    assert(+d.transcom_source_id === +trSource.source_id, 'transcom_source_id from source metadata');
    assert(+d.npmrds_production_source_id === 11, 'npmrds ref from params');
    assert(+d.map21_source_id === 12, 'map21 ref from params');
    assert(d.methodology === 'v2', 'methodology carried');
    // legacy hardcoded conflation defaults must be materialized in the descriptor
    assert(+d.conflation_nodes_source_id === 237, 'conflation nodes default 237');
    assert(+d.conflation_ways_source_id === 236, 'conflation ways default 236');
    assert(+d.conflation_v0_source_id === 238, 'conflation v0 default 238');
  });

  await test('transcom/congestion buildDescriptor throws (→ BLOCKED) without a transcom_source_id', async () => {
    const orphan = await metadata.createDamaSource(
      { name: `sched_congestion_orphan_${Date.now()}`, type: 'transcom_congestion' }, DAMA_TEST_DB);
    let threw = false;
    try {
      await cgSched.buildDescriptor({
        schedule: { schedule_id: 3, source_id: orphan.source_id, descriptor: {} },
        db, pgEnv: DAMA_TEST_DB,
      });
    } catch (e) {
      threw = true;
      assert(/transcom_source_id/.test(e.message), `should mention transcom_source_id, got: ${e.message}`);
    }
    assert(threw, 'should throw without transcom_source_id');
  });

  console.log(`\n  ${passed} passing, ${failed} failing\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => { console.error('Test runner error:', err); process.exit(1); });
