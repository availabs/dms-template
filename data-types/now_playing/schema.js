/**
 * Per-stream detection table schema for the now_playing dataType.
 *
 * Each stream gets one DAMA view backed by its own table at
 * `gis_datasets.s{source_id}_v{view_id}`. The Card page-section reads
 * from this table via the UDA Falcor routes (uda.sources[…].data…).
 *
 * Design intent: preserve as much ACRCloud signal as possible at column
 * level so downstream (Card filters/sorts, ad-hoc SQL, future analytics)
 * doesn't have to dig into JSONB. Top-level scalar fields each get their
 * own column. Nested objects/arrays land in JSONB columns. The full
 * untouched payload is also kept in `raw` so the schema can be widened
 * later without re-ingesting.
 *
 * Array handling: ACR returns `artists` and `genres` as arrays of objects.
 * We store both the structured form (JSONB) AND a joined-text helper
 * column (`artist_name`, `genre_names`) so the Card can render them as
 * plain text without a custom formatter.
 *
 * Columns are postgres-only for v1 (DAMA's primary backend). SQLite-backed
 * dama envs hit a 501 at the route layer.
 */

const QUERY_COLUMNS = [
  // platform fields
  'id', 'received_at',

  // top-level event shape
  'kind',                      // 'matched' | 'no-match'
  'timestamp_utc',             // ACR's own detection timestamp
  'played_duration',           // seconds the stream had been playing the track when sampled
  'result_type',               // 0 = match, 1 = no match (per ACR)
  'metadata_type',             // e.g. 'delay'

  // status (per-detection)
  'status_code',
  'status_msg',
  'status_version',

  // primary track display fields
  'title',
  'artist_name',               // joined string for easy rendering
  'album',
  'album_cover',
  'release_date',
  'label',
  'language',                  // sometimes present in ACR external_metadata

  // identifiers
  'acrid',
  'isrc',
  'upc',
  'spotify_track_id',
  'spotify_album_id',
  'spotify_artist_ids',        // JSONB array of strings
  'youtube_vid',
  'deezer_track_id',
  'deezer_album_id',
  'deezer_artist_ids',         // JSONB array of strings
  'musicbrainz_track_id',
  'genre_names',               // joined string

  // numeric / timing
  'score',
  'result_from',
  'duration_ms',
  'play_offset_ms',
  'sample_begin_time_offset_ms',
  'sample_end_time_offset_ms',
  'db_begin_time_offset_ms',
  'db_end_time_offset_ms',

  // structured (JSONB)
  'artists',                   // full artist objects from ACR
  'genres',                    // array (objects or strings, depending on ACR)
  'external_ids',              // full blob (isrc/upc + anything else)
  'external_metadata',         // full spotify/deezer/youtube/musicbrainz blob
  'contributors',              // when present
  'mood',                      // when present
  'lyrics',                    // when present

  // envelope (Custom Stream Monitoring)
  'stream_id',
  'stream_url',

  // catchall — the full untouched ACRCloud payload
  'raw',
];

const JSONB_COLUMNS = new Set([
  'spotify_artist_ids', 'deezer_artist_ids',
  'artists', 'genres', 'external_ids', 'external_metadata',
  'contributors', 'mood', 'lyrics', 'raw',
]);

function colDef(name) {
  if (name === 'id') return 'id SERIAL PRIMARY KEY';
  if (name === 'received_at') return 'received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()';
  if (name === 'kind') return 'kind TEXT NOT NULL';
  if (name === 'timestamp_utc') return 'timestamp_utc TIMESTAMPTZ';
  if (JSONB_COLUMNS.has(name)) return `${name} JSONB`;
  if ([
    'result_type', 'status_code', 'score', 'result_from',
    'duration_ms', 'play_offset_ms', 'played_duration',
    'sample_begin_time_offset_ms', 'sample_end_time_offset_ms',
    'db_begin_time_offset_ms', 'db_end_time_offset_ms',
  ].includes(name)) return `${name} INTEGER`;
  return `${name} TEXT`;
}

function buildCreateTableSQL(fullyQualifiedName) {
  const cols = QUERY_COLUMNS.map(colDef).join(',\n    ');
  return `CREATE TABLE IF NOT EXISTS ${fullyQualifiedName} (\n    ${cols}\n  )`;
}

const INSERT_COLUMNS = QUERY_COLUMNS.filter((c) => c !== 'id' && c !== 'received_at');

function buildInsertSQL(fullyQualifiedName) {
  const placeholders = INSERT_COLUMNS.map((_, i) => `$${i + 1}`).join(', ');
  return `INSERT INTO ${fullyQualifiedName} (${INSERT_COLUMNS.join(', ')})
          VALUES (${placeholders})
          RETURNING id, received_at`;
}

/** Stringify if it's an object/array, leave primitives/null alone. */
function jsonOrNull(v) {
  if (v == null) return null;
  return JSON.stringify(v);
}

function eventToInsertParams(ev) {
  return INSERT_COLUMNS.map((col) => {
    const v = ev[col];
    if (v === undefined) return null;
    if (JSONB_COLUMNS.has(col)) return jsonOrNull(v);
    return v;
  });
}

module.exports = {
  QUERY_COLUMNS,
  INSERT_COLUMNS,
  JSONB_COLUMNS,
  buildCreateTableSQL,
  buildInsertSQL,
  eventToInsertParams,
};
