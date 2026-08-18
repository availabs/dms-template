/**
 * now_playing backfill worker.
 *
 * Pages through ACRCloud's Custom Broadcast Monitoring v2 results-by-date
 * endpoint and inserts each detection into the per-stream view table that
 * the webhook also writes to. The bearer token is passed in via
 * task.descriptor (single-use); we never persist it.
 *
 * Endpoint:
 *   GET https://api-v2.acrcloud.com/api/bm-cs-projects/{project_id}/streams/{stream_id}/results
 *   Headers: Authorization: Bearer <token>, Accept: application/json
 *   Query:   date_from=YYYY-MM-DD, date_to=YYYY-MM-DD (omit for all-time),
 *            page=N, per_page=200
 *
 * Response shape varies by plan; we tolerate any of:
 *   { data: [...], meta: { total, current_page, last_page } }
 *   { results: [...], total, page }
 *   bare array of detections.
 *
 * Each detection is run through `./normalize.js` (the same parser the
 * webhook uses) and inserted via the same INSERT path. The `acrid`-based
 * partial unique index on the per-stream table makes re-runs over an
 * overlapping window safe (`ON CONFLICT DO NOTHING`).
 */

'use strict';

const { normalize } = require('./normalize');
const { enrichEvents } = require('./cover-enrichment');
const {
  buildBackfillInsertSQL,
  eventToInsertParams,
} = require('./schema');

const ACR_BASE = process.env.ACR_API_BASE || 'https://api-v2.acrcloud.com';
const PER_PAGE = 200;
const MAX_PAGES = 1000; // hard ceiling so a misbehaving API can't loop forever
const SRC_TYPE = 'now_playing';

// ACR's `bm-cs-projects/{id}/streams/{sid}/results` endpoint silently filters
// to "today only" when you omit `date_from`/`date_to`, despite the schema
// marking both as optional. So when the user leaves the form blank meaning
// "all time", we expand to a deliberately-wide range here. ACR retains
// detection history up to whatever the customer's plan caps at (typically
// 30-90 days), and clamps the response to that retention; passing a date
// older than retention doesn't error, it just gets ignored.
const ALL_TIME_DATE_FROM = '2010-01-01';

async function loadLatestView(db, sourceId) {
  const table = db.type === 'postgres' ? 'data_manager.views' : 'views';
  const { rows } = await db.query(
    `SELECT view_id, source_id, table_schema, table_name, data_table
     FROM ${table} WHERE source_id = $1 ORDER BY view_id DESC LIMIT 1`,
    [sourceId]
  );
  return rows[0] || null;
}

async function loadSourceStats(db, sourceId) {
  const table = db.type === 'postgres' ? 'data_manager.sources' : 'sources';
  const { rows } = await db.query(
    `SELECT statistics FROM ${table} WHERE source_id = $1`,
    [sourceId]
  );
  if (!rows[0]) return null;
  const raw = rows[0].statistics;
  if (raw == null) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

async function writeBackfillStatus(db, sourceId, patch) {
  const stats = (await loadSourceStats(db, sourceId)) || {};
  const next = { ...stats, backfill: { ...(stats.backfill || {}), ...patch } };
  const table = db.type === 'postgres' ? 'data_manager.sources' : 'sources';
  await db.query(
    `UPDATE ${table} SET statistics = $1 WHERE source_id = $2`,
    [JSON.stringify(next), sourceId]
  );
}

function extractPage(body) {
  if (Array.isArray(body)) return { items: body, total: body.length, isLast: true };
  if (Array.isArray(body?.data)) {
    const meta = body.meta || {};
    const total = meta.total ?? body.total ?? null;
    const isLast =
      (meta.current_page != null && meta.last_page != null && meta.current_page >= meta.last_page) ||
      body.data.length < PER_PAGE;
    return { items: body.data, total, isLast };
  }
  if (Array.isArray(body?.results)) {
    return { items: body.results, total: body.total ?? null, isLast: body.results.length < PER_PAGE };
  }
  return { items: [], total: 0, isLast: true };
}

/**
 * ACR's bm-cs results endpoint takes ONE day at a time, as `date=YYYYMMDD`.
 *
 * This was established empirically on 2026-08-14 against project 16608, and the
 * formats matter more than you would expect:
 *
 *   date=20260730              -> 200, 337 rows, all of 2026-07-30   ✓
 *   date=2026-07-30            -> 500 Server Error
 *   date=2026/07/30            -> 500 Server Error
 *   date=2026-07-30 00:00:00   -> 500 Server Error
 *   date_from=…&date_to=…      -> 200 but SILENTLY IGNORED: returns today
 *   day=…, timestamp_from=…    -> ignored, returns today
 *   per_page / page            -> ignored; the whole day comes back at once
 *
 * The dangerous one is `date_from`/`date_to`: it looks like it works (HTTP 200,
 * plausible rows) while quietly returning the current day, so a range backfill
 * appears to succeed and recovers nothing. That is why this builds a per-day URL
 * and the caller loops over days.
 */
function buildAcrUrl({ projectId, streamId, date, page }) {
  const u = new URL(`${ACR_BASE}/api/bm-cs-projects/${projectId}/streams/${streamId}/results`);
  if (date) u.searchParams.set('date', date.replace(/-/g, ''));
  if (page && page > 1) u.searchParams.set('page', String(page));
  return u.toString();
}

/** Inclusive list of YYYY-MM-DD strings from `from` to `to`. */
function eachDay(from, to) {
  const out = [];
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

async function fetchAcrPage(url, bearerToken) {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`ACR ${res.status}: ${text.slice(0, 500)}`);
  }
  return res.json();
}

