/**
 * Normalization + grouping rules for the actions_cleaned transform.
 *
 * These are direct ports of the analysis that defined the recommendations —
 * references/actions/scripts/10_duplicates.mjs (exact-duplicate groups,
 * survivor safety classes) and 11_boilerplate.mjs (template groups) — so the
 * published dataset collapses exactly the rows those reports counted.
 *
 * An EXACT DUPLICATE = same canonical action_name + description within the
 * same locality (jurisdiction, else county). Rows with neither locality can't
 * be confirmed co-located and are never grouped.
 *
 * BOILERPLATE = same canonical action_name + description across >= 2 distinct
 * localities. Legitimate template reuse — flagged, never dropped.
 */
const { createHash } = require("node:crypto");

const NAME = "action_name";
const DESC = "description_of_the_solution_action_description";

const SENTINEL = new Set(["", "n/a", "na", "n\\a", "tbd", "to be determined", "none", "unknown",
	"null", "undefined", "-", "--", "#error", "#n/a", "#error_#n/a"]);

const norm = v => v == null ? "" : String(v).trim();
const canon = v => norm(v).toLowerCase().replace(/\s+/g, " ");
const isEmpty = v => SENTINEL.has(canon(v));

const bodyKey = d => {
	const nm = canon(d[NAME]), ds = canon(d[DESC]);
	return (nm || ds) ? `${ nm }||${ ds }` : null;
};

// duplicate locality: jurisdiction if present, else county; null = unlocatable
const dupLocKey = d => canon(d.jurisdiction) || canon(d.county) || null;

const exactKey = d => {
	const b = bodyKey(d); if (b == null) return null;
	const l = dupLocKey(d); if (l == null) return null;
	return `${ b }||${ l }`;
};

// boilerplate locality: county — jurisdiction pair (11_boilerplate.mjs's loc())
const boilerLocKey = d =>
	`${ norm(d.county) || "(none)" } — ${ norm(d.jurisdiction) || "(none)" }`;

const templateKey = body => createHash("md5").update(body).digest("hex");

// ── field taxonomy (10_duplicates.mjs) ──────────────────────────────────────
// Substantive fields are what completeness scoring, fill, and conflict
// detection look at; identity/provenance/artifact keys never count.
const IDENTITY   = new Set(["id", "_inner_id", "action_number"]);
const PROVENANCE = new Set(["action_creation_date", "action_status_date"]);
const ARTIFACT   = new Set(["control", "column_1", "complete", "estimated_cost_original"]);

// import-artifact keys: literal SQL expressions, raw UUIDs, [object Object]
const isPolluted = k => /data->>|to_jsonb|array_remove|case when|::text|array_to_string/i.test(k)
	|| k === "[object Object]" || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/.test(k);

const isSubstantive = k =>
	!IDENTITY.has(k) && !PROVENANCE.has(k) && !ARTIFACT.has(k) && !isPolluted(k);

// non-empty substantive fields — the "most complete" leg of the survivor rule
const completeness = d => {
	let n = 0;
	for (const k of Object.keys(d)) {
		if (isSubstantive(k) && !isEmpty(d[k])) ++n;
	}
	return n;
};

// fields where members disagree on a non-empty value (auto vs rule classes)
const conflictFields = members => {
	const keys = new Set();
	for (const m of members) {
		for (const k of Object.keys(m.data)) {
			if (isSubstantive(k)) keys.add(k);
		}
	}
	const conflicts = [];
	for (const k of keys) {
		const vals = new Set(
			members.map(m => canon(m.data[k])).filter(v => !SENTINEL.has(v))
		);
		if (vals.size >= 2) conflicts.push(k);
	}
	return conflicts;
};

module.exports = {
	NAME, DESC,
	SENTINEL, norm, canon, isEmpty,
	bodyKey, dupLocKey, exactKey, boilerLocKey, templateKey,
	isPolluted, isSubstantive, completeness, conflictFields
};
