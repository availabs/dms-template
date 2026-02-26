import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { initDB } from './db/index.js';
import routes from './routes.js';
import { initWebSocket } from './ws.js';

const app = express();
const PORT = 3456;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());
app.use(routes);

const server = createServer(app);
initWebSocket(server);

async function start() {
  await initDB();
  server.listen(PORT, () => {
    console.log(`[toy-sync] server running on http://localhost:${PORT}`);
    console.log(`[toy-sync] WebSocket at ws://localhost:${PORT}/sync/subscribe`);
  });
}

start().catch(err => {
  console.error('[toy-sync] Failed to start:', err);
  process.exit(1);
});
