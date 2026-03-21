const router = require('express').Router();
const { query } = require('../db/pool');
const { auth, adminOnly } = require('../middleware/auth');

const DOC_SELECT = `
  SELECT d.*,
    w.ward_number,
    n.name AS nigam_name,
    c.name AS city_name
  FROM doctors d
  LEFT JOIN wards  w ON w.id = d.ward_id
  LEFT JOIN nigams n ON n.id = d.nigam_id
  LEFT JOIN cities c ON c.id = d.city_id
`;

// GET /api/doctors?cityId=1&q=Verma
router.get('/', auth, async (req, res) => {
  try {
    const { cityId, q = '' } = req.query;
    const like = `%${q}%`;
    let sql = `${DOC_SELECT} WHERE d.is_available=true`;
    const params = [];
    if (cityId) { sql += ` AND d.city_id=$${params.length+1}`; params.push(cityId); }
    if (q)      { sql += ` AND (d.name ILIKE $${params.length+1} OR d.clinic_name ILIKE $${params.length+1} OR d.specialization ILIKE $${params.length+1})`; params.push(like); }
    sql += ' ORDER BY d.name';
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch doctors' });
  }
});

// GET /api/doctors/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await query(`${DOC_SELECT} WHERE d.id=$1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Doctor not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch doctor' });
  }
});

// POST /api/doctors  — admin adds a doctor
router.post('/', auth, adminOnly(), async (req, res) => {
  try {
    const { name, qualification, specialization, clinicName, address,
      mobile, email, wardId, nigamId, cityId, timings, is24hr } = req.body;
    if (!name || !mobile || !address) {
      return res.status(400).json({ error: 'Name, mobile and address are required' });
    }
    const { rows } = await query(
      `INSERT INTO doctors
        (name,qualification,specialization,clinic_name,address,mobile,email,
         ward_id,nigam_id,city_id,timings,is_24hr,added_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [name, qualification, specialization, clinicName, address,
       mobile, email, wardId, nigamId, cityId, timings, is24hr || false, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add doctor' });
  }
});

// PUT /api/doctors/:id  — admin edits a doctor
router.put('/:id', auth, adminOnly(), async (req, res) => {
  try {
    const { name, qualification, specialization, clinicName, address,
      mobile, email, timings, is24hr, isAvailable } = req.body;
    const { rows } = await query(
      `UPDATE doctors SET
        name=$1, qualification=$2, specialization=$3, clinic_name=$4, address=$5,
        mobile=$6, email=$7, timings=$8, is_24hr=$9, is_available=$10, updated_at=NOW()
       WHERE id=$11 RETURNING *`,
      [name, qualification, specialization, clinicName, address,
       mobile, email, timings, is24hr, isAvailable !== false, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Doctor not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update doctor' });
  }
});

// DELETE /api/doctors/:id  — admin removes a doctor
router.delete('/:id', auth, adminOnly(), async (req, res) => {
  try {
    await query('UPDATE doctors SET is_available=false WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove doctor' });
  }
});

module.exports = router;
