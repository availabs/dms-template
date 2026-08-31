/**
 * Undo a fix run: restore each section's `data` object from its step-1 baseline.
 *
 * The baseline is a full row image, so a rollback is one `--data` write per
 * section - no reconstruction, no guessing which keys the run touched.
 *
 * Refuses to restore a section whose live row no longer matches what
 * validate.mjs recorded in `after/` - that means something changed after the
 * run, and blindly restoring the baseline would discard it.
 *
 * usage:
 *   node rollback.mjs <run-dir> [--dry-run] [--force]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { config, client, snapshot, canonical, readJson, writeJson } from './fix_lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DMS = path.resolve(HERE, '../../../../../src/dms/packages/dms/cli/bin/dms.js');

const argv = process.argv.slice(2);
const runDir = argv.shift();
const dryRun = argv.includes('--dry-run');
const force = argv.includes('--force');
if (!runDir) throw new Error('usage: node rollback.mjs <run-dir> [--dry-run] [--force]');

const applied = readJson(`${runDir}/applied.json`);
const targets = applied.results.filter((r) => r.action === 'SET');
if (!targets.length) { console.log('nothing was written in this run'); process.exit(0); }

const c = config();
const falcor = client(c);
const results = [];

for (const r of targets) {
  const base = readJson(`${runDir}/baseline/${r.id}.json`);
  const live = await snapshot(falcor, c, r.id, base.placement?.pageId ?? null);
  const rec = { id: r.id, fixId: r.fixId, action: null, detail: '' };

  const afterFile = `${runDir}/after/${r.id}.json`;
  if (!force && fs.existsSync(afterFile)) {
    const after = readJson(afterFile);
    if (JSON.stringify(canonical(live.data)) !== JSON.stringify(canonical(after.data))) {
      rec.action = 'REFUSED';
      rec.detail = 'row changed after the run was validated - review before restoring (--force to override)';
      results.push(rec); continue;
    }
  }
  if (JSON.stringify(canonical(live.data)) === JSON.stringify(canonical(base.data))) {
    rec.action = 'NO-OP'; rec.detail = 'already matches baseline';
    results.push(rec); continue;
  }
  if (dryRun) {
    rec.action = 'WOULD RESTORE'; rec.detail = `${r.attr}: ${JSON.stringify(live.data[r.attr] ?? null)} -> ${JSON.stringify(base.data[r.attr] ?? null)}`;
    results.push(rec); continue;
  }

  execFileSync(process.execPath, [DMS, 'section', 'update', r.id, '--data', JSON.stringify(base.data)],
    { encoding: 'utf8', env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  const back = await snapshot(falcor, c, r.id, base.placement?.pageId ?? null);
  const ok = JSON.stringify(canonical(back.data)) === JSON.stringify(canonical(base.data));
  rec.action = ok ? 'RESTORED' : 'FAILED';
  rec.detail = ok ? 'data matches baseline' : 'data still differs from baseline after write';
  results.push(rec);
}

results.forEach((r) => console.log(`${String(r.fixId).padEnd(8)} ${String(r.id).padEnd(9)} ${r.action.padEnd(14)} ${r.detail}`));
writeJson(`${runDir}/rollback.json`, { at: new Date().toISOString(), dryRun, force, results });
if (results.some((r) => r.action === 'FAILED' || r.action === 'REFUSED')) process.exitCode = 1;
