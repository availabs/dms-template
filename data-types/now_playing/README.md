# now_playing

Ingest ACRCloud Custom Stream Monitoring webhook callbacks into DMS as a per-stream DAMA dataset that any page can read via the standard `Card` (or any UDA-driven) section.

## Provision a stream

```bash
# 1. Make sure the dataType is registered (data-types/register-datatypes.js
#    must include `registerDatatype('now_playing', require('./now_playing'))`)
#    and DMS_EXTRA_DATATYPES points at that file in your .env.

# 2. Create the stream — produces a source + view + auto-creates the table.
curl -X POST -H 'Authorization: <jwt>' -H 'Content-Type: application/json' \
  -d '{"name":"WCDB FM","station_name":"WCDB FM","acr_project_id":16608,"acr_stream_id":"s-Z0XwkcHp"}' \
  http://localhost:3001/dama-admin/<pgEnv>/now_playing/streams

# Response includes the webhook URL — paste it into ACRCloud's
# "Result Callback URL" field in the project settings.
# {
#   "source_id": 42,
#   "view_id": 17,
#   "data_table": "gis_datasets.s42_v17",
#   "webhook_url": "https://<DMS_PUBLIC_URL>/dama-admin/<pgEnv>/now_playing/streams/42/webhook?key=<32 hex chars>"
# }
```

For the webhook URL to be reachable by ACR, set `DMS_PUBLIC_URL=https://<your-public-host>` in the server's environment. If unset, the response uses `http://localhost:${PORT}` and prints a warning — fine for local testing, useless for ACR.

## Display the latest track on a page

The detection table is a normal DAMA dataset, so the existing **Card** page section works without any custom code. In the DMS admin:

1. Edit a page → add a section → choose **Card**.
2. In the card's data picker, bind to the now_playing stream's source/view.
3. Configure columns:
   - `title`, `artist_name`, `album` — text
   - `album_cover` — image (set the column's `isImg` toggle on; `imageSrc` reads from this column)
4. Sort by `received_at desc`, page size 1.
5. Optional filter: `kind = matched` (skips no-match ticks).

## What the table looks like

One row per ACR callback. Columns prioritize what's useful for filtering / sorting / displaying directly; everything ACR sends — including nested objects and any future fields — is also preserved in the `raw` JSONB column so the schema can be widened later without re-ingesting.

| Field | Type | Notes |
|---|---|---|
| `id`, `received_at` | SERIAL, TIMESTAMPTZ | server-side bookkeeping |
| `kind` | TEXT | `matched` or `no-match` |
| `timestamp_utc` | TIMESTAMPTZ | ACR's own timestamp |
| `title`, `album`, `album_cover`, `release_date`, `label`, `language` | TEXT | display fields |
| `artist_name`, `genre_names` | TEXT | joined helpers; structured forms in `artists` / `genres` (JSONB) |
| `acrid`, `isrc`, `upc`, `spotify_*`, `youtube_vid`, `deezer_*`, `musicbrainz_track_id` | TEXT / JSONB | identifiers + cross-references |
| `score`, `result_from`, `duration_ms`, `play_offset_ms`, `*_offset_ms` | INTEGER | timing/scoring |
| `artists`, `genres`, `external_ids`, `external_metadata`, `contributors`, `mood`, `lyrics` | JSONB | structured ACR objects |
| `stream_id`, `stream_url` | TEXT | from the webhook envelope |
| `raw` | JSONB | full untouched payload |

See `schema.js` for the canonical column list. See `normalize.js` for how each payload is mapped.

## Auth model

JWT middleware in dms-server is decorative (sets `req.availAuthContext.user` to `null` if no token, never blocks). Each route enforces:

- **Admin routes** (`POST /streams`, `GET /streams/:id`, rotate-secret) — require `req.availAuthContext.user`, 401 otherwise.
- **Webhook + health** — unauthenticated transport-wise; validate `?key=<secret>` (or `X-API-Key` header) against `data_manager.sources.statistics.webhook_secret` for the path's `:sourceId` via `crypto.timingSafeEqual`.

Rotating a secret invalidates the old URL immediately. ACR's console URL must be updated to the new value.

## Postgres only (v1)

DAMA's primary backend is postgres; SQLite-backed dama envs hit a 501 at the create-stream route. SQLite support is straightforward (drop schema namespace, swap JSONB → TEXT, swap SERIAL → AUTOINCREMENT, swap TIMESTAMPTZ → TEXT) but not in scope here.

## Why a DAMA table instead of a DMS split table?

Either would work — UDA was designed to read from both. A DAMA-style table at `gis_datasets.s{src}_v{view}` was chosen because it's the more direct fit for tabular event data with a defined schema, and because the helper APIs (`createDamaSource` / `createDamaView`) already establish the source/view metadata pointers that UDA needs. A future variant of this dataType could write to a DMS split table instead — the route shape and webhook behavior wouldn't change.
