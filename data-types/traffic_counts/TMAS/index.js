const { buffer } = require('stream/consumers');
const busboy = require('busboy');

const Worker = require("./worker");

module.exports = {
  workers: {
    'TMAS_uploader/worker': Worker,
  },

  routes: (router, helpers) => {
    // Mounts as POST /dama-admin/:pgEnv/actions_location/publish
    router.post('/publish', async (req, res) => {

      console.log("TMAS_uploader/publish::req.body", req.body);

      // let {
      //   sourceName,
      //   sourceId = null,

      //   userId = null,

      //   actionsSource,
      //   actionsView,

      //   jurisdictionsSource,
      //   jurisdictionsView,

      //   countiesSource,
      //   countiesView
      // } = args;

      const missingArgs = [];
      // if (!sourceName) {
      //   missingArgs.push("sourceName");
      // }
      // if (!actionsSource) {
      //   missingArgs.push("actionsSource");
      // }
      // if (!jurisdictionsView) {
      //   missingArgs.push("jurisdictionsView");
      // }
      // if (!countiesView) {
      //   missingArgs.push("countiesView");
      // }

      try {

        const bb = busboy({ headers: req.headers });
        const args = {};

        let bufferedFile;

        bb.on('field', (name, value) => {
          args[name] = value;
        });

        bb.on('file', async (fieldName, stream, info) => {
          // const tempPath = path.join(os.tmpdir(), `dms-fileupload-${randomUUID()}`);
          // savedFilePath = tempPath;
          // stream.pipe(fs.createWriteStream(tempPath));
          bufferedFile = await buffer(stream);
        });

        bb.on('finish', async () => {
          console.log("bufferedFile", bufferedFile.length);

          const taskId = await helpers.queueTask({
            workerPath: 'TMAS_uploader/worker',
            bufferedFile,
            ...args
          }, req.params.pgEnv);

          res.json({ ok: true, etl_context_id: "taskId", source_id: args.source_id });
        });

        req.pipe(bb);

        // if (!sourceId) {
        //   const newDamaSource = await helpers.createDamaSource({
        //     name: sourceName,
        //     type: 'gis_dataset',
        //     user_id: userId,
        //     categories:[["Action Locations"]]
        //   }, req.params.pgEnv);

        //   args.sourceId = newDamaSource.source_id;
        // }

        // const taskId = await helpers.queueTask({
        //   workerPath: 'TMAS_uploader/worker',
        //   createDamaView: helpers.createDamaView,
        //   ...args
        // }, req.params.pgEnv);
      }
      catch (err) {
        console.error('[TMAS_uploader/publish] route failed:', err);
        res.status(500).json({ ok: false, error: err.message || err });
      }
    });
  },
};