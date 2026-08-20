// Build per-jurisdiction lexical payloads from the annex blue-box prose.
// Output: payloads.json = { rowId: {juris, file, columns:{col: lexicalRoot}, mapped:[], unmapped:[] } }
import fs from 'node:fs';
import { buildRootBlocks2 } from './lexical.mjs';

const DIR = 'C:/Code/dms-template/references/mny-transcribe/schenectady/schenectady-alex/annexes';
// file -> { juris marker, dataset row id }
const JURIS = {
  delanson:   { marker: 'Delanson (Village)',   rowId: 1346909 },
  duanesburg: { marker: 'Duanesburg (Town)',    rowId: 1346939 },
  glenville:  { marker: 'Glenville (Town)',     rowId: 1347151 },
  niskayuna:  { marker: 'Niskayuna (Town)',     rowId: 1347727 },
  princetown: { marker: 'Princetown (Town)',    rowId: 1347971 },
  rotterdam:  { marker: 'Rotterdam (Town)',     rowId: 1348052 },
  scotia:     { marker: 'Scotia (Village)',     rowId: 1348122 },
  'schenectady-city': { marker: 'Schenectady city ( City)', rowId: 1348106 },
};

// (chapter, section) -> jurisdictions dataset column. Confident mappings only.
function columnFor(chapter, section) {
  if (chapter === 'Home / Plan Overview' && /Context$/.test(section)) return 'lhmp_municipality_profile';
  if (chapter === 'Risk') {
    if (section === 'Built Environment') return 'lhmp_buildings_local_context';
    if (section === 'Critical Infrastructure') return 'lhmp_criticial_infrastructure';
    if (section === 'What Changed') return 'growth_and_development_trends';
    if (section === 'Previous Action Status') return 'lhmp_previous_actions_evaluation';
    if (section === 'Problem Areas') return 'lhmp_problem_areas';
  }
  if (chapter === 'Strategies') {
    if (section === 'Capacity To Address Risk') return 'lhmp_capacity_to_implement';
    if (/^NFIP Continued Compliance/.test(section)) return 'nfip';
  }
  return null; // unmapped (Natural Environment, Open Space, Evacuation, Shelters, etc.)
}

const NON_HAZARD = new Set(['Home / Plan Overview', 'Planning Process', 'Risk', 'Strategies']);

// Turn blue-box prose into lexical blocks: consecutive "- " => bullet list,
// "N)"/"N:" numbered => number list, else paragraphs. Verbatim text.
function toBlocks(text) {
  const lines = text.split(/\n/).map(l => l.replace(/[ \t\r]+$/, '')).filter(l => l.trim().length);
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^[-•]\s+/.test(l)) {
      const items = [];
      while (i < lines.length && /^[-•]\s+/.test(lines[i])) { items.push(lines[i].replace(/^[-•]\s+/, '')); i++; }
      blocks.push({ t: 'ul', items });
    } else if (/^\d+[)\.]\s+/.test(l)) {
      const items = [];
      while (i < lines.length && /^\d+[)\.]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\d+[)\.]\s+/, '')); i++; }
      blocks.push({ t: 'ol', items });
    } else { blocks.push({ t: 'p', text: l }); i++; }
  }
  return blocks;
}

function parse(file, marker) {
  const lines = fs.readFileSync(`${DIR}/schenectady-lhmp-v1-annex-${file}.md`, 'utf8').split(/\r?\n/);
  const m = `${marker} Jurisdictional Annex`;
  let chapter = '', section = '';
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^(#{2,6})\s+(.*)$/);
    if (h) { if (h[1].length <= 3) chapter = h[2].trim(); section = h[2].trim(); continue; }
    if (lines[i].trim() === m && i > 3) {
      const buf = [];
      for (let j = i + 1; j < lines.length; j++) {
        if (/^#{1,6}\s+/.test(lines[j]) || lines[j].trim() === m) break;
        buf.push(lines[j]);
      }
      const text = buf.join('\n').trim();
      if (text) blocks.push({ chapter, section, text });
    }
  }
  return blocks;
}

const out = {};
for (const [file, { marker, rowId }] of Object.entries(JURIS)) {
  const blocks = parse(file, marker);
  const columns = {}; const mapped = []; const unmapped = []; let hazardBoxes = 0;
  for (const b of blocks) {
    if (!NON_HAZARD.has(b.chapter)) { hazardBoxes++; continue; } // per-hazard -> out of scope
    const col = columnFor(b.chapter, b.section);
    if (!col) { unmapped.push(`${b.chapter} :: ${b.section} (${b.text.length}c)`); continue; }
    // If two source sections map to same column, concatenate (rare).
    const root = { root: buildRootBlocks2(toBlocks(b.text)) };
    if (columns[col]) { columns[col].root.children.push(...root.root.children); }
    else columns[col] = root;
    mapped.push(`${b.section} -> ${col} (${b.text.length}c)`);
  }
  out[rowId] = { juris: marker, file, columns, mapped, unmapped, hazardBoxes };
}
fs.writeFileSync('payloads.json', JSON.stringify(out, null, 2));
console.log('wrote payloads.json\n');
for (const [rowId, r] of Object.entries(out)) {
  console.log(`### ${r.juris} (row ${rowId}) — ${Object.keys(r.columns).length} cols`);
  for (const m of r.mapped) console.log('   MAP  ' + m);
  for (const u of r.unmapped) console.log('   skip ' + u);
  if (r.hazardBoxes) console.log(`   (per-hazard local-impacts boxes skipped: ${r.hazardBoxes})`);
}
