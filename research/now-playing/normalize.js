/**
 * Shared normalizer for ACRCloud payloads.
 *
 * Handles both shapes we see in the wild:
 *   - Custom Stream Monitoring webhook envelope:
 *       { stream_id, stream_url, data: { status, result_type, metadata: {...} }, status }
 *   - Identification API / Console results endpoint inner shape:
 *       { status, result_type, metadata: { music: [...] } }
 *   - Older `results: [...]` batched shape used by some plans.
 */

function normalizeOne(c) {
  const inner = c?.data ?? c;
  const md = inner?.metadata;
  const m  = md?.music?.[0];
  if (!m) {
    return {
      kind: 'no-match',
      timestamp_utc: md?.timestamp_utc || inner?.timestamp_utc || new Date().toISOString(),
      played_duration: md?.played_duration ?? null,
      status_code: inner?.status?.code ?? null,
      status_msg: inner?.status?.msg ?? null,
      stream_id: c?.stream_id ?? null,
      raw: c,
    };
  }
  return {
    kind: 'matched',
    timestamp_utc: md.timestamp_utc || new Date().toISOString(),
    played_duration: md.played_duration ?? null,
    title: m.title || null,
    artist: (m.artists || []).map((a) => a.name).filter(Boolean).join(', ') || null,
    album: m.album?.name || null,
    album_cover: m.album?.cover || null,
    acrid: m.acrid || null,
    score: m.score ?? null,
    isrc: m.external_ids?.isrc || null,
    upc:  m.external_ids?.upc  || null,
    spotify_track_id: m.external_metadata?.spotify?.track?.id || null,
    youtube_vid:      m.external_metadata?.youtube?.vid       || null,
    deezer_track_id:  m.external_metadata?.deezer?.track?.id  || null,
    genres: (m.genres || []).map((g) => g.name).filter(Boolean),
    label:  m.label || null,
    release_date: m.release_date || null,
    stream_id: c?.stream_id ?? null,
    raw: c,
  };
}

function normalize(body) {
  const candidates = Array.isArray(body?.results)
    ? body.results
    : [body];
  return candidates.map(normalizeOne);
}

module.exports = { normalize, normalizeOne };
