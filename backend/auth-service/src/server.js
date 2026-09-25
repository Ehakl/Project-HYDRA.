require('dotenv').config(); // Load .env file for local dev
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { register, login, verifyEmail, resendVerification, verifyToken } = require('./auth');
const pool = require('./db');
const { setupWebSocket } = require('./ws');

const app = express();
const allowedOrigins = process.env.CORS_ORIGIN || '*';

// --- Middleware ---
app.use(cors({ origin: allowedOrigins === '*' ? true : allowedOrigins.split(',').map((origin) => origin.trim()) }));
app.use(express.json()); // Parses JSON request bodies.

// --- Public Routes (No JWT required) ---
app.post('/auth/register', register);
app.post('/auth/login', login);
app.post('/api/auth/register', register);
app.post('/api/auth/login', login);
app.post('/auth/verify-email', verifyEmail);
app.post('/api/auth/verify-email', verifyEmail);
app.post('/auth/resend-verification', resendVerification);
app.post('/api/auth/resend-verification', resendVerification);

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

// Proxy AI tools to the FastAPI AI service.
app.use('/api/ai', createProxyMiddleware({
  target: 'http://ai-service:8000',
  changeOrigin: true,
  pathRewrite: { '^/api/ai': '' },
  onProxyReq: (proxyReq, req) => {
    proxyReq.setHeader('x-user-id', req.user.userId);
  },
  onError: (err, req, res) => {
    console.error('AI Proxy Error:', err);
    res.status(503).json({ error: 'AI service unavailable' });
  }
}));

// --- Health Check (for Docker) ---
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// --- Start the server ---
const PORT = process.env.PORT || 5000;
const start = async () => {
  const migrations = [
    'ALTER TABLE users ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 1',
    'ALTER TABLE users ADD COLUMN verification_code_hash VARCHAR(64) NULL',
    'ALTER TABLE users ADD COLUMN verification_expires_at DATETIME NULL'
  ];
  for (const migration of migrations) {
    try {
      await pool.query(migration);
    } catch (error) {
      if (error.code !== 'ER_DUP_FIELDNAME') throw error;
    }
  }
  const server = app.listen(PORT, () => {
    console.log(` Auth Gateway running on port ${PORT}`);
  });
  setupWebSocket(server);
};

start().catch((error) => {
  console.error('Auth Gateway failed to start:', error);
  process.exit(1);
});