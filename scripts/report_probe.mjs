// report_probe.mjs — one-stop Playwright probe for DMS report pages on the local dev stack.
//
// Replaces the family of one-off scratchpad scripts (shot_*, capture_*, probe_svg*,
// verify_report_*, dom_probe_*). One page load collects everything at once:
//   - console errors + uncaught page errors
//   - every dms-server response (count, non-200 list)
//   - requests still pending at close (signal for unbounded/hung ClickHouse queries)
//   - decoded /graph traffic (URL-encoded Falcor paths + POST bodies decoded to readable text)
//   - per-section SVG census (distinguishes "rendered blank" from "never rendered")
//   - visible body text
//   - full-page screenshot + machine-readable JSON dump
//
// Usage:
//   node scripts/report_probe.mjs <slug-or-full-url> [options]
//
// Examples:
//   node scripts/report_probe.mjs report_1070
//   node scripts/report_probe.mjs report_1070 --grep hours_of_delay --wait 10000
//   node scripts/report_probe.mjs report_796 --section "Travel Time" --no-json
//   node scripts/report_probe.mjs report_11 --eval scratchpad/npmrds-sub/tmp/my_probe.mjs
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
//   --host <origin>   page origin (default http://npmrds.localhost:5173 — subdomain matters,
//                     bare localhost routes to the wrong pattern)
//   --api <origin>    dms-server origin to capture (default http://localhost:3001)
//   --viewport WxH    default 1600x1000
//   --out <dir>       output dir (default scratchpad/npmrds-sub/tmp)
//   --no-shot         skip screenshot
//   --no-json         skip JSON dump
//
// For a truly novel probe, prefer --eval with a tiny probe file over forking this script.
// If the same --eval probe gets written twice, promote it to a flag here.

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---- args ----------------------------------------------------------------
const argv = process.argv.slice(2);
const target = argv[0];
if (!target || target.startsWith('--')) {
  console.error('usage: node scripts/report_probe.mjs <slug-or-url> [--wait ms] [--grep s]... [see header]');
  process.exit(2);
}
const opts = {
  wait: 6000,
  greps: [],
  bodies: false,
  section: null,
  eval: null,
  host: 'http://npmrds.localhost:5173',
  api: 'http://localhost:3001',
  viewport: { width: 1600, height: 1000 },
  out: path.join(repoRoot, 'scratchpad/npmrds-sub/tmp'),
  shot: true,
  json: true,
  auth: null,
};
for (let i = 1; i < argv.length; i++) {
  const a = argv[i];
  const next = () => argv[++i];
  if (a === '--wait') opts.wait = Number(next());
  else if (a === '--grep') opts.greps.push(next());
  else if (a === '--bodies') opts.bodies = true;
  else if (a === '--section') opts.section = next();
  else if (a === '--eval') opts.eval = next();
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
const slug = target.startsWith('http') ? new URL(target).pathname.replace(/\W+/g, '_').replace(/^_+|_+$/g, '') || 'index' : target;
mkdirSync(opts.out, { recursive: true });

// ---- collect -------------------------------------------------------------
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: opts.viewport });
if (opts.auth) {
  const { readFileSync } = await import('fs');
  const token = readFileSync(opts.auth, 'utf8').trim();
  await page.addInitScript(t => localStorage.setItem('userToken', t), token);
  console.log(`auth: injecting userToken from ${opts.auth}`);
}

const consoleErrors = [];
const pageErrors = [];
const badResponses = [];
const graphCaptures = [];
const pending = new Map(); // api-origin requests with no response yet
let apiResponses = 0;
let graphTotal = 0;

page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 400)); });
page.on('pageerror', e => pageErrors.push(String(e.message).slice(0, 400)));
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
  const matched = opts.greps.length === 0 || opts.greps.some(g => decoded.includes(g));
  if (!matched) return;
  let body = null;
  if (opts.bodies || matched) { try { body = await resp.json(); } catch {} }
  graphCaptures.push({ method: req.method(), status: resp.status(), decoded, body });
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

  const cells = [...document.querySelectorAll('div.relative.group')]
    .filter(el => !el.parentElement.closest('div.relative.group')); // outermost only
  const out = cells
    .map(el => ({
      title: (el.querySelector('.font-display')?.textContent || '').trim().slice(0, 80),
      svgs: graphSvgs(el),
    }))
    .filter(s => s.title || s.svgs.length);
  if (out.length) return out;

  document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(h => {
    const title = h.textContent.trim();
    if (!title || title.length > 80) return;
    let el = h.closest('div');
    for (let i = 0; i < 6 && el; i++) {
      const svgs = el.querySelectorAll('svg');
      if (svgs.length) { out.push({ title, svgs: [...svgs].map(svgInfo) }); return; }
      el = el.parentElement;
    }
    out.push({ title, svgs: [] });
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
const blankSections = sections.filter(s =>
  !s.svgs.length || s.svgs.every(v => v.paths + v.rects + v.circles === 0));
console.log(`\n== ${slug} ==`);
console.log(`api responses: ${apiResponses}  /graph: ${graphTotal} (captured ${graphCaptures.length})` +
  `  non-200: ${badResponses.length}  console errors: ${consoleErrors.length}` +
  `  page errors: ${pageErrors.length}  pending-at-close: ${stillPending.length}`);
for (const e of pageErrors.slice(0, 5)) console.log(`  pageerror: ${e}`);
for (const e of consoleErrors.slice(0, 5)) console.log(`  console: ${e}`);
for (const b of badResponses.slice(0, 5)) console.log(`  non200: ${b.status} ${b.url}`);
for (const p of stillPending.slice(0, 5)) console.log(`  PENDING (possible hung/unbounded query): ${p}`);
console.log(`sections with svg content: ${sections.length - blankSections.length}/${sections.length}`);
for (const s of sections) {
  const v = s.svgs[0];
  const state = !s.svgs.length ? 'NO SVG'
    : s.svgs.every(x => x.paths + x.rects + x.circles === 0) ? 'EMPTY SVG'
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
  console.log(`  [graph ${c.method} ${c.status}] ${c.decoded.slice(0, 160)}`);
  if (nums.length) console.log(`      leafNumbers=${nums.length} sample: ` +
    nums.slice(0, 6).map(([k, v]) => `${k}=${v}`).join(' '));
}
if (evalResult !== undefined) console.log('eval result:', JSON.stringify(evalResult, null, 1).slice(0, 2000));
if (shotPath) console.log(`screenshot: ${shotPath}`);
if (sectionShot) console.log(`section screenshot: ${sectionShot}`);

if (opts.json) {
  const jsonPath = path.join(opts.out, `probe_${slug}.json`);
  writeFileSync(jsonPath, JSON.stringify({
    url, when: new Date().toISOString(), opts: { ...opts, out: undefined },
    consoleErrors, pageErrors, badResponses, stillPending, sections, bodyText,
    graphTotal, graphCaptures, evalResult,
  }, null, 1));
  console.log(`json: ${jsonPath}`);
}
