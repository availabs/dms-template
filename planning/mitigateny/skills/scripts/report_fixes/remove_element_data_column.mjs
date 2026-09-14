/**
 * The R5 half of the fix loop: REMOVE one entry from a section's
 * `element['element-data'].columns` array.
 *
 * Sibling of `apply_element_data_key.mjs`, and it inherits that script's whole
 * safety contract - baseline required, drift-checked, draft-only, payload must
 * be stringify-canonical, minimality proven at the STRING level before the
 * write and byte-equality asserted after it. Read that file's header first;
 * only the differences are documented here.
 *
 * -- What is different, and why it needs its own script ---------------------
 * `apply_element_data_key.mjs` sets a scalar at a fixed path. This one splices
 * an element out of an ARRAY, which shifts every later index. A key set is
 * self-evidently local; an array splice is not, so this script has to prove
 * locality rather than assume it:
 *
 *   1. the entry is located by `name`, never by index, and exactly one match
 *      is required;
 *   2. the column must be genuinely UNUSED - `show` not true, and its `name`
 *      must not appear as a string anywhere else in the payload outside its
 *      own `columns[i]` entry and the `externalSource.columns` schema
 *      snapshot. That is the report's "hidden and not filtered" claim, checked
 *      against the live row instead of trusted;
 *   3. re-inserting the removed entry at its original index must reproduce the
 *      original payload byte-for-byte.
 *
 * `externalSource.columns` is deliberately LEFT ALONE. It is a snapshot of the
 * source's own schema - every column of it, deprecated ones included - not a
 * statement about what this component binds. Editing it would make the
 * component lie about the source it reads from; the binding lives in `columns`.
 *
 * usage:
 *   node remove_element_data_column.mjs <run-dir> --column-from "Remove column" [--dry-run]
 *
 * `<run-dir>` holds `rows.csv` and `baseline/`. A row whose column cell is
 * empty is SKIPPED, so a deliberately held row stays in the run's record.
 * Multiple rows may target the same section id (one per column); they are
 * grouped and applied in ONE write per section, because two writes would make
 * the second read the first as drift.
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
let columnColumn = null, dryRun = false, allowVisible = false;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--column-from') columnColumn = argv[++i];
  else if (argv[i] === '--dry-run') dryRun = true;
  else if (argv[i] === '--allow-visible') allowVisible = true;
}
if (!runDir || !columnColumn) {
  throw new Error('usage: node remove_element_data_column.mjs <run-dir> --column-from "<csvColumn>" [--dry-run] [--allow-visible]');
}

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const hdr = rows.shift().map((h) => h.replace(/^﻿/, ''));
  return rows.filter((r) => r.some((x) => x !== '')).map((r) => Object.fromEntries(hdr.map((h, i) => [h, r[i] ?? ''])));
}

/**
 * A component snapshots its source schema under `externalSource` (v2) or
 * `sourceInfo` (v1) - migrateToV2.js:203-226, and dataWrapper migrates either at
 * mount, so both shapes are live. That snapshot is NOT the binding and must be
 * excluded from the reference scan below (it legitimately lists the deprecated
 * column) and left untouched by the write. Selecting on one key alone is what
 * hid half the pattern from the T6 scan; see the fetch-mode skill's §2b.
 */
export const SNAPSHOT_KEYS = ['externalSource', 'sourceInfo'];
const snapshotKeyOf = (obj) => SNAPSHOT_KEYS.filter(
  (k) => obj[k] && typeof obj[k] === 'object' && Array.isArray(obj[k].columns));

/**
 * A payload can hold MORE copies of the source schema than the binding one.
 * A component that is itself consumable as a source caches the whole schema
 * again under `outputSourceInfo.asUdaConfig.sourceInfo.columns` - measured at
 * 147 columns, a name-for-name copy of `externalSource.columns`.
 *
 * Those are excluded from the reference scan too, but ONLY on proof, never on
 * the strength of the path looking snapshot-ish: `snapshotPaths()` requires the
 * candidate's column-name SET to equal the binding snapshot's, and refuses the
 * row otherwise. And the exclusion is path-precise - `outputSourceInfo.columns`
 * (the component's OUTPUT schema, 5 entries) is deliberately still scanned,
 * because a deprecated column appearing there would be load-bearing.
 */
