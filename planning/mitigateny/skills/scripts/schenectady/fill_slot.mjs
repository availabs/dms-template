// Usage: node fill_slot.mjs <specfile.json>  [--dry]
// spec: [{ id, heading?, headingTag?, paras:[...], status? }]
import { byIds, edit } from './fq.js';
import { buildRoot, buildRootBlocks2 } from './lexical.mjs';
import fs from 'fs';
const specFile=process.argv[2];
const dry=process.argv.includes('--dry');
const spec=JSON.parse(fs.readFileSync(specFile,'utf8'));
const ids=spec.map(s=>String(s.id));
const cur=await byIds(ids,['id','type','data']);
for(const s of spec){
  const row=cur[String(s.id)];
  if(!row){console.error('MISSING',s.id);continue;}
  const d=row.data||{};
  const el=d.element||{};
  let ed=el['element-data'];
  ed = typeof ed==='string' ? JSON.parse(ed) : (ed||{});
  if(ed.isCard!=='Annotation'){ console.error(`WARN ${s.id} isCard=${JSON.stringify(ed.isCard)} (not Annotation) — skipping`); continue; }
  ed.text = { root: s.blocks ? buildRootBlocks2(s.blocks) : buildRoot(s.paras, s.heading, s.headingTag) };
  const payload={ element:{ 'element-type':'lexical', 'element-data':JSON.stringify(ed) }, status: s.status||'shmp_sourced_content' };
  const chars=(s.blocks?s.blocks.map(b=>b.text).join(' '):s.paras.join(' ')).length;
  if(dry){ console.log(`DRY ${s.id} "${d.title}" <- ${(s.blocks||s.paras).length} blocks / ${chars} chars`); continue; }
  const res=await edit(s.id, payload);
  console.log(`WROTE ${s.id} "${d.title}" <- ${(s.blocks||s.paras).length} blocks / ${chars} chars :: ok`);
}
