/**
 * Step 2: build Capabilities rows for one jurisdiction from the extracted annex.
 *
 * Emits payloads/cap_<geoid>.json   [{ _table, _row, data:{...} }, ...]
 *        payloads/cap_<geoid>.md    the human review surface
 *
 * Nothing is written to the database here.
 *
 * Column choices are calibrated against the 1,621 EXISTING jurisdiction-level rows
 * in source 1068273 (see cap_<geoid>.md "Schema calibration" for the counts):
 *   - `administering_agency` is the live column; `administering_agency_organization`
 *     has 0 non-empty values in 2,000 rows. The crosswalk named the dead one.
 *   - `primary_capability_type` is set on 1,544/1,621 jurisdiction rows and is the
 *     de-facto categorisation. The category CHECKBOX columns (planning,
 *     codes_ordinance_..., education_awareness_outreach, ...) are 0/1,621 — unused
 *     at jurisdiction level, so they are left alone.
 *   - Stored select values carry a space after each slash ('Codes/ Ordinance/ ...'),
 *     which the DECLARED options do not. Stored vocabulary wins.
 *
 * Usage: node build_capabilities.mjs [geoid]
 */
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const CTX = path.resolve(HERE, '..');
const GEOID = process.argv[2] || '3610338000';

const annexDir = path.join(CTX, 'extracted', 'annexes');
const file = fs.readdirSync(annexDir).find(f => f.startsWith(GEOID + '_'));
if (!file) throw new Error(`No extracted annex for geoid ${GEOID}`);
const A = JSON.parse(fs.readFileSync(path.join(annexDir, file), 'utf8'));
const J = A.jurisdiction;

/**
 * Identity comes from juris_index.json, built from the Jurisdictions dataset.
 *
 * NEVER derive the county geoid by slicing: `geoid.slice(0,5)` is wrong for every NY
 * village, whose geoid is 7 digits (36 + a 5-digit place code) — Amityville 3602044
 * slices to '36020', not '36103'. Only 10-digit cousub geoids and the 5-digit county
 * geoid slice correctly, which is why the Islip slice (a Town) did not expose this.
 * Run `python build_index.py` if juris_index.json is missing or stale.
 */
const IDX = JSON.parse(fs.readFileSync(path.join(CTX, 'juris_index.json'), 'utf8'))[String(J.geoid)];
if (!IDX) throw new Error(`geoid ${J.geoid} not in juris_index.json — re-run build_index.py`);

const cellsOf = (r) => (Array.isArray(r) ? r : r.cells || r);
const tables = {};
for (const t of A.tables) if (t.table_label) tables[t.table_label] = t;
/**
 * Missing tables are NORMAL, not an error: special districts and tribal nations omit
 * whole sections (SCWA has no Q/R/S/T/U; Shinnecock no N/O). Return [] and let each
 * section contribute nothing rather than crashing the whole jurisdiction.
 */
const rows = (l) => (tables[l] ? tables[l].rows.map(cellsOf) : []);
const absent = [];
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const blank = (s) => { const c = clean(s); return !c || c === '-' || c === 'N/A' || c === 'NA'; };
const isYes = (s) => /^yes\b/i.test(clean(s).replace(/\/$/, ''));
const isNo  = (s) => /^no\b/i.test(clean(s));

// Stored select vocabulary (exact strings as they appear in existing rows).
const CT = {
  CODES: 'Codes/ Ordinance/ Zoning/ Policy/ Law/ Governance',
  PLANNING: 'Planning',
  LONGTERM: 'Establishing Long-Term Programs',
  OUTREACH: 'Education, Awareness, Outreach',
  PREP: 'Preparedness & Response',
};

const IDENT = {
  geoid_juris: String(J.geoid),
  geoid_county: IDX.county_geoid,
  jurisdiction: J.jurisdictions_title,
  county: IDX.county,
};

