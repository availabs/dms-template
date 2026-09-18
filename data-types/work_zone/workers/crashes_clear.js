/**
 * work_zone/crashes_clear — the NYSDOT CLEAR extract, typed (phase 7).
 *
 * Reads a raw CLEAR crash table (the `clear_crash_raw` view the loader or the
 * platform uploader created — every column TEXT, exactly as the CSV came) and
 * publishes `nys_crashes_clear`: one row per crash with the KABCO letter, the
 * severity class, the five-minute epoch, the work-zone code and the FHWA
 * functional class derived once (lib/crashes.js), and a point with SRID 4326
 * in the value. One view per calendar-year vintage.
 *
 * The statewide work-zone-coded series — the form NYSDOT already reports M5
 * in — is rolled up onto the view as `metadata.m5_statewide` while the rows
 * stream past, so nothing has to be recounted from 380 k rows.
 *
 * ── The window ────────────────────────────────────────────────────────────
 * The stage is declared file-driven (no window required), but the vintage
 * convention still holds: when the descriptor gives no window the run takes
 * the raw table's own date span, and rows outside a given window are skipped.
 *
 * Dependency-injected via makeCrashesClear(deps) so the integration test
 * fakes the physical side. ctx: { task, pgEnv, db, dispatchEvent, updateProgress }
 */
const crashes = require('../lib/crashes.js');
const { STAGES } = require('../stages.js');
const sql = require('../sql.js');

function defaultDeps() {
  const dbMod = require('@availabs/dms-server/src/db');
  const metadata = require('@availabs/dms-server/src/dama/upload/metadata');
  return { getPgDb: dbMod.getDb, createDamaView: metadata.createDamaView };
}

const tableFor = (db, base) => (db.type === 'postgres' ? `data_manager.${base}` : base);
const parseJson = (v) => (typeof v === 'string' ? (v ? JSON.parse(v) : {}) : (v || {}));
const qualified = (v) => v.data_table || (v.table_schema ? `"${v.table_schema}"."${v.table_name}"` : v.table_name);

async function mergeJsonColumn(db, table, idCol, id, col, patch) {
  const { rows } = await db.query(`SELECT ${col} FROM ${table} WHERE ${idCol} = $1`, [id]);
  const next = { ...parseJson(rows[0] && rows[0][col]), ...patch };
  await db.query(`UPDATE ${table} SET ${col} = $1 WHERE ${idCol} = $2`, [JSON.stringify(next), id]);
  return next;
}

/** A counter object for the statewide rollup, fed one shaped row at a time. */
function newStatewide() {
  return {
    crashes: 0, with_point: 0, time_known: 0, time_uncertain: 0,
    by_severity: {}, by_kabco: {}, by_month: {},
    wz_coded: 0, wz_by_code: {}, wz_by_severity: {}, wz_by_kabco: {}, wz_by_month: {},
    wz_interstate: 0, wz_not_interstate: 0, wz_fc_unknown: 0,
    flagger_coded: 0, flagger_by_severity: {},
    fatalities: 0, injuries: 0, wz_fatalities: 0, wz_injuries: 0,
    dmv_insert_max: null, dmv_insert_by_month: {},
  };
}
function bump(obj, key) { const k = key === null || key === undefined ? 'null' : String(key); obj[k] = (obj[k] || 0) + 1; }
function feedStatewide(s, r) {
  s.crashes += 1;
  if (r.has_point) s.with_point += 1;
  if (r.time_known) s.time_known += 1;
  if (r.time_uncertain) s.time_uncertain += 1;
  bump(s.by_severity, r.severity_class); bump(s.by_kabco, r.severity_kabco);
  const month = r.crash_date ? r.crash_date.slice(0, 7) : 'null';
  bump(s.by_month, month);
  s.fatalities += r.n_fatalities || 0; s.injuries += r.n_injuries || 0;
  if (r.dmv_insert_date) {
    if (!s.dmv_insert_max || r.dmv_insert_date > s.dmv_insert_max) s.dmv_insert_max = r.dmv_insert_date;
    bump(s.dmv_insert_by_month, r.dmv_insert_date.slice(0, 7));
  }
  if (r.wz_coded) {
    s.wz_coded += 1; bump(s.wz_by_code, r.wz_code); bump(s.wz_by_severity, r.severity_class);
    bump(s.wz_by_kabco, r.severity_kabco); bump(s.wz_by_month, month);
    if (r.fc_interstate === true) s.wz_interstate += 1;
    else if (r.fc_interstate === false) s.wz_not_interstate += 1;
    else s.wz_fc_unknown += 1;
    s.wz_fatalities += r.n_fatalities || 0; s.wz_injuries += r.n_injuries || 0;
  }
  if (r.flagger_coded) { s.flagger_coded += 1; bump(s.flagger_by_severity, r.severity_class); }
}

