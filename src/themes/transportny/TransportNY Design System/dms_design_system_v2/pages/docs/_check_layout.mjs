// Responsive + console check for docs pages (headless Chromium via dms-template's Playwright).
//   node _check_layout.mjs [file.html ...]      default: every non-underscore .html in this folder
// Reports scrollWidth vs clientWidth at 1440/1280/1024/768, console errors, failed requests. Exit 1 on any overflow/error.
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = await import("/home/alex/code/avail/dms-template/node_modules/playwright/index.mjs");
const files = process.argv.slice(2).filter(a => a.endsWith(".html")).map(a => a.replace(/^.*\//, ""));
const targets = files.length ? files : readdirSync(here).filter(f => f.endsWith(".html") && !f.startsWith("_"));
const browser = await chromium.launch(); let bad = 0;
for (const f of targets) {
  const row = [];
  for (const w of [1440, 1280, 1024, 768]) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } });
    const errors = [], failed = [];
    page.on("console", m => { if (m.type() === "error") errors.push(m.text().slice(0, 100)); });
    page.on("requestfailed", r => failed.push(r.url().slice(0, 80)));
    await page.goto("file://" + join(here, f), { waitUntil: "load" }); await page.waitForTimeout(900);
    const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, side: !!document.querySelector("#docsSidebar a"), h1: getComputedStyle(document.querySelector("h1") || document.body).fontFamily.slice(0, 6) }));
    const over = r.sw > r.cw; if (over || errors.length || failed.length) bad++;
    row.push(`${w}:${over ? "OVERFLOW " + r.sw : "ok"}${errors.length ? " err" + errors.length : ""}${failed.length ? " fail" + failed.length : ""}${r.side ? "" : " no-sidebar"}${r.h1 === "Oswald" ? "" : " font?"}`);
    if (errors.length) console.log("   console:", errors.join(" | "));
    await page.close();
  }
  console.log(`${f}  ${row.join("  ")}`);
}
await browser.close(); console.log(bad ? `\n${bad} problem(s)` : "\nall clean"); process.exit(bad ? 1 : 0);
