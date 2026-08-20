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

  // ─── provenance ───────────────────────────────────────────────
  // WHERE a row came from, which is what makes the log editable without
  // the matcher and a DJ fighting over it.
  //
  //   'auto'       written by the matcher (the webhook / backfill paths)
  //   'dj'         typed by a person — the matcher must never touch it
  //   'corrected'  a matched row a person fixed; the detection it replaced
  //                is preserved in original_* so the edit is reversible
  //
  // Every ingest path sets this ('auto'), so a NULL here means a row that
  // predates the column, which reads as 'auto' everywhere it matters.
  'provenance',
  'edited_by',                 // the editing user's email (CMSContext user)
  'edited_at',
  // The detection a correction replaced. Kept at column level rather than
  // only in `raw` because the admin shows it under the corrected value and
  // "revert" has to be a query, not a JSONB dig.
  'original_title',
  'original_artist_name',
  'original_score',

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
  'result_type', 'status_code', 'score', 'result_from', 'original_score',
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
  if (name === 'edited_at') return 'TIMESTAMPTZ';
  // Defaulted so a row inserted by any path that predates provenance — or by
  // hand in SQL — still classifies as an automatic detection rather than NULL.
  if (name === 'provenance') return "TEXT NOT NULL DEFAULT 'auto'";
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
  // ─── provenance ────────────────────────────────────────────────
  // Visible by default because the admin playlist reads them on every row
  // (the badge, and the original detection under a correction), and a column
  // missing from metadata.columns can't be selected by a page section.
  'provenance',
  'edited_by',
  'edited_at',
  'original_title',
  'original_artist_name',
  'original_score',
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

/**
 * Bring an EXISTING per-stream table up to the current QUERY_COLUMNS.
 *
 * `buildCreateTableSQL` is `IF NOT EXISTS`, so it is a no-op against a table
 * that already exists — a column added to QUERY_COLUMNS later would never
 * reach a live stream, and every read of it would error. (That is exactly the
 * failure that cost the dataset migration a day: `auth_permissions` was added
 * to a create script and to no migration, so envs created earlier never got
 * it. Adding a column to the list is not the same as adding it to a table.)
 *
 * `ADD COLUMN IF NOT EXISTS` makes this idempotent, so it is safe to run on
 * every provision and every backfill. Returns one statement per column.
 */
function buildMigrateTableSQL(fullyQualifiedName) {
  return QUERY_COLUMNS
    .filter((c) => {
      if (c === 'id') return false;                     // the PK is create-time only
      // NOT NULL without a DEFAULT cannot be added to a table that already has
      // rows. Those are create-time columns by definition (`kind`), and
      // IF NOT EXISTS would skip them anyway — but emitting the statement at
      // all would make this fail loudly on a table that somehow lacked one.
      const type = pgTypeFor(c);
      return !(type.includes('NOT NULL') && !type.includes('DEFAULT'));
    })
    .map((c) => `ALTER TABLE ${fullyQualifiedName} ADD COLUMN IF NOT EXISTS ${colDef(c)}`);
}

/**
 * Provenance bookkeeping, enforced by the DATABASE rather than by whichever
 * client happens to be writing.
 *
 * The admin playlist promises two things about an edited row: it reads as
 * `Corrected`, and the detection it replaced is still there underneath. Both
 * are properties of the row, not of the form that saved it — and the save goes
 * through the generic UDA edit route, which writes exactly the columns the Card
 * hands it and knows nothing about provenance. A trigger is the only place the
 * guarantee holds for every writer (the admin form, a future bulk fix, psql).
 *
 * On UPDATE, when one of the identifying fields actually changes:
 *   - an 'auto' row becomes 'corrected', and its previous title/artist/score
 *     are captured into original_* (once — a second edit does not overwrite the
 *     first capture, so original_* stays the MATCHER's value, not an
 *     intermediate human one)
 *   - a 'dj' row stays 'dj' — it had no detection to preserve
 *   - edited_at is stamped
 *
 * Idempotent: CREATE OR REPLACE + DROP TRIGGER IF EXISTS, so it can run on
 * every provision and every migration.
 */
function buildProvenanceTriggerSQL(fullyQualifiedName) {
  const unqualified = fullyQualifiedName.split('.').pop();
  const fnName = `${unqualified}_mark_corrected`;
  const trgName = `${unqualified}_mark_corrected_trg`;
  return [
    `CREATE OR REPLACE FUNCTION ${fnName}() RETURNS trigger AS $$
     BEGIN
       IF (NEW.title IS DISTINCT FROM OLD.title
           OR NEW.artist_name IS DISTINCT FROM OLD.artist_name
           OR NEW.album IS DISTINCT FROM OLD.album) THEN
         IF COALESCE(OLD.provenance, 'auto') = 'auto' THEN
           NEW.provenance := 'corrected';
           IF OLD.original_title IS NULL AND OLD.original_artist_name IS NULL THEN
             NEW.original_title := OLD.title;
             NEW.original_artist_name := OLD.artist_name;
             NEW.original_score := OLD.score;
           END IF;
         END IF;
         NEW.edited_at := NOW();
       END IF;
       RETURN NEW;
     END;
     $$ LANGUAGE plpgsql`,
    `DROP TRIGGER IF EXISTS ${trgName} ON ${fullyQualifiedName}`,
    `CREATE TRIGGER ${trgName} BEFORE UPDATE ON ${fullyQualifiedName}
       FOR EACH ROW EXECUTE FUNCTION ${fnName}()`,
  ];
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
  buildMigrateTableSQL,
  buildProvenanceTriggerSQL,
  buildIdempotencyIndexSQL,
  buildInsertSQL,
  buildBackfillInsertSQL,
  eventToInsertParams,
};
