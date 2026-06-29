'use strict';

const { createDamaView } = require('@availabs/dms-server/src/dama/upload/metadata');

async function enhance(db, {
  table_name,
  nfip_schema, nfip_table,
  dds_schema, dds_table,
  county_schema, county_table,
  jurisdiction_schema, jurisdiction_table,
  blockgroup_schema, blockgroup_table,
}) {
  const sql = `
    WITH disasters AS (
      SELECT
        disaster_number::text,
        incident_type,
        fips_state_code || fips_county_code AS geoid,
        MIN(incident_begin_date) AS incident_begin_date,
        MAX(incident_end_date)   AS incident_end_date
      FROM ${dds_schema}.${dds_table}
      WHERE disaster_number NOT BETWEEN 3000 AND 3999
        AND incident_type IN (
          'Coastal Storm', 'Dam/Levee Break', 'Flood', 'Hurricane',
          'Severe Storm', 'Severe Storm(s)', 'Tornado', 'Tsunami', 'Typhoon'
        )
      GROUP BY 1, 2, 3
      ORDER BY 1 DESC
    ),
    enhanced_geoids AS (
      SELECT
        (
          CASE
            WHEN (
              (county_code IS NULL OR county_code = '') AND
              (census_block_group_fips IS NOT NULL AND census_block_group_fips != '')
            ) OR (
              county_code IS NOT NULL AND county_code != '' AND
              census_block_group_fips IS NOT NULL AND census_block_group_fips != '' AND
              substring(census_block_group_fips, 1, 5) != county_code
            )
            THEN substring(census_block_group_fips, 1, 5)
            ELSE county_code
          END
        ) geoid,
        nfip.*
      FROM ${nfip_schema}.${nfip_table} nfip
    ),
    nfip_ny AS (
      SELECT * FROM enhanced_geoids WHERE state = 'NY'
    ),
    jurisdiction_match AS (
      SELECT * FROM (
        SELECT DISTINCT ON (nfip.id)
          nfip.*,
          jurisdictions.geoid AS jurisdiction_geoid,
          ST_SetSRID(ST_Centroid(jurisdictions.geom), 4326) AS wkb_geometry
        FROM nfip_ny nfip
        LEFT JOIN (
          SELECT geoid AS census_block_group_fips, wkb_geometry
          FROM ${blockgroup_schema}.${blockgroup_table}
        ) AS bg_geom ON nfip.census_block_group_fips = bg_geom.census_block_group_fips
        LEFT JOIN ${jurisdiction_schema}.${jurisdiction_table} jurisdictions
          ON st_contains(jurisdictions.geom, bg_geom.wkb_geometry)
          AND jurisdictions.census_type IN ('place', 'cousub')
        ORDER BY nfip.id, (CASE WHEN jurisdictions.census_type = 'place' THEN 1 ELSE 2 END)
      ) ny_ranked
      UNION ALL
      SELECT nfip.*, NULL AS jurisdiction_geoid, NULL AS wkb_geometry
      FROM enhanced_geoids nfip
      WHERE nfip.state <> 'NY'
    )
    SELECT * INTO ${nfip_schema}.${table_name} FROM (
      SELECT DISTINCT ON (nfip.id)
        dd.disaster_number::text,
        dd.incident_type,
        nfip.*,
        COALESCE(amount_paid_on_contents_claim, 0) +
        COALESCE(amount_paid_on_building_claim, 0) +
        COALESCE(amount_paid_on_increased_cost_of_compliance_claim, 0) AS total_amount_paid
      FROM jurisdiction_match nfip
      LEFT JOIN disasters dd
        ON nfip.geoid = dd.geoid
        AND nfip.date_of_loss BETWEEN dd.incident_begin_date AND dd.incident_end_date
      ORDER BY nfip.id, dd.incident_begin_date DESC NULLS LAST
    ) t;
    ALTER TABLE ${nfip_schema}.${table_name} ADD COLUMN ogc_fid SERIAL PRIMARY KEY;
  `;
  await db.query(sql);
}

