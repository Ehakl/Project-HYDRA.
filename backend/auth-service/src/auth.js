const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const pool = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'SuperSecretKey2026';

// --- REGISTER ---
exports.register = async (req, res) => {
  const { email, password, name } = req.body;
  
  // Validation: Never trust the client. Always validate.
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {
    // 1. Hash the password. Salt rounds = 10 (standard trade-off between security and speed).
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 2. Insert into MySQL.
    const [result] = await pool.query(
      'INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
      [email, hashedPassword, name]
    );
    
    res.status(201).json({ 
      message: 'User created', 
      userId: result.insertId 
    });
  } catch (error) {
    // MySQL throws error code 1062 for duplicate email.
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --- LOGIN ---
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Fetch user from MySQL.
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = rows[0];

    // 2. Compare plaintext password with hashed password.
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 3. Generate JWT. Payload contains userId and email.
    // Expires in 1 hour – short-lived tokens are safer.
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role || 'user' }, 
      JWT_SECRET, 
      { expiresIn: '1h' }
    );

    // 4. Return token and user data (excluding password).
    res.json({ 
      token, 
      user: { id: user.id, email: user.email, name: user.name } 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --- VERIFY MIDDLEWARE (The Gatekeeper) ---
exports.verifyToken = (req, res, next) => {
  // 1. Extract token from Authorization header. Format: "Bearer <token>"
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Malformed token' });
  }

  const token = parts[1];

  try {
    // 2. Verify token with secret. This throws if expired or tampered.
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // 3. Attach decoded payload to `req.user` so downstream services know WHO is calling.
    req.user = decoded;
    
    // 4. We also set a custom header `x-user-id` so that when we proxy to FastAPI/Flask,
    // they can know the user ID without re-verifying the token (performance optimization).
    req.headers['x-user-id'] = decoded.userId;
    
    next(); // Proceed to the next middleware or route handler.
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(403).json({ error: 'Invalid token' });
  }
};