/**
 * work_zone/queue — M3, queue length / duration / presence (phase 5).
 *
 * Produces two outputs per vintage:
 *   wz_queue       one row per work zone — the M3 statistics (max and 95th-
 *                  percentile queue, share of time queued, longest run, the
 *                  over-threshold flag) plus the corridor that was walked
 *   wz_queue_hour  one row per (zone x date x clock hour) — the evidence
 *
 * ── Shape of the run ──────────────────────────────────────────────────────
 *  1. Resolve the phase-1 spine view for THIS window, its wz_event_tmc view,
 *     the NPMRDS meta view (corridor order, lengths, posted limits) and the
 *     ClickHouse speed view.
 *  2. Read the zones and their ACTIVE EPOCH WINDOWS — the same expansion the
 *     speed stage uses (lib/windows.js), anchors only.
 *  3. Read every anchor's corridor from the meta view and walk it upstream in
 *     JavaScript (lib/queue.js buildCorridor): dedupe tied road_orders, stop
 *     at a gap, a reach or a segment cap.
 *  4. Stage corridor x active-day rows in ClickHouse, keyed (tmc, date); run
 *     the walk month by month into a per-epoch table; aggregate per hour and
 *     per zone; drop all staging in finally.
 *  5. Shape the rows, roll M3 up per tier for the view metadata, write both
 *     tables, stamp both views and both sources.
 *
 * Dependency-injected via makeQueue(deps) so the integration test fakes both
 * the physical Postgres side and ClickHouse. No test touches either.
 *
 * ctx: { task, pgEnv, db, dispatchEvent, updateProgress }
 */
const { activeWindowsSQL } = require('../lib/windows.js');
const { epochToClock } = require('../lib/baseline.js');
const queueLib = require('../lib/queue.js');
const { resolveThresholds } = require('../lib/thresholds.js');
const { STAGES } = require('../stages.js');
const chLib = require('../ch.js');
const sql = require('../sql.js');

