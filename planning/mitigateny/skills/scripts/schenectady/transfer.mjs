import { listIds, byIds, graph, atom, edit } from './fq.js';
import fs from 'fs';
const APP='mitigat-ny-prod';
const APPLY = process.argv.includes('--apply');
const NEW_INSTANCE = 'mitigateny_county_template_v1_copy';

function lexText(ed){ try{const w=n=>{let t=n&&n.text||'';if(n&&n.children)n.children.forEach(c=>t+=' '+w(c));return t};return ed&&ed.text&&ed.text.root?w(ed.text.root).replace(/\s+/g,' ').trim():''}catch(e){return ''} }
function parseEd(comp){ const el=(comp.data&&comp.data.element)||{}; let ed=el['element-data']; if(typeof ed==='string'){try{ed=JSON.parse(ed)}catch(e){ed=null}} return {ed, et:el['element-type']}; }

// ---------- OLD side: my 46 edited components on 2275239 ----------
const oldInv = JSON.parse(fs.readFileSync(new URL('./inventory.json',import.meta.url)));
const editDir = new URL('../edits/',import.meta.url);
const myIds = new Set();
for(const f of ['about_process.json','flooding.json','hazards_batch.json','chapters1.json','chapters2.json']){
  JSON.parse(fs.readFileSync(new URL(f,editDir))).forEach(e=>myIds.add(String(e.id)));
}
// old key by id: {slug,title,occ}
const oldKey={};
for(const [pid,e] of Object.entries(oldInv)){
  const counts={};
  for(const s of e.slots){ // annotation slots, in draft order
    counts[s.title]=(counts[s.title]??-1)+1;
    if(myIds.has(String(s.id))) oldKey[String(s.id)]={slug:e.slug,title:s.title,occ:counts[s.title]};
  }
}
const missingKey=[...myIds].filter(id=>!oldKey[id]);
if(missingKey.length) console.error('WARN old ids not found in inventory:', missingKey.join(','));
// fetch old content
const oldRows = await byIds([...myIds],['id','data']);

// ---------- NEW side: build annotation map for 2304223 ----------
const {ids:newPages} = await listIds(NEW_INSTANCE+'|page');
const pageRows = await byIds(newPages,['id','data']);
const newMap={}; // `${slug}|${title}|${occ}` -> {id, rawEd, isCard, page_slug}
let newAnnoCount=0;
for(const pid of newPages){
  const pd=pageRows[pid]&&pageRows[pid].data; if(!pd||Object.keys(pd).length===0) continue;
  const slug=pd.url_slug; const ds=(pd.draft_sections||[]).map(x=>String(x.id));
  if(!ds.length) continue;
  const comps=await byIds(ds,['id','data']);
  const counts={};
  for(const cid of ds){
    const c=comps[cid]; if(!c) continue;
    const {ed,et}=parseEd(c); if(et!=='lexical'||!ed||ed.isCard!=='Annotation') continue;
    const title=(c.data.title)||'';
    counts[title]=(counts[title]??-1)+1;
    const k=`${slug}|${title}|${counts[title]}`;
    newMap[k]={id:cid, rawEd:JSON.stringify(ed), page_slug:slug};
    newAnnoCount++;
  }
}
console.error(`NEW pattern 2304223: ${newPages.length} page rows, ${newAnnoCount} empty/annotation slots mapped`);

// ---------- JOIN ----------
const plan=[]; const unmatched=[];
for(const oldId of myIds){
  const k=oldKey[oldId]; if(!k){unmatched.push({oldId,reason:'no old key'});continue;}
  const key=`${k.slug}|${k.title}|${k.occ}`;
  const target=newMap[key];
  const {ed:oldEd}=parseEd(oldRows[oldId]||{});
  const preview=lexText(oldEd).slice(0,60);
  if(!target){unmatched.push({oldId,key,preview});continue;}
  // graft old text into NEW comp's element-data (preserve new styling)
  const newEd=JSON.parse(target.rawEd);
  newEd.text=oldEd.text;
  plan.push({oldId, newId:target.id, slug:k.slug, title:k.title, occ:k.occ, preview,
    payload:{element:{'element-type':'lexical','element-data':JSON.stringify(newEd)}, status:'shmp_sourced_content'}});
}
plan.sort((a,b)=>(a.slug||'').localeCompare(b.slug||'')||a.title.localeCompare(b.title));

// report
let rep=`# Transfer plan: 2275239 -> 2304223\n\nMatched ${plan.length} / ${myIds.size} components.\n\n`;
for(const p of plan) rep+=`- ${p.slug}  ::  "${p.title}"#${p.occ}   ${p.oldId} -> ${p.newId}   ${p.preview?`(${p.preview}…)`:''}\n`;
if(unmatched.length){ rep+=`\n## UNMATCHED (${unmatched.length})\n`; for(const u of unmatched) rep+=`- old ${u.oldId}  key=${u.key||'-'}  ${u.preview||u.reason||''}\n`; }
fs.writeFileSync(new URL('./transfer_plan.md',import.meta.url), rep);
console.error(`matched ${plan.length}/${myIds.size}; unmatched ${unmatched.length}. plan -> transfer_plan.md`);

if(!APPLY){
  console.error('DRY RUN — no writes. Re-run with --apply to write.');
} else {
  // backup targets first
  const targetIds=plan.map(p=>String(p.newId));
  const pre=await byIds(targetIds,['id','type','data']);
  fs.writeFileSync(new URL('../backups/transfer_targets_2304223.PRE.json',import.meta.url), JSON.stringify(pre,null,1));
  let ok=0;
  for(const p of plan){ await edit(p.newId,p.payload); ok++; }
  console.error(`APPLIED ${ok} transfers. backup -> backups/transfer_targets_2304223.PRE.json`);
}
