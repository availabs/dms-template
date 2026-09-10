/**
 * Tier C: pair the components tiers A and B could not.
 *
 * A template REBUILD mints fresh trackingIds (defeating tier A) and can also
 * shift draft order (defeating tier B). The duplicate is then left holding the
 * previous generation of a component with no link to its replacement, so the
 * snap skips it and the reorder treats it as local — which is how a rebuilt
 * hazard hero card ended up rendering above the Overview card it should sit
 * under.
 *
 * Tier C matches the leftovers on the same page by ELEMENT TYPE + SOURCE, taken
 * in draft order. It is a weaker inference than A or B: on a page holding
 * several cards from one source it pairs by sequence alone. Print the pairs and
 * have them reviewed before writing from them.
 *
 * usage:
 *   node pair_leftovers.mjs <groups.json> <out.json> <tmpl-sub> <target-sub> [--slug <slug>]...
 */
import fs from 'fs';

const argv = process.argv.slice(2);
const [groupsFile, outFile, T, S] = argv;
if (!S) throw new Error('usage: node pair_leftovers.mjs <groups.json> <out.json> <tmpl-sub> <target-sub> [--slug s]...');
const onlySlugs = argv.reduce((a, x, i) => (x === '--slug' ? [...a, argv[i + 1]] : a), []);

const doc = JSON.parse(fs.readFileSync(groupsFile, 'utf8'));
const groups = doc.groups;
const tIdx = new Map(); const sIdx = new Map();
groups.forEach((g, i) => {
  if (g.members[T] && !g.members[S]) { const k = g.members[T].slug; if (!tIdx.has(k)) tIdx.set(k, []); tIdx.get(k).push(i); }
  if (!g.members[T] && g.members[S]) { const k = g.members[S].slug; if (!sIdx.has(k)) sIdx.set(k, []); sIdx.get(k).push(i); }
});

const key = (m) => `${m.et}|${m.sourceName || ''}`;
const merged = []; const drop = new Set();
for (const [slug, tIs] of tIdx) {
  if (onlySlugs.length && !onlySlugs.includes(slug)) continue;
  const sIs = sIdx.get(slug) || [];
  const ts = tIs.map((i) => ({ i, m: groups[i].members[T] })).sort((a, b) => a.m.order - b.m.order);
  const pool = new Map();
  sIs.map((i) => ({ i, m: groups[i].members[S] })).sort((a, b) => a.m.order - b.m.order)
    .forEach((x) => { const k = key(x.m); if (!pool.has(k)) pool.set(k, []); pool.get(k).push(x); });
  for (const t of ts) {
    const p = pool.get(key(t.m));
    if (!p || !p.length) continue;
    const s = p.shift();
    merged.push({ slug, t: t.m, s: s.m, ti: t.i, si: s.i });
    drop.add(s.i);
  }
}

console.log(`tier C: ${merged.length} leftover pairs\n`);
let cur = '';
for (const p of merged) {
  if (p.slug !== cur) { cur = p.slug; console.log(`  ${cur}`); }
  console.log(`     ${p.t.id} -> ${p.s.id}  ${String(p.t.et).padEnd(9)} ${String(p.t.sourceName || '-').slice(0, 24).padEnd(25)} ord ${String(p.t.order).padStart(3)}/${String(p.s.order).padStart(3)}  "${String(p.s.title || p.t.title || '(untitled)').slice(0, 22)}"`);
}

// fold the duplicate's member into the template's group, drop the orphan group
for (const p of merged) groups[p.ti].members[S] = p.s;
for (const p of merged) groups[p.ti].tier = 'C';
doc.groups = groups.filter((g, i) => !drop.has(i));
fs.writeFileSync(outFile, JSON.stringify(doc));
console.log(`\nwrote ${outFile}: ${doc.groups.length} groups (${groups.length - doc.groups.length} orphan groups folded in)`);
