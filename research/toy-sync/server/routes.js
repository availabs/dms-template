import { Router } from 'express';
import { getDB } from './db/index.js';
import { broadcast } from './ws.js';

const router = Router();

// --- CRUD ---

// List all items
router.get('/api/items', async (req, res) => {
  const db = getDB();
  const rows = await db.all('SELECT * FROM items ORDER BY created_at DESC');
  res.json(rows);
});

// Create item (client sends UUID as id)
router.post('/api/items', async (req, res) => {
  const db = getDB();
  const { id, data } = req.body;
  if (!id) return res.status(400).json({ error: 'id is required' });

  const dataStr = typeof data === 'string' ? data : JSON.stringify(data || {});

  await db.run(
    'INSERT INTO items (id, data) VALUES ($1, $2)',
    [id, dataStr]
  );

  const { lastId: revision } = await db.run(
    'INSERT INTO change_log (item_id, action, data) VALUES ($1, $2, $3) RETURNING revision',
    [id, 'I', dataStr]
  );

  const item = await db.get('SELECT * FROM items WHERE id = $1', [id]);

  const msg = { type: 'change', revision, action: 'I', item };
  broadcast(msg);

  res.status(201).json({ item, revision });
});

// Update item
router.put('/api/items/:id', async (req, res) => {
  const db = getDB();
  const { id } = req.params;
  const { data } = req.body;
  if (!data) return res.status(400).json({ error: 'data is required' });

  const existing = await db.get('SELECT * FROM items WHERE id = $1', [id]);
  if (!existing) return res.status(404).json({ error: 'not found' });

  const dataStr = typeof data === 'string' ? data : JSON.stringify(data);

  await db.run(
    'UPDATE items SET data = $1, updated_at = NOW() WHERE id = $2',
    [dataStr, id]
  );

  const { lastId: revision } = await db.run(
    'INSERT INTO change_log (item_id, action, data) VALUES ($1, $2, $3) RETURNING revision',
    [id, 'U', dataStr]
  );

  const item = await db.get('SELECT * FROM items WHERE id = $1', [id]);

  const msg = { type: 'change', revision, action: 'U', item };
  broadcast(msg);

  res.json({ item, revision });
});

// Delete item
router.delete('/api/items/:id', async (req, res) => {
  const db = getDB();
  const { id } = req.params;

  const existing = await db.get('SELECT * FROM items WHERE id = $1', [id]);
  if (!existing) return res.status(404).json({ error: 'not found' });

  await db.run('DELETE FROM items WHERE id = $1', [id]);

  const { lastId: revision } = await db.run(
    'INSERT INTO change_log (item_id, action, data) VALUES ($1, $2, $3) RETURNING revision',
    [id, 'D', null]
  );

  const msg = { type: 'change', revision, action: 'D', item: { id } };
  broadcast(msg);

  res.json({ deleted: true, revision });
});

// --- Sync ---

// Bootstrap: all items + max revision
router.get('/sync/bootstrap', async (req, res) => {
  const db = getDB();
  const items = await db.all('SELECT * FROM items ORDER BY created_at DESC');
  const row = await db.get('SELECT MAX(revision) as "maxRevision" FROM change_log');
  const maxRevision = row?.maxRevision || 0;
  res.json({ items, revision: maxRevision });
});

// Delta: changes since revision N
router.get('/sync/delta', async (req, res) => {
  const db = getDB();
  const since = parseInt(req.query.since, 10) || 0;
  const changes = await db.all(
    'SELECT * FROM change_log WHERE revision > $1 ORDER BY revision ASC',
    [since]
  );
  const row = await db.get('SELECT MAX(revision) as "maxRevision" FROM change_log');
  const maxRevision = row?.maxRevision || since;
  res.json({ changes, revision: maxRevision });
});

export default router;
