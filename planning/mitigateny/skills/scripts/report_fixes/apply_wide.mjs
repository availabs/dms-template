/**
 * Wide snap: bring every setting of a duplicate's components to the template's,
 * then reposition them, for ONE page. Dry run unless --apply.
 *
 * This is the deny-list model of snap-to-county-template.md section 2: the
 * template's row is taken wholesale and only the county's own property is
 * carried back over it.
 *
 * Preserved from the target, always:
 *   data.id / data.parent / data.trackingId       identity and page ownership
 *   element-data.text                             AUTHORED TEXT - never altered
 *   element-data.data                             cached dataset rows
 *   element-data.display.totalLength|loadMoreId   per-instance fetch bookkeeping
 *   geoid filter VALUES                           section 3 - structure snaps, value stays
 *
 * Assertions after every write: authored text byte-identical, cached data
 * byte-identical, no geoid value the target already held moved, page ownership
 * unchanged.
 *
 * usage:
 *   node apply_wide.mjs <groups.json> <tmpl-sub> <target-sub> <page-slug> <out-dir>
 *                        [--apply] [--no-reorder]
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { config, client, refIds } from './fix_lib.mjs';
import { fetchById, parseData } from '../../../../../src/dms/packages/dms/cli/src/utils/data.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DMS = path.resolve(HERE, '../../../../../src/dms/packages/dms/cli/bin/dms.js');
const argv = process.argv.slice(2);
const [groupsFile, TSUB, SSUB, SLUG, outDir] = argv;
const APPLY = argv.includes('--apply');
const NO_REORDER = argv.includes('--no-reorder');
if (!outDir) throw new Error('usage: node apply_wide.mjs <groups.json> <tmpl-sub> <target-sub> <slug> <out-dir> [--apply]');
fs.mkdirSync(outDir, { recursive: true });

const J = JSON.stringify;
const c = config();
const falcor = client(c);
const readRow = async (id) => parseData((await fetchById(falcor, c.app, String(id), ['id', 'data'])).data) || {};
const edOf = (d) => {
  const r = ((d || {}).element || {})['element-data'];
  if (r == null) return { ed: {}, wasString: false };
  if (typeof r === 'string') { try { return { ed: JSON.parse(r), wasString: true }; } catch { return { ed: {}, wasString: true }; } }
  return { ed: r, wasString: false };
};
// null / undefined / "" / [] all mean "unset"; false and 0 are real values
const nz = (v) => (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length) ? null : v);
const same = (a, b) => J(nz(a)) === J(nz(b));

const { groups } = JSON.parse(fs.readFileSync(groupsFile, 'utf8'));
const templateIds = new Set(groups.map((g) => g.members[TSUB]?.id).filter(Boolean));

const pairs = groups
  .filter((g) => g.members[TSUB] && g.members[SSUB] && g.members[TSUB].slug === SLUG)
  .map((g) => ({ t: g.members[TSUB], s: g.members[SSUB], tier: g.tier }))
  .sort((a, b) => a.t.order - b.t.order);
if (!pairs.length) throw new Error(`no pairs on page ${SLUG}`);
if (pairs.some((p) => templateIds.has(p.s.id))) throw new Error('ABORT: a target id belongs to the template pattern');

const geoidMap = (ed) => {
  const m = new Map();
  const walk = (x) => {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) { x.forEach(walk); return; }
    if (x.col && /geoid/i.test(String(x.col))) m.set(String(x.col), x.value);
    if (x.groups) x.groups.forEach(walk);
  };
  walk(ed.filters ?? ed.dataRequest?.filterGroups);
  return m;
};
const graftGeoid = (node, m, invented) => {
  const walk = (x) => {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) { x.forEach(walk); return; }
    if (x.col && /geoid/i.test(String(x.col))) {
      if (m.has(String(x.col))) x.value = m.get(String(x.col));
      else invented.push(`${x.col}=${J(x.value)}`);
    }
    if (x.groups) x.groups.forEach(walk);
  };
  walk(node);
};

const CARRY = ['id', 'parent', 'trackingId'];
const build = (tRow, sRow) => {
  const next = JSON.parse(J(tRow));
  for (const k of CARRY) {
    if (sRow[k] !== undefined) next[k] = sRow[k];
    else delete next[k];
  }
  const { ed: tEd } = edOf(tRow);
  const { ed: sEd, wasString } = edOf(sRow);
  const nEd = JSON.parse(J(tEd));
  if (sEd.text !== undefined) nEd.text = sEd.text; else delete nEd.text;
  if (sEd.data !== undefined) nEd.data = sEd.data; else delete nEd.data;
  nEd.display = { ...(nEd.display || {}) };
  for (const k of ['totalLength', 'loadMoreId']) {
    if (sEd.display && sEd.display[k] !== undefined) nEd.display[k] = sEd.display[k];
    else delete nEd.display[k];
  }
  const invented = [];
  graftGeoid(nEd.filters ?? nEd.dataRequest?.filterGroups, geoidMap(sEd), invented);
  next.element = { ...(tRow.element || {}) };
  next.element['element-data'] = wasString ? J(nEd) : nEd;
  const dropped = Object.keys(sEd).filter((k) => !(k in nEd));
  return { next, nEd, sEd, invented, dropped };
};

const ROWKEYS = ['title', 'level', 'tags', 'size', 'border', 'offset', 'rowspan', 'group', 'hideInView'];
const report = [];
let wrote = 0; let failed = 0;
for (const p of pairs) {
  const tRow = await readRow(p.t.id);
  const sRow = await readRow(p.s.id);
  const {
    next, nEd, sEd, invented, dropped,
  } = build(tRow, sRow);
  const changes = ROWKEYS.filter((k) => !same(tRow[k], sRow[k]));
  const edKeys = [...new Set([...Object.keys(nEd), ...Object.keys(sEd)])]
    .filter((k) => !['text', 'data'].includes(k))
    .filter((k) => J(nz(nEd[k])) !== J(nz(sEd[k])));
  if (!changes.length && !edKeys.length) { report.push({ id: p.s.id, skip: true }); continue; }
  const line = {
    id: p.s.id, tid: p.t.id, tier: p.tier, title: p.t.title || p.s.title || '(untitled)', changes, edKeys, invented, dropped,
  };
  report.push(line);
  if (!APPLY) continue;
  fs.writeFileSync(path.join(outDir, `baseline_${p.s.id}.json`), J(sRow, null, 2));
  const pf = path.join(outDir, `payload_${p.s.id}.json`);
  fs.writeFileSync(pf, J(next));
  try {
    execFileSync(process.execPath, [DMS, 'raw', 'update', String(p.s.id), '--app', c.app, '--data', pf, '--format', 'json'],
      { encoding: 'utf8', env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) { line.error = String(e.stderr || e.message).slice(0, 160); failed++; continue; }
  const after = await readRow(p.s.id);
  const { ed: aEd } = edOf(after);
  const errs = [];
  if (J(aEd.text ?? null) !== J(sEd.text ?? null)) errs.push('AUTHORED TEXT MOVED');
  if (J(aEd.data ?? null) !== J(sEd.data ?? null)) errs.push('CACHED DATA MOVED');
  // A geoid VALUE must survive - but only where the template's filter structure
  // still has that column. Where the template dropped the leaf entirely, the
  // duplicate drops it too: structure comes from the template (section 3), and
  // the value it carried was inherited at duplication, not authored.
  const gm = geoidMap(sEd); const am = geoidMap(aEd); const tm = geoidMap(edOf(tRow).ed);
  for (const [k, v] of gm) {
    if (!tm.has(k)) { (line.removed = line.removed || []).push(`${k}=${J(v)}`); continue; }
    if (J(am.get(k)) !== J(v)) errs.push(`GEOID ${k} MOVED`);
  }
  if (String(after.parent ?? '') !== String(sRow.parent ?? '')) errs.push('PARENT MOVED');
  if (errs.length) { line.error = errs.join('; '); failed++; } else { line.ok = true; wrote++; }
}

const touched = report.filter((r) => !r.skip);
console.log(`page ${SLUG}   ${pairs.length} paired components   ${touched.length} need a row write   [${APPLY ? 'APPLY' : 'DRY RUN'}]\n`);
for (const r of touched) {
  console.log(`${r.ok ? 'ok  ' : r.error ? 'FAIL' : '    '} ${r.id}  ${String(r.title).slice(0, 26).padEnd(28)} tier ${r.tier}`);
  if (r.changes.length) console.log(`       row : ${r.changes.join(', ')}`);
  if (r.edKeys.length) console.log(`       ed  : ${r.edKeys.slice(0, 12).join(', ')}${r.edKeys.length > 12 ? ` (+${r.edKeys.length - 12})` : ''}`);
  if (r.invented.length) console.log(`       FLAG geoid value taken from the template: ${r.invented.join(', ')}`);
  if (r.removed && r.removed.length) console.log(`       FLAG geoid leaf removed - the template has no such column: ${r.removed.join(', ')}`);
  if (r.dropped.length) console.log(`       dropped target-only element-data keys: ${r.dropped.join(', ')}`);
  if (r.error) console.log(`       ${r.error}`);
}

if (!NO_REORDER) {
  const sPage = pairs[0].s.pageId;
  const pageRow = await readRow(sPage);
  const cur = refIds(pageRow.draft_sections);
  const rank = new Map(pairs.map((p) => [String(p.s.id), p.t.order]));
  // a component only the duplicate has re-anchors after the paired component
  // that currently precedes it, so local additions stay with their context
  const anchored = [];
  let lastPaired = null;
  cur.forEach((id, i) => {
    if (rank.has(id)) { anchored.push({ id, key: [rank.get(id), 0, i] }); lastPaired = rank.get(id); } else anchored.push({ id, key: [lastPaired === null ? -1 : lastPaired, 1, i] });
  });
  const newOrder = [...anchored].sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.key[2] - b.key[2]).map((x) => x.id);
  const moved = newOrder.filter((id, i) => id !== cur[i]).length;
  console.log(`\npage row ${sPage}: ${cur.length} draft sections, ${moved} change position`);
  if (APPLY && moved) {
    fs.writeFileSync(path.join(outDir, `baseline_page_${sPage}.json`), J(pageRow, null, 2));
    const orig = (typeof pageRow.draft_sections === 'string' ? JSON.parse(pageRow.draft_sections) : pageRow.draft_sections) || [];
    const byId = new Map(orig.map((m) => [refIds([m])[0], m]));
    const nextArr = newOrder.map((id) => byId.get(id)).filter(Boolean);
    if (nextArr.length !== orig.length) {
      console.log(`   ABORT reorder: ${nextArr.length} of ${orig.length} refs survived the remap`);
    } else {
      const np = { ...pageRow, draft_sections: typeof pageRow.draft_sections === 'string' ? J(nextArr) : nextArr };
      const pf = path.join(outDir, `payload_page_${sPage}.json`);
      fs.writeFileSync(pf, J(np));
      execFileSync(process.execPath, [DMS, 'raw', 'update', String(sPage), '--app', c.app, '--data', pf, '--format', 'json'],
        { encoding: 'utf8', env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
      const back = refIds((await readRow(sPage)).draft_sections);
      console.log(J(back) === J(newOrder) ? '   reorder ok - read back matches' : '   REORDER READ-BACK MISMATCH');
    }
  }
}
console.log(APPLY ? `\n${wrote} written, ${failed} failed` : '\ndry run - nothing written');
