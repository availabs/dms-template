// Generic: scrape per-hazard jurisdiction "blue box" narrative for ONE jurisdiction. Fresh browser.
// Usage: MNY_CONFIG=./niagara_config node mny_scrape_blue.js <outDir> "<Jurisdiction (Type)>"
// Output: <outDir>/blue_<slug>.json = { jurisdiction, boxes: { "<Hazard>": "<text>" } }
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const CFG = require(process.env.MNY_CONFIG || './ham_config');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = process.env.MNY_BASE || CFG.BASE;
const WAIT = parseInt(process.env.MNY_WAIT || '6000', 10);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const OUT = process.argv[2]; const J = process.argv[3];
const HAZARDS = CFG.HAZARDS;
const fslug = (s) => s.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
const js = fslug(J);
const log = (m) => { console.log(m); fs.appendFileSync(path.join(OUT, '_blue.log'), m + '\n'); };
const JRE = /\(\s*(County|Town|Village|City)\s*\)/;

async function gotoHome(page) {
  for (let i = 0; i < 4; i++) {
    try { await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(9000);
      const ok = await page.evaluate(() => !!Array.from(document.querySelectorAll('a')).find(x => (x.textContent || '').trim().toUpperCase() === 'HAZARDS')); if (ok) return true;
    } catch (e) { log('  gotoHome retry ' + (i + 1)); } await sleep(3000);
  } return false;
}
const getBlue = (page, juris) => page.evaluate((J) => {
  const head = J + ' Jurisdictional Annex';
  let cands = [...document.querySelectorAll('div.element-box')].map(el => (el.innerText || '').trim()).filter(t => t.startsWith(head));
  if (!cands.length) cands = [...document.querySelectorAll('div,section,td')].map(el => (el.innerText || '').trim()).filter(t => t.startsWith(head));
  if (!cands.length) return '';
  const t = cands.sort((a, b) => b.length - a.length)[0];
  return t.replace(new RegExp('^' + head.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*'), '').trim();
}, juris);

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage(); await page.setViewport({ width: 1400, height: 2600 });
  page.on('dialog', d => d.dismiss().catch(() => {})); page.on('pageerror', () => {});
  await gotoHome(page);
  await page.evaluate((reSrc) => { const re = new RegExp(reSrc); const b = [...document.querySelectorAll('button')].find(x => re.test(x.textContent || '')); b && b.click(); }, JRE.source); await sleep(1800);
  const sel = await page.evaluate((n) => { const el = [...document.querySelectorAll('li,div,a,span,[role="option"],[role="menuitem"]')].find(x => (x.textContent || '').trim() === n); if (el) { el.click(); return true; } return false; }, J);
  if (!sel) { log(`FATAL: could not select ${J}`); await browser.close(); process.exit(1); }
  await sleep(WAIT);
  await page.evaluate(() => { const a = [...document.querySelectorAll('a')].find(x => (x.textContent || '').trim().toUpperCase() === 'HAZARDS'); a && a.click(); }); await sleep(WAIT + 2000);

  const boxes = {}; let prev = null;
  for (const h of HAZARDS) {
    await page.evaluate((nm) => { const li = [...document.querySelectorAll('ul.main-menu li')].find(x => (x.textContent || '').trim() === nm); li && li.click(); }, h);
    await sleep(WAIT);
    let last = null, cur = '';
    for (let i = 0; i < 8; i++) {
      cur = await getBlue(page, J);
      if (cur === last && cur !== prev) break;
      if (cur === last && cur === prev && cur === '') break;
      last = cur; await sleep(3500);
    }
    if (cur && cur !== prev) { boxes[h] = cur; log(`  ${h}: blue box ${cur.length} chars`); }
    else log(`  ${h}: (no jurisdiction blue box)`);
    prev = cur;
  }
  fs.writeFileSync(path.join(OUT, `blue_${js}.json`), JSON.stringify({ jurisdiction: J, boxes }, null, 2), 'utf8');
  await browser.close();
  log(`${J} DONE — ${Object.keys(boxes).length} hazards with blue boxes`);
})().catch(e => { log('FATAL ' + J + ': ' + e.message); process.exit(1); });
