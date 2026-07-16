/**
 * excessive_delay staged worker (Phase 4).
 *
 * The legacy computation ran INLINE in the avail-falcor HTTP route
 * (npmrds/excessivedelay.route.js) — a multi-month CH+PG pipeline inside a
 * request handler that could time the server out. Here it is a proper queued
 * worker: one staged run per task, driven entirely by a self-contained
 * descriptor (no etl_contexts, no re-resolution of fragile metadata chains).
 *
 * Dependency-injected (makeWorker(deps)) so ClickHouse and the transcom
 * congestion query are faked in tests — tests never hit live CH.
 *
 * ctx: { task, pgEnv, db, dispatchEvent, updateProgress }
 * task.descriptor: {
 *   mode: 'publish' | 'add',
 *   source_id, view_id (add), name, user_id, email,
 *   npmrds_production_source_id, npmrds_production_view_id, npmrds_prod_table,
 *   npmrds_meta_view_id, npmrds_meta_table,
 *   transcom_source_id, transcom_view_id, transcom_table,
 *   years: [int, ...]   — arbitrary list (backfill must be able to fill gaps),
 *   months?: [1..12], region?: string | string[],
 * }
 */
const delay = require('./delay');
const sqlb = require('./sql');
const { VOT_RATES, CURRENT: VOT_VERSION } = require('../_shared/vot_rates');

const TABLE_SCHEMA = 'excessive_delay';

// metadata.columns descriptor for the output table — the legacy column
// contract (excessive_delay.s1469_v2633_excessive_delay_v3) plus vot_eff/cost
// (class-weighted monetization, 2026-06-22). Drives the Table page,
// DataWrapper, and the /congestion dashboard sections.
const EXCESSIVE_DELAY_COLUMNS = [
  { name: 'ogc_fid', display_name: 'ID', type: 'INTEGER', desc: null },
  { name: 'tmc', display_name: 'TMC', type: 'VARCHAR', desc: null },
  { name: 'year', display_name: 'Year', type: 'SMALLINT', desc: null },
  { name: 'month', display_name: 'Month', type: 'SMALLINT', desc: null },
  { name: 'total', display_name: 'Total Excessive Delay', type: 'DOUBLE PRECISION', desc: 'Vehicle-hours of delay beyond the free-flow threshold' },
  { name: 'non_recurrent', display_name: 'Non-Recurrent Delay', type: 'DOUBLE PRECISION', desc: 'Delay beyond the recurrent (weekday-average) baseline' },
  { name: 'construction', display_name: 'Construction Delay', type: 'DOUBLE PRECISION', desc: 'Transcom-attributed (NYSDOT category Construction)' },
  { name: 'accident', display_name: 'Accident Delay', type: 'DOUBLE PRECISION', desc: 'Transcom-attributed (NYSDOT category Incident)' },
  { name: 'other', display_name: 'Other Delay', type: 'DOUBLE PRECISION', desc: 'Transcom-attributed (NYSDOT category Other)' },
  { name: 'vot_eff', display_name: 'VOT (eff. $/veh-hr)', type: 'DOUBLE PRECISION', desc: 'Class-weighted value of time per TMC: (aadt_pass/aadt)·$52 + (aadt_singl/aadt)·$42 + (aadt_combi/aadt)·$77 (2024-25 $); network-blend fallback where the split is NULL/0' },
  { name: 'cost', display_name: 'Congestion Cost ($)', type: 'DOUBLE PRECISION', desc: 'Headline cost = total delay (veh-hrs) × vot_eff; bucket $ = bucket × vot_eff' },
  { name: 'region_code', display_name: 'Region Code', type: 'VARCHAR', desc: null },
  { name: 'region_name', display_name: 'Region', type: 'VARCHAR', desc: null },
  { name: 'wkb_geometry', display_name: 'Geometry', type: 'GEOMETRY', desc: null },
  { name: 'f_system', display_name: 'Functional System', type: 'SMALLINT', desc: null },
  { name: 'aadt', display_name: 'AADT', type: 'DOUBLE PRECISION', desc: 'Normalized (directional) AADT' },
  { name: 'aadt_singl', display_name: 'AADT Single-Unit', type: 'DOUBLE PRECISION', desc: null },
  { name: 'aadt_combi', display_name: 'AADT Combination', type: 'DOUBLE PRECISION', desc: null },
  { name: 'length', display_name: 'Length (mi)', type: 'FLOAT8', desc: null },
  { name: 'roadname', display_name: 'Road', type: 'VARCHAR', desc: null },
  { name: 'tmclinear', display_name: 'TMC Linear', type: 'DOUBLE PRECISION', desc: null },
  { name: 'road_order', display_name: 'Road Order', type: 'FLOAT8', desc: null },
  { name: 'county_code', display_name: 'County Code', type: 'VARCHAR', desc: null },
  { name: 'direction', display_name: 'Direction', type: 'VARCHAR', desc: null },
  { name: 'road_information', display_name: 'Road Information', type: 'VARCHAR', desc: null },
];

