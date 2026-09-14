import { byIds } from './fq.js';
const ids = process.argv.slice(2);
const rows = await byIds(ids, ['id','type','data']);
for(const id of ids){
  const r = rows[id]; if(!r){ console.log(id,'MISSING'); continue; }
  const d=r.data||{}; const el=d.element||{}; let ed=el['element-data'];
  if(typeof ed==='string'){try{ed=JSON.parse(ed)}catch(e){}}
  console.log('---', id, '| type:', r.type, '| element-type:', el['element-type'], '| title:', JSON.stringify(d.title), '| status:', d.status, '| tags:', JSON.stringify(d.tags));
  const keys = ed && typeof ed==='object' ? Object.keys(ed) : [];
  console.log('   element-data keys:', keys.join(', '));
  if(ed){
    for(const k of ['isCard','cardHint','hideInView','title','headerText','defaultOpen']) if(k in ed) console.log(`   ${k}:`, JSON.stringify(ed[k]).slice(0,200));
    if(ed.text) console.log('   text.root children:', (ed.text.root?.children||[]).length);
    if(ed.cardSpan) console.log('   cardSpan:', JSON.stringify(ed.cardSpan).slice(0,200));
  }
}
