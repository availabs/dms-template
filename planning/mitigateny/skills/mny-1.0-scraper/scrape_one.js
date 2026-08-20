// Scrape ONE jurisdiction's annex views with a fresh browser (crash/memory isolation).
// Usage: node scrape_one.js <outDir> "<Jurisdiction (Type)>"
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = process.env.MNY_BASE || 'https://delaware.mitigateny.org';
const WAIT = parseInt(process.env.MNY_WAIT || '7000', 10);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const OUT = process.argv[2]; const J = process.argv[3];
const fslug = (s) => s.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
const js = fslug(J);
const log = (m) => { console.log(m); fs.appendFileSync(path.join(OUT, '_scrape.log'), m + '\n'); };

async function gotoHome(page) {
  // Only 2 internal retries: once the SPA detaches the main frame, retrying goto on the same dead
  // page always fails, so fail fast to the outer browser-relaunch loop instead of burning ~50s here.
  for (let i = 0; i < 2; i++) {
    try {
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await sleep(WAIT + 2000);
      const ok = await page.evaluate(() => !!Array.from(document.querySelectorAll('a')).find(x => (x.textContent || '').trim().toUpperCase() === 'HAZARDS'));
      if (ok) return true;
    } catch (e) { log('  gotoHome retry ' + (i + 1) + ': ' + e.message); }
    await sleep(2000);
  }
  return false;
}
const navTo = async (page, label) => { await page.evaluate((l) => { const a = [...document.querySelectorAll('a')].find(x => (x.textContent || '').trim().toUpperCase() === l); a && a.click(); }, label.toUpperCase()); await sleep(WAIT); };
const clickHazard = async (page, nm) => { await page.evaluate((n) => { const li = [...document.querySelectorAll('ul.main-menu li')].find(x => (x.textContent || '').trim() === n); li && li.click(); }, nm); await sleep(WAIT); };
const selectJuris = async (page, nm) => {
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /\(County\)|\(Town\)|\(Village\)/.test(x.textContent || '')); b && b.click(); });
  await sleep(1500);
  const ok = await page.evaluate((n) => { const el = [...document.querySelectorAll('li,div,a,span,[role="option"],[role="menuitem"]')].find(x => (x.textContent || '').trim() === n); if (el) { el.click(); return true; } return false; }, nm);
  await sleep(WAIT); return ok;
};
const grab = (page) => page.evaluate(() => document.body.innerText || '');
const save = (n, t) => { fs.writeFileSync(path.join(OUT, n), t, 'utf8'); log(`  saved ${n} (${t.length})`); };

async function attempt() {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 2400 });
    page.on('dialog', d => d.dismiss().catch(() => {}));
    page.on('pageerror', () => {});
    const boot = await gotoHome(page);
    if (!boot) throw new Error('bootstrap failed (nav never rendered)');
    const sel = await selectJuris(page, J);
    if (!sel) log(`  WARN: could not select ${J}`);
    await navTo(page, 'HAZARDS'); await clickHazard(page, 'All Hazards'); await save(`annex_${js}_hazards.txt`, await grab(page));
    await navTo(page, 'RISK'); await save(`annex_${js}_risk.txt`, await grab(page));
    await navTo(page, 'STRATEGIES'); await save(`annex_${js}_strategies.txt`, await grab(page));
    log(`  ${J} DONE`);
  } finally { await browser.close().catch(() => {}); }
}

(async () => {
  // The SPA intermittently throws "detached Frame" mid-bootstrap. Retry the WHOLE flow with a
  // brand-new browser (not just page.goto) up to 3x before giving up.
  let lastErr;
  for (let i = 1; i <= 3; i++) {
    try { await attempt(); return; }
    catch (e) { lastErr = e; log(`  ${J} attempt ${i} failed: ${e.message}; relaunching browser`); await sleep(3000); }
  }
  log('FATAL ' + J + ': ' + (lastErr && lastErr.message)); process.exit(1);
})();
