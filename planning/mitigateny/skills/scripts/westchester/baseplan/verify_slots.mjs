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
// a bold run is a text node with the bold bit (format & 1) set
const countBold = n => ((n?.type === 'text' && (n.format & 1)) ? 1 : 0)
  + (n?.children || []).reduce((a, c) => a + countBold(c), 0);

const rows = await byIds(ids, ['id', 'data']);

const bad = [];
let okCount = 0, chars = 0, headings = 0, lists = 0, boldRuns = 0, linkRuns = 0, blanks = 0;

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
    // expected = sum of run text, the same measure build_fill_spec.py reports
    const runsText = rs => (rs || []).reduce((a, r) => a + (r.text || '').length, 0);
    const want = e.blocks.reduce((a, b) => a
      + runsText(b.runs)
      + (b.items || []).reduce((x, it) => x + runsText(it), 0), 0);
    if (got !== want) problems.push(`chars=${got} want=${want}`);
    // --- content blocks (ignoring the convention's empty spacer paragraphs)
    const kids = root.children || [];
    const isEmpty = n => n.type === 'paragraph' && (!n.children || n.children.length === 0);
    const content = kids.filter(n => !isEmpty(n));
    if (content.length !== e.blocks.length) problems.push(`blocks=${content.length} want=${e.blocks.length}`);

    // --- formatting convention (loading-a-plan-into-a-2.0-pattern.md)
    if (!kids.length || !isEmpty(kids[0])) problems.push('missing leading blank paragraph');
    if (!kids.length || !isEmpty(kids[kids.length - 1])) problems.push('missing trailing blank paragraph');
    // a blank must follow every content block EXCEPT a heading, which hugs the next
    for (let k = 0; k < kids.length; k++) {
      const n = kids[k];
      if (isEmpty(n)) continue;
      const next = kids[k + 1];
      if (n.type === 'heading') {
        if (next && isEmpty(next)) problems.push(`blank after heading at ${k} (should hug)`);
      } else if (next && !isEmpty(next)) {
        problems.push(`missing blank after block at ${k}`);
      }
    }
    // lists carry indent:1, and bullet/number must match the spec
    const specLists = e.blocks.filter(b => b.t === 'ul' || b.t === 'ol');
    const gotLists = content.filter(n => n.type === 'list');
    if (gotLists.length !== specLists.length) problems.push(`lists=${gotLists.length} want=${specLists.length}`);
    gotLists.forEach((n, k) => {
      if (n.indent !== 1) problems.push(`list ${k} indent=${n.indent} want 1`);
      const wantOrdered = specLists[k] && specLists[k].t === 'ol';
      const gotOrdered = n.listType === 'number';
      if (specLists[k] && gotOrdered !== wantOrdered) problems.push(`list ${k} listType=${n.listType}`);
    });
    // bold + link runs must survive the round-trip
    const specBold = e.n_bold || 0, specLinks = e.n_links || 0;
    const gotBold = countBold(root), gotLinks = countType(root, 'link');
    if (gotBold !== specBold) problems.push(`bold=${gotBold} want=${specBold}`);
    if (gotLinks !== specLinks) problems.push(`links=${gotLinks} want=${specLinks}`);

    chars += got;
    headings += countType(root, 'heading');
    lists += countType(root, 'list');
    boldRuns += gotBold;
    linkRuns += gotLinks;
    blanks += kids.filter(isEmpty).length;
  }

  if (problems.length) bad.push({ id, page: e.page_title, slot: e.slot_title, problems });
  else okCount++;
}

const expectHeadings = spec.reduce((a, e) => a + e.blocks.filter(b => b.t === 'h').length, 0);
const expectLists = spec.reduce((a, e) => a + e.blocks.filter(b => b.t === 'ul' || b.t === 'ol').length, 0);
const expectChars = spec.reduce((a, e) => a + e.chars, 0);
const expectBold = spec.reduce((a, e) => a + (e.n_bold || 0), 0);
const expectLinks = spec.reduce((a, e) => a + (e.n_links || 0), 0);

console.log(`slots verified clean:  ${okCount} / ${ids.length}`);
console.log(`characters live:       ${chars}   (spec ${expectChars}) ${chars === expectChars ? 'MATCH' : 'MISMATCH'}`);
console.log(`heading nodes:         ${headings}   (spec ${expectHeadings}) ${headings === expectHeadings ? 'MATCH' : 'MISMATCH'}`);
console.log(`list nodes:            ${lists}   (spec ${expectLists}) ${lists === expectLists ? 'MATCH' : 'MISMATCH'}`);
console.log(`bold runs:             ${boldRuns}   (spec ${expectBold}) ${boldRuns === expectBold ? 'MATCH' : 'MISMATCH'}`);
console.log(`link nodes:            ${linkRuns}   (spec ${expectLinks}) ${linkRuns === expectLinks ? 'MATCH' : 'MISMATCH'}`);
console.log(`blank spacer paragraphs: ${blanks}`);
if (bad.length) {
  console.log(`\nPROBLEMS (${bad.length}):`);
  for (const b of bad) console.log(`   ${b.id} ${b.page || ''} / ${b.slot || ''}: ${b.problems.join('; ')}`);
} else {
  console.log('problems:              none');
}
fs.writeFileSync(path.join(OUT, 'verify_results.json'),
  JSON.stringify({ ok: okCount, total: ids.length, chars, headings, lists, bad }, null, 1));
