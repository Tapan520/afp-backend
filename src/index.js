require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const app = express();

// ── MIDDLEWARE ────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir));

// ── HEALTH ────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), app: 'All For Pets API' });
});

// ── ROUTES ────────────────────────────────────────────────────────
app.use('/api/auth',    require('./routes/auth'));
app.use('/api/geo',     require('./routes/geo'));
app.use('/api/pets',    require('./routes/pets'));
app.use('/api/doctors', require('./routes/doctors'));
app.use('/api/shops',   require('./routes/shops'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/admin',   require('./routes/admin'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});
app.use((req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
});

// ── AUTO INIT DB ──────────────────────────────────────────────────
async function initDB() {
  const { pool } = require('./db/pool');
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS cities (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE,
        state TEXT NOT NULL, is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS nigams (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL,
        city_id INT REFERENCES cities(id), is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS wards (
        id SERIAL PRIMARY KEY, ward_number TEXT NOT NULL,
        nigam_id INT REFERENCES nigams(id), is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL,
        mobile TEXT NOT NULL UNIQUE, email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL, address TEXT NOT NULL,
        ward_id INT, nigam_id INT, city_id INT,
        role TEXT NOT NULL DEFAULT 'citizen'
          CHECK (role IN ('citizen','ward_admin','nigam_admin','city_admin','super_admin')),
        is_verified BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS pets (
        id SERIAL PRIMARY KEY, pet_id TEXT UNIQUE,
        name TEXT NOT NULL, species TEXT NOT NULL, breed TEXT NOT NULL,
        colour TEXT NOT NULL, gender TEXT NOT NULL, date_of_birth DATE NOT NULL,
        photo_url TEXT, certificate_url TEXT, owner_id INT REFERENCES users(id),
        ward_id INT, nigam_id INT, city_id INT,
        registration_status TEXT NOT NULL DEFAULT 'pending'
          CHECK (registration_status IN ('pending','approved','rejected')),
        licence_status TEXT, licence_expiry_date DATE,
        vaccine_next_due DATE, admin_note TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS doctors (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL,
        qualification TEXT, specialization TEXT, clinic_name TEXT,
        address TEXT, mobile TEXT NOT NULL, email TEXT,
        ward_id INT, nigam_id INT, city_id INT,
        timings TEXT, is_24hr BOOLEAN DEFAULT false,
        is_available BOOLEAN DEFAULT true, added_by INT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS food_shops (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, owner_name TEXT,
        address TEXT NOT NULL, mobile TEXT NOT NULL, email TEXT,
        ward_id INT, nigam_id INT, city_id INT,
        timings TEXT, speciality TEXT, is_active BOOLEAN DEFAULT true, added_by INT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS pet_reports (
        id SERIAL PRIMARY KEY, report_type TEXT NOT NULL,
        last_seen_address TEXT NOT NULL, reporter_mobile TEXT NOT NULL,
        ward_id INT, city_id INT, reported_by INT,
        status TEXT DEFAULT 'open', created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_pets_owner  ON pets(owner_id);
      CREATE INDEX IF NOT EXISTS idx_pets_status ON pets(registration_status);
      -- Add new columns safely (ignored if already exist)
      ALTER TABLE pets ADD COLUMN IF NOT EXISTS certificate_url TEXT;
      ALTER TABLE pets ADD COLUMN IF NOT EXISTS photo_url       TEXT;
      CREATE INDEX IF NOT EXISTS idx_users_mob   ON users(mobile);
    `);

    // Seed only once
    const { rows } = await client.query('SELECT COUNT(*) FROM cities');
    if (parseInt(rows[0].count) === 0) {
      const bcrypt = require('bcryptjs');
      const h = async p => bcrypt.hash(p, 10);

      await client.query(`INSERT INTO cities (name,state) VALUES
        ('Jaipur','Rajasthan'),('Delhi','Delhi'),('Mumbai','Maharashtra')`);

      await client.query(`INSERT INTO nigams (name,city_id) VALUES
        ('Jaipur Nagar Nigam Greater',1),('Jaipur Nagar Nigam Heritage',1),
        ('North Delhi Municipal Corp',2),('South Delhi Municipal Corp',2),
        ('Brihanmumbai Municipal Corp',3),('Thane Municipal Corp',3)`);

      await client.query(`INSERT INTO wards (ward_number,nigam_id) VALUES
        ('Ward 1',1),('Ward 2',1),('Ward 3',1),('Ward 5',1),('Ward 12',1),
        ('Ward 18',1),('Ward 27',1),('Ward 4',3),('Ward 8',3),
        ('Ward 3',5),('Ward 7',5)`);

      await client.query(
        `INSERT INTO users (name,mobile,email,password_hash,address,ward_id,nigam_id,city_id,role)
         VALUES ($1,$2,$3,$4,$5,5,1,1,'citizen'),
                ($6,$7,$8,$9,$10,5,1,1,'ward_admin'),
                ($11,$12,$13,$14,$15,1,1,1,'super_admin')`,
        [
          'Rahul Sharma','9876543210','rahul@example.com', await h('demo1234'), '12 Shyam Nagar, Jaipur',
          'Admin Officer','9000000001','admin@jaipur.gov.in', await h('admin1234'), 'Municipal Office',
          'Super Admin','9000000002','super@allforpets.gov.in', await h('super1234'), 'HQ',
        ]
      );

      await client.query(`
        INSERT INTO pets (pet_id,name,species,breed,colour,gender,date_of_birth,owner_id,ward_id,nigam_id,city_id,registration_status,licence_status,licence_expiry_date,vaccine_next_due)
        VALUES
          ('AFP-JP-2024-0042','Bruno','dog','Golden Retriever','Golden','male','2022-01-15',1,5,1,1,'approved','active','2025-03-31','2025-04-15'),
          (NULL,'Luna','cat','Persian','White','female','2023-06-01',1,5,1,1,'pending',NULL,NULL,NULL),
          ('AFP-JP-2024-0108','Max','dog','Labrador','Black','male','2021-03-20',1,4,1,1,'approved','active','2025-06-01',NULL),
          (NULL,'Rocky','dog','German Shepherd','Black & Tan','male','2023-01-10',1,5,1,1,'pending',NULL,NULL,NULL)
      `);

      await client.query(`
        INSERT INTO doctors (name,qualification,specialization,clinic_name,address,mobile,ward_id,nigam_id,city_id,timings,is_24hr,added_by)
        VALUES
          ('Dr. Rajesh Verma','BVSc, MVSc','Small animals','Verma Pet Clinic','B-42, Shyam Nagar, Ward 12','9800011111',5,1,1,'9am-7pm (Mon-Sat)',false,2),
          ('Dr. Priya Nair','BVSc','All pets','Nair Animal Hospital','C-10, Vaishali Nagar','9800022222',4,1,1,'24 hours',true,2),
          ('Dr. Suresh Kumar','BVSc, PhD','Large & exotic','Kumar Vet Centre','A-8, Lajpat Nagar','9811234567',8,3,2,'10am-5pm (Mon-Fri)',false,2),
          ('Dr. Meera Shah','MVSc (Surgery)','Surgery specialist','Shah Pet Surgery','D-5, Andheri','9922334455',10,5,3,'9am-6pm (Mon-Sat)',false,2)
      `);

      await client.query(`
        INSERT INTO food_shops (name,owner_name,address,mobile,ward_id,nigam_id,city_id,timings,speciality,added_by)
        VALUES
          ('Paws & Claws Pet Store','Amit Jain','Shop 12, MI Road, Ward 12','9911000001',5,1,1,'9am-9pm','Dog food, cat food, accessories',2),
          ('Happy Tails Pet Shop','Sunita Gupta','B-5, Vaishali Nagar','9911000002',4,1,1,'10am-8pm','Premium pet food, toys',2),
          ('Pet Kingdom','Ravi Sharma','A-1, Nehru Nagar','9911000003',8,3,2,'9am-9pm','All pet food, grooming',2),
          ('Animal Lovers Store','Meena Patel','C-10, Bandra','9911000004',10,5,3,'10am-9pm','Imported pet food',2)
      `);

      console.log('✅ Demo data seeded');
    }
    console.log('✅ Database ready');
  } catch (err) {
    console.error('❌ DB init error:', err.message);
  } finally {
    client.release();
  }
}

// ── START ─────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3000');
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`\n🐾 All For Pets API — port ${PORT}`);
  console.log(`   DB: ${process.env.DATABASE_URL ? 'Railway PostgreSQL ✅' : 'Local PostgreSQL'}`);
  await initDB();
});

module.exports = app;
