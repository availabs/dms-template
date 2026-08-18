/**
 * Location inputs for actions_cleaned:
 *
 * 1. The published Actions Location view (source 11725) — precision +
 *    point per action_id, joined in from the same DB the output lives in.
 *
 * 2. static/location_updates.csv — the coordinates recovered from action
 *    text by references/actions/scripts/14_build_location_updates.mjs
 *    (reports/location-from-text.html). The CSV is copied here because
 *    references/actions/ is gitignored and the deployed worker must be able
 *    to read it. Geocoding already happened when the CSV was built — the
 *    worker never calls a geocoder.
 *
 *    Per the owner's 2026-08-14 decision only the high/medium-confidence
 *    rows overlay (tiers A coords / B address / C intersection / D route);
 *    the low-confidence named-road tier stays on its centroid.
 */
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { csvParse } = require("d3-dsv");

const CSV_PATH = path.join(__dirname, "..", "static", "location_updates.csv");

const TIER = {
	A_coords:       { precision: 1, method: "recovered:coords" },
	B_address:      { precision: 2, method: "recovered:address" },
	C_intersection: { precision: 2, method: "recovered:intersection" },
	D_route:        { precision: 2, method: "recovered:route" },
	D_named_road:   { precision: 2, method: "recovered:named_road" }
};
const TIER_ORDER = ["A_coords", "B_address", "C_intersection", "D_route", "D_named_road"];

const loadOverlay = ({ includeLowConfidence = false } = {}) => {
	const rows = csvParse(readFileSync(CSV_PATH, "utf8"));
	const overlay = new Map();
	let skippedReview = 0, skippedLow = 0;
	for (const r of rows) {
		if (r.apply !== "yes") { ++skippedReview; continue; }
		if (!includeLowConfidence && r.confidence === "low") { ++skippedLow; continue; }
		overlay.set(String(r.action_id), {
			tier: r.tier,
			precision: TIER[r.tier]?.precision ?? 2,
			method: TIER[r.tier]?.method ?? "recovered:other",
			confidence: r.confidence,
			lon: Number(r.lon),
			lat: Number(r.lat),
			address: (r.address_if_available || "").trim() || null,
			dist_from_centroid_km: r.dist_from_centroid_km === "" ? null : Number(r.dist_from_centroid_km)
		});
	}
	return { overlay, totalCsvRows: rows.length, skippedReview, skippedLow };
};

const loadLocations = async (db, locationsView) => {
	const { rows: viewRows } = await db.query(
		`SELECT data_table FROM data_manager.views WHERE view_id = $1;`,
		[locationsView]
	);
	const dataTable = viewRows?.[0]?.data_table;
	if (!dataTable) {
		throw new Error(`no data_table found for locations view ${ locationsView }`);
	}
	const { rows } = await db.query(`
		SELECT action_id, precision,
				ST_X(wkb_geometry) AS lon,
				ST_Y(wkb_geometry) AS lat
			FROM ${ dataTable };
	`);
	const locations = new Map();
	for (const r of rows) {
		locations.set(String(r.action_id), {
			precision: r.precision,
			lon: r.lon == null ? null : Number(r.lon),
			lat: r.lat == null ? null : Number(r.lat)
		});
	}
	return locations;
};

// pipeline precision code → provenance columns for rows the overlay didn't touch
const PIPELINE_METHOD = {
	1: { method: "pipeline:coords",          confidence: "high" },
	2: { method: "pipeline:address",         confidence: "high" },
	3: { method: "pipeline:juris_centroid",  confidence: "medium" },
	4: { method: "pipeline:county_centroid", confidence: "low" },
	5: { method: "pipeline:statewide",       confidence: null },
	0: { method: null,                       confidence: null }
};

// smaller = better placed; used to pick a merged group's location
const PRECISION_RANK = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 0: 5 };
const precisionRank = p => p == null ? 6 : (PRECISION_RANK[p] ?? 6);

/**
 * Resolve the location columns for one output row. `ids` is the surviving
 * action id first, then any merged-away duplicate ids — a merged group takes
 * the best location any member had (they are the same action in the same
 * place by definition).
 */
const resolveLocation = ({ ids, locations, overlay }) => {
	let base = null;
	for (const id of ids) {
		const loc = locations.get(String(id));
		if (loc && precisionRank(loc.precision) < precisionRank(base?.precision)) {
			base = loc;
		}
	}

	// best overlay among members, by tier quality
	let ov = null;
	for (const id of ids) {
		const o = overlay.get(String(id));
		if (o && (ov == null || TIER_ORDER.indexOf(o.tier) < TIER_ORDER.indexOf(ov.tier))) {
			ov = o;
		}
	}

	// idempotency rule from 15_apply: never displace real coordinates
	if (ov && base?.precision !== 1) {
		return {
			precision: ov.precision,
			location_method: ov.method,
			location_confidence: ov.confidence,
			dist_from_centroid_km: ov.dist_from_centroid_km,
			lon: ov.lon, lat: ov.lat,
			overlayAddress: ov.address,
			overlaid: true
		};
	}

	if (base == null) {
		// action is missing from the locations view (added since it was published)
		return { precision: null, location_method: null, location_confidence: null,
			dist_from_centroid_km: null, lon: null, lat: null, overlayAddress: null,
			overlaid: false, missing: true };
	}

	const { method, confidence } = PIPELINE_METHOD[base.precision] || PIPELINE_METHOD[0];
	return {
		precision: base.precision,
		location_method: method,
		location_confidence: confidence,
		dist_from_centroid_km: null,
		lon: base.lon, lat: base.lat,
		overlayAddress: null,
		overlaid: false
	};
};

module.exports = { loadOverlay, loadLocations, resolveLocation };