const out = [];
const notes = [];
const add = (table, rowIdx, data) => out.push({ _table: table, _row: rowIdx, data: { ...IDENT, ...data } });
const put = (o, k, v) => { if (!blank(v)) o[k] = clean(v); };

// ── Table B — Community Classifications, participating programs only
if (!tables.B) absent.push('B'); else {
  const all = rows('B').slice(1);
  const yes = all.filter(r => isYes(r[1]));
  for (const [i, r] of yes.entries()) {
    const d = { capability_name: clean(r[0]), primary_capability_type: CT.LONGTERM, program: 'x' };
    const bits = [];
    if (!blank(r[2])) bits.push(clean(r[2]));
    if (!blank(r[3])) bits.push(`Date classified: ${clean(r[3])}`);
    if (bits.length) d.description = bits.join('. ') + '.';
    if (/climate smart/i.test(r[0])) d.supports_climate_smart_communities_csc_points = 'Yes';
    add('B', i, d);
  }
  const crs = all.find(r => /Community Rating System/i.test(r[0]));
  notes.push(`**Table B** — ${yes.length} of ${all.length} programs participating → ${yes.length} rows (${yes.map(r => clean(r[0])).join(', ')}). ` +
    (crs ? `CRS is Participating=**No** with Classification "${clean(crs[2])}", so the crosswalk's include-only-if-participating filter produces no row. The CRS pursuit is not lost — Table Q's Floodplain Management row says "The Planning Department is working on achieving a CRS rating for the town."` : ''));
}

// ── Table P — Ordinances (In Place = Yes)
if (!tables.P) absent.push('P'); else {
  const all = rows('P').slice(1);
  const yes = all.filter(r => isYes(r[1]));
  for (const [i, r] of yes.entries()) {
    const d = { capability_name: clean(r[0]), primary_capability_type: CT.CODES, plan_guidance: 'x' };
    put(d, 'mitigation_connection', r[2]);
    put(d, 'description', r[3]);
    put(d, 'administering_agency', r[4]);
    add('P', i, d);
  }
  notes.push(`**Table P** — ${yes.length} of ${all.length} ordinances In Place → ${yes.length} rows. capability_name=Capability Type, description=Ordinance Name/Chapter+Year, mitigation_connection=the effectiveness/enforcement/expansion prose, administering_agency=Responsible Department. Skipped (In Place=No): ${all.filter(r => !isYes(r[1])).map(r => clean(r[0])).join(', ')}.`);
}

// ── Table Q — Plans (In Place = Yes, minus the literal "Example:" row)
if (!tables.Q) absent.push('Q'); else {
  const all = rows('Q').slice(1);
  const example = all.filter(r => /^example:/i.test(clean(r[0])));
  const cand = all.filter(r => !/^example:/i.test(clean(r[0])));
  const yes = cand.filter(r => isYes(r[1]));
  for (const [i, r] of yes.entries()) {
    const d = { capability_name: clean(r[0]), primary_capability_type: CT.PLANNING, plan_guidance: 'x' };
    put(d, 'mitigation_connection', r[2]);
    put(d, 'description', r[3]);
    put(d, 'administering_agency', r[4]);
    add('Q', i, d);
  }
  notes.push(`**Table Q** — ${yes.length} of ${cand.length} plans In Place → ${yes.length} rows. ${example.length} literal "Example:" row(s) skipped per the crosswalk (${example.map(r => clean(r[0])).join(', ')}). NOTE: the crosswalk estimated 10; the extract yields ${yes.length}.`);
}

