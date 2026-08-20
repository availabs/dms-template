import { byIds, listIds } from './fq.js';
const pat = await byIds(['2323808'], ['id','type','data','created_at']);
const p = pat['2323808'];
console.log('PATTERN 2323808 type:', p?.type);
console.log('created_at:', p?.created_at);
const d = p?.data || {};
console.log('data keys:', Object.keys(d));
for (const k of ['name','doc_type','subdomain','base_url','pattern_type','title']) if (d[k]!==undefined) console.log('  ',k,'=',JSON.stringify(d[k]).slice(0,120));
