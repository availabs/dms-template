const { pipeline } = require("node:stream/promises");

const { createDamaView } = require('@availabs/dms-server/src/dama/upload/metadata');

const pgStuff = require("pg");
const pgCopyStreams = require("pg-copy-streams");
const split = require("split2");

const { getPostgresCredentials } = require('@availabs/dms-server/src/db');
const { resolveTable } = require('@availabs/dms-server/src/db/table-resolver');

const { csvParseRows, csvFormatRow } = require("d3-dsv");

const { checkForPoint } = require("./utils/checkForPoint.js");
const {
	cacheGeocodes,
	checkGeocodeCache
} = require("./utils/geocode");
const GeometryTableCache = require("./utils/GeometryTableCache");
const { countyKeys, isStatewideDeclared, isStateAction, NYC_WIDE, NYC_FIPS } = require("./utils/geoids");

/**
 * The precision codes written to the output table.
 *
 *   1  explicit coordinates   the action's own lat/lon         ~0 m
 *   2  geocoded address       Census batch geocoder            ~50 m
 *   3  jurisdiction centroid  middle of the town               median 5.1 km error
 *   4  county centroid        middle of the county             median 25.9 km error
 *   5  statewide, no point    NULL geometry, on purpose        — see geoids.isStatewide
 *   0  unresolved             NULL geometry, nothing matched   —
 *
 * 5 and 0 both carry a NULL geometry. The difference is that 5 is a statement
 * ("this action has no single locality") and 0 is a failure.
 */
const PRECISION = {
	COORDS:     1,
	GEOCODED:   2,
	JURIS:      3,
	COUNTY:     4,
	STATEWIDE:  5,
	UNRESOLVED: 0
};

