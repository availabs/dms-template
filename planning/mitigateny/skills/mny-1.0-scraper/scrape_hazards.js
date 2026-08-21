// Re-scrape the 18 county per-hazard Characteristics with content STABILIZATION polling.
// Fixes the click->render lag where a hazard file captured the previous hazard's stale body.
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = process.env.MNY_BASE || 'https://delaware.mitigateny.org';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const OUT = process.argv[2] || 'data';
const HAZARDS = ["Avalanche", "Coastal Hazards", "Coldwave", "Drought", "Earthquake", "Flooding", "Hail", "Heat Wave", "Hurricane", "Ice Storm", "Landslide", "Lightning", "Snow Storm", "Tornado", "Tsunami/Seiche", "Volcano", "Wildfire", "Wind"];
const fslug = (s) => s.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
const log = (m) => { console.log(m); fs.appendFileSync(path.join(OUT, '_scrape.log'), m + '\n'); };

async function gotoHome(page) {
  for (let i = 0; i < 4; i++) {
    try { await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(9000);
      const ok = await page.evaluate(() => !!Array.from(document.querySelectorAll('a')).find(x => (x.textContent || '').trim().toUpperCase() === 'HAZARDS')); if (ok) return true;
    } catch (e) { log('  gotoHome retry ' + (i + 1)); } await sleep(3000);
  } return false;
}
const grab = (page) => page.evaluate(() => document.body.innerText || '');
// characteristics body = text between "<H> Characteristics" and "- Local Impacts -"
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
  page.on('dialog', d => d.dismiss().catch(() => {})); page.on('pageerror', () => {});
  await gotoHome(page);
  await page.evaluate(() => { const a = [...document.querySelectorAll('a')].find(x => (x.textContent || '').trim().toUpperCase() === 'HAZARDS'); a && a.click(); });
  await sleep(8000);
  let prevBody = null;
  for (const h of HAZARDS) {
    await page.evaluate((nm) => { const li = [...document.querySelectorAll('ul.main-menu li')].find(x => (x.textContent || '').trim() === nm); li && li.click(); }, h);
    await sleep(6000);
    // stabilize: poll until charBody is non-null, stable across 2 grabs, and != prevBody (sequential-lag guard)
    let last = null, stableCount = 0, text = '', body = null;
    for (let i = 0; i < 10; i++) {
      text = await grab(page);
      body = charBody(text, h);
      const settled = body && body.length > 40 && body === last;
      const notStale = body !== prevBody; // guard against previous hazard's lingering body
      if (settled && notStale) { stableCount++; if (stableCount >= 1) break; }
      last = body; await sleep(4000);
    }
    fs.writeFileSync(path.join(OUT, `county_hazard_${fslug(h)}.txt`), text, 'utf8');
    const first = (body || '').slice(0, 60).replace(/\n/g, ' ');
    log(`  ${h}: len=${text.length} body="${first}..."`);
    prevBody = body;
  }
  await browser.close();
  log('=== HAZARD RESCRAPE DONE ===');
})().catch(e => { log('FATAL hazards: ' + e.message); process.exit(1); });
