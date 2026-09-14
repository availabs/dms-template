/**
 * STEP 3 for the R5 column-removal fix: prove the splice did what was asked
 * and nothing else.
 *
 * `validate.mjs` cannot do this. It asserts that ONE leaf path moved to ONE
 * scalar value, and a splice out of `element-data.columns` moves every leaf
 * under every later index - a 12-column component produces dozens of legitimate
 * leaf changes for a one-column removal. Asserting "only `columns[10].name`
 * changed" is not merely awkward here, it is the wrong claim.
 *
 * So the assertion is made at the level the change actually has: the ARRAY.
 * For every section the run reports as REMOVED:
 *
 *   1. `element-data` is byte-identical to the string the writer computed
 *      (`applied.json`'s `expectedPayload`) - the strongest form of "exactly
 *      the intended payload landed", and independent of any leaf diff;
 *   2. the live `columns` array equals the BASELINE array with exactly the
 *      target entries spliced out - deep-equal, order preserved, so a
 *      reordering or a silently rewritten sibling entry fails;
 *   3. the removed names no longer appear in `columns` at all, and still DO
 *      appear in `externalSource.columns` (the source snapshot must not have
 *      been touched);
 *   4. every leaf outside `data.element.element-data.columns` is unchanged
 *      except `updated_at` - so `filters`, `display`, `join`, the cached `data`
 *      rows and every top-level section attribute are all held byte-stable;
 *   5. placement is unchanged - same page, same draft index, same group.
 *
 * usage: node validate_element_data_column.mjs <run-dir> [--allow <path> ...]
 */
import fs from 'fs';
import { config, client, snapshot, canonical, flatten, readJson, writeJson } from './fix_lib.mjs';

const argv = process.argv.slice(2);
const runDir = argv.shift();
const allow = ['updated_at'];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--allow') allow.push(argv[++i]);
}
if (!runDir) throw new Error('usage: node validate_element_data_column.mjs <run-dir> [--allow <path>]');

const applied = readJson(`${runDir}/applied.json`);
if (applied.dryRun) throw new Error('applied.json is from a --dry-run; nothing to validate');

const c = config();
const falcor = client(c);

const PLACEMENT_KEYS = ['pageId', 'inDraftSections', 'draftIndex', 'draftSectionCount',
  'sectionGroupId', 'sectionGroupInDraftGroups'];

const COLUMNS_PREFIX = 'data.element.element-data.columns';
const eq = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

/** Leaf map of a snapshot with `element-data.columns` excised, so the rest of
 *  the row can be compared for byte-stability independently of the splice. */
function leavesOutsideColumns(snap) {
  const clone = JSON.parse(JSON.stringify(snap));
  delete clone.placement;
  const el = clone?.data?.element;
  if (el && typeof el['element-data'] === 'string') {
    try {
      const parsed = JSON.parse(el['element-data']);
      delete parsed.columns;
      el['element-data'] = parsed;
    } catch { /* left as the raw string - it will diff as one leaf */ }
  }
  return flatten(canonical(clone));
}

const parseEd = (snap) => {
  const raw = (snap.data.element || {})['element-data'];
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
};

