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
  { name: 'approach_tmc', display_name: 'Approach TMCs', type: 'TEXT', desc: 'M4 (phase 6): the 1-2 segments immediately upstream of the anchor on the same corridor, space-separated. NULL where the corridor has nothing upstream.' },
  { name: 'approach_speed', display_name: 'Approach speed', type: 'DOUBLE PRECISION', desc: 'M4: mean speed on the approach segments over this cell\'s active epochs, pooled like speed_mean. NULL where unobserved.' },
  { name: 'differential_approach', display_name: 'M4 · approach − in-zone (mph)', type: 'DOUBLE PRECISION', desc: 'PRIMARY M4 surrogate: approach_speed − speed_mean. Positive = traffic arrives faster than it moves through the zone (the taper). Negative beyond the threshold = the queue reached past the approach.' },
  { name: 'differential_baseline', display_name: 'M4 · baseline − during (mph)', type: 'DOUBLE PRECISION', desc: 'baseline_speed − speed_mean: the drop against the segment\'s normal speed at this hour and day-type. Positive = slower than normal.' },
  { name: 'exceeds_differential', display_name: 'Approach drop over threshold', type: 'BOOLEAN', desc: 'differential_approach > differential_mph. NULL where the approach is unobserved — unknown, not FALSE.' },
];


// ── phase 5: queues and M3 ──────────────────────────────────────────────────

/**
 * `wz_queue` — one row per work zone, the `wz_delay` shape: the M3 statistics
 * over the zone's whole active window, at the primary (absolute) threshold and
 * the road-scaled PHED comparator, with the corridor that was walked and how
 * much of the queue length is a lower bound. Geometry is the MAXIMUM queue
 * extent — the anchor plus the upstream TMCs queued at the longest epoch — so
 * the layer draws how far back the queue reached, not just where the work was.
 *
 * `max_queue_tmcs` is space-separated TEXT for the same reason
 * `member_event_ids` is: DMS filter chips and falcor keys are hostile to
 * commas. Phase 7's crash join reads it for the upstream queue extent.
 *
 * Queue length is UPSTREAM length: the anchor's own miles are on the row
 * (`anchor_miles`) but not in `max_queue_len_mi`. See lib/queue.js.
 */
function wzQueueTableDDL(schema, table) {
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
    -- where the walk started, and what it had to walk
    anchor_tmc TEXT,
    anchor_miles DOUBLE PRECISION,
    window_source TEXT,
    n_upstream_tmcs INTEGER,
    corridor_reach_mi DOUBLE PRECISION,
    corridor_end_reason TEXT,
    -- observation. FALSE where the anchor had no speed observation in the
    -- active window: the queue is UNKNOWN, not absent. Filter on it.
    queue_measured BOOLEAN,
    epochs_observed INTEGER,
    active_hours_observed DOUBLE PRECISION,
    epochs_2799 INTEGER,
    epochs_anchor_below INTEGER,
    -- M3 at the primary threshold (queue_speed_mph)
    epochs_queued INTEGER,
    pct_time_queued DOUBLE PRECISION,
    queue_hours DOUBLE PRECISION,
    hours_with_queue INTEGER,
    max_queue_len_mi DOUBLE PRECISION,
    p95_queue_len_mi DOUBLE PRECISION,
    mean_queue_len_mi DOUBLE PRECISION,
    queue_mile_hours DOUBLE PRECISION,
    longest_queue_run_min INTEGER,
    exceeds_queue_threshold BOOLEAN,
    max_queue_tmcs TEXT,
    max_queue_date DATE,
    max_queue_time TEXT,
    epochs_lower_bound INTEGER,
    epochs_corridor_end INTEGER,
    -- the road-scaled comparator: below max(20, 0.6 x posted limit)
    epochs_queued_phed INTEGER,
    pct_time_queued_phed DOUBLE PRECISION,
    max_queue_len_phed_mi DOUBLE PRECISION,
    p95_queue_len_phed_mi DOUBLE PRECISION,
    longest_queue_run_phed_min INTEGER,
    exceeds_queue_threshold_phed BOOLEAN,
    -- context
    anchor_speed_mean DOUBLE PRECISION,
    anchor_speed_min DOUBLE PRECISION,
    -- the parameters this row was measured with, so it is self-describing
    queue_speed_mph DOUBLE PRECISION,
    queue_threshold_mi DOUBLE PRECISION,
    min_consecutive_epochs SMALLINT,
    wkb_geometry public.geometry(Geometry, 4326)
);
CREATE INDEX IF NOT EXISTS ${table}_first_start_idx ON ${schema}.${table} (first_start);
CREATE INDEX IF NOT EXISTS ${table}_maxq_idx ON ${schema}.${table} (max_queue_len_mi);
CREATE INDEX IF NOT EXISTS ${table}_signif_idx ON ${schema}.${table} (is_significant_candidate);
CREATE INDEX IF NOT EXISTS ${table}_gix ON ${schema}.${table} USING gist (wkb_geometry);`;
}

/** Insert column order for wz_queue, with the cast each needs out of a VALUES subquery. */
const WZ_QUEUE_COLUMN_TYPES = [
  ['wz_event_id', 'text'], ['first_start', 'timestamp'], ['last_end', 'timestamp'],
  ['region_name', 'text'], ['county_name', 'text'], ['facility', 'text'],
  ['work_activity_class', 'text'], ['is_interstate', 'boolean'], ['in_tma', 'boolean'],
  ['is_significant_candidate', 'boolean'],
  ['anchor_tmc', 'text'], ['anchor_miles', 'double precision'], ['window_source', 'text'],
  ['n_upstream_tmcs', 'integer'], ['corridor_reach_mi', 'double precision'], ['corridor_end_reason', 'text'],
  ['queue_measured', 'boolean'], ['epochs_observed', 'integer'], ['active_hours_observed', 'double precision'],
  ['epochs_2799', 'integer'], ['epochs_anchor_below', 'integer'],
  ['epochs_queued', 'integer'], ['pct_time_queued', 'double precision'], ['queue_hours', 'double precision'],
  ['hours_with_queue', 'integer'], ['max_queue_len_mi', 'double precision'], ['p95_queue_len_mi', 'double precision'],
  ['mean_queue_len_mi', 'double precision'], ['queue_mile_hours', 'double precision'],
  ['longest_queue_run_min', 'integer'], ['exceeds_queue_threshold', 'boolean'],
  ['max_queue_tmcs', 'text'], ['max_queue_date', 'date'], ['max_queue_time', 'text'],
  ['epochs_lower_bound', 'integer'], ['epochs_corridor_end', 'integer'],
  ['epochs_queued_phed', 'integer'], ['pct_time_queued_phed', 'double precision'],
  ['max_queue_len_phed_mi', 'double precision'], ['p95_queue_len_phed_mi', 'double precision'],
  ['longest_queue_run_phed_min', 'integer'], ['exceeds_queue_threshold_phed', 'boolean'],
  ['anchor_speed_mean', 'double precision'], ['anchor_speed_min', 'double precision'],
  ['queue_speed_mph', 'double precision'], ['queue_threshold_mi', 'double precision'],
  ['min_consecutive_epochs', 'smallint'],
];
const WZ_QUEUE_COLUMNS = WZ_QUEUE_COLUMN_TYPES.map(([c]) => c);

/**
 * Batch insert for wz_queue. The geometry is the union of the anchor and the
 * max-queue TMCs, taken from the per-TMC geometry temp table
 * (metaGeomTempTableSQL) and wrapped in ST_SetSRID so the values carry 4326.
 * ST_CollectionExtract(..., 2) keeps the union a (Multi)LineString even when
 * PostGIS returns a collection.
 */
function wzQueueInsertSQL({ schema = WORK_ZONE_SCHEMA, table, rows, geomTable }) {
  if (!rows.length) return null;
  if (!geomTable) throw new Error('wzQueueInsertSQL: geomTable is required');
  const values = rows
    .map((r) => `(${WZ_QUEUE_COLUMNS.map((c) => sqlLiteral(r[c])).join(', ')})`)
    .join(',\n');
  const selectList = WZ_QUEUE_COLUMN_TYPES
    .map(([c, t]) => (t === 'text' ? `v.${c}` : `v.${c}::${t}`)).join(', ');
  const updates = WZ_QUEUE_COLUMNS.filter((c) => c !== 'wz_event_id')
    .map((c) => `${c} = EXCLUDED.${c}`).join(', ');
  return `INSERT INTO ${schema}.${table} (${WZ_QUEUE_COLUMNS.join(', ')}, wkb_geometry)
