/**
 * ClickHouse DDL + SQL builders for the npmrds (prod travel time) and
 * npmrds_meta data-types.
 *
 * Pure string builders (no CH connection) so the exact engine/keys/column
 * shapes/formulas are pinned by unit tests. Ported verbatim from the legacy
 * avail-falcor npmrds files:
 *   - publish.route.js   → prodTableDDL, metaTableDDL
 *   - add.worker.mjs     → insertRawIntoProdSQL, optimizeProdSQL
 *   - replace.worker.mjs → dropPartitionSQL, confirmRemovedSQL
 *   - queries.js         → tempChMetaTableDDL, insertIntoChMetaSQL,
 *                          tmcMetaQuerySQL (functionalClass)
 *   - metadata.worker.mjs→ tmcIdEnrichmentSelectSQL, deleteMetaYearSQL,
 *                          selectMetaYearSQL
 *   - map21 helpers/calcTtrMeasure → tmcListSQL, binnedDataSQL
 */

// ─── provisioning DDL ────────────────────────────────────────────────────────

// Production travel-time table. ReplacingMergeTree (NOT Aggregating like the
// raw layer) — rows arrive already merged per vehicle class from npmrds_raw,
// and the view_id column stamps each row's raw-view provenance for remove/replace.
function prodTableDDL(fullTableName) {
  return `
CREATE TABLE IF NOT EXISTS ${fullTableName} (
  tmc String NOT NULL,
  date Date NOT NULL,
  epoch Int64 NOT NULL,
  travel_time_all_vehicles Float64,
  travel_time_passenger_vehicles Float64,
  travel_time_freight_trucks Float64,
  data_density_all_vehicles String,
  data_density_passenger_vehicles String,
  data_density_freight_trucks String,
  state String,
  view_id Int64
) ENGINE = ReplacingMergeTree()
PRIMARY KEY(tmc, epoch, date)
ORDER BY(tmc, epoch, date)
PARTITION BY toYYYYMM(date)`;
}

// All-years CH tmc_meta table. NOTE: no mpo_name column — legacy kept mpo_name
// only on the PG side; the CH backfill silently drops it. Preserved as-is.
function metaTableDDL(fullTableName) {
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
  structype Int64, thrulanes Int64,
  route_numb Int64, route_sign Int64, route_qual Int64,
  altrtename String,
  aadt Int64, aadt_singl Int64, aadt_combi Int64,
  nhs Int64, nhs_pct Int64,
  strhnt_typ String, strhnt_pct String,
  truck Int8, isprimary Int8,
  active_start_date String, active_end_date String,
  thrulanes_unidir Int64, aadt_unidir Int64,
  aadt_singl_unidir Int64, aadt_combi_unidir Int64,
  congestion_level String, year Int64, avg_speedlimit Float64,
  directionality String, avg_vehicle_occupancy Float64,
  state_code String, county_code String, region_code String,
  mpo_code String, ua_code String, state_name String,
  county_name String, ua_name String,
  is_interstate Bool,
  wkb_geometry String
) ENGINE = ReplacingMergeTree()
ORDER BY (year, tmc)
PRIMARY KEY(year, tmc)`;
}

// Temp enrichment table: temp.meta_{tmcIdViewId}_{year}
function tempChMetaTableDDL(tempMetaViewTable) {
  return `
CREATE TABLE IF NOT EXISTS temp.${tempMetaViewTable} (
  tmc String,
  congestion_level String,
  year Int64,
  avg_speedlimit Float64,
  directionality String,
  avg_vehicle_occupancy Float64,
  state_code String,
  county_code String,
  region_code String,
  mpo_code String,
  ua_code String,
  state_name String,
  county_name String,
  ua_name String
) ENGINE = ReplacingMergeTree()
PRIMARY KEY (tmc, year, state_name)
ORDER BY (tmc, year, state_name)`;
}

// ─── add / replace / remove data movement ────────────────────────────────────

function insertRawIntoProdSQL({ prodTable, rawTable, rawViewId }) {
  return `
INSERT INTO ${prodTable}
SELECT
  tmc, date, epoch, travel_time_all_vehicles, travel_time_passenger_vehicles, travel_time_freight_trucks, data_density_all_vehicles, data_density_passenger_vehicles, data_density_freight_trucks, state, ${Number(rawViewId)} AS view_id
