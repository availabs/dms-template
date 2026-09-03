/**
 * Group the draft sections of N patterns into LOGICAL COMPONENTS.
 *
 * Input: one `scan_pattern.mjs --settings --sub <name>` file per pattern, the
 * TEMPLATE FIRST. Output: one record per logical component with its members
 * keyed by subdomain, plus the tier that matched it.
 *
 * Two tiers, after the ladder in
 * propagating-county-template-changes-to-duplicates.md:
 *
 *   A  trackingId + page url_slug, rank-aligned by draft order.
 *      Used only when the bucket holds the SAME number of components in every
 *      pattern AND is present in all of them. Either condition failing means
 *      rank-alignment would mis-pair or hide a sibling, so the bucket defers.
 *
 *   B  page url_slug + draft order + element type, guarded on source.
 *      Catches a component the TEMPLATE REBUILT: a rebuild mints a fresh
 *      trackingId, so the template's new id no longer matches the duplicates'
 *      old one and tier A splits one slot into template-only + duplicate-only.
 *      Title is deliberately NOT part of the guard - the template renames slots,
 *      and a title difference is reported as a deviation in its own right.
 *
 * Tier B is an inference. It is labelled so it stays reviewable, and callers
 * must not write from a tier B row unattended.
 *
 * usage:
 *   node pair_patterns.mjs <out.json> <template-scan.json> <dup-scan.json> [...]
 */
import fs from 'fs';

const argv = process.argv.slice(2);
const outFile = argv.shift();
if (!outFile || argv.length < 2) {
  throw new Error('usage: node pair_patterns.mjs <out.json> <template-scan.json> <dup-scan.json> [...]');
}

const patterns = argv.map((file) => {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const sub = j.subdomain || `pattern_${j.patternId}`;
  const rows = [];
  for (const [slug, page] of Object.entries(j.pages || {})) {
    (page.sections || []).forEach((s) => rows.push({
      ...s, sub, patternId: String(j.patternId), slug, pageId: page.pageId, order: s.i,
    }));
  }
  return { sub, patternId: String(j.patternId), rows };
});
const ORDER = patterns.map((p) => p.sub);
const TEMPLATE = ORDER[0];
console.log(`patterns: ${ORDER.join(', ')}   (template = ${TEMPLATE})`);
patterns.forEach((p) => console.log(`  ${p.sub.padEnd(24)} ${p.rows.length} draft sections`));

// ---- tier A ---------------------------------------------------------------
const bkey = (r) => `${r.trk ?? 'NOTRK:' + r.id}|${r.slug}`;
const B = {};
for (const p of patterns) {
  const m = new Map();
  p.rows.forEach((r) => { const k = bkey(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); });
  for (const v of m.values()) v.sort((a, b) => a.order - b.order);
  B[p.sub] = m;
}
const groups = [];
const claimed = new Set();
let deferred = 0;
for (const k of new Set(ORDER.flatMap((s) => [...B[s].keys()]))) {
  const depths = ORDER.map((s) => (B[s].get(k) || []).length);
  const nz = depths.filter((d) => d > 0);
  if (new Set(nz).size > 1 || depths.some((d) => d === 0)) { deferred++; continue; }
  for (let i = 0; i < depths[0]; i++) {
    const members = {};
    for (const s of ORDER) { const r = (B[s].get(k) || [])[i]; if (r) { members[s] = r; claimed.add(`${s}:${r.id}`); } }
    groups.push({ key: k + (depths[0] > 1 ? `#${i}` : ''), tier: 'A', members });
  }
}
console.log(`\ntier A groups: ${groups.length}   buckets deferred: ${deferred}`);

// ---- tier B ---------------------------------------------------------------
const left = patterns.flatMap((p) => p.rows).filter((r) => !claimed.has(`${r.sub}:${r.id}`));
const pos = new Map();
left.forEach((r) => { const k = `${r.slug}#${r.order}|${r.et}`; if (!pos.has(k)) pos.set(k, {}); pos.get(k)[r.sub] = r; });
let tierB = 0, rebuilds = 0, refused = 0, singles = 0;
for (const [k, members] of pos) {
  const subs = Object.keys(members);
  if (subs.length > 1) {
    const recs = subs.map((s) => members[s]);
    if (new Set(recs.map((r) => r.sourceName ?? '')).size === 1) {
      groups.push({ key: k, tier: 'B', members });
      tierB++;
      if (new Set(recs.map((r) => r.trk)).size > 1) rebuilds++;
      continue;
    }
    refused++;
    for (const s of subs) { groups.push({ key: `${k}|${s}`, tier: 'unmatched', members: { [s]: members[s] } }); singles++; }
    continue;
  }
  groups.push({ key: k, tier: 'unmatched', members });
  singles++;
}
console.log(`tier B groups: ${tierB}   (${rebuilds} bridge differing trackingIds - template rebuilds)`);
console.log(`  refused, source mismatch at the same position: ${refused}`);
console.log(`  single-pattern rows                          : ${singles}`);

const cover = new Map();
groups.forEach((g) => { const n = ORDER.filter((s) => g.members[s]).length; cover.set(n, (cover.get(n) || 0) + 1); });
console.log(`\ntotal logical components: ${groups.length}`);
[...cover.entries()].sort((a, b) => b[0] - a[0]).forEach(([n, c]) => console.log(`  present in ${n} pattern(s): ${c}`));

fs.writeFileSync(outFile, JSON.stringify({ order: ORDER, template: TEMPLATE, groups }));
console.log(`\nwrote ${outFile}`);
