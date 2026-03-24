import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  API_PORT: z.coerce.number().default(8080),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.coerce.number().default(15 * 60),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
});

const result = schema.safeParse(process.env);

if (!result.success) {
  console.error('Invalid environment variables:');
  console.error(z.flattenError(result.error).fieldErrors);
  process.exit(1);
}

export const env = result.data;
export type Env = typeof env;
