#!/usr/bin/env node
/**
 * Resolve project locations against RIS, and assign each project a location tier.
 *
 * `fetch.js` can only decide tier 1a — an eSTIP footprint is the project's own
 * geometry and needs nothing else. The other locators are text citations that
 * have to be checked against the Roadway Inventory, which lives in the database.
 * This script does that (READ-ONLY against RIS), fills in the geometry it can,
 * and rewrites the combined dataset with a final tier.
 *
 *   tier 1  the project's own geometry
 *           1a  estip_footprint   the eSTIP map layer's point/line/polygon
 *           1b  bin_bridge        RIS segments carrying a BIN the description cites
 *   tier 2  a corridor within a county — locates, but is NOT a project extent
 *           2a  route_county      RIS segments for a cited signed route in the county
 *           2b  county_route      RIS segments for a cited county route in the county
 *   tier 0  no locator resolved
 *
 * Tier 1 geometry is materialised into the output. **Tier 2 geometry deliberately
 * is not** — a signed route within a county can be tens of miles and thousands of
 * segments, and writing that onto a project row would read as "this is where the
 * work zone is" when it is only "this is the corridor it is on". Tier-2 rows keep
 * their locator columns so the corridor can be joined from RIS on demand.
 *
 * Tier 3 (road-name matching) is intentionally not implemented: spot-checking
 * showed most road-name hits are the project's endpoint cross street rather than
 * its own alignment.
 *
 * Usage:
 *   node resolve_ris.js                          # ./out, npmrds2, RIS 2026
 *   node resolve_ris.js --out /tmp/estip
 *   node resolve_ris.js --pg-env npmrds2 --ris-view 3638
 *   node resolve_ris.js --dry-run                # report tiers, write nothing
 *
 * Reads its connection from the dms-server db config for `--pg-env`. Runs only
 * SELECTs. Re-runnable: it always recomputes from the harvested columns.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { Client } = require('pg');

const args = process.argv.slice(2);
const flag = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};
const OUT = path.resolve(flag('out', path.join(__dirname, 'out')));
const PG_ENV = flag('pg-env', 'npmrds2');
const RIS_VIEW = flag('ris-view', '3638');           // 2026 vintage of source 2105
const CONFIG_DIR = flag('config-dir',
  path.join(__dirname, '..', '..', '..', 'src', 'dms', 'packages', 'dms-server', 'src', 'db', 'configs'));
const DRY = args.includes('--dry-run');
const log = (...m) => console.log(...m);

function connect() {
  const cfgPath = path.join(CONFIG_DIR, `${PG_ENV}.config.json`);
  if (!fs.existsSync(cfgPath)) throw new Error(`no db config at ${cfgPath} (pass --config-dir)`);
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  return new Client({
    host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password,
    database: cfg.database, statement_timeout: 300000,
  });
}

/** Confirm the view really is the RIS vintage we think it is before trusting it. */
async function risTable(db) {
  const { rows } = await db.query(
    `SELECT v.view_id, v.version, v.table_schema, v.table_name, s.name AS source_name
       FROM data_manager.views v JOIN data_manager.sources s USING (source_id)
      WHERE v.view_id = $1`, [RIS_VIEW]);
  if (!rows[0]) throw new Error(`view ${RIS_VIEW} does not exist in ${PG_ENV}`);
  const v = rows[0];
  log(`  RIS: view ${v.view_id} "${v.source_name.trim()}" version ${v.version} → ${v.table_schema}.${v.table_name}`);
  return `"${v.table_schema}"."${v.table_name}"`;
}

/**
 * Merge several BINs' geometry for one project into a single MultiLineString.
 *
 * Every input must already be line-typed (the query homogenizes), so anything
 * else is a bug in the query rather than a row to paper over — an earlier
 * version silently produced `coordinates: [null, null]` for 53 projects by
 * flat-mapping `.coordinates` off geometry types that do not have it.
 */
function mergeLines(geoms, pin) {
  const coordinates = [];
  for (const g of geoms) {
    if (g.type === 'MultiLineString') coordinates.push(...g.coordinates);
    else if (g.type === 'LineString') coordinates.push(g.coordinates);
    else throw new Error(`project ${pin}: cannot merge a ${g.type} BIN geometry — fix the RIS query`);
  }
  return { type: 'MultiLineString', coordinates };
}

