/**
 * work_zone SQL — shared pieces every stage needs.
 *
 * Per-table DDLs, insert builders and metadata.columns descriptors are added
 * here as each phase lands (see README). What lives here at phase 0 is what
 * all of them share: the output schema, the literal escaper the builders use,
 * and the two rules that bite DAMA outputs.
 *
 * Pure module: builds strings, runs nothing.
 */

/** Every physical table this plugin writes lives here. */
const WORK_ZONE_SCHEMA = 'work_zone';

/**
 * Escape a JS value into a SQL literal. Same helper as transcom/sql.js —
 * copied rather than shared, because these plugins are self-contained and a
 * cross-plugin require is a dependency the bootstrap does not need.
 */
function sqlLiteral(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (v instanceof Date) return `'${v.toISOString()}'`;
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

/** Physical table name for a (source, view) pair — the DAMA convention. */
function tableNameFor({ source_id, view_id, stage }) {
  return String(`s${source_id}_v${view_id}_${stage}`).replace(/[\s\W]+/g, '_').toLowerCase();
}

/**
 * The DAMA `version` label for a run's window — the vintage convention.
 *
 * A source is the unit of schema and a view is the unit of vintage, so every
 * work_zone stage publishes one view per calendar year and labels it here. A
 * window that stops short of 31 December says so in the label, because a
 * partial year silently compared against full ones is how the phase-1 report's
 * seasonality got contaminated: a `vintage <> 'CY2026'` filter did not match
 * `'CY2026 (partial to 2026-08-31)'`, and the incomplete year was averaged in.
 * Making the partiality part of the label is what makes that filterable at all.
 */
function vintageVersion({ startDate, endDate }) {
  const year = String(startDate).slice(0, 4);
  const end = String(endDate).slice(0, 10);
  return end < `${year}-12-31` ? `CY${year} (partial to ${end})` : `CY${year}`;
}

/**
 * The two DDL rules every work_zone table follows, applied by each phase's DDL:
 *
 *  1. `ogc_fid SERIAL PRIMARY KEY` — DAMA tiles carry ONLY ogc_fid, so a table
 *     without it can never back a map layer. (And fid 0 breaks one popup, so
 *     SERIAL starting at 1 is not an accident.)
 *  2. Geometry columns must carry SRID 4326 in the VALUES, not just in the
 *     typmod: a `geometry(MultiLineString,4326)` column holding SRID-0 values
 *     silently produces empty tiles. Always wrap inserts in ST_SetSRID(...,4326).
 */
const DDL_RULES = Object.freeze({
  pkColumn: 'ogc_fid SERIAL PRIMARY KEY',
  srid: 4326,
});

/** `CREATE SCHEMA IF NOT EXISTS work_zone;` — prefixed to each phase's DDL. */
function createSchemaSQL(schema = WORK_ZONE_SCHEMA) {
  return `CREATE SCHEMA IF NOT EXISTS ${schema};`;
}

/**
 * Delete one window from a table before re-inserting it.
 *
 * Every stage is idempotent and windowed: re-running a month must REPLACE that
 * month, not append it. Each phase's worker calls this with the date column
 * that defines its grain, inside the same transaction as its insert.
 */
function deleteWindowSQL({ schema = WORK_ZONE_SCHEMA, table, dateColumn, startDate, endDate }) {
  if (!table || !dateColumn) throw new Error('deleteWindowSQL: table and dateColumn are required');
  if (!startDate || !endDate) throw new Error('deleteWindowSQL: startDate and endDate are required');
  // `<= endDate::date` is midnight ON the end day, so anything later that day
  // survives a delete and is missed by a read — 50 of CY2024's 42,688 zones
  // start after midnight on 31 December. Always half-open to end + 1 day.
  return `DELETE FROM ${schema}.${table}
 WHERE ${dateColumn} >= ${sqlLiteral(startDate)}::date
   AND ${dateColumn} < (${sqlLiteral(endDate)}::date + INTERVAL '1 day');`;
}


// ── phase 1: the work-zone spine ────────────────────────────────────────────

/**
 * `wz_event` — one row per deduped work zone.
 *
 * Notes on two column choices:
 *  - `member_event_ids` is space-separated TEXT, not TEXT[]: DMS surfaces read
 *    these values into filter chips and falcor path keys, where a comma is
 *    hostile, and an array renders poorly in the Table page. The audit trail is
 *    still complete.
 *  - `lanes_affected` is NULL when no member reported a count (60% of events),
 *    and `lanes_affected_known` says which. Treating unknown as zero would
 *    quietly shrink the lane-closure population.
 */
function wzEventTableDDL(schema, table) {
  return `
CREATE SCHEMA IF NOT EXISTS ${schema};
CREATE TABLE IF NOT EXISTS ${schema}.${table} (
    ogc_fid SERIAL PRIMARY KEY,
    wz_event_id TEXT UNIQUE NOT NULL,
    member_event_ids TEXT,
    n_occurrences INTEGER,
    chain_key TEXT,
    facility TEXT,
    direction TEXT,
    county_name TEXT,
    region_name TEXT,
    description TEXT,
    work_activity_class TEXT,
    is_utility_or_permit BOOLEAN,
    first_start TIMESTAMP,
    last_end TIMESTAMP,
    active_days INTEGER,
    active_hours DOUBLE PRECISION,
    lanes_total SMALLINT,
    lanes_affected SMALLINT,
    lanes_affected_known BOOLEAN,
    consecutive_closure_days INTEGER,
    consecutive_active_days INTEGER,
    anchor_tmc TEXT,
    extent_source TEXT,
    extent_confidence TEXT,
    n_tmcs_anchor INTEGER,
    n_tmcs_impact INTEGER,
    impact_extent_implausible BOOLEAN,
    length_mi DOUBLE PRECISION,
    ua_code INTEGER,
    is_interstate BOOLEAN,
    f_system_says_interstate BOOLEAN,
    interstate_signals_disagree BOOLEAN,
    in_tma BOOLEAN,
    tma_name TEXT,
    tma_basis TEXT,
    meets_closure_duration BOOLEAN,
    meets_activity_duration BOOLEAN,
    is_significant_candidate BOOLEAN,
    is_significant_candidate_any_activity BOOLEAN,
    wkb_geometry public.geometry(Geometry, 4326)
);
CREATE INDEX IF NOT EXISTS ${table}_first_start_idx ON ${schema}.${table} (first_start);
CREATE INDEX IF NOT EXISTS ${table}_significant_idx ON ${schema}.${table} (is_significant_candidate);
CREATE INDEX IF NOT EXISTS ${table}_gix ON ${schema}.${table} USING gist (wkb_geometry);`;
}

/**
 * `wz_event_tmc` — one row per work zone × TMC, with the role that keeps the
 * work extent and the congestion-derived impact extent apart. Conflating them
 * would inflate phase 2's lane-mile-hours by the length of the queue.
 */
function wzEventTmcTableDDL(schema, table) {
  return `
CREATE SCHEMA IF NOT EXISTS ${schema};
CREATE TABLE IF NOT EXISTS ${schema}.${table} (
    ogc_fid SERIAL PRIMARY KEY,
    wz_event_id TEXT NOT NULL,
    tmc TEXT NOT NULL,
    tmc_role TEXT NOT NULL,
    first_start TIMESTAMP,
    last_end TIMESTAMP,
    length DOUBLE PRECISION,
    aadt INTEGER,
    f_system SMALLINT,
    tmclinear BIGINT,
    road_order INTEGER,
    road_name TEXT,
    linear_key TEXT,
    has_meta BOOLEAN,
    wkb_geometry public.geometry(Geometry, 4326),
    UNIQUE (wz_event_id, tmc, tmc_role)
);
CREATE INDEX IF NOT EXISTS ${table}_event_idx ON ${schema}.${table} (wz_event_id);
CREATE INDEX IF NOT EXISTS ${table}_tmc_idx ON ${schema}.${table} (tmc);
CREATE INDEX IF NOT EXISTS ${table}_gix ON ${schema}.${table} USING gist (wkb_geometry);`;
}

/** Insert column order for wz_event. */
const WZ_EVENT_COLUMNS = [
  'wz_event_id', 'member_event_ids', 'n_occurrences', 'chain_key', 'facility', 'direction',
  'county_name', 'region_name', 'description', 'work_activity_class', 'is_utility_or_permit',
  'first_start', 'last_end', 'active_days', 'active_hours', 'lanes_total', 'lanes_affected',
  'lanes_affected_known', 'consecutive_closure_days', 'consecutive_active_days', 'anchor_tmc',
  'extent_source', 'extent_confidence', 'n_tmcs_anchor', 'n_tmcs_impact',
  'impact_extent_implausible', 'length_mi', 'ua_code', 'is_interstate',
  'f_system_says_interstate', 'interstate_signals_disagree', 'in_tma', 'tma_name', 'tma_basis',
  'meets_closure_duration', 'meets_activity_duration', 'is_significant_candidate',
  'is_significant_candidate_any_activity',
];

/**
 * Insert column order for wz_event_tmc, with the cast each column needs when
 * read back out of a `(VALUES ...)` subquery — every column of one of those is
 * typed `text`, so an uncast `first_start` fails with "column is of type
 * timestamp but expression is of type text".
 */
const WZ_EVENT_TMC_COLUMN_TYPES = [
  ['wz_event_id', 'text'], ['tmc', 'text'], ['tmc_role', 'text'],
  ['first_start', 'timestamp'], ['last_end', 'timestamp'],
  ['length', 'double precision'], ['aadt', 'integer'], ['f_system', 'smallint'],
  ['tmclinear', 'bigint'], ['road_order', 'integer'], ['road_name', 'text'],
  ['linear_key', 'text'], ['has_meta', 'boolean'],
];
const WZ_EVENT_TMC_COLUMNS = WZ_EVENT_TMC_COLUMN_TYPES.map(([c]) => c);

/** Batch insert for wz_event. Idempotent on wz_event_id. */
function wzEventInsertSQL({ schema = WORK_ZONE_SCHEMA, table, rows }) {
  if (!rows.length) return null;
  const values = rows
    .map((r) => `(${WZ_EVENT_COLUMNS.map((c) => sqlLiteral(r[c])).join(', ')})`)
    .join(',\n');
  const updates = WZ_EVENT_COLUMNS.filter((c) => c !== 'wz_event_id')
    .map((c) => `${c} = EXCLUDED.${c}`).join(', ');
  return `INSERT INTO ${schema}.${table} (${WZ_EVENT_COLUMNS.join(', ')})
VALUES ${values}
ON CONFLICT (wz_event_id) DO UPDATE SET ${updates};`;
}

/**
 * Batch insert for wz_event_tmc, taking geometry from the npmrds meta table so
 * the values carry SRID 4326 — a geometry(...,4326) column holding SRID-0
 * values yields silently empty tiles.
 *
 * The meta view is one row per (tmc, year) — up to 9 rows per TMC — so the join
 * MUST reduce to one row per TMC or the insert fails with "ON CONFLICT DO UPDATE
 * command cannot affect row a second time". `metaYear` picks the newest vintage
 * at or before the window's year, which is also the right AADT for the window.
 */
function wzEventTmcInsertSQL({ schema = WORK_ZONE_SCHEMA, table, rows, metaTable, metaYear, geomTable }) {
  if (!rows.length) return null;
  const values = rows
    .map((r) => `(${WZ_EVENT_TMC_COLUMNS.map((c) => sqlLiteral(r[c])).join(', ')})`)
    .join(',\n');
  const updates = WZ_EVENT_TMC_COLUMNS.filter((c) => !['wz_event_id', 'tmc', 'tmc_role'].includes(c))
    .map((c) => `${c} = EXCLUDED.${c}`).join(', ');
  const selectList = WZ_EVENT_TMC_COLUMN_TYPES
    .map(([c, t]) => (t === 'text' ? `v.${c}` : `v.${c}::${t}`)).join(', ');
  return `INSERT INTO ${schema}.${table} (${WZ_EVENT_TMC_COLUMNS.join(', ')}, wkb_geometry)
SELECT ${selectList}, ST_SetSRID(m.wkb_geometry, 4326)
  FROM (VALUES ${values}) AS v(${WZ_EVENT_TMC_COLUMNS.join(', ')})
  LEFT JOIN ${geomTable || `(
        SELECT DISTINCT ON (tmc) tmc, wkb_geometry
          FROM ${metaTable}${metaYear ? ` WHERE year <= ${Number(metaYear)}` : ''}
         ORDER BY tmc, year DESC
       )`} m ON m.tmc = v.tmc
ON CONFLICT (wz_event_id, tmc, tmc_role) DO UPDATE SET ${updates}, wkb_geometry = EXCLUDED.wkb_geometry;`;
}

/**
 * A one-row-per-TMC geometry lookup for the window, materialised once.
 *
 * The meta view is one row per (tmc, year); putting its `DISTINCT ON` inside
 * the insert makes every chunk re-scan it (~1.2s per 500 rows, and a year's
 * spine is thousands of chunks). Restricted to the TMCs actually referenced,
 * this is a few thousand rows and the joins become index lookups.
 */
function metaGeomTempTableSQL({ metaTable, metaYear, tempTable = '_wz_meta_geom' }) {
  return `
DROP TABLE IF EXISTS ${tempTable};
CREATE TEMP TABLE ${tempTable} AS
SELECT DISTINCT ON (tmc) tmc, wkb_geometry
  FROM ${metaTable}${metaYear ? ` WHERE year <= ${Number(metaYear)}` : ''}
 ORDER BY tmc, year DESC;
CREATE INDEX ON ${tempTable} (tmc);
ANALYZE ${tempTable};`;
}

/**
 * Give each work zone the geometry of its anchor TMC.
 *
 * The work extent is the anchor, so that is what the wz_event geometry shows —
 * not the congestion-impact corridor, which would draw the queue as if it were
 * the work. Run after the wz_event_tmc insert, which is where the SRID-4326
 * geometry already landed.
 */
function wzEventGeometryUpdateSQL({ schema = WORK_ZONE_SCHEMA, eventTable, tmcTable, startDate, endDate }) {
  return `
UPDATE ${schema}.${eventTable} e
   SET wkb_geometry = t.wkb_geometry
  FROM ${schema}.${tmcTable} t
 WHERE t.wz_event_id = e.wz_event_id
   AND t.tmc_role = 'anchor'
   AND t.wkb_geometry IS NOT NULL
   AND e.first_start >= ${sqlLiteral(startDate)}::date
   AND e.first_start <= ${sqlLiteral(endDate)}::date;`;
}

/** metadata.columns for the wz_event source — the Table-page contract. */
const WZ_EVENT_TABLE_COLUMNS = [
  { name: 'wz_event_id', display_name: 'Work Zone ID', type: 'TEXT', desc: 'The earliest member TRANSCOM event id' },
  { name: 'member_event_ids', display_name: 'Member Event IDs', type: 'TEXT', desc: 'Space-separated TRANSCOM event ids collapsed into this work zone' },
  { name: 'n_occurrences', display_name: 'Occurrences', type: 'INTEGER', desc: 'TRANSCOM events in the chain' },
  { name: 'facility', display_name: 'Facility', type: 'TEXT', desc: null },
  { name: 'direction', display_name: 'Direction', type: 'TEXT', desc: null },
  { name: 'county_name', display_name: 'County', type: 'TEXT', desc: null },
  { name: 'region_name', display_name: 'NYSDOT Region', type: 'TEXT', desc: null },
  { name: 'description', display_name: 'Description', type: 'TEXT', desc: null },
  { name: 'work_activity_class', display_name: 'Work Activity', type: 'TEXT', desc: 'construction | maintenance | utility' },
  { name: 'is_utility_or_permit', display_name: 'Utility/Permit', type: 'BOOLEAN', desc: null },
  { name: 'first_start', display_name: 'First Start', type: 'TIMESTAMP', desc: null },
  { name: 'last_end', display_name: 'Last End', type: 'TIMESTAMP', desc: null },
  { name: 'active_days', display_name: 'Active Days', type: 'INTEGER', desc: 'Distinct calendar days with an occurrence' },
  { name: 'active_hours', display_name: 'Active Hours', type: 'DOUBLE PRECISION', desc: 'Sum of member estimated durations' },
  { name: 'lanes_total', display_name: 'Lanes (total)', type: 'SMALLINT', desc: null },
  { name: 'lanes_affected', display_name: 'Lanes Affected', type: 'SMALLINT', desc: 'NULL when no member reported a count' },
  { name: 'lanes_affected_known', display_name: 'Lane Count Known', type: 'BOOLEAN', desc: 'Only ~40% of TRANSCOM events report a lane count' },
  { name: 'consecutive_closure_days', display_name: 'Consecutive Closure Days', type: 'INTEGER', desc: 'Longest run of consecutive days with a reported lane closure' },
  { name: 'consecutive_active_days', display_name: 'Consecutive Active Days', type: 'INTEGER', desc: 'Longest run of consecutive active days, closure reported or not' },
  { name: 'anchor_tmc', display_name: 'Anchor TMC', type: 'TEXT', desc: 'The tmclist TMC — where the work is' },
  { name: 'extent_source', display_name: 'Extent Source', type: 'TEXT', desc: 'anchor+impact | anchor | impact | none' },
  { name: 'extent_confidence', display_name: 'Extent Confidence', type: 'TEXT', desc: 'high | medium | low | none' },
  { name: 'n_tmcs_anchor', display_name: 'Anchor TMCs', type: 'INTEGER', desc: null },
  { name: 'n_tmcs_impact', display_name: 'Impact TMCs', type: 'INTEGER', desc: 'Congestion-derived TMCs downstream of the work' },
  { name: 'impact_extent_implausible', display_name: 'Impact Extent Implausible', type: 'BOOLEAN', desc: 'Impact set longer than 50 TMCs — a corridor-wide attribution' },
  { name: 'length_mi', display_name: 'Work Extent (mi)', type: 'DOUBLE PRECISION', desc: 'Anchor TMC length' },
  { name: 'ua_code', display_name: 'Urbanized Area Code', type: 'INTEGER', desc: null },
  { name: 'is_interstate', display_name: 'Interstate', type: 'BOOLEAN', desc: 'From the facility name, not f_system' },
  { name: 'f_system_says_interstate', display_name: 'F-System says Interstate', type: 'BOOLEAN', desc: null },
  { name: 'interstate_signals_disagree', display_name: 'Interstate Signals Disagree', type: 'BOOLEAN', desc: null },
  { name: 'in_tma', display_name: 'In TMA', type: 'BOOLEAN', desc: null },
  { name: 'tma_name', display_name: 'TMA', type: 'TEXT', desc: null },
  { name: 'tma_basis', display_name: 'TMA Basis', type: 'TEXT', desc: 'ua_code | county_approx | none' },
  { name: 'meets_closure_duration', display_name: 'Meets closure duration', type: 'BOOLEAN', desc: '>= 3 consecutive days with a reported lane closure — the component of the significance rule that the lane-count reporting gap suppresses' },
  { name: 'meets_activity_duration', display_name: 'Meets activity duration', type: 'BOOLEAN', desc: '>= 3 consecutive ACTIVE days, whether or not a closure was reported — the upper-bound variant' },
  { name: 'is_significant_candidate', display_name: 'Significant Candidate', type: 'BOOLEAN', desc: 'Interstate AND TMA AND >= 3 consecutive closure days' },
  { name: 'is_significant_candidate_any_activity', display_name: 'Significant (any activity)', type: 'BOOLEAN', desc: 'Same rule with duration measured on active days — an upper bound given the lane-count gap' },
  { name: 'chain_key', display_name: 'Chain key', type: 'TEXT', desc: 'What the dedupe grouped on: activity class + facility + direction + county + normalised description. Two zones sharing a key on non-adjacent dates were split by the 14-day gap rule.' },
];

/** metadata.columns for the wz_event_tmc source. */
const WZ_EVENT_TMC_TABLE_COLUMNS = [
  { name: 'wz_event_id', display_name: 'Work Zone ID', type: 'TEXT', desc: null },
  { name: 'tmc', display_name: 'TMC', type: 'TEXT', desc: null },
  { name: 'tmc_role', display_name: 'Role', type: 'TEXT', desc: 'anchor = where the work is; impact = congestion-derived' },
  { name: 'first_start', display_name: 'First Start', type: 'TIMESTAMP', desc: null },
  { name: 'last_end', display_name: 'Last End', type: 'TIMESTAMP', desc: null },
  { name: 'length', display_name: 'Length (mi)', type: 'DOUBLE PRECISION', desc: null },
  { name: 'aadt', display_name: 'AADT', type: 'INTEGER', desc: null },
  { name: 'f_system', display_name: 'F-System', type: 'SMALLINT', desc: null },
  { name: 'tmclinear', display_name: 'TMC Linear', type: 'BIGINT', desc: 'Unique only within an NPMRDS region' },
  { name: 'road_order', display_name: 'Road Order', type: 'INTEGER', desc: null },
  { name: 'road_name', display_name: 'Road Name', type: 'TEXT', desc: null },
  { name: 'linear_key', display_name: 'Linear Key', type: 'TEXT', desc: 'region:tmclinear — collision-safe corridor key' },
  { name: 'has_meta', display_name: 'Has Meta', type: 'BOOLEAN', desc: null },
];


// ── phase 2: exposure (E1–E3) ───────────────────────────────────────────────

/**
 * `wz_exposure` — one row per work zone, the denominators every rate needs.
 *
 * Carries both the capped and the nominal-shift variants of every
 * duration-dependent figure, plus the completeness flags: an exposure row is
 * only as good as its inputs (AADT is on 79.6% of CY2024 zones, a lane count
 * on 60%), and a consumer must be able to filter on that rather than reading a
 * null as a zero.
 */
function wzExposureTableDDL(schema, table) {
  return `
CREATE SCHEMA IF NOT EXISTS ${schema};
CREATE TABLE IF NOT EXISTS ${schema}.${table} (
    ogc_fid SERIAL PRIMARY KEY,
    wz_event_id TEXT UNIQUE NOT NULL,
    first_start TIMESTAMP,
    last_end TIMESTAMP,
    region_name TEXT,
    county_name TEXT,
    facility TEXT,
    work_activity_class TEXT,
    is_interstate BOOLEAN,
    in_tma BOOLEAN,
    is_significant_candidate BOOLEAN,
    n_occurrences INTEGER,
    active_days INTEGER,
    -- E1
    lane_closure_count SMALLINT,
    lanes_affected SMALLINT,
    lane_count_known BOOLEAN,
    -- E2
    lane_mile_hours DOUBLE PRECISION,
    lane_mile_hours_nominal DOUBLE PRECISION,
    -- E3
    veh_through_wz DOUBLE PRECISION,
    vmt_through_wz DOUBLE PRECISION,
    -- the extent and duration that produced them
    n_anchor_tmcs INTEGER,
    length_mi DOUBLE PRECISION,
    active_hours_used DOUBLE PRECISION,
    active_hours_nominal DOUBLE PRECISION,
    duration_basis TEXT,
    capped_occurrences INTEGER,
    hours_per_active_day DOUBLE PRECISION,
    profile_name TEXT,
    aadt_source TEXT,
    -- completeness
    n_tmcs_with_aadt INTEGER,
    n_tmcs_with_length INTEGER,
    exposure_complete BOOLEAN,
    wkb_geometry public.geometry(Geometry, 4326)
);
CREATE INDEX IF NOT EXISTS ${table}_first_start_idx ON ${schema}.${table} (first_start);
CREATE INDEX IF NOT EXISTS ${table}_complete_idx ON ${schema}.${table} (exposure_complete);
CREATE INDEX IF NOT EXISTS ${table}_gix ON ${schema}.${table} USING gist (wkb_geometry);`;
}

/** Insert column order for wz_exposure, with the cast each needs out of a VALUES subquery. */
const WZ_EXPOSURE_COLUMN_TYPES = [
  ['wz_event_id', 'text'], ['first_start', 'timestamp'], ['last_end', 'timestamp'],
  ['region_name', 'text'], ['county_name', 'text'], ['facility', 'text'],
  ['work_activity_class', 'text'], ['is_interstate', 'boolean'], ['in_tma', 'boolean'],
  ['is_significant_candidate', 'boolean'], ['n_occurrences', 'integer'], ['active_days', 'integer'],
  ['lane_closure_count', 'smallint'], ['lanes_affected', 'smallint'], ['lane_count_known', 'boolean'],
  ['lane_mile_hours', 'double precision'], ['lane_mile_hours_nominal', 'double precision'],
  ['veh_through_wz', 'double precision'], ['vmt_through_wz', 'double precision'],
  ['n_anchor_tmcs', 'integer'], ['length_mi', 'double precision'],
  ['active_hours_used', 'double precision'], ['active_hours_nominal', 'double precision'],
  ['duration_basis', 'text'], ['capped_occurrences', 'integer'],
  ['hours_per_active_day', 'double precision'], ['profile_name', 'text'], ['aadt_source', 'text'],
  ['n_tmcs_with_aadt', 'integer'], ['n_tmcs_with_length', 'integer'], ['exposure_complete', 'boolean'],
];
const WZ_EXPOSURE_COLUMNS = WZ_EXPOSURE_COLUMN_TYPES.map(([c]) => c);

/**
 * Batch insert for wz_exposure, taking each zone's geometry from the spine so
 * the exposure layer is mappable without recomputing it. `eventTable` is the
 * wz_event table the rows came from.
 */
function wzExposureInsertSQL({ schema = WORK_ZONE_SCHEMA, table, rows, eventTable }) {
  if (!rows.length) return null;
  const values = rows
    .map((r) => `(${WZ_EXPOSURE_COLUMNS.map((c) => sqlLiteral(r[c])).join(', ')})`)
    .join(',\n');
  const selectList = WZ_EXPOSURE_COLUMN_TYPES
    .map(([c, t]) => (t === 'text' ? `v.${c}` : `v.${c}::${t}`)).join(', ');
  const updates = WZ_EXPOSURE_COLUMNS.filter((c) => c !== 'wz_event_id')
    .map((c) => `${c} = EXCLUDED.${c}`).join(', ');
  return `INSERT INTO ${schema}.${table} (${WZ_EXPOSURE_COLUMNS.join(', ')}, wkb_geometry)
SELECT ${selectList}, e.wkb_geometry
  FROM (VALUES ${values}) AS v(${WZ_EXPOSURE_COLUMNS.join(', ')})
  LEFT JOIN ${schema}.${eventTable} e ON e.wz_event_id = v.wz_event_id
ON CONFLICT (wz_event_id) DO UPDATE SET ${updates}, wkb_geometry = EXCLUDED.wkb_geometry;`;
}

/** metadata.columns for the wz_exposure source. */
const WZ_EXPOSURE_TABLE_COLUMNS = [
  { name: 'wz_event_id', display_name: 'Work Zone ID', type: 'TEXT', desc: 'Joins wz_event' },
  { name: 'first_start', display_name: 'First Start', type: 'TIMESTAMP', desc: null },
  { name: 'last_end', display_name: 'Last End', type: 'TIMESTAMP', desc: null },
  { name: 'region_name', display_name: 'NYSDOT Region', type: 'TEXT', desc: null },
  { name: 'county_name', display_name: 'County', type: 'TEXT', desc: null },
  { name: 'facility', display_name: 'Facility', type: 'TEXT', desc: null },
  { name: 'work_activity_class', display_name: 'Work Activity', type: 'TEXT', desc: null },
  { name: 'is_interstate', display_name: 'Interstate', type: 'BOOLEAN', desc: null },
  { name: 'in_tma', display_name: 'In TMA', type: 'BOOLEAN', desc: null },
  { name: 'is_significant_candidate', display_name: 'Significant Candidate', type: 'BOOLEAN', desc: null },
  { name: 'n_occurrences', display_name: 'Occurrences', type: 'INTEGER', desc: null },
  { name: 'active_days', display_name: 'Active Days', type: 'INTEGER', desc: null },
  { name: 'lane_closure_count', display_name: 'E1 · Lanes Closed', type: 'SMALLINT', desc: 'NULL when no occurrence reported a lane count' },
  { name: 'lanes_affected', display_name: 'Lanes Affected', type: 'SMALLINT', desc: null },
  { name: 'lane_count_known', display_name: 'Lane Count Known', type: 'BOOLEAN', desc: null },
  { name: 'lane_mile_hours', display_name: 'E2 · Lane-Mile-Hours', type: 'DOUBLE PRECISION', desc: 'lanes affected × work extent × active hours, on the run\'s duration basis' },
  { name: 'lane_mile_hours_nominal', display_name: 'E2 · Lane-Mile-Hours (nominal shift)', type: 'DOUBLE PRECISION', desc: 'The same with one 8-hour shift per active day — the duration-independent variant' },
  { name: 'veh_through_wz', display_name: 'E3 · Vehicles Through Zone', type: 'DOUBLE PRECISION', desc: 'AADT × month × day-of-week × hourly profile, over the active days and hours' },
  { name: 'vmt_through_wz', display_name: 'E3 · VMT Through Zone', type: 'DOUBLE PRECISION', desc: 'Vehicles × anchor TMC length' },
  { name: 'n_anchor_tmcs', display_name: 'Anchor TMCs', type: 'INTEGER', desc: 'Impact (congestion) TMCs are deliberately excluded from exposure' },
  { name: 'length_mi', display_name: 'Work Extent (mi)', type: 'DOUBLE PRECISION', desc: null },
  { name: 'active_hours_used', display_name: 'Active Hours Used', type: 'DOUBLE PRECISION', desc: null },
  { name: 'active_hours_nominal', display_name: 'Active Hours (nominal)', type: 'DOUBLE PRECISION', desc: null },
  { name: 'duration_basis', display_name: 'Duration Basis', type: 'TEXT', desc: 'reported_capped | reported | nominal_shift' },
  { name: 'capped_occurrences', display_name: 'Capped Occurrences', type: 'INTEGER', desc: 'Occurrences whose reported duration exceeded the cap' },
  { name: 'hours_per_active_day', display_name: 'Hours / Active Day', type: 'DOUBLE PRECISION', desc: null },
  { name: 'profile_name', display_name: 'Volume Profile', type: 'TEXT', desc: 'The MAP-21 traffic distribution profile used' },
  { name: 'aadt_source', display_name: 'AADT Source', type: 'TEXT', desc: 'unidirectional | mixed | bidirectional' },
  { name: 'n_tmcs_with_aadt', display_name: 'TMCs with AADT', type: 'INTEGER', desc: null },
  { name: 'n_tmcs_with_length', display_name: 'TMCs with Length', type: 'INTEGER', desc: null },
  { name: 'exposure_complete', display_name: 'Exposure Complete', type: 'BOOLEAN', desc: 'Both E2 and E3 computable — filter on this before aggregating' },
];


// ── phase 4: delay and M2 ───────────────────────────────────────────────────

/**
 * `wz_delay` — one row per work zone, the `wz_exposure` shape.
 *
 * Vehicle-hours of delay attributed to the zone by TRANSCOM's event-to-TMC
 * conflation, plus delay per vehicle using phase 2's vehicle count.
 *
 * The `delay_anchor` / `delay_impact` split is on the row on purpose: M2 sums
 * ALL TMC roles, which is the inverse of phases 2 and 3, and 91% of the total
 * falls on the impact segments. Keeping the split visible is what stops the
 * rule from becoming folklore. See lib/delay.js.
 */
function wzDelayTableDDL(schema, table) {
  return `
CREATE SCHEMA IF NOT EXISTS ${schema};
CREATE TABLE IF NOT EXISTS ${schema}.${table} (
    ogc_fid SERIAL PRIMARY KEY,
    wz_event_id TEXT UNIQUE NOT NULL,
    first_start TIMESTAMP,
    last_end TIMESTAMP,
    region_name TEXT,
    county_name TEXT,
    facility TEXT,
    work_activity_class TEXT,
    is_interstate BOOLEAN,
    in_tma BOOLEAN,
    is_significant_candidate BOOLEAN,
    -- M2
    delay_vehicle_hours DOUBLE PRECISION,
    raw_delay_vehicle_hours DOUBLE PRECISION,
    delay_anchor DOUBLE PRECISION,
    delay_impact DOUBLE PRECISION,
    delay_impact_share DOUBLE PRECISION,
    delay_per_vehicle_min DOUBLE PRECISION,
    exceeds_delay_per_vehicle BOOLEAN,
    -- the exposure denominator, carried so the rate is reproducible on the row
    veh_through_wz DOUBLE PRECISION,
    -- extent and completeness
    n_delay_rows INTEGER,
    n_delay_tmcs INTEGER,
    n_delay_tmcs_anchor INTEGER,
    rows_delay_missing INTEGER,
    rows_raw_delay_missing INTEGER,
    delay_complete BOOLEAN,
    -- FALSE where the zone has no 2799 conflation at all, so its delay is
    -- UNKNOWN rather than zero. 17,616 of CY2024's 42,688 zones. Filter on it
    -- before averaging anything.
    delay_measured BOOLEAN,
    delay_per_veh_min_threshold DOUBLE PRECISION,
    wkb_geometry public.geometry(Geometry, 4326)
);
CREATE INDEX IF NOT EXISTS ${table}_first_start_idx ON ${schema}.${table} (first_start);
CREATE INDEX IF NOT EXISTS ${table}_delay_idx ON ${schema}.${table} (delay_vehicle_hours);
CREATE INDEX IF NOT EXISTS ${table}_signif_idx ON ${schema}.${table} (is_significant_candidate);
CREATE INDEX IF NOT EXISTS ${table}_gix ON ${schema}.${table} USING gist (wkb_geometry);`;
}

/** Insert column order for wz_delay, with the cast each needs out of a VALUES subquery. */
const WZ_DELAY_COLUMN_TYPES = [
  ['wz_event_id', 'text'], ['first_start', 'timestamp'], ['last_end', 'timestamp'],
  ['region_name', 'text'], ['county_name', 'text'], ['facility', 'text'],
  ['work_activity_class', 'text'], ['is_interstate', 'boolean'], ['in_tma', 'boolean'],
  ['is_significant_candidate', 'boolean'],
  ['delay_vehicle_hours', 'double precision'], ['raw_delay_vehicle_hours', 'double precision'],
  ['delay_anchor', 'double precision'], ['delay_impact', 'double precision'],
  ['delay_impact_share', 'double precision'], ['delay_per_vehicle_min', 'double precision'],
  ['exceeds_delay_per_vehicle', 'boolean'], ['veh_through_wz', 'double precision'],
  ['n_delay_rows', 'integer'], ['n_delay_tmcs', 'integer'], ['n_delay_tmcs_anchor', 'integer'],
  ['rows_delay_missing', 'integer'], ['rows_raw_delay_missing', 'integer'],
  ['delay_complete', 'boolean'], ['delay_measured', 'boolean'],
  ['delay_per_veh_min_threshold', 'double precision'],
];
const WZ_DELAY_COLUMNS = WZ_DELAY_COLUMN_TYPES.map(([c]) => c);

/** Batch insert for wz_delay, taking each zone's geometry from the spine. */
function wzDelayInsertSQL({ schema = WORK_ZONE_SCHEMA, table, rows, eventTable }) {
  if (!rows.length) return null;
  const values = rows
    .map((r) => `(${WZ_DELAY_COLUMNS.map((c) => sqlLiteral(r[c])).join(', ')})`)
    .join(',\n');
  const selectList = WZ_DELAY_COLUMN_TYPES
    .map(([c, t]) => (t === 'text' ? `v.${c}` : `v.${c}::${t}`)).join(', ');
  const updates = WZ_DELAY_COLUMNS.filter((c) => c !== 'wz_event_id')
    .map((c) => `${c} = EXCLUDED.${c}`).join(', ');
  return `INSERT INTO ${schema}.${table} (${WZ_DELAY_COLUMNS.join(', ')}, wkb_geometry)
SELECT ${selectList}, e.wkb_geometry
  FROM (VALUES ${values}) AS v(${WZ_DELAY_COLUMNS.join(', ')})
  LEFT JOIN ${schema}.${eventTable} e ON e.wz_event_id = v.wz_event_id
ON CONFLICT (wz_event_id) DO UPDATE SET ${updates}, wkb_geometry = EXCLUDED.wkb_geometry;`;
}

/** metadata.columns for the wz_delay source. */
const WZ_DELAY_TABLE_COLUMNS = [
  { name: 'wz_event_id', display_name: 'Work Zone ID', type: 'TEXT', desc: 'Joins wz_event' },
  { name: 'first_start', display_name: 'First Start', type: 'TIMESTAMP', desc: null },
  { name: 'last_end', display_name: 'Last End', type: 'TIMESTAMP', desc: null },
  { name: 'region_name', display_name: 'NYSDOT Region', type: 'TEXT', desc: null },
  { name: 'county_name', display_name: 'County', type: 'TEXT', desc: null },
  { name: 'facility', display_name: 'Facility', type: 'TEXT', desc: null },
  { name: 'work_activity_class', display_name: 'Work Activity', type: 'TEXT', desc: null },
  { name: 'is_interstate', display_name: 'Interstate', type: 'BOOLEAN', desc: null },
  { name: 'in_tma', display_name: 'In TMA', type: 'BOOLEAN', desc: null },
  { name: 'is_significant_candidate', display_name: 'Significant Candidate', type: 'BOOLEAN', desc: null },
  { name: 'delay_vehicle_hours', display_name: 'Delay (veh-hrs)', type: 'DOUBLE PRECISION', desc: 'M2. Vehicle-hours attributed to this zone across ALL its TMCs, anchor and impact. Sums TRANSCOM view 2799 delay over the zone member events.' },
  { name: 'raw_delay_vehicle_hours', display_name: 'Raw delay (veh-hrs)', type: 'DOUBLE PRECISION', desc: "2799's raw_delay. Always <= delay; how one is derived from the other is not documented in the references, so both are published." },
  { name: 'delay_anchor', display_name: 'Delay on the work extent', type: 'DOUBLE PRECISION', desc: 'The ~9% of delay that accrues on the segments being worked on' },
  { name: 'delay_impact', display_name: 'Delay on the queue', type: 'DOUBLE PRECISION', desc: 'The ~91% that accrues downstream. Phases 2-3 exclude these TMCs; M2 must include them.' },
  { name: 'delay_impact_share', display_name: 'Share of delay downstream', type: 'DOUBLE PRECISION', desc: null },
  { name: 'delay_per_vehicle_min', display_name: 'Delay per vehicle (min)', type: 'DOUBLE PRECISION', desc: 'delay_vehicle_hours x 60 / veh_through_wz. NULL where exposure could not compute a vehicle count -- never 0.' },
  { name: 'exceeds_delay_per_vehicle', display_name: 'Over the per-vehicle threshold', type: 'BOOLEAN', desc: 'Against delay_per_veh_min_threshold. NULL where the rate is unknown.' },
  { name: 'veh_through_wz', display_name: 'Vehicles through the zone', type: 'DOUBLE PRECISION', desc: 'From phase 2 wz_exposure, carried so the rate is reproducible on the row' },
  { name: 'n_delay_rows', display_name: 'Delay rows', type: 'INTEGER', desc: '2799 (event x tmc) rows rolled up' },
  { name: 'n_delay_tmcs', display_name: 'TMCs with delay', type: 'INTEGER', desc: null },
  { name: 'n_delay_tmcs_anchor', display_name: 'Anchor TMCs with delay', type: 'INTEGER', desc: null },
  { name: 'rows_delay_missing', display_name: 'Rows missing delay', type: 'INTEGER', desc: 'Counted as a gap, not a zero' },
  { name: 'rows_raw_delay_missing', display_name: 'Rows missing raw delay', type: 'INTEGER', desc: null },
  { name: 'delay_complete', display_name: 'Delay complete', type: 'BOOLEAN', desc: 'Filter on this before aggregating' },
  { name: 'delay_measured', display_name: 'Delay measured', type: 'BOOLEAN', desc: 'FALSE where the zone has no TRANSCOM conflation row at all — its delay is UNKNOWN, not zero. Filter on this before averaging.' },
  { name: 'delay_per_veh_min_threshold', display_name: 'Per-vehicle threshold used', type: 'DOUBLE PRECISION', desc: null },
];

// ── phase 3: speeds and M1 ──────────────────────────────────────────────────

/**
 * `wz_speed` — one row per (work zone × TMC × hour-of-day).
 *
 * The hour cell pools every active day: a zone running 13:00–19:00 for
 * 43 nights is seven rows, not 301. That keeps a year at ~300k rows while
 * preserving the hour-of-day shape M1 and phase 6 both need.
 *
 * ⚠ **The phase-6 differential columns are created here, in phase 3.** All
 * views of a DAMA source share one `metadata.columns` list, so adding columns
 * when phase 6 lands would force a NEW source and orphan every phase-3 view.
 * They are nullable and filled later by the `differential` stage.
 *
 * No geometry: at this grain it would repeat per hour for no cartographic
 * gain. Join `wz_event_tmc` on (wz_event_id, tmc) for the segment geometry.
 */
function wzSpeedTableDDL(schema, table) {
  return `
CREATE SCHEMA IF NOT EXISTS ${schema};
CREATE TABLE IF NOT EXISTS ${schema}.${table} (
    ogc_fid SERIAL PRIMARY KEY,
    wz_event_id TEXT NOT NULL,
    tmc TEXT NOT NULL,
    hour SMALLINT NOT NULL,
    first_start TIMESTAMP,
    last_end TIMESTAMP,
    region_name TEXT,
    county_name TEXT,
    facility TEXT,
    work_activity_class TEXT,
    is_interstate BOOLEAN,
    in_tma BOOLEAN,
    is_significant_candidate BOOLEAN,
    -- observation
    -- Which source gave this cell its active window: '2799' (the TRANSCOM
    -- event->TMC conflation) or 'event' (the work zone's own clock times, used
    -- where the conflation has no row — it has none at all for 2019 and 2020).
    -- Filter on it to restrict any aggregate to the conflated windows.
    window_source TEXT,
    epochs_observed INTEGER,
    density_a INTEGER,
    density_b INTEGER,
    density_c INTEGER,
    -- M1 at four thresholds, all four always. m1_posted is the PRIMARY
    -- measure (owner decision 2026-09-09): below max(20, posted limit - 10).
    epochs_below_posted INTEGER,
    epochs_below_absolute INTEGER,
    epochs_below_relative INTEGER,
    epochs_below_fhwa INTEGER,
    m1_posted DOUBLE PRECISION,
    m1_absolute DOUBLE PRECISION,
    m1_relative DOUBLE PRECISION,
    m1_fhwa DOUBLE PRECISION,
    -- observed speeds
    speed_mean DOUBLE PRECISION,
    speed_median DOUBLE PRECISION,
    speed_min DOUBLE PRECISION,
    -- what they are compared against
    baseline_speed DOUBLE PRECISION,
    baseline_p85 DOUBLE PRECISION,
    reference_speed DOUBLE PRECISION,
    posted_threshold_speed DOUBLE PRECISION,
    phed_threshold_speed DOUBLE PRECISION,
    fhwa_threshold_speed DOUBLE PRECISION,
    -- the thresholds this row was measured with, so it is self-describing
    posted_speed_drop_mph DOUBLE PRECISION,
    speed_threshold_mph DOUBLE PRECISION,
    reference_speed_pct DOUBLE PRECISION,
    -- phase 6 (M4) — created now, filled by the differential stage
    approach_tmc TEXT,
    approach_speed DOUBLE PRECISION,
    differential_approach DOUBLE PRECISION,
    differential_baseline DOUBLE PRECISION,
    exceeds_differential BOOLEAN,
    UNIQUE (wz_event_id, tmc, hour)
);
CREATE INDEX IF NOT EXISTS ${table}_event_idx ON ${schema}.${table} (wz_event_id);
CREATE INDEX IF NOT EXISTS ${table}_start_idx ON ${schema}.${table} (first_start);
CREATE INDEX IF NOT EXISTS ${table}_signif_idx ON ${schema}.${table} (is_significant_candidate);`;
}

/** Insert column order for wz_speed, with the cast each needs out of a VALUES subquery. */
const WZ_SPEED_COLUMN_TYPES = [
  ['wz_event_id', 'text'], ['tmc', 'text'], ['hour', 'smallint'],
  ['first_start', 'timestamp'], ['last_end', 'timestamp'],
  ['region_name', 'text'], ['county_name', 'text'], ['facility', 'text'],
  ['work_activity_class', 'text'], ['is_interstate', 'boolean'], ['in_tma', 'boolean'],
  ['is_significant_candidate', 'boolean'],
  ['window_source', 'text'], ['epochs_observed', 'integer'], ['density_a', 'integer'], ['density_b', 'integer'], ['density_c', 'integer'],
  ['epochs_below_posted', 'integer'],
  ['epochs_below_absolute', 'integer'], ['epochs_below_relative', 'integer'], ['epochs_below_fhwa', 'integer'],
  ['m1_posted', 'double precision'],
  ['m1_absolute', 'double precision'], ['m1_relative', 'double precision'], ['m1_fhwa', 'double precision'],
  ['speed_mean', 'double precision'], ['speed_median', 'double precision'], ['speed_min', 'double precision'],
  ['baseline_speed', 'double precision'], ['baseline_p85', 'double precision'],
  ['reference_speed', 'double precision'], ['posted_threshold_speed', 'double precision'],
  ['phed_threshold_speed', 'double precision'], ['fhwa_threshold_speed', 'double precision'],
  ['posted_speed_drop_mph', 'double precision'],
  ['speed_threshold_mph', 'double precision'], ['reference_speed_pct', 'double precision'],
];
const WZ_SPEED_COLUMNS = WZ_SPEED_COLUMN_TYPES.map(([c]) => c);

/** Batch insert for wz_speed. Idempotent on (wz_event_id, tmc, hour). */
function wzSpeedInsertSQL({ schema = WORK_ZONE_SCHEMA, table, rows }) {
  if (!rows.length) return null;
  const values = rows
    .map((r) => `(${WZ_SPEED_COLUMNS.map((c) => sqlLiteral(r[c])).join(', ')})`)
    .join(',\n');
  const selectList = WZ_SPEED_COLUMN_TYPES
    .map(([c, t]) => (t === 'text' ? `v.${c}` : `v.${c}::${t}`)).join(', ');
  const updates = WZ_SPEED_COLUMNS.filter((c) => !['wz_event_id', 'tmc', 'hour'].includes(c))
    .map((c) => `${c} = EXCLUDED.${c}`).join(', ');
  return `INSERT INTO ${schema}.${table} (${WZ_SPEED_COLUMNS.join(', ')})
SELECT ${selectList}
  FROM (VALUES ${values}) AS v(${WZ_SPEED_COLUMNS.join(', ')})
ON CONFLICT (wz_event_id, tmc, hour) DO UPDATE SET ${updates};`;
}

/** metadata.columns for the wz_speed source. */
const WZ_SPEED_TABLE_COLUMNS = [
  { name: 'wz_event_id', display_name: 'Work Zone ID', type: 'TEXT', desc: 'Joins wz_event' },
  { name: 'tmc', display_name: 'TMC', type: 'TEXT', desc: 'Anchor TMC — join wz_event_tmc for geometry' },
  { name: 'hour', display_name: 'Hour of Day', type: 'SMALLINT', desc: '0-23, pooling every active day' },
  { name: 'first_start', display_name: 'First Start', type: 'TIMESTAMP', desc: null },
  { name: 'last_end', display_name: 'Last End', type: 'TIMESTAMP', desc: null },
  { name: 'region_name', display_name: 'NYSDOT Region', type: 'TEXT', desc: null },
  { name: 'county_name', display_name: 'County', type: 'TEXT', desc: null },
  { name: 'facility', display_name: 'Facility', type: 'TEXT', desc: null },
  { name: 'work_activity_class', display_name: 'Work Activity', type: 'TEXT', desc: null },
  { name: 'is_interstate', display_name: 'Interstate', type: 'BOOLEAN', desc: null },
  { name: 'in_tma', display_name: 'In TMA', type: 'BOOLEAN', desc: null },
  { name: 'is_significant_candidate', display_name: 'Significant Candidate', type: 'BOOLEAN', desc: null },
  { name: 'window_source', display_name: 'Active-window source', type: 'TEXT', desc: "'2799' = the TRANSCOM event->TMC conflation; 'event' = the zone's own reported clock times, used where the conflation has no row (it has none at all for 2019-2020). Filter on '2799' to restrict an aggregate to the conflated windows." },
  { name: 'epochs_observed', display_name: 'Epochs Observed', type: 'INTEGER', desc: 'Five-minute observations while active — the M1 denominator. Never 288: NPMRDS has gaps.' },
  { name: 'density_a', display_name: 'Density A', type: 'INTEGER', desc: 'Highest observation confidence' },
  { name: 'density_b', display_name: 'Density B', type: 'INTEGER', desc: null },
  { name: 'density_c', display_name: 'Density C', type: 'INTEGER', desc: 'Lowest confidence — included by decision, counted so it stays visible' },
  { name: 'epochs_below_posted', display_name: 'Epochs < posted−10 threshold', type: 'INTEGER', desc: 'The primary measure numerator' },
  { name: 'epochs_below_absolute', display_name: 'Epochs < absolute threshold', type: 'INTEGER', desc: null },
  { name: 'epochs_below_relative', display_name: 'Epochs < relative threshold', type: 'INTEGER', desc: null },
  { name: 'epochs_below_fhwa', display_name: 'Epochs < FHWA threshold', type: 'INTEGER', desc: null },
  { name: 'm1_posted', display_name: 'M1 · posted −10 (PRIMARY)', type: 'DOUBLE PRECISION', desc: 'PRIMARY MEASURE. Share of observed active epochs below max(20, posted speed limit − posted_speed_drop_mph). Scales with the road, so unlike the absolute threshold it is comparable across facility types, Regions and years.' },
  { name: 'm1_absolute', display_name: 'M1 · absolute', type: 'DOUBLE PRECISION', desc: 'Share of observed active epochs below speed_threshold_mph' },
  { name: 'm1_relative', display_name: 'M1 · relative', type: 'DOUBLE PRECISION', desc: 'Share below reference_speed_pct of the PM3 85th-percentile speed' },
  { name: 'm1_fhwa', display_name: 'M1 · FHWA/PHED', type: 'DOUBLE PRECISION', desc: 'Share below max(20, 0.6 × posted limit) — the anchor AVAIL congestion work uses' },
  { name: 'speed_mean', display_name: 'Speed (mean)', type: 'DOUBLE PRECISION', desc: 'Derived: miles × 3600 / travel time, all vehicles' },
  { name: 'speed_median', display_name: 'Speed (median)', type: 'DOUBLE PRECISION', desc: null },
  { name: 'speed_min', display_name: 'Speed (min)', type: 'DOUBLE PRECISION', desc: null },
  { name: 'baseline_speed', display_name: 'Baseline speed', type: 'DOUBLE PRECISION', desc: 'Median at the same hour and day-type over the baseline window, contaminated days removed' },
  { name: 'baseline_p85', display_name: 'Baseline 85th pct', type: 'DOUBLE PRECISION', desc: null },
  { name: 'reference_speed', display_name: 'Reference speed', type: 'DOUBLE PRECISION', desc: 'PM3 speed_pctl_85 for the TMC and year' },
  { name: 'posted_threshold_speed', display_name: 'Posted −10 threshold', type: 'DOUBLE PRECISION', desc: 'max(20, avg_speedlimit − posted_speed_drop_mph), capped at the posted limit — the primary measure threshold for this segment' },
  { name: 'phed_threshold_speed', display_name: 'PM3 PHED threshold', type: 'DOUBLE PRECISION', desc: null },
  { name: 'fhwa_threshold_speed', display_name: 'FHWA threshold', type: 'DOUBLE PRECISION', desc: 'max(20, 0.6 × avg_speedlimit) from the Postgres meta view' },
  { name: 'posted_speed_drop_mph', display_name: 'Posted drop used (mph)', type: 'DOUBLE PRECISION', desc: 'mph below the posted limit, for the primary measure' },
  { name: 'speed_threshold_mph', display_name: 'Absolute threshold used', type: 'DOUBLE PRECISION', desc: null },
  { name: 'reference_speed_pct', display_name: 'Relative threshold used (%)', type: 'DOUBLE PRECISION', desc: null },
  { name: 'approach_tmc', display_name: 'Approach TMC', type: 'TEXT', desc: 'Phase 6 (M4)' },
  { name: 'approach_speed', display_name: 'Approach speed', type: 'DOUBLE PRECISION', desc: 'Phase 6 (M4)' },
  { name: 'differential_approach', display_name: 'Differential · approach − zone', type: 'DOUBLE PRECISION', desc: 'Phase 6 (M4)' },
  { name: 'differential_baseline', display_name: 'Differential · baseline − during', type: 'DOUBLE PRECISION', desc: 'Phase 6 (M4)' },
  { name: 'exceeds_differential', display_name: 'Exceeds differential threshold', type: 'BOOLEAN', desc: 'Phase 6 (M4)' },
];

module.exports = {
  WORK_ZONE_SCHEMA,
  DDL_RULES,
  sqlLiteral,
  tableNameFor,
  vintageVersion,
  createSchemaSQL,
  deleteWindowSQL,
  wzEventTableDDL,
  wzEventTmcTableDDL,
  wzEventInsertSQL,
  wzEventTmcInsertSQL,
  metaGeomTempTableSQL,
  wzEventGeometryUpdateSQL,
  WZ_EVENT_COLUMNS,
  WZ_EVENT_TMC_COLUMNS,
  WZ_EVENT_TMC_COLUMN_TYPES,
  WZ_EVENT_TABLE_COLUMNS,
  WZ_EVENT_TMC_TABLE_COLUMNS,
  wzExposureTableDDL,
  wzExposureInsertSQL,
  wzDelayTableDDL,
  wzDelayInsertSQL,
  WZ_DELAY_COLUMNS,
  WZ_DELAY_COLUMN_TYPES,
  WZ_DELAY_TABLE_COLUMNS,
  WZ_EXPOSURE_COLUMNS,
  WZ_EXPOSURE_COLUMN_TYPES,
  WZ_EXPOSURE_TABLE_COLUMNS,
  wzSpeedTableDDL,
  wzSpeedInsertSQL,
  WZ_SPEED_COLUMNS,
  WZ_SPEED_COLUMN_TYPES,
  WZ_SPEED_TABLE_COLUMNS,
};
