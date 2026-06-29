/**
 * SQL builders + small utilities for the map21 publish worker.
 * Ported from references/avail-falcor/dama/routes/data_types/map21/helpers.js
 * with three changes:
 *   - `query(sql, pgEnv)` → `db.query(sql)` (PostgreSQL) — db passed as a param
 *   - `chQuery({query}, pgEnv)` → `chDb.query({ query, format: 'JSON' })` then `.json()`
 *   - `logger.info` → `console.log`
 *
 * `getOriginalPm3Data` was dropped — it referenced a hardcoded "npmrds" pgEnv
 * that no longer exists in the new server, and the only caller (historic
 * comparison) is gated off in the worker.
 *
 * Also includes `generateTmcIdMetaQuery`, inlined from the legacy
 * references/avail-falcor/.../npmrds/queries.js so map21 doesn't depend on
 * an unported npmrds module.
 */

const { uniq } = require('lodash');

// Replacement for moment().format('MM/DD/YYYY') — only date formatter we need
// in the data-table writer. Keeps the plugin free of the moment dependency.
function formatMmDdYyyy(input) {
  if (input == null || input === '') return null;
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}/${day}/${d.getFullYear()}`;
}
const { WEEKDAY } = require('./enums/dayTypes.js');
const { NUM_EPOCHS_PER_DAY, MAP_21_FHWA_COL_ORDER, FREEWAY, NONFREEWAY } = require('./constants.js');
const { columnToCsvHeaderMap } = require('./createPm3Output.js');

// --- TMC meta query builder (inlined from npmrds/queries.js) ----------------

const aadtTruck = '(COALESCE(t1.aadt_combi, 0) + COALESCE(t1.aadt_singl, 0))';
const aadtPass  = `(t1.aadt - ${aadtTruck})`;
const avgVehicleOccupancyPass  = 1.7;
const avgVehicleOccupancySingl = "(CASE ua_code WHEN '63217' THEN 16.8::DOUBLE PRECISION ELSE 10.7::DOUBLE PRECISION END)";
const avgVehicleOccupancyCombi = 1;
const avgVehicleOccupancyTruck = `(
  (
    (${avgVehicleOccupancySingl} * COALESCE(aadt_singl, 0))
    + (${avgVehicleOccupancyCombi} * COALESCE(aadt_combi, 0))
  ) / NULLIF(COALESCE(aadt_singl, 0) + COALESCE(aadt_combi, 0), 0)
)::DOUBLE PRECISION as avgVehicleOccupancyTruck`;

const buildDirAadtClause = (expr) =>
  `(${expr}::DOUBLE PRECISION / LEAST(COALESCE(faciltype, 2), 2)::DOUBLE PRECISION)::DOUBLE PRECISION`;

const direction = `
  substring(
    substring(direction FROM 'NORTH|NB|EAST|EB|SOUTH|SB|WEST|WB')
    FROM 1 FOR 1
  ) AS direction
