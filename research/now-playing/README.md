# now-playing — research code

Standalone Express webhook receiver for ACRCloud's Custom Stream Monitoring "Result Callback." Lives in `research/` because the shape will mutate as we learn what ACRCloud actually sends; once it's stable it'll move into `data-types/now-playing/` as a real DMS plugin.

## What it does

- `POST /acrcloud` — receives the webhook, normalizes the payload (title, artist, album, cover URL, ISRC, Spotify/Deezer/YouTube IDs, score, played_duration, timestamp), appends one JSON line to `results.jsonl`, prints a one-liner to stdout.
- `GET /current` — latest matched track in memory.
- `GET /last` — latest event of any kind (including no-match).
- `GET /health` — sanity ping.
- Always tees the unmodified ACRCloud payload to `raw.jsonl` so we can refine the normalizer if their schema differs from the docs.

## Run

```bash
cd research/now-playing
npm install
WEBHOOK_KEY=$(openssl rand -hex 16) PORT=4747 npm start
```

For local dev, expose with `cloudflared tunnel --url http://localhost:4747` (or ngrok / tailscale funnel) and paste the public URL into the ACRCloud console.

## What I need from you to make the call

To wire ACRCloud → this receiver, I need the following from your console:

1. **Project ID and Stream ID** — `https://console.acrcloud.com/projects/<PID>/customstreams/<STREAM_ID>`. Used only if we later poll the `/api/bm-cs-projects/.../streams/.../results` endpoint as a backup.
2. **The shared secret / API key** the console asks you to put in the callback URL — most ACR setups expect either `?api_key=…` in the URL or an `X-API-Key` header. Whatever the console labels it. Set it as `WEBHOOK_KEY` env var when starting `webhook.js`. (If your console doesn't offer one, run with no `WEBHOOK_KEY` and we'll add HMAC verification later — don't expose a public URL with no auth for long.)
3. **A reachable public URL** — the address ACRCloud will POST to. Either:
   - A box with port 4747 open (or whatever you set `PORT` to) and HTTPS in front of it, or
   - A `cloudflared` / `ngrok` / tailscale-funnel tunnel pointed at `http://localhost:4747`.
4. **The exact callback URL ACRCloud is configured with** — paste it back to me so we know what the receiver is listening for. e.g. `https://now-playing.example.com/acrcloud?api_key=…`.
5. **One real webhook payload** — once you've configured the callback and ACRCloud has fired it at least once, copy any line from `raw.jsonl` and paste it back. The normalizer is written from ACRCloud's docs; their actual webhook shape sometimes differs (e.g., results array vs single result), and one real sample lets us tighten the parser.

Optional but useful:

6. **The Bearer token for the Console API v2** (`https://console.acrcloud.com/account/access-keys`) if we want a fallback poll path that reads `GET /api/bm-cs-projects/{PID}/streams/{STREAM_ID}/results` when the webhook drops.

## Next steps after the receiver is logging

- Confirm the normalized fields match what we want (title, artist, album, cover, ISRC, Spotify/YouTube IDs).
- Decide on persistence: SQLite locally for the research phase, then split-table DMS storage when this becomes a `data-types/now-playing/` plugin.
- Add a small front-end (or just `/current` polling) so you can eyeball the feed live.
