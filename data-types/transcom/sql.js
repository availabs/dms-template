/**
 * Pure SQL builders for the transcom plugin. No I/O — every function returns
 * SQL text (or a parameterized statement) so units can assert the load-bearing
 * parts and workers stay thin.
 *
 * Ported from the legacy avail-falcor transcom family:
 *   - events table DDL + batch insert  (transcom.worker.mjs / transcom_add.worker.mjs)
 *   - NYSDOT category + TMC-match + region-name enrichment updates
 *   - event_tmc table DDL + JSONB-expansion insert (eventTmc.js)
 *   - congestion table DDL/upsert + events-table congestion update
 *     (transcom_congestion.worker.mjs / processIncidents.js)
 *   - incidents query (processIncidents.getIncidents)
 *
 * The legacy hardcoded conflation source ids (nodes=237, ways=236, v0=238)
 * are exposed as DEFAULT_CONFLATION_SOURCE_IDS — descriptor/config fields
 * override them per run.
 */

// Legacy: getYearToConflationTableNames(pgEnv, 237, 236, 238)
const DEFAULT_CONFLATION_SOURCE_IDS = {
  conflation_nodes_source_id: 237,
  conflation_ways_source_id: 236,
  conflation_v0_source_id: 238,
};

// The legacy classification dataset is referenced by its physical table name.
const NYSDOT_CLASSIFICATION_TABLE = 'datasets.s479_v835_nysdot_transcom_event_classification';

