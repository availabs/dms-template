/**
 * Plan a Snap to County Template run for ONE duplicate. READ ONLY.
 *
 * The catalogue collapses across every scanned pattern, so a DEVIATION there may
 * belong to a different county. A snap run must compare the target against the
 * template PAIRWISE, which is what this does.
 *
 * Emits the frozen work list the apply step consumes, one row per (component,
 * setting) so each write is independently reviewable, baselined and reversible.
 *
 * usage:
 *   node plan_snap.mjs <groups.json> <target-subdomain> <out.csv>
 */
import fs from 'fs';

const [groupsFile, target, outFile] = process.argv.slice(2);
if (!groupsFile || !target || !outFile) {
  throw new Error('usage: node plan_snap.mjs <groups.json> <target-subdomain> <out.csv>');
}
const { template: TEMPLATE, groups } = JSON.parse(fs.readFileSync(groupsFile, 'utf8'));
if (target === TEMPLATE) throw new Error(`refusing: ${target} is the template. The template is never written to.`);
const J = (v) => JSON.stringify(v);
const tagsOf = (m) => (Array.isArray(m.tags) ? m.tags.join(',') : String(m.tags ?? ''));
const geoid = (f) => (f || []).filter((x) => /geoid/i.test(x.col));
const other = (f) => (f || []).filter((x) => !/geoid/i.test(x.col));

// Settings that snap, in the order the run applies them: proven single-leaf
// writes first, structural ones last.
const SETTINGS = [
  { key: 'tags', where: 'row', get: tagsOf },
  { key: 'authPermissions', where: 'row', get: (m) => String(m.perms ?? '') },
  { key: 'display.fetchMode', where: 'element-data', get: (m) => (m.fetchMode ?? 'not set') },
  { key: 'columns[]', where: 'element-data', get: (m) => J(m.cols || []), structural: true },
  { key: 'filters (non-geoid)', where: 'element-data', get: (m) => J(other(m.filters)), structural: true },
];

const rows = [];
const skipped = { notPaired: 0, tierUnmatched: 0, noDeviation: 0 };
for (const g of groups) {
  const t = g.members[TEMPLATE];
  const d = g.members[target];
  if (!t || !d) { skipped.notPaired++; continue; }          // exempt: not in both
  if (g.tier === 'unmatched') { skipped.tierUnmatched++; continue; }

  let any = false;
  for (const s of SETTINGS) {
    const tv = s.get(t), dv = s.get(d);
    if (J(tv) === J(dv)) continue;
    any = true;
    rows.push({
      'Fix ID': '',
      Page: t.slug,
      'Section title': t.title || '(untitled)',
      'Component kind': t.et ?? '',
      'Template section ID': t.id,
      'Target section ID': d.id,
      'Target link': `https://${target}.devmny.org/edit/${d.slug}#${d.id}`,
      Setting: s.key,
      Where: s.where,
      'Template value': String(tv).slice(0, 300),
      'Target value': String(dv).slice(0, 300),
      'Match tier': g.tier,
      Structural: s.structural ? 'yes' : '',
      'Geoid leaves on target (PRESERVE)': geoid(d.filters).map((x) => `${x.col}=${Array.isArray(x.value) ? x.value.join('/') : x.value}`).join(' ; '),
      'Authored text on target (NEVER WRITE)': (d.authoredText || '').slice(0, 120),
      Status: '', Notes: '',
    });
  }
  if (!any) skipped.noDeviation++;
}

// Fix ids are positional within the frozen list and never renumbered mid-run.
rows.sort((a, b) => String(a.Page).localeCompare(String(b.Page))
  || String(a['Target section ID']).localeCompare(String(b['Target section ID']))
  || SETTINGS.findIndex((s) => s.key === a.Setting) - SETTINGS.findIndex((s) => s.key === b.Setting));
rows.forEach((r, i) => { r['Fix ID'] = `SNAP-${String(i + 1).padStart(4, '0')}`; });

const HDR = Object.keys(rows[0] || { 'Fix ID': '' });
const ascii = (s) => String(s ?? '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/[–—]/g, '-').replace(/…/g, '...').replace(/[^\x20-\x7E]/g, '');
const cell = (v) => { const s = ascii(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
fs.writeFileSync(outFile, `﻿${[HDR.map(cell).join(','), ...rows.map((r) => HDR.map((h) => cell(r[h])).join(','))].join('\r\n')}\r\n`, 'utf8');

console.log(`target: ${target}   template: ${TEMPLATE}`);
console.log(`wrote ${outFile}   ${rows.length} planned writes over ${new Set(rows.map((r) => r['Target section ID'])).size} components\n`);
const by = (k) => { const m = new Map(); rows.forEach((r) => m.set(r[k], (m.get(r[k]) || 0) + 1)); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
console.log('by setting:'); by('Setting').forEach(([k, v]) => console.log(`  ${String(v).padStart(5)}  ${k}`));
console.log('\nby match tier:'); by('Match tier').forEach(([k, v]) => console.log(`  ${String(v).padStart(5)}  tier ${k}`));
console.log('\ntop pages:'); by('Page').slice(0, 10).forEach(([k, v]) => console.log(`  ${String(v).padStart(5)}  ${k}`));
console.log('\nrows whose target carries authored text (write must not touch it): '
  + rows.filter((r) => r['Authored text on target (NEVER WRITE)']).length);
console.log('rows whose target carries geoid leaves (preserve on any filter write): '
  + rows.filter((r) => r['Geoid leaves on target (PRESERVE)']).length);
console.log(`\nskipped - not in both patterns: ${skipped.notPaired}, tier unmatched: ${skipped.tierUnmatched}, no deviation: ${skipped.noDeviation}`);
