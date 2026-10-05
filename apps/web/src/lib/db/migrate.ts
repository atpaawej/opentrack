import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import { db, pool } from './index';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsFolder = path.resolve(__dirname, '../../../drizzle');

async function runMigrations() {
  console.log('[db:migrate] Running migrations from:', migrationsFolder);
  const start = Date.now();
  try {
    await migrate(db, { migrationsFolder });
    const duration = Date.now() - start;
    console.log(`[db:migrate] ✅ Migrations completed successfully in ${duration}ms`);
  } catch (error) {
    console.error('[db:migrate] ❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
