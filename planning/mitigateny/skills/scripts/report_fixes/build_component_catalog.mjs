/**
 * Build pattern-component-catalog.csv from a `pair_patterns.mjs` grouping.
 *
 * One row per logical component. Scales to N patterns:
 *   - `Section ID (<sub>)` and `Link (<sub>)` per pattern
 *   - every comparable setting is ONE column, holding the shared value when all
 *     patterns that have the component agree, or the literal DEVIATION when not
 *   - `Domain` = all when every pattern has it, else the ones that do
 *
 * Deliberate exclusions, per template-and-duplicate-patterns.md:
 *   - authored text is NEVER a deviation (a county filling its own slot is the
 *     system working); it is reported via County-authored / Authored text status
 *   - dataset text is data, not config, and its cache goes stale; reported only
 *
 * usage:
 *   node build_component_catalog.mjs <groups.json> <out.csv> [--host <h>]
 * Needs DMS_HOST / DMS_APP / DMS_AUTH_TOKEN for the live source lookup that
 * powers Meta freshness; pass --no-live to skip it.
 */
import fs from 'fs';
import { config, client } from './fix_lib.mjs';
import { fetchByIds, parseData } from '../../../../../src/dms/packages/dms/cli/src/utils/data.js';

const argv = process.argv.slice(2);
const groupsFile = argv.shift();
const outFile = argv.shift();
const noLive = argv.includes('--no-live');
if (!groupsFile || !outFile) throw new Error('usage: node build_component_catalog.mjs <groups.json> <out.csv> [--no-live]');

const { order: SUBS, template: TEMPLATE, groups } = JSON.parse(fs.readFileSync(groupsFile, 'utf8'));
const J = (v) => JSON.stringify(v);
const DEV = 'DEVIATION';

// ---- live source column counts (Meta freshness) ---------------------------
const live = {};
if (!noLive) {
  const ids = [...new Set(groups.flatMap((g) => Object.values(g.members).map((m) => m.sourceId)).filter(Boolean))]
    .filter((x) => /^\d+$/.test(String(x)));
  const c = config();
  const falcor = client(c);
  for (let i = 0; i < ids.length; i += 20) {
    let rows = [];
    try { rows = await fetchByIds(falcor, c.app, ids.slice(i, i + 20), ['id', 'data']); } catch { rows = []; }
    for (const r of rows) {
      const d = parseData(r.data) || {};
      let cfg = d.config, n = 0;
      while (typeof cfg === 'string' && n++ < 5) { try { cfg = JSON.parse(cfg); } catch { cfg = null; } }
      let a = cfg?.attributes; n = 0;
      while (typeof a === 'string' && n++ < 5) { try { a = JSON.parse(a); } catch { a = null; } }
      if (Array.isArray(a)) live[String(r.id)] = a.length;
    }
  }
  console.log(`live sources resolved: ${Object.keys(live).length} of ${ids.length}`);
}

const geoidF = (f) => (f || []).filter((x) => /geoid/i.test(x.col));
const otherF = (f) => (f || []).filter((x) => !/geoid/i.test(x.col));
const fmtF = (f) => (f || []).map((x) => `${x.col}${x.upf ? '[page:' + (x.spk ?? '') + ']' : ''}=${Array.isArray(x.value) ? x.value.join('/') : J(x.value)}`).join(' ; ');
const fresh = (m) => {
  if (!m || !m.sourceId) return '';
  const n = live[String(m.sourceId)];
  if (n === undefined) return 'unknown source';
  if (!m.snapshotCols) return 'no snapshot';
  return m.snapshotCols === n ? 'current' : `behind (${m.snapshotCols} of ${n})`;
};
const collapse = (present, fn) => {
  const vals = present.map(fn);
  if (!vals.length) return '';
  const first = J(vals[0]);
  return vals.every((v) => J(v) === first) ? String(vals[0] ?? '') : DEV;
};
const differs = (present, fn) => {
  if (present.length < 2) return false;
  const first = J(fn(present[0]));
  return present.some((p) => J(fn(p)) !== first);
};
const tagsOf = (m) => (Array.isArray(m.tags) ? m.tags.join(',') : String(m.tags ?? ''));

