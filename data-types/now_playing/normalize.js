/**
 * ACRCloud payload normalizer. Verbatim shape proven during the research
 * phase (`research/now-playing/normalize.js`), expanded here to extract
 * everything ACR includes per detection so the dataset table can answer
 * a wider range of queries without digging into JSONB at read time.
 *
 * Three input shapes are accepted:
 *
 *   1. Custom Stream Monitoring webhook envelope:
 *        { stream_id, stream_url, data: { status, result_type, metadata: {...} }, status }
 *   2. Identification API / Console results endpoint inner shape:
 *        { status, result_type, metadata: { music: [...] } }
 *   3. Older `results: [...]` batched shape used by some plans.
 *
 * Output is a flat object whose keys map 1-to-1 to columns in
 * `schema.js#QUERY_COLUMNS`. Anything we don't lift to a column still lives
 * in `raw` (the unmodified original event).
 */

function joinNames(arr) {
  if (!Array.isArray(arr)) return null;
  const names = arr.map((x) => x?.name).filter(Boolean);
  return names.length ? names.join(', ') : null;
}

function pluckIds(arr, key = 'id') {
  if (!Array.isArray(arr)) return null;
  const ids = arr.map((x) => x?.[key]).filter(Boolean);
  return ids.length ? ids : null;
}

function normalizeOne(c) {
  const inner = c?.data ?? c;
  const md = inner?.metadata;
  const status = inner?.status || {};
  const m = md?.music?.[0];

  const base = {
    timestamp_utc: md?.timestamp_utc || inner?.timestamp_utc || null,
    played_duration: md?.played_duration ?? null,
    result_type: inner?.result_type ?? null,
    metadata_type: md?.type ?? null,

    status_code: status.code ?? null,
    status_msg: status.msg ?? null,
    status_version: status.version ?? null,

    stream_id: c?.stream_id ?? null,
    stream_url: c?.stream_url ?? null,
    raw: c,
  };

  if (!m) {
    return {
      ...base,
      kind: 'no-match',
      title: null,
      artist_name: null,
      album: null,
      album_cover: null,
      release_date: null,
      label: null,
      language: null,
      acrid: null,
      isrc: null,
      upc: null,
      spotify_track_id: null,
      spotify_album_id: null,
      spotify_artist_ids: null,
      youtube_vid: null,
      deezer_track_id: null,
      deezer_album_id: null,
      deezer_artist_ids: null,
      musicbrainz_track_id: null,
      genre_names: null,
      score: null,
      result_from: null,
      duration_ms: null,
      play_offset_ms: null,
      sample_begin_time_offset_ms: null,
      sample_end_time_offset_ms: null,
      db_begin_time_offset_ms: null,
      db_end_time_offset_ms: null,
      artists: null,
      genres: null,
      external_ids: null,
      external_metadata: null,
      contributors: null,
      mood: null,
      lyrics: null,
    };
  }

  const ext = m.external_metadata || {};
  const mb = Array.isArray(ext.musicbrainz) ? ext.musicbrainz[0] : ext.musicbrainz;

  return {
    ...base,
    kind: 'matched',

    title: m.title || null,
    artist_name: joinNames(m.artists),
    album: m.album?.name || null,
    album_cover: m.album?.cover || null,
    release_date: m.release_date || null,
    label: m.label || null,
    language: m.language || null,

    acrid: m.acrid || null,
    isrc: m.external_ids?.isrc || null,
    upc:  m.external_ids?.upc  || null,
    spotify_track_id:  ext.spotify?.track?.id  || null,
    spotify_album_id:  ext.spotify?.album?.id  || null,
    spotify_artist_ids: pluckIds(ext.spotify?.artists),
    youtube_vid:       ext.youtube?.vid        || null,
    deezer_track_id:   ext.deezer?.track?.id   || null,
    deezer_album_id:   ext.deezer?.album?.id   || null,
    deezer_artist_ids: pluckIds(ext.deezer?.artists),
    musicbrainz_track_id: mb?.track?.id || mb?.id || null,
    genre_names: joinNames(m.genres),

    score: m.score ?? null,
    result_from: m.result_from ?? null,
    duration_ms: m.duration_ms ?? null,
    play_offset_ms: m.play_offset_ms ?? null,
    sample_begin_time_offset_ms: m.sample_begin_time_offset_ms ?? null,
    sample_end_time_offset_ms: m.sample_end_time_offset_ms ?? null,
    db_begin_time_offset_ms: m.db_begin_time_offset_ms ?? null,
    db_end_time_offset_ms: m.db_end_time_offset_ms ?? null,

    artists:           m.artists           || null,
    genres:            m.genres            || null,
    external_ids:      m.external_ids      || null,
    external_metadata: ext                  || null,
    contributors:      m.contributors      || null,
    mood:              m.mood              || null,
    lyrics:            m.lyrics            || null,
  };
}

function normalize(body) {
  const candidates = Array.isArray(body?.results) ? body.results : [body];
  return candidates.map(normalizeOne);
}

module.exports = { normalize, normalizeOne };
