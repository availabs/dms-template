/**
 * The MitigateNY actions geolocation waterfall, as a synchronous per-row
 * resolver over pre-built caches. This is the ONE implementation — both the
 * actions_location plugin (streaming pipeline) and the actions_cleaned plugin
 * (in-process location stage) call resolveLevel; neither carries its own copy
 * of the rung logic.
 *
 * The rungs, in order (each only sees rows no earlier rung resolved):
 *
 *   1  explicit coordinates   the action's own lat/lon         ~0 m
 *   2  geocoded address       Census batch geocoder            ~50 m
 *   —  declared statewide     county = "Statewide" / 36000 → 5 (before centroids,
 *                             so a self-declared placeless action never gets one)
 *   3  jurisdiction centroid  middle of the town               median 5.1 km error
 *   4  county centroid        middle of the county             median 25.9 km error
 *   —  terminal statewide     unplaced state-plan action → 5 (a statement, not a failure)
 *   0  unresolved             nothing matched
 *
 * 5 and 0 both carry a NULL point. The difference is that 5 is a statement
 * ("this action has no single locality") and 0 is a failure.
 *
 * The funnel records candidates as well as hits per rung — a rung with
 * thousands of candidates and one hit is broken, not sparse. That gap is what
 * made the v1 type-mismatch bugs visible; keep feeding it.
 */
const { checkForPoint } = require("./checkForPoint.js");
const { checkGeocodeCache } = require("./geocode");
const GeometryTableCache = require("./GeometryTableCache");
const { countyKeys, isStatewideDeclared, isStateAction, NYC_WIDE, NYC_FIPS } = require("./geoids");

const PRECISION = {
	COORDS:     1,
	GEOCODED:   2,
	JURIS:      3,
	COUNTY:     4,
	STATEWIDE:  5,
	UNRESOLVED: 0
};

const makeFunnel = () => ({
	coordsCandidates: 0,
	geocodeCandidates: 0,
	jurisCandidates: 0,
	jurisMisses: 0,
	countyCandidates: 0,
	countyMisses: 0
});

const getDamaTable = async (db, view_id) => {
	const { rows } = await db.query(
		`SELECT data_table FROM data_manager.views WHERE view_id = $1;`,
		[view_id]
	);
	return rows?.length ? rows[0].data_table : null;
};

/**
 * Build the two centroid caches (+ the synthetic New York City entry) from the
 * jurisdiction and county boundary views. `onEvent(tag, message)` receives
 * progress lines so each caller can forward them under its own event namespace.
 *
 * New York City is five counties, so it has no GEOID of its own — but 2,081
 * actions carry the literal string "New York City" where a county GEOID
 * belongs. The city gets one synthetic centroid (the five boroughs combined)
 * so those actions can be placed at county precision; actions that name an
 * actual borough resolve to that borough instead (see geoids.countyKeys).
 * ST_Collect, not ST_Union: the TIGER borough polygons have topology defects
 * (ST_Union dies with "unable to assign free hole to a shell" on Brooklyn).
 * ST_Centroid over a collection of polygons is the area-weighted centroid of
 * the parts — the same answer, without asking GEOS to dissolve the shared
 * boundaries first.
 */
