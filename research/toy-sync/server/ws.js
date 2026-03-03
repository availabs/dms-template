import { WebSocketServer } from 'ws';

let wss = null;

export function initWebSocket(server) {
  wss = new WebSocketServer({ server, path: '/sync/subscribe' });

  wss.on('connection', (ws) => {
    console.log('[ws] client connected, total:', wss.clients.size);
    ws.on('close', () => {
      console.log('[ws] client disconnected, total:', wss.clients.size);
    });
    ws.on('error', (err) => {
      console.error('[ws] error:', err.message);
    });
  });

  return wss;
}

export function broadcast(msg) {
  if (!wss) return;
  const payload = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(payload);
    }
  }
}
