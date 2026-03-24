import bcrypt from 'bcrypt';
import { env } from '@/env.js';
import { pool } from '@/db/pool.js';

const users = [
  { name: 'Gabriel', email: 'gabriel@example.com', password: 'password123' },
  { name: 'Kristian', email: 'kristian@example.com', password: 'password123' },
  { name: 'Kerene', email: 'kerene@example.com', password: 'password123' },
];

export async function seed(): Promise<void> {
  const { rows } = await pool.query('SELECT COUNT(*) FROM users');
  if (Number(rows[0].count) > 0) {
    console.log('Seed skipped (table not empty)');
    return;
  }

  await Promise.all(
    users.map(async ({ name, email, password }) => {
      const password_hash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
      return pool.query(
        `INSERT INTO users (name, email, password_hash)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [name, email, password_hash],
      );
    }),
  );

  console.log(`Seeded ${users.length} users`);
}