const buildCentroidCaches = async (db, { jurisdictionsView, countiesView }, onEvent = async () => {}) => {
	const jurisdictions = new GeometryTableCache();
	const jurisdictionsTable = await getDamaTable(db, jurisdictionsView);
	await onEvent("GEOM_CACHE", `caching centroids from ${ jurisdictionsTable }`);
	await jurisdictions.cacheGeometryTable(db, `
		SELECT census_geo AS geoid,
				ST_AsGeoJSON(ST_Centroid(wkb_geometry)) AS geojson
			FROM ${ jurisdictionsTable }
				WHERE state_fips = '36';
	`);

	const counties = new GeometryTableCache();
	const countiesTable = await getDamaTable(db, countiesView);
	await onEvent("GEOM_CACHE", `caching centroids from ${ countiesTable }`);
	await counties.cacheGeometryTable(db, `
		SELECT geoid,
				ST_AsGeoJSON(ST_Centroid(wkb_geometry)) AS geojson
			FROM ${ countiesTable }
				WHERE geoid LIKE '36%';
	`);

	const { rows: nycRows } = await db.query(`
		SELECT ST_AsGeoJSON(ST_Centroid(ST_Collect(wkb_geometry))) AS geojson
			FROM ${ countiesTable }
				WHERE geoid = ANY($1);
	`, [NYC_FIPS]);
	if (nycRows?.[0]?.geojson) {
		counties.setGeometry(NYC_WIDE, JSON.parse(nycRows[0].geojson).coordinates);
		await onEvent("GEOM_CACHE", "cached the New York City city-wide centroid");
	}
	else {
		await onEvent("GEOM_CACHE", "WARNING: could not build a New York City centroid");
	}

	return { jurisdictions, counties };
};

/**
 * Run the waterfall for one action. `id` must be the DMS row id AS A STRING
 * (the geocode caches are keyed by the SQL query's string ids); `di` is the
 * RAW data JSONB — the rungs own all of its quirks (array county_geoid,
 * numeric geoid_juris, the literal "New York City"), so callers must not
 * clean it first. Returns { level, point } where point is [lon, lat] or null.
 */
const resolveLevel = ({ id, di, caches, funnel }) => {
	// Rung 1 — the action's own coordinates. In this dataset they live in the
	// free-text `geometry_lat_long_polygon_etc` field (checkForPoint reads it);
	// coordinates typed into address_if_available arrive via the points cache.
	let point = checkForPoint(di) || checkGeocodeCache(id, true);
	if (point) {
		++funnel.coordsCandidates;
		return { level: PRECISION.COORDS, point };
	}

	// Rung 2 — the geocoded street address.
	if (di.address_if_available) ++funnel.geocodeCandidates;
	point = checkGeocodeCache(id);
	if (point) {
		return { level: PRECISION.GEOCODED, point };
	}

	// Declared statewide — runs after the coordinate rungs (real coordinates
	// always win) but BEFORE the centroid rungs, so such an action never
	// receives a centroid asserting a locality it says it lacks.
	if (isStatewideDeclared(di)) {
		return { level: PRECISION.STATEWIDE, point: null };
	}

	// Rung 3 — the jurisdiction (municipality) centroid. The cache coerces keys
	// to strings, so the 721 rows whose geoid_juris is a JSON *number* hit
	// instead of silently dropping a rung.
	const geoid = di.geoid_juris;
	const hasGeoid = geoid !== null && geoid !== undefined && String(geoid).trim() !== "";
	if (hasGeoid) ++funnel.jurisCandidates;
	point = caches.jurisdictions.checkGeometryCache(geoid);
	if (point) {
		return { level: PRECISION.JURIS, point };
	}
	if (hasGeoid) ++funnel.jurisMisses;

	// Rung 4 — the county centroid. countyKeys unwraps the one-element array
	// form (["36091"]), walks every element of a multi-county action, and maps
	// the New York City rows onto a borough or the city-wide centroid.
	const keys = countyKeys(di);
	if (keys.length) ++funnel.countyCandidates;
	point = null;
	for (const key of keys) {
		point = caches.counties.checkGeometryCache(key);
		if (point) break;
	}
	if (point) {
		return { level: PRECISION.COUNTY, point };
	}
	if (keys.length) ++funnel.countyMisses;

	// Terminal statewide — a state-plan action that reached the end of the
	// waterfall with no jurisdiction and no county is placeless by nature:
	// precision 5 (a statement) rather than 0 (a failure). State actions that
	// DO carry a locality kept their centroid above.
	if (isStateAction(di)) {
		return { level: PRECISION.STATEWIDE, point: null };
	}

	return { level: PRECISION.UNRESOLVED, point: null };
};

module.exports = {
	PRECISION,
	makeFunnel,
	getDamaTable,
	buildCentroidCaches,
	resolveLevel
};
