import { Pool } from 'pg';

console.log('DB Config:', {
  url: process.env.DATABASE_URL ? 'Defined' : 'Undefined',
  ssl: true
});

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
