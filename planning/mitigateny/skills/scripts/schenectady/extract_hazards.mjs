import fs from 'fs';
const SRC='C:/Code/dms-template/references/schenectady/schenectady-lhmp-v1-hazards.md';
const lines=fs.readFileSync(SRC,'utf8').split(/\r?\n/);
// find all "#### Schenectady (County) - Local Impacts - X" and capture until next ####/#####/##
const out={};
for(let i=0;i<lines.length;i++){
  const m=lines[i].match(/^####\s+Schenectady \(County\) - Local Impacts - (.+?)\s*$/);
  if(!m) continue;
  const hazard=m[1].trim();
  const body=[];
  for(let j=i+1;j<lines.length;j++){
    if(/^#{2,5}\s/.test(lines[j])) break;
    body.push(lines[j]);
  }
  // classify lines: prose vs table vs subheading vs blank
  const blocks=[];
  for(const raw of body){
    const t=raw.trim();
    if(!t) continue;
    if(t.startsWith('|')) { blocks.push({t:'TABLE',text:t}); continue; }
    if(/^#{5,6}\s/.test(raw)){ blocks.push({t:'h',text:t.replace(/^#+\s*/,'')}); continue; }
    if(/^[-*]\s+/.test(t)){ blocks.push({t:'li',text:t.replace(/^[-*]\s+/,'')}); continue; }
    blocks.push({t:'p',text:t});
  }
  out[hazard]=blocks;
}
fs.writeFileSync(new URL('./hazard_impacts.json',import.meta.url),JSON.stringify(out,null,1));
// human review dump: prose only, with table/li flags
let md='';
for(const h of Object.keys(out)){
  const b=out[h];
  const nP=b.filter(x=>x.t==='p').length, nT=b.filter(x=>x.t==='TABLE').length, nL=b.filter(x=>x.t==='li').length;
  md+=`\n===== ${h}  (${nP} prose, ${nL} list, ${nT} table lines) =====\n`;
  for(const x of b){ if(x.t==='TABLE') continue; md+=`[${x.t}] ${x.text}\n`; }
}
fs.writeFileSync(new URL('./hazard_impacts_review.txt',import.meta.url),md);
console.log('hazards extracted:',Object.keys(out).join(', '));
console.log('prose-line counts:', Object.fromEntries(Object.entries(out).map(([k,v])=>[k,v.filter(x=>x.t==='p'||x.t==='li').length])));
