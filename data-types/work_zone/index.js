/**
 * work_zone datatype plugin — NYSDOT work-zone safety & mobility measures.
 *
 * Builds the measure set recommended in
 * reports/workzone_safety/05_recommendation_report.md for the FHWA Work Zone
 * Safety and Mobility Rule (23 CFR 630 Subpart J) out of data AVAIL already
 * holds: TRANSCOM events, TRANSCOM event×TMC delay, NPMRDS speeds (ClickHouse)
 * and metadata/AADT, excessive delay, plus public NYS crash and STIP data.
 *
 * ONE route with a stage selector, not one route per product:
 *
 *   POST /publish   { stage, ... }  create the stage's output source if needed
 *                                   and queue its worker for a date window.
 *                                   → { etl_context_id, source_id, stage }
 *   GET  /status    ?etl_context_id= task status (+ events with ?events=1)
 *   GET  /stages                     the stage registry, which stages are
 *                                    runnable, and the default thresholds —
 *                                    the Create page renders its form from it.
 *
 * `stages.js` declares the pipeline; this file's `workers` map decides what is
 * actually runnable. A stage whose worker has not landed yet 400s naming the
 * phase that delivers it, rather than queueing a task nothing can pick up.
 *
 * Design rules this plugin holds itself to (task doc § Design rules):
 *   - upstream data is addressed by SOURCE ID in the descriptor, resolved to a
 *     view at run time — never a hardcoded view id;
 *   - every stage is idempotent and windowed: re-running a month replaces it;
 *   - thresholds are descriptor parameters with report defaults, and the
 *     resolved set is stamped onto the output view metadata;
 *   - no live calls to TRANSCOM or RITIS anywhere — we read the stores.
 *
 * Build phases and their gates live in
 * planning/transportny/tasks/current/workzone-performance-data-type-pipeline.md
 * and are documented stage by stage in ./README.md.
 */
const { STAGES, STAGE_NAMES, STAGES_BY_PHASE, phaseOf } = require('./stages.js');
const { THRESHOLD_SPECS, DEFAULT_THRESHOLDS, resolveThresholds } = require('./lib/thresholds.js');

const spineWorker = require('./workers/spine.js');
const exposureWorker = require('./workers/exposure.js');

/**
 * workerPath → handler. One entry lands per phase; `stages.js` lists the rest
 * as declarations. Adding an entry here is what makes a stage runnable.
 */
const workers = {
  'work_zone/spine': spineWorker,
  'work_zone/exposure': exposureWorker,
};

const isRunnable = (stage) => Boolean(STAGES[stage] && workers[STAGES[stage].workerPath]);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const tableFor = (db, base) => (db.type === 'postgres' ? `data_manager.${base}` : base);

