import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { getWS, onWSChange } from '../sync-manager.js';

// Generate random user identity per tab (persists in sessionStorage)
function getUserIdentity() {
  let identity = null;
  try {
    const stored = sessionStorage.getItem('collab-identity');
    if (stored) identity = JSON.parse(stored);
  } catch {}

  if (!identity) {
    const colors = ['#e06c75', '#98c379', '#e5c07b', '#61afef', '#c678dd', '#56b6c2', '#d19a66'];
    const names = ['Fox', 'Owl', 'Bear', 'Wolf', 'Hawk', 'Deer', 'Lynx', 'Crow', 'Hare', 'Pike'];
    identity = {
      name: names[Math.floor(Math.random() * names.length)] + ' ' + Math.floor(Math.random() * 100),
      color: colors[Math.floor(Math.random() * colors.length)],
    };
    try {
      sessionStorage.setItem('collab-identity', JSON.stringify(identity));
    } catch {}
  }

  return identity;
}

/**
 * ToyProvider bridges the Lexical CollaborationPlugin's Provider interface
 * to the existing toy-sync WebSocket. It handles:
 * - Joining/leaving rooms (per note)
 * - Relaying Yjs binary updates as base64 JSON messages
 * - Relaying awareness (cursor/presence) updates
 * - Sync protocol (sync-step1/step2) for bootstrapping
 */
export class ToyProvider {
  constructor(noteId, ydoc) {
    this.noteId = noteId;
    this.doc = ydoc;
    this.awareness = new Awareness(ydoc);
    this._connected = false;
    this._synced = false;
    this._listeners = new Map(); // event type → Set<callback>
    this._wsHandler = null;
    this._docUpdateHandler = null;
    this._awarenessUpdateHandler = null;
    this._unsubWSChange = null;

    // Set local awareness state with user identity
    const identity = getUserIdentity();
    this.awareness.setLocalState({
      name: identity.name,
      color: identity.color,
      focusing: false,
      anchorPos: null,
      focusPos: null,
      awarenessData: {},
    });
  }

  // --- Provider interface ---

