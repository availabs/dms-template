import { byIds, graph, atom } from './fq.js';
import fs from 'fs';
const APP='mitigat-ny-prod';
const PAGES = process.argv.slice(2);
async function pageData(id){
  const j=await graph([['dms','data',APP,'byId',Number(id),['id','type','data']]]);
  let d=atom(j.jsonGraph?.dms?.data?.[APP]?.byId?.[id]?.data);
  if(typeof d==='string'){try{d=JSON.parse(d)}catch(e){}}
  return d;
}
for(const pid of PAGES){
  const d=await pageData(pid);
  const order=(d.draft_sections||[]).map(x=>String(x.id));
  const rows=await byIds(order,['id','type','data','created_at','updated_at']);
  const bundle={page_id:pid, page_data:d, draft_order:order, components:rows};
  fs.writeFileSync(new URL(`../backups/page_${pid}.PRE.json`,import.meta.url), JSON.stringify(bundle,null,1));
  console.log(`backed up page ${pid} (${d.title}) — ${order.length} components`);
}
