import { byIds, graph, atom } from './fq.js';
import fs from 'fs';
const APP='mitigat-ny-prod';
const pages = JSON.parse(fs.readFileSync(new URL('../out/pages.json',import.meta.url)))
  .filter(p=>p.title && p.ndraft>0);
function lexText(ed){ try{const walk=n=>{let t=n.text||'';if(n.children)n.children.forEach(c=>t+=' '+walk(c));return t};
  return ed&&ed.text&&ed.text.root?walk(ed.text.root).replace(/\s+/g,' ').trim():''}catch(e){return ''} }
async function pageDraft(id){
  const j=await graph([['dms','data',APP,'byId',Number(id),['data']]]);
  let d=atom(j.jsonGraph?.dms?.data?.[APP]?.byId?.[id]?.data);
  if(typeof d==='string'){try{d=JSON.parse(d)}catch(e){d={}}}
  return (d.draft_sections||[]).map(x=>String(x.id));
}
const inv={}; let totalAnno=0, emptyAnno=0;
const allComps={};
for(const pg of pages){
  const order=await pageDraft(pg.id);
  const rows=await byIds(order,['id','type','data']);
  const comps=order.map((id,i)=>{
    const r=rows[id]; if(!r) return {id,i,missing:true};
    const d=r.data||{}; const el=d.element||{}; let ed=el['element-data'];
    if(typeof ed==='string'){try{ed=JSON.parse(ed)}catch(e){ed={}}}
    const txt=lexText(ed);
    return {id,i,et:el['element-type'],isCard:(ed&&ed.isCard)||'',status:d.status||'',
      title:d.title||'', tags:d.tags||null, txt, len:txt.length};
  });
  allComps[pg.id]=comps.map(c=>({id:c.id,order:c.i,et:c.et,isCard:c.isCard,title:c.title,len:c.len,preview:(c.txt||'').slice(0,160)}));
  const slots=[];
  for(let i=0;i<comps.length;i++){
    const c=comps[i];
    if(c.et==='lexical' && c.isCard==='Annotation'){
      // collect ALL preceding inline guidance / non-annotation lexical context up to previous annotation
      let g='', hdr='';
      for(let k=i-1;k>=0;k--){
        if(comps[k].isCard==='Annotation') break;
        if(comps[k].isCard==='Inline Guidance' && !g){ g=comps[k].txt; }
        if(comps[k].et==='Header' && !hdr){ hdr=comps[k].txt || comps[k].title; }
        if(i-k>6) break;
      }
      slots.push({id:c.id,order:i,title:c.title,status:c.status,filled:c.len>0,len:c.len,
        text:c.txt, guidance:g, header:hdr});
      totalAnno++; if(c.len===0)emptyAnno++;
    }
  }
  inv[pg.id]={title:pg.title,slug:pg.slug,n_comps:comps.length,slots};
}
fs.writeFileSync(new URL('../out/inventory.json',import.meta.url),JSON.stringify(inv,null,1));
fs.writeFileSync(new URL('../out/all_components.json',import.meta.url),JSON.stringify(allComps,null,1));
console.log('pages inventoried:',pages.length,'| Annotation slots:',totalAnno,'| empty:',emptyAnno);
let md=`# Westchester-2026 (pattern 2448336) — Annotation slot inventory\n\n${totalAnno} Annotation slots (${emptyAnno} empty).\n`;
for(const pg of pages){ const e=inv[pg.id];
  if(!e.slots.length) continue;
  md+=`\n## ${e.title} — page ${pg.id} (/${e.slug}) — ${e.slots.length} Annotation slots\n`;
  for(const s of e.slots){ md+=`\n- **[${s.id}]** ${s.filled?'FILLED('+s.len+')':'EMPTY'} — "${s.title||'(untitled)'}" (order ${s.order})\n`;
    if(s.header)md+=`    - header: ${s.header.replace(/\n/g,' ').slice(0,200)}\n`;
    if(s.guidance)md+=`    - guidance: ${s.guidance.replace(/\n/g,' ').slice(0,600)}\n`;
    if(s.filled)md+=`    - text: ${s.text.slice(0,300)}\n`; }
}
fs.writeFileSync(new URL('../out/inventory.md',import.meta.url),md);
console.log('wrote inventory.json + all_components.json + inventory.md');
