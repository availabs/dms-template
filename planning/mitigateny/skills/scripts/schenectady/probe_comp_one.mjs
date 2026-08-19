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
const id = process.argv[2] || '2310366';
const attrs = ['id','type','data'];
const j = await graph([['dms','data',APP,'byId',[id],attrs]]);
const row = j.jsonGraph?.dms?.data?.[APP]?.byId?.[id] || {};
const o={};
for(const a of attrs){ let v=atom(row[a]); if(a==='data'&&typeof v==='string'){try{v=JSON.parse(v)}catch(e){}} o[a]=v; }
console.log('id:', o.id, '| type:', o.type, '| parent:', o.parent, '| index:', o.index);
console.log('data keys:', o.data && typeof o.data==='object'? Object.keys(o.data): typeof o.data);
if(o.data && o.data.element){
  console.log('element-type:', o.data.element['element-type']);
  console.log('element keys:', Object.keys(o.data.element));
}
fs.writeFileSync('comp_'+id+'.json', JSON.stringify(o,null,2));
