/**
 * Album-cover enrichment.
 *
 * ACRCloud's APIs (both webhook + Console results) don't return album
 * cover URLs in `metadata.music[].album` — only the album name. We fill
 * the gap by looking up tracks on free public catalog APIs:
 *
 *   1. iTunes Search API — `https://itunes.apple.com/search?term=…&entity=song`
 *      Unauthenticated, returns `artworkUrl100` we up-rez to 600x600.
 *      Coverage is excellent for mainstream releases and reasonable for
 *      indie. ISRC isn't a supported lookup parameter (despite plausible
 *      assumptions to the contrary) — `?isrc=` returns nothing — so we
 *      search by `term="<title> <artist>"` and pick the top hit.
 *
 *   2. MusicBrainz + Cover Art Archive — fallback for releases iTunes
 *      misses. Looks up the recording by ISRC, then asks
 *      `https://coverartarchive.org/release/<mbid>/front-500.jpg`.
 *      Slower and less reliable but covers a long tail iTunes doesn't.
 *
 * Cache is keyed by `${title}|${artist}|${isrc}` so repeated plays of
 * the same track don't hit the network. Module-level, bounded so a
 * long-running webhook receiver can't grow it without bound.
 *
 * Usage: call `enrichEvent(event)` on a normalized event AFTER
 * `normalize.js` has run and BEFORE INSERT. The function mutates and
 * returns the event; if `album_cover` is already set, it's a no-op.
 */

'use strict';

const ITUNES_SEARCH = 'https://itunes.apple.com/search';
const MUSICBRAINZ_RECORDING = 'https://musicbrainz.org/ws/2/recording';
const COVER_ART_ARCHIVE = 'https://coverartarchive.org/release';
const USER_AGENT = 'now_playing/1.0 (https://github.com/availabs/dms-template)';
const FETCH_TIMEOUT_MS = 4000;
const MAX_CACHE_ENTRIES = 10000;

// cacheKey -> url | null (null = looked up, no result)
const COVER_CACHE = new Map();

function rememberCover(key, value) {
  if (COVER_CACHE.size >= MAX_CACHE_ENTRIES) {
    // Evict the oldest insertion (Map preserves insertion order).
    const firstKey = COVER_CACHE.keys().next().value;
    COVER_CACHE.delete(firstKey);
  }
  COVER_CACHE.set(key, value);
}

function cacheKeyFor(event) {
  return `${event.title || ''}|${event.artist_name || ''}|${event.isrc || ''}`;
}

/**
 * iTunes returns `artworkUrl100` shaped like
 *   https://is1-ssl.mzstatic.com/.../source/100x100bb.jpg
 * Replace the size segment to get a higher-res variant. 600 is a good
 * balance between quality and bandwidth; consumers can string-replace
 * again if they want a different size.
 */
function upresArtworkUrl(url) {
  if (typeof url !== 'string') return null;
  return url.replace(/\/\d+x\d+bb\./, '/600x600bb.');
}

async function fetchWithTimeout(url, timeoutMs, headers = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT, ...headers },
      // For coverartarchive.org redirect handling
      redirect: 'follow',
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Try iTunes Search by title + artist. Returns a 600x600 URL or null.
 * Picks the top hit; we trust ACR's match score implicitly.
 */
async function lookupItunesByTitleArtist(title, artist) {
  if (!title) return null;
  const term = artist ? `${title} ${artist}` : title;
  const url = `${ITUNES_SEARCH}?term=${encodeURIComponent(term)}&entity=song&limit=1&country=US`;
  try {
    const res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
    if (!res.ok) return null;
    const body = await res.json();
    const hit = Array.isArray(body?.results) ? body.results[0] : null;
    return upresArtworkUrl(hit?.artworkUrl100);
  } catch (err) {
    if (process.env.NOW_PLAYING_DEBUG) {
      console.warn(`[now_playing/cover] iTunes lookup failed for "${term}":`, err.message);
    }
    return null;
  }
}

/**
 * Try MusicBrainz: ISRC -> recording -> release -> cover art archive.
 * Slower (two HTTP calls) and only worth it when iTunes misses, so callers
 * use this as a fallback.
 */
async function lookupMusicBrainzByIsrc(isrc) {
  if (!isrc) return null;
  try {
    const recUrl = `${MUSICBRAINZ_RECORDING}?query=isrc:${encodeURIComponent(isrc)}&fmt=json&limit=1`;
    const recRes = await fetchWithTimeout(recUrl, FETCH_TIMEOUT_MS);
    if (!recRes.ok) return null;
    const recBody = await recRes.json();
    const releaseId = recBody?.recordings?.[0]?.releases?.[0]?.id;
    if (!releaseId) return null;

    // coverartarchive.org responds 200 with image bytes (not JSON) when
    // a cover exists, 404 otherwise. Use HEAD so we don't pull binary.
    const coverUrl = `${COVER_ART_ARCHIVE}/${releaseId}/front-500.jpg`;
    const coverRes = await fetchWithTimeout(coverUrl, FETCH_TIMEOUT_MS, {});
    if (!coverRes.ok) return null;
    return coverUrl;
  } catch (err) {
    if (process.env.NOW_PLAYING_DEBUG) {
      console.warn(`[now_playing/cover] MusicBrainz fallback failed for ${isrc}:`, err.message);
    }
    return null;
  }
}

/**
 * Look up a high-res cover URL for a normalized event. Returns the URL
 * or null. Never throws.
 */
async function lookupCover(event) {
  const key = cacheKeyFor(event);
  if (COVER_CACHE.has(key)) return COVER_CACHE.get(key);

  let cover = await lookupItunesByTitleArtist(event.title, event.artist_name);
  if (!cover) cover = await lookupMusicBrainzByIsrc(event.isrc);

  rememberCover(key, cover);
  return cover;
}

/**
 * Enrich a single normalized event in place. Mutates and returns.
 * No-op if `album_cover` is already set or there's nothing to look up.
 */
async function enrichEvent(event) {
  if (!event || event.album_cover) return event;
  if (!event.title && !event.isrc) return event;
  const cover = await lookupCover(event);
  if (cover) event.album_cover = cover;
  return event;
}

/**
 * Enrich an array of events with bounded concurrency so a long backfill
 * page doesn't open 200 sockets to iTunes at once.
 */
async function enrichEvents(events, { concurrency = 8 } = {}) {
  if (!Array.isArray(events) || events.length === 0) return events;
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, events.length) }, async () => {
    while (i < events.length) {
      const idx = i++;
      await enrichEvent(events[idx]);
    }
  });
  await Promise.all(workers);
  return events;
}

module.exports = {
  enrichEvent,
  enrichEvents,
  lookupCover,
  lookupItunesByTitleArtist,
  lookupMusicBrainzByIsrc,
  // Exposed for tests / cache flush
  _COVER_CACHE: COVER_CACHE,
};
