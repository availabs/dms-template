/**
 * Postgres DDL + SQL builders for the npmrds_meta geometry tables.
 *
 * Pure string builders. Ported verbatim from legacy avail-falcor:
 *   - publish.route.js     → geometryTableDDL/geometryIndexDDL (all-years table)
 *   - queries.js           → tempPgMetaTableDDL, insertIntoPgMetaSQL (spatial join)
 *   - metadata.worker.mjs  → toPgRowValues (the ORDER MATTERS row), per-year DDL,
 *                            perYearInsertSQL, setSridSQL
 *
 * The legacy batch insert used pg-format %L literals; this port uses a
 * parameterized multi-row VALUES insert instead (no new deps, injection-safe).
 */

// The 58 columns of the CH meta table / PG temp table, in the legacy declared
// order. The PG all-years geometry table adds mpo_name (after mpo_code) and an
// ogc_fid serial PK on top of these.
const TEMP_META_COLUMNS = [
  'tmc', 'road', 'direction', 'intersection', 'state', 'county', 'zip',
  'start_latitude', 'start_longitude', 'end_latitude', 'end_longitude',
  'miles', 'road_order', 'timezone_name', 'type', 'country',
  'tmclinear', 'frc', 'border_set', 'f_system', 'urban_code', 'faciltype',
  'structype', 'thrulanes', 'route_numb', 'route_sign', 'route_qual',
  'altrtename', 'aadt', 'aadt_singl', 'aadt_combi', 'nhs', 'nhs_pct',
  'strhnt_typ', 'strhnt_pct', 'truck', 'isprimary',
  'active_start_date', 'active_end_date',
  'thrulanes_unidir', 'aadt_unidir', 'aadt_singl_unidir', 'aadt_combi_unidir',
  'congestion_level', 'year', 'avg_speedlimit', 'directionality',
  'avg_vehicle_occupancy', 'state_code', 'county_code', 'region_code',
  'mpo_code', 'ua_code', 'state_name', 'county_name', 'ua_name',
  'is_interstate', 'wkb_geometry',
];

// PG column types in the same order (used by both temp + geometry tables).
const COLUMN_TYPES = {
  tmc: 'VARCHAR', road: 'VARCHAR', direction: 'VARCHAR', intersection: 'VARCHAR',
  state: 'VARCHAR', county: 'VARCHAR', zip: 'VARCHAR',
  start_latitude: 'FLOAT8', start_longitude: 'FLOAT8',
  end_latitude: 'FLOAT8', end_longitude: 'FLOAT8',
  miles: 'FLOAT8', road_order: 'FLOAT8',
  timezone_name: 'VARCHAR', type: 'VARCHAR', country: 'VARCHAR',
  tmclinear: 'BIGINT', frc: 'BIGINT', border_set: 'VARCHAR',
  f_system: 'SMALLINT', urban_code: 'BIGINT', faciltype: 'BIGINT',
  structype: 'BIGINT', thrulanes: 'BIGINT',
  route_numb: 'BIGINT', route_sign: 'BIGINT', route_qual: 'BIGINT',
  altrtename: 'VARCHAR',
  aadt: 'BIGINT', aadt_singl: 'BIGINT', aadt_combi: 'BIGINT',
  nhs: 'BIGINT', nhs_pct: 'BIGINT',
  strhnt_typ: 'VARCHAR', strhnt_pct: 'VARCHAR',
  truck: 'SMALLINT', isprimary: 'SMALLINT',
  active_start_date: 'VARCHAR', active_end_date: 'VARCHAR',
  thrulanes_unidir: 'BIGINT', aadt_unidir: 'BIGINT',
  aadt_singl_unidir: 'BIGINT', aadt_combi_unidir: 'BIGINT',
  congestion_level: 'VARCHAR', year: 'BIGINT', avg_speedlimit: 'FLOAT8',
  directionality: 'VARCHAR', avg_vehicle_occupancy: 'FLOAT8',
  state_code: 'VARCHAR', county_code: 'VARCHAR', region_code: 'VARCHAR',
  mpo_code: 'VARCHAR', mpo_name: 'VARCHAR', ua_code: 'VARCHAR',
  state_name: 'VARCHAR', county_name: 'VARCHAR', ua_name: 'VARCHAR',
  is_interstate: 'BOOLEAN', wkb_geometry: 'GEOMETRY(MultiLineString)',
};

