/**
 * Generic inserter for the flat forms datasets (Capabilities, Roles, Participation,
 * and the Hazards-of-Concern "Other" rows).
 *
 * The insert path, verified 2026-08-17 on source 1068273:
 *   1. `dms raw create <app> "<sourceInstance>|<viewId>:data"`  -> new empty row id
 *      (`dms.data.create` honours a split-table type; see dms-server
 *      tests/test-table-splitting.js)
 *   2. `dms dataset update <source> <newId> --data <file>`      -> fill it
 * Two calls because `raw create --data` only takes inline JSON, which blows the
 * Windows arg-length limit on prose columns, while `dataset update --data` takes a path.
 *
 * Every created id is appended to created/<dataset>_<geoid>.json BEFORE the fill,
 * so an interrupted run is still fully reversible with `dms raw delete`.
 *
 * Usage: node insert_rows.mjs <dataset> <geoid> [--dry] [--force] [--limit N]
 *   dataset: capabilities | roles | participation
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const CTX = path.resolve(HERE, '..');
const CLI = path.resolve(CTX, '../../../../src/dms/packages/dms/cli/bin/dms.js');
const APP = process.env.DMS_APP || 'mitigat-ny-prod';

/**
 * `geoidScalar` says whether this dataset stores geoid_juris as a bare value (so
 * `--filter geoid_juris=<geoid>` works) or as an ARRAY (so it does not — see the filter
 * trap below). It decides fetch strategy, and that matters for transfer size:
 *
 *   Capabilities   3,078 rows x ~1.8 KB = ~5.3 MB full fetch  -> FILTER (scalar)
 *   Roles            373 rows x ~0.1 KB = ~0.04 MB            -> full fetch (array, cheap)
 *   Participation    216 rows x ~0.5 KB = ~0.1 MB             -> FILTER (scalar)
 *
 * Full-fetching Capabilities twice per jurisdiction (guard + read-back) across 38 annexes
 * would move ~390 MB for no reason. Size the query before choosing — see the skill's
 * "Size a query before you run it".
 */
const DATASETS = {
  capabilities:  { source: '1068273', view: '1172519', instance: 'capabilities_catalogue', payload: 'cap',  label: 'Capabilities', geoidScalar: true },
  roles:         { source: '1473295', view: '1473296', instance: 'roles',                  payload: 'roles', label: 'Roles',        geoidScalar: false },
  participation: { source: '1473468', view: '1473469', instance: 'participation',           payload: 'part', label: 'Participation', geoidScalar: true },
};

const which = process.argv[2];
const GEOID = process.argv[3];
const DRY = process.argv.includes('--dry');
const FORCE = process.argv.includes('--force');
const LIMIT = Number((process.argv.find(a => a.startsWith('--limit=')) || '').split('=')[1] || 0);
const OFFSET = Number((process.argv.find(a => a.startsWith('--offset=')) || '').split('=')[1] || 0);
const DS = DATASETS[which];
if (!DS || !GEOID) {
  console.error(`Usage: node insert_rows.mjs <${Object.keys(DATASETS).join('|')}> <geoid> [--dry] [--force] [--limit=N]`);
  process.exit(2);
}
const DATA_TYPE = `${DS.instance}|${DS.view}:data`;

const dms = (args) => {
  const out = execFileSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8', env: process.env, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
  });
  const i = out.indexOf('{');
  if (i < 0) throw new Error(`No JSON in CLI output: ${out.slice(0, 400)}`);
  return JSON.parse(out.slice(i));
};

/**
 * Fetch every row and match geoid client-side.
 *
 * `--filter geoid_juris=<geoid>` CANNOT be used here. The filter compiles to
 * `data->>'geoid_juris'`, which for an array-valued column returns the JSON text
 * `["3610338000"]` and never equals the bare geoid. Roles and Participation store
 * geoid_juris as an array (the current convention), so a filtered query returns 0
 * rows — which would silently defeat both the duplicate guard below and the
 * read-back verification. Capabilities happens to store a bare string, which is
 * what made the filter look like it worked.
 */
const geoidMatches = (v) => {
  if (Array.isArray(v)) return v.map(String).includes(String(GEOID));
  return String(v ?? '') === String(GEOID);
};
const queryJuris = () => {
  if (DS.geoidScalar) {
    // The filter is valid here AND avoids a multi-MB dump. Read-back matching still needs
    // to see rows whose geoid failed to write, so fetch those by id in a second small call.
    const mine = dms(['dataset', 'query', DS.source, '--view', DS.view,
      '--filter', `geoid_juris=${GEOID}`, '--limit', '2000', '--format', 'json']);
    return { total: mine.items.length, items: mine.items, all: mine.items, filtered: true };
  }
  const all = dms(['dataset', 'query', DS.source, '--view', DS.view, '--limit', '5000', '--format', 'json']);
  const items = all.items.filter(r => geoidMatches(r.data.geoid_juris));
  return { total: items.length, items, all: all.items, filtered: false };
};

