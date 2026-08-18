/**
 * actions_cleaned/publish — builds the "Actions Cleaned" derived dataset.
 *
 * Reads the MitigateNY actions internal dataset (dms-mercury-3), applies every
 * transform the actions data-quality report series recommends, joins the
 * published Actions Location precision + geometry, overlays the high/medium
 * confidence coordinates recovered from action text, and publishes the result
 * as a new view under the output source in the DAMA DB.
 *
 * Inputs are read-only: the actions dataset and the locations source are
 * never modified. Publishing again creates a new view; prior views stay.
 *
 * Transforms, with the report that specified each:
 *   T1 flatten          id-last (401 inner `id` keys shadow the row id)
 *   T2 schema hygiene   actions-data-quality.md §3/§6.10 — artifact keys,
 *                       misspelled twin, sentinels, county labels
 *   T3 de-duplicate     duplicate-actions.html — keep-the-richer-copy within
 *                       one locality; locality-less rows never grouped
 *   T4 boilerplate flag boilerplate-actions.html — flag, never delete
 *   T5 priority         priority-coverage.html — migrate, don't overwrite
 *   T6 location         join + location-from-text.html recovered overlay
 *
 * descriptor: { sourceId, userId, actionsSource, actionsView, locationsView,
 *               dryRun? } — dryRun runs every transform and prints the funnel
 * without creating a view or writing any rows.
 */
const pgStuff = require("pg");

const { createDamaView } = require("@availabs/dms-server/src/dama/upload/metadata");
const { getPostgresCredentials } = require("@availabs/dms-server/src/db");
const { resolveTable } = require("@availabs/dms-server/src/db/table-resolver");

const {
	NAME, DESC, norm, isEmpty, exactKey, bodyKey, boilerLocKey, templateKey,
	isSubstantive, completeness, conflictFields
} = require("./utils/normalize");
const { parsePriority } = require("./utils/priority");
const { cleanRow } = require("./utils/hygiene");
const { loadOverlay, loadLocations, resolveLocation } = require("./utils/locations");

const PAGE_SIZE = 1000;
const INSERT_BATCH = 400;

