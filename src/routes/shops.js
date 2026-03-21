const router = require('express').Router();
const { query } = require('../db/pool');
const { auth, adminOnly } = require('../middleware/auth');

const SHOP_SELECT = `
  SELECT s.*,
    w.ward_number,
    n.name AS nigam_name,
    c.name AS city_name
  FROM food_shops s
  LEFT JOIN wards  w ON w.id = s.ward_id
  LEFT JOIN nigams n ON n.id = s.nigam_id
  LEFT JOIN cities c ON c.id = s.city_id
`;

// GET /api/shops?cityId=1&q=Paws
router.get('/', auth, async (req, res) => {
  try {
    const { cityId, q = '' } = req.query;
    const like = `%${q}%`;
    let sql = `${SHOP_SELECT} WHERE s.is_active=true`;
    const params = [];
    if (cityId) { sql += ` AND s.city_id=$${params.length+1}`; params.push(cityId); }
    if (q)      { sql += ` AND (s.name ILIKE $${params.length+1} OR s.speciality ILIKE $${params.length+1} OR s.address ILIKE $${params.length+1})`; params.push(like); }
    sql += ' ORDER BY s.name';
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch shops' });
  }
});

// GET /api/shops/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await query(`${SHOP_SELECT} WHERE s.id=$1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Shop not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch shop' });
  }
});

// POST /api/shops  — admin adds a shop
router.post('/', auth, adminOnly(), async (req, res) => {
  try {
    const { name, ownerName, address, mobile, email,
      wardId, nigamId, cityId, timings, speciality } = req.body;
    if (!name || !mobile || !address) {
      return res.status(400).json({ error: 'Name, mobile and address are required' });
    }
    const { rows } = await query(
      `INSERT INTO food_shops
        (name,owner_name,address,mobile,email,ward_id,nigam_id,city_id,timings,speciality,added_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [name, ownerName, address, mobile, email, wardId, nigamId, cityId, timings, speciality, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add shop' });
  }
});

// PUT /api/shops/:id
router.put('/:id', auth, adminOnly(), async (req, res) => {
  try {
    const { name, ownerName, address, mobile, email, timings, speciality, isActive } = req.body;
    const { rows } = await query(
      `UPDATE food_shops SET
        name=$1, owner_name=$2, address=$3, mobile=$4, email=$5,
        timings=$6, speciality=$7, is_active=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [name, ownerName, address, mobile, email, timings, speciality, isActive !== false, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Shop not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update shop' });
  }
});

// DELETE /api/shops/:id
router.delete('/:id', auth, adminOnly(), async (req, res) => {
  try {
    await query('UPDATE food_shops SET is_active=false WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove shop' });
  }
});

module.exports = router;
