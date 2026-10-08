const { WebSocketServer } = require('ws');
const { createClient } = require('redis');

exports.setupWebSocket = (server) => {
  const wss = new WebSocketServer({ server });

  // Connect to Redis for pub/sub
  const redisSubscriber = createClient({
    url: process.env.REDIS_URL || 'redis://redis:6379'
  });

  redisSubscriber.connect().catch(console.error);

  redisSubscriber.subscribe('upload_channel', (message) => {
    // message is the doc_id published by doc-service
    // Broadcast to all connected WebSocket clients
    wss.clients.forEach((client) => {
      if (client.readyState === 1) { // OPEN
        client.send(JSON.stringify({ type: 'document_uploaded', doc_id: message }));
      }
    });
  });

  wss.on('connection', (socket) => {
    socket.send(JSON.stringify({ type: 'connected' }));

    socket.on('error', console.error);
  });
};