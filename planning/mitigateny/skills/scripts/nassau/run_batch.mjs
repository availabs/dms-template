/**
 * Gate 5 driver - run load.mjs once per jurisdiction for one dataset.
 *
 * WHY NOT `load.mjs <dataset> --all`
 * The loader's prior-run guard compares the run's `target` string. A completed run recorded
 * against target `3643335` does not match a later run against target `--all`, so `--all` would
 * sail past the guard and re-insert every jurisdiction already loaded at Gate 4. Driving the
 * loader per geoid keeps each jurisdiction its own guarded unit, and yields one run directory
 * per jurisdiction so a partial batch is resumable at jurisdiction granularity.
 *
 * Already-loaded jurisdictions are SKIPPED rather than forced: the loader exits non-zero with a
 * REFUSING message, which this reads as "done" and moves on. That makes the driver idempotent --
 * re-running it after an interruption picks up exactly where it stopped.
 *
 * Stops the whole batch on `no-access` (an expired token) rather than grinding through the
 * remaining jurisdictions accumulating failures.
 *
 * Usage: node run_batch.mjs <dataset> [--dry] [--limit=N] [--from=<geoid>]
 *   --limit=N   process at most N jurisdictions this run (for a cautious first slice)
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const CTX = path.resolve(HERE, '..');
const LOADER = path.join(HERE, 'load.mjs');

const which = process.argv[2];
const DRY = process.argv.includes('--dry');
const LIMIT = Number((process.argv.find(a => a.startsWith('--limit=')) || '').split('=')[1] || 0);
const FROM = (process.argv.find(a => a.startsWith('--from=')) || '').split('=')[1] || null;
if (!which) {
  console.error('Usage: node run_batch.mjs <dataset> [--dry] [--limit=N] [--from=<geoid>]');
  process.exit(2);
}

// Which jurisdictions have a payload for this dataset?
const PAY = path.join(CTX, 'payloads');
const PREFIX = { actions: 'act', capabilities: 'cap', roles: 'roles',
                 participation: 'part', hoc: 'hoc', jurisdictions: 'juris' }[which];
let geoids;
if (which === 'jurisdictions') {
  geoids = JSON.parse(fs.readFileSync(path.join(PAY, '_juris_updates.json'), 'utf8'))
    .map(r => String(r.geoid));
} else {
  geoids = [...new Set(fs.readdirSync(PAY)
    .filter(f => f.startsWith(PREFIX + '_') && f.endsWith('.json') && !f.startsWith('_'))
    .map(f => f.slice(PREFIX.length + 1).replace(/(_updates|_inserts)?\.json$/, '')))];
}
geoids = geoids.filter(g => /^\d+$/.test(g)).sort();
if (FROM) geoids = geoids.filter(g => g >= FROM);

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
const logPath = path.join(CTX, 'runs', `_batch_${stamp}_${which}.log`);
fs.mkdirSync(path.dirname(logPath), { recursive: true });
const lines = [];
const say = (s) => { console.log(s); lines.push(s); fs.writeFileSync(logPath, lines.join('\n') + '\n'); };

say(`batch ${which}: ${geoids.length} jurisdiction(s)${DRY ? '  [--dry]' : ''}`);

let done = 0, skipped = 0, failed = 0, rows = 0;
const problems = [];
for (const [i, g] of geoids.entries()) {
  if (LIMIT && done + failed >= LIMIT) { say(`\n--limit=${LIMIT} reached; stopping.`); break; }
  const args = [LOADER, which, g];
  if (DRY) args.push('--dry');
  let out = '', code = 0;
  try {
    out = execFileSync(process.execPath, args, {
      encoding: 'utf8', env: process.env, stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (e) {
    out = `${e.stdout || ''}${e.stderr || ''}`;
    code = e.status ?? 1;
  }
  const clean = out.split('\n').filter(l => !/MODULE_TYPELESS|Reparsing as ES|"type": "module"|trace-warnings/.test(l));
  const wroteLine = clean.find(l => /^wrote /.test(l.trim()));
  const verLine = clean.find(l => /row\(s\) verified|field diff|not found/.test(l));
  const refuse = clean.find(l => /^REFUSING/.test(l.trim()));
  const noAccess = clean.some(l => /no-access/.test(l));

  const tag = `[${String(i + 1).padStart(2)}/${geoids.length}] ${g}`;
  if (noAccess) {
    say(`${tag}  TOKEN EXPIRED — stopping the batch here.`);
    say(`  Re-mint and re-run this same command; completed jurisdictions will be skipped.`);
    failed++;
    break;
  }
  if (refuse) {
    // Only ONE refusal means "already done": the prior-run guard. Every other refusal is the
    // loader declining to write for a reason that needs fixing, and treating it as a skip
    // hides missing rows behind a benign-looking line.
    //
    // That happened on the first HOC batch. Freeport was refused for a missing match
    // provenance -- a guard that should not apply to HOC at all -- and the driver logged it
    // as "skip", so 17 updates and 6 inserts went unwritten and the batch still reported
    // "0 with problems". A skip and a refusal are not the same event.
    const alreadyDone = /has already been written to/.test(refuse);
    if (alreadyDone) {
      skipped++;
      say(`${tag}  skip — already loaded`);
    } else {
      failed++;
      problems.push(`${g}: REFUSED — ${refuse.replace(/^\s*REFUSING:\s*/, '').slice(0, 120)}`);
      say(`${tag}  REFUSED (not a skip) — ` +
          `${refuse.replace(/^\s*REFUSING:\s*/, '').slice(0, 100)}`);
    }
    continue;
  }
  const n = wroteLine ? Number((wroteLine.match(/wrote (\d+)/) || [])[1] || 0) : 0;
  rows += n;
  const bad = verLine && /field diff|not found/.test(verLine);
  if (code !== 0 || bad) {
    failed++;
    problems.push(`${g}: ${(verLine || clean.slice(-3).join(' ')).trim().slice(0, 140)}`);
    say(`${tag}  PROBLEM  ${n} row(s) — ${(verLine || '').trim().slice(0, 80)}`);
  } else {
    done++;
    say(`${tag}  ok  ${n} row(s)${verLine ? '  ' + verLine.trim() : ''}`);
  }
}

say(`\n${which}: ${done} jurisdiction(s) loaded, ${skipped} skipped, ${failed} with problems`);
say(`${rows} row(s) written this batch`);
for (const p of problems) say(`  PROBLEM ${p}`);
say(`-> ${path.relative(CTX, logPath)}`);
process.exit(failed ? 1 : 0);
