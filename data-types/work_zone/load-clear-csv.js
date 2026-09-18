#!/usr/bin/env node
/**
 * Load a CLEAR crash extract CSV into npmrds2 as a `clear_crash_raw` DAMA
 * source/view — the "file_upload" input the crashes_clear stage reads.
 *
 *   node work_zone/load-clear-csv.js <csv> <year>
 *   CLEAR_RAW_SOURCE_ID=2230 node work_zone/load-clear-csv.js out/crash_2025/crash_2025.csv 2025
 *   CLEAR_RAW_SOURCE_ID=2230 CLEAR_RAW_VIEW_ID=3940 node work_zone/load-clear-csv.js ... 2024   # replace a vintage
 *
 * Every CSV column lands as TEXT, exactly as delivered; a point is built from
 * the derived lon/lat with the SRID in the value. The platform's own CSV
 * uploader would produce the same thing; this exists because the extract is
 * 160 MB and the DMS upload path caps well below the file sizes a full year
 * needs, and because a run-stage validation should not depend on a dev server.
 *
 * WRITES to the pgEnv. Reuses the source named by CLEAR_RAW_SOURCE_ID (else
 * creates one) and REPLACES the view named by CLEAR_RAW_VIEW_ID (else creates
 * one per run).
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const PG_ENV = process.env.PG_ENV || 'npmrds2';
const [csvPath, yearArg] = process.argv.slice(2);

async function firstLine(file) {
  const rl = readline.createInterface({ input: fs.createReadStream(file) });
  for await (const line of rl) { rl.close(); return line; }
  return '';
}

async function main() {
  if (!csvPath || !yearArg) {
    console.error('usage: node work_zone/load-clear-csv.js <csv> <year>');
    process.exit(2);
  }
  const abs = path.resolve(csvPath);
  const year = Number(yearArg);
  const sql = require('./sql.js');
  const dbMod = require('@availabs/dms-server/src/db');
  const metadata = require('@availabs/dms-server/src/dama/upload/metadata');
  dbMod.getDb(PG_ENV);
  await dbMod.awaitReady();
  const db = dbMod.getDb(PG_ENV);

  // A dedicated pg client for COPY (the pool wrapper does not expose the stream).
  const serverRoot = path.dirname(require.resolve('@availabs/dms-server/package.json'));
  const cfg = JSON.parse(fs.readFileSync(path.join(serverRoot, 'src', 'db', 'configs', `${PG_ENV}.config.json`), 'utf8'));
  const { Client } = require('pg');
  const { from: copyFrom } = require('pg-copy-streams');
  const client = new Client({ host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password, database: cfg.database });
  await client.connect();

  const header = (await firstLine(abs)).replace(/^﻿/, '');
  const columns = header.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
  if (!columns.includes('CaseNumber') || !columns.includes('lon')) {
    throw new Error(`does not look like a CLEAR crash extract (columns: ${columns.slice(0, 8).join(', ')}...)`);
  }

  let sourceId = process.env.CLEAR_RAW_SOURCE_ID ? Number(process.env.CLEAR_RAW_SOURCE_ID) : null;
  if (!sourceId) {
    const src = await metadata.createDamaSource({
      name: 'NYSDOT CLEAR crash extract (raw)',
      type: 'clear_crash_raw',
      description: 'Statewide crash records pulled from the NYSDOT CLEAR Crash Data Viewer by references/workzone_saftey/clear/clear_download.py, every field as delivered plus lon/lat derived from UTM 18N. One view per calendar year. Input to the work_zone crashes_clear stage.',
      user_id: 1,
      metadata: { work_zone_stage: 'clear_raw', extractor: 'dms-template/references/workzone_saftey/clear/' },
    }, PG_ENV);
    sourceId = src.source_id;
    console.log(`created clear_crash_raw source ${sourceId}`);
  }
  const viewId = process.env.CLEAR_RAW_VIEW_ID
    ? Number(process.env.CLEAR_RAW_VIEW_ID)
    : (await metadata.createDamaView({ source_id: sourceId, user_id: 1 }, PG_ENV)).view_id;

  const schema = sql.WORK_ZONE_SCHEMA;
  const table = sql.tableNameFor({ source_id: sourceId, view_id: viewId, stage: 'clear_crash_raw' });
  await client.query(sql.clearCrashRawTableDDL(schema, table, columns));
  await client.query(`TRUNCATE ${schema}.${table}`);

  const t0 = Date.now();
  await new Promise((resolve, reject) => {
    const colList = columns.map((c) => `"${c.replace(/"/g, '')}"`).join(', ');
    const stream = client.query(copyFrom(`COPY ${schema}.${table} (${colList}) FROM STDIN WITH (FORMAT csv, HEADER true)`));
    fs.createReadStream(abs).on('error', reject).pipe(stream).on('error', reject).on('finish', resolve);
  });
  await client.query(sql.clearCrashRawGeometrySQL(schema, table));
  await client.query(`ANALYZE ${schema}.${table}`);

  const { rows: [stats] } = await client.query(`
    SELECT count(*) AS rows, count(wkb_geometry) AS with_point,
           count(DISTINCT "CaseNumber") AS distinct_cases,
           to_char(min("CrashDate"::timestamp), 'YYYY-MM-DD') AS min_date,
           to_char(max("CrashDate"::timestamp), 'YYYY-MM-DD') AS max_date,
           to_char(max("DMVInsertDate"::timestamp), 'YYYY-MM-DD') AS dmv_insert_max,
           count(*) FILTER (WHERE "TrafficControl" IN ('HIGHWAY WORK AREA','MAINTENANCE WORK AREA','UTILITY WORK AREA')) AS wz_coded
      FROM ${schema}.${table}`);
  const manifestPath = path.join(path.dirname(abs), 'manifest.json');
  let manifest = null;
  if (fs.existsSync(manifestPath)) {
    try {
      const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      manifest = { chunks: Array.isArray(m.chunks) ? m.chunks.length : (m.chunks ? Object.keys(m.chunks).length : null), keys: Object.keys(m).slice(0, 12) };
    } catch (e) { manifest = { error: e.message }; }
  }

  const startDate = `${year}-01-01`;
  const endDate = stats.max_date && stats.max_date < `${year}-12-31` ? stats.max_date : `${year}-12-31`;
  await db.query(
    `UPDATE data_manager.views SET table_schema = $1, table_name = $2, data_table = $3, version = $5 WHERE view_id = $4`,
    [schema, table, `${schema}.${table}`, viewId, sql.vintageVersion({ startDate, endDate })]);
  const { rows: mv } = await db.query(`SELECT metadata FROM data_manager.views WHERE view_id = $1`, [viewId]);
  const prev = typeof mv[0].metadata === 'string' ? JSON.parse(mv[0].metadata || '{}') : (mv[0].metadata || {});
  await db.query(`UPDATE data_manager.views SET metadata = $1 WHERE view_id = $2`, [JSON.stringify({
    ...prev,
    is_clickhouse_table: 0,
    start_date: startDate, end_date: endDate, year,
    csv_path: abs, csv_bytes: fs.statSync(abs).size, columns: columns.length, loaded_at: new Date().toISOString(),
    rows: Number(stats.rows), with_point: Number(stats.with_point), distinct_cases: Number(stats.distinct_cases),
    min_date: stats.min_date, max_date: stats.max_date, dmv_insert_max: stats.dmv_insert_max,
    wz_coded: Number(stats.wz_coded), manifest,
  }), viewId]);
  const { rows: ms } = await db.query(`SELECT metadata FROM data_manager.sources WHERE source_id = $1`, [sourceId]);
  const prevS = typeof ms[0].metadata === 'string' ? JSON.parse(ms[0].metadata || '{}') : (ms[0].metadata || {});
  await db.query(`UPDATE data_manager.sources SET metadata = $1 WHERE source_id = $2`, [JSON.stringify({
    ...prevS,
    columns: columns.map((c) => ({ name: c, display_name: c, type: 'TEXT', desc: null })),
    schema: 'clear_crash_raw_v1',
  }), sourceId]);

  console.log(JSON.stringify({
    source_id: sourceId, view_id: viewId, table: `${schema}.${table}`, seconds: Math.round((Date.now() - t0) / 100) / 10,
    ...stats, version: sql.vintageVersion({ startDate, endDate }),
  }, null, 1));
  await client.end();
  process.exit(0);
}
main().catch((e) => { console.error(`FAILED: ${e.message}`); console.error(e.stack); process.exit(1); });
