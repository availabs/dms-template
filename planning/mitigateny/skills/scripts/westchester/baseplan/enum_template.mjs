import { listIds, byIds, graph, atom } from './fq.js';
import fs from 'fs';
const APP='mitigat-ny-prod';
const {total, ids} = await listIds('mitigateny_county_template|page');
console.error('total pages:', total);
const rows = await byIds(ids, ['id','data','created_at']);
const recs = ids.filter(id=>rows[id]).map(id=>{ const d=rows[id].data||{}; return {id:String(id), title:d.title??null, slug:d.url_slug??null, ndraft:(d.draft_sections||[]).length};});
function lexText(ed){ try{const walk=n=>{let t=n.text||'';if(n.children)n.children.forEach(c=>t+=' '+walk(c));return t};
  return ed&&ed.text&&ed.text.root?walk(ed.text.root).replace(/\s+/g,' ').trim():''}catch(e){return ''} }
async function pageDraft(id){
  const j=await graph([['dms','data',APP,'byId',Number(id),['data']]]);
  let d=atom(j.jsonGraph?.dms?.data?.[APP]?.byId?.[id]?.data);
  if(typeof d==='string'){try{d=JSON.parse(d)}catch(e){d={}}}
  return (d.draft_sections||[]).map(x=>String(x.id));
}
const inv={}; let tot=0;
for(const pg of recs.filter(p=>p.title&&p.ndraft>0)){
  const order=await pageDraft(pg.id);
  const rws=await byIds(order,['id','type','data']);
  const slots=[];
  order.forEach((id,i)=>{ const r=rws[id]; if(!r) return; const d=r.data||{}; const el=d.element||{}; let ed=el['element-data'];
    if(typeof ed==='string'){try{ed=JSON.parse(ed)}catch(e){ed={}}}
    if(el['element-type']==='lexical' && ed && ed.isCard==='Annotation'){ slots.push({id,order:i,title:d.title||'',len:lexText(ed).length}); tot++; }});
  inv[pg.id]={title:pg.title,slug:pg.slug,n:order.length,slots};
}
fs.writeFileSync(new URL('../out/template_inventory.json',import.meta.url),JSON.stringify(inv,null,1));
console.log('template pages:',Object.keys(inv).length,'Annotation slots:',tot);
