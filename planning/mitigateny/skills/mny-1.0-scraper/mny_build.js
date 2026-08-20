// Generic deterministic assembler: cleaned MNY 1.0 innerText -> structured markdown.
// Config-driven via MNY_CONFIG (path to *_config.js providing COUNTY/FIPS/SITE/SLUG/HAZARDS/JURIS/EXTRA_HAZARD_PAGES).
// Faithful (verbatim narrative), no invention. Produces:
//   <OUT>/<slug>-lhmp-v1.md, <slug>-lhmp-hazards.md, <slug>-lhmp-annexes.md, jurisdictional-annexes/*.md
// Usage: MNY_CONFIG=./niagara_config node mny_build.js <dataDir> <outDir>
const fs = require('fs');
const path = require('path');
const CFG = require(process.env.MNY_CONFIG || './ham_config');
const DATA = process.argv[2] || 'data';
const OUT = process.argv[3] || 'out';
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.join(OUT, 'jurisdictional-annexes'), { recursive: true });

const COUNTY = CFG.COUNTY;
const FIPS = CFG.FIPS;
const SITE = CFG.SITE;
const SLUG = CFG.SLUG;
const HAZARDS = CFG.HAZARDS;
const JURIS = CFG.JURIS;
const V1 = `${SLUG}-lhmp-v1.md`, HAZF = `${SLUG}-lhmp-hazards.md`, ANNF = `${SLUG}-lhmp-annexes.md`;