SELECT ${selectList}, gg.geom
  FROM (VALUES ${values}) AS v(${WZ_QUEUE_COLUMNS.join(', ')})
  LEFT JOIN LATERAL (
        SELECT ST_SetSRID(ST_Multi(ST_CollectionExtract(ST_Union(g.wkb_geometry), 2)), 4326) AS geom
          FROM ${geomTable} g
         WHERE g.tmc = ANY(string_to_array(trim(coalesce(v.anchor_tmc, '') || ' ' || coalesce(v.max_queue_tmcs, '')), ' '))
       ) gg ON TRUE
ON CONFLICT (wz_event_id) DO UPDATE SET ${updates}, wkb_geometry = EXCLUDED.wkb_geometry;`;
}

/** metadata.columns for the wz_queue source. */
const WZ_QUEUE_TABLE_COLUMNS = [
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
  { name: 'anchor_tmc', display_name: 'Anchor TMC', type: 'TEXT', desc: 'Where the work is; the walk starts here and goes upstream' },
  { name: 'anchor_miles', display_name: 'Anchor length (mi)', type: 'DOUBLE PRECISION', desc: 'NOT included in the queue length' },
  { name: 'window_source', display_name: 'Active-window source', type: 'TEXT', desc: "'2799' | 'event' | 'mixed' — see wz_speed. Filter on '2799' for the conflated windows." },
  { name: 'n_upstream_tmcs', display_name: 'Upstream TMCs walked', type: 'INTEGER', desc: 'Corridor segments available upstream of the anchor, within the reach and gap limits' },
  { name: 'corridor_reach_mi', display_name: 'Corridor reach (mi)', type: 'DOUBLE PRECISION', desc: 'Upstream miles available to the walk — a queue cannot measure longer than this' },
  { name: 'corridor_end_reason', display_name: 'Corridor ended by', type: 'TEXT', desc: 'end_of_linear | gap | reach | tmcs | no_meta' },
  { name: 'queue_measured', display_name: 'Queue measured', type: 'BOOLEAN', desc: 'FALSE where the anchor had no speed observation while active — the queue is UNKNOWN, not zero. Filter on this before aggregating.' },
  { name: 'epochs_observed', display_name: 'Epochs observed', type: 'INTEGER', desc: 'Five-minute periods with an anchor observation while active — the denominator' },
  { name: 'active_hours_observed', display_name: 'Active hours observed', type: 'DOUBLE PRECISION', desc: 'epochs_observed / 12' },
  { name: 'epochs_2799', display_name: 'Epochs on conflated windows', type: 'INTEGER', desc: null },
  { name: 'epochs_anchor_below', display_name: 'Epochs anchor below threshold', type: 'INTEGER', desc: 'Before the consecutive-epoch rule' },
  { name: 'epochs_queued', display_name: 'M3 · Epochs queued', type: 'INTEGER', desc: 'Anchor below queue_speed_mph in two or more consecutive epochs' },
  { name: 'pct_time_queued', display_name: 'M3 · Share of time queued', type: 'DOUBLE PRECISION', desc: 'epochs_queued / epochs_observed' },
  { name: 'queue_hours', display_name: 'M3 · Queue hours', type: 'DOUBLE PRECISION', desc: 'epochs_queued / 12' },
  { name: 'hours_with_queue', display_name: 'Clock hours with a queue', type: 'INTEGER', desc: 'Distinct (date, hour) with any queued epoch' },
  { name: 'max_queue_len_mi', display_name: 'M3 · Max queue (mi)', type: 'DOUBLE PRECISION', desc: 'PRIMARY. Longest contiguous run of upstream TMCs below queue_speed_mph in any queued epoch. Upstream length only.' },
  { name: 'p95_queue_len_mi', display_name: 'M3 · 95th-pct queue (mi)', type: 'DOUBLE PRECISION', desc: 'Over queued epochs. The report figure the recommendation asks for beside the max.' },
  { name: 'mean_queue_len_mi', display_name: 'Mean queue when present (mi)', type: 'DOUBLE PRECISION', desc: null },
  { name: 'queue_mile_hours', display_name: 'Queue-mile-hours', type: 'DOUBLE PRECISION', desc: 'Sum over queued epochs of queue length, in hours' },
  { name: 'longest_queue_run_min', display_name: 'M3 · Longest queue (min)', type: 'INTEGER', desc: 'Longest run of consecutive queued epochs, in minutes — the duration measure' },
  { name: 'exceeds_queue_threshold', display_name: 'Over the queue threshold', type: 'BOOLEAN', desc: 'max_queue_len_mi > queue_threshold_mi. NULL where unmeasured.' },
  { name: 'max_queue_tmcs', display_name: 'Max-queue TMCs', type: 'TEXT', desc: 'Space-separated upstream TMCs queued at the longest epoch — the extent phase 7 joins crashes to' },
  { name: 'max_queue_date', display_name: 'Max-queue date', type: 'DATE', desc: null },
  { name: 'max_queue_time', display_name: 'Max-queue time', type: 'TEXT', desc: 'HH:MM of the epoch' },
  { name: 'epochs_lower_bound', display_name: 'Epochs where length is a lower bound', type: 'INTEGER', desc: 'The walk ran out of observed segments while still queued' },
  { name: 'epochs_corridor_end', display_name: 'Epochs queued to the corridor end', type: 'INTEGER', desc: 'Queue reached the last segment the corridor had — reach or linear end' },
  { name: 'epochs_queued_phed', display_name: 'PHED · Epochs queued', type: 'INTEGER', desc: 'Comparator: below max(20, 0.6 x posted limit) per segment' },
  { name: 'pct_time_queued_phed', display_name: 'PHED · Share of time queued', type: 'DOUBLE PRECISION', desc: null },
  { name: 'max_queue_len_phed_mi', display_name: 'PHED · Max queue (mi)', type: 'DOUBLE PRECISION', desc: null },
  { name: 'p95_queue_len_phed_mi', display_name: 'PHED · 95th-pct queue (mi)', type: 'DOUBLE PRECISION', desc: null },
  { name: 'longest_queue_run_phed_min', display_name: 'PHED · Longest queue (min)', type: 'INTEGER', desc: null },
  { name: 'exceeds_queue_threshold_phed', display_name: 'PHED · Over the queue threshold', type: 'BOOLEAN', desc: null },
  { name: 'anchor_speed_mean', display_name: 'Anchor speed (mean)', type: 'DOUBLE PRECISION', desc: 'Over observed active epochs' },
  { name: 'anchor_speed_min', display_name: 'Anchor speed (min)', type: 'DOUBLE PRECISION', desc: null },
  { name: 'queue_speed_mph', display_name: 'Queue speed used (mph)', type: 'DOUBLE PRECISION', desc: null },
  { name: 'queue_threshold_mi', display_name: 'Queue threshold used (mi)', type: 'DOUBLE PRECISION', desc: null },
  { name: 'min_consecutive_epochs', display_name: 'Consecutive epochs required', type: 'SMALLINT', desc: null },
];

/**
 * `wz_queue_hour` — one row per (work zone x date x clock hour): the evidence
 * under wz_queue, at the grain that keeps the DATE (so a queue's day-by-day
 * shape and its duration survive) without the ~5 million rows a year the
 * epoch grain would cost. `first_start` is carried so the window delete works
 * the same way as on every other table.
 */
function wzQueueHourTableDDL(schema, table) {
  return `
