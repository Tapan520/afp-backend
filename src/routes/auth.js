const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { query } = require('../db/pool');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, mobile, email, password, address, wardId, nigamId, cityId } = req.body;
    if (!name || !mobile || !email || !password || !address || !wardId) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check unique
    const exists = await query(
      'SELECT id FROM users WHERE mobile=$1 OR email=$2',
      [mobile, email]
    );
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: 'Mobile or email already registered' });
    }

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      `INSERT INTO users (name,mobile,email,password_hash,address,ward_id,nigam_id,city_id,role)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'citizen') RETURNING id,name,mobile,email,role`,
      [name, mobile, email, hash, address, wardId, nigamId, cityId]
    );

    const user  = rows[0];
    const token = jwt.sign(
      { id: user.id, role: user.role, wardId, nigamId, cityId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Identifier and password required' });
    }

    const { rows } = await query(
      `SELECT u.*, w.ward_number, n.name as nigam_name, c.name as city_name
       FROM users u
       LEFT JOIN wards   w ON w.id = u.ward_id
       LEFT JOIN nigams  n ON n.id = u.nigam_id
       LEFT JOIN cities  c ON c.id = u.city_id
       WHERE (u.mobile=$1 OR u.email=$1)`,
      [identifier]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];
    const ok   = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, role: user.role,
        wardId: user.ward_id, nigamId: user.nigam_id, cityId: user.city_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    delete user.password_hash;
    res.json({ token, user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', require('../middleware/auth').auth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT u.id,u.name,u.mobile,u.email,u.address,u.role,u.profile_photo,u.created_at,
              u.ward_id,u.nigam_id,u.city_id,
              w.ward_number, n.name as nigam_name, c.name as city_name
       FROM users u
       LEFT JOIN wards   w ON w.id = u.ward_id
       LEFT JOIN nigams  n ON n.id = u.nigam_id
       LEFT JOIN cities  c ON c.id = u.city_id
       WHERE u.id=$1`,
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

module.exports = router;
