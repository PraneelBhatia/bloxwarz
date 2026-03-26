import http from 'node:http';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { GameRoom } from './GameRoom.js';
import { getRoomIdByCode } from './roomCodes.js';

const port = Number(process.env.PORT) || 2567;

const httpServer = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Room code lookup endpoint
  const match = req.url?.match(/^\/api\/room-by-code\/([A-Z0-9]+)$/);
  if (match && req.method === 'GET') {
    const code = match[1];
    const roomId = getRoomIdByCode(code);

    res.setHeader('Content-Type', 'application/json');

    if (roomId) {
      res.writeHead(200);
      res.end(JSON.stringify({ roomId }));
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Room not found' }));
    }
    return;
  }

  // Let Colyseus handle other routes (matchmaking, etc.)
});

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define('game', GameRoom);

gameServer.listen(port).then(() => {
  console.log(`Game server listening on port ${port}`);
});
