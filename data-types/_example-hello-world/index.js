/**
 * Example datatype plugin — `_example-hello-world`.
 *
 * Reference for developers writing a new datatype under `data-types/`. NOT
 * registered in `data-types/register-datatypes.js` — the leading underscore
 * in the directory name signals "example/skeleton, do not load."
 *
 * To use this as a starting point:
 *   1. Copy the directory to `data-types/<your-name>/`
 *   2. Replace `hello-world` everywhere below with your datatype name
 *   3. Add `registerDatatype('<your-name>', require('./<your-name>'));`
 *      to `data-types/register-datatypes.js`
 *
 * The file is laid out the way a real plugin would be — the smaller plugins
 * (one worker, one route) can keep everything in `index.js`. Larger plugins
 * (see `data-types/map21/`) split workers, helpers, and SQL builders into
 * separate files and re-export the route + worker handlers from `index.js`.
 *
 * --- Plugin shape ---------------------------------------------------------
 *
 * A plugin module exports an object with two optional keys:
 *
 *   workers — map of `<workerPath>` → async handler. The worker path is
 *             written to `tasks.worker_path` when the route enqueues a task,
 *             and `registerHandler(workerPath, handler)` keys it. Convention
 *             is `<datatype-name>/<action>`, but any string works.
 *
 *   routes  — `(router, helpers) => void`. Mounted at
 *             `/dama-admin/:pgEnv/<datatype-name>/`. The router is created
 *             with `mergeParams: true` so `req.params.pgEnv` is available.
 *
 * --- Worker `ctx` shape (from src/dama/tasks/index.js startTaskWorker) ----
 *
 *   ctx.task            — the row from data_manager.tasks (or `tasks` for
 *                         sqlite). Has task_id, descriptor (the object the
 *                         route passed to queueTask), source_id, etc.
 *   ctx.pgEnv           — database config name (e.g. 'npmrds2')
 *   ctx.db              — db adapter (postgres or sqlite). Use ctx.db.query.
 *   ctx.dispatchEvent   — (type, message, payload?) → Promise. Writes to
 *                         task_events. `type` is the polled key — keep the
 *                         legacy `<datatype>:<EVENT>` format if a client is
 *                         already polling.
 *   ctx.updateProgress  — (progress: 0..1) → Promise. Drives the UI bar.
 *
 * --- Route `helpers` shape (from mountDatatypeRoutes) ---------------------
 *
 *   helpers.queueTask({ workerPath, sourceId?, ...descriptor }, pgEnv)
 *       → enqueue a task; returns taskId. `descriptor.workerPath` is the
 *         only required field; everything else is plugin-defined and
 *         surfaces as `ctx.task.descriptor.*` in the worker.
 *
 *   helpers.getTaskStatus(taskId, pgEnv)
 *   helpers.getTaskEvents(taskId, pgEnv, sinceEventId?)
 *   helpers.dispatchEvent(taskId, type, message, payload?, pgEnv)
 *       → out-of-band event from a route (rare).
 *
 *   helpers.createDamaSource({ name, type, user_id, ... }, pgEnv)
 *   helpers.createDamaView({ source_id, user_id, etl_context_id, metadata,
 *                            view_dependencies }, pgEnv)
 *       → metadata helpers. createDamaView auto-sets table_schema/_name to
 *         `gis_datasets.s{source_id}_v{view_id}`; override via UPDATE if
 *         your plugin needs different naming.
 *
 *   helpers.ensureSchema(db, schemaName)
 *       → CREATE SCHEMA IF NOT EXISTS (no-op on sqlite).
 *
 *   helpers.getDb(pgEnv) / helpers.loadConfig(pgEnv)
 *   helpers.storage     → local/S3 storage (.write, .read, .getUrl)
 *
 * --- Response contract ----------------------------------------------------
 *
 * Routes that queue a task should respond with `{ etl_context_id, source_id }`
 * — the legacy client polls events via `etl_context_id`, which IS the new
 * task_id. Keeping this shape lets existing clients work unchanged.
 */

module.exports = {
  workers: {
    // The worker path is what tasks.worker_path stores. Convention:
    // `<datatype-name>/<action>`. Unrelated to the URL path the client hits.
    'hello-world/ping': async (ctx) => {
      // Lifecycle events — type strings are what clients poll for.
      await ctx.dispatchEvent('hello-world:INITIAL', 'ping received', null);

      // Fake some work and report progress.
      await ctx.updateProgress(0.5);

      // The descriptor surfaced here is whatever the route put in queueTask.
      const result = {
        ok: true,
        echoedDescriptor: ctx.task.descriptor,
        ranAt: new Date().toISOString(),
      };

      await ctx.updateProgress(1);
      await ctx.dispatchEvent('hello-world:FINAL', 'pong', result);

      // Return value is persisted on tasks.result. Keep it small —
      // clients poll `getTaskStatus` to read it.
      return result;
    },
  },

  routes: (router, helpers) => {
    // Mounts as POST /dama-admin/:pgEnv/hello-world/ping
    router.post('/ping', async (req, res) => {
      try {
        const taskId = await helpers.queueTask({
          workerPath: 'hello-world/ping',
          // Anything else here is plugin-free-form and shows up as
          // ctx.task.descriptor.* in the worker. Validate inputs first
          // in real plugins (see data-types/map21/index.js for an example).
          ...(req.body || {}),
        }, req.params.pgEnv);

        // Legacy-compatible response shape: etl_context_id IS the task_id;
        // the existing client poll loop hits /events/query?etl_context_id=…
        res.json({ etl_context_id: taskId, source_id: null });
      } catch (err) {
        console.error('[hello-world] route failed:', err);
        res.status(500).json({ error: err.message });
      }
    });
  },
};
