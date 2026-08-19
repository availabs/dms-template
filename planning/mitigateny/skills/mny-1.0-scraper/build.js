// Deterministic assembler: cleaned MitigateNY innerText -> structured markdown.
// Faithful (verbatim narrative), no invention. Left-nav submenu drives header levels.
// Produces: <OUT>/delaware-lhmp-v1.md  and  <OUT>/jurisdictional-annexes/*.md
const fs = require('fs');
const path = require('path');
const DATA = process.argv[2] || 'data';
const OUT = process.argv[3] || 'out';
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.join(OUT, 'jurisdictional-annexes'), { recursive: true });

const NAV = new Set(['MITIGATION PLANNER', 'LOGIN', 'HOME', 'PLANNING PROCESS', 'HAZARDS', 'RISK', 'STRATEGIES', 'ABOUT', 'Mitigation Planner', 'Home', 'Planning Process', 'Hazards', 'Risk', 'Strategies', 'About', 'DELAWARE (COUNTY)']);
const isJuris = (s) => /\((County|Town|Village)\)$/i.test(s.trim());
const readLines = (f) => fs.readFileSync(path.join(DATA, f), 'utf8').split('\n').map(l => l.replace(/\s+$/, ''));
const exists = (f) => fs.existsSync(path.join(DATA, f));
const BLUE = process.env.BLUE_DIR || 'blue';
// load the per-hazard jurisdiction "blue box" narratives scraped by scrape_blue.js
function loadBlue(slugForFile) {
  const p = path.join(BLUE, `blue_${slugForFile}.json`);
  if (!fs.existsSync(p)) return {};
  try { return JSON.parse(fs.readFileSync(p, 'utf8')).boxes || {}; } catch (e) { return {}; }
}