module.exports = {
  workers: {
    'enhance_nfip_claims_v2/publish': async (ctx) => {
      const { task, pgEnv, db, dispatchEvent, updateProgress } = ctx;
      const {
        table_name,
        source_id,
        user_id,
        view_dependencies,
        nfip_schema, nfip_table,
        dds_schema, dds_table,
        county_schema, county_table,
        jurisdiction_schema, jurisdiction_table,
        blockgroup_schema, blockgroup_table,
      } = task.descriptor;

      const src_type = 'fima_nfip_claims_v2_enhanced';

      await dispatchEvent(`${src_type}:WORKER_INIT`, 'worker started');
      await updateProgress(0.05);
      console.log('comes here', table_name, nfip_table, nfip_schema)

      try {
        const view = await createDamaView({
          source_id,
          user_id,
          etl_context_id: task.task_id,
          view_dependencies: view_dependencies ? JSON.parse(view_dependencies) : null,
        }, pgEnv);
        const { view_id } = view;

        await db.query(`CREATE SCHEMA IF NOT EXISTS ${nfip_schema}`);

        await dispatchEvent(`${src_type}:ENHANCE_INIT`, 'running SQL enhancement');
        await updateProgress(0.1);

        const actual_table = `${table_name}_${view_id}`;
        await enhance(db, {
          table_name: actual_table,
          nfip_schema, nfip_table,
          dds_schema, dds_table,
          county_schema, county_table,
          jurisdiction_schema, jurisdiction_table,
          blockgroup_schema, blockgroup_table,
        });

        await updateProgress(0.9);
        await dispatchEvent(`${src_type}:ENHANCE_FIN`, 'SQL enhancement complete');

        const viewsTable = db.type === 'postgres' ? 'data_manager.views' : 'views';
        const damaHost = process.env.DAMA_HOST || '';
        const metadata = JSON.stringify({
          tiles: {
            sources: [{
              id: table_name,
              source: {
                tiles: [`${damaHost}/dama-admin/${pgEnv}/tiles/${view_id}/{z}/{x}/{y}/t.pbf`],
                format: 'pbf',
                type: 'vector',
              },
            }],
            layers: [{
              id: `s${source_id}_v${view_id}_tPoint`,
              type: 'circle',
              paint: { 'circle-color': '#0a0', 'circle-radius': 4 },
              source: table_name,
              'source-layer': `view_${view_id}`,
            }],
          },
        });

        await db.query(
          `UPDATE ${viewsTable}
           SET table_schema = $1, table_name = $2, data_table = $3, metadata = $4::jsonb
           WHERE view_id = $5`,
          [nfip_schema, actual_table, `${nfip_schema}.${actual_table}`, metadata, view_id]
        );

        await updateProgress(1);
        await dispatchEvent(`${src_type}:FINAL`, 'complete', { view_id, source_id });
        return { view_id, source_id };
      } catch (e) {
        await dispatchEvent(`${src_type}:ERROR`, e.message, { error: e.stack });
        throw e;
      }
    },
  },

  routes: (router, helpers) => {
    router.post('/publish', async (req, res) => {
      try {
        const { pgEnv } = req.params;
        const {
          table_name,
          source_name,
          existing_source_id,
          view_dependencies,
          user_id,
          email,
          nfip_schema, nfip_table,
          dds_schema, dds_table,
          county_schema, county_table,
          jurisdiction_schema, jurisdiction_table,
          blockgroup_schema, blockgroup_table,
        } = req.body || {};

        let source_id = existing_source_id || null;
        if (!source_id) {
          const created = await helpers.createDamaSource({
            name: source_name || table_name,
            type: 'fima_nfip_claims_v2_enhanced',
            user_id,
          }, pgEnv);
          source_id = created.source_id;
        }

        const taskId = await helpers.queueTask({
          workerPath: 'enhance_nfip_claims_v2/publish',
          sourceId: source_id,
          source_id,
          table_name,
          user_id,
          email,
          view_dependencies,
          nfip_schema, nfip_table,
          dds_schema, dds_table,
          county_schema, county_table,
          jurisdiction_schema, jurisdiction_table,
          blockgroup_schema, blockgroup_table,
        }, pgEnv);

        console.log(`[enhance_nfip_claims_v2] task queued: etl_context_id=${taskId} source_id=${source_id}`);
        res.json({ etl_context_id: taskId, source_id });
      } catch (err) {
        console.error('[enhance_nfip_claims_v2] route failed:', err);
        res.status(500).json({ error: err.message });
      }
    });
  },
};
