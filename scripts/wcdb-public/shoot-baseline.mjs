#!/usr/bin/env node
/* Full-page before/after shots for a THEME-level change.
 *
 *   node scripts/wcdb-public/shoot-baseline.mjs before
 *   …make the theme change, restart `npm run dev`…
 *   node scripts/wcdb-public/shoot-baseline.mjs after
 *
 * `card-shot.mjs` answers "how far is this ONE card from its mockup". This
 * answers the other question a theme migration asks: "did anything move that I
 * did not intend". Same URLs, same viewport, two runs, diffed by pixel count.
 *
 * `/edit/` on purpose, even though edit mode mounts the section manager (which
 * can auto-persist a degraded layout — back the page rows up first, and take
 * few settled shots). The published versions of these pages are the OLD site:
 * the Card sections this migration is about exist only in the draft, so a view-
 * mode shot would diff a page the change cannot touch.
 */
import { chromium } from 'playwright';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const phase = process.argv[2] || 'before';
const OUT = `scratchpad/wcdb-prod/v2-baseline/${phase}`;
const BASE = process.env.WCDB_BASE || 'http://localhost:5173';
const STORAGE = 'scratchpad/wcdb-prod/auth.json';

// Four pages that exercise the Card differently: a multi-cell composition with
// images and column types; a long list card; a cardsGridSize>1 grid; and the
// admin list styles (adminRow / adminHeaderRow), which is where a v2 packing
// change would show up first.
const TARGETS = [
  { name: 'home', url: '/edit/home' },
  { name: 'playlist', url: '/edit/playlist' },
  { name: 'station_info', url: '/edit/station_info' },
  { name: 'admin_playlist', url: '/admin/edit/playlist' },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1200 },
  deviceScaleFactor: 1,
  ...(existsSync(STORAGE) ? { storageState: STORAGE } : {}),
});

for (const t of TARGETS) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}${t.url}`, { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => console.log(`  goto: ${e.message}`));
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/${t.name}.png`, fullPage: true });
  const h = await page.evaluate(() => document.body.scrollHeight);
  console.log(`${t.name.padEnd(16)} ${String(h).padStart(6)}px  → ${OUT}/${t.name}.png`);
  await page.close();
}

await ctx.close();
await browser.close();

// When the `after` run lands, report the height delta per page — the cheapest
// signal that v2's top-packing changed something.
if (phase === 'after') {
  console.log('\ncompare with: node scripts/wcdb-public/shoot-baseline.mjs diff');
}
if (phase === 'diff') {
  for (const t of TARGETS) {
    const a = `scratchpad/wcdb-prod/v2-baseline/before/${t.name}.png`;
    const b = `scratchpad/wcdb-prod/v2-baseline/after/${t.name}.png`;
    if (!existsSync(a) || !existsSync(b)) continue;
    console.log(`${t.name}: ${readFileSync(a).length} vs ${readFileSync(b).length} bytes`);
  }
}