`;

const functionalClass = `(CASE WHEN f_system <= 2 THEN '${FREEWAY}' ELSE '${NONFREEWAY}' END) as functionalClass`;
const directionalAadt      = `${buildDirAadtClause('aadt')} as directionalAadt`;
const directionalAadtSingl = `${buildDirAadtClause('aadt_singl')} as directionalAadtSingl`;
const directionalAadtCombi = `${buildDirAadtClause('aadt_combi')} as directionalAadtCombi`;
const directionalAadtTruck = `${buildDirAadtClause(aadtTruck)} as directionalAadtTruck`;
const directionalAadtPass  = `${buildDirAadtClause(aadtPass)} as directionalAadtPass`;

const dataKeyToQueryMap = {
  functionalClass,
  aadtTruck,
  aadtPass,
  directionalAadt,
  directionalAadtSingl,
  directionalAadtCombi,
  directionalAadtTruck,
  directionalAadtPass,
  direction,
  avgVehicleOccupancyTruck,
};

function generateTmcIdMetaQuery({ metaTName, dataKeys, tmc }) {
  const select = dataKeys
    .map((k) => (dataKeyToQueryMap[k] ? dataKeyToQueryMap[k] : k))
    .join(', ');
  return `
    SELECT ${select}
    FROM   ${metaTName} t1
    WHERE  tmc = '${tmc}';
  `;
}

// --- Number / date formatting ----------------------------------------------

function precisionRound(number, precision = 0) {
  if (number === null) return null;
  if (!Number.isFinite(+number)) return NaN;
  const factor = 10 ** precision;
  return Math.round(+number * factor) / factor;
}

// --- Data table creation (PostgreSQL) ---------------------------------------

const omitPrefixColumns = ['tmc', 'year'];

const createAnalysisTableSql = ({ table_schema, table_name, columns = true }) => `
  CREATE TABLE IF NOT EXISTS
    ${table_schema}.${table_name} (
      ogc_fid SERIAL,
      ${columns ? `
        tmc TEXT UNIQUE NOT NULL,
        "ALL_lottr" NUMERIC,
        "ALL_lottr_50_PCT" NUMERIC,
        "ALL_lottr_80_PCT" NUMERIC,
        "AMP_lottr" NUMERIC,
        "AMP_lottr_50_PCT" NUMERIC,
        "AMP_lottr_80_PCT" NUMERIC,
        "MIDD_lottr" NUMERIC,
        "MIDD_lottr_50_PCT" NUMERIC,
        "MIDD_lottr_80_PCT" NUMERIC,
        "PMP_lottr" NUMERIC,
        "PMP_lottr_50_PCT" NUMERIC,
        "PMP_lottr_80_PCT" NUMERIC,
        "WE_lottr_50_PCT" NUMERIC,
        "WE_lottr_80_PCT" NUMERIC,
        "WE_lottr" NUMERIC,
        "OVN_lottr" NUMERIC,
        "OVN_lottr_50_PCT" NUMERIC,
        "OVN_lottr_80_PCT" NUMERIC,
        "ALL_tttr" NUMERIC,
        "ALL_tttr_50_PCT" NUMERIC,
        "ALL_tttr_95_PCT" NUMERIC,
        "AMP_tttr" NUMERIC,
        "AMP_tttr_50_PCT" NUMERIC,
        "AMP_tttr_95_PCT" NUMERIC,
        "MIDD_tttr" NUMERIC,
        "MIDD_tttr_50_PCT" NUMERIC,
        "MIDD_tttr_95_PCT" NUMERIC,
        "PMP_tttr" NUMERIC,
        "PMP_tttr_50_PCT" NUMERIC,
        "PMP_tttr_95_PCT" NUMERIC,
        "WE_tttr_50_PCT" NUMERIC,
        "WE_tttr_95_PCT" NUMERIC,
        "WE_tttr" NUMERIC,
        "OVN_tttr" NUMERIC,
        "OVN_tttr_50_PCT" NUMERIC,
        "OVN_tttr_95_PCT" NUMERIC,
        "xdelay_hrs" NUMERIC,
        "all_xdelay_phrs" NUMERIC,
        "all_xdelay_vhrs" NUMERIC,
        "AMP_all_xdelay_phrs" NUMERIC,
        "AMP_all_xdelay_vhrs" NUMERIC,
        "AMP_xdelay_hrs" NUMERIC,
        "PMP_all_xdelay_phrs" NUMERIC,
        "PMP_all_xdelay_vhrs" NUMERIC,
        "PMP_xdelay_hrs" NUMERIC,
        "phed_meta" JSONB,
      ` : ''}
      PRIMARY KEY (ogc_fid)
    )
