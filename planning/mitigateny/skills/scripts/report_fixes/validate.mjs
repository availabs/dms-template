/**
 * STEP 3 of the report-fix loop: prove the write did what was asked and
 * nothing else.
 *
 * Re-snapshots every section in the run and diffs it leaf-by-leaf against the
 * step-1 baseline. `element-data` is JSON-parsed before diffing, so a stray
 * re-serialisation of a lexical body or a Card config shows up as the specific
 * node that moved rather than as one opaque changed string.
 *
 * A run PASSES only when, for every section:
 *   - `data.<attr>` moved to exactly the value the report asked for;
 *   - the only other differing leaves are in the allow-list (`updated_at`);
 *   - placement is unchanged - same page, same index in `draft_sections`,
 *     same section group.
 *
 * usage: node validate.mjs <run-dir> --attr tags [--allow <path> ...]
 */
import fs from 'fs';
import { config, client, snapshot, diffLeaves, readJson, writeJson } from './fix_lib.mjs';

const argv = process.argv.slice(2);
const runDir = argv.shift();
let attr = null;
const allow = ['updated_at'];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--attr') attr = argv[++i];
  else if (argv[i] === '--allow') allow.push(argv[++i]);
}
if (!runDir || !attr) throw new Error('usage: node validate.mjs <run-dir> --attr <sectionAttr> [--allow <path>]');

const applied = readJson(`${runDir}/applied.json`);
if (applied.dryRun) throw new Error('applied.json is from a --dry-run; nothing to validate');

const c = config();
const falcor = client(c);

const PLACEMENT_KEYS = ['pageId', 'inDraftSections', 'draftIndex', 'draftSectionCount',
  'sectionGroupId', 'sectionGroupInDraftGroups'];

/**
 * If the run also removed sections (remove_from_page.mjs), every surviving
 * section AFTER a removed index shifts down. That is expected, but it is not a
 * licence to stop checking placement - so compute where each id SHOULD now be
 * and assert that exactly, rather than ignoring the two keys.
 */
const removedByPage = new Map();
if (fs.existsSync(`${runDir}/removed.json`)) {
  const rem = readJson(`${runDir}/removed.json`);
  if (!rem.dryRun) {
    for (const p of rem.pages || []) {
      if (p.action !== 'REMOVED') continue;
      removedByPage.set(String(p.pageId), (p.removed || []).map((x) => x.draftIndex).filter((i) => i >= 0));
    }
  }
}
const shiftFor = (pageId, baseIndex) => {
  const idxs = removedByPage.get(String(pageId));
  if (!idxs) return { index: baseIndex, count: 0 };
  return { index: baseIndex - idxs.filter((i) => i < baseIndex).length, count: idxs.length };
};

const report = [];
let failures = 0;
for (const r of applied.results) {
  const row = { fixId: r.fixId, id: r.id, action: r.action, verdict: null, notes: [] };
  if (r.action !== 'SET') {
    row.verdict = 'NOT WRITTEN';
    row.notes.push(r.detail);
    report.push(row); continue;
  }

  const base = readJson(`${runDir}/baseline/${r.id}.json`);
  const now = await snapshot(falcor, c, r.id, base.placement.pageId ?? null);
  writeJson(`${runDir}/after/${r.id}.json`, now);

  const allChanged = diffLeaves(base, now);
  // `placement` is not part of the row - it is derived context, and it is
  // asserted explicitly via PLACEMENT_KEYS below. Keeping it out of the leaf
  // diff means an unrelated publish (or a snapshot format change) cannot
  // masquerade as content drift.
  const changed = allChanged.filter((d) => !d.path.startsWith('placement.'));
  const placementLeaves = allChanged.filter((d) => d.path.startsWith('placement.'));
  const intended = `data.${attr}`;
  const unexpected = changed.filter((d) => d.path !== intended && !allow.includes(d.path));
  const hit = changed.find((d) => d.path === intended);

  if (!hit) { row.notes.push(`${intended} did not change`); failures++; }
  else if (String(hit.after) !== String(r.want)) {
    row.notes.push(`${intended} is ${JSON.stringify(hit.after)}, expected ${JSON.stringify(r.want)}`);
    failures++;
  } else {
    row.notes.push(`${intended}: ${JSON.stringify(hit.before)} -> ${JSON.stringify(hit.after)}`);
  }

  const sh = shiftFor(base.placement.pageId, base.placement.draftIndex);
  const expected = {
    ...base.placement,
    draftIndex: sh.index,
    draftSectionCount: base.placement.draftSectionCount - sh.count,
  };
  const moved = PLACEMENT_KEYS.filter((k) => JSON.stringify(expected[k]) !== JSON.stringify(now.placement[k]));
  if (moved.length) {
    row.notes.push(`placement changed: ${moved.map((k) => `${k} ${JSON.stringify(expected[k])} -> ${JSON.stringify(now.placement[k])}`).join(', ')}`);
    failures++;
  } else if (sh.count) {
    row.notes.push(`draft index ${base.placement.draftIndex} -> ${sh.index} of ${expected.draftSectionCount}, exactly the shift this run's ${sh.count} removal(s) imply`);
  }
  placementLeaves
    .filter((d) => !PLACEMENT_KEYS.some((k) => d.path === `placement.${k}`))
    .forEach((d) => row.notes.push(`note (not a row change) ${d.path}: ${JSON.stringify(d.before)} -> ${JSON.stringify(d.after)}`));

  if (unexpected.length) {
    failures++;
    unexpected.slice(0, 12).forEach((d) => row.notes.push(
      `UNEXPECTED ${d.path}: ${JSON.stringify(d.before)?.slice(0, 90)} -> ${JSON.stringify(d.after)?.slice(0, 90)}`));
    if (unexpected.length > 12) row.notes.push(`... and ${unexpected.length - 12} more`);
  }

  row.changedLeafCount = changed.length;
  row.unexpectedLeafCount = unexpected.length;
  row.verdict = (!hit || unexpected.length || moved.length
    || String(hit?.after) !== String(r.want)) ? 'FAIL' : 'PASS';
  report.push(row);
}

for (const r of report) {
  console.log(`${String(r.fixId).padEnd(8)} ${String(r.id).padEnd(9)} ${String(r.verdict).padEnd(12)}${r.changedLeafCount != null ? `${r.changedLeafCount} leaf change(s), ${r.unexpectedLeafCount} unexpected` : ''}`);
  r.notes.forEach((n) => console.log(`         ${n}`));
}
writeJson(`${runDir}/validation.json`, { at: new Date().toISOString(), attr, allow, report });
console.log(`\n${report.filter((r) => r.verdict === 'PASS').length}/${report.length} PASS -> ${runDir}/validation.json`);
if (failures) process.exitCode = 1;
