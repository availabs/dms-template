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

function buildAcrUrl({ projectId, streamId, dateFrom, dateTo, page }) {
  const u = new URL(`${ACR_BASE}/api/bm-cs-projects/${projectId}/streams/${streamId}/results`);
  if (dateFrom) u.searchParams.set('date_from', dateFrom);
  if (dateTo) u.searchParams.set('date_to', dateTo);
  u.searchParams.set('page', String(page));
  u.searchParams.set('per_page', String(PER_PAGE));
  return u.toString();
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

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = buildAcrUrl({
      projectId: acr_project_id,
      streamId: acr_stream_id,
      dateFrom: date_from,
      dateTo: date_to,
      page,
    });

    let body;
    try {
      body = await fetchAcrPage(url, acr_bearer_token);
    } catch (fetchErr) {
      await writeBackfillStatus(db, source_id, { last_error: fetchErr.message });
      await dispatchEvent(`${SRC_TYPE}:BACKFILL_ERROR`, fetchErr.message, { page });
      throw fetchErr;
    }

    const { items, total, isLast } = extractPage(body);
    if (knownTotal == null && total != null) knownTotal = total;
    pagesFetched++;

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

    await dispatchEvent(`${SRC_TYPE}:BACKFILL_PAGE`, `page ${page}: +${pageInserted}`, {
      page,
      page_size: items.length,
      page_inserted: pageInserted,
      total_inserted: totalInserted,
      known_total: knownTotal,
    });

    if (knownTotal && knownTotal > 0) {
      await updateProgress(Math.min(0.99, totalInserted / knownTotal));
    } else {
      await updateProgress(Math.min(0.99, 0.01 + pagesFetched * 0.05));
    }

    await writeBackfillStatus(db, source_id, {
      rows_inserted: totalInserted,
      last_page: page,
      known_total: knownTotal,
    });

    if (isLast || items.length === 0) break;
  }

  const finishedAt = new Date().toISOString();
  await writeBackfillStatus(db, source_id, {
    finished_at: finishedAt,
    rows_inserted: totalInserted,
    last_error: null,
  });
  await updateProgress(1);
  await dispatchEvent(`${SRC_TYPE}:BACKFILL_FIN`, `inserted ${totalInserted} rows`, {
    rows_inserted: totalInserted,
    pages_fetched: pagesFetched,
  });

  return { rows_inserted: totalInserted, pages_fetched: pagesFetched };
};