function defaultDeps() {
  const dbMod = require('@availabs/dms-server/src/db');
  const metadata = require('@availabs/dms-server/src/dama/upload/metadata');
  return {
    getPgDb: dbMod.getDb,
    getChDb: dbMod.getChDb,
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
async function resolveYearView(db, sourceId, startDate, label) {
  const views = (await viewsForSource(db, sourceId)).filter((v) => v.table_name);
  if (!views.length) throw new Error(`${label}: source ${sourceId} has no view with a table`);
  const year = String(startDate).slice(0, 4);
  const match = views.find((v) => String(v.metadata.start_date || '').slice(0, 4) === year);
  if (!match) {
    const have = views.map((v) => v.metadata.start_date || v.version || v.view_id).join(', ');
    throw new Error(`${label}: source ${sourceId} has no view for ${year} (has: ${have})`);
  }
  return { view: match, table: qualified(match) };
}

function makeQueue(depOverrides = {}) {
  const deps = { ...defaultDeps(), ...depOverrides };

  return async function queue(ctx) {
    const { task, pgEnv, db, dispatchEvent, updateProgress } = ctx;
    const d = (task && task.descriptor) || {};
    const spec = STAGES.queue;

    const missing = spec.inputs.filter((k) => d[k] === undefined || d[k] === null || d[k] === '');
    if (missing.length) throw new Error(`work_zone/queue: descriptor is missing ${missing.join(', ')}`);
    if (!d.start_date || !d.end_date) throw new Error('work_zone/queue: descriptor is missing start_date/end_date');
    const thresholds = resolveThresholds(d.thresholds);

    // Walk limits: descriptor options with report defaults, stamped on the view.
    const maxReachMi = num(d.queue_max_reach_mi) ?? queueLib.DEFAULT_QUEUE_MAX_REACH_MI;
    const maxUpstreamTmcs = num(d.queue_max_upstream_tmcs) ?? queueLib.DEFAULT_QUEUE_MAX_UPSTREAM_TMCS;
    const maxGapMi = num(d.queue_max_gap_mi) ?? queueLib.DEFAULT_QUEUE_MAX_GAP_MI;
    const minConsecutive = queueLib.DEFAULT_MIN_CONSECUTIVE_EPOCHS;
    const year = Number(String(d.start_date).slice(0, 4));

    const say = (t, m, p) => (dispatchEvent ? dispatchEvent(t, m, p) : Promise.resolve());
    await say('work_zone/queue:INITIAL', 'work_zone queue run started', {
      source_id: d.source_id, start_date: d.start_date, end_date: d.end_date, thresholds,
      queue_max_reach_mi: maxReachMi, queue_max_upstream_tmcs: maxUpstreamTmcs, queue_max_gap_mi: maxGapMi,
      min_consecutive_epochs: minConsecutive,
    });

    const pgDb = deps.getPgDb(pgEnv);
    const chDb = deps.getChDb(pgEnv);

    // ── resolve everything by source id ──
    const spine = await resolveYearView(db, d.wz_event_source_id, d.start_date, 'wz_event');
    const tmcSourceId = d.wz_event_tmc_source_id
      ?? parseJson((await db.query(`SELECT metadata FROM ${tableFor(db, 'sources')} WHERE source_id = $1`,
        [d.wz_event_source_id])).rows[0]?.metadata).wz_event_tmc_source_id;
    if (!tmcSourceId) throw new Error('work_zone/queue: cannot resolve the wz_event_tmc source');
    const tmcView = await resolveYearView(db, tmcSourceId, d.start_date, 'wz_event_tmc');

    const metaSourceId = d.npmrds_meta_source_id ?? spine.view.metadata.npmrds_meta_source_id;
    if (!metaSourceId) throw new Error('work_zone/queue: no npmrds_meta_source_id in the descriptor or on the spine view');
    const metaViews = (await viewsForSource(db, metaSourceId)).filter((v) => v.table_name);
    const metaView = metaViews.find((v) => {
      const m = v.metadata || {};
      return Number(m.is_clickhouse_table || 0) === 0 && (m.year === undefined || m.year === null);
    }) || metaViews[0];
    if (!metaView) throw new Error(`work_zone/queue: npmrds_meta source ${metaSourceId} has no usable view`);

    const speedViews = (await viewsForSource(db, d.npmrds_source_id)).filter((v) => v.table_name);
    const speedView = speedViews.find((v) => Number(parseJson(v.metadata).is_clickhouse_table) === 1);
    if (!speedView) throw new Error(`work_zone/queue: npmrds source ${d.npmrds_source_id} has no ClickHouse view`);
    const speedTable = chLib.stripChPrefix(qualified(speedView).replace(/"/g, ''));

    await say('work_zone/queue:RESOLVED', 'inputs resolved', {
      wz_event: spine.table, wz_event_tmc: tmcView.table, npmrds_meta: qualified(metaView),
      npmrds_speeds_ch: speedTable, event_tmc_table: d.event_tmc_table, meta_year: year,
    });

    // ── zones in the window ──
    const { rows: zones } = await pgDb.query(
      `SELECT wz_event_id, member_event_ids, to_char(first_start,'YYYY-MM-DD HH24:MI:SS') AS first_start,
              to_char(last_end,'YYYY-MM-DD HH24:MI:SS') AS last_end,
              region_name, county_name, facility, work_activity_class,
              is_interstate, in_tma, is_significant_candidate
         FROM ${spine.table}
        WHERE first_start >= $1::date AND first_start < ($2::date + INTERVAL '1 day')`,
      [d.start_date, d.end_date]);
    const zoneById = new Map(zones.map((z) => [String(z.wz_event_id), z]));
    await updateProgress(0.05);

    // ── active epoch windows: zone x anchor x day, half-open epochs (lib/windows.js) ──
    const { rows: activeRows } = await pgDb.query(
      activeWindowsSQL({ spineTable: spine.table, tmcTable: tmcView.table, eventTmcTable: d.event_tmc_table }),
      [d.start_date, d.end_date]);
    await updateProgress(0.15);

    // ── corridors: every anchor's own segment plus everything upstream of it ──
    // One meta row per TMC (newest vintage at or before the window's year),
    // then every TMC on the anchor's (region, tmclinear, direction) with a
    // road_order at or below the anchor's. The pull is bounded generously in
    // order; the reach / segment / gap limits are applied in buildCorridor,
    // where they can be unit-tested.
    const { rows: corridorRows } = await pgDb.query(
      `WITH anchors AS (SELECT DISTINCT tmc FROM ${tmcView.table} WHERE tmc_role = 'anchor'),
       m AS (SELECT DISTINCT ON (tmc) tmc, left(tmc, 3) AS reg, tmclinear, direction, road_order, miles,
                    avg_speedlimit, start_latitude, start_longitude, end_latitude, end_longitude
               FROM ${qualified(metaView)} WHERE year <= $1 ORDER BY tmc, year DESC),
       a AS (SELECT m.* FROM anchors JOIN m USING (tmc))
       SELECT a.tmc AS anchor_tmc, u.tmc, u.road_order, u.miles, u.avg_speedlimit,
              u.start_latitude, u.start_longitude, u.end_latitude, u.end_longitude
         FROM a
         JOIN m u ON u.reg = a.reg AND u.tmclinear = a.tmclinear AND u.direction = a.direction
                 AND u.road_order <= a.road_order AND u.road_order >= a.road_order - $2
        WHERE a.tmclinear IS NOT NULL AND a.road_order IS NOT NULL`,
      [year, Math.max(60, maxUpstreamTmcs * 3)]);
    const rowsByAnchor = new Map();
    for (const r of corridorRows) {
      const k = String(r.anchor_tmc).toUpperCase();
      if (!rowsByAnchor.has(k)) rowsByAnchor.set(k, []);
      rowsByAnchor.get(k).push(r);
    }
    const anchorTmcs = new Set(activeRows.map((r) => String(r.tmc).toUpperCase()));
    const corridorByAnchor = new Map();
    for (const tmc of anchorTmcs) {
      corridorByAnchor.set(tmc, queueLib.buildCorridor({
        anchorTmc: tmc, rows: rowsByAnchor.get(tmc) || [], maxReachMi, maxUpstreamTmcs, maxGapMi,
      }));
    }
    const endReasons = {};
    for (const c of corridorByAnchor.values()) endReasons[c.end_reason] = (endReasons[c.end_reason] || 0) + 1;
    await say('work_zone/queue:STAGED', 'inputs read', {
      zones: zones.length, active_windows: activeRows.length, anchors: anchorTmcs.size,
      corridor_rows_read: corridorRows.length, corridor_end_reasons: endReasons,
    });
    await updateProgress(0.25);

    // ── stage in ClickHouse, walk, aggregate, drop ──
    const runId = `${d.source_id}_${Date.now()}`;
    const names = {
      database: d.ch_database || chLib.DEFAULT_CH_DATABASE,
      corridorTable: chLib.stagingTableName('qcorr', runId),
      epochTable: chLib.stagingTableName('qepoch', runId),
    };
    const qualify = (t) => `${names.database}.${t}`;
    let hourRows = []; let zoneAgg = []; let runAgg = [];
    let corridorActiveRows = 0;
    const chunks = queueLib.monthChunks(d.start_date, d.end_date);
    try {
      const swept = await chLib.sweepStaleStaging(chDb, { database: names.database });
      if (swept.length) {
        await say('work_zone/queue:SWEPT', `dropped ${swept.length} orphaned staging tables`, { tables: swept });
      }
      await chLib.chExec(chDb, queueLib.corridorActiveDDL({ database: names.database, table: names.corridorTable }));
      await chLib.chExec(chDb, queueLib.queueEpochDDL({ database: names.database, table: names.epochTable }));

      // corridor x active-day, built in batches so a year never sits in memory
      let batch = [];
      const flush = async () => {
        if (!batch.length) return;
        corridorActiveRows += await chLib.insertRows(chDb, qualify(names.corridorTable), batch);
        batch = [];
      };
      for (const a of activeRows) {
        const corridor = corridorByAnchor.get(String(a.tmc).toUpperCase());
        // No meta row for the anchor: still measure presence at the anchor if
        // wz_event_tmc knows its length; otherwise there is nothing to walk.
        const tmcs = corridor && corridor.tmcs.length ? corridor.tmcs : [];
        const nRanks = tmcs.length;
        for (const t of tmcs) {
          batch.push({
            wz_event_id: String(a.wz_event_id), tmc: t.tmc, rank: t.rank, n_ranks: nRanks,
            miles: Number(t.miles) || 0, phed_threshold_speed: Number(t.phed_threshold_speed) || 0,
            date: a.date, epoch_from: Number(a.epoch_from), epoch_to: Number(a.epoch_to),
            window_source: a.window_source,
          });
        }
        if (batch.length >= 50000) await flush();
      }
      await flush();
      await say('work_zone/queue:CORRIDORS', `${corridorActiveRows} corridor x day rows staged`, {
        corridor_active_rows: corridorActiveRows, month_chunks: chunks.length,
      });
      await updateProgress(0.35);

      // the walk, one calendar month at a time
      let i = 0;
      for (const c of chunks) {
        await chLib.chExec(chDb, queueLib.queueEpochInsertSQL({
          epochTable: qualify(names.epochTable), speedTable, corridorTable: qualify(names.corridorTable),
          windowStart: c.start, windowEnd: c.end, queueSpeedMph: thresholds.queue_speed_mph,
          minConsecutive,
        }));
        i += 1;
        await updateProgress(0.35 + 0.35 * (i / chunks.length));
      }
      await say('work_zone/queue:WALKED', `${chunks.length} month chunks walked`, {});

      hourRows = await chLib.chQueryRows(chDb, queueLib.queueHourSQL({ epochTable: qualify(names.epochTable) }));
      zoneAgg = await chLib.chQueryRows(chDb, queueLib.queueZoneSQL({ epochTable: qualify(names.epochTable) }));
      runAgg = await chLib.chQueryRows(chDb, queueLib.queueRunsSQL({ epochTable: qualify(names.epochTable) }));
      await say('work_zone/queue:MEASURED', `${zoneAgg.length} zones measured, ${hourRows.length} zone-hours`, {
        zones_measured: zoneAgg.length, zone_hours: hourRows.length,
      });
    } finally {
      for (const t of [names.corridorTable, names.epochTable]) {
        try { await chLib.chExec(chDb, `DROP TABLE IF EXISTS ${qualify(t)}`); } catch (e) { /* a failed create leaves nothing to drop */ }
      }
    }
    await updateProgress(0.75);

    // ── shape the rows ──
    // Anchor + corridor per zone, from the active rows (one anchor per zone).
    const anchorByZone = new Map();
    for (const a of activeRows) {
      const id = String(a.wz_event_id);
      if (!anchorByZone.has(id)) anchorByZone.set(id, { tmc: String(a.tmc).toUpperCase(), sources: new Set() });
      anchorByZone.get(id).sources.add(a.window_source);
    }
    const runsById = new Map(runAgg.map((r) => [String(r.wz_event_id), r]));
    const aggById = new Map(zoneAgg.map((r) => [String(r.wz_event_id), r]));

    const zoneRows = [];
    for (const z of zones) {
      const id = String(z.wz_event_id);
      const anchor = anchorByZone.get(id);
      const corridor = anchor ? corridorByAnchor.get(anchor.tmc) : null;
      const agg = aggById.get(id);
      const runs = runsById.get(id) || {};
      const observed = agg ? Number(agg.epochs_observed) || 0 : 0;
      const measured = observed > 0;
      const share = (k) => (measured ? round((Number(agg[k]) || 0) / observed) : null);
      const val = (k, p = 4) => (measured ? round(num(agg[k]), p) : null);
      const maxLen = measured ? (num(agg.max_queue_len_mi) || 0) : null;
      const maxLenPhed = measured ? (num(agg.max_queue_len_phed_mi) || 0) : null;
      const queued = measured ? Number(agg.epochs_queued) || 0 : null;
      const sources = anchor ? [...anchor.sources] : [];
      zoneRows.push({
        wz_event_id: id, first_start: z.first_start, last_end: z.last_end,
        region_name: z.region_name, county_name: z.county_name, facility: z.facility,
        work_activity_class: z.work_activity_class, is_interstate: z.is_interstate, in_tma: z.in_tma,
        is_significant_candidate: z.is_significant_candidate,
        anchor_tmc: anchor ? anchor.tmc : null,
        anchor_miles: corridor && corridor.tmcs[0] ? round(corridor.tmcs[0].miles) : null,
        window_source: sources.length === 0 ? null : (sources.length > 1 ? 'mixed' : sources[0]),
        n_upstream_tmcs: corridor ? corridor.n_upstream_tmcs : null,
        corridor_reach_mi: corridor ? corridor.reach_mi : null,
        corridor_end_reason: corridor ? corridor.end_reason : (anchor ? 'no_meta' : null),
        queue_measured: measured,
        epochs_observed: observed,
        active_hours_observed: round(observed / queueLib.EPOCHS_PER_HOUR, 2),
        epochs_2799: measured ? Number(agg.epochs_2799) || 0 : null,
        epochs_anchor_below: measured ? Number(agg.epochs_anchor_below) || 0 : null,
        epochs_queued: queued,
        pct_time_queued: share('epochs_queued'),
        queue_hours: measured ? round(queued / queueLib.EPOCHS_PER_HOUR, 2) : null,
        hours_with_queue: measured ? Number(agg.hours_with_queue) || 0 : null,
        max_queue_len_mi: measured ? round(maxLen) : null,
        p95_queue_len_mi: measured && queued > 0 ? val('p95_queue_len_mi') : (measured ? 0 : null),
        mean_queue_len_mi: measured && queued > 0 ? val('mean_queue_len_mi') : (measured ? 0 : null),
        queue_mile_hours: measured ? round((num(agg.queue_mile_epochs) || 0) / queueLib.EPOCHS_PER_HOUR) : null,
        longest_queue_run_min: measured ? (Number(runs.longest_run_epochs) || 0) * 5 : null,
        exceeds_queue_threshold: measured ? maxLen > thresholds.queue_threshold_mi : null,
        max_queue_tmcs: measured && maxLen > 0 ? (agg.max_queue_tmcs || null) : null,
        max_queue_date: measured && queued > 0 ? String(agg.max_queue_date).slice(0, 10) : null,
        max_queue_time: measured && queued > 0 ? epochToClock(agg.max_queue_epoch) : null,
        epochs_lower_bound: measured ? Number(agg.epochs_lower_bound) || 0 : null,
        epochs_corridor_end: measured ? Number(agg.epochs_corridor_end) || 0 : null,
        epochs_queued_phed: measured ? Number(agg.epochs_queued_phed) || 0 : null,
        pct_time_queued_phed: share('epochs_queued_phed'),
        max_queue_len_phed_mi: measured ? round(maxLenPhed) : null,
        p95_queue_len_phed_mi: measured && Number(agg.epochs_queued_phed) > 0 ? val('p95_queue_len_phed_mi') : (measured ? 0 : null),
        longest_queue_run_phed_min: measured ? (Number(runs.longest_run_phed_epochs) || 0) * 5 : null,
        exceeds_queue_threshold_phed: measured ? maxLenPhed > thresholds.queue_threshold_mi : null,
        anchor_speed_mean: val('anchor_speed_mean', 2),
        anchor_speed_min: val('anchor_speed_min', 2),
        queue_speed_mph: thresholds.queue_speed_mph,
        queue_threshold_mi: thresholds.queue_threshold_mi,
        min_consecutive_epochs: minConsecutive,
      });
    }

    const hourOut = [];
    for (const h of hourRows) {
      const z = zoneById.get(String(h.wz_event_id));
      if (!z) continue;   // a corridor day outside this window's zones
      const observed = Number(h.epochs_observed) || 0;
      const queued = Number(h.epochs_queued) || 0;
      hourOut.push({
        wz_event_id: z.wz_event_id, date: String(h.date).slice(0, 10), hour: Number(h.hour),
        first_start: z.first_start, region_name: z.region_name,
        is_interstate: z.is_interstate, is_significant_candidate: z.is_significant_candidate,
        window_source: h.window_source || null,
        epochs_observed: observed,
        epochs_anchor_below: Number(h.epochs_anchor_below) || 0,
        epochs_queued: queued,
        max_queue_len_mi: round(num(h.max_queue_len_mi) || 0),
        mean_queue_len_mi: queued > 0 ? round(num(h.mean_queue_len_mi)) : 0,
        queue_mile_epochs: round(num(h.queue_mile_epochs) || 0),
        epochs_lower_bound: Number(h.epochs_lower_bound) || 0,
        epochs_queued_phed: Number(h.epochs_queued_phed) || 0,
        max_queue_len_phed_mi: round(num(h.max_queue_len_phed_mi) || 0),
        anchor_speed_mean: round(num(h.anchor_speed_mean), 2),
        anchor_speed_min: round(num(h.anchor_speed_min), 2),
      });
    }

    // Rollups from the SHAPED rows, per tier (see lib/queue.js).
    const tierMeta = new Map(zones.map((z) => [String(z.wz_event_id), {
      is_significant_candidate: z.is_significant_candidate,
      is_interstate: z.is_interstate,
      span_hours: (new Date(`${String(z.last_end).replace(' ', 'T')}Z`)
                 - new Date(`${String(z.first_start).replace(' ', 'T')}Z`)) / 3600000,
    }]));
    const m3 = queueLib.rollupM3(zoneRows, { queueThresholdMi: thresholds.queue_threshold_mi });
    const m3ByTier = queueLib.rollupM3ByTier(zoneRows, tierMeta, { queueThresholdMi: thresholds.queue_threshold_mi });
    await updateProgress(0.8);

    // ── provision: the wz_queue_hour source is created here, not by the route ──
    let hourSourceId = d.wz_queue_hour_source_id ?? null;
    if (!hourSourceId) {
      const { rows } = await db.query(
        `SELECT source_id FROM ${tableFor(db, 'sources')} WHERE type = $1 ORDER BY source_id DESC LIMIT 1`,
        ['wz_queue_hour']);
      hourSourceId = rows[0] && rows[0].source_id;
    }
    if (!hourSourceId) {
      const created = await deps.createDamaSource({
        name: `wz_queue_hour_${d.source_id}`,
        type: 'wz_queue_hour',
        user_id: d.user_id ?? null,
        metadata: { work_zone_stage: 'queue', wz_queue_source_id: d.source_id },
      }, pgEnv);
      hourSourceId = created.source_id;
    }

    const view = d.target_view_id
      ? { view_id: d.target_view_id }
      : await deps.createDamaView({ source_id: d.source_id, user_id: d.user_id ?? null }, pgEnv);
    const hourView = d.target_hour_view_id
      ? { view_id: d.target_hour_view_id }
      : await deps.createDamaView({ source_id: hourSourceId, user_id: d.user_id ?? null }, pgEnv);

    const schema = sql.WORK_ZONE_SCHEMA;
    const table = sql.tableNameFor({ source_id: d.source_id, view_id: view.view_id, stage: 'wz_queue' });
    const hourTable = sql.tableNameFor({ source_id: hourSourceId, view_id: hourView.view_id, stage: 'wz_queue_hour' });

    await pgDb.query(sql.wzQueueTableDDL(schema, table));
    await pgDb.query(sql.wzQueueHourTableDDL(schema, hourTable));
    await pgDb.query(sql.deleteWindowSQL({
      schema, table, dateColumn: 'first_start', startDate: d.start_date, endDate: d.end_date,
    }));
    await pgDb.query(sql.deleteWindowSQL({
      schema, table: hourTable, dateColumn: 'first_start', startDate: d.start_date, endDate: d.end_date,
    }));

    // Per-TMC geometry once (the meta view is one row per tmc x year); the
    // queue-extent union joins against it.
    const GEOM_TEMP = '_wz_meta_geom';
    await pgDb.query(sql.metaGeomTempTableSQL({ metaTable: qualified(metaView), metaYear: year, tempTable: GEOM_TEMP }));

    const CHUNK = 1000;
    for (let i = 0; i < zoneRows.length; i += CHUNK) {
      const stmt = sql.wzQueueInsertSQL({ schema, table, rows: zoneRows.slice(i, i + CHUNK), geomTable: GEOM_TEMP });
      if (stmt) await pgDb.query(stmt);
    }
    const HCHUNK = 2000;
    for (let i = 0; i < hourOut.length; i += HCHUNK) {
      const stmt = sql.wzQueueHourInsertSQL({ schema, table: hourTable, rows: hourOut.slice(i, i + HCHUNK) });
      if (stmt) await pgDb.query(stmt);
    }
    await updateProgress(0.92);

    // ── metadata ──
    const viewsTable = tableFor(db, 'views');
    const sourcesTable = tableFor(db, 'sources');
    const vintage = sql.vintageVersion({ startDate: d.start_date, endDate: d.end_date });
    const setTable = async (viewId, tbl) => db.query(
      `UPDATE ${viewsTable} SET table_schema = $1, table_name = $2, data_table = $3, version = $5
        WHERE view_id = $4`,
      [schema, tbl, `${schema}.${tbl}`, viewId, vintage]);
    await setTable(view.view_id, table);
    await setTable(hourView.view_id, hourTable);

    const runMeta = {
      is_clickhouse_table: 0,
      start_date: d.start_date, end_date: d.end_date,
      thresholds,
      queue_max_reach_mi: maxReachMi, queue_max_upstream_tmcs: maxUpstreamTmcs, queue_max_gap_mi: maxGapMi,
      min_consecutive_epochs: minConsecutive,
      queue_length_basis: 'upstream_only',
      corridor_key: 'region:tmclinear:direction, upstream = lower road_order',
      vehicle_class: 'all_vehicles',
      wz_event_source_id: d.wz_event_source_id, wz_event_view_id: spine.view.view_id,
      wz_event_tmc_source_id: tmcSourceId,
      npmrds_source_id: d.npmrds_source_id, npmrds_speed_table: speedTable,
      npmrds_meta_source_id: metaSourceId, meta_year: year,
      event_tmc_table: d.event_tmc_table,
      wz_queue_hour_source_id: hourSourceId, wz_queue_hour_view_id: hourView.view_id,
      zones: zones.length, zones_measured: zoneRows.filter((r) => r.queue_measured).length,
      zone_hours: hourOut.length,
      active_windows: activeRows.length, corridor_active_rows: corridorActiveRows,
      anchors: anchorTmcs.size, corridor_end_reasons: endReasons,
      windows_from_2799: activeRows.filter((r) => r.window_source === '2799').length,
      windows_from_event: activeRows.filter((r) => r.window_source === 'event').length,
      m3,
      m3_by_tier: m3ByTier,
    };
    await mergeJsonColumn(db, viewsTable, 'view_id', view.view_id, 'metadata', runMeta);
    await mergeJsonColumn(db, viewsTable, 'view_id', hourView.view_id, 'metadata',
      { ...runMeta, wz_queue_view_id: view.view_id });
    await mergeJsonColumn(db, sourcesTable, 'source_id', d.source_id, 'metadata', {
      columns: sql.WZ_QUEUE_TABLE_COLUMNS, schema: 'wz_queue_v1',
      wz_event_source_id: d.wz_event_source_id, wz_queue_hour_source_id: hourSourceId,
    });
    await mergeJsonColumn(db, sourcesTable, 'source_id', hourSourceId, 'metadata', {
      columns: sql.WZ_QUEUE_HOUR_TABLE_COLUMNS, schema: 'wz_queue_hour_v1',
      wz_queue_source_id: d.source_id, wz_event_source_id: d.wz_event_source_id,
    });

    await updateProgress(1);
    await say('work_zone/queue:FINAL', 'work_zone queue complete', {
      source_id: d.source_id, view_id: view.view_id, hour_view_id: hourView.view_id,
      zones: zones.length, zones_measured: runMeta.zones_measured, zone_hours: hourOut.length,
      pct_time_queued: m3.pct_time_queued, pct_zones_exceeding: m3.pct_zones_exceeding,
      zones_exceeding: m3.zones_exceeding,
    });

    return {
      source_id: d.source_id, view_id: view.view_id,
      hour_source_id: hourSourceId, hour_view_id: hourView.view_id,
      zones: zones.length, zones_measured: runMeta.zones_measured, zone_hours: hourOut.length, m3,
    };
  };
}

module.exports = makeQueue();
module.exports.makeQueue = makeQueue;
