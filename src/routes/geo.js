const router = require('express').Router();
const { query } = require('../db/pool');
const { auth, adminOnly } = require('../middleware/auth');

const superAdminOnly = adminOnly(['super_admin']);

// ── CITIES ────────────────────────────────────────────────────────

// GET /api/geo/cities  — public (registration dropdown)
router.get('/cities', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT id, name, state FROM cities WHERE is_active=true ORDER BY name'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch cities' });
  }
});

// GET /api/geo/cities/all  — super_admin: full detail with counts
router.get('/cities/all', auth, superAdminOnly, async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT c.*,
        COUNT(DISTINCT n.id) AS nigam_count,
        COUNT(DISTINCT w.id) AS ward_count,
        COUNT(DISTINCT p.id) AS pet_count
      FROM cities c
      LEFT JOIN nigams n ON n.city_id = c.id
      LEFT JOIN wards  w ON w.nigam_id = n.id
      LEFT JOIN pets   p ON p.city_id  = c.id
      GROUP BY c.id ORDER BY c.name
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch cities' });
  }
});

// POST /api/geo/cities  — super_admin only
router.post('/cities', auth, superAdminOnly, async (req, res) => {
  try {
    const { name, state } = req.body;
    if (!name || !state) return res.status(400).json({ error: 'City name and state are required' });
    const dup = await query('SELECT id FROM cities WHERE LOWER(name)=LOWER($1)', [name]);
    if (dup.rows.length) return res.status(409).json({ error: `City "${name}" already exists` });
    const { rows } = await query(
      'INSERT INTO cities (name, state) VALUES ($1, $2) RETURNING *',
      [name.trim(), state.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add city' });
  }
});

// PUT /api/geo/cities/:id  — super_admin only
router.put('/cities/:id', auth, superAdminOnly, async (req, res) => {
  try {
    const { name, state, is_active } = req.body;
    if (!name || !state) return res.status(400).json({ error: 'City name and state are required' });
    const { rows } = await query(
      'UPDATE cities SET name=$1, state=$2, is_active=$3 WHERE id=$4 RETURNING *',
      [name.trim(), state.trim(), is_active !== false, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'City not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update city' });
  }
});

// DELETE /api/geo/cities/:id  — soft delete, blocked if pets exist
router.delete('/cities/:id', auth, superAdminOnly, async (req, res) => {
  try {
    const { rows } = await query('SELECT COUNT(*) FROM pets WHERE city_id=$1', [req.params.id]);
    if (parseInt(rows[0].count) > 0)
      return res.status(400).json({ error: `Cannot deactivate — ${rows[0].count} pets exist in this city` });
    await query('UPDATE cities SET is_active=false WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to deactivate city' });
  }
});

// ── NIGAMS ────────────────────────────────────────────────────────

// GET /api/geo/nigams?cityId=1  — public (registration dropdown)
router.get('/nigams', async (req, res) => {
  try {
    const { cityId } = req.query;
    const { rows } = await query(
      'SELECT id, name, city_id FROM nigams WHERE city_id=$1 AND is_active=true ORDER BY name',
      [cityId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch nigams' });
  }
});

// GET /api/geo/nigams/all?cityId=1  — super_admin
router.get('/nigams/all', auth, superAdminOnly, async (req, res) => {
  try {
    const { cityId } = req.query;
    let sql = `
      SELECT n.*, c.name AS city_name, COUNT(DISTINCT w.id) AS ward_count
      FROM nigams n
      LEFT JOIN cities c ON c.id = n.city_id
      LEFT JOIN wards  w ON w.nigam_id = n.id
    `;
    const params = [];
    if (cityId) { sql += ' WHERE n.city_id=$1'; params.push(cityId); }
    sql += ' GROUP BY n.id, c.name ORDER BY c.name, n.name';
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch nigams' });
  }
});

// POST /api/geo/nigams  — super_admin only
router.post('/nigams', auth, superAdminOnly, async (req, res) => {
  try {
    const { name, cityId } = req.body;
    if (!name || !cityId) return res.status(400).json({ error: 'Nigam name and city are required' });
    const dup = await query(
      'SELECT id FROM nigams WHERE LOWER(name)=LOWER($1) AND city_id=$2', [name, cityId]
    );
    if (dup.rows.length) return res.status(409).json({ error: `Nigam "${name}" already exists in this city` });
    const { rows } = await query(
      'INSERT INTO nigams (name, city_id) VALUES ($1, $2) RETURNING *',
      [name.trim(), cityId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add nigam' });
  }
});

// PUT /api/geo/nigams/:id  — super_admin only
router.put('/nigams/:id', auth, superAdminOnly, async (req, res) => {
  try {
    const { name, is_active } = req.body;
    if (!name) return res.status(400).json({ error: 'Nigam name is required' });
    const { rows } = await query(
      'UPDATE nigams SET name=$1, is_active=$2 WHERE id=$3 RETURNING *',
      [name.trim(), is_active !== false, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Nigam not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update nigam' });
  }
});

// DELETE /api/geo/nigams/:id  — soft delete
router.delete('/nigams/:id', auth, superAdminOnly, async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT COUNT(*) FROM pets p JOIN wards w ON w.id=p.ward_id WHERE w.nigam_id=$1',
      [req.params.id]
    );
    if (parseInt(rows[0].count) > 0)
      return res.status(400).json({ error: `Cannot deactivate — ${rows[0].count} pets exist in this nigam` });
    await query('UPDATE nigams SET is_active=false WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to deactivate nigam' });
  }
});

// ── WARDS ─────────────────────────────────────────────────────────

// GET /api/geo/wards?nigamId=1  — public (registration dropdown)
router.get('/wards', async (req, res) => {
  try {
    const { nigamId } = req.query;
    const { rows } = await query(
      'SELECT id, ward_number, nigam_id FROM wards WHERE nigam_id=$1 AND is_active=true ORDER BY ward_number',
      [nigamId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch wards' });
  }
});

// GET /api/geo/wards/all?nigamId=1&cityId=1  — super_admin
router.get('/wards/all', auth, superAdminOnly, async (req, res) => {
  try {
    const { nigamId, cityId } = req.query;
    let sql = `
      SELECT w.*, n.name AS nigam_name, c.name AS city_name,
        COUNT(DISTINCT p.id) AS pet_count
      FROM wards w
      LEFT JOIN nigams n ON n.id = w.nigam_id
      LEFT JOIN cities c ON c.id = n.city_id
      LEFT JOIN pets   p ON p.ward_id = w.id
    `;
    const params = [];
    if (nigamId)     { sql += ' WHERE w.nigam_id=$1'; params.push(nigamId); }
    else if (cityId) { sql += ' WHERE n.city_id=$1';  params.push(cityId); }
    sql += ' GROUP BY w.id, n.name, c.name ORDER BY c.name, n.name, w.ward_number';
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch wards' });
  }
});

// POST /api/geo/wards  — super_admin only
router.post('/wards', auth, superAdminOnly, async (req, res) => {
  try {
    const { wardNumber, nigamId } = req.body;
    if (!wardNumber || !nigamId) return res.status(400).json({ error: 'Ward number and nigam are required' });
    const dup = await query(
      'SELECT id FROM wards WHERE LOWER(ward_number)=LOWER($1) AND nigam_id=$2',
      [wardNumber, nigamId]
    );
    if (dup.rows.length) return res.status(409).json({ error: `Ward "${wardNumber}" already exists in this nigam` });
    const { rows } = await query(
      'INSERT INTO wards (ward_number, nigam_id) VALUES ($1, $2) RETURNING *',
      [wardNumber.trim(), nigamId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add ward' });
  }
});

// PUT /api/geo/wards/:id  — super_admin only
router.put('/wards/:id', auth, superAdminOnly, async (req, res) => {
  try {
    const { wardNumber, is_active } = req.body;
    if (!wardNumber) return res.status(400).json({ error: 'Ward number is required' });
    const { rows } = await query(
      'UPDATE wards SET ward_number=$1, is_active=$2 WHERE id=$3 RETURNING *',
      [wardNumber.trim(), is_active !== false, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Ward not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update ward' });
  }
});

// DELETE /api/geo/wards/:id  — soft delete
router.delete('/wards/:id', auth, superAdminOnly, async (req, res) => {
  try {
    const { rows } = await query('SELECT COUNT(*) FROM pets WHERE ward_id=$1', [req.params.id]);
    if (parseInt(rows[0].count) > 0)
      return res.status(400).json({ error: `Cannot deactivate — ${rows[0].count} pets exist in this ward` });
    await query('UPDATE wards SET is_active=false WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to deactivate ward' });
  }
});

module.exports = router;
