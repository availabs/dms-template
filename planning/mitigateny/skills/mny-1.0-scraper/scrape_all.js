// Comprehensive MitigateNY 1.0 scraper using IN-APP navigation.
// Reusable across *.mitigateny.org 1.0 sites. Set MNY_BASE env for other counties.
//
// Key lessons baked in:
//  - Direct URL loads of sub-routes (e.g. /planning-process) throw; must bootstrap on "/"
//    then click the top-nav <a> (React Router client nav preserves falcor state).
//  - Hazards are <li> in ul.main-menu (left nav). Click by text to switch hazard.
//  - Jurisdiction selector is a top-nav <button> ("... (County)"); clicking opens a menu of
//    "<Name> (Town|Village|County)" items. Selection is global and persists across pages.
//  - SPA needs ~6-8s after each nav for falcor data + charts to hydrate.
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = process.env.MNY_BASE || 'https://delaware.mitigateny.org';
const OUT = process.argv[2] || 'data';
const WAIT = parseInt(process.env.MNY_WAIT || '7000', 10);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });
const log = (m) => { const line = `[${new Date().toISOString?.() || ''}] ${m}`; console.log(m); fs.appendFileSync(path.join(OUT, '_scrape.log'), m + '\n'); };

// County-specific taxonomy. Override per county by setting MNY_CONFIG=<path to json>
// with {"hazards":[...],"juris":[...]}. Defaults below are Delaware's (first county scraped).
const DEFAULT_HAZARDS = ["Avalanche","Coastal Hazards","Coldwave","Drought","Earthquake","Flooding","Hail","Heat Wave","Hurricane","Ice Storm","Landslide","Lightning","Snow Storm","Tornado","Tsunami/Seiche","Volcano","Wildfire","Wind"];
const DEFAULT_JURIS = ["Andes (Town)","Bovina (Town)","Colchester (Town)","Davenport (Town)","Delhi (Town)","Delhi (Village)","Deposit (Town)","Fleischmanns (Village)","Franklin (Town)","Franklin (Village)","Hamden (Town)","Hancock (Town)","Hancock (Village)","Harpersfield (Town)","Hobart (Village)","Kortright (Town)","Margaretville (Village)","Masonville (Town)","Meredith (Town)","Middletown (Town)","Roxbury (Town)","Sidney (Town)","Sidney (Village)","Stamford (Town)","Stamford (Village)","Tompkins (Town)","Walton (Town)","Walton (Village)"];
let HAZARDS = DEFAULT_HAZARDS, JURIS = DEFAULT_JURIS;
if (process.env.MNY_CONFIG) {
  const cfg = JSON.parse(fs.readFileSync(process.env.MNY_CONFIG, 'utf8'));
  if (Array.isArray(cfg.hazards)) HAZARDS = cfg.hazards;
  if (Array.isArray(cfg.juris)) JURIS = cfg.juris;
  console.log(`[config] ${process.env.MNY_CONFIG}: ${HAZARDS.length} hazards, ${JURIS.length} jurisdictions`);
}
const SECTIONS = ["PLANNING PROCESS","HAZARDS","RISK","STRATEGIES","ABOUT"];
const fslug = (s) => s.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');

