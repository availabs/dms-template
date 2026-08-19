import fs from 'fs';
const assess = JSON.parse(fs.readFileSync(new URL('./hazard_assessments.json',import.meta.url)));
const pages = JSON.parse(fs.readFileSync(new URL('./delaware_pages.json',import.meta.url)));
const inv = JSON.parse(fs.readFileSync(new URL('./inventory.json',import.meta.url)));
// hazard -> page slug leaf + target slot (not-of-concern -> Local Hazard Summary; else County Assessment)
const MAP = {
 'Avalanche':{slug:'avalanche',slot:'Local Hazard Summary'},
 'Coastal Hazards':{slug:'coastal_hazards',slot:'Local Hazard Summary'},
 'Coldwave':{slug:'extreme_cold',slot:'County Assessment'},
 'Drought':{slug:'drought',slot:'County Assessment'},
 'Earthquake':{slug:'earthquake',slot:'County Assessment'},
 'Flooding':{slug:'flooding',slot:'County Assessment'},
 'Hail':{slug:'hail',slot:'County Assessment'},
 'Heat Wave':{slug:'extreme_heat',slot:'County Assessment'},
 'Hurricane':{slug:'hurricane',slot:'County Assessment'},
 'Ice Storm':{slug:'ice_storm',slot:'County Assessment'},
 'Landslide':{slug:'landslide',slot:'County Assessment'},
 'Lightning':{slug:'lightning',slot:'County Assessment'},
 'Snow Storm':{slug:'snowstorm',slot:'County Assessment'},
 'Tornado':{slug:'tornado',slot:'County Assessment'},
 'Wildfire':{slug:'wildfire',slot:'County Assessment'},
 'Wind':{slug:'wind',slot:'County Assessment'},
};
const pageBySlugLeaf = {};
pages.forEach(p=>{ if(p.slug) pageBySlugLeaf[p.slug.split('/').pop()] = p.id; });
// markdown: bold standalone label lines (short, no terminal punctuation, followed by a sentence)
function toMd(text){
  const lines = text.split('\n').map(s=>s.trim()).filter(Boolean);
  return lines.map((l,i)=>{
    const next = lines[i+1]||'';
    const isLabel = l.length<45 && !/[.?!:]$/.test(l) && next.length>60;
    return isLabel ? `**${l}**` : l;
  }).join('\n');
}
const spec=[]; const report=[];
for(const [hz,cfg] of Object.entries(MAP)){
  const text=assess[hz];
  if(!text || !text.trim()){ report.push(`SKIP ${hz} (no assessment prose)`); continue; }
  const pid=pageBySlugLeaf[cfg.slug];
  if(!pid){ report.push(`MISSING PAGE ${cfg.slug}`); continue; }
  const slot=(inv[pid]?.slots||[]).find(s=>s.title===cfg.slot);
  if(!slot){ report.push(`MISSING SLOT ${cfg.slug} "${cfg.slot}"`); continue; }
  spec.push({ id:String(slot.id), title:`${hz} — ${cfg.slot}`, md:toMd(text) });
  report.push(`${hz} -> ${cfg.slug} [${slot.id}] ${cfg.slot} (${text.length} chars)`);
}
fs.writeFileSync(new URL('../edits/fills_D.json',import.meta.url), JSON.stringify(spec,null,1));
console.log(report.join('\n'));
console.log('\nwrote fills_D.json:',spec.length,'slots');
