import { byIds, edit } from './fq.js';
import fs from 'fs';
const APPLY = process.argv.includes('--apply');

// target new IDs = the 46 transferred components (parse transfer_plan.md)
const plan = fs.readFileSync(new URL('./transfer_plan.md',import.meta.url),'utf8');
const ids = [...plan.matchAll(/(\d+)\s*->\s*(\d+)/g)].map(m=>m[2]);
console.error('targets:', ids.length);

const emptyPara = () => ({children:[],direction:null,format:"",indent:0,type:"paragraph",version:1,textFormat:0,textStyle:""});
const isEmpty = n => n && n.type==='paragraph' && (!n.children || n.children.length===0 ||
  n.children.every(c => (c.type==='text') && (!c.text || !c.text.trim())));

// re-space: leading blank, blank after each block EXCEPT no blank right after a heading
// (heading hugs its following block), trailing blank.
function respace(children){
  const content = children.filter(n => !isEmpty(n));
  const out = [emptyPara()];
  content.forEach((b,i)=>{
    out.push(b);
    const isLast = i===content.length-1;
    if (b.type==='heading' && !isLast) return; // keep heading with next block
    out.push(emptyPara());
  });
  return out;
}

const rows = await byIds(ids,['id','data']);
const snapshot={};
let changed=0;
for(const id of ids){
  const r=rows[id]; if(!r){console.error('missing',id);continue;}
  const el=r.data.element||{}; let ed=el['element-data'];
  ed = typeof ed==='string' ? JSON.parse(ed) : ed;
  if(!ed || ed.isCard!=='Annotation' || !ed.text || !ed.text.root){ console.error('skip (not annotation lexical)',id); continue; }
  snapshot[id]=JSON.stringify(el['element-data']);
  const before = ed.text.root.children.length;
  ed.text.root.children = respace(ed.text.root.children);
  const after = ed.text.root.children.length;
  if(!APPLY){ console.log(`${id} "${r.data.title}"  ${before} -> ${after} blocks`); continue; }
  await edit(id, { element:{ 'element-type':'lexical', 'element-data':JSON.stringify(ed) } });
  changed++;
}
if(APPLY){
  fs.writeFileSync(new URL('../backups/reformat_2304223.PRE.json',import.meta.url), JSON.stringify(snapshot,null,1));
  console.error(`reformatted ${changed}; pre-state -> backups/reformat_2304223.PRE.json`);
} else {
  console.error('DRY RUN — re-run with --apply to write.');
}
