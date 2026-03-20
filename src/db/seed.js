require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('./pool');

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Seeding database...');
    await client.query('BEGIN');

    // Check if already seeded
    const { rows } = await client.query('SELECT COUNT(*) FROM cities');
    if (parseInt(rows[0].count) > 0) {
      console.log('Database already seeded. Skipping.');
      await client.query('ROLLBACK');
      return;
    }

    // ── CITIES ────────────────────────────────────────────────────
    const { rows: cities } = await client.query(`
      INSERT INTO cities (name, state) VALUES
        ('Jaipur', 'Rajasthan'),
        ('Delhi',  'Delhi'),
        ('Mumbai', 'Maharashtra')
      RETURNING id, name
    `);
    const cityMap = Object.fromEntries(cities.map(c => [c.name, c.id]));

    // ── NIGAMS ────────────────────────────────────────────────────
    const { rows: nigams } = await client.query(`
      INSERT INTO nigams (name, city_id) VALUES
        ('Jaipur Nagar Nigam Greater',  ${cityMap['Jaipur']}),
        ('Jaipur Nagar Nigam Heritage', ${cityMap['Jaipur']}),
        ('North Delhi Municipal Corp',  ${cityMap['Delhi']}),
        ('South Delhi Municipal Corp',  ${cityMap['Delhi']}),
        ('East Delhi Municipal Corp',   ${cityMap['Delhi']}),
        ('Brihanmumbai Municipal Corp', ${cityMap['Mumbai']}),
        ('Thane Municipal Corp',        ${cityMap['Mumbai']})
      RETURNING id, name
    `);
    const nigamMap = Object.fromEntries(nigams.map(n => [n.name, n.id]));

    // ── WARDS ─────────────────────────────────────────────────────
    const jnn = nigamMap['Jaipur Nagar Nigam Greater'];
    const ndm = nigamMap['North Delhi Municipal Corp'];
    const bmc = nigamMap['Brihanmumbai Municipal Corp'];

    const { rows: wards } = await client.query(`
      INSERT INTO wards (ward_number, nigam_id) VALUES
        ('Ward 1',  ${jnn}), ('Ward 2',  ${jnn}), ('Ward 3',  ${jnn}),
        ('Ward 5',  ${jnn}), ('Ward 12', ${jnn}), ('Ward 18', ${jnn}), ('Ward 27', ${jnn}),
        ('Ward 4',  ${ndm}), ('Ward 8',  ${ndm}), ('Ward 15', ${ndm}),
        ('Ward 3',  ${bmc}), ('Ward 7',  ${bmc})
      RETURNING id, ward_number, nigam_id
    `);
    // Ward 12 of JNN Greater (index 4, 0-based) = ward_id for demo citizen
    const ward12 = wards.find(w => w.ward_number === 'Ward 12' && w.nigam_id === jnn);
    const ward5  = wards.find(w => w.ward_number === 'Ward 5'  && w.nigam_id === jnn);
    const ward4  = wards.find(w => w.ward_number === 'Ward 4'  && w.nigam_id === ndm);
    const ward3B = wards.find(w => w.ward_number === 'Ward 3'  && w.nigam_id === bmc);

    // ── USERS ─────────────────────────────────────────────────────
    const hash = async pw => bcrypt.hash(pw, 10);

    const { rows: users } = await client.query(`
      INSERT INTO users (name, mobile, email, password_hash, address, ward_id, nigam_id, city_id, role) VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,'citizen'),
        ($9,$10,$11,$12,$13,$14,$15,$16,'ward_admin'),
        ($17,$18,$19,$20,$21,$22,$23,$24,'super_admin')
      RETURNING id, name, role
    `, [
      'Rahul Sharma', '9876543210', 'rahul@example.com', await hash('demo1234'),
        '12 Shyam Nagar, Jaipur', ward12.id, jnn, cityMap['Jaipur'],
      'Admin Officer', '9000000001', 'admin@jaipur.gov.in', await hash('admin1234'),
        'Municipal Office', ward12.id, jnn, cityMap['Jaipur'],
      'Super Admin', '9000000002', 'super@allforpets.gov.in', await hash('super1234'),
        'HQ Delhi', ward4.id, ndm, cityMap['Delhi'],
    ]);
    const citizen   = users.find(u => u.role === 'citizen');
    const wardAdmin = users.find(u => u.role === 'ward_admin');

    // ── PETS ──────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO pets (pet_id,name,species,breed,colour,gender,date_of_birth,owner_id,ward_id,nigam_id,city_id,registration_status,licence_status,licence_expiry_date,vaccine_next_due) VALUES
        ('AFP-JP-2024-0042','Bruno','dog','Golden Retriever','Golden','male','2022-01-15',$1,$2,$3,$4,'approved','active','2025-03-31','2025-04-15'),
        (NULL,'Luna','cat','Persian','White','female','2023-06-01',$1,$2,$3,$4,'pending',NULL,NULL,NULL),
        ('AFP-JP-2024-0108','Max','dog','Labrador','Black','male','2021-03-20',$1,$5,$3,$4,'approved','active','2025-06-01',NULL),
        ('AFP-JP-2023-0814','Coco','cat','Persian','Gray','female','2021-07-12',$1,$2,$3,$4,'approved','expiring_soon','2025-04-01',NULL),
        (NULL,'Rocky','dog','German Shepherd','Black & Tan','male','2023-01-10',$1,$2,$3,$4,'pending',NULL,NULL,NULL),
        (NULL,'Simba','cat','Siamese','Cream','male','2023-11-05',$1,$2,$3,$4,'pending',NULL,NULL,NULL),
        (NULL,'Tweety','bird','Budgerigar','Green','female','2024-02-14',$1,$2,$3,$4,'pending',NULL,NULL,NULL)
    `, [citizen.id, ward12.id, jnn, cityMap['Jaipur'], ward5.id]);

    // ── DOCTORS ───────────────────────────────────────────────────
    await client.query(`
      INSERT INTO doctors (name,qualification,specialization,clinic_name,address,mobile,ward_id,nigam_id,city_id,timings,is_24hr,is_available,added_by) VALUES
        ('Dr. Rajesh Verma','BVSc, MVSc','Small animals','Verma Pet Clinic','B-42, Shyam Nagar, Ward 12','9800011111',$1,$2,$3,'9am-7pm (Mon-Sat)',false,true,$4),
        ('Dr. Priya Nair','BVSc','All pets','Nair Animal Hospital','C-10, Vaishali Nagar','9800022222',$5,$2,$3,'24 hours',true,true,$4),
        ('Dr. Suresh Kumar','BVSc, PhD','Large & exotic pets','Kumar Vet Centre','A-8, Lajpat Nagar','9811234567',$6,$7,$8,'10am-5pm (Mon-Fri)',false,true,$4),
        ('Dr. Meera Shah','MVSc (Surgery)','Surgery specialist','Shah Pet Surgery','D-5, Andheri','9922334455',$9,$10,$11,'9am-6pm (Mon-Sat)',false,true,$4)
    `, [
      ward12.id, jnn, cityMap['Jaipur'], wardAdmin.id,
      ward5.id,
      ward4.id, ndm, cityMap['Delhi'],
      ward3B.id, bmc, cityMap['Mumbai'],
    ]);

    // ── FOOD SHOPS ────────────────────────────────────────────────
    await client.query(`
      INSERT INTO food_shops (name,owner_name,address,mobile,ward_id,nigam_id,city_id,timings,speciality,is_active,added_by) VALUES
        ('Paws & Claws Pet Store','Amit Jain','Shop 12, MI Road, Ward 12','9911000001',$1,$2,$3,'9am-9pm','Dog food, cat food, accessories',true,$4),
        ('Happy Tails Pet Shop','Sunita Gupta','B-5, Vaishali Nagar, Ward 5','9911000002',$5,$2,$3,'10am-8pm','Premium pet food, toys',true,$4),
        ('Pet Kingdom','Ravi Sharma','A-1, Nehru Nagar','9911000003',$6,$7,$8,'9am-9pm','All pet food, grooming',true,$4),
        ('Animal Lovers Store','Meena Patel','C-10, Bandra, Ward 3','9911000004',$9,$10,$11,'10am-9pm','Imported pet food, accessories',true,$4)
    `, [
      ward12.id, jnn, cityMap['Jaipur'], wardAdmin.id,
      ward5.id,
      ward4.id, ndm, cityMap['Delhi'],
      ward3B.id, bmc, cityMap['Mumbai'],
    ]);

    await client.query('COMMIT');
    console.log('✅ Seed complete.');
    console.log('\nDemo credentials:');
    console.log('  Citizen:    9876543210 / demo1234');
    console.log('  Ward Admin: admin@jaipur.gov.in / admin1234');
    console.log('  Super Admin: super@allforpets.gov.in / super1234');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
