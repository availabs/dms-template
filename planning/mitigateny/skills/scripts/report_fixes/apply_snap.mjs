/**
 * Apply a Snap to County Template work list. Dry run unless --apply.
 *
 * Guards, in order:
 *   1. refuses if any target section id belongs to the TEMPLATE pattern
 *   2. baselines the full row before every write
 *   3. writes ONE setting per call
 *   4. reads back and asserts that only the intended leaf moved
 *   5. asserts element-data.text is byte-identical - authored text is never
 *      altered by this process, and this is the assertion that proves it
 *
 * usage:
 *   node apply_snap.mjs <worklist.csv> <groups.frozen.json> <out-dir> \
 *        [--page <slug>] [--setting <name>]... [--apply]
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { config, client } from './fix_lib.mjs';
import { fetchById, parseData } from '../../../../../src/dms/packages/dms/cli/src/utils/data.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DMS = path.resolve(HERE, '../../../../../src/dms/packages/dms/cli/bin/dms.js');
const argv = process.argv.slice(2);
const [listFile, groupsFile, outDir] = argv;
const APPLY = argv.includes('--apply');
const onlyPage = argv.includes('--page') ? argv[argv.indexOf('--page') + 1] : null;
const onlySettings = argv.reduce((a, x, i) => (x === '--setting' ? [...a, argv[i + 1]] : a), []);
if (!listFile || !groupsFile || !outDir) throw new Error('usage: node apply_snap.mjs <worklist.csv> <groups.frozen.json> <out-dir> [--page slug] [--setting name] [--apply]');
fs.mkdirSync(outDir, { recursive: true });

const parseCsv = (t) => {
  const rows = []; let f = '', row = [], q = false; const b = t.replace(/^﻿/, '');
  for (let i = 0; i < b.length; i++) {
    const c = b[i];
    if (q) { if (c === '"') { if (b[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\r' && b[i + 1] === '\n') { row.push(f); rows.push(row); row = []; f = ''; i++; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const h = rows[0];
  return rows.slice(1).filter((r) => r.length === h.length).map((r) => Object.fromEntries(h.map((k, i) => [k, r[i]])));
};

let work = parseCsv(fs.readFileSync(listFile, 'utf8'));
if (onlyPage) work = work.filter((r) => r.Page === onlyPage);
if (onlySettings.length) work = work.filter((r) => onlySettings.includes(r.Setting));

// ---- guard 1: the template is never a target ------------------------------
const { template: TEMPLATE, groups } = JSON.parse(fs.readFileSync(groupsFile, 'utf8'));
const templateIds = new Set(groups.map((g) => g.members[TEMPLATE]?.id).filter(Boolean));
const violations = work.filter((r) => templateIds.has(r['Target section ID']));
if (violations.length) {
  console.error(`ABORT: ${violations.length} target(s) are ${TEMPLATE} sections - the template is never written to.`);
  violations.slice(0, 5).forEach((v) => console.error(`  ${v['Fix ID']} ${v['Target section ID']}`));
  process.exit(1);
}
console.log(`guard: 0 of ${work.length} targets belong to ${TEMPLATE} (${templateIds.size} template ids checked)`);

const c = config();
const falcor = client(c);
const readRow = async (id) => parseData((await fetchById(falcor, c.app, id, ['id', 'data'])).data) || {};
const edOf = (d) => { const r = (d.element || {})['element-data']; if (r == null) return null; if (typeof r === 'object') return r; try { return JSON.parse(r); } catch { return null; } };
const textOf = (d) => JSON.stringify(edOf(d)?.text ?? null);
const J = (v) => JSON.stringify(v);
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const leaves = (node) => {
  const o = [];
  const w = (x) => {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) return x.forEach(w);
    if (x.col) o.push({ col: norm(x.col), value: x.value ?? null, upf: !!x.usePageFilters, spk: x.searchParamKey ?? null, op: x.op ?? null });
    if (x.groups) x.groups.forEach(w);
  };
  w(node);
  return o;
};
// The same projection plan_snap.mjs compared on, so "already correct" here means
// exactly what "no deviation" means there.
const project = (setting, d) => {
  const e = edOf(d) || {};
  switch (setting) {
    case 'tags': return Array.isArray(d.tags) ? d.tags.join(',') : String(d.tags ?? '');
    case 'authPermissions': return String(d.authPermissions ?? '');
    case 'display.fetchMode': return String(e.display?.fetchMode ?? 'not set');
    case 'columns[]': return J((e.columns || []).map((x) => norm(x.name)));
    case 'filters (non-geoid)': return J(leaves(e.filters ?? e.dataRequest?.filterGroups).filter((x) => !/geoid/i.test(x.col)));
    default: throw new Error(`unknown setting: ${setting}`);
  }
};
// element-data keys each setting is allowed to move
const ALLOWED_ED = {
  'display.fetchMode': ['display'],
  'columns[]': ['columns'],
  'filters (non-geoid)': ['filters', 'dataRequest'],
};

console.log(`\nplanned: ${work.length} writes`);
const bySet = new Map(); work.forEach((r) => bySet.set(r.Setting, (bySet.get(r.Setting) || 0) + 1));
[...bySet.entries()].forEach(([k, v]) => console.log(`  ${String(v).padStart(4)}  ${k}`));
if (!APPLY) { console.log('\nDRY RUN - pass --apply to write.'); process.exit(0); }

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const baseline = {}, results = [], templateRows = {};
let skippedCount = 0;
for (const r of work) baseline[r['Target section ID']] ??= await readRow(r['Target section ID']);
fs.writeFileSync(path.join(outDir, `baseline_${stamp}.json`), JSON.stringify(baseline, null, 1));
console.log(`\nbaseline: ${Object.keys(baseline).length} rows -> baseline_${stamp}.json`);

for (const r of work) {
  const id = r['Target section ID'];
  // Re-read immediately before each write. The batch baseline is kept for
  // rollback, but it must NOT be the comparison point: a component receiving
  // two settings in one batch has already moved one leaf by the time the second
  // is written, and comparing to the batch baseline reports that as a failure.
  const before = await readRow(id);
  // The authoritative value is the TEMPLATE'S LIVE ROW, not the work list: the
  // work list truncates long values (a columns[] array of SQL expressions runs to
  // thousands of characters) and a truncated string can never compare equal.
  // The frozen value is still used as a DRIFT CHECK where it is not truncated.
  const tRow = templateRows[r['Template section ID']] ??= await readRow(r['Template section ID']);
  const tmplVal = project(r.Setting, tRow);
  const frozen = r['Template value'];
  if (frozen.length < 300 && frozen !== tmplVal) {
    results.push({ fix: r['Fix ID'], id, setting: r.Setting, ok: false, why: `TEMPLATE DRIFTED since the plan was frozen: plan=${J(frozen).slice(0, 60)} live=${J(tmplVal).slice(0, 60)}` });
    process.stdout.write(`  ${results.length}/${work.length} DRIFT\r`);
    continue;
  }
  let ok = false, why = '';
  // Already at the template's value - a re-run, or another row in this batch
  // touched it. Skip rather than write: a no-op write moves no leaf and would
  // fail the "exactly one leaf moved" assertion.
  const current = project(r.Setting, before);
  if (current === tmplVal) {
    results.push({ fix: r['Fix ID'], id, setting: r.Setting, ok: true, why: 'already correct - skipped' });
    skippedCount++;
    process.stdout.write(`  ${results.length}/${work.length} skip\r`);
    continue;
  }
  try {
    if (r.Where === 'row') {
      const key = r.Setting;                       // tags | authPermissions
      execFileSync(process.execPath, [DMS, 'raw', 'update', id, '--app', c.app, '--set', `${key}=${J(tmplVal)}`, '--format', 'json'],
        { encoding: 'utf8', env: process.env, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
    } else {
      // element-data: parse, set, re-serialise, write the whole data object
      const e = edOf(before) || {};
      let next;
      if (r.Setting === 'display.fetchMode') {
        next = { ...e, display: { ...(e.display || {}), fetchMode: tmplVal } };
      } else if (r.Setting === 'columns[]' || r.Setting === 'filters (non-geoid)') {
        // These carry structure the work list only summarises, so take them from
        // the TEMPLATE'S LIVE ROW. Read-only on the template.
        const te = edOf(await readRow(r['Template section ID'])) || {};
        if (r.Setting === 'columns[]') {
          next = { ...e, columns: te.columns ?? [] };
        } else {
          // Shape comes from the template - column, usePageFilters, searchParamKey,
          // operators, grouping. VALUES stay the duplicate's wherever it has a leaf
          // on the same column; the template's value is used only where the target
          // has none. That gives sibling shape parity without overwriting a geoid
          // the duplicate already has right.
          // Only GEOID values are the county's own. A non-geoid filter value -
          // a hazard name, a capability type - is template content and snaps with
          // the shape; carrying the target's value there would leave the sibling
          // filtering on different data while looking identical.
          const targetGeoid = new Map();
          const collect = (n) => {
            if (!n || typeof n !== 'object') return;
            if (Array.isArray(n)) return n.forEach(collect);
            if (n.col && /geoid/i.test(String(n.col)) && !targetGeoid.has(String(n.col))) targetGeoid.set(String(n.col), n.value);
            if (n.groups) n.groups.forEach(collect);
          };
          collect(e.filters ?? e.dataRequest?.filterGroups);
          const graft = (n) => {
            if (n == null || typeof n !== 'object') return n;
            if (Array.isArray(n)) return n.map(graft);
            const o = { ...n };
            if (o.groups) o.groups = o.groups.map(graft);
            if (o.col && targetGeoid.has(String(o.col))) o.value = targetGeoid.get(String(o.col));
            return o;
          };
          const merged = graft(te.filters ?? te.dataRequest?.filterGroups ?? null);
          // write into whichever key the TARGET uses - config shape is out of scope
          if (e.externalSource || e.filters !== undefined) next = { ...e, filters: merged };
          else next = { ...e, dataRequest: { ...(e.dataRequest || {}), filterGroups: merged } };
        }
      } else throw new Error(`unsupported element-data setting: ${r.Setting}`);
      const payload = { ...before, element: { ...before.element, 'element-data': JSON.stringify(next) } };
      const pf = path.join(outDir, `payload_${id}.json`);
      fs.writeFileSync(pf, JSON.stringify(payload));
      try {
        execFileSync(process.execPath, [DMS, 'raw', 'update', id, '--app', c.app, '--data', pf, '--format', 'json'],
          { encoding: 'utf8', env: process.env, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
      } finally { fs.unlinkSync(pf); }
    }
    // ---- verify -----------------------------------------------------------
    const after = await readRow(id);
    if (textOf(after) !== textOf(before)) { why = 'AUTHORED TEXT CHANGED'; }
    else {
      const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
      const moved = keys.filter((k) => J(before[k]) !== J(after[k]));
      if (r.Where === 'row') {
        ok = moved.length === 1 && moved[0] === r.Setting && String(after[r.Setting] ?? '') === tmplVal;
        why = ok ? '' : `moved=${moved.join(',')} value=${J(after[r.Setting])}`;
      } else {
        const eb = edOf(before) || {}, ea = edOf(after) || {};
        const ek = [...new Set([...Object.keys(eb), ...Object.keys(ea)])];
        const emoved = ek.filter((k) => J(eb[k]) !== J(ea[k]));
        const allowed = ALLOWED_ED[r.Setting] || [];
        const stray = emoved.filter((k) => !allowed.includes(k));
        const valueOk = project(r.Setting, after) === tmplVal;
        ok = moved.length === 1 && moved[0] === 'element' && !stray.length && valueOk;
        why = ok ? '' : `row=${moved.join(',')} ed=${emoved.join(',')}${stray.length ? ' STRAY=' + stray.join(',') : ''}${valueOk ? '' : ' value-mismatch'}`;
      }
    }
  } catch (e) { why = String(e.message || e).slice(0, 200); }
  results.push({ fix: r['Fix ID'], id, setting: r.Setting, ok, why });
  process.stdout.write(`  ${results.length}/${work.length} ${ok ? 'ok ' : 'FAIL'}\r`);
}
const bad = results.filter((x) => !x.ok);
console.log(`\n\nwritten ${results.length}, verified ${results.length - bad.length}, FAILED ${bad.length}`);
bad.forEach((x) => console.log(`  FAIL ${x.fix} ${x.id} ${x.setting}: ${x.why}`));
fs.writeFileSync(path.join(outDir, `result_${stamp}.json`), JSON.stringify({ results }, null, 1));
console.log(bad.length ? 'DONE WITH ERRORS' : 'DONE - every write verified');
