/**
 * Integration test: the excessive_delay schedulable (monthly add).
 *  - buildDescriptor: previous-complete-month { years, months } in mode 'add',
 *    reusing the npmrds/transcom table refs the publish worker stored on the
 *    latest view's metadata (same self-contained-descriptor contract as the
 *    /add route).
 *
 * Node/sqlite harness — NO ClickHouse.
 * Run: node data-types/excessive_delay/tests/schedule.integration.js
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
  console.log(`\n=== excessive_delay schedulable (${DAMA_TEST_DB}) ===\n`);
  await setup();

  const metadata = require('@availabs/dms-server/src/dama/upload/metadata');
  const { getDb } = require('@availabs/dms-server/src/db');
  const db = getDb(DAMA_TEST_DB);
  const plugin = require('../index.js');
  const delay = require('../delay.js');
  const sched = plugin.schedulables && plugin.schedulables['excessive_delay/publish'];

  await test('plugin exposes the excessive_delay/publish schedulable', async () => {
    assert(sched, 'schedulables["excessive_delay/publish"] should exist');
    assert(typeof sched.buildDescriptor === 'function', 'has buildDescriptor');
    assert(sched.label && sched.defaultCron, 'has label + defaultCron');
  });

  const refs = {
    npmrds_production_source_id: 11,
    npmrds_production_view_id: 110,
    npmrds_prod_table: 'npmrds_production.s11_v110',
    npmrds_meta_view_id: 111,
    npmrds_meta_table: 'npmrds_production.s12_v111_meta',
    transcom_source_id: 13,
    transcom_view_id: 130,
    transcom_table: 'gis_datasets.s13_v130_transcom',
  };

  const edSource = await metadata.createDamaSource(
    { name: `sched_ed_${Date.now()}`, type: 'excessive_delay' }, DAMA_TEST_DB);
  const edView = await metadata.createDamaView({ source_id: edSource.source_id }, DAMA_TEST_DB);
  await db.query(`UPDATE views SET metadata = $1 WHERE view_id = $2`,
    [JSON.stringify({ years: [2025], ...refs }), edView.view_id]);

  await test('buildDescriptor: previous-complete-month in mode add, refs from view metadata', async () => {
    const d = await sched.buildDescriptor({
      schedule: {
        schedule_id: 5,
        source_id: edSource.source_id,
        descriptor: { methodology: 'v2', region: 'NY', user_id: 6, email: 'x@y.z' },
      },
      db, pgEnv: DAMA_TEST_DB,
    });
    const expected = delay.previousCompleteMonth();
    assert(d.mode === 'add', `mode should be add, got ${d.mode}`);
    assert(JSON.stringify(d.years) === JSON.stringify([expected.year]), `years [${expected.year}], got ${JSON.stringify(d.years)}`);
    assert(JSON.stringify(d.months) === JSON.stringify([expected.month]), `months [${expected.month}], got ${JSON.stringify(d.months)}`);
    assert(+d.source_id === +edSource.source_id, 'source_id from schedule');
    assert(+d.view_id === +edView.view_id, 'resolves the latest view');
    assert(d.name, 'carries the source name');
    assert(d.methodology === 'v2', 'methodology carried');
    assert(d.region === 'NY', 'region param carried');
    for (const [k, v] of Object.entries(refs)) {
      assert(String(d[k]) === String(v), `ref ${k} should be ${v}, got ${d[k]}`);
    }
  });

  await test('buildDescriptor throws (→ BLOCKED) when the view metadata carries no refs', async () => {
    const bareSource = await metadata.createDamaSource(
      { name: `sched_ed_bare_${Date.now()}`, type: 'excessive_delay' }, DAMA_TEST_DB);
    const bareView = await metadata.createDamaView({ source_id: bareSource.source_id }, DAMA_TEST_DB);
    await db.query(`UPDATE views SET metadata = $1 WHERE view_id = $2`,
      [JSON.stringify({}), bareView.view_id]);
    let threw = false;
    try {
      await sched.buildDescriptor({
        schedule: { schedule_id: 5, source_id: bareSource.source_id, descriptor: {} },
        db, pgEnv: DAMA_TEST_DB,
      });
    } catch (e) {
      threw = true;
      assert(/refs|npmrds/i.test(e.message), `should mention missing refs, got: ${e.message}`);
    }
    assert(threw, 'should throw without refs');
  });

  await test('buildDescriptor throws (→ BLOCKED) when the source has no view', async () => {
    const noViewSource = await metadata.createDamaSource(
      { name: `sched_ed_noview_${Date.now()}`, type: 'excessive_delay' }, DAMA_TEST_DB);
    let threw = false;
    try {
      await sched.buildDescriptor({
        schedule: { schedule_id: 5, source_id: noViewSource.source_id, descriptor: {} },
        db, pgEnv: DAMA_TEST_DB,
      });
    } catch (e) { threw = true; }
    assert(threw, 'should throw without a view');
  });

  console.log(`\n  ${passed} passing, ${failed} failing\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => { console.error('Test runner error:', err); process.exit(1); });
