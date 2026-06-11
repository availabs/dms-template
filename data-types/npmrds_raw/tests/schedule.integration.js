/**
 * Integration test: the npmrds_raw schedulable (scheduled RITIS download).
 *  - buildDescriptor: rolling-month window from max(views.metadata.end_date)
 *  - preflight: the RITIS ≤1-download-per-day budget (counts npmrds_raw/publish
 *    tasks queued/running/done in the last 24h across ALL sources)
 *
 * Node/sqlite harness — NO ClickHouse, NO RITIS (tests never call RITIS).
 * Run: node data-types/npmrds_raw/tests/schedule.integration.js
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
  console.log(`\n=== npmrds_raw schedulable (${DAMA_TEST_DB}) ===\n`);
  await setup();

  const metadata = require('@availabs/dms-server/src/dama/upload/metadata');
  const { getDb } = require('@availabs/dms-server/src/db');
  const db = getDb(DAMA_TEST_DB);
  const plugin = require('../index.js');
  const sched = plugin.schedulables && plugin.schedulables['npmrds_raw/publish'];

  await test('plugin exposes the npmrds_raw/publish schedulable', async () => {
    assert(sched, 'schedulables["npmrds_raw/publish"] should exist');
    assert(typeof sched.buildDescriptor === 'function', 'has buildDescriptor');
    assert(typeof sched.preflight === 'function', 'has preflight (RITIS budget)');
    assert(sched.label, 'has a label');
    assert(sched.defaultCron, 'has a defaultCron');
    const states = (sched.params || []).find((p) => p.name === 'states');
    assert(states && Array.isArray(states.default) && states.default[0] === 'NY',
      'params include states with default ["NY"]');
    assert((sched.params || []).some((p) => p.name === 'npmrds_prod_id'),
      'params include npmrds_prod_id');
  });

  // ── fixtures: raw source + 2 views with end_date metadata ────────────────
  const tmcSource = await metadata.createDamaSource(
    { name: `sched_tmcid_${Date.now()}`, type: 'npmrds_raw_tmc_identification' }, DAMA_TEST_DB);
  const rawSource = await metadata.createDamaSource({
    name: `sched_raw_${Date.now()}`,
    type: 'npmrds_raw',
    metadata: { tmc_identification_source_id: tmcSource.source_id },
  }, DAMA_TEST_DB);

  const v1 = await metadata.createDamaView({ source_id: rawSource.source_id }, DAMA_TEST_DB);
  const v2 = await metadata.createDamaView({ source_id: rawSource.source_id }, DAMA_TEST_DB);
  await db.query(`UPDATE views SET metadata = $1 WHERE view_id = $2`,
    [JSON.stringify({ start_date: '2025-10-01', end_date: '2025-10-31' }), v1.view_id]);
  await db.query(`UPDATE views SET metadata = $1 WHERE view_id = $2`,
    [JSON.stringify({ start_date: '2025-11-01', end_date: '2025-11-30' }), v2.view_id]);

  const schedule = {
    schedule_id: 1,
    source_id: rawSource.source_id,
    worker_path: 'npmrds_raw/publish',
    descriptor: { states: ['NY', 'NJ'], npmrds_prod_id: 55, user_id: 7, email: 'x@y.z' },
  };

  await test('buildDescriptor computes the rolling-month window from max(views end_date)', async () => {
    const d = await sched.buildDescriptor({ schedule, db, pgEnv: DAMA_TEST_DB });
    assert(d.startDate === '2025-12-01', `startDate should be 2025-12-01, got ${d.startDate}`);
    assert(d.endDate === '2025-12-31', `endDate year-capped at Dec 31, got ${d.endDate}`);
    assert(+d.source_id === +rawSource.source_id, 'source_id from schedule');
    assert(+d.tmc_identification_source_id === +tmcSource.source_id,
      'tmc_identification_source_id rehydrated from source metadata');
    assert(d.name, 'carries the source name (worker uses it for table naming)');
    assert(JSON.stringify(d.states) === JSON.stringify(['NY', 'NJ']), 'states from schedule params');
    assert(d.scheduledDataDownload === true, 'flags scheduledDataDownload');
    assert(+d.npmrds_prod_id === 55, 'npmrds_prod_id param carried (chained add)');
    assert(d.include_full_tmc_network === true, 'include_full_tmc_network default');
    assert(d.averagingWindowSize === 0, 'averagingWindowSize default 0');
  });

  await test('buildDescriptor defaults states to ["NY"] when the template has none', async () => {
    const d = await sched.buildDescriptor({
      schedule: { ...schedule, descriptor: {} }, db, pgEnv: DAMA_TEST_DB,
    });
    assert(JSON.stringify(d.states) === JSON.stringify(['NY']), `states default NY, got ${JSON.stringify(d.states)}`);
  });

  await test('buildDescriptor throws (→ BLOCKED) when no prior view has an end_date', async () => {
    const bare = await metadata.createDamaSource(
      { name: `sched_bare_${Date.now()}`, type: 'npmrds_raw' }, DAMA_TEST_DB);
    let threw = false;
    try {
      await sched.buildDescriptor({
        schedule: { ...schedule, source_id: bare.source_id }, db, pgEnv: DAMA_TEST_DB,
      });
    } catch (e) {
      threw = true;
      assert(/end_date/.test(e.message), `error should mention end_date, got: ${e.message}`);
    }
    assert(threw, 'should throw without prior end_date');
  });

  // ── RITIS daily budget preflight ─────────────────────────────────────────

  await test('preflight passes with no npmrds_raw/publish task in the last 24h', async () => {
    const verdict = await sched.preflight({ schedule, descriptor: {}, db, pgEnv: DAMA_TEST_DB });
    assert(verdict.ok === true, `should pass, got ${JSON.stringify(verdict)}`);
  });

  await test('preflight blocks when ANY npmrds_raw/publish ran within 24h (across all sources)', async () => {
    // different source on purpose — the budget is global
    await db.query(`
      INSERT INTO tasks (host_id, source_id, worker_path, status, descriptor)
      VALUES ('budget-test-host', 99999, 'npmrds_raw/publish', 'done', '{}')
    `);
    const verdict = await sched.preflight({ schedule, descriptor: {}, db, pgEnv: DAMA_TEST_DB });
    assert(verdict.ok === false, 'should block');
    assert(/RITIS|budget|24/i.test(verdict.reason || ''), `reason should explain the budget, got: ${verdict.reason}`);
    await db.query(`DELETE FROM tasks WHERE host_id = 'budget-test-host'`);
  });

  await test('preflight counts queued and running too, but NOT errored runs', async () => {
    await db.query(`
      INSERT INTO tasks (host_id, source_id, worker_path, status, descriptor)
      VALUES ('budget-test-host', 1, 'npmrds_raw/publish', 'queued', '{}')
    `);
    let verdict = await sched.preflight({ schedule, descriptor: {}, db, pgEnv: DAMA_TEST_DB });
    assert(verdict.ok === false, 'queued consumes the budget');
    await db.query(`DELETE FROM tasks WHERE host_id = 'budget-test-host'`);

    await db.query(`
      INSERT INTO tasks (host_id, source_id, worker_path, status, descriptor)
      VALUES ('budget-test-host', 1, 'npmrds_raw/publish', 'error', '{}')
    `);
    verdict = await sched.preflight({ schedule, descriptor: {}, db, pgEnv: DAMA_TEST_DB });
    assert(verdict.ok === true, 'an errored run does NOT consume the budget');
    await db.query(`DELETE FROM tasks WHERE host_id = 'budget-test-host'`);
  });

  await test('preflight ignores runs older than 24h', async () => {
    await db.query(`
      INSERT INTO tasks (host_id, source_id, worker_path, status, descriptor, queued_at)
      VALUES ('budget-test-host', 1, 'npmrds_raw/publish', 'done', '{}', '2020-01-01 00:00:00')
    `);
    const verdict = await sched.preflight({ schedule, descriptor: {}, db, pgEnv: DAMA_TEST_DB });
    assert(verdict.ok === true, `old run should not block, got ${JSON.stringify(verdict)}`);
    await db.query(`DELETE FROM tasks WHERE host_id = 'budget-test-host'`);
  });

  console.log(`\n  ${passed} passing, ${failed} failing\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => { console.error('Test runner error:', err); process.exit(1); });
