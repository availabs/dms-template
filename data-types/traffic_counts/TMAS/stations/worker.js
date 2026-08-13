const { pipeline } = require("node:stream/promises");
const { createReadStream } = require("node:fs");

const split2 = require("split2");
const pgStuff = require("pg");
const pgCopyStreams = require("pg-copy-streams");

const { csvFormatRow } = require("d3-dsv");

const { createDamaView } = require('@availabs/dms-server/src/dama/upload/metadata');
const { getPostgresCredentials } = require('@availabs/dms-server/src/db');

const {
  getStationRow,
  getTableValues,
  TMAScolumns
} = require("./utils")

const Worker = async ctx => {

  const result = {
    ok: true,
    startedAt: new Date().toLocaleString(),
    completedAt: null,
  };

  const { task, pgEnv, db, dispatchEvent, updateProgress } = ctx;
  const {
		source_id,

		user_id,

		tempFilePath
  } = task.descriptor.args;

  await dispatchEvent('TMAS_station_data:INITIAL', `TMAS Station Data task started: ${ task.task_id }`);
  await updateProgress(0.1);

  const pgCreds = getPostgresCredentials(pgEnv);
  const pgClient = new pgStuff.Client(pgCreds);
  await pgClient.connect();

  const newDamaView = await createDamaView({
    source_id,
    user_id,
    etl_context_id: task.task_id,
    table_schema: "tmas"
  }, pgEnv);

  const { table_name, data_table, view_id } = newDamaView;

  const createDamaViewSql = `
    CREATE TABLE ${ data_table }(
      state_fips TEXT,
      station_id TEXT,
      travel_dir TEXT,
      travel_lane TEXT,
      year_record TEXT,
      f_system TEXT,
      num_lanes TEXT,
      sample_type_volume TEXT,
      num_lanes_volume TEXT,
      method_volume TEXT,
      sample_type_class TEXT,
      num_lanes_class TEXT,
      method_class TEXT,
      algorithm_volume TEXT,
      num_classes TEXT,
      sample_type_truck TEXT,
      num_lanes_truck TEXT,
      method_truck TEXT,
      calibration TEXT,
      data_retrieval TEXT,
      type_sensor_1 TEXT,
      type_sensor_2 TEXT,
      primary_purpose TEXT,
      lrs_id TEXT,
      lrs_point TEXT,
      shrp_id TEXT,
      prev_station_id TEXT,
      year_established TEXT,
      year_discontinued TEXT,
      county_code TEXT,
      is_sample TEXT,
      sample_id TEXT,
      nhs TEXT,
      posted_route_signing TEXT,
      posted_signed_route TEXT,
      con_route_signing TEXT,
      con_signed_route TEXT,
      station_location TEXT,
      wkb_geometry GEOMETRY(POINT, 4326)
    )
  `;
  await db.query(createDamaViewSql);

  await dispatchEvent(`TMAS_station_data:DATA_TABLE', 'create new data table: ${ data_table }`);
  await updateProgress(0.3);

  let foundFirstRow = false;

  async function* parseResults(source) {
    for await (const row of source) {
      if (foundFirstRow) {
        const data = getTableValues(row);
        yield `${ csvFormatRow(data) }\n`;
      }
      else {
        foundFirstRow = true;
      }
    }
  }

  const copyFromSql = `
    COPY ${ data_table }
      FROM STDIN WITH (FORMAT CSV)
  `;

  await dispatchEvent(`TMAS_station_data:STREAM', 'streaming data into DB table ${ data_table }`);
  await updateProgress(0.4);

  await pipeline(
    createReadStream(tempFilePath),
    split2(getStationRow),
    parseResults,
    pgClient.query(
      pgCopyStreams.from(copyFromSql)
    )
  );

  pgClient.end();

  await dispatchEvent(`TMAS_station_data:STREAM', 'streaming completed`);
  await updateProgress(0.7);

  const addOgcFidSql = `
    ALTER TABLE ${ data_table }
      ADD COLUMN ogc_fid BIGSERIAL PRIMARY KEY;
  `;
  await db.query(addOgcFidSql);

  const updateSourceMetadataSql = `
    UPDATE data_manager.sources
      SET metadata = COALESCE(metadata, '{}') || $1
        WHERE source_id = $2
  `;
  await db.query(updateSourceMetadataSql, [JSON.stringify({ columns: TMAScolumns }), source_id]);

  result.completedAt = new Date().toLocaleString();

  await dispatchEvent(`TMAS_station_data:FINAL', 'request completed`);
  await updateProgress(1.0);

  return result;
}

module.exports = Worker