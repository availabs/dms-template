import { listIds, byIds } from './fq.js';
import fs from 'fs';

const {ids} = await listIds('mitigateny_county_template_copy|page');
const rows = await byIds(ids, ['id','type','data','created_at']);

// bucket pages by creation date -> pattern
const PAT = {
  '2026-06-16': {id:'2231616', name:'MitigateNY_County_Template_Westchester', sub:'westchester'},
  '2026-07-21': {id:'2275239', name:'MitigateNY Schenectady Draft',           sub:'schenectady-draft'},
};
const buckets = {'2231616':[], '2275239':[], 'other':[]};
for(const id of ids){
  const r=rows[id]; if(!r) continue;
  const d=r.data||{};
  const created=(r.created_at||'').slice(0,10);
  const rec={ id:String(id), title:d.title??null, slug:d.url_slug??null,
    parent:(d.parent===''?'ROOT':(d.parent??null)),
    ndraft:(d.draft_sections||[]).length, nsec:(d.sections||[]).length,
    hide:d.hide_in_nav, created };
  const pat = PAT[created];
  if(pat) buckets[pat.id].push(rec);
  else buckets.other.push(rec);
}

const TOPLABEL={the_risk:'The Risk', the_local_environment:'The Local Environment', the_plan:'The Plan', track_progress:'Track Progress', home:'Home'};
function topSeg(slug){ return slug? slug.split('/')[0] : ''; }

function renderTree(list){
  const byId=Object.fromEntries(list.map(p=>[p.id,p]));
  const childrenOf={};
  list.forEach(p=>{ const k=p.parent||'NULL'; (childrenOf[k]=childrenOf[k]||[]).push(p); });
  // roots = ROOT parent, OR parent id not present in this bucket (auth-gated container)
  const present=new Set(list.map(p=>p.id));
  const rootParents=new Set();
  list.forEach(p=>{ if(p.parent==='ROOT'||p.parent==null||!present.has(p.parent)) rootParents.add(p.parent==='ROOT'?'ROOT':(p.parent==null?'NULL':p.parent)); });
  let out='';
  // group by top-level slug chapter for readability
  const chapters={};
  for(const p of list){ const seg=topSeg(p.slug)||'(no slug)'; (chapters[seg]=chapters[seg]||[]).push(p); }
  const segOrder=['home','the_local_environment','the_risk','the_plan','track_progress','(no slug)'];
  const segs=[...new Set([...segOrder.filter(s=>chapters[s]), ...Object.keys(chapters).filter(s=>!segOrder.includes(s))])];
  for(const seg of segs){
    const label=TOPLABEL[seg]||seg;
    out+=`\n**${label}**\n\n`;
    // sort by slug depth then slug
    const items=chapters[seg].sort((a,b)=>{
      const da=(a.slug||'').split('/').length, db=(b.slug||'').split('/').length;
      return da-db || (a.slug||'').localeCompare(b.slug||'');
    });
    for(const p of items){
      const depth=Math.max(0,(p.slug||'').split('/').length-1);
      const indent='  '.repeat(depth);
      const t=p.title||'(no title / restricted)';
      out+=`${indent}- \`${p.id}\` — ${t}${p.slug?`  (\`${p.slug}\`)`:''} — ${p.ndraft} draft / ${p.nsec} pub sections${p.hide?' — hidden':''}\n`;
    }
  }
  return out;
}

let md=`# Pattern page inventory — 2231616 vs 2275239\n\n`;
md+=`Generated ${'2026-07-22'}. Attribution is by **page creation date**, because both patterns share the instance slug \`mitigateny_county_template_copy\` (so page \`type\` strings are identical and cannot separate them).\n\n`;
for(const patId of ['2231616','2275239']){
  const meta=Object.values(PAT).find(p=>p.id===patId);
  const list=buckets[patId];
  const titled=list.filter(p=>p.title);
  md+=`\n---\n\n## Pattern ${patId} — "${meta.name}"  (subdomain \`${meta.sub}\`)\n\n`;
  md+=`Pages: **${list.length}** total (${titled.length} titled). Created ${Object.keys(PAT).find(k=>PAT[k].id===patId)}.\n`;
  md+=renderTree(list);
}
// other / restricted
if(buckets.other.length){
  md+=`\n---\n\n## Unattributed / access-restricted rows (${buckets.other.length})\n\n`;
  md+=`These page rows returned no readable creation date (empty/placeholder rows, or auth-gated container pages such as the top-level "The Risk"/"The Plan" nodes). Listed for completeness.\n\n`;
  for(const p of buckets.other.sort((a,b)=>a.id.localeCompare(b.id))){
    md+=`- \`${p.id}\` — ${p.title||'(null)'}${p.slug?`  (\`${p.slug}\`)`:''} — parent ${p.parent}\n`;
  }
}
fs.writeFileSync(new URL('../PATTERN_PAGES_REPORT.md',import.meta.url), md);
console.log(`2231616: ${buckets['2231616'].length} pages | 2275239: ${buckets['2275239'].length} pages | other: ${buckets.other.length}`);
console.log('wrote PATTERN_PAGES_REPORT.md');
