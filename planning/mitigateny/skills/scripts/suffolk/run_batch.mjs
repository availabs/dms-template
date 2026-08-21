/**
 * Batch loader: run all five datasets for every annex not yet loaded.
 *
 * Sequential on purpose — this is a shared production server, and a failure part-way
 * through one jurisdiction is easier to reason about than five interleaved ones.
 *
 * Per jurisdiction, in order:
 *   1. build all payloads (local, no DB)
 *   2. write Jurisdictions   (update in place, backed up)
 *   3. insert Capabilities / Roles / Participation
 *   4. write Hazards of Concern (17 updates in place + 5 Other inserts)
 *
 * Every step's own guards still apply: insert steps refuse a jurisdiction that already has
 * rows, the Jurisdictions writer refuses to overwrite non-default content, and the HOC
 * writer refuses dirty targets and duplicate Other rows. So a jurisdiction already loaded
 * is SKIPPED by its own guards rather than duplicated — re-running this script is safe.
 *
 * Usage: node run_batch.mjs [--dry] [--only=<geoid>[,<geoid>]] [--skip=<geoid>,...]
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const CTX = path.resolve(HERE, '..');
const DRY = process.argv.includes('--dry');
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1]?.split(',').filter(Boolean) || [];
const SKIP = (process.argv.find(a => a.startsWith('--skip=')) || '').split('=')[1]?.split(',').filter(Boolean) || [];

const annexDir = path.join(CTX, 'extracted', 'annexes');
const annexes = fs.readdirSync(annexDir).filter(f => f.endsWith('.json') && !f.startsWith('_'))
  .map(f => {
    const J = JSON.parse(fs.readFileSync(path.join(annexDir, f), 'utf8')).jurisdiction;
    return { geoid: String(J.geoid), title: J.jurisdictions_title };
  })
  .filter(a => (!ONLY.length || ONLY.includes(a.geoid)) && !SKIP.includes(a.geoid))
  .sort((a, b) => a.title.localeCompare(b.title));

const run = (cmd, args) => {
  try {
    const out = execFileSync(cmd, args, {
      cwd: HERE, encoding: 'utf8', env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
    });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: (e.stdout || '') + (e.stderr || ''), code: e.status };
  }
};
const NODE = process.execPath;
const PY = 'python';

const STEPS = [
  { name: 'build:juris', cmd: NODE, args: g => ['build_jurisdictions.mjs', g], build: true },
  { name: 'build:cap',   cmd: NODE, args: g => ['build_capabilities.mjs', g], build: true },
  { name: 'build:roles', cmd: NODE, args: g => ['build_roles.mjs', g], build: true },
  { name: 'build:part',  cmd: PY,   args: g => ['build_participation.py', g], build: true },
  { name: 'build:hoc',   cmd: PY,   args: g => ['build_hoc.py', g], build: true },
  { name: 'write:juris', cmd: NODE, args: g => ['write_jurisdictions.mjs', g] },
  { name: 'write:cap',   cmd: NODE, args: g => ['insert_rows.mjs', 'capabilities', g] },
  { name: 'write:roles', cmd: NODE, args: g => ['insert_rows.mjs', 'roles', g] },
  { name: 'write:part',  cmd: NODE, args: g => ['insert_rows.mjs', 'participation', g] },
  { name: 'write:hoc',   cmd: NODE, args: g => ['write_hoc.mjs', g] },
];

// A guard refusal is a SKIP, not a failure — it means the step was already done.
const isGuardSkip = (out) => /Refusing|already has rows|already hold non-default|already exist for/i.test(out);
// How many rows a write step reported, for the log.
const rowCount = (out) => {
  const m = out.match(/inserted (\d+)\/(\d+)/) || out.match(/(\d+) columns sent/) || out.match(/All (\d+) updates and (\d+) inserts/);
  return m ? m.slice(1).filter(Boolean).join('+') : '';
};

const log = [];
let hardFail = 0;
console.log(`batch: ${annexes.length} jurisdiction(s)${DRY ? ' (--dry: build only)' : ''}\n`);

for (const [i, a] of annexes.entries()) {
  const head = `[${String(i + 1).padStart(2)}/${annexes.length}] ${a.title} (${a.geoid})`;
  const rec = { ...a, steps: {} };
  let stop = false;
  for (const st of STEPS) {
    if (DRY && !st.build) continue;
    if (stop) { rec.steps[st.name] = 'not-run'; continue; }
    const r = run(st.cmd, st.args(a.geoid));
    if (r.ok) {
      rec.steps[st.name] = 'ok' + (rowCount(r.out) ? `(${rowCount(r.out)})` : '');
    } else if (isGuardSkip(r.out)) {
      rec.steps[st.name] = 'skip(guard)';
    } else {
      rec.steps[st.name] = 'FAIL';
      rec.error = { step: st.name, tail: r.out.trim().split('\n').slice(-4).join(' | ').slice(0, 300) };
      hardFail++;
      stop = true;   // don't write later datasets for a jurisdiction whose earlier step broke
    }
  }
  log.push(rec);
  const line = STEPS.filter(s => !DRY || s.build).map(s => `${s.name.split(':')[1]}=${rec.steps[s.name]}`).join(' ');
  console.log(`${head}\n    ${line}${rec.error ? `\n    !! ${rec.error.step}: ${rec.error.tail}` : ''}`);
}

fs.writeFileSync(path.join(CTX, 'batch_log.json'), JSON.stringify(log, null, 1));
console.log(`\n${'='.repeat(78)}`);
console.log(`jurisdictions processed: ${log.length} · hard failures: ${hardFail}`);
if (hardFail) {
  console.log('\nfailures:');
  for (const r of log.filter(x => x.error)) console.log(`  ${r.title} (${r.geoid}) — ${r.error.step}: ${r.error.tail}`);
}
console.log(`log -> ${path.join(CTX, 'batch_log.json')}`);
process.exit(hardFail ? 1 : 0);
