/**
 * pm3-specific SQL builders.
 *
 * pm3 differs from map21 in how calculator output reaches the data table:
 *   - map21 renames intermediate keys to FHWA CSV headers
 *     (columnToCsvHeaderMap: "AMP_lottr" → "lottramp") and writes ONE row per
 *     TMC across all metrics;
 *   - pm3 lowercases the intermediate keys (legacy LOWER_CASE_COLUMNS=true),
 *     prefixes them with the metric name ("AMP_lottr" → "lottr_amp_lottr"),
 *     and upserts PER METRIC against a named UNIQUE(tmc, year) constraint
 *     (legacy METRIC_WRITES_DB=true).
 *
 * `generateUpdateColumnsSql` is ported from the legacy
 * avail-falcor/dama/routes/data_types/pm3/helpers.js; `getDataRowInsertSql`
 * from the legacy map21/helpers.js (the new map21 port intentionally dropped
 * it because the new map21 worker writes once per TMC). `omitPrefixColumns`
 * is REUSED from the already-ported map21 helpers.
 */

const { omitPrefixColumns } = require('../map21/helpers.js');

/**
 * Lowercase a calculator result's keys (legacy LOWER_CASE_COLUMNS=true) and
 * drop non-scalar entries — calcPhed returns a nested `meta` object that the
 * legacy METRIC_WRITES_DB path never wrote (it wrote phedResult, not phedResp).
 */
function toMetricDbRow(result) {
  const dbRow = {};
  Object.keys(result || {}).forEach((key) => {
    const v = result[key];
    if (v !== null && typeof v === 'object') return;
    dbRow[key.toLowerCase()] = v;
  });
  return dbRow;
}

// Ported verbatim from legacy pm3/helpers.js
const generateUpdateColumnsSql = ({ tmcRow, metricName, table_schema, table_name }) => {
  const addColumnClauses = Object.keys(tmcRow)
    .filter((rowKey) => !omitPrefixColumns.includes(rowKey))
    .map((rowKey) => {
      const colType = typeof tmcRow[rowKey] === 'string' ? 'TEXT' : 'NUMERIC';
      return `ADD COLUMN IF NOT EXISTS "${metricName}_${rowKey}" ${colType}`;
    });
  return `
    ALTER TABLE
      ${table_schema}.${table_name}
    ${addColumnClauses.join(',')}
  `;
};

// Ported verbatim from legacy map21/helpers.js (truthy-filter behavior kept
// deliberately: null/NaN metric values are simply not written).
const getDataRowInsertSql = ({ result, table_schema, table_name, prefix = '', constraint = `("tmc")` }) => {
  const resultKeys = Object.keys(result)
    .filter((key) => !!result[key])
    .map((key) => `"${prefix.length > 0 && (!omitPrefixColumns.includes(key)) ? prefix + '_' : ''}${key}"`);
  const resultValues = Object.values(result)
    .filter((ttrVal) => !!ttrVal)
    .map((ttrVal) => (typeof ttrVal === 'string' ? `'${ttrVal}'` : ttrVal));

  const updateClause = resultKeys.map((resultKey) => `${resultKey}=EXCLUDED.${resultKey}`).join(', ');

  return `
    INSERT INTO
      ${table_schema}.${table_name} (${resultKeys.join(', ')})
    VALUES
      (${resultValues.join(', ')})
    ON CONFLICT ${constraint}
      DO UPDATE
    SET
      ${updateClause}
  `;
};

// SQL literal for the meta-row insert (ported from the legacy pm3 worker's
// inline formatVal — strings get '' escaping, null → NULL).
function formatSqlLiteral(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
  return val;
}

// The static (non-metric) columns every pm3 row carries — legacy list, verbatim.
const META_COLUMNS = [
  'tmc', 'urban_code', 'region_code', 'county', 'ua_name', 'mpo_code', 'mpo_name',
  'wkb_geometry', 'year', 'miles', 'f_system', 'faciltype', 'nhs',
  'avg_vehicle_occupancy', 'directionalaadt', 'directionalaadttruck',
  'avgvehicleoccupancytruck', 'state_code', 'nhs_pct', 'isprimary',
  'congestion_level', 'directionality', 'metricsource', 'comments', 'active_start_date',
];
// strict subset of META_COLUMNS
const NUMERIC_META_COLUMNS = [
  'year', 'miles', 'f_system', 'nhs', 'avg_vehicle_occupancy', 'directionalaadt',
  'directionalaadttruck', 'avgvehicleoccupancytruck', 'nhs_pct',
];

function buildAddMetaColumnsSql({ table_schema, table_name }) {
  const clauses = META_COLUMNS.map((colName) => {
    if (colName === 'wkb_geometry') {
      return `ADD COLUMN IF NOT EXISTS "${colName}" GEOMETRY(MultiLineString)`;
    }
    if (NUMERIC_META_COLUMNS.includes(colName)) {
      return `ADD COLUMN IF NOT EXISTS "${colName}" NUMERIC`;
    }
    return `ADD COLUMN IF NOT EXISTS "${colName}" TEXT`;
  });
  return `
    ALTER TABLE
      ${table_schema}.${table_name}
    ${clauses.join(',')}
  `;
}

module.exports = {
  toMetricDbRow,
  generateUpdateColumnsSql,
  getDataRowInsertSql,
  formatSqlLiteral,
  META_COLUMNS,
  NUMERIC_META_COLUMNS,
  buildAddMetaColumnsSql,
};
