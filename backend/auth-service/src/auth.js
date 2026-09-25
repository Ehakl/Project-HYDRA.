const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { createHash, randomInt } = require('crypto');
const pool = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'SuperSecretKey2026';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

const hashCode = (code) => createHash('sha256').update(code).digest('hex');

const sendVerificationEmail = async (email, code) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.ALLOW_DEV_VERIFICATION === 'true') return;
    throw new Error('Email delivery is not configured');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || 'Hydra <onboarding@resend.dev>',
      to: [email],
      subject: 'Your Hydra verification code',
      html: `<p>Your Hydra verification code is <strong>${code}</strong>.</p><p>This code expires in 10 minutes.</p>`
    })
  });

  if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
};

const createVerificationCode = () => String(randomInt(100000, 1000000));

// --- REGISTER ---
exports.register = async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !emailPattern.test(email) || !password || !name) {
    return res.status(400).json({ error: 'Enter a valid email, name, and password' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = createVerificationCode();
    const [result] = await pool.query(
      'INSERT INTO users (email, password, name, email_verified, verification_code_hash, verification_expires_at) VALUES (?, ?, ?, 0, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))',
      [email.toLowerCase().trim(), hashedPassword, name.trim(), hashCode(verificationCode)]
    );

    try {
      await sendVerificationEmail(email, verificationCode);
    } catch (deliveryError) {
      await pool.query('DELETE FROM users WHERE id = ?', [result.insertId]);
      return res.status(503).json({ error: 'Email verification is not configured yet' });
    }

    const payload = { message: 'Verification code sent', userId: result.insertId, email: email.toLowerCase().trim() };
    if (process.env.ALLOW_DEV_VERIFICATION === 'true' && !process.env.RESEND_API_KEY) {
      payload.devVerificationCode = verificationCode;
    }
    res.status(201).json(payload);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.verifyEmail = async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  const code = String(req.body.code || '').trim();
  if (!emailPattern.test(email) || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'Enter the six-digit verification code' });
  }

  const [rows] = await pool.query(
    'SELECT id, verification_code_hash, verification_expires_at FROM users WHERE email = ?',
    [email]
  );
  const user = rows[0];
  if (!user || !user.verification_code_hash || new Date(user.verification_expires_at) < new Date() || hashCode(code) !== user.verification_code_hash) {
    return res.status(400).json({ error: 'That code is invalid or expired' });
  }

  await pool.query(
    'UPDATE users SET email_verified = 1, verification_code_hash = NULL, verification_expires_at = NULL WHERE id = ?',
    [user.id]
  );
  res.json({ message: 'Email verified' });
};

exports.resendVerification = async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  if (!emailPattern.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });
  const verificationCode = createVerificationCode();
  const [result] = await pool.query(
    'UPDATE users SET verification_code_hash = ?, verification_expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE email = ? AND email_verified = 0',
    [hashCode(verificationCode), email]
  );
  if (!result.affectedRows) return res.status(404).json({ error: 'Unverified account not found' });
  try {
    await sendVerificationEmail(email, verificationCode);
  } catch (error) {
    return res.status(503).json({ error: 'Email delivery is unavailable right now' });
  }
  const response = { message: 'Verification code sent' };
  if (process.env.ALLOW_DEV_VERIFICATION === 'true' && !process.env.RESEND_API_KEY) response.devVerificationCode = verificationCode;
  res.json(response);
};

// --- LOGIN ---
exports.login = async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  const { password } = req.body;

  if (!emailPattern.test(email) || !password) {
    return res.status(400).json({ error: 'Enter a valid email and password' });
  }

  try {
    // 1. Fetch user from MySQL.
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = rows[0];

    if (!user.email_verified) {
      return res.status(403).json({ error: 'Verify your email before signing in' });
    }

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