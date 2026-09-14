/**
 * Verify a wide snap across every shared page. READ ONLY.
 *
 * Four assertions, after snap-to-county-template.md section 8:
 *   1. no paired component still deviates on a snapped setting
 *   2. the duplicate's section order is monotonic in the template's rank
 *   3. authored text and cached dataset rows are byte-identical to the baselines
 *   4. metadata-out-of-date drift is no worse than the template's
 *
 * Settings are compared KEY BY KEY. Comparing `display` objects whole with
 * JSON.stringify is order-sensitive and reports identical settings as
 * deviations - that mistake produced 31 phantom findings on flooding.
 *
 * usage:
 *   node verify_wide.mjs <groups.json> <tmpl-sub> <target-sub> <baseline-root>
 */
import fs from 'fs';
import path from 'path';
import { config, client, refIds } from './fix_lib.mjs';
import { fetchById, fetchByIds, parseData } from '../../../../../src/dms/packages/dms/cli/src/utils/data.js';

const [groupsFile, TSUB, SSUB, baseRoot] = process.argv.slice(2);
if (!baseRoot) throw new Error('usage: node verify_wide.mjs <groups.json> <tmpl-sub> <target-sub> <baseline-root>');
const J = JSON.stringify;
const nz = (v) => (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length) ? null : v);
const N = (v) => J(nz(v));
const edOf = (d) => {
  const r = ((d || {}).element || {})['element-data'];
  if (r == null) return {};
  if (typeof r === 'object') return r;
  try { return JSON.parse(r); } catch { return {}; }
};
const SYNC = ['type', 'required', 'display', 'defaultFn', 'dataType', 'trueValue', 'options', 'mapped_options', 'meta_lookup'];
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const drift = (e) => {
  const snap = (e.sourceInfo || e.externalSource || {}).columns || [];
  return (e.columns || []).filter((col) => {
    const s = snap.find((x) => norm(x.name) === norm(col.name));
    return !s || SYNC.some((k) => J(col[k] ?? null) !== J(s[k] ?? null));
  }).length;
};
// per-instance fetch bookkeeping, preserved by design - not a deviation
const SKIP_ED = new Set(['text', 'data', 'totalLength', 'lastDataRequest']);
const SKIP_DISPLAY = new Set(['totalLength', 'loadMoreId']);

const c = config();
const falcor = client(c);
const read = async (id) => parseData((await fetchById(falcor, c.app, String(id), ['id', 'data'])).data) || {};

const { groups } = JSON.parse(fs.readFileSync(groupsFile, 'utf8'));
const pairs = groups.filter((g) => g.members[TSUB] && g.members[SSUB])
  .map((g) => ({ t: g.members[TSUB], s: g.members[SSUB] }));
const ids = pairs.flatMap((p) => [p.t.id, p.s.id]);
const rows = new Map();
for (let i = 0; i < ids.length; i += 60) {
  for (const s of await fetchByIds(falcor, c.app, ids.slice(i, i + 60), ['id', 'data'])) rows.set(String(s.id), parseData(s.data) || {});
}

const ROW = ['title', 'level', 'tags', 'size', 'border', 'offset', 'rowspan', 'group', 'hideInView'];
const stripGeoid = (e) => {
  const o = JSON.parse(J(e));
  const w = (x) => {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) { x.forEach(w); return; }
    if (x.col && /geoid/i.test(String(x.col))) x.value = '<geoid>';
    if (x.groups) x.groups.forEach(w);
  };
  w(o.filters ?? o.dataRequest?.filterGroups);
  return o;
};
const tally = new Map();
let devComponents = 0;
for (const p of pairs) {
  const t = rows.get(p.t.id); const s = rows.get(p.s.id);
  if (!t || !s) continue;
  const hits = ROW.filter((k) => N(t[k]) !== N(s[k]));
  const a = stripGeoid(edOf(t)); const b = stripGeoid(edOf(s));
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (SKIP_ED.has(k)) continue;
    if (k === 'display') {
      const da = a.display || {}; const db = b.display || {};
      for (const dk of new Set([...Object.keys(da), ...Object.keys(db)])) {
        if (SKIP_DISPLAY.has(dk)) continue;
        if (N(da[dk]) !== N(db[dk])) hits.push(`display.${dk}`);
      }
    } else if (N(a[k]) !== N(b[k])) hits.push(k);
  }
  if (!hits.length) continue;
  devComponents++;
  hits.forEach((h) => tally.set(h, (tally.get(h) || 0) + 1));
}
console.log(`paired components: ${pairs.length}`);
console.log(`still deviating  : ${devComponents}`);
if (tally.size) [...tally.entries()].sort((x, y) => y[1] - x[1]).forEach(([k, n]) => console.log(`    ${k.padEnd(28)} ${n}`));

// order
const byPage = new Map();
pairs.forEach((p) => { if (!byPage.has(p.s.pageId)) byPage.set(p.s.pageId, []); byPage.get(p.s.pageId).push(p); });
let badOrder = 0;
for (const [pageId, ps] of byPage) {
  const cur = refIds((await read(pageId)).draft_sections);
  const rank = new Map(ps.map((p) => [String(p.s.id), p.t.order]));
  const seq = cur.filter((id) => rank.has(id)).map((id) => rank.get(id));
  if (!seq.every((v, i) => i === 0 || v >= seq[i - 1])) { badOrder++; console.log(`   ORDER NOT MONOTONE on page ${pageId} (${ps[0].t.slug})`); }
}
console.log(`\npages checked for order: ${byPage.size}; not monotonic in template rank: ${badOrder}`);

// preserved values, against every baseline written by the run
let n = 0; let tMoved = 0; let dMoved = 0;
const walk = (dir) => {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) { walk(full); continue; }
    if (!/^baseline_\d+\.json$/.test(f.name)) continue;
    const id = f.name.slice(9, -5);
    const after = rows.get(id);
    if (!after) continue;
    const before = edOf(JSON.parse(fs.readFileSync(full, 'utf8')));
    const aE = edOf(after);
    n++;
    if (J(before.text ?? null) !== J(aE.text ?? null)) { tMoved++; console.log(`   AUTHORED TEXT MOVED ${id}`); }
    if (J(before.data ?? null) !== J(aE.data ?? null)) { dMoved++; console.log(`   CACHED DATA MOVED ${id}`); }
  }
};
walk(baseRoot);
console.log(`\nbaselines checked: ${n}; authored text moved: ${tMoved}; cached data moved: ${dMoved}`);

// badges
const dS = pairs.filter((p) => rows.get(p.s.id)).map((p) => drift(edOf(rows.get(p.s.id))));
const dT = pairs.filter((p) => rows.get(p.t.id)).map((p) => drift(edOf(rows.get(p.t.id))));
const sum = (a) => a.reduce((x, y) => x + y, 0);
console.log(`\nmetadata-out-of-date  target: ${dS.filter(Boolean).length} components / ${sum(dS)} columns`);
console.log(`                    template: ${dT.filter(Boolean).length} components / ${sum(dT)} columns`);
const worse = pairs.filter((p) => rows.get(p.s.id) && rows.get(p.t.id) && drift(edOf(rows.get(p.s.id))) > drift(edOf(rows.get(p.t.id))));
console.log(`components drifting MORE than their template sibling: ${worse.length}`);
worse.slice(0, 10).forEach((p) => console.log(`   ${p.s.id} ${p.t.slug}`));

const pass = devComponents === 0 && badOrder === 0 && tMoved === 0 && dMoved === 0 && worse.length === 0;
console.log(`\n${pass ? 'VERIFIED' : 'ATTENTION NEEDED'}`);