  connect() {
    if (this._connected) return;
    this._connected = true;

    // Listen for doc updates to send to server
    this._docUpdateHandler = (update, origin) => {
      // Skip updates from remote (they came FROM the server)
      if (origin === 'remote') return;

      const ws = getWS();
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'yjs-update',
          noteId: this.noteId,
          update: uint8ToBase64(update),
        }));
      }
    };
    this.doc.on('update', this._docUpdateHandler);

    // Listen for awareness changes to send to server
    this._awarenessUpdateHandler = ({ added, updated, removed }, origin) => {
      if (origin === 'remote') return;
      const changedClients = added.concat(updated).concat(removed);
      if (changedClients.length === 0) return;
      const ws = getWS();
      if (ws && ws.readyState === 1) {
        const encodedUpdate = encodeAwarenessUpdate(this.awareness, changedClients);
        ws.send(JSON.stringify({
          type: 'yjs-awareness',
          noteId: this.noteId,
          update: uint8ToBase64(encodedUpdate),
        }));
      }
    };
    this.awareness.on('update', this._awarenessUpdateHandler);

    // Subscribe to WebSocket messages
    this._wsHandler = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.noteId !== this.noteId) return;

        if (msg.type === 'yjs-sync-step1') {
          // Server sent its state vector — respond with our updates
          const serverSV = base64ToUint8(msg.stateVector);
          const update = Y.encodeStateAsUpdate(this.doc, serverSV);
          const ws = getWS();
          if (ws && ws.readyState === 1) {
            ws.send(JSON.stringify({
              type: 'yjs-sync-response',
              noteId: this.noteId,
              update: uint8ToBase64(update),
            }));
          }
        }

        if (msg.type === 'yjs-sync-step2') {
          // Server sent full state — apply it
          const update = base64ToUint8(msg.update);
          Y.applyUpdate(this.doc, update, 'remote');
          // Mark as synced after receiving server state
          if (!this._synced) {
            this._synced = true;
            this._emit('sync', true);
          }
        }

        if (msg.type === 'yjs-update') {
          const update = base64ToUint8(msg.update);
          Y.applyUpdate(this.doc, update, 'remote');
        }

        if (msg.type === 'yjs-awareness') {
          const update = base64ToUint8(msg.update);
          applyAwarenessUpdate(this.awareness, update, 'remote');
        }
      } catch (err) {
        console.error('[ToyProvider] message error:', err);
      }
    };

    // Track the current WS so we can remove listeners on reconnect
    this._currentWS = null;

    // Attach to current WS and any future reconnections
    const attachWS = (websocket) => {
      if (!websocket || websocket.readyState !== 1) return;
      // Already attached to this exact WS — skip
      if (this._currentWS === websocket) return;

      // Remove listener from previous WS if it changed
      if (this._currentWS) {
        this._currentWS.removeEventListener('message', this._wsHandler);
      }
      this._currentWS = websocket;
      websocket.addEventListener('message', this._wsHandler);

      // Join room
      websocket.send(JSON.stringify({
        type: 'join-room',
        noteId: this.noteId,
      }));

      this._emit('status', { status: 'connected' });
    };

    // onWSChange fires immediately if WS is already open, and on future reconnects
    this._unsubWSChange = onWSChange((newWs) => {
      if (newWs && newWs.readyState === 1) {
        attachWS(newWs);
      }
    });

    // If no server state arrives within a short time, mark synced
    // (handles case where server has no state for this note)
    this._syncTimeout = setTimeout(() => {
      if (!this._synced) {
        this._synced = true;
        this._emit('sync', true);
      }
    }, 1000);
  }

  disconnect() {
    if (!this._connected) return;
    this._connected = false;

    if (this._syncTimeout) {
      clearTimeout(this._syncTimeout);
      this._syncTimeout = null;
    }

    // Remove doc update listener
    if (this._docUpdateHandler) {
      this.doc.off('update', this._docUpdateHandler);
      this._docUpdateHandler = null;
    }

    // Remove awareness listener
    if (this._awarenessUpdateHandler) {
      this.awareness.off('update', this._awarenessUpdateHandler);
      this._awarenessUpdateHandler = null;
    }

    // Remove WS message listener
    if (this._wsHandler && this._currentWS) {
      this._currentWS.removeEventListener('message', this._wsHandler);
      this._wsHandler = null;
    }

    // Unsubscribe from WS lifecycle
    if (this._unsubWSChange) {
      this._unsubWSChange();
      this._unsubWSChange = null;
    }

    // Leave room
    const ws = this._currentWS || getWS();
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'leave-room',
        noteId: this.noteId,
      }));
    }
    this._currentWS = null;

    this._synced = false;
    this._emit('status', { status: 'disconnected' });
  }

  on(type, cb) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(cb);
  }

  off(type, cb) {
    const set = this._listeners.get(type);
    if (set) set.delete(cb);
  }

  _emit(type, ...args) {
    const set = this._listeners.get(type);
    if (set) {
      for (const cb of set) cb(...args);
    }
  }

  destroy() {
    this.disconnect();
    this.awareness.destroy();
  }
}

/**
 * Factory function for CollaborationPlugin's providerFactory prop.
 */
export function createToyProvider(noteId, yjsDocMap) {
  let ydoc = yjsDocMap.get(noteId);
  if (!ydoc) {
    ydoc = new Y.Doc();
    yjsDocMap.set(noteId, ydoc);
  }

  return new ToyProvider(noteId, ydoc);
}

// --- Helpers ---

function uint8ToBase64(uint8) {
  let binary = '';
  for (let i = 0; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return btoa(binary);
}

function base64ToUint8(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Re-export awareness helpers used in the provider
import { encodeAwarenessUpdate, applyAwarenessUpdate } from 'y-protocols/awareness';
