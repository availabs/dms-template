// Mirrors uploadImageFile() in src/dms/packages/dms/src/ui/columnTypes/image.jsx
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
const DAMA_HOST = 'https://dmsserver.availabs.org';
const pgEnv = 'npmrds2';
const APP = 'npmrdsv5', TYPE = 'dev2';
const dir = `img/${APP}+${TYPE}`;
const sourceName = `${APP}+${TYPE}|${pgEnv}`;

export async function upload(path) {
  const buf = readFileSync(path), name = basename(path);
  const fd = new FormData();
  fd.append('source_name', sourceName);
  fd.append('type', 'file_upload');
  fd.append('file_name', name);
  fd.append('file_type', 'image/png');
  fd.append('description', 'NPMRDS docs screenshot — macro view, captured 2026-08-27');
  fd.append('directory', dir);
  fd.append('categories', JSON.stringify([['Uploaded File']]));
  fd.append('file', new Blob([buf], { type: 'image/png' }), name);
  const res = await fetch(`${DAMA_HOST}/dama-admin/${pgEnv}/file_upload`, { method: 'POST', body: fd });
  const txt = await res.text();
  let json; try { json = JSON.parse(txt); } catch { json = { raw: txt.slice(0, 300) }; }
  return { status: res.status, json };
}

if (process.argv[2]) console.log(JSON.stringify(await upload(process.argv[2]), null, 1));
