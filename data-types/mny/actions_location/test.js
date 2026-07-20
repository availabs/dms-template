/**
 * Run the actions_location worker locally, outside the dms-server task queue.
 *
 *   node data-types/mny/actions_location/test.js            # publish a new view on source 11725
 *   node data-types/mny/actions_location/test.js --dry      # resolve + log the funnel, write nothing
 *
 * A real run CREATES A NEW VIEW (and its physical table) under the output
 * source — that is how a new version of the dataset is published. It does not
 * touch the previous view.
 */
const Worker = require("./worker.js");
const { getDb } = require('@availabs/dms-server/src/db');

const PG_ENV = "hazmit_dama";

const DESCRIPTOR = {
	// output: the "Actions Location" gis_dataset source
	sourceId: 11725,
	userId: null,

	// input: the Mitigate-NY actions internal dataset (lives on dms-mercury-3)
	actionsSource: 1029065,
	actionsView: 1074456,

	// rung 3: NFIP community layer — jurisdiction polygons
	jurisdictionsSource: 1612,
	jurisdictionsView: 2297,

	// rung 4: TIGER counties
	countiesSource: 1567,
	countiesView: 2157,
};

const ctx = {
	dispatchEvent: (type, message) => console.log(`  [${ type }] ${ message }`),
	updateProgress: p => console.log(`  progress: ${ Math.round(p * 100) }%`),
	db: getDb(PG_ENV),
	pgEnv: PG_ENV,
	task: {
		task_id: null,          // no etl_context when run outside the queue
		descriptor: DESCRIPTOR
	}
};

(async () => {
	console.log(`\nactions_location → source ${ DESCRIPTOR.sourceId } on ${ PG_ENV }\n`);
	const result = await Worker(ctx);
	if (!result.ok) {
		console.error("FAILED:", result);
		process.exit(1);
	}
	console.log("result:", JSON.stringify(result.results, null, 2));
	process.exit(0);
})();