const EXTRA_SNAPSHOT_PATHS = [['outputSourceInfo', 'asUdaConfig', 'sourceInfo', 'columns']];
const getIn = (o, keys) => keys.reduce((a, k) => (a == null ? a : a[k]), o);

function snapshotPaths(obj, bindingKey) {
  const paths = [[bindingKey, 'columns']];
  const names = (cols) => new Set(cols.map((c) => c && c.name));
  const want = names(obj[bindingKey].columns);
  for (const p of EXTRA_SNAPSHOT_PATHS) {
    const cols = getIn(obj, p);
    if (!Array.isArray(cols)) continue;
    const got = names(cols);
    if (got.size !== want.size || [...got].some((n) => !want.has(n))) {
      return { error: `${p.join('.')} holds ${cols.length} columns whose names are NOT the source schema `
        + `(${got.size} vs ${want.size}) - it may be a real binding, refusing to exclude it from the reference scan` };
    }
    paths.push(p);
  }
  return { paths };
}

/**
 * Every path at which `needle` occurs as a substring of a string leaf (or of
 * an object key). Used to prove the column name is not wired into a filter, a
 * transform, a groupBy, a colSize map or a cached data row.
 */
function stringRefs(node, needle, prefix = '', out = []) {
  if (typeof node === 'string') {
    if (node.includes(needle)) out.push(prefix);
  } else if (Array.isArray(node)) {
    node.forEach((v, i) => stringRefs(v, needle, `${prefix}[${i}]`, out));
  } else if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) {
      if (k.includes(needle)) out.push(`${prefix}{key:${k}}`);
      stringRefs(node[k], needle, prefix ? `${prefix}.${k}` : k, out);
    }
  }
  return out;
}

const rows = parseCsv(fs.readFileSync(`${runDir}/rows.csv`, 'utf8'));
const c = config();
const falcor = client(c);
fs.mkdirSync(`${runDir}/payloads`, { recursive: true });

// group by section id - one write per row would make the second read the first as drift
const bySection = new Map();
for (const r of rows) {
  const id = r['Draft section ID'];
  if (!bySection.has(id)) bySection.set(id, []);
  bySection.get(id).push(r);
}

