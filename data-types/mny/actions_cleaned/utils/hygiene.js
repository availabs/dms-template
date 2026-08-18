/**
 * Row-level schema hygiene (actions-data-quality.md §3 / §6.10) + the mapping
 * from the actions dataset's raw JSONB field names to the output columns
 * (same working set as references/actions/scripts/02_build.mjs).
 */
const { norm, isEmpty, isPolluted } = require("./normalize");

// fields where TBD / N/A / unknown sentinels are scrubbed to NULL
const SENTINEL_SCRUBBED = ["estimated_cost", "potential_primary_funding_sources"];

const cleanText = v => {
	const s = norm(v);
	return s === "" ? null : s;
};

// county_geoid arrives as ["36091"], "36091", 36091, or the literal
// "New York City". Column value = the first real FIPS (or statewide 36000);
// the NYC string is a label, not a geoid, and stays only in the county column.
const cleanCountyGeoid = v => {
	const arr = Array.isArray(v) ? v : [v];
	for (const el of arr) {
		const s = norm(el);
		if (/^36\d{3}$/.test(s) || s === "36000") return s;
	}
	return null;
};

/**
 * Cleans one flattened action `data` object.
 * Returns { cols, data, counters } where `cols` holds the promoted output
 * columns, `data` is the cleaned remainder JSONB (artifact keys and the
 * shadowing inner id removed, misspelled twin merged), and `counters` records
 * what was scrubbed for the funnel log.
 */
const cleanRow = raw => {
	const counters = { innerId: 0, pollutedKeys: 0, seondaryMerged: 0,
		sentinelsNulled: 0, countySplit: 0 };

	const data = {};
	for (const [k, v] of Object.entries(raw)) {
		// 401 actions carry their own `id` inside data — it shadows the DMS row
		// id (the join key); the row id is authoritative, the inner one is junk
		if (k === "id") { ++counters.innerId; continue; }
		if (isPolluted(k)) { ++counters.pollutedKeys; continue; }
		data[k] = v;
	}

	// misspelled twin: seondary_hazard_type shadows 352 rows' secondary hazard;
	// the key also appears with null values, so remove it whenever present
	if ("seondary_hazard_type" in data) {
		if (isEmpty(data.secondary_hazard_type) && !isEmpty(data.seondary_hazard_type)) {
			data.secondary_hazard_type = data.seondary_hazard_type;
			++counters.seondaryMerged;
		}
		delete data.seondary_hazard_type;
	}

	// sentinel cost/funding values are "filled" but say nothing
	for (const f of SENTINEL_SCRUBBED) {
		if (data[f] != null && isEmpty(data[f]) && norm(data[f]) !== "") {
			data[f] = null;
			++counters.sentinelsNulled;
		}
	}

	// county: 69 labels for a 62-county state
	let county = cleanText(raw.county);
	if (county === "[object Object]" || (county && isEmpty(county))) county = null;
	let counties = null;
	if (county && county.includes(",")) {
		counties = county.split(",").map(s => s.trim()).filter(Boolean);
		county = counties[0] || null;
		++counters.countySplit;
	}
	else if (county) {
		counties = [county];
	}

	const source_id = norm(raw.source_id);

	const cols = {
		scope: source_id === "State" ? "State" : source_id === "Local" ? "Local" : "Unknown",
		county,
		counties,
		county_geoid: cleanCountyGeoid(raw.county_geoid),
		jurisdiction: cleanText(raw.jurisdiction),
		geoid_juris: cleanText(raw.geoid_juris),
		action_name: cleanText(raw.action_name),
		action_description: cleanText(raw.description_of_the_solution_action_description),
		problem_statement: cleanText(raw.description_of_the_problem_problem_statement),
		primary_hazard_type: cleanText(raw.primary_hazard_type),
		secondary_hazard_type: cleanText(data.secondary_hazard_type),
		primary_action_type: cleanText(raw.primary_action_type),
		action_status: cleanText(raw.action_status),
		implementation_status: cleanText(raw.implementation_status),
		estimated_cost: cleanText(data.estimated_cost),
		cost_range: cleanText(raw.cost_range),
		lead_agency: cleanText(raw.lead_agency_department),
		funding_sources: cleanText(data.potential_primary_funding_sources),
		address_if_available: cleanText(raw.address_if_available),
		county_priority: cleanText(raw.county_priority),
		is_valid: !(raw.isValid === false || raw.isValid === "false")
	};

	return { cols, data, counters };
};

module.exports = { cleanRow };
