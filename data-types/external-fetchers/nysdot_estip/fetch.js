#!/usr/bin/env node
/**
 * NYSDOT capital-program harvester → one project-grain GeoPackage.
 *
 * Combines three public sources that all key on the NYSDOT PIN:
 *
 *   1. the eSTIP public API      one row per project in the current STIP
 *                                (region, MPO, agency, type, description, cost)
 *   2. its Mapbox project layers  the project geometry (point / line / polygon),
 *                                tagged with PROJECT_ID = the PIN
 *   3. the STIP region workbooks  per-phase and per-federal-fiscal-year dollars,
 *                                plus County, which the API does not expose
 *
 * Output: ONE GeoPackage layer, one row per project, geometry where it exists and
 * NULL where it does not — so the whole capital program is a single dataset
 * rather than three that have to be re-joined later.
 *
 * Endpoint documentation, join keys and access caveats:
 *   dms-template/references/workzone_saftey/NYSDOT_eSTIP_API.md
 *
 * Usage:
 *   npm install                       # once, in this directory
 *   node fetch.js                     # all steps into ./out
 *   node fetch.js --out /tmp/estip    # elsewhere
 *   node fetch.js --steps tiles,combine
 *   node fetch.js --keep-going        # don't stop on a failed workbook download
 *
 * Requires: node ≥ 18 (global fetch) and GDAL's ogr2ogr on PATH (xls → csv,
 * geojson → gpkg). Nothing here writes to a database; loading the GeoPackage is
 * a separate, deliberate step.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const vtMod = require('@mapbox/vector-tile');
const VectorTile = vtMod.VectorTile;
const Pbf = require('pbf').PbfReader;

// ── configuration ───────────────────────────────────────────────────────────

const SITE = 'https://nysdotestip.ecointeractive.com';
const API = 'https://api-pwi-prod.ecointeractive.com/api/v1/public';
const STIP_FILES = 'https://www.dot.ny.gov/programs/stip/files';
const REGION_FILES = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'SW'];
const UA = 'Mozilla/5.0 (AVAIL work_zone harvester; one-off)';

/** Tile layers to harvest. Zoom comes from each tileset's TileJSON maxzoom. */
const TILE_LAYERS = ['Production-NYSDOT-Point', 'Production-NYSDOT-LineString', 'Production-NYSDOT-Polygon'];
const TILE_CONCURRENCY = 6;   // someone else's public token and quota — stay modest

/** Region STIP workbook column order on the "Project List" sheet. */
const WB_COLUMNS = [
  'Region', 'MPO', 'ID', 'County', 'Air Quality', 'Agency', 'Plan Revision', 'Title', 'Description',
  'Fund Types (All)', 'Total Cost', '2026', '2027', '2028', '2029',
  'FHWA', 'FTA', 'FA_Costs', 'State', 'Local', 'MTA', 'NFARollup',
  'SCOPING', 'PRELDES', 'DETLDES', 'ROWINCD', 'ROWACQU', 'CONINSP', 'CONST', 'DESCONST', 'MISC',
  'OPER', 'VEHEQUIP',
];
/** Workbook phase columns → output column names. */
const PHASE_COLUMNS = {
  SCOPING: 'phase_scoping', PRELDES: 'phase_preldes', DETLDES: 'phase_detldes',
  ROWINCD: 'phase_rowincd', ROWACQU: 'phase_rowacqu', CONINSP: 'phase_coninsp',
  CONST: 'phase_const', DESCONST: 'phase_desconst', MISC: 'phase_misc',
  OPER: 'phase_oper', VEHEQUIP: 'phase_vehequip',
};

// ── small helpers ───────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : dflt;
};
const has = (name) => args.includes(`--${name}`);

const OUT = path.resolve(flag('out', path.join(__dirname, 'out')));
const STEPS = flag('steps', 'grid,tiles,workbooks,combine').split(',').map((s) => s.trim());
const KEEP_GOING = has('keep-going');
const log = (...m) => console.log(...m);

const ensureDir = (d) => fs.mkdirSync(d, { recursive: true });
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJson = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 1));

/** Numbers in the workbooks are bare digit strings; '', '-' and 'N/A' mean zero. */
function money(v) {
  const s = String(v ?? '').trim().replace(/[$,]/g, '');
  if (s === '' || s === '-' || s.toUpperCase() === 'N/A') return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
const txt = (v) => {
  const s = String(v ?? '').trim();
  return s === '' || s === '-' ? null : s;
};

async function get(url, { json = false, headers = {} } = {}) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers } });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return json ? res.json() : Buffer.from(await res.arrayBuffer());
}

