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

const { omitPrefixColumns, dataKeyToQueryMap } = require('./lib/helpers.js');
const { erasForYear } = require('./lib/eras.js');

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

// The static (non-metric) columns every pm3 ROW EXPOSES — legacy list, verbatim.
// Since the geometry de-duplication these are no longer materialized: they are
// produced by the metrics⋈geometry view (see buildPm3ViewSql). The order is
// load-bearing — it is the column order the pm3 table had, and downstream
// consumers (the UDA table page, ogr2ogr downloads) surface columns in
// relation order.
const META_COLUMNS = [
  'tmc', 'urban_code', 'region_code', 'county', 'ua_name', 'mpo_code', 'mpo_name',
  'wkb_geometry', 'year', 'miles', 'f_system', 'faciltype', 'nhs',
  'avg_vehicle_occupancy', 'directionalaadt', 'directionalaadttruck',
  'avgvehicleoccupancytruck', 'state_code', 'nhs_pct', 'isprimary',
  'congestion_level', 'directionality', 'metricsource', 'comments', 'active_start_date',
];
// strict subset of META_COLUMNS. NOTE `metricsource` is deliberately NOT here:
// the legacy table typed it TEXT even though the worker inserted the number 1,
// and the view must reproduce that type or UDA filters change behavior.
const NUMERIC_META_COLUMNS = [
  'year', 'miles', 'f_system', 'nhs', 'avg_vehicle_occupancy', 'directionalaadt',
  'directionalaadttruck', 'avgvehicleoccupancytruck', 'nhs_pct',
];

const metaColumnType = (colName) => {
  if (colName === 'wkb_geometry') return 'GEOMETRY(MultiLineString)';
  return NUMERIC_META_COLUMNS.includes(colName) ? 'NUMERIC' : 'TEXT';
};

// The metrics table carries ONLY the join key; every other static column comes
// from the view. `ogc_fid SERIAL` is created by map21's createDataTable.
const JOIN_KEY_COLUMNS = ['tmc', 'year'];

function buildAddMetaColumnsSql({ table_schema, table_name }) {
  const clauses = JOIN_KEY_COLUMNS.map(
    (colName) => `ADD COLUMN IF NOT EXISTS "${colName}" ${metaColumnType(colName)}`
  );
  return `
    ALTER TABLE
      ${table_schema}.${table_name}
    ${clauses.join(',')}
  `;
}

// ── metrics ⋈ geometry view ─────────────────────────────────────────────────
// The three AADT/AVO columns are NOT re-derived here: the expressions come
// verbatim from map21's dataKeyToQueryMap (which is also what the per-TMC
// compute-time meta query uses), so the view and the calculators can never
// disagree. Those expressions reference the meta table as `t1` and carry their
// own aliases, which is why the geometry table is aliased `t1` below.
//
// The map21 strings end in their own `as <camelCaseAlias>`; that alias is
// stripped so the expression can be re-cast to the column type the legacy
// MATERIALIZED table used. This matters: the map21 expressions yield DOUBLE
// PRECISION, the old pm3 columns were NUMERIC, and Postgres normalized the
// values on insert. Emitting double precision here would surface float noise
// in the table page and in CSV downloads, and would contradict the NUMERIC type
// advertised in metadata.columns.
//
// NUMERIC_CAST_NOTE — every NUMERIC cast in the view goes through TEXT.
//
// Half the meta-table columns pm3 exposes as NUMERIC are `double precision`
// upstream (avg_vehicle_occupancy, miles) or are computed as double precision
// (the three derived AADT/AVO columns). Postgres's direct float8→numeric cast
// truncates to 15 significant digits, while float8out (i.e. ::TEXT) emits the
// shortest round-trip form — which is exactly what node-postgres wrote when the
// legacy worker inserted a JS double into a NUMERIC column:
//
//   7.01800458715596     float8 ::NUMERIC          (a digit short)
//   7.018004587155963    float8 ::TEXT::NUMERIC    (matches legacy)
//
// Measured against live view 3425 (2026-08-07, 52,127 rows): direct ::NUMERIC
// differed in text on 19,042 rows for avgvehicleoccupancytruck, 20,361 for
// avg_vehicle_occupancy and 1,287 for miles; via ::TEXT, all 25 meta columns are
// exact-text identical. Harmless for the int/numeric/text sources — the extra
// hop is an identity there.
const numericViaText = (expr, type) =>
  (type === 'NUMERIC' ? `(${expr})::TEXT::NUMERIC` : `(${expr})::${type}`);

const stripSqlAlias = (expr) => expr.replace(/\s+as\s+[A-Za-z_][A-Za-z_0-9]*\s*$/i, '');

const DERIVED_META_COLUMNS = {
  directionalaadt: dataKeyToQueryMap.directionalAadt,
  directionalaadttruck: dataKeyToQueryMap.directionalAadtTruck,
  avgvehicleoccupancytruck: dataKeyToQueryMap.avgVehicleOccupancyTruck,
};
// MetricSource is always 1 and comments always blank (legacy worker behavior).
// Emitted as text literals because both land in TEXT columns.
const CONSTANT_META_COLUMNS = { metricsource: `'1'`, comments: `''` };

/**
 * The view's output columns, in order. This IS the pm3 view contract — the UDA
 * table page and ogr2ogr downloads surface columns in relation order — so it is
 * exposed separately from the SQL so it can be asserted without a database.
 */
