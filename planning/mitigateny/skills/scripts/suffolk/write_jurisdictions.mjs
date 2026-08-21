/**
 * Step 1 writer: back up the Jurisdictions row, write the payload, read back, diff.
 *
 * Requires DMS_HOST / DMS_APP / DMS_TYPE / DMS_AUTH_TOKEN in the environment
 * (see src/dms/skills/authenticating-the-dms-cli.md).
 *
 * Usage: node write_jurisdictions.mjs [geoid]        (default 3610338000 = Islip)
 *        node write_jurisdictions.mjs [geoid] --dry
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { rootToText } from './lexical.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const CTX = path.resolve(HERE, '..');
const CLI = path.resolve(CTX, '../../../../src/dms/packages/dms/cli/bin/dms.js');
const SOURCE = '1346449', VIEW = '1346450';

const GEOID = process.argv.find(a => /^\d+$/.test(a)) || '3610338000';
const DRY = process.argv.includes('--dry');

const dms = (args) => {
  const out = execFileSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8', env: process.env, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
  });
  const i = out.indexOf('{');
  if (i < 0) throw new Error(`No JSON in CLI output: ${out.slice(0, 300)}`);
  return JSON.parse(out.slice(i));
};

const readRow = () => {
  const res = dms(['dataset', 'query', SOURCE, '--view', VIEW, '--filter', `geoid=${GEOID}`, '--limit', '5', '--format', 'json']);
  if (res.total !== 1) throw new Error(`Expected exactly 1 row for geoid ${GEOID}, got ${res.total}`);
  return res.items[0];
};

const payload = JSON.parse(fs.readFileSync(path.join(CTX, 'payloads', `juris_${GEOID}.json`), 'utf8'));
const cols = Object.keys(payload);

// ── 1. back up
const before = readRow();
const backupDir = path.join(CTX, 'backups');
fs.mkdirSync(backupDir, { recursive: true });
const backup = path.join(backupDir, `juris_${GEOID}_PRE.json`);
fs.writeFileSync(backup, JSON.stringify(before, null, 1));
console.log(`row ${before.id} — backed up ${Object.keys(before.data).length} existing columns -> ${backup}`);

/**
 * APPEND MODE (owner, 2026-08-18)
 *
 * Some jurisdictions already hold authored content in columns this builder targets —
 * possibly written by the town itself. For those, MERGE: keep what is there and append this
 * annex's content below a marker heading, rather than overwriting it or refusing outright.
 *
 * Keyed by geoid, not global: appending everywhere would duplicate content on any
 * jurisdiction that was partially loaded and re-run. The marker also makes it IDEMPOTENT —
 * a column whose text already carries the marker is left completely alone.
 */
const APPEND_MARKER = 'Added from the 2026 jurisdictional annex';
const APPEND_OK = {
  '3677519': 'Village of the Branch — pre-existing text in lhmp_historic_occurances, possibly authored by the town. Owner decision 2026-08-18: append, do not overwrite.',
};

const hasText = (v) => !!rootToText(v).trim();
const collisions = cols.filter(c => hasText(before.data[c]));
const appended = [], alreadyAppended = [];

if (collisions.length && APPEND_OK[GEOID]) {
  console.log(`\nappend mode: ${APPEND_OK[GEOID]}`);
  for (const c of collisions) {
    const existing = before.data[c];
    /**
     * Two ways a column can already be done, and BOTH must be caught or a re-run doubles
     * the content:
     *   1. the marker is present  -> we appended here on an earlier run
     *   2. the existing text already CONTAINS this payload's text -> we wrote this column
     *      normally on an earlier run, so it is a self-collision, not the town's content
     * Case 2 is the one that bites: after a successful append-mode run every target column
     * has text, so all of them look like collisions on the next run.
     */
    const existingText = rootToText(existing);
    const mineText = rootToText(payload[c]);
    if (existingText.includes(APPEND_MARKER) || (mineText && existingText.includes(mineText))) {
      alreadyAppended.push(c);
      delete payload[c];
      continue;
    }
    payload[c] = {
      root: {
        ...existing.root,
        children: [
          ...existing.root.children,
          {
            children: [{ detail: 0, format: 0, mode: 'normal', style: '', text: APPEND_MARKER, type: 'text', version: 1 }],
            direction: 'ltr', format: '', indent: 0, type: 'heading', version: 1, tag: 'h3',
          },
          ...payload[c].root.children,
        ],
      },
    };
    appended.push(c);
  }
  if (appended.length) console.log(`  appending to: ${appended.join(', ')}`);
  if (alreadyAppended.length) console.log(`  already appended previously, left untouched: ${alreadyAppended.join(', ')}`);
} else if (collisions.length) {
  console.log(`\n!! ${collisions.length} target column(s) ALREADY HAVE CONTENT and would be overwritten:`);
  for (const c of collisions) console.log(`   ${c}`);
  if (!process.argv.includes('--force')) {
    console.log('   Refusing to write. Add this geoid to APPEND_OK to merge, or pass --force to overwrite.');
    process.exit(1);
  }
}

const colsToWrite = Object.keys(payload);
if (!colsToWrite.length) { console.log('\nNothing left to write for this jurisdiction.'); process.exit(0); }

if (DRY) { console.log('\n--dry: stopping before the write.'); process.exit(0); }

// ── 2. write (server shallow-merges into data JSONB, so only these columns change)
// Send from a temp file: in append mode `payload` now differs from the on-disk payload,
// and the on-disk one must stay pristine so the review sheet still matches the builder.
const sendPath = path.join(os.tmpdir(), `juris_${GEOID}_send.json`);
fs.writeFileSync(sendPath, JSON.stringify(payload));
const res = dms(['dataset', 'update', SOURCE, String(before.id), '--view', VIEW,
  '--data', sendPath, '--format', 'json']);
console.log(`\nwrite ok=${res.ok} — ${res.columns.length} columns sent to type ${res.type}`);

// ── 3. read back and diff
const after = readRow();
let bad = 0;
console.log('\nread-back diff:');
for (const c of colsToWrite) {
  const want = rootToText(payload[c]);
  const got = after.data[c] ? rootToText(after.data[c]) : '';
  const ok = want === got;
  if (!ok) bad++;
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${c.padEnd(36)} ${String(got.length).padStart(6)}/${String(want.length).padStart(6)} chars`);
  if (!ok) {
    const at = [...want].findIndex((ch, i) => ch !== got[i]);
    console.log(`       first divergence at char ${at}:\n       want: ${JSON.stringify(want.slice(at, at + 90))}\n       got : ${JSON.stringify(got.slice(at, at + 90))}`);
  }
}

// preserved columns
const preserved = Object.keys(before.data).filter(k => !colsToWrite.includes(k));
const lost = preserved.filter(k => JSON.stringify(after.data[k]) !== JSON.stringify(before.data[k]));
console.log(`\npre-existing columns preserved: ${preserved.length - lost.length}/${preserved.length}`);
if (lost.length) console.log(`  !! CHANGED: ${lost.join(', ')}`);

fs.writeFileSync(path.join(CTX, 'payloads', `juris_${GEOID}_POST.json`), JSON.stringify(after, null, 1));
console.log(bad ? `\n${bad} column(s) failed verification.` : `\nAll ${colsToWrite.length} columns verified${appended.length ? ` (${appended.length} appended, existing content preserved above the marker)` : ''}.`);
process.exit(bad || lost.length ? 1 : 0);
