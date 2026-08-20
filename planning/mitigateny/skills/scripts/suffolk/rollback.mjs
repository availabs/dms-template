/**
 * Delete rows this session created, using the created/*.json id records.
 *
 * Those records are written BEFORE each fill, so they list every row that exists —
 * including any created-but-unfilled orphan from an interrupted run.
 *
 * Deletes ONLY inserted rows. Rows UPDATED in place (Jurisdictions columns, the 17 HOC
 * rows per jurisdiction) are not deletable — restore those from backups/*_PRE.json.
 *
 * Usage:
 *   node rollback.mjs --list                              what would be deleted, by file
 *   node rollback.mjs --file=capabilities_3610310000.json  delete one dataset's rows
 *   node rollback.mjs --file=... --confirm                 actually delete
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const CTX = path.resolve(HERE, '..');
const CLI = path.resolve(CTX, '../../../../src/dms/packages/dms/cli/bin/dms.js');
const APP = process.env.DMS_APP || 'mitigat-ny-prod';
const createdDir = path.join(CTX, 'created');

const TYPE_FOR = {
  capabilities: 'capabilities_catalogue|1172519:data',
  roles: 'roles|1473296:data',
  participation: 'participation|1473469:data',
  hoc: 'hazards_of_concern|1473471:data',
};
const typeOf = (file, rec) => rec.type || TYPE_FOR[file.split('_')[0]];

const FILE = (process.argv.find(a => a.startsWith('--file=')) || '').split('=')[1];
const CONFIRM = process.argv.includes('--confirm');

const files = fs.readdirSync(createdDir).filter(f => f.endsWith('.json') && (!FILE || f === FILE));
if (!files.length) { console.error(`No created/ file matching ${FILE || '*'}`); process.exit(2); }

if (!FILE || !CONFIRM) {
  console.log(`${FILE ? 'Would delete' : 'created/ inventory'}:\n`);
  let total = 0;
  for (const f of files) {
    const recs = JSON.parse(fs.readFileSync(path.join(createdDir, f), 'utf8'));
    total += recs.length;
    console.log(`  ${f.padEnd(42)} ${String(recs.length).padStart(4)} rows   type=${typeOf(f, recs[0] || {})}`);
  }
  console.log(`\n  total ${total} rows`);
  if (FILE) console.log('\nRe-run with --confirm to delete.');
  console.log('\nNOTE: rows UPDATED in place are not listed here and cannot be deleted —');
  console.log('restore those from backups/*_PRE.json.');
  process.exit(0);
}

const recs = JSON.parse(fs.readFileSync(path.join(createdDir, FILE), 'utf8'));
console.log(`deleting ${recs.length} rows from ${FILE}`);
let ok = 0, fail = 0;
const remaining = [];
for (const [i, r] of recs.entries()) {
  const t = typeOf(FILE, r);
  try {
    execFileSync(process.execPath, [CLI, 'raw', 'delete', APP, t, String(r.id), '--format', 'json'],
      { encoding: 'utf8', env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    ok++;
    console.log(`  ${String(i + 1).padStart(3)}/${recs.length}  deleted ${r.id}  ${String(r.tag || '').slice(0, 54)}`);
  } catch (e) {
    fail++; remaining.push(r);
    console.log(`  ${String(i + 1).padStart(3)}/${recs.length}  FAILED  ${r.id} — ${String(e.message).slice(0, 90)}`);
  }
}
// Keep the record honest: only rows we could not delete stay listed.
if (remaining.length) fs.writeFileSync(path.join(createdDir, FILE), JSON.stringify(remaining, null, 1));
else fs.renameSync(path.join(createdDir, FILE), path.join(createdDir, FILE + '.deleted'));
console.log(`\ndeleted ${ok}, failed ${fail}`);
console.log(remaining.length ? `${FILE} now lists only the ${remaining.length} undeleted row(s).`
                             : `${FILE} renamed to ${FILE}.deleted`);
process.exit(fail ? 1 : 0);
