const { pipeline } = require("node:stream/promises");
const { createWriteStream } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

const { randomUUID } = require('crypto');

const busboy = require('busboy');

const Worker = require("./worker");

module.exports = {
  workers: {
    'TMAS_station_uploader/worker': Worker,
  },

  routes: (router, helpers) => {
    // Mounts as POST /dama-admin/:pgEnv/actions_location/publish
    router.post('/publish', async (req, res) => {

      console.log("TMAS_station_uploader/publish REQUEST RECEIVED", req.params.pgEnv);

      try {

        const bb = busboy({ headers: req.headers });

        const args = {
          tempFilePath: join(tmpdir(), `TMAS_temp_file_${ randomUUID() }`)
        };

        bb.on('field', (name, value) => {
          args[name] = value;
        });

        bb.on('file', async (fieldName, stream, info) => {
          await pipeline(
            stream,
            createWriteStream(args.tempFilePath)
          )
        });

        bb.on('finish', async () => {

          if (!args.source_id) {
            const newDamaSource = await helpers.createDamaSource({
                name: args.source_name,
                type: 'gis_dataset',
                user_id: args.user_id,
                categories: [["TMAS", "Station Data"]]
              },
              req.params.pgEnv
            );
            args.source_id = newDamaSource.source_id;
          }

          const taskId = await helpers.queueTask({
            workerPath: 'TMAS_station_uploader/worker',
            args
          }, req.params.pgEnv);

          res.json({ ok: true, etl_context_id: taskId, source_id: args.source_id });
        });

        req.pipe(bb);
      }
      catch (err) {
        console.error('[TMAS_station_uploader/publish] route failed:', err);
        res.status(500).json({ ok: false, error: err.message || err });
      }
    });
  },
};