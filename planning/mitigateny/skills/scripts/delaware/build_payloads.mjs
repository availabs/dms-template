// Build per-jurisdiction lexical payloads for the Delaware annex load.
//
// Source of truth: the already-scraped blue-box JSON in
// _raw-scrape/blue/blue_<Juris>.json  ({ jurisdiction, boxes: { hazard: text } }),
// produced by mny-1.0-scraper (Jul 2021). These are the light-blue per-hazard
// "Jurisdictional Annex" narratives — the only authored per-jurisdiction prose
// in the Delaware plan (the rest of each annex is tables 2.0 auto-populates).
//
// Target column (owner decision, 2026-08-03): all of a jurisdiction's per-hazard
// narratives are aggregated into `lhmp_risk_overview` (the annex page's "Risk" /
// Overview box), one H3 heading per hazard, verbatim paragraphs. Location
// Descriptions from the hazards table are intentionally SKIPPED (2.0
// auto-populates the Hazards-of-Concern table). Invent nothing.
//
// Row mapping is derived from context/backups/juris_rows_PRE.json (read_rows.mjs):
// blue JSON `jurisdiction` == `${municipality_name} (${municipality_type})`.
//
// Output: payloads.json = { rowId: {juris, columns:{lhmp_risk_overview: root}, hazards:[], chars} }
import fs from 'node:fs';
import { buildRootBlocks2 } from './lexical.mjs';

const BLUE_DIR = 'C:/Code/dms-template/references/mny-transcribe/delaware/_raw-scrape/blue';
const TARGET_COL = 'lhmp_risk_overview';

// --- build jurisdiction -> rowId map from the PRE backup (skip CDP artifacts) ---
const pre = JSON.parse(fs.readFileSync('backups/juris_rows_PRE.json', 'utf8'));
const rowByJuris = {};
for (const r of pre) {
  if (r.census_type === 'CDP') continue;                 // census artifacts, not plan jurisdictions
  if (!r.municipality_name || !r.municipality_type) continue;
  rowByJuris[`${r.municipality_name} (${r.municipality_type})`] = r.id;
}

// paragraphs: split box text on newlines, trim, drop empties -> paragraph blocks
function toBlocks(hazard, text) {
  const blocks = [{ t: 'h', text: hazard, tag: 'h3' }];
  for (const raw of String(text).split(/\n/)) {
    const line = raw.replace(/[ \t\r]+$/, '').trim();
    if (line) blocks.push({ t: 'p', text: line });
  }
  return blocks;
}

const files = fs.readdirSync(BLUE_DIR).filter(f => /^blue_.*\.json$/.test(f)).sort();
const out = {};
const unmatched = [];
for (const f of files) {
  const d = JSON.parse(fs.readFileSync(`${BLUE_DIR}/${f}`, 'utf8'));
  const juris = d.jurisdiction;
  const boxes = d.boxes || {};
  const hazards = Object.keys(boxes);
  if (!hazards.length) continue;                         // Masonville: no boxes
  const rowId = rowByJuris[juris];
  if (!rowId) { unmatched.push(juris); continue; }
  const children = [];
  for (const hz of hazards) children.push(...buildRootBlocks2(toBlocks(hz, boxes[hz])).children);
  const root = { root: { children, direction: 'ltr', format: '', indent: 0, type: 'root', version: 1 } };
  out[rowId] = { juris, file: f, columns: { [TARGET_COL]: root }, hazards, chars: JSON.stringify(root).length };
}

fs.writeFileSync('payloads.json', JSON.stringify(out, null, 2));
console.log(`wrote payloads.json — ${Object.keys(out).length} rows -> ${TARGET_COL}\n`);
for (const [rowId, r] of Object.entries(out)) {
  console.log(`${rowId} | ${r.juris} | ${r.hazards.length} hazards | ${r.chars} chars | ${r.hazards.join(', ')}`);
}
// Coverage report
const withBoxes = files.map(f => JSON.parse(fs.readFileSync(`${BLUE_DIR}/${f}`, 'utf8'))).filter(d => Object.keys(d.boxes || {}).length);
console.log(`\nBlue files: ${files.length} | with boxes: ${withBoxes.length} | payloads: ${Object.keys(out).length}`);
if (unmatched.length) console.log('UNMATCHED (no dataset row):', unmatched.join('; '));