// One spec drives the CREATE TABLE, the INSERTs, and metadata.columns.
const COLUMNS = [
	{ name: "action_id", type: "BIGINT", display: "Action ID",
		desc: "The DMS row id in the actions dataset. For a merged duplicate group, the surviving row's id." },
	{ name: "scope", type: "TEXT", display: "Scope",
		desc: "State (statewide HMP), Local (county/municipal annex), or Unknown." },
	{ name: "county", type: "TEXT", display: "County",
		desc: "Cleaned county label; first county for multi-county actions. 'New York City' spans five counties." },
	{ name: "counties", type: "TEXT[]", display: "Counties",
		desc: "All county labels on the action (comma-joined source values split)." },
	{ name: "county_geoid", type: "TEXT", display: "County GEOID",
		desc: "First county FIPS on the action (36xxx; 36000 = statewide). NULL when the source held no FIPS (e.g. the literal 'New York City')." },
	{ name: "jurisdiction", type: "TEXT", display: "Jurisdiction", desc: null },
	{ name: "geoid_juris", type: "TEXT", display: "Jurisdiction GEOID", desc: null },
	{ name: "action_name", type: "TEXT", display: "Action Name", desc: null },
	{ name: "action_description", type: "TEXT", display: "Action Description", desc: null },
	{ name: "problem_statement", type: "TEXT", display: "Problem Statement", desc: null },
	{ name: "primary_hazard_type", type: "TEXT", display: "Primary Hazard", desc: null },
	{ name: "secondary_hazard_type", type: "TEXT", display: "Secondary Hazard",
		desc: "Includes the 352 values that lived on the misspelled seondary_hazard_type field." },
	{ name: "primary_action_type", type: "TEXT", display: "Action Type", desc: null },
	{ name: "action_status", type: "TEXT", display: "Action Status", desc: null },
	{ name: "implementation_status", type: "TEXT", display: "Implementation Status", desc: null },
	{ name: "estimated_cost", type: "TEXT", display: "Estimated Cost",
		desc: "Sentinel values (TBD / N/A / unknown) scrubbed to NULL." },
	{ name: "cost_range", type: "TEXT", display: "Cost Range", desc: null },
	{ name: "lead_agency", type: "TEXT", display: "Lead Agency", desc: null },
	{ name: "funding_sources", type: "TEXT", display: "Funding Sources",
		desc: "Sentinel values (TBD / N/A / unknown) scrubbed to NULL." },
	{ name: "address_if_available", type: "TEXT", display: "Address",
		desc: "Source address, plus addresses recovered from action text where the source was blank." },
	{ name: "priority", type: "TEXT", display: "Priority",
		desc: "Normalized local priority: High / Medium / Low / Not Yet Prioritized. NULL = the free-text value needs the plan's own legend to convert (review queue); see priority_original." },
	{ name: "priority_original", type: "TEXT", display: "Priority (original)",
		desc: "The verbatim free-text priority as the plan wrote it." },
	{ name: "priority_score", type: "NUMERIC", display: "Priority Score",
		desc: "The plan's own numeric score when one was embedded in the priority text ('Low (14.5)' → 14.5)." },
	{ name: "priority_rank", type: "INTEGER", display: "Priority Rank",
		desc: "The plan's own ordering when one was embedded in the priority text ('High - 1' → 1)." },
	{ name: "priority_notes", type: "TEXT", display: "Priority Notes",
		desc: "Hedges and conditions stripped off a leading label ('High - after flood events')." },
	{ name: "county_priority", type: "TEXT", display: "County Priority",
		desc: "The county-lens implementation tier, unchanged — a different lens from local priority; never merged." },
	{ name: "is_boilerplate", type: "BOOLEAN", display: "Boilerplate",
		desc: "True when the identical name+description appears in 2+ localities (template reuse — legitimate, but carries no local specifics)." },
	{ name: "template_key", type: "TEXT", display: "Template Key",
		desc: "Stable key (md5 of the normalized name+description) shared by all rows of one template." },
	{ name: "template_size", type: "INTEGER", display: "Template Size",
		desc: "How many localities share this template." },
	{ name: "merged_action_ids", type: "JSONB", display: "Merged Action IDs",
		desc: "DMS row ids of same-place duplicate rows merged into this one (keep-the-richer-copy rule)." },
	{ name: "is_valid", type: "BOOLEAN", display: "Is Valid",
		desc: "The source dataset's own validation flag (583 rows carry false; they are kept and flagged)." },
	{ name: "precision", type: "SMALLINT", display: "Precision",
		desc: "How the point was resolved. 1 = the action's own coordinates (~0 m). 2 = geocoded address/intersection/route. 3 = jurisdiction centroid (median 5.1 km error). 4 = county centroid (median 25.9 km error). 5 = statewide, no point by design. 0 = unresolved. NULL = action not present in the joined locations view. Codes 3 and 4 say WHICH municipality or county, never WHERE." },
	{ name: "location_method", type: "TEXT", display: "Location Method",
		desc: "pipeline:* = from the Actions Location waterfall; recovered:* = coordinate recovered from the action's own text (location-from-text report)." },
	{ name: "location_confidence", type: "TEXT", display: "Location Confidence",
		desc: "high / medium / low. Recovered rows carry the geocode confidence; centroids are medium (jurisdiction) or low (county)." },
	{ name: "dist_from_centroid_km", type: "NUMERIC", display: "Distance From Centroid (km)",
		desc: "For recovered points: how far the recovered site is from the centroid it replaced." },
	{ name: "wkb_geometry", type: "GEOMETRY(POINT, 4326)", display: "Geometry", desc: null },
	{ name: "data", type: "JSONB", display: "Data",
		desc: "The full cleaned source record (import-artifact keys and the shadowing inner id removed). Nothing is lost by column promotion." }
];

