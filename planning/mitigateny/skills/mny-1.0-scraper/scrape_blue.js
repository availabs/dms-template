// Scrape the per-hazard jurisdiction-specific "blue box" narrative for ONE jurisdiction.
// The blue box = div.element-box with aliceblue bg rgb(240,248,255), headed "<Juris> Jurisdictional Annex".
// It appears only for hazards the jurisdiction added local info to. Fresh browser (memory isolation).
// Output: <outDir>/blue_<slug>.json = { jurisdiction, boxes: { "<Hazard>": "<text>" } }
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = process.env.MNY_BASE || 'https://delaware.mitigateny.org';
const WAIT = parseInt(process.env.MNY_WAIT || '6000', 10);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const OUT = process.argv[2]; const J = process.argv[3];
const HAZARDS = ["Avalanche", "Coastal Hazards", "Coldwave", "Drought", "Earthquake", "Flooding", "Hail", "Heat Wave", "Hurricane", "Ice Storm", "Landslide", "Lightning", "Snow Storm", "Tornado", "Tsunami/Seiche", "Volcano", "Wildfire", "Wind"];
const fslug = (s) => s.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
const js = fslug(J);
const log = (m) => { console.log(m); fs.appendFileSync(path.join(OUT, '_blue.log'), m + '\n'); };

async function gotoHome(page) {
  // 2 internal retries then fail fast to the outer browser-relaunch loop (detached frame = dead page).
  for (let i = 0; i < 2; i++) {
    try {
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(9000);
      const ok = await page.evaluate(() => !!Array.from(document.querySelectorAll('a')).find(x => (x.textContent || '').trim().toUpperCase() === 'HAZARDS')); if (ok) return true;
    } catch (e) { log('  gotoHome retry ' + (i + 1)); } await sleep(2000);
  } return false;
}
// The real jurisdiction blue box is the innermost element whose text starts with
// "<Juris> Jurisdictional Annex" (aliceblue bg). Anchoring on this heading avoids the
// false positive where the whole aliceblue page wrapper is caught when no box exists.
const getBlue = (page, juris) => page.evaluate((J) => {
  const head = J + ' Jurisdictional Annex';
  // the real box is div.element-box whose text starts with the heading (heading + body).
  // A separate heading-only node also starts with it, so pick the LONGEST match.
  let cands = [...document.querySelectorAll('div.element-box')].map(el => (el.innerText || '').trim()).filter(t => t.startsWith(head));
  if (!cands.length) cands = [...document.querySelectorAll('div,section,td')].map(el => (el.innerText || '').trim()).filter(t => t.startsWith(head));
  if (!cands.length) return '';
  const t = cands.sort((a, b) => b.length - a.length)[0];
  return t.replace(new RegExp('^' + head.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*'), '').trim();
}, juris);

const JSON_PATH = path.join(OUT, `blue_${js}.json`);
function loadState() {
  if (fs.existsSync(JSON_PATH)) { try { const s = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8')); return { boxes: s.boxes || {}, done: new Set(s.done || Object.keys(s.boxes || {})) }; } catch (e) {} }
  return { boxes: {}, done: new Set() };
}
function saveState(boxes, done) {
  const complete = HAZARDS.every(h => done.has(h));
  fs.writeFileSync(JSON_PATH, JSON.stringify({ jurisdiction: J, boxes, done: [...done], complete }, null, 2), 'utf8');
  return complete;
}

// Long Allegany sessions detach the frame mid-hazard-loop, so save INCREMENTALLY (after each hazard)
// and RESUME from the partial JSON on the next attempt — skipping hazards already processed.
async function attempt() {
  const { boxes, done } = loadState();
  const remaining = HAZARDS.filter(h => !done.has(h));
  if (!remaining.length) return true;
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage(); await page.setViewport({ width: 1400, height: 2600 });
    page.on('dialog', d => d.dismiss().catch(() => {})); page.on('pageerror', () => {});
    const boot = await gotoHome(page);
    if (!boot) throw new Error('bootstrap failed (nav never rendered)');
    // Allegany detaches the frame mid-hazard-loop, likely localStorage-quota / chart-cache churn. Clear it.
    await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /\(County\)|\(Town\)|\(Village\)/.test(x.textContent || '')); b && b.click(); }); await sleep(1800);
    const sel = await page.evaluate((n) => { const el = [...document.querySelectorAll('li,div,a,span,[role="option"],[role="menuitem"]')].find(x => (x.textContent || '').trim() === n); if (el) { el.click(); return true; } return false; }, J);
    if (!sel) throw new Error(`could not select ${J}`);
    await sleep(WAIT);
    await page.evaluate(() => { const a = [...document.querySelectorAll('a')].find(x => (x.textContent || '').trim().toUpperCase() === 'HAZARDS'); a && a.click(); }); await sleep(WAIT + 2000);

    let prev = null;
    for (const h of remaining) {
      await page.evaluate((nm) => { const li = [...document.querySelectorAll('ul.main-menu li')].find(x => (x.textContent || '').trim() === nm); li && li.click(); }, h);
      await sleep(WAIT);
      // stabilize: poll until blue text stable across 2 grabs AND != previous hazard's (guard click->render lag)
      let last = null, cur = '';
      for (let i = 0; i < 3; i++) {
        cur = await getBlue(page, J);
        if (cur === last && cur !== prev) break;
        if (cur === last && cur === prev && cur === '') break;
        last = cur; await sleep(2500);
      }
      await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); // curb quota growth per hazard
      if (cur && cur !== prev) { boxes[h] = cur; log(`  ${h}: blue box ${cur.length} chars`); }
      else log(`  ${h}: (no jurisdiction blue box)`);
      done.add(h); saveState(boxes, done);   // incremental persist → crash-resumable
      prev = cur;
    }
    const complete = saveState(boxes, done);
    log(`${J} DONE — ${Object.keys(boxes).length} hazards with blue boxes (complete=${complete})`);
    return complete;
  } finally { await browser.close().catch(() => {}); }
}

(async () => {
  // Resume-driven retry: each attempt advances (per-hazard save), so retry until complete, up to 8x.
  let lastErr;
  for (let i = 1; i <= 8; i++) {
    try { if (await attempt()) return; }
    catch (e) { lastErr = e; log(`  ${J} attempt ${i} failed: ${e.message}; relaunching`); await sleep(3000); }
  }
  log('FATAL ' + J + ': ' + (lastErr && lastErr.message)); process.exit(1);
})();
