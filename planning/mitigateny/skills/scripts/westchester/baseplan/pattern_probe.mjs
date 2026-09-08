import { byIds, graph, atom } from './fq.js';
const PID = process.argv[2] || '2448336';
const rows = await byIds([PID], ['id','type','data','created_at','updated_at']);
const r = rows[PID];
if(!r){ console.error('NOT FOUND'); process.exit(1); }
console.log('type:', r.type);
console.log('created_at:', r.created_at, ' updated_at:', r.updated_at);
const d = r.data || {};
for(const k of Object.keys(d)){
  const v = d[k];
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  console.log(`  ${k}: ${(s||'').slice(0,300)}`);
}
