/**
 * geoid -> [lon, lat] centroid lookup.
 *
 * Keys are ALWAYS coerced to trimmed strings on both write and read. The actions
 * dataset stores geoids inconsistently — `geoid_juris` is a string on most rows
 * and a JSON number on 721 of them; `county_geoid` is a one-element array. A
 * Map keyed by raw values silently misses every one of those (Map.get(3678036)
 * and Map.get(["36091"]) never match a "36091" key), which is what killed rungs
 * 3 and 4 in v1. Normalising here means callers can't reintroduce that bug.
 */

const normalizeKey = geoid => {
	if (geoid === null || geoid === undefined) return null;
	const key = String(geoid).trim();
	return key === "" ? null : key;
};

class GeometryTableCache {
	constructor() {
		this.cache = new Map();
	}

	async cacheGeometryTable(db, sql) {
		const { rows } = await db.query(sql);
		if (!rows?.length) {
			return;
		}
		for (const { geoid, geojson } of rows) {
			const key = normalizeKey(geoid);
			if (!key || !geojson) continue;
			this.cache.set(key, JSON.parse(geojson).coordinates);
		}
	}

	// Add a synthetic entry (used for the New York City city-wide centroid).
	setGeometry(geoid, coordinates) {
		const key = normalizeKey(geoid);
		if (key && coordinates) this.cache.set(key, coordinates);
	}

	checkGeometryCache(geoid) {
		const key = normalizeKey(geoid);
		if (key === null) return null;
		return this.cache.has(key) ? this.cache.get(key) : null;
	}

	get size() {
		return this.cache.size;
	}
}

module.exports = GeometryTableCache;
module.exports.normalizeKey = normalizeKey;