function ogr2ogr(argv) {
  execFileSync('ogr2ogr', argv, { stdio: ['ignore', 'ignore', 'pipe'] });
}

// ── step: credentials ───────────────────────────────────────────────────────

/**
 * Both credentials are the portal's own PUBLIC values and can rotate, so they
 * are discovered at harvest time rather than hardcoded:
 *   - x-system-key  ← the tenant config's `systemToken`
 *   - Mapbox pk     ← REACT_APP_GL_MAP_KEY in the site's JS bundle (~7 MB, cached)
 */
async function credentials() {
  const cachePath = path.join(OUT, 'credentials.json');
  if (fs.existsSync(cachePath)) return readJson(cachePath);

  const tenant = await get(`${SITE}/static/tenants/nysdotestip.ecointeractive.com/tenantConfig.json`, { json: true });
  const systemKey = tenant.systemToken;
  if (!systemKey) throw new Error('tenantConfig.json carried no systemToken — the portal changed');

  const html = (await get(`${SITE}/interactive-map/?includeControls=true`)).toString('utf8');
  const bundle = (html.match(/src="(\/static\/js\/main\.[a-z0-9]+\.js)"/) || [])[1];
  if (!bundle) throw new Error('could not find the site JS bundle — the portal changed');
  const js = (await get(`${SITE}${bundle}`)).toString('utf8');
  const mapboxToken = (js.match(/REACT_APP_GL_MAP_KEY:"(pk\.[A-Za-z0-9._-]+)"/) || [])[1];
  if (!mapboxToken) throw new Error('could not find REACT_APP_GL_MAP_KEY in the bundle');

  const creds = { systemKey, mapboxToken, bundle, discovered_at: new Date().toISOString() };
  writeJson(cachePath, creds);
  log(`  credentials discovered (bundle ${bundle})`);
  return creds;
}

// ── step: the project grid ──────────────────────────────────────────────────

