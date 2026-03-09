import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import { getDB } from './db/index.js';

let wss = null;

// Room management: noteId → Set<WebSocket>
const rooms = new Map();

// Server-side Yjs docs: noteId → Y.Doc
const yjsDocs = new Map();

// Awareness instances: noteId → awarenessProtocol.Awareness
const awarenesses = new Map();

// Flush timers: noteId → timeout
const flushTimers = new Map();
const FLUSH_DELAY = 2000; // ms

function getRoom(noteId) {
  if (!rooms.has(noteId)) rooms.set(noteId, new Set());
  return rooms.get(noteId);
}

async function getOrCreateYDoc(noteId) {
  if (yjsDocs.has(noteId)) return yjsDocs.get(noteId);

  const ydoc = new Y.Doc();
  yjsDocs.set(noteId, ydoc);

  // Try to load persisted state
  try {
    const db = getDB();
    const row = await db.get('SELECT state FROM yjs_states WHERE item_id = $1', [noteId]);
    if (row && row.state) {
      const buf = row.state instanceof Buffer ? row.state : Buffer.from(row.state);
      Y.applyUpdate(ydoc, new Uint8Array(buf));
      console.log(`[ws] loaded Yjs state for note ${noteId}`);
    }
  } catch (err) {
    console.warn(`[ws] failed to load Yjs state for ${noteId}:`, err.message);
  }

  return ydoc;
}

function getOrCreateAwareness(noteId, ydoc) {
  if (awarenesses.has(noteId)) return awarenesses.get(noteId);
  const awareness = new awarenessProtocol.Awareness(ydoc);
  awarenesses.set(noteId, awareness);
  return awareness;
}

function scheduleFlush(noteId) {
  if (flushTimers.has(noteId)) clearTimeout(flushTimers.get(noteId));
  flushTimers.set(noteId, setTimeout(() => flushYjsState(noteId), FLUSH_DELAY));
}

async function flushYjsState(noteId) {
  flushTimers.delete(noteId);
  const ydoc = yjsDocs.get(noteId);
  if (!ydoc) return;

  try {
    const state = Y.encodeStateAsUpdate(ydoc);
    const db = getDB();
    await db.run(
      `INSERT INTO yjs_states (item_id, state, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT(item_id) DO UPDATE SET state = excluded.state, updated_at = NOW()`,
      [noteId, Buffer.from(state)]
    );
  } catch (err) {
    console.warn(`[ws] failed to flush Yjs state for ${noteId}:`, err.message);
  }
}

function cleanupRoom(noteId) {
  const room = rooms.get(noteId);
  if (room && room.size === 0) {
    rooms.delete(noteId);
    // Flush and clean up Yjs doc when last client leaves
    flushYjsState(noteId).then(() => {
      if (!rooms.has(noteId) || rooms.get(noteId).size === 0) {
        const ydoc = yjsDocs.get(noteId);
        if (ydoc) {
          ydoc.destroy();
          yjsDocs.delete(noteId);
        }
        const awareness = awarenesses.get(noteId);
        if (awareness) {
          awareness.destroy();
          awarenesses.delete(noteId);
        }
        if (flushTimers.has(noteId)) {
          clearTimeout(flushTimers.get(noteId));
          flushTimers.delete(noteId);
        }
      }
    });
  }
}

function broadcastToRoom(noteId, msg, excludeWs = null) {
  const room = rooms.get(noteId);
  if (!room) return;
  const payload = typeof msg === 'string' ? msg : JSON.stringify(msg);
  for (const client of room) {
    if (client !== excludeWs && client.readyState === 1) {
      client.send(payload);
    }
  }
}

