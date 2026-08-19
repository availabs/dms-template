import { listIds, byIds } from './fq.js';
const {total, ids} = await listIds('mitigateny_county_template_v2_copy|page');
console.error('total pages of instance:', total);
const rows = await byIds(ids, ['id','data','created_at']);
const byDate={};
for(const id of ids){ const r=rows[id]; if(!r) continue; const dt=(r.created_at||'').slice(0,10); byDate[dt]=(byDate[dt]||0)+1; }
console.error('pages by creation date:', JSON.stringify(byDate));
// Delaware = today 2026-07-23
const del = ids.filter(id => (rows[id]?.created_at||'').slice(0,10)==='2026-07-23');
console.error('Delaware (2026-07-23) pages:', del.length);
const recs = del.map(id=>{ const d=rows[id].data||{}; return { id:String(id), title:d.title??null, slug:d.url_slug??null, parent:d.parent===''?'ROOT':(d.parent??null), ndraft:(d.draft_sections||[]).length, nsec:(d.sections||[]).length, hide:d.hide_in_nav }; });
recs.sort((a,b)=> (a.slug||'~').split('/').length-(b.slug||'~').split('/').length || (a.slug||'').localeCompare(b.slug||''));
import fs from 'fs';
fs.writeFileSync(new URL('./delaware_pages.json',import.meta.url), JSON.stringify(recs,null,1));
for(const r of recs) console.log(`${r.id}\t${r.slug||'(no slug)'}\t${r.title||'(none)'}\t${r.ndraft}d/${r.nsec}p${r.hide?' [hidden]':''}`);
