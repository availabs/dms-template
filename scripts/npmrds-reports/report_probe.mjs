// report_probe.mjs — one-stop Playwright probe for DMS report pages on the local dev stack.
//
// Replaces the family of one-off scratchpad scripts (shot_*, capture_*, probe_svg*,
// verify_report_*, dom_probe_*). One page load collects everything at once:
//   - console errors + uncaught page errors
//   - every dms-server response (count, non-200 list)
//   - requests still pending at close (signal for unbounded/hung ClickHouse queries)
//   - SQL/ClickHouse errors that come back as a 200 with an error payload (status-code checks
//     alone miss these, and the page often just renders blank with no console error either)
//   - decoded /graph traffic (URL-encoded Falcor paths + POST bodies decoded to readable text)
//   - per-section SVG census (distinguishes "rendered blank" from "never rendered")
//   - visible body text
//   - full-page screenshot + machine-readable JSON dump
//
// Usage:
//   node scripts/npmrds-reports/report_probe.mjs <slug-or-full-url> [options]
//
// Examples:
//   node scripts/npmrds-reports/report_probe.mjs report_1070
//   node scripts/npmrds-reports/report_probe.mjs report_1070 --grep hours_of_delay --wait 10000
//   node scripts/npmrds-reports/report_probe.mjs report_796 --section "Travel Time" --no-json
//   node scripts/npmrds-reports/report_probe.mjs report_11 --eval scratchpad/npmrds-sub/tmp/my_probe.mjs
//
// Options:
//   --wait <ms>       settle time after networkidle (default 6000)
//   --grep <substr>   only include /graph captures whose decoded request matches (repeatable);
//                     response bodies are stored only for matches unless --bodies
//   --bodies          store response bodies for ALL /graph captures (default: only --grep matches,
//                     or all when no --grep given)
//   --section <text>  additionally screenshot the section whose heading contains <text>
//   --eval <file>     after settle, run `export default async (page) => any` from <file>;
//                     result is printed and included in the JSON dump
//   --auth [file]     load as an authenticated user by injecting the minted DMS token
//                     into localStorage.userToken (default token file:
//                     scratchpad/npmrds-sub/.dms-auth-token — refresh it by having
//                     Ryan run scratchpad/npmrds-sub/mint_token.sh). Needed for
//                     edit-mode probes; a stale token silently degrades to anon.
//   --host <origin>   page origin (default http://www.localhost:5173/npmrds — the npmrds_sub
//                     pattern's subdomain mount was retired 2026-09-02 in favor of this
//                     path-mounted one; bare localhost or the old npmrds.localhost subdomain
//                     both route to the wrong pattern now)
//   --api <origin>    dms-server origin to capture (default http://localhost:3001)
//   --viewport WxH    default 1600x1000
//   --out <dir>       output dir (default scratchpad/npmrds-sub/tmp)
//   --no-shot         skip screenshot
//   --no-json         skip JSON dump
//   --expect <spec>   assert the live page matches a report_build.mjs spec (see
//                      research/npmrds-reports/report-spec.md for the format): every AVL Graph/
//                      Map/Info Box graph fired a real /graph request carrying exactly its
//                      assigned routes as seriesVariants, and no console/page errors. Prints
//                      PASS/FAIL per assertion and exits 1 on any failure (exit 0 otherwise) —
//                      the only flag that turns this script's normally report-only output into
//                      a gate. Matches a spec graph to a live query by checking that every one of
//                      its assigned routes' `name` appears in the query's decoded seriesVariants
//                      labels, not by any structural id — see the "--verify decision" in
//                      planning/transportny/tasks/current/report-spec-and-build-script.md for why
//                      this lives here instead of on report_build.mjs itself. RouteCompare graphs
//                      are skipped (no seriesVariants-shaped query); Map/Info Box are included
//                      (confirmed 2026-07-28 to ride the same comparisonSeries query path as AVL
//                      Graph — see report-spec.md's "startTime/endTime" section).
//
// For a truly novel probe, prefer --eval with a tiny probe file over forking this script.
// If the same --eval probe gets written twice, promote it to a flag here.

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// ---- args ----------------------------------------------------------------
const argv = process.argv.slice(2);
const target = argv[0];
if (!target || target.startsWith('--')) {
  console.error('usage: node scripts/npmrds-reports/report_probe.mjs <slug-or-url> [--wait ms] [--grep s]... [see header]');
  process.exit(2);
}
const opts = {
  wait: 6000,
  greps: [],
  bodies: false,
  section: null,
  eval: null,
  host: 'http://www.localhost:5173/npmrds',
  api: 'http://localhost:3001',
  viewport: { width: 1600, height: 1000 },
  out: path.join(repoRoot, 'scratchpad/npmrds-sub/tmp'),
  shot: true,
  json: true,
  auth: null,
  block: [], // substrings of request URLs to abort — for isolating connection-pool/waterfall effects
  expect: null,
};
for (let i = 1; i < argv.length; i++) {
  const a = argv[i];
  const next = () => argv[++i];
  if (a === '--wait') opts.wait = Number(next());
  else if (a === '--grep') opts.greps.push(next());
  else if (a === '--block') opts.block.push(next());
  else if (a === '--bodies') opts.bodies = true;
  else if (a === '--section') opts.section = next();
  else if (a === '--eval') opts.eval = next();
  else if (a === '--expect') opts.expect = next();
  else if (a === '--host') opts.host = next();
  else if (a === '--api') opts.api = next();
  else if (a === '--viewport') {
    const [w, h] = next().split('x').map(Number);
    opts.viewport = { width: w, height: h };
  } else if (a === '--out') opts.out = path.resolve(next());
  else if (a === '--no-shot') opts.shot = false;
  else if (a === '--no-json') opts.json = false;
  else if (a === '--auth') {
    opts.auth = (argv[i + 1] && !argv[i + 1].startsWith('--'))
      ? path.resolve(next())
      : path.join(repoRoot, 'scratchpad/npmrds-sub/.dms-auth-token');
  }
  else { console.error(`unknown option: ${a}`); process.exit(2); }
}
const url = target.startsWith('http') ? target : `${opts.host}/${target}`;
// Sanitize in both branches — a bare slug target can itself contain '/' (parent/slug, the norm
// for every converted-report page) or a '?query=param' (e.g. Dynamic Report's `?routes=`), and an
// unsanitized slug silently lands the JSON/screenshot output in a nested subdirectory instead of
// erroring (Playwright's screenshot `path` option auto-creates missing parent dirs, masking it).
const rawSlug = target.startsWith('http') ? new URL(target).pathname : target;
const slug = rawSlug.replace(/\W+/g, '_').replace(/^_+|_+$/g, '') || 'index';
mkdirSync(opts.out, { recursive: true });

