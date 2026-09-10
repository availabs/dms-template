/**
 * Integration test (phase 1): the work_zone/spine worker.
 *
 * Runs the real worker over a synthetic TRANSCOM window, with the physical
 * Postgres side faked (PostGIS geometry, SERIAL, gist indexes) while the
 * data_manager reads and writes go to the sqlite harness — the
 * data-types/npmrds pattern. The fake records every statement, so the test can
 * assert on the SQL the worker would run as well as on the rows it built.
 *
 * No TRANSCOM, RITIS, ClickHouse or network contact.
 *
 * Run: node data-types/work_zone/tests/spine.integration.js
 */
const DAMA_TEST_DB = process.env.DAMA_TEST_DB || 'dama-sqlite-test';

let passed = 0, failed = 0;
function assert(c, m) { if (!c) throw new Error(`Assertion failed: ${m}`); }
async function test(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.log(`  ✗ ${name}: ${err.message}`); failed++; }
}
const parseJson = (v) => (typeof v === 'string' ? JSON.parse(v || '{}') : (v || {}));

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

// ── the fixture: three chains on two facilities, plus rows that must be dropped ──
const ev = (over) => ({
  event_id: over.event_id,
  event_type: 'Construction',
  state: 'NY',
  state_code: 36,
  facility: 'I-81',
  direction: 'SOUTHBOUND',
  primary_direction: null,
  county_name: 'ONONDAGA',
  region_name: 'Region 03 - Syracuse',
  description: 'Construction, milling on I-81 southbound between Exit 24 and Exit 25',
  summary_description: null,
  start_date_time: over.day,
  close_date: over.day,
  lanes_total_count: 3,
  lanes_affected_count: 1,
  estimated_duration_mins: 480,
  tmclist: '104P11905',
  f_system: 1,
  nysdot_general_category: 'Construction',
  nysdot_sub_category: 'Construction',
  ...over,
});

const FIXTURE_EVENTS = [
  // chain A — 4 consecutive nights on an Interstate in the Syracuse TMA → significant
  ev({ event_id: 'A1', day: '2024-03-01T21:00:00Z' }),
  ev({ event_id: 'A2', day: '2024-03-02T21:00:00Z' }),
  ev({ event_id: 'A3', day: '2024-03-03T21:00:00Z' }),
  ev({ event_id: 'A4', day: '2024-03-04T21:00:00Z' }),
  // chain A, second mobilisation 20 days later → a separate work zone
  ev({ event_id: 'A9', day: '2024-03-25T21:00:00Z' }),
  // chain B — 2 nights only → not significant (fails the duration test)
  ev({ event_id: 'B1', day: '2024-03-05T21:00:00Z', facility: 'I-690', description: 'Construction, paving on I-690' }),
  ev({ event_id: 'B2', day: '2024-03-06T21:00:00Z', facility: 'I-690', description: 'Construction, paving on I-690' }),
  // chain C — a non-Interstate arterial, 5 nights → not significant
  ev({ event_id: 'C1', day: '2024-03-05T21:00:00Z', facility: 'NY 5', description: 'Construction, paving on NY 5' }),
  ev({ event_id: 'C2', day: '2024-03-06T21:00:00Z', facility: 'NY 5', description: 'Construction, paving on NY 5' }),
  ev({ event_id: 'C3', day: '2024-03-07T21:00:00Z', facility: 'NY 5', description: 'Construction, paving on NY 5' }),
  // must be dropped: not a work zone
  ev({ event_id: 'X1', day: '2024-03-02T10:00:00Z', event_type: 'Police department activity', nysdot_sub_category: 'Emergency Operations' }),
  ev({ event_id: 'X2', day: '2024-03-02T10:00:00Z', event_type: 'Plowing and salting', nysdot_sub_category: 'Maintenance' }),
  // must be dropped: not New York
  ev({ event_id: 'X3', day: '2024-03-02T10:00:00Z', state: 'CT', state_code: 9 }),
  // an unrecognised type — must be reported, not silently kept or dropped
  ev({ event_id: 'X4', day: '2024-03-02T10:00:00Z', event_type: 'Orbital Laser Repair' }),
];

