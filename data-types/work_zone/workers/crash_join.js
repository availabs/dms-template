/**
 * work_zone/crash_join — M5, crashes located in active work zones (phase 7).
 *
 * Produces two outputs per vintage:
 *   wz_crash        one row per work zone — crashes inside the zone while
 *                   active, by role (work extent / upstream queue) and by
 *                   severity, the coded and flagger counts among them, the
 *                   exposure denominator from phase 2 and the rate per
 *                   100 million VMT
 *   wz_crash_match  one row per (crash, zone) — the evidence: distance, role,
 *                   in-window or how far outside, the crash's point
 *
 * ── Shape of the run ──────────────────────────────────────────────────────
 *  1. Resolve the spine and its wz_event_tmc view for THIS window, the typed
 *     crash view (nys_crashes_clear), and where given the exposure and queue
 *     views, all by source id.
 *  2. Stage two run-scoped TEMP tables in Postgres: the zones' active
 *     windows (lib/windows.js — the same minutes phases 3 and 5 measured on)
 *     and the zones' probe geometries (queue extent where phase 5 measured
 *     one — it already contains the anchor — else the anchor alone).
 *  3. One PostGIS query (lib/crashes.js crashMatchSQL): every crash within
 *     `crash_buffer_m` of a probe geometry on a date inside the zone's span,
 *     with the role decided by distance to the anchor and the active windows
 *     deciding in-window.
 *  4. Roll the matches up per zone, attach exposure, compute the rate only
 *     where exposure is complete, write both tables, stamp both views and
 *     both sources with M5 and the coded-versus-located cross-check.
 *
 * Dependency-injected via makeCrashJoin(deps) so the integration test fakes
 * the physical side. ctx: { task, pgEnv, db, dispatchEvent, updateProgress }
 */
const { activeWindowsSQL } = require('../lib/windows.js');
const crashes = require('../lib/crashes.js');
const { STAGES } = require('../stages.js');
const sql = require('../sql.js');

function defaultDeps() {
  const dbMod = require('@availabs/dms-server/src/db');
  const metadata = require('@availabs/dms-server/src/dama/upload/metadata');
  return {
    getPgDb: dbMod.getDb,
    createDamaView: metadata.createDamaView,
    createDamaSource: metadata.createDamaSource,
  };
}

const tableFor = (db, base) => (db.type === 'postgres' ? `data_manager.${base}` : base);
const parseJson = (v) => (typeof v === 'string' ? (v ? JSON.parse(v) : {}) : (v || {}));
const qualified = (v) => v.data_table || (v.table_schema ? `"${v.table_schema}"."${v.table_name}"` : v.table_name);
const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const round = (v, p = 4) => (v === null ? null : Math.round(v * 10 ** p) / 10 ** p);

async function mergeJsonColumn(db, table, idCol, id, col, patch) {
  const { rows } = await db.query(`SELECT ${col} FROM ${table} WHERE ${idCol} = $1`, [id]);
  const next = { ...parseJson(rows[0] && rows[0][col]), ...patch };
  await db.query(`UPDATE ${table} SET ${col} = $1 WHERE ${idCol} = $2`, [JSON.stringify(next), id]);
  return next;
}

async function viewsForSource(db, sourceId) {
  const { rows } = await db.query(
    `SELECT view_id, source_id, table_schema, table_name, data_table, version, metadata
       FROM ${tableFor(db, 'views')} WHERE source_id = $1 ORDER BY view_id DESC`, [sourceId]);
  return rows.map((r) => ({ ...r, metadata: parseJson(r.metadata) }));
}

/** The view of `sourceId` whose recorded window covers the descriptor's year. */
async function resolveYearView(db, sourceId, startDate, label, { optional = false } = {}) {
  const views = (await viewsForSource(db, sourceId)).filter((v) => v.table_name);
  if (!views.length) {
    if (optional) return null;
    throw new Error(`${label}: source ${sourceId} has no view with a table`);
  }
  const year = String(startDate).slice(0, 4);
  const match = views.find((v) => String(v.metadata.start_date || '').slice(0, 4) === year);
  if (!match) {
    if (optional) return null;
    const have = views.map((v) => v.metadata.start_date || v.version || v.view_id).join(', ');
    throw new Error(`${label}: source ${sourceId} has no view for ${year} (has: ${have})`);
  }
  return { view: match, table: qualified(match) };
}