// ---- collect -------------------------------------------------------------
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: opts.viewport });
if (opts.auth) {
  const token = readFileSync(opts.auth, 'utf8').trim();
  await page.addInitScript(t => localStorage.setItem('userToken', t), token);
  console.log(`auth: injecting userToken from ${opts.auth}`);
}

const consoleErrors = [];
const pageErrors = [];
const badResponses = [];
const graphCaptures = [];
const sqlErrors = []; // /graph responses whose 200 body still carries a DB error string — see below
const pending = new Map(); // api-origin requests with no response yet
let apiResponses = 0;
let graphTotal = 0;
const navStart = Date.now(); // ms reference for graphCaptures[].tMs — diagnoses render-vs-fetch timing gaps

// A ClickHouse/Postgres query error can come back as a 200 with an error payload — status-code
// checks alone (badResponses above) miss it entirely, and the page often just renders blank with
// no console/page error either. Borrowed from qa_skills/tools/qa_assess.mjs's identical check
// (same regex core), extended with ClickHouse's own "DB::Exception"/"Code: N" error shape since
// these are ClickHouse-backed queries, not just Postgres.
const SQL_ERROR_RE = /(syntax error[^"]{0,160}|column [^"]{0,80} does not exist|relation [^"]{0,80} does not exist|DB::Exception[^"]{0,160}|Code:\s*\d+[^"]{0,160})/i;

page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 400)); });
page.on('pageerror', e => pageErrors.push(String(e.message).slice(0, 400)));
if (opts.block.length) {
  await page.route('**/*', route => {
    const u = route.request().url();
    if (opts.block.some(b => u.includes(b))) return route.abort();
    return route.continue();
  });
}
page.on('request', req => {
  if (req.url().startsWith(opts.api)) pending.set(req, decodeURIComponent(req.url()).slice(0, 300));
});
page.on('requestfailed', req => pending.delete(req));
page.on('response', async resp => {
  const req = resp.request();
  pending.delete(req);
  const u = resp.url();
  if (!u.startsWith(opts.api)) return;
  apiResponses++;
  if (resp.status() !== 200) badResponses.push({ status: resp.status(), url: u.slice(0, 200) });
  if (!u.includes('/graph')) return;
  graphTotal++;
  const decoded = decodeURIComponent(u) + (req.postData() ? ' ' + decodeURIComponent(req.postData()) : '');
  let body = null;
  try { body = await resp.json(); } catch {}
  // Scan every /graph response regardless of --grep — a query the caller didn't grep for can
  // still be the one silently returning an error.
  if (body) {
    const m = JSON.stringify(body).match(SQL_ERROR_RE);
    if (m) sqlErrors.push({ match: m[1].slice(0, 200), decoded: decoded.slice(0, 160) });
  }
  const matched = opts.greps.length === 0 || opts.greps.some(g => decoded.includes(g));
  if (!matched) return;
  graphCaptures.push({ method: req.method(), status: resp.status(), decoded, body: (opts.bodies || matched) ? body : null, tMs: Date.now() - navStart });
});

