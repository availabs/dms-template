/**
 * Fetch the EXISTING rows of an MNY forms dataset for one county, so Phase-7 payloads can be
 * matched against them before loading (match_existing.py).
 *
 * ============================================================================================
 * SCOPE A COUNTY BY GEOID. NEVER BY THE `county` NAME COLUMN.
 * ============================================================================================
 * `county` is a human-readable name and is expected to be **deprecated** (owner, 2026-08-24).
 * It is also the thing this project's own skill already warns against joining on -- names drift
 * between datasets ("Suffolk County" vs "Suffolk (County)"). An earlier revision of this script
 * filtered Roles / Participation / HOC on `county=Nassau`, which worked and was still wrong:
 * it would break silently the day the column goes away, and a silent break here reads as
 * "this county has no existing rows", which is the one wrong answer that causes duplicate loads.
 *
 * So the strategy is chosen from the GEOID columns only, in this order:
 *
 *   1. `geoid_juris`   declared `select`  -> one small filtered query per jurisdiction
 *   2. `geoid_county`  declared `select`  -> one filtered query for the county
 *   3. neither is filterable              -> FULL FETCH, then match geoid client-side
 *
 * ---- why the type matters: the --filter trap ----
 * `--filter` is compiled from a column's **DECLARED** type. A filter on any column declared
 * `multiselect` returns **0 rows** regardless of content, and that zero is indistinguishable
 * from "there is nothing there". Measured across the five MNY forms datasets, 2026-08-24:
 *
 *   dataset         geoid_juris   geoid/county_geoid   strategy
 *   actions         select        multiselect          per-geoid
 *   capabilities    select        select               per-geoid
 *   hoc             multiselect   select               by county geoid
 *   roles           multiselect   multiselect          FULL FETCH  (516 rows statewide)
 *   participation   multiselect   multiselect          FULL FETCH  (324 rows statewide)
 *
 * Roles and Participation have NO filterable geoid column at all, which is exactly why the
 * county-name filter was reached for. The honest answer is a full fetch: both are tiny.
 * Size before fetching -- if a dataset in this position were large, that is a real problem to
 * raise, not to paper over with a name filter.
 *
 * ---- verify every zero ----
 * A real zero reproduces as non-zero for a county known to hold data; a broken filter returns 0
 * for both. `--verify` does that comparison. Never report "no existing rows" without it.
 *
 * Usage: node fetch_live.mjs <actions|capabilities|roles|participation|hoc> [--verify]
 * Writes: extracted/live_<dataset>_<county>.json   {geoid: [{id, data}]}
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const CTX = path.resolve(HERE, '..');
const CLI = path.resolve(CTX, '../../../../src/dms/packages/dms/cli/bin/dms.js');

const COUNTY = process.env.MNY_COUNTY || 'Nassau';
const COUNTY_GEOID = process.env.MNY_COUNTY_GEOID || '36059';
// A county known to hold rows in every one of these datasets, for --verify.
const CONTROL_GEOID = '36103';          // Suffolk
const CONTROL_NAME = 'Suffolk';

const DATASETS = {
  actions:       { source: '1029065', view: '1074456', strategy: 'juris' },
  capabilities:  { source: '1068273', view: '1172519', strategy: 'juris' },
  hoc:           { source: '1473470', view: '1473471', strategy: 'county_geoid',
                   countyCol: 'geoid_county' },
  roles:         { source: '1473295', view: '1473296', strategy: 'full',
                   why: 'geoid_juris AND geoid_county are both declared multiselect' },
  participation: { source: '1473468', view: '1473469', strategy: 'full',
                   why: 'geoid_juris AND geoid_county are both declared multiselect' },
  // The Jurisdictions dataset keys on `geoid`, not `geoid_juris`, and it is the UPDATE target
  // for the seven lexical prose columns.
  jurisdictions: { source: '1346449', view: '1346450', strategy: 'county_geoid',
                   countyCol: 'county_geoid', geoidCol: 'geoid' },
};

const WHICH = process.argv[2];
const VERIFY = process.argv.includes('--verify');
const DS = DATASETS[WHICH];
if (!DS) {
  console.error(`Usage: node fetch_live.mjs <${Object.keys(DATASETS).join('|')}> [--verify]`);
  process.exit(2);
}

process.env.DMS_HOST ||= 'https://dmsserver.availabs.org';
process.env.DMS_APP ||= 'mitigat-ny-prod';
process.env.DMS_TYPE ||= 'prod';

const dms = (args) => {
  const out = execFileSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8', env: process.env, stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 256 * 1024 * 1024,
  });
  const i = out.indexOf('{');
  if (i < 0) throw new Error(`no JSON in CLI output: ${out.slice(0, 300)}`);
  return JSON.parse(out.slice(i));
};
const query = (filter, limit = 20000) => {
  const args = ['dataset', 'query', DS.source, '--view', DS.view,
    '--limit', String(limit), '--format', 'json'];
  if (filter) args.push('--filter', filter);
  return dms(args);
};

/**
 * The jurisdiction geoid(s) of a row, as strings.
 *
 * Most forms datasets carry it as `geoid_juris`; the Jurisdictions dataset itself calls the
 * column plainly `geoid`, because there the row IS the jurisdiction. `geoidCol` overrides.
 */