/** No geometry may carry a null/empty coordinate list. Cheap, and it caught a real bug. */
function validate(features) {
  const bad = [];
  const walk = (g) => {
    if (!g) return true;
    if (g.type === 'GeometryCollection') return (g.geometries || []).length > 0 && g.geometries.every(walk);
    const c = g.coordinates;
    if (!Array.isArray(c) || c.length === 0) return false;
    return JSON.stringify(c).indexOf('null') === -1;
  };
  for (const f of features) if (!walk(f.geometry)) bad.push(f.properties.pin);
  if (bad.length) {
    throw new Error(`${bad.length} projects have empty or null geometry (${bad.slice(0, 5).join(', ')}…) — refusing to write`);
  }
}

async function main() {
  const geojsonPath = path.join(OUT, 'nysdot_capital_projects.geojson');
  if (!fs.existsSync(geojsonPath)) {
    throw new Error(`${geojsonPath} not found — run fetch.js first`);
  }
  const fc = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
  log(`resolve → ${OUT}\n  ${fc.features.length} projects · pgEnv ${PG_ENV}${DRY ? ' · DRY RUN' : ''}`);

  const db = connect();
  await db.connect();
  try {
    const RIS = await risTable(db);

    // ── the BINs actually cited, and their geometry ──
    const citedBins = [...new Set(fc.features.flatMap((f) => (f.properties.bins || '').split(' ').filter(Boolean)))];
    const binGeom = new Map();
    if (citedBins.length) {
      // One geometry per BIN: a long bridge is many RIS segments (the Robert
      // Moses Causeway is 23), so collect them and keep SRID 4326 explicit.
      // ST_Collect over MultiLineStrings yields a GEOMETRYCOLLECTION, which
      // ST_Multi will NOT flatten — CollectionHomogenize is what turns
      // like-typed parts into a single MultiLineString.
      const { rows } = await db.query(
        `SELECT bin_number,
                count(*)::int AS segs,
                ST_AsGeoJSON(ST_SetSRID(ST_Multi(ST_CollectionHomogenize(ST_Collect(wkb_geometry))), 4326)) AS gj
           FROM ${RIS}
          WHERE bin_number = ANY($1::text[])
          GROUP BY bin_number`, [citedBins]);
      for (const r of rows) binGeom.set(r.bin_number, { segs: r.segs, geometry: JSON.parse(r.gj) });
      log(`  BINs: ${citedBins.length} cited · ${binGeom.size} resolve in RIS (${(100 * binGeom.size / citedBins.length).toFixed(1)}%)`);
    }

    // ── which signed / county routes exist in which county ──
    const { rows: routeRows } = await db.query(
      `SELECT DISTINCT upper(county_name) AS county, coalesce(signing,'') AS signing, route_number
         FROM ${RIS} WHERE route_number IS NOT NULL AND county_name IS NOT NULL`);
    const routesByCounty = new Map();
    const numbersByCounty = new Map();
    for (const r of routeRows) {
      if (!routesByCounty.has(r.county)) { routesByCounty.set(r.county, new Set()); numbersByCounty.set(r.county, new Set()); }
      routesByCounty.get(r.county).add(`${r.signing}${r.route_number}`);
      numbersByCounty.get(r.county).add(r.route_number);
    }
    const { rows: crRows } = await db.query(
      `SELECT DISTINCT upper(county_name) AS county, county_road
         FROM ${RIS} WHERE nullif(county_road,'') IS NOT NULL AND county_name IS NOT NULL`);
    const countyRoadsByCounty = new Map();
    for (const r of crRows) {
      if (!countyRoadsByCounty.has(r.county)) countyRoadsByCounty.set(r.county, new Set());
      countyRoadsByCounty.get(r.county).add(r.county_road);
    }
    log(`  routes: ${routeRows.length} county×signed-route pairs · ${crRows.length} county×county-route pairs`);

    // ── assign a tier per project ──
    const tally = { 0: 0, 1: 0, 2: 0 };
    const methods = {};
    // The STIP's County column is a LIST for multi-county projects
    // ('ERIE, NIAGARA'; 'BRONX, KINGS, NEW YORK, QUEENS, RICHMOND' — 129 of the
    // 194 distinct values, on 821 projects). Matching it whole against a single
    // RIS county_name silently fails every one of them, so split and match any.
    const countiesOf = (v) => (v || '').toUpperCase().split(',').map((x) => x.trim()).filter(Boolean);

    for (const f of fc.features) {
      const p = f.properties;
      const counties = countiesOf(p.county);

      // tier 1a — already decided by fetch.js, and it wins: it is the project's own footprint
      if (f.geometry) {
        p.location_tier = 1;
        p.location_method = 'estip_footprint';
      } else {
        // tier 1b — BIN bridges
        const bins = (p.bins || '').split(' ').filter((b) => binGeom.has(b));
        if (bins.length) {
          const geoms = bins.map((b) => binGeom.get(b).geometry);
          f.geometry = geoms.length === 1 ? geoms[0] : mergeLines(geoms, p.pin);
          p.location_tier = 1;
          p.location_method = 'bin_bridge';
          p.geom_type = f.geometry.type;
          p.geom_pieces = bins.reduce((n, b) => n + binGeom.get(b).segs, 0);
          p.geom_source = `ris:view_${RIS_VIEW}:bin_number(${bins.join(' ')})`;
        } else {
          // tier 2 — a corridor in the county; geometry deliberately not materialised
          const cited = (p.locator_routes || '').split(' ').filter(Boolean);
          const routeHit = counties.some((county) => {
            const known = routesByCounty.get(county) || new Set();
            const nums = numbersByCounty.get(county) || new Set();
            return cited.some((tok) => (tok.startsWith('?') ? nums.has(tok.slice(1)) : known.has(tok)));
          });
          const citedCr = (p.locator_county_routes || '').split(' ').filter(Boolean);
          const crHit = counties.some((county) =>
            citedCr.some((n) => (countyRoadsByCounty.get(county) || new Set()).has(n)));
          if (routeHit) { p.location_tier = 2; p.location_method = 'route_county'; }
          else if (crHit) { p.location_tier = 2; p.location_method = 'county_route'; }
          else { p.location_tier = 0; p.location_method = null; }
        }
      }
      p.location_resolved_against = `ris_view_${RIS_VIEW}`;
      tally[p.location_tier]++;
      methods[p.location_method || 'none'] = (methods[p.location_method || 'none'] || 0) + 1;
    }

    // ── report ──
    const construction = fc.features.filter((f) => f.properties.is_construction_funded === true);
    const share = (n, d) => `${n} (${(100 * n / d).toFixed(1)}%)`;
    log('\n  location tiers — all projects:');
    log(`    tier 1 (own geometry)   ${share(tally[1], fc.features.length)}`);
    log(`    tier 2 (corridor)       ${share(tally[2], fc.features.length)}`);
    log(`    tier 0 (unlocated)      ${share(tally[0], fc.features.length)}`);
    log('  by method: ' + Object.entries(methods).map(([k, v]) => `${k}=${v}`).join(' · '));
    const c1 = construction.filter((f) => f.properties.location_tier === 1).length;
    const c2 = construction.filter((f) => f.properties.location_tier === 2).length;
    log('\n  construction-funded projects:');
    log(`    tier 1                  ${share(c1, construction.length)}`);
    log(`    tier 1 or 2             ${share(c1 + c2, construction.length)}`);

    validate(fc.features);
    log(`  geometry validated: ${fc.features.filter((f) => f.geometry).length} non-null, none empty`);

    if (DRY) { log('\n  --dry-run: nothing written'); return; }

    fs.writeFileSync(geojsonPath, JSON.stringify(fc));
    const gpkg = path.join(OUT, 'nysdot_capital_projects.gpkg');
    fs.rmSync(gpkg, { force: true });
    execFileSync('ogr2ogr', ['-f', 'GPKG', gpkg, geojsonPath,
      '-nln', 'nysdot_capital_projects', '-nlt', 'GEOMETRY', '-a_srs', 'EPSG:4326',
      '-lco', 'FID=ogc_fid', '-lco', 'GEOMETRY_NAME=wkb_geometry'], { stdio: ['ignore', 'ignore', 'pipe'] });
    log(`\n✓ rewrote nysdot_capital_projects.gpkg with location tiers`);
  } finally {
    await db.end();
  }
}
main().catch((err) => { console.error(`\n✗ resolve failed: ${err.message}`); process.exit(1); });