// R9/R4 — era tags are view-level columns, emitted per year branch as literals rather than stored.
// They are listed here (and in buildPm3SourceColumns) because the datasets contract requires every
// published column to appear in source metadata.columns — without it DataWrapper, the Table page and
// the column-aware filter UI render an empty grid.
const ERA_COLUMNS = [
  { name: 'era_all_vehicles', display_name: 'Coverage Era (all vehicles)', type: 'TEXT',
    desc: 'NPMRDS coverage era(s) this year falls in. Pipe-separated when the year spans a boundary. See data-types/pm3/lib/eras.js.' },
  { name: 'era_all_vehicles_crosses_boundary', display_name: 'Crosses Coverage Era Boundary (all vehicles)', type: 'BOOLEAN',
    desc: 'True when this year spans an all-vehicle coverage-era boundary; such a year must not be compared to another without a coverage control.' },
  { name: 'era_truck', display_name: 'Coverage Era (truck)', type: 'TEXT',
    desc: 'Truck-stream coverage era(s). The truck stream steps on DIFFERENT dates from the all-vehicle stream.' },
  { name: 'era_truck_crosses_boundary', display_name: 'Crosses Coverage Era Boundary (truck)', type: 'BOOLEAN',
    desc: 'True when this year spans a truck-stream coverage-era boundary.' },
];

function pm3ViewColumnNames({ metricColumns }) {
  return ['ogc_fid', ...META_COLUMNS, ...metricColumns, ...ERA_COLUMNS.map((c) => c.name)];
}

function buildMetaSelectParts() {
  return META_COLUMNS.map((col) => {
    if (JOIN_KEY_COLUMNS.includes(col)) return `m."${col}"`;
    // wkb_geometry is passed through untouched — casting it would drop the
    // typmod PostGIS needs to register the view in geometry_columns.
    if (col === 'wkb_geometry') return 't1."wkb_geometry"';

    const type = metaColumnType(col);
    if (DERIVED_META_COLUMNS[col]) {
      return `${numericViaText(stripSqlAlias(DERIVED_META_COLUMNS[col]), type)} AS "${col}"`;
    }
    if (CONSTANT_META_COLUMNS[col]) {
      return `${numericViaText(CONSTANT_META_COLUMNS[col], type)} AS "${col}"`;
    }
    return `${numericViaText(`t1."${col}"`, type)} AS "${col}"`;
  });
}

/**
 * SQL for the per-view relation registered as `views.table_name`.
 *
 * One SELECT branch per year, UNION ALL'd, each joined to that year's
 * npmrds_meta geometry table (resolved from data_manager.views — never guessed;
 * npmrds_geometry holds two tables per meta-layer view and only the registered
 * one is right).
 *
 * @param {string} viewName            fully-qualified target, e.g. `pm3.s1_v2_pm_3`
 * @param {string} metricsTable        fully-qualified metrics table
 * @param {Object} metaTableByYear     { [year]: 'schema.table' }
 * @param {string[]} metricColumns     metric columns present on the metrics table
 */
function buildPm3ViewSql({ viewName, metricsTable, metaTableByYear, metricColumns }) {
  const years = Object.keys(metaTableByYear).map(Number).sort((a, b) => a - b);
  if (!years.length) throw new Error('buildPm3ViewSql: metaTableByYear is empty');

  const selectParts = [
    'm."ogc_fid"',
    ...buildMetaSelectParts(),
    ...metricColumns.map((c) => `m."${c}"`),
  ];

  // R9/R4 — coverage-era tags. These are a pure function of `year`, so they are emitted as literals
  // in each per-year UNION branch rather than stored: no duplication across 52,127 rows, and the
  // value cannot drift out of sync with the row's year. Two tags because the era model differs by
  // stream (see lib/eras.js), and a `crosses_boundary` flag because four of the nine boundaries fall
  // mid-year — an annual figure for 2024 blends THREE all-vehicle eras, and reading it against
  // another year without a coverage control compares feed history as much as traffic.
  const eraParts = (year) => {
    const av = erasForYear(year, 'all_vehicles');
    const tk = erasForYear(year, 'truck');
    const lit = (v) => (v === null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
    return [
      `${lit(av.label)}::TEXT AS "era_all_vehicles"`,
      `${av.crossesBoundary ? 'TRUE' : 'FALSE'}::BOOLEAN AS "era_all_vehicles_crosses_boundary"`,
      `${lit(tk.label)}::TEXT AS "era_truck"`,
      `${tk.crossesBoundary ? 'TRUE' : 'FALSE'}::BOOLEAN AS "era_truck_crosses_boundary"`,
    ];
  };

  const branches = years.map((year) => `
    SELECT
      ${[...selectParts, ...eraParts(year)].join(',\n      ')}
    FROM ${metricsTable} m
    JOIN ${metaTableByYear[year]} t1
      ON t1.tmc = m."tmc" AND t1.year = m."year"
    WHERE m."year" = ${year}`);

  return `
    CREATE VIEW ${viewName} AS
    ${branches.join('\n    UNION ALL\n')}
  `;
}

module.exports = {
  toMetricDbRow,
  generateUpdateColumnsSql,
  getDataRowInsertSql,
  formatSqlLiteral,
  META_COLUMNS,
  NUMERIC_META_COLUMNS,
  JOIN_KEY_COLUMNS,
  metaColumnType,
  buildAddMetaColumnsSql,
  buildMetaSelectParts,
  buildPm3ViewSql,
  pm3ViewColumnNames,
  ERA_COLUMNS,
  DERIVED_META_COLUMNS,
  CONSTANT_META_COLUMNS,
  stripSqlAlias,
};
