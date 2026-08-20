// Generic MitigateNY 1.0 SPA crawler.
// Usage: node crawl.js <outDir> <route1> [route2] ...
// Renders each route in headless Edge, waits for SPA hydration, saves innerText + a
// link inventory. Reusable across *.mitigateny.org 1.0 sites (subdomain = county).
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = process.env.MNY_BASE || 'https://delaware.mitigateny.org';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const outDir = process.argv[2];
const routes = process.argv.slice(3);
fs.mkdirSync(outDir, { recursive: true });

const slug = (r) => (r.replace(/^https?:\/\/[^/]+/, '').replace(/^\/+|\/+$/g, '') || 'index').replace(/[^a-zA-Z0-9]+/g, '_');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 2200 });
  page.on('dialog', d => d.dismiss().catch(() => {}));

  const allLinks = {};
  for (const route of routes) {
    const url = route.startsWith('http') ? route : BASE + route;
    const errors = [];
    page.removeAllListeners('pageerror');
    page.on('pageerror', e => errors.push(String(e).slice(0, 150)));
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    } catch (e) { errors.push('goto:' + e.message); }
    await sleep(7000);
    // expand any collapsed accordions/read-more toggles heuristically
    await page.evaluate(() => {
      document.querySelectorAll('[aria-expanded="false"]').forEach(el => { try { el.click(); } catch (e) {} });
    }).catch(() => {});
    await sleep(1500);
    const data = await page.evaluate(() => {
      const txt = document.body.innerText || '';
      const links = Array.from(document.querySelectorAll('a[href]'))
        .map(a => ({ href: a.getAttribute('href'), text: (a.innerText || '').trim().slice(0, 80) }))
        .filter(l => l.href && !l.href.startsWith('http') && l.href !== '#');
      return { url: location.href, title: document.title, text: txt, links };
    });
    const s = slug(route);
    fs.writeFileSync(path.join(outDir, s + '.txt'), data.text, 'utf8');
    fs.writeFileSync(path.join(outDir, s + '.links.json'), JSON.stringify(data.links, null, 2), 'utf8');
    allLinks[route] = data.links;
    console.log(`${route} -> ${s}.txt  (len=${data.text.length}, links=${data.links.length}, err=${errors.length})`);
    if (errors.length) console.log('   ERR:', errors.slice(0, 3).join(' | '));
  }
  fs.writeFileSync(path.join(outDir, '_alllinks.json'), JSON.stringify(allLinks, null, 2), 'utf8');
  await browser.close();
})();
