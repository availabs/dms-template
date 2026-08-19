// Orchestrate per-jurisdiction annex + blue-box scrapes with a concurrency cap and resume.
// Each task is a fresh-browser child process (memory isolation — the reliable path at scale).
// Usage: node ham_run_annexes.js <outDir> [concurrency]
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const CFG = require('./ham_config');
const OUT = process.argv[2] || 'hamilton/data';
const CONC = parseInt(process.argv[3] || '3', 10);
const fslug = (s) => s.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
fs.mkdirSync(OUT, { recursive: true });

// build the task list, skipping already-done outputs (resume)
const tasks = [];
for (const j of CFG.JURIS) {
  const js = fslug(j);
  if (!fs.existsSync(path.join(OUT, `annex_${js}_strategies.txt`))) tasks.push({ script: 'ham_scrape_one.js', j, label: `annex ${j}` });
  if (!fs.existsSync(path.join(OUT, `blue_${js}.json`))) tasks.push({ script: 'ham_scrape_blue.js', j, label: `blue ${j}` });
}
console.log(`${tasks.length} tasks, concurrency ${CONC}`);

function run(t) {
  return new Promise((resolve) => {
    console.log(`START ${t.label}`);
    const p = spawn(process.execPath, [t.script, OUT, t.j], { stdio: 'ignore' });
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
