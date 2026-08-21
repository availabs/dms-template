/**
 * Step 3: build Roles rows for one jurisdiction from annex Table A (+ Table O for the FPA title).
 *
 * Emits payloads/roles_<geoid>.json and .md
 *
 * Table A is NOT a clean grid — each cell is a labelled blob:
 *   "Name/Title: X Address: Y Phone Number: Z Email: W"
 *   "Name/Title: X Method of Participation: Y"
 * and the Alternate-POC cell holds TWO people concatenated, so records are split on
 * repeated "Name/Title:" rather than on cell boundaries.
 *
 * Schema calibration against the 356 existing rows (see the .md for counts):
 *   - `geoid_juris` / `geoid_county` / `hmp_committee` are stored as ARRAYS in the
 *     193/196 most recent rows; `role` and `meeting_participation` as plain strings.
 *   - `address_optional` EXISTS (49 rows use it). The crosswalk called address
 *     `gap-no-target`, which was wrong.
 *   - OWNER DECISION 2026-08-17: `role` uses the DECLARED option list, mapped only
 *     where the annex title is unambiguous; left null rather than guessed otherwise.
 *   - OWNER DECISION 2026-08-17: the verbatim "Method of Participation" text goes to
 *     `comments` (lexical), with `meeting_participation = "Jurisdictional Team"`.
 *
 * Usage: node build_roles.mjs [geoid]
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildRoot, rootToText } from './lexical.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const CTX = path.resolve(HERE, '..');
const GEOID = process.argv[2] || '3610338000';

const annexDir = path.join(CTX, 'extracted', 'annexes');
const file = fs.readdirSync(annexDir).find(f => f.startsWith(GEOID + '_'));
const A = JSON.parse(fs.readFileSync(path.join(annexDir, file), 'utf8'));
const J = A.jurisdiction;

/**
 * Identity comes from juris_index.json, built from the Jurisdictions dataset.
 * NEVER slice a county geoid out of a jurisdiction geoid: NY village geoids are 7 digits
 * (36 + a 5-digit place code), so Amityville 3602044 slices to '36020', not '36103'.
 * Run `python build_index.py` if juris_index.json is missing or stale.
 */
const IDX = JSON.parse(fs.readFileSync(path.join(CTX, 'juris_index.json'), 'utf8'))[String(J.geoid)];
if (!IDX) throw new Error(`geoid ${J.geoid} not in juris_index.json — re-run build_index.py`);

const cellsOf = (r) => (Array.isArray(r) ? r : r.cells || r);
const tables = {};
for (const t of A.tables) if (t.table_label) tables[t.table_label] = t;
// Missing tables are NORMAL for some jurisdiction types (Shinnecock has no N/O,
// Suffolk County no O). Return [] rather than crashing the jurisdiction.
const rows = (l) => (tables[l] ? tables[l].rows.map(cellsOf) : []);
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

// ── parse a labelled contact blob into { nameTitle, address, phone, email, method }
const LABELS = [
  ['nameTitle', /Name\s*\/\s*Title\s*:/i],
  ['address', /Address\s*:/i],
  ['phone', /Phone\s*Number\s*:/i],
  ['email', /Email\s*:/i],
  ['method', /Method\s+of\s+Participation\s*:/i],
];
const splitRecords = (cell) => {
  const s = clean(cell);
  // Each record starts at a "Name/Title:" label.
  const starts = [...s.matchAll(/Name\s*\/\s*Title\s*:/gi)].map(m => m.index);
  if (!starts.length) return [];
  return starts.map((st, i) => s.slice(st, i + 1 < starts.length ? starts[i + 1] : undefined));
};
const parseRecord = (rec) => {
  // Find every label occurrence, then slice between them.
  const hits = [];
  for (const [key, re] of LABELS) {
    const g = new RegExp(re.source, 'gi');
    let m; while ((m = g.exec(rec))) hits.push({ key, at: m.index, len: m[0].length });
  }
  hits.sort((a, b) => a.at - b.at);
  const out = {};
  for (const [i, h] of hits.entries()) {
    const end = i + 1 < hits.length ? hits[i + 1].at : rec.length;
    out[h.key] = clean(rec.slice(h.at + h.len, end));
  }
  return out;
};
// "Anthony Prudenti, Commissioner, Public Safety Enforcement" -> name + title
const splitName = (nameTitle) => {
  const s = clean(nameTitle);
  const i = s.indexOf(',');
  return i < 0 ? { name: s, title: '' } : { name: clean(s.slice(0, i)), title: clean(s.slice(i + 1)) };
};