const rowsIn = JSON.parse(fs.readFileSync(path.join(CTX, 'payloads', `${DS.payload}_${GEOID}.json`), 'utf8'));
const planned = rowsIn.slice(OFFSET, LIMIT ? OFFSET + LIMIT : undefined);

// ── guard: refuse to double-insert
const existing = queryJuris();
console.log(`${DS.label} — ${existing.total} existing row(s) for geoid ${GEOID}; ${planned.length} to insert`);
if (existing.total > 0 && !FORCE) {
  console.log(`  Refusing: this jurisdiction already has rows and re-running would duplicate them.`);
  console.log(`  Existing ids: ${existing.items.map(r => r.id).join(', ')}`);
  console.log(`  Pass --force only if you intend to add rows alongside them.`);
  process.exit(1);
}
if (DRY) { console.log('--dry: stopping before any write.'); process.exit(0); }

// ── insert
const createdDir = path.join(CTX, 'created');
fs.mkdirSync(createdDir, { recursive: true });
const createdPath = path.join(createdDir, `${which}_${GEOID}.json`);
const created = fs.existsSync(createdPath) ? JSON.parse(fs.readFileSync(createdPath, 'utf8')) : [];
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmsload-'));

let failed = 0;
for (const [i, row] of planned.entries()) {
  const tag = row.data.capability_name || row.data.name || row.data.meeting_name || `row ${i + 1}`;
  try {
    const c = dms(['raw', 'create', APP, DATA_TYPE, '--format', 'json']);
    if (!c.id) throw new Error(`create returned no id: ${JSON.stringify(c).slice(0, 200)}`);
    created.push({ id: c.id, _table: row._table ?? null, _row: row._row ?? null, tag });
    fs.writeFileSync(createdPath, JSON.stringify(created, null, 1));   // before the fill

    const f = path.join(tmpDir, `row_${c.id}.json`);
    fs.writeFileSync(f, JSON.stringify(row.data));
    const u = dms(['dataset', 'update', DS.source, String(c.id), '--view', DS.view, '--data', f, '--format', 'json']);
    if (!u.ok) throw new Error('dataset update returned ok=false');
    console.log(`  ${String(i + 1).padStart(3)}/${planned.length}  ${String(c.id).padEnd(9)} ${tag.slice(0, 62)}`);
  } catch (e) {
    failed++;
    console.log(`  ${String(i + 1).padStart(3)}/${planned.length}  FAILED    ${tag.slice(0, 62)} — ${e.message}`);
  }
}
console.log(`\ninserted ${planned.length - failed}/${planned.length}; ids -> ${createdPath}`);

// ── read back and diff every field we sent
const after = queryJuris();
// Match by row id over ALL rows, not just the geoid-matched subset — a row whose
// geoid failed to write would otherwise read as "missing" instead of as a diff.
const byId = new Map(after.all.map(r => [String(r.id), r.data]));
let bad = 0, missing = 0;
for (const [i, row] of planned.entries()) {
  const rec = created[created.length - planned.length + i];
  let got = byId.get(String(rec?.id));
  if (!got && after.filtered) {
    // Filtered fetch can't see a row whose geoid_juris failed to write. Pull it by id so a
    // geoid problem is reported as a DIFF on that field, not as a phantom missing row.
    const one = dms(['dataset', 'query', DS.source, '--view', DS.view,
      '--filter', `id=${rec.id}`, '--limit', '2', '--format', 'json']);
    got = one.items.find(r => String(r.id) === String(rec.id))?.data;
  }
  if (!got) { missing++; console.log(`  MISSING  ${rec?.id} ${rec?.tag}`); continue; }
  for (const [k, v] of Object.entries(row.data)) {
    const g = got[k];
    // Compare structurally: arrays and lexical objects both coerce to useless
    // strings ("[object Object]"), which would make any diff silently pass.
    // Key order must not matter: the server round-trips lexical objects with its own
    // key ordering, which a plain JSON.stringify compare reports as a false diff.
    const sortKeys = (x) => {
      if (Array.isArray(x)) return x.map(sortKeys);
      if (x && typeof x === 'object') return Object.keys(x).sort().reduce((a, k) => (a[k] = sortKeys(x[k]), a), {});
      return x;
    };
    const norm = (x) => (x === null || x === undefined ? '' : (typeof x === 'object' ? JSON.stringify(sortKeys(x)) : String(x)));
    if (norm(g) !== norm(v)) {
      bad++;
      console.log(`  DIFF  ${rec.id} ${k}\n        sent: ${norm(v).slice(0, 140)}\n        got : ${norm(g).slice(0, 140)}`);
    }
  }
}
console.log(`\nread-back: ${after.total} rows now carry geoid_juris=${GEOID}`);
console.log(bad || missing ? `${bad} field diff(s), ${missing} missing row(s).` : `All ${planned.length} rows verified field-for-field.`);
process.exit(failed || bad || missing ? 1 : 0);
