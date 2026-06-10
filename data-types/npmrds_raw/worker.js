/**
 * npmrds_raw staged worker (Phase 1).
 *
 * Ported from the legacy 6-stage avail-falcor pipeline into ONE staged worker
 * (per the migration plan: the new runner has no parent/child chaining, so a
 * single worker that runs phases in sequence is the right shape — like map21).
 *
 * Dependency-injected (makeWorker(deps)) so ClickHouse, RITIS, and CSV loading
 * are faked in tests. NO test ever calls RITIS (iron-clad rate-limit rule); the
 * real RITIS client only runs in a deliberate, user-approved manual publish.
 *
 * ctx: { task, pgEnv, db, dispatchEvent, updateProgress }
 * task.descriptor: { source_id, tmc_identification_source_id, name, states,
 *                    startDate, endDate, averagingWindowSize, include_full_tmc_network,
 *                    user_id, email }
 */
const dates = require('./dates');
const stats = require('./stats');
const ch = require('./ch-sql');

// metadata.columns descriptor for the npmrds_raw production table (drives the Table page).
const RAW_TABLE_COLUMNS = [
  { name: 'tmc', display_name: 'TMC', type: 'TEXT', desc: null },
  { name: 'date', display_name: 'Date', type: 'DATE', desc: null },
  { name: 'epoch', display_name: 'Epoch (5-min bucket)', type: 'INTEGER', desc: null },
  { name: 'travel_time_all_vehicles', display_name: 'Travel Time (all)', type: 'DOUBLE PRECISION', desc: null },
  { name: 'travel_time_passenger_vehicles', display_name: 'Travel Time (passenger)', type: 'DOUBLE PRECISION', desc: null },
  { name: 'travel_time_freight_trucks', display_name: 'Travel Time (freight)', type: 'DOUBLE PRECISION', desc: null },
  { name: 'data_density_all_vehicles', display_name: 'Data Density (all)', type: 'TEXT', desc: null },
  { name: 'data_density_passenger_vehicles', display_name: 'Data Density (passenger)', type: 'TEXT', desc: null },
  { name: 'data_density_freight_trucks', display_name: 'Data Density (freight)', type: 'TEXT', desc: null },
  { name: 'state', display_name: 'State', type: 'TEXT', desc: null },
];

const sanitize = (s) => String(s).replace(/[\s\W]+/g, '_');
const viewTableName = (sourceId, viewId, name) => sanitize(`s${sourceId}_v${viewId}_${name}`);

function defaultDeps() {
  return {
    getChDb: require('@availabs/dms-server/src/db').getChDb,
    createDamaView: require('@availabs/dms-server/src/dama/upload/metadata').createDamaView,
    ensureSchema: require('@availabs/dms-server/src/dama/upload/metadata').ensureSchema,
    makeRitisClient: () => require('./ritis').makeRitisClient(),
    loadCsvToCh: (...a) => require('./ch-load').loadCsvToCh(...a),
    insertRows: (...a) => require('./ch-load').insertRows(...a),
  };
}

// Read-modify-write a JSON column (portable across sqlite TEXT / pg JSONB).
async function mergeJsonColumn(db, table, idCol, id, col, patch) {
  const { rows } = await db.query(`SELECT ${col} FROM ${table} WHERE ${idCol} = $1`, [id]);
  const cur = rows[0] && rows[0][col];
  const obj = typeof cur === 'string' ? (cur ? JSON.parse(cur) : {}) : (cur || {});
  const next = { ...obj, ...patch };
  await db.query(`UPDATE ${table} SET ${col} = $1 WHERE ${idCol} = $2`, [JSON.stringify(next), id]);
  return next;
}

async function setColumn(db, table, idCol, id, col, valueObj) {
  await db.query(`UPDATE ${table} SET ${col} = $1 WHERE ${idCol} = $2`, [JSON.stringify(valueObj), id]);
}