/**
 * ── role mapping ──────────────────────────────────────────────────────────────────────
 * ONE ORDERED LIST. First match wins, so precedence is the whole design: "Senior Account
 * Clerk, Assistant to the Commissioner, Department of Public Works" must reach Fiscal Staff
 * before either the /clerk/ rule or the /public works/ rule can claim it.
 *
 * Vocabulary (owner decisions 2026-08-17 and 2026-08-18): DECLARED options wherever one
 * fits. Municipal clerks have NO declared option, so they take the coarse de-facto value
 * `Government - Staff or Technical` — not one of the 52, but the most-used stored value
 * (186 of 345 live rows). Titles that fit nothing stay NULL rather than being guessed; the
 * verbatim title is preserved in `title` regardless, so nothing is lost by abstaining.
 */
const ROLE_RULES = [
  // — most specific first: titles that would otherwise be captured by a broader rule —
  [/floodplain administrator/i,              'Floodplain Administrator'],
  [/account clerk|accountant/i,              'Fiscal Staff'],
  [/planning and development engineering/i,  'Civil Engineer'],          // owner 2026-08-17
  [/parks,? recreation/i,                    'Public Works Professional'],// owner 2026-08-17
  [/airport/i,                               'Stakeholder - Critical Facility Manager'], // owner 2026-08-17
  [/chief building official|building inspector|building dept\.? supervisor|building department supervisor/i,
                                             'Chief Building Official'],
  [/fire marshal|fire chief|fire (&|and) ems|\bfire\b.*(chief|administrator)/i,
                                             'First Responder - Fire'],
  [/superintendent of highways|highway superintendent/i,
                                             'Highway Superintendent'],
  [/chief of police|police (department )?chief|\bPD\b|constable chief|police/i,
                                             'First Responder - Police'],
  [/village administrator|city manager|town manager/i,
                                             'Community Chief Executive Officer - Other'],
  [/\bmayor\b(?!.*deputy)/i,                'Community Chief Executive Officer - Mayor'],
  [/deputy mayor|\btrustee\b|deputy supervisor|town supervisor|elected/i,
                                             'Elected Official'],
  [/town engineer|village engineer|civil engineer/i,
                                             'Civil Engineer'],
  [/\bOEM\b|emergency preparedness|emergency management|emergency (evacuation )?coordinator|public safety/i,
                                             'Emergency Management Personnel'],
  [/public works|highway/i,                  'Public Works Professional'],
  [/environmental conservation/i,             'Nature Resources / Environmental Protection Personnel'],
  // — additional clean matches found by measuring the whole corpus (owner: 'all reasonable mappings') —
  [/chief building (code )?official/i,       'Chief Building Official'],
  [/code enforcement/i,                      'Land Use / Code Enforcement Personnel'],
  [/emergency manager|\bEMO\b|director emo/i, 'Emergency Management Personnel'],
  [/councilperson|councilman|councilwoman|council member/i, 'Elected Official'],
  [/sachem|chairwoman|chairman|chairperson/i, 'Community Chief Executive Officer - Other'],
  [/storm ?water|waterways|bay management|watershed/i, 'Watershed Manager'],
  [/grants? coordinator|grant writer/i,      'Grant Writer'],
  [/sargent|sergeant/i,                      'First Responder - Police'],
  // — clerks last: no declared option covers them (owner 2026-08-18) —
  [/\bclerk\b|clerk-treasurer|treasurer/i,  'Government - Staff or Technical'],
];
const roleFor = (title, isFpa) => {
  if (isFpa) return { role: 'Floodplain Administrator', why: 'Table A names them the NFIP Floodplain Administrator' };
  const t = clean(title);
  if (!t) return { role: null, why: 'abstained — no title given in the source' };
  for (const [re, v] of ROLE_RULES) if (re.test(t)) return { role: v, why: `title matches ${re}` };
  return { role: null, why: 'abstained — no declared option fits this title' };
};

const IDENT = {
  geoid_juris: [String(J.geoid)],
  geoid_county: [IDX.county_geoid],
  jurisdiction: J.jurisdictions_title,
  county: IDX.county,
};

// The extract's jurisdiction object carries `jurisdictions_title` ("Islip (Town)") and
// `municipality_type` ("Town") but no bare municipality_name — build the agency from those.
const MUNI_NAME = clean(J.jurisdictions_title.replace(/\s*\([^)]*\)\s*$/, ''));
const AGENCY = /^(Town|Village|City)$/i.test(J.municipality_type)
  ? `${J.municipality_type} of ${MUNI_NAME}`
  : J.jurisdictions_title;

// Steering Committee membership: Volume I Table 21 lists the county's SC members;
// Table A also flags it inline in a contributor's Method of Participation.
const VOL1_STEERING = ['Anthony Prudenti'];

