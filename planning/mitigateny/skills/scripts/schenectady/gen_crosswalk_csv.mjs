import fs from 'fs';
// Jurisdictions source columns
const src = JSON.parse(fs.readFileSync('juris_source.json','utf8'));
const cfg = JSON.parse(src.data.config);
const jcols = {};
for (const a of cfg.attributes) jcols[a.name] = { disp: a.display_name, type: a.type };

// Annex page cards -> shown column (show:true)
const comps = JSON.parse(fs.readFileSync('annex_components.json','utf8'));
const pairs = {};
for (const x of comps) {
  if (x.elementType !== 'Card') continue;
  let ed; try { ed = JSON.parse(x.elementData); } catch(e){ continue; }
  const shown = (ed.columns||[]).filter(c => c.show === true);
  for (const c of shown) {
    if (!(c.name in jcols)) continue;         // only Jurisdictions cols
    if (jcols[c.name].type !== 'lexical') continue; // only rich text
    const key = (x.title||'') + ' :: ' + c.name;
    if (!pairs[key]) pairs[key] = { title: x.title||'', col: c.name, disp: jcols[c.name].disp };
  }
}
const rows = Object.values(pairs).sort((a,b)=> a.title.localeCompare(b.title) || a.col.localeCompare(b.col));

// annex "tab" grouping (semantic, from column meaning) for author orientation
const tabOf = {
  description:'Overview',
  lhmp_municipality_profile:'Municipal Profile', growth_and_development_trends:'Municipal Profile',
  lhmp_municipal_profile_additional:'Municipal Profile',
  lhmp_buildings_local_context:'Built Environment', lhmp_critical_buildings:'Built Environment',
  lhmp_criticial_infrastructure:'Built Environment',
  lhmp_risk_overview:'Risk Assessment', lhmp_declared_disasters:'Risk Assessment',
  lhmp_historic_occurances:'Risk Assessment', lhmp_cascading_impacts:'Risk Assessment',
  lhmp_other_hazards:'Risk Assessment', lhmp_problem_areas:'Risk Assessment',
  lhmp_risk_additional:'Risk Assessment',
  lhmp_capacity_to_implement:'Capabilities', lhmp_capacity_to_implement_additional:'Capabilities',
  lhmp_planning_process:'Capabilities',
  lhmp:'Mitigation Strategy', lhmp_prioritization:'Mitigation Strategy',
  lhmp_previous_actions_evaluation:'Progress', lhmp_proposed_actions:'Mitigation Strategy',
  lhmp_in_progress_actions:'Progress', lhmp_completed_actions:'Progress',
  lhmp_integration:'Progress', lhmp_progress_additional:'Progress',
  lhmp_strategies_additional:'Mitigation Strategy',
};

function esc(s){ s = s==null?'':String(s); return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; }
const out = [];
out.push(['annex_tab','page_section_title','jurisdiction_column_name','column_display_name','column_type','notes'].join(','));
for (const r of rows) {
  let note = '';
  if (r.title === 'Local Context') note = 'Title reused on the page — disambiguate by tab (Built Environment vs Mitigation Strategy).';
  if (r.title === 'Complete Actions') note = 'Page label "Complete Actions" -> column "Completed Actions".';
  if (r.title === 'Jurisdictional Profile') note = 'Page label -> column "Municipality Profile".';
  if (r.title === 'Action Development') note = 'Page label -> column "Strategy Development".';
  if (r.title === 'Risk') note = 'Page label "Risk" -> column "Overview".';
  out.push([esc(tabOf[r.col]||''), esc(r.title), esc(r.col), esc(r.disp), 'lexical', esc(note)].join(','));
}
// lexical columns NOT surfaced as a titled card on the annex page
const used = new Set(rows.map(r=>r.col));
for (const [name,meta] of Object.entries(jcols)) {
  if (meta.type !== 'lexical') continue;
  if (used.has(name)) continue;
  out.push([esc(tabOf[name]||''), '(not surfaced as titled rich-text box on annex page)', esc(name), esc(meta.disp), 'lexical', 'Column exists in dataset but no titled Card on annex page binds it.'].join(','));
}
fs.writeFileSync('../jurisdictional_annex_crosswalk.csv', out.join('\n')+'\n');
console.log('wrote jurisdictional_annex_crosswalk.csv with', out.length-1, 'rows');
console.log(out.join('\n'));
