/**
 * work_zone/delay — M2, vehicle-hours of delay (phase 4).
 *
 * Reads the phase-1 spine and TRANSCOM's event-to-TMC conflation (view 2799),
 * and produces `wz_delay`: one row per work zone with delay in vehicle-hours,
 * delay per vehicle, and the anchor/impact split.
 *
 * ── ⚠ This worker sums ALL TMC roles. exposure.js and speed.js do not. ────
 * `workers/exposure.js` reads anchor TMCs only, and says so in its own header:
 * counting the queue would inflate lane-mile-hours. `workers/speed.js` does the
 * same, because M1 is a statement about speed where the work is.
 *
 * **M2 is the opposite.** Delay IS the queue. Measured on CY2024 a work zone's
 * delay divides anchor 3.52 M vehicle-hours (8.6%) / impact 37.22 M (91.4%), so
 * an anchors-only rollup reports 3.5 M where the truth is 40.7 M. The split is
 * written to every row so the rule stays checkable.
 *
 * ── The join is on (event_id, tmc). NEVER on region_name. ─────────────────
 * 2799 stores `'Region 11 - New York City '` with a trailing space; the phase-1
 * spine trims it. Joining on the region name silently drops New York City —
 * which is 83% of the state's work-zone delay. Region comes from the spine.
 *
 * Delay is not recomputed here: 2799 already attributes it per (event, TMC) in
 * vehicle-hours. See lib/delay.js for the rollup rules and for what is known
 * and unknown about `delay` vs `raw_delay`.
 *
 * Dependency-injected via makeDelay(deps) so the integration test can fake the
 * physical Postgres side. ctx: { task, pgEnv, db, dispatchEvent, updateProgress }
 */
const { delayForZone, rollupDelay, delayShare } = require('../lib/delay.js');
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

