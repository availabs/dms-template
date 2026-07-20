// qa_assess.mjs — Playwright harness for qa-assess-page (T3). Runs the MACHINE-detectable
// checks against one page URL and emits machine-readable findings + artifacts (screenshots,
// text dump) for the agent's judgment checks (stories, design comparison).
//
//   node src/themes/transportny/qa_skills/tools/qa_assess.mjs \
//     --url http://tsmo2.localhost:5173/edit/home \
//     --storage scratchpad/npmrdsv5-dev2/auth.json \
//     [--design "src/themes/.../dms_design_system_v2/pages/tsmo-home.html"] \
//     --out /tmp/assess_tsmo2_home
//
// Output: <out>/findings.json  { url, findings: [{check, severity, title, detail, env}],
//         artifacts: { desktop, mobile, design?, text } }
// Checks: console/page errors · failed API requests (≥400) · /graph SQL errors · stuck
// loading/NaN · in-app link audit (nested /edit/<slug>/<slug>, empty ?param=) · 390px horizontal
// overflow. Screenshots at 1480×1100 + 390×844 (+ the design mockup render when --design).
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const URL = opt("url"), STORAGE = opt("storage"), DESIGN = opt("design"), OUT = opt("out", "/tmp/qa_assess");
const SETTLE = +opt("settle", 10000);
if (!URL) { console.error("--url required"); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const route = new globalThis.URL(URL).pathname;
const findings = [];
const push = (check, severity, title, detail, viewport) =>
  findings.push({ check, severity, title, detail: String(detail).slice(0, 600), env: `${route} · Chromium · ${viewport}` });

const b = await chromium.launch();

async function assessViewport(width, height, label, shotName) {
  const ctx = await b.newContext({ ...(STORAGE ? { storageState: STORAGE } : {}), viewport: { width, height } });
  const p = await ctx.newPage();
  const consoleErrs = [], pageErrs = [], failedReqs = [], graphErrs = [];
  p.on("console", (m) => { if (m.type() === "error") consoleErrs.push(m.text().slice(0, 250)); });
  p.on("pageerror", (e) => pageErrs.push(String(e).slice(0, 250)));
  p.on("response", async (r) => {
    const u = r.url();
    const isApi = /:(3001|4444)\//.test(u); // API hosts only — Vite-served sources are noise
    if (isApi && r.status() >= 400) failedReqs.push(`${r.status()} ${u.slice(0, 160)}`);
    if (isApi && u.includes("/graph")) {
      let body = ""; try { body = await r.text(); } catch {}
      const m = body.match(/(syntax error[^"]{0,160}|column .{0,80} does not exist|relation .{0,80} does not exist)/i);
      if (m) graphErrs.push(m[1]);
    }
  });
  await p.goto(URL, { waitUntil: "networkidle", timeout: 60000 }).catch((e) => push("load", "Blocker", "Page failed to load", e.message, label));
  await p.waitForTimeout(SETTLE);

  const dom = await p.evaluate(() => {
    const body = document.body.innerText;
    const loginish = /sign in.*password|password.*sign in/is.test(body) && body.length < 800;
    // stuck check: exclude matches inside FIXED-position chrome — the edit UI's bottom-right
    // widget shows "Loading… N" long after page content settles (systematic false positive).
    const stuckEls = [...document.querySelectorAll("div,span")]
      .filter((e) => e.childElementCount === 0 && /loading\s*\.\.\.|PAGE\s+\S+\s+OF\s+NaN/i.test((e.innerText || "").trim()))
      .filter((e) => !e.closest(".fixed"));
    const stuck = stuckEls.slice(0, 3).map((e) => (e.innerText || "").trim().slice(0, 60));
    const links = [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href"));
    const badNested = links.filter((h) => /\/edit\/[^/?#]+\/[^/?#]+/.test(h || ""));
    const emptyParam = links.filter((h) => /[?&][a-z_]+=($|&)/i.test(h || ""));
    const hOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 4;
    return { loginish, stuck, badNested: [...new Set(badNested)].slice(0, 5), emptyParam: [...new Set(emptyParam)].slice(0, 5), hOverflow, bodyLen: body.length, text: body.slice(0, 6000) };
  });

  if (dom.loginish) push("auth", "Blocker", "Assessment landed on the sign-in page", "storageState missing/expired or wrong --origin", label);
  for (const e of [...new Set(consoleErrs)].slice(0, 5)) push("console", "Major", "Console error on load", e, label);
  for (const e of [...new Set(pageErrs)].slice(0, 5)) push("pageerror", "Blocker", "Uncaught page error", e, label);
  for (const e of [...new Set(failedReqs)].slice(0, 5)) push("request", "Major", "API request failed", e, label);
  for (const e of [...new Set(graphErrs)].slice(0, 5)) push("graph", "Blocker", "SQL error from a section query", e, label);
  for (const s of dom.stuck) push("stuck", "Major", "Section stuck at loading/NaN after settle", s, label);
  for (const h of dom.badNested) push("link", "Major", "Nested/broken in-app link", h, label);
  for (const h of dom.emptyParam) push("link", "Minor", "Link with empty query param", h, label);
  if (width < 500 && dom.hOverflow) push("responsive", "Minor", "Horizontal overflow on mobile viewport", `scrollWidth > clientWidth at ${width}px`, label);

  await p.screenshot({ path: `${OUT}/${shotName}.png`, fullPage: true });
  const text = dom.text;
  await ctx.close();
  return text;
}

const text = await assessViewport(1480, 1100, "1480×1100", "desktop");
await assessViewport(390, 844, "390×844", "mobile");

let designShot = null;
if (DESIGN) {
  const ctx = await b.newContext({ viewport: { width: 1480, height: 1100 } });
  const p = await ctx.newPage();
  await p.goto("file://" + DESIGN.replace(/^file:\/\//, ""), { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(2500);
  designShot = `${OUT}/design.png`;
  await p.screenshot({ path: designShot, fullPage: true });
  await ctx.close();
}
await b.close();

writeFileSync(`${OUT}/page_text.txt`, text || "");
const result = { url: URL, findings, artifacts: { desktop: `${OUT}/desktop.png`, mobile: `${OUT}/mobile.png`, ...(designShot ? { design: designShot } : {}), text: `${OUT}/page_text.txt` } };
writeFileSync(`${OUT}/findings.json`, JSON.stringify(result, null, 1));
console.log(JSON.stringify({ findings: findings.length, out: `${OUT}/findings.json` }));
