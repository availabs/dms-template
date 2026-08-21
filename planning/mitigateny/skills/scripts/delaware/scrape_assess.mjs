import puppeteer from 'puppeteer-core';
import fs from 'fs';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = 'https://delaware.mitigateny.org';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const OUTF = new URL('./hazard_assessments.json', import.meta.url);
const HAZARDS = ["Avalanche", "Coastal Hazards", "Coldwave", "Drought", "Earthquake", "Flooding", "Hail", "Heat Wave", "Hurricane", "Ice Storm", "Landslide", "Lightning", "Snow Storm", "Tornado", "Wildfire", "Wind"];
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function assess(text, h) {
  const L = text.split('\n').map(x => x.trim());
  const startRe = new RegExp('- Local Impacts - ' + esc(h) + '$');
  const a = L.findIndex(l => startRe.test(l));
  if (a < 0) return '';
  const b = L.findIndex((l, i) => i > a && /- Local Hazards of Concern Table -/.test(l));
  return L.slice(a + 1, b < 0 ? a + 30 : b).filter(Boolean).join('\n');
}
let out = {};
try { out = JSON.parse(fs.readFileSync(OUTF, 'utf8')); } catch (e) {}   // resume
const remaining = HAZARDS.filter(h => !(out[h] !== undefined));
async function fresh() {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const p = await browser.newPage(); await p.setViewport({ width: 1400, height: 2600 });
  p.on('dialog', d => d.dismiss().catch(() => {})); p.on('pageerror', () => {});
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(9000);
  await p.evaluate(() => { const a = [...document.querySelectorAll('a')].find(x => x.textContent.trim().toUpperCase() === 'HAZARDS'); a && a.click(); }); await sleep(8000);
  return { browser, p };
}
let ctx = await fresh(); let sinceLaunch = 0, prev = null;
for (const h of remaining) {
  if (sinceLaunch >= 6) { await ctx.browser.close(); ctx = await fresh(); sinceLaunch = 0; prev = null; }
  const p = ctx.p;
  await p.evaluate(nm => { const li = [...document.querySelectorAll('ul.main-menu li')].find(x => x.textContent.trim() === nm); li && li.click(); }, h);
  await sleep(6000);
  let last = null, cur = '';
  for (let i = 0; i < 9; i++) {
    const t = await p.evaluate(() => document.body.innerText); cur = assess(t, h);
    if (cur && cur === last && cur !== prev) break;
    if (cur === '' && last === '') break;
    last = cur; await sleep(3500);
  }
  out[h] = cur; prev = cur; sinceLaunch++;
  fs.writeFileSync(OUTF, JSON.stringify(out, null, 1));   // incremental save
  console.log(`${h}: ${cur.length} chars — ${cur.slice(0, 70).replace(/\n/g, ' ')}`);
}
await ctx.browser.close();
console.log('wrote hazard_assessments.json (' + Object.keys(out).length + ' hazards)');