CREATE SCHEMA IF NOT EXISTS ${schema};
CREATE TABLE IF NOT EXISTS ${schema}.${table} (
    ogc_fid SERIAL PRIMARY KEY,
    wz_event_id TEXT NOT NULL,
    date DATE NOT NULL,
    hour SMALLINT NOT NULL,
    first_start TIMESTAMP,
    region_name TEXT,
    is_interstate BOOLEAN,
    is_significant_candidate BOOLEAN,
    window_source TEXT,
    epochs_observed INTEGER,
    epochs_anchor_below INTEGER,
    epochs_queued INTEGER,
    max_queue_len_mi DOUBLE PRECISION,
    mean_queue_len_mi DOUBLE PRECISION,
    queue_mile_epochs DOUBLE PRECISION,
    epochs_lower_bound INTEGER,
    epochs_queued_phed INTEGER,
    max_queue_len_phed_mi DOUBLE PRECISION,
    anchor_speed_mean DOUBLE PRECISION,
    anchor_speed_min DOUBLE PRECISION,
    UNIQUE (wz_event_id, date, hour)
);
CREATE INDEX IF NOT EXISTS ${table}_event_idx ON ${schema}.${table} (wz_event_id);
CREATE INDEX IF NOT EXISTS ${table}_start_idx ON ${schema}.${table} (first_start);
CREATE INDEX IF NOT EXISTS ${table}_date_idx ON ${schema}.${table} (date);`;
}

const WZ_QUEUE_HOUR_COLUMN_TYPES = [
  ['wz_event_id', 'text'], ['date', 'date'], ['hour', 'smallint'], ['first_start', 'timestamp'],
  ['region_name', 'text'], ['is_interstate', 'boolean'], ['is_significant_candidate', 'boolean'],
  ['window_source', 'text'], ['epochs_observed', 'integer'], ['epochs_anchor_below', 'integer'],
  ['epochs_queued', 'integer'], ['max_queue_len_mi', 'double precision'], ['mean_queue_len_mi', 'double precision'],
  ['queue_mile_epochs', 'double precision'], ['epochs_lower_bound', 'integer'],
  ['epochs_queued_phed', 'integer'], ['max_queue_len_phed_mi', 'double precision'],
  ['anchor_speed_mean', 'double precision'], ['anchor_speed_min', 'double precision'],
];
const WZ_QUEUE_HOUR_COLUMNS = WZ_QUEUE_HOUR_COLUMN_TYPES.map(([c]) => c);

/** Batch insert for wz_queue_hour. Idempotent on (wz_event_id, date, hour). */
function wzQueueHourInsertSQL({ schema = WORK_ZONE_SCHEMA, table, rows }) {
  if (!rows.length) return null;
  const values = rows
    .map((r) => `(${WZ_QUEUE_HOUR_COLUMNS.map((c) => sqlLiteral(r[c])).join(', ')})`)
    .join(',\n');
  const selectList = WZ_QUEUE_HOUR_COLUMN_TYPES
    .map(([c, t]) => (t === 'text' ? `v.${c}` : `v.${c}::${t}`)).join(', ');
  const updates = WZ_QUEUE_HOUR_COLUMNS.filter((c) => !['wz_event_id', 'date', 'hour'].includes(c))
    .map((c) => `${c} = EXCLUDED.${c}`).join(', ');
  return `INSERT INTO ${schema}.${table} (${WZ_QUEUE_HOUR_COLUMNS.join(', ')})
SELECT ${selectList}
  FROM (VALUES ${values}) AS v(${WZ_QUEUE_HOUR_COLUMNS.join(', ')})
ON CONFLICT (wz_event_id, date, hour) DO UPDATE SET ${updates};`;
}

/** metadata.columns for the wz_queue_hour source. */
const WZ_QUEUE_HOUR_TABLE_COLUMNS = [
  { name: 'wz_event_id', display_name: 'Work Zone ID', type: 'TEXT', desc: 'Joins wz_event / wz_queue' },
  { name: 'date', display_name: 'Date', type: 'DATE', desc: null },
  { name: 'hour', display_name: 'Hour', type: 'SMALLINT', desc: '0-23, clock hour of this date' },
  { name: 'first_start', display_name: 'Zone first start', type: 'TIMESTAMP', desc: null },
  { name: 'region_name', display_name: 'NYSDOT Region', type: 'TEXT', desc: null },
  { name: 'is_interstate', display_name: 'Interstate', type: 'BOOLEAN', desc: null },
  { name: 'is_significant_candidate', display_name: 'Significant Candidate', type: 'BOOLEAN', desc: null },
  { name: 'window_source', display_name: 'Active-window source', type: 'TEXT', desc: "'2799' or 'event'" },
  { name: 'epochs_observed', display_name: 'Epochs observed', type: 'INTEGER', desc: 'Anchor observations in this hour while active (max 12)' },
  { name: 'epochs_anchor_below', display_name: 'Epochs anchor below threshold', type: 'INTEGER', desc: 'Before the consecutive-epoch rule' },
  { name: 'epochs_queued', display_name: 'Epochs queued', type: 'INTEGER', desc: null },
  { name: 'max_queue_len_mi', display_name: 'Max queue (mi)', type: 'DOUBLE PRECISION', desc: 'Upstream length' },
  { name: 'mean_queue_len_mi', display_name: 'Mean queue when present (mi)', type: 'DOUBLE PRECISION', desc: null },
  { name: 'queue_mile_epochs', display_name: 'Queue-mile-epochs', type: 'DOUBLE PRECISION', desc: 'Divide by 12 for queue-mile-hours' },
  { name: 'epochs_lower_bound', display_name: 'Epochs where length is a lower bound', type: 'INTEGER', desc: null },
  { name: 'epochs_queued_phed', display_name: 'PHED · Epochs queued', type: 'INTEGER', desc: null },
  { name: 'max_queue_len_phed_mi', display_name: 'PHED · Max queue (mi)', type: 'DOUBLE PRECISION', desc: null },
  { name: 'anchor_speed_mean', display_name: 'Anchor speed (mean)', type: 'DOUBLE PRECISION', desc: null },
  { name: 'anchor_speed_min', display_name: 'Anchor speed (min)', type: 'DOUBLE PRECISION', desc: null },
];


// ── phase 7: crashes and M5 ─────────────────────────────────────────────────

/**
 * `clear_crash_raw` — the CLEAR extract as delivered, every column TEXT plus
 * a point built from the derived lon/lat. This is the "file_upload" input the
 * crashes_clear stage reads; the loader (load-clear-csv.js) creates it from
 * the CSV exactly as the platform uploader would, and the stage never reads
 * the CSV itself so a server-side run needs no file.
 */
function clearCrashRawTableDDL(schema, table, columns) {
  if (!Array.isArray(columns) || !columns.length) throw new Error('clearCrashRawTableDDL: columns are required');
  const cols = columns.map((c) => `    "${String(c).replace(/"/g, '')}" TEXT`).join(',\n');
  return `
CREATE SCHEMA IF NOT EXISTS ${schema};
CREATE TABLE IF NOT EXISTS ${schema}.${table} (
    ogc_fid SERIAL PRIMARY KEY,
${cols},
    wkb_geometry public.geometry(Point, 4326)
);`;
}

