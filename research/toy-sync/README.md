# Toy Sync — Local-First Notes

A proof-of-concept collaborative notes app validating local-first sync mechanics: SQLite WASM as client DB, revision-based sync protocol, WebSocket push, and offline support.

## Quick Start

```bash
cd toy-sync
npm install
```

**Terminal 1 — Server** (Express + better-sqlite3 on port 3456):

```bash
npm run server
```

**Terminal 2 — Client** (Vite dev server on port 5173):

```bash
npm run dev
```

Open http://localhost:5173 in two browser tabs side by side.

## What to Try

1. **Create a note** in tab A — it appears in tab B instantly via WebSocket
2. **Edit title/description** — changes sync across tabs with 300ms debounce
3. **Kill the server** (`Ctrl+C` in terminal 1) — keep editing in both tabs, edits are saved locally
4. **Restart the server** — pending edits flush to the server automatically
5. **Refresh a tab** — data persists from IndexedDB (wa-sqlite)

## Architecture

```
toy-sync/
  server/
    index.js          # Express + WebSocket on :3456
    db.js             # better-sqlite3, WAL mode, items + change_log tables
    routes.js         # CRUD + /sync/bootstrap + /sync/delta
    ws.js             # WebSocket broadcast manager
  client/
    index.html
    main.jsx          # React root
    App.jsx           # Init: DB → bootstrap → WebSocket → render
    worker.js         # Web Worker hosting wa-sqlite (IDBBatchAtomicVFS)
    db-client.js      # Promise-based SQL proxy to worker
    sync-manager.js   # Bootstrap/delta/WebSocket/pending mutations
    yjs-store.js      # Per-item Yjs document management (not yet wired in)
    use-query.js      # Reactive query hook (invalidation-based)
    use-mutation.js   # Mutation hook (optimistic local write + server push)
    style.css
    components/
      NoteList.jsx    # Reactive list, sorted by updated_at
      NoteEditor.jsx  # Title + description, debounced saves
      SyncStatus.jsx  # Connection dot + pending count
```

### Sync Protocol

1. **Bootstrap** — empty client calls `GET /sync/bootstrap`, gets all items + max revision
2. **Delta** — returning client calls `GET /sync/delta?since=N`, gets only changes since last sync
3. **WebSocket** — server broadcasts every mutation; client applies and updates local revision
4. **Pending queue** — local writes go to `pending_mutations` table, flush to server via REST; on failure, retry with backoff

### Client DB

wa-sqlite (async build) running in a Web Worker with `IDBBatchAtomicVFS` for IndexedDB persistence. Three tables: `items` (note data), `sync_state` (last revision), `pending_mutations` (offline queue).

## Wiring Yjs Merge

`yjs-store.js` is implemented but not yet integrated into the data flow. Currently, edits overwrite the full JSON blob (last-write-wins at the document level). To enable field-level merge via Yjs:

### 1. On local edit (NoteEditor → sync-manager)

In `sync-manager.js`, update `localUpdate` to route through Yjs:

```js
import { applyLocal } from './yjs-store.js';

export async function localUpdate(id, data) {
  // Merge via Yjs instead of raw overwrite
  const merged = applyLocal(id, data);
  const dataStr = JSON.stringify(merged);

  await exec(
    "UPDATE items SET data = ?, updated_at = datetime('now') WHERE id = ?",
    [dataStr, id]
  );
  // ... rest unchanged (queue pending, push to server)
}
```

### 2. On remote change (WebSocket → local DB)

In the `ws.onmessage` handler inside `sync-manager.js`, merge remote data through Yjs:

```js
import { applyRemote } from './yjs-store.js';

// Inside ws.onmessage, for action 'U':
if (msg.action === 'U') {
  const remoteData = JSON.parse(msg.item.data);
  const merged = applyRemote(msg.item.id, remoteData);
  const mergedStr = JSON.stringify(merged);

  await exec(
    `INSERT INTO items (id, app, type, data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    [msg.item.id, msg.item.app, msg.item.type, mergedStr,
     msg.item.created_at, msg.item.updated_at]
  );
}
```

### 3. On bootstrap

In the `applyItems` function, initialize Yjs docs from existing data:

```js
import { initFromData } from './yjs-store.js';

async function applyItems(items) {
  for (const item of items) {
    // ... existing upsert ...
    try {
      const parsed = JSON.parse(item.data);
      initFromData(item.id, parsed);
    } catch {}
  }
}
```

### What this gives you

- Tab A edits `title`, tab B edits `description` simultaneously — both fields preserved
- Without Yjs: last write wins at the document level (one edit lost)
- With Yjs: `YMap` merges at the field level (both edits preserved)
- Same field edited in both tabs: Yjs resolves deterministically (LWW per key, consistent across clients)

### Limitation

Yjs state is in-memory only (lost on page refresh). To persist it, you'd store the Yjs state vector alongside each item in the client DB and reload it on startup. For this toy, re-bootstrapping from the server on refresh is sufficient.