function makeWorker(depOverrides = {}) {
  const deps = { ...defaultDeps(), ...depOverrides };

  return async function npmrdsRawPublish(ctx) {
    const { task, pgEnv, db, dispatchEvent, updateProgress } = ctx;
    const d = task.descriptor || {};
    const {
      source_id, tmc_identification_source_id, name,
      states, startDate, endDate, averagingWindowSize = 0, user_id,
    } = d;
    const stateCode = Array.isArray(states) ? states[0] : states;

    await dispatchEvent('npmrds_raw:INITIAL', 'npmrds_raw publish started', { source_id });

    // ── Phase 1: setup — resolve the actual available window ──────────────────
    dates.enforceSingleCalendarYear(startDate, endDate);
    const ritis = deps.makeRitisClient();
    const latestAvailableDate = await ritis.getLatestAvailableDate();
    const { newStartDate, newEndDate } = dates.adjustDates({ latestAvailableDate, startDate, endDate });
    dates.enforceSingleCalendarYear(newStartDate, newEndDate);
    const year = dates.parseDate(newStartDate).getUTCFullYear();

    const rawView = await deps.createDamaView({ source_id, user_id }, pgEnv);
    const tmcView = await deps.createDamaView({ source_id: tmc_identification_source_id, user_id }, pgEnv);

    const rawTableName = viewTableName(source_id, rawView.view_id, name);
    const tmcTableName = viewTableName(tmc_identification_source_id, tmcView.view_id, `${name}_tmc_identification`);
    const rawSchema = 'clickhouse.npmrds_raw';
    const tmcSchema = 'clickhouse.npmrds_raw_tmc_identification';
    const viewsTable = tableFor(db, 'views');
    const sourcesTable = tableFor(db, 'sources');

    await db.query(
      `UPDATE ${viewsTable} SET table_schema = $1, table_name = $2, data_table = $3 WHERE view_id = $4`,
      [rawSchema, rawTableName, `${rawSchema}.${rawTableName}`, rawView.view_id]
    );
    await db.query(
      `UPDATE ${viewsTable} SET table_schema = $1, table_name = $2, data_table = $3 WHERE view_id = $4`,
      [tmcSchema, tmcTableName, `${tmcSchema}.${tmcTableName}`, tmcView.view_id]
    );

    const chDb = deps.getChDb(pgEnv);
    for (const dbName of ['npmrds_raw', 'temp', 'npmrds_raw_tmc_identification']) {
      await chDb.exec({ query: `CREATE DATABASE IF NOT EXISTS ${dbName}` });
    }
    await updateProgress(0.1);

    // ── Phase 2: fetch (RITIS — via injected client only) ────────────────────
    const { regionTmcs, tmcToGeo } = await ritis.getRegionTmcs({
      year, stateCode, includeFullTmcNetwork: d.include_full_tmc_network !== false,
    });
    const downloads = await ritis.requestAndAwaitDownloads({
      regionTmcs, name, startDate: newStartDate, endDate: newEndDate, averagingWindowSize,
    });
    await updateProgress(0.3);

    // ── Phase 3: download + extract ──────────────────────────────────────────
    const extracted = await ritis.downloadAndExtract({ downloads });
    await updateProgress(0.4);

    // ── Phase 4: temp load (CH-side; no DuckDB) ──────────────────────────────
    const tempByKey = {};
    for (const src of extracted) {
      const key = ch.VEHICLE_SOURCE_TO_KEY[src.vehicle_class];
      if (!key) continue;
      const tempName = `temp.${rawTableName}_${key}`;
      await chDb.exec({ query: ch.tempDataTableDDL(tempName) });
      await deps.loadCsvToCh(chDb, tempName, src.csvPath, pgEnv);
      tempByKey[key] = tempName;
    }
    const tempTmcId = `temp.${tmcTableName}`;
    await chDb.exec({ query: ch.tempTmcIdTableDDL(tempTmcId) });
    await deps.loadCsvToCh(chDb, tempTmcId, extracted[0] && extracted[0].tmcIdentificationPath, pgEnv);

    const tempGeo = `temp.${rawTableName}_geometry`;
    await chDb.exec({ query: ch.tempGeoTableDDL(tempGeo) });
    await deps.insertRows(chDb, tempGeo, tmcToGeo, pgEnv);
    await updateProgress(0.6);

    // ── Phase 5: copy to final typed/aggregating tables ──────────────────────
    const finalTmc = `npmrds_raw_tmc_identification.${tmcTableName}`;
    await chDb.exec({ query: ch.tmcIdentificationTableDDL(finalTmc) });
    await chDb.exec({ query: ch.tmcIdInsertSQL({ destTable: finalTmc, tempTmcIdTable: tempTmcId, tempGeoTable: tempGeo }) });

    const finalRaw = `npmrds_raw.${rawTableName}`;
    await chDb.exec({ query: ch.rawDataTableDDL(finalRaw) });
    for (const key of ch.VEHICLE_KEYS) {
      if (!tempByKey[key]) continue;
      await chDb.exec({ query: ch.vehicleInsertSQL({ destTable: finalRaw, tempTable: tempByKey[key], vehicleKey: key, stateCode }) });
    }
    await chDb.exec({ query: `OPTIMIZE TABLE ${finalRaw} FINAL` });
    await updateProgress(0.8);

    // ── Phase 6: statistics + metadata ───────────────────────────────────────
    const days = dates.generateDateRanges(newStartDate, newEndDate).length;
    const count = async (query) => {
      const rs = await chDb.query({ query, format: 'JSONEachRow' });
      const rows = await rs.json();
      return Number((rows[0] && (rows[0].count ?? rows[0]['count()'])) || 0);
    };
    // First-cut coverage: total + f_system group buckets. Group SQL refined later.
    const totalCount = await count(`SELECT count(*) AS count FROM ${finalRaw}`);
    const interstateCount = await count(`SELECT count(*) AS count FROM ${finalRaw} t WHERE t.tmc IN (SELECT tmc FROM ${finalTmc} WHERE f_system = 1)`);
    const nonInterstateCount = await count(`SELECT count(*) AS count FROM ${finalRaw} t WHERE t.tmc IN (SELECT tmc FROM ${finalTmc} WHERE f_system > 1)`);
    const extendedCount = await count(`SELECT count(*) AS count FROM ${finalRaw} t WHERE t.tmc IN (SELECT tmc FROM ${finalTmc} WHERE f_system = 0)`);
    const groupTmcs = async (cond) => count(`SELECT count(DISTINCT tmc) AS count FROM ${finalTmc} WHERE ${cond}`);
    const statistics = stats.coverageStatistics({
      averagingWindowSize, days,
      totalCount, totalTmcs: regionTmcs.length || 1,
      interstateCount, interstateTmcs: await groupTmcs('f_system = 1'),
      nonInterstateCount, nonInterstateTmcs: await groupTmcs('f_system > 1'),
      extendedCount, extendedTmcs: await groupTmcs('f_system = 0'),
    });

    await mergeJsonColumn(db, viewsTable, 'view_id', rawView.view_id, 'metadata', {
      dama_source_name: name,
      rawTableName,
      start_date: newStartDate,
      end_date: newEndDate,
      schema: 'npmrds_raw',
      is_clickhouse_table: 1,
      data_table: `${rawSchema}.${rawTableName}`,
      no_of_tmc: regionTmcs.length,
      tmc_identification_view_id: tmcView.view_id,
      state_code: stateCode,
    });
    await setColumn(db, viewsTable, 'view_id', rawView.view_id, 'statistics', statistics);

    await mergeJsonColumn(db, viewsTable, 'view_id', tmcView.view_id, 'metadata', {
      dama_source_name: name,
      table_name: tmcTableName,
      table_schema: tmcSchema,
      is_clickhouse_table: 1,
      data_table: `${tmcSchema}.${tmcTableName}`,
      npmrds_raw_view_id: rawView.view_id,
      state_code: stateCode,
    });

    // metadata.columns on the raw source — drives the Table page.
    await mergeJsonColumn(db, sourcesTable, 'source_id', source_id, 'metadata', {
      columns: RAW_TABLE_COLUMNS,
      schema: 'npmrds_raw_v1',
    });

    await updateProgress(1);
    await dispatchEvent('npmrds_raw:FINAL', 'npmrds_raw publish complete', {
      source_id, view_id: rawView.view_id, statistics,
    });

    return { source_id, view_id: rawView.view_id, tmc_identification_view_id: tmcView.view_id };
  };
}

// Resolve the unqualified vs data_manager-qualified table name for the active DB.
function tableFor(db, base) {
  return db.type === 'postgres' ? `data_manager.${base}` : base;
}

module.exports = makeWorker();
module.exports.makeWorker = makeWorker;
module.exports.RAW_TABLE_COLUMNS = RAW_TABLE_COLUMNS;
