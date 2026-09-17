/**
 * work_zone/differential — M4, speed differential (phase 6).
 *
 * The one stage that writes INTO an existing source. wz_speed was created in
 * phase 3 with five nullable columns for this measure, because all views of
 * a source share one column list and adding them later would have meant a
 * new source and orphaned views. This worker fills them for one vintage and
 * publishes M4 on that view's metadata. It never creates a view.
 *
 * ── Shape of the run ──────────────────────────────────────────────────────
 *  1. Resolve, by source id: the spine and its wz_event_tmc view for THIS
 *     window, the wz_speed view for the same year (the target), the NPMRDS
 *     meta view (corridor order) and the ClickHouse speed view.
 *  2. Read the zones, their active windows (lib/windows.js — the same
 *     minutes phases 3, 5 and 7 measured on) and each anchor's corridor,
 *     walked upstream for `approach_tmcs` segments (lib/queue.js
 *     buildCorridor: ties, gaps, the same rules as M3).
 *  3. Stage in ClickHouse: corridor x active day (rank 0 = anchor, 1..N =
 *     approach), the anchors' lengths and the baseline's contaminated days;
 *     run the hour-grain query (in-zone, approach and baseline speed per
 *     zone, date, hour) and the cell-grain query (approach speed per zone
 *     and hour of day); drop the staging in finally.
 *  4. Roll M4 up per tier from the hour rows; fill the baseline drop on every
 *     cell in the window from the cell's own columns, then the approach side
 *     from the cell rows; stamp the view and re-stamp the source's column
 *     descriptors.
 *
 * ctx: { task, pgEnv, db, dispatchEvent, updateProgress }
 */
const { activeWindowsSQL, MAX_SPAN_DAYS } = require('../lib/windows.js');
const { baselineWindow, baselineSQL, DEFAULT_BASELINE_MONTHS } = require('../lib/baseline.js');
const queueLib = require('../lib/queue.js');
const diff = require('../lib/differential.js');
const { resolveThresholds } = require('../lib/thresholds.js');
const { STAGES } = require('../stages.js');
const chLib = require('../ch.js');
const sql = require('../sql.js');