FROM ${rawTable}
SETTINGS max_memory_usage = 0`;
}

function optimizeProdSQL(prodTable) {
  return `OPTIMIZE TABLE ${prodTable} FINAL DEDUPLICATE BY tmc, date, epoch`;
}

function deleteMetaYearSQL(metaTable, year) {
  return `ALTER TABLE ${metaTable} DELETE WHERE year = ${Number(year)}`;
}

function deleteProdViewIdSQL(prodTable, viewId) {
  return `ALTER TABLE ${prodTable} DELETE WHERE view_id = ${Number(viewId)} SETTINGS max_memory_usage = 0, max_execution_time = 0, mutations_sync = 2`;
}

function dropPartitionSQL(prodTable, partitionId) {
  return `ALTER TABLE ${prodTable} DROP PARTITION '${partitionId}'`;
}

function dropTableSQL(table) {
  return `DROP TABLE IF EXISTS ${table}`;
}

function confirmRemovedSQL({ prodTable, viewIds }) {
  return `SELECT DISTINCT view_id FROM ${prodTable} WHERE view_id IN (${viewIds.map(Number).join(',')})`;
}

// ─── metadata enrichment SQL ─────────────────────────────────────────────────

// Feed for the temp enrichment table — straight pull from tmc_identification.
function tmcIdEnrichmentSelectSQL(metaTName) {
  return `
SELECT
  tmc,
  substring(active_start_date, 1, 4) as year,
  state as state_name,
  county as county_name,
  urban_code as ua_code
FROM ${metaTName}`;
}

// tmc_identification FULL OUTER JOIN temp enrichment → CH meta table.
// avg_vehicle_occupancy: FHWA AVO guidance factors (1.7 passenger, 10.7
// single-unit truck — 16.8 in the NYC urbanized area ua_code 63217, 1 combi).
// avg_speedlimit / mpo_code stay NULL here; the PG spatial round-trip fills them.
function insertIntoChMetaSQL({ metaTableName, metaTName, tempMetaViewTable }) {
  return `
INSERT INTO
  ${metaTableName}
SELECT
  DISTINCT *
FROM (
  SELECT
    COALESCE(t1.tmc, t2.tmc) AS tmc,
    t1.road AS road,
    t1.direction AS direction,
    t1.intersection,
    t1.state AS state,
    t1.county AS county,
    t1.zip AS zip,
    t1.start_latitude AS start_latitude,
    t1.start_longitude AS start_longitude,
    t1.end_latitude AS end_latitude,
    t1.end_longitude AS end_longitude,
    t1.miles AS miles,
    t1.road_order AS road_order,
    t1.timezone_name AS timezone_name,
    t1.type AS type,
    t1.country AS country,
    t1.tmclinear AS tmclinear,
    t1.frc AS frc,
    t1.border_set AS border_set,
    t1.f_system AS f_system,
    t1.urban_code AS urban_code,
    t1.faciltype AS faciltype,
    t1.structype AS structype,
    t1.thrulanes AS thrulanes,
    t1.route_numb AS route_numb,
    t1.route_sign AS route_sign,
    t1.route_qual AS route_qual,
    t1.altrtename AS altrtename,
    t1.aadt AS aadt,
    t1.aadt_singl AS aadt_singl,
    t1.aadt_combi AS aadt_combi,
    t1.nhs AS nhs,
    t1.nhs_pct AS nhs_pct,
    t1.strhnt_typ AS strhnt_typ,
    t1.strhnt_pct AS strhnt_pct,
    t1.truck AS truck,
    t1.isprimary AS isprimary,
    t1.active_start_date AS active_start_date,
    t1.active_end_date AS active_end_date,
    t1.thrulanes_unidir AS thrulanes_unidir,
    t1.aadt_unidir AS aadt_unidir,
    t1.aadt_singl_unidir AS aadt_singl_unidir,
    t1.aadt_combi_unidir AS aadt_combi_unidir,
    t2.congestion_level AS congestion_level,
    t2.year AS year,
    NULL AS avg_speedlimit,
    t2.directionality AS directionality,
    ((
      (1.7 * (t1.aadt - (COALESCE(t1.aadt_combi, 0) + COALESCE(t1.aadt_singl, 0))))
      + ((CASE ua_code WHEN '63217' THEN 16.8::DOUBLE PRECISION ELSE 10.7::DOUBLE PRECISION END) * COALESCE(t1.aadt_singl, 0))
      + (1 * COALESCE(t1.aadt_combi, 0))
    ) / aadt)::DOUBLE PRECISION AS avg_vehicle_occupancy,
    t2.state_code AS state_code,
    t2.county_code AS county_code,
    t2.region_code AS region_code,
    NULL as mpo_code,
    t2.ua_code AS ua_code,
    t2.state_name AS state_name,
    t2.county_name AS county_name,
    t2.ua_name AS ua_name,
    (case when ((t1.f_system = 1) AND (t1.faciltype::int IN (1, 2, 6)) AND (t1.nhs::int IN (1, 2, 3, 4, 5, 6, 7, 8, 9)) AND (t1.urban_code::int > 0)) then true else false end) as is_interstate,
    t1.wkb_geometry AS wkb_geometry
  FROM
    ${metaTName} t1
  FULL OUTER JOIN
    temp.${tempMetaViewTable} t2
  ON
    t1.tmc = t2.tmc
  WHERE
    state IS NOT NULL AND county IS NOT NULL AND country IS NOT NULL AND tmc IS NOT NULL AND tmc != '' AND year > 2000
) AS combined_data`;
}

function selectMetaYearSQL(metaTable, year) {
  return `SELECT * FROM ${metaTable} WHERE year = ${Number(year)}`;
}

// ─── directionality inputs (ported from map21 helpers) ───────────────────────

function tmcListSQL({ dataTable, year }) {
  const yearClause = year ? `WHERE EXTRACT(YEAR from date) = ${Number(year)}` : '';
  return `SELECT distinct(tmc) AS tmc FROM ${dataTable} ${yearClause}`;
}

// miles + FREEWAY/NONFREEWAY for one tmc (f_system <= 2 ⇒ FREEWAY).
function tmcMetaQuerySQL({ metaTName, tmc }) {
  return `
