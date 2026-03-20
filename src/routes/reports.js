const router = require('express').Router();
const { query } = require('../db/pool');
const { auth } = require('../middleware/auth');

// POST /api/reports
router.post('/', auth, async (req, res) => {
  try {
    const { reportType, petName, species, breed, colour,
      lastSeenAddress, reporterMobile } = req.body;
    if (!reportType || !lastSeenAddress || !reporterMobile) {
      return res.status(400).json({ error: 'Report type, address and mobile required' });
    }
    const { wardId, cityId, id: reportedBy } = req.user;
    const { rows } = await query(
      `INSERT INTO pet_reports
        (report_type,pet_name,species,breed,colour,last_seen_address,ward_id,city_id,reporter_mobile,reported_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [reportType, petName, species, breed, colour, lastSeenAddress, wardId, cityId, reporterMobile, reportedBy]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

module.exports = router;