const Worker = async ctx => {

	const result = {
		ok: true,
		startedAt: new Date().toLocaleString(),
		completedAt: null
	};

	const { task, pgEnv, db, dispatchEvent, updateProgress } = ctx;
	const {
		sourceId,
		userId,
		actionsSource,
		actionsView,
		locationsView,
		dryRun = false
	} = task.descriptor;

	await dispatchEvent("actions_cleaned:INITIAL", "request received");
	await updateProgress(0.05);

	const dmsCreds = getPostgresCredentials("dms-mercury-3");
	const dmsClient = new pgStuff.Client(dmsCreds);
	await dmsClient.connect();

	const actionsType = `actions_revised|${ actionsView }:data`;
	const actionsTableInfo = resolveTable("mitigat-ny-prod", actionsType, "postgres", "per-app", actionsSource);
	const actionsTable = actionsTableInfo.fullName;

	const funnel = {
		rowsIn: 0,
		hygiene: { innerId: 0, pollutedKeys: 0, seondaryMerged: 0, sentinelsNulled: 0, countySplit: 0 },
		dedup: { groups: 0, autoGroups: 0, ruleGroups: 0, droppedRows: 0, blanksFilled: 0 },
		boilerplate: { templates: 0, flaggedRows: 0 },
		priority: { High: 0, Medium: 0, Low: 0, notYet: 0, review: 0 },
		location: {
			byPrecision: {},
			missingFromView: 0,
			overlayEligible: 0,
			overlayApplied: 0,
			overlayByTier: {},
			overlaySkippedAlreadyP1: 0,
			overlayIdNotInInput: 0,
			addressFilled: 0
		},
		rowsOut: 0
	};

	try {
		// ── pass A: grouping keys ───────────────────────────────────────────────
		// One light sweep computes the duplicate groups and the boilerplate
		// templates before any row is transformed — both need the whole dataset.
		await dispatchEvent("actions_cleaned:GROUPING", "pass A: computing duplicate + template groups");

		const byExact = new Map();   // exactKey -> [id]
		const byBody = new Map();    // bodyKey -> { ids, localities }

		{
			let lastId = 0;
			while (true) {
				const { rows } = await dmsClient.query(`
					SELECT id,
							data->>'${ NAME }' AS name,
							data->>'${ DESC }' AS descr,
							data->>'jurisdiction' AS jurisdiction,
							data->>'county' AS county
						FROM ${ actionsTable }
							WHERE type = $1 AND id > $2
							ORDER BY id
							LIMIT ${ PAGE_SIZE };
				`, [actionsType, lastId]);
				if (!rows.length) break;
				for (const r of rows) {
					lastId = Number(r.id);
					++funnel.rowsIn;
					const d = { [NAME]: r.name, [DESC]: r.descr,
						jurisdiction: r.jurisdiction, county: r.county };
					const ek = exactKey(d);
					if (ek != null) {
						(byExact.get(ek) ?? byExact.set(ek, []).get(ek)).push(String(r.id));
					}
					const bk = bodyKey(d);
					if (bk != null) {
						const entry = byBody.get(bk) ?? byBody.set(bk, { ids: [], localities: new Set() }).get(bk);
						entry.ids.push(String(r.id));
						entry.localities.add(boilerLocKey(d));
					}
				}
			}
		}

		const groupOfId = new Map();   // id -> group index
		const groups = [];
		for (const ids of byExact.values()) {
			if (ids.length < 2) continue;
			const gi = groups.length;
			groups.push({ ids, members: [] });
			for (const id of ids) groupOfId.set(id, gi);
		}
		funnel.dedup.groups = groups.length;

		const boiler = new Map();      // id -> { template_key, template_size }
		for (const [bk, entry] of byBody) {
			if (entry.ids.length < 2 || entry.localities.size < 2) continue;
			++funnel.boilerplate.templates;
			const tk = templateKey(bk);
			const size = entry.localities.size;
			for (const id of entry.ids) boiler.set(id, { template_key: tk, template_size: size });
		}
		byBody.clear();

		await dispatchEvent("actions_cleaned:GROUPING",
			`${ funnel.rowsIn } actions · ${ groups.length } duplicate groups · ${ funnel.boilerplate.templates } templates`);
		await updateProgress(0.2);

		// ── location inputs ─────────────────────────────────────────────────────
		const locations = await loadLocations(db, locationsView);
		const { overlay, skippedReview, skippedLow } = loadOverlay();
		funnel.location.overlayEligible = overlay.size;
		await dispatchEvent("actions_cleaned:LOCATIONS",
			`${ locations.size } located actions from view ${ locationsView } · ` +
			`${ overlay.size } recovered coordinates (${ skippedLow } low-confidence + ${ skippedReview } review rows excluded)`);
		await updateProgress(0.3);

		// ── output view + table ─────────────────────────────────────────────────
		let data_table = null, table_name = null, view_id = null;
		if (!dryRun) {
			const newDamaView = await createDamaView({
				source_id: sourceId,
				user_id: userId,
				metadata: { task_id: task.task_id }
			}, pgEnv);
			({ table_name, data_table, view_id } = newDamaView);

			const columnDefs = COLUMNS.map(c => `"${ c.name }" ${ c.type }`).join(",\n\t\t\t");
			await db.query(`
				CREATE TABLE ${ data_table }(
					ogc_fid BIGSERIAL PRIMARY KEY,
					${ columnDefs }
				);
			`);
			await dispatchEvent("actions_cleaned:TABLE", `created ${ data_table } (view ${ view_id })`);
		}
		else {
			await dispatchEvent("actions_cleaned:TABLE", "DRY RUN — no view or table created");
		}

		// ── insert machinery ────────────────────────────────────────────────────
		const insertCols = COLUMNS.map(c => `"${ c.name }"`).join(", ");
		let buffer = [];
		const flush = async () => {
			if (!buffer.length || dryRun) { buffer = []; return; }
			const params = [];
			const tuples = buffer.map(row => {
				const ph = row.map(v => { params.push(v); return `$${ params.length }`; });
				return `(${ ph.join(",") })`;
			});
			await db.query(
				`INSERT INTO ${ data_table } (${ insertCols }) VALUES ${ tuples.join(",") };`,
				params
			);
			buffer = [];
		};

		// ── the per-row transform ───────────────────────────────────────────────
		const transform = (id, rawData, mergedIds) => {
			const { cols, data, counters } = cleanRow(rawData);
			for (const k of Object.keys(counters)) funnel.hygiene[k] += counters[k];

			const pr = parsePriority(rawData.priority);
			if (pr.priority === "Not Yet Prioritized") ++funnel.priority.notYet;
			else if (pr.priority) ++funnel.priority[pr.priority];
			else ++funnel.priority.review;

			const b = boiler.get(String(id));
			if (b) ++funnel.boilerplate.flaggedRows;

			const loc = resolveLocation({ ids: [id, ...mergedIds], locations, overlay });
			if (loc.missing) ++funnel.location.missingFromView;
			else funnel.location.byPrecision[loc.precision] =
				(funnel.location.byPrecision[loc.precision] || 0) + 1;
			if (loc.overlaid) {
				++funnel.location.overlayApplied;
				funnel.location.overlayByTier[loc.location_method] =
					(funnel.location.overlayByTier[loc.location_method] || 0) + 1;
				if (loc.overlayAddress && !cols.address_if_available) {
					cols.address_if_available = loc.overlayAddress;
					++funnel.location.addressFilled;
				}
			}
			else if ([id, ...mergedIds].some(i => overlay.has(String(i)))) {
				++funnel.location.overlaySkippedAlreadyP1;
			}

			const geometry = loc.lon == null ? null
				: `SRID=4326;POINT(${ loc.lon } ${ loc.lat })`;

			++funnel.rowsOut;
			return [
				Number(id),
				cols.scope, cols.county, cols.counties, cols.county_geoid,
				cols.jurisdiction, cols.geoid_juris,
				cols.action_name, cols.action_description, cols.problem_statement,
				cols.primary_hazard_type, cols.secondary_hazard_type, cols.primary_action_type,
				cols.action_status, cols.implementation_status,
				cols.estimated_cost, cols.cost_range, cols.lead_agency, cols.funding_sources,
				cols.address_if_available,
				pr.priority, pr.priority_original, pr.priority_score, pr.priority_rank, pr.priority_notes,
				cols.county_priority,
				Boolean(b), b?.template_key ?? null, b?.template_size ?? null,
				mergedIds.length ? JSON.stringify(mergedIds.map(Number)) : null,
				cols.is_valid,
				loc.precision, loc.location_method, loc.location_confidence, loc.dist_from_centroid_km,
				geometry,
				JSON.stringify(data)
			];
		};

		// ── pass B: full rows ───────────────────────────────────────────────────
		// Non-duplicate rows transform and insert as they stream; duplicate-group
		// members are buffered (only ~4k rows) and resolved after the sweep.
		await dispatchEvent("actions_cleaned:STREAM", "pass B: transforming rows");

		{
			let lastId = 0, scanned = 0;
			while (true) {
				const { rows } = await dmsClient.query(`
					SELECT id, data, updated_at
						FROM ${ actionsTable }
							WHERE type = $1 AND id > $2
							ORDER BY id
							LIMIT ${ PAGE_SIZE };
				`, [actionsType, lastId]);
				if (!rows.length) break;
				for (const r of rows) {
					lastId = Number(r.id);
					++scanned;
					const id = String(r.id);
					const gi = groupOfId.get(id);
					if (gi != null) {
						groups[gi].members.push({ id, data: r.data, updated_at: r.updated_at });
					}
					else {
						buffer.push(transform(id, r.data, []));
						if (buffer.length >= INSERT_BATCH) await flush();
					}
				}
				await updateProgress(0.3 + 0.5 * (scanned / Math.max(funnel.rowsIn, 1)));
			}
		}
		await flush();

		// ── resolve duplicate groups ────────────────────────────────────────────
		// Survivor = valid, most complete, most recently updated. Its blanks are
		// filled from the dropped copies (newest non-empty value), so collapsing
		// loses no content — the "keep the richer copy" rule.
		for (const g of groups) {
			const members = g.members;
			if (members.length < 2) {
				// shouldn't happen (group keys came from the same table) — emit
				// whatever arrived rather than dropping data silently
				for (const m of members) {
					buffer.push(transform(m.id, m.data, []));
				}
				continue;
			}

			if (conflictFields(members).length) ++funnel.dedup.ruleGroups;
			else ++funnel.dedup.autoGroups;

			const isValid = d => !(d.isValid === false || d.isValid === "false");
			const sorted = [...members].sort((a, b) =>
				(isValid(b.data) - isValid(a.data)) ||
				(completeness(b.data) - completeness(a.data)) ||
				(new Date(b.updated_at) - new Date(a.updated_at)) ||
				(Number(b.id) - Number(a.id))
			);
			const survivor = sorted[0];
			const dropped = sorted.slice(1);
			funnel.dedup.droppedRows += dropped.length;

			const merged = { ...survivor.data };
			const byRecency = [...dropped].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
			const keys = new Set();
			for (const m of members) for (const k of Object.keys(m.data)) if (isSubstantive(k)) keys.add(k);
			for (const k of keys) {
				if (!isEmpty(merged[k])) continue;
				const donor = byRecency.find(m => !isEmpty(m.data[k]));
				if (donor) {
					merged[k] = donor.data[k];
					++funnel.dedup.blanksFilled;
				}
			}

			buffer.push(transform(survivor.id, merged, dropped.map(m => m.id)));
			if (buffer.length >= INSERT_BATCH) await flush();
		}
		await flush();

		await dispatchEvent("actions_cleaned:STREAM",
			`${ funnel.rowsIn } in → ${ funnel.rowsOut } out (${ funnel.dedup.droppedRows } duplicate rows merged away)`);
		await updateProgress(0.85);

		// ── indexes + metadata ──────────────────────────────────────────────────
		if (!dryRun) {
			await db.query(`CREATE INDEX ON ${ data_table } USING GIST (wkb_geometry);`);
			await db.query(`CREATE INDEX ON ${ data_table } (action_id);`);
			await db.query(`ANALYZE ${ data_table };`);

			// without metadata.columns every UDA/Table/DataWrapper surface renders
			// an empty grid; desc AND description so the metadata page shows them
			const columns = COLUMNS.map(c => ({
				name: c.name,
				display_name: c.display,
				type: c.type.startsWith("GEOMETRY") ? "GEOMETRY" : c.type.replace("[]", "").trim(),
				desc: c.desc,
				description: c.desc
			}));
			await db.query(`
				UPDATE data_manager.sources
					SET metadata = COALESCE(metadata, '{}') || $1
						WHERE source_id = $2;
			`, [JSON.stringify({ columns }), sourceId]);

			const tiles = {
				sources: [
					{ id: table_name,
						source: {
							tiles: [`https://dmsserver.availabs.org/dama-admin/${ pgEnv }/tiles/${ view_id }/{z}/{x}/{y}/t.pbf`],
							format: "pbf",
							type: "vector"
						}
					}
				],
				layers: [
					{ id: `s${ sourceId }_v${ view_id }_actions`,
						type: "circle",
						paint: { "circle-color": "#000", "circle-radius": 4 },
						source: table_name,
						"source-layer": `view_${ view_id }`
					}
				]
			};
			await db.query(`
				UPDATE data_manager.views
					SET metadata = COALESCE(metadata, '{}') || $1
						WHERE view_id = $2;
			`, [JSON.stringify({ tiles }), view_id]);

			await dispatchEvent("actions_cleaned:METADATA", "source columns + view tiles metadata written");
		}
		await updateProgress(0.95);

		// ── funnel ──────────────────────────────────────────────────────────────
		const f = funnel;
		console.log("\n###########################################");
		console.log("[actions_cleaned/publish] worker completed" + (dryRun ? " (DRY RUN)" : ""));
		console.log(`view_id ${ view_id ?? "—" } · ${ f.rowsIn } actions in → ${ f.rowsOut } rows out`);
		console.log("-------------------------------------------");
		console.log(`hygiene     inner ids dropped ${ f.hygiene.innerId } · artifact keys ${ f.hygiene.pollutedKeys } · seondary merged ${ f.hygiene.seondaryMerged } · sentinels nulled ${ f.hygiene.sentinelsNulled } · counties split ${ f.hygiene.countySplit }`);
		console.log(`dedup       ${ f.dedup.groups } groups (auto ${ f.dedup.autoGroups } / rule ${ f.dedup.ruleGroups }) · dropped ${ f.dedup.droppedRows } · blanks filled ${ f.dedup.blanksFilled }`);
		console.log(`boilerplate ${ f.boilerplate.templates } templates · ${ f.boilerplate.flaggedRows } rows flagged`);
		console.log(`priority    High ${ f.priority.High } · Medium ${ f.priority.Medium } · Low ${ f.priority.Low } · not-yet ${ f.priority.notYet } · review ${ f.priority.review }`);
		console.log(`location    precision ${ JSON.stringify(f.location.byPrecision) } · missing from view ${ f.location.missingFromView }`);
		console.log(`overlay     eligible ${ f.location.overlayEligible } · applied ${ f.location.overlayApplied } ${ JSON.stringify(f.location.overlayByTier) } · already-p1 ${ f.location.overlaySkippedAlreadyP1 } · addresses filled ${ f.location.addressFilled }`);
		console.log("###########################################\n");

		result.results = { view_id, source_id: sourceId, dryRun, funnel };
	}
	catch (e) {
		console.error("[actions_cleaned/publish] failed:", e);
		await dispatchEvent("actions_cleaned:ERROR", `worker failed: ${ e.message || e }`);
		result.ok = false;
		result.error = e.message || String(e);
	}
	finally {
		await dmsClient.end();
	}

	await updateProgress(1);
	result.completedAt = new Date().toLocaleString();
	await dispatchEvent("actions_cleaned:FINAL", "finished", result);
	return result;
};

module.exports = Worker;
