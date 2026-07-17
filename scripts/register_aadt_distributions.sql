-- Registers the existing ClickHouse table avail.aadt_distributions as a DAMA
-- source+view in npmrds2's data_manager schema, shaped to match a real
-- gis_dataset row (per user direction, 2026-07-08). See
-- src/dms/documentation/npmrds-data-sources.md in the dms-template repo for
-- the full rationale and cross-reference.
WITH new_source AS (
  INSERT INTO data_manager.sources
    (name, description, statistics, metadata, categories, type, display_name, user_id, auth_permissions)
  VALUES (
    'aadt_distributions',
    'AADT epoch-distribution weighting profiles (20 congestion/direction/road-type profiles x 288 5-min epochs), used to weight AADT into per-epoch traffic volume for delay/CO2 calculations. Backs the NPMRDS old-reports-conversion task (dms-template src/dms/documentation/npmrds-data-sources.md).',
    '{"auth": {"users": {"993": "10"}, "groups": {}}}'::jsonb,
    '{"columns": [{"desc": null, "name": "key", "type": "string"}, {"desc": null, "name": "distributions", "type": "array"}]}'::jsonb,
    '[["NPMRDS"]]'::jsonb,
    'gis_dataset',
    'AADT Distributions',
    993,
    '{"users": {"993": ["*"]}, "groups": {"AVAIL": ["*"], "NYSDOT": ["*"], "public": []}}'::jsonb
  )
  RETURNING source_id
)
INSERT INTO data_manager.views
  (source_id, version, table_schema, table_name, data_table, metadata, user_id)
SELECT
  source_id,
  'clickhouse',
  'clickhouse.avail',
  'aadt_distributions',
  'clickhouse.avail.aadt_distributions',
  jsonb_build_object('table_name', 'aadt_distributions', 'table_schema', 'clickhouse.avail', 'is_clickhouse_table', 1),
  993
FROM new_source
RETURNING view_id, source_id;
