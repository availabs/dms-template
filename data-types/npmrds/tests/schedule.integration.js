/**
 * Integration test: the npmrds/add schedulable (weekly raw→prod add).
 *  - buildDescriptor: last complete Mon–Sun window; resolves the prod view +
 *    the raw views (of the configured npmrds_raw source) overlapping the window
 *  - preflight: the date-gap check — the prod view's end_date must abut the
 *    window start (legacy isNextDay), BLOCKING loudly on mismatch
 *
 * Node/sqlite harness — NO ClickHouse.
 * Run: node data-types/npmrds/tests/schedule.integration.js
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

// 'YYYY-MM-DD' + n days (UTC)
function plusDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

async function runTests() {
  console.log(`\n=== npmrds/add schedulable (${DAMA_TEST_DB}) ===\n`);
  await setup();

  const metadata = require('@availabs/dms-server/src/dama/upload/metadata');
  const { getDb } = require('@availabs/dms-server/src/db');
  const db = getDb(DAMA_TEST_DB);
  const plugin = require('../index.js');
  const dates = require('../dates.js');
  const sched = plugin.schedulables && plugin.schedulables['npmrds/add'];

  const window = dates.lastCompleteWeek(); // what buildDescriptor will compute

  await test('plugin exposes the npmrds/add schedulable', async () => {
    assert(sched, 'schedulables["npmrds/add"] should exist');
    assert(typeof sched.buildDescriptor === 'function', 'has buildDescriptor');
    assert(typeof sched.preflight === 'function', 'has preflight (gap check)');
    assert((sched.params || []).some((p) => p.name === 'npmrds_raw_source_id'),
      'params include npmrds_raw_source_id');
  });

  // ── fixtures ─────────────────────────────────────────────────────────────
  const prodSource = await metadata.createDamaSource(
    { name: `sched_npmrds_${Date.now()}`, type: 'npmrds' }, DAMA_TEST_DB);
  const prodView = await metadata.createDamaView({ source_id: prodSource.source_id }, DAMA_TEST_DB);
  // prod end_date abuts the window (day before the window start)
  await db.query(`UPDATE views SET metadata = $1 WHERE view_id = $2`,
    [JSON.stringify({ start_date: '2025-01-01', end_date: plusDays(window.startDate, -1) }), prodView.view_id]);

  const rawSource = await metadata.createDamaSource(
    { name: `sched_npmrds_raw_${Date.now()}`, type: 'npmrds_raw' }, DAMA_TEST_DB);
  // raw view covering the window
  const rawCovering = await metadata.createDamaView({ source_id: rawSource.source_id }, DAMA_TEST_DB);
  await db.query(`UPDATE views SET metadata = $1 WHERE view_id = $2`,
    [JSON.stringify({ start_date: plusDays(window.startDate, -20), end_date: plusDays(window.endDate, 3) }), rawCovering.view_id]);
  // raw view NOT covering the window (way in the past)
  const rawStale = await metadata.createDamaView({ source_id: rawSource.source_id }, DAMA_TEST_DB);
  await db.query(`UPDATE views SET metadata = $1 WHERE view_id = $2`,
    [JSON.stringify({ start_date: '2020-01-01', end_date: '2020-01-31' }), rawStale.view_id]);

  const schedule = {
    schedule_id: 4,
    source_id: prodSource.source_id,
    worker_path: 'npmrds/add',
    descriptor: { npmrds_raw_source_id: rawSource.source_id, user_id: 5, email: 'x@y.z' },
  };

  let builtDescriptor;

  await test('buildDescriptor: last complete Mon–Sun window + overlapping raw views only', async () => {
    const d = await sched.buildDescriptor({ schedule, db, pgEnv: DAMA_TEST_DB });
    builtDescriptor = d;
    assert(d.startDate === window.startDate, `startDate ${window.startDate}, got ${d.startDate}`);
    assert(d.endDate === window.endDate, `endDate ${window.endDate}, got ${d.endDate}`);
    assert(+d.source_id === +prodSource.source_id, 'source_id from schedule');
    assert(+d.view_id === +prodView.view_id, 'resolves the latest prod view');
    assert(Array.isArray(d.npmrds_raw_view_ids), 'npmrds_raw_view_ids is an array');
    assert(d.npmrds_raw_view_ids.map(Number).includes(Number(rawCovering.view_id)),
      'includes the raw view overlapping the window');
    assert(!d.npmrds_raw_view_ids.map(Number).includes(Number(rawStale.view_id)),
      'excludes raw views outside the window');
  });

  await test('buildDescriptor throws (→ BLOCKED) when no raw view covers the window', async () => {
    await db.query(`UPDATE views SET metadata = $1 WHERE view_id = $2`,
      [JSON.stringify({ start_date: '2020-02-01', end_date: '2020-02-28' }), rawCovering.view_id]);
    let threw = false;
    try {
      await sched.buildDescriptor({ schedule, db, pgEnv: DAMA_TEST_DB });
    } catch (e) {
      threw = true;
      assert(/raw view/i.test(e.message), `should mention raw views, got: ${e.message}`);
    }
    assert(threw, 'should throw with no covering raw view');
    // restore
    await db.query(`UPDATE views SET metadata = $1 WHERE view_id = $2`,
      [JSON.stringify({ start_date: plusDays(window.startDate, -20), end_date: plusDays(window.endDate, 3) }), rawCovering.view_id]);
  });

  await test('buildDescriptor throws (→ BLOCKED) without npmrds_raw_source_id', async () => {
    let threw = false;
    try {
      await sched.buildDescriptor({
        schedule: { ...schedule, descriptor: {} }, db, pgEnv: DAMA_TEST_DB,
      });
    } catch (e) {
      threw = true;
      assert(/npmrds_raw_source_id/.test(e.message), `should mention the param, got: ${e.message}`);
    }
    assert(threw, 'npmrds_raw_source_id is required');
  });

  // ── date-gap preflight (the legacy isNextDay check, now LOUD) ────────────

  await test('preflight passes when the prod end_date abuts the window start', async () => {
    const verdict = await sched.preflight({
      schedule, descriptor: builtDescriptor, db, pgEnv: DAMA_TEST_DB,
    });
    assert(verdict.ok === true, `should pass, got ${JSON.stringify(verdict)}`);
  });

  await test('preflight BLOCKS on a date gap (prod end_date does not abut)', async () => {
    await db.query(`UPDATE views SET metadata = $1 WHERE view_id = $2`,
      [JSON.stringify({ start_date: '2025-01-01', end_date: plusDays(window.startDate, -9) }), prodView.view_id]);
    const verdict = await sched.preflight({
      schedule, descriptor: builtDescriptor, db, pgEnv: DAMA_TEST_DB,
    });
    assert(verdict.ok === false, 'should block on gap');
    assert(/gap|abut|end_date/i.test(verdict.reason || ''), `reason should explain the gap, got: ${verdict.reason}`);
  });

  await test('preflight passes when the prod view has no end_date yet (initial population)', async () => {
    await db.query(`UPDATE views SET metadata = $1 WHERE view_id = $2`,
      [JSON.stringify({}), prodView.view_id]);
    const verdict = await sched.preflight({
      schedule, descriptor: builtDescriptor, db, pgEnv: DAMA_TEST_DB,
    });
    assert(verdict.ok === true, `no prior window should pass, got ${JSON.stringify(verdict)}`);
  });

  console.log(`\n  ${passed} passing, ${failed} failing\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => { console.error('Test runner error:', err); process.exit(1); });
