-- =====================================================================
-- Work-zone events × NYSDOT capital projects — joinability measurement
--
-- Phase 1a of the work_zone pipeline:
--   planning/transportny/tasks/current/workzone-performance-data-type-pipeline.md
--
-- Measures how well TRANSCOM work-zone events can be tied to a capital
-- project, and assigns each event a match confidence. Read-only.
--
--   psql -f join_transcom.sql          (or any client; it only SELECTs
--                                       into TEMP tables)
--
-- Inputs, both in npmrds2:
--   transcom.s956_v1947_transcom_main_v2                      events (source 956 / view 1947)
--   gis_datasets.s2185_v3830_nysdot_capital_projects_estip…    projects (source 2185 / view 3830)
--
-- Change the window in `ev` below. Note the VINTAGE CONSTRAINT: the loaded
-- project dataset is STIP 26-29, so it can only be expected to match events
-- from 2026 onward. Joining it to 2024 events measures the vintage gap, not
-- the method.
-- =====================================================================

-- ── events: the NY work-zone family for a window ─────────────────────
-- Event geometry is stored at SRID 3857; point_lat/point_long are plain
-- 4326 degrees and 100% populated, so the point is built from those.
CREATE TEMP TABLE ev AS
SELECT event_id, facility, county_name, nysdot_sub_category, description,
       -- facility is clean ('I-81', 'I-90 - NYS Thruway', 'NY 27') → a
       -- comparable token ('I81', 'NY27') plus the bare number.
       upper(regexp_replace(facility,'^\s*(I|NY|US)[\s-]*(\d{1,3}[A-Za-z]?).*$','\1'))
         || upper(regexp_replace(facility,'^\s*(I|NY|US)[\s-]*(\d{1,3}[A-Za-z]?).*$','\2')) AS fac_tok,
       upper(regexp_replace(facility,'^\s*(I|NY|US)[\s-]*(\d{1,3}[A-Za-z]?).*$','\2'))       AS fac_num,
       ST_SetSRID(ST_MakePoint(point_long::float8, point_lat::float8), 4326)                 AS pt
  FROM transcom.s956_v1947_transcom_main_v2
 WHERE state = 'NY'
   AND nysdot_sub_category IN ('Construction','Maintenance','Emergency Operations')
   AND start_date_time >= '2026-01-01' AND start_date_time < '2026-09-01';
CREATE INDEX ON ev USING gist (pt);
ANALYZE ev;

-- ── projects: tier 1 only — the ones with their own geometry ─────────
CREATE TEMP TABLE pr AS
SELECT pin, project_title, county, location_method, is_construction_funded,
       construction_amount, wkb_geometry AS geom,
       string_to_array(locator_routes, ' ') AS routes
  FROM gis_datasets.s2185_v3830_nysdot_capital_projects_estip__stip__ris
 WHERE location_tier = 1 AND wkb_geometry IS NOT NULL;
CREATE INDEX ON pr USING gist (geom);
ANALYZE pr;

-- ── candidate pairs within 1 km ──────────────────────────────────────
-- The degree tolerance is an index-assisted prefilter — 1° of longitude is
-- ~78 km at NY latitudes, so 1000/78000 is generous enough not to miss;
-- the geography ST_DWithin is the exact test.
CREATE TEMP TABLE m AS
SELECT e.event_id, e.facility, e.fac_tok, e.nysdot_sub_category,
       p.pin, p.project_title, p.location_method, p.is_construction_funded,
       ST_Distance(e.pt::geography, p.geom::geography) AS dist_m,
       (p.routes IS NOT NULL)                                            AS decidable,
       (e.fac_tok = ANY(p.routes) OR ('?' || e.fac_num) = ANY(p.routes))  AS route_agrees
  FROM ev e
  JOIN pr p ON ST_DWithin(p.geom, e.pt, 1000.0 / 78000.0)
           AND ST_DWithin(p.geom::geography, e.pt::geography, 1000);