const rows = [];
for (const g of groups) {
  const bySub = g.members;
  const present = SUBS.filter((s) => bySub[s]).map((s) => bySub[s]);
  if (!present.length) continue;
  const tmpl = bySub[TEMPLATE];
  const ref = tmpl || present[0];
  const domain = present.length === SUBS.length ? 'all' : SUBS.filter((s) => bySub[s]).join(' + ');

  // county-specific text, the owner's two types
  const dups = present.filter((x) => x !== tmpl);
  const authored = present.map((x) => x.authoredText ?? '');
  let authoredStatus = '', textType = '';
  if (present.length < 2) authoredStatus = ref.authoredText ? 'present' : 'none';
  else if (authored.every((t) => t === authored[0])) authoredStatus = authored[0] ? 'same' : 'none';
  else if (tmpl && !tmpl.authoredText && dups.some((d) => d.authoredText)) {
    authoredStatus = 'template blank, duplicate filled';
    textType = 'type 1 - authored county narrative';
  } else if (tmpl && tmpl.authoredText && dups.some((d) => !d.authoredText)) authoredStatus = 'duplicate blank, template has text';
  else authoredStatus = 'differs';
  const dsDiff = differs(present, (x) => x.datasetText ?? '');

  // A county authoring slot. The TEMPLATE defines it, so judge from the template.
  //   type 1  a TITLED lexical the template ships EMPTY. Untitled empties are
  //           contentless shells; a lexical the template fills is boilerplate.
  //   type 2  a card bound to Jurisdictions - the county's OWN dataset - with a
  //           prose column. Structural, never cache-derived: element-data.data
  //           goes stale. LHMP_IA is excluded: that is STATE narrative,
  //           permission-locked against county editing.
  const TEXTCOL = /(^|_)description$|narrative|summary/i;
  const slot = tmpl || ref;
  const isType1 = slot.et === 'lexical' && !slot.authoredText && !!String(slot.title ?? '').trim();
  const isType2 = String(slot.sourceName) === 'Jurisdictions' && (slot.cols || []).some((c) => TEXTCOL.test(c));
  if (isType2) textType = textType ? `${textType}; type 2 - dataset-backed` : 'type 2 - dataset-backed';

  const dev = [];
  if (present.length > 1) {
    if (differs(present, (x) => geoidF(x.filters))) dev.push('geoid filter');
    if (differs(present, (x) => otherF(x.filters))) dev.push('non-geoid filter');
    if (differs(present, (x) => x.fetchMode ?? null)) dev.push('fetch mode');
    if (differs(present, tagsOf)) dev.push('tags');
    if (differs(present, (x) => x.snapshotCols)) dev.push('snapshot generation');
    if (differs(present, (x) => x.cols)) dev.push('column set');
    if (differs(present, (x) => x.shape ?? '')) dev.push('config shape');
    if (differs(present, (x) => !!x.perms)) dev.push('permissions');
    // authored text is NOT a deviation - see the header note
    if (differs(present, (x) => x.title ?? '')) dev.push('title');
    if (differs(present, (x) => x.hideInView)) dev.push('hidden-from-view');
  }
  const EXPECTED = new Set(['geoid filter', 'title']);
  const LAG = new Set(['fetch mode', 'tags', 'permissions', 'column set', 'snapshot generation', 'config shape']);
  let verdict;
  if (present.length < SUBS.length) verdict = 'not in every pattern';
  else if (!dev.length) verdict = 'identical';
  else if (dev.every((x) => EXPECTED.has(x))) verdict = 'expected - localisation';
  else if (dev.some((x) => LAG.has(x))) verdict = 'lag - propagate from template';
  else verdict = 'review';

  const row = {
    'Logical key': g.key,
    Domain: domain,
    Page: ref.slug,
    'Page URL': `/edit/${ref.slug}`,
    'Section title': ref.title || '(untitled)',
    'Component kind': ref.et ?? '',
    'Hidden from view': ref.hideInView ? 'yes' : 'no',
  };
  for (const sub of SUBS) {
    const m = bySub[sub];
    row[`Section ID (${sub})`] = m?.id ?? '';
    row[`Link (${sub})`] = m ? `https://${sub}.devmny.org/edit/${m.slug}#${m.id}` : '';
  }
  Object.assign(row, {
    trackingId: ref.trk ?? '',
    Source: collapse(present, (x) => x.sourceName || (x.sourceId ? `src ${x.sourceId}` : '')),
    'Config shape': collapse(present, (x) => x.shape ?? ''),
    'Data fetch mode': collapse(present, (x) => x.fetchMode ?? 'not set'),
    Tags: collapse(present, tagsOf),
    'Geoid filters': collapse(present, (x) => fmtF(geoidF(x.filters))),
    'Other filters': collapse(present, (x) => fmtF(otherF(x.filters))),
    'Meta freshness': collapse(present, fresh),
    'County-authored': (isType1 || isType2) ? 'TRUE' : 'FALSE',
    'County-specific text type': textType,
    'Authored text status': authoredStatus,
    'Dataset text differs': present.length > 1 ? (dsDiff ? 'yes - data, not config' : 'no') : '',
    'Match tier': g.tier === 'A' ? 'A - trackingId + page'
      : g.tier === 'B' ? 'B - position + kind + source' : 'unmatched - one pattern only',
    'Deviation count': present.length > 1 ? dev.length : '',
    'Deviations across patterns': dev.join('; '),
    Verdict: verdict,
    Status: '', 'Assigned to': '', Notes: '',
  });
  rows.push(row);
}

rows.sort((a, b) => String(a.Page).localeCompare(String(b.Page)) || String(a['Section title']).localeCompare(String(b['Section title'])));
const HDR = Object.keys(rows[0]);
const ascii = (s) => String(s ?? '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/[–—]/g, '-').replace(/…/g, '...').replace(/ /g, ' ').replace(/[^\x20-\x7E]/g, '');
const cell = (v) => { const s = ascii(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
fs.writeFileSync(outFile, `﻿${[HDR.map(cell).join(','), ...rows.map((r) => HDR.map((h) => cell(r[h])).join(','))].join('\r\n')}\r\n`, 'utf8');

console.log(`wrote ${outFile}  ${rows.length} rows x ${HDR.length} columns`);
const t = (k) => { const m = new Map(); rows.forEach((r) => m.set(r[k] || '(blank)', (m.get(r[k] || '(blank)') || 0) + 1)); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
for (const col of ['Domain', 'Match tier', 'Verdict']) {
  console.log(`\n${col}:`);
  t(col).forEach(([k, v]) => console.log(`  ${String(v).padStart(5)}  ${k}`));
}