SELECT
  miles,
  (CASE WHEN f_system <= 2 THEN 'FREEWAY' ELSE 'NONFREEWAY' END) as functionalClass
FROM ${metaTName} t1
WHERE tmc = '${tmc}'`;
}

const MINUTES_PER_EPOCH = 5;
const EPOCHS_IN_HOUR = 12;

// 15-min binned travel times for one tmc/window (the directionality feed).
function binnedDataSQL({ dataTable, year, tmc, npmrdsDataKey, hours, dow, timeBinSize = 15 }) {
  const epochsPerBin = Math.floor(timeBinSize / MINUTES_PER_EPOCH);
  return `
SELECT
  tmc,
  date,
  (toDayOfWeek(date, 2)) as dow,
  EXTRACT(MONTH from date) as month,
  FLOOR(epoch::NUMERIC / ${epochsPerBin}::NUMERIC)::SMALLINT AS "timeBinNum",
  round(AVG(CASE WHEN ${npmrdsDataKey} > 0 THEN ${npmrdsDataKey} ELSE NULL END), 3) as tt
FROM
  ${dataTable}
WHERE (
    tmc = '${tmc}'
  AND
    EXTRACT(YEAR from date) = ${Number(year)}
  AND
    FLOOR(epoch::NUMERIC / ${EPOCHS_IN_HOUR}::NUMERIC)::SMALLINT in (${hours.join(',')})
  AND
    toDayOfWeek(date, 2) in (${dow.join(',')})
)
GROUP BY
  tmc, date, FLOOR(epoch::NUMERIC / ${epochsPerBin}::NUMERIC)::SMALLINT
ORDER BY
  date, tmc, FLOOR(epoch::NUMERIC / ${epochsPerBin}::NUMERIC)::SMALLINT`;
}

module.exports = {
  prodTableDDL,
  metaTableDDL,
  tempChMetaTableDDL,
  insertRawIntoProdSQL,
  optimizeProdSQL,
  deleteMetaYearSQL,
  deleteProdViewIdSQL,
  dropPartitionSQL,
  dropTableSQL,
  confirmRemovedSQL,
  tmcIdEnrichmentSelectSQL,
  insertIntoChMetaSQL,
  selectMetaYearSQL,
  tmcListSQL,
  tmcMetaQuerySQL,
  binnedDataSQL,
};
