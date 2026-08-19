import { listIds, byIds } from './fq.js';
import fs from 'fs';
const {ids} = await listIds('mitigateny_county_template_copy|page');
const rows = await byIds(ids, ['id','type','data','created_at']);
const pages=[];
for(const id of ids){
  const r=rows[id]; if(!r) continue;
  const d=r.data||{}; if(!d || Object.keys(d).length===0) continue;
  pages.push({id:String(id), created:(r.created_at||'').slice(0,10), title:d.title||null,
    slug:d.url_slug||null, parent:(d.parent===''?'ROOT':d.parent)||null,
    n_sec:(d.sections||[]).length, n_draft:(d.draft_sections||[]).length,
    hide_in_nav:d.hide_in_nav, index:d.index});
}
fs.writeFileSync(new URL('./pages_all.json',import.meta.url), JSON.stringify(pages,null,1));
const byDate={}; pages.forEach(p=>byDate[p.created]=(byDate[p.created]||0)+1);
console.log('pages with data:', pages.length);
console.log('by created date:', JSON.stringify(byDate));
console.log('\n--- pages created 2026-07-21 (Schenectady candidates), titled ---');
pages.filter(p=>p.created==='2026-07-21'&&p.title).sort((a,b)=>(a.slug||'').localeCompare(b.slug||''))
  .forEach(p=>console.log(`  ${p.id}  [${p.n_sec}s/${p.n_draft}d] ${JSON.stringify(p.slug)}  <- ${p.parent}   "${p.title}"`));