const HAZARDS = ["Avalanche", "Coastal Hazards", "Coldwave", "Drought", "Earthquake", "Flooding", "Hail", "Heat Wave", "Hurricane", "Ice Storm", "Landslide", "Lightning", "Snow Storm", "Tornado", "Tsunami/Seiche", "Volcano", "Wildfire", "Wind"];
const JURIS = ["Andes (Town)", "Bovina (Town)", "Colchester (Town)", "Davenport (Town)", "Delhi (Town)", "Delhi (Village)", "Deposit (Town)", "Fleischmanns (Village)", "Franklin (Town)", "Franklin (Village)", "Hamden (Town)", "Hancock (Town)", "Hancock (Village)", "Harpersfield (Town)", "Hobart (Village)", "Kortright (Town)", "Margaretville (Village)", "Masonville (Town)", "Meredith (Town)", "Middletown (Town)", "Roxbury (Town)", "Sidney (Town)", "Sidney (Village)", "Stamford (Town)", "Stamford (Village)", "Tompkins (Town)", "Walton (Town)", "Walton (Village)"];
const fslug = (s) => s.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
const kebab = (s) => s.toLowerCase().replace(/[()]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---- noise filter: chart axis labels, pagination, data-table chrome ----
const NOISE = [
  /^\$?[\d,]+(\.\d+)?[KMB]?$/, /^-?\d+(\.\d+)?%$/, /^'\d{2}$/, /^\d{1,4}$/,
  /^(January|February|March|April|May|June|July|August|September|October|November|December)$/,
  /^(Download CSV|Loading\.\.\.|No data found\.\.\.|Search \d+ Records\.\.\.|Previous|Next|View All|Hide All|Reset North|Zoom In|Zoom Out|Map|Mapbox logo|Source: NOAA NCEI Storm Events Dataset)$/,
  /^[<>]$/, /^All time$/, /^Max$/, /^[\d.]+[KMB]?$/, /^Page \d+ of \d+/, /^Showing Records/, /^Rows \d+/, /^<<<?\d/,
];
const isNoise = (t) => NOISE.some(r => r.test(t)) || /^(\$[\d.]+[KMB]?)+$/.test(t) || /^([\d.]+%)+$/.test(t);

function split(lines, pageTitle) {
  let j = lines.findIndex(isJuris); if (j < 0) j = 8;
  let cs = -1;
  for (let i = j + 1; i < lines.length; i++) if (lines[i].trim().toUpperCase() === pageTitle) { cs = i; break; }
  const submenu = lines.slice(j + 1, cs < 0 ? j + 1 : cs).map(s => s.trim()).filter(Boolean);
  const content = cs < 0 ? lines.slice(j + 1) : lines.slice(cs + 1);
  return { submenu, content };
}
const dedupeConsecutive = (arr) => { const o = []; for (const l of arr) { if (o.length && o[o.length - 1] === l) continue; o.push(l); } return o; };
function dropDupHalf(arr) { const n = arr.length; if (n < 20) return arr; const h = Math.floor(n / 2); if (arr.slice(0, h).join('\n') === arr.slice(h).join('\n')) return arr.slice(0, h); return arr; }

const COLLAPSE_RUN = 16; // runs of this many short non-sentence lines = a vertical data table
const isSentence = (t) => t.length > 65 || /[.!?:,]$/.test(t);
function toMarkdown(submenu, content, { stripNoise = true, collapse = true } = {}) {
  const h2 = new Set(), h3 = new Set();
  for (const s of submenu) { if (NAV.has(s) || isJuris(s)) continue; if (s === s.toUpperCase() && /[A-Z]/.test(s)) h2.add(s); else h3.add(s); }
  const lines = dedupeConsecutive(content);
  const out = []; let inTable = false, cols = 0;
  let buf = []; // buffer of short non-sentence lines (potential vertical data table)
  const flush = () => { inTable = false; cols = 0; };
  const flushBuf = () => {
    if (!buf.length) return;
    if (collapse && buf.length >= COLLAPSE_RUN) out.push('', `_[${buf.length} data rows omitted — auto-generated table in the source site; see the jurisdictional annexes for the authored per-jurisdiction slices.]_`, '');
    else for (const b of buf) out.push(b);
    buf = [];
  };
  const emit = (line) => { flushBuf(); out.push(line); };
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) { if (inTable) flush(); flushBuf(); if (out[out.length - 1] !== '') out.push(''); continue; }
    if (raw.includes('\t')) {
      flushBuf();
      const c = raw.split('\t').map(x => x.trim());
      if (!inTable) { out.push('', '| ' + c.join(' | ') + ' |', '| ' + c.map(() => '---').join(' | ') + ' |'); inTable = true; cols = c.length; }
      else { while (c.length < cols) c.push(''); out.push('| ' + c.join(' | ') + ' |'); }
      continue;
    }
    if (inTable) flush();
    if (h2.has(t)) { flushBuf(); out.push('', '## ' + t, ''); continue; }
    if (h3.has(t)) { flushBuf(); out.push('', '### ' + t, ''); continue; }
    if (stripNoise && isNoise(t)) continue;
    const safe = t.replace(/^#+\s?/, '');           // escape stray leading '#'
    if (collapse && !isSentence(safe)) { buf.push(safe); continue; } // buffer short data-ish lines
    emit(safe);
  }
  flushBuf();
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
function cleanPage(file, pageTitle, opts) {
  const { submenu, content } = split(readLines(file), pageTitle);
  return toMarkdown(submenu, dropDupHalf(content), opts);
}

// ---- table extractors (for annexes) ----
function tabRows(lines, ncols) {
  const seen = new Set(), rows = [];
  for (const l of lines) {
    if ((l.match(/\t/g) || []).length !== ncols - 1) continue;
    const key = l.trim(); if (seen.has(key)) continue; seen.add(key);
    rows.push(l.split('\t').map(c => c.trim()));
  }
  return rows;
}
function mdTable(header, rows) {
  if (!rows.length) return '';
  return ['| ' + header.join(' | ') + ' |', '| ' + header.map(() => '---').join(' | ') + ' |',
  ...rows.map(r => { const c = r.slice(); while (c.length < header.length) c.push(''); return '| ' + c.slice(0, header.length).map(x => x.replace(/\|/g, '\\|')).join(' | ') + ' |'; })].join('\n') + '\n';
}
// filter tab rows whose first cell matches a predicate (for county-table slicing)
function tabRowsWhere(lines, ncols, pred) { return tabRows(lines, ncols).filter(r => pred(r[0])); }
// vertical capabilities: records of 5 fields keyed by jurisdiction-name repetition
function extractCapabilities(lines, jurisFilter) {
  let s = -1; const occ = [];
  lines.forEach((l, i) => { if (l.trim() === 'Capabilities Table') occ.push(i); });
  if (!occ.length) return [];
  s = occ[occ.length - 1];
  // header ends at 'RESPONSIBLE AUTHORITY'
  let hi = lines.findIndex((l, i) => i > s && l.trim() === 'RESPONSIBLE AUTHORITY');
  if (hi < 0) return [];
  const recs = []; let cur = [];
  for (let i = hi + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    if (isJuris(t)) { if (cur.length) recs.push(cur); cur = [t]; continue; }
    if (!cur.length) continue;
    cur.push(t);
    if (/^(INTEGRATION|Integration|Capacity To Address Risk|Environmental and Historic)/.test(t)) { cur.pop(); break; }
  }
  if (cur.length) recs.push(cur);
  // each rec: [Jurisdiction, Name, Category, Type, ResponsibleAuthority] (Type/Auth may be absent)
  const seen = new Set(), out = [];
  for (const r of recs) {
    if (r.length < 3) continue;
    if (jurisFilter && r[0] !== jurisFilter) continue;
    const row = [r[1] || '', r[2] || '', r[3] || '', r[4] || ''];
    const k = row.join('|'); if (seen.has(k)) continue; seen.add(k); out.push(row);
  }
  return out;
}

// ---- MAIN PLAN FILE ----
function buildMain() {
  const P = [];
  P.push('# Delaware County, New York — Multi-Jurisdictional All-Hazards Mitigation Plan');
  P.push('## 2021 Update (Version 1.0 — MitigateNY pilot)');
  P.push('');
  P.push('> **Source:** transcribed from the MitigateNY 1.0 web plan at <https://delaware.mitigateny.org/> ' +
    '(a NYS DHSES / University at Albany AVAIL pilot). This Markdown is a faithful scrape of the site\'s ' +
    'narrative content, assembled as the input for a 1.0 → 2.0 transcription. Interactive data tables, maps, ' +
    'and charts in the source are auto-generated from datasets (filtered by geoid); only their narrative ' +
    'framing and the qualitative/tabular content that carries authored text are reproduced here. ' +
    'Per-jurisdiction detail lives in [`jurisdictional-annexes/`](./jurisdictional-annexes/).');
  P.push('');
  P.push('**Plan type:** Multi-jurisdictional (Delaware County + 28 participating towns and villages). ' +
    '**Hazards profiled:** 18. **County FIPS:** 36025.');
  P.push('');
  P.push('---\n');

  P.push('# 1. About This Plan\n');
  P.push(cleanPage('county_about.txt', 'ABOUT'));
  P.push('\n---\n');

  P.push('# 2. Planning Process\n');
  P.push(cleanPage('county_planning_process.txt', 'PLANNING PROCESS'));
  P.push('\n---\n');

  P.push('# 3. Hazards\n');
  // intro (All Hazards page narrative — keep the characteristics/context prose)
  P.push(cleanPage('county_hazards_ALL.txt', 'HAZARDS'));
  P.push('\n## Hazard Profiles\n');
  P.push('_County-level characteristics for each of the 18 profiled hazards. ' +
    'Jurisdiction-specific local impacts are in the annexes._\n');
  for (const h of HAZARDS) {
    const f = 'county_hazard_' + fslug(h) + '.txt';
    if (!exists(f)) { P.push(`\n### ${h}\n\n_Not captured._\n`); continue; }
    const lines = readLines(f);
    // extract "<H> Characteristics" .. "Local Impacts"
    const marker = h + ' Characteristics';
    let a = lines.findIndex(l => l.trim() === marker);
    let b = lines.findIndex((l, i) => i > a && /- Local Impacts -/.test(l));
    P.push(`\n### ${h}\n`);
    if (a < 0) { P.push('_No characteristics narrative in source._\n'); continue; }
    const body = lines.slice(a + 1, b < 0 ? a + 60 : b).map(x => x.trim()).filter(x => x && !isNoise(x));
    P.push(dedupeConsecutive(body).join('\n\n'));
    P.push('');
  }
  P.push('\n---\n');

  P.push('# 4. Risk Assessment\n');
  P.push(cleanPage('county_risk.txt', 'RISK'));
  P.push('\n---\n');

  P.push('# 5. Mitigation Strategy\n');
  P.push(cleanPage('county_strategies.txt', 'STRATEGIES'));
  P.push('\n---\n');

  P.push('# 6. Jurisdictional Annexes\n');
  P.push('Each participating jurisdiction has an annex capturing its Local Hazards of Concern, mitigation ' +
    'capabilities, and mitigation actions. See [`jurisdictional-annexes/`](./jurisdictional-annexes/):\n');
  const all = JURIS.concat(['Deposit (Village)']);
  all.sort();
  for (const j of all) P.push(`- [${j}](./jurisdictional-annexes/${kebab(j)}.md)`);
  P.push('');

  fs.writeFileSync(path.join(OUT, 'delaware-lhmp-v1.md'), P.join('\n'));
  console.log('wrote delaware-lhmp-v1.md');
}

// ---- ANNEXES ----
function buildAnnex(display) {
  const s = fslug(display); const slug = kebab(display);
  const hf = `annex_${s}_hazards.txt`, sf = `annex_${s}_strategies.txt`, rf = `annex_${s}_risk.txt`;
  if (!exists(hf)) { console.log('  skip (no data):', display); return false; }
  const hL = readLines(hf), sL = exists(sf) ? readLines(sf) : [], rL = exists(rf) ? readLines(rf) : [];

  const hoc = tabRows(hL, 6).map(r => r.slice(1)); // drop community col
  const caps = extractCapabilities(sL);    // Name|Category|Type|Responsible Authority
  const proposed = tabRows(sL, 7);         // Juris|Action|Hazards|Priority|Timeframe|Cost|Lead
  const inventory = tabRows(sL, 4);        // Juris|Action|Hazards|Status
  const blue = loadBlue(s);
  return emitAnnex(display, { hoc, caps, proposed, inventory, blue,
    note: `Scraped from <https://delaware.mitigateny.org/> with the jurisdiction filter set to **${display}**.` });
}

function emitAnnex(display, { hoc, caps, proposed, inventory, blue, note }) {
  const slug = kebab(display);
  const M = [];
  M.push(`# Jurisdictional Annex — ${display}`);
  M.push(`\n_Delaware County Multi-Jurisdictional All-Hazards Mitigation Plan, 2021 Update (v1.0). ` +
    `${note} Shared county narrative is in the [main plan](../delaware-lhmp-v1.md); this annex carries the ` +
    `jurisdiction-specific content._\n`);
  M.push('---\n');

  M.push('## Local Hazards of Concern\n');
  M.push('Ratings recorded during the jurisdictional interview: **Previous Occurrence**, **Future ' +
    'Occurrence**, and **Loss of Life & Property** (High / Medium / Low). The Location Description is the ' +
    'jurisdiction representative\'s verbatim note.\n');
  if (hoc.length) M.push(mdTable(['Hazard of Concern', 'Previous Occurrence', 'Future Occurrence', 'Loss of Life & Property', 'Location Description'], hoc));
  else M.push('_No hazards of concern recorded for this jurisdiction in the source._\n');

  // jurisdiction-specific "blue box" narrative per hazard (Local Impacts)
  const blues = blue || {};
  const blueHazards = HAZARDS.filter(h => blues[h] && blues[h].trim());
  M.push('\n## Local Impacts — Jurisdiction-Specific Narrative\n');
  M.push('The authored per-hazard narrative shown in the light-blue "Jurisdictional Annex" boxes on the ' +
    'Hazards page when this jurisdiction is selected (present only for hazards the jurisdiction added local ' +
    'detail to; verbatim from the source).\n');
  if (blueHazards.length) {
    for (const h of blueHazards) {
      M.push(`\n### ${h}\n`);
      M.push(blues[h].split('\n').map(l => l.trim()).filter(Boolean).join('\n\n'));
    }
    M.push('');
  } else if (blue === null) {
    M.push('_Not available: the blue boxes render only when the jurisdiction is selected in the site dropdown, ' +
      'and this jurisdiction was not selectable at scrape time (see note above)._\n');
  } else {
    M.push('_No jurisdiction-specific hazard narrative (blue boxes) was present for this jurisdiction in the source._\n');
  }

  M.push('\n## Mitigation Capabilities\n');
  if (caps.length) M.push(mdTable(['Capability', 'Category', 'Type', 'Responsible Authority'], caps));
  else M.push('_No capabilities recorded for this jurisdiction in the source._\n');

  M.push('\n## Mitigation Actions — Proposed (HMP)\n');
  M.push('_Actions prioritized for this plan update (status **Proposed-HMP**), with priority score, ' +
    'timeframe, estimated cost, and lead agency._\n');
  if (proposed.length) M.push(mdTable(['Jurisdiction', 'Action', 'Associated Hazards', 'Priority Score', 'Timeframe', 'Estimated Cost', 'Lead Agency'], proposed));
  else M.push('_None in source._\n');

  M.push('\n## Mitigation Actions — Additional Inventory\n');
  M.push('_Carryover and additional actions (status column). These require further development._\n');
  if (inventory.length) M.push(mdTable(['Jurisdiction', 'Action', 'Associated Hazards', 'Status'], inventory));
  else M.push('_None in source._\n');

  fs.writeFileSync(path.join(OUT, 'jurisdictional-annexes', slug + '.md'), M.join('\n'));
  console.log('  annex:', slug + '.md', `(hoc=${hoc.length} caps=${caps.length} proposed=${proposed.length} inv=${inventory.length})`);
  return true;
}

// Deposit (Village) = geoid 3620346: absent from the site dropdown but present in county tables.
function buildDepositVillage() {
  const display = 'Deposit (Village)';
  const hL = readLines('county_hazards_ALL.txt');
  const sL = readLines('county_strategies.txt');
  const hoc = tabRowsWhere(hL, 6, c => /^3620346/.test(c)).map(r => r.slice(1));
  const caps = extractCapabilities(sL, '3620346 (Village)');
  const proposed = tabRowsWhere(sL, 7, c => /3620346/.test(c));
  const inventory = tabRowsWhere(sL, 4, c => /3620346/.test(c));
  return emitAnnex(display, { hoc, caps, proposed, inventory, blue: null,
    note: 'Built from the county-wide tables at <https://delaware.mitigateny.org/> filtered to geoid **3620346** ' +
      '(Village of Deposit). This jurisdiction participates in the plan and appears throughout the county data, ' +
      'but was not selectable in the site\'s jurisdiction dropdown at scrape time.' });
}

// ---- test mode ----
if (process.argv[4] === 'test') { process.stdout.write(cleanPage(process.argv[5], process.argv[6])); process.exit(0); }
if (process.argv[4] === 'main') { buildMain(); process.exit(0); }
if (process.argv[4] === 'annex') { buildAnnex(process.argv[5]); process.exit(0); }
if (process.argv[4] === 'deposit') { buildDepositVillage(); process.exit(0); }

// full build
buildMain();
for (const j of JURIS) buildAnnex(j);
buildDepositVillage();
module.exports = { cleanPage, buildAnnex, buildMain, buildDepositVillage };
