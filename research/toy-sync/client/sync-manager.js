import { exec } from './db-client.js';

// Event bus for invalidation
const listeners = new Set();
export function onInvalidate(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function invalidate(scope) {
  for (const fn of listeners) fn(scope);
}

// Track pending item IDs for dedup
const pendingItemIds = new Set();

let ws = null;
let wsRetryDelay = 500;
let wsMaxDelay = 30000;

// --- Bootstrap / Delta ---

async function getLastRevision() {
  const result = await exec(
    "SELECT value FROM sync_state WHERE key = 'last_revision'"
  );
  return result.rows.length > 0 ? parseInt(result.rows[0].value, 10) : null;
}

async function setLastRevision(rev) {
  await exec(
    "INSERT OR REPLACE INTO sync_state (key, value) VALUES ('last_revision', ?)",
    [String(rev)]
  );
}

async function applyChanges(changes) {
  for (const change of changes) {
    if (change.action === 'I' || change.action === 'U') {
      // Skip echoes of our own pending mutations
      if (pendingItemIds.has(change.item_id)) continue;

      const data = change.data;
      // Upsert: try insert, on conflict update
      await exec(
        `INSERT INTO items (id, data, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))
         ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = datetime('now')`,
        [change.item_id, data]
      );
    } else if (change.action === 'D') {
      if (pendingItemIds.has(change.item_id)) continue;
      await exec('DELETE FROM items WHERE id = ?', [change.item_id]);
    }
  }
}

async function applyItems(items) {
  for (const item of items) {
    await exec(
      `INSERT INTO items (id, app, type, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      [item.id, item.app, item.type, item.data, item.created_at, item.updated_at]
    );
  }
}

export async function bootstrap() {
  const lastRev = await getLastRevision();

  try {
    if (lastRev === null) {
      // Full bootstrap
      const res = await fetch('/sync/bootstrap');
      if (!res.ok) throw new Error(`bootstrap failed: ${res.status}`);
      const { items, revision } = await res.json();
      await applyItems(items);
      await setLastRevision(revision);
      invalidate('items');
      console.log(`[sync] bootstrapped ${items.length} items, revision=${revision}`);
    } else {
      // Delta sync
      const res = await fetch(`/sync/delta?since=${lastRev}`);
      if (!res.ok) throw new Error(`delta failed: ${res.status}`);
      const { changes, revision } = await res.json();
      if (changes.length > 0) {
        await applyChanges(changes);
        invalidate('items');
        console.log(`[sync] applied ${changes.length} deltas, revision=${revision}`);
      }
      await setLastRevision(revision);
    }
  } catch (err) {
    console.warn('[sync] bootstrap/delta failed (offline?):', err.message);
  }

  // Flush any pending mutations
  await flushPending();
}

// --- WebSocket ---

export function connectWS() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${protocol}//${location.host}/sync/subscribe`;

  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log('[sync] WebSocket connected');
    wsRetryDelay = 500;
    // Catch up on anything missed while disconnected
    catchUp();
    updateStatus('connected');
  };

  ws.onmessage = async (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'change') {
        // Skip echoes of own pending writes
        if (msg.item && pendingItemIds.has(msg.item.id)) {
          await setLastRevision(msg.revision);
          return;
        }

        if (msg.action === 'I' || msg.action === 'U') {
          await exec(
            `INSERT INTO items (id, app, type, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
            [msg.item.id, msg.item.app, msg.item.type, msg.item.data, msg.item.created_at, msg.item.updated_at]
          );
        } else if (msg.action === 'D') {
          await exec('DELETE FROM items WHERE id = ?', [msg.item.id]);
        }

        await setLastRevision(msg.revision);
        invalidate('items');
      }
    } catch (err) {
      console.error('[sync] ws message error:', err);
    }
  };

  ws.onclose = () => {
    console.log(`[sync] WebSocket closed, retrying in ${wsRetryDelay}ms`);
    updateStatus('disconnected');
    setTimeout(() => {
      wsRetryDelay = Math.min(wsRetryDelay * 2, wsMaxDelay);
      connectWS();
    }, wsRetryDelay);
  };

  ws.onerror = () => {
    // onclose will fire after this
  };
}

async function catchUp() {
  try {
    const lastRev = await getLastRevision();
    if (lastRev !== null) {
      const res = await fetch(`/sync/delta?since=${lastRev}`);
      if (res.ok) {
        const { changes, revision } = await res.json();
        if (changes.length > 0) {
          await applyChanges(changes);
          invalidate('items');
        }
        await setLastRevision(revision);
      }
    }
  } catch (err) {
    console.warn('[sync] catch-up failed:', err.message);
  }
}

// --- Local writes + pending mutations ---

export async function localCreate(id, data) {
  const dataStr = typeof data === 'string' ? data : JSON.stringify(data);

  // Optimistic local write
  await exec(
    "INSERT INTO items (id, data, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))",
    [id, dataStr]
  );

  // Queue pending mutation
  await exec(
    "INSERT INTO pending_mutations (item_id, action, data) VALUES (?, 'create', ?)",
    [id, dataStr]
  );

  pendingItemIds.add(id);
  invalidate('items');
  updateStatus('syncing');

  // Push to server
  pushCreate(id, dataStr);
}

export async function localUpdate(id, data) {
  const dataStr = typeof data === 'string' ? data : JSON.stringify(data);

  // Optimistic local write
  await exec(
    "UPDATE items SET data = ?, updated_at = datetime('now') WHERE id = ?",
    [dataStr, id]
  );

  // Queue pending mutation
  await exec(
    "INSERT INTO pending_mutations (item_id, action, data) VALUES (?, 'update', ?)",
    [id, dataStr]
  );

  pendingItemIds.add(id);
  invalidate('items');
  updateStatus('syncing');

  // Push to server
  pushUpdate(id, dataStr);
}

export async function localDelete(id) {
  // Optimistic local delete
  await exec('DELETE FROM items WHERE id = ?', [id]);

  // Queue pending mutation
  await exec(
    "INSERT INTO pending_mutations (item_id, action, data) VALUES (?, 'delete', NULL)",
    [id]
  );

  pendingItemIds.add(id);
  invalidate('items');
  updateStatus('syncing');

  // Push to server
  pushDelete(id);
}

async function pushCreate(id, dataStr) {
  try {
    const res = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, data: dataStr }),
    });
    if (!res.ok) throw new Error(`create failed: ${res.status}`);
    const { item, revision } = await res.json();
    // Update local with server timestamps
    await exec(
      'UPDATE items SET created_at = ?, updated_at = ? WHERE id = ?',
      [item.created_at, item.updated_at, id]
    );
    await setLastRevision(revision);
    await removePending(id, 'create');
    pendingItemIds.delete(id);
    updateStatus('connected');
  } catch (err) {
    console.warn('[sync] push create failed (will retry):', err.message);
    retryFlush();
  }
}

async function pushUpdate(id, dataStr) {
  try {
    const res = await fetch(`/api/items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: dataStr }),
    });
    if (!res.ok) throw new Error(`update failed: ${res.status}`);
    const { revision } = await res.json();
    await setLastRevision(revision);
    await removePending(id, 'update');
    pendingItemIds.delete(id);
    updateStatus('connected');
  } catch (err) {
    console.warn('[sync] push update failed (will retry):', err.message);
    retryFlush();
  }
}

