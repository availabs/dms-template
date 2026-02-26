import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data.db');

// Rewrite Postgres-style $1,$2 params to SQLite ? placeholders
function rewriteParams(sql) {
  return sql.replace(/\$\d+/g, '?');
}

// Rewrite NOW() to SQLite's datetime('now')
function rewriteSQL(sql) {
  return rewriteParams(sql).replace(/\bNOW\(\)/gi, "datetime('now')");
}

export default function createSQLiteAdapter() {
  const raw = new Database(DB_PATH);
  raw.pragma('journal_mode = WAL');
  raw.pragma('foreign_keys = ON');

  const SCHEMA = `
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      app TEXT NOT NULL DEFAULT 'toy',
      type TEXT NOT NULL DEFAULT 'note',
      data TEXT NOT NULL DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS change_log (
      revision INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id TEXT NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('I', 'U', 'D')),
      data TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `;

  // Run schema statements one at a time
  for (const stmt of SCHEMA.split(';').map(s => s.trim()).filter(Boolean)) {
    raw.exec(stmt);
  }

  return {
    async all(sql, params = []) {
      return raw.prepare(rewriteSQL(sql)).all(...params);
    },

    async get(sql, params = []) {
      return raw.prepare(rewriteSQL(sql)).get(...params) || null;
    },

    async run(sql, params = []) {
      const info = raw.prepare(rewriteSQL(sql)).run(...params);
      return { lastId: info.lastInsertRowid };
    },

    async close() {
      raw.close();
    },
  };
}
