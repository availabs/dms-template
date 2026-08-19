import fs from 'fs';
const inv=JSON.parse(fs.readFileSync(new URL('./inventory.json',import.meta.url)));
const pages=JSON.parse(fs.readFileSync(new URL('./pages_all.json',import.meta.url)));
const impacts=JSON.parse(fs.readFileSync(new URL('./hazard_impacts.json',import.meta.url)));

// page slug (leaf) -> {source hazard key, target slot title}
const MAP={
 'avalanche':            {src:'Avalanche',      target:'Local Hazard Summary'},
 'coastal_hazards':      {src:'Coastal Hazards',target:'Local Hazard Summary'},
 'hurricane':            {src:'Hurricane',      target:'Local Hazard Summary'},
 'drought':              {src:'Drought',        target:'County Assessment'},
 'earthquake':           {src:'Earthquake',     target:'County Assessment'},
 'extreme_cold':         {src:'Coldwave',       target:'County Assessment'},
 'extreme_heat':         {src:'Heat Wave',      target:'County Assessment'},
 'hail':                 {src:'Hail',           target:'County Assessment'},
 'ice_storm':            {src:'Ice Storm',      target:'County Assessment'},
 'landslide':            {src:'Landslide',      target:'County Assessment'},
 'lightning':            {src:'Lightning',      target:'County Assessment'},
 'snowstorm':            {src:'Snow Storm',     target:'County Assessment'},
 'tornado':              {src:'Tornado',        target:'County Assessment'},
 'wildfire':             {src:'Wildfire',       target:'County Assessment'},
 'wind':                 {src:'Wind',           target:'County Assessment'},
};
// Flooding excluded (done). map-caption lines to drop (Flooding-style) — none in these.
const DROP=new Set([
 'Flooding and Social Vulnerability Across the County:',
]);

function slugLeaf(slug){ return (slug||'').split('/').pop(); }
const pageBySlug={};
pages.filter(p=>p.created==='2026-07-21'&&p.slug).forEach(p=>{ pageBySlug[slugLeaf(p.slug)]=p.id; });

// coalesce impacts blocks: consecutive li -> ul
function coalesce(blocks){
  const out=[]; let buf=null;
  for(const b of blocks){
    if(DROP.has(b.text)) continue;
    if(b.t==='li'){ if(!buf){buf={t:'ul',items:[]};out.push(buf);} buf.items.push(b.text); continue; }
    buf=null;
    if(b.t==='h') out.push({t:'h',text:b.text,tag:'h3'});
    else out.push({t:'p',text:b.text});
  }
  return out;
}

const spec=[]; const report=[];
for(const [slug,cfg] of Object.entries(MAP)){
  const pid=pageBySlug[slug];
  if(!pid){ report.push(`MISSING PAGE ${slug}`); continue; }
  const slot=(inv[pid].slots||[]).find(s=>s.title===cfg.target);
  if(!slot){ report.push(`MISSING SLOT ${slug} "${cfg.target}"`); continue; }
  const raw=impacts[cfg.src];
  if(!raw){ report.push(`MISSING SOURCE ${cfg.src}`); continue; }
  const blocks=coalesce(raw);
  spec.push({id:slot.id, blocks});
  report.push(`${slug} (page ${pid}) -> [${slot.id}] ${cfg.target} <- ${cfg.src} (${blocks.length} blocks)`);
}
fs.writeFileSync(new URL('../edits/hazards_batch.json',import.meta.url),JSON.stringify(spec,null,1));
console.log(report.join('\n'));
console.log('\nwrote hazards_batch.json:',spec.length,'slots');
