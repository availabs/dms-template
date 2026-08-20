const Worker = require("./worker");

module.exports = {
	workers: {
		"actions_cleaned/publish": Worker
	},

	routes: (router, helpers) => {
		// Mounts as POST /dama-admin/:pgEnv/actions_cleaned/publish
		router.post("/publish", async (req, res) => {

			console.log("actions_cleaned/publish request:", req.body);

			const args = { ...(req.body || {}) };

			const {
				sourceName,
				sourceId = null,
				userId = null,
				actionsSource,
				actionsView,
				locationsView
			} = args;

			const missingArgs = [];
			if (!sourceName && !sourceId) missingArgs.push("sourceName");
			if (!actionsSource) missingArgs.push("actionsSource");
			if (!actionsView) missingArgs.push("actionsView");
			if (!locationsView) missingArgs.push("locationsView");

			try {
				if (missingArgs.length) {
					throw new Error(`Missing required arguments: ${ missingArgs }`);
				}

				if (!sourceId) {
					const newDamaSource = await helpers.createDamaSource({
						name: sourceName,
						type: "gis_dataset",
						user_id: userId,
						categories: [["Actions"]],
						description:
							"MitigateNY actions with every recommended data-quality transform applied: " +
							"schema hygiene, same-place duplicates merged (keep-the-richer-copy), " +
							"boilerplate templates flagged, priority normalized (originals preserved), " +
							"and location precision + geometry joined from Actions Location with " +
							"high/medium-confidence coordinates recovered from action text. " +
							"Derived read-only from the actions dataset — the inputs are never modified."
					}, req.params.pgEnv);

					args.sourceId = newDamaSource.source_id;
				}

				const taskId = await helpers.queueTask({
					workerPath: "actions_cleaned/publish",
					...args
				}, req.params.pgEnv);

				res.json({ ok: true, etl_context_id: taskId, source_id: args.sourceId });
			}
			catch (err) {
				console.error("[actions_cleaned/publish] route failed:", err);
				res.status(500).json({ ok: false, error: err.message || err });
			}
		});
	}
};
