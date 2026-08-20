/**
 * Step 1 of the Islip vertical slice: build the Jurisdictions-row payload.
 *
 * Reads the extracted annex JSON, maps annex tables onto the Jurisdictions
 * lexical columns per suffolk-annex-crosswalk.csv, and writes:
 *   payloads/juris_<geoid>.json   the payload for `dms dataset update`
 *   payloads/juris_<geoid>.md     the human review surface
 *
 * Nothing is written to the database here.
 *
 * Usage: node build_jurisdictions.mjs [geoid]     (default 3610338000 = Islip)
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildRoot, rootToText } from './lexical.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const CTX = path.resolve(HERE, '..');
const GEOID = process.argv[2] || '3610338000';

const annexDir = path.join(CTX, 'extracted', 'annexes');
const file = fs.readdirSync(annexDir).find(f => f.startsWith(GEOID + '_'));
if (!file) throw new Error(`No extracted annex for geoid ${GEOID}`);
const A = JSON.parse(fs.readFileSync(path.join(annexDir, file), 'utf8'));
const J = A.jurisdiction;
/**
 * NAME is the jurisdiction as prose ("the Town of Islip", "the Village of Patchogue").
 * Every generated sentence must use it. Hardcoding one jurisdiction's name here writes
 * that name into all 38 annexes' content — silently, since the payload still validates.
 */
const MUNI = String(J.jurisdictions_title).replace(/\s*\([^)]*\)\s*$/, '').trim();
const NAME = /^(Town|Village|City)$/i.test(J.municipality_type)
  ? `the ${J.municipality_type} of ${MUNI}`
  : (J.municipality_type === 'County' ? `${MUNI} County` : MUNI);

const cells = (row) => (Array.isArray(row) ? row : row.cells || row);
const tables = {};
for (const t of A.tables) if (t.table_label) tables[t.table_label] = t;
/**
 * Missing tables are NORMAL, not an error: the county chapter and Shinnecock omit Table O,
 * SCWA omits Q/R/S/T/U. Return [] and let the dependent column simply go unfilled.
 */
const rows = (label) => (tables[label] ? tables[label].rows.map(cells) : []);
const absentTables = [];
const has = (label) => {
  if (tables[label]) return true;
  if (!absentTables.includes(label)) absentTables.push(label);
  return false;
};
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const isBlank = (s) => { const c = clean(s); return !c || c === '-' || c === 'N/A' || c === 'NA'; };

const payload = {};   // column -> lexical root value
const notes = [];     // provenance / decisions, for the review markdown

// ── lhmp_declared_disasters ← Table C, col 3 (the only jurisdiction-authored column)
if (has('C')) {
  const items = rows('C').slice(1).map(r => ({
    runs: [
      { t: `${clean(r[0])} (${clean(r[1])}) — ${clean(r[2])}: `, b: true },
      { t: clean(r[3]) },
    ],
  }));
  payload.lhmp_declared_disasters = buildRoot([{ t: 'ul', items }]);
  notes.push(`lhmp_declared_disasters: Table C, ${items.length} declarations. Date + declaration number + event bolded; the authored loss summary follows verbatim.`);
}

// ── lhmp_historic_occurances ← Table D, col 4, boilerplate rows dropped
if (has('D')) {
  const all = rows('D').slice(1);
  /**
   * Detect the boilerplate sentence FROM THE DATA. Islip's is "This event had minimal impact
   * on the TOI and Town personnel were equipped to manage the event." — every jurisdiction
   * words its own differently, so a hardcoded regex silently dedupes nothing for the other 37.
   * Treat the single most-repeated answer as boilerplate when it dominates the column.
   */
  const freq = {};
  for (const r of all) { const v = clean(r[4]); if (v && !isBlank(v)) freq[v] = (freq[v] || 0) + 1; }
  const [topVal, topN] = Object.entries(freq).sort((a, b) => b[1] - a[1])[0] || [null, 0];
  const boilerplate = (topN >= 3 && topN / all.length >= 0.4) ? topVal : null;
  const kept = all.filter(r => !isBlank(r[4]) && clean(r[4]) !== boilerplate);
  const items = kept.map(r => ({
    runs: [{ t: `${clean(r[0])}: `, b: true }, { t: clean(r[4]) }],
  }));
  payload.lhmp_historic_occurances = buildRoot([{ t: 'ul', items }]);
  notes.push(`lhmp_historic_occurances: Table D, ${kept.length} of ${all.length} rows kept.` +
    (boilerplate
      ? ` ${topN} rows repeat one boilerplate sentence verbatim and were dropped (detected from the data, not hardcoded): "${boilerplate.slice(0, 120)}".`
      : ` No sentence repeated often enough to be treated as boilerplate, so every non-empty row was kept.`));
}

