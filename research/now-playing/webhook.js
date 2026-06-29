#!/usr/bin/env node
/**
 * Research-stage webhook receiver for ACRCloud Custom Stream Monitoring.
 *
 * Listens for ACRCloud's "Result Callback" POSTs, normalizes the payload,
 * appends every event to results.jsonl (one JSON object per line), and
 * keeps the latest match in memory at GET /current.
 *
 * Run:
 *   cd research/now-playing && npm install && WEBHOOK_KEY=… node webhook.js
 *
 * Then in the ACRCloud console for your Custom Stream:
 *   Stream → Actions → Set Result Callback → URL = https://<your-host>/acrcloud
 *   (with ?api_key=<WEBHOOK_KEY> in the URL, or whatever shared-secret scheme
 *   the console exposes — see README.md "What I need from you" section).
 *
 * For local dev, expose this with `cloudflared tunnel --url http://localhost:4747`
 * (or ngrok / tailscale funnel) and paste the public URL into ACRCloud.
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const { normalize } = require('./normalize');

const PORT       = +(process.env.PORT || 4747);
const WEBHOOK_KEY = process.env.WEBHOOK_KEY || null;   // null = no shared-secret check
const LOG_PATH   = process.env.LOG_PATH   || path.join(__dirname, 'results.jsonl');
const RAW_LOG    = process.env.RAW_LOG    || path.join(__dirname, 'raw.jsonl');

let lastMatch = null;          // latest "matched" event (for /current)
let lastEvent = null;          // latest event of any kind (for /last)

const app = express();
app.use(express.json({ limit: '5mb' }));

function appendJsonl(filePath, obj) {
  fs.appendFileSync(filePath, JSON.stringify(obj) + '\n');
}

app.post('/acrcloud', (req, res) => {
  // Optional shared-secret check — supports either ?api_key= or X-API-Key header
  if (WEBHOOK_KEY) {
    const got = req.query.api_key || req.get('x-api-key');
    if (got !== WEBHOOK_KEY) {
      console.warn(`[acr] rejected: bad/missing api_key (got=${got ? 'present' : 'missing'})`);
      return res.status(401).json({ error: 'bad api_key' });
    }
  }

  // Always log the raw payload for diagnosing the actual schema ACRCloud
  // sends — their docs and reality occasionally diverge.
  appendJsonl(RAW_LOG, { received_at: new Date().toISOString(), body: req.body });

  const events = normalize(req.body || {});
  for (const ev of events) {
    appendJsonl(LOG_PATH, ev);
    lastEvent = ev;
    if (ev.kind === 'matched') {
      lastMatch = ev;
      const score = ev.score != null ? ` score=${ev.score}` : '';
      console.log(`[acr] ${ev.timestamp_utc}  ${ev.artist || '?'}  —  ${ev.title || '?'}${ev.album ? `  [${ev.album}]` : ''}${score}`);
    } else {
      console.log(`[acr] ${ev.timestamp_utc}  no-match (status=${ev.status_msg || 'n/a'})`);
    }
  }

  res.json({ ok: true, events: events.length });
});

app.get('/current', (req, res) => res.json(lastMatch || { kind: 'none' }));
app.get('/last',    (req, res) => res.json(lastEvent || { kind: 'none' }));

app.get('/health',  (req, res) => res.json({ ok: true, port: PORT, log: LOG_PATH }));

app.listen(PORT, () => {
  console.log(`[acr] webhook listening on :${PORT}`);
  console.log(`[acr] POST   /acrcloud   ← point ACRCloud here`);
  console.log(`[acr] GET    /current    ← latest matched track`);
  console.log(`[acr] GET    /last       ← latest event (match or no-match)`);
  console.log(`[acr] log:   ${LOG_PATH}`);
  console.log(`[acr] raw:   ${RAW_LOG}`);
  if (!WEBHOOK_KEY) console.log(`[acr] WARNING: WEBHOOK_KEY not set — accepting any caller`);
});