// Which of the 58 are coerced with the legacy `Number(x) || null` semantics
// (note: that maps 0 / '0' to null — a legacy quirk, preserved).
const NUMERIC_COLUMNS = new Set([
  'start_latitude', 'start_longitude', 'end_latitude', 'end_longitude',
  'miles', 'road_order', 'tmclinear', 'frc', 'f_system', 'urban_code',
  'faciltype', 'structype', 'thrulanes', 'route_numb', 'route_sign',
  'route_qual', 'aadt', 'aadt_singl', 'aadt_combi', 'nhs', 'nhs_pct',
  'truck', 'isprimary', 'thrulanes_unidir', 'aadt_unidir',
  'aadt_singl_unidir', 'aadt_combi_unidir', 'year', 'avg_speedlimit',
  'avg_vehicle_occupancy',
]);

function colDefs(columns, { withMpoName = false, withIsInterstate = true } = {}) {
  return columns
    .filter((c) => withIsInterstate || c !== 'is_interstate')
    .flatMap((c) => {
      const defs = [`${c} ${COLUMN_TYPES[c]}`];
      if (withMpoName && c === 'mpo_code') defs.push(`mpo_name ${COLUMN_TYPES.mpo_name}`);
      return defs;
    })
    .join(',\n  ');
}

// ─── all-years geometry table (provisioning) ─────────────────────────────────

function geometryTableDDL({ schema, tableName, viewId }) {
  return `
CREATE TABLE IF NOT EXISTS ${schema}.${tableName} (
  ogc_fid serial PRIMARY KEY,
  ${colDefs(TEMP_META_COLUMNS, { withMpoName: true })},
  CONSTRAINT ${tableName}_${viewId}_unique_tmc_year UNIQUE (tmc, year)
)`;
}

function geometryIndexDDL({ schema, tableName, viewId }) {
  return `
CREATE INDEX IF NOT EXISTS ${tableName}_${viewId}_wkb_geometry_idx
ON ${schema}.${tableName}
USING GIST (wkb_geometry)`;
}

// ─── temp staging table + batch insert ───────────────────────────────────────

function tempPgMetaTableDDL({ table_name }) {
  return `
CREATE TABLE temp.${table_name} (
  ${colDefs(TEMP_META_COLUMNS)}
)`;
}

// CH JSONEachRow row → 58 values in TEMP_META_COLUMNS order.
// Legacy semantics: numerics via Number(x) || null; everything else verbatim
// (undefined normalized to null for parameterized-insert safety).
function toPgRowValues(row) {
  return TEMP_META_COLUMNS.map((col) => {
    if (NUMERIC_COLUMNS.has(col)) return Number(row[col]) || null;
    const v = row[col];
    return v === undefined ? null : v;
  });
}

// Parameterized multi-row VALUES insert into the temp table.
// rows: array of toPgRowValues() outputs.
function insertIntoTempPgMetaSQL({ table_name, rows }) {
  const nCols = TEMP_META_COLUMNS.length;
  const values = [];
  const tuples = rows.map((vals, r) => {
    if (vals.length !== nCols) {
      throw new Error(`insertIntoTempPgMetaSQL: row has ${vals.length} values, expected ${nCols}`);
    }
    values.push(...vals);
    const ph = vals.map((_, c) => `$${r * nCols + c + 1}`);
    return `(${ph.join(', ')})`;
  });
  const text = `
INSERT INTO temp.${table_name} (${TEMP_META_COLUMNS.join(', ')})
VALUES
  ${tuples.join(',\n  ')}`;
  return { text, values };
}

// ─── the spatial-join insert (legacy generateInsertIntoPgMetaQuery) ──────────

