/**
 * excessive_delay SQL builders — pure string functions, no connections.
 *
 * monthDelayQuery is the ClickHouse port of the legacy inline computation
 * (avail-falcor npmrds/excessivedelay.route.js): the threshold / normalized
 * AADT / distribution-key expressions embedded here are the SQL twins of the
 * pure functions in delay.js, and both are pinned by unit tests.
 *
 * PG-side builders are dialect-aware (postgres | sqlite) so the worker runs
 * unchanged against the dama-sqlite-test harness; the dialect only changes
 * what genuinely differs (SERIAL/GEOMETRY/GIST/::text), never the logic.
 */

const sanitize = (s) => String(s).replace(/[\s\W]+/g, '_');
const viewTableName = (sourceId, viewId, name) =>
  sanitize(`s${sourceId}_v${viewId}_${name}`).toLowerCase();

// SQL literal: numbers verbatim (NaN/Infinity → NULL), null/undefined → NULL,
// everything else single-quoted with quote doubling.
function escapeLiteral(value) {
  if (value == null) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function assertIntegers(values, label) {
  if (!Array.isArray(values) || values.length === 0 || values.some((v) => !Number.isInteger(Number(v)))) {
    throw new Error(`${label} must be a non-empty array of integers`);
  }
  return values.map(Number);
}

// ── output table DDL ─────────────────────────────────────────────────────────

// 25 columns — the legacy excessive_delay shape (matches
// excessive_delay.s1469_v2633_excessive_delay_v3 on npmrds2) plus the
// class-weighted monetization pair (vot_eff, cost) added 2026-06-22.
function outputTableDDL({ table, dialect }) {
  const pg = dialect === 'postgres';
  const stmts = [`
CREATE TABLE IF NOT EXISTS ${table} (
  ogc_fid ${pg ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
  tmc VARCHAR(9) NOT NULL,
  year SMALLINT NOT NULL CHECK (year > 2015),
  month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  total DOUBLE PRECISION,
  non_recurrent DOUBLE PRECISION,
  construction DOUBLE PRECISION,
  accident DOUBLE PRECISION,
  other DOUBLE PRECISION,
  vot_eff DOUBLE PRECISION,
  cost DOUBLE PRECISION,
  region_code VARCHAR,
  region_name VARCHAR,
  wkb_geometry ${pg ? 'GEOMETRY(MultiLineString)' : 'TEXT'},
  f_system SMALLINT,
  aadt DOUBLE PRECISION,
  aadt_singl DOUBLE PRECISION,
  aadt_combi DOUBLE PRECISION,
  length FLOAT8,
  roadname VARCHAR,
  tmclinear DOUBLE PRECISION,
  road_order FLOAT8,
  county_code VARCHAR,
  direction VARCHAR,
  road_information VARCHAR,
  UNIQUE (tmc, year, month)
)`];
  if (pg) {
    const idxName = `${sanitize(table)}_geom_idx`;
    stmts.push(`CREATE INDEX IF NOT EXISTS ${idxName} ON ${table} USING GIST (wkb_geometry)`);
  }
  return stmts;
}

// ── ClickHouse monthly bucket computation ────────────────────────────────────

/**
 * The whole delay computation for one month. Ported verbatim from the legacy
 * route; parameterized over table names, with two additions:
 *   - distributionsTable (default 'aadt_distributions')
 *   - region: optional region_code scope (string or string[])
 */
// ── P1/P2: shared materialized yearly baseline (see 06_congestion_delay_methodology.md) ──

function baselineTableName({ prodTable, year }) {
  const tag = String(prodTable).split('.').pop().replace(/[^A-Za-z0-9_]/g, '_');
  return `temp.avl_avg_tt_${tag}_${Number(year)}`;
}

// CTAS: the weekday baseline travel time per (tmc, epoch) for one year — computed
// ONCE per run and joined by every monthly query (and reusable by the transcom
// congestion worker, which shares this exact baseline definition).
// statistic: 'mean' (legacy v1, default — keeps old runs reproducible) or
// 'median' (methodology v2 / M2 — robust to the disrupted days themselves).
function baselineCreateSQL({ table, prodTable, year, statistic = 'mean' }) {
  const agg = statistic === 'median'
    ? 'quantile(0.5)(travel_time_all_vehicles)'
    : 'AVG(travel_time_all_vehicles)';
  return `
CREATE TABLE IF NOT EXISTS ${table}
ENGINE = MergeTree()
ORDER BY (tmc, epoch)
AS SELECT
    tmc,
    epoch,
    ${agg} AS avg_tt
FROM ${prodTable}
WHERE toDayOfWeek(date) IN (1, 2, 3, 4, 5)
  AND epoch >= 0 AND epoch < 288 AND toYear(date) = ${Number(year)}
GROUP BY tmc, epoch`;
}

function baselineDropSQL({ table }) {
  return `DROP TABLE IF EXISTS ${table}`;
}

function monthDelayQuery({
  prodTable, metaTable, year, startDate, endDate,
  distributionsTable = 'aadt_distributions', region, baselineTable,
}) {
  const regions = region == null ? [] : (Array.isArray(region) ? region : [region]);
  const regionClause = regions.length
    ? ` AND region_code IN (${regions.map(escapeLiteral).join(', ')})`
    : '';
  return `
WITH county_road_dir_miles AS (
    SELECT
        road,
        county_code,
        direction,
        SUM(miles) AS total_road_miles
    FROM ${metaTable}
    WHERE aadt IS NOT NULL AND year = ${Number(year)}
    GROUP BY road, county_code, direction
)
SELECT
    a.tmc AS tmc,
    toYear(a.date) AS year,
    toMonth(a.date) AS month,
    SUM(
        GREATEST(
            0,
            a.travel_time_all_vehicles - GREATEST(
                c.threshold_tt,
                COALESCE(b.avg_tt, 0)
            )
        ) / 3600
        * c.aadt -- using normalized aadt
        * d.distributions[a.epoch + 1]
    ) AS non_recurrent,
    SUM(
        GREATEST(
            0,
            a.travel_time_all_vehicles - c.threshold_tt
        ) / 3600
        * c.aadt
        * d.distributions[a.epoch + 1]
    ) AS total,

    -- Additional metadata fields — constant per TMC, so any() (P3: keeps the
    -- geometry string and friends out of the GROUP BY hash keys)
    any(c.f_system) AS f_system,
    any(c.aadt) AS aadt,
    any(c.aadt_unnorm) AS aadt_raw, -- raw undirected total, for class-weighted VOT_eff (delay.js)
    any(c.aadt_combi) AS aadt_combi,
    any(c.aadt_singl) AS aadt_singl,
    any(c.miles) AS length,
    any(c.road) AS roadname,
    any(c.tmclinear) AS tmclinear,
    any(c.road_order) AS road_order,
    any(c.county_code) AS county_code,
    any(c.direction) AS direction,
    any(c.region_code) AS region_code,
    any(c.wkb_geometry) AS wkb_geometry,
    any(m.total_road_miles) AS total_road_miles
FROM ${prodTable} AS a

-- Recurrent baseline: weekday avg per (tmc, epoch). P2: when a materialized
-- baseline table is supplied (created once per run via baselineCreateSQL),
-- join it directly instead of rescanning the whole year inline every month.
${baselineTable ? `INNER JOIN ${baselineTable} AS b
  ON a.tmc = b.tmc AND a.epoch = b.epoch` : `INNER JOIN (
    SELECT
        toYear(date) AS year,
        tmc,
        epoch,
        AVG(travel_time_all_vehicles) AS avg_tt
    FROM ${prodTable}
    WHERE toDayOfWeek(date) IN (1, 2, 3, 4, 5)
      AND epoch >= 0 AND epoch < 288 AND toYear(date) = ${Number(year)}
    GROUP BY toYear(date), tmc, epoch
) AS b
  ON a.tmc = b.tmc AND a.epoch = b.epoch`}

-- Metadata table with normalized AADT
INNER JOIN (
    SELECT
        tmc,
        miles,
        road,
        tmclinear,
        road_order,
        county_code,
        direction,
        wkb_geometry,
        aadt_combi,
        aadt_singl,
        avg_speedlimit,
        f_system,
        faciltype,
        region_code,
        congestion_level,
        directionality,
        COALESCE(aadt, 0) / LEAST(COALESCE(faciltype, 2), 2) AS aadt, -- normalized AADT
        COALESCE(aadt, 0) AS aadt_unnorm, -- raw undirected AADT (VOT_eff needs raw, to match aadt_singl/combi)
        (miles / GREATEST(20, COALESCE(avg_speedlimit, 0) * 0.6)) * 3600 AS threshold_tt,
        concat('WEEKEND_', IF(COALESCE(f_system, 3) < 3, 'FREEWAY', 'NONFREEWAY')) AS weekend_dist,
        concat(
            'WEEKDAY_',
            COALESCE(congestion_level, 'NO2LOW_CONGESTION'),
            '_',
            COALESCE(directionality, 'EVEN_DIST'),
            '_',
            IF(COALESCE(f_system, 3) < 3, 'FREEWAY', 'NONFREEWAY')
        ) AS weekday_dist

    FROM ${metaTable}
    WHERE aadt IS NOT NULL AND year = ${Number(year)}${regionClause}
) AS c
  ON a.tmc = c.tmc

-- Road total miles lookup
LEFT JOIN county_road_dir_miles AS m
    ON c.road = m.road AND c.county_code = m.county_code AND c.direction = m.direction

-- Distribution mapping
INNER JOIN ${distributionsTable} AS d
    ON d.key = IF(toDayOfWeek(a.date) IN (6, 7), c.weekend_dist, c.weekday_dist)

WHERE a.date >= '${startDate}' AND a.date <= '${endDate}'

GROUP BY a.tmc, toYear(a.date), toMonth(a.date)`;
}

// ── PG transcom congestion blobs (one month) ─────────────────────────────────

function transcomDelayQuery({ transcomTable, year, month }) {
  const y = Number(year);
  const m = Number(month);
  const pad = (n) => String(n).padStart(2, '0');
  const monthStart = `${y}-${pad(m)}-01`;
  const nextStart = m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`;
  // P4: half-open range on start_date_time (sargable — EXTRACT() defeats indexes).
  return `
SELECT
  CASE
    WHEN nysdot_general_category = 'Other' THEN 'other'
    WHEN nysdot_general_category = 'Construction' THEN 'construction'
    WHEN nysdot_general_category = 'Incident' THEN 'accident'
    ELSE NULL
  END AS event_category,
  congestion_data->'tmcDelayData' AS delay_data
FROM ${transcomTable}
WHERE start_date_time >= '${monthStart}'
  AND start_date_time < '${nextStart}'
  AND congestion_data IS NOT NULL
  AND congestion_data->'tmcDelayData' IS NOT NULL
  AND nysdot_general_category IN ('Other', 'Construction', 'Incident')`;
}

// ── insert computed rows ─────────────────────────────────────────────────────

const INSERT_COLUMNS = [
  'tmc', 'year', 'month', 'region_code', 'total', 'f_system', 'non_recurrent',
  'vot_eff', 'cost', 'aadt', 'aadt_combi', 'aadt_singl', 'length', 'roadname',
  'tmclinear', 'road_order', 'county_code', 'direction', 'wkb_geometry', 'road_information',
];

// rows: cleaned records from delay.js#normalizeDelayRow.
// CH meta wkb_geometry strings vary by vintage: GeoJSON (2018-2025 era),
// WKB hex (2026+), WKT (raw-pipeline temp tables). Sniff and emit the right
// PostGIS constructor; anything unrecognizable becomes NULL instead of a
// PostGIS parse error (2026-06-10: ED April failed on "unknown GeoJSON type").
function pgGeometryLiteral(value) {
  if (value == null) return 'NULL';
  const v = typeof value === 'object' ? JSON.stringify(value) : String(value);
  const t = v.trim();
  if (!t) return 'NULL';
  if (t.startsWith('{')) return `ST_SetSRID(ST_GeomFromGeoJSON(${escapeLiteral(t)}), 4326)`;
  if (/^[0-9A-Fa-f]+$/.test(t) && (t.startsWith('00') || t.startsWith('01'))) {
    return `ST_SetSRID(${escapeLiteral(t)}::geometry, 4326)`;
  }
  if (/^(MULTI)?(LINESTRING|POLYGON|POINT)/i.test(t)) {
    return `ST_SetSRID(ST_GeomFromText(${escapeLiteral(t)}), 4326)`;
  }
  return 'NULL';
}

function insertRowsSQL({ table, rows, dialect, upsert = false }) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('rows must be a non-empty array');
  const pg = dialect === 'postgres';
  const tuples = rows.map((r) => {
    const geom = pg ? pgGeometryLiteral(r.wkb_geometry) : escapeLiteral(
      r.wkb_geometry && typeof r.wkb_geometry === 'object' ? JSON.stringify(r.wkb_geometry) : r.wkb_geometry
    );
    const vals = INSERT_COLUMNS.map((c) => (c === 'wkb_geometry' ? geom : escapeLiteral(r[c])));
    return `(${vals.join(', ')})`;
  });
  const conflict = upsert
    ? `\nON CONFLICT (tmc, year, month) DO UPDATE SET\n${INSERT_COLUMNS
      .filter((c) => !['tmc', 'year', 'month'].includes(c))
      .map((c) => `  ${c} = EXCLUDED.${c}`)
      .join(',\n')}`
    : '';
  return `INSERT INTO ${table}\n  (${INSERT_COLUMNS.join(', ')})\nVALUES\n${tuples.join(',\n')}${conflict}`;
}

// ── transcom attribution update (pg + sqlite portable UPDATE ... FROM) ───────

// rows: tuples from delay.js#attributionRows — [year, month, tmc, c, a, o].
function attributionUpdateSQL({ table, rows }) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('rows must be a non-empty array');
  const cols = ['year', 'month', 'tmc', 'construction', 'accident', 'other'];
  const selects = rows.map(([year, month, tmc, construction, accident, other], i) => {
    const vals = [year, month, tmc, construction, accident, other].map(escapeLiteral);
    return i === 0
      ? `SELECT ${vals.map((v, j) => `${v} AS ${cols[j]}`).join(', ')}`
      : `UNION ALL SELECT ${vals.join(', ')}`;
  });
  return `
UPDATE ${table}
SET construction = v.construction,
    accident = v.accident,
    other = v.other
FROM (
  ${selects.join('\n  ')}
) AS v
WHERE ${table}.year = v.year AND ${table}.month = v.month AND ${table}.tmc = v.tmc`;
}

// ── region names ─────────────────────────────────────────────────────────────

function regionNameUpdateSQL({ table, regionNamesTable, year, month, dialect }) {
  const cast = dialect === 'postgres' ? '::text' : '';
  return `
UPDATE ${table} AS t
SET region_name = n.name
FROM ${regionNamesTable} AS n
WHERE t.region_code${cast} = n.region${cast}
  AND t.region_code IS NOT NULL AND t.year = ${Number(year)} AND t.month = ${Number(month)}`;
}

// ── delete / introspection ───────────────────────────────────────────────────

function deleteMonthSQL({ table, year, month }) {
  return `DELETE FROM ${table} WHERE year = ${Number(year)} AND month = ${Number(month)}`;
}

// The /remove contract: delete whole years, never TRUNCATE (the legacy remove
// handler truncated the entire table after its ranged delete — a bug, dropped).
function deleteYearsSQL({ table, years }) {
  const ys = assertIntegers(years, 'years');
  return `DELETE FROM ${table} WHERE year IN (${ys.join(', ')})`;
}

function distinctPeriodsSQL(table) {
  return `SELECT DISTINCT year, month FROM ${table} ORDER BY year, month`;
}

module.exports = {
  sanitize,
  viewTableName,
  escapeLiteral,
  outputTableDDL,
  baselineTableName,
  baselineCreateSQL,
  baselineDropSQL,
  monthDelayQuery,
  transcomDelayQuery,
  INSERT_COLUMNS,
  insertRowsSQL,
  pgGeometryLiteral,
  attributionUpdateSQL,
  regionNameUpdateSQL,
  deleteMonthSQL,
  deleteYearsSQL,
  distinctPeriodsSQL,
};