// ── lhmp_critical_buildings ← Table E, col 5 "Already Protected to 0.2% Flood Level"
if (has('E')) {
  const all = rows('E').slice(1);
  const yes = all.filter(r => clean(r[5]).toUpperCase() === 'Y');
  // 37 of 38 jurisdictions have ZERO facilities marked Y. Emitting "…0 are already
  // protected:" over an empty bullet list is worse than leaving the column unset — it
  // renders as a populated box asserting nothing. Islip (29 of 65) masked this.
  if (yes.length === 0) {
    notes.push(`lhmp_critical_buildings: OMITTED — Table E marks none of its ${all.length} critical facilities as already protected to the 0.2% level, so there is nothing to state.`);
  } else {
  const blocks = [
    { t: 'p', runs: `Of the ${all.length} critical facilities inventoried in ${NAME}, ${yes.length} are already protected to the 0.2-percent-annual-chance (500-year) flood level:` },
    { t: 'ul', items: yes.map(r => ({ runs: [{ t: clean(r[0]), b: true }, { t: ` — ${clean(r[1])}` }] })) },
  ];
  payload.lhmp_critical_buildings = buildRoot(blocks);
  notes.push(`lhmp_critical_buildings: Table E col "Already Protected to 0.2% Flood Level" — ${yes.length} of ${all.length} marked Y. Counts and facility names are verbatim; the framing sentence states the count only.`);
  }
}

// ── growth_and_development_trends ← Tables L (recent) + M (anticipated)
{
  if (!has('L') && !has('M')) { /* nothing to fill */ } else {
  const devItems = (label) => rows(label).slice(1).map(r => {
    const bits = [];
    if (!isBlank(r[1])) bits.push(clean(r[1]));
    if (!isBlank(r[2])) bits.push(clean(r[2]));
    if (!isBlank(r[3])) bits.push(clean(r[3]));
    if (!isBlank(r[4])) bits.push(`hazard zone: ${clean(r[4])}`);
    if (!isBlank(r[5])) bits.push(clean(r[5]));
    return { runs: [{ t: `${clean(r[0])} — `, b: true }, { t: bits.join('; ') }] };
  });
  const L = devItems('L'), M = devItems('M');
  payload.growth_and_development_trends = buildRoot([
    { t: 'h', text: 'Recent Major Development and Infrastructure, 2020 to Present' },
    { t: 'ul', items: L },
    { t: 'h', text: 'Known or Anticipated Major Development and Infrastructure, Next Five Years' },
    { t: 'ul', items: M },
  ]);
  notes.push(`growth_and_development_trends: Tables L (${L.length} recent) + M (${M.length} anticipated) under two H3 headings, per the crosswalk's "same column, two headings".`);
  }
}

// ── nfip ← Table O, 21 topic Q&A rows (bold question, plain answer)
if (has('O')) {
  const qa = rows('O').slice(1).filter(r => !isBlank(r[0]));
  const blocks = qa.map(r => ({
    t: 'p',
    runs: [{ t: clean(r[0]), b: true }, { t: ` ${isBlank(r[1]) ? 'Not reported.' : clean(r[1])}` }],
  }));
  payload.nfip = buildRoot(blocks);
  notes.push(`nfip: Table O, ${qa.length} topics as bolded question + verbatim answer. Blank answers render "Not reported." rather than being dropped.`);
}

// ── lhmp_problem_areas ← Identified Issues bullets, nesting preserved
{
  const src = A.identified_issues.filter(i => !isBlank(i.text));
  const items = [];
  for (const i of src) {
    if (i.depth > 1 && items.length) {
      const parent = items[items.length - 1];
      (parent.children = parent.children || []).push({ runs: clean(i.text) });
    } else {
      items.push({ runs: clean(i.text), children: [] });
    }
  }
  const top = items.length, nested = src.length - top;
  payload.lhmp_problem_areas = buildRoot([{ t: 'ul', items }]);
  notes.push(`lhmp_problem_areas: Identified Issues — ${top} top-level bullets, ${nested} nested (the critical-facilities-in-SFHA sub-list). Nesting preserved via @lexical/list's nested-listitem shape. NOTE: the crosswalk said 19 bullets; the extract has ${top} top-level + ${nested} nested = ${src.length}.`);
}

