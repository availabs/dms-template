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
const key = APP+'+mitigateny_county_template_v1_copy|component';
// grab first few ids via byIndex
const j = await graph([['dms','data',key,'byIndex',{from:0,to:4},['id','parent']]]);
const bi = j.jsonGraph?.dms?.data?.[key]?.byIndex || {};
console.log('byIndex sample:', JSON.stringify(bi,null,2).slice(0,1500));
