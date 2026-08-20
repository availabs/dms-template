// Usage: node backup_targets.mjs <spec.json> <outfile>  — dump pre-edit element-data for each target id
import { byIds } from './fq.js';
import fs from 'fs';
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const out = process.argv[3];
const ids = spec.map(s => String(s.id));
const rows = await byIds(ids, ['id', 'data']);
const snap = {};
for (const id of ids) { const r = rows[id]; if (!r) { snap[id] = null; continue; } snap[id] = { title: r.data?.title, status: r.data?.status, element: r.data?.element }; }
fs.writeFileSync(out, JSON.stringify(snap, null, 1));
console.log('backed up', Object.keys(snap).length, 'targets ->', out);