CREATE INDEX ON m (event_id);
ANALYZE m;

-- ── 1. recall and precision by threshold ─────────────────────────────
-- `route_agrees` is only decidable for the ~29% of projects whose text cites
-- a route, so precision is reported over decidable pairs only. Computing it
-- over all pairs understates it by construction.
SELECT 'recall/precision' AS report, v.t AS threshold_m,
       count(DISTINCT x.event_id)                                         AS events_matched,
       round(100.0 * count(DISTINCT x.event_id) / (SELECT count(*) FROM ev), 1) AS pct_events,
       count(DISTINCT x.pin)                                              AS projects_matched,
       count(*) FILTER (WHERE x.decidable)                                AS decidable_pairs,
       round(100.0 * count(*) FILTER (WHERE x.decidable AND x.route_agrees)
             / NULLIF(count(*) FILTER (WHERE x.decidable), 0), 1)         AS pct_precision
  FROM (VALUES (50),(100),(250),(500),(1000)) v(t)
  JOIN m x ON x.dist_m <= v.t
 GROUP BY v.t ORDER BY v.t;

-- ── 2. ambiguity: how many projects compete for one event ────────────
SELECT 'ambiguity' AS report, v.t AS threshold_m,
       round(avg(q.n), 2) AS mean_candidates, max(q.n) AS max_candidates,
       round(100.0 * count(*) FILTER (WHERE q.n = 1) / count(*), 1) AS pct_unambiguous
  FROM (VALUES (100),(250),(500),(1000)) v(t)
  JOIN LATERAL (SELECT event_id, count(DISTINCT pin) AS n
                  FROM m WHERE dist_m <= v.t GROUP BY event_id) q ON TRUE
 GROUP BY v.t ORDER BY v.t;

-- ── 3. the deliverable: a confidence per event ───────────────────────
-- A and B are the usable matches. C is a near miss on the wrong road,
-- D/E have no defensible candidate.
CREATE TEMP TABLE assign AS
SELECT event_id,
       CASE WHEN min(dist_m) FILTER (WHERE route_agrees AND dist_m <= 250) IS NOT NULL
              THEN 'A: route agrees <=250m'
            WHEN min(dist_m) FILTER (WHERE NOT decidable AND dist_m <= 100) IS NOT NULL
              THEN 'B: <=100m, project states no route'
            WHEN min(dist_m) FILTER (WHERE dist_m <= 250) IS NOT NULL
              THEN 'C: nearby but route disagrees'
            ELSE 'D: only >250m' END AS confidence
  FROM m GROUP BY event_id;

SELECT 'confidence' AS report, confidence, count(*) AS events,
       round(100.0 * count(*) / (SELECT count(*) FROM ev), 1) AS pct_of_wz_events
  FROM assign GROUP BY confidence
UNION ALL
SELECT 'confidence', 'E: no tier-1 project within 1km',
       (SELECT count(*) FROM ev) - (SELECT count(*) FROM assign),
       round(100.0 * ((SELECT count(*) FROM ev) - (SELECT count(*) FROM assign))
             / (SELECT count(*) FROM ev), 1)
 ORDER BY 2;

-- ── 4. eyeball sample of the high-confidence matches ─────────────────
SELECT 'sample' AS report, e.facility, e.county_name, round(d.dist_m::numeric, 0) AS m,
       d.pin, d.location_method, left(d.project_title, 50) AS project,
       left(regexp_replace(e.description, '^NYSDOT - Region \d+: ', ''), 50) AS event_descr
  FROM ev e
  JOIN LATERAL (
        SELECT m.* FROM m
         WHERE m.event_id = e.event_id AND m.route_agrees AND m.dist_m <= 250
         ORDER BY m.dist_m LIMIT 1) d ON TRUE
 ORDER BY md5(e.event_id) LIMIT 20;
