// Discover Niagara County taxonomy: hazards (ul.main-menu li on Hazards page) + jurisdiction dropdown items.
const puppeteer = require('puppeteer-core');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = process.env.MNY_BASE || 'https://niagara.mitigateny.org';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 2200 });
  page.on('dialog', d => d.dismiss().catch(() => {}));
  page.on('pageerror', () => {});
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(9000);
  const nav = await page.evaluate(() => Array.from(document.querySelectorAll('a')).map(a => (a.textContent||'').trim()).filter(Boolean));
  await page.evaluate(() => { const a = Array.from(document.querySelectorAll('a')).find(x => (x.textContent||'').trim().toUpperCase()==='HAZARDS'); if(a)a.click(); });
  await sleep(8000);
  const hazards = await page.evaluate(() => Array.from(document.querySelectorAll('ul.main-menu li')).map(li => (li.textContent||'').trim()).filter(Boolean));
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /\(\s*(County|Town|Village|City)\)/.test(x.textContent||'')); if(b)b.click(); });
  await sleep(2500);
  const juris = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('li, [role="option"], [role="menuitem"], a, div, span'))
      .map(e => (e.textContent||'').trim())
      .filter(t => /\(\s*(Town|Village|County|City)\s*\)$/.test(t) && t.length < 45);
    return Array.from(new Set(items));
  });
  const countyBtn = await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /\(\s*(County|Town|Village|City)\)/.test(x.textContent||'')); return b ? b.textContent.trim() : null; });
  console.log(JSON.stringify({ nav: Array.from(new Set(nav)), countyBtn, hazards, hazardCount: hazards.length, juris, jurisCount: juris.length }, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
