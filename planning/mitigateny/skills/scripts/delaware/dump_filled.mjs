import { byIds } from './fq.js';
const ids=['2325858','2329965','2325796']; // Flooding filled, Home filled, Flooding_dup filled
const rows=await byIds(ids,['id','data']);
for(const id of ids){
  const r=rows[id]; if(!r){console.log(id,'MISSING');continue;}
  const el=r.data.element||{}; let ed=el['element-data']; ed=typeof ed==='string'?JSON.parse(ed):ed;
  console.log('\n===== '+id+' isCard='+(ed?.isCard)+' title='+JSON.stringify(r.data.title)+' =====');
  const kids=ed?.text?.root?.children||[];
  console.log('child types:', kids.map(c=>c.type+(c.tag?':'+c.tag:'')+(c.listType?':'+c.listType:'')).join(', '));
  // find any node with a link or a bold text (format&1) or indent>0
  const findFeatures=(n,path='root')=>{ if(!n)return;
    if(n.type==='link') console.log('LINK node:', JSON.stringify({url:n.url||n.rel||n.fields,keys:Object.keys(n)}).slice(0,200));
    if(n.type==='text'&&n.format) console.log('FORMATTED text: format='+n.format+' "'+(n.text||'').slice(0,40)+'"');
    if((n.type==='list'||n.type==='listitem')&&n.indent) console.log(n.type+' indent='+n.indent);
    (n.children||[]).forEach(c=>findFeatures(c,path+'>'+n.type));
  };
  kids.forEach(k=>findFeatures(k));
  // print first list node fully if any
  const firstList=kids.find(c=>c.type==='list');
  if(firstList) console.log('FIRST LIST node JSON:\n'+JSON.stringify(firstList,null,1).slice(0,900));
}
