require('dotenv').config();
const { pool } = require('./pool');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running migrations...');

    await client.query(`
      -- EXTENSIONS
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      -- GEO HIERARCHY
      CREATE TABLE IF NOT EXISTS cities (
        id          SERIAL PRIMARY KEY,
        name        TEXT NOT NULL UNIQUE,
        state       TEXT NOT NULL,
        country     TEXT NOT NULL DEFAULT 'India',
        is_active   BOOLEAN DEFAULT true,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS nigams (
        id          SERIAL PRIMARY KEY,
        name        TEXT NOT NULL,
        city_id     INT NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
        is_active   BOOLEAN DEFAULT true,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS wards (
        id          SERIAL PRIMARY KEY,
        ward_number TEXT NOT NULL,
        nigam_id    INT NOT NULL REFERENCES nigams(id) ON DELETE CASCADE,
        is_active   BOOLEAN DEFAULT true,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );

      -- USERS
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL PRIMARY KEY,
        name          TEXT NOT NULL,
        mobile        TEXT NOT NULL UNIQUE,
        email         TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        address       TEXT NOT NULL,
        ward_id       INT REFERENCES wards(id),
        nigam_id      INT REFERENCES nigams(id),
        city_id       INT REFERENCES cities(id),
        role          TEXT NOT NULL DEFAULT 'citizen'
                        CHECK (role IN ('citizen','ward_admin','nigam_admin','city_admin','super_admin')),
        is_verified   BOOLEAN DEFAULT true,
        profile_photo TEXT,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      );

      -- PETS
      CREATE TABLE IF NOT EXISTS pets (
        id                    SERIAL PRIMARY KEY,
        pet_id                TEXT UNIQUE,
        name                  TEXT NOT NULL,
        species               TEXT NOT NULL CHECK (species IN ('dog','cat','rabbit','bird','other')),
        breed                 TEXT NOT NULL,
        colour                TEXT NOT NULL,
        gender                TEXT NOT NULL CHECK (gender IN ('male','female')),
        date_of_birth         DATE NOT NULL,
        photo_url             TEXT,
        certificate_url       TEXT,
        owner_id              INT NOT NULL REFERENCES users(id),
        ward_id               INT REFERENCES wards(id),
        nigam_id              INT REFERENCES nigams(id),
        city_id               INT REFERENCES cities(id),
        registration_status   TEXT NOT NULL DEFAULT 'pending'
                                CHECK (registration_status IN ('pending','approved','rejected')),
        licence_status        TEXT CHECK (licence_status IN ('active','expiring_soon','expired')),
        licence_expiry_date   DATE,
        vaccine_next_due      DATE,
        admin_note            TEXT,
        created_at            TIMESTAMPTZ DEFAULT NOW(),
        updated_at            TIMESTAMPTZ DEFAULT NOW()
      );

      -- DOCTORS (Vets)
      CREATE TABLE IF NOT EXISTS doctors (
        id              SERIAL PRIMARY KEY,
        name            TEXT NOT NULL,
        qualification   TEXT,
        specialization  TEXT,
        clinic_name     TEXT,
        address         TEXT,
        mobile          TEXT NOT NULL,
        email           TEXT,
        ward_id         INT REFERENCES wards(id),
        nigam_id        INT REFERENCES nigams(id),
        city_id         INT REFERENCES cities(id),
        timings         TEXT,
        is_24hr         BOOLEAN DEFAULT false,
        is_available    BOOLEAN DEFAULT true,
        photo_url       TEXT,
        added_by        INT REFERENCES users(id),
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW()
      );

      -- PET FOOD SHOPS
      CREATE TABLE IF NOT EXISTS food_shops (
        id          SERIAL PRIMARY KEY,
        name        TEXT NOT NULL,
        owner_name  TEXT,
        address     TEXT NOT NULL,
        mobile      TEXT NOT NULL,
        email       TEXT,
        ward_id     INT REFERENCES wards(id),
        nigam_id    INT REFERENCES nigams(id),
        city_id     INT REFERENCES cities(id),
        timings     TEXT,
        speciality  TEXT,
        photo_url   TEXT,
        is_active   BOOLEAN DEFAULT true,
        added_by    INT REFERENCES users(id),
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );

      -- PET REPORTS
      CREATE TABLE IF NOT EXISTS pet_reports (
        id                  SERIAL PRIMARY KEY,
        report_type         TEXT NOT NULL,
        pet_name            TEXT,
        species             TEXT,
        breed               TEXT,
        colour              TEXT,
        last_seen_address   TEXT NOT NULL,
        ward_id             INT REFERENCES wards(id),
        city_id             INT REFERENCES cities(id),
        owner_name          TEXT,
        reporter_mobile     TEXT NOT NULL,
        status              TEXT DEFAULT 'open' CHECK (status IN ('open','resolved','closed')),
        reported_by         INT REFERENCES users(id),
        created_at          TIMESTAMPTZ DEFAULT NOW()
      );

      -- INDEXES
      CREATE INDEX IF NOT EXISTS idx_pets_owner   ON pets(owner_id);
      CREATE INDEX IF NOT EXISTS idx_pets_city    ON pets(city_id);
      CREATE INDEX IF NOT EXISTS idx_pets_ward    ON pets(ward_id);
      CREATE INDEX IF NOT EXISTS idx_pets_status  ON pets(registration_status);
      CREATE INDEX IF NOT EXISTS idx_users_mobile ON users(mobile);
      CREATE INDEX IF NOT EXISTS idx_users_email  ON users(email);
      CREATE INDEX IF NOT EXISTS idx_doctors_city ON doctors(city_id);
      CREATE INDEX IF NOT EXISTS idx_shops_city   ON food_shops(city_id);
    `);

    console.log('✅ Migrations complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