const T = rows('A');
if (!T.length) throw new Error(`Annex for ${J.jurisdictions_title} has no Table A — no Roles source. Handle explicitly.`);
const out = [];
const notes = [];

const push = ({ rec, kind, isFpa = false, hmRep }) => {
  const p = parseRecord(rec);
  const { name, title } = splitName(p.nameTitle || '');
  const { role, why } = roleFor(title || name, isFpa);
  const d = { ...IDENT, name, agency: AGENCY };
  if (title) d.title = title;
  if (p.phone) d.phone = p.phone;
  if (p.email) d.email = p.email;
  if (p.address) d.address_optional = p.address;
  if (role) d.role = role;
  d.hm_representative = hmRep;
  const committee = ['Jurisdictional Representative'];
  const sc = VOL1_STEERING.includes(name) || /steering committee/i.test(p.method || '');
  if (sc) committee.push('Steering Committee');
  d.hmp_committee = committee;
  d.meeting_participation = 'Jurisdictional Team';
  if (p.method) d.comments = buildRoot([{ t: 'p', runs: `Method of participation: ${p.method}` }]);
  out.push({ _kind: kind, _roleWhy: why, _steering: sc, data: d });
};

// Primary POC (Table A row 1 col 0)
for (const rec of splitRecords(T[1][0])) push({ rec, kind: 'Primary POC', hmRep: 'Yes' });
// Alternate POC(s) (row 1 col 1) — may hold several people
for (const rec of splitRecords(T[1][1])) push({ rec, kind: 'Alternate POC', hmRep: 'Yes' });
// NFIP Floodplain Administrator (row 3 col 0)
for (const rec of splitRecords(T[3][0])) push({ rec, kind: 'NFIP Floodplain Administrator', isFpa: true, hmRep: 'No' });
// Additional Contributors (rows 5..end)
for (const r of T.slice(5)) for (const rec of splitRecords(r[0])) push({ rec, kind: 'Additional Contributor', hmRep: 'No' });

/**
 * Participants present in the Volume III Appendix B attendance matrix but ABSENT from the
 * jurisdiction's own Table A contributor list. They demonstrably participated, so they get
 * a Roles row (owner decision 2026-08-17), tagged as Appendix-B-sourced so a reviewer can
 * see the annex did not name them.
 *
 * Appendix B carries no phone/email/address, so those stay null.
 *
 * On name spellings: where Appendix B and Table A disagree on the SAME person
 * (Dominique/Dominick Mezzapesa, Hillebrand/Hillenbrand), Roles keeps the Table A
 * spelling — the jurisdiction authored that list. Only people Table A omits entirely
 * are added here. Participation's attendance text keeps Appendix B verbatim.
 */
const APPENDIX_B_ONLY = {
  // KEYED BY GEOID. An unkeyed list leaks every entry into every jurisdiction.
  '3610338000': [
    { name: 'Michael Andre', title: 'Planning', role: 'Community Planner',
      why: "Appendix B lists only the department 'Planning'; Community Planner is the most-used declared planner option (5 live rows). Subject to correction.",
      attended: 'PP Kickoff (12.1.2025)' },
  ],
};
for (const p of (APPENDIX_B_ONLY[String(J.geoid)] || [])) {
  out.push({
    _kind: 'Additional Contributor (Appendix B only)',
    _roleWhy: p.why,
    _steering: false,
    data: {
      ...IDENT,
      name: p.name,
      agency: AGENCY,
      title: p.title,
      role: p.role,
      hm_representative: 'No',
      hmp_committee: ['Jurisdictional Representative'],
      meeting_participation: 'Jurisdictional Team',
      comments: buildRoot([{ t: 'p', runs:
        `Source: Volume III Appendix B attendance matrix, which records attendance at ${p.attended}. ` +
        `Not listed in the annex's Table A Hazard Mitigation Planning Team.` }]),
    },
  });
}

// The FPA's title is absent from Table A but present in Table O — same person, per the
// crosswalk's "duplicate of Table A FPA row - dedupe".
{
  const fpa = out.find(r => r._kind === 'NFIP Floodplain Administrator');
  const o = rows('O').find(r => /Community Floodplain Administrator/i.test(clean(r[0])));   // rows('O') is [] when the annex omits Table O
  if (fpa && !fpa.data.title && o) {
    const m = clean(o[1]).match(new RegExp(`${fpa.data.name}\\s*[-–—:,]\\s*(.+)$`, 'i'));
    if (m) {
      fpa.data.title = clean(m[1]);
      notes.push(`**FPA title recovered from Table O.** Table A gives only "${fpa.data.name}" with no title; Table O's Floodplain Administrator row reads "${clean(o[1])}", so \`title\` = "${fpa.data.title}". Same person, one row — not two.`);
    }
  }
}