function makeDelay(depOverrides = {}) {
  const deps = { ...defaultDeps(), ...depOverrides };

  return async function delay(ctx) {
    const { task, pgEnv, db, dispatchEvent, updateProgress } = ctx;
    const d = (task && task.descriptor) || {};
    const spec = STAGES.delay;

    const missing = spec.inputs.filter((k) => d[k] === undefined || d[k] === null);
    if (missing.length) throw new Error(`work_zone/delay: descriptor is missing ${missing.join(', ')}`);
    if (!d.start_date || !d.end_date) throw new Error('work_zone/delay: descriptor is missing start_date/end_date');
    const thresholds = resolveThresholds(d.thresholds);

    const say = (type, msg, payload) => (dispatchEvent ? dispatchEvent(type, msg, payload) : Promise.resolve());
    await say('work_zone/delay:INITIAL', 'work_zone delay run started', {
      source_id: d.source_id, start_date: d.start_date, end_date: d.end_date,
      delay_per_veh_min: thresholds.delay_per_veh_min,
    });

    const pgDb = deps.getPgDb(pgEnv);

    // ── resolve the spine views for THIS window ──
    const spine = await resolveSpineView(db, d.wz_event_source_id, d.start_date, 'wz_event');
    const tmcSourceId = d.wz_event_tmc_source_id
      ?? parseJson((await db.query(
        `SELECT metadata FROM ${tableFor(db, 'sources')} WHERE source_id = $1`, [d.wz_event_source_id]
      )).rows[0]?.metadata).wz_event_tmc_source_id;
    if (!tmcSourceId) throw new Error('work_zone/delay: cannot resolve the wz_event_tmc source (pass wz_event_tmc_source_id)');
    const tmcView = await resolveTmcView(db, tmcSourceId, spine.view);

    // Phase 2's exposure view for the same window supplies veh_through_wz. It is
    // optional: without it delay still publishes, and the per-vehicle rate is
    // null rather than invented.
    let exposureTable = null;
    if (d.wz_exposure_source_id) {
      const exp = (await viewsForSource(db, d.wz_exposure_source_id)).filter((v) => v.table_name);
      const year = String(d.start_date).slice(0, 4);
      const match = exp.find((v) => String(v.metadata.start_date || '').slice(0, 4) === year);
      if (match) exposureTable = qualified(match);
      else await say('work_zone/delay:WARN',
        `wz_exposure source ${d.wz_exposure_source_id} has no view for ${year}; delay per vehicle will be null`, {});
    }

    await say('work_zone/delay:RESOLVED', 'inputs resolved', {
      wz_event: spine.table, wz_event_tmc: tmcView.table,
      event_tmc_table: d.event_tmc_table, wz_exposure: exposureTable,
    });

    // ── zones in the window, with the exposure vehicle count ──
    const { rows: zones } = await pgDb.query(
      `SELECT e.wz_event_id, e.member_event_ids,
              to_char(e.first_start,'YYYY-MM-DD HH24:MI:SS') AS first_start,
              to_char(e.last_end,'YYYY-MM-DD HH24:MI:SS') AS last_end,
              e.region_name, e.county_name, e.facility, e.work_activity_class,
              e.is_interstate, e.in_tma, e.is_significant_candidate
              ${exposureTable ? ', x.veh_through_wz' : ', NULL::double precision AS veh_through_wz'}
         FROM ${spine.table} e
         ${exposureTable ? `LEFT JOIN ${exposureTable} x ON x.wz_event_id = e.wz_event_id` : ''}
        WHERE e.first_start >= $1::date AND e.first_start < ($2::date + INTERVAL '1 day')`,
      [d.start_date, d.end_date]);
    await updateProgress(0.15);

    // ── delay rows: member events x the zone's TMCs, ALL roles ──
    // The role is carried through so the rollup can split anchor from impact
    // without a second query, and so an anchors-only regression is visible.
    const { rows: delayRows } = await pgDb.query(
      `WITH zone_members AS (
         SELECT wz_event_id, unnest(string_to_array(member_event_ids, ' ')) AS event_id
           FROM ${spine.table}
          WHERE first_start >= $1::date AND first_start < ($2::date + INTERVAL '1 day')),
       zone_tmcs AS (
         SELECT DISTINCT wz_event_id, tmc, tmc_role FROM ${tmcView.table})
       SELECT zm.wz_event_id, zt.tmc, zt.tmc_role, et.delay, et.raw_delay
         FROM zone_members zm
         JOIN zone_tmcs zt ON zt.wz_event_id = zm.wz_event_id
         JOIN ${d.event_tmc_table} et ON et.event_id = zm.event_id AND et.tmc = zt.tmc`,
      [d.start_date, d.end_date]);
    await say('work_zone/delay:READ', `${delayRows.length} (event x tmc) delay rows`, {
      zones: zones.length, delay_rows: delayRows.length,
    });
    await updateProgress(0.4);

    const byZone = new Map();
    for (const r of delayRows) {
      const k = String(r.wz_event_id);
      if (!byZone.has(k)) byZone.set(k, []);
      byZone.get(k).push(r);
    }

    const rows = zones.map((z) => ({
      wz_event_id: z.wz_event_id,
      first_start: z.first_start, last_end: z.last_end,
      region_name: z.region_name, county_name: z.county_name, facility: z.facility,
      work_activity_class: z.work_activity_class,
      is_interstate: z.is_interstate, in_tma: z.in_tma,
      is_significant_candidate: z.is_significant_candidate,
      veh_through_wz: z.veh_through_wz === null || z.veh_through_wz === undefined
        ? null : Number(z.veh_through_wz),
      delay_per_veh_min_threshold: thresholds.delay_per_veh_min,
      ...delayForZone(byZone.get(String(z.wz_event_id)) || [], {
        veh_through_wz: z.veh_through_wz,
        delay_per_veh_min: thresholds.delay_per_veh_min,
      }),
    }));

    const statewide = rollupDelay(rows);
    await say('work_zone/delay:COMPUTED',
      `${statewide.delay_vehicle_hours} veh-hrs across ${statewide.zones_with_delay} zones`, statewide);
    await updateProgress(0.6);

    // ── the share of all delay, from the excessive-delay series ──
    // Source 2039 / view 3488 by default: view 2633 (excessive_delay_v3) is
    // missing 2020 entirely and its 2019 is broken.
    let share = null;
    if (d.excessive_delay_source_id) {
      const eds = (await viewsForSource(db, d.excessive_delay_source_id)).filter((v) => v.table_name);
      if (eds.length) {
        const year = Number(String(d.start_date).slice(0, 4));
        const { rows: agg } = await pgDb.query(
          `SELECT sum(total) AS total, sum(construction) AS construction
             FROM ${qualified(eds[0])} WHERE year = $1`, [year]);
        share = delayShare({
          wzDelay: statewide.delay_vehicle_hours,
          total: agg[0] && agg[0].total,
          construction: agg[0] && agg[0].construction,
        });
        await say('work_zone/delay:SHARE', 'work-zone delay as a share of all delay', share);
      }
    }

    // ── provision + write ──
    const view = d.target_view_id
      ? { view_id: d.target_view_id }
      : await deps.createDamaView({ source_id: d.source_id, user_id: d.user_id ?? null }, pgEnv);
    const schema = sql.WORK_ZONE_SCHEMA;
    const table = sql.tableNameFor({ source_id: d.source_id, view_id: view.view_id, stage: 'wz_delay' });

    await pgDb.query(sql.wzDelayTableDDL(schema, table));
    await pgDb.query(sql.deleteWindowSQL({
      schema, table, dateColumn: 'first_start', startDate: d.start_date, endDate: d.end_date,
    }));

    const CHUNK = 2000;
    const eventTableName = spine.view.table_name;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const stmt = sql.wzDelayInsertSQL({
        schema, table, rows: rows.slice(i, i + CHUNK), eventTable: eventTableName,
      });
      if (stmt) await pgDb.query(stmt);
    }
    await updateProgress(0.9);

    // ── metadata ──
    const viewsTable = tableFor(db, 'views');
    await db.query(
      `UPDATE ${viewsTable} SET table_schema = $1, table_name = $2, data_table = $3, version = $5
        WHERE view_id = $4`,
      [schema, table, `${schema}.${table}`, view.view_id,
       sql.vintageVersion({ startDate: d.start_date, endDate: d.end_date })]);

    const runMeta = {
      is_clickhouse_table: 0,
      start_date: d.start_date, end_date: d.end_date,
      thresholds,
      // Recorded because it is the inverse of phases 2 and 3 and the single
      // easiest thing to get wrong when copying this pipeline forward.
      tmc_roles_included: 'anchor+impact',
      delay_column: 'delay',
      delay_column_note: 'raw_delay published alongside; its relationship to delay is undocumented upstream',
      wz_event_source_id: d.wz_event_source_id, wz_event_view_id: spine.view.view_id,
      wz_event_tmc_source_id: tmcSourceId,
      wz_exposure_source_id: d.wz_exposure_source_id ?? null,
      wz_exposure_table: exposureTable,
      event_tmc_table: d.event_tmc_table,
      excessive_delay_source_id: d.excessive_delay_source_id ?? null,
      zones: rows.length, delay_rows: delayRows.length,
      statewide_m2: statewide,
      delay_share: share,
    };
    await mergeJsonColumn(db, viewsTable, 'view_id', view.view_id, 'metadata', runMeta);
    await mergeJsonColumn(db, tableFor(db, 'sources'), 'source_id', d.source_id, 'metadata', {
      columns: sql.WZ_DELAY_TABLE_COLUMNS, schema: 'wz_delay_v1',
      wz_event_source_id: d.wz_event_source_id,
    });

    await updateProgress(1);
    await say('work_zone/delay:FINAL', 'work_zone delay complete', {
      source_id: d.source_id, view_id: view.view_id, zones: rows.length,
      delay_vehicle_hours: statewide.delay_vehicle_hours,
      delay_impact_share: statewide.delay_impact_share,
      delay_per_vehicle_min: statewide.delay_per_vehicle_min,
      zones_exceeding_per_vehicle: statewide.zones_exceeding_per_vehicle,
      share_of_all_delay: share && share.share_of_all_delay,
    });

    return {
      source_id: d.source_id, view_id: view.view_id, zones: rows.length,
      statewide: statewide, share,
    };
  };
}

module.exports = makeDelay();
module.exports.makeDelay = makeDelay;