async function pushDelete(id) {
  try {
    const res = await fetch(`/api/items/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) throw new Error(`delete failed: ${res.status}`);
    if (res.ok) {
      const { revision } = await res.json();
      await setLastRevision(revision);
    }
    await removePending(id, 'delete');
    pendingItemIds.delete(id);
    updateStatus('connected');
  } catch (err) {
    console.warn('[sync] push delete failed (will retry):', err.message);
    retryFlush();
  }
}

async function removePending(itemId, action) {
  // Remove the oldest matching pending mutation
  const result = await exec(
    'SELECT id FROM pending_mutations WHERE item_id = ? AND action = ? ORDER BY id ASC LIMIT 1',
    [itemId, action]
  );
  if (result.rows.length > 0) {
    await exec('DELETE FROM pending_mutations WHERE id = ?', [result.rows[0].id]);
  }
}

let flushTimer = null;
function retryFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    await flushPending();
  }, 3000);
}

async function flushPending() {
  const result = await exec(
    'SELECT * FROM pending_mutations ORDER BY id ASC'
  );
  for (const row of result.rows) {
    pendingItemIds.add(row.item_id);
    if (row.action === 'create') {
      await pushCreate(row.item_id, row.data);
    } else if (row.action === 'update') {
      await pushUpdate(row.item_id, row.data);
    } else if (row.action === 'delete') {
      await pushDelete(row.item_id);
    }
  }
}

// --- Status ---

const statusListeners = new Set();
let currentStatus = 'disconnected';

export function onStatusChange(fn) {
  statusListeners.add(fn);
  fn(currentStatus); // immediate callback
  return () => statusListeners.delete(fn);
}

function updateStatus(status) {
  currentStatus = status;
  for (const fn of statusListeners) fn(status);
}

export function getStatus() {
  return currentStatus;
}

// --- Pending count ---

export async function getPendingCount() {
  const result = await exec('SELECT COUNT(*) as count FROM pending_mutations');
  return result.rows[0]?.count || 0;
}
