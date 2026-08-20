// Probe: does Allegany render per-jurisdiction hazard detail? Select Wellsville (Town), click Flooding,
// dump the "Local Impacts" region + any element-box, and list element-box headings.
const puppeteer = require('puppeteer-core');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = 'https://allegany.mitigateny.org';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage(); await page.setViewport({ width: 1400, height: 2600 });
  page.on('dialog', d => d.dismiss().catch(() => {})); page.on('pageerror', () => {});
  for (let i = 0; i < 3; i++) { try { await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(9000); const ok = await page.evaluate(() => !![...document.querySelectorAll('a')].find(x => (x.textContent||'').trim().toUpperCase()==='HAZARDS')); if (ok) break; } catch(e){ console.log('boot retry', e.message);} }
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /\(County\)|\(Town\)|\(Village\)/.test(x.textContent||'')); b&&b.click(); }); await sleep(1800);
  const sel = await page.evaluate(() => { const el=[...document.querySelectorAll('li,div,a,span')].find(x=>(x.textContent||'').trim()==='Wellsville (Town)'); if(el){el.click();return true;} return false; });
  console.log('selected Wellsville (Town):', sel); await sleep(6000);
  await page.evaluate(() => { const a=[...document.querySelectorAll('a')].find(x=>(x.textContent||'').trim().toUpperCase()==='HAZARDS'); a&&a.click(); }); await sleep(8000);
  await page.evaluate(() => { const li=[...document.querySelectorAll('ul.main-menu li')].find(x=>(x.textContent||'').trim()==='Flooding'); li&&li.click(); }); await sleep(9000);
  const info = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll('div.element-box')].map(el => (el.innerText||'').trim().slice(0, 120));
    const bg = [...document.querySelectorAll('div')].filter(el => { try { return getComputedStyle(el).backgroundColor === 'rgb(240, 248, 255)'; } catch(e){ return false; } }).map(el => (el.innerText||'').trim().slice(0,120)).filter(Boolean).slice(0,5);
    const body = document.body.innerText || '';
    const idx = body.indexOf('Local Impacts');
    return { nBoxes: boxes.length, boxSample: boxes.slice(0,6), aliceblueSample: bg, localImpactsRegion: idx>=0 ? body.slice(idx, idx+800) : '(no "Local Impacts" text)' };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})().catch(e => { console.log('FATAL', e.message); process.exit(1); });
