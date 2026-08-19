// Generic MNY 1.0 assembler (first written for Fulton) — 3-file split, driven entirely by MNY_CONFIG:
//   <slug>-lhmp-v1.md       (main plan: About, Planning Process, Hazards intro, Risk, Strategy, annex index)
//   <slug>-lhmp-hazards.md  (the 18 county-level hazard profiles, as a SEPARATE file)
//   <slug>-lhmp-annexes.md  (index) + jurisdictional-annexes/*.md (one per jurisdiction)
// Config keys: {slug, county, base, fips, hazards[], juris[], missing[{display,geoidRe,capsFilter,resolvedNote}]}.
// Used for Fulton (slug "fulton") and Allegany (slug "allegany"); copy config per county, no code edits.
// Faithful/verbatim narrative, no invention. Reuses the cleaning/extraction machinery from build.js style.
const fs = require('fs');
const path = require('path');
const DATA = process.argv[2] || 'data';
const OUT = process.argv[3] || 'out';
const CFG = JSON.parse(fs.readFileSync(process.env.MNY_CONFIG, 'utf8'));
const COUNTY = CFG.county || 'County';
const SLUG = CFG.slug || COUNTY.toLowerCase().replace(/[^a-z0-9]+/g, '-'); // output file prefix, e.g. "allegany"
const BASE = CFG.base || 'https://county.mitigateny.org';
const FIPS = CFG.fips || '';
const HAZARDS = CFG.hazards;
const JURIS = CFG.juris;
const MISSING = CFG.missing || []; // [{display, geoidRe}] dropdown-missing jurisdictions sliced from county tables
const F_MAIN = `${SLUG}-lhmp-v1.md`, F_HAZ = `${SLUG}-lhmp-hazards.md`, F_ANX = `${SLUG}-lhmp-annexes.md`;
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.join(OUT, 'jurisdictional-annexes'), { recursive: true });

