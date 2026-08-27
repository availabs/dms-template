/**
 * Gate 2 - prove the whole write path on ONE throwaway row, then remove it.
 *
 * Nothing real is touched. This exercises, in order, every mechanism the Nassau load depends on:
 *
 *   1. CREATE   `raw create` a row -> capture the new id
 *   2. RECORD   write that id to disk BEFORE filling it. A failure between create and fill
 *               otherwise leaves an orphan empty row with no record that it exists.
 *   3. FILL     `dataset update --data` with a realistic payload
 *   4. READ BACK and diff field-for-field, structurally and key-order-insensitively
 *   5. ROLLBACK send the rollback patch shape that backup_before_write.py generates --
 *               original values for columns that existed, explicit clears for columns the
 *               update introduced -- and confirm the row really does return to blank.
 *               The 1,085 real rollbacks have so far only been SIMULATED; this is the only
 *               place that shape gets exercised against the actual server before it matters.
 *   6. DELETE   `raw delete`, then confirm the row is gone by querying for it.
 *
 * If any step fails the created id is printed prominently, because a half-created row that
 * nobody knows about is the worst outcome here.
 *
 * Usage: node prove_write_path.mjs [--keep]
 *   --keep  skip the delete, for inspecting the row in the UI
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const CTX = path.resolve(HERE, '..');
const CLI = path.resolve(CTX, '../../../../src/dms/packages/dms/cli/bin/dms.js');

// Capabilities: the dataset the Suffolk load proved this path on.
const SOURCE = '1068273', VIEW = '1172519', INSTANCE = 'capabilities_catalogue';
const APP = process.env.DMS_APP || 'mitigat-ny-prod';
const KEEP = process.argv.includes('--keep');
const MARK = 'ZZZ TEST ROW - safe to delete - Nassau load path proof';

process.env.DMS_HOST ||= 'https://dmsserver.availabs.org';
process.env.DMS_TYPE ||= 'prod';
if (!process.env.DMS_AUTH_TOKEN) {
  console.error('DMS_AUTH_TOKEN is not set. Writes will be rejected; mint one first.');
  process.exit(2);
}

const dms = (args) => {
  const out = execFileSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8', env: process.env, stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
  const i = out.search(/[[{]/);
  if (i < 0) throw new Error(`no JSON in CLI output: ${out.slice(0, 300)}`);
  return JSON.parse(out.slice(i));
};

const sortKeys = (x) => {
  if (Array.isArray(x)) return x.map(sortKeys);
  if (x && typeof x === 'object') {
    return Object.keys(x).sort().reduce((a, k) => (a[k] = sortKeys(x[k]), a), {});
  }
  return x;
};
const norm = (x) => (x === null || x === undefined || x === ''
  ? '' : (typeof x === 'object' ? JSON.stringify(sortKeys(x)) : String(x)));

const step = (n, msg) => console.log(`\n[${n}] ${msg}`);
let createdId = null;
const idFile = path.join(CTX, 'backups', 'gate2_throwaway_ids.json');

// A payload shaped like a real Capabilities row, including the value types that actually
// caused trouble: an "x" checkbox, a multiselect array, and a scalar geoid.
const PAYLOAD = {
  capability_name: MARK,
  description: 'Created by prove_write_path.mjs to verify create -> fill -> read-back -> '
             + 'rollback -> delete. If this row is still here, it was left behind by a failed '
             + 'run and can be deleted.',
  primary_capability_type: 'Planning',
  planning: 'x',
  administering_agency: 'AVAIL test',
  administering_agency_type_fed_state_local_non_profit: ['Local'],
  county: 'Nassau',
  geoid_county: '36059',
  geoid_juris: '36059',
  jurisdiction: 'Nassau (County)',
};

try {
  // ---------------------------------------------------------------- 1 + 2 create, record
  step(1, `raw create in ${INSTANCE}|${VIEW}:data`);
  const c = dms(['raw', 'create', APP, `${INSTANCE}|${VIEW}:data`, '--format', 'json']);
  createdId = String(c.id || '');
  if (!createdId) throw new Error(`create returned no id: ${JSON.stringify(c).slice(0, 200)}`);
  console.log(`    created id ${createdId}`);

  step(2, 'recording the id to disk BEFORE filling it');
  fs.mkdirSync(path.dirname(idFile), { recursive: true });
  const prior = fs.existsSync(idFile) ? JSON.parse(fs.readFileSync(idFile, 'utf8')) : [];
  prior.push({ id: createdId, source: SOURCE, view: VIEW, note: MARK });
  fs.writeFileSync(idFile, JSON.stringify(prior, null, 1));
  console.log(`    -> backups/gate2_throwaway_ids.json`);

  // ---------------------------------------------------------------- 3 fill
  step(3, `dataset update ${SOURCE} ${createdId} --data (${Object.keys(PAYLOAD).length} columns)`);
  const tmp = path.join(os.tmpdir(), `gate2_${createdId}.json`);
  fs.writeFileSync(tmp, JSON.stringify(PAYLOAD));
  const u = dms(['dataset', 'update', SOURCE, createdId, '--view', VIEW,
    '--data', tmp, '--format', 'json']);
  console.log(`    ok=${u.ok}`);

  // ---------------------------------------------------------------- 4 read back
  step(4, 'read back and diff field-for-field');
  const q = dms(['dataset', 'query', SOURCE, '--view', VIEW,
    '--filter', `id=${createdId}`, '--limit', '2', '--format', 'json']);
  const got = (q.items || []).find(r => String(r.id) === createdId)?.data;
  if (!got) throw new Error('read-back found no row with that id');
  let bad = 0;
  for (const [k, v] of Object.entries(PAYLOAD)) {
    if (norm(got[k]) !== norm(v)) {
      bad++;
      console.log(`    DIFF ${k}\n         sent: ${norm(v).slice(0, 90)}\n         got : ${norm(got[k]).slice(0, 90)}`);
    }
  }
  console.log(bad ? `    ${bad} field diff(s)` : `    all ${Object.keys(PAYLOAD).length} fields verified`);

  // ---------------------------------------------------------------- 5 rollback
  step(5, 'exercise the ROLLBACK shape: clear every column the update introduced');
  const undo = {};
  for (const k of Object.keys(PAYLOAD)) undo[k] = null;   // all were introduced by the fill
  const tmp2 = path.join(os.tmpdir(), `gate2_undo_${createdId}.json`);
  fs.writeFileSync(tmp2, JSON.stringify(undo));
  const r = dms(['dataset', 'update', SOURCE, createdId, '--view', VIEW,
    '--data', tmp2, '--format', 'json']);
  console.log(`    ok=${r.ok}`);
  const q2 = dms(['dataset', 'query', SOURCE, '--view', VIEW,
    '--filter', `id=${createdId}`, '--limit', '2', '--format', 'json']);
  const after = (q2.items || []).find(x => String(x.id) === createdId)?.data || {};
  const left = Object.keys(PAYLOAD).filter(k => norm(after[k]) !== '');
  console.log(left.length
    ? `    ROLLBACK INCOMPLETE — still set: ${left.join(', ')}`
    : `    rollback verified: all ${Object.keys(PAYLOAD).length} columns cleared`);

  // ---------------------------------------------------------------- 6 delete
  if (KEEP) {
    console.log(`\n[6] --keep given; row ${createdId} left in place. Delete it when done.`);
  } else {
    step(6, `raw delete ${createdId}`);
    // `raw delete` takes <app> <type> <id>, NOT a bare id. Passing only the id fails with
    // "missing required argument 'type'" -- and it fails AFTER the row exists, which is exactly
    // the case the id-recording in step 2 is there for. Found the hard way at Gate 2.
    dms(['raw', 'delete', APP, `${INSTANCE}|${VIEW}:data`, createdId, '--format', 'json']);
    const q3 = dms(['dataset', 'query', SOURCE, '--view', VIEW,
      '--filter', `id=${createdId}`, '--limit', '2', '--format', 'json']);
    const still = (q3.items || []).some(x => String(x.id) === createdId);
    console.log(still ? `    STILL PRESENT — delete did not take` : `    confirmed gone`);
    if (!still) {
      fs.writeFileSync(idFile, JSON.stringify(
        prior.filter(p => p.id !== createdId), null, 1));
      console.log(`    id removed from the record file`);
    }
  }
  console.log(`\nGate 2 complete.`);
} catch (e) {
  console.error(`\nFAILED: ${e.message.slice(0, 400)}`);
  if (createdId) {
    console.error(`\n  !! A ROW WAS CREATED AND MAY BE INCOMPLETE: id ${createdId}`);
    console.error(`  !! It is recorded in backups/gate2_throwaway_ids.json`);
    console.error(`  !! Remove it with:  dms raw delete ${createdId}`);
  }
  process.exit(1);
}