const results = [];
for (const [id, group] of bySection) {
  const fixId = group.map((r) => r['Fix ID'] || '(no fix id)').join('+');
  const wanted = group.map((r) => (r[columnColumn] ?? '').trim());
  const rec = { fixId, id, columns: wanted.filter(Boolean), action: null, detail: '' };

  const baseFile = `${runDir}/baseline/${id}.json`;
  if (!fs.existsSync(baseFile)) {
    rec.action = 'REFUSED'; rec.detail = 'no baseline - run baseline.mjs first';
    results.push(rec); continue;
  }
  const base = readJson(baseFile);

  if (!rec.columns.length) {
    rec.action = 'SKIPPED';
    rec.detail = `report column "${columnColumn}" is empty` + (group[0].Notes ? ` - ${group[0].Notes}` : '');
    results.push(rec); continue;
  }
  // Some rows of this section may carry an empty value cell. That is the loop's
  // HOLD convention, not an ambiguity: the row stays in the run's record as
  // SKIPPED while its siblings are written. (A section with several deprecated
  // columns routinely has one of them already unbound, or unresolvable against
  // the report - refusing the whole section for that would strand the rest.)
  rec.heldRows = group
    .filter((r) => !(r[columnColumn] ?? '').trim())
    .map((r) => ({ fixId: r['Fix ID'] || '(no fix id)', note: r.Notes || '' }));
  if (rec.heldRows.length) {
    rec.heldDetail = `${rec.heldRows.length} row(s) held with an empty "${columnColumn}": ${rec.heldRows.map((h) => h.fixId).join(', ')}`;
  }
  if (!base.placement.inDraftSections || !base.placement.sectionGroupInDraftGroups) {
    rec.action = 'REFUSED';
    rec.detail = `not a draft section in a draft section group (inDraftSections=${base.placement.inDraftSections}, groupInDraftGroups=${base.placement.sectionGroupInDraftGroups})`;
    results.push(rec); continue;
  }

  const live = await snapshot(falcor, c, id, base.placement.pageId ?? null);
  if (JSON.stringify(canonical(live.data)) !== JSON.stringify(canonical(base.data))) {
    rec.action = 'REFUSED';
    rec.detail = `live row drifted since baseline (updated_at ${base.updated_at} -> ${live.updated_at}) - re-baseline and re-review`;
    results.push(rec); continue;
  }

  const el = live.data.element || {};
  const raw = el['element-data'];
  if (typeof raw !== 'string') {
    rec.action = 'REFUSED';
    rec.detail = `element-data is ${raw === undefined ? 'absent' : typeof raw}, not a JSON string`;
    results.push(rec); continue;
  }
  let obj;
  try { obj = JSON.parse(raw); }
  catch (e) {
    rec.action = 'REFUSED'; rec.detail = `element-data is not parseable JSON: ${e.message}`;
    results.push(rec); continue;
  }

  const roundTrip = JSON.stringify(obj);
  rec.payloadChars = raw.length;
  rec.roundTripCanonical = roundTrip === raw;
  if (!rec.roundTripCanonical) {
    rec.action = 'REFUSED';
    rec.detail = `element-data is not stringify-canonical (${raw.length} chars -> ${roundTrip.length}); re-serialising would reformat it. Needs a human.`;
    results.push(rec); continue;
  }
  if (!Array.isArray(obj.columns)) {
    rec.action = 'REFUSED';
    rec.detail = `element-data.columns is ${obj.columns === undefined ? 'absent' : typeof obj.columns}, not an array`;
    results.push(rec); continue;
  }

  const snapKeys = snapshotKeyOf(obj);
  if (snapKeys.length !== 1) {
    rec.action = 'REFUSED';
    rec.detail = `expected exactly one source snapshot with a columns list (${SNAPSHOT_KEYS.join(' or ')}), found ${snapKeys.length ? snapKeys.join('+') : 'none'} - element-data keys: ${Object.keys(obj).join(', ')}`;
    results.push(rec); continue;
  }
  const snapKey = snapKeys[0];
  rec.sourceSnapshotKey = snapKey;

  const snaps = snapshotPaths(obj, snapKey);
  if (snaps.error) {
    rec.action = 'REFUSED'; rec.detail = snaps.error;
    results.push(rec); continue;
  }
  rec.snapshotPaths = snaps.paths.map((p) => p.join('.'));

  rec.columnCountBefore = obj.columns.length;
  // Evaluate EVERY named column before deciding, rather than stopping at the
  // first problem: when a section carries several deprecated columns, "which of
  // them are safe" is the thing the operator needs in order to split the run.
  // Stopping early reports one blocker and hides the rest.
  const targets = [];
  const blocked = [];
  const absent = [];
  for (const name of rec.columns) {
    const hits = obj.columns.map((col, i) => [i, col]).filter(([, col]) => col && col.name === name);
    if (hits.length === 0) { absent.push(name); continue; }
    if (hits.length > 1) {
      blocked.push(`${name}: ${hits.length} bound columns with that name - ambiguous`);
      continue;
    }
    const [idx, col] = hits[0];

    // gate 1: it must not be rendered
    if (col.show === true && !allowVisible) {
      blocked.push(`${name}: show=true, it is RENDERED - removing it changes the page (needs --allow-visible, a stated decision)`);
      continue;
    }
    // gate 2: it must not be wired into anything else. The source snapshot is
    // excluded because it legitimately lists the deprecated column - it is the
    // schema, not the binding.
    const scrub = JSON.parse(JSON.stringify(obj));
    scrub.columns.splice(idx, 1);
    for (const p of snaps.paths) delete getIn(scrub, p.slice(0, -1))[p[p.length - 1]];
    const refs = stringRefs(scrub, name);
    if (refs.length) {
      blocked.push(`${name}: referenced elsewhere in the payload at ${refs.slice(0, 6).join(', ')}${refs.length > 6 ? ` (+${refs.length - 6} more)` : ''}`);
      (rec.otherRefs ??= {})[name] = refs;
      continue;
    }
    targets.push({ name, index: idx, entry: col, show: col.show ?? null, storedTitle: col.display_name ?? null });
  }

  if (blocked.length) {
    rec.action = 'REFUSED';
    rec.blocked = blocked;
    rec.wouldRemove = targets.map((t) => t.name);
    rec.detail = `${blocked.join(' | ')}`
      + (targets.length ? ` || the other ${targets.length} column(s) pass every gate (${targets.map((t) => t.name).join(', ')}) - split the run to apply them` : '')
      + (rec.heldDetail ? ` || ${rec.heldDetail}` : '');
    results.push(rec); continue;
  }
  if (!targets.length) {
    rec.action = 'NO-OP';
    rec.detail = `no bound column named ${absent.map((n) => JSON.stringify(n)).join(', ')} - already removed?`;
    results.push(rec); continue;
  }
  if (absent.length) rec.alreadyAbsent = absent;

  rec.targets = targets.map((t) => ({ name: t.name, index: t.index, show: t.show, storedTitle: t.storedTitle }));

  // splice highest index first so the earlier indices stay valid
  const nextObj = JSON.parse(JSON.stringify(obj));
  [...targets].sort((a, b) => b.index - a.index).forEach((t) => nextObj.columns.splice(t.index, 1));
  const next = JSON.stringify(nextObj);

  // minimality at the STRING level: put the entries back where they were and
  // the serialisation must equal what we started with, byte for byte.
  const check = JSON.parse(next);
  [...targets].sort((a, b) => a.index - b.index).forEach((t) => check.columns.splice(t.index, 0, t.entry));
  if (JSON.stringify(check) !== raw) {
    rec.action = 'REFUSED';
    rec.detail = 're-inserting the removed column(s) does not reproduce the original payload byte-for-byte - refusing to write';
    results.push(rec); continue;
  }
  rec.columnCountAfter = nextObj.columns.length;
  rec.payloadCharsAfter = next.length;
  rec.payloadDelta = next.length - raw.length;

  const describe = targets
    .map((t) => `${t.name} (index ${t.index}, stored title ${JSON.stringify(t.storedTitle)}, show=${JSON.stringify(t.show)})`)
    .join('; ');

  if (dryRun) {
    rec.action = 'WOULD REMOVE';
    rec.detail = `${describe} | columns ${rec.columnCountBefore} -> ${rec.columnCountAfter}, payload ${raw.length} -> ${next.length} chars (${rec.payloadDelta})`
      + (rec.heldDetail ? ` | ${rec.heldDetail}` : '');
    results.push(rec); continue;
  }

  rec.expectedPayload = next;

  const payload = JSON.parse(JSON.stringify(live.data));
  payload.element = { ...el, 'element-data': next };
  const payloadFile = path.resolve(`${runDir}/payloads/${id}.json`);
  fs.writeFileSync(payloadFile, JSON.stringify(payload));

  const out = execFileSync(process.execPath, [DMS, 'section', 'update', id, '--data', payloadFile], {
    encoding: 'utf8', env: process.env, stdio: ['ignore', 'pipe', 'pipe'],
  });

  const after = await snapshot(falcor, c, id, base.placement.pageId ?? null);
  const rawAfter = (after.data.element || {})['element-data'];
  rec.exactPayloadMatch = rawAfter === next;
  rec.typeStillString = typeof rawAfter === 'string';
  rec.action = (rec.exactPayloadMatch && rec.typeStillString) ? 'REMOVED' : 'FAIL';
  rec.detail = [
    describe,
    `columns ${rec.columnCountBefore} -> ${rec.columnCountAfter}`,
    rec.typeStillString ? 'element-data still a string' : 'ELEMENT-DATA TYPE CHANGED',
    rec.exactPayloadMatch ? 'payload byte-identical to the computed string' : 'PAYLOAD DIFFERS FROM COMPUTED',
    ...(rec.heldDetail ? [rec.heldDetail] : []),
  ].join('; ');
  rec.cliOutput = out.trim().split('\n').slice(-1)[0]?.slice(0, 120);
  results.push(rec);
}

for (const r of results) {
  console.log(`${r.fixId.padEnd(10)} ${String(r.id).padEnd(9)} ${r.action.padEnd(14)} ${r.detail}`);
}
writeJson(`${runDir}/applied.json`, {
  at: new Date().toISOString(), attr: 'element-data:columns[] (remove)', column: columnColumn,
  dryRun, allowVisible, results,
});
console.log(`\n${dryRun ? 'dry run' : 'applied'} -> ${runDir}/applied.json`);
if (results.some((r) => r.action === 'REFUSED' || r.action === 'FAIL')) process.exitCode = 2;
