# now-playing — research overview

Research-stage notes for a service that monitors a 24/7 internet radio stream (initial target: WCDB FM, `https://streams.wcdb.fm/stream`) and emits real-time song-level identifications. Long-term destination is a `data-types/now-playing/` plugin in `dms-server`; this folder is the standalone scratchpad while the integration shape stabilizes.

Date of research: 2026-04-27.

## Goal

Continuously identify what's playing on a target audio stream and surface track-level metadata (title, artist, album, cover art, ISRC, external IDs) into a JSON feed that downstream DMS components can consume.

Constraints:

- **Language**: JavaScript / Node.js end-to-end (so it ports cleanly into the dms-server plugin system).
- **Cost**: low — single-station college radio budget, not an enterprise broadcast contract.
- **Operational footprint**: prefer "no infrastructure to babysit." Avoid running a local audio-capture sidecar or a dedicated MySQL solely to mirror match results.

## Options surveyed

| Path | Cost | Coverage | Engineering | Op. footprint |
|---|---|---|---|---|
| **ICY metadata parsing** (`StreamTitle` from the stream itself) | $0 | Whatever the DJ/automation tags in real-time | Small | None |
| **AcoustID + chromaprint self-host** | $0 | Poor for indie / Bandcamp / promo / local artists (>50% miss rate empirically); free tier is non-commercial | Medium | Run `fpcalc` + DB queries; manage rate limits |
| **AudD streaming** | $45/stream/mo (their DB) or $25 (your DB); $5 / 1k requests PAYG | Industry catalog | Tiny — POST URL of stream | Their cloud captures audio |
| **ACRCloud Identification API** (sample-and-POST) | ~$30–40/mo at 1 ID / 30s on a 24/7 stream | Industry catalog | Medium — open stream, chunk into 10s clips, POST each | Local capture loop |
| **ACRCloud Custom Stream Monitoring (hosted)** | ~$26/channel/mo (community-reported; pricing now login-gated) | Industry catalog, dense (every track, no sampling gaps) | Tiny — webhook receiver | None — ACR captures audio |
| **ACRCloud Local Monitoring Tool** (open-source Python) | Same per-channel + your hosting | Same | Medium — run + maintain a Python sidecar | Local audio capture; defaults to MySQL (callback module bypasses it) |
| Gracenote / Audible Magic / BMAT | "Contact sales" enterprise | Excellent | High onboarding | Enterprise |

## What we observed about the WCDB stream

```bash
curl -sI -H 'Icy-MetaData: 1' https://streams.wcdb.fm/stream
# ... icy-name: WCDB FM, icy-genre: College Radio, etc.

curl -s --max-time 6 -H 'Icy-MetaData: 1' https://streams.wcdb.fm/stream \
  | head -c 65536 | strings | grep StreamTitle
# StreamTitle='I WANTED by COUPONS';
```

WCDB **does** interleave ICY metadata, format `'TITLE by ARTIST'` (note: `by`, not the more common `ARTIST - TITLE`). Title and artist are free for the taking via any Node Icecast parser (e.g. `icecast-metadata-js`). Album and cover art still require a metadata lookup.

Coverage caveat: ICY tags depend on the DJ/automation tagging tracks. Reliability for college radio is empirically high during scheduled programming and patchier during live shows / DJ talk / automation handoffs.

## Decision

**Go with ACRCloud Custom Stream Monitoring (hosted) + webhook receiver.** ~$26/channel/mo, no local infrastructure, dense per-track results delivered as JSON to an HTTP endpoint.

Rationale:

1. The user has already provisioned a Custom Stream in ACRCloud and confirmed it's working — that decision is settled.
2. Hosted is strictly better than the Local Monitoring Tool for this use case. The local tool is open-source Python (`acrcloud/acrcloud_local_monitor`) and ships SQLite + HTTP-callback modules so the MySQL requirement is avoidable, but it adds a sidecar process and audio-capture loop with no upside over the hosted version.
4. ICY parsing (free) was considered as a primary path. Worth keeping as a future enrichment / sanity-cross-check, but ACRCloud's per-track timing and metadata are richer (ISRC, Spotify/YouTube/Deezer IDs, cover art, played_duration), and the user already has it set up.
5. Webhook delivery is the cleanest fit for a Node service — ACRCloud POSTs each detection as JSON, no polling, no audio handling on our side.

