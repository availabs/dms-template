/**
 * Rung 1 of the location waterfall — an action's own explicit coordinates.
 *
 * Returns a plain `[lon, lat]` array (NOT GeoJSON): the worker's parseResults
 * spreads the point with `[...item.point]`, and every other rung (the geocode
 * cache, the centroid caches) hands back a bare pair. Returning a GeoJSON object
 * here would throw "is not iterable" downstream.
 */

const notNumbers = [false, true, null, "", []];
const strictNaN = v => {
	if (notNumbers.includes(v)) return true;
	return isNaN(v);
};

// New York State bounding box — [[left, top], [right, bottom]]
const nyBounds = [
	[-79.77, 45.02],
	[-71.85, 40.50]
];
const inBounds = (lon, lat) => {
	if (strictNaN(lon) || strictNaN(lat)) return false;
	if (lon < nyBounds[0][0]) return false;
	if (lon > nyBounds[1][0]) return false;
	if (lat > nyBounds[0][1]) return false;
	if (lat < nyBounds[1][1]) return false;
	return true;
};

/**
 * Given two numbers in unknown order/sign, return them as [lon, lat] if any
 * arrangement lands inside New York. Handles "42.65, -73.75" (lat first),
 * "-73.75, 42.65" (lon first) and "42.65 N, 73.75 W" (unsigned, hemisphere
 * letters) without having to parse the hemisphere letters themselves.
 */
const orient = (a, b) => {
	const candidates = [
		[a, b],
		[b, a],
		[-Math.abs(a), Math.abs(b)],
		[-Math.abs(b), Math.abs(a)]
	];
	for (const [lon, lat] of candidates) {
		if (inBounds(lon, lat)) return [lon, lat];
	}
	return null;
};

/**
 * Pull a coordinate pair out of a free-text value.
 *
 * `geometry_lat_long_polygon_etc` is a free-text location field: most values are
 * prose ("Townwide", "City of Binghamton", a street address), a few are real
 * pairs ("40.7569, -73.9903"), and at least one is a lone latitude with no
 * longitude ("40.576603"). So: require TWO decimal numbers, and require the
 * result to fall inside New York. Anything else returns null and falls through
 * to the next rung rather than inventing a point.
 */
const parseCoordText = value => {
	if (value === null || value === undefined) return null;
	const text = String(value).trim();
	if (!text) return null;

	// Decimals only — a bare integer in prose ("10 New Street", "NY 13542") is
	// never a coordinate, and requiring the decimal point is what keeps street
	// numbers and zip codes out.
	const nums = text.match(/-?\d+\.\d+/g);
	if (!nums || nums.length < 2) return null;

	// Walk consecutive pairs rather than assuming the coordinate is the first two
	// numbers: the value may carry a leading measurement ("1.5 miles east of
	// 42.65, -73.75"). The in-New-York test is what decides which pair is real.
	for (let i = 0; i + 1 < nums.length; i++) {
		const point = orient(Number(nums[i]), Number(nums[i + 1]));
		if (point) return point;
	}
	return null;
};

const getLongitude = di => {
	if (di.longitude) return Number(di.longitude);
	if (di.lon) return Number(di.lon);
	if (di.lng) return Number(di.lng);
	return false;
};
const getLatitude = di => {
	if (di.latitude) return Number(di.latitude);
	if (di.lat) return Number(di.lat);
	return false;
};

const getCoords = di => {
	// (a) a real array/string coordinate field, if one ever appears
	const coords = di.coordinates || di.coords;
	if (coords) {
		if (Array.isArray(coords) && coords.length >= 2) {
			return orient(Number(coords[0]), Number(coords[1]));
		}
		const parsed = parseCoordText(coords);
		if (parsed) return parsed;
	}

	// (b) discrete lat/lon fields, if they ever appear
	const lon = getLongitude(di);
	const lat = getLatitude(di);
	if (!strictNaN(lon) && !strictNaN(lat)) {
		const oriented = orient(Number(lon), Number(lat));
		if (oriented) return oriented;
	}

	// (c) the field that actually holds coordinates in the Mitigate-NY actions
	// dataset. None of (a) or (b) exist there — this is the one that fires.
	return parseCoordText(di.geometry_lat_long_polygon_etc);
};

const checkForPoint = di => getCoords(di);

module.exports = {
	checkForPoint,
	parseCoordText,
	inBounds
};
