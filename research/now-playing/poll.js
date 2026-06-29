#!/usr/bin/env node
/**
 * Polling fallback for ACRCloud Custom Stream Monitoring results.
 *
 * Calls GET /api/bm-cs-projects/<PID>/streams/<SID>/results?type=last on a
 * timer and writes any new detections to poll-results.jsonl (normalized) +
 * poll-raw.jsonl (untouched). Useful as a sanity check vs. the webhook path:
 * if results show up here but not in raw.jsonl, the webhook delivery is
 * broken, not the underlying stream monitoring.
 *
 * Run:
 *   ACR_BEARER=<token> ACR_PROJECT_ID=16608 ACR_STREAM_ID=<sid> node poll.js
 *
 * If ACR_STREAM_ID is unset, lists streams in the project and exits.
 *
 * Bearer token: console.acrcloud.com/account/access-keys
 */

const fs = require('fs');
const path = require('path');
const { normalize } = require('./normalize');

const PROJECT_ID = process.env.ACR_PROJECT_ID || '16608';
const STREAM_ID  = process.env.ACR_STREAM_ID  || null;
const BEARER     = process.env.ACR_BEARER     || null;
const INTERVAL_S = +(process.env.POLL_INTERVAL_S || 60);
const RAW_LOG    = path.join(__dirname, 'poll-raw.jsonl');
const RES_LOG    = path.join(__dirname, 'poll-results.jsonl');
const STATE_PATH = path.join(__dirname, 'poll-state.json');

if (!BEARER) {
  console.error('[poll] ACR_BEARER env var required (get from https://console.acrcloud.com/account/access-keys)');
  process.exit(1);
}

const API  = 'https://api-v2.acrcloud.com/api';
const HDRS = { Authorization: `Bearer ${BEARER}`, Accept: 'application/json' };

let seen = new Set();
try {
  seen = new Set(JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')).seen || []);
} catch {}

function persistSeen() {
  // Cap to last ~2k keys so the file doesn't grow without bound
  const arr = [...seen].slice(-2000);
  fs.writeFileSync(STATE_PATH, JSON.stringify({ seen: arr }));
  seen = new Set(arr);
}

function appendJsonl(filePath, obj) {
  fs.appendFileSync(filePath, JSON.stringify(obj) + '\n');
}

async function apiGet(url) {
  const r = await fetch(url, { headers: HDRS });
  const text = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} — ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { return text; }
}

async function listStreams() {
  return apiGet(`${API}/bm-cs-projects/${PROJECT_ID}/streams`);
}

async function fetchResults(streamId) {
  return apiGet(`${API}/bm-cs-projects/${PROJECT_ID}/streams/${streamId}/results?type=last`);
}

async function tick(streamId) {
  let body;
  try {
    body = await fetchResults(streamId);
  } catch (e) {
    console.error(`[poll] fetch failed: ${e.message}`);
    return;
  }
  appendJsonl(RAW_LOG, { received_at: new Date().toISOString(), body });

  const items = Array.isArray(body?.data) ? body.data : [];
  const events = normalize({ results: items });
  let newCount = 0;
  for (const ev of events) {
    const key = `${ev.acrid || 'no-match'}|${ev.timestamp_utc}`;
    if (seen.has(key)) continue;
    seen.add(key);
    newCount++;
    appendJsonl(RES_LOG, ev);
    if (ev.kind === 'matched') {
      console.log(`[poll] ${ev.timestamp_utc}  ${ev.artist || '?'} — ${ev.title || '?'}${ev.album ? `  [${ev.album}]` : ''}`);
    } else {
      console.log(`[poll] ${ev.timestamp_utc}  no-match`);
    }
  }
  if (newCount > 0) persistSeen();
  console.log(`[poll] tick: ${items.length} item(s), ${newCount} new`);
}

(async () => {
  if (!STREAM_ID) {
    console.log(`[poll] ACR_STREAM_ID not set — listing streams in project ${PROJECT_ID}…`);
    try {
      const streams = await listStreams();
      console.log(JSON.stringify(streams, null, 2));
      console.log(`\n[poll] Re-run with: ACR_STREAM_ID=<id from above> ACR_BEARER=… node poll.js`);
    } catch (e) {
      console.error(`[poll] list streams failed: ${e.message}`);
      process.exit(1);
    }
    process.exit(0);
  }

  console.log(`[poll] polling project=${PROJECT_ID} stream=${STREAM_ID} every ${INTERVAL_S}s`);
  console.log(`[poll] log: ${RES_LOG}`);
  console.log(`[poll] raw: ${RAW_LOG}`);

  await tick(STREAM_ID);
  setInterval(() => tick(STREAM_ID), INTERVAL_S * 1000);
})();
