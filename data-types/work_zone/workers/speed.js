/**
 * work_zone/speed — M1, speed-threshold exceedance (phase 3).
 *
 * Produces `wz_speed`: one row per (work zone × TMC × hour-of-day) with epochs
 * observed while the zone was active, how many fell below each of three
 * thresholds, the observed speeds, and what they were compared against.
 *
 * ── Shape of the run ──────────────────────────────────────────────────────
 *  1. Resolve the phase-1 spine view for THIS window (one vintage per year).
 *  2. Read the zones, and their ACTIVE EPOCH WINDOWS from view 2799 — which
 *     carries `bound_start_time`/`bound_end_time` on every row and, verified,
 *     equals the event's own reported start/close window rather than a
 *     congestion-detected one. Using a congestion-derived window would make M1
 *     circular: measuring slow epochs over exactly the epochs where congestion
 *     was found.
 *  3. Read per-TMC length, PM3 reference speed and the FHWA threshold.
 *  4. Stage those three sets in ClickHouse, run one query, drop the staging.
 *  5. Roll the cells into per-zone M1 for the view metadata, and write cells.
 *
 * Dependency-injected via makeSpeed(deps) so the integration test can fake both
 * the physical Postgres side and ClickHouse. No test touches either.
 *
 * ctx: { task, pgEnv, db, dispatchEvent, updateProgress }
 */
const { baselineWindow, baselineSQL, measureSQL, fhwaThresholdSpeed, postedDropThresholdSpeed,
        DEFAULT_BASELINE_MONTHS, EPOCHS_PER_DAY } = require('../lib/baseline.js');

/**
 * Longest span a single 2799 (event, tmc) row may claim as active, in days.
 * Matches phase 2's duration cap: the same never-closed records that made the
 * reported duration unusable there would otherwise claim a month of active
 * time here. Truncations are counted into the run metadata.
 */
const MAX_SPAN_DAYS = 30;
const { m1ForZone, groupCellsByZone, rollupM1, DEFAULT_MIN_EPOCHS } = require('../lib/measures.js');
const { zoneHourM1SQL, rollupZoneM1, rollupZoneM1ByTier,
        DEFAULT_MIN_EPOCHS_PER_HOUR } = require('../lib/m1.js');
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
  };
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

/**
 * A source's view by DAMA `version`, for pm3's per-year vintages.
 *
 * PM3 lags the work-zone inventory: the inventory has a CY2026 vintage while
 * PM3's newest year is 2025. Rather than refuse to measure the current year,
 * fall back to the newest numeric vintage available and record that it happened
 * (`pm3_version_fallback`). The reference speed is the segment's 85th-percentile
 * free-flow speed — a property of the road, not of the year — so the nearest
 * vintage is a defensible stand-in, but only if the substitution is visible.
 * Any OLDER missing year is still an error: that means PM3 is incomplete
 * behind us, which is a data problem, not a lag.
 */
async function resolveVersionView(db, sourceId, version, label) {
  const views = (await viewsForSource(db, sourceId)).filter((v) => v.table_name);
  const match = views.find((v) => String(v.version) === String(version));
  if (match) return { view: match, table: qualified(match), requested: String(version), fallback: false };

  const numeric = views
    .filter((v) => /^\d{4}$/.test(String(v.version)))
    .sort((a, b) => Number(b.version) - Number(a.version));
  const newest = numeric[0];
  if (newest && Number(version) > Number(newest.version)) {
    return { view: newest, table: qualified(newest), requested: String(version), fallback: true };
  }
  const have = views.map((v) => v.version).join(', ');
  throw new Error(`${label}: source ${sourceId} has no view for version ${version} (has: ${have})`);
}

