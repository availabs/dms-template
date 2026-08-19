// Generic: scrape ONE jurisdiction's annex views (hazards/risk/strategies) with a fresh browser.
// Usage: MNY_CONFIG=./niagara_config node mny_scrape_one.js <outDir> "<Jurisdiction (Type)>"
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const CFG = require(process.env.MNY_CONFIG || './ham_config');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = process.env.MNY_BASE || CFG.BASE;
const WAIT = parseInt(process.env.MNY_WAIT || '7000', 10);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const OUT = process.argv[2]; const J = process.argv[3];
const fslug = (s) => s.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
const js = fslug(J);
const log = (m) => { console.log(m); fs.appendFileSync(path.join(OUT, '_scrape.log'), m + '\n'); };
const JRE = /\(\s*(County|Town|Village|City)\s*\)/;

async function gotoHome(page) {
  for (let i = 0; i < 4; i++) {
    try { await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(WAIT + 2000);
      const ok = await page.evaluate(() => !!Array.from(document.querySelectorAll('a')).find(x => (x.textContent || '').trim().toUpperCase() === 'HAZARDS')); if (ok) return true;
    } catch (e) { log('  gotoHome retry ' + (i + 1) + ': ' + e.message); } await sleep(3000);
  } return false;
}
const navTo = async (page, label) => { await page.evaluate((l) => { const a = [...document.querySelectorAll('a')].find(x => (x.textContent || '').trim().toUpperCase() === l); a && a.click(); }, label.toUpperCase()); await sleep(WAIT); };
const clickHazard = async (page, nm) => { await page.evaluate((n) => { const li = [...document.querySelectorAll('ul.main-menu li')].find(x => (x.textContent || '').trim() === n); li && li.click(); }, nm); await sleep(WAIT); };
const selectJuris = async (page, nm) => {
  await page.evaluate((reSrc) => { const re = new RegExp(reSrc); const b = [...document.querySelectorAll('button')].find(x => re.test(x.textContent || '')); b && b.click(); }, JRE.source);
  await sleep(1800);
  const ok = await page.evaluate((n) => { const el = [...document.querySelectorAll('li,div,a,span,[role="option"],[role="menuitem"]')].find(x => (x.textContent || '').trim() === n); if (el) { el.click(); return true; } return false; }, nm);
  await sleep(WAIT); return ok;
};
const grab = (page) => page.evaluate(() => document.body.innerText || '');
const save = (n, t) => { fs.writeFileSync(path.join(OUT, n), t, 'utf8'); log(`  saved ${n} (${t.length})`); };

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 2400 });
  page.on('dialog', d => d.dismiss().catch(() => {}));
  page.on('pageerror', () => {});
  log(`--- ${J} (fresh browser) ---`);
  await gotoHome(page);
  const sel = await selectJuris(page, J);
  if (!sel) log(`  WARN: could not select ${J}`);
  await navTo(page, 'HAZARDS'); await clickHazard(page, 'All Hazards'); await save(`annex_${js}_hazards.txt`, await grab(page));
  await navTo(page, 'RISK'); await save(`annex_${js}_risk.txt`, await grab(page));
  await navTo(page, 'STRATEGIES'); await save(`annex_${js}_strategies.txt`, await grab(page));
  await browser.close();
  log(`  ${J} DONE`);
})().catch(e => { log('FATAL ' + J + ': ' + e.message); process.exit(1); });
