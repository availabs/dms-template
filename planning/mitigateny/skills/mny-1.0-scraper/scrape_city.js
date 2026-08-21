// Scrape ONE jurisdiction's full annex (all views) from a MitigateNY 1.0 site and
// emit a structured markdown file matching schenectady-lhmp-v1-annex-<juris>.md.
//
// Built for the City of Schenectady, which the original Schenectady scrape missed:
// its dropdown label is "Schenectady city ( City)" (irregular "( City)" spacing) —
// the older toolchain's jurisdiction matcher skipped that token (the bug later fixed
// in the Niagara/Allegany mny_* toolchain). This script selects by the EXACT dropdown
// text, so the token spacing is irrelevant.
//
// Usage: node scrape_city.js
//   env: MNY_BASE (default schenectady), MNY_JURIS (exact dropdown text),
//        MNY_SLUG (output file slug), MNY_TITLE (H1), MNY_WAIT (ms)
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = process.env.MNY_BASE || 'https://schenectady.mitigateny.org';
const JURIS = process.env.MNY_JURIS || 'Schenectady city ( City)';
const SLUG = process.env.MNY_SLUG || 'schenectady-city';
const TITLE = process.env.MNY_TITLE || 'City of Schenectady';
const WAIT = parseInt(process.env.MNY_WAIT || '7000', 10);
const OUTDIR = path.resolve(__dirname, '../schenectady/schenectady-alex/annexes');
const RAWDIR = path.resolve(__dirname, '../schenectady/schenectady-alex/_raw', SLUG);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// top-nav pages -> annex chapter label (matches existing annex md structure the loader parses)
const NAV = [
  { nav: 'HOME', chapter: 'Home / Plan Overview' },
  { nav: 'PLANNING PROCESS', chapter: 'Planning Process' },
  { nav: 'RISK', chapter: 'Risk' },
  { nav: 'STRATEGIES', chapter: 'Strategies' },
];
const HAZARDS = ['Avalanche','Coastal Hazards','Coldwave','Drought','Earthquake','Flooding','Hail','Heat Wave','Hurricane','Ice Storm','Landslide','Lightning','Snow Storm','Tornado','Tsunami/Seiche','Volcano','Wildfire','Wind'];

// In-page extractor: all div.element-box blue boxes for JURIS + nearest section heading.
function blueBoxesJs() {
  return (J) => {
    const head = J + ' Jurisdictional Annex';
    const all = [...document.querySelectorAll('*')];
    const nearestHeading = (el) => {
      const idx = all.indexOf(el);
      for (let i = idx - 1; i >= 0; i--) { const e = all[i]; if (/^h[1-6]$/.test(e.tagName.toLowerCase())) { const t = e.textContent.trim(); if (t) return t; } }
      return '(unknown)';
    };
    return [...document.querySelectorAll('div.element-box')]
      .filter(el => (el.innerText || '').trim().startsWith(head))
      .map(el => { const full = (el.innerText || '').trim(); return { section: nearestHeading(el), text: full.slice(head.length).trim() }; })
      .filter(b => b.text);
  };
}

async function selectJuris(page) {
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /\(\s*(County|City|Town|Village)\s*\)/i.test(x.textContent || '')); b && b.click(); });
  await sleep(1500);
  const ok = await page.evaluate((n) => { const el = [...document.querySelectorAll('*')].find(x => x.children.length === 0 && (x.textContent || '').trim() === n); if (el) { el.click(); return true; } return false; }, JURIS);
  await sleep(WAIT);
  return ok;
}
async function clickNav(page, label) {
  await page.evaluate((L) => { const a = [...document.querySelectorAll('a,button')].find(x => (x.textContent || '').trim().toUpperCase() === L); a && a.click(); }, label);
  await sleep(WAIT);
}

(async () => {
  fs.mkdirSync(RAWDIR, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const capture = { jurisdiction: JURIS, base: BASE, pages: {}, hazards: {} };
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 2800 });
    page.on('dialog', d => d.dismiss().catch(() => {})); page.on('pageerror', () => {});
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(9000);
    const sel = await selectJuris(page);
    console.log('selected juris:', sel);

    for (const { nav, chapter } of NAV) {
      await clickNav(page, nav);
      const boxes = await page.evaluate(blueBoxesJs(), JURIS);
      capture.pages[chapter] = boxes;
      console.log(`${nav} (${chapter}): ${boxes.length} blue boxes -> ${boxes.map(b => b.section).join(', ')}`);
    }

    // hazards: sidebar list; capture per-hazard blue box
    await clickNav(page, 'HAZARDS');
    for (const h of HAZARDS) {
      await page.evaluate((nm) => { const li = [...document.querySelectorAll('ul.main-menu li, aside a, .sidebar a, a')].find(x => (x.textContent || '').trim() === nm); li && li.click(); }, h);
      await sleep(WAIT);
      const boxes = await page.evaluate(blueBoxesJs(), JURIS);
      const box = boxes.find(b => b.text) || null;
      if (box) { capture.hazards[h] = box.text; console.log(`  hazard ${h}: ${box.text.length} chars`); }
    }
  } finally { await browser.close().catch(() => {}); }

  fs.writeFileSync(path.join(RAWDIR, 'capture.json'), JSON.stringify(capture, null, 2));

  // ---- assemble markdown (structure the annex loader parses) ----
  const L = [];
  L.push(`# ${TITLE} — Jurisdictional Annex`, '');
  L.push(`> Scraped ${BASE} jurisdiction "${JURIS}" via scrape_city.js. Blue-box local prose only;`);
  L.push(`> shared boilerplate + data tables omitted (2.0 auto-populates those).`, '');
  for (const { chapter } of NAV) {
    const boxes = capture.pages[chapter] || [];
    if (!boxes.length) continue;
    L.push(`## ${chapter}`, '');
    for (const b of boxes) {
      L.push(`##### ${b.section}`, '');
      L.push(`${JURIS} Jurisdictional Annex`);
      L.push(b.text, '');
    }
  }
  const hz = Object.keys(capture.hazards);
  if (hz.length) {
    L.push(`## Hazard Profiles — ${TITLE} local content`, '');
    for (const h of hz) {
      L.push(`### ${h}`, '');
      L.push(`###### ${JURIS} - Local Impacts - ${h}`, '');
      L.push(capture.hazards[h], '');
    }
  }
  const mdPath = path.join(OUTDIR, `schenectady-lhmp-v1-annex-${SLUG}.md`);
  fs.writeFileSync(mdPath, L.join('\n'));
  console.log('\nWROTE', mdPath);
  console.log('pages:', Object.entries(capture.pages).map(([c, b]) => `${c}=${b.length}`).join(', '), '| hazards:', hz.length);
})();
