// Falcor query helper for mitigat-ny-prod (form-encoded POST /graph)
import fs from 'fs';
const HOST = process.env.DMS_HOST || 'https://dmsserver.availabs.org';
const APP = 'mitigat-ny-prod';
async function graph(paths){
  const body = 'method=get&paths='+encodeURIComponent(JSON.stringify(paths));
  const r = await fetch(HOST+'/graph',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  if(!r.ok) throw new Error('HTTP '+r.status+' '+await r.text());
  return r.json();
}
function atom(v){ return v && v.$type==='atom' ? v.value : v; }
// fetch byId ids -> {id: {id,type,data(parsed)}}
export async function byIds(ids, attrs=['id','type','data']){
  const out={};
  const CH=200;
  for(let i=0;i<ids.length;i+=CH){
    const chunk=ids.slice(i,i+CH);
    const j=await graph([['dms','data',APP,'byId',chunk,attrs]]);
    const b=j.jsonGraph?.dms?.data?.[APP]?.byId||{};
    for(const id of chunk){
      const row=b[String(id)]; if(!row) continue;
      const o={};
      for(const a of attrs){ let v=atom(row[a]); if(a==='data'&&typeof v==='string'){try{v=JSON.parse(v)}catch(e){}} o[a]=v; }
      out[id]=o;
    }
  }
  return out;
}
// list all refs (ids) for an app+type key
export async function listIds(typeKey){
  const key=APP+'+'+typeKey;
  const lj=await graph([['dms','data',key,'length']]);
  const total=atom(lj.jsonGraph?.dms?.data?.[key]?.length)||0;
  const ids=[];
  const CH=500;
  for(let from=0; from<total; from+=CH){
    const to=Math.min(from+CH-1,total-1);
    const j=await graph([['dms','data',key,'byIndex',{from,to},['id']]]);
    const bi=j.jsonGraph?.dms?.data?.[key]?.byIndex||{};
    for(const k of Object.keys(bi)){ const ref=bi[k]; if(ref&&ref.$type==='ref'){ ids.push(ref.value[ref.value.length-1]); } }
  }
  return {total, ids};
}
export { graph, atom };

// --- write support ---
const HOST2 = process.env.DMS_HOST || 'https://dmsserver.availabs.org';
export async function edit(id, data){
  const callPath=['dms','data','edit'];
  const args=['mitigat-ny-prod', Number(id), data];
  const body='method=call&callPath='+encodeURIComponent(JSON.stringify(callPath))+'&arguments='+encodeURIComponent(JSON.stringify(args));
  const r=await fetch(HOST2+'/graph',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  const text=await r.text();
  if(!r.ok) throw new Error('HTTP '+r.status+' '+text);
  return text;
}