`;

async function createDataTable({ db, table_schema, table_name, columns = false }) {
  console.log(`[map21] creating data table: ${table_schema}.${table_name}`);
  return db.query(createAnalysisTableSql({ table_schema, table_name, columns }));
}

// --- TMC list (ClickHouse) --------------------------------------------------

async function getListTmcId({ chDb, dataTableName, year }) {
  const yearClause = year ? `WHERE EXTRACT(YEAR from date) = ${year}` : '';
  const sql = `SELECT distinct(tmc) FROM ${dataTableName} ${yearClause}`;
  const result = await chDb.query({ query: sql, format: 'JSON' });
  return result.json();
}

// --- Insert / column-update SQL builders for the map21 data table -----------

const columnValueFormatMap = {
  diraadt:        (v) => precisionRound(v),
  occfac:         (v) => precisionRound(v, 1),
  segmentlength:  (v) => precisionRound(v, 3),
  phed:           (v) => precisionRound(v, 3),
  begindate:      (v) => formatMmDdYyyy(v),
  directionality: (v) => {
    const m = { N: 1, S: 2, E: 3, W: 4 };
    return m[v] != null ? m[v] : 5;
  },
};

function getDataInsertSqlForMap21({ result, table_schema, table_name, METRIC_NAMES }) {
  const colNames = [];
  const resultValues = [];
  Object.keys(result).forEach((metricName) => {
    if (!METRIC_NAMES.includes(metricName) && metricName !== 'meta') return;
    const metricObj = result[metricName];
    if (!metricObj) return;

    Object.keys(metricObj).forEach((intermedKey) => {
      const intermedValue = metricObj[intermedKey];
      const csvKey = columnToCsvHeaderMap[intermedKey];
      if (!csvKey || colNames.includes(`"${csvKey}"`)) return;

      colNames.push(`"${csvKey}"`);
      let v = columnValueFormatMap[csvKey] ? columnValueFormatMap[csvKey](intermedValue) : intermedValue;
      v = Number.isNaN(v) ? null : v;
      const sqlValue = (v != null) ? (typeof v === 'string' ? `'${v}'` : v) : 'NULL';
      resultValues.push(sqlValue);
    });
  });

  return `
    INSERT INTO ${table_schema}.${table_name} (${colNames.join(', ')})
    VALUES (${resultValues.join(', ')})
  `;
}

function getUpdateColumnsSqlForMap21({ result, table_schema, table_name, METRIC_NAMES }) {
  const addColumnClauses = [];
  Object.keys(result).forEach((metricName) => {
    if (!METRIC_NAMES.includes(metricName) && metricName !== 'meta') return;
    const metricObj = result[metricName];
    if (!metricObj) return;

    Object.keys(metricObj).forEach((intermedKey) => {
      const intermedValue = metricObj[intermedKey];
      const csvKey = columnToCsvHeaderMap[intermedKey];
      if (!csvKey) return;
      const columnType = typeof intermedValue === 'string' ? 'TEXT' : 'NUMERIC';
      addColumnClauses.push({ columnName: csvKey, sql: `ADD COLUMN IF NOT EXISTS "${csvKey}" ${columnType}` });
    });
  });

  // Defaults written by every row — lowercase to match the FHWA columns.
  addColumnClauses.push({ columnName: 'MetricSource', sql: `ADD COLUMN IF NOT EXISTS "metricsource" NUMERIC DEFAULT 1` });
  addColumnClauses.push({ columnName: 'COMMENTS',     sql: `ADD COLUMN IF NOT EXISTS "comments" TEXT DEFAULT ''` });

  addColumnClauses.sort((a, b) =>
    MAP_21_FHWA_COL_ORDER.indexOf(a.columnName) - MAP_21_FHWA_COL_ORDER.indexOf(b.columnName)
  );

  return `
    ALTER TABLE ${table_schema}.${table_name}
    ${uniq(addColumnClauses.map((c) => c.sql)).join(',')}
  `;
}

// --- Statewide metrics aggregation (PostgreSQL) -----------------------------

const generateGetStateMetricsQuery = ({ dataTable }) => `
  SELECT
    "BeginDate",
    count(1) AS num_tmcs,
    sum("SegmentLength") AS total_miles,
    Round(sum(CASE
      WHEN GREATEST("LOTTRAMP", "LOTTRMIDD", "LOTTRPMP", "LOTTRWE") >= 1.5 THEN 0
      WHEN "FSystem" = 1 AND "NHS" IN ('1','2','3','4','5','6','7','8','9') AND "UrbanCode" IS NOT NULL AND "FacilityType" IN ('1','2','6')
        THEN "SegmentLength" * ROUND("DIRAADT", 0) * "OCCFAC"
      ELSE 0
    END) /
    sum(CASE
      WHEN "FSystem" = 1 AND "NHS" IN ('1','2','3','4','5','6','7','8','9') AND "UrbanCode" IS NOT NULL AND "FacilityType" IN ('1','2','6')
        THEN "SegmentLength" * ROUND("DIRAADT", 0) * "OCCFAC" ELSE 0
    END) * 100, 1) AS lottrinterstate,
    Round(sum(CASE
      WHEN GREATEST("LOTTRAMP", "LOTTRMIDD", "LOTTRPMP", "LOTTRWE") >= 1.5 THEN 0
      WHEN "FSystem" > 1 AND "NHS" IN ('1','2','3','4','5','6','7','8','9') AND "UrbanCode" IS NOT NULL AND "FacilityType" IN ('1','2','6')
        THEN "SegmentLength" * ROUND("DIRAADT", 0) * "OCCFAC"
      ELSE 0
    END) /
    sum(CASE
      WHEN "FSystem" > 1 AND "NHS" IN ('1','2','3','4','5','6','7','8','9') AND "UrbanCode" IS NOT NULL AND "FacilityType" IN ('1','2','6')
        THEN "SegmentLength" * ROUND("DIRAADT", 0) * "OCCFAC" ELSE 0
    END) * 100, 1) AS lottrnon_interstate,
    Round(sum(CASE
      WHEN "FSystem" = 1 AND "NHS" IN ('1','2','3','4','5','6','7','8','9') AND "UrbanCode" IS NOT NULL AND "FacilityType" IN ('1','2','6')
        THEN GREATEST("TTTRAMP", "TTTRMIDD", "TTTRPMP", "TTTRWE", "TTTROVN") * "SegmentLength"
      ELSE 0
    END) / sum(CASE
      WHEN "FSystem" = 1 AND "NHS" IN ('1','2','3','4','5','6','7','8','9') AND "UrbanCode" IS NOT NULL AND "FacilityType" IN ('1','2','6')
        THEN "SegmentLength" ELSE 0
    END), 2) AS tttrinterstate,
    Round(sum("PHED"), 1) AS phed
  FROM ${dataTable}
  GROUP BY 1;
`;

// --- Misc helpers used by calcPhed -----------------------------------------

function getTrafficDistributionProfileName({ dayType, congestionLevel, directionality, functionalClass }) {
  return dayType === WEEKDAY
    ? `${dayType}_${congestionLevel}_${directionality}_${functionalClass}`
    : `${dayType}_${functionalClass}`;
}

const getNumBinsInDayForTimeBinSize = (timeBinSize) =>
  Math.floor((5 / timeBinSize) * NUM_EPOCHS_PER_DAY);

module.exports = {
  precisionRound,
  createDataTable,
  getListTmcId,
  getDataInsertSqlForMap21,
  getUpdateColumnsSqlForMap21,
  generateGetStateMetricsQuery,
  generateTmcIdMetaQuery,
  getTrafficDistributionProfileName,
  getNumBinsInDayForTimeBinSize,
  omitPrefixColumns,
};
