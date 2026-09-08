// Independent read-back verification of the base-plan load.
// Re-fetches every slot in the fill spec and checks shape, length and status.
import { byIds } from './fq.js';
import fs from 'fs';
import path from 'path';

const OUT = path.resolve('../out');
const spec = JSON.parse(fs.readFileSync(path.join(OUT, 'fill_spec.json'), 'utf8'));
const byId = Object.fromEntries(spec.map(e => [String(e.slot_id), e]));
const ids = spec.map(e => String(e.slot_id));

const walk = n => (n?.text || '') + (n?.children || []).map(walk).join('');
const countType = (n, t) => (n?.type === t ? 1 : 0) + (n?.children || []).reduce((a, c) => a + countType(c, t), 0);

const rows = await byIds(ids, ['id', 'data']);

const bad = [];
let okCount = 0, chars = 0, headings = 0, lists = 0;

for (const id of ids) {
  const e = byId[id];
  const problems = [];
  const row = rows[id];
  if (!row) { bad.push({ id, problems: ['unreadable'] }); continue; }

  const d = row.data || {};
  let ed = d.element?.['element-data'];
  if (typeof ed === 'string') { try { ed = JSON.parse(ed); } catch { ed = null; } }

  if (!ed) problems.push('no element-data');
  if (ed && ed.isCard !== 'Annotation') problems.push(`isCard=${JSON.stringify(ed.isCard)}`);
  if (d.element?.['element-type'] !== 'lexical') problems.push(`element-type=${d.element?.['element-type']}`);
  if (d.status !== e.status) problems.push(`status=${JSON.stringify(d.status)} want ${JSON.stringify(e.status)}`);

  const root = ed?.text?.root;
  if (!root) problems.push('text.root missing (wrong nesting?)');
  else {
    if (root.type !== 'root') problems.push(`text.root.type=${root.type}`);
    const got = walk(root).trim().length;
    // expected = sum of block text, same measure build_fill_spec.py reports
    const want = e.blocks.reduce((a, b) => a + (b.text || '').length + (b.items || []).reduce((x, i) => x + i.length, 0), 0);
    if (got !== want) problems.push(`chars=${got} want=${want}`);
    const gotBlocks = (root.children || []).length;
    if (gotBlocks !== e.blocks.length) problems.push(`blocks=${gotBlocks} want=${e.blocks.length}`);
    chars += got;
    headings += countType(root, 'heading');
    lists += countType(root, 'list');
  }

  if (problems.length) bad.push({ id, page: e.page_title, slot: e.slot_title, problems });
  else okCount++;
}

const expectHeadings = spec.reduce((a, e) => a + e.blocks.filter(b => b.t === 'h').length, 0);
const expectLists = spec.reduce((a, e) => a + e.blocks.filter(b => b.t === 'ul').length, 0);
const expectChars = spec.reduce((a, e) => a + e.chars, 0);

console.log(`slots verified clean:  ${okCount} / ${ids.length}`);
console.log(`characters live:       ${chars}   (spec ${expectChars}) ${chars === expectChars ? 'MATCH' : 'MISMATCH'}`);
console.log(`heading nodes:         ${headings}   (spec ${expectHeadings}) ${headings === expectHeadings ? 'MATCH' : 'MISMATCH'}`);
console.log(`list nodes:            ${lists}   (spec ${expectLists}) ${lists === expectLists ? 'MATCH' : 'MISMATCH'}`);
if (bad.length) {
  console.log(`\nPROBLEMS (${bad.length}):`);
  for (const b of bad) console.log(`   ${b.id} ${b.page || ''} / ${b.slot || ''}: ${b.problems.join('; ')}`);
} else {
  console.log('problems:              none');
}
fs.writeFileSync(path.join(OUT, 'verify_results.json'),
  JSON.stringify({ ok: okCount, total: ids.length, chars, headings, lists, bad }, null, 1));
