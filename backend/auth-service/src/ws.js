const { WebSocketServer } = require('ws');

exports.setupWebSocket = (server) => {
  const websocketServer = new WebSocketServer({ server });

  websocketServer.on('connection', (socket) => {
    socket.send(JSON.stringify({ type: 'connected' }));
  });
};