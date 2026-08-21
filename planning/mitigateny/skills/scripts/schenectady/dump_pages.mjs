import { listIds, byIds } from './fq.js';
import fs from 'fs';
const {total, ids} = await listIds('mitigateny_county_template_copy|page');
console.error('page total', total, 'ids fetched', ids.length);
const rows = await byIds(ids, ['id','type','data']);
// group by parent pattern id
const byParent={};
const pages=[];
for(const id of ids){
  const r=rows[id]; if(!r) continue;
  const d=r.data||{};
  const parent = d.parent!=null ? d.parent : (d.parent_id||null);
  const p = (parent && typeof parent==='object') ? (parent.id||JSON.stringify(parent)) : parent;
  byParent[p]=(byParent[p]||0)+1;
  pages.push({id, parent:p, title:d.title, slug:d.url_slug, index:d.index, published:d.published,
    n_sections:(d.sections&&d.sections.length)||0, n_draft:(d['draft_sections']&&d['draft_sections'].length)||0});
}
fs.writeFileSync(new URL('./pages_all.json', import.meta.url), JSON.stringify(pages,null,1));
console.error('parent distribution:', JSON.stringify(byParent,null,1));