/**
 * The ACR per-stream results envelope often does NOT include the
 * stream_id / stream_url at the top level the way the webhook does.
 * Inject them so `normalize.js` can fill those columns from the source's
 * stored config.
 */
function asWebhookShape(detection, streamId) {
  if (detection?.stream_id) return detection;
  return { stream_id: streamId, ...detection };
}

module.exports = async function backfillWorker(ctx) {
  const { task, db, dispatchEvent, updateProgress } = ctx;
  const {
    source_id,
    acr_project_id,
    acr_stream_id,
    acr_bearer_token,
    date_from: rawDateFrom,
    date_to: rawDateTo,
  } = task.descriptor || {};

  if (!source_id) throw new Error('source_id is required');
  if (!acr_project_id) throw new Error('acr_project_id is required');
  if (!acr_stream_id) throw new Error('acr_stream_id is required');
  if (!acr_bearer_token) throw new Error('acr_bearer_token is required');

  // Expand "blank" (null/undefined/'') into an explicit wide window. ACR's
  // results endpoint silently defaults to "today only" if no date filter
  // is given, which is the opposite of what "leave blank for all-time"
  // promises in the create form. Pass a far-back `date_from` and today
  // (UTC) as `date_to` so ACR returns its full retained history.
  const todayUtc = new Date().toISOString().slice(0, 10);
  const date_from = rawDateFrom || ALL_TIME_DATE_FROM;
  const date_to = rawDateTo || todayUtc;

  const startedAt = new Date().toISOString();
  await dispatchEvent(`${SRC_TYPE}:BACKFILL_INIT`, 'starting backfill', {
    date_from,
    date_to,
    raw_date_from: rawDateFrom || null,
    raw_date_to: rawDateTo || null,
  });
  await updateProgress(0.01);
  await writeBackfillStatus(db, source_id, {
    started_at: startedAt,
    finished_at: null,
    rows_inserted: 0,
    last_error: null,
    range: { from: date_from, to: date_to },
  });

  const view = await loadLatestView(db, source_id);
  if (!view?.data_table) throw new Error('stream has no view configured');

  const insertSql = buildBackfillInsertSQL(view.data_table);

  let totalInserted = 0;
  let pagesFetched = 0;
  let knownTotal = null;
  let lastFingerprint = null;

  // One request per day. The endpoint has no working range filter, so the range
  // is walked here rather than handed to ACR.
  const days = eachDay(date_from, date_to);
  await dispatchEvent(`${SRC_TYPE}:BACKFILL_RANGE`, `${days.length} day(s) to fetch`, {
    days: days.length, from: date_from, to: date_to,
  });

  for (const [dayIdx, day] of days.entries()) {
    const page = dayIdx + 1;
    const url = buildAcrUrl({
      projectId: acr_project_id,
      streamId: acr_stream_id,
      date: day,
    });

    let body;
    try {
      body = await fetchAcrPage(url, acr_bearer_token);
    } catch (fetchErr) {
      await writeBackfillStatus(db, source_id, { last_error: fetchErr.message });
      await dispatchEvent(`${SRC_TYPE}:BACKFILL_ERROR`, `${day}: ${fetchErr.message}`, { day });
      throw fetchErr;
    }

    const { items, total } = extractPage(body);  // isLast is meaningless here: no pagination
    if (knownTotal == null && total != null) knownTotal = total;
    pagesFetched++;

    // Guard: if a day comes back byte-identical to the previous day, the `date`
    // filter has stopped being honoured and we are re-reading one day forever.
    // That is not hypothetical — `date_from`/`date_to` behave exactly this way
    // on this endpoint (HTTP 200, plausible rows, silently the current day), so
    // a future ACR change to `date` would land us straight back here.
    const fingerprint = `${items.length}:${items[0]?.metadata?.timestamp_utc ?? ''}:` +
      `${items[items.length - 1]?.metadata?.timestamp_utc ?? ''}`;
    if (items.length && fingerprint === lastFingerprint) {
      await dispatchEvent(`${SRC_TYPE}:BACKFILL_ERROR`,
        `${day} returned the same payload as the previous day — ACR is ignoring the date filter, stopping`,
        { day, page_size: items.length });
      break;
    }
    lastFingerprint = fingerprint;

    // Sanity-check that ACR gave us the day we asked for; a mismatch means the
    // filter silently changed behaviour again.
    const gotDay = items[0]?.metadata?.timestamp_utc?.slice(0, 10);
    if (gotDay && gotDay !== day) {
      await dispatchEvent(`${SRC_TYPE}:BACKFILL_ERROR`,
        `asked ACR for ${day} but got ${gotDay} — date filter not honoured, stopping`, { day, gotDay });
      break;
    }

    // Normalize the whole page first, then enrich covers from iTunes in
    // bounded parallel before INSERT. Best-effort — enrichment failures
    // never abort the backfill; they just leave album_cover null.
    const allEvents = [];
    for (const detection of items) {
      const events = normalize(asWebhookShape(detection, acr_stream_id));
      for (const ev of events) allEvents.push(ev);
    }
    await enrichEvents(allEvents, { concurrency: 8 });

    let pageInserted = 0;
    for (const ev of allEvents) {
      try {
        const result = await db.query(insertSql, eventToInsertParams(ev));
        if (result.rows && result.rows.length > 0) pageInserted++;
      } catch (insErr) {
        console.error(`[now_playing/backfill] insert failed for source=${source_id}:`, insErr.message);
      }
    }
    totalInserted += pageInserted;

    await dispatchEvent(`${SRC_TYPE}:BACKFILL_PAGE`,
      `${day}: ${items.length} from ACR, +${pageInserted} new`, {
        day,
        page,
        page_size: items.length,
        page_inserted: pageInserted,
        total_inserted: totalInserted,
      });

    // Progress is days-completed; the old row-ratio needed a `total` this API
    // never returns, so it always fell through to the 0.05-per-page fallback.
    await updateProgress(Math.min(0.99, (dayIdx + 1) / days.length));

    await writeBackfillStatus(db, source_id, {
      rows_inserted: totalInserted,
      last_page: page,
      known_total: knownTotal,
    });

    // No per-day pagination: this endpoint returns the whole day at once
    // (337 rows observed for a single day, well above the old PER_PAGE of 200).
    // An empty day is normal — the station may simply not have aired — so keep
    // going rather than treating it as the end of the range.
  }

  const finishedAt = new Date().toISOString();
  await writeBackfillStatus(db, source_id, {
    finished_at: finishedAt,
    rows_inserted: totalInserted,
    last_error: null,
  });
  await updateProgress(1);
  await dispatchEvent(`${SRC_TYPE}:BACKFILL_FIN`,
    `inserted ${totalInserted} rows over ${pagesFetched} day(s)`, {
      rows_inserted: totalInserted,
      days_fetched: pagesFetched,
    });

  return { rows_inserted: totalInserted, days_fetched: pagesFetched };
};