/** After the COPY: build the points (SRID in the VALUES) and index them. */
function clearCrashRawGeometrySQL(schema, table) {
  return `
UPDATE ${schema}.${table}
   SET wkb_geometry = ST_SetSRID(ST_MakePoint(lon::double precision, lat::double precision), 4326)
 WHERE lon ~ '^-?[0-9.]+$' AND lat ~ '^-?[0-9.]+$';
CREATE INDEX IF NOT EXISTS ${table}_gix ON ${schema}.${table} USING gist (wkb_geometry);
CREATE INDEX IF NOT EXISTS ${table}_date_idx ON ${schema}.${table} ("CrashDate");`;
}

/**
 * `nys_crashes_clear` — one row per crash, typed. The KABCO letter, the
 * severity class, the work-zone code and the five-minute epoch are derived
 * once here (lib/crashes.js) so every consumer reads the same answer. The
 * point carries SRID 4326 in the value and a geography column is generated
 * for the metre-based join.
 */
function nysCrashesClearTableDDL(schema, table) {
  return `
CREATE SCHEMA IF NOT EXISTS ${schema};
CREATE TABLE IF NOT EXISTS ${schema}.${table} (
    ogc_fid SERIAL PRIMARY KEY,
    crash_id TEXT UNIQUE NOT NULL,
    case_year SMALLINT,
    crash_date DATE,
    crash_time TEXT,
    crash_ts TIMESTAMP,
    epoch SMALLINT,
    hour SMALLINT,
    time_known BOOLEAN,
    time_uncertain BOOLEAN,
    -- severity
    severity_class TEXT,
    severity_kabco TEXT,
    crash_severity TEXT,
    max_injury_severity TEXT,
    n_fatalities INTEGER,
    n_injuries INTEGER,
    n_serious_injuries INTEGER,
    n_other_injuries INTEGER,
    n_vehicles INTEGER,
    -- circumstances
    collision_type TEXT,
    crash_type TEXT,
    light_condition TEXT,
    roadway_characteristic TEXT,
    road_surface TEXT,
    weather TEXT,
    traffic_control TEXT,
    -- the work-zone attribution CLEAR carries (MV-104A traffic control 12/13/14), and the flagger code
    wz_coded BOOLEAN,
    wz_code TEXT,
    flagger_coded BOOLEAN,
    commercial_vehicle BOOLEAN,
    non_reportable BOOLEAN,
    police_dept TEXT,
    reporting_agency TEXT,
    -- location
    county_name TEXT,
    municipality TEXT,
    on_street TEXT,
    cross_street TEXT,
    intersection_ind BOOLEAN,
    distance_from_int_m DOUBLE PRECISION,
    direction_from_int TEXT,
    master_intersection_id TEXT,
    reference_marker TEXT,
    functional_class_clear SMALLINT,
    functional_class_fhwa SMALLINT,
    functional_class_desc TEXT,
    fc_interstate BOOLEAN,
    fc_urban BOOLEAN,
    access_control TEXT,
    divided TEXT,
    posted_speed SMALLINT,
    road_name TEXT,
    maint_jurisdiction TEXT,
    owning_jurisdiction TEXT,
    apparent_factors TEXT,
    dmv_insert_date DATE,
    utm_easting DOUBLE PRECISION,
    utm_northing DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    lat DOUBLE PRECISION,
    has_point BOOLEAN,
    wkb_geometry public.geometry(Point, 4326),
    geog geography(Point, 4326) GENERATED ALWAYS AS (wkb_geometry::geography) STORED
);
CREATE INDEX IF NOT EXISTS ${table}_date_idx ON ${schema}.${table} (crash_date);
CREATE INDEX IF NOT EXISTS ${table}_wz_idx ON ${schema}.${table} (wz_coded);
CREATE INDEX IF NOT EXISTS ${table}_gix ON ${schema}.${table} USING gist (wkb_geometry);
CREATE INDEX IF NOT EXISTS ${table}_geog_gix ON ${schema}.${table} USING gist (geog);`;
}

const NYS_CRASHES_CLEAR_COLUMN_TYPES = [
  ['crash_id', 'text'], ['case_year', 'smallint'], ['crash_date', 'date'], ['crash_time', 'text'], ['crash_ts', 'timestamp'],
  ['epoch', 'smallint'], ['hour', 'smallint'], ['time_known', 'boolean'], ['time_uncertain', 'boolean'],
  ['severity_class', 'text'], ['severity_kabco', 'text'], ['crash_severity', 'text'], ['max_injury_severity', 'text'],
  ['n_fatalities', 'integer'], ['n_injuries', 'integer'], ['n_serious_injuries', 'integer'], ['n_other_injuries', 'integer'],
  ['n_vehicles', 'integer'],
  ['collision_type', 'text'], ['crash_type', 'text'], ['light_condition', 'text'], ['roadway_characteristic', 'text'],
  ['road_surface', 'text'], ['weather', 'text'], ['traffic_control', 'text'],
  ['wz_coded', 'boolean'], ['wz_code', 'text'], ['flagger_coded', 'boolean'], ['commercial_vehicle', 'boolean'],
  ['non_reportable', 'boolean'], ['police_dept', 'text'], ['reporting_agency', 'text'],
  ['county_name', 'text'], ['municipality', 'text'], ['on_street', 'text'], ['cross_street', 'text'],
  ['intersection_ind', 'boolean'], ['distance_from_int_m', 'double precision'], ['direction_from_int', 'text'],
  ['master_intersection_id', 'text'], ['reference_marker', 'text'],
  ['functional_class_clear', 'smallint'], ['functional_class_fhwa', 'smallint'], ['functional_class_desc', 'text'],
  ['fc_interstate', 'boolean'], ['fc_urban', 'boolean'], ['access_control', 'text'], ['divided', 'text'],
  ['posted_speed', 'smallint'], ['road_name', 'text'], ['maint_jurisdiction', 'text'], ['owning_jurisdiction', 'text'],
  ['apparent_factors', 'text'], ['dmv_insert_date', 'date'],
  ['utm_easting', 'double precision'], ['utm_northing', 'double precision'],
  ['lon', 'double precision'], ['lat', 'double precision'], ['has_point', 'boolean'],
];
const NYS_CRASHES_CLEAR_COLUMNS = NYS_CRASHES_CLEAR_COLUMN_TYPES.map(([c]) => c);

/** Batch insert for nys_crashes_clear, the point built from lon/lat with the SRID in the value. */
function nysCrashesClearInsertSQL({ schema = WORK_ZONE_SCHEMA, table, rows }) {
  if (!rows.length) return null;
  const values = rows
    .map((r) => `(${NYS_CRASHES_CLEAR_COLUMNS.map((c) => sqlLiteral(r[c])).join(', ')})`)
    .join(',\n');
  const selectList = NYS_CRASHES_CLEAR_COLUMN_TYPES
    .map(([c, t]) => (t === 'text' ? `v.${c}` : `v.${c}::${t}`)).join(', ');
  const updates = NYS_CRASHES_CLEAR_COLUMNS.filter((c) => c !== 'crash_id')
    .map((c) => `${c} = EXCLUDED.${c}`).join(', ');
  return `INSERT INTO ${schema}.${table} (${NYS_CRASHES_CLEAR_COLUMNS.join(', ')}, wkb_geometry)
SELECT ${selectList},
       CASE WHEN v.lon IS NOT NULL AND v.lat IS NOT NULL
            THEN ST_SetSRID(ST_MakePoint(v.lon::double precision, v.lat::double precision), 4326) END
  FROM (VALUES ${values}) AS v(${NYS_CRASHES_CLEAR_COLUMNS.join(', ')})
ON CONFLICT (crash_id) DO UPDATE SET ${updates}, wkb_geometry = EXCLUDED.wkb_geometry;`;
}