function makeSpeed(depOverrides = {}) {
  const deps = { ...defaultDeps(), ...depOverrides };

  return async function speed(ctx) {
    const { task, pgEnv, db, dispatchEvent, updateProgress } = ctx;
    const d = (task && task.descriptor) || {};
    const spec = STAGES.speed;

    const missing = spec.inputs.filter((k) => d[k] === undefined || d[k] === null);
    if (missing.length) throw new Error(`work_zone/speed: descriptor is missing ${missing.join(', ')}`);
    if (!d.start_date || !d.end_date) throw new Error('work_zone/speed: descriptor is missing start_date/end_date');
    const thresholds = resolveThresholds(d.thresholds);

    const baselineMonths = d.baseline_months ?? DEFAULT_BASELINE_MONTHS;
    const minEpochs = d.min_epochs ?? DEFAULT_MIN_EPOCHS;
    // How much of an hour must be observed before M1 will classify it.
    const minEpochsPerHour = d.min_epochs_per_hour ?? DEFAULT_MIN_EPOCHS_PER_HOUR;
    const { baseline_start, baseline_end } = baselineWindow({ startDate: d.start_date, months: baselineMonths });
    const year = Number(String(d.start_date).slice(0, 4));

    const say = (t, m, p) => (dispatchEvent ? dispatchEvent(t, m, p) : Promise.resolve());
    await say('work_zone/speed:INITIAL', 'work_zone speed run started', {
      source_id: d.source_id, start_date: d.start_date, end_date: d.end_date,
      thresholds, baseline_months: baselineMonths, baseline_start, baseline_end, min_epochs: minEpochs,
    });

    const pgDb = deps.getPgDb(pgEnv);
    const chDb = deps.getChDb(pgEnv);

    // ── resolve everything by source id ──
    const spine = await resolveYearView(db, d.wz_event_source_id, d.start_date, 'wz_event');
    const tmcSourceId = d.wz_event_tmc_source_id
      ?? parseJson((await db.query(`SELECT metadata FROM ${tableFor(db, 'sources')} WHERE source_id = $1`,
        [d.wz_event_source_id])).rows[0]?.metadata).wz_event_tmc_source_id;
    if (!tmcSourceId) throw new Error('work_zone/speed: cannot resolve the wz_event_tmc source');
    const tmcView = await resolveYearView(db, tmcSourceId, d.start_date, 'wz_event_tmc');

    const metaSourceId = spine.view.metadata.npmrds_meta_source_id;
    if (!metaSourceId) throw new Error('work_zone/speed: the spine view records no npmrds_meta_source_id');
    const metaViews = (await viewsForSource(db, metaSourceId)).filter((v) => v.table_name);
    const metaView = metaViews.find((v) => {
      const m = v.metadata || {};
      return Number(m.is_clickhouse_table || 0) === 0 && (m.year === undefined || m.year === null);
    }) || metaViews[0];
    if (!metaView) throw new Error(`work_zone/speed: npmrds_meta source ${metaSourceId} has no usable view`);

    // The NPMRDS speeds live in ClickHouse; take the CH view of the prod source.
    const speedViews = (await viewsForSource(db, d.npmrds_source_id)).filter((v) => v.table_name);
    const speedView = speedViews.find((v) => Number(parseJson(v.metadata).is_clickhouse_table) === 1);
    if (!speedView) throw new Error(`work_zone/speed: npmrds source ${d.npmrds_source_id} has no ClickHouse view`);
    const speedTable = chLib.stripChPrefix(qualified(speedView).replace(/"/g, ''));

    // PM3 supplies the reference speed; its views are versioned by year.
    const pm3 = await resolveVersionView(db, d.pm3_source_id, year, 'pm3');

    await say('work_zone/speed:RESOLVED', 'inputs resolved', {
      wz_event: spine.table, wz_event_tmc: tmcView.table, npmrds_meta: qualified(metaView),
      npmrds_speeds_ch: speedTable, pm3: pm3.table, meta_year: year,
      pm3_version_fallback: pm3.fallback ? `${year} -> ${pm3.view.version}` : false,
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
    const zoneById = new Map(zones.map((z) => [z.wz_event_id, z]));
    await updateProgress(0.1);

    // ── active epoch windows: the zones' member events × their anchor TMCs ──
    // 2799 gives the epoch bounds; the anchor filter keeps the measure on the
    // work extent rather than the congestion corridor.
    //
    // A 2799 row is one (event, tmc) SPAN — `bound_start_date/time` to
    // `bound_end_date/time` — not one row per active day, and it must be
    // expanded to the day grid before it can be joined to NPMRDS. Three things
    // about that expansion are load-bearing, each measured on CY2024:
    //
    //  1. **Multi-day spans (12.8% of rows, up to 27 days).** Reading the row
    //     as-is measures only its FIRST day, and on that day applies an epoch
    //     range whose end belongs to a later day — usually an empty range. The
    //     first version of this query did exactly that and silently lost most of
    //     the active time of every zone lasting more than a day.
    //  2. **Same-day rows whose end epoch precedes its start (0.8%).** That is a
    //     night shift that crossed midnight, so the end is rolled onto the next
    //     day. Read literally it is an empty range and the shift disappears —
    //     and night work is precisely when a work zone's speed impact is
    //     cheapest, so dropping it would bias M1 upward.
    //  3. **Epoch bounds are half-open.** `bound_end_time` reaches 288, one past
    //     the last epoch of the day, so the end is exclusive; a whole day is
    //     [0, 288). The measure joins with `< epoch_to` to match.
    //
    // Spans are capped at MAX_SPAN_DAYS and clamped to the measurement window:
    // the cap matches phase 2's duration cap so one never-closed record cannot
    // claim a month of active time, and the clamp keeps the staged table from
    // carrying days the measure would discard anyway.
    //
    // ── Why there is a second, fallback source of windows ──────────────────
    // View 2799 is the event->TMC conflation, and it has holes: NO rows at all
    // for 2019 and 2020, only 9,070 events in 2018 against 134,337 in 2024, and
    // even in a good year ~10% of zones have no conflated row. Measured against
    // 2799 alone, M1 is simply blank for two of the nine vintages.
    //
    // The anchor TMC does not come from 2799 — the spine reads it from the
    // event's own `tmclist` — so for those zones the segment is known and only
    // the window is missing. It is recovered from the anchor row's own
    // `first_start`/`last_end`, which is the same quantity 2799 reports
    // per-TMC, just without the per-TMC refinement. Converting that clock time
    // to the epoch grid reproduces 2799's bounds exactly on the cases where
    // both exist (an event 04:25-09:45 gives epochs 53-117 either way), so this
    // is the same measure on a coarser input, not a different measure.
    //
    // Every row records which source it came from in `window_source`, and the
    // counts are stamped on the view, because the fallback's weakness is real:
    // the anchor row's span is the CHAIN's span, so a recurring chain can claim
    // days it was not working. MAX_SPAN_DAYS bounds the damage and the flag
    // makes those rows filterable.
    const { rows: activeRows } = await pgDb.query(
      `WITH zone_members AS (
         SELECT wz_event_id, unnest(string_to_array(member_event_ids, ' ')) AS event_id
           FROM ${spine.table}
          WHERE first_start >= $1::date AND first_start < ($2::date + INTERVAL '1 day')),
       anchors AS (
         SELECT DISTINCT wz_event_id, tmc FROM ${tmcView.table} WHERE tmc_role = 'anchor'),
       spans AS (
         SELECT DISTINCT zm.wz_event_id, a.tmc,
                et.bound_start_date AS d0, et.bound_start_time AS t0,
                CASE WHEN et.bound_end_date = et.bound_start_date
                          AND et.bound_end_time <= et.bound_start_time
                     THEN et.bound_start_date + 1
                     ELSE et.bound_end_date END AS d1,
                et.bound_end_time AS t1
           FROM zone_members zm
           JOIN anchors a ON a.wz_event_id = zm.wz_event_id
           JOIN ${d.event_tmc_table} et ON et.event_id = zm.event_id AND et.tmc = a.tmc
          WHERE et.bound_start_time IS NOT NULL AND et.bound_end_time IS NOT NULL),
       -- Anchor rows with no 2799 span: recover the window from the anchor's own
       -- clock times. floor() for the start and ceil() for the end reproduce
       -- 2799's half-open epoch bounds.
       derived AS (
         SELECT t.wz_event_id, t.tmc,
                t.first_start::date AS d0,
                FLOOR((EXTRACT(HOUR FROM t.first_start) * 60
                     + EXTRACT(MINUTE FROM t.first_start)) / 5.0)::int AS t0,
                t.last_end::date AS d1,
                LEAST(${EPOCHS_PER_DAY}, CEIL((EXTRACT(HOUR FROM t.last_end) * 60
                     + EXTRACT(MINUTE FROM t.last_end)
                     + EXTRACT(SECOND FROM t.last_end) / 60.0) / 5.0))::int AS t1
           FROM ${tmcView.table} t
           JOIN ${spine.table} e ON e.wz_event_id = t.wz_event_id
          WHERE t.tmc_role = 'anchor'
            AND e.first_start >= $1::date AND e.first_start < ($2::date + INTERVAL '1 day')
            AND t.first_start IS NOT NULL AND t.last_end IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM spans s
                             WHERE s.wz_event_id = t.wz_event_id AND s.tmc = t.tmc)),
       capped AS (
         SELECT wz_event_id, tmc, d0, t0, t1, LEAST(d1, d0 + ${MAX_SPAN_DAYS}) AS d1,
                '2799' AS window_source
           FROM spans WHERE d1 >= d0
          UNION ALL
         SELECT wz_event_id, tmc, d0, t0, t1, LEAST(d1, d0 + ${MAX_SPAN_DAYS}) AS d1,
                'event' AS window_source
           FROM derived WHERE d1 >= d0)
       SELECT wz_event_id, tmc, to_char(g.day::date, 'YYYY-MM-DD') AS date, window_source,
              CASE WHEN g.day::date = d0 THEN t0 ELSE 0 END AS epoch_from,
              CASE WHEN g.day::date = d1 THEN t1 ELSE ${EPOCHS_PER_DAY} END AS epoch_to
         FROM capped
         CROSS JOIN generate_series(GREATEST(d0, $1::date)::timestamp,
                                    LEAST(d1, $2::date)::timestamp,
                                    INTERVAL '1 day') AS g(day)
        WHERE (CASE WHEN g.day::date = d0 THEN t0 ELSE 0 END)
            < (CASE WHEN g.day::date = d1 THEN t1 ELSE ${EPOCHS_PER_DAY} END)`,
      [d.start_date, d.end_date]);
    await updateProgress(0.25);

    // ── per-TMC length, reference speed and thresholds ──
    const { rows: tmcRows } = await pgDb.query(
      `WITH anchors AS (SELECT DISTINCT tmc FROM ${tmcView.table} WHERE tmc_role = 'anchor'),
       m AS (SELECT DISTINCT ON (tmc) tmc, miles, avg_speedlimit
               FROM ${qualified(metaView)} WHERE year <= $1 ORDER BY tmc, year DESC)
       SELECT a.tmc, m.miles, m.avg_speedlimit,
              p.speed_pctl_85 AS reference_speed, p.phed_threshold_speed
         FROM anchors a
         LEFT JOIN m ON m.tmc = a.tmc
         LEFT JOIN ${pm3.table} p ON p.tmc = a.tmc`,
      [year]);

    // ── contaminated (tmc, date) pairs over the baseline window ──
    // Expanded across each span's whole days for the same reason the active
    // windows are: keying on the start date alone leaves the later days of every
    // multi-day event IN the baseline, which is the contamination this exclusion
    // exists to remove. Epochs are irrelevant here — a contaminated day is
    // dropped whole (see lib/baseline.js on why).
    const { rows: excludeRows } = await pgDb.query(
      `WITH spans AS (
         SELECT DISTINCT tmc, bound_start_date AS d0,
                LEAST(GREATEST(bound_end_date, bound_start_date),
                      bound_start_date + ${MAX_SPAN_DAYS}) AS d1
           FROM ${d.event_tmc_table}
          WHERE bound_end_date >= $1::date AND bound_start_date <= $2::date)
       SELECT DISTINCT tmc, to_char(g.day::date, 'YYYY-MM-DD') AS date
         FROM spans
         CROSS JOIN generate_series(GREATEST(d0, $1::date)::timestamp,
                                    LEAST(d1, $2::date)::timestamp,
                                    INTERVAL '1 day') AS g(day)`,
      [baseline_start, baseline_end]);
    await updateProgress(0.35);

    await say('work_zone/speed:STAGED', 'inputs read', {
      zones: zones.length, active_windows: activeRows.length,
      anchor_tmcs: tmcRows.length, excluded_tmc_days: excludeRows.length,
    });

    // ── stage in ClickHouse, measure, drop ──
    const runId = `${d.source_id}_${Date.now()}`;
    const names = {
      database: d.ch_database || chLib.DEFAULT_CH_DATABASE,
      tmcTable: chLib.stagingTableName('tmc', runId),
      activeTable: chLib.stagingTableName('active', runId),
      excludeTable: chLib.stagingTableName('exclude', runId),
    };
    let cells = [];
    let zoneM1Rows = [];
    try {
      // Drop anything a previously killed run left behind. The staging tables
      // are Memory-engine on a shared server, and `finally` does not run on a
      // SIGKILL. 6-hour floor, so this can never touch a concurrent run.
      const swept = await chLib.sweepStaleStaging(chDb, { database: names.database });
      if (swept.length) {
        await say('work_zone/speed:SWEPT', `dropped ${swept.length} orphaned staging tables`,
          { tables: swept });
      }
      for (const stmt of chLib.stagingDDL(names)) await chLib.chExec(chDb, stmt);

      await chLib.insertRows(chDb, `${names.database}.${names.tmcTable}`, tmcRows.map((r) => ({
        tmc: r.tmc,
        miles: Number(r.miles) || 0,
        reference_speed: Number(r.reference_speed) || 0,
        // The primary threshold, computed once here from the POSTGRES posted
        // limit (the ClickHouse copy of avg_speedlimit is empty — see
        // lib/baseline.js) and staged per TMC so the measure query applies it
        // rather than recomputing the floor per epoch.
        // The raw limit as well as the derived threshold: M1 is a ZONE measure,
        // so it needs the length-weighted limit across the zone's segments and
        // must apply the floor after that weighting, not before.
        posted_speed_limit: Number(r.avg_speedlimit) || 0,
        posted_threshold_speed:
          postedDropThresholdSpeed(r.avg_speedlimit, thresholds.posted_speed_drop_mph) || 0,
        phed_threshold_speed: Number(r.phed_threshold_speed) || 0,
        fhwa_threshold_speed: fhwaThresholdSpeed(r.avg_speedlimit) || 0,
      })));
      await chLib.insertRows(chDb, `${names.database}.${names.activeTable}`, activeRows.map((r) => ({
        wz_event_id: r.wz_event_id, tmc: r.tmc, date: r.date,
        epoch_from: Number(r.epoch_from), epoch_to: Number(r.epoch_to),
        window_source: r.window_source,
      })));
      await chLib.insertRows(chDb, `${names.database}.${names.excludeTable}`,
        excludeRows.map((r) => ({ tmc: r.tmc, date: r.date })));
      await updateProgress(0.5);

      const qualify = (t) => `${names.database}.${t}`;
      const baselineCte = baselineSQL({
        speedTable, tmcTable: qualify(names.tmcTable), excludeTable: qualify(names.excludeTable),
        baselineStart: baseline_start, baselineEnd: baseline_end,
      });
      const measure = measureSQL({
        speedTable, tmcTable: qualify(names.tmcTable), activeTable: qualify(names.activeTable),
        baselineCte,
        speedThresholdMph: thresholds.speed_threshold_mph,
        referencePct: thresholds.reference_speed_pct,
        windowStart: d.start_date, windowEnd: d.end_date,
      });
      cells = await chLib.chQueryRows(chDb, measure);
      await say('work_zone/speed:MEASURED', `${cells.length} (zone × tmc × hour) cells`, { cells: cells.length });

      // ── M1 proper, at the grain the measure is actually defined at ──
      // "Percent of active work-zone HOURS in which the AVERAGE SPEED WITHIN THE
      // ZONE falls below the threshold." The cell measure above is the evidence
      // table — finer in both time and space — and does not answer this. Run
      // while the staging tables are still up; see lib/m1.js for why the two
      // grains give different numbers.
      const zoneM1 = zoneHourM1SQL({
        speedTable, tmcTable: qualify(names.tmcTable), activeTable: qualify(names.activeTable),
        windowStart: d.start_date, windowEnd: d.end_date,
        postedDropMph: thresholds.posted_speed_drop_mph,
        absoluteMph: thresholds.speed_threshold_mph,
        referencePct: thresholds.reference_speed_pct,
        minEpochsPerHour: minEpochsPerHour,
      });
      zoneM1Rows = await chLib.chQueryRows(chDb, zoneM1);
      await say('work_zone/speed:M1', `${zoneM1Rows.length} zones classified by active hour`,
        { zones: zoneM1Rows.length });
    } finally {
      for (const stmt of chLib.stagingDropDDL(names)) {
        try { await chLib.chExec(chDb, stmt); } catch (e) { /* a failed create leaves nothing to drop */ }
      }
    }
    await updateProgress(0.7);

    // ── shape the rows ──
    const rows = [];
    for (const c of cells) {
      const z = zoneById.get(String(c.wz_event_id));
      if (!z) continue;
      const observed = Number(c.epochs_observed) || 0;
      const share = (k) => (observed > 0 ? Math.round((Number(c[k]) || 0) / observed * 1e4) / 1e4 : null);
      const numOrNull = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
      rows.push({
        wz_event_id: z.wz_event_id, tmc: c.tmc, hour: Number(c.hour),
        first_start: z.first_start, last_end: z.last_end,
        region_name: z.region_name, county_name: z.county_name, facility: z.facility,
        work_activity_class: z.work_activity_class,
        is_interstate: z.is_interstate, in_tma: z.in_tma,
        is_significant_candidate: z.is_significant_candidate,
        window_source: c.window_source || null,
        epochs_observed: observed,
        density_a: Number(c.density_a) || 0, density_b: Number(c.density_b) || 0, density_c: Number(c.density_c) || 0,
        epochs_below_posted: Number(c.epochs_below_posted) || 0,
        epochs_below_absolute: Number(c.epochs_below_absolute) || 0,
        epochs_below_relative: Number(c.epochs_below_relative) || 0,
        epochs_below_fhwa: Number(c.epochs_below_fhwa) || 0,
        m1_posted: share('epochs_below_posted'),
        m1_absolute: share('epochs_below_absolute'),
        m1_relative: share('epochs_below_relative'),
        m1_fhwa: share('epochs_below_fhwa'),
        speed_mean: numOrNull(c.speed_mean), speed_median: numOrNull(c.speed_median), speed_min: numOrNull(c.speed_min),
        baseline_speed: numOrNull(c.baseline_speed), baseline_p85: numOrNull(c.baseline_p85),
        reference_speed: numOrNull(c.reference_speed),
        posted_threshold_speed: numOrNull(c.posted_threshold_speed),
        phed_threshold_speed: numOrNull(c.phed_threshold_speed),
        fhwa_threshold_speed: numOrNull(c.fhwa_threshold_speed),
        posted_speed_drop_mph: thresholds.posted_speed_drop_mph,
        speed_threshold_mph: thresholds.speed_threshold_mph,
        reference_speed_pct: thresholds.reference_speed_pct,
      });
    }

    // Per-zone M1 and the statewide rollup, for the view metadata.
    // Built from the SHAPED rows, not the raw cells: the query can return cells
    // for zones outside this window (a TMC's active windows are not partitioned
    // by our window), and those are dropped above. Rolling up the raw cells
    // would silently count them.
    const zoneM1 = [...groupCellsByZone(rows)].map(([, cs]) => m1ForZone(cs, { minEpochs }));
    const statewide = rollupM1(zoneM1);
    await updateProgress(0.8);

    // ── provision + write ──
    const view = d.target_view_id
      ? { view_id: d.target_view_id }
      : await deps.createDamaView({ source_id: d.source_id, user_id: d.user_id ?? null }, pgEnv);
    const schema = sql.WORK_ZONE_SCHEMA;
    const table = sql.tableNameFor({ source_id: d.source_id, view_id: view.view_id, stage: 'wz_speed' });

    await pgDb.query(sql.wzSpeedTableDDL(schema, table));
    await pgDb.query(sql.deleteWindowSQL({
      schema, table, dateColumn: 'first_start', startDate: d.start_date, endDate: d.end_date,
    }));
    const CHUNK = 2000;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const stmt = sql.wzSpeedInsertSQL({ schema, table, rows: rows.slice(i, i + CHUNK) });
      if (stmt) await pgDb.query(stmt);
    }
    await updateProgress(0.92);

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

    const runMeta = {
      is_clickhouse_table: 0,
      start_date: d.start_date, end_date: d.end_date,
      thresholds,
      baseline_months: baselineMonths, baseline_start, baseline_end,
      min_epochs: minEpochs,
      vehicle_class: 'all_vehicles',
      density_c_included: true,
      wz_event_source_id: d.wz_event_source_id, wz_event_view_id: spine.view.view_id,
      wz_event_tmc_source_id: tmcSourceId,
      npmrds_source_id: d.npmrds_source_id, npmrds_speed_table: speedTable,
      npmrds_meta_source_id: metaSourceId, meta_year: year,
      pm3_source_id: d.pm3_source_id, pm3_view_id: pm3.view.view_id,
      pm3_version: String(pm3.view.version), pm3_version_fallback: !!pm3.fallback,
      zones: zones.length, cells: rows.length,
      active_windows: activeRows.length, excluded_tmc_days: excludeRows.length,
      // The split between conflated and event-derived windows is the single
      // biggest caveat on any M1 aggregate, so it is stamped on the view rather
      // than left to be recounted from the rows.
      windows_from_2799: activeRows.filter((r) => r.window_source === '2799').length,
      windows_from_event: activeRows.filter((r) => r.window_source === 'event').length,
      cells_from_2799: rows.filter((r) => r.window_source === '2799').length,
      cells_from_event: rows.filter((r) => r.window_source === 'event').length,
      statewide_m1: statewide,
      // M1 as defined: the share of active zone-HOURS whose ZONE-AVERAGE speed
      // fell below each threshold. This — not `statewide_m1` — is the published
      // measure; `statewide_m1` is the epoch-level evidence behind it.
      min_epochs_per_hour: minEpochsPerHour,
      m1: rollupZoneM1(zoneM1Rows),
      // M1 per comparable universe. A statewide share over all 42k zones is
      // dominated by six-hour maintenance shifts and matches no peer state's
      // reporting scope; see lib/m1.js.
      m1_by_tier: rollupZoneM1ByTier(zoneM1Rows, new Map(zones.map((z) => [String(z.wz_event_id), {
        is_significant_candidate: z.is_significant_candidate,
        is_interstate: z.is_interstate,
        span_hours: (new Date(`${String(z.last_end).replace(' ', 'T')}Z`)
                   - new Date(`${String(z.first_start).replace(' ', 'T')}Z`)) / 3600000,
      }]))),
    };
    await mergeJsonColumn(db, viewsTable, 'view_id', view.view_id, 'metadata', runMeta);
    await mergeJsonColumn(db, tableFor(db, 'sources'), 'source_id', d.source_id, 'metadata', {
      columns: sql.WZ_SPEED_TABLE_COLUMNS, schema: 'wz_speed_v1',
      wz_event_source_id: d.wz_event_source_id,
    });

    await updateProgress(1);
    const m1 = runMeta.m1;
    await say('work_zone/speed:FINAL', 'work_zone speed complete', {
      source_id: d.source_id, view_id: view.view_id, cells: rows.length,
      m1_zones: m1.zones, m1_active_hours: m1.active_hours_measured,
      m1_posted: m1.m1_posted_hour_weighted,
      m1_absolute: m1.m1_absolute_hour_weighted,
      m1_relative: m1.m1_relative_hour_weighted,
      ...statewide,
    });

    return { source_id: d.source_id, view_id: view.view_id, cells: rows.length, zones: zones.length, statewide };
  };
}

module.exports = makeSpeed();
module.exports.makeSpeed = makeSpeed;
