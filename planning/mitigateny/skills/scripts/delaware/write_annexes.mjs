// Write the built annex payloads into the jurisdictions dataset via `dms dataset update`.
// Reads payloads.json (built by build_payloads.mjs). Verifies each row after writing.
// Usage: node write_annexes.mjs [rowId]   (optional single-row target)
import fs from 'node:fs';
import { login, readRow, cliUpdate } from './annex_lib.mjs';

const payloads = JSON.parse(fs.readFileSync('payloads.json', 'utf8'));
const only = process.argv[2]; // optional: write just this rowId
const token = await login();
const results = [];
for (const [rowId, r] of Object.entries(payloads)) {
  if (only && String(rowId) !== String(only)) continue;
  const cols = r.columns;
  const colNames = Object.keys(cols);
  if (!colNames.length) { console.log(`SKIP ${r.juris} (row ${rowId}) — no columns`); continue; }
  const res = cliUpdate(token, rowId, cols);
  // verify: read back, confirm each column now non-empty
  const back = await readRow(token, rowId) || {};
  const filled = colNames.filter(c => back[c] && back[c].root && back[c].root.children && back[c].root.children.length);
  const missing = colNames.filter(c => !filled.includes(c));
  results.push({ rowId, juris: r.juris, wrote: colNames.length, verified: filled.length, missing });
  console.log(`${res.ok ? 'OK  ' : 'FAIL'} ${r.juris} (row ${rowId}) wrote=${colNames.length} verified=${filled.length}${missing.length ? ' MISSING=' + missing.join(',') : ''}`);
}
fs.writeFileSync('write_results.json', JSON.stringify(results, null, 2));
const totalWrote = results.reduce((a, r) => a + r.wrote, 0);
const totalVer = results.reduce((a, r) => a + r.verified, 0);
console.log(`\nTOTAL: ${results.length} rows, ${totalWrote} columns written, ${totalVer} verified.`);
