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
  for(const a of attrs){ let v=atom(row[a]); if(a==='data'&&typeof v==='string'){try{v=JSON.parse(v)}catch(e){}} o[a]=v; }
  return o;
}
const page = await byId(2304232);
fs.writeFileSync('annex_page.json', JSON.stringify(page,null,2));
const d = page.data || {};
console.log('PAGE 2304232 data keys:', Object.keys(d));
console.log('title:', d.title, '| slug:', d.url_slug || d.slug);
for(const k of ['sections','draft_sections']){
  const s = d[k];
  if(Array.isArray(s)) console.log(`${k}: array len ${s.length}`);
  else console.log(`${k}:`, typeof s, s && s.$type);
}
