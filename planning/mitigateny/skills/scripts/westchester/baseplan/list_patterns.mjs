import { listIds, byIds } from './fq.js';
const {total, ids} = await listIds('pattern');
console.error('patterns:', total);
const rows = await byIds(ids, ['id','type','data','created_at']);
const out=[];
for(const id of ids){ const r=rows[id]; if(!r) continue; const d=r.data||{};
  out.push({id:String(id), name:d.name, subdomain:d.subdomain, type:r.type, filters:JSON.stringify(d.filters||''), created:(r.created_at||'').slice(0,10)});
}
out.sort((a,b)=>(a.created||'').localeCompare(b.created||''));
for(const o of out) console.log(`${o.id}\t${o.created}\t${(o.name||'').padEnd(40)}\t${(o.subdomain||'').padEnd(24)}\t${o.filters}`);
