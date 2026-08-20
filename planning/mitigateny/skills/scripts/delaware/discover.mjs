// Delaware jurisdictional-annex load — DISCOVERY.
// 1) probe the annex page (2323817): type, app, data keys, section arrays
// 2) enumerate that page's Card components -> which lexical column each binds
// 3) dump the jurisdictions source (1346449) lexical column config
// Writes: annex_page.json, annex_components.json, juris_source.json
import fs from 'node:fs';

const HOST = 'https://dmsserver.availabs.org';
const APP = 'mitigat-ny-prod';
const ANNEX_PAGE = '2323817';
const SOURCE_ID = '1346449';

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
  for(const a of attrs){ let v=atom(row[a]); if((a==='data')&&typeof v==='string'){try{v=JSON.parse(v)}catch(e){}} o[a]=v; }
  return o;
}

// ---- 1) annex page ----
const page = await byId(ANNEX_PAGE);
fs.writeFileSync('annex_page.json', JSON.stringify(page,null,2));
const pd = page.data || {};
console.log(`PAGE ${ANNEX_PAGE}: type=${JSON.stringify(page.type)} app=${JSON.stringify(page.app)}`);
console.log('  data keys:', Object.keys(pd).join(', '));
console.log('  title:', pd.title, '| slug:', pd.url_slug || pd.slug);

// ---- 2) components parented to this page ----
// component type = page type with |page -> |component
const pageType = page.type || '';
const compType = pageType.replace(/\|page$/, '|component');
const KEY = APP + '+' + compType;
console.log(`\nComponent type key: ${KEY}`);
const lj = await graph([['dms','data',KEY,'length']]);
const total = atom(lj.jsonGraph?.dms?.data?.[KEY]?.length) || 0;
console.log('  total components of this type:', total);

const ids=[];
for(let from=0; from<total; from+=500){
  const to=Math.min(from+499,total-1);
  const j=await graph([['dms','data',KEY,'byIndex',{from,to},['id']]]);
  const bi=j.jsonGraph?.dms?.data?.[KEY]?.byIndex||{};
  for(const k of Object.keys(bi)){ const ref=bi[k]; if(ref&&ref.$type==='ref'){ ids.push(ref.value[ref.value.length-1]); } }
}
console.log('  collected component ids:', ids.length);

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
    if(String(pid)!==ANNEX_PAGE) continue;
    const el=d.element||{};
    matches.push({id, title:d.title, index:d.index, level:d.level, elementType:el['element-type'], elementData:el['element-data']});
  }
}
matches.sort((a,b)=>(a.index??0)-(b.index??0));
fs.writeFileSync('annex_components.json', JSON.stringify(matches,null,2));
console.log(`  MATCHES parented to page ${ANNEX_PAGE}:`, matches.length);

// ---- 3) jurisdictions source columns ----
const src = await byId(SOURCE_ID, ['id','type','app','data']);
fs.writeFileSync('juris_source.json', JSON.stringify(src,null,2));
let cfg = src.data && src.data.config;
if(typeof cfg==='string'){ try{cfg=JSON.parse(cfg)}catch(e){} }
const attrs = (cfg && cfg.attributes) || [];
const lexCols = attrs.filter(a=>a.type==='lexical');
console.log(`\nJurisdictions source ${SOURCE_ID}: ${attrs.length} attributes, ${lexCols.length} lexical`);

console.log('\n=== ANNEX PAGE COMPONENTS (index | type | title | shown-lexical-col) ===');
const jByName = {}; for(const a of attrs) jByName[a.name]={disp:a.display_name,type:a.type};
for(const m of matches){
  let shown='';
  if(m.elementType==='Card' && m.elementData){
    try{ const ed=JSON.parse(m.elementData); const s=(ed.columns||[]).filter(c=>c.show===true).map(c=>c.name).filter(n=>jByName[n]&&jByName[n].type==='lexical'); shown=s.join(','); }catch(e){}
  }
  console.log(`${m.index??'?'} | ${m.elementType||''} | ${m.title||''}${shown?'  ->  '+shown:''}`);
}
