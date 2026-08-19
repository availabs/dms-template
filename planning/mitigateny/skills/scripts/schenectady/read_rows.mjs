// Read all Schenectady jurisdiction rows, identify them, back up current content.
import fs from 'node:fs';
import { login, readRow, schenectadyRowIds } from './annex_lib.mjs';

const LEX = ['description','lhmp_municipality_profile','growth_and_development_trends','lhmp_municipal_profile_additional','lhmp_buildings_local_context','lhmp_critical_buildings','lhmp_criticial_infrastructure','lhmp_risk_overview','lhmp_declared_disasters','lhmp_historic_occurances','lhmp_cascading_impacts','lhmp_other_hazards','lhmp_problem_areas','lhmp_risk_additional','lhmp_capacity_to_implement','lhmp_capacity_to_implement_additional','lhmp_planning_process','lhmp_previous_actions_evaluation','lhmp_proposed_actions','lhmp_in_progress_actions','lhmp_completed_actions','lhmp_integration','lhmp','lhmp_progress_additional','lhmp_strategies_additional','lhmp_prioritization','demographics_description','nfip','lhmp_dams','historic_prop_dist'];

const token = await login();
const ids = await schenectadyRowIds(token);
console.error(`Schenectady rows: ${ids.length}`);
const rows = [];
for (const id of ids) {
  const d = await readRow(token, id) || {};
  const filled = LEX.filter(c => d[c] && JSON.stringify(d[c]).length > 40);
  rows.push({ id, geoid: d.geoid, county_geoid: d.county_geoid, municipality_name: d.municipality_name, municipality_type: d.municipality_type, census_type: d.census_type, cis_cid: d.cis_cid, filledLex: filled, data: d });
}
rows.sort((a, b) => String(a.geoid).localeCompare(String(b.geoid)));
fs.writeFileSync('../backups/juris_rows_PRE.json', JSON.stringify(rows, null, 2));
console.log('id | geoid | municipality_name | municipality_type | census_type | #filledLex');
for (const r of rows) console.log(`${r.id} | ${r.geoid} | ${r.municipality_name} | ${r.municipality_type} | ${r.census_type} | ${r.filledLex.length}${r.filledLex.length ? ' [' + r.filledLex.join(',') + ']' : ''}`);
