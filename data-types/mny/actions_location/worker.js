const { pipeline } = require("node:stream/promises");
const { createWriteStream } = require("node:fs")

const { createDamaView } = require('@availabs/dms-server/src/dama/upload/metadata');

const pgStuff = require("pg");
const pgCopyStreams = require("pg-copy-streams");
const split = require("split2");

const { getPostgresCredentials } = require('@availabs/dms-server/src/db');
const { resolveTable } = require('@availabs/dms-server/src/db/table-resolver');
// const { getDb } = require('@availabs/dms-server/src/db');

const { csvParseRows, csvFormatRow } = require("d3-dsv");

const { checkForPoint } = require("./utils/checkForPoint.js");
const {
	cacheGeocodes,
	checkGeocodeCache
} = require("./utils/geocode");
const GeometryTableCache = require("./utils/GeometryTableCache")

const getDamaTable = async (db, view_id) => {
	const sql = `
		SELECT data_table
			FROM data_manager.views
				WHERE view_id = $1;
	`
	const { rows } = await db.query(sql, [view_id]);
	return rows?.length ? rows[0].data_table : null;
}

const Worker = async ctx => {

  const result = {
    ok: true,
    startedAt: new Date().toLocaleString(),
    completedAt: null,
  };

  const { task, pgEnv, db, dispatchEvent, updateProgress } = ctx;
  const {
		sourceName,
		sourceId,

		userId,

		actionsSource,
		actionsView,

		jurisdictionsSource,
		jurisdictionsView,

		countiesSource,
		countiesView
  } = task.descriptor;

  await dispatchEvent('actions_location:INITIAL', 'request received');
  await updateProgress(0.1);

	const dmsCreds = getPostgresCredentials("dms-mercury-3");
	const dmsClient = new pgStuff.Client(dmsCreds);
	await dmsClient.connect();

	const pgCreds = getPostgresCredentials(pgEnv);
	const pgClient = new pgStuff.Client(pgCreds);
	await pgClient.connect();

  // function resolveTable(app, type, dbType, splitMode = 'legacy', sourceId = null)
	const actionsTableInfo = resolveTable("mitigat-ny-prod", "actions_revised|1074456:data", "postgres", "per-app", actionsSource);
	const actionsTable = actionsTableInfo.fullName;
// dms_mitigat_ny_prod.data_items__s1029065_v1074456_actions_revised

  await dispatchEvent('actions_location:GEOCODE', 'starting geocode pre-caching ');

	const geocodeResult = await cacheGeocodes(dmsClient, actionsTable, dispatchEvent);

	if (!geocodeResult.ok) {
		const msg = `geocoding failed with error: ${ geocodeResult.error }`;
		await dispatchEvent('actions_location:GEOCODE', msg);
	}
	else {
		const msg = `geocoding successfully retrieved ${ geocodeResult.results } coordinates`;
		await dispatchEvent('actions_location:GEOCODE', msg);
	}
  await updateProgress(0.2);

	const jurisdictionsTableCache = new GeometryTableCache();
	const jurisdictionsTable = await getDamaTable(db, jurisdictionsView);
  await dispatchEvent('actions_location:GEOM_CACHE', `caching centroids from ${ jurisdictionsTable }`);
	const jurisdictionsTableSql = `
		SELECT census_geo AS geoid,
				ST_AsGeoJSON(ST_Centroid(wkb_geometry)) AS geojson
			FROM ${ jurisdictionsTable }
				WHERE state_fips = '36';
	`;
	await jurisdictionsTableCache.cacheGeometryTable(db, jurisdictionsTableSql);

	const countiesTableCache = new GeometryTableCache();
	const countiesTable = await getDamaTable(db, countiesView);
  await dispatchEvent('actions_location:GEOM_CACHE', `caching centroids from ${ countiesTable }`);
	const countiesTableSql = `
		SELECT geoid,
				ST_AsGeoJSON(ST_Centroid(wkb_geometry)) AS geojson
			FROM ${ countiesTable }
				WHERE geoid LIKE '36%';
	`;
	await countiesTableCache.cacheGeometryTable(db, countiesTableSql);

  await updateProgress(0.3);

  async function* yieldDataItems(source) {
  	for await (const [[id, di]] of source) {
  		yield { id, di: JSON.parse(di), level: 0 };
  	}
  }

  async function* checkLevel1(source) {
  	for await (const item of source) {
  		const point = checkForPoint(item.di) ||
  									checkGeocodeCache(item.id, true);
  		if (point) {
  			yield { ...item, level: 1, point };
  		}
  		else {
  			yield item;
  		}
  	}
  }

  async function* checkLevel2(source) {
  	for await (const item of source) {
  		if (item.level > 0) {
  			yield item;
  		}
  		else {
	  		const point = checkGeocodeCache(item.id);
	  		if (point) {
	  			yield { ...item, level: 2, point };
	  		}
	  		else {
	  			yield item;
	  		}
  		}
  	}
  }

  async function* checkLevel3(source) {
  	for await (const item of source) {
  		if (item.level > 0) {
  			yield item;
  		}
  		else {
	  		const point = jurisdictionsTableCache.checkGeometryCache(item.di.geoid_juris);
	  		if (point) {
	  			yield { ...item, level: 3, point };
	  		}
	  		else {
	  			yield item;
	  		}
  		}
  	}
  }

  async function* checkLevel4(source) {
  	for await (const item of source) {
  		if (item.level > 0) {
  			yield item;
  		}
  		else {
	  		const point = countiesTableCache.checkGeometryCache(item.di.county_geoid);
	  		if (point) {
	  			yield { ...item, level: 4, point };
	  		}
	  		else {
	  			yield item;
	  		}
  		}
  	}
  }

  let numLevel0 = 0;
  let numLevel1 = 0;
  let numLevel2 = 0;
  let numLevel3 = 0;
  let numLevel4 = 0;

  const addEmUp = () => {
  	return numLevel0 + numLevel1 + numLevel2 + numLevel3 + numLevel4;
  }

  async function* parseResults(source) {
  	for await (const item of source) {
  		switch (item.level) {
  			case 0:
  				++numLevel0; break;
  			case 1:
  				++numLevel1; break;
  			case 2:
  				++numLevel2; break;
  			case 3:
  				++numLevel3; break;
  			case 4:
  				++numLevel4; break;
  		}
  		if (item.level > 0) {
	  		const geom = {
	  			type: "Point",
	  			coordinates: [...item.point]
	  		};
	  		yield `${ csvFormatRow([item.id, item.level, JSON.stringify(geom)]) }\n`;
  		}
  		else {
	  		yield `${ csvFormatRow([item.id, 0, '']) }\n`;
  		}
  	}
  }

  const newDamaView = await createDamaView({
    source_id: sourceId,
    user_id: userId,
    etl_context_id: task.task_id
  }, pgEnv);
 console.log("GOT NEW DAMA VIEW:", newDamaView);

  const { table_name, data_table, view_id } = newDamaView;

  const createDamaTableSql = `
  	CREATE TABLE ${ data_table }(
  		ogc_fid BIGSERIAL PRIMARY KEY,
  		action_id BIGINT,
  		precision SMALLINT,
  		wkb_geometry GEOMETRY(POINT, 4326)
  	);
  `;
  await db.query(createDamaTableSql);

  const selectActionsSql = `
  	SELECT id, data
  		FROM ${ actionsTable }
  			WHERE type = 'actions_revised|1074456:data'
  `;
  const copyToSql = `
  	COPY (${ selectActionsSql })
  		TO STDOUT WITH (FORMAT CSV, HEADER FALSE, DELIMITER ',');
  `;

  const copyFromSql = `
  	COPY ${ data_table }(action_id, precision, wkb_geometry)
  		FROM STDIN WITH (FORMAT CSV)
  `;

  await dispatchEvent('actions_location:STREAM', 'starting postgres stream');
  await updateProgress(0.4);

  try {
		await pipeline(
			dmsClient.query(
				pgCopyStreams.to(copyToSql)
			),
			split(csvParseRows),
			yieldDataItems,
			checkLevel1,
			checkLevel2,
			checkLevel3,
			checkLevel4,
			parseResults,
			// createWriteStream("./results.txt")
			pgClient.query(
				pgCopyStreams.from(copyFromSql)
			)
		);
	}
	catch (e) {
  	await dispatchEvent('actions_location:STREAM', `postgres stream failed with error: ${ e }`);
  	result.completedAt = new Date().toLocaleString();
  	result.ok = false;
  	return result;
	}
  await dispatchEvent('actions_location:STREAM', `postgres stream completed`);
  await updateProgress(0.7);

  const columns = [
	  { 'name': 'ogc_fid',
	  	'display_name': 'ogc_fid',
	  	'type': 'INTEGER',
	  	'desc': null
	  },
	  { 'name': 'action_id',
	  	'display_name': 'Action ID',
	  	'type': 'INTEGER',
	  	'desc': `The action ID from source ${ actionsSource }`
	  },
	  { 'name': 'precision',
	  	'display_name': 'precision',
	  	'type': 'INTEGER',
	  	'desc': 'The precision of the location from 0 to 4'
	  }
	];
	const updateSourceMetadataSql = `
		UPDATE data_manager.sources
			SET metadata = COALESCE(metadata, '{}') || $1
				WHERE source_id = $2
	`;
  await dispatchEvent('actions_location:METADATA', `updating source table with columns metadata`);
  await updateProgress(0.8);
	await db.query(updateSourceMetadataSql, [JSON.stringify({ columns }), sourceId]);

	const tiles = {
    sources: [
    	{ 'id': table_name,
	      'source': {
	        'tiles': [`https://dmsserver.availabs.org/dama-admin/${ pgEnv }/tiles/${ view_id }/{z}/{x}/{y}/t.pbf`],
	        'format': 'pbf',
	        'type': 'vector',
	      },
    	}
    ],
    layers: [
    	{
	      'id': `s${ sourceId }_v${ view_id }_locations`,
	      'type': 'circle',
	      'paint': { 'circle-color': '#000', 'circle-radius': 4 },
	      'source': table_name,
	      'source-layer': `view_${ view_id }`,
	    }
	  ]
  };
	const viewsTable = db.type === 'postgres' ? 'data_manager.views' : 'views';
	const updateViewMetadataSql = `
		UPDATE ${ viewsTable }
			SET metadata = COALESCE(metadata, '{}') || $1
				WHERE view_id = $2
	`;
  await dispatchEvent('actions_location:METADATA', `updating view table with tiles metadata`);
  await updateProgress(0.9);
	await db.query(updateViewMetadataSql, [JSON.stringify({ tiles }), view_id]);

	console.log("\n###########################################");
	console.log("[actions_location/publish] worker completed");
	console.log("processed", addEmUp(), "total actions");
	console.log("number of level 0 results:", numLevel0);
	console.log("number of level 1 results:", numLevel1);
	console.log("number of level 2 results:", numLevel2);
	console.log("number of level 3 results:", numLevel3);
	console.log("number of level 4 results:", numLevel4);
	console.log("###########################################\n");

	await dmsClient.end();
	await pgClient.end();

  await ctx.updateProgress(1);

  result.completedAt = new Date().toLocaleString();
  result.results = {
  	total: addEmUp(),
  	numLevel0,
  	numLevel1,
  	numLevel2,
  	numLevel3,
  	numLevel4
  }

  await dispatchEvent('actions_location:FINAL', 'finished', result);

  return result;
}

module.exports = Worker;