async function stepGrid(creds) {
  log('\n▶ grid — eSTIP project list');
  const res = await fetch(`${API}/ProjectRevisions/grid`, {
    method: 'POST',
    headers: { 'User-Agent': UA, 'x-system-key': creds.systemKey, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) throw new Error(`grid → ${res.status}`);
  const body = await res.json();
  writeJson(path.join(OUT, 'grid.json'), body);
  log(`  ${body.view.rows.length} rows · grid "${body.view.grid.title}"`);

  // The same table as XLSX, kept as the retrieved artifact.
  const xlsx = await get(`${API}/ProjectRevisions/grid/export/?`, { headers: { 'x-system-key': creds.systemKey } });
  fs.writeFileSync(path.join(OUT, 'grid_export.xlsx'), xlsx);
  log(`  grid_export.xlsx (${xlsx.length} bytes)`);
}

/** grid.json → { pin → merged row }, reading both the visible cells and the actionLink. */
function loadGrid() {
  const p = path.join(OUT, 'grid.json');
  if (!fs.existsSync(p)) return { rows: {}, title: null };
  const body = readJson(p);
  const titles = body.view.columns.map((c) => c.title);
  const rows = {};
  for (const r of body.view.rows) {
    const cells = {};
    (r.rowData || []).forEach((c, i) => { cells[titles[i]] = c.data; });
    const a = r.actionLink || {};
    const pin = String(a.clientProjectId || cells.ID || '').trim();
    if (!pin) continue;
    rows[pin] = { cells, link: a };
  }
  return { rows, title: body.view.grid.title };
}

// ── step: the Mapbox project layers ─────────────────────────────────────────

const lon2x = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);
const lat2y = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

async function stepTiles(creds) {
  log('\n▶ tiles — project geometry');
  for (const ts of TILE_LAYERS) {
    const tj = await get(`https://api.mapbox.com/v4/digyman.${ts}.json?access_token=${creds.mapboxToken}`, { json: true });
    const z = tj.maxzoom;
    const [w, s, e, n] = tj.bounds;
    const tiles = [];
    for (let x = lon2x(w, z); x <= lon2x(e, z); x++) {
      for (let y = lat2y(n, z); y <= lat2y(s, z); y++) tiles.push([x, y]);
    }
    const out = fs.createWriteStream(path.join(OUT, `tiles_${ts}.ndjson`));
    let done = 0, features = 0, empty = 0;
    log(`  ${ts}: z${z} (tileset maxzoom), ${tiles.length} tiles`);

    let cursor = 0;
    const worker = async () => {
      for (;;) {
        const i = cursor++;
        if (i >= tiles.length) return;
        const [x, y] = tiles[i];
        const buf = await tile(ts, z, x, y, creds.mapboxToken);
        done++;
        if (!buf) { empty++; continue; }
        const vt = new VectorTile(new Pbf(buf));
        for (const name of Object.keys(vt.layers)) {
          const layer = vt.layers[name];
          for (let k = 0; k < layer.length; k++) {
            const gj = layer.feature(k).toGeoJSON(x, y, z);
            out.write(`${JSON.stringify({ ts, z, x, y, props: gj.properties, geometry: gj.geometry })}\n`);
            features++;
          }
        }
      }
    };
    await Promise.all(Array.from({ length: TILE_CONCURRENCY }, worker));
    await new Promise((r) => out.end(r));
    log(`    ${done} tiles · ${features} features · ${empty} empty`);
  }
}

/** 404 = an empty tile, which is normal and not an error. Retries 429/5xx. */
async function tile(ts, z, x, y, token, attempt = 0) {
  const url = `https://api.mapbox.com/v4/digyman.${ts}/${z}/${x}/${y}.mvt?access_token=${token}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (res.status === 404) return null;
  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 4) throw new Error(`${ts} ${z}/${x}/${y} → ${res.status} after retries`);
    await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    return tile(ts, z, x, y, token, attempt + 1);
  }
  if (!res.ok) throw new Error(`${ts} ${z}/${x}/${y} → ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Tile features → { pin → geometry pieces }. Tiles clip geometry at their
 * edges, so one project arrives as several pieces; they are de-duplicated on
 * rounded coordinates (features repeat in neighbouring tiles' buffers) and then
 * merged into one multi-geometry per project.
 */
function loadTileGeometry() {
  const byPin = new Map();
  for (const ts of TILE_LAYERS) {
    const p = path.join(OUT, `tiles_${ts}.ndjson`);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      if (!line) continue;
      const d = JSON.parse(line);
      const pin = String(d.props.PROJECT_ID || '').trim();
      if (!pin) continue;
      if (!byPin.has(pin)) byPin.set(pin, { props: d.props, z: d.z, pieces: new Map() });
      const entry = byPin.get(pin);
      const key = `${d.geometry.type}:${JSON.stringify(d.geometry.coordinates).replace(/(\d+\.\d{6})\d+/g, '$1')}`;
      if (!entry.pieces.has(key)) entry.pieces.set(key, d.geometry);
    }
  }
  return byPin;
}

/** Merge like-typed pieces into a Multi*; fall back to a GeometryCollection. */
function mergeGeometry(pieces) {
  const geoms = [...pieces.values()];
  if (geoms.length === 1) return geoms[0];
  const base = (t) => t.replace(/^Multi/, '');
  const kinds = new Set(geoms.map((g) => base(g.type)));
  if (kinds.size === 1) {
    const kind = [...kinds][0];
    const coords = [];
    for (const g of geoms) {
      if (g.type.startsWith('Multi')) coords.push(...g.coordinates);
      else coords.push(g.coordinates);
    }
    return { type: `Multi${kind}`, coordinates: coords };
  }
  return { type: 'GeometryCollection', geometries: geoms };
}

// ── step: the region workbooks ──────────────────────────────────────────────

async function stepWorkbooks() {
  log('\n▶ workbooks — STIP region project lists');
  const xlsDir = path.join(OUT, 'workbooks');
  const csvDir = path.join(OUT, 'workbooks_csv');
  ensureDir(xlsDir); ensureDir(csvDir);
  for (const r of REGION_FILES) {
    const xls = path.join(xlsDir, `${r}.xls`);
    const csv = path.join(csvDir, `${r}.csv`);
    try {
      fs.writeFileSync(xls, await get(`${STIP_FILES}/${r}.xls`));
      fs.rmSync(csv, { force: true });
      ogr2ogr([csv, xls, 'Project List']);
      const rows = fs.readFileSync(csv, 'utf8').split('\n').filter(Boolean).length - 1;
      log(`  ${r}: ${rows} sheet rows`);
    } catch (err) {
      log(`  ${r}: FAILED — ${err.message}`);
      if (!KEEP_GOING) throw err;
    }
  }
}

/**
 * The sheet repeats its header row (once for the ogr field names, again as data,
 * and again at page breaks), so every row whose first cell is literally 'Region'
 * is dropped. Later files win on a duplicate PIN, which is recorded.
 */
function loadWorkbooks() {
  const dir = path.join(OUT, 'workbooks_csv');
  if (!fs.existsSync(dir)) return { rows: {}, duplicates: [] };
  const rows = {}; const duplicates = [];
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.csv'))) {
    const regionFile = f.replace(/\.csv$/, '');
    for (const line of parseCsv(fs.readFileSync(path.join(dir, f), 'utf8'))) {
      if (!line.length || line[0] === 'Field1' || line[0] === 'Region') continue;
      const rec = {};
      WB_COLUMNS.forEach((c, i) => { rec[c] = line[i]; });
      const pin = String(rec.ID || '').trim();
      if (!pin) continue;
      if (rows[pin]) duplicates.push(pin);
      rows[pin] = { ...rec, region_file: regionFile };
    }
  }
  return { rows, duplicates };
}

/** Minimal RFC4180 reader — the descriptions contain commas, quotes and newlines. */
function parseCsv(text) {
  const out = []; let row = []; let field = ''; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ',') { row.push(field); field = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { row.push(field); out.push(row); row = []; field = ''; continue; }
    field += c;
  }
  if (field !== '' || row.length) { row.push(field); out.push(row); }
  return out;
}