// ── Table R — Administrative and Technical (In Place = Yes)
{
  // Live convention: staffing/capacity → Establishing Long-Term Programs; the
  // code/zoning-flavoured departments → Codes/Ordinance/...; an EM department →
  // Preparedness & Response. Calibrated against existing rows for the same names.
  const typeFor = (name) => {
    if (/code enforcement|building|zoning board|planning department/i.test(name)) return CT.CODES;
    if (/emergency management|public safety/i.test(name)) return CT.PREP;
    return CT.LONGTERM;
  };
  if (!tables.R) { absent.push('R'); } else {
  const all = rows('R').slice(1);
  const yes = all.filter(r => isYes(r[1]));
  for (const [i, r] of yes.entries()) {
    const name = clean(r[0]);
    const d = { capability_name: name, primary_capability_type: typeFor(name), tool: 'x' };
    put(d, 'mitigation_connection', r[2]);
    if (!blank(r[3])) d.description = `Number of staff: ${clean(r[3])}`;
    add('R', i, d);
  }
  notes.push(`**Table R** — ${yes.length} of ${all.length} staffing capabilities In Place → ${yes.length} rows. "# of Staff" has no column (gap-no-target), so it goes into description as "Number of staff: N" rather than being dropped. Row 1 reads "Yes/" with a stray slash and is treated as Yes.`);
  }
}

// ── Table S — Fiscal (used since the last plan; the answer column is mixed Yes/No/prose)
if (!tables.S) absent.push('S'); else {
  const all = rows('S').slice(1);
  const used = all.filter(r => !isNo(r[1]) && !blank(r[1]));
  for (const [i, r] of used.entries()) {
    const d = { capability_name: clean(r[0]), primary_capability_type: CT.LONGTERM, funding_source: 'x' };
    put(d, 'description', r[1]);
    add('S', i, d);
  }
  notes.push(`**Table S** — ${used.length} of ${all.length} funding mechanisms used → ${used.length} rows. The answer column is mixed: bare "Yes", bare "No", and prose. Rows whose answer *begins* with "No" are excluded — including "No, handled by the state" (Open Space Acquisition), which is a negative answer with an explanation, not a use. NOTE: the crosswalk estimated 8; the extract yields ${used.length}.`);
}

// ── Table T — Education and Outreach (all in use for Islip)
if (!tables.T) absent.push('T'); else {
  const all = rows('T').slice(1);
  const used = all.filter(r => !isNo(r[1]) && !blank(r[1]));
  for (const [i, r] of used.entries()) {
    const name = clean(r[0]);
    const d = {
      capability_name: name,
      primary_capability_type: /warning system/i.test(name) ? CT.PREP : CT.OUTREACH,
      program: 'x',
    };
    put(d, 'description', r[1]);
    add('T', i, d);
  }
  notes.push(`**Table T** — ${used.length} of ${all.length} outreach capabilities in use → ${used.length} rows. "Warning systems for hazard events" takes Preparedness & Response, matching all 18 existing rows of that name statewide; the rest take Education, Awareness, Outreach.`);
}

if (absent.length) {
  notes.push(`**Tables absent from this annex: ${absent.join(', ')}.** Normal for this jurisdiction type — special districts and tribal nations omit whole sections. Those tables contribute no rows.`);
}

// ── emit
const outDir = path.join(CTX, 'payloads');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, `cap_${GEOID}.json`), JSON.stringify(out, null, 1));