const report = [];
let failures = 0;
for (const r of applied.results) {
  const row = { fixId: r.fixId, id: r.id, action: r.action, verdict: null, notes: [] };
  if (r.action !== 'REMOVED') {
    row.verdict = 'NOT WRITTEN';
    row.notes.push(r.detail);
    report.push(row); continue;
  }

  const base = readJson(`${runDir}/baseline/${r.id}.json`);
  const now = await snapshot(falcor, c, r.id, base.placement.pageId ?? null);
  writeJson(`${runDir}/after/${r.id}.json`, now);

  let bad = 0;

  // 1. byte-exact payload
  const rawNow = (now.data.element || {})['element-data'];
  const exact = rawNow === r.expectedPayload;
  row.payloadByteExact = exact;
  row.notes.push(exact
    ? `element-data byte-identical to the computed payload (${rawNow.length} chars, ${r.payloadDelta} vs baseline)`
    : 'PAYLOAD IS NOT the string the writer computed');
  if (!exact) bad++;

  // 2. columns array == baseline minus the targets, order preserved
  const baseCols = parseEd(base).columns;
  const nowCols = parseEd(now).columns;
  const expectCols = JSON.parse(JSON.stringify(baseCols));
  [...(r.targets || [])].sort((a, b) => b.index - a.index).forEach((t) => expectCols.splice(t.index, 1));
  const colsOk = eq(expectCols, nowCols);
  row.columnCount = { baseline: baseCols.length, now: nowCols.length, expected: expectCols.length };
  row.notes.push(colsOk
    ? `columns ${baseCols.length} -> ${nowCols.length}: exactly the baseline array minus ${(r.targets || []).map((t) => t.name).join(', ')}, order preserved, every surviving entry deep-equal`
    : `COLUMNS ARRAY is not the baseline minus the target(s) (${baseCols.length} -> ${nowCols.length}, expected ${expectCols.length})`);
  if (!colsOk) bad++;

  // 3. gone from the binding, still present in the source snapshot.
  //    The snapshot key is `externalSource` (v2) or `sourceInfo` (v1); the writer
  //    recorded which, so the assertion is made against the shape it actually saw.
  const snapKey = r.sourceSnapshotKey || 'externalSource';
  for (const t of r.targets || []) {
    const stillBound = nowCols.some((col) => col && col.name === t.name);
    const inSource = (parseEd(now)[snapKey]?.columns || []).some((col) => col && col.name === t.name);
    if (stillBound) { row.notes.push(`STILL BOUND: ${t.name} is present in columns`); bad++; }
    if (!inSource) {
      row.notes.push(`SOURCE SNAPSHOT ALTERED: ${t.name} is gone from ${snapKey}.columns - the write should not have touched it`);
      bad++;
    }
    if (!stillBound && inSource) {
      row.notes.push(`${t.name}: unbound from columns, still listed in ${snapKey}.columns (source snapshot untouched)`);
    }
  }

  // 4. nothing outside columns moved
  const a = leavesOutsideColumns(base);
  const b = leavesOutsideColumns(now);
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  const outside = keys
    .filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
    .filter((k) => !allow.includes(k) && !k.startsWith(COLUMNS_PREFIX));
  row.leavesOutsideColumns = keys.length;
  row.unexpectedLeafCount = outside.length;
  if (outside.length) {
    failures++; bad++;
    outside.slice(0, 12).forEach((k) => row.notes.push(
      `UNEXPECTED ${k}: ${JSON.stringify(a[k])?.slice(0, 90)} -> ${JSON.stringify(b[k])?.slice(0, 90)}`));
    if (outside.length > 12) row.notes.push(`... and ${outside.length - 12} more`);
  } else {
    row.notes.push(`all ${keys.length} leaves outside columns[] byte-identical (filters, display, join, cached data, every section attribute), only ${allow.join(' / ')} allowed to move`);
  }

  // 5. placement
  const moved = PLACEMENT_KEYS.filter((k) => JSON.stringify(base.placement[k]) !== JSON.stringify(now.placement[k]));
  if (moved.length) {
    bad++;
    row.notes.push(`placement changed: ${moved.map((k) => `${k} ${JSON.stringify(base.placement[k])} -> ${JSON.stringify(now.placement[k])}`).join(', ')}`);
  } else {
    row.notes.push(`placement unchanged (page ${now.placement.pageId}, draft index ${now.placement.draftIndex} of ${now.placement.draftSectionCount}, group ${now.placement.sectionGroupId})`);
  }

  if (bad) failures++;
  row.verdict = bad ? 'FAIL' : 'PASS';
  report.push(row);
}

for (const r of report) {
  console.log(`${String(r.fixId).padEnd(10)} ${String(r.id).padEnd(9)} ${String(r.verdict).padEnd(12)}${r.unexpectedLeafCount != null ? `${r.unexpectedLeafCount} unexpected leaf change(s) outside columns[]` : ''}`);
  r.notes.forEach((n) => console.log(`           ${n}`));
}
writeJson(`${runDir}/validation.json`, { at: new Date().toISOString(), mode: 'element-data columns removal', allow, report });
console.log(`\n${report.filter((r) => r.verdict === 'PASS').length}/${report.length} PASS -> ${runDir}/validation.json`);
if (failures) process.exitCode = 1;