module.exports = {
  workers,

  // schedulables: designed at phase 10 (monthly, windowed) and deliberately
  // NOT wired before then — same stance as the ETL migration task.

  routes: (router, helpers) => {
    // ── GET /stages ──────────────────────────────────────────────────────
    // Static description of the pipeline. No DB access, so it stays useful
    // for orientation even against an env with nothing published yet.
    router.get('/stages', (req, res) => {
      res.json({
        stages: STAGES_BY_PHASE.map((stage) => ({
          stage,
          ...STAGES[stage],
          runnable: isRunnable(stage),
        })),
        thresholds: { defaults: DEFAULT_THRESHOLDS, specs: THRESHOLD_SPECS },
      });
    });

    // ── POST /publish ────────────────────────────────────────────────────
    router.post('/publish', async (req, res) => {
      try {
        const { pgEnv } = req.params;
        const b = req.body || {};
        const {
          stage, source_id, source_values, name, description,
          view_id, target_view_id, start_date, end_date, thresholds,
          user_id, email, parent_context_id,
        } = b;

        if (!stage) {
          return res.status(400).json({ error: `stage is required (one of: ${STAGE_NAMES.join(', ')})` });
        }
        const spec = STAGES[stage];
        if (!spec) {
          return res.status(400).json({ error: `unknown stage '${stage}' (known: ${STAGE_NAMES.join(', ')})` });
        }
        if (!isRunnable(stage)) {
          return res.status(400).json({
            error: `stage '${stage}' is declared but not implemented yet — it lands in phase ${phaseOf(stage)} of the work_zone pipeline`,
          });
        }

        if (spec.requiresWindow) {
          if (!start_date || !end_date) {
            return res.status(400).json({ error: `stage '${stage}' requires start_date and end_date` });
          }
          if (!DATE_RE.test(start_date) || !DATE_RE.test(end_date)) {
            return res.status(400).json({ error: 'start_date and end_date must be YYYY-MM-DD' });
          }
          if (start_date > end_date) {
            return res.status(400).json({ error: 'start_date must not be after end_date' });
          }
        }

        const missing = spec.inputs.filter((k) => b[k] === undefined || b[k] === null || b[k] === '');
        if (missing.length) {
          return res.status(400).json({ error: `stage '${stage}' requires ${missing.join(', ')}` });
        }

        // Threshold typos and out-of-range values fail here — before a source
        // is created and before a long run starts.
        let resolvedThresholds;
        try {
          resolvedThresholds = resolveThresholds(thresholds);
        } catch (err) {
          return res.status(400).json({ error: err.message });
        }

        if (!source_id && !name) {
          return res.status(400).json({ error: 'name is required when creating a new source' });
        }

        // The source ids this stage consumes, carried into the descriptor and
        // cross-linked on the output source's metadata.
        const inputRefs = {};
        for (const key of [...spec.inputs, ...spec.optionalInputs]) {
          if (b[key] !== undefined && b[key] !== null && b[key] !== '') {
            inputRefs[key] = key.endsWith('_id') && !Number.isNaN(Number(b[key])) ? Number(b[key]) : b[key];
          }
        }

        // Re-running into an existing source: it must be the type this stage
        // produces. Writing spine rows into a wz_speed source would corrupt
        // both the table and the source's single column list.
        if (source_id) {
          const db = helpers.getDb(pgEnv);
          const { rows } = await db.query(
            `SELECT type FROM ${tableFor(db, 'sources')} WHERE source_id = $1`, [source_id]);
          if (!rows[0]) {
            return res.status(400).json({ error: `no source ${source_id}` });
          }
          if (rows[0].type !== spec.sourceType) {
            return res.status(400).json({
              error: `source ${source_id} is a '${rows[0].type}' source — stage '${stage}' writes '${spec.sourceType}'`,
            });
          }
        }

        let resolvedSourceId = source_id;
        if (!resolvedSourceId) {
          const source = await helpers.createDamaSource({
            ...(source_values || {}),
            name,
            description,
            type: spec.sourceType,
            user_id,
            metadata: { work_zone_stage: stage, ...inputRefs },
          }, pgEnv);
          resolvedSourceId = source.source_id;
        }

        const taskId = await helpers.queueTask({
          workerPath: spec.workerPath,
          sourceId: resolvedSourceId,
          source_id: resolvedSourceId,
          stage,
          name: name ?? null,
          user_id: user_id ?? null,
          email: email ?? null,
          // A windowed stage replaces the window it is given; a file-driven
          // stage carries nulls rather than an invented range.
          start_date: spec.requiresWindow ? start_date : (start_date ?? null),
          end_date: spec.requiresWindow ? end_date : (end_date ?? null),
          thresholds: resolvedThresholds,
          // Re-runs upsert into an existing view when one is named.
          view_id: view_id ?? null,
          target_view_id: target_view_id ?? null,
          ...inputRefs,
          // carried for correlation only — there is no etl_contexts table
          parent_context_id: parent_context_id ?? null,
        }, pgEnv);

        res.json({
          etl_context_id: taskId,
          source_id: resolvedSourceId,
          stage,
          source_type: spec.sourceType,
        });
      } catch (err) {
        console.error('[work_zone] /publish failed:', err);
        res.status(500).json({ error: err.message });
      }
    });

    // ── GET /status ──────────────────────────────────────────────────────
    router.get('/status', async (req, res) => {
      try {
        const { pgEnv } = req.params;
        const taskId = req.query.etl_context_id || req.query.task_id;
        if (!taskId) {
          return res.status(400).json({ error: 'etl_context_id is required' });
        }
        const status = await helpers.getTaskStatus(taskId, pgEnv);
        if (!status) return res.status(404).json({ error: `no task ${taskId}` });

        const events = req.query.events && helpers.getTaskEvents
          ? await helpers.getTaskEvents(taskId, pgEnv)
          : undefined;

        res.json({ etl_context_id: taskId, ...status, ...(events ? { events } : {}) });
      } catch (err) {
        console.error('[work_zone] /status failed:', err);
        res.status(500).json({ error: err.message });
      }
    });
  },
};
