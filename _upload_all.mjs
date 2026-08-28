import { upload } from './_upload.mjs';
const DIR = 'src/themes/transportny/TransportNY Design System/dms_design_system_v2/assets/screens';
const files = ['macro-02-measure-menu','macro-03-phed-controls','macro-04-coverage','macro-05-worst-segments','macro-06-download-builder'];
const out = { 'macro-01-overview': 'https://availabs-bucket.files.availabs.org/img/npmrdsv5+dev2/macro-01-overview.avif' };
for (const f of files) {
  const r = await upload(`${DIR}/${f}.png`);
  if (!r.json?.ok) { console.log(`${f}: FAILED ${JSON.stringify(r).slice(0,200)}`); continue; }
  out[f] = r.json.dl_url;
  console.log(`${f}: source ${r.json.source_id}`);
}
console.log('\nMAP=' + JSON.stringify(out));
