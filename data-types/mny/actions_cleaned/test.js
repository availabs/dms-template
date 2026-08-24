/**
 * Run the actions_cleaned worker locally, outside the dms-server task queue.
 *
 *   node data-types/mny/actions_cleaned/test.js --dry             # full transform + funnel, writes NOTHING
 *   node data-types/mny/actions_cleaned/test.js --dry --skip-geocode  # dry run without the Census batch call
 *                                                                     # (address rows fall to centroids — counts shift)
 *   node data-types/mny/actions_cleaned/test.js --source-id <id>  # publish a new view under an existing source
 *   node data-types/mny/actions_cleaned/test.js --create-source   # create the "Actions Cleaned" source, then publish
 *
 * A real run CREATES A NEW VIEW (and its physical table) under the output
 * source — that is how a new version of the dataset is published. It never
 * touches the actions dataset or prior views. --skip-geocode is refused on a
 * real run: it would publish degraded precisions.
 */
const Worker = require("./worker.js");
const { getDb } = require("@availabs/dms-server/src/db");
const { createDamaSource } = require("@availabs/dms-server/src/dama/upload/metadata");

const PG_ENV = "hazmit_dama";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry");
const skipGeocode = args.includes("--skip-geocode");
const createSource = args.includes("--create-source");
const sidIdx = args.indexOf("--source-id");
let sourceId = sidIdx >= 0 ? Number(args[sidIdx + 1]) : null;

if (skipGeocode && !dryRun) {
	console.error("--skip-geocode is a dry-run-only flag: a real publish would write degraded precisions");
	process.exit(1);
}

const DESCRIPTOR = {
	userId: null,

	// input: the Mitigate-NY actions internal dataset (lives on dms-mercury-3)
	actionsSource: 1029065,
	actionsView: 1074456,

	// waterfall centroid inputs: NFIP community layer + TIGER counties
	jurisdictionsView: 2297,
	countiesView: 2157,

	skipGeocode,
	dryRun
};

(async () => {
	const db = getDb(PG_ENV);

	if (!dryRun && !sourceId && createSource) {
		const source = await createDamaSource({
			name: "Actions Cleaned",
			type: "gis_dataset",
			user_id: null,
			categories: [["Actions"]],
			description:
				"MitigateNY actions with every recommended data-quality transform applied: " +
				"schema hygiene, same-place duplicates merged (keep-the-richer-copy), " +
				"boilerplate templates flagged, priority normalized (originals preserved), " +
				"and location precision + geometry computed in-process by the geolocation " +
				"waterfall (coordinates → geocoded address → jurisdiction/county centroid), " +
				"with high/medium-confidence coordinates recovered from action text overlaid. " +
				"Derived read-only from the actions dataset (source 1029065) — the inputs " +
				"are never modified."
		}, PG_ENV);
		sourceId = source.source_id;
		// match Actions Location (11725): legacy-public visibility, not creator-private
		await db.query(
			`UPDATE data_manager.sources SET auth_permissions = NULL WHERE source_id = $1;`,
			[sourceId]
		);
		console.log(`created source ${ sourceId } ("${ source.name }")`);
	}

	if (!dryRun && !sourceId) {
		console.error("a real run needs --source-id <id> or --create-source");
		process.exit(1);
	}

	const ctx = {
		dispatchEvent: (type, message) => console.log(`  [${ type }] ${ message }`),
		updateProgress: () => {},
		db,
		pgEnv: PG_ENV,
		task: {
			task_id: null,          // no etl_context when run outside the queue
			descriptor: { ...DESCRIPTOR, sourceId }
		}
	};

	console.log(`\nactions_cleaned → ${ dryRun ? "DRY RUN" : `source ${ sourceId }` } on ${ PG_ENV }\n`);
	const result = await Worker(ctx);
	if (!result.ok) {
		console.error("FAILED:", result);
		process.exit(1);
	}
	console.log("result:", JSON.stringify(result.results, null, 2));
	process.exit(0);
})();
