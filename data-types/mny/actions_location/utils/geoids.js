/**
 * Turning an action's messy county/jurisdiction fields into county-centroid
 * lookup keys — including the New York City special case.
 *
 * `county_geoid` in the actions dataset is a one-element JSON array on 97% of
 * rows (`["36091"]`), a bare string on 2, a JSON `null` on ~500, and on the
 * 2,081 New York City rows it is the literal string "New York City" — which is
 * not a GEOID at all, because NYC is five counties.
 */

const NYC_WIDE = 'NYC';   // synthetic key: centroid of the five boroughs combined

// The five boroughs, by every name the actions dataset uses for them.
const BOROUGH_FIPS = [
	[/\bstaten\s+island\b|\brichmond\b/i, '36085'],
	[/\bbronx\b/i,                        '36005'],
	[/\bbrooklyn\b|\bkings\b/i,           '36047'],
	[/\bqueens\b/i,                       '36081'],
	[/\bmanhattan\b/i,                    '36061'],
];

const NYC_FIPS = ['36005', '36047', '36061', '36081', '36085'];

const text = v => (v === null || v === undefined) ? '' : String(v).trim();

/** A borough FIPS if the text names one, else null. Never returns NYC_WIDE. */
const boroughFromText = value => {
	const s = text(value);
	if (!s) return null;
	for (const [re, fips] of BOROUGH_FIPS) {
		if (re.test(s)) return fips;
	}
	// "New York (County)" is Manhattan — but only when it isn't "New York City",
	// and only when it is qualified as a county (a bare "New York" is the state).
	if (/\bnew\s+york\b/i.test(s) && !/\bnew\s+york\s+city\b/i.test(s) && /count(y|ies)/i.test(s)) {
		return '36061';
	}
	return null;
};

const isNycText = value => /\bnew\s+york\s+city\b|\bnyc\b/i.test(text(value));

/** The raw county_geoid values as a list of trimmed strings (handles the array form). */
const countyGeoidValues = di => {
	const raw = di?.county_geoid;
	if (raw === null || raw === undefined || raw === '') return [];
	const list = Array.isArray(raw) ? raw : [raw];
	return list.map(text).filter(Boolean);
};

/**
 * Ordered county-centroid lookup keys for an action. Rung 4 tries each in turn
 * and takes the first that hits — so a multi-county action resolves to its first
 * named county rather than falling through entirely.
 */
const countyKeys = di => {
	const keys = [];
	const push = k => { if (k && !keys.includes(k)) keys.push(k); };

	for (const value of countyGeoidValues(di)) {
		if (/^\d{5}$/.test(value)) { push(value); continue; }

		// Non-numeric: "New York City", "Staten Island", "#ERROR_#N/A", …
		const borough = boroughFromText(value);
		if (borough) { push(borough); continue; }

		if (isNycText(value)) {
			// Prefer the borough when the action names one; fall back to a
			// single city-wide point for the ~2,065 that only say "New York City".
			push(boroughFromText(di.jurisdiction) || boroughFromText(di.municipality_name) || NYC_WIDE);
		}
	}

	// No usable county_geoid at all — last resort, read the county/jurisdiction text.
	if (!keys.length) {
		const borough = boroughFromText(di?.county) || boroughFromText(di?.jurisdiction);
		if (borough) push(borough);
		else if (isNycText(di?.county) || isNycText(di?.jurisdiction)) {
			push(boroughFromText(di?.jurisdiction) || NYC_WIDE);
		}
	}

	return keys;
};

/**
 * An action that DECLARES it has no single locality: its county is the literal
 * "Statewide" (~88 rows) or its county_geoid is the state pseudo-GEOID "36000"
 * (~84 rows). These bypass the centroid rungs entirely — a town or county
 * centroid would assert a location the action explicitly says it doesn't have.
 */
const isStatewideDeclared = di => {
	if (/^statewide$/i.test(text(di?.county))) return true;
	return countyGeoidValues(di).includes('36000');
};

/**
 * An action from the statewide plan rather than a county annex. `source_id` here
 * is the actions dataset's own field (the string 'State' / 'Local'), NOT a DAMA
 * source id.
 *
 * Being a state action does NOT by itself mean the action is placeless. 33 of
 * the 361 are New York City actions and 18 of those name a specific borough
 * ("Sunset Cove Restoration Project", jurisdiction "Queens (County)") — those
 * are located projects that happen to be funded through the state plan, and
 * suppressing their point would throw away real geography. So this is used as a
 * TERMINAL classifier: a state action that reaches the end of the waterfall
 * unplaced is precision 5 ("statewide, no point") rather than precision 0
 * ("unresolved") — a statement instead of a failure. A state action that DOES
 * have a jurisdiction or county still gets its centroid.
 */
const isStateAction = di =>
	/^state$/i.test(text(di?.source_id)) || /^state$/i.test(text(di?.state_or_local));

module.exports = {
	NYC_WIDE,
	NYC_FIPS,
	boroughFromText,
	countyGeoidValues,
	countyKeys,
	isStatewideDeclared,
	isStateAction
};
