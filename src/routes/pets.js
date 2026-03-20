const router = require('express').Router();
const { query } = require('../db/pool');
const { auth, adminOnly } = require('../middleware/auth');

const PET_SELECT = `
  SELECT p.*,
    u.name  AS owner_name, u.mobile AS owner_mobile,
    w.ward_number,
    n.name  AS nigam_name,
    c.name  AS city_name
  FROM pets p
  LEFT JOIN users  u ON u.id = p.owner_id
  LEFT JOIN wards  w ON w.id = p.ward_id
  LEFT JOIN nigams n ON n.id = p.nigam_id
  LEFT JOIN cities c ON c.id = p.city_id
`;

// GET /api/pets/my  — citizen's own pets
router.get('/my', auth, async (req, res) => {
  try {
    const { rows } = await query(
      `${PET_SELECT} WHERE p.owner_id=$1 ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pets' });
  }
});

// GET /api/pets/search?q=Bruno&cityId=1
router.get('/search', auth, async (req, res) => {
  try {
    const { q = '', cityId } = req.query;
    const like = `%${q}%`;
    let sql = `${PET_SELECT}
      WHERE (p.name ILIKE $1 OR p.pet_id ILIKE $1 OR u.name ILIKE $1 OR p.breed ILIKE $1)`;
    const params = [like];
    if (cityId) { sql += ` AND p.city_id=$${params.length + 1}`; params.push(cityId); }
    sql += ' ORDER BY p.name LIMIT 50';
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// GET /api/pets/pending  — admin: get pending pets for their ward
router.get('/pending', auth, adminOnly(), async (req, res) => {
  try {
    const { wardId } = req.user;
    // super_admin sees all pending
    const isSuperAdmin = req.user.role === 'super_admin';
    let sql = `${PET_SELECT} WHERE p.registration_status='pending'`;
    const params = [];
    if (!isSuperAdmin) {
      sql += ` AND p.ward_id=$1`;
      params.push(wardId);
    }
    sql += ' ORDER BY p.created_at ASC';
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pending pets' });
  }
});

// GET /api/pets/stats  — meter stats
router.get('/stats', auth, async (req, res) => {
  try {
    const total   = await query("SELECT COUNT(*) FROM pets");
    const active  = await query("SELECT COUNT(*) FROM pets WHERE licence_status='active'");
    const pending = await query("SELECT COUNT(*) FROM pets WHERE registration_status='pending'");
    const cities  = await query(`
      SELECT c.name, COUNT(p.id) AS total,
        SUM(CASE WHEN p.species='dog' THEN 1 ELSE 0 END) AS dogs,
        SUM(CASE WHEN p.species='cat' THEN 1 ELSE 0 END) AS cats,
        SUM(CASE WHEN p.species NOT IN ('dog','cat') THEN 1 ELSE 0 END) AS others,
        SUM(CASE WHEN p.licence_status='active' THEN 1 ELSE 0 END) AS licensed
      FROM cities c LEFT JOIN pets p ON p.city_id=c.id
      WHERE c.is_active=true GROUP BY c.id, c.name ORDER BY total DESC
    `);
    res.json({
      totalPets:     parseInt(total.rows[0].count),
      activeLicences:parseInt(active.rows[0].count),
      pendingCount:  parseInt(pending.rows[0].count),
      cities: cities.rows,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/pets/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await query(`${PET_SELECT} WHERE p.id=$1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Pet not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pet' });
  }
});

// POST /api/pets  — register new pet
router.post('/', auth, async (req, res) => {
  try {
    const { name, species, breed, colour, gender, dateOfBirth } = req.body;
    if (!name || !species || !breed || !colour || !gender || !dateOfBirth) {
      return res.status(400).json({ error: 'All fields required' });
    }
    const { wardId, nigamId, cityId, id: ownerId } = req.user;
    const { rows } = await query(
      `INSERT INTO pets (name,species,breed,colour,gender,date_of_birth,owner_id,ward_id,nigam_id,city_id,registration_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending') RETURNING *`,
      [name, species, breed, colour, gender, dateOfBirth, ownerId, wardId, nigamId, cityId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to register pet' });
  }
});

// PATCH /api/pets/:id/approve  — admin approves pet
router.patch('/:id/approve', auth, adminOnly(), async (req, res) => {
  try {
    const petId = parseInt(req.params.id);
    // Get pet's city for code
    const petRes = await query(
      'SELECT p.*, c.name as city_name FROM pets p JOIN cities c ON c.id=p.city_id WHERE p.id=$1',
      [petId]
    );
    if (!petRes.rows.length) return res.status(404).json({ error: 'Pet not found' });
    const pet     = petRes.rows[0];
    const code    = pet.city_name.substring(0, 2).toUpperCase();
    const year    = new Date().getFullYear();
    const genId   = `AFP-${code}-${year}-${String(petId).padStart(4, '0')}`;
    const expiry  = new Date(); expiry.setFullYear(expiry.getFullYear() + 1);

    const { rows } = await query(
      `UPDATE pets SET
        registration_status='approved', pet_id=$1,
        licence_status='active', licence_expiry_date=$2,
        admin_note=$3, updated_at=NOW()
       WHERE id=$4 RETURNING *`,
      [genId, expiry.toISOString().split('T')[0], req.body.note || null, petId]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Approval failed' });
  }
});

// PATCH /api/pets/:id/reject  — admin rejects pet
router.patch('/:id/reject', auth, adminOnly(), async (req, res) => {
  try {
    const { note } = req.body;
    if (!note) return res.status(400).json({ error: 'Rejection note required' });
    const { rows } = await query(
      `UPDATE pets SET registration_status='rejected', admin_note=$1, updated_at=NOW()
       WHERE id=$2 RETURNING *`,
      [note, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Pet not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Rejection failed' });
  }
});

// PATCH /api/pets/:id/renew  — renew licence
router.patch('/:id/renew', auth, async (req, res) => {
  try {
    const expiry = new Date(); expiry.setFullYear(expiry.getFullYear() + 1);
    const { rows } = await query(
      `UPDATE pets SET licence_status='active', licence_expiry_date=$1,
        registration_status='approved', updated_at=NOW()
       WHERE id=$2 AND owner_id=$3 RETURNING *`,
      [expiry.toISOString().split('T')[0], req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Pet not found or not authorized' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Renewal failed' });
  }
});

module.exports = router;