/** SQL literal (pg-format %L equivalent for our value types). */
function sqlLiteral(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

// ── transcom events table ────────────────────────────────────────────────────

/** Insert column order — matches the legacy insertEvents() column list. */
const EVENT_COLUMNS = [
  'event_id', 'event_class', 'reporting_organization', 'start_date_time',
  'end_date_time', 'last_updatedate', 'close_date', 'estimated_duration_mins',
  'event_duration', 'facility', 'event_type', 'lanes_total_count',
  'lanes_affected_count', 'lanes_detail', 'lanes_status', 'description',
  'direction', 'county', 'city', 'city_article', 'primary_city',
  'secondary_city', 'point_lat', 'point_long', 'location_article',
  'primary_marker', 'secondary_marker', 'primary_location', 'secondary_location',
  'state', 'region_closed', 'point_datum', 'marker_units', 'marker_article',
  'summary_description', 'eventstatus', 'is_highway', 'icon_file',
  'start_incident_occured', 'started_at_date_time_comment', 'incident_reported',
  'incident_reported_comment', 'incident_verified', 'incident_verified_comment',
  'response_identified_and_dispatched', 'response_identified_and_dispatched_comment',
  'response_arrives_on_scene', 'response_arrives_on_scene_comment',
  'end_all_lanes_open_to_traffic', 'ended_at_date_time_comment',
  'response_departs_scene', 'response_departs_scene_comment',
  'time_to_return_to_normal_flow', 'time_to_return_to_normal_flow_comment',
  'no_of_vehicle_involved', 'secondary_event', 'secondary_event_types',
  'secondary_involvements', 'within_work_zone', 'truck_commercial_vehicle_involved',
  'shoulder_available', 'injury_involved', 'fatality_involved',
  'maintance_crew_involved', 'roadway_clearance', 'incident_clearance',
  'time_to_return_to_normal_flow_duration', 'duration', 'associated_impact_ids',
  'secondary_event_ids', 'is_transit', 'is_shoulder_lane', 'is_toll_lane',
  'lanes_affected_detail', 'to_facility', 'to_state', 'to_direction',
  'fatality_involved_associated_event_id', 'with_in_work_zone_associated_event_id',
  'to_lat', 'to_lon', 'primary_direction', 'secondary_direction',
  'is_both_direction', 'secondary_lanes_affected_count', 'secondary_lanes_detail',
  'secondary_lanes_status', 'secondary_lanes_total_count',
  'secondary_lanes_affected_detail', 'event_location_latitude',
  'event_location_longitude', 'tripcnt', 'tmclist', 'recoverytime', 'year',
  'datasource', 'datasourcevalue', 'day_of_week', 'tmc_geometry', 'month',
  'day_of_month', 'month_year',
];

/** Full events table DDL — the legacy column set, indexes and geometry trigger. */
function eventsTableDDL(schema, table) {
  return `
CREATE SCHEMA IF NOT EXISTS ${schema};
CREATE TABLE IF NOT EXISTS ${schema}.${table} (
    ogc_fid SERIAL PRIMARY KEY,
    event_id TEXT UNIQUE,
    event_class TEXT,
    reporting_organization TEXT,
    start_date_time TIMESTAMP,
    end_date_time TEXT,
    last_updatedate TIMESTAMP,
    close_date TIMESTAMP,
    estimated_duration_mins INTEGER,
    event_duration TEXT,
    facility TEXT,
    event_type TEXT,
    lanes_total_count SMALLINT,
    lanes_affected_count SMALLINT,
    lanes_detail TEXT,
    lanes_status TEXT,
    description TEXT,
    direction TEXT,
    county TEXT,
    city TEXT,
    city_article TEXT,
    primary_city TEXT,
    secondary_city TEXT,
    point_lat NUMERIC,
    point_long NUMERIC,
    location_article TEXT,
    primary_marker REAL,
    secondary_marker REAL,
    primary_location TEXT,
    secondary_location TEXT,
    state TEXT,
    region_closed BOOLEAN,
    point_datum TEXT,
    marker_units TEXT,
    marker_article TEXT,
    summary_description TEXT,
    eventstatus TEXT,
    is_highway BOOLEAN,
    icon_file TEXT,
    start_incident_occured TIMESTAMP,
    started_at_date_time_comment TEXT,
    incident_reported TIMESTAMP,
    incident_reported_comment TEXT,
    incident_verified TIMESTAMP,
    incident_verified_comment TEXT,
    response_identified_and_dispatched TIMESTAMP,
    response_identified_and_dispatched_comment TEXT,
    response_arrives_on_scene TIMESTAMP,
    response_arrives_on_scene_comment TEXT,
    end_all_lanes_open_to_traffic TIMESTAMP,
    ended_at_date_time_comment TEXT,
    response_departs_scene TIMESTAMP,
    response_departs_scene_comment TEXT,
    time_to_return_to_normal_flow TIMESTAMP,
    time_to_return_to_normal_flow_comment TEXT,
    no_of_vehicle_involved TEXT,
    secondary_event BOOLEAN,
    secondary_event_types TEXT,
    secondary_involvements TEXT,
    within_work_zone BOOLEAN,
    truck_commercial_vehicle_involved BOOLEAN,
    shoulder_available BOOLEAN,
    injury_involved BOOLEAN,
    fatality_involved BOOLEAN,
    maintance_crew_involved BOOLEAN,
    roadway_clearance TEXT,
    incident_clearance TEXT,
    time_to_return_to_normal_flow_duration TEXT,
    duration TEXT,
    associated_impact_ids TEXT,
    secondary_event_ids TEXT,
    is_transit BOOLEAN,
    is_shoulder_lane BOOLEAN,
    is_toll_lane BOOLEAN,
    lanes_affected_detail TEXT,
    to_facility TEXT,
    to_state TEXT,
    to_direction TEXT,
    fatality_involved_associated_event_id BOOLEAN,
    with_in_work_zone_associated_event_id TEXT,
    to_lat NUMERIC,
    to_lon NUMERIC,
    primary_direction TEXT,
    secondary_direction TEXT,
    is_both_direction BOOLEAN,
    secondary_lanes_affected_count SMALLINT,
    secondary_lanes_detail TEXT,
    secondary_lanes_status TEXT,
    secondary_lanes_total_count SMALLINT,
    secondary_lanes_affected_detail TEXT,
    event_location_latitude REAL,
    event_location_longitude REAL,
    tripcnt BOOLEAN,
    tmclist TEXT,
    recoverytime SMALLINT,
    year SMALLINT,
    datasource BOOLEAN,
    datasourcevalue TEXT,
    day_of_week SMALLINT,
    tmc_geometry TEXT,
    month SMALLINT,
    day_of_month TEXT,
    month_year TEXT,
    nysdot_general_category TEXT,
    nysdot_sub_category TEXT,
    nysdot_detailed_category TEXT,
    nysdot_waze_category TEXT,
    state_code TEXT,
    region_name TEXT,
    region_code TEXT,
    county_name TEXT,
    county_code TEXT,
    f_system SMALLINT,
    congestion_data JSONB,
    vehicle_delay NUMERIC,
    cost BIGINT,

    -- Geometry column
    wkb_geometry geometry(Point, 3857),

    -- Timestamps
    _created_timestamp TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    _modified_timestamp TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
) WITH (
    fillfactor = 100,
    autovacuum_enabled = false
);

CREATE INDEX IF NOT EXISTS idx_${table}_event_id ON ${schema}.${table} (event_id);

-- Index for null-filtered fields
CREATE INDEX IF NOT EXISTS idx_${table}_filter_fields
ON ${schema}.${table}(event_id)
WHERE tmclist IS NULL AND f_system IS NULL AND state_code IS NULL
  AND county_code IS NULL AND region_code IS NULL AND county_name IS NULL;

-- GIST index for spatial queries
CREATE INDEX IF NOT EXISTS idx_${table}_wkb_geometry
ON ${schema}.${table}
USING GIST (wkb_geometry);

-- Trigger function to set wkb_geometry
CREATE OR REPLACE FUNCTION set_wkb_geometry()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.point_lat IS NOT NULL AND NEW.point_long IS NOT NULL THEN
    NEW.wkb_geometry := ST_Transform(
      ST_SetSRID(ST_MakePoint(NEW.point_long, NEW.point_lat), 4326),
      3857
    );
  ELSE
    NEW.wkb_geometry := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on INSERT and UPDATE
DROP TRIGGER IF EXISTS trg_set_wkb_geometry ON ${schema}.${table};
CREATE TRIGGER trg_set_wkb_geometry
BEFORE INSERT OR UPDATE ON ${schema}.${table}
FOR EACH ROW
EXECUTE FUNCTION set_wkb_geometry();`;
}

/** Batch insert of normalized event rows (see events.normalizeEvent). */
function insertEventsSQL(schema, table, normalizedRows) {
  const values = normalizedRows
    .map((row) => `(${EVENT_COLUMNS.map((c) => sqlLiteral(row[c])).join(', ')})`)
    .join(',\n');
  return `INSERT INTO ${schema}.${table} (${EVENT_COLUMNS.join(', ')})
VALUES ${values}
ON CONFLICT (event_id) DO NOTHING;`;
}

/** NYSDOT category enrichment from the classification dataset. */
function nysdotCategoryUpdateSQL({ schema, table, startTimestamp, endTimestamp, classificationTable = NYSDOT_CLASSIFICATION_TABLE }) {
  return `WITH matched_event_types AS (
    SELECT
        a.event_id,
        b.general_category,
        b.sub_category,
        b.detailed_category,
        b.waze_category
    FROM ${schema}.${table} a
    JOIN ${classificationTable} b
        ON LOWER(a.event_type) = LOWER(b.event_type)
    WHERE
        a.start_date_time >= '${startTimestamp}'
        AND a.start_date_time <= '${endTimestamp}'
    )
    UPDATE ${schema}.${table} AS t
    SET
    nysdot_general_category = m.general_category,
    nysdot_sub_category = m.sub_category,
    nysdot_detailed_category = m.detailed_category,
    nysdot_waze_category = m.waze_category
    FROM matched_event_types m
    WHERE t.event_id = m.event_id;`;
}

// Shared CTE body for the spatial/similarity TMC match.
function tmcMatchCTE({ schema, table, geomDataTable, year, onlyMissingTmclist, withMetaFields }) {
  const metaSelect = withMetaFields
    ? `,
          g.f_system,
          g.state_code,
          g.county_code,
          g.region_code,
          g.county_name`
    : '';
  const metaGeomCols = withMetaFields
    ? `,
            f_system,
            state_code,
            county_code,
            region_code,
            county_name`
    : '';
  const metaOut = withMetaFields
    ? `,
        f_system,
        state_code,
        county_code,
        region_code,
        county_name`
    : '';
  return `WITH base_events AS (
        SELECT
          event_id,
          facility,
          wkb_geometry AS point,
          CASE
            WHEN direction ILIKE 'both%' THEN
              CASE
                WHEN primary_direction = 'northbound' THEN 'N'
                WHEN primary_direction = 'southbound' THEN 'S'
                WHEN primary_direction = 'eastbound'  THEN 'E'
                WHEN primary_direction = 'westbound'  THEN 'W'
                ELSE NULL
              END
            ELSE
              CASE
                WHEN direction = 'northbound' THEN 'N'
                WHEN direction = 'southbound' THEN 'S'
                WHEN direction = 'eastbound'  THEN 'E'
                WHEN direction = 'westbound' THEN 'W'
                ELSE NULL
              END
          END AS selected_direction
        FROM ${schema}.${table}
        WHERE year = ${year} AND state = 'NY'${onlyMissingTmclist ? `
            AND tmclist IS NULL` : ''}
      ),
      matched_tmcs AS (
        SELECT
          e.event_id,
          g.tmc,
          e.facility,
          similarity(e.facility, g.road) AS sim_score,
          g.direction,
          e.selected_direction${metaSelect}
        FROM base_events e
        JOIN (
          SELECT
            tmc,
            road,
            direction${metaGeomCols},
            ST_Transform(ST_SetSRID(wkb_geometry, 4326), 3857) AS geometry
          FROM ${geomDataTable}
          WHERE year = ${year}
        ) g
        ON ST_DWithin(e.point, g.geometry, 18)
      ),
      ranked_tmcs AS (
        SELECT *,
          ROW_NUMBER() OVER (
            PARTITION BY event_id
            ORDER BY
              CASE WHEN direction = selected_direction THEN 0 ELSE 1 END,
              sim_score DESC
          ) AS rn
        FROM matched_tmcs
      )
      SELECT
        event_id,
        tmc${metaOut}
      FROM ranked_tmcs
      WHERE rn = 1`;
}

/** Publish variant: set tmclist + the denormalized roadway fields for a year. */
function tmcMatchUpdateSQL({ schema, table, geomDataTable, year }) {
  return `UPDATE ${schema}.${table} AS b
    SET
      tmclist = s.tmc,
      f_system = s.f_system,
      state_code = s.state_code,
      county_code = s.county_code,
      region_code = s.region_code,
      county_name = s.county_name
    FROM (
      ${tmcMatchCTE({ schema, table, geomDataTable, year, onlyMissingTmclist: false, withMetaFields: true })}
    ) s
    WHERE b.event_id = s.event_id;`;
}

/** Add variant step 1: only fill rows that still have NULL tmclist. */
function tmcMatchFillMissingSQL({ schema, table, geomDataTable, year }) {
  return `UPDATE ${schema}.${table} AS b
    SET
      tmclist = s.tmc
    FROM (
      ${tmcMatchCTE({ schema, table, geomDataTable, year, onlyMissingTmclist: true, withMetaFields: false })}
    ) s
    WHERE b.event_id = s.event_id;`;
}

/** Add variant step 2: backfill roadway metadata from the first tmc of tmclist. */
function tmcMetaFromTmclistSQL({ schema, table, geomDataTable, year }) {
  return `UPDATE ${schema}.${table} AS b
    SET
      f_system    = g.f_system,
      state_code  = g.state_code,
      county_code = g.county_code,
      region_code = g.region_code,
      county_name = g.county_name
    FROM (
      SELECT
        event_id,
        (string_to_array(tmclist, ','))[1] AS tmc
      FROM ${schema}.${table}
      WHERE year = ${year}
        AND state = 'NY'
        AND tmclist IS NOT NULL
    ) e
    JOIN ${geomDataTable} g
      ON g.tmc = e.tmc
     AND g.year = ${year}
    WHERE b.event_id = e.event_id;`;
}

/** region_code -> region_name via ny.nysdot_region_names. */
function regionNameUpdateSQL({ schema, table, onlyNull = false }) {
  return `UPDATE ${schema}.${table} AS t
    SET region_name = n.name
    FROM ny.nysdot_region_names AS n
    WHERE t.region_code::text = n.region::text${onlyNull ? `
    AND t.region_name IS NULL AND t.state = 'NY'` : ''};`;
}

// ── transcom_event_tmc table ─────────────────────────────────────────────────

/**
 * Event->TMC expansion table. Ported from eventTmc.js EventTmcPublish; the
 * hardcoded `ALTER TABLE … OWNER TO npmrds_admin` is intentionally dropped
 * (role-specific, not portable across environments).
 */
function eventTmcTableDDL(schema, table) {
  return `
CREATE SCHEMA IF NOT EXISTS ${schema};
CREATE TABLE IF NOT EXISTS ${schema}.${table}
(
    ogc_fid             BIGSERIAL PRIMARY KEY,
    event_id            TEXT NOT NULL,
    tmc                 TEXT NOT NULL,
    bound_start_date    DATE,
    bound_start_time    INT,
    bound_end_date      DATE,
    bound_end_time      INT,
    delay               DOUBLE PRECISION,
    raw_delay           DOUBLE PRECISION,
    direction           TEXT,
    county              TEXT,
    state               TEXT,
    day_of_week         TEXT,
    wkb_geometry        geometry(MultiLineString, 4326),
    month               INT,
    day_of_month        INT,
    month_year          TEXT,
    nysdot_sub_category TEXT,
    state_code          TEXT,
    region_name         TEXT,
    f_system            INT,
    tmclinear           BIGINT,
    road_name           TEXT,
    CONSTRAINT ${table}_event_tmc_uniq UNIQUE (event_id, tmc)
);

CREATE INDEX IF NOT EXISTS idx_${table}_event_id ON ${schema}.${table} (event_id);
CREATE INDEX IF NOT EXISTS idx_${table}_tmc ON ${schema}.${table} (tmc);
CREATE INDEX IF NOT EXISTS idx_${table}_state ON ${schema}.${table} (state);
CREATE INDEX IF NOT EXISTS idx_${table}_county ON ${schema}.${table} (county);
CREATE INDEX IF NOT EXISTS idx_${table}_wkb_geometry ON ${schema}.${table} USING GIST (wkb_geometry);`;
}

/** Expand congestion_data into per-(event, tmc) rows (eventTmc.js LoadEventTmcData). */
function eventTmcInsertSQL({ eventTmcTable, transcomTable, geomTable, startDate, endDate }) {
  return `INSERT INTO ${eventTmcTable} (
    event_id,
    tmc,
    bound_start_date,
    bound_start_time,
    bound_end_date,
    bound_end_time,
    delay,
    raw_delay,
    wkb_geometry,
    tmclinear,
    direction,
    county,
    state,
    day_of_week,
    month,
    day_of_month,
    month_year,
    nysdot_sub_category,
    state_code,
    region_name,
    f_system
)
SELECT
    t.event_id,
    tmc_keys.tmc_key AS tmc,
    COALESCE(
        (tmc_bounds.value->0->>0)::date,
        (t.congestion_data->'dates'->>0)::date
    ) AS bound_start_date,
    COALESCE(
        (tmc_bounds.value->0->>1)::int,
        (t.congestion_data->>'startTime')::int
    ) AS bound_start_time,
    COALESCE(
        (tmc_bounds.value->1->>0)::date,
        (t.congestion_data->'dates'->>0)::date
    ) AS bound_end_date,
    COALESCE(
        (tmc_bounds.value->1->>1)::int,
        (t.congestion_data->>'endTime')::int
    ) AS bound_end_time,
    (t.congestion_data->'tmcDelayData'->>tmc_keys.tmc_key)::float AS delay,
    (t.congestion_data->'rawTmcDelayData'->>tmc_keys.tmc_key)::float AS raw_delay,
    g.wkb_geometry,
    g.tmclinear,
    t.direction,
    t.county,
    t.state,
    t.day_of_week,
    t.month,
    t.day_of_month::int,
    t.month_year,
    t.nysdot_sub_category,
    t.state_code,
    t.region_name,
    t.f_system
FROM ${transcomTable} t
JOIN LATERAL (
    SELECT DISTINCT key AS tmc_key
    FROM jsonb_each(t.congestion_data->'tmcBounds')
    UNION
    SELECT DISTINCT key AS tmc_key
    FROM jsonb_each(t.congestion_data->'tmcDelayData')
) AS tmc_keys ON TRUE
LEFT JOIN LATERAL jsonb_each(t.congestion_data->'tmcBounds') AS tmc_bounds
    ON tmc_bounds.key = tmc_keys.tmc_key
LEFT JOIN ${geomTable} g
    ON g.tmc = tmc_keys.tmc_key
   AND g.year = EXTRACT(YEAR FROM '${startDate}'::date)
WHERE t.start_date_time::timestamp >= '${startDate}'::timestamp
    AND t.start_date_time::timestamp <= '${endDate}'::timestamp
ON CONFLICT (event_id, tmc) DO UPDATE
SET
    bound_start_date    = EXCLUDED.bound_start_date,
    bound_start_time    = EXCLUDED.bound_start_time,
    bound_end_date      = EXCLUDED.bound_end_date,
    bound_end_time      = EXCLUDED.bound_end_time,
    delay               = EXCLUDED.delay,
    raw_delay           = EXCLUDED.raw_delay,
    wkb_geometry        = EXCLUDED.wkb_geometry,
    tmclinear           = EXCLUDED.tmclinear,
    direction           = EXCLUDED.direction,
    county              = EXCLUDED.county,
    state               = EXCLUDED.state,
    day_of_week         = EXCLUDED.day_of_week,
    month               = EXCLUDED.month,
    day_of_month        = EXCLUDED.day_of_month,
    month_year          = EXCLUDED.month_year,
    nysdot_sub_category = EXCLUDED.nysdot_sub_category,
    state_code          = EXCLUDED.state_code,
    region_name         = EXCLUDED.region_name,
    f_system            = EXCLUDED.f_system;`;
}

// ── transcom_congestion table ────────────────────────────────────────────────

function congestionTableDDL(schema, table) {
  return `
CREATE SCHEMA IF NOT EXISTS ${schema};
CREATE TABLE IF NOT EXISTS ${schema}.${table} (
  event_id TEXT PRIMARY KEY,
  congestion_data JSONB
);`;
}

/** Parameterized upsert — worker passes [event_id, congestion_data]. */
function congestionUpsertSQL(schema, table) {
  return `INSERT INTO ${schema}.${table} (event_id, congestion_data)
VALUES ($1, $2)
ON CONFLICT (event_id)
DO UPDATE
SET congestion_data = excluded.congestion_data;`;
}

/**
 * Copy congestion results back onto the events table (vehicle_delay, cost).
 * cost is the class-weighted value-of-time dollars precomputed per event in
 * congestion.js#assembleCongestionData (Σ_tmc rawTmcDelay[tmc] × VOT_eff(tmc)),
 * stored on congestion_data.cost — replaces the old flat 20×rawVehicleDelay.
 * COALESCE keeps pre-VOT blobs (no cost key) from nulling the column.
 */
function updateEventsCongestionSQL({ eventsTable, congestionTable, geoid }) {
  // geoid-scoped variant: cheap per-county writeback after each county completes,
  // so the events-table resume markers (congestion_data ? 'probe') survive a
  // mid-run crash (2026-06-11 finding: year-end-only writeback orphaned 29
  // counties of markers after an OOM). The unscoped form remains the final sync.
  const scope = geoid ? `
  AND t.county_code = '${String(geoid).replace(/'/g, "''")}'` : '';
  return `UPDATE ${eventsTable} AS t
SET
  congestion_data = m.congestion_data,
  vehicle_delay = (m.congestion_data->>'vehicleDelay')::NUMERIC,
  cost = ROUND(COALESCE(
    (m.congestion_data->>'cost')::NUMERIC,
    20 * (m.congestion_data->>'rawVehicleDelay')::NUMERIC
  ))
FROM ${congestionTable} m
WHERE t.event_id = m.event_id${scope};`;
}

/** Candidate incidents for one county/month window (processIncidents.getIncidents). */
function incidentsSQL({ transcomTable, v0Table, waysTable, geoid, startDate, endDate, reprocess = false, resumeV2 = false }) {
  return `WITH filtered_trans AS (
    SELECT *
    FROM ${transcomTable}
    WHERE start_date_time >= '${startDate}'::timestamp
      AND COALESCE(close_date, last_updatedate)::timestamp <= '${endDate}'::timestamp
      AND county_code = '${geoid}'
      AND nysdot_general_category IS NOT NULL${reprocess ? (resumeV2 ? `
      AND (congestion_data IS NULL OR NOT (congestion_data ? 'probe'))` : '') : `
      AND congestion_data IS NULL`}
    )
    SELECT DISTINCT ON (trans.event_id)
        trans.event_id,
        CASE
            WHEN cv0.osm_fwd = 0 THEN -COALESCE(cw.node_ids[1], 0)
            ELSE COALESCE(cw.node_ids[1], 0)
        END AS node_id,
        cv0.id AS conflation_way_id,
        trans.duration,
        (trans.nysdot_general_category = 'Construction') AS is_construction,
        trans.start_date_time::TEXT AS open_time,
        COALESCE(trans.close_date, trans.last_updatedate)::TEXT AS close_time,
        (trans.start_date_time > COALESCE(trans.close_date, trans.last_updatedate)::TIMESTAMP) AS bad_dates
    FROM filtered_trans AS trans
    LEFT JOIN ${v0Table} AS cv0
        ON cv0.tmc = ANY(string_to_array(trans.tmclist, ','))
    LEFT JOIN ${waysTable} AS cw
        ON cw.id = cv0.id
    WHERE cv0.n < 7
    ORDER BY trans.event_id, cv0.tmc NULLS LAST, cv0.id;`;
}

/** Per-year TMC attributes from the npmrds geometry year table. */
function tmcAttributesSQL(geomYearDataTable) {
  return `SELECT
    tmc,
    avg_speedlimit,
    ROUND(CAST(miles AS NUMERIC), 6)::double precision AS miles,
    CAST((miles / NULLIF(avg_speedlimit, 0)) * 3600 AS NUMERIC)::double precision AS avg_tt,
    CAST((miles / GREATEST(20, COALESCE(avg_speedlimit, 0) * 0.6)) * 3600 AS NUMERIC)::double precision AS threshold,
    congestion_level,
    directionality,
    CAST(COALESCE(aadt, 0) AS INTEGER) AS aadt,
    CAST(COALESCE(aadt_singl, 0) AS INTEGER) AS aadt_singl,
    CAST(COALESCE(aadt_combi, 0) AS INTEGER) AS aadt_combi,
    CAST(COALESCE(f_system, 3) AS INTEGER) AS f_system,
    CAST(COALESCE(faciltype, 2) AS INTEGER) AS faciltype
FROM ${geomYearDataTable};`;
}

/** Free-flow travel time per tmc from a map21 view joined to the geometry table. */
function tmcMeasuresSQL({ map21DataTable, geomYearDataTable }) {
  return `SELECT
    o.tmc,
    (t.miles / o.speed_pctl_85) * 3600 as freeflow_tt
  FROM ${map21DataTable} o
  JOIN ${geomYearDataTable} t
  ON o.tmc = t.tmc;`;
}

/** Conflation graph nodes (SELECT port of the legacy COPY-to-stdout stream). */
function conflationNodesSQL({ nodesTable, waysTable, v0Table }) {
  return `SELECT id, ST_AsGeoJSON(wkb_geometry) AS geom
  FROM ${nodesTable}
  WHERE id IN (
    SELECT unnest(a.node_ids)
    FROM ${waysTable} AS a
      JOIN ${v0Table} AS b
        USING(id)
    WHERE n < 7
  )
  ORDER BY id;`;
}

/** Conflation graph ways (SELECT port of the legacy COPY-to-stdout stream). */
function conflationWaysSQL({ waysTable, v0Table }) {
  return `SELECT a.id, COALESCE(osm_fwd, 1) AS osm_fwd, b.tmc, array_to_json(a.node_ids) AS node_ids
  FROM ${waysTable} AS a
    JOIN ${v0Table} AS b
      USING(id)
  WHERE n < 7
  ORDER BY id;`;
}

// ── metadata.columns descriptors (the cross-DAMA contract) ──────────────────

// Curated subset of the ~115 physical event columns (the full payload stays
// queryable on the table; this only drives the default Table page).
const EVENTS_TABLE_COLUMNS = [
  { name: 'event_id', display_name: 'Event ID', type: 'TEXT', desc: null },
  { name: 'event_class', display_name: 'Event Class', type: 'TEXT', desc: null },
  { name: 'event_type', display_name: 'Event Type', type: 'TEXT', desc: null },
  { name: 'nysdot_general_category', display_name: 'NYSDOT General Category', type: 'TEXT', desc: null },
  { name: 'nysdot_sub_category', display_name: 'NYSDOT Sub Category', type: 'TEXT', desc: null },
  { name: 'reporting_organization', display_name: 'Reporting Organization', type: 'TEXT', desc: null },
  { name: 'start_date_time', display_name: 'Start', type: 'TIMESTAMP', desc: null },
  { name: 'close_date', display_name: 'Closed', type: 'TIMESTAMP', desc: null },
  { name: 'facility', display_name: 'Facility', type: 'TEXT', desc: null },
  { name: 'direction', display_name: 'Direction', type: 'TEXT', desc: null },
  { name: 'description', display_name: 'Description', type: 'TEXT', desc: null },
  { name: 'county', display_name: 'County', type: 'TEXT', desc: null },
  { name: 'county_name', display_name: 'County Name', type: 'TEXT', desc: null },
  { name: 'region_name', display_name: 'NYSDOT Region', type: 'TEXT', desc: null },
  { name: 'state', display_name: 'State', type: 'TEXT', desc: null },
  { name: 'point_lat', display_name: 'Latitude', type: 'NUMERIC', desc: null },
  { name: 'point_long', display_name: 'Longitude', type: 'NUMERIC', desc: null },
  { name: 'tmclist', display_name: 'TMC', type: 'TEXT', desc: null },
  { name: 'f_system', display_name: 'F-System', type: 'SMALLINT', desc: null },
  { name: 'year', display_name: 'Year', type: 'SMALLINT', desc: null },
  { name: 'vehicle_delay', display_name: 'Vehicle Delay (hrs)', type: 'NUMERIC', desc: null },
  { name: 'cost', display_name: 'Cost ($)', type: 'BIGINT', desc: null },
  { name: 'congestion_data', display_name: 'Congestion Data', type: 'JSONB', desc: null },
];

const EVENT_TMC_TABLE_COLUMNS = [
  { name: 'event_id', display_name: 'Event ID', type: 'TEXT', desc: null },
  { name: 'tmc', display_name: 'TMC', type: 'TEXT', desc: null },
  { name: 'bound_start_date', display_name: 'Bound Start Date', type: 'DATE', desc: null },
  { name: 'bound_start_time', display_name: 'Bound Start Epoch', type: 'INTEGER', desc: null },
  { name: 'bound_end_date', display_name: 'Bound End Date', type: 'DATE', desc: null },
  { name: 'bound_end_time', display_name: 'Bound End Epoch', type: 'INTEGER', desc: null },
  { name: 'delay', display_name: 'Delay', type: 'DOUBLE PRECISION', desc: null },
  { name: 'raw_delay', display_name: 'Raw Delay', type: 'DOUBLE PRECISION', desc: null },
  { name: 'direction', display_name: 'Direction', type: 'TEXT', desc: null },
  { name: 'county', display_name: 'County', type: 'TEXT', desc: null },
  { name: 'state', display_name: 'State', type: 'TEXT', desc: null },
  { name: 'day_of_week', display_name: 'Day of Week', type: 'TEXT', desc: null },
  { name: 'month', display_name: 'Month', type: 'INTEGER', desc: null },
  { name: 'month_year', display_name: 'Month-Year', type: 'TEXT', desc: null },
  { name: 'nysdot_sub_category', display_name: 'NYSDOT Sub Category', type: 'TEXT', desc: null },
  { name: 'region_name', display_name: 'NYSDOT Region', type: 'TEXT', desc: null },
  { name: 'f_system', display_name: 'F-System', type: 'INTEGER', desc: null },
  { name: 'tmclinear', display_name: 'TMC Linear', type: 'BIGINT', desc: null },
  { name: 'road_name', display_name: 'Road Name', type: 'TEXT', desc: null },
];

const CONGESTION_TABLE_COLUMNS = [
  { name: 'event_id', display_name: 'Event ID', type: 'TEXT', desc: null },
  { name: 'congestion_data', display_name: 'Congestion Data', type: 'JSONB', desc: null },
];

module.exports = {
  DEFAULT_CONFLATION_SOURCE_IDS,
  NYSDOT_CLASSIFICATION_TABLE,
  sqlLiteral,
  EVENT_COLUMNS,
  eventsTableDDL,
  insertEventsSQL,
  nysdotCategoryUpdateSQL,
  tmcMatchUpdateSQL,
  tmcMatchFillMissingSQL,
  tmcMetaFromTmclistSQL,
  regionNameUpdateSQL,
  eventTmcTableDDL,
  eventTmcInsertSQL,
  congestionTableDDL,
  congestionUpsertSQL,
  updateEventsCongestionSQL,
  incidentsSQL,
  tmcAttributesSQL,
  tmcMeasuresSQL,
  conflationNodesSQL,
  conflationWaysSQL,
  EVENTS_TABLE_COLUMNS,
  EVENT_TMC_TABLE_COLUMNS,
  CONGESTION_TABLE_COLUMNS,
};