function makeCrashJoin(depOverrides = {}) {
  const deps = { ...defaultDeps(), ...depOverrides };

  return async function crashJoin(ctx) {
    const { task, pgEnv, db, dispatchEvent, updateProgress } = ctx;
    const d = (task && task.descriptor) || {};
    const spec = STAGES.crash_join;

    const missing = spec.inputs.filter((k) => d[k] === undefined || d[k] === null || d[k] === '');
    if (missing.length) throw new Error(`work_zone/crash_join: descriptor is missing ${missing.join(', ')}`);
    if (!d.start_date || !d.end_date) throw new Error('work_zone/crash_join: descriptor is missing start_date/end_date');
    const bufferM = num(d.crash_buffer_m) ?? crashes.DEFAULT_CRASH_BUFFER_M;
    if (!(bufferM > 0)) throw new Error('work_zone/crash_join: crash_buffer_m must be a positive number of metres');

    const say = (t, m, p) => (dispatchEvent ? dispatchEvent(t, m, p) : Promise.resolve());
    await say('work_zone/crash_join:INITIAL', 'crash join started', {
      source_id: d.source_id, start_date: d.start_date, end_date: d.end_date, crash_buffer_m: bufferM,
    });
    const pgDb = deps.getPgDb(pgEnv);

    // ── resolve everything by source id ──
    const spine = await resolveYearView(db, d.wz_event_source_id, d.start_date, 'wz_event');
    const tmcSourceId = d.wz_event_tmc_source_id
      ?? parseJson((await db.query(`SELECT metadata FROM ${tableFor(db, 'sources')} WHERE source_id = $1`,
        [d.wz_event_source_id])).rows[0]?.metadata).wz_event_tmc_source_id;
    if (!tmcSourceId) throw new Error('work_zone/crash_join: cannot resolve the wz_event_tmc source');
    const tmcView = await resolveYearView(db, tmcSourceId, d.start_date, 'wz_event_tmc');
    const crashView = await resolveYearView(db, d.crash_source_id, d.start_date, 'nys_crashes_clear');
    const exposure = d.wz_exposure_source_id
      ? await resolveYearView(db, d.wz_exposure_source_id, d.start_date, 'wz_exposure', { optional: true }) : null;
    const queue = d.wz_queue_source_id
      ? await resolveYearView(db, d.wz_queue_source_id, d.start_date, 'wz_queue', { optional: true }) : null;

    await say('work_zone/crash_join:RESOLVED', 'inputs resolved', {
      wz_event: spine.table, wz_event_tmc: tmcView.table, crashes: crashView.table,
      wz_exposure: exposure ? exposure.table : null, wz_queue: queue ? queue.table : null,
      event_tmc_table: d.event_tmc_table,
    });

    // ── zones in the window ──
    const { rows: zones } = await pgDb.query(
      `SELECT wz_event_id, member_event_ids, to_char(first_start,'YYYY-MM-DD HH24:MI:SS') AS first_start,
              to_char(last_end,'YYYY-MM-DD HH24:MI:SS') AS last_end,
              region_name, county_name, facility, work_activity_class,
              is_interstate, in_tma, is_significant_candidate, anchor_tmc
         FROM ${spine.table}
        WHERE first_start >= $1::date AND first_start < ($2::date + INTERVAL '1 day')`,
      [d.start_date, d.end_date]);
    const zoneById = new Map(zones.map((z) => [String(z.wz_event_id), z]));
    await updateProgress(0.1);

    // ── stage: active windows and probe geometries, as run-scoped TEMP tables ──
    const runId = String(Date.now()).slice(-8);
    const ACTIVE = `_wz_crash_active_${runId}`;
    const GEOMS = `_wz_crash_zones_${runId}`;
    let matches = []; let activeHours = []; let codedTotals = {}; let exposureRows = []; let queueZones = 0;
    try {
      // Explicit DDL + INSERT ... SELECT rather than CREATE TABLE AS: parameters
      // are only reliably accepted inside a plain SELECT.
      await pgDb.query(`CREATE TEMP TABLE ${ACTIVE} (
        wz_event_id text, tmc text, date date, window_source text, epoch_from integer, epoch_to integer)`);
      await pgDb.query(`INSERT INTO ${ACTIVE} (wz_event_id, tmc, date, window_source, epoch_from, epoch_to)
        SELECT w.wz_event_id, w.tmc, w.date::date, w.window_source, w.epoch_from, w.epoch_to FROM (
        ${activeWindowsSQL({ spineTable: spine.table, tmcTable: tmcView.table, eventTmcTable: d.event_tmc_table })}
        ) w`, [d.start_date, d.end_date]);
      await pgDb.query(`CREATE INDEX ON ${ACTIVE} (wz_event_id, date)`);
      await pgDb.query(`ANALYZE ${ACTIVE}`);
      // Hours in the windows each zone was matched against — the time-based denominator.
      ({ rows: activeHours } = await pgDb.query(
        `SELECT wz_event_id, sum(epoch_to - epoch_from) / 12.0 AS active_hours, count(*) AS active_days
           FROM ${ACTIVE} GROUP BY wz_event_id`));

      // The probe geometry: the queue extent where phase 5 measured a queue (it
      // is the union of the anchor and the queued upstream segments, so it
      // contains the anchor), else the anchor alone. Geography, so the buffer
      // is metres and the join can use the crash table's geography index.
      const queueJoin = queue
        ? `LEFT JOIN ${queue.table} q ON q.wz_event_id = e.wz_event_id AND q.max_queue_len_mi > 0 AND q.wkb_geometry IS NOT NULL`
        : `LEFT JOIN (SELECT NULL::text AS wz_event_id, NULL::geometry AS wkb_geometry) q ON FALSE`;
      await pgDb.query(`CREATE TEMP TABLE ${GEOMS} (
        wz_event_id text, first_start timestamp, last_end timestamp,
        anchor_geog geography, queue_geog geography, probe_geog geography)`);
      await pgDb.query(`INSERT INTO ${GEOMS} (wz_event_id, first_start, last_end, anchor_geog, queue_geog, probe_geog)
        SELECT e.wz_event_id, e.first_start, e.last_end,
               e.wkb_geometry::geography,
               q.wkb_geometry::geography,
               COALESCE(q.wkb_geometry, e.wkb_geometry)::geography
          FROM ${spine.table} e
          ${queueJoin}
         WHERE e.first_start >= $1::date AND e.first_start < ($2::date + INTERVAL '1 day')
           AND e.wkb_geometry IS NOT NULL`, [d.start_date, d.end_date]);
      await pgDb.query(`CREATE INDEX ON ${GEOMS} USING gist (probe_geog)`);
      await pgDb.query(`ANALYZE ${GEOMS}`);
      ({ rows: [{ n: queueZones } = { n: 0 }] } = await pgDb.query(`SELECT count(*) AS n FROM ${GEOMS} WHERE queue_geog IS NOT NULL`));
      await updateProgress(0.3);

      // ── the match ──
      ({ rows: matches } = await pgDb.query(crashes.crashMatchSQL({
        crashTable: crashView.table, zoneTable: GEOMS, activeTable: ACTIVE, bufferM,
      })));
      await say('work_zone/crash_join:MATCHED', `${matches.length} crash x zone matches`, {
        matches: matches.length, in_window: matches.filter((m) => m.in_window).length,
      });
      await updateProgress(0.6);

      // ── the coded series for the cross-check, and exposure ──
      ({ rows: [codedTotals = {}] } = await pgDb.query(
        `SELECT count(*) AS crashes, count(*) FILTER (WHERE wz_coded) AS wz_coded,
                count(*) FILTER (WHERE wz_coded AND severity_class = 'fatal') AS wz_fatal,
                count(*) FILTER (WHERE wz_coded AND severity_class = 'injury') AS wz_injury,
                count(*) FILTER (WHERE wz_coded AND severity_class = 'pdo') AS wz_pdo,
                count(*) FILTER (WHERE flagger_coded) AS flagger_coded
           FROM ${crashView.table} WHERE crash_date >= $1::date AND crash_date <= $2::date`,
        [d.start_date, d.end_date]));
      if (exposure) {
        ({ rows: exposureRows } = await pgDb.query(
          `SELECT wz_event_id, veh_through_wz, vmt_through_wz, exposure_complete FROM ${exposure.table}`));
      }
    } finally {
      for (const t of [ACTIVE, GEOMS]) {
        try { await pgDb.query(`DROP TABLE IF EXISTS ${t}`); } catch (e) { /* a failed create leaves nothing to drop */ }
      }
    }

    // ── shape the match rows ──
    const matchRows = [];
    const byZone = new Map();
    for (const m of matches) {
      const z = zoneById.get(String(m.wz_event_id));
      if (!z) continue;   // a zone outside this window
      const row = {
        crash_id: String(m.crash_id), wz_event_id: z.wz_event_id, first_start: z.first_start,
        crash_date: String(m.crash_date).slice(0, 10), epoch: num(m.epoch),
        time_known: m.time_known === true, time_uncertain: m.time_uncertain === true,
        role: m.role, distance_m: round(num(m.distance_m), 1),
        dist_anchor_m: round(num(m.dist_anchor_m), 1), dist_queue_m: round(num(m.dist_queue_m), 1),
        in_window: m.in_window === true, active_that_day: m.active_that_day === true,
        epoch_gap: num(m.epoch_gap), window_source: m.window_source || null,
        severity_class: m.severity_class || 'unknown', severity_kabco: m.severity_kabco || null,
        n_fatalities: num(m.n_fatalities), n_injuries: num(m.n_injuries),
        wz_coded: m.wz_coded === true, wz_code: m.wz_code || null, flagger_coded: m.flagger_coded === true,
        on_street: m.on_street || null, facility: z.facility, region_name: z.region_name,
        is_interstate: z.is_interstate, is_significant_candidate: z.is_significant_candidate,
      };
      matchRows.push(row);
      if (!byZone.has(row.wz_event_id)) byZone.set(row.wz_event_id, []);
      byZone.get(row.wz_event_id).push(row);
    }

    // ── per zone ──
    const hoursById = new Map(activeHours.map((r) => [String(r.wz_event_id), r]));
    const exposureById = new Map(exposureRows.map((r) => [String(r.wz_event_id), r]));
    const hasQueueGeom = new Set(matches.filter((m) => m.dist_queue_m !== null && m.dist_queue_m !== undefined).map((m) => String(m.wz_event_id)));
    const zoneRows = [];
    for (const z of zones) {
      const id = String(z.wz_event_id);
      const ms = byZone.get(id) || [];
      const inWin = ms.filter((m) => m.in_window);
      const count = (pred) => inWin.filter(pred).length;
      const sumOf = (k) => inWin.reduce((a, m) => a + (num(m[k]) || 0), 0);
      const h = hoursById.get(id);
      const activeHrs = h ? round(num(h.active_hours), 2) : null;
      const ex = exposureById.get(id);
      const vmt = ex ? num(ex.vmt_through_wz) : null;
      const exposureComplete = ex ? ex.exposure_complete === true : null;
      const rateMeasured = exposureComplete === true && vmt !== null && vmt > 0;
      const total = inWin.length;
      zoneRows.push({
        wz_event_id: id, first_start: z.first_start, last_end: z.last_end,
        region_name: z.region_name, county_name: z.county_name, facility: z.facility,
        work_activity_class: z.work_activity_class, is_interstate: z.is_interstate, in_tma: z.in_tma,
        is_significant_candidate: z.is_significant_candidate,
        anchor_tmc: z.anchor_tmc || null,
        queue_extent_available: hasQueueGeom.has(id),
        buffer_m: bufferM,
        active_hours: activeHrs,
        crashes_total: total,
        crashes_work_extent: count((m) => m.role === 'work_extent'),
        crashes_queue: count((m) => m.role === 'queue'),
        crashes_fatal: count((m) => m.severity_class === 'fatal'),
        crashes_injury: count((m) => m.severity_class === 'injury'),
        crashes_pdo: count((m) => m.severity_class === 'pdo'),
        crashes_unknown: count((m) => m.severity_class === 'unknown'),
        kabco_k: count((m) => m.severity_kabco === 'K'), kabco_a: count((m) => m.severity_kabco === 'A'),
        kabco_b: count((m) => m.severity_kabco === 'B'), kabco_c: count((m) => m.severity_kabco === 'C'),
        kabco_o: count((m) => m.severity_kabco === 'O'),
        n_fatalities: sumOf('n_fatalities'), n_injuries: sumOf('n_injuries'),
        crashes_wz_coded: count((m) => m.wz_coded), crashes_flagger: count((m) => m.flagger_coded),
        crashes_time_uncertain: count((m) => m.time_uncertain),
        crashes_off_window: ms.length - total,
        veh_through_wz: ex ? round(num(ex.veh_through_wz), 1) : null,
        vmt_through_wz: ex ? round(vmt, 1) : null,
        exposure_complete: exposureComplete,
        rate_measured: rateMeasured,
        crash_rate_per_100m_vmt: rateMeasured ? crashes.ratePer100mVmt(total, vmt) : null,
        crash_rate_work_extent_per_100m_vmt: rateMeasured ? crashes.ratePer100mVmt(count((m) => m.role === 'work_extent'), vmt) : null,
        injury_rate_per_100m_vmt: rateMeasured
          ? crashes.ratePer100mVmt(count((m) => m.severity_class === 'fatal' || m.severity_class === 'injury'), vmt) : null,
        crashes_per_1000_active_hours: activeHrs && activeHrs > 0 ? round(total / activeHrs * 1000) : null,
      });
    }

    const tierMeta = new Map(zones.map((z) => [String(z.wz_event_id), {
      is_significant_candidate: z.is_significant_candidate, is_interstate: z.is_interstate,
      span_hours: (new Date(`${String(z.last_end).replace(' ', 'T')}Z`) - new Date(`${String(z.first_start).replace(' ', 'T')}Z`)) / 3600000,
    }]));
    const m5 = crashes.rollupM5(zoneRows);
    const m5ByTier = crashes.rollupM5ByTier(zoneRows, tierMeta);
    const locatedIds = new Set(matchRows.filter((m) => m.in_window).map((m) => m.crash_id));
    const locatedCodedIds = new Set(matchRows.filter((m) => m.in_window && m.wz_coded).map((m) => m.crash_id));
    const nearAnyTimeCodedIds = new Set(matchRows.filter((m) => m.wz_coded).map((m) => m.crash_id));
    await updateProgress(0.75);

    // ── provision: the wz_crash_match source is created here, not by the route ──
    let matchSourceId = d.wz_crash_match_source_id ?? null;
    if (!matchSourceId) {
      const { rows } = await db.query(
        `SELECT source_id FROM ${tableFor(db, 'sources')} WHERE type = $1 ORDER BY source_id DESC LIMIT 1`, ['wz_crash_match']);
      matchSourceId = rows[0] && rows[0].source_id;
    }
    if (!matchSourceId) {
      const created = await deps.createDamaSource({
        name: `wz_crash_match_${d.source_id}`, type: 'wz_crash_match', user_id: d.user_id ?? null,
        metadata: { work_zone_stage: 'crash_join', wz_crash_source_id: d.source_id },
      }, pgEnv);
      matchSourceId = created.source_id;
    }
    const view = d.target_view_id
      ? { view_id: d.target_view_id }
      : await deps.createDamaView({ source_id: d.source_id, user_id: d.user_id ?? null }, pgEnv);
    const matchView = d.target_match_view_id
      ? { view_id: d.target_match_view_id }
      : await deps.createDamaView({ source_id: matchSourceId, user_id: d.user_id ?? null }, pgEnv);

    const schema = sql.WORK_ZONE_SCHEMA;
    const table = sql.tableNameFor({ source_id: d.source_id, view_id: view.view_id, stage: 'wz_crash' });
    const matchTable = sql.tableNameFor({ source_id: matchSourceId, view_id: matchView.view_id, stage: 'wz_crash_match' });
    await pgDb.query(sql.wzCrashTableDDL(schema, table));
    await pgDb.query(sql.wzCrashMatchTableDDL(schema, matchTable));
    await pgDb.query(sql.deleteWindowSQL({ schema, table, dateColumn: 'first_start', startDate: d.start_date, endDate: d.end_date }));
    await pgDb.query(sql.deleteWindowSQL({ schema, table: matchTable, dateColumn: 'first_start', startDate: d.start_date, endDate: d.end_date }));

    const eventTable = spine.view.table_name;
    for (let i = 0; i < zoneRows.length; i += 1000) {
      const stmt = sql.wzCrashInsertSQL({ schema, table, rows: zoneRows.slice(i, i + 1000), eventTable });
      if (stmt) await pgDb.query(stmt);
    }
    for (let i = 0; i < matchRows.length; i += 2000) {
      const stmt = sql.wzCrashMatchInsertSQL({ schema, table: matchTable, rows: matchRows.slice(i, i + 2000), crashTable: crashView.table });
      if (stmt) await pgDb.query(stmt);
    }
    await updateProgress(0.92);

    // ── metadata ──
    const viewsTable = tableFor(db, 'views');
    const sourcesTable = tableFor(db, 'sources');
    const vintage = sql.vintageVersion({ startDate: d.start_date, endDate: d.end_date });
    const setTable = async (viewId, tbl) => db.query(
      `UPDATE ${viewsTable} SET table_schema = $1, table_name = $2, data_table = $3, version = $5 WHERE view_id = $4`,
      [schema, tbl, `${schema}.${tbl}`, viewId, vintage]);
    await setTable(view.view_id, table);
    await setTable(matchView.view_id, matchTable);

    const codedTotal = num(codedTotals.wz_coded) || 0;
    const runMeta = {
      is_clickhouse_table: 0,
      start_date: d.start_date, end_date: d.end_date,
      crash_buffer_m: bufferM,
      roles: 'work_extent = within buffer of the anchor; queue = within buffer of the phase-5 queue extent only',
      wz_event_source_id: d.wz_event_source_id, wz_event_view_id: spine.view.view_id,
      wz_event_tmc_source_id: tmcSourceId,
      crash_source_id: d.crash_source_id, crash_view_id: crashView.view.view_id,
      wz_exposure_source_id: d.wz_exposure_source_id ?? null, wz_exposure_view_id: exposure ? exposure.view.view_id : null,
      wz_queue_source_id: d.wz_queue_source_id ?? null, wz_queue_view_id: queue ? queue.view.view_id : null,
      event_tmc_table: d.event_tmc_table,
      wz_crash_match_source_id: matchSourceId, wz_crash_match_view_id: matchView.view_id,
      zones: zones.length, zones_with_probe_geometry: undefined,
      zones_with_queue_extent: num(queueZones) || 0,
      matches: matchRows.length, matches_in_window: matchRows.filter((m) => m.in_window).length,
      // the cross-check between CLEAR's own attribution and the join
      coded_crashes_in_window_year: codedTotal,
      coded_by_severity: { fatal: num(codedTotals.wz_fatal) || 0, injury: num(codedTotals.wz_injury) || 0, pdo: num(codedTotals.wz_pdo) || 0 },
      flagger_crashes_in_window_year: num(codedTotals.flagger_coded) || 0,
      crashes_in_window_year: num(codedTotals.crashes) || 0,
      coded_located_in_active_zone: locatedCodedIds.size,
      coded_located_share: codedTotal ? round(locatedCodedIds.size / codedTotal) : null,
      coded_near_zone_any_time: nearAnyTimeCodedIds.size,
      located_crashes: locatedIds.size,
      located_coded_share: locatedIds.size ? round(locatedCodedIds.size / locatedIds.size) : null,
      m5,
      m5_by_tier: m5ByTier,
    };
    delete runMeta.zones_with_probe_geometry;
    await mergeJsonColumn(db, viewsTable, 'view_id', view.view_id, 'metadata', runMeta);
    await mergeJsonColumn(db, viewsTable, 'view_id', matchView.view_id, 'metadata', { ...runMeta, wz_crash_view_id: view.view_id });
    await mergeJsonColumn(db, sourcesTable, 'source_id', d.source_id, 'metadata', {
      columns: sql.WZ_CRASH_TABLE_COLUMNS, schema: 'wz_crash_v1',
      wz_event_source_id: d.wz_event_source_id, crash_source_id: d.crash_source_id, wz_crash_match_source_id: matchSourceId,
    });
    await mergeJsonColumn(db, sourcesTable, 'source_id', matchSourceId, 'metadata', {
      columns: sql.WZ_CRASH_MATCH_TABLE_COLUMNS, schema: 'wz_crash_match_v1',
      wz_crash_source_id: d.source_id, crash_source_id: d.crash_source_id,
    });
    await updateProgress(1);
    await say('work_zone/crash_join:FINAL', 'crash join complete', {
      source_id: d.source_id, view_id: view.view_id, match_view_id: matchView.view_id,
      zones: zones.length, matches: matchRows.length, crashes_in_zones: m5.crashes_total,
      fatal: m5.fatal, injury: m5.injury, rate_per_100m_vmt: m5.rate_per_100m_vmt,
      coded_located_share: runMeta.coded_located_share, located_coded_share: runMeta.located_coded_share,
    });
    return {
      source_id: d.source_id, view_id: view.view_id, match_source_id: matchSourceId, match_view_id: matchView.view_id,
      zones: zones.length, matches: matchRows.length, m5,
    };
  };
}

module.exports = makeCrashJoin();
module.exports.makeCrashJoin = makeCrashJoin;