console.log(`probing ${url} (wait ${opts.wait}ms after networkidle)`);
try {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
} catch (e) {
  console.log(`goto did not reach networkidle (${e.message.split('\n')[0]}) — continuing anyway`);
}
await page.waitForTimeout(opts.wait);

// SVG census + body text. DMS report pages render each section as a
// div.relative.group cell with a div.font-display title and avl-graph svgs;
// heading-anchored walk is the fallback for docs-style pages with real h1-h6.
const sections = await page.evaluate(() => {
  const svgInfo = svg => ({
    w: Math.round(svg.getBoundingClientRect().width),
    h: Math.round(svg.getBoundingClientRect().height),
    cls: String(svg.getAttribute('class') || '').trim().slice(0, 40),
    paths: svg.querySelectorAll('path').length,
    rects: svg.querySelectorAll('rect').length,
    circles: svg.querySelectorAll('circle').length,
    texts: svg.querySelectorAll('text').length,
  });
  const graphSvgs = el => [...el.querySelectorAll('svg')]
    .map(svgInfo)
    .filter(s => s.w >= 100 && s.h >= 60); // skip icons/chevrons

  // Map sections render via a MapLibre <canvas> (WebGL), never SVG — an SVG-only census reads a
  // correctly-rendered map as permanently blank (found live 2026-08-10 probing the Dynamic Report
  // corpus candidate: a real choropleth with real data still showed "NO SVG"). Same size filter as
  // graphSvgs, since a canvas's drawn content can't be introspected the way path/rect counts can —
  // presence + real size is the only signal available.
  const canvasInfo = c => ({ w: Math.round(c.getBoundingClientRect().width), h: Math.round(c.getBoundingClientRect().height) });
  const graphCanvases = el => [...el.querySelectorAll('canvas')].map(canvasInfo).filter(c => c.w >= 100 && c.h >= 60);

  const cells = [...document.querySelectorAll('div.relative.group')]
    .filter(el => !el.parentElement.closest('div.relative.group')); // outermost only
  const out = cells
    .map(el => ({
      // In edit mode, every section cell's FIRST .font-display match is the hover
      // "Add Section" control's own label ("Add"), not the section's real title — take
      // the first match that isn't literally that placeholder (found live 2026-08-07
      // building --expect: every census title came back "Add", silently).
      title: ([...el.querySelectorAll('.font-display')].map(e => e.textContent.trim()).find(t => t !== 'Add') || '').slice(0, 80),
      svgs: graphSvgs(el),
      canvases: graphCanvases(el),
    }))
    .filter(s => s.title || s.svgs.length || s.canvases.length);
  if (out.length) return out;

  document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(h => {
    const title = h.textContent.trim();
    if (!title || title.length > 80) return;
    let el = h.closest('div');
    for (let i = 0; i < 6 && el; i++) {
      const svgs = el.querySelectorAll('svg');
      const canvases = el.querySelectorAll('canvas');
      if (svgs.length || canvases.length) {
        out.push({ title, svgs: [...svgs].map(svgInfo), canvases: [...canvases].map(canvasInfo) });
        return;
      }
      el = el.parentElement;
    }
    out.push({ title, svgs: [], canvases: [] });
  });
  return out;
});
const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 3000));

