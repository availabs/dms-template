/**
 * Prerequisite for the batch: create the rows two non-census participants are missing.
 * Owner-authorised 2026-08-17.
 *
 *   Shinnecock (Reservation), geoid 3610367059
 *     - Jurisdictions row EXISTS (id 1348155) — do not touch it.
 *     - 17 Hazards-of-Concern rows were never generated. Create them.
 *
 *   Suffolk County Water Authority, synthetic geoid 3610390001
 *     - No Jurisdictions row and no HOC rows. Create 1 + 17.
 *
 * Why 3610390001: county prefix 36103 + suffix 90001. Re-verified 2026-08-17 —
 * 0 of the 970 ten-digit cousub geoids statewide use a 9-prefixed suffix, and
 * 3610390001 is absent from all 2,345 Jurisdictions rows. Reserves 3610390001-3610399999
 * for future non-census entities. It must stay NUMERIC and 10 DIGITS because
 * `GeoID (Number Only)` / `geoid_num` are calculated numeric casts and HOC's
 * `geoid_juris` is a string array — a key like "36103-SCWA" would break both. Keeping the
 * county prefix means every existing county filter picks it up with no special-casing.
 *
 * Storage conventions follow the DOMINANT live convention, not the Reservation outliers:
 * `geoid` and `county_geoid` as STRINGS (2,302 / 2,301 of 2,345 rows; the 9 Reservation
 * rows are among the 43 that use ints). The 17 HOC rows are modelled on the untouched
 * Islip backup, which is the authoritative "never reported" shape.
 *
 * Usage: node create_missing_entities.mjs [--dry]
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const CTX = path.resolve(HERE, '..');
const CLI = path.resolve(CTX, '../../../../src/dms/packages/dms/cli/bin/dms.js');
const APP = process.env.DMS_APP || 'mitigat-ny-prod';
const DRY = process.argv.includes('--dry');

const JURIS = { source: '1346449', view: '1346450', type: 'jurisdictions|1346450:data' };
const HOC = { source: '1473470', view: '1473471', type: 'hazards_of_concern|1473471:data' };

const dms = (args) => {
  const out = execFileSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8', env: process.env, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
  });
  const i = out.indexOf('{');
  if (i < 0) throw new Error(`No JSON in CLI output: ${out.slice(0, 300)}`);
  return JSON.parse(out.slice(i));
};

const SCWA = {
  geoid: '3610390001',
  county: 'Suffolk',
  county_geoid: '36103',
  municipality_name: 'Suffolk County Water Authority',
  municipality_type: 'Authority',   // new value; parallels the established Reservation class
  census_type: 'Non-Census',        // explicit + filterable, never mistaken for census geography
};

// The 17 named MNY hazards, in the exact stored display-label spelling.
const PRE = JSON.parse(fs.readFileSync(path.join(CTX, 'backups', 'hoc_3610338000_PRE.json'), 'utf8'));
const HAZARDS = PRE.map(r => r.data.hazard).filter(h => h !== 'Other');
if (HAZARDS.length !== 17) throw new Error(`Expected 17 named hazards from the Islip backup, got ${HAZARDS.length}`);

const TARGETS = [
  { geoid: '3610367059', title: 'Shinnecock (Reservation)', needsJuris: false },
  { geoid: SCWA.geoid, title: 'Suffolk County Water Authority', needsJuris: true },
];

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mkent-'));
const createdPath = path.join(CTX, 'created', 'missing_entities.json');
fs.mkdirSync(path.dirname(createdPath), { recursive: true });
const created = fs.existsSync(createdPath) ? JSON.parse(fs.readFileSync(createdPath, 'utf8')) : [];

// ── preflight
// Collision check is a FILTERED query on purpose. An unfiltered Jurisdictions dump is
// ~67 MB — it carries every filled row's lexical content — and overruns the exec buffer.
// The 9-prefixed-suffix block audit (0 of 970 ten-digit cousub geoids statewide) is a
// one-time design verification, re-confirmed 2026-08-17 and recorded in
// ISLIP_SLICE_LOAD_REPORT.md; it does not need re-running on every invocation.
const clash = dms(['dataset', 'query', JURIS.source, '--view', JURIS.view,
  '--filter', `geoid=${SCWA.geoid}`, '--limit', '5', '--format', 'json']);
if (clash.total !== 0) {
  console.log(`!! ${SCWA.geoid} already exists in Jurisdictions (${clash.total} row) — refusing.`);
  process.exit(1);
}
const jurisGeoids = new Set();
for (const g of ['3610367059', SCWA.geoid]) {
  const q = dms(['dataset', 'query', JURIS.source, '--view', JURIS.view,
    '--filter', `geoid=${g}`, '--limit', '5', '--format', 'json']);
  if (q.total > 0) jurisGeoids.add(g);
}
console.log(`geoid ${SCWA.geoid}: absent from Jurisdictions ✓`);

const allHoc = dms(['dataset', 'query', HOC.source, '--view', HOC.view, '--filter', 'geoid_county=36103',
  '--limit', '5000', '--format', 'json']);
const hocFor = (g) => allHoc.items.filter(r => (r.data.geoid_juris || []).map(String).includes(String(g)));
for (const t of TARGETS) {
  t.existingHoc = hocFor(t.geoid).length;
  console.log(`  ${t.title.padEnd(32)} jurisdictions row: ${jurisGeoids.has(t.geoid) ? 'exists' : 'MISSING'} · HOC rows: ${t.existingHoc}`);
  if (t.existingHoc > 0) { console.log('  !! already has HOC rows — refusing to duplicate.'); process.exit(1); }
}

if (DRY) {
  console.log(`\n--dry: would create 1 Jurisdictions row (${SCWA.geoid}) and ${HAZARDS.length * 2} HOC rows.`);
  console.log(`hazards: ${HAZARDS.join(', ')}`);
  process.exit(0);
}

const mk = (typeStr, source, view, data, tag) => {
  const c = dms(['raw', 'create', APP, typeStr, '--format', 'json']);
  if (!c.id) throw new Error('create returned no id');
  created.push({ id: c.id, type: typeStr, tag });
  fs.writeFileSync(createdPath, JSON.stringify(created, null, 1));   // before the fill
  const f = path.join(tmpDir, `${c.id}.json`);
  fs.writeFileSync(f, JSON.stringify(data));
  const u = dms(['dataset', 'update', source, String(c.id), '--view', view, '--data', f, '--format', 'json']);
  if (!u.ok) throw new Error('dataset update returned ok=false');
  return c.id;
};

// ── 1. the SCWA Jurisdictions row
const scwaId = mk(JURIS.type, JURIS.source, JURIS.view, SCWA, `Jurisdictions ${SCWA.municipality_name}`);
console.log(`\nJurisdictions row created: ${scwaId}  ${SCWA.municipality_name} (${SCWA.municipality_type}) geoid ${SCWA.geoid}`);

// ── 2. the HOC rows
for (const t of TARGETS) {
  console.log(`\n${t.title} — creating ${HAZARDS.length} HOC rows`);
  for (const [i, hazard] of HAZARDS.entries()) {
    const data = {
      hazard,
      hazard_of_concern: 'Not Reported',
      geoid_juris: [t.geoid],
      geoid_county: 36103,
      county: 'Suffolk',
      jurisdiction: t.title,
    };
    const id = mk(HOC.type, HOC.source, HOC.view, data, `HOC ${t.title} / ${hazard}`);
    console.log(`  ${String(i + 1).padStart(2)}/${HAZARDS.length}  ${id}  ${hazard}`);
  }
}

// ── verify
const jurisAfter = dms(['dataset', 'query', JURIS.source, '--view', JURIS.view, '--filter', `geoid=${SCWA.geoid}`,
  '--limit', '5', '--format', 'json']);
console.log(`\nSCWA Jurisdictions row read-back: ${jurisAfter.total} row(s)`);
if (jurisAfter.total === 1) {
  const got = jurisAfter.items[0].data;
  const bad = Object.entries(SCWA).filter(([k, v]) => String(got[k]) !== String(v));
  console.log(bad.length ? `  DIFF ${JSON.stringify(bad)}` : '  all fields verified');
}
const hocAfter = dms(['dataset', 'query', HOC.source, '--view', HOC.view, '--filter', 'geoid_county=36103',
  '--limit', '5000', '--format', 'json']);
for (const t of TARGETS) {
  const rows = hocAfter.items.filter(r => (r.data.geoid_juris || []).map(String).includes(String(t.geoid)));
  const haz = new Set(rows.map(r => r.data.hazard));
  const missing = HAZARDS.filter(h => !haz.has(h));
  console.log(`${t.title.padEnd(32)} HOC rows: ${rows.length}/17 ${missing.length ? `MISSING ${missing.join(', ')}` : '✓ all named hazards present'}`);
}
console.log(`\nids -> ${createdPath}`);
