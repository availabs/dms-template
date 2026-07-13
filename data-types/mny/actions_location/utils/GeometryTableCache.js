
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
			this.cache.set(geoid, JSON.parse(geojson).coordinates);
		}
	}
	checkGeometryCache(geoid) {
		if (this.cache.has(geoid)) {
			return this.cache.get(geoid);
		}
		return null;
	}
}

module.exports = GeometryTableCache;