// ── lhmp_dams ← the grey-box free-text dam note
{
  const box = A.tables.find(t => t.shape === '1x1' && /Dams/i.test(t.subsection || ''));
  if (box) {
    const text = clean(cells(box.rows[0])[0]);
    payload.lhmp_dams = buildRoot([{ t: 'p', runs: text }]);
    notes.push(`lhmp_dams: grey-box note, verbatim — "${text}"`);
  } else {
    absentTables.push('Dams grey box');
  }
}

// ── lhmp_completed_actions ← Additional Mitigation Efforts bullets
{
  const eff = A.additional_mitigation_efforts.map(e => clean(e.text)).filter(Boolean);
  payload.lhmp_completed_actions = buildRoot([{ t: 'p', runs: eff.join(' ') }]);
  notes.push(`lhmp_completed_actions: Additional Mitigation Efforts, verbatim — ${JSON.stringify(eff)}.`);
}

// ── lhmp_cascading_impacts ← Table G (2-up layout: cols 0/1 and 2/3 are separate pairs)
{
  const pairs = [];
  if (has('G')) for (const r of rows('G').slice(1)) {
    for (const [a, b] of [[0, 1], [2, 3]]) {
      if (!isBlank(r[a])) pairs.push([clean(r[a]), clean(r[b])]);
    }
  }
  const NA = /^not applicable$/i;
  const substantive = pairs.filter(([, v]) => !NA.test(v) && !isBlank(v));
  const na = pairs.filter(([, v]) => NA.test(v)).map(([k]) => k);
  const blocks = [{ t: 'ul', items: substantive.map(([k, v]) => ({ runs: [{ t: `${k}: `, b: true }, { t: v }] })) }];
  if (na.length) blocks.push({ t: 'p', runs: `Reported as not applicable in ${NAME}: ${na.join('; ')}.` });
  payload.lhmp_cascading_impacts = buildRoot(blocks);
  notes.push(`lhmp_cascading_impacts: Table G — ${pairs.length} asset types (table is 2-up: cols 0/1 and 2/3 are separate asset/impact pairs). ${substantive.length} carry authored prose; ${na.length} marked Not Applicable are listed in a trailing line. OWNER DECISION 2026-08-17: land Table G here rather than parking it.`);
}

