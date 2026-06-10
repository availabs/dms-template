/**
 * ClickHouse DDL + INSERT builders for npmrds_raw.
 *
 * Pure string builders (no CH connection) so they are unit-testable and the
 * exact engine/keys/column-shapes/epoch-math are pinned by tests. Ported from
 * the legacy avail-falcor npmrds_raw copy_tables/temp_clickhouse_load stages.
 *
 * Vehicle-class merge is CH-side (no DuckDB): the 3 RITIS datasources are loaded
 * to temp tables and inserted into one AggregatingMergeTree whose
 * SimpleAggregateFunction(max) columns collapse the per-class rows by (tmc, epoch, date).
 */

// RITIS export datasources used by npmrds_raw.
const VEHICLE_SOURCES = ['npmrds2_combined', 'npmrds2_passenger', 'npmrds2_truck'];

// Which production column-key each RITIS datasource feeds.
const VEHICLE_SOURCE_TO_KEY = {
  npmrds2_combined: 'all_vehicles',
  npmrds2_passenger: 'passenger_vehicles',
  npmrds2_truck: 'freight_trucks',
};

const VEHICLE_KEYS = ['all_vehicles', 'passenger_vehicles', 'freight_trucks'];

// ─── final production travel-time table ──────────────────────────────────────
function rawDataTableDDL(fullTableName) {
  return `
CREATE TABLE IF NOT EXISTS ${fullTableName} (
  tmc String NOT NULL,
  date Date NOT NULL,
  epoch Int64 NOT NULL,
  travel_time_all_vehicles SimpleAggregateFunction(max, Nullable(Float64)),
  travel_time_passenger_vehicles SimpleAggregateFunction(max, Nullable(Float64)),
  travel_time_freight_trucks SimpleAggregateFunction(max, Nullable(Float64)),
  data_density_all_vehicles SimpleAggregateFunction(max, Nullable(String)),
  data_density_passenger_vehicles SimpleAggregateFunction(max, Nullable(String)),
  data_density_freight_trucks SimpleAggregateFunction(max, Nullable(String)),
  state String
)
ENGINE = AggregatingMergeTree()
PRIMARY KEY (tmc, epoch, date)
ORDER BY (tmc, epoch, date)
PARTITION BY toYYYYMM(date)`;
}

// ─── temp staging tables (all String — CSVs land here verbatim) ──────────────
function tempDataTableDDL(fullTableName) {
  return `
CREATE TABLE IF NOT EXISTS ${fullTableName} (
  tmc_code String,
  measurement_tstamp String,
  speed String,
  historical_average_speed String,
  reference_speed String,
  travel_time_seconds String,
  data_density String,
  NPMRDS2 String
)
ENGINE = ReplacingMergeTree()
ORDER BY (tmc_code, measurement_tstamp)`;
}

const TMC_ID_RAW_COLUMNS = [
  'tmc', 'road', 'direction', 'intersection', 'state', 'county', 'zip',
  'start_latitude', 'start_longitude', 'end_latitude', 'end_longitude',
  'miles', 'road_order', 'timezone_name', 'type', 'country',
  'tmclinear', 'frc', 'border_set', 'f_system', 'urban_code', 'faciltype',
  'structype', 'thrulanes', 'route_numb', 'route_sign', 'route_qual', 'altrtename',
  'aadt', 'aadt_singl', 'aadt_combi', 'nhs', 'nhs_pct',
  'strhnt_typ', 'strhnt_pct', 'truck', 'isprimary',
  'active_start_date', 'active_end_date',
  'thrulanes_unidir', 'aadt_unidir', 'aadt_singl_unidir', 'aadt_combi_unidir',
];

function tempTmcIdTableDDL(fullTableName) {
  const cols = TMC_ID_RAW_COLUMNS.map((c) => `  ${c} String`).join(',\n');
  return `
CREATE TABLE IF NOT EXISTS ${fullTableName} (
${cols}
)
ENGINE = ReplacingMergeTree()
ORDER BY (tmc, county)`;
}

function tempGeoTableDDL(fullTableName) {
  return `
CREATE TABLE IF NOT EXISTS ${fullTableName} (
  tmc String,
  wkb_geometry String
)
ENGINE = ReplacingMergeTree()
PRIMARY KEY (tmc)
ORDER BY (tmc)`;
}

