// Discover a MitigateNY 1.0 county's hazard list + jurisdiction list.
// Usage: MNY_BASE=https://fulton.mitigateny.org node inspect_taxonomy.js
const puppeteer = require('puppeteer-core');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = process.env.MNY_BASE || 'https://fulton.mitigateny.org';
const WAIT = parseInt(process.env.MNY_WAIT || '8000', 10);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 2400 });
  page.on('dialog', d => d.dismiss().catch(() => {}));
  page.on('pageerror', () => {});

  // bootstrap
  let ok = false;
  for (let i = 0; i < 4 && !ok; i++) {
    try {
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await sleep(WAIT + 2000);
      ok = await page.evaluate(() => !!Array.from(document.querySelectorAll('a')).find(x => (x.textContent || '').trim().toUpperCase() === 'HAZARDS'));
    } catch (e) { console.error('retry', i, e.message); await sleep(3000); }
  }
  console.log('bootstrap ok:', ok);
  console.log('TITLE:', await page.title());

  // top nav labels
  const nav = await page.evaluate(() => Array.from(document.querySelectorAll('a')).map(a => (a.textContent||'').trim()).filter(Boolean));
  console.log('NAV LINKS:', JSON.stringify([...new Set(nav)]));

  // go to hazards, read left menu
  await page.evaluate(() => { const a = Array.from(document.querySelectorAll('a')).find(x => (x.textContent||'').trim().toUpperCase()==='HAZARDS'); if(a) a.click(); });
  await sleep(WAIT);
  const hazards = await page.evaluate(() => Array.from(document.querySelectorAll('ul.main-menu li')).map(li => (li.textContent||'').trim()).filter(Boolean));
  console.log('HAZARDS (' + hazards.length + '):', JSON.stringify(hazards));

  // open jurisdiction dropdown
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /\(County\)|\(Town\)|\(Village\)|\(City\)/.test(x.textContent||'')); if(b) b.click(); });
  await sleep(2500);
  const juris = await page.evaluate(() => {
    const set = new Set();
    Array.from(document.querySelectorAll('li,div,a,[role="option"],[role="menuitem"],span')).forEach(x => {
      const t = (x.textContent||'').trim();
      if (/^[^\n]{1,60}\((County|Town|Village|City)\)$/.test(t)) set.add(t);
    });
    return [...set];
  });
  console.log('JURIS (' + juris.length + '):', JSON.stringify(juris));

  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