const NYS_CRASHES_CLEAR_TABLE_COLUMNS = [
  { name: 'crash_id', display_name: 'Case Number', type: 'TEXT', desc: 'CLEAR / DMV case number' },
  { name: 'case_year', display_name: 'Case Year', type: 'SMALLINT', desc: null },
  { name: 'crash_date', display_name: 'Crash Date', type: 'DATE', desc: null },
  { name: 'crash_time', display_name: 'Crash Time', type: 'TEXT', desc: 'As reported, h:mm AM/PM' },
  { name: 'crash_ts', display_name: 'Crash Timestamp', type: 'TIMESTAMP', desc: null },
  { name: 'epoch', display_name: 'Epoch', type: 'SMALLINT', desc: 'Five-minute period of the day, 0-287 — the grid the work-zone windows use' },
  { name: 'hour', display_name: 'Hour', type: 'SMALLINT', desc: null },
  { name: 'time_known', display_name: 'Time known', type: 'BOOLEAN', desc: 'FALSE where the time did not parse' },
  { name: 'time_uncertain', display_name: 'Time uncertain', type: 'BOOLEAN', desc: 'TRUE at exactly midnight, which occurs twice as often as any other minute and is partly an unknown-time default' },
  { name: 'severity_class', display_name: 'Severity', type: 'TEXT', desc: 'fatal | injury | pdo | unknown, from CrashSeverity' },
  { name: 'severity_kabco', display_name: 'KABCO', type: 'TEXT', desc: 'K/A/B/C from MaxInjurySeverity; O when the crash is property damage only; U unknown' },
  { name: 'crash_severity', display_name: 'Crash Severity (raw)', type: 'TEXT', desc: null },
  { name: 'max_injury_severity', display_name: 'Max Injury (raw)', type: 'TEXT', desc: null },
  { name: 'n_fatalities', display_name: 'Fatalities', type: 'INTEGER', desc: null },
  { name: 'n_injuries', display_name: 'Injuries', type: 'INTEGER', desc: null },
  { name: 'n_serious_injuries', display_name: 'Serious injuries', type: 'INTEGER', desc: null },
  { name: 'n_other_injuries', display_name: 'Other injuries', type: 'INTEGER', desc: null },
  { name: 'n_vehicles', display_name: 'Vehicles', type: 'INTEGER', desc: null },
  { name: 'collision_type', display_name: 'Collision Type', type: 'TEXT', desc: null },
  { name: 'crash_type', display_name: 'Crash Type', type: 'TEXT', desc: null },
  { name: 'light_condition', display_name: 'Light', type: 'TEXT', desc: null },
  { name: 'roadway_characteristic', display_name: 'Road Characteristic', type: 'TEXT', desc: null },
  { name: 'road_surface', display_name: 'Road Surface', type: 'TEXT', desc: null },
  { name: 'weather', display_name: 'Weather', type: 'TEXT', desc: null },
  { name: 'traffic_control', display_name: 'Traffic Control', type: 'TEXT', desc: 'MV-104A traffic control device at the crash' },
  { name: 'wz_coded', display_name: 'Work-zone coded', type: 'BOOLEAN', desc: 'TrafficControl is HIGHWAY / MAINTENANCE / UTILITY WORK AREA (codes 12/13/14) — the only work-zone attribution CLEAR carries' },
  { name: 'wz_code', display_name: 'Work-zone code', type: 'TEXT', desc: 'highway | maintenance | utility' },
  { name: 'flagger_coded', display_name: 'Flagger coded', type: 'BOOLEAN', desc: 'TrafficControl is OFFICER/FLAGMAN/GUARD — usually a work zone, not always' },
  { name: 'commercial_vehicle', display_name: 'Commercial vehicle', type: 'BOOLEAN', desc: null },
  { name: 'non_reportable', display_name: 'Non-reportable', type: 'BOOLEAN', desc: null },
  { name: 'police_dept', display_name: 'Police Dept', type: 'TEXT', desc: null },
  { name: 'reporting_agency', display_name: 'Reporting Agency', type: 'TEXT', desc: null },
  { name: 'county_name', display_name: 'County', type: 'TEXT', desc: null },
  { name: 'municipality', display_name: 'Municipality', type: 'TEXT', desc: null },
  { name: 'on_street', display_name: 'On Street', type: 'TEXT', desc: null },
  { name: 'cross_street', display_name: 'Cross Street', type: 'TEXT', desc: null },
  { name: 'intersection_ind', display_name: 'At intersection', type: 'BOOLEAN', desc: null },
  { name: 'distance_from_int_m', display_name: 'Distance from intersection (m)', type: 'DOUBLE PRECISION', desc: null },
  { name: 'direction_from_int', display_name: 'Direction from intersection', type: 'TEXT', desc: null },
  { name: 'master_intersection_id', display_name: 'Intersection ID', type: 'TEXT', desc: null },
  { name: 'reference_marker', display_name: 'Reference Marker', type: 'TEXT', desc: 'NYSDOT reference marker where recorded (38% of CY2024)' },
  { name: 'functional_class_clear', display_name: 'Functional Class (CLEAR code)', type: 'SMALLINT', desc: 'CLEAR uses its own 1-14 codes — see functional_class_fhwa' },
  { name: 'functional_class_fhwa', display_name: 'Functional Class (FHWA)', type: 'SMALLINT', desc: 'Mapped through the CLEAR lookup table' },
  { name: 'functional_class_desc', display_name: 'Functional Class', type: 'TEXT', desc: null },
  { name: 'fc_interstate', display_name: 'Interstate (by class)', type: 'BOOLEAN', desc: null },
  { name: 'fc_urban', display_name: 'Urban (by class)', type: 'BOOLEAN', desc: null },
  { name: 'access_control', display_name: 'Access Control (raw)', type: 'TEXT', desc: null },
  { name: 'divided', display_name: 'Divided (raw)', type: 'TEXT', desc: null },
  { name: 'posted_speed', display_name: 'Posted Speed', type: 'SMALLINT', desc: null },
  { name: 'road_name', display_name: 'Road Name (inventory)', type: 'TEXT', desc: null },
  { name: 'maint_jurisdiction', display_name: 'Maintenance Jurisdiction', type: 'TEXT', desc: null },
  { name: 'owning_jurisdiction', display_name: 'Owning Jurisdiction', type: 'TEXT', desc: null },
  { name: 'apparent_factors', display_name: 'Apparent Contributing Factors', type: 'TEXT', desc: 'Per-vehicle driver/vehicle/environment factors; the vocabulary has no work-zone value' },
  { name: 'dmv_insert_date', display_name: 'DMV Insert Date', type: 'DATE', desc: 'When the crash reached CLEAR — the completeness clock' },
  { name: 'utm_easting', display_name: 'UTM Easting', type: 'DOUBLE PRECISION', desc: 'EPSG:26918' },
  { name: 'utm_northing', display_name: 'UTM Northing', type: 'DOUBLE PRECISION', desc: null },
  { name: 'lon', display_name: 'Longitude', type: 'DOUBLE PRECISION', desc: null },
  { name: 'lat', display_name: 'Latitude', type: 'DOUBLE PRECISION', desc: null },
  { name: 'has_point', display_name: 'Has point', type: 'BOOLEAN', desc: null },
];

