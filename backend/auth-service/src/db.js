const mysql = require('mysql2/promise');

// Why a pool? Because opening/closing connections for every request is expensive.
// A pool keeps 10 connections alive and reuses them. This is standard in production.
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',  // 'mysql_db' inside Docker, 'localhost' outside
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'rootpass',
  database: process.env.MYSQL_DB || 'hydra_auth',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;