// ── lhmp_previous_actions_evaluation ← factual tally of the 21 prior-cycle actions
{
  const STATUS = [
    ['Completed', /\[x\][^[]*Completed/i],
    ['In progress', /\[x\][^[]*In-Progress/i],
    ['Proposed, not started', /\[x\][^[]*Proposed/i],
    ['Discontinued', /\[x\][^[]*Discontinued/i],
  ];
  const statusOf = (f) => {
    const cell = Object.entries(f).find(([k]) => /^Current Status/i.test(k))?.[1] || '';
    return STATUS.find(([, re]) => re.test(cell))?.[0] || 'Not reported';
  };
  const inclOf = (f) => {
    const cell = Object.entries(f).find(([k]) => /^Include in the/i.test(k))?.[1] || '';
    if (/\[x\][^[]*Include/i.test(cell)) return 'Include';
    if (/\[x\][^[]*Discontinue/i.test(cell)) return 'Discontinue';
    return 'Not reported';
  };
  const tally = {}, incl = {};
  for (const a of A.prior_actions) {
    const s = statusOf(a.fields); tally[s] = (tally[s] || 0) + 1;
    const i = inclOf(a.fields); incl[i] = (incl[i] || 0) + 1;
  }
  const byStatus = Object.entries(tally).sort((x, y) => y[1] - x[1]);
  const items = byStatus.map(([k, v]) => ({ runs: [{ t: `${k}: `, b: true }, { t: `${v} action${v === 1 ? '' : 's'}` }] }));
  const inclItems = Object.entries(incl).sort((x, y) => y[1] - x[1])
    .map(([k, v]) => ({ runs: [{ t: `${k}: `, b: true }, { t: `${v} action${v === 1 ? '' : 's'}` }] }));
  payload.lhmp_previous_actions_evaluation = buildRoot([
    { t: 'p', runs: `${NAME[0].toUpperCase()}${NAME.slice(1)} reported on ${A.prior_actions.length} mitigation actions carried forward from the 2020 plan. Status at the time of this update:` },
    { t: 'ul', items },
    { t: 'p', runs: 'Disposition for the 2026 plan update:' },
    { t: 'ul', items: inclItems },
  ]);
  notes.push(`lhmp_previous_actions_evaluation: factual tally only, counted from the ${A.prior_actions.length} prior-action status checkboxes — ${byStatus.map(([k, v]) => `${v} ${k}`).join(', ')}. No composed narrative. OWNER DECISION 2026-08-17: fill this one; leave lhmp_capacity_to_implement and lhmp_prioritization empty.`);
}

if (absentTables.length) {
  notes.push(`**Tables absent from this annex: ${absentTables.join(', ')}.** Normal for this jurisdiction type — the county chapter and non-census entities omit whole sections. Their dependent columns are simply unfilled, NOT empty-by-choice.`);
}

/**
 * Never write an EMPTY lexical value. A column holding a root with no text renders as a
 * populated-but-blank box, which reads as "the jurisdiction reported nothing here" rather
 * than "not applicable". Unset is the honest state. This catches the whole class — e.g.
 * lhmp_historic_occurances on the 17 jurisdictions where every Table D row is boilerplate.
 */
const emptied = [];
for (const [col, val] of Object.entries(payload)) {
  if (!rootToText(val).trim()) { delete payload[col]; emptied.push(col); }
}
if (emptied.length) {
  notes.push(`**Omitted as empty: ${emptied.join(', ')}.** The source rows exist but carry no content once boilerplate is removed, so the columns are left unset rather than written blank.`);
}

// ── deliberately NOT filled
const skipped = [
  ['lhmp_municipality_profile', 'gap-empty — Tetra Tech annexes carry no authored municipality-profile prose, only tables.'],
  ['lhmp_capacity_to_implement', 'Would be a composed roll-up of Table R with no verbatim source. OWNER DECISION 2026-08-17: leave empty.'],
  ['lhmp_prioritization', 'Would be a composed roll-up of the Table V methodology with no verbatim source. OWNER DECISION 2026-08-17: leave empty.'],
];

// ── emit
const outDir = path.join(CTX, 'payloads');
fs.mkdirSync(outDir, { recursive: true });
const jsonPath = path.join(outDir, `juris_${GEOID}.json`);
fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 1));

const md = [];
md.push(`# Jurisdictions payload review — ${A.jurisdiction.jurisdictions_title} (geoid ${GEOID})`);
md.push('');
md.push(`Source: \`${A.jurisdiction.chapter_file}\` · target row **1347347** · source \`1346449\` / view \`1346450\``);
md.push('');
md.push(`## Columns filled (${Object.keys(payload).length})`);
md.push('');
md.push('| Column | Chars | Source |');
md.push('|---|---:|---|');
for (const [col, val] of Object.entries(payload)) {
  md.push(`| \`${col}\` | ${rootToText(val).length} | ${notes.find(n => n.startsWith(col + ':'))?.split(':')[1]?.split('.')[0]?.trim() || ''} |`);
}
md.push('');
md.push('## Columns left empty');
md.push('');
for (const [col, why] of skipped) md.push(`- \`${col}\` — ${why}`);
md.push('');
md.push('## Mapping notes');
md.push('');
for (const n of notes) md.push(`- ${n}`);
md.push('');
md.push('## Rendered content');
for (const [col, val] of Object.entries(payload)) {
  md.push('');
  md.push(`### \`${col}\``);
  md.push('');
  md.push('```');
  md.push(rootToText(val));
  md.push('```');
}
fs.writeFileSync(path.join(outDir, `juris_${GEOID}.md`), md.join('\n'));

console.log(`payload  -> ${jsonPath}`);
console.log(`review   -> ${path.join(outDir, `juris_${GEOID}.md`)}`);
if (absentTables.length) console.log(`tables absent from this annex: ${absentTables.join(', ')}`);
console.log(`columns  -> ${Object.keys(payload).length} filled, ${skipped.length} intentionally empty`);
for (const [col, val] of Object.entries(payload)) {
  console.log(`  ${col.padEnd(36)} ${String(rootToText(val).length).padStart(6)} chars`);
}
