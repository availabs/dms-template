#!/usr/bin/env node
/**
 * save-auth.mjs — capture a logged-in browser session for card-shot.mjs.
 *
 * The live DMS edit page is auth-gated, and Playwright launches a FRESH browser
 * with no cookies — so it lands on /auth/login. This opens a VISIBLE browser,
 * lets YOU log in by hand, waits until you've left the login screen, then writes
 * the cookies/localStorage to a storageState JSON. Pass that file to card-shot
 * with --storage and the screenshots run as you.
 *
 * USAGE
 *   node scripts/save-auth.mjs \
 *     --url "http://npmrds.localhost:5173/edit/map_21_system_performance?year_record=2025" \
 *     --out scratchpad/npmrdsv5-dev2/auth.json
 *
 *   A Chromium window opens on the login page. Sign in. Once you see the real
 *   page (URL no longer contains /auth/), the script saves and closes itself.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1]; };
const url = flag("url", "http://npmrds.localhost:5173/");
const out = flag("out", "scratchpad/auth.json");

await mkdir(path.dirname(out), { recursive: true });

// headless:false → a real window you can type into.
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ viewport: { width: 1480, height: 1000 } });
const page = await context.newPage();

console.log(`Opening ${url} — log in in the window that appears…`);
await page.goto(url, { waitUntil: "domcontentloaded" }).catch(() => {});

// Wait until you've logged in and been redirected off the /auth/ login route.
await page.waitForURL((u) => !u.toString().includes("/auth/"), { timeout: 300_000 });
await page.waitForTimeout(1500); // let any post-login token settle

await context.storageState({ path: out });
console.log(`✓ saved session → ${out}`);
await browser.close();
