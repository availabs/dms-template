/**
 * excessive_delay datatype plugin.
 *
 * Mounts at /dama-admin/:pgEnv/excessive_delay/ via mountDatatypeRoutes.
 *   POST /publish — create the excessive_delay source if needed, resolve the
 *                   npmrds prod/meta + transcom table refs, queue the
 *                   excessive_delay/publish task with a fully self-contained
 *                   descriptor. Returns { etl_context_id, source_id }.
 *   POST /add     — additional years (backfill — gaps allowed) into an
 *                   existing view via the same worker (mode 'add').
 *   POST /remove  — delete by year(s), synchronously (a single DELETE; never
 *                   the legacy TRUNCATE), and recompute the view date range.
 *
 * Critical change from legacy: the computation ran INLINE in the HTTP route
 * (it could time out the server). It now lives in worker.js as a queued task.
 * No etl_contexts anywhere — etl_context_id IS the task_id.
 */
const worker = require('./worker.js');
const sqlb = require('./sql.js');
const delay = require('./delay.js');

const parseMeta = (m) => (typeof m === 'string' ? JSON.parse(m || '{}') : (m || {}));
const tableFor = (db, base) => (db.type === 'postgres' ? `data_manager.${base}` : base);
const stripCh = (s) => (s || '').replace(/^clickhouse\./, '');

const validYears = (years) =>
  Array.isArray(years) && years.length > 0 && years.every((y) => Number.isInteger(Number(y)));

/**
 * Resolve the legacy metadata chain into concrete table refs, once, at queue
 * time — so the descriptor is self-contained and the worker never re-walks
 * fragile source/view metadata:
 *   npmrds production source → its CH view (is_clickhouse_table=1) → prod table
 *                            → metadata.npmrds_meta_view_id → meta table
 *   transcom_congestion source → latest view → transcom table
 */
async function resolveRefs(db, { selectedNpmrdsSourceId, selectedTranscomSourceId }) {
  const sourcesTable = tableFor(db, 'sources');
  const viewsTable = tableFor(db, 'views');

  const { rows: [prodSource] } = await db.query(
    `SELECT * FROM ${sourcesTable} WHERE source_id = $1`, [selectedNpmrdsSourceId]);
  if (!prodSource) throw new Error('Invalid NPMRDS production source');

  const { rows: prodViews } = await db.query(
    `SELECT * FROM ${viewsTable} WHERE source_id = $1 ORDER BY view_id DESC`, [selectedNpmrdsSourceId]);
  const prodView = prodViews.find((v) => Number(parseMeta(v.metadata).is_clickhouse_table) === 1);
  if (!prodView) throw new Error('Invalid NPMRDS production view (no ClickHouse view on the source)');

  const npmrdsMetaViewId = parseMeta(prodView.metadata).npmrds_meta_view_id;
  if (!npmrdsMetaViewId) throw new Error('NPMRDS production view metadata is missing npmrds_meta_view_id');
  const { rows: [metaView] } = await db.query(
    `SELECT * FROM ${viewsTable} WHERE view_id = $1`, [npmrdsMetaViewId]);
  if (!metaView) throw new Error('Invalid NPMRDS meta view');

  const { rows: [transcomView] } = await db.query(
    `SELECT * FROM ${viewsTable} WHERE source_id = $1 ORDER BY view_id DESC LIMIT 1`,
    [selectedTranscomSourceId]);
  if (!transcomView) throw new Error('Invalid transcom_congestion source (no view)');

  return {
    npmrds_production_source_id: Number(selectedNpmrdsSourceId),
    npmrds_production_view_id: prodView.view_id,
    npmrds_prod_table: stripCh(prodView.data_table),
    npmrds_meta_view_id: npmrdsMetaViewId,
    npmrds_meta_table: stripCh(metaView.data_table),
    transcom_source_id: Number(selectedTranscomSourceId),
    transcom_view_id: transcomView.view_id,
    transcom_table: transcomView.data_table || `${transcomView.table_schema}.${transcomView.table_name}`,
  };
}

async function getView(db, { view_id, source_id }) {
  const viewsTable = tableFor(db, 'views');
  if (view_id) {
    const { rows } = await db.query(`SELECT * FROM ${viewsTable} WHERE view_id = $1`, [view_id]);
    return rows[0] || null;
  }
  const { rows } = await db.query(
    `SELECT * FROM ${viewsTable} WHERE source_id = $1 ORDER BY view_id DESC LIMIT 1`, [source_id]);
  return rows[0] || null;
}

