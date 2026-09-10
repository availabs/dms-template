/**
 * work_zone/spine — TRANSCOM events → the work-zone spine (phase 1).
 *
 * Produces the two tables every later stage reads:
 *   wz_event      one row per deduped work zone
 *   wz_event_tmc  one row per work zone × TMC, roled 'anchor' or 'impact'
 *
 * The judgement lives in the pure libs — lib/classify.js decides what is a
 * work zone, lib/dedupe.js collapses recurring chains, lib/extents.js places
 * them on the network, lib/tma.js decides significance. This worker is the
 * plumbing: resolve upstream views, read a window, hand the rows to those
 * libs, write the results, stamp the metadata.
 *
 * Dependency-injected via makeSpine(deps) so the integration test can fake the
 * physical Postgres side (PostGIS geometry, SERIAL, gist indexes) while
 * data_manager reads and writes stay on ctx.db, which is portable to sqlite.
 * Same pattern as data-types/npmrds/worker.js.
 *
 * ctx: { task, pgEnv, db, dispatchEvent, updateProgress }
 */
const {
  classifyBatch, DEFAULT_SCOPE_CLASSES, WORK_ACTIVITY_BY_EVENT_TYPE, LEGACY_FAMILY_SUB_CATEGORIES,
} = require('../lib/classify.js');
const { collapseChains, DEFAULT_MAX_GAP_DAYS } = require('../lib/dedupe.js');
const { parseAnchorTmc, buildExtent } = require('../lib/extents.js');
const { assessSignificance, DEFAULT_MIN_CONSECUTIVE_DAYS } = require('../lib/tma.js');
const { resolveThresholds } = require('../lib/thresholds.js');
const { STAGES } = require('../stages.js');
const sql = require('../sql.js');

const KNOWN_EVENT_TYPES = Object.keys(WORK_ACTIVITY_BY_EVENT_TYPE);

/**
 * `start_date_time` and `close_date` are read as TEXT on purpose.
 *
 * They are `timestamp without time zone` holding naive local times; the pg
 * driver would hand them back as Dates in the process's timezone, and any
 * subsequent `.toISOString()` shifts them by the local offset. Reading them as
 * text keeps the source's own wall clock intact end to end — see the note in
 * lib/dedupe.js.
 */
const EVENT_FIELDS = [
  'event_id', 'event_type', 'state', 'state_code', 'facility', 'direction', 'primary_direction',
  'county_name', 'region_name', 'description', 'summary_description',
  `to_char(start_date_time, 'YYYY-MM-DD HH24:MI:SS') AS start_date_time`,
  `to_char(close_date, 'YYYY-MM-DD HH24:MI:SS') AS close_date`,
  'lanes_total_count', 'lanes_affected_count', 'estimated_duration_mins',
  'tmclist', 'f_system', 'nysdot_general_category', 'nysdot_sub_category',
];

function defaultDeps() {
  const dbMod = require('@availabs/dms-server/src/db');
  const metadata = require('@availabs/dms-server/src/dama/upload/metadata');
  return {
    // In production this is the same adapter as ctx.db; split out so tests can
    // fake PostGIS without faking the DAMA bookkeeping.
    getPgDb: dbMod.getDb,
    createDamaView: metadata.createDamaView,
    createDamaSource: metadata.createDamaSource,
  };
}

const tableFor = (db, base) => (db.type === 'postgres' ? `data_manager.${base}` : base);
const parseJson = (v) => (typeof v === 'string' ? (v ? JSON.parse(v) : {}) : (v || {}));

async function mergeJsonColumn(db, table, idCol, id, col, patch) {
  const { rows } = await db.query(`SELECT ${col} FROM ${table} WHERE ${idCol} = $1`, [id]);
  const next = { ...parseJson(rows[0] && rows[0][col]), ...patch };
  await db.query(`UPDATE ${table} SET ${col} = $1 WHERE ${idCol} = $2`, [JSON.stringify(next), id]);
  return next;
}

/** Views of a source, newest first, with parsed metadata. */
async function viewsForSource(db, sourceId) {
  const { rows } = await db.query(
    `SELECT view_id, source_id, table_schema, table_name, data_table, version, metadata
       FROM ${tableFor(db, 'views')} WHERE source_id = $1 ORDER BY view_id DESC`, [sourceId]);
  return rows.map((r) => ({ ...r, metadata: parseJson(r.metadata) }));
}

const qualified = (v) => v.data_table || (v.table_schema ? `"${v.table_schema}"."${v.table_name}"` : v.table_name);

