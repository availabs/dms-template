#!/usr/bin/env node
/**
 * Watch results.jsonl in real time. Useful when running `webhook.js` on a
 * remote box and you just want a one-liner of the latest matches locally.
 *
 *   node tail.js                  # tail ./results.jsonl
 *   LOG_PATH=/path/to.jsonl node tail.js
 */
const fs = require('fs');
const path = require('path');

const LOG_PATH = process.env.LOG_PATH || path.join(__dirname, 'results.jsonl');

let pos = 0;
try {
  pos = fs.statSync(LOG_PATH).size;
  console.log(`[tail] watching ${LOG_PATH} (starting at byte ${pos})`);
} catch {
  console.log(`[tail] ${LOG_PATH} does not exist yet — waiting`);
  fs.writeFileSync(LOG_PATH, '');
}

let buffer = '';
fs.watch(LOG_PATH, { persistent: true }, () => {
  let stat;
  try { stat = fs.statSync(LOG_PATH); } catch { return; }
  if (stat.size <= pos) { pos = stat.size; return; }
  const stream = fs.createReadStream(LOG_PATH, { start: pos, end: stat.size - 1 });
  stream.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    let nl;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      if (!line.trim()) continue;
      try {
        const ev = JSON.parse(line);
        if (ev.kind === 'matched') {
          console.log(`${ev.timestamp_utc}  ${ev.artist || '?'}  —  ${ev.title || '?'}${ev.album ? `  [${ev.album}]` : ''}`);
        } else {
          console.log(`${ev.timestamp_utc}  (no match)`);
        }
      } catch {
        console.log(`(unparseable) ${line}`);
      }
    }
  });
  stream.on('end', () => { pos = stat.size; });
});
