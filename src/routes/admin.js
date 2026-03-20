const router = require('express').Router();
const { query } = require('../db/pool');
const { auth, adminOnly } = require('../middleware/auth');

// GET /api/admin/stats  — ward/city stats for admin dashboard
router.get('/stats', auth, adminOnly(), async (req, res) => {
  try {
    const { wardId, cityId, role } = req.user;
    const isSuperAdmin = role === 'super_admin';

    // Ward-level
    const wardFilter = isSuperAdmin ? '' : `WHERE p.ward_id=${wardId}`;
    const total   = await query(`SELECT COUNT(*) FROM pets p ${wardFilter}`);
    const pending = await query(`SELECT COUNT(*) FROM pets p ${wardFilter} ${wardFilter ? 'AND' : 'WHERE'} registration_status='pending'`);
    const approved= await query(`SELECT COUNT(*) FROM pets p ${wardFilter} ${wardFilter ? 'AND' : 'WHERE'} registration_status='approved'`);

    // Cities overview (super admin only)
    let cities = [];
    if (isSuperAdmin) {
      const res2 = await query(`
        SELECT c.id, c.name, c.state,
          COUNT(DISTINCT n.id) AS nigam_count,
          COUNT(DISTINCT w.id) AS ward_count,
          COUNT(DISTINCT p.id) AS pet_count,
          SUM(CASE WHEN p.licence_status='active' THEN 1 ELSE 0 END) AS licensed_count
        FROM cities c
        LEFT JOIN nigams n ON n.city_id=c.id
        LEFT JOIN wards  w ON w.nigam_id=n.id
        LEFT JOIN pets   p ON p.city_id=c.id
        GROUP BY c.id, c.name, c.state ORDER BY pet_count DESC
      `);
      cities = res2.rows;
    }

    res.json({
      total:    parseInt(total.rows[0].count),
      pending:  parseInt(pending.rows[0].count),
      approved: parseInt(approved.rows[0].count),
      cities,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

// GET /api/admin/pets  — all pets for admin's city
router.get('/pets', auth, adminOnly(), async (req, res) => {
  try {
    const { cityId, wardId, role } = req.user;
    const isSuperAdmin = role === 'super_admin';
    let sql = `
      SELECT p.*, u.name AS owner_name, w.ward_number, n.name AS nigam_name, c.name AS city_name
      FROM pets p
      LEFT JOIN users  u ON u.id=p.owner_id
      LEFT JOIN wards  w ON w.id=p.ward_id
      LEFT JOIN nigams n ON n.id=p.nigam_id
      LEFT JOIN cities c ON c.id=p.city_id
    `;
    const params = [];
    if (!isSuperAdmin) {
      sql += ` WHERE p.city_id=$1`; params.push(cityId);
    }
    sql += ' ORDER BY p.created_at DESC LIMIT 100';
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pets' });
  }
});

module.exports = router;
