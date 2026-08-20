const { existsSync, mkdirSync, rmdirSync, createWriteStream } = require("node:fs");
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

const getPgClient = async pgEnv => {
	const creds = getPostgresCredentials(pgEnv);
	const client = new pgStuff.Client(creds);
	return await client.connect();
}

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
const risSourceLegacy1 = {
	source_id: 175,
	view_id: 308,
	pgEnv: "npmrds2",
	stationColumns: ["station_nu", "ccstn"]
}
const risSourceLegacy2 = {
	source_id: 2105,
	view_id: 3628,
	pgEnv: "npmrds2",
	stationColumns: ["station_number", "continuous_count_station"]
}

const tmasStationsSource = {
	source_id: 2124,
	view_id: 3657,
	pgEnv: "npmrds2",
	stationColumns: ["station_id"],
	geometryColumns: ["wkb_geometry"]
}

// const VOLUME_DATA_FOLDER = "./ny_2024_volume_data";
const VOLUME_DATA_FOLDER = "./ny_2019_volume_data";
const SQLITE_DIRECTORY = "./sqlite"
const SQLITE_DB_URL = join(SQLITE_DIRECTORY, "sqlite.db");
const TMAS_DATA_FORMAT = "pre-2020-format"

const checkRowMatch = row => {
	const tmasId = (+row.tmas_station_id).toString();
	const risId = (+row.ris_station_number).toString();
	return risId.includes(tmasId);
}

;(async () => {
	const risSource = risSourceLegacy2;
	const tmasSource = tmasStationsSource;

console.log("CONNECTING TO RIS DB");
	const risClient = await getPgClient(risSource.pgEnv);
	const ris_data_table = await getDataTable(risClient, risSource.view_id);
console.log("RIS DATA TABLE:", ris_data_table);

console.log("CONNECTING TO TMAS DB")
	const tmasClient = await getPgClient(tmasSource.pgEnv);
	const tmas_data_table = await getDataTable(tmasClient, tmasSource.view_id);
console.log("TMAS DATA TABLE:", tmas_data_table);

	const degreesToMeters = 111134.0;

	const stationCodesSql = `
		WITH tmas_stations AS (
			SELECT DISTINCT TRIM(LEADING '0' FROM station_id) || travel_dir || travel_lane AS tmas_station_code,
						wkb_geometry
				FROM ${ tmas_data_table }
		)
		SELECT tmas.tmas_station_code,
					ris.ris_station_number,	
					ris.route_id,
					ris.degrees * ${ degreesToMeters } AS meters
			FROM tmas_stations AS tmas
			CROSS JOIN LATERAL (
				SELECT route_id, TRIM(LEADING '0' FROM station_number) AS ris_station_number,
							r.wkb_geometry <-> tmas.wkb_geometry AS degrees
					FROM ${ ris_data_table } as r
						WHERE station_number IS NOT NULL
							ORDER BY degrees
							LIMIT 5
			) AS ris
	`;
	const stationIDsSql = `
		WITH tmas_stations AS (
			SELECT DISTINCT TRIM(LEADING '0' FROM station_id) AS tmas_station_id,
						wkb_geometry
				FROM ${ tmas_data_table }
		)
		SELECT tmas.tmas_station_id,
					ris.ris_station_number,	
					ris.route_id,
					ris.degrees * ${ degreesToMeters } AS meters
			FROM tmas_stations AS tmas
			CROSS JOIN LATERAL (
				SELECT route_id, TRIM(LEADING '0' FROM station_number) AS ris_station_number,
							r.wkb_geometry <-> tmas.wkb_geometry AS degrees
					FROM ${ ris_data_table } as r
						WHERE station_number IS NOT NULL
							ORDER BY degrees
							LIMIT 5
			) AS ris
	`;


	const options = [
		{ sql: stationCodesSql,
			msg: "QUERYING TABLES FOR STATION CODES",
			file: "./station_code_points.txt"
		},
		{ sql: stationIDsSql,
			msg: "QUERYING TABLES FOR STATION IDs",
			file: "./station_id_points.txt"
		}
	]

	for (const { sql, msg, file } of options) {
console.log(msg);
		const { rows = [] } = await tmasClient.query(sql);

		for (const row of rows) {
			row.matched = checkRowMatch(row);
		}
		rows.sort((a, b) => {
			if (a.matched === b.matched) {
				return a.meters - b.meters;
			}
			if (a.matched) return -1;
			if (b.matched) return 1;
			return 0;
		})

		async function* yieldResults() {
			for (const row of rows) {
				yield JSON.stringify(row, null, 3);
			}
		}
console.log("STREAMING RESULTS");
		await pipeline(
			yieldResults,
			createWriteStream(file)
		);
	}

	await risClient.end();
	await tmasClient.end();
})();