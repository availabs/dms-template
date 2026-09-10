import { byIds } from './fq.js';
import fs from 'fs';
const comps = JSON.parse(fs.readFileSync('../out/annex_page_components.json','utf8'));
const rows = await byIds(comps.map(c=>c.id), ['id','data']);
const parents = new Map();
for (const c of comps) {
  const p = rows[c.id]?.data?.parent;
  const pid = p && typeof p === 'object' ? p.id : p;
  if (!parents.has(pid)) parents.set(pid, []);
  parents.get(pid).push(c.order);
}
for (const [pid, ords] of [...parents].sort()) {
  console.log(`parent ${pid}  ${ords.length} components  orders ${ords.slice(0,6).join(',')}${ords.length>6?'…':''}`);
}
