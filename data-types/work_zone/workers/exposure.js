/**
 * work_zone/exposure — E1–E3, the denominators (phase 2).
 *
 * Reads the phase-1 spine and produces `wz_exposure`: one row per work zone
 * with lane closures, lane-mile-hours, and vehicles and VMT through the zone.
 *
 * Two things it deliberately does NOT do:
 *
 *  - **It does not count impact TMCs.** `wz_event_tmc` roles each TMC `anchor`
 *    (where the work is) or `impact` (congestion-derived, downstream with the
 *    queue). Exposure reads anchors only; including impacts would inflate
 *    lane-mile-hours and VMT by the length of the queue.
 *  - **It does not materialise a Region × month rollup.** Phase 10's
 *    `work_zone_measures` is exactly that source, and standing up a parallel
 *    rollup here would fork the rollup schema before phase 10 defines it. Every
 *    dimension a rollup needs — region, county, facility, activity class,
 *    interstate, TMA, significance, month via `first_start` — is on each row,
 *    so a rollup is a GROUP BY away in the meantime.
 *
 * Dependency-injected via makeExposure(deps) so the integration test can fake
 * the physical Postgres side. ctx: { task, pgEnv, db, dispatchEvent, updateProgress }
 */
const { computeExposure, DEFAULT_DURATION_BASIS, DURATION_BASES } = require('../lib/exposure.js');
const { resolveThresholds } = require('../lib/thresholds.js');
const { STAGES } = require('../stages.js');
const sql = require('../sql.js');

function defaultDeps() {
  const dbMod = require('@availabs/dms-server/src/db');
  const metadata = require('@availabs/dms-server/src/dama/upload/metadata');
  return { getPgDb: dbMod.getDb, createDamaView: metadata.createDamaView };
}

const tableFor = (db, base) => (db.type === 'postgres' ? `data_manager.${base}` : base);
const parseJson = (v) => (typeof v === 'string' ? (v ? JSON.parse(v) : {}) : (v || {}));

async function mergeJsonColumn(db, table, idCol, id, col, patch) {
  const { rows } = await db.query(`SELECT ${col} FROM ${table} WHERE ${idCol} = $1`, [id]);
  const next = { ...parseJson(rows[0] && rows[0][col]), ...patch };
  await db.query(`UPDATE ${table} SET ${col} = $1 WHERE ${idCol} = $2`, [JSON.stringify(next), id]);
  return next;
}

const qualified = (v) => v.data_table || (v.table_schema ? `"${v.table_schema}"."${v.table_name}"` : v.table_name);

/** Views of a source, newest first, metadata parsed. */
async function viewsForSource(db, sourceId) {
  const { rows } = await db.query(
    `SELECT view_id, source_id, table_schema, table_name, data_table, version, metadata
       FROM ${tableFor(db, 'views')} WHERE source_id = $1 ORDER BY view_id DESC`, [sourceId]);
  return rows.map((r) => ({ ...r, metadata: parseJson(r.metadata) }));
}

/**
 * The spine view covering this window.
 *
 * Phase 1 publishes one view per calendar year, so exposure must pick the view
 * whose recorded window matches — not simply the newest, which would silently
 * compute one year's exposure against another year's spine.
 */
async function resolveSpineView(db, sourceId, startDate, label) {
  const views = (await viewsForSource(db, sourceId)).filter((v) => v.table_name);
  if (!views.length) throw new Error(`${label}: source ${sourceId} has no view with a table`);
  const year = String(startDate).slice(0, 4);
  const match = views.find((v) => String(v.metadata.start_date || '').slice(0, 4) === year);
  if (!match) {
    const have = views.map((v) => v.metadata.start_date || v.version || v.view_id).join(', ');
    throw new Error(`${label}: source ${sourceId} has no view for ${year} (has: ${have}) — run the spine for that window first`);
  }
  return { view: match, table: qualified(match) };
}

/** The wz_event_tmc view belonging to a given wz_event view (same run). */
async function resolveTmcView(db, tmcSourceId, spineView) {
  const views = (await viewsForSource(db, tmcSourceId)).filter((v) => v.table_name);
  if (!views.length) throw new Error(`wz_event_tmc: source ${tmcSourceId} has no view with a table`);
  const year = String(spineView.metadata.start_date || '').slice(0, 4);
  const match = views.find((v) => String(v.metadata.start_date || '').slice(0, 4) === year);
  if (!match) throw new Error(`wz_event_tmc: source ${tmcSourceId} has no view for ${year}`);
  return { view: match, table: qualified(match) };
}

