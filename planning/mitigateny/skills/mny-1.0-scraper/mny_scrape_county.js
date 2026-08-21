// Generic MNY 1.0 county-level scrape. Config via MNY_CONFIG env (path to a *_config.js), default ./ham_config.
// Captures: landing, 5 top-nav sections, All-Hazards dashboard, per-hazard Characteristics (stabilized),
// and each EXTRA_HAZARD_PAGES page (e.g. "Other Hazards"). One long-lived browser.
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const CFG = require(process.env.MNY_CONFIG || './ham_config');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = process.env.MNY_BASE || CFG.BASE;
const OUT = process.argv[2] || 'data';
const WAIT = parseInt(process.env.MNY_WAIT || '7000', 10);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });
const log = (m) => { console.log(m); fs.appendFileSync(path.join(OUT, '_scrape.log'), m + '\n'); };
const HAZARDS = CFG.HAZARDS;
const EXTRA = CFG.EXTRA_HAZARD_PAGES || [];
const fslug = (s) => s.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');

async function gotoHome(page) {
  for (let i = 0; i < 4; i++) {
    try {
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await sleep(WAIT + 2000);
      const ok = await page.evaluate(() => !!Array.from(document.querySelectorAll('a')).find(x => (x.textContent || '').trim().toUpperCase() === 'HAZARDS'));
      if (ok) return true;
    } catch (e) { log('  gotoHome retry ' + (i + 1) + ': ' + e.message); }
    await sleep(3000);
  }
  return false;
}
const navTo = async (page, label) => { const ok = await page.evaluate((l) => { const a = [...document.querySelectorAll('a')].find(x => (x.textContent || '').trim().toUpperCase() === l); if (a) { a.click(); return true; } return false; }, label.toUpperCase()); await sleep(WAIT); return ok; };
const clickHazard = async (page, nm) => { const ok = await page.evaluate((n) => { const li = [...document.querySelectorAll('ul.main-menu li')].find(x => (x.textContent || '').trim() === n); if (li) { li.click(); return true; } return false; }, nm); await sleep(WAIT); return ok; };
const grab = (page) => page.evaluate(() => document.body.innerText || '');
const save = (n, t) => { fs.writeFileSync(path.join(OUT, n), t, 'utf8'); log(`  saved ${n} (${t.length})`); };
function charBody(text, h) {
  const L = text.split('\n');
  const a = L.findIndex(l => l.trim() === h + ' Characteristics');
  if (a < 0) return null;
  const b = L.findIndex((l, i) => i > a && /- Local Impacts -/.test(l));
  return L.slice(a + 1, b < 0 ? a + 40 : b).join('\n').trim();
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 2400 });
  page.on('dialog', d => d.dismiss().catch(() => {}));
  page.on('pageerror', () => {});
  log(`=== BOOTSTRAP ${BASE} ===`);
  await gotoHome(page);
  await save('landing.txt', await grab(page));

  log('=== COUNTY: sections ===');
  await navTo(page, 'PLANNING PROCESS'); await save('county_planning_process.txt', await grab(page));
  await navTo(page, 'RISK'); await save('county_risk.txt', await grab(page));
  await navTo(page, 'STRATEGIES'); await save('county_strategies.txt', await grab(page));
  await navTo(page, 'ABOUT'); await save('county_about.txt', await grab(page));

  log('=== COUNTY: hazards dashboard + per-hazard (stabilized) ===');
  await navTo(page, 'HAZARDS');
  await clickHazard(page, 'All Hazards');
  await sleep(2000);
  await save('county_hazards_ALL.txt', await grab(page));

  let prevBody = null;
  for (const h of HAZARDS) {
    await clickHazard(page, h);
    await sleep(1000);
    let last = null, text = '', body = null;
    for (let i = 0; i < 10; i++) {
      text = await grab(page);
      body = charBody(text, h);
      const settled = body && body.length > 40 && body === last;
      const notStale = body !== prevBody;
      if (settled && notStale) break;
      last = body; await sleep(4000);
    }
    save(`county_hazard_${fslug(h)}.txt`, text);
    log(`  ${h}: body="${(body || '').slice(0, 60).replace(/\n/g, ' ')}..."`);
    prevBody = body;
  }

  for (const ep of EXTRA) {
    const ok = await clickHazard(page, ep);
    await sleep(2000);
    if (ok) save(`county_${fslug(ep).toLowerCase()}.txt`, await grab(page));
    else log(`  WARN: extra hazard page li not found: ${ep}`);
  }

  await browser.close();
  log('=== COUNTY DONE ===');
})().catch(e => { log('FATAL: ' + e.message); process.exit(1); });
