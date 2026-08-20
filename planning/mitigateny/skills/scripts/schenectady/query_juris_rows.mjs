import fs from 'fs';
const HOST = 'https://dmsserver.availabs.org';
const APP = 'mitigat-ny-prod';
const DATA_TYPE = `${APP}+jurisdictions|1346450:data`;
function atom(v){ return v && v.$type === 'atom' ? v.value : v; }
async function graph(paths){
  const body = 'method=get&paths=' + encodeURIComponent(JSON.stringify(paths));
  const r = await fetch(HOST + '/graph', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body });
  if(!r.ok) throw new Error('HTTP '+r.status+' '+await r.text());
  return r.json();
}
const filterVal = process.argv[2] || '36093';
const filterCol = process.argv[3] || 'county_geoid';
const optionsObj = { filter: { [`data->>'${filterCol}'`]: [filterVal] } };
const optKey = JSON.stringify(optionsObj);
// length
const lj = await graph([['dms','data',DATA_TYPE,'options',[optKey],'length']]);
const total = atom(lj.jsonGraph?.dms?.data?.[DATA_TYPE]?.options?.[optKey]?.length) || 0;
console.log(`filter ${filterCol}=${filterVal} -> ${total} rows`);
if(!total) process.exit(0);
const j = await graph([['dms','data',DATA_TYPE,'options',[optKey],'byIndex',{from:0,to:total-1},['id','data']]]);
const bi = j.jsonGraph?.dms?.data?.[DATA_TYPE]?.options?.[optKey]?.byIndex || {};
const lexCols = ['description','lhmp_municipality_profile','growth_and_development_trends','lhmp_municipal_profile_additional','lhmp_buildings_local_context','lhmp_critical_buildings','lhmp_criticial_infrastructure','lhmp_risk_overview','lhmp_declared_disasters','lhmp_historic_occurances','lhmp_cascading_impacts','lhmp_other_hazards','lhmp_problem_areas','lhmp_risk_additional','lhmp_capacity_to_implement','lhmp_capacity_to_implement_additional','lhmp_planning_process','lhmp_previous_actions_evaluation','lhmp_proposed_actions','lhmp_in_progress_actions','lhmp_completed_actions','lhmp_integration','lhmp','lhmp_progress_additional','lhmp_strategies_additional','lhmp_prioritization','demographics_description','nfip','lhmp_dams','historic_prop_dist'];
const rows=[];
for(const k of Object.keys(bi)){
  const entry=bi[k]; if(!entry) continue;
  let id=atom(entry.id); let d=atom(entry.data); if(typeof d==='string'){try{d=JSON.parse(d)}catch(e){}}
  if(!d||typeof d!=='object'){ rows.push({id, geoid:'?', municipality_name:'(no data)', filledLex:[]}); continue; }
  const filled=lexCols.filter(c=>{ const v=d[c]; return v && (typeof v==='string'? v.trim().length>0 : (v.root? JSON.stringify(v).length>60 : true)); });
  rows.push({id, geoid:d.geoid, county_geoid:d.county_geoid, municipality_name:d.municipality_name, municipality_type:d.municipality_type, census_type:d.census_type, filledLex:filled});
}
rows.sort((a,b)=>String(a.geoid).localeCompare(String(b.geoid)));
fs.writeFileSync('schenectady_juris_rows.json', JSON.stringify(rows,null,2));
console.log('\nid | geoid | name | type | census | #filledLex');
for(const r of rows){ console.log(`${r.id} | ${r.geoid} | ${r.municipality_name} | ${r.municipality_type} | ${r.census_type} | ${r.filledLex.length} ${r.filledLex.length? '['+r.filledLex.join(',')+']':''}`); }
