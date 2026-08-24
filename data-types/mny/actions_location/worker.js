const { pipeline } = require("node:stream/promises");

const { createDamaView } = require('@availabs/dms-server/src/dama/upload/metadata');

const pgStuff = require("pg");
const pgCopyStreams = require("pg-copy-streams");
const split = require("split2");

const { getPostgresCredentials } = require('@availabs/dms-server/src/db');
const { resolveTable } = require('@availabs/dms-server/src/db/table-resolver');

const { csvParseRows, csvFormatRow } = require("d3-dsv");

const { cacheGeocodes } = require("../_shared/location/geocode");

// The waterfall itself — rung logic, precision codes, funnel shape and the
// centroid-cache builder — lives in the shared module so actions_cleaned can
// run the identical resolver in-process. See _shared/location/waterfall.js
// for the rung-by-rung documentation.
const {
	PRECISION,
	makeFunnel,
	buildCentroidCaches,
	resolveLevel
} = require("../_shared/location/waterfall");

const Worker = async ctx => {

  const result = {
    ok: true,
    startedAt: new Date().toLocaleString(),
    completedAt: null,
  };

  const { task, pgEnv, db, dispatchEvent, updateProgress } = ctx;
  const {
		sourceId,

		userId,

		actionsSource,

		jurisdictionsView,

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

	const actionsTableInfo = resolveTable("mitigat-ny-prod", "actions_revised|1074456:data", "postgres", "per-app", actionsSource);
	const actionsTable = actionsTableInfo.fullName;
	// dms_mitigat_ny_prod.data_items__s1029065_v1074456_actions_revised

  await dispatchEvent('actions_location:GEOCODE', 'starting geocode pre-caching');

	const geocodeResult = await cacheGeocodes(dmsClient, actionsTable);

	if (!geocodeResult.ok) {
		await dispatchEvent('actions_location:GEOCODE', `geocoding failed with error: ${ geocodeResult.error }`);
	}
	else {
		await dispatchEvent('actions_location:GEOCODE', `geocoding successfully retrieved ${ geocodeResult.results } coordinates`);
	}
  await updateProgress(0.2);

	const caches = await buildCentroidCaches(
		db,
		{ jurisdictionsView, countiesView },
		(tag, message) => dispatchEvent(`actions_location:${ tag }`, message)
	);

  await updateProgress(0.3);

	// ── the waterfall ─────────────────────────────────────────────────────────
	// resolveLevel records how many actions each rung was ABLE to try as well as
	// how many it placed. That candidates-vs-hits gap is the funnel, and it is
	// what makes a broken rung (thousands of candidates, one hit) distinguishable
	// from a merely sparse one.

	const funnel = makeFunnel();

  async function* yieldDataItems(source) {
  	for await (const [[id, di]] of source) {
  		yield { id, di: JSON.parse(di) };
  	}
  }

  async function* resolveItems(source) {
  	for await (const item of source) {
  		const { level, point } = resolveLevel({ id: item.id, di: item.di, caches, funnel });
  		yield { ...item, level, point };
  	}
  }

  const counts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const addEmUp = () => Object.values(counts).reduce((a, b) => a + b, 0);

  async function* parseResults(source) {
  	for await (const item of source) {
  		++counts[item.level];

			// Levels 0 AND 5 carry no geometry, so the emit branches on the point,
			// not on the level — a level-5 statewide row is deliberately point-less.
  		if (item.point) {
	  		const geom = {
	  			type: "Point",
	  			coordinates: [...item.point].map(Number)
	  		};
	  		yield `${ csvFormatRow([item.id, item.level, JSON.stringify(geom)]) }\n`;
  		}
  		else {
	  		yield `${ csvFormatRow([item.id, item.level, '']) }\n`;
  		}
  	}
  }

  const newDamaView = await createDamaView({
    source_id: sourceId,
    user_id: userId,
    metadata: { task_id: task.task_id }
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
			resolveItems,
			parseResults,
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
  await dispatchEvent('actions_location:STREAM', 'postgres stream completed');
  await updateProgress(0.7);

	// Tiles and every map query read this column.
	await db.query(`CREATE INDEX ON ${ data_table } USING GIST (wkb_geometry);`);

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
	  	'display_name': 'Precision',
	  	'type': 'INTEGER',
	  	'desc': "How the point was resolved. 1 = the action's own coordinates (~0 m). 2 = geocoded street address (~50 m). 3 = jurisdiction centroid (median 5.1 km error). 4 = county centroid (median 25.9 km error). 5 = statewide action, no point by design. 0 = unresolved, no point. Codes 3 and 4 are approximations: they say WHICH municipality or county, never WHERE."
	  }
	];
	const updateSourceMetadataSql = `
		UPDATE data_manager.sources
			SET metadata = COALESCE(metadata, '{}') || $1
				WHERE source_id = $2
	`;
  await dispatchEvent('actions_location:METADATA', 'updating source table with columns metadata');
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
  await dispatchEvent('actions_location:METADATA', 'updating view table with tiles metadata');
  await updateProgress(0.9);
	await db.query(updateViewMetadataSql, [JSON.stringify({ tiles }), view_id]);

	const total = addEmUp();
	const pct = n => total ? `${ (100 * n / total).toFixed(1) }%` : '—';
	const located = counts[1] + counts[2] + counts[3] + counts[4];

	// The funnel. Every v1 bug — county_geoid arrays, numeric geoid_juris, a rung
	// 1 that read fields which don't exist — would have been obvious on day one
	// from these lines: a rung with thousands of candidates and one hit is broken,
	// not sparse. The v1 log only printed the final counts, which looked plausible.
	console.log("\n###########################################");
	console.log("[actions_location/publish] worker completed");
	console.log(`view_id ${ view_id } · ${ total } actions processed`);
	console.log("-------------------------------------------");
	console.log(`  1 coordinates        ${ String(counts[1]).padStart(6) } ${ pct(counts[1]).padStart(7) }   (found: ${ funnel.coordsCandidates })`);
	console.log(`  2 geocoded address   ${ String(counts[2]).padStart(6) } ${ pct(counts[2]).padStart(7) }   (with an address: ${ funnel.geocodeCandidates })`);
	console.log(`  3 jurisdiction       ${ String(counts[3]).padStart(6) } ${ pct(counts[3]).padStart(7) }   (had a geoid: ${ funnel.jurisCandidates }, unmatched: ${ funnel.jurisMisses })`);
	console.log(`  4 county             ${ String(counts[4]).padStart(6) } ${ pct(counts[4]).padStart(7) }   (had a key: ${ funnel.countyCandidates }, unmatched: ${ funnel.countyMisses })`);
	console.log(`  5 statewide/no point ${ String(counts[5]).padStart(6) } ${ pct(counts[5]).padStart(7) }`);
	console.log(`  0 unresolved         ${ String(counts[0]).padStart(6) } ${ pct(counts[0]).padStart(7) }`);
	console.log("-------------------------------------------");
	console.log(`  geolocated           ${ String(located).padStart(6) } ${ pct(located).padStart(7) }`);
	console.log("###########################################\n");

	await dmsClient.end();
	await pgClient.end();

  await ctx.updateProgress(1);

  result.completedAt = new Date().toLocaleString();
  result.results = {
  	view_id,
  	source_id: sourceId,
  	total,
  	geolocated: located,
  	numLevel0: counts[0],
  	numLevel1: counts[1],
  	numLevel2: counts[2],
  	numLevel3: counts[3],
  	numLevel4: counts[4],
  	numLevel5: counts[5],
  	funnel
  };

  await dispatchEvent('actions_location:FINAL', 'finished', result);

  return result;
};

module.exports = Worker;
module.exports.PRECISION = PRECISION;