## What this folder contains

- **`webhook.js`** — Express server. `POST /acrcloud` accepts ACRCloud's Result Callback, normalizes into a flat shape, appends one JSON line per event to `results.jsonl`, tees the raw payload to `raw.jsonl`. `GET /current` and `GET /last` expose the latest match / event in memory. Optional `WEBHOOK_KEY` env var enforces a shared secret (`?api_key=…` query param or `X-API-Key` header).
- **`tail.js`** — file-watcher that prints a one-liner per match from `results.jsonl`.
- **`README.md`** — run instructions and the list of items needed from the user to wire ACRCloud → this receiver.
- **`research.md`** — this file.

The normalizer pulls these fields out of each detection: `timestamp_utc`, `played_duration`, `title`, `artist` (joined), `album`, `album_cover`, `acrid`, `score`, `isrc`, `upc`, `spotify_track_id`, `youtube_vid`, `deezer_track_id`, `genres`, `label`, `release_date`, plus the unmodified original under `raw`. The full ACRCloud payload is also stored unchanged in `raw.jsonl` so the normalizer can be tightened once we have real samples.

## Open questions

1. **Real payload shape.** ACRCloud's webhook docs and behavior occasionally diverge — single result vs `results: [...]` array, presence/absence of `external_metadata` blocks. Resolves once one real callback fires and we inspect `raw.jsonl`.
2. **Auth mechanism the console actually offers.** The receiver supports `?api_key=` and `X-API-Key`. If ACRCloud provides HMAC-signed callbacks instead, we'll add signature verification.
3. **Persistence target.** Currently JSONL on disk. For the DMS plugin, the natural target is a split table keyed by detection timestamp (`streams|<stream_id>:data` per the DMS type scheme); revisit once the field set stabilizes.
4. **Backfill / dropped-callback handling.** If the receiver is offline, ACRCloud's retry behavior matters. The Console API v2 exposes `GET /api/bm-cs-projects/{PID}/streams/{STREAM_ID}/results` which can be polled as a backstop. Not implemented yet — wait for first observed gap.
5. **Multi-stream scaling.** Single station for now. The plugin shape will eventually need to multiplex many streams; webhook routing by `?stream_id=` or per-stream URL is straightforward but defer until the user adds a second station.

## Path to production (rough)

1. **Now**: stand up `webhook.js` behind a tunnel, point ACRCloud at it, watch `results.jsonl` for a few hours / days. Tighten the normalizer if `raw.jsonl` shows surprises.
2. **Once payload is stable**: add SQLite persistence (drop-in for JSONL) and a small `/now-playing` HTML page that polls `/current`.
3. **Port to dms-server plugin** (`data-types/now-playing/`):
   - Worker `now-playing/ingest`: long-running process that owns the webhook endpoint and writes detections to a split table.
   - Routes: `POST /streams/register`, `GET /streams/:id/current`, `GET /streams/:id/history`.
   - Per-stream config (callback URL secret, station name) lives as a DMS source.
4. **Optional ICY enrichment**: parse `StreamTitle` independently and reconcile against ACR matches — useful as a sanity check and for marking gaps where ACR returned no match but the DJ tagged something.

## References

- ACRCloud pricing (login-gated): https://www.acrcloud.com/pricing/
- ACRCloud Identification API: https://docs.acrcloud.com/reference/identification-api
- ACRCloud Custom Stream Monitoring tutorial: https://docs.acrcloud.com/get-started/tutorials/broadcast-monitoring-for-custom-content.md
- Custom Streams Results console API: https://docs.acrcloud.com/reference/console-api/bm-projects/custom-streams-projects/streams-results
- ACRCloud Local Monitoring Tool (Python): https://github.com/acrcloud/acrcloud_local_monitor
- Community webhook receiver (archived; useful reference): https://github.com/radiorabe/acr-webhook-receiver
- Community price datapoint ($26/channel): https://www.mediarealm.com.au/articles/metaradio-standalone-acrcloud-setup-live-radio-fingerprinting/
- AudD pricing: https://audd.io/
- Icecast metadata parser: https://www.npmjs.com/package/icecast-metadata-js