notes.push(`**Row count** — ${out.length} people: ` +
  Object.entries(out.reduce((a, r) => (a[r._kind] = (a[r._kind] || 0) + 1, a), {})).map(([k, n]) => `${n} ${k}`).join(', ') +
  `. The Alternate POC cell holds ${out.filter(r => r._kind === 'Alternate POC').length} people concatenated in one cell — split on repeated "Name/Title:", not on cell boundaries.`);
const mapped = out.filter(r => r.data.role).length;
notes.push(`**\`role\`** — ${mapped} of ${out.length} mapped to declared options; ${out.length - mapped} left null rather than guessed (owner decision 2026-08-17).`);
notes.push(`**\`hm_representative\`** — Yes for the Primary and Alternate POCs (Table A's own grouping), No for the FPA and Additional Contributors.`);
notes.push(`**\`hmp_committee\`** — every row gets "Jurisdictional Representative". "Steering Committee" is added only where a source says so: ${out.filter(r => r._steering).map(r => r.data.name).join(', ') || 'nobody'} (Volume I Table 21 and/or an inline note in Table A).`);
notes.push(`**\`address_optional\`** — populated for the ${out.filter(r => r.data.address_optional).length} POC/FPA records that carry an address. The crosswalk marked address \`gap-no-target\`; the column exists and 49 live rows use it.`);

// ── emit
const outDir = path.join(CTX, 'payloads');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, `roles_${GEOID}.json`), JSON.stringify(out, null, 1));

const md = [];
md.push(`# Roles payload review — ${J.jurisdictions_title} (geoid ${GEOID})`);
md.push('');
md.push(`Source: \`${J.chapter_file}\` Table A (+ Table O for the FPA title) · target source \`1473295\` / view \`1473296\` · **${out.length} new rows**`);
md.push('');
md.push(`Suffolk currently has **1** row in this dataset (Greg Larnard, geoid 3610542235 — a different jurisdiction), so all ${out.length} rows here are inserts.`);
md.push('');
md.push('## Storage-format calibration (356 existing rows; 200 most recent)');
md.push('');
md.push('| Column | Stored as | Note |');
md.push('|---|---|---|');
md.push('| `geoid_juris` / `geoid_county` | **array of strings** (193/196 recent) | older rows use int and bare string; arrays are current |');
md.push('| `hmp_committee` | **array** (182/182 recent) | vocabulary: Jurisdictional Representative 265, Steering Committee 36, Core Planning Group 15, Stakeholder 6 |');
md.push('| `role` | **plain string** (194/194 recent) | declared options used, per owner decision |');
md.push('| `meeting_participation` | **plain string** | only value in use statewide: `Jurisdictional Team` (152) |');
md.push('| `hm_representative` | `Yes` / `No` | 264 Yes / 72 No |');
md.push('| `comments` | lexical root | 21 rows populated, 8 of them lexical objects |');
md.push('');
md.push('## Mapping notes');
md.push('');
for (const n of notes) md.push(`- ${n}`);
md.push('');
md.push('## Every row');
md.push('');
md.push('| # | Name | Title | Kind | `role` | Why |');
md.push('|---:|---|---|---|---|---|');
out.forEach((r, i) => md.push(`| ${i + 1} | ${r.data.name} | ${r.data.title || '—'} | ${r._kind} | ${r.data.role || '*(null)*'} | ${r._roleWhy} |`));
md.push('');
md.push('### Full field detail');
for (const [i, r] of out.entries()) {
  md.push('');
  md.push(`**${i + 1}. ${r.data.name}** — ${r._kind}`);
  md.push('');
  for (const [k, v] of Object.entries(r.data)) {
    if (['jurisdiction', 'county', 'geoid_juris', 'geoid_county', 'name'].includes(k)) continue;
    md.push(`- \`${k}\`: ${k === 'comments' ? rootToText(v) : JSON.stringify(v)}`);
  }
}
fs.writeFileSync(path.join(outDir, `roles_${GEOID}.md`), md.join('\n'));

console.log(`payload -> payloads/roles_${GEOID}.json   (${out.length} rows)`);
console.log(`review  -> payloads/roles_${GEOID}.md`);
console.log('');
for (const [i, r] of out.entries()) {
  console.log(`  ${String(i + 1).padStart(2)}  ${(r.data.name || '?').padEnd(22)} ${(r.data.role || '—').padEnd(46)} ${r._kind}`);
}
console.log(`\nrole mapped ${mapped}/${out.length}; steering committee: ${out.filter(r => r._steering).map(r => r.data.name).join(', ')}`);
