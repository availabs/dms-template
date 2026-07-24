const { pipeline } = require("node:stream/promises");
const { Readable } = require("node:stream");
const { createReadStream, createWriteStream } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const split2 = require("split2");
const pgStuff = require("pg");
const pgCopyStreams = require("pg-copy-streams");

const { csvFormatRow } = require("d3-dsv");

const { createDamaView } = require('@availabs/dms-server/src/dama/upload/metadata');
const { getPostgresCredentials } = require('@availabs/dms-server/src/db');

const {
	getTMASrowProcessor,
	getRowValues,
	TMAScolumns
} = require("./utils.js");

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

		format,

		tempFilePath
  } = task.descriptor.args;

  await dispatchEvent('TMAS_volume_data:INITIAL', 'request received');
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
  		f_class TEXT,
  		station_id TEXT,
  		travel_dir TEXT,
  		travel_lane TEXT,
  		date_recorded DATE,
  		day_of_week SMALLINT,
  		restrictions TEXT,
  		hour_0 INTEGER,
  		hour_1 INTEGER,
  		hour_2 INTEGER,
  		hour_3 INTEGER,
  		hour_4 INTEGER,
  		hour_5 INTEGER,
  		hour_6 INTEGER,
  		hour_7 INTEGER,
  		hour_8 INTEGER,
  		hour_9 INTEGER,
  		hour_10 INTEGER,
  		hour_11 INTEGER,
  		hour_12 INTEGER,
  		hour_13 INTEGER,
  		hour_14 INTEGER,
  		hour_15 INTEGER,
  		hour_16 INTEGER,
  		hour_17 INTEGER,
  		hour_18 INTEGER,
  		hour_19 INTEGER,
  		hour_20 INTEGER,
  		hour_21 INTEGER,
  		hour_22 INTEGER,
  		hour_23 INTEGER
  	)
  `;
  await db.query(createDamaViewSql);

  await updateProgress(0.2);

  // skip the first row of POST-2020 formats since it is a header row
  let foundFirstPost2020row = format === "pre-2020-format";

  async function* parseResults(source) {
  	for await (const row of source) {
  		if (foundFirstPost2020row) {
  			const data = getRowValues(row);
	  		yield `${ csvFormatRow(data) }\n`;
	  	}
	  	else {
	  		foundFirstPost2020row = true;
	  	}
		}
	}

  const copyFromSql = `
  	COPY ${ data_table }
  		FROM STDIN WITH (FORMAT CSV)
  `;

  await dispatchEvent(`TMAS_volume_data:STREAM', 'streaming data into DB table ${ data_table }`);
  await updateProgress(0.3);

  await pipeline(
  	createReadStream(tempFilePath),
  	split2(getTMASrowProcessor(format)),
  	parseResults,
		pgClient.query(
			pgCopyStreams.from(copyFromSql)
		)
  );

  pgClient.end();

  await dispatchEvent(`TMAS_volume_data:STREAM', 'streaming completed`);
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

  await dispatchEvent(`TMAS_volume_data:FINAL', 'request completed`);
  await updateProgress(1.0);

	return result;
}

module.exports = Worker;