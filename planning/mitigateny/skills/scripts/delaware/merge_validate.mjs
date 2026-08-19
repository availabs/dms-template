import fs from 'fs';
const inv = JSON.parse(fs.readFileSync(new URL('./inventory.json',import.meta.url)));
// map slot id -> {title, filled} across all pages
const slotIndex = {};
for(const pid of Object.keys(inv)) for(const s of inv[pid].slots) slotIndex[String(s.id)] = {title:s.title, filled:s.filled, page:inv[pid].title};
const chapters = ['A','B','C','D'];
const all = []; const seen = {};
for(const ch of chapters){
  const arr = JSON.parse(fs.readFileSync(new URL(`../edits/fills_${ch}.json`,import.meta.url)));
  for(const e of arr){
    const id=String(e.id);
    if(seen[id]){ console.log(`DUP id ${id} (ch ${ch} vs ${seen[id]}) — keeping first`); continue; }
    if(!slotIndex[id]){ console.log(`INVALID id ${id} (ch ${ch}) not an Annotation slot — dropping`); continue; }
    if(slotIndex[id].filled){ console.log(`PRE-FILLED id ${id} "${slotIndex[id].title}" (ch ${ch}) — dropping to avoid clobber`); continue; }
    seen[id]=ch; all.push({id, md:e.md, status:'shmp_sourced_content'});
  }
}
fs.writeFileSync(new URL('../edits/fills_all.json',import.meta.url), JSON.stringify(all,null,1));
// per-chapter counts
const counts={}; for(const id of Object.keys(seen)) counts[seen[id]]=(counts[seen[id]]||0)+1;
console.log('\nmerged fills_all.json:', all.length, 'slots |', JSON.stringify(counts));