const jurisGeoids = (d) => {
  const g = d?.[DS.geoidCol || 'geoid_juris'];
  if (g === null || g === undefined || g === '') return [];
  return (Array.isArray(g) ? g : [g]).map(String);
};
/** geoid_county / county_geoid, whichever this dataset uses, as strings. */
const countyGeoids = (d) => {
  const g = d?.geoid_county ?? d?.county_geoid;
  if (g === null || g === undefined || g === '') return [];
  return (Array.isArray(g) ? g : [g]).map(String);
};

// ---------------------------------------------------------------- the jurisdiction list
const lines = fs.readFileSync(path.join(CTX, 'nassau-jurisdiction-aliases.csv'), 'utf8')
  .trim().split(/\r?\n/);
const head = lines[0].split(',');
const gi = head.indexOf('geoid'), ni = head.indexOf('jurisdiction_title');
const juris = lines.slice(1).map(l => l.split(',')).map(r => ({ geoid: r[gi], name: r[ni] }));
const mine = new Set(juris.map(j => j.geoid));

/** Does this row belong to the county? Geoid only -- never the county name. */
const belongs = (d) =>
  jurisGeoids(d).some(g => mine.has(g)) || countyGeoids(d).includes(String(COUNTY_GEOID));

// ---------------------------------------------------------------- fetch
const out = {};
let total = 0, unplaced = 0;

const place = (x) => {
  const gs = jurisGeoids(x.data).filter(g => mine.has(g));
  if (!gs.length) { unplaced++; return; }
  for (const g of gs) { (out[g] ||= []).push({ id: String(x.id), data: x.data }); total++; }
};

if (DS.strategy === 'juris') {
  console.log(`strategy: one filtered query per jurisdiction on geoid_juris (declared select)`);
  for (const j of juris) {
    let res;
    try { res = query(`geoid_juris=${j.geoid}`, 2000); }
    catch (e) { console.log(`  ${j.geoid} ${j.name} -- FAILED ${e.message.slice(0, 80)}`); continue; }
    const items = (res.items || []).map(x => ({ id: String(x.id), data: x.data }));
    out[j.geoid] = items;
    total += items.length;
    if (items.length) console.log(`  ${j.geoid} ${j.name}: ${items.length}`);
  }
} else if (DS.strategy === 'county_geoid') {
  const col = DS.countyCol;
  console.log(`strategy: one filtered query on ${col}=${COUNTY_GEOID} (declared select)`);
  const res = query(`${col}=${COUNTY_GEOID}`);
  const items = res.items || [];
  console.log(`  ${items.length} row(s) returned (source reports total=${res.total})`);
  items.forEach(place);
} else {
  // No filterable geoid column exists. Size it, then take the whole thing.
  const probe = query(null, 1);
  console.log(`strategy: FULL FETCH -- ${DS.why}`);
  console.log(`          ${probe.total} row(s) statewide; small enough to take whole.`);
  if (probe.total > 20000) {
    console.error(`REFUSING: ${probe.total} rows is too large to full-fetch. A filterable ` +
      `geoid column is needed -- do NOT fall back to the county name column.`);
    process.exit(1);
  }
  const res = query(null);
  (res.items || []).filter(x => belongs(x.data)).forEach(place);
  console.log(`  ${res.items.length} fetched, ${total} belong to ${COUNTY} by geoid`);
}
for (const j of juris) out[j.geoid] ||= [];
if (unplaced) {
  console.log(`  ${unplaced} row(s) matched the county but carry no jurisdiction geoid ` +
    `belonging to it -- NOT placed. Investigate rather than ignore.`);
}

// ---------------------------------------------------------------- verify a zero
if (VERIFY) {
  console.log(`\n--verify: is this count real, or a broken filter?`);
  try {
    let r;
    if (DS.strategy === 'juris') {
      // A jurisdiction geoid in the control county: Islip (Town), Suffolk.
      r = query('geoid_juris=3610338000', 1);
      console.log(`  same filter shape, control jurisdiction 3610338000: total=${r.total}`);
    } else if (DS.strategy === 'county_geoid') {
      r = query(`${DS.countyCol}=${CONTROL_GEOID}`, 1);
      console.log(`  same filter shape, ${CONTROL_NAME} (${CONTROL_GEOID}): total=${r.total}`);
    } else {
      r = query(null, 1);
      console.log(`  unfiltered total: ${r.total} (full fetch cannot silently return 0)`);
    }
    console.log(r.total > 0
      ? `  -> the query shape works, so a 0 for ${COUNTY} is a REAL zero.`
      : `  -> 0 for the control too: treat this as BROKEN, not as an empty dataset.`);
  } catch (e) {
    console.log(`  verify failed: ${e.message.slice(0, 120)}`);
  }
}

const outName = `live_${WHICH}_${COUNTY.toLowerCase()}.json`;
fs.writeFileSync(path.join(CTX, 'extracted', outName), JSON.stringify(out, null, 1));
const withRows = Object.values(out).filter(v => v.length).length;
console.log(`\n${total} existing ${WHICH} row(s) across ${withRows}/${juris.length} jurisdictions`);
console.log(`-> extracted/${outName}`);
