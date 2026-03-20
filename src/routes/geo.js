const router = require('express').Router();
const { query } = require('../db/pool');

// GET /api/geo/cities
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

// GET /api/geo/nigams?cityId=1
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

// GET /api/geo/wards?nigamId=1
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

module.exports = router;
