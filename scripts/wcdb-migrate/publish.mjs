#!/usr/bin/env node
/* 3/3 · Publish the four CSVs as external datasets in the pgEnv.
 *
 *   DMS_AUTH_TOKEN=… node scripts/wcdb-migrate/publish.mjs [--only djs]
 *
 * Follows src/dms/skills/uploading-gis-and-tabular-datasets.md exactly:
 *   1  GET  /etl/new-context-id
 *   2  POST /gis-dataset/upload            (multipart — used for CSV too)
 *   2.5 GET /gis-dataset/:id/layerNames    poll until non-empty (upload is async)
 *   4  POST /gis-dataset/:id/:layer/layerAnalysis
 *   5  GET  /gis-dataset/:id/:layer/layerAnalysis   poll
 *   6  GET  /staged-geospatial-dataset/:id/:layer/tableDescriptor
 *   7  POST /csv-dataset/publish           layerName is TOP-LEVEL and required
 *   8  GET  /events/query                  poll to completion
 *
 * Never writes `data_manager.*` by hand — that is how orphan tables happen.
 *
 * AFTER THIS RUNS, two manual steps make each dataset editable from the admin
 * UI (see src/dms/planning/tasks/current/set_primary_col_from_meta.md):
 *   a) on the source's Metadata page, set the PK column (printed below)
 *   b) then flip the `isEditable` toggle — deliberately, per that task's design
 * Without both, the admin pages can read these datasets but not write them.
 */
import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, 'out');

const API_HOST = process.env.API_HOST || 'http://localhost:3001';
const PG_ENV = process.env.PG_ENV || 'wcdb-dama';
const TOKEN = process.env.DMS_AUTH_TOKEN;
const EMAIL = process.env.DMS_EMAIL || 'availabs@gmail.com';

if (!TOKEN) {
  console.error(`No DMS_AUTH_TOKEN.

  export DMS_AUTH_TOKEN=$(node -e '
    fetch("${API_HOST}/login", { method:"POST",
      headers:{"Content-type":"application/json"},
      body: JSON.stringify({ email:"…", password:"…", project:"wcdb" }) })
    .then(r=>r.json()).then(d=>process.stdout.write(d?.user?.token||""))')

  (Access for availabs@gmail.com on project wcdb was granted 2026-08-13.)`);
  process.exit(1);
}

// PK per dataset — the first column, matching transform.mjs's assertions.
const DATASETS = [
  { file: 'djs.csv',      name: 'WCDB DJs',      pk: 'dj_id' },
  { file: 'shows.csv',    name: 'WCDB Shows',    pk: 'show_id' },
  { file: 'schedule.csv', name: 'WCDB Schedule', pk: 'airing_id' },
  { file: 'events.csv',   name: 'WCDB Events',   pk: 'event_id' },
];

const base = `${API_HOST}/dama-admin/${PG_ENV}`;
const H = { Authorization: `Bearer ${TOKEN}` };
const j = async (r) => { if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json(); };
const poll = async (url, done, ms = 2000, tries = 150) => {
  for (let i = 0; i < tries; i++) {
    const e = await j(await fetch(url, { headers: H }));
    if (done(e)) return e;
    await new Promise((s) => setTimeout(s, ms));
  }
  throw new Error(`timeout polling ${url}`);
};

const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const results = [];

for (const ds of DATASETS) {
  if (only && !ds.file.startsWith(only)) continue;
  const path = `${OUT}/${ds.file}`;
  const size = statSync(path).size;
  console.log(`\n── ${ds.name}  (${ds.file}, ${size} bytes)`);

  // /etl/new-context-id returns a BARE NUMBER (e.g. `1003`), not `{etlContextId}`.
  // Destructuring it yields undefined, which the upload silently accepts and the
  // publish then cannot correlate.
  const ctxRaw = await j(await fetch(`${base}/etl/new-context-id`, { headers: H }));
  const etlContextId = typeof ctxRaw === 'object' ? (ctxRaw.etlContextId ?? ctxRaw.etl_context_id) : ctxRaw;
  if (etlContextId === undefined || etlContextId === null) throw new Error(`no etlContextId from ${JSON.stringify(ctxRaw)}`);
  console.log(`   ctx ${etlContextId}`);

  const fd = new FormData();
  fd.append('etlContextId', String(etlContextId));
  fd.append('user_id', String(process.env.DMS_USER_ID || ''));
  fd.append('email', EMAIL);
  fd.append('name', ds.name);
  fd.append('type', 'csv_dataset');
  fd.append('fileSizeBytes', String(size));
  fd.append('file', new Blob([readFileSync(path)], { type: 'text/csv' }), ds.file);
  const up = await j(await fetch(`${base}/gis-dataset/upload`, { method: 'POST', headers: H, body: fd }));
  const gisUploadId = Array.isArray(up) ? up[0]?.id : up?.id;
  console.log(`   upload ${gisUploadId}`);

  // the upload processes async — layerNames stays [] until it is ready
  const layers = await poll(`${base}/gis-dataset/${gisUploadId}/layerNames`,
    (r) => Array.isArray(r) && r.length > 0, 2000, 150);
  const layer = layers[0];
  console.log(`   layer ${layer}`);

  await fetch(`${base}/gis-dataset/${gisUploadId}/${layer}/layerAnalysis`, { method: 'POST', headers: H });
  await poll(`${base}/gis-dataset/${gisUploadId}/${layer}/layerAnalysis`, (e) => !e?.message);
  const tableDescriptor = await j(await fetch(
    `${base}/staged-geospatial-dataset/${gisUploadId}/${layer}/tableDescriptor`, { headers: H }));

  const { etl_context_id, source_id } = await j(await fetch(`${base}/csv-dataset/publish`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source_id: null,
      source_values: { name: ds.name, type: 'csv_dataset' },
      layerName: layer,                 // top-level and required — the worker reads it here
      tableDescriptor,
      user_id: process.env.DMS_USER_ID || '',
      email: EMAIL,
      gisUploadId,
      etlContextId,
    }),
  }));
  // Completion is signalled by the event TYPE, and that type does not contain
  // the word "publish" — the real sequence ends `csv-dataset:FINAL`, then `done`.
  // An earlier predicate here required /publish/ and so never matched: the
  // dataset published correctly and the script then sat in this loop until it
  // timed out, taking every remaining dataset down with it.
  await poll(`${base}/events/query?etl_context_id=${etl_context_id}&event_id=-1`, (evs) => {
    if (!Array.isArray(evs)) return false;
    const bad = evs.find((e) => /error|fail/i.test(e?.type || ''));
    if (bad) throw new Error(`publish failed: ${JSON.stringify(bad).slice(0, 400)}`);
    return evs.some((e) => e?.type === 'done' || /:FINAL$/.test(e?.type || ''));
  });

  console.log(`   ✓ source_id ${source_id}`);
  results.push({ ...ds, source_id });
}

console.log('\n── published');
for (const r of results) console.log(`   ${r.name.padEnd(16)} source_id=${r.source_id}  PK=${r.pk}`);
console.log(`
Next, per source, in the DMS admin (these are deliberate admin actions and are
not scriptable through this route):
  1. Metadata page → set the primary key column to the PK above
  2. then enable the \`isEditable\` toggle
Both are required before the admin pages can write to these datasets.`);
