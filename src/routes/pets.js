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

// GET /api/pets/my
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

// GET /api/pets/search
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

// GET /api/pets/pending
router.get('/pending', auth, adminOnly(), async (req, res) => {
  try {
    const { wardId } = req.user;
    const isSuperAdmin = req.user.role === 'super_admin';
    let sql = `${PET_SELECT} WHERE p.registration_status='pending'`;
    const params = [];
    if (!isSuperAdmin) { sql += ` AND p.ward_id=$1`; params.push(wardId); }
    sql += ' ORDER BY p.created_at ASC';
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pending pets' });
  }
});

// GET /api/pets/stats
router.get('/stats', auth, async (req, res) => {
  try {
    const total   = await query("SELECT COUNT(*) FROM pets");
    const active  = await query("SELECT COUNT(*) FROM pets WHERE licence_status='active'");
    const pending = await query("SELECT COUNT(*) FROM pets WHERE registration_status='pending'");
    const cities  = await query(`
      SELECT c.name, COUNT(p.id) AS total,
        SUM(CASE WHEN p.species='dog'  THEN 1 ELSE 0 END) AS dogs,
        SUM(CASE WHEN p.species='cat'  THEN 1 ELSE 0 END) AS cats,
        SUM(CASE WHEN p.species NOT IN ('dog','cat') THEN 1 ELSE 0 END) AS others,
        SUM(CASE WHEN p.licence_status='active' THEN 1 ELSE 0 END) AS licensed
      FROM cities c LEFT JOIN pets p ON p.city_id=c.id
      WHERE c.is_active=true GROUP BY c.id, c.name ORDER BY total DESC
    `);
    res.json({
      totalPets:      parseInt(total.rows[0].count),
      activeLicences: parseInt(active.rows[0].count),
      pendingCount:   parseInt(pending.rows[0].count),
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

// POST /api/pets — register new pet (with optional base64 photo + cert)
router.post('/', auth, async (req, res) => {
  try {
    const { name, species, breed, colour, gender, dateOfBirth,
            photoBase64, certificateBase64 } = req.body;
    if (!name || !species || !breed || !colour || !gender || !dateOfBirth) {
      return res.status(400).json({ error: 'All fields required' });
    }

    // Validate base64 size — max 2MB each (base64 of 2MB ≈ 2.7M chars)
    if (photoBase64 && photoBase64.length > 3_000_000) {
      return res.status(400).json({ error: 'Pet photo must be under 2MB' });
    }
    if (certificateBase64 && certificateBase64.length > 3_000_000) {
      return res.status(400).json({ error: 'Certificate must be under 2MB' });
    }

    const { wardId, nigamId, cityId, id: ownerId } = req.user;
    const { rows } = await query(
      `INSERT INTO pets
        (name, species, breed, colour, gender, date_of_birth,
         photo_url, certificate_url,
         owner_id, ward_id, nigam_id, city_id, registration_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending')
       RETURNING *`,
      [name, species, breed, colour, gender, dateOfBirth,
       photoBase64 || null,
       certificateBase64 || null,
       ownerId, wardId, nigamId, cityId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to register pet' });
  }
});

// PATCH /api/pets/:id/upload — upload/update photo or certificate after registration
router.patch('/:id/upload', auth, async (req, res) => {
  try {
    const { photoBase64, certificateBase64 } = req.body;
    const petId = req.params.id;

    // Verify ownership
    const check = await query(
      'SELECT id, owner_id FROM pets WHERE id=$1', [petId]
    );
    if (!check.rows.length) return res.status(404).json({ error: 'Pet not found' });
    if (check.rows[0].owner_id !== req.user.id && req.user.role === 'citizen') {
      return res.status(403).json({ error: 'Not your pet' });
    }

    if (photoBase64 && photoBase64.length > 3_000_000) {
      return res.status(400).json({ error: 'Pet photo must be under 2MB' });
    }
    if (certificateBase64 && certificateBase64.length > 3_000_000) {
      return res.status(400).json({ error: 'Certificate must be under 2MB' });
    }

    // Build dynamic update — only update fields that were sent
    const updates = [];
    const params  = [];
    if (photoBase64 !== undefined) {
      params.push(photoBase64 || null);
      updates.push(`photo_url=$${params.length}`);
    }
    if (certificateBase64 !== undefined) {
      params.push(certificateBase64 || null);
      updates.push(`certificate_url=$${params.length}`);
    }
    if (!updates.length) {
      return res.status(400).json({ error: 'No file data provided' });
    }
    params.push(petId);
    updates.push('updated_at=NOW()');

    const { rows } = await query(
      `UPDATE pets SET ${updates.join(', ')} WHERE id=$${params.length} RETURNING id, name, photo_url, certificate_url`,
      params
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// PATCH /api/pets/:id/approve
router.patch('/:id/approve', auth, adminOnly(), async (req, res) => {
  try {
    const petId = parseInt(req.params.id);
    const petRes = await query(
      'SELECT p.*, c.name as city_name FROM pets p JOIN cities c ON c.id=p.city_id WHERE p.id=$1',
      [petId]
    );
    if (!petRes.rows.length) return res.status(404).json({ error: 'Pet not found' });
    const pet    = petRes.rows[0];
    const code   = pet.city_name.substring(0, 2).toUpperCase();
    const year   = new Date().getFullYear();
    const genId  = `AFP-${code}-${year}-${String(petId).padStart(4, '0')}`;
    const expiry = new Date(); expiry.setFullYear(expiry.getFullYear() + 1);
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

// PATCH /api/pets/:id/reject
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

// PATCH /api/pets/:id/renew
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

// ── FILE UPLOAD ROUTES (multer multipart) ─────────────────────────

const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

// Store uploads in /uploads directory, keep original extension
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || (file.mimetype === 'application/pdf' ? '.pdf' : '.jpg');
    cb(null, `pet_${req.params.id}_${file.fieldname}_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg','image/png','image/jpg','application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, PNG, and PDF files are allowed'));
  }
});

// POST /api/pets/:id/upload-photo
router.post('/:id/upload-photo', auth, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No photo file provided' });

    // Verify ownership
    const check = await query('SELECT id, owner_id FROM pets WHERE id=$1', [req.params.id]);
    if (!check.rows.length) return res.status(404).json({ error: 'Pet not found' });
    if (check.rows[0].owner_id !== req.user.id && req.user.role === 'citizen') {
      return res.status(403).json({ error: 'Not your pet' });
    }

    // Build public URL
    const photoUrl = `/uploads/${req.file.filename}`;
    const { rows } = await query(
      'UPDATE pets SET photo_url=$1, updated_at=NOW() WHERE id=$2 RETURNING id, name, photo_url',
      [photoUrl, req.params.id]
    );
    res.json({ success: true, photo_url: rows[0].photo_url, pet: rows[0] });
  } catch (err) {
    console.error('Photo upload error:', err);
    res.status(500).json({ error: err.message || 'Photo upload failed' });
  }
});

// POST /api/pets/:id/upload-certificate
router.post('/:id/upload-certificate', auth, upload.single('certificate'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No certificate file provided' });

    const check = await query('SELECT id, owner_id FROM pets WHERE id=$1', [req.params.id]);
    if (!check.rows.length) return res.status(404).json({ error: 'Pet not found' });
    if (check.rows[0].owner_id !== req.user.id && req.user.role === 'citizen') {
      return res.status(403).json({ error: 'Not your pet' });
    }

    const certUrl = `/uploads/${req.file.filename}`;
    const { rows } = await query(
      'UPDATE pets SET certificate_url=$1, updated_at=NOW() WHERE id=$2 RETURNING id, name, certificate_url',
      [certUrl, req.params.id]
    );
    res.json({ success: true, certificate_url: rows[0].certificate_url, pet: rows[0] });
  } catch (err) {
    console.error('Certificate upload error:', err);
    res.status(500).json({ error: err.message || 'Certificate upload failed' });
  }
});
