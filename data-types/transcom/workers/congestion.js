/**
 * transcom/congestion — per-event congestion_data attribution.
 *
 * Port of the CANONICAL legacy implementation
 * (transcom/transcom_congestion.worker.mjs + processIncidents.js — the one
 * wired to the transcom lifecycle), with one structural improvement taken
 * from the npmrds/ variant: the (event_id, congestion_data JSONB) table is a
 * REAL transcom_congestion source/view table, not a dropped temp table. The
 * legacy events-table update (congestion_data, vehicle_delay, cost = 20x raw
 * vehicle delay) is kept.
 *
 * Pipeline per year in [start_date, end_date]:
 *   1. build the conflation road graph (nodes/ways/v0 year tables; the
 *      legacy hardcoded source ids 237/236/238 arrive as descriptor fields
 *      with those defaults)
 *   2. TMC attributes from the npmrds geometry year view; free-flow travel
 *      times from the map21 year view
 *   3. per county x month: fetch candidate incidents, walk the graph,
 *      compute delay vs the npmrds production ClickHouse table (injected),
 *      assemble congestion_data (EXACT legacy JSON shape), upsert
 *   4. copy results onto the events table; flip the transcom view's
 *      congestion month-chunk bookkeeping
 *
 * Deviations (documented):
 *   - geoids: the legacy looped ALL NY counties from a falcor geo route; we
 *     loop the DISTINCT county_code values present in the events window
 *     (identical coverage — county/months without events yield no incidents).
 *   - conflation nodes/ways arrive via plain SELECTs instead of
 *     COPY-to-stdout streams (same rows, simpler transport).
 *
 * deps (makeWorker): getDataDb(ctx), getChDb(pgEnv), createDamaView.
 */
const dates = require('../dates.js');
const sql = require('../sql.js');
const cg = require('../congestion.js');
const {
  sanitizeName, tableFor, mergeJsonColumn, getSourceById, getViewById,
  getViewsForSource, resolveGeomYearView, setViewTable,
} = require('./util.js');

function defaultDeps() {
  return {
    getDataDb: (ctx) => ctx.db,
    getChDb: require('@availabs/dms-server/src/db').getChDb,
    createDamaView: require('@availabs/dms-server/src/dama/upload/metadata').createDamaView,
  };
}

// map21 year-view selection with year clamping (legacy getTmcMeasures head).
function pickMap21View(views, year) {
  const yearToView = {};
  for (const v of views) {
    const match = String(v.version || '').match(/(20\d{2})/);
    if (match) yearToView[Number(match[1])] = v;
  }
  const years = Object.keys(yearToView).map(Number);
  if (!years.length) return null;
  const target = Math.min(Math.max(year, Math.min(...years)), Math.max(...years));
  return yearToView[target] || null;
}

