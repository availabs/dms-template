// Apply out/payloads/*.json to the Jurisdictions dataset via the DMS CLI, then read back.
//   node write_annexes.mjs --dry-run          list what would be written
//   node write_annexes.mjs                    write every row in load_spec.json
//   node write_annexes.mjs <rowId> [<rowId>]  write only these rows
// Requires DMS_HOST / DMS_APP / DMS_TYPE and, for the writes, DMS_AUTH_TOKEN.
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'out');
const CLI = path.resolve(HERE, '../../../../../src/dms/packages/dms/cli/bin/dms.js');
const SOURCE = '1346449';

const args = process.argv.slice(2);
const dry = args.includes('--dry-run');
const only = args.filter(a => /^\d+$/.test(a));

const spec = JSON.parse(fs.readFileSync(path.join(OUT, 'load_spec.json'), 'utf8'));
const todo = only.length ? spec.filter(s => only.includes(String(s.row_id))) : spec;
if (!todo.length) { console.error('nothing to do'); process.exit(1); }

function cli(cmdArgs) {
  return execFileSync(process.execPath, [CLI, ...cmdArgs], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function lexLen(v) {
  if (!v) return 0;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { return v.length; } }
  const walk = n => (n.text || '') + (n.children || []).map(walk).join(' ');
  return v.root ? walk(v.root).trim().length : 0;
}

console.error(`${dry ? 'DRY RUN — ' : ''}${todo.length} rows, ` +
  `${todo.reduce((a, s) => a + s.n_columns, 0)} column writes`);

const results = [];
for (const s of todo) {
  const payloadPath = path.join(OUT, s.payload);
  const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
  const expect = Object.fromEntries(Object.entries(payload).map(([k, v]) => [k, lexLen(v)]));

  if (dry) {
    console.log(`  ${s.row_id}  ${s.jurisdiction.padEnd(32)} ${s.n_columns} cols  ` +
      Object.entries(expect).map(([k, n]) => `${k}:${n}`).join(' '));
    results.push({ ...s, dry: true, expect });
    continue;
  }

  let status = 'ok', err = null, verified = null;
  try {
    cli(['dataset', 'update', SOURCE, String(s.row_id), '--data', payloadPath]);
  } catch (e) {
    status = 'write_failed';
    err = (e.stderr || e.stdout || e.message || '').toString().slice(-600);
  }

  if (status === 'ok') {
    try {
      const raw = cli(['dataset', 'query', SOURCE, '--view', '1346450',
        '--filter', `geoid=${s.geoid}`, '--limit', '5', '--format', 'json']);
      const rows = JSON.parse(raw).items || [];
      const row = rows.find(r => String(r.id) === String(s.row_id));
      if (!row) { status = 'readback_missing'; }
      else {
        verified = {};
        for (const k of Object.keys(payload)) verified[k] = lexLen(row.data?.[k]);
        const bad = Object.keys(expect).filter(k => verified[k] !== expect[k]);
        if (bad.length) { status = 'readback_mismatch'; err = 'mismatch: ' + bad.join(', '); }
      }
    } catch (e) {
      status = 'readback_failed';
      err = (e.stderr || e.message || '').toString().slice(-400);
    }
  }

  console.log(`  ${status === 'ok' ? 'OK  ' : 'FAIL'} ${s.row_id}  ` +
    `${s.jurisdiction.padEnd(32)} ${s.n_columns} cols  ${status}${err ? ' — ' + err.split('\n')[0] : ''}`);
  results.push({ ...s, status, err, expect, verified });
  if (status === 'write_failed' && results.length === 1) {
    console.error('\nFirst write failed — stopping before touching anything else.');
    break;
  }
}

if (!dry) {
  fs.writeFileSync(path.join(OUT, 'write_results.json'), JSON.stringify(results, null, 1));
  const ok = results.filter(r => r.status === 'ok').length;
  console.error(`\n${ok}/${results.length} rows written and verified`);
}