const byTable = {};
for (const r of out) byTable[r._table] = (byTable[r._table] || 0) + 1;
const md = [];
md.push(`# Capabilities payload review — ${J.jurisdictions_title} (geoid ${GEOID})`);
md.push('');
md.push(`Source: \`${J.chapter_file}\` · target source \`1068273\` / view \`1172519\` · **${out.length} new rows**`);
md.push('');
md.push(`Suffolk currently has **0** rows in this dataset, so every row here is an insert.`);
md.push('');
md.push('## Rows by source table');
md.push('');
md.push('| Table | Subject | Rows | primary_capability_type | Row-kind flag |');
md.push('|---|---|---:|---|---|');
const meta = {
  B: ['Community Classifications', 'Establishing Long-Term Programs', '`program=x`'],
  P: ['Ordinances', 'Codes/ Ordinance/ Zoning/ Policy/ Law/ Governance', '`plan_guidance=x`'],
  Q: ['Plans', 'Planning', '`plan_guidance=x`'],
  R: ['Administrative & Technical', 'mostly Establishing Long-Term Programs', '`tool=x`'],
  S: ['Fiscal', 'Establishing Long-Term Programs', '`funding_source=x`'],
  T: ['Education & Outreach', 'Education, Awareness, Outreach', '`program=x`'],
};
for (const [t, n] of Object.entries(byTable)) md.push(`| ${t} | ${meta[t][0]} | ${n} | ${meta[t][1]} | ${meta[t][2]} |`);
md.push(`| | **total** | **${out.length}** | | |`);
md.push('');
md.push('## Schema calibration against existing rows');
md.push('');
md.push('Measured over the 2,000-row sample of source 1068273, split by whether a row has `geoid_juris`:');
md.push('');
md.push('| Column | Jurisdiction rows (1,621) | State catalogue rows (379) | Decision |');
md.push('|---|---:|---:|---|');
md.push('| `administering_agency` | 941 | — | **use this one** |');
md.push('| `administering_agency_organization` | 0 | 0 | dead column — the crosswalk named it by mistake |');
md.push('| `primary_capability_type` | 1,544 | — | set it; the crosswalk did not mention it |');
md.push('| category checkboxes (`planning`, `codes_ordinance_…`, …) | 0 | populated | leave alone |');
md.push('| `plan_guidance` | 2 | 41 | see the row-kind note below |');
md.push('| `tool` | 0 | 95 | " |');
md.push('| `funding_source` | 0 | 118 | " |');
md.push('| `program` | 1 | 180 | " |');
md.push('');
md.push('## Decision to confirm: the row-kind checkboxes');
md.push('');
md.push('The crosswalk prescribes `plan_guidance=TRUE` for Tables P/Q, `tool=TRUE` for R,');
md.push('`funding_source=TRUE` for S, `program=TRUE` for T. That is the convention of the **state');
md.push('catalogue** rows. Jurisdiction rows essentially never set them (2 / 0 / 0 / 1 out of 1,621).');
md.push('');
md.push('Dropping them loses a real distinction: Tables R (staffing) and S (fiscal) both map to');
md.push('`primary_capability_type = Establishing Long-Term Programs`, so without the flags they become');
md.push('indistinguishable. This payload therefore sets **both** — `primary_capability_type` per the');
md.push('live jurisdiction convention *and* the row-kind checkbox per the crosswalk. The flags are');
md.push('additive: views keyed on `primary_capability_type` behave exactly as they do for other');
md.push('counties, and a view filtering on `funding_source` now finds Islip\'s fiscal rows.');
md.push('');
md.push('Say so if you would rather match the other counties exactly and omit the flags.');
md.push('');
md.push('## Mapping notes');
md.push('');
for (const n of notes) md.push(`- ${n}`);
md.push('');
md.push('## Every row');
for (const t of Object.keys(byTable)) {
  md.push('');
  md.push(`### Table ${t} — ${meta[t][0]}`);
  md.push('');
  for (const r of out.filter(x => x._table === t)) {
    md.push(`**${r.data.capability_name}**`);
    md.push('');
    for (const [k, v] of Object.entries(r.data)) {
      if (['geoid_juris', 'geoid_county', 'jurisdiction', 'county', 'capability_name'].includes(k)) continue;
      md.push(`- \`${k}\`: ${v}`);
    }
    md.push('');
  }
}
fs.writeFileSync(path.join(outDir, `cap_${GEOID}.md`), md.join('\n'));

console.log(`payload -> payloads/cap_${GEOID}.json   (${out.length} rows)`);
console.log(`review  -> payloads/cap_${GEOID}.md`);
for (const [t, n] of Object.entries(byTable)) console.log(`  Table ${t}  ${meta[t][0].padEnd(28)} ${String(n).padStart(3)} rows`);
const cols = new Set(); out.forEach(r => Object.keys(r.data).forEach(k => cols.add(k)));
if (absent.length) console.log(`tables absent from this annex (contributed no rows): ${absent.join(', ')}`);
console.log(`columns used: ${[...cols].sort().join(', ')}`);