const getDamaTable = async (db, view_id) => {
	const sql = `
		SELECT data_table
			FROM data_manager.views
				WHERE view_id = $1;
	`;
	const { rows } = await db.query(sql, [view_id]);
	return rows?.length ? rows[0].data_table : null;
};

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

	// New York City is five counties, so it has no GEOID of its own — but 2,081
	// actions carry the literal string "New York City" where a county GEOID
	// belongs. Give the city one synthetic centroid (the centroid of the five
	// boroughs unioned) so those actions can be placed at county precision.
	// Actions that name an actual borough resolve to that borough instead — see
	// geoids.countyKeys.
	// ST_Collect, not ST_Union: the TIGER borough polygons have topology defects
	// (ST_Union dies with "unable to assign free hole to a shell" on Brooklyn).
	// ST_Centroid over a collection of polygons is the area-weighted centroid of
	// the parts — the same answer, without asking GEOS to dissolve the shared
	// boundaries first.
	const nycCentroidSql = `
		SELECT ST_AsGeoJSON(ST_Centroid(ST_Collect(wkb_geometry))) AS geojson
			FROM ${ countiesTable }
				WHERE geoid = ANY($1);
	`;
	const { rows: nycRows } = await db.query(nycCentroidSql, [NYC_FIPS]);
	if (nycRows?.[0]?.geojson) {
		countiesTableCache.setGeometry(NYC_WIDE, JSON.parse(nycRows[0].geojson).coordinates);
		await dispatchEvent('actions_location:GEOM_CACHE', 'cached the New York City city-wide centroid');
	}
	else {
		await dispatchEvent('actions_location:GEOM_CACHE', 'WARNING: could not build a New York City centroid');
	}

  await updateProgress(0.3);

	// ── the waterfall ─────────────────────────────────────────────────────────
	// Each stage only touches items no earlier stage resolved, and each records
	// how many actions it was ABLE to try as well as how many it placed. That
	// candidates-vs-hits gap is the funnel, and it is what makes a broken rung
	// (thousands of candidates, one hit) distinguishable from a merely sparse one.

	const funnel = {
		coordsCandidates: 0,
		geocodeCandidates: 0,
		jurisCandidates: 0,
		jurisMisses: 0,
		countyCandidates: 0,
		countyMisses: 0
	};

  async function* yieldDataItems(source) {
  	for await (const [[id, di]] of source) {
  		yield { id, di: JSON.parse(di), level: PRECISION.UNRESOLVED, point: null };
  	}
  }

	// Rung 1 — the action's own coordinates. In this dataset they live in the
	// free-text `geometry_lat_long_polygon_etc` field (checkForPoint reads it);
	// coordinates typed into address_if_available arrive via the points cache.
  async function* checkLevel1(source) {
  	for await (const item of source) {
  		const point = checkForPoint(item.di) || checkGeocodeCache(item.id, true);
  		if (point) {
  			++funnel.coordsCandidates;
  			yield { ...item, level: PRECISION.COORDS, point };
  		}
  		else {
  			yield item;
  		}
  	}
  }

	// Rung 2 — the geocoded street address.
  async function* checkLevel2(source) {
  	for await (const item of source) {
  		if (item.level > 0) { yield item; continue; }

  		if (item.di.address_if_available) ++funnel.geocodeCandidates;

  		const point = checkGeocodeCache(item.id);
  		if (point) {
  			yield { ...item, level: PRECISION.GEOCODED, point };
  		}
  		else {
  			yield item;
  		}
  	}
  }

	// Declared statewide — the action's own county field says "Statewide" (or its
	// county_geoid is the state pseudo-GEOID 36000). Runs after the coordinate
	// rungs (real coordinates always win) but BEFORE the centroid rungs, so such
	// an action never receives a centroid asserting a locality it says it lacks.
  async function* checkStatewideDeclared(source) {
  	for await (const item of source) {
  		if (item.level > 0) { yield item; continue; }

  		if (isStatewideDeclared(item.di)) {
  			yield { ...item, level: PRECISION.STATEWIDE, point: null };
  		}
  		else {
  			yield item;
  		}
  	}
  }

	// Rung 3 — the jurisdiction (municipality) centroid.
  async function* checkLevel3(source) {
  	for await (const item of source) {
  		if (item.level > 0) { yield item; continue; }

  		const geoid = item.di.geoid_juris;
  		const hasGeoid = geoid !== null && geoid !== undefined && String(geoid).trim() !== '';
  		if (hasGeoid) ++funnel.jurisCandidates;

  		// The cache coerces keys to strings, so the 721 rows whose geoid_juris is
  		// a JSON *number* now hit instead of silently dropping a rung.
  		const point = jurisdictionsTableCache.checkGeometryCache(geoid);
  		if (point) {
  			yield { ...item, level: PRECISION.JURIS, point };
  		}
  		else {
  			if (hasGeoid) ++funnel.jurisMisses;
  			yield item;
  		}
  	}
  }

	// Rung 4 — the county centroid. countyKeys unwraps the one-element array form
	// (["36091"]), walks every element of a multi-county action, and maps the New
	// York City rows onto a borough or the city-wide centroid.
  async function* checkLevel4(source) {
  	for await (const item of source) {
  		if (item.level > 0) { yield item; continue; }

  		const keys = countyKeys(item.di);
  		if (keys.length) ++funnel.countyCandidates;

  		let point = null;
  		for (const key of keys) {
  			point = countiesTableCache.checkGeometryCache(key);
  			if (point) break;
  		}

  		if (point) {
  			yield { ...item, level: PRECISION.COUNTY, point };
  		}
  		else {
  			if (keys.length) ++funnel.countyMisses;
  			yield item;
  		}
  	}
  }

	// Terminal statewide — a state-plan action that reached the end of the
	// waterfall with no jurisdiction and no county. It is placeless by nature, so
	// it is reported as precision 5 (a statement) rather than 0 (a failure).
	// State actions that DO carry a locality kept their centroid above.
  async function* checkStatewideTerminal(source) {
  	for await (const item of source) {
  		if (item.level === PRECISION.UNRESOLVED && isStateAction(item.di)) {
  			yield { ...item, level: PRECISION.STATEWIDE, point: null };
  		}
  		else {
  			yield item;
  		}
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
			checkStatewideDeclared,
			checkLevel3,
			checkLevel4,
			checkStatewideTerminal,
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