const GEOM_INSERT_COLUMNS = TEMP_META_COLUMNS.flatMap((c) =>
  c === 'mpo_code' ? ['mpo_code', 'mpo_name'] : [c]
);

function insertIntoPgMetaSQL({ data_table, table_name, tmcSpeedDataTable, mpoBoundariesDataTable }) {
  const selectCols = TEMP_META_COLUMNS.map((c) => {
    if (c === 'avg_speedlimit') {
      return `(COALESCE(NULLIF(t3.avg_speedlimit, 0), (CASE WHEN temp_meta.year <= 2023 THEN 20 ELSE (CASE temp_meta.f_system WHEN 1 THEN 65 WHEN 2 THEN 55 WHEN 3 THEN 45 ELSE 35 END) END))) AS avg_speedlimit`;
    }
    if (c === 'mpo_code') {
      return `mb.mpo_code,\n    mb.mpo_name`;
    }
    return `temp_meta.${c}`;
  });
  return `
INSERT INTO
  ${data_table} (${GEOM_INSERT_COLUMNS.join(', ')})
SELECT
    ${selectCols.join(',\n    ')}
FROM
  temp.${table_name} temp_meta
LEFT OUTER JOIN
  ${tmcSpeedDataTable} t3
ON
  temp_meta.tmc = t3.tmc
AND
  temp_meta.state_name ILIKE t3.state
JOIN LATERAL (
  SELECT
    mb.mpo_id as mpo_code,
    mb.mpo_name,
    ST_length(geography(
      ST_intersection(
        mb.wkb_geometry,
        ST_SetSRID(temp_meta.wkb_geometry, 4326)
      )
    )) AS mi_in_mpo
  FROM
    ${mpoBoundariesDataTable} mb
  ORDER BY
    mi_in_mpo desc
  LIMIT 1
) AS mb ON TRUE
WHERE
  temp_meta.state IS NOT NULL
AND
  county IS NOT NULL
AND
  country IS NOT NULL
AND
  temp_meta.tmc IS NOT NULL
AND
  temp_meta.tmc != ''
AND
  year > 2000`;
}

// ─── per-year layer (tile) table ─────────────────────────────────────────────

// NOTE: per-year table has mpo_name but NOT is_interstate — a legacy
// inconsistency preserved on purpose (downstream tile consumers don't read it).
function perYearLayerTableDDL({ schema, tableName, viewId }) {
  return `
CREATE TABLE IF NOT EXISTS ${schema}.${tableName} (
  ogc_fid serial PRIMARY KEY,
  ${colDefs(TEMP_META_COLUMNS, { withMpoName: true, withIsInterstate: false })},
  CONSTRAINT ${tableName}_${viewId}_unique_tmc_year UNIQUE (tmc, year)
);
CREATE INDEX IF NOT EXISTS ${tableName}_${viewId}_wkb_geometry_idx
ON ${schema}.${tableName}
USING GIST (wkb_geometry)`;
}

const PER_YEAR_COLUMNS = ['ogc_fid', ...GEOM_INSERT_COLUMNS.filter((c) => c !== 'is_interstate')];

function perYearInsertSQL({ layerDataTable, geometryDataTable, year }) {
  return `
INSERT INTO ${layerDataTable}
(SELECT
  ${PER_YEAR_COLUMNS.join(', ')}
FROM
  ${geometryDataTable}
WHERE
  year = ${Number(year)})`;
}

function setSridSQL(dataTable) {
  return `UPDATE ${dataTable} SET wkb_geometry = ST_SETSRID(wkb_geometry, 4326)`;
}

function deleteYearSQL(dataTable, year) {
  return `DELETE FROM ${dataTable} WHERE year = ${Number(year)}`;
}

module.exports = {
  TEMP_META_COLUMNS,
  GEOM_INSERT_COLUMNS,
  geometryTableDDL,
  geometryIndexDDL,
  tempPgMetaTableDDL,
  toPgRowValues,
  insertIntoTempPgMetaSQL,
  insertIntoPgMetaSQL,
  perYearLayerTableDDL,
  perYearInsertSQL,
  setSridSQL,
  deleteYearSQL,
};