// optional section screenshot
let sectionShot = null;
if (opts.section) {
  const heading = page.locator('h1,h2,h3,h4,h5,h6,div.font-display', { hasText: opts.section }).first();
  if (await heading.count()) {
    let container = heading.locator('xpath=ancestor::div[contains(concat(" ",normalize-space(@class)," ")," group ")][1]');
    if (!(await container.count())) container = heading.locator('xpath=ancestor::div[.//svg][1]');
    if (!(await container.count())) container = heading.locator('xpath=ancestor::div[3]');
    sectionShot = path.join(opts.out, `probe_${slug}_section.png`);
    await container.screenshot({ path: sectionShot }).catch(async () => {
      await heading.screenshot({ path: sectionShot });
    });
  } else {
    console.log(`--section: no heading matching ${JSON.stringify(opts.section)}`);
  }
}

// optional custom probe
let evalResult;
if (opts.eval) {
  const mod = await import(path.resolve(opts.eval));
  evalResult = await mod.default(page);
}

let shotPath = null;
if (opts.shot) {
  shotPath = path.join(opts.out, `probe_${slug}.png`);
  await page.screenshot({ path: shotPath, fullPage: true });
}

const stillPending = [...pending.values()];
await browser.close();

// ---- report ---------------------------------------------------------------
// "Has content" = real SVG ink OR a real-sized canvas (Map sections render via MapLibre
// WebGL/canvas, never SVG — see graphCanvases above).
const hasSvgInk = s => s.svgs.length > 0 && s.svgs.some(v => v.paths + v.rects + v.circles > 0);
const hasCanvas = s => (s.canvases || []).length > 0;
const blankSections = sections.filter(s => !hasSvgInk(s) && !hasCanvas(s));
console.log(`\n== ${slug} ==`);
console.log(`api responses: ${apiResponses}  /graph: ${graphTotal} (captured ${graphCaptures.length})` +
  `  non-200: ${badResponses.length}  console errors: ${consoleErrors.length}` +
  `  page errors: ${pageErrors.length}  pending-at-close: ${stillPending.length}  sql errors: ${sqlErrors.length}`);
for (const e of pageErrors.slice(0, 5)) console.log(`  pageerror: ${e}`);
for (const e of consoleErrors.slice(0, 5)) console.log(`  console: ${e}`);
for (const b of badResponses.slice(0, 5)) console.log(`  non200: ${b.status} ${b.url}`);
for (const p of stillPending.slice(0, 5)) console.log(`  PENDING (possible hung/unbounded query): ${p}`);
for (const s of sqlErrors.slice(0, 5)) console.log(`  SQL ERROR (200 but error payload): ${s.match}  — query: ${s.decoded}`);
console.log(`sections with content: ${sections.length - blankSections.length}/${sections.length}`);
for (const s of sections) {
  const v = s.svgs[0];
  const c = (s.canvases || [])[0];
  const state = hasCanvas(s) ? `canvas ${s.canvases.length}, first: ${c.w}x${c.h}`
    : !s.svgs.length ? 'NO SVG/CANVAS'
    : !hasSvgInk(s) ? 'EMPTY SVG'
    : `${s.svgs.length} svg(s), first: ${v.w}x${v.h} paths=${v.paths} rects=${v.rects} circles=${v.circles}`;
  console.log(`  [${state}] ${s.title}`);
}
for (const c of graphCaptures) {
  const nums = [];
  (function walk(o) {
    if (nums.length >= 200 || o == null || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'number') nums.push([k, v]); else walk(v);
    }
  })(c.body);
  console.log(`  [graph ${c.method} ${c.status} t=${c.tMs}ms] ${c.decoded.slice(0, 160)}`);
  if (nums.length) console.log(`      leafNumbers=${nums.length} sample: ` +
    nums.slice(0, 6).map(([k, v]) => `${k}=${v}`).join(' '));
}
if (evalResult !== undefined) console.log('eval result:', JSON.stringify(evalResult, null, 1).slice(0, 2000));
if (shotPath) console.log(`screenshot: ${shotPath}`);
if (sectionShot) console.log(`section screenshot: ${sectionShot}`);