/**
 * `wz_crash` — one row per work zone: M5. Crashes located inside the zone
 * during its active windows, by role (work extent vs upstream queue) and by
 * severity, the coded/flagger counts among them, the exposure denominator
 * from phase 2 and the rate per 100 million VMT. `rate_measured` is FALSE
 * where the exposure is incomplete — the rate is unknown, not zero.
 */
function wzCrashTableDDL(schema, table) {
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
    anchor_tmc TEXT,
    queue_extent_available BOOLEAN,
    buffer_m DOUBLE PRECISION,
    active_hours DOUBLE PRECISION,
    -- M5: crashes inside the zone while active
    crashes_total INTEGER,
    crashes_work_extent INTEGER,
    crashes_queue INTEGER,
    crashes_fatal INTEGER,
    crashes_injury INTEGER,
    crashes_pdo INTEGER,
    crashes_unknown INTEGER,
    kabco_k INTEGER,
    kabco_a INTEGER,
    kabco_b INTEGER,
    kabco_c INTEGER,
    kabco_o INTEGER,
    n_fatalities INTEGER,
    n_injuries INTEGER,
    crashes_wz_coded INTEGER,
    crashes_flagger INTEGER,
    crashes_time_uncertain INTEGER,
    -- located within the extent on an active day but outside the reported hours
    crashes_off_window INTEGER,
    -- the exposure denominator (phase 2) and the rate
    veh_through_wz DOUBLE PRECISION,
    vmt_through_wz DOUBLE PRECISION,
    exposure_complete BOOLEAN,
    rate_measured BOOLEAN,
    crash_rate_per_100m_vmt DOUBLE PRECISION,
    crash_rate_work_extent_per_100m_vmt DOUBLE PRECISION,
    injury_rate_per_100m_vmt DOUBLE PRECISION,
    crashes_per_1000_active_hours DOUBLE PRECISION,
    wkb_geometry public.geometry(Geometry, 4326)
);
CREATE INDEX IF NOT EXISTS ${table}_first_start_idx ON ${schema}.${table} (first_start);
CREATE INDEX IF NOT EXISTS ${table}_crashes_idx ON ${schema}.${table} (crashes_total);
CREATE INDEX IF NOT EXISTS ${table}_signif_idx ON ${schema}.${table} (is_significant_candidate);
CREATE INDEX IF NOT EXISTS ${table}_gix ON ${schema}.${table} USING gist (wkb_geometry);`;
}

const WZ_CRASH_COLUMN_TYPES = [
  ['wz_event_id', 'text'], ['first_start', 'timestamp'], ['last_end', 'timestamp'],
  ['region_name', 'text'], ['county_name', 'text'], ['facility', 'text'], ['work_activity_class', 'text'],
  ['is_interstate', 'boolean'], ['in_tma', 'boolean'], ['is_significant_candidate', 'boolean'],
  ['anchor_tmc', 'text'], ['queue_extent_available', 'boolean'], ['buffer_m', 'double precision'], ['active_hours', 'double precision'],
  ['crashes_total', 'integer'], ['crashes_work_extent', 'integer'], ['crashes_queue', 'integer'],
  ['crashes_fatal', 'integer'], ['crashes_injury', 'integer'], ['crashes_pdo', 'integer'], ['crashes_unknown', 'integer'],
  ['kabco_k', 'integer'], ['kabco_a', 'integer'], ['kabco_b', 'integer'], ['kabco_c', 'integer'], ['kabco_o', 'integer'],
  ['n_fatalities', 'integer'], ['n_injuries', 'integer'],
  ['crashes_wz_coded', 'integer'], ['crashes_flagger', 'integer'], ['crashes_time_uncertain', 'integer'], ['crashes_off_window', 'integer'],
  ['veh_through_wz', 'double precision'], ['vmt_through_wz', 'double precision'], ['exposure_complete', 'boolean'], ['rate_measured', 'boolean'],
  ['crash_rate_per_100m_vmt', 'double precision'], ['crash_rate_work_extent_per_100m_vmt', 'double precision'],
  ['injury_rate_per_100m_vmt', 'double precision'], ['crashes_per_1000_active_hours', 'double precision'],
];
const WZ_CRASH_COLUMNS = WZ_CRASH_COLUMN_TYPES.map(([c]) => c);

/** Batch insert for wz_crash; geometry from the spine (the anchor extent), like wz_delay. */
function wzCrashInsertSQL({ schema = WORK_ZONE_SCHEMA, table, rows, eventTable }) {
  if (!rows.length) return null;
  const values = rows
    .map((r) => `(${WZ_CRASH_COLUMNS.map((c) => sqlLiteral(r[c])).join(', ')})`)
    .join(',\n');
  const selectList = WZ_CRASH_COLUMN_TYPES
    .map(([c, t]) => (t === 'text' ? `v.${c}` : `v.${c}::${t}`)).join(', ');
  const updates = WZ_CRASH_COLUMNS.filter((c) => c !== 'wz_event_id')
    .map((c) => `${c} = EXCLUDED.${c}`).join(', ');
  return `INSERT INTO ${schema}.${table} (${WZ_CRASH_COLUMNS.join(', ')}, wkb_geometry)
SELECT ${selectList}, e.wkb_geometry
  FROM (VALUES ${values}) AS v(${WZ_CRASH_COLUMNS.join(', ')})
  LEFT JOIN ${schema}.${eventTable} e ON e.wz_event_id = v.wz_event_id
