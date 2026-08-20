// Usage: node fill_md.mjs <spec.json> [--apply]   (default = dry run)
// spec: [{ id, md, status? }]  — md is light markdown; mdToRoot applies formatting rules.
import { byIds, edit } from './fq.js';
import { mdToRoot } from './lexical.mjs';
import fs from 'fs';
const specFile = process.argv[2];
const APPLY = process.argv.includes('--apply');
const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
const ids = spec.map(s => String(s.id));
const cur = await byIds(ids, ['id', 'data']);
let ok = 0, skip = 0;
for (const s of spec) {
  const row = cur[String(s.id)];
  if (!row) { console.error('MISSING', s.id); skip++; continue; }
  const d = row.data || {}; const el = d.element || {};
  let ed = el['element-data']; ed = typeof ed === 'string' ? JSON.parse(ed) : (ed || {});
  if (ed.isCard !== 'Annotation') { console.error(`WARN ${s.id} isCard=${JSON.stringify(ed.isCard)} — skip`); skip++; continue; }
  ed.text = mdToRoot(s.md);
  const payload = { element: { 'element-type': 'lexical', 'element-data': JSON.stringify(ed) }, status: s.status || 'shmp_sourced_content' };
  const nblocks = s.md.split(/\n\s*\n/).filter(x => x.trim()).length;
  if (!APPLY) { console.log(`DRY ${s.id} "${d.title || ''}" <- ${nblocks} blocks / ${s.md.length} chars`); continue; }
  await edit(s.id, payload);
  console.log(`WROTE ${s.id} "${d.title || ''}" <- ${nblocks} blocks / ${s.md.length} chars`);
  ok++;
}
console.error(APPLY ? `applied ${ok}, skipped ${skip}` : `DRY RUN — ${spec.length} specs (${skip} would skip). Re-run with --apply.`);