const FIXTURE_META = [
  { tmc: '104P11905', length: 0.42, aadt: 51000, f_system: 1, tmclinear: 12, road_order: 3,
    direction: 'SOUTHBOUND', road_name: 'I-81', ua_code: 86302 },      // Syracuse TMA
  { tmc: '104P11906', length: 0.55, aadt: 48000, f_system: 1, tmclinear: 12, road_order: 4,
    direction: 'SOUTHBOUND', road_name: 'I-81', ua_code: 86302 },
];

/** event_id → impact TMCs, as view 2799 would report them. */
const FIXTURE_EVENT_TMC = [
  { event_id: 'A1', tmc: '104P11905' },   // the anchor, must not be double counted
  { event_id: 'A1', tmc: '104P11906' },
  { event_id: 'A2', tmc: '104P11906' },
];

/** Records every statement; answers the three reads the worker makes. */
function fakePgDb() {
  const statements = [];
  return {
    type: 'postgres',
    statements,
    async query(text, params) {
      statements.push({ text: String(text), params });
      const t = String(text).trim();
      // Only the three reads are answered; DDL, DELETE and INSERT return nothing.
      // Matched on the qualified table the worker resolved (transcom.transcom_events
      // etc.), and only for SELECTs — the wz_event_tmc INSERT also mentions
      // npmrds_meta in its geometry join.
      if (/^SELECT/i.test(t)) {
        if (/transcom\.transcom_events/.test(t)) return { rows: FIXTURE_EVENTS };
        if (/transcom\.event_tmc/.test(t)) {
          const ids = new Set((params && params[0]) || []);
          return { rows: FIXTURE_EVENT_TMC.filter((r) => ids.has(r.event_id)) };
        }
        if (/npmrds_geometry\.npmrds_meta/.test(t)) {
          const tmcs = new Set((params && params[0]) || []);
          return { rows: FIXTURE_META.filter((r) => tmcs.has(r.tmc)) };
        }
      }
      return { rows: [] };
    },
  };
}