const INSERT_BATCH = 2000;
const ATTRIBUTION_BATCH = 500;

function defaultDeps() {
  return {
    getChDb: require('@availabs/dms-server/src/db').getChDb,
    createDamaView: require('@availabs/dms-server/src/dama/upload/metadata').createDamaView,
    ensureSchema: require('@availabs/dms-server/src/dama/upload/metadata').ensureSchema,
    // One month of congestion blobs from the transcom_congestion PG table.
    fetchTranscomRows: async ({ db, transcomTable, year, month }) => {
      const { rows } = await db.query(sqlb.transcomDelayQuery({ transcomTable, year, month }));
      return rows;
    },
    regionNamesTable: 'ny.nysdot_region_names',
    distributionsTable: 'aadt_distributions',
  };
}

// Resolve the unqualified vs data_manager-qualified table name for the active DB.
function tableFor(db, base) {
  return db.type === 'postgres' ? `data_manager.${base}` : base;
}

// sqlite has no schemas — the output table is unqualified there.
function qualifyTable(db, schema, name) {
  return db.type === 'postgres' ? `${schema}.${name}` : name;
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

function makeWorker(depOverrides = {}) {
  const deps = { ...defaultDeps(), ...depOverrides };

  return async function excessiveDelayPublish(ctx) {
    const { task, pgEnv, db, dispatchEvent, updateProgress } = ctx;
    const d = task.descriptor || {};
    const mode = d.mode || 'publish';
    const { source_id, name, user_id } = d;
    const dialect = db.type === 'postgres' ? 'postgres' : 'sqlite';
    // Methodology version: 'v1' (legacy-reproducible: mean baseline, uncapped
    // attribution) or 'v2' (M2 median baseline + M3 attribution cap). See
    // references/tsmo/06_congestion_delay_methodology.md.
    const methodology = d.methodology === 'v2' ? 'v2' : 'v1';
    const viewsTable = tableFor(db, 'views');
    const sourcesTable = tableFor(db, 'sources');

    try {
      await dispatchEvent('excessive_delay:INITIAL', `excessive_delay ${mode} started`, { source_id });

      const periods = delay.expandPeriods({ years: d.years, months: d.months });

      // ── Phase 1: view + output table ─────────────────────────────────────
      let view_id = d.view_id;
      let dataTable;
      if (mode === 'publish' || !view_id) {
        const view = await deps.createDamaView({ source_id, user_id }, pgEnv);
        view_id = view.view_id;
        const tableName = sqlb.viewTableName(source_id, view_id, name || 'excessive_delay');
        dataTable = qualifyTable(db, TABLE_SCHEMA, tableName);

        await deps.ensureSchema(db, TABLE_SCHEMA);
        for (const stmt of sqlb.outputTableDDL({ table: dataTable, dialect })) {
          await db.query(stmt);
        }
        await db.query(
          `UPDATE ${viewsTable} SET table_schema = $1, table_name = $2, data_table = $3 WHERE view_id = $4`,
          [TABLE_SCHEMA, tableName, dataTable, view_id]
        );
        await dispatchEvent('excessive_delay:TABLE_CREATE_SUCCESS', `created ${dataTable}`, { source_id, view_id });
      } else {
        const { rows } = await db.query(`SELECT * FROM ${viewsTable} WHERE view_id = $1`, [view_id]);
        if (!rows[0]) throw new Error(`excessive_delay view ${view_id} not found`);
        dataTable = rows[0].data_table || qualifyTable(db, rows[0].table_schema, rows[0].table_name);
      }

      // Insert only columns the target table actually has — add-mode may land
      // in a table created before a schema addition (the v2 series table
      // predates vot_eff/cost, deliberately left un-ALTERed until the
      // series-wide monetization backfill).
      const { rows: colRows } = await db.query(sqlb.tableColumnsSQL({ table: dataTable, dialect }));
      const tableColumns = new Set(colRows.map((r) => r.name));
      const insertColumns = sqlb.INSERT_COLUMNS.filter((c) => tableColumns.has(c));
      const skippedColumns = sqlb.INSERT_COLUMNS.filter((c) => !tableColumns.has(c));
      if (skippedColumns.length) {
        await dispatchEvent('excessive_delay:COLUMNS_SKIPPED',
          `target table lacks ${skippedColumns.join(', ')} — inserting without them`,
          { source_id, view_id, skipped: skippedColumns });
      }
      await updateProgress(0.05);

      // ── Phase 2: per-month compute → insert → region names → attribution ─
      const chDb = deps.getChDb(pgEnv);

      // P2 perf: materialize the yearly weekday-average baseline ONCE per year
      // in this run; every monthly query joins it instead of rescanning the
      // year inline (see references/tsmo/06_congestion_delay_methodology.md).
      const baselineByYear = {};
      const baselineStatistic = methodology === 'v2' ? 'median' : 'mean';
      for (const year of [...new Set(periods.map((p) => p.year))]) {
        const table = sqlb.baselineTableName({ prodTable: d.npmrds_prod_table, year });
        await chDb.exec({ query: sqlb.baselineDropSQL({ table }) }); // fresh per run
        await chDb.exec({ query: sqlb.baselineCreateSQL({
          table, prodTable: d.npmrds_prod_table, year, statistic: baselineStatistic,
        }) });
        baselineByYear[year] = table;
      }

      for (let i = 0; i < periods.length; i++) {
        const { year, month, startDate, endDate } = periods[i];

        // Replace-don't-duplicate: clear the month before recomputing it.
        await db.query(sqlb.deleteMonthSQL({ table: dataTable, year, month }));

        const resultSet = await chDb.query({
          query: sqlb.monthDelayQuery({
            prodTable: d.npmrds_prod_table,
            metaTable: d.npmrds_meta_table,
            distributionsTable: deps.distributionsTable,
            year, startDate, endDate,
            region: d.region,
            baselineTable: baselineByYear[year],
          }),
          format: 'JSONEachRow',
        });
        const chRows = await resultSet.json();

        const records = (chRows || []).map(delay.normalizeDelayRow);
        for (let j = 0; j < records.length; j += INSERT_BATCH) {
          await db.query(sqlb.insertRowsSQL({
            table: dataTable, rows: records.slice(j, j + INSERT_BATCH), dialect, upsert: true,
            columns: insertColumns,
          }));
        }

        if (records.length) {
          await db.query(sqlb.regionNameUpdateSQL({
            table: dataTable, regionNamesTable: deps.regionNamesTable, year, month, dialect,
          }));
        }

        // Transcom attribution: construction / accident / other buckets.
        const congestionRows = await deps.fetchTranscomRows({
          db, transcomTable: d.transcom_table, year, month,
        });
        let tmcMap = delay.aggregateTranscomDelays(congestionRows, { year, month });
        if (methodology === 'v2') {
          // M3: overlapping events may not attribute more than the month's
          // independently computed non_recurrent delay per TMC.
          const nonRecByTmc = {};
          for (const r of records) nonRecByTmc[r.tmc] = Number(r.non_recurrent) || 0;
          tmcMap = delay.capAttribution(tmcMap, nonRecByTmc);
        }
        const attribution = delay.attributionRows(tmcMap);
        for (let j = 0; j < attribution.length; j += ATTRIBUTION_BATCH) {
          await db.query(sqlb.attributionUpdateSQL({
            table: dataTable, rows: attribution.slice(j, j + ATTRIBUTION_BATCH),
          }));
        }

        await dispatchEvent('excessive_delay:SUCCESS_DATA_INSERTING',
          `${year}-${String(month).padStart(2, '0')}: ${records.length} rows, ${attribution.length} attributed`,
          { source_id, view_id, year, month });
        await updateProgress(0.05 + 0.9 * ((i + 1) / periods.length));
      }

      // Baselines are per-run scratch — drop them (kept on error for debugging).
      for (const table of Object.values(baselineByYear)) {
        await chDb.exec({ query: sqlb.baselineDropSQL({ table }) });
      }

      // ── Phase 3: metadata ─────────────────────────────────────────────────
      // start/end/years computed from what is actually in the table (add runs
      // extend prior runs; gaps stay visible in years[]).
      const { rows: periodRows } = await db.query(sqlb.distinctPeriodsSQL(dataTable));
      const have = periodRows.map((r) => ({ year: Number(r.year), month: Number(r.month) }));
      const years = [...new Set(have.map((p) => p.year))].sort((a, b) => a - b);
      const first = have[0];
      const last = have[have.length - 1];
      const bounds = (p) => delay.expandPeriods({ years: [p.year], months: [p.month] })[0];

      await mergeJsonColumn(db, viewsTable, 'view_id', view_id, 'metadata', {
        dama_source_name: name,
        is_clickhouse_table: 0,
        schema: TABLE_SCHEMA,
        // M5: make units + monetization + methodology explicit on the view.
        methodology,
        baseline_statistic: baselineStatistic,
        attribution_capped: methodology === 'v2',
        units: 'vehicle_hours',
        monetization: tableColumns.has('vot_eff') && tableColumns.has('cost') ? {
          // Class-weighted value of time (adopted 2026-06-19, rates confirmed
          // 2026-06-22). cost = total delay (veh-hrs) × vot_eff; bucket-level
          // dollars derive as bucket × vot_eff. Per-vehicle rates with
          // occupancy already bundled — do NOT also multiply by AVO.
          method: 'class_weighted_vot',
          vot_version: VOT_VERSION,
          vot_rates: VOT_RATES[VOT_VERSION], // dated $/veh-hr by class + network blend
          note: 'cost column = total veh-hrs × vot_eff (per-TMC class-weighted $/veh-hr from the AADT split). '
            + 'Where the split is NULL/0, vot_eff falls back to the network-blended rate. '
            + 'Caveat: NY single-unit (FHWA 4–7) is bus-heavy — revisit a transit person-VOT for bus-dominated urban TMCs.',
          // Legacy flat rate, retained so pre-2026-06 dashboards stay reproducible.
          legacy_usd_per_vehicle_hour: 20,
        } : {
          method: 'downstream',
          note: 'vot_eff/cost columns are not present on this table (pre-monetization schema); '
            + 'dollars are computed at read time by the dashboards.',
          legacy_usd_per_vehicle_hour: 20,
        },
        start_date: first ? bounds(first).startDate : null,
        end_date: last ? bounds(last).endDate : null,
        years,
        npmrds_production_source_id: d.npmrds_production_source_id ?? null,
        npmrds_production_view_id: d.npmrds_production_view_id ?? null,
        npmrds_prod_table: d.npmrds_prod_table,
        npmrds_meta_view_id: d.npmrds_meta_view_id ?? null,
        npmrds_meta_table: d.npmrds_meta_table,
        transcom_source_id: d.transcom_source_id ?? null,
        transcom_view_id: d.transcom_view_id ?? null,
        transcom_table: d.transcom_table,
      });

      // metadata.columns on the source — drives the Table page (the
      // most-forgotten step per data-types/CLAUDE.md). Advertise only columns
      // the table really has, or UDA queries against the source error out.
      await mergeJsonColumn(db, sourcesTable, 'source_id', source_id, 'metadata', {
        columns: EXCESSIVE_DELAY_COLUMNS.filter((c) => tableColumns.has(c.name)),
        schema: 'excessive_delay_v1',
      });

      await updateProgress(1);
      await dispatchEvent('excessive_delay:FINAL', `excessive_delay ${mode} complete`, {
        source_id, view_id, years,
      });

      return { source_id, view_id, years };
    } catch (err) {
      // Legacy clients poll for excessive_delay:ERROR; the task runner also
      // marks the task failed from the rethrow.
      await dispatchEvent('excessive_delay:ERROR', err.message, { source_id });
      throw err;
    }
  };
}

module.exports = makeWorker();
module.exports.makeWorker = makeWorker;
module.exports.EXCESSIVE_DELAY_COLUMNS = EXCESSIVE_DELAY_COLUMNS;
