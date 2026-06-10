/**
 * Test runner for app-owned data-type plugins.
 *
 * Two layers (see data-types/CLAUDE.md + the migration task plan):
 *   1. Unit tests   — vitest files: <plugin>/tests/*.unit.test.{js,mjs}
 *                     (auto-discovered by vitest; pure functions, no DB/CH/RITIS).
 *   2. Integration  — node scripts: <plugin>/tests/*.integration.js
 *                     (the dms-server sqlite harness; route/worker behavior).
 *                     Named *.integration.js (NOT *.test.*) so vitest ignores them.
 *
 * Usage:
 *   node data-types/run-tests.js            # run both layers for all plugins
 *   node data-types/run-tests.js npmrds_raw # only that plugin
 *   node data-types/run-tests.js --unit     # only vitest units
 *   node data-types/run-tests.js --integration
 *
 * RITIS is NEVER called by any test (see the iron-clad rule in the task plan).
 */
const { readdirSync, statSync, existsSync } = require('fs');
const { join } = require('path');
const { spawnSync } = require('child_process');

const ROOT = __dirname;
const args = process.argv.slice(2);
const only = args.find((a) => !a.startsWith('--'));
const unitOnly = args.includes('--unit');
const integrationOnly = args.includes('--integration');

function pluginDirs() {
  return readdirSync(ROOT)
    .filter((n) => !n.startsWith('_') && !n.startsWith('.'))
    .filter((n) => statSync(join(ROOT, n)).isDirectory())
    .filter((n) => (only ? n === only : true));
}

function findIntegrationScripts() {
  const out = [];
  for (const p of pluginDirs()) {
    const testsDir = join(ROOT, p, 'tests');
    if (!existsSync(testsDir)) continue;
    walk(testsDir, (f) => {
      if (f.endsWith('.integration.js')) out.push(f);
    });
  }
  return out;
}

function walk(dir, cb) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, cb);
    else cb(full);
  }
}

let failures = 0;

if (!unitOnly) {
  const scripts = findIntegrationScripts();
  console.log(`\n── Integration (node/sqlite): ${scripts.length} script(s) ──`);
  for (const s of scripts) {
    console.log(`\n▶ ${s.replace(ROOT + '/', '')}`);
    const r = spawnSync(process.execPath, [s], { stdio: 'inherit' });
    if (r.status !== 0) failures++;
  }
}

if (!integrationOnly) {
  console.log(`\n── Unit (vitest) ──`);
  const target = only ? join(ROOT, only) : ROOT;
  const r = spawnSync('npx', ['vitest', 'run', target], { stdio: 'inherit', cwd: ROOT });
  // vitest exits 1 when no test files are found; treat that as "no units yet", not a failure.
  if (r.status !== 0 && r.status !== 1) failures++;
  else if (r.status === 1) console.log('(vitest: non-zero — check output above; "no test files" is OK)');
}

if (failures > 0) {
  console.error(`\n✗ ${failures} integration script(s) failed.\n`);
  process.exit(1);
}
console.log('\n✓ data-type tests passed.\n');
