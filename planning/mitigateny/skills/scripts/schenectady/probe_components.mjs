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
async function lenOf(typeKey){
  const key = APP+'+'+typeKey;
  const j = await graph([['dms','data',key,'length']]);
  return atom(j.jsonGraph?.dms?.data?.[key]?.length) || 0;
}
const candidates = [
  'mitigateny_county_template_v1_copy|section',
  'mitigateny_county_template_v1_copy|component',
  'mitigateny_county_template_v1_copy|page',
];
for(const t of candidates){
  try { console.log(t, '=>', await lenOf(t)); } catch(e){ console.log(t, 'ERR', e.message); }
}
