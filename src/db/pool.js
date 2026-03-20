const { Pool } = require('pg');
require('dotenv').config();

// Railway provides DATABASE_URL; local uses individual vars
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  : new Pool({
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME     || 'allforpets',
      user:     process.env.DB_USER     || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err);
});

// Helper: run a query
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === 'development') {
    console.log('query', { text: text.substring(0, 80), duration, rows: res.rowCount });
  }
  return res;
}

// Helper: get a client for transactions
async function getClient() {
  const client = await pool.connect();
  const originalQuery = client.query.bind(client);
  client.query = (...args) => originalQuery(...args);
  return client;
}

module.exports = { pool, query, getClient };