ON CONFLICT (wz_event_id) DO UPDATE SET ${updates}, wkb_geometry = EXCLUDED.wkb_geometry;`;
}

const WZ_CRASH_TABLE_COLUMNS = [
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
  { name: 'anchor_tmc', display_name: 'Anchor TMC', type: 'TEXT', desc: null },
  { name: 'queue_extent_available', display_name: 'Queue extent available', type: 'BOOLEAN', desc: 'Phase 5 measured a queue extent for this zone, so crashes on the approach could be located' },
  { name: 'buffer_m', display_name: 'Buffer (m)', type: 'DOUBLE PRECISION', desc: 'Distance from the segment centreline within which a crash counts' },
  { name: 'active_hours', display_name: 'Active hours', type: 'DOUBLE PRECISION', desc: 'Hours in the active windows the crashes were matched against' },
  { name: 'crashes_total', display_name: 'M5 · Crashes in zone', type: 'INTEGER', desc: 'Crashes within the buffer of the work extent or the queue extent during an active window' },
  { name: 'crashes_work_extent', display_name: 'On the work extent', type: 'INTEGER', desc: null },
  { name: 'crashes_queue', display_name: 'On the queue approach', type: 'INTEGER', desc: 'Within the buffer of the upstream queue segments but not of the anchor' },
  { name: 'crashes_fatal', display_name: 'Fatal', type: 'INTEGER', desc: null },
  { name: 'crashes_injury', display_name: 'Injury', type: 'INTEGER', desc: null },
  { name: 'crashes_pdo', display_name: 'Property damage only', type: 'INTEGER', desc: null },
  { name: 'crashes_unknown', display_name: 'Unknown severity', type: 'INTEGER', desc: null },
  { name: 'kabco_k', display_name: 'K', type: 'INTEGER', desc: null },
  { name: 'kabco_a', display_name: 'A', type: 'INTEGER', desc: null },
  { name: 'kabco_b', display_name: 'B', type: 'INTEGER', desc: null },
  { name: 'kabco_c', display_name: 'C', type: 'INTEGER', desc: null },
  { name: 'kabco_o', display_name: 'O', type: 'INTEGER', desc: null },
  { name: 'n_fatalities', display_name: 'Persons killed', type: 'INTEGER', desc: null },
  { name: 'n_injuries', display_name: 'Persons injured', type: 'INTEGER', desc: null },
  { name: 'crashes_wz_coded', display_name: 'Of which work-zone coded', type: 'INTEGER', desc: 'Located crashes whose police report also coded a work area — the under-coding check' },
  { name: 'crashes_flagger', display_name: 'Of which flagger coded', type: 'INTEGER', desc: null },
  { name: 'crashes_time_uncertain', display_name: 'Of which time uncertain', type: 'INTEGER', desc: 'Matched on a midnight timestamp' },
  { name: 'crashes_off_window', display_name: 'Nearby, outside the hours', type: 'INTEGER', desc: 'Within the extent on an active day but outside the reported active hours — not counted in M5' },
  { name: 'veh_through_wz', display_name: 'Vehicles through zone', type: 'DOUBLE PRECISION', desc: 'From phase 2' },
  { name: 'vmt_through_wz', display_name: 'VMT through zone', type: 'DOUBLE PRECISION', desc: 'From phase 2' },
  { name: 'exposure_complete', display_name: 'Exposure complete', type: 'BOOLEAN', desc: null },
  { name: 'rate_measured', display_name: 'Rate measured', type: 'BOOLEAN', desc: 'FALSE where exposure is incomplete — the rate is unknown, not zero. Filter on this before averaging.' },
  { name: 'crash_rate_per_100m_vmt', display_name: 'All-roles rate per 100M VMT (upper bound)', type: 'DOUBLE PRECISION', desc: 'crashes_total x 1e8 / vmt_through_wz. The numerator includes crashes on the upstream queue approach but the denominator is VMT through the WORK EXTENT only (phase 2 has no approach VMT), so this overstates; compare crash_rate_work_extent_per_100m_vmt like for like.' },
  { name: 'crash_rate_work_extent_per_100m_vmt', display_name: 'M5 · Work-extent crash rate per 100M VMT', type: 'DOUBLE PRECISION', desc: 'PRIMARY rate: crashes within the buffer of the work extent x 1e8 / VMT through that extent while active — numerator and denominator on the same segments' },
  { name: 'injury_rate_per_100m_vmt', display_name: 'Fatal + injury rate per 100M VMT', type: 'DOUBLE PRECISION', desc: 'All roles over work-extent VMT — the same upper-bound caveat as crash_rate_per_100m_vmt' },
  { name: 'crashes_per_1000_active_hours', display_name: 'Crashes per 1,000 active hours', type: 'DOUBLE PRECISION', desc: 'A time-based rate that needs no volume' },
];

/**
 * `wz_crash_match` — one row per (crash, zone): the evidence under wz_crash.
 * Every located crash, in window or not, with the role, the distance and the
 * gap to the nearest active window. The point is the crash's.
 */
function wzCrashMatchTableDDL(schema, table) {
  return `
CREATE SCHEMA IF NOT EXISTS ${schema};
CREATE TABLE IF NOT EXISTS ${schema}.${table} (
    ogc_fid SERIAL PRIMARY KEY,
    crash_id TEXT NOT NULL,
    wz_event_id TEXT NOT NULL,
    first_start TIMESTAMP,
    crash_date DATE,
    epoch SMALLINT,
    time_known BOOLEAN,
    time_uncertain BOOLEAN,
    role TEXT,
    distance_m DOUBLE PRECISION,
    dist_anchor_m DOUBLE PRECISION,
    dist_queue_m DOUBLE PRECISION,
    in_window BOOLEAN,
    active_that_day BOOLEAN,
    epoch_gap INTEGER,
    window_source TEXT,
    severity_class TEXT,
    severity_kabco TEXT,
    n_fatalities INTEGER,
    n_injuries INTEGER,
    wz_coded BOOLEAN,
    wz_code TEXT,
    flagger_coded BOOLEAN,
    on_street TEXT,
    facility TEXT,
    region_name TEXT,
    is_interstate BOOLEAN,
    is_significant_candidate BOOLEAN,
    wkb_geometry public.geometry(Point, 4326),
    UNIQUE (crash_id, wz_event_id)
);
CREATE INDEX IF NOT EXISTS ${table}_event_idx ON ${schema}.${table} (wz_event_id);
CREATE INDEX IF NOT EXISTS ${table}_start_idx ON ${schema}.${table} (first_start);
CREATE INDEX IF NOT EXISTS ${table}_inwin_idx ON ${schema}.${table} (in_window);
CREATE INDEX IF NOT EXISTS ${table}_gix ON ${schema}.${table} USING gist (wkb_geometry);`;
}

const WZ_CRASH_MATCH_COLUMN_TYPES = [
  ['crash_id', 'text'], ['wz_event_id', 'text'], ['first_start', 'timestamp'], ['crash_date', 'date'], ['epoch', 'smallint'],
  ['time_known', 'boolean'], ['time_uncertain', 'boolean'], ['role', 'text'],
  ['distance_m', 'double precision'], ['dist_anchor_m', 'double precision'], ['dist_queue_m', 'double precision'],
  ['in_window', 'boolean'], ['active_that_day', 'boolean'], ['epoch_gap', 'integer'], ['window_source', 'text'],
  ['severity_class', 'text'], ['severity_kabco', 'text'], ['n_fatalities', 'integer'], ['n_injuries', 'integer'],
  ['wz_coded', 'boolean'], ['wz_code', 'text'], ['flagger_coded', 'boolean'], ['on_street', 'text'],
  ['facility', 'text'], ['region_name', 'text'], ['is_interstate', 'boolean'], ['is_significant_candidate', 'boolean'],
];
const WZ_CRASH_MATCH_COLUMNS = WZ_CRASH_MATCH_COLUMN_TYPES.map(([c]) => c);

/** Batch insert for wz_crash_match; the point comes from the crash table. */
function wzCrashMatchInsertSQL({ schema = WORK_ZONE_SCHEMA, table, rows, crashTable }) {
  if (!rows.length) return null;
  if (!crashTable) throw new Error('wzCrashMatchInsertSQL: crashTable is required');
  const values = rows
    .map((r) => `(${WZ_CRASH_MATCH_COLUMNS.map((c) => sqlLiteral(r[c])).join(', ')})`)
    .join(',\n');
  const selectList = WZ_CRASH_MATCH_COLUMN_TYPES
    .map(([c, t]) => (t === 'text' ? `v.${c}` : `v.${c}::${t}`)).join(', ');
  const updates = WZ_CRASH_MATCH_COLUMNS.filter((c) => !['crash_id', 'wz_event_id'].includes(c))
    .map((c) => `${c} = EXCLUDED.${c}`).join(', ');
  return `INSERT INTO ${schema}.${table} (${WZ_CRASH_MATCH_COLUMNS.join(', ')}, wkb_geometry)
SELECT ${selectList}, c.wkb_geometry
  FROM (VALUES ${values}) AS v(${WZ_CRASH_MATCH_COLUMNS.join(', ')})
  LEFT JOIN ${crashTable} c ON c.crash_id = v.crash_id
