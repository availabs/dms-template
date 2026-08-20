/**
 * Step 5 writer: update the 17 pre-existing Hazards-of-Concern rows in place, then insert
 * the `Other` rows. Backs up every target row first — unlike steps 2–4 this OVERWRITES
 * existing data, so the backup is the rollback.
 *
 * Requires DMS_HOST / DMS_APP / DMS_TYPE / DMS_AUTH_TOKEN.
 *
 * Usage: node write_hoc.mjs [geoid] [--dry] [--updates-only] [--inserts-only]
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const CTX = path.resolve(HERE, '..');
const CLI = path.resolve(CTX, '../../../../src/dms/packages/dms/cli/bin/dms.js');
const APP = process.env.DMS_APP || 'mitigat-ny-prod';
const SOURCE = '1473470', VIEW = '1473471';
const DATA_TYPE = `hazards_of_concern|${VIEW}:data`;

const GEOID = process.argv.find(a => /^\d+$/.test(a)) || '3610338000';
const DRY = process.argv.includes('--dry');
const ONLY_U = process.argv.includes('--updates-only');
const ONLY_I = process.argv.includes('--inserts-only');

const dms = (args) => {
  const out = execFileSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8', env: process.env, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
  });
  const i = out.indexOf('{');
  if (i < 0) throw new Error(`No JSON in CLI output: ${out.slice(0, 400)}`);
  return JSON.parse(out.slice(i));
};

/**
 * County geoid comes from juris_index.json, NOT from slicing the jurisdiction geoid.
 * `'3656660'.slice(0,5)` is '36566', not '36103' — NY village geoids are 7 digits
 * (36 + a 5-digit place code). Slicing works only for 10-digit cousub geoids, which is
 * why this survived the Islip (Town) slice and failed on the first village.
 */
const IDX = JSON.parse(fs.readFileSync(path.join(CTX, 'juris_index.json'), 'utf8'))[String(GEOID)];
if (!IDX) throw new Error(`geoid ${GEOID} not in juris_index.json — re-run build_index.py`);
const COUNTY = IDX.county_geoid;
const isOurs = (v) => Array.isArray(v) ? v.map(String).includes(String(GEOID)) : String(v ?? '') === String(GEOID);
const queryMine = () => {
  const res = dms(['dataset', 'query', SOURCE, '--view', VIEW, '--filter', `geoid_county=${COUNTY}`,
    '--limit', '5000', '--format', 'json']);
  return res.items.filter(r => isOurs(r.data.geoid_juris));
};

// Key order must not matter — the server returns objects with its own ordering.
const sortKeys = (x) => Array.isArray(x) ? x.map(sortKeys)
  : (x && typeof x === 'object' ? Object.keys(x).sort().reduce((a, k) => (a[k] = sortKeys(x[k]), a), {}) : x);
const norm = (x) => (x === null || x === undefined ? '' : (typeof x === 'object' ? JSON.stringify(sortKeys(x)) : String(x)));

const P = (n) => JSON.parse(fs.readFileSync(path.join(CTX, 'payloads', n), 'utf8'));
const updates = P(`hoc_${GEOID}_updates.json`);
const inserts = P(`hoc_${GEOID}_inserts.json`);
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hocload-'));

// ── back up every pre-existing row for this jurisdiction
const before = queryMine();
const backupDir = path.join(CTX, 'backups');
fs.mkdirSync(backupDir, { recursive: true });
const backup = path.join(backupDir, `hoc_${GEOID}_PRE.json`);
fs.writeFileSync(backup, JSON.stringify(before, null, 1));
console.log(`${before.length} pre-existing rows backed up -> ${backup}`);

const beforeById = new Map(before.map(r => [String(r.id), r.data]));
// --inserts-only performs NO updates, so the update-target and dirty checks do not apply.
// Leaving them active makes a re-run refuse purely because the earlier run succeeded.
const missing = ONLY_I ? [] : updates.filter(u => !beforeById.has(String(u.id)));
if (missing.length) {
  console.log(`!! ${missing.length} update target(s) not found live: ${missing.map(m => m.id).join(', ')}`);
  process.exit(1);
}
// Refuse to clobber content someone else has already entered.
const dirty = [];
for (const u of (ONLY_I ? [] : updates)) {
  const b = beforeById.get(String(u.id));
  for (const k of Object.keys(u.data)) {
    const cur = b[k];
    const isDefault = cur === null || cur === undefined || cur === '' || (k === 'hazard_of_concern' && cur === 'Not Reported');
    if (!isDefault) dirty.push(`${u.id} ${u.hazard}.${k} = ${norm(cur).slice(0, 60)}`);
  }
}
if (dirty.length) {
  console.log(`\n!! ${dirty.length} target field(s) already hold non-default content:`);
  dirty.slice(0, 20).forEach(d => console.log(`   ${d}`));
  if (!process.argv.includes('--force')) { console.log('   Refusing. Re-run with --force if intended.'); process.exit(1); }
}
/**
 * Other rows are keyed on (geoid_juris, hazard='Other', hazard_name_if_other). SKIP the ones
 * already present and insert only the rest, rather than refusing the whole set — that makes
 * re-runs idempotent AND lets a jurisdiction gain a row it was previously missing.
 * (Brookhaven had 4 of 5: Groundwater Contamination is ranked in Table I with no Table F
 * narrative, which an earlier version of the builder keyed rows off exclusively.)
 */
