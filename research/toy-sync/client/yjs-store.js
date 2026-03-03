import * as Y from 'yjs';

// Map of itemId → Y.Doc
const docs = new Map();

export function getDoc(id) {
  if (docs.has(id)) return docs.get(id);
  const ydoc = new Y.Doc();
  docs.set(id, ydoc);
  return ydoc;
}

// Apply a local edit: update the YMap with new data fields, return materialized JSON
export function applyLocal(id, newData) {
  const ydoc = getDoc(id);
  const ymap = ydoc.getMap('data');

  ydoc.transact(() => {
    for (const [key, value] of Object.entries(newData)) {
      ymap.set(key, value);
    }
  });

  return materialize(ymap);
}

// Apply remote data: merge remote JSON into YMap (LWW per key), return materialized JSON
export function applyRemote(id, remoteData) {
  const ydoc = getDoc(id);
  const ymap = ydoc.getMap('data');

  // For the toy, server stores plain JSON snapshots.
  // We merge remote keys into the YMap — Yjs handles conflicts via LWW.
  ydoc.transact(() => {
    for (const [key, value] of Object.entries(remoteData)) {
      // Only set if different to avoid unnecessary updates
      if (ymap.get(key) !== value) {
        ymap.set(key, value);
      }
    }
    // Remove keys that no longer exist remotely (handles field deletion)
    for (const key of ymap.keys()) {
      if (!(key in remoteData)) {
        ymap.delete(key);
      }
    }
  });

  return materialize(ymap);
}

// Initialize a YDoc from existing data (e.g., after bootstrap)
export function initFromData(id, data) {
  const ydoc = getDoc(id);
  const ymap = ydoc.getMap('data');

  if (ymap.size === 0 && Object.keys(data).length > 0) {
    ydoc.transact(() => {
      for (const [key, value] of Object.entries(data)) {
        ymap.set(key, value);
      }
    });
  }

  return materialize(ymap);
}

// Get the current materialized data for an item
export function getData(id) {
  if (!docs.has(id)) return null;
  const ydoc = docs.get(id);
  const ymap = ydoc.getMap('data');
  return materialize(ymap);
}

// Clean up
export function destroyDoc(id) {
  const ydoc = docs.get(id);
  if (ydoc) {
    ydoc.destroy();
    docs.delete(id);
  }
}

// Convert YMap to plain object
function materialize(ymap) {
  const obj = {};
  ymap.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
}
