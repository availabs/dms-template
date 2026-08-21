// Generic concurrency orchestrator: per-jurisdiction annex + blue scrapes, fresh-browser children, resumable.
// Usage: MNY_CONFIG=./niagara_config node mny_run_annexes.js <outDir> [concurrency]
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const CFG = require(process.env.MNY_CONFIG || './ham_config');
const OUT = process.argv[2] || 'data';
const CONC = parseInt(process.argv[3] || '3', 10);
const fslug = (s) => s.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
fs.mkdirSync(OUT, { recursive: true });
const env = { ...process.env };

const NO_BLUE = !!process.env.MNY_NO_BLUE; // some plans (Niagara) have no per-hazard blue boxes
// treat a 0-byte/tiny file as NOT done — a failed jurisdiction selection writes an empty file but exits 0
const done = (p) => fs.existsSync(p) && fs.statSync(p).size >= 500;
const tasks = [];
for (const j of CFG.JURIS) {
  const js = fslug(j);
  if (!done(path.join(OUT, `annex_${js}_hazards.txt`)) || !done(path.join(OUT, `annex_${js}_strategies.txt`))) tasks.push({ script: 'mny_scrape_one.js', j, label: `annex ${j}` });
  if (!NO_BLUE && !fs.existsSync(path.join(OUT, `blue_${js}.json`))) tasks.push({ script: 'mny_scrape_blue.js', j, label: `blue ${j}` });
}
console.log(`${tasks.length} tasks, concurrency ${CONC}`);

function run(t) {
  return new Promise((resolve) => {
    console.log(`START ${t.label}`);
    const p = spawn(process.execPath, [t.script, OUT, t.j], { stdio: 'ignore', env });
    p.on('exit', (code) => { console.log(`DONE  ${t.label} (exit ${code})`); resolve(); });
    p.on('error', (e) => { console.log(`ERR   ${t.label}: ${e.message}`); resolve(); });
  });
}

(async () => {
  let i = 0;
  async function worker() { while (i < tasks.length) { const t = tasks[i++]; await run(t); } }
  await Promise.all(Array.from({ length: Math.min(CONC, tasks.length) }, worker));
  console.log('ALL ANNEX TASKS DONE');
})();