const NAV = new Set(['MITIGATION PLANNER', 'LOGIN', 'HOME', 'PLANNING PROCESS', 'HAZARDS', 'RISK', 'STRATEGIES', 'ABOUT', 'Mitigation Planner', 'Home', 'Planning Process', 'Hazards', 'Risk', 'Strategies', 'About', COUNTY.toUpperCase() + ' (COUNTY)']);
const isJuris = (s) => /\(\s*(County|Town|Village|City)\s*\)$/i.test(s.trim());
const readLines = (f) => fs.readFileSync(path.join(DATA, f), 'utf8').split('\n').map(l => l.replace(/[ \r]+$/, ''));
const exists = (f) => fs.existsSync(path.join(DATA, f));
const fslug = (s) => s.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
// display normalizer: "Lockport city ( City)" -> "Lockport (City)"; "Indian lake (Town)" -> "Indian Lake (Town)"
const cleanType = (s) => s.replace(/\(\s*(County|Town|Village|City)\s*\)/i, (m, t) => '(' + t[0].toUpperCase() + t.slice(1).toLowerCase() + ')');
const pretty = (s) => { let x = cleanType(s).replace(/\s+(city|town|village|county)\s*(\([A-Za-z]+\))/i, ' $2'); return x.replace(/\b([a-z])/g, (m, c) => c.toUpperCase()); };
const kebab = (s) => pretty(s).toLowerCase().replace(/[()]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const normKey = (s) => pretty(s).toLowerCase().replace(/\s+/g, ' ').trim();
function loadBlue(slugForFile) {
  const p = path.join(DATA, `blue_${slugForFile}.json`);
  if (!fs.existsSync(p)) return {};
  try { return JSON.parse(fs.readFileSync(p, 'utf8')).boxes || {}; } catch (e) { return {}; }
}

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
  const occ = [];
  lines.forEach((l, i) => { if (l.trim() === 'Capabilities Table') occ.push(i); });
  if (!occ.length) return [];
  const s = occ[occ.length - 1];
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
// county-wide master HoC rows (6 col): [Community, Hazard, Prev, Future, Loss, Location]
function countyHoc() { return exists('county_hazards_ALL.txt') ? tabRows(readLines('county_hazards_ALL.txt'), 6) : []; }
// fallback HoC for a jurisdiction sliced from the county master table (Fulton-style empty filtered views)
function hocFromCounty(display) {
  const k = normKey(display);
  return countyHoc().filter(r => normKey(r[0]) === k).map(r => r.slice(1));
}
// municipality key "name|type" for matching dropdown labels to "<Type> of <Name>:" prose lines
const muniKey = (name, type) => `${name.toLowerCase().replace(/\s+/g, ' ').trim()}|${type.toLowerCase()}`;
const jurKey = (display) => { const m = pretty(display).match(/^(.+?)\s*\((County|Town|Village|City)\)$/); return m ? muniKey(m[1], m[2]) : pretty(display).toLowerCase(); };
// Some narrative-style plans (e.g. Niagara) author no HoC rating table; instead the county All-Hazards page
// carries a "Hazards of Concern from Qualitative Feedback from Jurisdictional Teams" list of one-liners.
let _qual = null;
function qualHoc() {
  if (_qual) return _qual; _qual = {};
  if (!exists('county_hazards_ALL.txt')) return _qual;
  const L = readLines('county_hazards_ALL.txt');
  const start = L.findIndex(l => /^Hazards of Concern from Qualitative Feedback/i.test(l.trim()));
  if (start < 0) return _qual;
  for (let i = start + 1; i < L.length; i++) {
    const m = L[i].trim().match(/^(Village|Town|City) of (.+?):\s*(.+)$/);
    if (m) _qual[muniKey(m[2], m[1])] = { display: `${m[2]} (${m[1]})`, hazards: m[3].trim() };
    else if (L[i].trim() && Object.keys(_qual).length) break;
  }
  return _qual;
}

// --- Narrative-plan (Niagara-style) extractors: per-jurisdiction content lives in the annex-view
// "<Juris> Jurisdictional Annex" boxes + a filtered Problem Statements table, not per-hazard blue boxes. ---
function jurisBoxLines(file, endMarkers) {
  if (!exists(file)) return [];
  const L = readLines(file);
  const start = L.findIndex(l => /Jurisdictional Annex$/.test(l.trim()));
  if (start < 0) return [];
  let end = L.length;
  for (let i = start + 1; i < L.length; i++) { if (endMarkers.some(m => m.test(L[i].trim()))) { end = i; break; } }
  return L.slice(start + 1, end).map(x => x.trim()).filter(Boolean);
}
// hazards-of-concern list from the hazards-view annex box
function annexHazardBox(hf) {
  return jurisBoxLines(hf, [/^Events with Highest/, /DOWNLOAD CSV/i, /^Hazard Loss by/]);
}
// jurisdiction community profile from the risk-view annex box (stops at shared county boilerplate)
function communityProfile(rf) {
  return jurisBoxLines(rf, [/^VULNERABILITY$/i, /^Social Vulnerability$/i, /DOWNLOAD CSV/i, /^Problem Areas$/i]);
}
// jurisdiction-filtered problem statements (3-col: Jurisdiction | Problem Statement | Associated Hazards)
function problemStatements(rf) {
  if (!exists(rf)) return [];
  const L = readLines(rf);
  const s = L.findIndex(l => /^Problem Statements Table$/i.test(l.trim()));
  if (s < 0) return [];
  let e = L.findIndex((l, i) => i > s && /^(CHANGES IN RISK|Open Space|Previous Action)/i.test(l.trim()));
  if (e < 0) e = L.length;
  return tabRows(L.slice(s, e), 3).filter(r => !/PROBLEM STATEMENT/i.test(r[1]) && r[1] && r[1].length > 12);
}

const SRC_NOTE = `> **Source:** faithfully transcribed from the MitigateNY 1.0 web plan at <${SITE}> ` +
  `(a NYS DHSES / University at Albany AVAIL pilot). This Markdown is a deterministic scrape of the site's ` +
  `narrative content, assembled as the input for a 1.0 → 2.0 transcription. Interactive data tables, maps, and ` +
  `charts in the source are auto-generated from datasets (filtered by geoid); only their narrative framing and ` +
  `the qualitative/tabular content that carries authored text are reproduced here.`;

function buildMain() {
  const P = [];
  P.push(`# ${COUNTY} County, New York — Multi-Jurisdictional Hazard Mitigation Plan`);
  P.push(`## Version 1.0 (MitigateNY pilot)`);
  P.push('');
  P.push(SRC_NOTE);
  P.push('');
  P.push(`**Plan type:** Multi-jurisdictional (${COUNTY} County + ${JURIS.length} participating municipalities). ` +
    `**Hazards profiled:** ${HAZARDS.length}. **County FIPS:** ${FIPS}.`);
  P.push('');
  P.push(`**Companion files:** [Hazard profiles](./${HAZF}) · [Jurisdictional annexes index](./${ANNF}) · [per-jurisdiction annexes](./jurisdictional-annexes/)`);
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
  P.push(`The ${HAZARDS.length} profiled hazards and the "Other Hazards" reference are in a companion file: [**${HAZF}**](./${HAZF}).\n`);
  P.push('\n---\n');
  P.push('# 6. Jurisdictional Annexes\n');
  P.push(`Each participating jurisdiction has its own annex file. See the [annexes index](./${ANNF}) and [\`jurisdictional-annexes/\`](./jurisdictional-annexes/).\n`);
  fs.writeFileSync(path.join(OUT, V1), P.join('\n'));
  console.log('wrote ' + V1);
}

function buildHazards() {
  const P = [];
  P.push(`# ${COUNTY} County, New York — Hazard Profiles`);
  P.push(`## Version 1.0 (MitigateNY pilot) — companion to [${V1}](./${V1})`);
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
    const rows = countyHoc();
    if (rows.length) {
      P.push(`\n### ${COUNTY} County — Local Hazards of Concern (all jurisdictions)\n`);
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
    `impacts are in the [annexes](./${ANNF})._\n`);
  const HAZ_END = /(- Local Hazards of Concern Table -|^Search \d+ Records|^Built Environment Table$|^Critical Facilities Table$|- Loss Estimates? -|- Storm Events -|- Disaster Declarations -)/;
  for (const h of HAZARDS) {
    const f = 'county_hazard_' + fslug(h) + '.txt';
    P.push(`\n### ${h}\n`);
    if (!exists(f)) { P.push('_Not captured._\n'); continue; }
    const lines = readLines(f);
    const a = lines.findIndex(l => l.trim() === h + ' Characteristics');
    if (a < 0) { P.push('_No characteristics narrative in source._\n'); continue; }
    const li = lines.findIndex((l, i) => i > a && /- Local Impacts -/.test(l));
    const charBody = dedupeConsecutive(lines.slice(a + 1, li < 0 ? a + 60 : li).map(x => x.trim()).filter(x => x && !isNoise(x)));
    P.push('#### Characteristics\n');
    P.push(charBody.join('\n\n'));
    P.push('');
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
  if (exists('county_other_hazards.txt')) {
    P.push('## Other Hazards (Reference)\n');
    P.push('_Non-natural / additional hazards carried as a reference page in the source site._\n');
    const { submenu, content } = split(readLines('county_other_hazards.txt'), 'HAZARDS');
    let cut = content.findIndex(l => /- Local Hazards of Concern Table -/.test(l.trim()));
    const trimmed = cut < 0 ? content : content.slice(0, cut);
    P.push(toMarkdown(submenu, dropDupHalf(trimmed)));
    P.push('');
  }
  fs.writeFileSync(path.join(OUT, HAZF), P.join('\n'));
  console.log('wrote ' + HAZF);
}

function buildAnnexesIndex(built) {
  const P = [];
  P.push(`# ${COUNTY} County, New York — Jurisdictional Annexes`);
  P.push(`## Version 1.0 (MitigateNY pilot) — companion to [${V1}](./${V1})`);
  P.push('');
  P.push(SRC_NOTE);
  P.push('');
  P.push(`Each participating jurisdiction has its own annex file: **Local Hazards of Concern** (verbatim location ` +
    `notes), **Local Impacts — Jurisdiction-Specific Narrative** (authored per-hazard "blue box" prose), ` +
    `**Mitigation Capabilities**, and **Mitigation Actions** (proposed + additional inventory).`);
  P.push('');
  P.push('---\n');
  P.push('## Participating Jurisdictions\n');
  for (const j of JURIS) {
    const disp = pretty(j);
    P.push(built[j] ? `- [${disp}](./jurisdictional-annexes/${kebab(j)}.md)` : `- ${disp} — _no annex data captured in source_`);
  }
  P.push('');
  fs.writeFileSync(path.join(OUT, ANNF), P.join('\n'));
  console.log('wrote ' + ANNF);
}

function buildAnnex(display) {
  const s = fslug(display);
  const hf = `annex_${s}_hazards.txt`, sf = `annex_${s}_strategies.txt`, rf = `annex_${s}_risk.txt`;
  const hasFiltered = exists(hf);
  const hL = hasFiltered ? readLines(hf) : [], sL = exists(sf) ? readLines(sf) : [];
  let hoc = hasFiltered ? tabRows(hL, 6).map(r => r.slice(1)) : [];
  let hocSource = 'filtered';
  if (!hoc.length) { const fb = hocFromCounty(display); if (fb.length) { hoc = fb; hocSource = 'county-table'; } }
  const caps = extractCapabilities(sL);
  const proposed = tabRows(sL, 7);
  const inventory = tabRows(sL, 4);
  const blue = loadBlue(s);
  const qual = qualHoc()[jurKey(display)];  // narrative-plan hazards-of-concern one-liner (Niagara-style)
  // Niagara-style narrative pieces (from the annex-view "<Juris> Jurisdictional Annex" boxes)
  const hazBox = annexHazardBox(hf);
  const profile = communityProfile(rf);
  const problems = problemStatements(rf);
  // strategies view sometimes crashes the source SPA (detached frame) for a few jurisdictions
  const strategiesMissing = !exists(sf) || sL.length < 5;
  // consider the jurisdiction "present" if it has ANY authored content
  if (!hoc.length && !caps.length && !proposed.length && !inventory.length && !Object.keys(blue).length &&
      !qual && !hazBox.length && !profile.length && !problems.length) {
    console.log('  skip (no data):', display); return false;
  }
  return emitAnnex(display, { hoc, hocSource, caps, proposed, inventory, blue, qual, hazBox, profile, problems, strategiesMissing });
}

function emitAnnex(display, { hoc, hocSource, caps, proposed, inventory, blue, qual, hazBox, profile, problems, strategiesMissing }) {
  const slug = kebab(display); const disp = pretty(display);
  const M = [];
  M.push(`# Jurisdictional Annex — ${disp}`);
  M.push(`\n_${COUNTY} County Multi-Jurisdictional Hazard Mitigation Plan, Version 1.0 (MitigateNY pilot). ` +
    `Scraped from <${SITE}> with the jurisdiction filter set to **${disp}**. Shared county narrative is in the ` +
    `[main plan](../${V1}) and [hazard profiles](../${HAZF}); this annex carries the jurisdiction-specific content._\n`);
  M.push('---\n');

  // Community profile (narrative-plan: jurisdiction-specific opening paragraph of the Risk annex box)
  if (profile && profile.length) {
    M.push('## Community Profile\n');
    M.push(profile.join('\n\n'));
    M.push('');
  }

  M.push('\n## Local Hazards of Concern\n');
  const blues = blue || {};
  const blueHazards = HAZARDS.filter(h => blues[h] && blues[h].trim());
  if (hoc.length) {
    M.push('Ratings recorded during the jurisdictional interview: **Previous Occurrence**, **Future Occurrence**, ' +
      'and **Loss of Life & Property** (High / Medium / Low). The Location Description is the jurisdiction ' +
      'representative\'s verbatim note.\n');
    if (hocSource === 'county-table') M.push('_(Sliced from the county-wide Local Hazards of Concern table; this jurisdiction\'s filtered view returned no rows.)_\n');
    M.push(mdTable(['Hazard of Concern', 'Previous Occurrence', 'Future Occurrence', 'Loss of Life & Property', 'Location Description'], hoc));
  } else if (hazBox && hazBox.length) {
    // narrative-plan: the "<Juris> Jurisdictional Annex" box lists hazards of concern as authored prose
    M.push(hazBox.join('\n\n'));
    M.push('');
  } else if (qual) {
    M.push(`**Hazards of concern identified by the jurisdictional team:** ${qual.hazards}\n`);
  } else M.push('_No hazards of concern recorded for this jurisdiction in the source._\n');

  if (blueHazards.length) {
    // per-hazard blue boxes (Delaware/Hamilton-style plans)
    M.push('\n## Local Impacts — Jurisdiction-Specific Narrative\n');
    M.push('The authored per-hazard narrative shown in the light-blue "Jurisdictional Annex" boxes on the Hazards ' +
      'page when this jurisdiction is selected (verbatim from the source).\n');
    for (const h of blueHazards) { M.push(`\n### ${h}\n`); M.push(blues[h].split('\n').map(l => l.trim()).filter(Boolean).join('\n\n')); }
    M.push('');
  }
  if (problems && problems.length) {
    // narrative-plan: jurisdiction-specific Problem Statements (the richest local-impacts content)
    M.push('\n## Problem Statements\n');
    M.push('_Problem statements developed with the jurisdictional team during the planning process, with the ' +
      'hazards associated with each (verbatim from the source)._\n');
    M.push(mdTable(['Problem Statement', 'Associated Hazards'], problems.map(r => [r[1], r[2] || ''])));
  }

  if (strategiesMissing) {
    M.push('\n## Mitigation Capabilities & Actions\n');
    M.push('_The source **Strategies** view for this jurisdiction failed to load (the 1.0 site\'s page crashed ' +
      'repeatedly during scraping — a source-side defect). Mitigation **capabilities** and **actions** ' +
      '(proposed + inventory) could not be captured and should be recovered manually during the 2.0 ' +
      'transcription._\n');
    fs.writeFileSync(path.join(OUT, 'jurisdictional-annexes', slug + '.md'), M.join('\n'));
    console.log('  annex:', slug + '.md', `(hoc=${hoc.length}/${hocSource} STRATEGIES-MISSING prof=${profile ? profile.length : 0} probs=${problems ? problems.length : 0})`);
    return true;
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
  console.log('  annex:', slug + '.md', `(hoc=${hoc.length}/${hocSource} caps=${caps.length} prop=${proposed.length} inv=${inventory.length} blue=${blueHazards.length} prof=${profile ? profile.length : 0} probs=${problems ? problems.length : 0})`);
  return true;
}

if (process.argv[4] === 'test') { process.stdout.write(cleanPage(process.argv[5], process.argv[6])); process.exit(0); }

buildMain();
buildHazards();
const built = {};
for (const j of JURIS) built[j] = buildAnnex(j);
buildAnnexesIndex(built);
module.exports = { cleanPage, buildAnnex, buildMain, buildHazards };
