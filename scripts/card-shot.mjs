#!/usr/bin/env node
/**
 * card-shot.mjs — the visual half of the "design card → DMS card" transcription loop.
 *
 * WHAT IT DOES
 *   Screenshots one element from the design mockup AND the matching element from
 *   the live DMS page, crops each to its own bounding box, and stitches a labeled
 *   side-by-side so you can eyeball "mockup vs. live" while you iterate the card
 *   config. It does NOT change the page — it only looks.
 *
 * HOW PLAYWRIGHT WORKS (the 6 lines this script is built on)
 *   1. chromium.launch()        → starts a real headless browser process.
 *   2. browser.newContext(...)  → an isolated profile (its own cookies/storage),
 *                                 where you set viewport + deviceScaleFactor (2 = retina,
 *                                 crisp text). Auth lives here via storageState.
 *   3. context.newPage()        → a tab.
 *   4. page.goto(url)           → navigate. url can be file://… (the mockup) or
 *                                 http://localhost:5173/… (the live dev server).
 *   5. page.locator(css)        → a lazy handle to an element; .screenshot({path})
 *                                 captures JUST that element, cropped to its box.
 *   6. browser.close()          → tear down.
 *   Everything is async/await because each call is a round-trip to the browser.
 *
 * USAGE
 *   node scripts/card-shot.mjs \
 *     --name interstate \
 *     --mockup "src/themes/transportny/TransportNY Design System/dms_design_system_v2/pages/map-21-system-performance.html" \
 *     --mockup-sel '[data-dms-section="kpi-interstate"]' \
 *     --live "http://localhost:5173/list/map_21_system_performance?year_record=2025" \
 *     --live-sel '#section-2173919' \
 *     --out scratchpad/npmrdsv5-dev2/transcribe
 *
 *   Optional:
 *     --storage <file.json>   saved auth state (see "AUTH" in the skill) — omit on open sites
 *     --width <px>            context viewport width  (default 1480, the report's max-w)
 *     --wait <ms>            extra settle time after load (default 600)
 *     --mockup-only / --live-only   shoot just one side
 *
 * PREREQUISITES (one-time, asks the user — see skill):
 *     npm i -D playwright && npx playwright install chromium
 */

import { chromium } from "playwright";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

// ---- tiny arg parser (no dep) -------------------------------------------------
const args = process.argv.slice(2);
const flag = (name, dflt = undefined) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return dflt;
  const v = args[i + 1];
  return v && !v.startsWith("--") ? v : true; // bare flag → true
};

const name       = flag("name", "card");
const mockupPath  = flag("mockup");
const mockupSel   = flag("mockup-sel");
const liveUrl     = flag("live");
const liveSel     = flag("live-sel");
const outDir      = flag("out", "scratchpad/transcribe");
const storage     = flag("storage");
const width       = Number(flag("width", 1480));
const settleMs    = Number(flag("wait", 600));
const mockupOnly  = flag("mockup-only", false);
const liveOnly    = flag("live-only", false);

// ---- shoot one element on one page -------------------------------------------
async function shoot(context, { url, selector, outFile, label }) {
  const page = await context.newPage();
  try {
    // waitUntil:'networkidle' = wait until no network for 500ms (CDN fonts, data).
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    // Web fonts load async; without this, text can screenshot in a fallback font.
    await page.evaluate(() => document.fonts && document.fonts.ready);
    // Wait for the actual element to exist & be visible before measuring it.
    const el = page.locator(selector).first();
    await el.waitFor({ state: "visible", timeout: 15_000 });
    await page.waitForTimeout(settleMs); // let transitions/sparklines settle
    await el.screenshot({ path: outFile });
    const box = await el.boundingBox();
    console.log(`  ✓ ${label}: ${outFile}  (${Math.round(box?.width)}×${Math.round(box?.height)})`);
    return box;
  } catch (e) {
    console.error(`  ✗ ${label} FAILED: ${e.message}`);
    return null;
  } finally {
    await page.close();
  }
}

// ---- stitch the two PNGs into one labeled side-by-side ------------------------
// Done by rendering a tiny HTML page that <img>s both files, then screenshotting
// it — so we need no image library, just the browser we already have.
async function composite(context, { mockupFile, liveFile, outFile }) {
  const page = await context.newPage();
  // Inline both PNGs as base64 data URIs — Chromium blocks file:// subresources
  // loaded from an about:blank/setContent document, so file:// <img src> renders broken.
  const dataUri = async (f) => `data:image/png;base64,${(await readFile(f)).toString("base64")}`;
  const [mSrc, lSrc] = await Promise.all([dataUri(mockupFile), dataUri(liveFile)]);
  const html = `<!doctype html><meta charset=utf8>
    <body style="margin:0;background:#0b0f14;font:12px ui-monospace,monospace;color:#9aa4b2">
    <div style="display:flex;gap:16px;padding:16px;align-items:flex-start">
      <figure style="margin:0"><figcaption style="padding:4px 0">MOCKUP</figcaption>
        <img src="${mSrc}" style="display:block;box-shadow:0 0 0 1px #1f2733"></figure>
      <figure style="margin:0"><figcaption style="padding:4px 0">LIVE (DMS)</figcaption>
        <img src="${lSrc}" style="display:block;box-shadow:0 0 0 1px #1f2733"></figure>
    </div></body>`;
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.waitForTimeout(200);
  await page.locator("body").screenshot({ path: outFile });
  console.log(`  ⇄ side-by-side: ${outFile}`);
  await page.close();
}

// ---- main ---------------------------------------------------------------------
(async () => {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch(); // headless by default
  const context = await browser.newContext({
    viewport: { width, height: 1200 },
    deviceScaleFactor: 2, // 2× pixel density → sharp text in screenshots
    ...(storage ? { storageState: storage } : {}),
  });

  const mockupFile = path.join(outDir, `${name}.mockup.png`);
  const liveFile   = path.join(outDir, `${name}.live.png`);

  if (!liveOnly) {
    if (!mockupPath || !mockupSel) throw new Error("need --mockup and --mockup-sel");
    console.log("MOCKUP:");
    await shoot(context, {
      url: pathToFileURL(path.resolve(mockupPath)).href,
      selector: mockupSel, outFile: mockupFile, label: "mockup",
    });
  }
  if (!mockupOnly) {
    if (!liveUrl || !liveSel) throw new Error("need --live and --live-sel");
    console.log("LIVE:");
    await shoot(context, { url: liveUrl, selector: liveSel, outFile: liveFile, label: "live" });
  }
  if (!mockupOnly && !liveOnly) {
    await composite(context, { mockupFile, liveFile, outFile: path.join(outDir, `${name}.compare.png`) });
  }

  await browser.close();
  console.log(`\nDone. Open ${path.join(outDir, `${name}.compare.png`)} to compare.`);
})().catch((e) => { console.error(e); process.exit(1); });