function makeWorker(depOverrides = {}) {
  const deps = { ...defaultDeps(), ...depOverrides };

  return async function transcomCongestion(ctx) {
    const { task, pgEnv, db, dispatchEvent, updateProgress } = ctx;
    const d = task.descriptor || {};
    const {
      source_id, user_id, start_date, end_date,
      conflation_nodes_source_id = sql.DEFAULT_CONFLATION_SOURCE_IDS.conflation_nodes_source_id,
      conflation_ways_source_id = sql.DEFAULT_CONFLATION_SOURCE_IDS.conflation_ways_source_id,
      conflation_v0_source_id = sql.DEFAULT_CONFLATION_SOURCE_IDS.conflation_v0_source_id,
    } = d;

    await dispatchEvent('transcom_congestion:INITIAL', 'congestion attribution started', { source_id });
    if (!start_date || !end_date) throw new Error('start_date and end_date are required');

    const source = await getSourceById(db, source_id);
    if (!source) throw new Error('Invalid Source');
    const transcomSourceId = d.transcom_source_id || (source.metadata || {}).transcom_source_id;
    if (!transcomSourceId) throw new Error('transcom_source_id is required');

    // The transcom events view being attributed.
    const transcomView = d.transcom_view_id
      ? await getViewById(db, d.transcom_view_id)
      : (await getViewsForSource(db, transcomSourceId)).pop();
    if (!transcomView || !transcomView.data_table) {
      throw new Error(`No transcom events view found for source ${transcomSourceId}`);
    }
    const tMeta = transcomView.metadata || {};
    const geomSourceId = d.geom_source_id || tMeta.geom_source_id;
    const prodSourceId = d.npmrds_production_source_id || tMeta.npmrds_production_source_id;
    const map21SourceId = d.map21_source_id || tMeta.map21_source_id;
    if (!geomSourceId || !prodSourceId || !map21SourceId) {
      throw new Error('geom/npmrds_production/map21 source ids are required (descriptor or transcom view metadata)');
    }

    // ── congestion source view + table ──────────────────────────────────
    // Reuse an existing view when d.view_id is supplied (backfill runs add
    // months into ONE view/table instead of spawning a view per invocation);
    // otherwise create one (legacy publish behavior).
    const tableSchema = 'transcom_congestion';
    let view;
    let tableName;
    if (d.view_id) {
      view = await getViewById(db, d.view_id);
      if (!view) throw new Error(`congestion view ${d.view_id} not found`);
      if (Number(view.source_id) !== Number(source_id)) {
        throw new Error(`view ${d.view_id} belongs to source ${view.source_id}, not ${source_id}`);
      }
      tableName = view.table_name || sanitizeName(`s${source_id}_v${view.view_id}_${source.name}`);
      if (!view.table_name) await setViewTable(db, view.view_id, tableSchema, tableName);
    } else {
      view = await deps.createDamaView({ source_id, user_id }, pgEnv);
      tableName = sanitizeName(`s${source_id}_v${view.view_id}_${source.name}`);
      await setViewTable(db, view.view_id, tableSchema, tableName);
    }

    const dataDb = deps.getDataDb(ctx);
    await dataDb.query(sql.congestionTableDDL(tableSchema, tableName));
    const congestionTable = `${tableSchema}.${tableName}`;
    await dispatchEvent('transcom_congestion:RETRIVED_VIEW_INFO', 'congestion table ready', {
      source_id, view_id: view.view_id,
    });
    await updateProgress(0.05);

    // ── shared inputs ────────────────────────────────────────────────────
    const viewsTable = tableFor(db, 'views');
    const { rows: conflRows } = await db.query(
      `SELECT data_table, version FROM ${viewsTable} WHERE source_id IN ($1, $2, $3)`,
      [conflation_nodes_source_id, conflation_ways_source_id, conflation_v0_source_id]
    );
    const conflationByYear = cg.getYearToConflationTableNamesFromViews(conflRows);

    const prodViews = await getViewsForSource(db, prodSourceId);
    const prodView = prodViews[prodViews.length - 1];
    if (!prodView || !prodView.data_table) {
      throw new Error(`No npmrds production view for source ${prodSourceId}`);
    }
    const prodTableName = String(prodView.data_table).replace(/^clickhouse\./, '');
    const map21Views = (await getViewsForSource(db, map21SourceId))
      .filter((v) => /20[0-9]{2}/.test(String(v.version || '')));

    const chDb = deps.getChDb(pgEnv);
    const yearToRanges = dates.getYearAndMonthDateRanges(start_date, end_date);
    await dispatchEvent('transcom_congestion:RETRIVED_CONFLATION_TABLE_NAMES_AND_INFO',
      'conflation + production inputs resolved', { source_id, view_id: view.view_id });
    await dispatchEvent('transcom_congestion:START_PROCESS', 'processing', { source_id, view_id: view.view_id });
    await updateProgress(0.1);

    const years = Object.keys(yearToRanges);
    let yi = 0;
    try {
      for (const year of years) {
        const tables = conflationByYear[year] || {};
        if (!tables.nodes || !tables.ways || !tables.v0) {
          throw new Error(`No conflation tables resolvable for year ${year}`);
        }

        // graph
        await dispatchEvent(`transcom_congestion:START_STREAM_NODES_FOR_${year}`, 'building graph', { view_id: view.view_id });
        const { rows: nodeRows } = await dataDb.query(sql.conflationNodesSQL({
          nodesTable: tables.nodes, waysTable: tables.ways, v0Table: tables.v0,
        }));
        const { rows: wayRows } = await dataDb.query(sql.conflationWaysSQL({
          waysTable: tables.ways, v0Table: tables.v0,
        }));
        const graph = cg.buildGraphFromRows(nodeRows, wayRows);
        await dispatchEvent(`transcom_congestion:END_STREAM_WAYS_FOR_${year}`, 'graph built', { view_id: view.view_id });

        // tmc attributes + free-flow measures
        const geomYearView = await resolveGeomYearView(db, geomSourceId, year);
        if (!geomYearView || !geomYearView.data_table) {
          throw new Error(`No npmrds geometry year view for ${year} (source ${geomSourceId})`);
        }
        const { rows: attrRows } = await dataDb.query(sql.tmcAttributesSQL(geomYearView.data_table));
        const tmcAttributes = (attrRows || []).reduce((a, c) => { a[c.tmc] = c; return a; }, {});
        await dispatchEvent(`transcom_congestion:FETCHED_TMC_ATTRIBUTES_FOR_${year}`, 'tmc attributes', { view_id: view.view_id });

        const map21View = pickMap21View(map21Views, Number(year));
        if (!map21View) throw new Error(`No map21 year view for source ${map21SourceId}`);
        const { rows: ffRows } = await dataDb.query(sql.tmcMeasuresSQL({
          map21DataTable: map21View.data_table, geomYearDataTable: geomYearView.data_table,
        }));
        const ffDataMap = (ffRows || []).reduce((a, c) => { a[c.tmc] = c.freeflow_tt; return a; }, {});
        await dispatchEvent(`transcom_congestion:END_FETCH_TMC_MEASURES_FOR_${year}`, 'free-flow measures', { view_id: view.view_id });

        // P1 perf: materialize the yearly weekday-average baseline ONCE (same
        // definition + builders as the excessive_delay plugin — shared on purpose,
        // see references/tsmo/06_congestion_delay_methodology.md). Every incident's
        // fetchDelayRows then does an indexed lookup instead of a full-table GROUP BY.
        const edSql = require('../../excessive_delay/sql.js');
        const baselineTable = edSql.baselineTableName({ prodTable: prodTableName, year });
        // methodology v2 (M2): median baseline; v1 default keeps legacy runs reproducible.
        const baselineStatistic = d.methodology === 'v2' ? 'median' : 'mean';
        await chDb.exec({ query: edSql.baselineCreateSQL({
          table: baselineTable, prodTable: prodTableName, year, statistic: baselineStatistic,
        }) });
        await dispatchEvent(`transcom_congestion:BASELINE_READY_FOR_${year}`, baselineTable, { view_id: view.view_id });

        const upsertCongestion = (eventId, data) => dataDb.query(
          sql.congestionUpsertSQL(tableSchema, tableName),
          [eventId, JSON.stringify(data)]
        );

        // geoids present in the events window (see header note vs legacy falcor list)
        const { months } = yearToRanges[year];
        const { rows: geoidRows } = await dataDb.query(
          `SELECT DISTINCT county_code FROM ${transcomView.data_table}
           WHERE county_code IS NOT NULL
             AND start_date_time >= '${yearToRanges[year].start_date}'::timestamp
             AND start_date_time <= '${yearToRanges[year].end_date} 23:59:59'::timestamp`
        );
        let geoids = (geoidRows || []).map((g) => g.county_code);
        // optional county scope (surgical re-runs / diff validation)
        if (Array.isArray(d.geoids) && d.geoids.length) {
          const scope = new Set(d.geoids.map(String));
          geoids = geoids.filter((g) => scope.has(String(g)));
        }

        // Bounded county concurrency (descriptor county_concurrency, default 4).
        // The graph + attributes are shared (read-only); each county gets its
        // OWN fetchDelayRows instance so caches/resets never cross counties.
        // Memory: each county's cache is bounded per day-group (~50–250MB), so
        // 4 in flight adds well under 1GB on top of the shared graph.
        const countyConcurrency = Math.max(1, Number(d.county_concurrency) || 4);
        let nextGeoid = 0;
        let doneGeoids = 0;
        const runCounty = async (geoid) => {
          const fetchDelayRows = cg.makeFetchDelayRows({
            chDb, prodTableName, tmcAttributes, ffDataMap, baselineTable,
          });
          for (const monthObj of months) {
            const { rows: incidentRows } = await dataDb.query(sql.incidentsSQL({
              transcomTable: transcomView.data_table,
              v0Table: tables.v0,
              waysTable: tables.ways,
              geoid,
              startDate: monthObj.start_date,
              endDate: monthObj.end_date,
              reprocess: d.reprocess === true,
              resumeV2: d.resume_v2 === true,
            }));
            const incidents = cg.postProcessIncidentRows(incidentRows);
            if (incidents.length) {
              await cg.processIncidents(
                { fetchDelayRows, upsertCongestion },
                incidents, graph, tmcAttributes
              );
            }
          }
          doneGeoids++;
          await dispatchEvent(`transcom_congestion:END_PROCESS_FOR_GEO_${geoid}_FOR_${year}`,
            `county done (${doneGeoids}/${geoids.length})`, { view_id: view.view_id });
        };
        await Promise.all(
          Array.from({ length: Math.min(countyConcurrency, geoids.length) }, async () => {
            while (nextGeoid < geoids.length) {
              const geoid = geoids[nextGeoid++];
              await runCounty(geoid);
            }
          })
        );

        // Events-table sync once per year (was per county-month; concurrent
        // full-table UPDATEs would contend — the final sync below still runs).
        await dataDb.query(sql.updateEventsCongestionSQL({
          eventsTable: transcomView.data_table, congestionTable,
        }));

        yi++;
        await updateProgress(0.1 + 0.8 * (yi / years.length));
        await dispatchEvent(`transcom_congestion:END_PROCESS_FOR_YEAR_${year}`, 'year done', { view_id: view.view_id });
      }
    } catch (err) {
      await dispatchEvent('transcom_congestion:ERROR', err.message, { source_id, view_id: view.view_id });
      throw err;
    }

    // final events-table sync (legacy finally block)
    await dataDb.query(sql.updateEventsCongestionSQL({
      eventsTable: transcomView.data_table, congestionTable,
    }));
    await dispatchEvent('transcom_congestion:END_PROCESS', 'attribution done', { source_id, view_id: view.view_id });

    // ── bookkeeping ──────────────────────────────────────────────────────
    const freshTranscomView = await getViewById(db, transcomView.view_id);
    const congestion = dates.markCongestionTrue(
      (freshTranscomView.metadata || {}).congestion || [], start_date, end_date
    );
    await mergeJsonColumn(db, viewsTable, 'view_id', transcomView.view_id, 'metadata', { congestion });

    await mergeJsonColumn(db, viewsTable, 'view_id', view.view_id, 'metadata', {
      start_date,
      end_date,
      transcom_source_id: transcomSourceId,
      transcom_view_id: transcomView.view_id,
      npmrds_production_source_id: prodSourceId,
      map21_source_id: map21SourceId,
      geom_source_id: geomSourceId,
      conflation_nodes_source_id,
      conflation_ways_source_id,
      conflation_v0_source_id,
    });

    const sourcesTable = tableFor(db, 'sources');
    await mergeJsonColumn(db, sourcesTable, 'source_id', source_id, 'metadata', {
      columns: sql.CONGESTION_TABLE_COLUMNS,
      schema: 'transcom_congestion_v1',
      transcom_source_id: transcomSourceId,
    });

    await updateProgress(1);
    await dispatchEvent('transcom_congestion:FINAL', 'congestion attribution complete', {
      source_id, view_id: view.view_id,
    });
    return { source_id, view_id: view.view_id };
  };
}

module.exports = makeWorker();
module.exports.makeWorker = makeWorker;
