import '@/env.js';
import express from 'express';
import { migrate, seed, pool } from '@/db/index.js';
import { env } from '@/env.js';
import authRouter from '@/routes/auth.js';
import usersRouter from '@/routes/users.js';

const app = express();
app.use(express.json());

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'OK', db: 'connected' });
  } catch (err) {
    res.status(500).json({
      status: 'ERROR',
      db: 'disconnected',
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);

async function start(): Promise<void> {
  try {
    console.log('Initializing database...');
    await migrate();

    if (env.NODE_ENV === 'development') {
      await seed();
    }

    app.listen(env.API_PORT, () =>
      console.log(`Server running at http://localhost:${env.API_PORT}`),
    );
  } catch (error) {
    console.error('Failed to start server:');
    console.error(error);
    process.exit(1);
  }
}

start();
