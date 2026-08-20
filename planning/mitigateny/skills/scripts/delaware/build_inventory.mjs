import { byIds, graph, atom } from './fq.js';
import fs from 'fs';
const APP='mitigat-ny-prod';
const pages = JSON.parse(fs.readFileSync(new URL('./delaware_pages.json',import.meta.url)))
  .filter(p=>p.title && p.ndraft>0);
function lexPreview(ed){ try{const walk=n=>{let t=n.text||'';if(n.children)n.children.forEach(c=>t+=' '+walk(c));return t};
  return ed&&ed.text&&ed.text.root?walk(ed.text.root).replace(/\s+/g,' ').trim():''}catch(e){return ''} }
async function pageDraft(id){
  const j=await graph([['dms','data',APP,'byId',Number(id),['data']]]);
  let d=atom(j.jsonGraph?.dms?.data?.[APP]?.byId?.[id]?.data);
  if(typeof d==='string'){try{d=JSON.parse(d)}catch(e){d={}}}
  return (d.draft_sections||[]).map(x=>String(x.id));
}
const inv={}; let totalAnno=0, emptyAnno=0;
for(const pg of pages){
  const order=await pageDraft(pg.id);
  const rows=await byIds(order,['id','type','data']);
  const comps=order.map((id,i)=>{
    const r=rows[id]; if(!r) return {id,i,missing:true};
    const d=r.data||{}; const el=d.element||{}; let ed=el['element-data'];
    if(typeof ed==='string'){try{ed=JSON.parse(ed)}catch(e){ed={}}}
    return {id,i,et:el['element-type'],isCard:(ed&&ed.isCard)||'',status:d.status||'',
      title:d.title||'',preview:lexPreview(ed),len:lexPreview(ed).length};
  });
  const slots=[];
  for(let i=0;i<comps.length;i++){
    const c=comps[i];
    if(c.et==='lexical' && c.isCard==='Annotation'){
      let g='';
      for(let k=i-1;k>=0 && i-k<=3;k--){ if(comps[k].isCard==='Inline Guidance'){g=comps[k].preview;break;} if(comps[k].isCard==='Annotation')break; }
      slots.push({id:c.id,order:i,title:c.title,status:c.status,filled:c.len>0,preview:c.preview.slice(0,80),guidance:g.slice(0,400)});
      totalAnno++; if(c.len===0)emptyAnno++;
    }
  }
  inv[pg.id]={title:pg.title,slug:pg.slug,n_comps:comps.length,slots};
}
fs.writeFileSync(new URL('./inventory.json',import.meta.url),JSON.stringify(inv,null,1));
console.log('pages inventoried:',pages.length,'| Annotation slots:',totalAnno,'| empty:',emptyAnno);
let md=`# Delaware (pattern 2323808) — Annotation slot inventory\n\nGenerated 2026-07-23. ${totalAnno} Annotation slots (${emptyAnno} empty).\n`;
for(const pg of pages){ const e=inv[pg.id];
  md+=`\n## ${e.title} — page ${pg.id} (${e.slug}) — ${e.slots.length} Annotation slots\n`;
  for(const s of e.slots){ md+=`- [${s.id}] ${s.filled?'FILLED':'empty'} — "${s.title||'(untitled)'}"\n`;
    if(s.guidance)md+=`    guidance: ${s.guidance.replace(/\n/g,' ')}\n`; }
}
fs.writeFileSync(new URL('./inventory.md',import.meta.url),md);
console.log('wrote inventory.json + inventory.md');
