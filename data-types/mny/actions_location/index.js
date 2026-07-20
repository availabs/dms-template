const Worker = require("./worker");

module.exports = {
  workers: {
    'actions_location/publish': Worker,
  },

  routes: (router, helpers) => {
    // Mounts as POST /dama-admin/:pgEnv/actions_location/publish
    router.post('/publish', async (req, res) => {

      console.log("actions_location/publish request:", req.body);

      const args = { ...(req.body || {}) };

      let {
        sourceName,
        sourceId = null,

        userId = null,

        actionsSource,
        actionsView,

        jurisdictionsSource,
        jurisdictionsView,

        countiesSource,
        countiesView
      } = args;

      const missingArgs = [];
      if (!sourceName) {
        missingArgs.push("sourceName");
      }
      if (!actionsSource) {
        missingArgs.push("actionsSource");
      }
      if (!jurisdictionsView) {
        missingArgs.push("jurisdictionsView");
      }
      if (!countiesView) {
        missingArgs.push("countiesView");
      }

      try {
        if (missingArgs.length) {
          throw new Error(`Missing required arguments: ${ missingArgs }`);
        }

        if (!sourceId) {
          const newDamaSource = await helpers.createDamaSource({
            name: sourceName,
            type: 'gis_dataset',
            user_id: userId,
            categories:[["Action Locations"]]
          }, req.params.pgEnv);

console.log("newDamaSource", newDamaSource);

          args.sourceId = newDamaSource.source_id;
        }

        const taskId = await helpers.queueTask({
          workerPath: 'actions_location/publish',
          createDamaView: helpers.createDamaView,
          ...args
        }, req.params.pgEnv);

        res.json({ ok: true, etl_context_id: taskId, source_id: args.sourceId });
      }
      catch (err) {
        console.error('[actions_location/publish] route failed:', err);
        res.status(500).json({ ok: false, error: err.message || err });
      }
    });
  },
};