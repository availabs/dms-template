// Generic CONCURRENT runner for MNY 1.0 scrapes — the scalable path for big counties (Allegany: 40 juris).
// Spawns fresh-browser child processes (scrape_one.js for annexes, scrape_blue.js for blue boxes) with a
// concurrency cap; resumable (skips jurisdictions whose output already exists). No Edge-killing (that would
// kill sibling browsers) — each child self-heals via its own 3x browser-relaunch retry.
//
// Usage: MNY_BASE=... MNY_CONFIG=<abs config.json> OUT=<abs _raw-scrape dir> CONC=3 \
//          node run_concurrent.js <annex|blue>
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const CFG = require(process.env.MNY_CONFIG);
const OUT = process.env.OUT;
const MODE = process.argv[2] || 'annex';           // 'annex' | 'blue'
const CONC = parseInt(process.env.CONC || '3', 10);
const blueDir = path.join(OUT, 'blue');
if (MODE === 'blue') fs.mkdirSync(blueDir, { recursive: true });
const fslug = (s) => s.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
const isDone = (j) => {
  const s = fslug(j);
  if (MODE === 'annex') return fs.existsSync(path.join(OUT, `annex_${s}_strategies.txt`));
  // blue JSON is written incrementally (resumable per-hazard) — only "done" when complete:true
  const p = path.join(blueDir, `blue_${s}.json`);
  if (!fs.existsSync(p)) return false;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')).complete === true; } catch (e) { return false; }
};
const todo = CFG.juris.filter(j => !isDone(j));
console.log(`[${MODE}] ${todo.length}/${CFG.juris.length} to do, concurrency ${CONC}`);
let i = 0, active = 0, finished = 0;
function launchNext() {
  if (i >= todo.length) { if (active === 0) console.log(`[${MODE}] ALL DONE (${finished} run this pass)`); return; }
  const j = todo[i++]; active++;
  const script = MODE === 'annex' ? 'scrape_one.js' : 'scrape_blue.js';
  const outArg = MODE === 'annex' ? OUT : blueDir;
  const child = spawn('node', [script, outArg, j], { stdio: 'inherit', env: process.env });
  child.on('exit', (code) => {
    active--; finished++;
    console.log(`[${MODE}] done ${j} (exit ${code}) — ${finished}/${todo.length} complete, ${active} active`);
    launchNext();
  });
}
for (let k = 0; k < Math.min(CONC, todo.length); k++) launchNext();
