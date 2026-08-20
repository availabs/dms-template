const fs = require('fs');
const path = require('path');
const { createDamaView } = require('../../src/dms/packages/dms-server/src/dama/upload/metadata');
const processOSMUpload = require('./processors');

const OSM_SCHEMA = 'osm_datasets';

const MAIN_COLUMNS = [
  { name: 'ogc_fid', display_name: 'OGC FID', type: 'BIGSERIAL', desc: null },
  { name: 'osm_id', display_name: 'OSM ID', type: 'BIGINT', desc: null },
  { name: 'refs', display_name: 'Refs', type: 'BIGINT[]', desc: null },
  { name: 'tags', display_name: 'Tags', type: 'JSONB', desc: null },
  { name: 'wkb_geometry', display_name: 'Geometry', type: 'GEOMETRY', desc: null },
];

async function getSourceMetadata(db, sourceId) {
  const sourcesTable = db.type === 'postgres' ? 'data_manager.sources' : 'sources';
  const { rows } = await db.query(
    `SELECT metadata FROM ${sourcesTable} WHERE source_id = $1`,
    [sourceId]
  );
  return rows[0]?.metadata ?? null;
}

async function initializeSourceMetadataUsingView(db, sourceId, viewId) {
  const metadata = await getSourceMetadata(db, sourceId);
  if (metadata !== null) {
    return false;
  }

  await db.query('BEGIN');
  try {
    await db.query('CALL _data_manager_admin.initialize_dama_src_metadata_using_view($1)', [viewId]);
    await db.query('COMMIT');
    return true;
  } catch (err) {
    try {
      await db.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('[osm] rollback after initialize_dama_src_metadata_using_view failed:', rollbackErr);
      if (rollbackErr?.stack) console.error(rollbackErr.stack);
    }
    throw err;
  }
}

async function updateViewSchema(db, viewId, tableName) {
  const viewsTable = db.type === 'postgres' ? 'data_manager.views' : 'views';
  await db.query(
    `UPDATE ${viewsTable}
     SET table_schema = $1, table_name = $2, data_table = $3
     WHERE view_id = $4`,
    [OSM_SCHEMA, tableName, `${OSM_SCHEMA}.${tableName}`, viewId]
  );
}

async function mergeSourceMetadataColumns(db, sourceId) {
  const sourcesTable = db.type === 'postgres' ? 'data_manager.sources' : 'sources';
  await db.query(
    `UPDATE ${sourcesTable}
     SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb
     WHERE source_id = $2 AND (metadata IS NULL OR NOT (metadata ? 'columns'))`,
    [JSON.stringify({ columns: MAIN_COLUMNS }), sourceId]
  );
}

async function mergeViewTilesMetadata(db, pgEnv, etlContextId, sourceId, viewId) {
  const viewsTable = db.type === 'postgres' ? 'data_manager.views' : 'views';
  const tilesId = `${pgEnv}_${etlContextId}_s${sourceId}_v${viewId}`;
  const metadata = {
    tiles: {
      sources: [
        {
          id: tilesId,
          source: {
            tiles: [`https://graph.availabs.org/dama-admin/${pgEnv}/tiles/${viewId}/{z}/{x}/{y}/t.pbf`],
            format: 'pbf',
            type: 'vector',
          },
        },
      ],
      layers: [
        {
          id: `${sourceId}_v${viewId}_linestrings`,
          type: 'line',
          paint: {
            'line-color': '#0080ff',
            'line-opacity': 0.5,
          },
          source: tilesId,
          'source-layer': `view_${viewId}`,
        },
      ],
    },
  };

  await db.query(
    `UPDATE ${viewsTable}
     SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb
     WHERE view_id = $2`,
    [JSON.stringify(metadata), viewId]
  );
}

module.exports = async function osmUploadWorker(ctx) {
  const { task, db, pgEnv, dispatchEvent, updateProgress } = ctx;
  const {
    source_id,
    user_id,
    osm_file_path,
    osm_file_name,
    working_directory,
    isNewSourceCreate,
  } = task.descriptor || {};

  try {
    if (db.type !== 'postgres') {
      throw new Error('osm upload requires PostgreSQL');
    }
    if (!source_id) {
      throw new Error('source_id is required');
    }
    if (!osm_file_path || !osm_file_name || !working_directory) {
      throw new Error('osm_file_path, osm_file_name, and working_directory are required');
    }
    if (!fs.existsSync(osm_file_path)) {
      throw new Error(`Uploaded OSM file not found: ${osm_file_path}`);
    }

    await dispatchEvent('osm-db-load:INITIAL', 'Starting OSM upload', {
      source_id,
      osm_file_name,
    });
    await updateProgress(0.05);

    await db.query(`CREATE SCHEMA IF NOT EXISTS ${OSM_SCHEMA}`);

    const view = await createDamaView({
      source_id,
      user_id,
      metadata: { task_id: task.task_id },
      view_dependencies: [],
    }, pgEnv);

    await updateViewSchema(db, view.view_id, view.table_name);
    await dispatchEvent('osm-db-load:VIEW_READY', `Created view ${view.view_id}`, {
      view_id: view.view_id,
      table_name: view.table_name,
    });
    await updateProgress(0.15);

    await processOSMUpload({
      workingDirectory: working_directory,
      osmFileName: osm_file_name,
      schemaName: OSM_SCHEMA,
      tableName: view.table_name,
      dbConfig: db.config,
    });

    await updateProgress(0.85);

    const initializedFromProc = await initializeSourceMetadataUsingView(db, source_id, view.view_id);
    if (!initializedFromProc && isNewSourceCreate) {
      await mergeSourceMetadataColumns(db, source_id);
    }
    await mergeViewTilesMetadata(db, pgEnv, task.task_id, source_id, view.view_id);

    await updateProgress(1);
    const result = {
      source_id,
      view_id: view.view_id,
      data_table: `${OSM_SCHEMA}.${view.table_name}`,
    };
    await dispatchEvent('osm-db-load:FINAL', 'OSM upload complete', result);

    try {
      fs.rmSync(working_directory, { recursive: true, force: true });
    } catch (e) {
      console.warn('[osm] could not remove temp working directory:', e.message);
    }

    return result;
  } catch (err) {
    console.error(`[osm] worker failed task=${task.task_id}:`, err);
    if (err?.stack) console.error(err.stack);
    try {
      await dispatchEvent('osm-db-load:ERROR', err.message || String(err), {
        source_id,
        osm_file_name,
      });
    } catch (eventErr) {
      console.error('[osm] could not dispatch error event:', eventErr);
      if (eventErr?.stack) console.error(eventErr.stack);
    }
    throw err;
  }
};
