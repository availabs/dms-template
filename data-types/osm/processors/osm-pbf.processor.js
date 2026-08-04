const { join } = require('path');
const { pipeline, Transform } = require('stream');
const { createReadStream } = require('fs');
const osmParser = require('osm-pbf-parser');
const { Client } = require('pg');

const OSMObjectHandler = require('./utils/OSMObjectHandler');

module.exports = async function processPbf({ workingDirectory, osmFileName, schemaName, tableName, dbConfig }) {
  const fullPath = join(workingDirectory, osmFileName);
  const client = new Client(dbConfig);
  await client.connect();

  const nodesTable = `${schemaName}.${tableName}_nodes`;
  const waysTable = `${schemaName}.${tableName}`;
  const relationsTable = `${schemaName}.${tableName}_relations`;

  await client.query(`
    CREATE TABLE ${nodesTable}(
      ogc_fid BIGSERIAL,
      osm_id BIGINT,
      lon DOUBLE PRECISION,
      lat DOUBLE PRECISION
    ) WITH (fillfactor = 100, autovacuum_enabled = off)
  `);

  await client.query(`
    CREATE TABLE ${waysTable}(
      ogc_fid BIGSERIAL,
      osm_id BIGINT,
      refs BIGINT[],
      tags JSONB,
      wkb_geometry GEOMETRY(LINESTRING, 4326)
    ) WITH (fillfactor = 100, autovacuum_enabled = off)
  `);

  await client.query(`
    CREATE TABLE ${relationsTable}(
      ogc_fid BIGSERIAL,
      osm_id BIGINT,
      members JSONB,
      tags JSONB
    ) WITH (fillfactor = 100, autovacuum_enabled = off)
  `);

  await client.end();

  const handler = new OSMObjectHandler({
    nodesTable,
    waysTable,
    relationsTable,
    dbConfig,
  });
  await handler.initialize();

  const transform = new Transform({
    objectMode: true,
    highWaterMark: 16,
    transform(items, enc, next) {
      Promise.resolve()
        .then(() => handler.handleItems(items))
        .then(() => handler.streamOSMObjects())
        .then(() => next())
        .catch(next);
    },
  });

  await new Promise((resolve, reject) => {
    pipeline(
      createReadStream(fullPath),
      osmParser(),
      transform,
      (err) => (err ? reject(err) : resolve())
    );
  });

  await handler.flushOSMObjects();
  await handler.finalize();

  const indexClient = new Client(dbConfig);
  await indexClient.connect();

  await indexClient.query(`
    CREATE INDEX ${tableName}_geom_idx
      ON ${waysTable}
      USING GIST(wkb_geometry)
      WITH (fillfactor = 100)
  `);
  await indexClient.query(`
    CREATE INDEX ${tableName}_osm_idx
      ON ${waysTable}(osm_id)
      WITH (fillfactor = 100)
  `);
  await indexClient.query(`
    ALTER TABLE ${waysTable}
      ADD PRIMARY KEY(ogc_fid)
  `);

  await indexClient.query(`
    CREATE INDEX ${tableName}_nodes_osm_idx
      ON ${nodesTable}(osm_id)
      WITH (fillfactor = 100)
  `);
  await indexClient.query(`
    ALTER TABLE ${nodesTable}
      ADD PRIMARY KEY(ogc_fid)
  `);

  await indexClient.query(`
    CREATE INDEX ${tableName}_relations_osm_idx
      ON ${relationsTable}(osm_id)
      WITH (fillfactor = 100)
  `);
  await indexClient.query(`
    ALTER TABLE ${relationsTable}
      ADD PRIMARY KEY(ogc_fid)
  `);

  await indexClient.end();
};