const existingOther = new Set(before.filter(r => r.data.hazard === 'Other').map(r => r.data.hazard_name_if_other));
const skipOther = inserts.filter(r => existingOther.has(r.data.hazard_name_if_other));
const toInsert = inserts.filter(r => !existingOther.has(r.data.hazard_name_if_other));
if (skipOther.length) {
  console.log(`\nOther row(s) already present, skipping: ${skipOther.map(r => r.data.hazard_name_if_other).join(', ')}`);
  if (toInsert.length) console.log(`  still to insert: ${toInsert.map(r => r.data.hazard_name_if_other).join(', ')}`);
}
inserts.length = 0;
inserts.push(...toInsert);

if (DRY) { console.log('\n--dry: stopping before any write.'); process.exit(0); }

let failed = 0;
// ── updates in place
if (!ONLY_I) {
  console.log(`\nupdating ${updates.length} rows`);
  for (const [i, u] of updates.entries()) {
    try {
      const f = path.join(tmpDir, `u_${u.id}.json`);
      fs.writeFileSync(f, JSON.stringify(u.data));
      const res = dms(['dataset', 'update', SOURCE, String(u.id), '--view', VIEW, '--data', f, '--format', 'json']);
      if (!res.ok) throw new Error('ok=false');
      console.log(`  ${String(i + 1).padStart(2)}/${updates.length}  ${u.id}  ${u.hazard.padEnd(16)} ${Object.keys(u.data).length} cols`);
    } catch (e) { failed++; console.log(`  ${String(i + 1).padStart(2)}/${updates.length}  FAILED ${u.id} ${u.hazard} — ${e.message}`); }
  }
}
// ── Other inserts
const createdPath = path.join(CTX, 'created', `hoc_${GEOID}.json`);
if (!ONLY_U) {
  fs.mkdirSync(path.dirname(createdPath), { recursive: true });
  const created = fs.existsSync(createdPath) ? JSON.parse(fs.readFileSync(createdPath, 'utf8')) : [];
  console.log(`\ninserting ${inserts.length} Other rows`);
  for (const [i, r] of inserts.entries()) {
    try {
      const c = dms(['raw', 'create', APP, DATA_TYPE, '--format', 'json']);
      if (!c.id) throw new Error('create returned no id');
      created.push({ id: c.id, tag: r.data.hazard_name_if_other });
      fs.writeFileSync(createdPath, JSON.stringify(created, null, 1));   // before the fill
      const f = path.join(tmpDir, `i_${c.id}.json`);
      fs.writeFileSync(f, JSON.stringify(r.data));
      const res = dms(['dataset', 'update', SOURCE, String(c.id), '--view', VIEW, '--data', f, '--format', 'json']);
      if (!res.ok) throw new Error('ok=false');
      console.log(`  ${String(i + 1).padStart(2)}/${inserts.length}  ${c.id}  Other / ${r.data.hazard_name_if_other}`);
    } catch (e) { failed++; console.log(`  ${String(i + 1).padStart(2)}/${inserts.length}  FAILED ${r.data.hazard_name_if_other} — ${e.message}`); }
  }
}

// ── read back and diff
const after = queryMine();
const afterById = new Map(after.map(r => [String(r.id), r.data]));
let bad = 0;
console.log('\nread-back diff (updates):');
for (const u of updates) {
  const got = afterById.get(String(u.id));
  let rowBad = 0;
  for (const [k, v] of Object.entries(u.data)) if (norm(got?.[k]) !== norm(v)) {
    rowBad++; bad++;
    console.log(`  DIFF ${u.id} ${u.hazard}.${k}\n       sent: ${norm(v).slice(0, 120)}\n       got : ${norm(got?.[k]).slice(0, 120)}`);
  }
  if (!rowBad) console.log(`  OK   ${u.id}  ${u.hazard}`);
}
if (!ONLY_U && fs.existsSync(createdPath)) {
  const created = JSON.parse(fs.readFileSync(createdPath, 'utf8'));
  console.log('\nread-back diff (Other inserts):');
  for (const [i, r] of inserts.entries()) {
    const rec = created[created.length - inserts.length + i];
    const got = afterById.get(String(rec?.id));
    if (!got) { bad++; console.log(`  MISSING ${rec?.id} ${rec?.tag}`); continue; }
    let rowBad = 0;
    for (const [k, v] of Object.entries(r.data)) if (norm(got[k]) !== norm(v)) {
      rowBad++; bad++;
      console.log(`  DIFF ${rec.id} ${k}\n       sent: ${norm(v).slice(0, 120)}\n       got : ${norm(got[k]).slice(0, 120)}`);
    }
    if (!rowBad) console.log(`  OK   ${rec.id}  Other / ${r.data.hazard_name_if_other}`);
  }
}

// ── confirm nothing else on these rows changed
let collateral = 0;
for (const r of before) {
  const a = afterById.get(String(r.id));
  const sent = new Set(Object.keys(updates.find(u => String(u.id) === String(r.id))?.data || {}));
  for (const k of Object.keys(r.data)) {
    if (sent.has(k) || k === 'isValid') continue;
    if (norm(a?.[k]) !== norm(r.data[k])) {
      collateral++;
      console.log(`  !! COLLATERAL ${r.id} ${k}: ${norm(r.data[k]).slice(0, 60)} -> ${norm(a?.[k]).slice(0, 60)}`);
    }
  }
}
console.log(`\nrows for this jurisdiction: ${before.length} -> ${after.length}`);
console.log(`untouched fields preserved on all ${before.length} pre-existing rows: ${collateral === 0 ? 'yes' : `NO (${collateral} changed)`}`);
console.log(bad || failed ? `\n${failed} write failure(s), ${bad} field diff(s).` : `\nAll ${updates.length} updates and ${inserts.length} inserts verified.`);
process.exit(bad || failed || collateral ? 1 : 0);