async function runTests() {
  console.log(`\n=== work_zone/spine worker (${DAMA_TEST_DB}) ===\n`);
  await setup();

  const { getDb } = require('@availabs/dms-server/src/db');
  const metadata = require('@availabs/dms-server/src/dama/upload/metadata');
  const db = getDb(DAMA_TEST_DB);
  const { makeSpine } = require('../workers/spine.js');
  const sql = require('../sql.js');

  // Upstream sources + views, so the worker resolves tables the way it will in production.
  const mkSource = (name, type) => metadata.createDamaSource({ name, type, user_id: 1 }, DAMA_TEST_DB);
  const transcom = await mkSource(`transcom_${Date.now()}`, 'transcom');
  const meta = await mkSource(`npmrds_meta_${Date.now()}`, 'npmrds_meta');
  const eventTmc = await mkSource(`transcom_event_tmc_${Date.now()}`, 'transcom_event_tmc');
  const wzEvent = await mkSource(`wz_event_${Date.now()}`, 'wz_event');

  const mkView = async (source_id, schema, table, meta_ = {}) => {
    const v = await metadata.createDamaView({ source_id, user_id: 1 }, DAMA_TEST_DB);
    await db.query(
      `UPDATE views SET table_schema = $1, table_name = $2, data_table = $3, metadata = $4 WHERE view_id = $5`,
      [schema, table, `${schema}.${table}`, JSON.stringify(meta_), v.view_id]);
    return v;
  };
  await mkView(transcom.source_id, 'transcom', 'transcom_events');
  await mkView(meta.source_id, 'npmrds_geometry', 'npmrds_meta', { is_clickhouse_table: 0 });
  await mkView(eventTmc.source_id, 'transcom', 'event_tmc');

  const pg = fakePgDb();
  const spine = makeSpine({
    getPgDb: () => pg,
    createDamaView: metadata.createDamaView,
    createDamaSource: metadata.createDamaSource,
  });

  const events = [];
  const ctx = (descriptor) => ({
    task: { task_id: 1, descriptor },
    pgEnv: DAMA_TEST_DB,
    db,
    dispatchEvent: async (type, msg, payload) => { events.push({ type, msg, payload }); },
    updateProgress: async () => {},
  });

  const descriptor = {
    source_id: wzEvent.source_id,
    transcom_source_id: transcom.source_id,
    npmrds_meta_source_id: meta.source_id,
    transcom_event_tmc_source_id: eventTmc.source_id,
    start_date: '2024-03-01',
    end_date: '2024-03-31',
    user_id: 1,
  };

  let result;
  await test('runs end to end and reports what it built', async () => {
    result = await spine(ctx(descriptor));
    assert(result.source_id === wzEvent.source_id, 'returns the wz_event source id');
    assert(result.wz_event_tmc_source_id, 'creates and returns the wz_event_tmc source');
    assert(result.view_id && result.tmc_view_id, 'creates both views');
  });

  await test('keeps only NY work-zone events and reports unknown event types', () => {
    const classified = events.find((e) => e.type === 'work_zone/spine:CLASSIFIED');
    assert(classified, 'dispatches a CLASSIFIED event');
    // 10 in-scope: A1-A4, A9, B1-B2, C1-C3. Dropped: police, plowing, CT, unknown.
    assert(classified.payload.in_scope === 10, `10 events in scope (got ${classified.payload.in_scope})`);
    assert(classified.payload.read === FIXTURE_EVENTS.length, 'reports how many it read');
    const unknown = events.find((e) => e.type === 'work_zone/spine:UNKNOWN_EVENT_TYPES');
    assert(unknown, 'reports the unrecognised event_type rather than dropping it silently');
    assert(unknown.payload.unknown[0].event_type === 'Orbital Laser Repair', 'names the unknown type');
  });

  await test('reconciles the legacy family count alongside scope', () => {
    const classified = events.find((e) => e.type === 'work_zone/spine:CLASSIFIED');
    // legacy family = sub_category in (Construction, Maintenance, Emergency Operations) AND NY:
    // the 10 in-scope + police + plowing + the unknown type (all NY, sub Construction) = 13
    assert(classified.payload.legacy_family === 13,
      `legacy family counts differently from scope (got ${classified.payload.legacy_family})`);
  });

  await test('collapses chains and splits on the gap', () => {
    const deduped = events.find((e) => e.type === 'work_zone/spine:DEDUPED');
    // A(4 nights) + A9(separate mobilisation) + B(2) + C(3) = 4 work zones
    assert(deduped.payload.work_zones === 4, `4 work zones (got ${deduped.payload.work_zones})`);
    assert(result.work_zones === 4, 'the result agrees');
  });

  await test('applies the significance rule to the right zone only', () => {
    assert(result.significant_candidates === 1,
      `only chain A qualifies (got ${result.significant_candidates})`);
  });

  await test('writes wz_event rows with the anchor/impact split and no double-counted anchor', () => {
    const inserts = pg.statements.filter((s) => /INSERT INTO work_zone\..*_wz_event_tmc/.test(s.text));
    assert(inserts.length === 1, `one wz_event_tmc insert batch (got ${inserts.length})`);
    const body = inserts[0].text;
    assert(/'anchor'/.test(body) && /'impact'/.test(body), 'writes both TMC roles');
    // Every fixture zone shares the same anchor TMC, so it appears once per
    // zone — and never as an impact row, even though view 2799 also lists it.
    const anchorCount = (body.match(/'104P11905', 'anchor'/g) || []).length;
    assert(anchorCount === result.work_zones,
      `the anchor is written once per work zone (got ${anchorCount} for ${result.work_zones} zones)`);
    assert(!/'104P11905', 'impact'/.test(body), 'the anchor is never also an impact row');
    assert(/ST_SetSRID\(m\.wkb_geometry, 4326\)/.test(body), 'geometry values carry SRID 4326');
  });

  await test('replaces its window before inserting, so a re-run cannot duplicate', () => {
    const deletes = pg.statements.filter((s) => /^DELETE FROM work_zone\./.test(s.text.trim()));
    assert(deletes.length === 2, `deletes both tables' windows (got ${deletes.length})`);
    for (const del of deletes) {
      assert(/first_start >= '2024-03-01'/.test(del.text), 'deletes the descriptor window');
      assert(/first_start < \('2024-03-31'::date \+ INTERVAL '1 day'\)/.test(del.text),
        'the window is half-open to end + 1 day, so rows later on the end day are not missed');
    }
    const firstInsert = pg.statements.findIndex((s) => /INSERT INTO work_zone\./.test(s.text));
    const lastDelete = pg.statements.map((s) => s.text).reduce((acc, t, i) => (/^DELETE FROM work_zone\./.test(t.trim()) ? i : acc), -1);
    assert(lastDelete < firstInsert, 'the delete precedes the insert');
  });

  await test('creates both tables with ogc_fid and a 4326 geometry column', () => {
    const ddl = pg.statements.filter((s) => /CREATE TABLE IF NOT EXISTS work_zone\./.test(s.text));
    assert(ddl.length === 2, `two DDL statements (got ${ddl.length})`);
    for (const stmt of ddl) {
      assert(/ogc_fid SERIAL PRIMARY KEY/.test(stmt.text), 'ogc_fid PK — DAMA tiles carry only ogc_fid');
      assert(/public\.geometry\(Geometry, 4326\)/.test(stmt.text), 'geometry column is SRID 4326');
    }
  });

  await test('writes metadata.columns on BOTH sources', async () => {
    const { rows } = await db.query(`SELECT source_id, metadata FROM sources WHERE source_id IN ($1, $2)`,
      [wzEvent.source_id, result.wz_event_tmc_source_id]);
    for (const r of rows) {
      const m = parseJson(r.metadata);
      assert(Array.isArray(m.columns) && m.columns.length > 5,
        `source ${r.source_id} has metadata.columns (got ${m.columns && m.columns.length})`);
      assert(m.schema, `source ${r.source_id} records a schema tag`);
    }
    const evCols = parseJson(rows.find((r) => r.source_id === wzEvent.source_id).metadata).columns;
    assert(evCols.length === sql.WZ_EVENT_TABLE_COLUMNS.length, 'the full wz_event column list');
    assert(evCols.every((c) => c.name && c.display_name && c.type), 'every column has name/display_name/type');
  });

  await test('stamps the run and its config on the view metadata', async () => {
    const { rows } = await db.query(`SELECT metadata, table_schema, table_name FROM views WHERE view_id = $1`, [result.view_id]);
    const m = parseJson(rows[0].metadata);
    assert(rows[0].table_schema === 'work_zone', 'view points at the work_zone schema');
    assert(m.start_date === '2024-03-01' && m.end_date === '2024-03-31', 'records the window');
    assert(m.thresholds && m.thresholds.speed_threshold_mph === 35, 'records the resolved thresholds');
    assert(m.chain_gap_days === 14 && m.min_consecutive_days === 3, 'records the phase-1 config');
    assert(m.work_zones === 4 && m.significant_candidates === 1, 'records the counts');
    assert(Array.isArray(m.unknown_event_types) && m.unknown_event_types.length === 1,
      'carries the unknown event types into the view metadata');
    assert(m.events_legacy_family === 13, 'keeps the reconciliation count');
  });

  await test('a narrower gap parameter splits more chains', async () => {
    const events2 = [];
    const pg2 = fakePgDb();
    const spine2 = makeSpine({ getPgDb: () => pg2, createDamaView: metadata.createDamaView, createDamaSource: metadata.createDamaSource });
    const r = await spine2({
      task: { task_id: 2, descriptor: { ...descriptor, chain_gap_days: 1 } },
      pgEnv: DAMA_TEST_DB, db,
      dispatchEvent: async (t, m, p) => { events2.push({ type: t, payload: p }); },
      updateProgress: async () => {},
    });
    // chain A's 4 consecutive nights still hold at gap 1; A9 still splits; B and C hold.
    assert(r.work_zones === 4, `same 4 zones at gap 1 (got ${r.work_zones})`);
    const r2 = await makeSpine({ getPgDb: () => fakePgDb(), createDamaView: metadata.createDamaView, createDamaSource: metadata.createDamaSource })({
      task: { task_id: 3, descriptor: { ...descriptor, min_consecutive_days: 5 } },
      pgEnv: DAMA_TEST_DB, db, dispatchEvent: async () => {}, updateProgress: async () => {},
    });
    assert(r2.significant_candidates === 0, `a 5-day threshold disqualifies chain A (got ${r2.significant_candidates})`);
  });

  await test('a wider scope brings winter operations into the population', async () => {
    const r = await makeSpine({ getPgDb: () => fakePgDb(), createDamaView: metadata.createDamaView, createDamaSource: metadata.createDamaSource })({
      task: { task_id: 4, descriptor: { ...descriptor, scope_classes: ['construction', 'maintenance', 'utility', 'winter_operations'] } },
      pgEnv: DAMA_TEST_DB, db, dispatchEvent: async () => {}, updateProgress: async () => {},
    });
    assert(r.work_zones === 5, `plowing adds a fifth zone (got ${r.work_zones})`);
  });

  console.log(`\n  ${passed} passing, ${failed} failing\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => { console.error('Test runner error:', err); process.exit(1); });
