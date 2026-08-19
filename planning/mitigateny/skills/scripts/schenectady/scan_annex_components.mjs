import fs from 'fs';
const HOST = 'https://dmsserver.availabs.org';
const APP = 'mitigat-ny-prod';
const TARGET_PAGE = '2304232';
const KEY = APP+'+mitigateny_county_template_v1_copy|component';
function atom(v){ return v && v.$type === 'atom' ? v.value : v; }
async function graph(paths){
  const body = 'method=get&paths=' + encodeURIComponent(JSON.stringify(paths));
  const r = await fetch(HOST + '/graph', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body });
  if(!r.ok) throw new Error('HTTP '+r.status+' '+await r.text());
  return r.json();
}
// 1) all ids
const lj = await graph([['dms','data',KEY,'length']]);
const total = atom(lj.jsonGraph?.dms?.data?.[KEY]?.length)||0;
console.error('total components:', total);
const ids=[];
for(let from=0; from<total; from+=500){
  const to=Math.min(from+499,total-1);
  const j=await graph([['dms','data',KEY,'byIndex',{from,to},['id']]]);
  const bi=j.jsonGraph?.dms?.data?.[KEY]?.byIndex||{};
  for(const k of Object.keys(bi)){ const ref=bi[k]; if(ref&&ref.$type==='ref'){ ids.push(ref.value[ref.value.length-1]); } }
}
console.error('collected ids:', ids.length);
// 2) fetch data in chunks, filter by parent==TARGET_PAGE
const matches=[];
const CH=100;
for(let i=0;i<ids.length;i+=CH){
  const chunk=ids.slice(i,i+CH);
  const j=await graph([['dms','data',APP,'byId',chunk,['data']]]);
  const b=j.jsonGraph?.dms?.data?.[APP]?.byId||{};
  for(const id of chunk){
    const row=b[String(id)]; if(!row) continue;
    let d=atom(row.data); if(typeof d==='string'){try{d=JSON.parse(d)}catch(e){continue;}}
    if(!d||typeof d!=='object') continue;
    let parent=d.parent; if(typeof parent==='string'){try{parent=JSON.parse(parent)}catch(e){}}
    const pid=parent&&parent.id;
    if(String(pid)!==TARGET_PAGE) continue;
    const el=d.element||{};
    matches.push({id, title:d.title, index:d.index, level:d.level, elementType:el['element-type'], elementData:el['element-data']});
  }
  if(i%1000===0) console.error('scanned', i);
}
console.error('MATCHES for page '+TARGET_PAGE+':', matches.length);
fs.writeFileSync('annex_components.json', JSON.stringify(matches,null,2));
// summary
for(const m of matches){
  console.log(`${m.index??'?'} | ${m.elementType} | ${m.title}`);
}
