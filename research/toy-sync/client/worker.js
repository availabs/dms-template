import SQLiteESMFactory from '@journeyapps/wa-sqlite/dist/wa-sqlite-async.mjs';
import * as SQLite from '@journeyapps/wa-sqlite';
import { IDBBatchAtomicVFS } from '@journeyapps/wa-sqlite/src/examples/IDBBatchAtomicVFS.js';

let sqlite3;
let db;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    app TEXT NOT NULL DEFAULT 'toy',
    type TEXT NOT NULL DEFAULT 'note',
    data TEXT NOT NULL DEFAULT '{}',
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS sync_state (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS pending_mutations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT,
    action TEXT NOT NULL,
    data TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`;

async function init() {
  const module = await SQLiteESMFactory();
  sqlite3 = SQLite.Factory(module);

  const vfs = await IDBBatchAtomicVFS.create('toy-notes-vfs', module);
  sqlite3.vfs_register(vfs, true);

  db = await sqlite3.open_v2('toy-notes');

  // Run schema statements one at a time
  const statements = SCHEMA.split(';').map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    await sqlite3.exec(db, stmt);
  }

  return true;
}

async function exec(sql, params = []) {
  const rows = [];
  let columns = null;

  if (params.length > 0) {
    // Parameterized query using statements() async generator + bind
    for await (const stmt of sqlite3.statements(db, sql)) {
      sqlite3.bind_collection(stmt, params);
      columns = sqlite3.column_names(stmt);
      while (await sqlite3.step(stmt) === SQLite.SQLITE_ROW) {
        rows.push(sqlite3.row(stmt));
      }
    }
  } else {
    // Non-parameterized query via exec callback
    await sqlite3.exec(db, sql, (row, cols) => {
      if (!columns) columns = [...cols];
      rows.push([...row]);
    });
  }

  // Convert to array of objects
  const result = rows.map(row => {
    const obj = {};
    (columns || []).forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });

  return { rows: result, columns: columns || [] };
}

// Serialize all operations — SQLite can't handle concurrent async calls
let initPromise = null;
let queue = Promise.resolve();

function enqueue(fn) {
  queue = queue.then(fn, fn);
  return queue;
}

self.onmessage = (e) => {
  const { id, type, sql, params } = e.data;

  if (type === 'init') {
    enqueue(async () => {
      try {
        if (!initPromise) initPromise = init();
        await initPromise;
        self.postMessage({ id, type: 'ready' });
      } catch (err) {
        self.postMessage({ id, type: 'error', error: err.message });
      }
    });
    return;
  }

  if (type === 'exec') {
    enqueue(async () => {
      try {
        if (!initPromise) initPromise = init();
        await initPromise;
        const result = await exec(sql, params || []);
        self.postMessage({ id, type: 'result', ...result });
      } catch (err) {
        self.postMessage({ id, type: 'error', error: err.message });
      }
    });
    return;
  }
};