module.exports = {
  workers: {
    'excessive_delay/publish': worker,
  },

  schedulables: {
    // Monthly keep-current: previous-complete-month in mode 'add' against the
    // latest view, reusing the npmrds/transcom table refs the publish worker
    // stored on the view metadata (same contract as the /add route's
    // metadata-reuse path — explicit re-picks go through the route, not here).
    'excessive_delay/publish': {
      label: 'Excessive delay (monthly add)',
      defaultCron: '0 6 3 * *', // 3rd of the month, after the congestion run
      params: [
        { name: 'region', type: 'string', optional: true },
        { name: 'methodology', type: 'string', optional: true, default: 'v1' },
      ],
      async buildDescriptor({ schedule, db }) {
        const t = schedule.descriptor || {};
        const view = await getView(db, { source_id: schedule.source_id });
        if (!view) {
          throw new Error(`No excessive_delay view for source ${schedule.source_id} — run publish first`);
        }
        const meta = parseMeta(view.metadata);
        if (!meta.npmrds_prod_table || !meta.npmrds_meta_table || !meta.transcom_table) {
          throw new Error(
            `View ${view.view_id} metadata carries no npmrds/transcom refs — re-run publish (or use the /add route with explicit pickers)`);
        }

        const { rows: srcRows } = await db.query(
          `SELECT name FROM ${tableFor(db, 'sources')} WHERE source_id = $1`, [schedule.source_id]);

        const { year, month } = delay.previousCompleteMonth();

        return {
          mode: 'add',
          methodology: t.methodology === 'v2' ? 'v2' : 'v1',
          source_id: schedule.source_id,
          sourceId: schedule.source_id,
          view_id: view.view_id,
          name: (srcRows[0] && srcRows[0].name) || meta.dama_source_name || 'excessive_delay',
          user_id: t.user_id ?? null,
          email: t.email ?? null,
          years: [year],
          months: [month],
          region: t.region ?? null,
          npmrds_production_source_id: meta.npmrds_production_source_id ?? null,
          npmrds_production_view_id: meta.npmrds_production_view_id ?? null,
          npmrds_prod_table: meta.npmrds_prod_table,
          npmrds_meta_view_id: meta.npmrds_meta_view_id ?? null,
          npmrds_meta_table: meta.npmrds_meta_table,
          transcom_source_id: meta.transcom_source_id ?? null,
          transcom_view_id: meta.transcom_view_id ?? null,
          transcom_table: meta.transcom_table,
        };
      },
    },
  },

  routes: (router, helpers) => {
    router.post('/publish', async (req, res) => {
      try {
        const { pgEnv } = req.params;
        const b = req.body || {};
        const {
          source_id, name, description, user_id, email, years, months, region,
        } = b;
        // legacy client compat: the old route called the picker selectedGeomSourceId
        const selectedNpmrdsSourceId = b.selectedNpmrdsSourceId ?? b.selectedGeomSourceId;
        const selectedTranscomSourceId = b.selectedTranscomSourceId;

        if (!validYears(years))
          return res.status(400).json({ error: 'years (non-empty array of integers) is required' });
        if (!source_id && !name)
          return res.status(400).json({ error: 'name is required' });
        if (!selectedNpmrdsSourceId || !selectedTranscomSourceId)
          return res.status(400).json({ error: 'selectedNpmrdsSourceId and selectedTranscomSourceId are required' });

        const db = helpers.getDb(pgEnv);
        const refs = await resolveRefs(db, { selectedNpmrdsSourceId, selectedTranscomSourceId });

        let resolvedSourceId = source_id;
        let sourceName = name;
        if (!resolvedSourceId) {
          const source = await helpers.createDamaSource({
            ...(b.source_values || {}),
            name, description, type: 'excessive_delay', user_id,
          }, pgEnv);
          resolvedSourceId = source.source_id;
          sourceName = source.name;
        } else if (!sourceName) {
          const { rows } = await db.query(
            `SELECT name FROM ${tableFor(db, 'sources')} WHERE source_id = $1`, [resolvedSourceId]);
          sourceName = (rows[0] && rows[0].name) || 'excessive_delay';
        }

        const taskId = await helpers.queueTask({
          workerPath: 'excessive_delay/publish',
          sourceId: resolvedSourceId,
          mode: 'publish',
          methodology: (req.body || {}).methodology === 'v2' ? 'v2' : 'v1',
          source_id: resolvedSourceId,
          name: sourceName,
          user_id,
          email,
          years: years.map(Number),
          months: Array.isArray(months) && months.length ? months.map(Number) : null,
          region: region ?? null,
          ...refs,
        }, pgEnv);

        res.json({ etl_context_id: taskId, source_id: resolvedSourceId });
      } catch (err) {
        console.error('[excessive_delay] publish route failed:', err);
        res.status(err.message.startsWith('Invalid') ? 400 : 500).json({ error: err.message });
      }
    });

    router.post('/add', async (req, res) => {
      try {
        const { pgEnv } = req.params;
        const b = req.body || {};
        const { source_id, view_id, years, months, region, user_id, email } = b;

        if (!validYears(years))
          return res.status(400).json({ error: 'years (non-empty array of integers) is required' });
        if (!source_id && !view_id)
          return res.status(400).json({ error: 'source_id or view_id is required' });

        const db = helpers.getDb(pgEnv);
        const view = await getView(db, { view_id, source_id });
        if (!view) return res.status(400).json({ error: 'No excessive_delay view found to add to' });
        const meta = parseMeta(view.metadata);

        // Refs: explicit pickers re-resolve (a newer npmrds/transcom view may
        // exist); otherwise reuse the refs the publish worker stored on the view.
        let refs;
        const selectedNpmrdsSourceId = b.selectedNpmrdsSourceId ?? b.selectedGeomSourceId
          ?? meta.npmrds_production_source_id;
        const selectedTranscomSourceId = b.selectedTranscomSourceId ?? meta.transcom_source_id;
        if (b.selectedNpmrdsSourceId || b.selectedGeomSourceId || b.selectedTranscomSourceId) {
          refs = await resolveRefs(db, { selectedNpmrdsSourceId, selectedTranscomSourceId });
        } else if (meta.npmrds_prod_table && meta.npmrds_meta_table && meta.transcom_table) {
          refs = {
            npmrds_production_source_id: meta.npmrds_production_source_id ?? null,
            npmrds_production_view_id: meta.npmrds_production_view_id ?? null,
            npmrds_prod_table: meta.npmrds_prod_table,
            npmrds_meta_view_id: meta.npmrds_meta_view_id ?? null,
            npmrds_meta_table: meta.npmrds_meta_table,
            transcom_source_id: meta.transcom_source_id ?? null,
            transcom_view_id: meta.transcom_view_id ?? null,
            transcom_table: meta.transcom_table,
          };
        } else if (selectedNpmrdsSourceId && selectedTranscomSourceId) {
          refs = await resolveRefs(db, { selectedNpmrdsSourceId, selectedTranscomSourceId });
        } else {
          return res.status(400).json({
            error: 'View metadata carries no npmrds/transcom refs — pass selectedNpmrdsSourceId and selectedTranscomSourceId',
          });
        }

        const resolvedSourceId = source_id || view.source_id;
        const { rows: srcRows } = await db.query(
          `SELECT name FROM ${tableFor(db, 'sources')} WHERE source_id = $1`, [resolvedSourceId]);

        const taskId = await helpers.queueTask({
          workerPath: 'excessive_delay/publish',
          sourceId: resolvedSourceId,
          mode: 'add',
          source_id: resolvedSourceId,
          view_id: view.view_id,
          name: (srcRows[0] && srcRows[0].name) || meta.dama_source_name || 'excessive_delay',
          user_id,
          email,
          years: years.map(Number),
          months: Array.isArray(months) && months.length ? months.map(Number) : null,
          region: region ?? null,
          ...refs,
        }, pgEnv);

        res.json({ etl_context_id: taskId, source_id: resolvedSourceId });
      } catch (err) {
        console.error('[excessive_delay] add route failed:', err);
        res.status(err.message.startsWith('Invalid') ? 400 : 500).json({ error: err.message });
      }
    });

    // Synchronous: a year-scoped DELETE is sub-second; no worker needed.
    router.post('/remove', async (req, res) => {
      try {
        const { pgEnv } = req.params;
        const b = req.body || {};
        const { source_id, view_id, years } = b;

        if (!validYears(years))
          return res.status(400).json({ error: 'years (non-empty array of integers) is required' });
        if (!source_id && !view_id)
          return res.status(400).json({ error: 'source_id or view_id is required' });

        const db = helpers.getDb(pgEnv);
        const view = await getView(db, { view_id, source_id });
        if (!view) return res.status(400).json({ error: 'No excessive_delay view found' });
        const dataTable = view.data_table
          || (db.type === 'postgres' ? `${view.table_schema}.${view.table_name}` : view.table_name);

        await db.query(sqlb.deleteYearsSQL({ table: dataTable, years }));

        // Recompute the date range from what actually remains.
        const { rows: periodRows } = await db.query(sqlb.distinctPeriodsSQL(dataTable));
        const have = periodRows.map((r) => ({ year: Number(r.year), month: Number(r.month) }));
        const remainingYears = [...new Set(have.map((p) => p.year))].sort((a, b) => a - b);
        const bounds = (p) => delay.expandPeriods({ years: [p.year], months: [p.month] })[0];
        const viewsTable = tableFor(db, 'views');
        const meta = parseMeta(view.metadata);
        await db.query(
          `UPDATE ${viewsTable} SET metadata = $1 WHERE view_id = $2`,
          [JSON.stringify({
            ...meta,
            years: remainingYears,
            start_date: have.length ? bounds(have[0]).startDate : null,
            end_date: have.length ? bounds(have[have.length - 1]).endDate : null,
          }), view.view_id]
        );

        res.json({
          source_id: source_id || view.source_id,
          view_id: view.view_id,
          removed_years: years.map(Number),
          years: remainingYears,
        });
      } catch (err) {
        console.error('[excessive_delay] remove route failed:', err);
        res.status(500).json({ error: err.message });
      }
    });
  },
};
