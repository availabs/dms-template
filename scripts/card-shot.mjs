#!/usr/bin/env node
/* card-shot — shoot a design atom and its live counterpart, side by side.
 *
 * The verification foot of the loop in
 * `src/dms/skills/transcribing-a-design-card-to-dms.md`: it tells you HOW FAR
 * OFF a live card is from its mockup. It never writes card config — the
 * inventory table in that skill is where the mapping happens.
 *
 *   node scripts/card-shot.mjs \
 *     --name board \
 *     --mockup "src/themes/wcdb/WCDB Design System/dms_design_system/pages/station-info.html" \
 *     --mockup-sel '[data-dms-section="card:executive-board"]' \
 *     --live "http://localhost:5173/edit/station_info" \
 *     --live-sel '[id="1964987"]' \
 *     --storage scratchpad/wcdb-prod/auth.json \
 *     --out scratchpad/wcdb-prod/transcribe
 *
 * Writes `<name>.mockup.png`, `<name>.live.png`, `<name>.compare.png`.
 * Omit --live/--live-sel to shoot the mockup alone (useful for an inventory
 * pass before anything is built).
 *
 * ── the caveats that will each bite once ─────────────────────────────────
 * • A DRAFT page renders only at `/edit/<slug>`, which is auth-gated, so pass
 *   `--storage` (mint one with `dms/packages/dms/cli/bin/mint-token.mjs`).
 *   Tokens last ~6h; when shots land on the sign-in page, re-mint.
 * • Edit mode mounts the section manager, which can auto-persist a degraded
 *   layout. **Back the page row up first** and take few, settled shots —
 *   never a rapid loop. (`dms raw get <pageId> > …/backups/page_<id>.json`)
 * • Sections render as `<div id="<sectionId>">`. A CSS id cannot start with a
 *   digit, so the live selector is the ATTRIBUTE form `[id="1964987"]`.
 * • Theme edits are assembled at boot and do NOT reliably hot-rebuild. If a
 *   theme change is not showing, restart `npm run dev` before believing the
 *   shot.
 * • Fonts load late; this waits on `document.fonts.ready` so nothing is
 *   captured in a fallback face.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const name = opt('name', 'atom');
const mockup = opt('mockup');
const mockupSel = opt('mockup-sel');
const live = opt('live');
const liveSel = opt('live-sel');
const storage = opt('storage');
const out = opt('out', 'scratchpad/transcribe');
const width = +opt('width', 1440);
const wait = +opt('wait', 4000);
// Chromium ships in this repo's node_modules only on some machines; the local
// Chrome is what the other WCDB scripts drive.
const executablePath = opt('chrome', '/usr/bin/google-chrome');

if (!mockup || !mockupSel) {
  console.error('usage: card-shot.mjs --name <n> --mockup <file.html> --mockup-sel <css> [--live <url> --live-sel <css>] [--storage auth.json] [--out dir]');
  process.exit(1);
}
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath });

async function shoot(url, sel, path, useStorage) {
  const ctx = await browser.newContext({
    viewport: { width, height: 1200 },
    deviceScaleFactor: 2,                       // retina-crisp text, so type is judgeable
    ...(useStorage && storage ? { storageState: storage } : {}),
  });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => console.log(`  goto: ${e.message}`));
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await page.waitForTimeout(wait);
  const el = page.locator(sel).first();
  const n = await el.count();
  if (!n) { console.log(`  ✗ ${sel} not found at ${url}`); await ctx.close(); return null; }
  await el.screenshot({ path }).catch(async (e) => { console.log(`  ✗ shot failed: ${e.message}`); });
  const box = await el.boundingBox();
  await ctx.close();
  return box;
}

console.log(`mockup  ${mockupSel}`);
const mBox = await shoot(`file://${resolve(mockup)}`, mockupSel, `${out}/${name}.mockup.png`, false);
if (mBox) console.log(`  ${Math.round(mBox.width)}×${Math.round(mBox.height)} → ${out}/${name}.mockup.png`);

let lBox = null;
if (live && liveSel) {
  console.log(`live    ${liveSel}`);
  lBox = await shoot(live, liveSel, `${out}/${name}.live.png`, true);
  if (lBox) console.log(`  ${Math.round(lBox.width)}×${Math.round(lBox.height)} → ${out}/${name}.live.png`);
}

/* ── stitch, labelled, on one canvas ──────────────────────────────────────
 * Done in the browser rather than with an image library: it is already
 * running, and a labelled HTML page screenshots to exactly the comparison you
 * want to look at.
 */
if (mBox && lBox) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  // Written to disk and NAVIGATED to, not `setContent`: a page created with
  // setContent has an `about:blank` base, and a `file://` <img> inside it is
  // blocked — the compare came out as two broken-image icons.
  const html = `
    <style>
      body { margin:0; background:#0e1011; color:#f5f5f5; font:12px ui-monospace,monospace; }
      .row { display:flex; gap:16px; padding:16px; align-items:flex-start; }
      .col { flex:1; min-width:0; }
      .lbl { text-transform:uppercase; letter-spacing:.12em; color:#8a8a8a; padding:6px 2px; }
      img { width:100%; height:auto; display:block; border:1px solid rgba(255,255,255,.1); }
    </style>
    <div class="row">
      <div class="col"><div class="lbl">design · ${Math.round(mBox.width)}×${Math.round(mBox.height)}</div>
        <img src="./${name}.mockup.png"></div>
      <div class="col"><div class="lbl">live · ${Math.round(lBox.width)}×${Math.round(lBox.height)}</div>
        <img src="./${name}.live.png"></div>
    </div>`;
  writeFileSync(`${out}/${name}.compare.html`, html);
  await page.goto(`file://${resolve(out)}/${name}.compare.html`, { waitUntil: 'networkidle' });
  await page.locator('.row').screenshot({ path: `${out}/${name}.compare.png` });
  await ctx.close();
  console.log(`compare → ${out}/${name}.compare.png`);
  const dh = Math.round((lBox.height / mBox.height) * 100);
  console.log(`height: live is ${dh}% of the design's (${Math.round(lBox.height)} vs ${Math.round(mBox.height)})`);
}

await browser.close();