// ---- --expect: assert the live page matches a report_build.mjs spec ------
let expectResult = null;
if (opts.expect) {
  const spec = JSON.parse(readFileSync(path.resolve(opts.expect), 'utf8'));
  const checks = [];
  const record = (name, ok, detail) => checks.push({ name, ok, detail });

  for (const g of spec.graphs) {
    if (g.graphType === 'RouteCompare') continue; // no seriesVariants-shaped query — see header note
    const assignedNames = spec.routes.filter(r => (r.graphs || []).includes(g.key)).map(r => r.name);
    if (!assignedNames.length) continue; // report_build.mjs's own structural check already fails builds with no routes assigned

    const matches = graphCaptures.filter(c => assignedNames.every(n => c.decoded.includes(n)));
    record(`graph "${g.key}": fired a /graph request`, matches.length > 0,
      matches.length ? `${matches.length} matching capture(s)` : `no capture's seriesVariants contained all of: ${assignedNames.join(', ')}`);

    if (matches.length) {
      // Count `\"label\":\"` occurrences inside the matched capture's own seriesVariants array —
      // cheap and sufficient (route names are the only thing that produces this key shape in the
      // decoded query text), rather than re-parsing the nested stringified JSON options key. The
      // backslash-escaped quotes are real: the Falcor path segment is itself a JSON-stringified
      // object, so decodeURIComponent leaves its literal embedded `\"` untouched.
      const labelCount = (matches[0].decoded.match(/\\"label\\":\\"/g) || []).length;
      record(`graph "${g.key}": series count matches assigned routes`, labelCount === assignedNames.length,
        `expected ${assignedNames.length}, query carried ${labelCount}`);
    }

    if (g.title) {
      const section = sections.find(s => s.title === g.title);
      const rendered = section && (hasSvgInk(section) || hasCanvas(section));
      record(`graph "${g.key}": section "${g.title}" rendered non-empty`, Boolean(rendered),
        !section ? 'no census section with this title' : rendered ? 'has non-empty SVG/canvas content' : 'NO SVG/CANVAS or EMPTY SVG');
    }
  }
  record('no console errors', consoleErrors.length === 0, `${consoleErrors.length} error(s)`);
  record('no page errors', pageErrors.length === 0, `${pageErrors.length} error(s)`);
  record('no SQL errors in /graph responses', sqlErrors.length === 0,
    sqlErrors.length ? sqlErrors.map(s => s.match).join('; ') : '0 error(s)');

  const failed = checks.filter(c => !c.ok);
  expectResult = { pass: failed.length === 0, checks };
  console.log(`\n== --expect ${path.basename(opts.expect)} ==`);
  for (const c of checks) console.log(`  [${c.ok ? 'PASS' : 'FAIL'}] ${c.name}${c.ok ? '' : ` — ${c.detail}`}`);
  console.log(failed.length ? `${failed.length}/${checks.length} check(s) FAILED` : `all ${checks.length} check(s) passed`);
}

if (opts.json) {
  const jsonPath = path.join(opts.out, `probe_${slug}.json`);
  writeFileSync(jsonPath, JSON.stringify({
    url, when: new Date().toISOString(), opts: { ...opts, out: undefined },
    consoleErrors, pageErrors, badResponses, stillPending, sqlErrors, sections, bodyText,
    graphTotal, graphCaptures, evalResult, expectResult,
  }, null, 1));
  console.log(`json: ${jsonPath}`);
}

if (expectResult && !expectResult.pass) process.exit(1);
