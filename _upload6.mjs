import { readFileSync } from 'node:fs';
const DAMA_HOST='https://dmsserver.availabs.org', pgEnv='npmrds2';
const p='src/themes/transportny/TransportNY Design System/dms_design_system_v2/assets/screens/macro-06-download-builder.png';
const fd=new FormData();
// the shared source name has run out of variants; a distinct one still yields the
// same dl_url, which is derived from directory + file_name, not from source_name.
fd.append('source_name','npmrdsv5+dev2|npmrds2 docs images');
fd.append('type','file_upload');
fd.append('file_name','macro-06-download-builder.png');
fd.append('file_type','image/png');
fd.append('description','NPMRDS docs screenshot — macro view, captured 2026-08-27');
fd.append('directory','img/npmrdsv5+dev2');
fd.append('categories',JSON.stringify([['Uploaded File']]));
fd.append('file', new Blob([readFileSync(p)],{type:'image/png'}), 'macro-06-download-builder.png');
const r=await fetch(`${DAMA_HOST}/dama-admin/${pgEnv}/file_upload`,{method:'POST',body:fd});
console.log(r.status, (await r.text()).slice(0,300));