async function handleMessage(ws, rawData) {
  try {
    const msg = JSON.parse(rawData);

    if (msg.type === 'join-room') {
      const { noteId } = msg;
      if (!noteId) return;

      // Track which rooms this client is in
      if (!ws._rooms) ws._rooms = new Set();
      ws._rooms.add(noteId);
      getRoom(noteId).add(ws);

      // Get or create server-side Yjs doc
      const ydoc = await getOrCreateYDoc(noteId);
      const awareness = getOrCreateAwareness(noteId, ydoc);

      // Send sync step 1: our state vector so client knows what to send us
      const sv = Y.encodeStateVector(ydoc);
      ws.send(JSON.stringify({
        type: 'yjs-sync-step1',
        noteId,
        stateVector: Buffer.from(sv).toString('base64'),
      }));

      // Send full state as sync step 2 so client gets all existing content
      const update = Y.encodeStateAsUpdate(ydoc);
      if (update.length > 2) { // non-empty doc (empty Y.Doc encodes to 2 bytes)
        ws.send(JSON.stringify({
          type: 'yjs-sync-step2',
          noteId,
          update: Buffer.from(update).toString('base64'),
        }));
      }

      // Send current awareness states
      const awarenessStates = awarenessProtocol.encodeAwarenessUpdate(
        awareness,
        Array.from(awareness.getStates().keys())
      );
      if (awarenessStates.length > 1) {
        ws.send(JSON.stringify({
          type: 'yjs-awareness',
          noteId,
          update: Buffer.from(awarenessStates).toString('base64'),
        }));
      }

      console.log(`[ws] client joined room ${noteId}, room size: ${getRoom(noteId).size}`);
      return;
    }

    if (msg.type === 'leave-room') {
      const { noteId } = msg;
      if (!noteId) return;
      if (ws._rooms) ws._rooms.delete(noteId);
      const room = rooms.get(noteId);
      if (room) {
        room.delete(ws);
        cleanupRoom(noteId);
      }
      console.log(`[ws] client left room ${noteId}`);
      return;
    }

    if (msg.type === 'yjs-update') {
      const { noteId, update } = msg;
      if (!noteId || !update) return;

      const binaryUpdate = new Uint8Array(Buffer.from(update, 'base64'));

      // Apply to server-side Y.Doc
      const ydoc = await getOrCreateYDoc(noteId);
      Y.applyUpdate(ydoc, binaryUpdate);
      scheduleFlush(noteId);

      // Relay to other clients in room
      broadcastToRoom(noteId, { type: 'yjs-update', noteId, update }, ws);
      return;
    }

    if (msg.type === 'yjs-sync-response') {
      // Client responding to sync-step1 with its updates
      const { noteId, update } = msg;
      if (!noteId || !update) return;

      const binaryUpdate = new Uint8Array(Buffer.from(update, 'base64'));
      const ydoc = await getOrCreateYDoc(noteId);
      Y.applyUpdate(ydoc, binaryUpdate);
      scheduleFlush(noteId);

      // Relay to other clients
      broadcastToRoom(noteId, { type: 'yjs-update', noteId, update }, ws);
      return;
    }

    if (msg.type === 'yjs-awareness') {
      const { noteId, update } = msg;
      if (!noteId || !update) return;

      // Apply to server-side awareness
      const ydoc = await getOrCreateYDoc(noteId);
      const awareness = getOrCreateAwareness(noteId, ydoc);
      const binaryUpdate = new Uint8Array(Buffer.from(update, 'base64'));
      awarenessProtocol.applyAwarenessUpdate(awareness, binaryUpdate, ws);

      // Relay to other clients in room
      broadcastToRoom(noteId, { type: 'yjs-awareness', noteId, update }, ws);
      return;
    }

  } catch (err) {
    console.error('[ws] message handling error:', err);
  }
}

export function initWebSocket(server) {
  wss = new WebSocketServer({ server, path: '/sync/subscribe' });

  wss.on('connection', (ws) => {
    console.log('[ws] client connected, total:', wss.clients.size);
    ws._rooms = new Set();

    ws.on('message', (data) => handleMessage(ws, data));

    ws.on('close', () => {
      console.log('[ws] client disconnected, total:', wss.clients.size);
      // Leave all rooms
      if (ws._rooms) {
        for (const noteId of ws._rooms) {
          const room = rooms.get(noteId);
          if (room) {
            room.delete(ws);
            cleanupRoom(noteId);
          }
        }
        ws._rooms.clear();
      }
    });

    ws.on('error', (err) => {
      console.error('[ws] error:', err.message);
    });
  });

  return wss;
}

// Broadcast to ALL clients (existing behavior for change_log messages)
export function broadcast(msg) {
  if (!wss) return;
  const payload = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(payload);
    }
  }
}