async function navTo(page, label) {
  const ok = await page.evaluate((lbl) => {
    const a = Array.from(document.querySelectorAll('a')).find(x => (x.textContent || '').trim().toUpperCase() === lbl);
    if (a) { a.click(); return true; } return false;
  }, label.toUpperCase());
  await sleep(WAIT);
  return ok;
}
async function clickHazard(page, name) {
  const ok = await page.evaluate((nm) => {
    const li = Array.from(document.querySelectorAll('ul.main-menu li')).find(x => (x.textContent || '').trim() === nm);
    if (li) { li.click(); return true; } return false;
  }, name);
  await sleep(WAIT);
  return ok;
}
async function selectJuris(page, name) {
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /\(County\)|\(Town\)|\(Village\)/.test(x.textContent || '')); if (b) b.click(); });
  await sleep(1500);
  const ok = await page.evaluate((nm) => {
    const el = Array.from(document.querySelectorAll('li,div,a,[role="option"],[role="menuitem"],span')).find(x => (x.textContent || '').trim() === nm);
    if (el) { el.click(); return true; } return false;
  }, name);
  await sleep(WAIT);
  return ok;
}
async function gotoHome(page) {
  for (let i = 0; i < 4; i++) {
    try {
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await sleep(WAIT + 2000);
      // confirm the SPA nav rendered
      const ok = await page.evaluate(() => !!Array.from(document.querySelectorAll('a')).find(x => (x.textContent || '').trim().toUpperCase() === 'HAZARDS'));
      if (ok) return true;
    } catch (e) { log(`  gotoHome retry ${i + 1}: ${e.message}`); }
    await sleep(3000);
  }
  return false;
}
async function grab(page) {
  return page.evaluate(() => document.body.innerText || '');
}
async function save(name, text) { fs.writeFileSync(path.join(OUT, name), text, 'utf8'); log(`  saved ${name} (${text.length})`); }

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  let page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 2400 });
  page.on('dialog', d => d.dismiss().catch(() => {}));
  page.on('pageerror', () => {}); // swallow SPA errors
  log(`=== BOOTSTRAP ${BASE} ===`);
  await gotoHome(page);
  await sleep(WAIT + 2000);
  const countyDone = fs.existsSync(path.join(OUT, 'county_hazard_Wind.txt'));
  if (countyDone) { log('=== COUNTY already scraped — skipping to annexes ==='); }
  if (!countyDone) {
  await save('landing.txt', await grab(page));

  // ---- COUNTY LEVEL ----
  log('=== COUNTY: sections ===');
  await navTo(page, 'PLANNING PROCESS'); await save('county_planning_process.txt', await grab(page));
  await navTo(page, 'RISK'); await save('county_risk.txt', await grab(page));
  await navTo(page, 'STRATEGIES'); await save('county_strategies.txt', await grab(page));
  await navTo(page, 'ABOUT'); await save('county_about.txt', await grab(page));

  log('=== COUNTY: per-hazard narratives ===');
  await navTo(page, 'HAZARDS');
  await save('county_hazards_ALL.txt', await grab(page));
  for (const h of HAZARDS) {
    const ok = await clickHazard(page, h);
    await save(`county_hazard_${fslug(h)}.txt`, await grab(page));
    if (!ok) log(`  WARN: hazard li not found: ${h}`);
  }
  } // end county block

  // County-only mode: stop here (annexes done separately, e.g. via scrape_one loop at scale).
  if (process.env.MNY_COUNTY_ONLY) { log('=== COUNTY-ONLY: done ==='); await browser.close(); return; }

  // ---- JURISDICTION ANNEXES ----
  log('=== ANNEXES ===');
  for (const j of JURIS) {
    const js = fslug(j);
    if (fs.existsSync(path.join(OUT, `annex_${js}_strategies.txt`))) { log(`--- ${j} (skip, done) ---`); continue; }
    log(`--- ${j} ---`);
    let attempt = 0;
    while (attempt < 2) {
      attempt++;
      try {
        const sel = await selectJuris(page, j);
        if (!sel) { log(`  WARN: could not select ${j}`); }
        await navTo(page, 'HAZARDS'); await clickHazard(page, 'All Hazards'); await save(`annex_${js}_hazards.txt`, await grab(page));
        await navTo(page, 'RISK'); await save(`annex_${js}_risk.txt`, await grab(page));
        await navTo(page, 'STRATEGIES'); await save(`annex_${js}_strategies.txt`, await grab(page));
        break;
      } catch (e) {
        log(`  ERROR ${j} attempt ${attempt}: ${e.message}. Recovering page...`);
        try { await page.close(); } catch (_) {}
        page = await browser.newPage();
        await page.setViewport({ width: 1400, height: 2400 });
        page.on('dialog', d => d.dismiss().catch(() => {}));
        page.on('pageerror', () => {});
        await gotoHome(page);
        await sleep(WAIT + 2000);
      }
    }
  }
  log('=== DONE ===');
  await browser.close();
})().catch(e => { log('FATAL: ' + e.message); process.exit(1); });
