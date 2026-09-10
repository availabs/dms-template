import { listIds, byIds } from './fq.js';
import fs from 'fs';
const INSTANCE = process.argv[2] || 'mitigateny_county_template_v3_copy_2';
const {total, ids} = await listIds(INSTANCE+'|page');
console.error('total pages of instance:', total);
const rows = await byIds(ids, ['id','data','created_at']);
const byDate={};
for(const id of ids){ const r=rows[id]; if(!r) continue; const dt=(r.created_at||'').slice(0,10); byDate[dt]=(byDate[dt]||0)+1; }
console.error('pages by creation date:', JSON.stringify(byDate));
const recs = ids.filter(id=>rows[id]).map(id=>{ const d=rows[id].data||{}; return { id:String(id), created:(rows[id].created_at||'').slice(0,19), title:d.title??null, slug:d.url_slug??null, parent:d.parent===''?'ROOT':(d.parent??null), ndraft:(d.draft_sections||[]).length, nsec:(d.sections||[]).length, hide:d.hide_in_nav, index:d.index };});
recs.sort((a,b)=> (a.slug||'~').split('/').length-(b.slug||'~').split('/').length || (a.slug||'').localeCompare(b.slug||''));
fs.writeFileSync(new URL('../out/pages.json',import.meta.url), JSON.stringify(recs,null,1));
for(const r of recs) console.log(`${r.id}\t${r.slug||'(no slug)'}\t${r.title||'(none)'}\t${r.ndraft}d/${r.nsec}p${r.hide?' [hidden]':''}\tparent=${r.parent}`);
