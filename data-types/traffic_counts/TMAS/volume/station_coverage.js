const { existsSync, mkdirSync, rmdirSync } = require("node:fs");
const { readdir, readFile } = require("node:fs/promises");
const { pipeline } = require("node:stream/promises");
const { join } = require("node:path");

const pgStuff = require("pg");
const split = require("split2");
const { format: d3format } = require("d3-format")

const SQLite3DB = require("./BetterSQLite3DB.js");

const { getPostgresCredentials } = require('@availabs/dms-server/src/db');

const {
	getRowValues,
	getTMASrowProcessor
} = require("./utils.js");

const intFormat = d3format(",d");

const getDataTable = async (client, view_id) => {
	const sql = `
		SELECT data_table
			FROM data_manager.views
			WHERE view_id = $1;
	`
	const { rows } = await client.query(sql, [view_id]);
	if (rows?.length) {
		return rows[0].data_table;
	}
	return null;
}

const risSourceCurrent = {
	source_id: 2080,
	view_id: 3588,
	pgEnv: "npmrds2",
	stationColumns: ["station_number", "continuous_count_station"]
}

const risSourceLegacy = {
	source_id: 175,
	view_id: 308,
	pgEnv: "npmrds2",
	stationColumns: ["station_nu", "ccstn"]
}

// const VOLUME_DATA_FOLDER = "./ny_2024_volume_data";
const VOLUME_DATA_FOLDER = "./ny_2019_volume_data";
const SQLITE_DIRECTORY = "./sqlite"
const SQLITE_DB_URL = join(SQLITE_DIRECTORY, "sqlite.db");
const TMAS_DATA_FORMAT = "pre-2020-format"

;(async () => {
	const risSource = risSourceLegacy;

console.log("CONNECTING TO RIS DB")
	const risCreds = getPostgresCredentials(risSource.pgEnv);
	const risClient = new pgStuff.Client(risCreds);
	await risClient.connect();
	const ris_data_table = await getDataTable(risClient, risSource.view_id);

	if (!existsSync(SQLITE_DB_URL)) {
		console.log("DID NOT FIND SQLITE DB, LOADING VOLUME DATA");
		try {
			mkdirSync(SQLITE_DIRECTORY);
			await loadVolumeDataIntoSqlite(TMAS_DATA_FORMAT);
		}
		catch (e) {
			rmdirSync(SQLITE_DIRECTORY);
		}
	}

	for (const column of risSource.stationColumns) {
		const sql = `
			SELECT DISTINCT ${ column } AS station
				FROM ${ ris_data_table }
					WHERE ${ column } IS NOT NULL;
		`;
		console.log("QUERYING RIS DB FOR", column);
		const { rows } = await risClient.query(sql);
		console.log("RETRIEVED", rows.length, "ROWS");

		await checkRisStation(risClient, ris_data_table, column)
	}

	await risClient.end();
})();



const queryStationIDs = async () => {
	console.log("QUERYING VOLUME DATA FOR STATION IDs");
	const db = new SQLite3DB(SQLITE_DB_URL);
	const countSql = `
		SELECT DISTINCT station_id
			FROM ny_2024_volume_data
	`;
	const rows = db.all(countSql).map(r => +r.station_id).filter(Boolean);
	console.log("RETRIEVED", rows.length, "STATION IDs");
	await db.close();
	return rows;
}
const queryStationCodes = async () => {
	console.log("QUERYING VOLUME DATA FOR STATION CODES");
	const db = new SQLite3DB(SQLITE_DB_URL);
	const countSql = `
		SELECT DISTINCT (station_id || travel_dir || travel_lane) AS station_code
			FROM ny_2024_volume_data
	`;
	const rows = db.all(countSql).map(r => +r.station_code).filter(Boolean);
	console.log("RETRIEVED", rows.length, "STATION CODES");
	await db.close();
	return rows;
}

const checkRisStation = async (risClient, ris_data_table, column) => {
	const station_ids = await queryStationIDs();
	const checkStationIDsSql = `
		SELECT DISTINCT ${ column }::INT AS station
			FROM ${ ris_data_table }
				WHERE ${ column }::INT = ANY($1);
	`;
	const { rows: siRows } = await risClient.query(checkStationIDsSql, [station_ids]);
	console.log("MATCHED", siRows.length, "STATION IDs TO", column);

	const station_codes = await queryStationCodes();
	const checkStationCodesSql = `
		SELECT DISTINCT ${ column }::INT AS station
			FROM ${ ris_data_table }
				WHERE ${ column }::INT = ANY($1);
	`;
	const { rows: scRows } = await risClient.query(checkStationCodesSql, [station_codes]);
	console.log("MATCHED", scRows.length, "STATION CODES TO", column);
}

const loadVolumeDataIntoSqlite = async tmasDataFormat => {

	const db = new SQLite3DB(SQLITE_DB_URL);

  db.run("DROP TABLE IF EXISTS ny_2024_volume_data");

	const createTableSql = `
		CREATE TABLE ny_2024_volume_data(
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
  db.run(createTableSql);

	let foundFirstPost2020row = false;

	async function* readFilesDirectory() {
		for (const file of await readdir(VOLUME_DATA_FOLDER)) {
			console.log("PROCESSING FILE:", file);
			foundFirstPost2020row = tmasDataFormat === "pre-2020-format";
			yield file;
		}
	}

	async function* yieldFileData(source) {
		for await (const file of source) {
			yield await readFile(join(VOLUME_DATA_FOLDER, file));
		}
	}

	const insertSql = `
		INSERT INTO ny_2024_volume_data
			VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
	`
	const stmt = db.prepare(insertSql);

	let num = 0;

	async function* runInsertStatement(source) {
		for await (const row of source) {
			if (foundFirstPost2020row) {
				stmt.run(...getRowValues(row));
				if (++num % 5000 == 0) {
					console.log("LOADED", num, "RECORDS")
				}
			}
			else {
				foundFirstPost2020row = true;
			}
		}
	}

	await pipeline(
		readFilesDirectory,
		yieldFileData,
		split(getTMASrowProcessor(tmasDataFormat)),
		runInsertStatement
	);

	await db.close();
}