/** The newest view of a source that actually has a table behind it. */
async function resolveTable(db, sourceId, label) {
  const views = await viewsForSource(db, sourceId);
  const view = views.find((v) => v.table_name);
  if (!view) throw new Error(`${label}: source ${sourceId} has no view with a table`);
  return { view, table: qualified(view) };
}

/**
 * The npmrds meta geometry view: Postgres (not ClickHouse) and not per-year.
 * Filtered in JS rather than with jsonb operators so the resolution is portable.
 */
async function resolveMetaTable(db, sourceId) {
  const views = await viewsForSource(db, sourceId);
  const view = views.find((v) => {
    const m = v.metadata || {};
    const notCh = Number(m.is_clickhouse_table || 0) === 0;
    return v.table_name && notCh && (m.year === undefined || m.year === null);
  }) || views.find((v) => v.table_name);
  if (!view) throw new Error(`npmrds_meta: source ${sourceId} has no usable view`);
  return { view, table: qualified(view) };
}

function makeSpine(depOverrides = {}) {
  const deps = { ...defaultDeps(), ...depOverrides };

  return async function spine(ctx) {
    const { task, pgEnv, db, dispatchEvent, updateProgress } = ctx;
    const d = (task && task.descriptor) || {};
    const spec = STAGES.spine;

    // ── validate (a scheduled fire never passes through the route) ──
    const missing = spec.inputs.filter((k) => d[k] === undefined || d[k] === null);
    if (missing.length) throw new Error(`work_zone/spine: descriptor is missing ${missing.join(', ')}`);
    if (!d.start_date || !d.end_date) throw new Error('work_zone/spine: descriptor is missing start_date/end_date');
    const thresholds = resolveThresholds(d.thresholds);

    const scopeClasses = d.scope_classes || DEFAULT_SCOPE_CLASSES;
    const maxGapDays = d.chain_gap_days ?? DEFAULT_MAX_GAP_DAYS;
    const minConsecutiveDays = d.min_consecutive_days ?? DEFAULT_MIN_CONSECUTIVE_DAYS;
    const config = { scopeClasses, maxGapDays, minConsecutiveDays, thresholds };

    const say = (type, msg, payload) => (dispatchEvent ? dispatchEvent(type, msg, payload) : Promise.resolve());
    await say('work_zone/spine:INITIAL', 'work_zone spine run started', {
      source_id: d.source_id, start_date: d.start_date, end_date: d.end_date, ...config,
    });

    // ── resolve upstream tables by SOURCE id, never a hardcoded view ──
    const pgDb = deps.getPgDb(pgEnv);
    const events = await resolveTable(db, d.transcom_source_id, 'transcom');
    const meta = await resolveMetaTable(db, d.npmrds_meta_source_id);
    const eventTmc = d.transcom_event_tmc_source_id
      ? await resolveTable(db, d.transcom_event_tmc_source_id, 'transcom_event_tmc')
      : null;
    await say('work_zone/spine:RESOLVED', 'upstream tables resolved', {
      events: events.table, meta: meta.table, event_tmc: eventTmc && eventTmc.table,
    });

    // ── 1. read the window ──
    // Restricted to plausible work zones: anything the classifier knows, plus
    // anything the legacy family filter would have taken. Reading every event
    // instead would make the unknown-type report meaningless — it would fire
    // for crashes and weather on every run — and reads ~4x the rows.
    const { rows: rawEvents } = await pgDb.query(
      `SELECT ${EVENT_FIELDS.join(', ')} FROM ${events.table}
        WHERE start_date_time >= $1 AND start_date_time < ($2::date + INTERVAL '1 day')
          AND (event_type = ANY($3::text[]) OR nysdot_sub_category = ANY($4::text[]))`,
      [d.start_date, d.end_date, KNOWN_EVENT_TYPES, LEGACY_FAMILY_SUB_CATEGORIES]);
    await updateProgress(0.15);

    // ── 2. classify ──
    const { inScope, unknownEventTypes } = classifyBatch(rawEvents, { scopeClasses });
    // Every row read is either a type we know or one the legacy family filter
    // claims, so an unclassified row here is a genuinely new work-zone-family
    // event type — a decision for a person, never a silent drop.
    if (unknownEventTypes.length) {
      await say('work_zone/spine:UNKNOWN_EVENT_TYPES',
        `${unknownEventTypes.length} work-zone-family event_type value(s) are not in classify.js`,
        { unknown: unknownEventTypes.slice(0, 25) });
    }
    const legacyFamilyCount = rawEvents.filter((r) => {
      const sub = (r.nysdot_sub_category || '').trim();
      return LEGACY_FAMILY_SUB_CATEGORIES.includes(sub)
        && (r.state === 'NY' || Number(r.state_code) === 36);
    }).length;
    await say('work_zone/spine:CLASSIFIED', `${inScope.length} in-scope events of ${rawEvents.length} read`, {
      read: rawEvents.length, in_scope: inScope.length, legacy_family: legacyFamilyCount,
    });
    await updateProgress(0.3);

    // ── 3. collapse chains ──
    const scopeByEventId = new Map(inScope.map((c) => [String(c.row.event_id), c]));
    // The activity class is part of chain identity — see lib/dedupe.js chainKey.
    const workZones = collapseChains(
      inScope.map((c) => ({ ...c.row, work_activity_class: c.work_activity_class })),
      { maxGapDays });
    await say('work_zone/spine:DEDUPED',
      `${workZones.length} work zones from ${inScope.length} events`,
      { work_zones: workZones.length, collapse_ratio: +(inScope.length / (workZones.length || 1)).toFixed(2) });
    await updateProgress(0.45);

    // ── 4. extents: anchors from tmclist, impact TMCs from view 2799 ──
    const anchorByWz = new Map();
    for (const wz of workZones) {
      const first = scopeByEventId.get(wz.member_event_ids[0]);
      anchorByWz.set(wz.wz_event_id, first ? parseAnchorTmc(first.row) : null);
    }

    const impactByWz = new Map();
    if (eventTmc) {
      const memberIds = workZones.flatMap((wz) => wz.member_event_ids);
      const { rows: etRows } = await pgDb.query(
        `SELECT event_id, tmc FROM ${eventTmc.table} WHERE event_id = ANY($1::text[])`, [memberIds]);
      const wzByMember = new Map();
      for (const wz of workZones) for (const m of wz.member_event_ids) wzByMember.set(m, wz.wz_event_id);
      for (const r of etRows) {
        const wzId = wzByMember.get(String(r.event_id));
        if (!wzId) continue;
        if (!impactByWz.has(wzId)) impactByWz.set(wzId, new Set());
        impactByWz.get(wzId).add(String(r.tmc).toUpperCase());
      }
    }

    // AADT and geometry are per-year in the meta view; the window's year is the
    // right vintage to describe it.
    const metaYear = Number(String(d.start_date).slice(0, 4));

    const allTmcs = new Set();
    for (const [, t] of anchorByWz) if (t) allTmcs.add(t);
    for (const [, set] of impactByWz) for (const t of set) allTmcs.add(t);
    const metaByTmc = new Map();
    if (allTmcs.size) {
      // The meta view holds one row per (tmc, year) — up to 9 per TMC — so take
      // the newest vintage at or before the window's year. Without DISTINCT ON
      // the Map would keep whichever row the server happened to return last,
      // making length, AADT and ua_code non-deterministic between runs.
      // Column names: `miles` for length, `road` for the road name.
      const { rows: metaRows } = await pgDb.query(
        `SELECT DISTINCT ON (tmc)
                tmc, miles AS length, aadt, f_system, tmclinear, road_order, direction,
                road AS road_name, ua_code, year AS meta_year
           FROM ${meta.table}
          WHERE tmc = ANY($1::text[]) AND year <= $2
          ORDER BY tmc, year DESC`, [[...allTmcs], metaYear]);
      for (const r of metaRows) metaByTmc.set(String(r.tmc).toUpperCase(), r);
    }
    await updateProgress(0.6);

    // ── 5. assemble the rows ──
    const eventRows = [];
    const tmcRows = [];
    for (const wz of workZones) {
      const anchorTmc = anchorByWz.get(wz.wz_event_id) || null;
      const cls = scopeByEventId.get(wz.member_event_ids[0]);
      const extent = buildExtent({
        anchorTmc,
        impactTmcs: [...(impactByWz.get(wz.wz_event_id) || [])],
        metaByTmc,
        eventDirection: wz.direction,
      });
      const anchorMeta = anchorTmc ? metaByTmc.get(anchorTmc) : null;
      const sig = assessSignificance({
        ...wz,
        ua_code: anchorMeta ? anchorMeta.ua_code : null,
        f_system: anchorMeta ? anchorMeta.f_system : null,
      }, { minConsecutiveDays });

      eventRows.push({
        wz_event_id: wz.wz_event_id,
        member_event_ids: wz.member_event_ids.join(' '),
        n_occurrences: wz.n_occurrences,
        chain_key: wz.chain_key,
        facility: wz.facility,
        direction: extent.direction,
        county_name: wz.county_name,
        region_name: wz.region_name,
        description: wz.description,
        work_activity_class: cls ? cls.work_activity_class : null,
        is_utility_or_permit: cls ? cls.is_utility_or_permit : null,
        first_start: wz.first_start,
        last_end: wz.last_end,
        active_days: wz.active_days,
        active_hours: wz.active_hours,
        lanes_total: wz.lanes_total,
        lanes_affected: wz.lanes_affected,
        lanes_affected_known: wz.lanes_affected_known,
        consecutive_closure_days: wz.consecutive_closure_days,
        consecutive_active_days: wz.consecutive_active_days,
        anchor_tmc: anchorTmc,
        extent_source: extent.extent_source,
        extent_confidence: extent.extent_confidence,
        n_tmcs_anchor: extent.n_tmcs_anchor,
        n_tmcs_impact: extent.n_tmcs_impact,
        impact_extent_implausible: extent.impact_extent_implausible,
        length_mi: extent.length_mi,
        ua_code: anchorMeta ? anchorMeta.ua_code : null,
        is_interstate: sig.is_interstate,
        f_system_says_interstate: sig.f_system_says_interstate,
        interstate_signals_disagree: sig.interstate_signals_disagree,
        in_tma: sig.in_tma,
        tma_name: sig.tma_name,
        tma_basis: sig.tma_basis,
        meets_closure_duration: sig.meets_closure_duration,
        meets_activity_duration: sig.meets_activity_duration,
        is_significant_candidate: sig.is_significant_candidate,
        is_significant_candidate_any_activity: sig.is_significant_candidate_any_activity,
      });

      for (const t of extent.tmcs) {
        tmcRows.push({
          wz_event_id: wz.wz_event_id,
          tmc: t.tmc,
          tmc_role: t.tmc_role,
          first_start: wz.first_start,
          last_end: wz.last_end,
          length: t.length,
          aadt: t.aadt,
          f_system: t.f_system,
          tmclinear: t.tmclinear,
          road_order: t.road_order,
          road_name: t.road_name,
          linear_key: t.linear_key,
          has_meta: t.has_meta,
        });
      }
    }
    await updateProgress(0.7);

    // ── 6. provision: the wz_event_tmc source is created here, not by the route ──
    let tmcSourceId = d.wz_event_tmc_source_id ?? null;
    if (!tmcSourceId) {
      const { rows } = await db.query(
        `SELECT source_id FROM ${tableFor(db, 'sources')} WHERE type = $1 ORDER BY source_id DESC LIMIT 1`,
        ['wz_event_tmc']);
      tmcSourceId = rows[0] && rows[0].source_id;
    }
    if (!tmcSourceId) {
      const created = await deps.createDamaSource({
        name: `wz_event_tmc_${d.source_id}`,
        type: 'wz_event_tmc',
        user_id: d.user_id ?? null,
        metadata: { work_zone_stage: 'spine', wz_event_source_id: d.source_id },
      }, pgEnv);
      tmcSourceId = created.source_id;
    }

    const eventView = d.target_view_id
      ? { view_id: d.target_view_id }
      : await deps.createDamaView({ source_id: d.source_id, user_id: d.user_id ?? null }, pgEnv);
    const tmcView = d.target_tmc_view_id
      ? { view_id: d.target_tmc_view_id }
      : await deps.createDamaView({ source_id: tmcSourceId, user_id: d.user_id ?? null }, pgEnv);

    const schema = sql.WORK_ZONE_SCHEMA;
    const eventTable = sql.tableNameFor({ source_id: d.source_id, view_id: eventView.view_id, stage: 'wz_event' });
    const tmcTable = sql.tableNameFor({ source_id: tmcSourceId, view_id: tmcView.view_id, stage: 'wz_event_tmc' });

    await pgDb.query(sql.wzEventTableDDL(schema, eventTable));
    await pgDb.query(sql.wzEventTmcTableDDL(schema, tmcTable));

    // ── 7. idempotent write: replace the window, then insert ──
    await pgDb.query(sql.deleteWindowSQL({
      schema, table: eventTable, dateColumn: 'first_start', startDate: d.start_date, endDate: d.end_date,
    }));
    await pgDb.query(sql.deleteWindowSQL({
      schema, table: tmcTable, dateColumn: 'first_start', startDate: d.start_date, endDate: d.end_date,
    }));

    // Materialise the per-TMC geometry once; see sql.metaGeomTempTableSQL.
    const GEOM_TEMP = '_wz_meta_geom';
    await pgDb.query(sql.metaGeomTempTableSQL({ metaTable: meta.table, metaYear, tempTable: GEOM_TEMP }));

    // 2,000 rows per statement: a year's spine is ~670k wz_event_tmc rows, and
    // at 500 that is 1,300+ round trips.
    const CHUNK = 2000;
    for (let i = 0; i < eventRows.length; i += CHUNK) {
      const stmt = sql.wzEventInsertSQL({ schema, table: eventTable, rows: eventRows.slice(i, i + CHUNK) });
      if (stmt) await pgDb.query(stmt);
    }
    for (let i = 0; i < tmcRows.length; i += CHUNK) {
      const stmt = sql.wzEventTmcInsertSQL({
        schema, table: tmcTable, rows: tmcRows.slice(i, i + CHUNK),
        metaTable: meta.table, metaYear, geomTable: GEOM_TEMP,
      });
      if (stmt) await pgDb.query(stmt);
    }
    // The work zone's own geometry is its anchor TMC — see wzEventGeometryUpdateSQL.
    await pgDb.query(sql.wzEventGeometryUpdateSQL({
      schema, eventTable, tmcTable, startDate: d.start_date, endDate: d.end_date,
    }));
    await updateProgress(0.9);

    // ── 8. metadata — the most-forgotten step ──
    const viewsTable = tableFor(db, 'views');
    const sourcesTable = tableFor(db, 'sources');
    const setTable = async (viewId, tbl) => db.query(
      `UPDATE ${viewsTable} SET table_schema = $1, table_name = $2, data_table = $3 WHERE view_id = $4`,
      [schema, tbl, `${schema}.${tbl}`, viewId]);
    await setTable(eventView.view_id, eventTable);
    await setTable(tmcView.view_id, tmcTable);

    const significant = eventRows.filter((r) => r.is_significant_candidate).length;
    const runMeta = {
      is_clickhouse_table: 0,
      start_date: d.start_date,
      end_date: d.end_date,
      thresholds,
      scope_classes: scopeClasses,
      chain_gap_days: maxGapDays,
      min_consecutive_days: minConsecutiveDays,
      transcom_source_id: d.transcom_source_id,
      npmrds_meta_source_id: d.npmrds_meta_source_id,
      meta_year: metaYear,
      transcom_event_tmc_source_id: d.transcom_event_tmc_source_id ?? null,
      events_read: rawEvents.length,
      events_in_scope: inScope.length,
      events_legacy_family: legacyFamilyCount,
      work_zones: eventRows.length,
      significant_candidates: significant,
      unknown_event_types: unknownEventTypes,
    };
    await mergeJsonColumn(db, viewsTable, 'view_id', eventView.view_id, 'metadata', runMeta);
    await mergeJsonColumn(db, viewsTable, 'view_id', tmcView.view_id, 'metadata',
      { ...runMeta, tmc_rows: tmcRows.length });
    await mergeJsonColumn(db, sourcesTable, 'source_id', d.source_id, 'metadata', {
      columns: sql.WZ_EVENT_TABLE_COLUMNS, schema: 'wz_event_v1', wz_event_tmc_source_id: tmcSourceId,
    });
    await mergeJsonColumn(db, sourcesTable, 'source_id', tmcSourceId, 'metadata', {
      columns: sql.WZ_EVENT_TMC_TABLE_COLUMNS, schema: 'wz_event_tmc_v1', wz_event_source_id: d.source_id,
    });

    await updateProgress(1);
    await say('work_zone/spine:FINAL', 'work_zone spine complete', {
      source_id: d.source_id, view_id: eventView.view_id,
      wz_event_tmc_source_id: tmcSourceId, tmc_view_id: tmcView.view_id,
      work_zones: eventRows.length, tmc_rows: tmcRows.length, significant_candidates: significant,
    });

    return {
      source_id: d.source_id, view_id: eventView.view_id,
      wz_event_tmc_source_id: tmcSourceId, tmc_view_id: tmcView.view_id,
      work_zones: eventRows.length, tmc_rows: tmcRows.length, significant_candidates: significant,
    };
  };
}

module.exports = makeSpine();
module.exports.makeSpine = makeSpine;
