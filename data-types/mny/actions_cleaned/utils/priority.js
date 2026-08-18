/**
 * Priority normalization — a port of the convention-family classifier in
 * references/actions/scripts/17_priority_coverage.mjs (the numbers behind
 * reports/priority-coverage.html), extended to extract the companions the
 * report recommends: keep the original verbatim, put the plan's own math in
 * priority_score / priority_rank, and hedges in priority_notes.
 *
 * Output labels: High | Medium | Low | "Not Yet Prioritized" | null.
 * null = the per-county review queue (bare numbers, tiers, ranges, misc) —
 * values that need the plan's legend to convert; never guessed.
 */
const LBL = "(very\\s+high|extremely\\s+high|high|medium|med\\.?|moderate|low|lown)"; // lown = observed typo

const toBucket = s => {
	const t = s.toLowerCase();
	if (/very|extremely|high|^h$/.test(t)) return "High";
	if (/med|moderate|^m$/.test(t)) return "Medium";
	return "Low";
};

const classify = raw => {
	const v = raw.trim();
	// non-answers
	if (/^(n\/?a|tbd|to be determined|none|-+|\?+|unknown|dependent)$/i.test(v))
		return { family: "non_answer", bucket: null };
	// label ranges: "Medium - High", "Low to Medium", "M-H", "Moderate/High"
	if (new RegExp(`^\\(?[a-z)\\s]*${ LBL }\\s*(?:[-–\\/]|to)\\s*${ LBL }$`, "i").test(v) ||
			/^\(?[a-z)\s]*[hml]\s*[-–\/]\s*[hml]$/i.test(v))
		return { family: "range", bucket: null };
	// canonical single labels (+ bare abbreviations)
	if (new RegExp(`^${ LBL }$`, "i").test(v)) return { family: "canonical", bucket: toBucket(v) };
	if (/^[hml]$/i.test(v)) return { family: "abbrev", bucket: toBucket(v) };
	// synonyms that map cleanly
	if (/^(top priority|immediate|high priority|(high|medium|low) priority)$/i.test(v))
		return { family: "synonym", bucket: /top|immediate|high/i.test(v) ? "High" : toBucket(v) };
	// label + rank: "High - 1", "High (Priority 4)", "medium (#2)"
	const rank = v.match(new RegExp(`^${ LBL }\\s*(?:priority)?\\s*[-–(]\\s*(?:priority\\s*)?#?\\s*\\d+\\s*\\)?$`, "i"));
	if (rank) return { family: "label_rank", bucket: toBucket(rank[1]) };
	// label + score: "Low (14.5)", "15/High", "11 (Medium)"
	const sc = v.match(new RegExp(`^${ LBL }\\s*\\(?\\d+(?:\\.\\d+)?\\)?$`, "i")) ||
			v.match(new RegExp(`^\\d+(?:\\.\\d+)?\\s*[(\\/]\\s*${ LBL }\\)?$`, "i"));
	if (sc) return { family: "label_score", bucket: toBucket(sc[1]) };
	// tier vocabularies: "Tier 1", "Tier I-B- 13", "Tier 1 - Top Priority"
	if (/^tier\s*#?\s*(\d|i)/i.test(v)) return { family: "tier", bucket: null };
	// "Priority #1", "Priority 2- 15", "Priority Number 1 of 2"
	if (/^priority\s*(#|number|\d)/i.test(v)) return { family: "label_rank", bucket: null };
	// pure numbers — plan scores or ranks with no legend in the row
	if (/^\d+(\.\d+)?$/.test(v)) return { family: "numeric", bucket: null };
	// leading-label narratives: "High - ongoing", "(ongoing) High", "Medium - DOF"
	const lead = v.match(new RegExp(`^\\(?[a-z)\\s]*\\b${ LBL }\\b`, "i"));
	if (lead && !/^(yes|some|staff|varies|not a)/i.test(v))
		return { family: "label_narrative", bucket: toBucket(lead[1]) };
	return { family: "other", bucket: null };
};

const NOT_YET = "Not Yet Prioritized";

const lastNumber = v => {
	const m = String(v).match(/(\d+(?:\.\d+)?)(?!.*\d)/);
	return m ? Number(m[1]) : null;
};

/**
 * @param rawValue the source `priority` string (may be null/blank)
 * @returns { priority, priority_original, priority_score, priority_rank,
 *            priority_notes, family }
 */
const parsePriority = rawValue => {
	const original = rawValue == null ? null : String(rawValue).trim() || null;
	if (original == null) {
		return { priority: NOT_YET, priority_original: null, priority_score: null,
			priority_rank: null, priority_notes: null, family: "blank" };
	}
	const { family, bucket } = classify(original);

	let score = null, rank = null, notes = null;
	if (family === "label_score" || family === "numeric") score = lastNumber(original);
	if (family === "label_rank") {
		const n = lastNumber(original);
		if (n != null && Number.isInteger(n)) rank = n;
	}
	if (family === "label_narrative") {
		// what's left after the label word is the hedge/condition
		notes = original
			.replace(new RegExp(`\\b${ LBL }\\b`, "i"), "")
			.replace(/^[\s\-–:/]+|[\s\-–:/]+$/g, "")
			.trim() || null;
	}

	const priority = family === "non_answer" ? NOT_YET : (bucket || null);

	return { priority, priority_original: original, priority_score: score,
		priority_rank: rank, priority_notes: notes, family };
};

module.exports = { parsePriority, classify, NOT_YET };
