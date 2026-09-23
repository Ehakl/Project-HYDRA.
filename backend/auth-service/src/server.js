require('dotenv').config(); // Load .env file for local dev
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { register, login, verifyToken } = require('./auth');
const { setupWebSocket } = require('./ws');

const app = express();

// --- Middleware ---
app.use(cors()); // Allows React (localhost:3000) to call this API without CORS errors.
app.use(express.json()); // Parses JSON request bodies.

// --- Public Routes (No JWT required) ---
app.post('/auth/register', register);
app.post('/auth/login', login);

// --- Protected Routes (JWT required) ---
// All routes under /api/* will first go through verifyToken.
app.use('/api', verifyToken);

// Proxy to Document Service (FastAPI on port 8000)
app.use('/api/docs', createProxyMiddleware({
  target: 'http://doc-service:8000', // Inside Docker, this resolves to the doc-service container.
  changeOrigin: true,
  pathRewrite: { '^/api/docs': '' }, // Strips /api/docs, so /api/docs/documents becomes /documents.
  onProxyReq: (proxyReq, req) => {
    // Forward the user ID to FastAPI so it knows who is making the request.
    proxyReq.setHeader('x-user-id', req.user.userId);
  },
  onError: (err, req, res) => {
    console.error('Proxy Error:', err);
    res.status(500).json({ error: 'Document service unavailable' });
  }
}));

// Proxy to Search Service (Flask on port 5001)
app.use('/api/search', createProxyMiddleware({
  target: 'http://search-service:5001',
  changeOrigin: true,
  pathRewrite: { '^/api/search': '' },
  onProxyReq: (proxyReq, req) => {
    proxyReq.setHeader('x-user-id', req.user.userId);
  }
}));

// --- Health Check (for Docker) ---
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// --- Start the server ---
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(` Auth Gateway running on port ${PORT}`);
});

// --- Attach WebSocket to the same server ---
setupWebSocket(server);