function makeExposure(depOverrides = {}) {
  const deps = { ...defaultDeps(), ...depOverrides };

  return async function exposure(ctx) {
    const { task, pgEnv, db, dispatchEvent, updateProgress } = ctx;
    const d = (task && task.descriptor) || {};
    const spec = STAGES.exposure;

    const missing = spec.inputs.filter((k) => d[k] === undefined || d[k] === null);
    if (missing.length) throw new Error(`work_zone/exposure: descriptor is missing ${missing.join(', ')}`);
    if (!d.start_date || !d.end_date) throw new Error('work_zone/exposure: descriptor is missing start_date/end_date');
    const thresholds = resolveThresholds(d.thresholds);

    const durationBasis = d.duration_basis || DEFAULT_DURATION_BASIS;
    if (!DURATION_BASES.includes(durationBasis)) {
      throw new Error(`work_zone/exposure: unknown duration_basis '${durationBasis}' (known: ${DURATION_BASES.join(', ')})`);
    }
    const opts = {
      durationBasis,
      durationCapDays: d.duration_cap_days,
      nominalShiftHours: d.nominal_shift_hours,
      preferUnidirectionalAadt: d.prefer_unidirectional_aadt !== false,
    };

    const say = (type, msg, payload) => (dispatchEvent ? dispatchEvent(type, msg, payload) : Promise.resolve());
    await say('work_zone/exposure:INITIAL', 'work_zone exposure run started', {
      source_id: d.source_id, start_date: d.start_date, end_date: d.end_date, ...opts,
    });

    const pgDb = deps.getPgDb(pgEnv);

    // ── resolve the spine views for THIS window ──
    const spine = await resolveSpineView(db, d.wz_event_source_id, d.start_date, 'wz_event');
    const tmcSourceId = d.wz_event_tmc_source_id
      ?? parseJson((await db.query(
        `SELECT metadata FROM ${tableFor(db, 'sources')} WHERE source_id = $1`, [d.wz_event_source_id]
      )).rows[0]?.metadata).wz_event_tmc_source_id;
    if (!tmcSourceId) throw new Error('work_zone/exposure: cannot resolve the wz_event_tmc source (pass wz_event_tmc_source_id)');
    const tmc = await resolveTmcView(db, tmcSourceId, spine.view);
    const meta = (() => {
      // The meta table the spine itself used, so exposure describes the same
      // network vintage the extents were built against.
      const t = spine.view.metadata.npmrds_meta_source_id;
      if (!t) throw new Error('work_zone/exposure: the spine view records no npmrds_meta_source_id');
      return t;
    })();
    const metaViews = (await viewsForSource(db, meta)).filter((v) => v.table_name);
    const metaView = metaViews.find((v) => {
      const m = v.metadata || {};
      return Number(m.is_clickhouse_table || 0) === 0 && (m.year === undefined || m.year === null);
    }) || metaViews[0];
    if (!metaView) throw new Error(`work_zone/exposure: npmrds_meta source ${meta} has no usable view`);
    const metaTable = qualified(metaView);
    const metaYear = Number(String(d.start_date).slice(0, 4));

    await say('work_zone/exposure:RESOLVED', 'spine and metadata resolved', {
      wz_event: spine.table, wz_event_tmc: tmc.table, npmrds_meta: metaTable, meta_year: metaYear,
    });

    // ── read the spine for the window ──
    const { rows: zones } = await pgDb.query(
      `SELECT wz_event_id, first_start, last_end, region_name, county_name, facility,
              work_activity_class, is_interstate, in_tma, is_significant_candidate,
              n_occurrences, active_days, active_hours, lanes_affected, lanes_affected_known
         FROM ${spine.table}
        WHERE first_start >= $1::date AND first_start < ($2::date + INTERVAL '1 day')`,
      [d.start_date, d.end_date]);
    await updateProgress(0.2);

    // ── read the ANCHOR TMCs, joined to the year's metadata ──
    // One row per (tmc, year) in the meta view, up to 9 per TMC, so reduce to
    // the newest vintage at or before the window's year.
    const { rows: anchorRows } = await pgDb.query(
      `WITH m AS (
         SELECT DISTINCT ON (tmc) tmc, miles AS length, aadt, aadt_unidir, f_system,
                congestion_level, directionality
           FROM ${metaTable} WHERE year <= $1 ORDER BY tmc, year DESC)
       SELECT t.wz_event_id, t.tmc, coalesce(t.length, m.length) AS length,
              m.aadt, m.aadt_unidir, coalesce(t.f_system, m.f_system) AS f_system,
              m.congestion_level, m.directionality
         FROM ${tmc.table} t LEFT JOIN m ON m.tmc = t.tmc
        WHERE t.tmc_role = 'anchor'
          AND t.first_start >= $2::date AND t.first_start < ($3::date + INTERVAL '1 day')`,
      [metaYear, d.start_date, d.end_date]);

    const anchorsByZone = new Map();
    for (const r of anchorRows) {
      if (!anchorsByZone.has(r.wz_event_id)) anchorsByZone.set(r.wz_event_id, []);
      anchorsByZone.get(r.wz_event_id).push(r);
    }
    await updateProgress(0.4);

    // ── compute ──
    const rows = [];
    const tally = { complete: 0, no_aadt: 0, no_lane_count: 0, no_anchor: 0, capped: 0 };
    for (const z of zones) {
      const anchors = anchorsByZone.get(z.wz_event_id) || [];
      const e = computeExposure(z, anchors, opts);
      if (!anchors.length) tally.no_anchor++;
      if (e.n_tmcs_with_aadt === 0) tally.no_aadt++;
      if (!e.lane_count_known) tally.no_lane_count++;
      if (e.exposure_complete) tally.complete++;
      if (e.capped_occurrences > 0) tally.capped++;
      rows.push({
        wz_event_id: z.wz_event_id,
        first_start: z.first_start,
        last_end: z.last_end,
        region_name: z.region_name,
        county_name: z.county_name,
        facility: z.facility,
        work_activity_class: z.work_activity_class,
        is_interstate: z.is_interstate,
        in_tma: z.in_tma,
        is_significant_candidate: z.is_significant_candidate,
        n_occurrences: z.n_occurrences,
        active_days: z.active_days,
        ...e,
      });
    }
    await say('work_zone/exposure:COMPUTED',
      `${rows.length} zones · ${tally.complete} with complete exposure`, tally);
    await updateProgress(0.6);

    // ── provision + write ──
    const view = d.target_view_id
      ? { view_id: d.target_view_id }
      : await deps.createDamaView({ source_id: d.source_id, user_id: d.user_id ?? null }, pgEnv);
    const schema = sql.WORK_ZONE_SCHEMA;
    const table = sql.tableNameFor({ source_id: d.source_id, view_id: view.view_id, stage: 'wz_exposure' });

    await pgDb.query(sql.wzExposureTableDDL(schema, table));
    await pgDb.query(sql.deleteWindowSQL({
      schema, table, dateColumn: 'first_start', startDate: d.start_date, endDate: d.end_date,
    }));

    const CHUNK = 2000;
    // The spine's table name, so the insert can take each zone's geometry from it.
    const eventTableName = spine.view.table_name;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const stmt = sql.wzExposureInsertSQL({
        schema, table, rows: rows.slice(i, i + CHUNK), eventTable: eventTableName,
      });
      if (stmt) await pgDb.query(stmt);
    }
    await updateProgress(0.9);

    // ── metadata ──
    const viewsTable = tableFor(db, 'views');
    await db.query(
      // The vintage label goes on in the same statement as the table name. It
      // used to be applied by hand afterwards, which meant a re-run silently
      // published an unlabelled view.
      `UPDATE ${viewsTable} SET table_schema = $1, table_name = $2, data_table = $3, version = $5
        WHERE view_id = $4`,
      [schema, table, `${schema}.${table}`, view.view_id,
       sql.vintageVersion({ startDate: d.start_date, endDate: d.end_date })]);

    const sum = (k) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
    const runMeta = {
      is_clickhouse_table: 0,
      start_date: d.start_date,
      end_date: d.end_date,
      thresholds,
      duration_basis: durationBasis,
      duration_cap_days: d.duration_cap_days ?? null,
      nominal_shift_hours: d.nominal_shift_hours ?? null,
      prefer_unidirectional_aadt: opts.preferUnidirectionalAadt,
      wz_event_source_id: d.wz_event_source_id,
      wz_event_view_id: spine.view.view_id,
      wz_event_tmc_source_id: tmcSourceId,
      npmrds_meta_source_id: meta,
      meta_year: metaYear,
      zones: rows.length,
      exposure_complete: tally.complete,
      zones_without_aadt: tally.no_aadt,
      zones_without_lane_count: tally.no_lane_count,
      zones_without_anchor: tally.no_anchor,
      zones_with_capped_duration: tally.capped,
      lane_mile_hours: Math.round(sum('lane_mile_hours')),
      lane_mile_hours_nominal: Math.round(sum('lane_mile_hours_nominal')),
      veh_through_wz: Math.round(sum('veh_through_wz')),
      vmt_through_wz: Math.round(sum('vmt_through_wz')),
    };
    await mergeJsonColumn(db, viewsTable, 'view_id', view.view_id, 'metadata', runMeta);
    await mergeJsonColumn(db, tableFor(db, 'sources'), 'source_id', d.source_id, 'metadata', {
      columns: sql.WZ_EXPOSURE_TABLE_COLUMNS, schema: 'wz_exposure_v1',
      wz_event_source_id: d.wz_event_source_id,
    });

    await updateProgress(1);
    await say('work_zone/exposure:FINAL', 'work_zone exposure complete', {
      source_id: d.source_id, view_id: view.view_id, ...tally,
      lane_mile_hours: runMeta.lane_mile_hours, vmt_through_wz: runMeta.vmt_through_wz,
    });

    return {
      source_id: d.source_id, view_id: view.view_id, zones: rows.length,
      exposure_complete: tally.complete,
      lane_mile_hours: runMeta.lane_mile_hours, vmt_through_wz: runMeta.vmt_through_wz,
    };
  };
}

module.exports = makeExposure();
module.exports.makeExposure = makeExposure;
