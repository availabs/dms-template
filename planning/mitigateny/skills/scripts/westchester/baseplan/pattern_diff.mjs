import { byIds } from './fq.js';
const rows = await byIds(['2448336','1300890'], ['id','data']);
const a = rows['2448336'].data||{}, b = rows['1300890'].data||{};
const keys = [...new Set([...Object.keys(a),...Object.keys(b)])].sort();
for(const k of keys){
  const sa = a[k]===undefined?'(absent)':(typeof a[k]==='string'?a[k]:JSON.stringify(a[k]));
  const sb = b[k]===undefined?'(absent)':(typeof b[k]==='string'?b[k]:JSON.stringify(b[k]));
  const same = sa===sb;
  console.log(`${same?'  =':'DIFF'}  ${k}`);
  if(!same){ console.log(`        westchester: ${sa.slice(0,180)}`); console.log(`        template  : ${sb.slice(0,180)}`); }
}