ON CONFLICT (crash_id, wz_event_id) DO UPDATE SET ${updates}, wkb_geometry = EXCLUDED.wkb_geometry;`;
}

const WZ_CRASH_MATCH_TABLE_COLUMNS = [
  { name: 'crash_id', display_name: 'Case Number', type: 'TEXT', desc: 'Joins nys_crashes_clear' },
  { name: 'wz_event_id', display_name: 'Work Zone ID', type: 'TEXT', desc: 'Joins wz_event / wz_crash' },
  { name: 'first_start', display_name: 'Zone first start', type: 'TIMESTAMP', desc: null },
  { name: 'crash_date', display_name: 'Crash Date', type: 'DATE', desc: null },
  { name: 'epoch', display_name: 'Epoch', type: 'SMALLINT', desc: null },
  { name: 'time_known', display_name: 'Time known', type: 'BOOLEAN', desc: null },
  { name: 'time_uncertain', display_name: 'Time uncertain', type: 'BOOLEAN', desc: 'Midnight timestamp' },
  { name: 'role', display_name: 'Where', type: 'TEXT', desc: 'work_extent = within the buffer of the anchor segment; queue = of the upstream queue segments only' },
  { name: 'distance_m', display_name: 'Distance (m)', type: 'DOUBLE PRECISION', desc: 'To the nearest matched segment' },
  { name: 'dist_anchor_m', display_name: 'Distance to work extent (m)', type: 'DOUBLE PRECISION', desc: null },
  { name: 'dist_queue_m', display_name: 'Distance to queue extent (m)', type: 'DOUBLE PRECISION', desc: null },
  { name: 'in_window', display_name: 'In active window', type: 'BOOLEAN', desc: 'The crash fell inside one of the zone\'s active windows — the M5 condition' },
  { name: 'active_that_day', display_name: 'Zone active that day', type: 'BOOLEAN', desc: null },
  { name: 'epoch_gap', display_name: 'Periods outside the window', type: 'INTEGER', desc: '0 when inside; otherwise five-minute periods to the nearest window that day' },
  { name: 'window_source', display_name: 'Window source', type: 'TEXT', desc: null },
  { name: 'severity_class', display_name: 'Severity', type: 'TEXT', desc: null },
  { name: 'severity_kabco', display_name: 'KABCO', type: 'TEXT', desc: null },
  { name: 'n_fatalities', display_name: 'Persons killed', type: 'INTEGER', desc: null },
  { name: 'n_injuries', display_name: 'Persons injured', type: 'INTEGER', desc: null },
  { name: 'wz_coded', display_name: 'Work-zone coded', type: 'BOOLEAN', desc: null },
  { name: 'wz_code', display_name: 'Work-zone code', type: 'TEXT', desc: null },
  { name: 'flagger_coded', display_name: 'Flagger coded', type: 'BOOLEAN', desc: null },
  { name: 'on_street', display_name: 'On Street (crash report)', type: 'TEXT', desc: null },
  { name: 'facility', display_name: 'Facility (work zone)', type: 'TEXT', desc: null },
  { name: 'region_name', display_name: 'NYSDOT Region', type: 'TEXT', desc: null },
  { name: 'is_interstate', display_name: 'Interstate', type: 'BOOLEAN', desc: null },
  { name: 'is_significant_candidate', display_name: 'Significant Candidate', type: 'BOOLEAN', desc: null },
];


// ── phase 6: M4 fills the wz_speed differential columns in place ────────────

/**
 * Fill the approach side of the differential on wz_speed cells for one
 * vintage. Batched through a VALUES join on (wz_event_id, hour): the anchor
 * is single per zone, so (zone, hour) identifies the cell. The differential
 * and the flag are derived in SQL from the row's own speed_mean, so they
 * cannot drift from the evidence beside them. The window keeps a re-run of
 * one month from touching another month's cells.
 */
function wzSpeedApproachUpdateSQL({ schema = WORK_ZONE_SCHEMA, table, rows, thresholdMph, startDate, endDate }) {
  if (!rows.length) return null;
  if (!table) throw new Error('wzSpeedApproachUpdateSQL: table is required');
  const t = Number(thresholdMph);
  if (!Number.isFinite(t) || t <= 0) throw new Error('wzSpeedApproachUpdateSQL: thresholdMph must be a positive number');
  if (!startDate || !endDate) throw new Error('wzSpeedApproachUpdateSQL: startDate and endDate are required');
  const values = rows
    .map((r) => `(${sqlLiteral(r.wz_event_id)}, ${sqlLiteral(r.hour)}, ${sqlLiteral(r.approach_tmc)}, ${sqlLiteral(r.approach_speed)})`)
    .join(',\n');
  return `UPDATE ${schema}.${table} t
   SET approach_tmc = v.approach_tmc,
       approach_speed = v.approach_speed::double precision,
       differential_approach = round((v.approach_speed::double precision - t.speed_mean)::numeric, 2),
       exceeds_differential = CASE WHEN v.approach_speed IS NULL OR t.speed_mean IS NULL THEN NULL
                                   ELSE (v.approach_speed::double precision - t.speed_mean) > ${t} END
  FROM (VALUES ${values}) AS v(wz_event_id, hour, approach_tmc, approach_speed)
 WHERE t.wz_event_id = v.wz_event_id AND t.hour = v.hour::smallint
   AND t.first_start >= ${sqlLiteral(startDate)}::date
   AND t.first_start < (${sqlLiteral(endDate)}::date + INTERVAL '1 day');`;
}

/**
 * The baseline side needs no new observation: every wz_speed cell already
 * carries its contamination-cleaned baseline median beside its observed
 * mean. One statement fills the whole window, and clears the approach side
 * first so a cell whose corridor has no approach cannot keep a stale value
 * from an earlier run.
 */
function wzSpeedBaselineDropUpdateSQL({ schema = WORK_ZONE_SCHEMA, table, startDate, endDate }) {
  if (!table) throw new Error('wzSpeedBaselineDropUpdateSQL: table is required');
  if (!startDate || !endDate) throw new Error('wzSpeedBaselineDropUpdateSQL: startDate and endDate are required');
  return `UPDATE ${schema}.${table}
   SET differential_baseline = CASE WHEN baseline_speed IS NULL OR speed_mean IS NULL THEN NULL
                                    ELSE round((baseline_speed - speed_mean)::numeric, 2) END,
       approach_tmc = NULL, approach_speed = NULL, differential_approach = NULL, exceeds_differential = NULL
 WHERE first_start >= ${sqlLiteral(startDate)}::date
   AND first_start < (${sqlLiteral(endDate)}::date + INTERVAL '1 day');`;
}

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
  wzQueueTableDDL,
  wzQueueInsertSQL,
  WZ_QUEUE_COLUMNS,
  WZ_QUEUE_COLUMN_TYPES,
  WZ_QUEUE_TABLE_COLUMNS,
  wzQueueHourTableDDL,
  wzQueueHourInsertSQL,
  WZ_QUEUE_HOUR_COLUMNS,
  WZ_QUEUE_HOUR_COLUMN_TYPES,
  WZ_QUEUE_HOUR_TABLE_COLUMNS,
  clearCrashRawTableDDL,
  clearCrashRawGeometrySQL,
  nysCrashesClearTableDDL,
  nysCrashesClearInsertSQL,
  NYS_CRASHES_CLEAR_COLUMNS,
  NYS_CRASHES_CLEAR_COLUMN_TYPES,
  NYS_CRASHES_CLEAR_TABLE_COLUMNS,
  wzCrashTableDDL,
  wzCrashInsertSQL,
  WZ_CRASH_COLUMNS,
  WZ_CRASH_COLUMN_TYPES,
  WZ_CRASH_TABLE_COLUMNS,
  wzCrashMatchTableDDL,
  wzCrashMatchInsertSQL,
  WZ_CRASH_MATCH_COLUMNS,
  WZ_CRASH_MATCH_COLUMN_TYPES,
  WZ_CRASH_MATCH_TABLE_COLUMNS,
  wzSpeedApproachUpdateSQL,
  wzSpeedBaselineDropUpdateSQL,
};
