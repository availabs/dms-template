#!/usr/bin/env node
/**
 * Run a work_zone stage directly, for a phase gate's live validation.
 *
 * The normal path is `POST /dama-admin/:pgEnv/work_zone/publish`, but that
 * needs a dms-server that has this plugin loaded — a restart the phase gates
 * should not depend on. This driver builds the same ctx the task runner would
 * and calls the worker in-process.
 *
 *   node work_zone/run-stage.js spine 2024-01-01 2024-12-31
 *   WZ_SOURCE_ID=2193 node work_zone/run-stage.js spine 2024-01-01 2024-01-31
 *   PG_ENV=npmrds2 node work_zone/run-stage.js spine 2024-03-01 2024-03-31
 *
 * WRITES to the pgEnv: creates DAMA sources, views and tables.
 *
 * Two ids to pass once you have them, or every run spawns new objects:
 *   WZ_SOURCE_ID   reuse the output source (otherwise a new source per run)
 *   WZ_VIEW_ID     upsert into an existing view (otherwise a new view + table
 *                  per run — the stage is idempotent WITHIN a view, so a re-run
 *                  without this leaves the previous table behind)
 *   WZ_TMC_VIEW_ID the same, for the wz_event_tmc output
 *
 * Upstream source ids default to the npmrds2 production ones and can be
 * overridden with TRANSCOM_SOURCE_ID / NPMRDS_META_SOURCE_ID / EVENT_TMC_SOURCE_ID.
 */
const PG_ENV = process.env.PG_ENV || 'npmrds2';
const [stage, start, end] = process.argv.slice(2);

const UPSTREAM = {
  transcom_source_id: Number(process.env.TRANSCOM_SOURCE_ID || 956),
  npmrds_meta_source_id: Number(process.env.NPMRDS_META_SOURCE_ID || 582),
  transcom_event_tmc_source_id: Number(process.env.EVENT_TMC_SOURCE_ID || 1635),
  npmrds_source_id: Number(process.env.NPMRDS_SOURCE_ID || 583),
};

async function main() {
  if (!stage || !start || !end) {
    console.error('usage: node work_zone/run-stage.js <stage> <start YYYY-MM-DD> <end YYYY-MM-DD>');
    process.exit(2);
  }
  const { STAGES } = require('./stages.js');
  const plugin = require('./index.js');
  const spec = STAGES[stage];
  if (!spec) throw new Error(`unknown stage '${stage}'`);
  const worker = plugin.workers[spec.workerPath];
  if (!worker) throw new Error(`stage '${stage}' has no worker yet (phase ${spec.phaseLabel || spec.phase})`);

  const dbMod = require('@availabs/dms-server/src/db');
  const metadata = require('@availabs/dms-server/src/dama/upload/metadata');
  dbMod.getDb(PG_ENV);
  await dbMod.awaitReady();
  const db = dbMod.getDb(PG_ENV);

  let sourceId = process.env.WZ_SOURCE_ID ? Number(process.env.WZ_SOURCE_ID) : null;
  if (!sourceId) {
    const src = await metadata.createDamaSource({
      name: `Work Zone ${spec.sourceType} (${stage})`,
      type: spec.sourceType,
      description: spec.desc,
      user_id: 1,
      metadata: { work_zone_stage: stage, ...UPSTREAM },
    }, PG_ENV);
    sourceId = src.source_id;
    console.log(`created ${spec.sourceType} source ${sourceId}`);
  }

  // Stages after the spine consume the spine's own sources, so those ids are
  // passed too; WZ_EVENT_SOURCE_ID / WZ_EVENT_TMC_SOURCE_ID name them.
  const descriptor = {
    source_id: sourceId, ...UPSTREAM, start_date: start, end_date: end, user_id: 1,
    target_view_id: process.env.WZ_VIEW_ID ? Number(process.env.WZ_VIEW_ID) : null,
    target_tmc_view_id: process.env.WZ_TMC_VIEW_ID ? Number(process.env.WZ_TMC_VIEW_ID) : null,
  };
  if (process.env.WZ_EVENT_SOURCE_ID) descriptor.wz_event_source_id = Number(process.env.WZ_EVENT_SOURCE_ID);
  if (process.env.WZ_EVENT_TMC_SOURCE_ID) descriptor.wz_event_tmc_source_id = Number(process.env.WZ_EVENT_TMC_SOURCE_ID);
  if (process.env.WZ_DURATION_BASIS) descriptor.duration_basis = process.env.WZ_DURATION_BASIS;
  // phase 3 also needs PM3 (the reference speed) and the view-2799 table whose
  // epoch bounds define each zone's active window.
  if (process.env.PM3_SOURCE_ID) descriptor.pm3_source_id = Number(process.env.PM3_SOURCE_ID);
  if (process.env.EVENT_TMC_TABLE) descriptor.event_tmc_table = process.env.EVENT_TMC_TABLE;
  if (process.env.WZ_EXPOSURE_SOURCE_ID) descriptor.wz_exposure_source_id = Number(process.env.WZ_EXPOSURE_SOURCE_ID);
  if (process.env.EXCESSIVE_DELAY_SOURCE_ID) descriptor.excessive_delay_source_id = Number(process.env.EXCESSIVE_DELAY_SOURCE_ID);
  if (process.env.WZ_THRESHOLDS) descriptor.thresholds = JSON.parse(process.env.WZ_THRESHOLDS);

  const t0 = Date.now();
  const result = await worker({
    task: { task_id: 0, descriptor },
    pgEnv: PG_ENV,
    db,
    dispatchEvent: async (type, msg, payload) => {
      const p = JSON.stringify(payload || {});
      console.log(`  [${type}] ${msg}${p.length < 500 ? ` ${p}` : ''}`);
    },
    updateProgress: async () => {},
  });
  console.log(`\ndone in ${((Date.now() - t0) / 1000).toFixed(1)}s\n${JSON.stringify(result, null, 1)}`);
  process.exit(0);
}
main().catch((e) => { console.error(`FAILED: ${e.message}`); console.error(e.stack); process.exit(1); });