const NAV = new Set(['MITIGATION PLANNER', 'LOGIN', 'HOME', 'PLANNING PROCESS', 'HAZARDS', 'RISK', 'STRATEGIES', 'ABOUT', 'Mitigation Planner', 'Home', 'Planning Process', 'Hazards', 'Risk', 'Strategies', 'About', COUNTY.toUpperCase() + ' (COUNTY)']);
const isJuris = (s) => /\(\s*(County|Town|Village|City)\)$/i.test(s.trim());
const readLines = (f) => fs.readFileSync(path.join(DATA, f), 'utf8').split('\n').map(l => l.replace(/\s+$/, ''));
// Tab-preserving reader: strips trailing spaces/CR but KEEPS trailing tabs, so tab-separated
// rows whose last column is empty keep their full column count (HoC location, action lead agency, …).
const readRaw = (f) => fs.readFileSync(path.join(DATA, f), 'utf8').split('\n').map(l => l.replace(/[ \r]+$/, ''));
const exists = (f) => fs.existsSync(path.join(DATA, f));
const BLUE = process.env.BLUE_DIR || path.join(DATA, 'blue');
function loadBlue(slugForFile) {
  const p = path.join(BLUE, `blue_${slugForFile}.json`);
  if (!fs.existsSync(p)) return {};
  try { return JSON.parse(fs.readFileSync(p, 'utf8')).boxes || {}; } catch (e) { return {}; }
}
const fslug = (s) => s.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
const kebab = (s) => s.toLowerCase().replace(/[()]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

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

const COLLAPSE_RUN = 16;
const isSentence = (t) => t.length > 65 || /[.!?:,]$/.test(t);
function toMarkdown(submenu, content, { stripNoise = true, collapse = true } = {}) {
  const h2 = new Set(), h3 = new Set();
  for (const s of submenu) { if (NAV.has(s) || isJuris(s)) continue; if (s === s.toUpperCase() && /[A-Z]/.test(s)) h2.add(s); else h3.add(s); }
  const lines = dedupeConsecutive(content);
  const out = []; let inTable = false, cols = 0;
  let buf = [];
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
    const safe = t.replace(/^#+\s?/, '');
    if (collapse && !isSentence(safe)) { buf.push(safe); continue; }
    emit(safe);
  }
  flushBuf();
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
function cleanPage(file, pageTitle, opts) {
  const { submenu, content } = split(readLines(file), pageTitle);
  return toMarkdown(submenu, dropDupHalf(content), opts);
}

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
function tabRowsWhere(lines, ncols, pred) { return tabRows(lines, ncols).filter(r => pred(r[0])); }
function extractCapabilities(lines, jurisFilter) {
  let s = -1; const occ = [];
  lines.forEach((l, i) => { if (l.trim() === 'Capabilities Table') occ.push(i); });
  if (!occ.length) return [];
  s = occ[occ.length - 1];
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
  const seen = new Set(), out = [];
  for (const r of recs) {
    if (r.length < 3) continue;
    if (jurisFilter && r[0] !== jurisFilter) continue;
    const row = [r[1] || '', r[2] || '', r[3] || '', r[4] || ''];
    const k = row.join('|'); if (seen.has(k)) continue; seen.add(k); out.push(row);
  }
  return out;
}

const SRC_NOTE = `transcribed from the MitigateNY 1.0 web plan at <${BASE}/>`;

// ---- MAIN PLAN ----
function buildMain() {
  const P = [];
  P.push(`# ${COUNTY} County, New York — Multi-Jurisdictional All-Hazards Mitigation Plan`);
  P.push('## Version 1.0 (MitigateNY pilot)');
  P.push('');
  P.push(`> **Source:** ${SRC_NOTE} (a NYS DHSES / University at Albany AVAIL pilot). This Markdown is a ` +
    `faithful scrape of the site's narrative content, assembled as the input for a 1.0 → 2.0 transcription. ` +
    `Interactive data tables, maps, and charts in the source are auto-generated from datasets (filtered by ` +
    `geoid); only their narrative framing and the qualitative/tabular content that carries authored text are ` +
    `reproduced here.`);
  P.push('');
  P.push(`**Plan type:** Multi-jurisdictional (${COUNTY} County + ${JURIS.length + MISSING.length} participating ` +
    `municipalities). **Hazards profiled:** ${HAZARDS.length} — see [\`${F_HAZ}\`](./${F_HAZ}). ` +
    `**Per-jurisdiction detail:** [\`${F_ANX}\`](./${F_ANX}) and ` +
    `[\`jurisdictional-annexes/\`](./jurisdictional-annexes/).` + (FIPS ? ` **County FIPS:** ${FIPS}.` : ''));
  P.push('');
  P.push('---\n');

  P.push('# 1. About This Plan\n');
  P.push(cleanPage('county_about.txt', 'ABOUT'));
  P.push('\n---\n');

  P.push('# 2. Planning Process\n');
  P.push(cleanPage('county_planning_process.txt', 'PLANNING PROCESS'));
  P.push('\n---\n');

  P.push('# 3. Hazards (Overview)\n');
  P.push('_The "All Hazards" dashboard narrative and the county-wide Local Hazards of Concern summary. ' +
    'The full county-level profile for each of the ' + HAZARDS.length + ' hazards is in a separate file: ' +
    `[\`${F_HAZ}\`](./${F_HAZ})._\n`);
  P.push(cleanPage('county_hazards_ALL.txt', 'HAZARDS'));
  P.push('\n---\n');

  P.push('# 4. Risk Assessment\n');
  P.push(cleanPage('county_risk.txt', 'RISK'));
  P.push('\n---\n');

  P.push('# 5. Mitigation Strategy\n');
  P.push(cleanPage('county_strategies.txt', 'STRATEGIES'));
  P.push('\n---\n');

  P.push('# 6. Jurisdictional Annexes\n');
  P.push('Each participating jurisdiction has an annex (Local Hazards of Concern, jurisdiction-specific ' +
    'narrative, mitigation capabilities, and mitigation actions). Index: ' +
    `[\`${F_ANX}\`](./${F_ANX}).\n`);
  const all = JURIS.concat(MISSING.map(m => m.display)); all.sort();
  for (const j of all) P.push(`- [${j}](./jurisdictional-annexes/${kebab(j)}.md)`);
  P.push('');

  fs.writeFileSync(path.join(OUT, F_MAIN), P.join('\n'));
  console.log('wrote ' + F_MAIN);
}

// ---- HAZARDS (separate file) ----
function buildHazards() {
  const P = [];
  P.push(`# ${COUNTY} County LHMP v1.0 — Hazard Profiles`);
  P.push('');
  P.push(`> County-level **Characteristics** narrative for each of the ${HAZARDS.length} profiled hazards, ` +
    `${SRC_NOTE}. Part of the [${COUNTY} County main plan](./${F_MAIN}); jurisdiction-specific local ` +
    `impacts are in the [annexes](./${F_ANX}). Auto-generated data tables/charts (storm events, ` +
    `losses, exposure) are omitted here — the 2.0 platform repopulates them from datasets.`);
  P.push('');
  P.push('---\n');
  for (const h of HAZARDS) {
    const f = 'county_hazard_' + fslug(h) + '.txt';
    P.push(`\n## ${h}\n`);
    if (!exists(f)) { P.push('_Not captured._\n'); continue; }
    const lines = readLines(f);
    const marker = h + ' Characteristics';
    let a = lines.findIndex(l => l.trim() === marker);
    let b = lines.findIndex((l, i) => i > a && /- Local Impacts -/.test(l));
    if (a < 0) { P.push('_No characteristics narrative in source._\n'); continue; }
    const body = lines.slice(a + 1, b < 0 ? a + 80 : b).map(x => x.trim()).filter(x => x && !isNoise(x));
    P.push('### Characteristics\n');
    P.push(dedupeConsecutive(body).join('\n\n'));
    P.push('');
  }
  fs.writeFileSync(path.join(OUT, F_HAZ), P.join('\n'));
  console.log('wrote ' + F_HAZ);
}

// Where per-jurisdiction Local Hazards of Concern ratings live varies by county (CFG.hocSource):
//   "county"   — structured 6-col table in the county "All Hazards" view (Fulton). Slice by community.
//   "filtered" — structured 6-col table in the FILTERED annex hazards view (Delaware).
//   "none"     — no structured HoC table anywhere; ratings live only in the blue-box prose (Allegany).
const HOC_SOURCE = CFG.hocSource || 'county';
// false = this county's 1.0 plan has NO per-jurisdiction hazard content (no HoC ratings, no local-impact
// narrative/blue boxes); hazard analysis is county-level only. Annexes then carry just capabilities+actions.
const PERJURIS_HAZARDS = CFG.perJurisHazards !== false;
function hocFromCounty(pred) {
  const hL = readRaw('county_hazards_ALL.txt');
  return tabRows(hL, 6).filter(r => pred(r[0])).map(r => r.slice(1));
}

// ---- ANNEXES ----
function buildAnnex(display) {
  const s = fslug(display);
  const sf = `annex_${s}_strategies.txt`, hf = `annex_${s}_hazards.txt`;
  if (!exists(sf)) { console.log('  skip (no data):', display); return false; }
  const sL = readRaw(sf);
  // HoC per HOC_SOURCE; caps/actions always from the filtered strategies view (that always filters correctly).
  let hoc = [], hocNote = '';
  if (HOC_SOURCE === 'county') {
    hoc = hocFromCounty(c => c === display);
    hocNote = 'Local Hazards of Concern are sliced from the county-wide table (where this county stores per-jurisdiction ratings).';
  } else if (HOC_SOURCE === 'filtered') {
    hoc = exists(hf) ? tabRows(readRaw(hf), 6).map(r => r.slice(1)) : [];
    hocNote = 'Local Hazards of Concern are from the jurisdiction-filtered Hazards view.';
  } else if (PERJURIS_HAZARDS) { // 'none' but per-jurisdiction hazard prose exists (blue boxes)
    hocNote = 'This county has no structured Local Hazards of Concern table; the ratings are recorded in prose in the Local Impacts narrative below.';
  } else { // 'none' and NO per-jurisdiction hazard content at all (county-level analysis only)
    hocNote = 'This plan keeps hazard identification and analysis at the county level (see the hazard profiles); this annex carries the jurisdiction\'s capabilities and mitigation actions.';
  }
  const caps = extractCapabilities(sL);
  const proposed = tabRows(sL, 7);
  const inventory = tabRows(sL, 4);
  const blue = loadBlue(s);
  return emitAnnex(display, { hoc, caps, proposed, inventory, blue,
    note: `Scraped from <${BASE}/> with the jurisdiction filter set to **${display}**. ${hocNote}` });
}

function emitAnnex(display, { hoc, caps, proposed, inventory, blue, note }) {
  const slug = kebab(display);
  const M = [];
  M.push(`# Jurisdictional Annex — ${display}`);
  M.push(`\n_${COUNTY} County Multi-Jurisdictional All-Hazards Mitigation Plan (v1.0). ${note} Shared county ` +
    `narrative is in the [main plan](../${F_MAIN}) and [hazard profiles](../${F_HAZ}); ` +
    `this annex carries the jurisdiction-specific content._\n`);
  M.push('---\n');

  if (!PERJURIS_HAZARDS) {
    // County keeps hazard identification/analysis at the county level — no per-jurisdiction HoC or local-impact
    // narrative in the 1.0 plan. Emit one note pointing to the county hazard profiles.
    M.push('## Hazards\n');
    M.push(`_${COUNTY} County's 1.0 plan identifies and profiles hazards at the **county level** — there is no ` +
      `per-jurisdiction Local Hazards of Concern table or jurisdiction-specific hazard narrative in the source ` +
      `for this municipality. See the county [hazard profiles](../${F_HAZ}) and the Risk Assessment in the ` +
      `[main plan](../${F_MAIN}). This annex carries this jurisdiction's mitigation **capabilities** and ` +
      `**actions**, which are jurisdiction-specific._\n`);
  } else {
    M.push('## Local Hazards of Concern\n');
    M.push('Ratings recorded during the jurisdictional interview: **Previous Occurrence**, **Future ' +
      'Occurrence**, and **Loss of Life & Property** (High / Medium / Low). The Location Description is the ' +
      'jurisdiction representative\'s verbatim note.\n');
    if (hoc.length) M.push(mdTable(['Hazard of Concern', 'Previous Occurrence', 'Future Occurrence', 'Loss of Life & Property', 'Location Description'], hoc));
    else if (HOC_SOURCE === 'none') M.push('_This county\'s plan has no structured Local Hazards of Concern table; the hazards this jurisdiction identified as "of concern" — with previous/future-occurrence and loss ratings — are recorded in prose in the **Local Impacts — Jurisdiction-Specific Narrative** section below._\n');
    else M.push('_No hazards of concern recorded for this jurisdiction in the source._\n');

    const blues = blue || {};
    const blueHazards = HAZARDS.filter(h => blues[h] && blues[h].trim());
    M.push('\n## Local Impacts — Jurisdiction-Specific Narrative\n');
    M.push('The authored per-hazard narrative shown in the light-blue "Jurisdictional Annex" boxes on the ' +
      'Hazards page when this jurisdiction is selected (present only for hazards the jurisdiction added local ' +
      'detail to; verbatim from the source).\n');
    if (blueHazards.length) {
      for (const h of blueHazards) { M.push(`\n### ${h}\n`); M.push(blues[h].split('\n').map(l => l.trim()).filter(Boolean).join('\n\n')); }
      M.push('');
    } else if (blue === null) {
      M.push('_Not available: the blue boxes render only when the jurisdiction is selected in the site dropdown, ' +
        'and this jurisdiction was not selectable at scrape time (see note above)._\n');
    } else {
      M.push('_No jurisdiction-specific hazard narrative (blue boxes) was present for this jurisdiction in the source._\n');
    }
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

// dropdown-missing jurisdictions: sliced from county-wide tables by geoid/name regex
function buildMissing(m) {
  const sL = readRaw('county_strategies.txt');
  const re = new RegExp(m.geoidRe);
  const hoc = hocFromCounty(c => re.test(c));
  const caps = m.capsFilter ? extractCapabilities(sL, m.capsFilter) : [];
  const proposed = tabRowsWhere(sL, 7, c => re.test(c));
  const inventory = tabRowsWhere(sL, 4, c => re.test(c));
  return emitAnnex(m.display, { hoc, caps, proposed, inventory, blue: null,
    note: `Built from the county-wide tables at <${BASE}/> filtered to this jurisdiction. ` +
      (m.resolvedNote ? m.resolvedNote + ' ' : '') +
      `This jurisdiction participates in the plan and appears throughout the county data, but was not ` +
      `selectable in the site's jurisdiction dropdown at scrape time, so its filtered views (and blue-box ` +
      `narrative) could not be captured directly; action/capability rows are a best-effort slice of the ` +
      `county tables and may be incomplete.` });
}

// ---- ANNEX INDEX ----
function buildAnnexIndex(built) {
  const P = [];
  P.push(`# ${COUNTY} County LHMP v1.0 — Jurisdictional Annexes`);
  P.push('');
  P.push(`> Index of the ${built.length} jurisdictional annexes for the ${COUNTY} County Multi-Jurisdictional ` +
    `All-Hazards Mitigation Plan (v1.0), ${SRC_NOTE}. Each annex carries that jurisdiction's Local Hazards of ` +
    `Concern, authored per-hazard local-impact narrative ("blue boxes"), mitigation capabilities, and ` +
    `mitigation actions. Shared content is in the [main plan](./${F_MAIN}) and ` +
    `[hazard profiles](./${F_HAZ}).`);
  P.push('');
  P.push('| Jurisdiction | Annex |');
  P.push('| --- | --- |');
  for (const j of built.slice().sort()) P.push(`| ${j} | [\`jurisdictional-annexes/${kebab(j)}.md\`](./jurisdictional-annexes/${kebab(j)}.md) |`);
  P.push('');
  fs.writeFileSync(path.join(OUT, F_ANX), P.join('\n'));
  console.log('wrote ' + F_ANX);
}

// ---- run ----
if (process.argv[4] === 'test') { process.stdout.write(cleanPage(process.argv[5], process.argv[6])); process.exit(0); }
buildMain();
buildHazards();
const built = [];
for (const j of JURIS) { if (buildAnnex(j)) built.push(j); }
for (const m of MISSING) { if (buildMissing(m)) built.push(m.display); }
buildAnnexIndex(built);
console.log('DONE');
