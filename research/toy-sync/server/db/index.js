import createSQLiteAdapter from './sqlite.js';
import createPgAdapter from './pg.js';

let db = null;

export async function initDB() {
  if (db) return db;

  const connectionString = process.env.DATABASE_URL;

  if (connectionString) {
    console.log('[db] Using Postgres');
    db = await createPgAdapter(connectionString);
  } else {
    console.log('[db] Using SQLite');
    db = createSQLiteAdapter();
  }

  return db;
}

export function getDB() {
  if (!db) throw new Error('Database not initialized — call initDB() first');
  return db;
}
