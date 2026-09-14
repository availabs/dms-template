// Pre-edit snapshot of every slot the fill spec targets.
// Read-only. Writes ../out/backups/slots_PRE.json + a summary of anything non-empty.
import { byIds } from './fq.js';
import fs from 'fs';
import path from 'path';

const OUT = path.resolve('../out');
const BK = path.join(OUT, 'backups');
fs.mkdirSync(BK, { recursive: true });

const spec = JSON.parse(fs.readFileSync(path.join(OUT, 'fill_spec.json'), 'utf8'));
const ids = spec.map(e => String(e.slot_id));

function lexLen(ed) {
  const walk = n => (n?.text || '') + (n?.children || []).map(walk).join('');
  return ed?.text?.root ? walk(ed.text.root).trim().length : 0;
}

const rows = await byIds(ids, ['id', 'type', 'data']);

const snap = {};
const nonEmpty = [];
const missing = [];

for (const id of ids) {
  const r = rows[id];
  if (!r) { missing.push(id); continue; }
  const d = r.data || {};
  const el = d.element || {};
  let ed = el['element-data'];
  if (typeof ed === 'string') { try { ed = JSON.parse(ed); } catch { /* keep raw */ } }
  snap[id] = {
    id, type: r.type,
    title: d.title ?? null,
    status: d.status ?? null,
    tags: d.tags ?? null,
    element_type: el['element-type'] ?? null,
    isCard: ed?.isCard ?? null,
    // the full pre-edit element-data, verbatim, so a restore is exact
    element_data: el['element-data'],
  };
  const n = lexLen(ed);
  if (n > 0) nonEmpty.push({ id, chars: n, title: d.title, isCard: ed?.isCard });
}

fs.writeFileSync(path.join(BK, 'slots_PRE.json'), JSON.stringify(snap, null, 1));

const notAnnotation = Object.values(snap).filter(s => s.isCard !== 'Annotation');

console.log(`spec slots:            ${ids.length}`);
console.log(`snapshotted:           ${Object.keys(snap).length}`);
console.log(`unreadable:            ${missing.length}${missing.length ? ' -> ' + missing.join(' ') : ''}`);
console.log(`already NON-EMPTY:     ${nonEmpty.length}`);
for (const x of nonEmpty) console.log(`   ${x.id}  ${String(x.chars).padStart(6)} ch  ${JSON.stringify(x.title)}  isCard=${JSON.stringify(x.isCard)}`);
console.log(`NOT isCard=Annotation: ${notAnnotation.length}`);
for (const x of notAnnotation) console.log(`   ${x.id}  element-type=${x.element_type}  isCard=${JSON.stringify(x.isCard)}  ${JSON.stringify(x.title)}`);
console.log(`\nwrote ${path.join(BK, 'slots_PRE.json')}`);