function defaultDeps() {
  const dbMod = require('@availabs/dms-server/src/db');
  return { getPgDb: dbMod.getDb, getChDb: dbMod.getChDb };
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

function makeDifferential(depOverrides = {}) {
  const deps = { ...defaultDeps(), ...depOverrides };

  return async function differential(ctx) {
    const { task, pgEnv, db, dispatchEvent, updateProgress } = ctx;
    const d = (task && task.descriptor) || {};
    const spec = STAGES.differential;

    const speedSourceId = d.wz_speed_source_id ?? d.source_id;
    const missing = spec.inputs.filter((k) => k !== 'wz_speed_source_id' && (d[k] === undefined || d[k] === null || d[k] === ''));
    if (speedSourceId === undefined || speedSourceId === null || speedSourceId === '') missing.unshift('wz_speed_source_id');
    if (missing.length) throw new Error(`work_zone/differential: descriptor is missing ${missing.join(', ')}`);
    if (!d.start_date || !d.end_date) throw new Error('work_zone/differential: descriptor is missing start_date/end_date');
    const thresholds = resolveThresholds(d.thresholds);
    const approachTmcs = Math.max(1, Math.round(num(d.approach_tmcs) ?? diff.DEFAULT_APPROACH_TMCS));
    const minEpochsPerHour = num(d.min_epochs_per_hour) ?? diff.DEFAULT_MIN_EPOCHS_PER_HOUR;
    const baselineMonths = num(d.baseline_months) ?? DEFAULT_BASELINE_MONTHS;
    const { baseline_start, baseline_end } = baselineWindow({ startDate: d.start_date, months: baselineMonths });
    const year = Number(String(d.start_date).slice(0, 4));

    const say = (t, m, p) => (dispatchEvent ? dispatchEvent(t, m, p) : Promise.resolve());
    await say('work_zone/differential:INITIAL', 'M4 run started', {
      wz_speed_source_id: speedSourceId, start_date: d.start_date, end_date: d.end_date,
      differential_mph: thresholds.differential_mph, approach_tmcs: approachTmcs,
      min_epochs_per_hour: minEpochsPerHour, baseline_start, baseline_end,
    });
    const pgDb = deps.getPgDb(pgEnv);
    const chDb = deps.getChDb(pgEnv);

    // ── resolve everything by source id; the target is an EXISTING wz_speed view ──
    const spine = await resolveYearView(db, d.wz_event_source_id, d.start_date, 'wz_event');
    const tmcSourceId = d.wz_event_tmc_source_id
      ?? parseJson((await db.query(`SELECT metadata FROM ${tableFor(db, 'sources')} WHERE source_id = $1`,
        [d.wz_event_source_id])).rows[0]?.metadata).wz_event_tmc_source_id;
    if (!tmcSourceId) throw new Error('work_zone/differential: cannot resolve the wz_event_tmc source');
    const tmcView = await resolveYearView(db, tmcSourceId, d.start_date, 'wz_event_tmc');
    let target;
    if (d.target_view_id) {
      const { rows } = await db.query(
        `SELECT view_id, source_id, table_schema, table_name, data_table, version, metadata FROM ${tableFor(db, 'views')} WHERE view_id = $1`,
        [d.target_view_id]);
      if (!rows[0] || !rows[0].table_name) throw new Error(`work_zone/differential: view ${d.target_view_id} has no table`);
      target = { view: { ...rows[0], metadata: parseJson(rows[0].metadata) }, table: qualified(rows[0]) };
    } else {
      target = await resolveYearView(db, speedSourceId, d.start_date, 'wz_speed');
    }
    const metaSourceId = d.npmrds_meta_source_id ?? spine.view.metadata.npmrds_meta_source_id;
    if (!metaSourceId) throw new Error('work_zone/differential: no npmrds_meta_source_id in the descriptor or on the spine view');
    const metaViews = (await viewsForSource(db, metaSourceId)).filter((v) => v.table_name);
    const metaView = metaViews.find((v) => {
      const m = v.metadata || {};
      return Number(m.is_clickhouse_table || 0) === 0 && (m.year === undefined || m.year === null);
    }) || metaViews[0];
    if (!metaView) throw new Error(`work_zone/differential: npmrds_meta source ${metaSourceId} has no usable view`);
    const speedViews = (await viewsForSource(db, d.npmrds_source_id)).filter((v) => v.table_name);
    const speedView = speedViews.find((v) => Number(parseJson(v.metadata).is_clickhouse_table) === 1);
    if (!speedView) throw new Error(`work_zone/differential: npmrds source ${d.npmrds_source_id} has no ClickHouse view`);
    const speedTable = chLib.stripChPrefix(qualified(speedView).replace(/"/g, ''));

    await say('work_zone/differential:RESOLVED', 'inputs resolved', {
      wz_event: spine.table, wz_event_tmc: tmcView.table, wz_speed: target.table, wz_speed_view_id: target.view.view_id,
      npmrds_meta: qualified(metaView), npmrds_speeds_ch: speedTable, event_tmc_table: d.event_tmc_table,
    });

    // ── zones, active windows, corridors ──
    const { rows: zones } = await pgDb.query(
      `SELECT wz_event_id, to_char(first_start,'YYYY-MM-DD HH24:MI:SS') AS first_start,
              to_char(last_end,'YYYY-MM-DD HH24:MI:SS') AS last_end,
              is_interstate, in_tma, is_significant_candidate
         FROM ${spine.table}
        WHERE first_start >= $1::date AND first_start < ($2::date + INTERVAL '1 day')`,
      [d.start_date, d.end_date]);
    const zoneById = new Map(zones.map((z) => [String(z.wz_event_id), z]));
    const { rows: activeRows } = await pgDb.query(
      activeWindowsSQL({ spineTable: spine.table, tmcTable: tmcView.table, eventTmcTable: d.event_tmc_table }),
      [d.start_date, d.end_date]);
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
      [year, Math.max(12, approachTmcs * 6)]);
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
        anchorTmc: tmc, rows: rowsByAnchor.get(tmc) || [], maxUpstreamTmcs: approachTmcs,
      }));
    }
    const anchorsWithApproach = [...corridorByAnchor.values()].filter((c) => c.n_upstream_tmcs > 0).length;
    // the anchors' lengths (rank 0) for the baseline CTE
    const anchorMiles = new Map();
    for (const c of corridorByAnchor.values()) if (c.tmcs[0]) anchorMiles.set(c.tmcs[0].tmc, c.tmcs[0].miles);

    // ── the baseline's contaminated (tmc, date) pairs, anchors only ──
    const { rows: excludeRows } = await pgDb.query(
      `WITH spans AS (
         SELECT DISTINCT tmc, bound_start_date AS d0,
                LEAST(GREATEST(bound_end_date, bound_start_date), bound_start_date + ${MAX_SPAN_DAYS}) AS d1
           FROM ${d.event_tmc_table}
          WHERE bound_end_date >= $1::date AND bound_start_date <= $2::date
            AND tmc IN (SELECT DISTINCT tmc FROM ${tmcView.table} WHERE tmc_role = 'anchor'))
       SELECT DISTINCT tmc, to_char(g.day::date, 'YYYY-MM-DD') AS date
         FROM spans
         CROSS JOIN generate_series(GREATEST(d0, $1::date)::timestamp, LEAST(d1, $2::date)::timestamp, INTERVAL '1 day') AS g(day)`,
      [baseline_start, baseline_end]);
    await say('work_zone/differential:STAGED', 'inputs read', {
      zones: zones.length, active_windows: activeRows.length, anchors: anchorTmcs.size,
      anchors_with_approach: anchorsWithApproach, excluded_tmc_days: excludeRows.length,
    });
    await updateProgress(0.25);

    // ── ClickHouse ──
    const runId = `${speedSourceId}_${Date.now()}`;
    const names = {
      database: d.ch_database || chLib.DEFAULT_CH_DATABASE,
      corridorTable: chLib.stagingTableName('dcorr', runId),
      tmcTable: chLib.stagingTableName('dtmc', runId),
      excludeTable: chLib.stagingTableName('dexcl', runId),
    };
    const qualify = (t) => `${names.database}.${t}`;
    let hourRows = []; let cellRows = []; let corridorActiveRows = 0;
    try {
      const swept = await chLib.sweepStaleStaging(chDb, { database: names.database });
      if (swept.length) await say('work_zone/differential:SWEPT', `dropped ${swept.length} orphaned staging tables`, { tables: swept });
      await chLib.chExec(chDb, diff.approachCorridorDDL({ database: names.database, table: names.corridorTable }));
      await chLib.chExec(chDb, diff.approachTmcDDL({ database: names.database, table: names.tmcTable }));
      await chLib.chExec(chDb, diff.approachExcludeDDL({ database: names.database, table: names.excludeTable }));

      let batch = [];
      const flush = async () => {
        if (!batch.length) return;
        corridorActiveRows += await chLib.insertRows(chDb, qualify(names.corridorTable), batch);
        batch = [];
      };
      for (const a of activeRows) {
        const corridor = corridorByAnchor.get(String(a.tmc).toUpperCase());
        for (const t of (corridor ? corridor.tmcs : [])) {
          batch.push({
            wz_event_id: String(a.wz_event_id), tmc: t.tmc, rank: t.rank, miles: Number(t.miles) || 0,
            date: a.date, epoch_from: Number(a.epoch_from), epoch_to: Number(a.epoch_to),
          });
        }
        if (batch.length >= 50000) await flush();
      }
      await flush();
      await chLib.insertRows(chDb, qualify(names.tmcTable), [...anchorMiles].map(([tmc, miles]) => ({ tmc, miles: Number(miles) || 0 })));
      await chLib.insertRows(chDb, qualify(names.excludeTable), excludeRows.map((r) => ({ tmc: r.tmc, date: r.date })));
      await updateProgress(0.4);

      const baselineCte = baselineSQL({
        speedTable, tmcTable: qualify(names.tmcTable), excludeTable: qualify(names.excludeTable),
        baselineStart: baseline_start, baselineEnd: baseline_end,
      });
      hourRows = await chLib.chQueryRows(chDb, diff.approachHourSQL({
        speedTable, corridorTable: qualify(names.corridorTable), baselineCte,
        windowStart: d.start_date, windowEnd: d.end_date, minEpochsPerHour,
      }));
      await updateProgress(0.6);
      cellRows = await chLib.chQueryRows(chDb, diff.approachCellSQL({
        speedTable, corridorTable: qualify(names.corridorTable), windowStart: d.start_date, windowEnd: d.end_date,
      }));
      await say('work_zone/differential:MEASURED', `${hourRows.length} zone-hours, ${cellRows.length} approach cells`, {
        zone_hours: hourRows.length, approach_cells: cellRows.length, corridor_active_rows: corridorActiveRows,
      });
    } finally {
      for (const t of [names.corridorTable, names.tmcTable, names.excludeTable]) {
        try { await chLib.chExec(chDb, `DROP TABLE IF EXISTS ${qualify(t)}`); } catch (e) { /* a failed create leaves nothing to drop */ }
      }
    }
    await updateProgress(0.7);

    // ── M4 at the hour grain, rolled up per tier ──
    const inWindow = hourRows.filter((r) => zoneById.has(String(r.wz_event_id)));
    const tierMeta = new Map(zones.map((z) => [String(z.wz_event_id), {
      is_significant_candidate: z.is_significant_candidate, is_interstate: z.is_interstate,
      span_hours: (new Date(`${String(z.last_end).replace(' ', 'T')}Z`) - new Date(`${String(z.first_start).replace(' ', 'T')}Z`)) / 3600000,
    }]));
    const m4 = diff.rollupM4(inWindow, { thresholdMph: thresholds.differential_mph });
    const m4ByTier = diff.rollupM4ByTier(inWindow, tierMeta, { thresholdMph: thresholds.differential_mph });

    // ── fill the cells in place ──
    const schema = sql.WORK_ZONE_SCHEMA;
    const table = target.view.table_name;
    await pgDb.query(sql.wzSpeedBaselineDropUpdateSQL({ schema, table, startDate: d.start_date, endDate: d.end_date }));
    const cellUpdates = cellRows
      .filter((c) => zoneById.has(String(c.wz_event_id)) && num(c.approach_speed) !== null)
      .map((c) => ({
        wz_event_id: String(c.wz_event_id), hour: Number(c.hour),
        approach_tmc: c.approach_tmcs || null, approach_speed: round(num(c.approach_speed), 2),
      }));
    const CHUNK = 2000;
    for (let i = 0; i < cellUpdates.length; i += CHUNK) {
      const stmt = sql.wzSpeedApproachUpdateSQL({
        schema, table, rows: cellUpdates.slice(i, i + CHUNK), thresholdMph: thresholds.differential_mph,
        startDate: d.start_date, endDate: d.end_date,
      });
      if (stmt) await pgDb.query(stmt);
    }
    const { rows: [coverage = {}] } = await pgDb.query(
      `SELECT count(*) AS cells, count(*) FILTER (WHERE approach_speed IS NOT NULL) AS cells_with_approach,
              count(*) FILTER (WHERE differential_baseline IS NOT NULL) AS cells_with_baseline,
              count(*) FILTER (WHERE exceeds_differential) AS cells_exceeding,
              count(DISTINCT wz_event_id) AS zones, count(DISTINCT wz_event_id) FILTER (WHERE approach_speed IS NOT NULL) AS zones_with_approach
         FROM ${schema}.${table}
        WHERE first_start >= $1::date AND first_start < ($2::date + INTERVAL '1 day')`,
      [d.start_date, d.end_date]);
    await updateProgress(0.92);

    // ── metadata: the view gets M4, the source gets the real descriptors ──
    const viewsTable = tableFor(db, 'views');
    await mergeJsonColumn(db, viewsTable, 'view_id', target.view.view_id, 'metadata', {
      m4, m4_by_tier: m4ByTier,
      m4_thresholds: { differential_mph: thresholds.differential_mph },
      m4_approach_tmcs: approachTmcs, m4_min_epochs_per_hour: minEpochsPerHour,
      m4_baseline_start: baseline_start, m4_baseline_end: baseline_end, m4_baseline_months: baselineMonths,
      m4_sign_convention: 'positive = the work zone slowed traffic (approach - in-zone; baseline - during)',
      m4_zone_hours: inWindow.length, m4_approach_cells: cellUpdates.length,
      m4_cells: num(coverage.cells), m4_cells_with_approach: num(coverage.cells_with_approach),
      m4_cells_with_baseline: num(coverage.cells_with_baseline), m4_cells_exceeding: num(coverage.cells_exceeding),
      m4_zones: num(coverage.zones), m4_zones_with_approach: num(coverage.zones_with_approach),
      m4_anchors_with_approach: anchorsWithApproach, m4_anchors: anchorTmcs.size,
      m4_run_at: new Date().toISOString(),
    });
    await mergeJsonColumn(db, tableFor(db, 'sources'), 'source_id', speedSourceId, 'metadata', {
      columns: sql.WZ_SPEED_TABLE_COLUMNS, schema: 'wz_speed_v1',
    });
    await updateProgress(1);
    await say('work_zone/differential:FINAL', 'M4 complete', {
      wz_speed_source_id: speedSourceId, view_id: target.view.view_id,
      zone_hours: inWindow.length, cells_updated: cellUpdates.length,
      m4_approach_hour_weighted: m4.m4_approach_hour_weighted, m4_baseline_hour_weighted: m4.m4_baseline_hour_weighted,
      hours_approach_slower_than_zone: m4.hours_approach_slower_than_zone,
    });
    return { source_id: speedSourceId, view_id: target.view.view_id, zone_hours: inWindow.length, cells_updated: cellUpdates.length, m4 };
  };
}

module.exports = makeDifferential();
module.exports.makeDifferential = makeDifferential;
