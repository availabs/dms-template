import fs from 'fs';
const HOST = 'https://dmsserver.availabs.org';
const APP = 'mitigat-ny-prod';
function atom(v){ return v && v.$type === 'atom' ? v.value : v; }
async function graph(paths){
  const body = 'method=get&paths=' + encodeURIComponent(JSON.stringify(paths));
  const r = await fetch(HOST + '/graph', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body });
  if(!r.ok) throw new Error('HTTP '+r.status+' '+await r.text());
  return r.json();
}
async function byId(id, attrs=['id','type','app','data']){
  const j = await graph([['dms','data',APP,'byId',[id],attrs]]);
  const row = j.jsonGraph?.dms?.data?.[APP]?.byId?.[String(id)] || {};
  const o={};
  for(const a of attrs){ let v=atom(row[a]); if((a==='data'||a==='metadata')&&typeof v==='string'){try{v=JSON.parse(v)}catch(e){}} o[a]=v; }
  return o;
}
const src = await byId(1346449,['id','type','app','data']);
fs.writeFileSync('juris_source.json', JSON.stringify(src,null,2));
console.log('SOURCE 1346449 top keys of data:', Object.keys(src.data||{}));
console.log('SOURCE metadata keys:', src.metadata && typeof src.metadata==='object'? Object.keys(src.metadata):src.metadata);
const view = await byId(1346450,['id','type','app','data']);
fs.writeFileSync('juris_view.json', JSON.stringify(view,null,2));
console.log('VIEW 1346450 data keys:', Object.keys(view.data||{}));
// columns often under data.columns or metadata.columns
const cols = src.data?.columns || src.metadata?.columns || src.metadata;
if(Array.isArray(cols)){
  console.log('\n--- COLUMNS ('+cols.length+') ---');
  for(const c of cols){ console.log(`  name=${c.name||c.id} | display=${c.display_name||c.header||''} | type=${c.type||''} | display=${c.display||''}`); }
} else {
  console.log('columns not an array; wrote files for inspection');
}