// ─── final typed TMC identification table ────────────────────────────────────
function tmcIdentificationTableDDL(fullTableName) {
  return `
CREATE TABLE IF NOT EXISTS ${fullTableName} (
  tmc String, road String, direction String, intersection String,
  state String, county String, zip String,
  start_latitude Float64, start_longitude Float64,
  end_latitude Float64, end_longitude Float64,
  miles Float64, road_order Float64,
  timezone_name String, type String, country String,
  tmclinear Int64, frc Int64, border_set String,
  f_system Int8, urban_code Int64, faciltype Int64,
  structype Int64, thrulanes Int64, route_numb Int64,
  route_sign Int64, route_qual Int64, altrtename String,
  aadt Int64, aadt_singl Int64, aadt_combi Int64,
  nhs Int64, nhs_pct Int64,
  strhnt_typ String, strhnt_pct String,
  truck Int8, isprimary Int8,
  active_start_date String, active_end_date String,
  thrulanes_unidir Int64, aadt_unidir Int64,
  aadt_singl_unidir Int64, aadt_combi_unidir Int64,
  wkb_geometry String
)
ENGINE = ReplacingMergeTree()
ORDER BY (tmc, county)`;
}

// Typed INSERT from the temp TMC-id table, LEFT JOIN the temp geometry table.
function tmcIdInsertSQL({ destTable, tempTmcIdTable, tempGeoTable }) {
  return `
INSERT INTO ${destTable}
SELECT
  tmc, road, direction, intersection, state, county, zip,
  toFloat64OrNull(start_latitude), toFloat64OrNull(start_longitude),
  toFloat64OrNull(end_latitude), toFloat64OrNull(end_longitude),
  toFloat64OrNull(miles), toFloat64OrNull(road_order),
  timezone_name, type, country,
  toInt64OrNull(tmclinear), toInt64OrNull(frc), border_set,
  toInt8OrNull(f_system), toInt64OrNull(urban_code), toInt64OrNull(faciltype),
  toInt64OrNull(structype), toInt64OrNull(thrulanes),
  toInt64OrNull(route_numb), toInt64OrNull(route_sign), toInt64OrNull(route_qual),
  altrtename,
  toInt64OrNull(aadt), toInt64OrNull(aadt_singl), toInt64OrNull(aadt_combi),
  toInt64OrNull(nhs), toInt64OrNull(nhs_pct),
  strhnt_typ, strhnt_pct,
  toInt8OrNull(truck), toInt8OrNull(isprimary),
  active_start_date, active_end_date,
  toInt64OrNull(thrulanes_unidir), toInt64OrNull(aadt_unidir),
  toInt64OrNull(aadt_singl_unidir), toInt64OrNull(aadt_combi_unidir),
  COALESCE(geo.wkb_geometry, '') AS wkb_geometry
FROM ${tempTmcIdTable} AS main
LEFT JOIN ${tempGeoTable} AS geo ON main.tmc = geo.tmc`;
}

// One INSERT per vehicle class into the AggregatingMergeTree. epoch = 5-min bucket of day.
function vehicleInsertSQL({ destTable, tempTable, vehicleKey, stateCode }) {
  if (!VEHICLE_KEYS.includes(vehicleKey)) {
    throw new Error(`Unknown vehicle key "${vehicleKey}" (expected one of ${VEHICLE_KEYS.join(', ')})`);
  }
  const state = String(stateCode || '').toLowerCase();
  return `
INSERT INTO ${destTable} (tmc, date, epoch, travel_time_${vehicleKey}, data_density_${vehicleKey}, state)
SELECT
  tmc_code AS tmc,
  toDate(substring(measurement_tstamp, 1, 10)) AS date,
  (toInt64(toUnixTimestamp(measurement_tstamp)) % 86400) / 300 AS epoch,
  travel_time_seconds AS travel_time_${vehicleKey},
  data_density AS data_density_${vehicleKey},
  '${state}' AS state
FROM ${tempTable}`;
}

module.exports = {
  VEHICLE_SOURCES,
  VEHICLE_SOURCE_TO_KEY,
  VEHICLE_KEYS,
  TMC_ID_RAW_COLUMNS,
  rawDataTableDDL,
  tempDataTableDDL,
  tempTmcIdTableDDL,
  tempGeoTableDDL,
  tmcIdentificationTableDDL,
  tmcIdInsertSQL,
  vehicleInsertSQL,
};
