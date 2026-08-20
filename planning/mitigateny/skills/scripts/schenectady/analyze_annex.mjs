// Parse an annex markdown: associate each "<Juris> Jurisdictional Annex" blue-box
// block with the section (and parent chapter) it sits under, and print the local prose.
import fs from 'node:fs';

const files = {
  delanson:'Delanson (Village)', duanesburg:'Duanesburg (Town)', glenville:'Glenville (Town)',
  niskayuna:'Niskayuna (Town)', princetown:'Princetown (Town)', rotterdam:'Rotterdam (Town)',
  scotia:'Scotia (Village)',
};
const DIR='C:/Code/dms-template/references/mny-transcribe/schenectady/schenectady-alex/annexes';
const only = process.argv[2]; // optional single jurisdiction key

function parse(file, juris){
  const lines = fs.readFileSync(`${DIR}/schenectady-lhmp-v1-annex-${file}.md`,'utf8').split(/\r?\n/);
  const marker = `${juris} Jurisdictional Annex`;
  let chapter='', section='';
  const blocks=[];
  for(let i=0;i<lines.length;i++){
    const ln=lines[i];
    const h=ln.match(/^(#{2,6})\s+(.*)$/);
    if(h){ const level=h[1].length, txt=h[2].trim();
      if(level<=3) chapter=txt; // ##, ### = chapter/hazard
      section=txt; // most specific header
      continue;
    }
    if(ln.trim()===marker && i>3){ // a blue box (not the H1 title)
      const buf=[];
      for(let j=i+1;j<lines.length;j++){
        const nx=lines[j];
        if(/^#{1,6}\s+/.test(nx)) break;
        if(nx.trim()===marker) break;
        buf.push(nx);
      }
      const text=buf.join('\n').trim();
      if(text) blocks.push({chapter, section, text});
    }
  }
  return blocks;
}

for(const [file,juris] of Object.entries(files)){
  if(only && file!==only) continue;
  const blocks=parse(file,juris);
  console.log(`\n########## ${file} (${juris}) — ${blocks.length} blue-box blocks ##########`);
  for(const b of blocks){
    console.log(`\n--- [chapter: ${b.chapter}] [section: ${b.section}] (${b.text.length} chars) ---`);
    console.log(b.text.length>600 ? b.text.slice(0,600)+' …[truncated]' : b.text);
  }
}
