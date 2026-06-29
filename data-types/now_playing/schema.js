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

const INTEGER_COLUMNS = new Set([
  'result_type', 'status_code', 'score', 'result_from',
  'duration_ms', 'play_offset_ms', 'played_duration',
  'sample_begin_time_offset_ms', 'sample_end_time_offset_ms',
  'db_begin_time_offset_ms', 'db_end_time_offset_ms',
]);

/**
 * Postgres column type for `name`, used by both the CREATE TABLE builder
 * and the COLUMN_METADATA export below. Single source of truth so the
 * source's `metadata.columns` (read by DAMA's DataWrapper, the Table
 * page, and any downstream UDA-driven UI) always matches the actual
 * column types.
 */
function pgTypeFor(name) {
  if (name === 'id') return 'SERIAL PRIMARY KEY';
  if (name === 'received_at') return 'TIMESTAMPTZ NOT NULL DEFAULT NOW()';
  if (name === 'kind') return 'TEXT NOT NULL';
  if (name === 'timestamp_utc') return 'TIMESTAMPTZ';
  if (JSONB_COLUMNS.has(name)) return 'JSONB';
  if (INTEGER_COLUMNS.has(name)) return 'INTEGER';
  return 'TEXT';
}

function colDef(name) {
  return `${name} ${pgTypeFor(name)}`;
}

/**
 * Pretty display name for `name` — used as the column header in the
 * built-in Table page. Snake-case is fine in SQL but ugly in a header
 * row, so title-case the name and special-case a few abbreviations.
 */
function displayNameFor(name) {
  const overrides = {
    acrid: 'ACRID',
    isrc: 'ISRC',
    upc: 'UPC',
    timestamp_utc: 'Timestamp (UTC)',
    spotify_track_id: 'Spotify Track ID',
    spotify_album_id: 'Spotify Album ID',
    spotify_artist_ids: 'Spotify Artist IDs',
    youtube_vid: 'YouTube VID',
    deezer_track_id: 'Deezer Track ID',
    deezer_album_id: 'Deezer Album ID',
    deezer_artist_ids: 'Deezer Artist IDs',
    musicbrainz_track_id: 'MusicBrainz Track ID',
  };
  if (overrides[name]) return overrides[name];
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function metadataEntry(name) {
  return {
    name,
    display_name: displayNameFor(name),
    type: pgTypeFor(name).split(' ')[0],   // bare type, no "NOT NULL" / "PRIMARY KEY"
    desc: null,
  };
}

/**
 * Curated default columns surfaced in `data_manager.sources.metadata.columns`
 * at provision time. The shape — `[{ name, display_name, type, desc }]` — is
 * the cross-DAMA contract (see `dms-server/src/dama/CLAUDE.md`); DataWrapper,
 * the built-in Table page, and column-aware filters all read from here.
 *
 * The physical table has every column in `QUERY_COLUMNS`; this list only
 * controls what surfaces by default in the column-aware UI. Anything left
 * out is still queryable via the JSONB `raw` blob (last entry below) and
 * can be promoted into the default view by appending to this array.
 */
const DEFAULT_VISIBLE_COLUMNS = [
  // ─── timestamps ─────────────────────────────────────────────────
  'received_at',           // when the row landed in our DB — strictly monotonic, default sort
  'timestamp_utc',         // ACR's own detection timestamp
  // ─── classification ────────────────────────────────────────────
  'kind',                  // 'matched' / 'no-match'
  // ─── primary track display ─────────────────────────────────────
  'title',
  'artist_name',
  'album',
  'release_date',
  'label',
  'genre_names',
  // ─── confidence / timing ───────────────────────────────────────
  'score',
  'played_duration',
  // ─── identifiers (the ones worth eyeballing in a table) ────────
  'acrid',
  'isrc',
  'spotify_track_id',
  'youtube_vid',
  'album_cover',
  // ─── envelope ──────────────────────────────────────────────────
  'stream_id',
  // ─── raw payload — always last, gives full fidelity ────────────
  'raw',
];

const COLUMN_METADATA = DEFAULT_VISIBLE_COLUMNS.map(metadataEntry);

/** All columns in the physical table, including the ones excluded from the default view. */
const ALL_COLUMN_METADATA = QUERY_COLUMNS.map(metadataEntry);

/**
 * Index name has to be deterministic per-table so re-creating it is a no-op.
 * Postgres caps identifiers at 63 chars; the per-stream tables are
 * `gis_datasets.s{source_id}_v{view_id}` so the bare table name is short.
 */
function buildIndexName(unqualifiedTable) {
  return `${unqualifiedTable}_acrid_ts_uniq`;
}

/**
 * Partial unique index on (acrid, timestamp_utc) WHERE kind='matched'.
 * Lets the backfill worker re-run an overlapping window safely with
 * INSERT … ON CONFLICT DO NOTHING. No-match rows have null acrid so we
 * exclude them — re-pulling no-match rows is rare and the duplicates are
 * harmless if they happen.
 */
function buildIdempotencyIndexSQL(fullyQualifiedName) {
  const unqualified = fullyQualifiedName.split('.').pop();
  const idxName = buildIndexName(unqualified);
  return `CREATE UNIQUE INDEX IF NOT EXISTS ${idxName}
          ON ${fullyQualifiedName} (acrid, timestamp_utc)
          WHERE kind = 'matched' AND acrid IS NOT NULL`;
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

/**
 * Same INSERT as the webhook path, but adds ON CONFLICT DO NOTHING against
 * the partial unique index built by `buildIdempotencyIndexSQL`. RETURNING
 * is empty on conflict, which the backfill worker uses to count actual
 * inserts (vs. skipped duplicates).
 */
function buildBackfillInsertSQL(fullyQualifiedName) {
  const placeholders = INSERT_COLUMNS.map((_, i) => `$${i + 1}`).join(', ');
  return `INSERT INTO ${fullyQualifiedName} (${INSERT_COLUMNS.join(', ')})
          VALUES (${placeholders})
          ON CONFLICT (acrid, timestamp_utc) WHERE kind = 'matched' AND acrid IS NOT NULL
          DO NOTHING
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
  COLUMN_METADATA,
  ALL_COLUMN_METADATA,
  DEFAULT_VISIBLE_COLUMNS,
  buildCreateTableSQL,
  buildIdempotencyIndexSQL,
  buildInsertSQL,
  buildBackfillInsertSQL,
  eventToInsertParams,
};
