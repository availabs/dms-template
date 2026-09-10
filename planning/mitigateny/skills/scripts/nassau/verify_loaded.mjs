/**
 * Verify what is actually in the database against what the payload said to write.
 *
 * Independent of load.mjs on purpose. The loader verifies its own writes in the same process
 * that made them, which is fine for catching a rejected value but useless if the run was
 * interrupted before its read-back phase -- exactly what happened to the Long Beach capabilities
 * load, whose output pipeline was closed early. This can be run at any time, against any
 * dataset/target, including rows loaded days ago.
 *
 * It resolves each payload row to a live row id the same way the loader did:
 *   update -> `_existing_id` from the payload
 *   insert -> the `{row, id}` mapping in the run's created.json
 * so an insert is checked against the row it actually created, not against something with a
 * matching name.
 *
 * Usage: node verify_loaded.mjs <dataset> <geoid> [--verbose]
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const CTX = path.resolve(HERE, '..');
const CLI = path.resolve(CTX, '../../../../src/dms/packages/dms/cli/bin/dms.js');
const PAY = path.join(CTX, 'payloads');

const DATASETS = {
  actions:       { source: '1029065', view: '1074456', prefix: 'act',   label: 'action_name' },
  capabilities:  { source: '1068273', view: '1172519', prefix: 'cap',   label: 'capability_name' },
  roles:         { source: '1473295', view: '1473296', prefix: 'roles', label: 'name' },
  participation: { source: '1473468', view: '1473469', prefix: 'part',  label: 'meeting_name' },
  hoc:           { source: '1473470', view: '1473471', prefix: 'hoc',   label: 'hazard', split: true },
  jurisdictions: { source: '1346449', view: '1346450', prefix: 'juris', label: 'jurisdiction',
                   single: '_juris_updates.json' },
};

const which = process.argv[2];
const geoid = process.argv[3];
const VERBOSE = process.argv.includes('--verbose');
const DS = DATASETS[which];
if (!DS || !geoid) {
  console.error(`Usage: node verify_loaded.mjs <${Object.keys(DATASETS).join('|')}> <geoid> [--verbose]`);
  process.exit(2);
}
process.env.DMS_HOST ||= 'https://dmsserver.availabs.org';
process.env.DMS_APP ||= 'mitigat-ny-prod';
process.env.DMS_TYPE ||= 'prod';

const dms = (args) => {
  const out = execFileSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8', env: process.env, stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 128 * 1024 * 1024,
  });
  const i = out.search(/[[{]/);
  if (i < 0) throw new Error(`no JSON in CLI output: ${out.slice(0, 300)}`);
  return JSON.parse(out.slice(i));
};
const sortKeys = (x) => Array.isArray(x) ? x.map(sortKeys)
  : (x && typeof x === 'object'
     ? Object.keys(x).sort().reduce((a, k) => (a[k] = sortKeys(x[k]), a), {}) : x);
const norm = (x) => (x === null || x === undefined || x === ''
  ? '' : (typeof x === 'object' ? JSON.stringify(sortKeys(x)) : String(x)));

// ---------------------------------------------------------------- payload
const rows = [];
if (DS.single) {
  for (const r of JSON.parse(fs.readFileSync(path.join(PAY, DS.single), 'utf8'))) {
    if (String(r.geoid) === String(geoid)) {
      rows.push({ op: 'update', data: r.data, id: String(r.row_id), tag: r.jurisdiction });
    }
  }
} else if (DS.split) {
  for (const [f, op] of [[`hoc_${geoid}_updates.json`, 'update'],
                         [`hoc_${geoid}_inserts.json`, 'insert']]) {
    const p = path.join(PAY, f);
    if (!fs.existsSync(p)) continue;
    for (const r of JSON.parse(fs.readFileSync(p, 'utf8'))) {
      rows.push({ op, data: r.data, id: op === 'update' ? String(r.id) : null,
                  tag: r.hazard || r.data.hazard_name_if_other });
    }
  }
} else {
  const p = path.join(PAY, `${DS.prefix}_${geoid}.json`);
  for (const [i, r] of JSON.parse(fs.readFileSync(p, 'utf8')).entries()) {
    rows.push({ op: r._op || 'insert', data: r.data,
                id: r._existing_id ? String(r._existing_id) : null,
                idx: i, tag: String(r.data[DS.label] || '').slice(0, 55) });
  }
}

// ---------------------------------------------------------------- resolve insert ids
const runsRoot = path.join(CTX, 'runs');
const createdByIdx = new Map();
if (fs.existsSync(runsRoot)) {
  for (const d of fs.readdirSync(runsRoot).sort()) {
    if (!d.includes(`_${which}_${geoid}`)) continue;
    if (fs.existsSync(path.join(runsRoot, d, 'reconciled.json'))) continue;
    const cf = path.join(runsRoot, d, 'created.json');
    if (!fs.existsSync(cf)) continue;
    for (const c of JSON.parse(fs.readFileSync(cf, 'utf8'))) {
      if (c.row !== undefined) createdByIdx.set(c.row, String(c.id));
    }
  }
}
for (const r of rows) {
  if (r.op === 'insert' && r.id === null && r.idx !== undefined) {
    r.id = createdByIdx.get(r.idx) || null;
  }
}

// ---------------------------------------------------------------- fetch and diff
console.log(`${which} / ${geoid}: ${rows.length} payload row(s) ` +
  `(${rows.filter(r => r.op === 'insert').length} insert, ` +
  `${rows.filter(r => r.op === 'update').length} update)`);

let unresolved = 0, missing = 0, diffs = 0, ok = 0;
for (const r of rows) {
  if (!r.id) {
    unresolved++;
    console.log(`  UNRESOLVED  no live id recorded for: ${r.tag}`);
    continue;
  }
  let got;
  try {
    const q = dms(['dataset', 'query', DS.source, '--view', DS.view,
      '--filter', `id=${r.id}`, '--limit', '2', '--format', 'json']);
    got = (q.items || []).find(x => String(x.id) === r.id)?.data;
  } catch (e) {
    console.log(`  QUERY FAILED  ${r.id}: ${String(e.message).slice(0, 90)}`);
  }
  if (!got) { missing++; console.log(`  MISSING  ${r.id}  ${r.tag}`); continue; }
  const bad = [];
  for (const [k, v] of Object.entries(r.data)) {
    if (norm(got[k]) !== norm(v)) bad.push(k);
  }
  if (bad.length) {
    diffs += bad.length;
    console.log(`  DIFF  ${r.id}  ${r.tag}`);
    for (const k of bad.slice(0, 6)) {
      console.log(`        ${k}\n          want: ${norm(r.data[k]).slice(0, 110)}` +
                  `\n          live: ${norm(got[k]).slice(0, 110)}`);
    }
  } else {
    ok++;
    if (VERBOSE) console.log(`  ok    ${r.id}  ${r.tag}`);
  }
}

console.log(`\n${ok}/${rows.length} row(s) match the payload field-for-field`);
if (unresolved) console.log(`${unresolved} row(s) have no recorded live id (never loaded?)`);
if (missing) console.log(`${missing} row(s) resolved to an id that no longer exists`);
if (diffs) console.log(`${diffs} field difference(s)`);
process.exit(unresolved || missing || diffs ? 1 : 0);