// ── step: combine ───────────────────────────────────────────────────────────

/**
 * Bridge Identification Numbers cited in a project's description.
 *
 * ~36% of the capital program has no public eSTIP geometry, but a quarter of
 * construction projects name their bridges. A BIN resolves to roadway geometry
 * through the RIS Legacy v2 bridge column (`bin_number`), so extracting them
 * here turns a text description into a locatable project — the join itself is
 * done in the database after loading, where RIS lives.
 *
 * Matches the keyword form only ('BIN 1234567', 'BINS 1234567 & 1234568',
 * 'BIN #1234567'); a bare 7-character token is far too common to trust.
 */
// \bBINS?\b matters: without the trailing boundary, 'BINGHAMTON' yields a
// phantom BIN of 'GHAMTON'. A BIN is 7 characters and mostly digits, so a
// candidate token must carry at least four of them.
const BIN_KEYWORD = /\bBINS?\b\s*(?:#|NO\.?|NUMBERS?)?\s*[:-]?\s*((?:[0-9A-Z]{7})(?:\s*(?:,|&|AND|\/|\+)\s*[0-9A-Z]{7})*)/gi;
const BIN_TOKEN = /[0-9A-Z]{7}/gi;
const digitsIn = (s) => (s.match(/\d/g) || []).length;

function binsFrom(...texts) {
  const hay = texts.filter(Boolean).join(' ').toUpperCase();
  const found = [];
  for (const m of hay.matchAll(BIN_KEYWORD)) {
    for (const t of m[1].matchAll(BIN_TOKEN)) {
      if (digitsIn(t[0]) >= 4) found.push(t[0]);
    }
  }
  return [...new Set(found)];
}

/**
 * Signed routes and county routes cited in a description.
 *
 * RIS stores routes compactly — `signing` 'I'/'NY'/'US' plus `route_number`,
 * surfaced as `route_display_value` ('NY27', 'I495', 'US20') — and project
 * descriptions use exactly that form, so a keyword-only regex ('ROUTE 27')
 * undercounts by roughly a third. Both forms are matched.
 *
 * Tokens are emitted as `<signing><number>`, with `?` for the signing when the
 * text gave a number without one ('ROUTE 145' → '?145'); the resolver then
 * matches those on route_number alone within the project's county.
 */
const ROUTE_DISPLAY = /\b(I|NY|US)[\s-]?(\d{1,3}[A-Z]?)\b/gi;
const ROUTE_KEYWORD = /\b(?:NYS?\s*)?(?:STATE\s+)?(?:ROUTE|RTE?\.?|INTERSTATE)\s*[-#]?\s*(\d{1,3}[A-Z]?)\b/gi;
const COUNTY_ROUTE = /\b(?:CR|COUNTY\s+(?:ROUTE|RD\.?|ROAD))\s*[-#]?\s*(\d{1,3}[A-Z]?)\b/gi;

function routesFrom(...texts) {
  const hay = texts.filter(Boolean).join(' ').toUpperCase();
  const found = [];
  for (const m of hay.matchAll(ROUTE_DISPLAY)) found.push(`${m[1].toUpperCase()}${m[2].toUpperCase()}`);
  for (const m of hay.matchAll(ROUTE_KEYWORD)) found.push(`?${m[1].toUpperCase()}`);
  return [...new Set(found)];
}

function countyRoutesFrom(...texts) {
  const hay = texts.filter(Boolean).join(' ').toUpperCase();
  return [...new Set([...hay.matchAll(COUNTY_ROUTE)].map((m) => m[1].toUpperCase()))];
}

/** NYSDOT PIN convention: first character encodes the Region. */
function regionFromPin(pin) {
  const c = String(pin || '').trim().charAt(0).toUpperCase();
  if (c === '0') return 10;
  if (c === 'X') return 11;
  if (c >= '1' && c <= '9') return Number(c);
  return null;   // statewide programs and other agencies' numbering
}

function stepCombine() {
  log('\n▶ combine — one row per project');
  const grid = loadGrid();
  const wb = loadWorkbooks();
  const geo = loadTileGeometry();

  const pins = new Set([...Object.keys(grid.rows), ...Object.keys(wb.rows), ...geo.keys()]);
  const harvestedAt = new Date().toISOString().slice(0, 10);
  const features = [];
  const stats = { total: 0, with_geometry: 0, in_grid: 0, in_workbook: 0, geometry_only: 0,
    const_funded: 0, with_bins: 0, const_funded_no_geom_with_bins: 0 };

  for (const pin of [...pins].sort()) {
    const g = grid.rows[pin];
    const w = wb.rows[pin];
    const t = geo.get(pin);

    const props = {
      // ── identity ──
      pin,
      project_title: txt(g && g.link.projectTitle) || txt(w && w.Title),
      estip_project_id: txt(g && g.link.projectId) || txt(t && t.props.INT_ID),
      estip_resource_id: txt(g && g.link.resourceId) || txt(t && t.props.INT_REV_ID),
      region: regionFromPin(pin) ?? (w ? Number(w.Region) || null : null),
      region_from_pin: regionFromPin(pin),
      // ── provenance ──
      in_estip_grid: !!g,
      in_stip_workbook: !!w,
      has_geometry: !!t,
      stip_cycle: grid.title,
      region_file: txt(w && w.region_file),
      harvested_at: harvestedAt,
      // ── eSTIP API attributes ──
      mpo: txt(w && w.MPO) || txt(g && g.cells.MPO),
      lead_agency: txt(w && w.Agency) || txt(g && g.cells['Lead Agency']),
      project_type: txt(g && g.link.projectType),
      project_type_id: txt(g && g.link.projectTypeId),
      project_type_category_id: txt(g && g.link.projectTypeCategoryId),
      project_category: txt(t && t.props.PROJECT_CA),
      funding_source: txt(g && g.cells['Funding Source']),
      tip_year_funding: txt(g && g.cells['TIP Year Funding']),
      total_cost_text: txt(g && g.cells['Total Cost']),
      // ── workbook attributes ──
      county: txt(w && w.County),
      air_quality: txt(w && w['Air Quality']),
      plan_revision: txt(w && w['Plan Revision']),
      description: txt(w && w.Description) || txt(g && g.cells.Description),
      fund_types_all: txt(w && w['Fund Types (All)']),
      total_cost: w ? money(w['Total Cost']) : null,
      ffy_2026: w ? money(w['2026']) : null,
      ffy_2027: w ? money(w['2027']) : null,
      ffy_2028: w ? money(w['2028']) : null,
      ffy_2029: w ? money(w['2029']) : null,
      fund_fhwa: w ? money(w.FHWA) : null,
      fund_fta: w ? money(w.FTA) : null,
      fund_fa_costs: w ? money(w.FA_Costs) : null,
      fund_state: w ? money(w.State) : null,
      fund_local: w ? money(w.Local) : null,
      fund_mta: w ? money(w.MTA) : null,
      fund_nfa_rollup: w ? money(w.NFARollup) : null,
    };
    for (const [src, dst] of Object.entries(PHASE_COLUMNS)) props[dst] = w ? money(w[src]) : null;

    // ── derived: is construction actually funded, and how much ──
    const constAmount = w ? money(w.CONST) + money(w.DESCONST) + money(w.CONINSP) : null;
    props.construction_amount = constAmount;
    props.is_construction_funded = w ? constAmount > 0 : null;

    // ── derived: BINs cited in the description (space-separated, never commas —
    //    a comma in a value is awkward for DMS filter chips and falcor keys) ──
    const bins = binsFrom(props.description, props.project_title);
    props.bins = bins.length ? bins.join(' ') : null;
    props.bin_count = bins.length;

    // ── derived: route locators, for the resolver to check against RIS ──
    const routes = routesFrom(props.description, props.project_title);
    const countyRoutes = countyRoutesFrom(props.description, props.project_title);
    props.locator_routes = routes.length ? routes.join(' ') : null;
    props.locator_county_routes = countyRoutes.length ? countyRoutes.join(' ') : null;

    // ── derived: geometry shape summary ──
    let geometry = null;
    if (t) {
      geometry = mergeGeometry(t.pieces);
      props.geom_type = geometry.type;
      props.geom_pieces = t.pieces.size;
      props.geom_source = `mapbox:digyman.Production-NYSDOT-* z${t.z}`;
    } else {
      props.geom_type = null;
      props.geom_pieces = 0;
      props.geom_source = null;
    }

    // ── location tier ──
    // Only tier 1a can be decided here: an eSTIP footprint is the project's own
    // geometry and needs nothing else. BIN bridges (1b) and route corridors (2)
    // depend on RIS, which lives in the database — resolve_ris.js fills those in
    // and overwrites these two columns. NULL means "not resolved yet", which is
    // deliberately distinguishable from 0 ("resolved, and unlocatable").
    props.location_tier = t ? 1 : null;
    props.location_method = t ? 'estip_footprint' : null;

    stats.total++;
    if (t) stats.with_geometry++;
    if (g) stats.in_grid++;
    if (w) stats.in_workbook++;
    if (t && !g && !w) stats.geometry_only++;
    if (props.is_construction_funded) stats.const_funded++;
    if (bins.length) stats.with_bins++;
    if (bins.length && !t && props.is_construction_funded) stats.const_funded_no_geom_with_bins++;

    features.push({ type: 'Feature', properties: props, geometry });
  }

  const geojsonPath = path.join(OUT, 'nysdot_capital_projects.geojson');
  fs.writeFileSync(geojsonPath, JSON.stringify({
    type: 'FeatureCollection',
    crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } },
    features,
  }));

  const gpkgPath = path.join(OUT, 'nysdot_capital_projects.gpkg');
  fs.rmSync(gpkgPath, { force: true });
  // -nlt GEOMETRY: point, line, polygon and null geometries share one layer.
  ogr2ogr(['-f', 'GPKG', gpkgPath, geojsonPath, '-nln', 'nysdot_capital_projects',
    '-nlt', 'GEOMETRY', '-a_srs', 'EPSG:4326', '-lco', 'FID=ogc_fid', '-lco', 'GEOMETRY_NAME=wkb_geometry']);

  writeJson(path.join(OUT, 'combine_stats.json'), { ...stats, workbook_duplicate_pins: wb.duplicates.length });
  log(`  ${stats.total} projects → nysdot_capital_projects.gpkg`);
  log(`    in eSTIP grid      ${stats.in_grid}`);
  log(`    in STIP workbook   ${stats.in_workbook}`);
  log(`    with geometry      ${stats.with_geometry}  (${(100 * stats.with_geometry / stats.total).toFixed(1)}%)`);
  log(`    geometry only      ${stats.geometry_only}  (not in the current STIP tables)`);
  log(`    construction $     ${stats.const_funded}`);
  log(`    cite a BIN         ${stats.with_bins}  (of which ${stats.const_funded_no_geom_with_bins} are construction-funded with no geometry)`);
  log(`    tier 1 (eSTIP)     ${stats.with_geometry}  — run resolve_ris.js to add BIN bridges (1b) and route corridors (2)`);
  return { gpkgPath, stats };
}

// ── main ────────────────────────────────────────────────────────────────────

(async () => {
  ensureDir(OUT);
  log(`NYSDOT eSTIP harvest → ${OUT}\n  steps: ${STEPS.join(', ')}`);
  const needsCreds = STEPS.some((s) => s === 'grid' || s === 'tiles');
  const creds = needsCreds ? await credentials() : null;

  if (STEPS.includes('grid')) await stepGrid(creds);
  if (STEPS.includes('tiles')) await stepTiles(creds);
  if (STEPS.includes('workbooks')) await stepWorkbooks();
  if (STEPS.includes('combine')) stepCombine();
  log('\n✓ harvest complete');
})().catch((err) => { console.error(`\n✗ harvest failed: ${err.message}`); process.exit(1); });