function makeCrashesClear(depOverrides = {}) {
  const deps = { ...defaultDeps(), ...depOverrides };

  return async function crashesClear(ctx) {
    const { task, pgEnv, db, dispatchEvent, updateProgress } = ctx;
    const d = (task && task.descriptor) || {};
    const spec = STAGES.crashes_clear;

    const rawViewId = d.file_upload_view_id ?? d.clear_raw_view_id;
    if (rawViewId === undefined || rawViewId === null || rawViewId === '') {
      throw new Error(`work_zone/crashes_clear: descriptor is missing ${spec.inputs.join(', ')}`);
    }
    const say = (t, m, p) => (dispatchEvent ? dispatchEvent(t, m, p) : Promise.resolve());
    const pgDb = deps.getPgDb(pgEnv);

    // ── the raw view ──
    const { rows: rv } = await db.query(
      `SELECT view_id, source_id, table_schema, table_name, data_table, metadata FROM ${tableFor(db, 'views')} WHERE view_id = $1`,
      [rawViewId]);
    if (!rv[0] || !rv[0].table_name) throw new Error(`work_zone/crashes_clear: view ${rawViewId} has no table`);
    const rawView = { ...rv[0], metadata: parseJson(rv[0].metadata) };
    const rawTable = qualified(rawView);

    // ── the window: the descriptor's, else the raw table's own span ──
    let startDate = d.start_date ? String(d.start_date).slice(0, 10) : null;
    let endDate = d.end_date ? String(d.end_date).slice(0, 10) : null;
    if (!startDate || !endDate) {
      const { rows } = await pgDb.query(
        `SELECT to_char(min("CrashDate"::timestamp), 'YYYY-MM-DD') AS min_date,
                to_char(max("CrashDate"::timestamp), 'YYYY-MM-DD') AS max_date
           FROM ${rawTable}`);
      startDate = startDate || (rows[0] && rows[0].min_date);
      endDate = endDate || (rows[0] && rows[0].max_date);
    }
    if (!startDate || !endDate) throw new Error('work_zone/crashes_clear: could not determine a date window');

    await say('work_zone/crashes_clear:INITIAL', 'CLEAR typing run started', {
      source_id: d.source_id, raw_view_id: rawView.view_id, raw_table: rawTable, start_date: startDate, end_date: endDate,
    });

    // ── provision ──
    const view = d.target_view_id
      ? { view_id: d.target_view_id }
      : await deps.createDamaView({ source_id: d.source_id, user_id: d.user_id ?? null }, pgEnv);
    const schema = sql.WORK_ZONE_SCHEMA;
    const table = sql.tableNameFor({ source_id: d.source_id, view_id: view.view_id, stage: 'nys_crashes_clear' });
    await pgDb.query(sql.nysCrashesClearTableDDL(schema, table));
    await pgDb.query(sql.deleteWindowSQL({ schema, table, dateColumn: 'crash_date', startDate, endDate }));
    await updateProgress(0.1);

    // ── stream the raw rows through the shaper, in pages, keyed on ogc_fid ──
    const PAGE = Number(d.page_size) || 20000;
    const CHUNK = 1000;
    const statewide = newStatewide();
    let lastFid = 0; let read = 0; let written = 0; let skippedWindow = 0; let skippedNoId = 0;
    let buffer = [];
    const flush = async () => {
      if (!buffer.length) return;
      await pgDb.query(sql.nysCrashesClearInsertSQL({ schema, table, rows: buffer }));
      written += buffer.length; buffer = [];
    };
    for (;;) {
      const { rows } = await pgDb.query(
        `SELECT * FROM ${rawTable} WHERE ogc_fid > $1 ORDER BY ogc_fid LIMIT ${PAGE}`, [lastFid]);
      if (!rows.length) break;
      for (const raw of rows) {
        lastFid = Number(raw.ogc_fid) || lastFid;
        read += 1;
        const r = crashes.shapeCrashRow(raw);
        if (!r.crash_id) { skippedNoId += 1; continue; }
        if (!r.crash_date || r.crash_date < startDate || r.crash_date > endDate) { skippedWindow += 1; continue; }
        feedStatewide(statewide, r);
        buffer.push(r);
        if (buffer.length >= CHUNK) await flush();
      }
      if (rows.length < PAGE) break;
    }
    await flush();
    await updateProgress(0.9);
    await say('work_zone/crashes_clear:TYPED', `${written} crashes typed`, {
      read, written, skipped_outside_window: skippedWindow, skipped_no_case_number: skippedNoId,
      wz_coded: statewide.wz_coded, flagger_coded: statewide.flagger_coded,
    });

    // ── metadata ──
    const viewsTable = tableFor(db, 'views');
    await db.query(
      `UPDATE ${viewsTable} SET table_schema = $1, table_name = $2, data_table = $3, version = $5 WHERE view_id = $4`,
      [schema, table, `${schema}.${table}`, view.view_id, sql.vintageVersion({ startDate, endDate })]);
    const runMeta = {
      is_clickhouse_table: 0,
      start_date: startDate, end_date: endDate,
      raw_view_id: rawView.view_id, raw_source_id: rawView.source_id, raw_table: rawTable,
      raw_metadata: {
        csv_path: rawView.metadata.csv_path ?? null, rows: rawView.metadata.rows ?? null,
        loaded_at: rawView.metadata.loaded_at ?? null, dmv_insert_max: rawView.metadata.dmv_insert_max ?? null,
      },
      rows_read: read, rows_written: written,
      skipped_outside_window: skippedWindow, skipped_no_case_number: skippedNoId,
      wz_attribution: 'TrafficControl in (HIGHWAY WORK AREA, MAINTENANCE WORK AREA, UTILITY WORK AREA); no contributing-factor value exists in CLEAR for work zones',
      // the completeness clock: the newest DMV insert in the file says how stale the extract is
      dmv_insert_max: statewide.dmv_insert_max,
      m5_statewide: statewide,
    };
    await mergeJsonColumn(db, viewsTable, 'view_id', view.view_id, 'metadata', runMeta);
    await mergeJsonColumn(db, tableFor(db, 'sources'), 'source_id', d.source_id, 'metadata', {
      columns: sql.NYS_CRASHES_CLEAR_TABLE_COLUMNS, schema: 'nys_crashes_clear_v1',
      raw_source_id: rawView.source_id,
    });
    await updateProgress(1);
    await say('work_zone/crashes_clear:FINAL', 'CLEAR typing complete', {
      source_id: d.source_id, view_id: view.view_id, rows: written,
      wz_coded: statewide.wz_coded, wz_by_severity: statewide.wz_by_severity, dmv_insert_max: statewide.dmv_insert_max,
    });
    return { source_id: d.source_id, view_id: view.view_id, rows: written, read, statewide };
  };
}

module.exports = makeCrashesClear();
module.exports.makeCrashesClear = makeCrashesClear;
