// Deterministic assembler: cleaned Hamilton MitigateNY innerText -> structured markdown.
// Faithful (verbatim narrative), no invention. Produces:
//   <OUT>/hamilton-lhmp-v1.md        (main plan: About, Planning Process, Risk, Strategy + indexes)
//   <OUT>/hamilton-lhmp-hazards.md   (All-Hazards intro + 18 hazard profiles + Other Hazards)
//   <OUT>/hamilton-lhmp-annexes.md   (annex overview + index/links)
//   <OUT>/jurisdictional-annexes/*.md (one per jurisdiction)
const fs = require('fs');
const path = require('path');
const CFG = require('./ham_config');
const DATA = process.argv[2] || 'hamilton/data';
const OUT = process.argv[3] || 'hamilton/out';
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.join(OUT, 'jurisdictional-annexes'), { recursive: true });

const COUNTY = 'Hamilton';
const FIPS = '36041';
const SITE = 'https://hamilton.mitigateny.org/';
const HAZARDS = CFG.HAZARDS;
const JURIS = CFG.JURIS;

const NAV = new Set(['MITIGATION PLANNER', 'LOGIN', 'HOME', 'PLANNING PROCESS', 'HAZARDS', 'RISK', 'STRATEGIES', 'ABOUT', 'Mitigation Planner', 'Home', 'Planning Process', 'Hazards', 'Risk', 'Strategies', 'About', COUNTY.toUpperCase() + ' (COUNTY)']);
const isJuris = (s) => /\((County|Town|Village)\)$/i.test(s.trim());
// strip only trailing spaces/CR — NOT tabs (a trailing tab marks an empty last table cell,
// e.g. an empty Location Description; stripping it corrupts the column count for tabRows()).
const readLines = (f) => fs.readFileSync(path.join(DATA, f), 'utf8').split('\n').map(l => l.replace(/[ \r]+$/, ''));
const exists = (f) => fs.existsSync(path.join(DATA, f));
const fslug = (s) => s.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
const kebab = (s) => s.toLowerCase().replace(/[()]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// prettify dropdown text ("Indian lake (Town)" -> "Indian Lake (Town)") for display only
const pretty = (s) => s.replace(/\b([a-z])/g, (m, c) => c.toUpperCase());
function loadBlue(slugForFile) {
  const p = path.join(DATA, `blue_${slugForFile}.json`);
  if (!fs.existsSync(p)) return {};
  try { return JSON.parse(fs.readFileSync(p, 'utf8')).boxes || {}; } catch (e) { return {}; }
}

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

const COLLAPSE_RUN = 16;
const isSentence = (t) => t.length > 65 || /[.!?:,]$/.test(t);
function toMarkdown(submenu, content, { stripNoise = true, collapse = true } = {}) {
  const h2 = new Set(), h3 = new Set();
  for (const s of submenu) { if (NAV.has(s) || isJuris(s)) continue; if (s === s.toUpperCase() && /[A-Z]/.test(s)) h2.add(s); else h3.add(s); }
  const lines = dedupeConsecutive(content);
  const out = [];
  let tbl = null;
  let buf = [];
  const flushTbl = () => {
    if (!tbl) return;
    const rows = tbl; tbl = null;
    if (rows.some(r => r.some(c => /DOWNLOAD CSV/i.test(c)))) {
      out.push('', '_[auto-generated data table omitted -- regenerated from datasets in the source site / 2.0 platform.]_', '');
      return;
    }
    const cols = rows[0].length;
    out.push('', '| ' + rows[0].join(' | ') + ' |', '| ' + rows[0].map(() => '---').join(' | ') + ' |');
    for (let i = 1; i < rows.length; i++) { const c = rows[i].slice(); while (c.length < cols) c.push(''); out.push('| ' + c.join(' | ') + ' |'); }
  };
  const flushBuf = () => {
    if (!buf.length) return;
    if (collapse && buf.length >= COLLAPSE_RUN) out.push('', `_[${buf.length} data rows omitted — auto-generated table in the source site; see the jurisdictional annexes for the authored per-jurisdiction slices.]_`, '');
    else for (const b of buf) out.push(b);
    buf = [];
  };
  const emit = (line) => { flushBuf(); out.push(line); };
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) { flushTbl(); flushBuf(); if (out[out.length - 1] !== '') out.push(''); continue; }
    if (raw.includes('\t')) {
      flushBuf();
      if (!tbl) tbl = [];
      tbl.push(raw.split('\t').map(x => x.trim()));
      continue;
    }
    flushTbl();
    if (h2.has(t)) { flushBuf(); out.push('', '## ' + t, ''); continue; }
    if (h3.has(t)) { flushBuf(); out.push('', '### ' + t, ''); continue; }
    if (stripNoise && isNoise(t)) continue;
    const safe = t.replace(/^#+\s?/, '');
    if (collapse && !isSentence(safe)) { buf.push(safe); continue; }
    emit(safe);
  }
  flushTbl();
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

const SRC_NOTE = `> **Source:** faithfully transcribed from the MitigateNY 1.0 web plan at <${SITE}> ` +
  `(a NYS DHSES / University at Albany AVAIL pilot). This Markdown is a deterministic scrape of the site's ` +
  `narrative content, assembled as the input for a 1.0 → 2.0 transcription. Interactive data tables, maps, and ` +
  `charts in the source are auto-generated from datasets (filtered by geoid); only their narrative framing and ` +
  `the qualitative/tabular content that carries authored text are reproduced here.`;

// ---- FILE 1: MAIN PLAN ----
function buildMain() {
  const P = [];
  P.push(`# ${COUNTY} County, New York — Multi-Jurisdictional Hazard Mitigation Plan`);
  P.push(`## Version 1.0 (MitigateNY pilot)`);
  P.push('');
  P.push(SRC_NOTE);
  P.push('');
  P.push(`**Plan type:** Multi-jurisdictional (${COUNTY} County + ${JURIS.length} participating towns and villages). ` +
    `**Hazards profiled:** ${HAZARDS.length}. **County FIPS:** ${FIPS}.`);
  P.push('');
  P.push('**Companion files:** ' +
    '[Hazard profiles](./hamilton-lhmp-hazards.md) · ' +
    '[Jurisdictional annexes index](./hamilton-lhmp-annexes.md) · ' +
    '[per-jurisdiction annexes](./jurisdictional-annexes/)');
  P.push('');
  P.push('---\n');

  P.push('# 1. About This Plan\n');
  P.push(cleanPage('county_about.txt', 'ABOUT'));
  P.push('\n---\n');

  P.push('# 2. Planning Process\n');
  P.push(cleanPage('county_planning_process.txt', 'PLANNING PROCESS'));
  P.push('\n---\n');

  P.push('# 3. Risk Assessment\n');
  P.push(cleanPage('county_risk.txt', 'RISK'));
  P.push('\n---\n');

  P.push('# 4. Mitigation Strategy\n');
  P.push(cleanPage('county_strategies.txt', 'STRATEGIES'));
  P.push('\n---\n');

  P.push('# 5. Hazards\n');
  P.push(`The ${HAZARDS.length} profiled hazards and the "Other Hazards" reference are in a companion file: ` +
    '[**hamilton-lhmp-hazards.md**](./hamilton-lhmp-hazards.md).\n');
  P.push('\n---\n');

  P.push('# 6. Jurisdictional Annexes\n');
  P.push('Each participating jurisdiction has its own annex file capturing its Local Hazards of Concern, ' +
    'jurisdiction-specific hazard narrative, mitigation capabilities, and mitigation actions. ' +
    'See the [annexes index](./hamilton-lhmp-annexes.md) and [`jurisdictional-annexes/`](./jurisdictional-annexes/).\n');

  fs.writeFileSync(path.join(OUT, 'hamilton-lhmp-v1.md'), P.join('\n'));
  console.log('wrote hamilton-lhmp-v1.md');
}

// ---- FILE 2: HAZARDS ----
function buildHazards() {
  const P = [];
  P.push(`# ${COUNTY} County, New York — Hazard Profiles`);
  P.push(`## Version 1.0 (MitigateNY pilot) — companion to [hamilton-lhmp-v1.md](./hamilton-lhmp-v1.md)`);
  P.push('');
  P.push(SRC_NOTE);
  P.push('');
  P.push('---\n');

  P.push('## Hazards Overview\n');
  {
    const { submenu, content } = split(readLines('county_hazards_ALL.txt'), 'HAZARDS');
    const cut = content.findIndex(l => /- Local Hazards of Concern Table -/.test(l.trim()));
    const narrative = cut < 0 ? content : content.slice(0, cut);
    P.push(toMarkdown(submenu, dropDupHalf(narrative)));
    // county-wide master Local Hazards of Concern table (authored interview ratings, all jurisdictions)
    const rows = tabRows(readLines('county_hazards_ALL.txt'), 6);
    if (rows.length) {
      P.push('\n### Hamilton County — Local Hazards of Concern (all jurisdictions)\n');
      P.push('_Authored interview ratings for every participating jurisdiction: **Previous Occurrence**, ' +
        '**Future Occurrence**, **Loss of Life & Property** (High / Medium / Low)._\n');
      P.push(mdTable(['Community', 'Hazard of Concern', 'Previous Occurrence', 'Future Occurrence', 'Loss of Life & Property', 'Location Description'], rows));
    }
  }
  P.push('\n---\n');

  P.push('## Hazard Profiles\n');
  P.push(`_County-level characteristics and authored local impacts for each of the ${HAZARDS.length} profiled ` +
    'hazards. Auto-generated data tables (loss statistics, storm events, building/critical-facility inventories, ' +
    'the full per-jurisdiction hazards-of-concern record table) are collapsed; jurisdiction-specific local ' +
    'impacts are in the [annexes](./hamilton-lhmp-annexes.md)._\n');
  // end-of-authored-content markers: the giant auto-generated record dumps start here
  const HAZ_END = /(- Local Hazards of Concern Table -|^Search \d+ Records|^Built Environment Table$|^Critical Facilities Table$|- Loss Estimates? -|- Storm Events -|- Disaster Declarations -)/;
  for (const h of HAZARDS) {
    const f = 'county_hazard_' + fslug(h) + '.txt';
    P.push(`\n### ${h}\n`);
    if (!exists(f)) { P.push('_Not captured._\n'); continue; }
    const lines = readLines(f);
    const a = lines.findIndex(l => l.trim() === h + ' Characteristics');
    if (a < 0) { P.push('_No characteristics narrative in source._\n'); continue; }
    const li = lines.findIndex((l, i) => i > a && /- Local Impacts -/.test(l));
    // Characteristics: a+1 .. local-impacts marker (or +60)
    const charBody = dedupeConsecutive(lines.slice(a + 1, li < 0 ? a + 60 : li).map(x => x.trim()).filter(x => x && !isNoise(x)));
    P.push('#### Characteristics\n');
    P.push(charBody.join('\n\n'));
    P.push('');
    // Local Impacts (authored): after marker .. first auto-generated record-dump marker (or end)
    if (li >= 0) {
      let end = lines.findIndex((l, i) => i > li && HAZ_END.test(l.trim()));
      if (end < 0) end = lines.length;
      const region = lines.slice(li + 1, end);
      const cleaned = toMarkdown([], region, { stripNoise: true, collapse: true }).trim();
      P.push(`#### Local Impacts — ${COUNTY} County\n`);
      P.push(cleaned && cleaned !== '' ? cleaned : '_No authored county-level local-impacts narrative in source (data-only)._');
      P.push('');
    }
  }
  P.push('\n---\n');

  // Other Hazards reference page — trim the trailing auto-generated record table
  if (exists('county_other_hazards.txt')) {
    P.push('## Other Hazards (Reference)\n');
    P.push('_Non-natural / additional hazards carried as a reference page in the source site._\n');
    const { submenu, content } = split(readLines('county_other_hazards.txt'), 'HAZARDS');
    let cut = content.findIndex(l => /- Local Hazards of Concern Table -/.test(l.trim()));
    const trimmed = cut < 0 ? content : content.slice(0, cut);
    P.push(toMarkdown(submenu, dropDupHalf(trimmed)));
    P.push('');
  }

  fs.writeFileSync(path.join(OUT, 'hamilton-lhmp-hazards.md'), P.join('\n'));
  console.log('wrote hamilton-lhmp-hazards.md');
}

// ---- FILE 3: ANNEXES INDEX ----
function buildAnnexesIndex(built) {
  const P = [];
  P.push(`# ${COUNTY} County, New York — Jurisdictional Annexes`);
  P.push(`## Version 1.0 (MitigateNY pilot) — companion to [hamilton-lhmp-v1.md](./hamilton-lhmp-v1.md)`);
  P.push('');
  P.push(SRC_NOTE);
  P.push('');
  P.push(`Each participating jurisdiction has its own annex file. Each carries that jurisdiction's ` +
    `**Local Hazards of Concern** (with verbatim location notes), **Local Impacts — Jurisdiction-Specific ` +
    `Narrative** (the authored per-hazard "blue box" prose), **Mitigation Capabilities**, and ` +
    `**Mitigation Actions** (proposed + additional inventory).`);
  P.push('');
  P.push('---\n');
  P.push('## Participating Jurisdictions\n');
  for (const j of JURIS) {
    const disp = pretty(j);
    const line = built[j] ? `- [${disp}](./jurisdictional-annexes/${kebab(j)}.md)` : `- ${disp} — _no annex data captured in source_`;
    P.push(line);
  }
  P.push('');
  fs.writeFileSync(path.join(OUT, 'hamilton-lhmp-annexes.md'), P.join('\n'));
  console.log('wrote hamilton-lhmp-annexes.md');
}

// ---- ANNEX (one per jurisdiction) ----
function buildAnnex(display) {
  const s = fslug(display); const slug = kebab(display);
  const hf = `annex_${s}_hazards.txt`, sf = `annex_${s}_strategies.txt`, rf = `annex_${s}_risk.txt`;
  if (!exists(hf)) { console.log('  skip (no data):', display); return false; }
  const hL = readLines(hf), sL = exists(sf) ? readLines(sf) : [];
  const hoc = tabRows(hL, 6).map(r => r.slice(1));
  const caps = extractCapabilities(sL);
  const proposed = tabRows(sL, 7);
  const inventory = tabRows(sL, 4);
  const blue = loadBlue(s);
  return emitAnnex(display, { hoc, caps, proposed, inventory, blue });
}

function emitAnnex(display, { hoc, caps, proposed, inventory, blue }) {
  const slug = kebab(display); const disp = pretty(display);
  const M = [];
  M.push(`# Jurisdictional Annex — ${disp}`);
  M.push(`\n_${COUNTY} County Multi-Jurisdictional Hazard Mitigation Plan, Version 1.0 (MitigateNY pilot). ` +
    `Scraped from <${SITE}> with the jurisdiction filter set to **${disp}**. Shared county narrative is in the ` +
    `[main plan](../hamilton-lhmp-v1.md) and [hazard profiles](../hamilton-lhmp-hazards.md); this annex carries ` +
    `the jurisdiction-specific content._\n`);
  M.push('---\n');

  M.push('## Local Hazards of Concern\n');
  M.push('Ratings recorded during the jurisdictional interview: **Previous Occurrence**, **Future Occurrence**, ' +
    'and **Loss of Life & Property** (High / Medium / Low). The Location Description is the jurisdiction ' +
    'representative\'s verbatim note.\n');
  if (hoc.length) M.push(mdTable(['Hazard of Concern', 'Previous Occurrence', 'Future Occurrence', 'Loss of Life & Property', 'Location Description'], hoc));
  else M.push('_No hazards of concern recorded for this jurisdiction in the source._\n');

  const blues = blue || {};
  const blueHazards = HAZARDS.filter(h => blues[h] && blues[h].trim());
  M.push('\n## Local Impacts — Jurisdiction-Specific Narrative\n');
  M.push('The authored per-hazard narrative shown in the light-blue "Jurisdictional Annex" boxes on the Hazards ' +
    'page when this jurisdiction is selected (present only for hazards the jurisdiction added local detail to; ' +
    'verbatim from the source).\n');
  if (blueHazards.length) {
    for (const h of blueHazards) { M.push(`\n### ${h}\n`); M.push(blues[h].split('\n').map(l => l.trim()).filter(Boolean).join('\n\n')); }
    M.push('');
  } else {
    M.push('_No jurisdiction-specific hazard narrative (blue boxes) was present for this jurisdiction in the source._\n');
  }

  M.push('\n## Mitigation Capabilities\n');
  if (caps.length) M.push(mdTable(['Capability', 'Category', 'Type', 'Responsible Authority'], caps));
  else M.push('_No capabilities recorded for this jurisdiction in the source._\n');

  M.push('\n## Mitigation Actions — Proposed (HMP)\n');
  M.push('_Actions prioritized for this plan update (status **Proposed-HMP**), with priority score, timeframe, ' +
    'estimated cost, and lead agency._\n');
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

// ---- test / selective modes ----
if (process.argv[4] === 'test') { process.stdout.write(cleanPage(process.argv[5], process.argv[6])); process.exit(0); }

buildMain();
buildHazards();
const built = {};
for (const j of JURIS) built[j] = buildAnnex(j);
buildAnnexesIndex(built);
module.exports = { cleanPage, buildAnnex, buildMain, buildHazards };
