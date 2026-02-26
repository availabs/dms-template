import pg from 'pg';
const { Pool } = pg;

export default async function createPgAdapter(connectionString) {
  const pool = new Pool({ connectionString });

  // Verify connection
  const client = await pool.connect();
  client.release();

  const SCHEMA = `
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      app TEXT NOT NULL DEFAULT 'toy',
      type TEXT NOT NULL DEFAULT 'note',
      data TEXT NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS change_log (
      revision SERIAL PRIMARY KEY,
      item_id TEXT NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('I', 'U', 'D')),
      data TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  await pool.query(SCHEMA);

  return {
    async all(sql, params = []) {
      const { rows } = await pool.query(sql, params);
      return rows;
    },

    async get(sql, params = []) {
      const { rows } = await pool.query(sql, params);
      return rows[0] || null;
    },

    async run(sql, params = []) {
      const { rows } = await pool.query(sql, params);
      // If query used RETURNING, extract the first row
      const lastId = rows[0]?.revision ?? null;
      return { lastId };
    },

    async close() {
      await pool.end();
    },
  };
}
