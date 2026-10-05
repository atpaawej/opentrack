import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';
import * as dotenv from 'dotenv';
import path from 'node:path';

// If DATABASE_URL is not yet in process.env (e.g. CLI, scripts, or worker runtime), load it
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
  dotenv.config({ path: path.resolve(process.cwd(), '../../.env.local') });
  dotenv.config();
}

const connectionString = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('[db] Warning: DATABASE_URL or DATABASE_URL_POOLED is not set in environment.');
}

// Neon serverless connection pool
export const pool = new Pool({
  connectionString: connectionString || '',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export const db = drizzle(pool, { schema });

export { schema };
