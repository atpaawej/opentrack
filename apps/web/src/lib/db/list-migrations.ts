import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './index';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsFolder = path.resolve(__dirname, '../../../drizzle');
const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');

async function listMigrations() {
  console.log('[db:list] Inspecting migrations in:', migrationsFolder);

  if (!fs.existsSync(journalPath)) {
    console.log('[db:list] No migrations found. Run "pnpm db:generate" to generate the initial migration.');
    await pool.end();
    return;
  }

  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
  const entries: Array<{ idx: number; tag: string; when: number }> = journal.entries || [];

  if (entries.length === 0) {
    console.log('[db:list] Migration journal is empty.');
    await pool.end();
    return;
  }

  const appliedCreatedAt = new Set<string>();
  const appliedIds = new Set<number>();

  try {
    const res = await pool.query(
      `SELECT * FROM "drizzle"."__drizzle_migrations" ORDER BY id ASC`
    );
    for (const row of res.rows) {
      if (row.created_at) appliedCreatedAt.add(String(row.created_at));
      if (row.id !== undefined) appliedIds.add(Number(row.id));
    }
  } catch (err: any) {
    if (err.code !== '42P01') {
      console.warn('[db:list] Note: Could not query __drizzle_migrations table:', err.message);
    }
  }

  console.log('\n--- MIGRATION STATUS ---');
  console.log(
    `${'Index'.padEnd(8)} | ${'Migration Tag'.padEnd(35)} | ${'Generated Date'.padEnd(25)} | Status`
  );
  console.log('-'.repeat(85));

  for (const entry of entries) {
    const dateStr = new Date(entry.when).toISOString();
    const isApplied =
      appliedCreatedAt.has(String(entry.when)) || appliedIds.has(entry.idx + 1);
    const status = isApplied ? '✅ APPLIED' : '⏳ PENDING';

    console.log(
      `${String(entry.idx).padEnd(8)} | ${entry.tag.padEnd(35)} | ${dateStr.padEnd(25)} | ${status}`
    );
  }
  console.log('-'.repeat(85) + '\n');

  await pool.end();
}

listMigrations().catch(async (err) => {
  console.error('[db:list] Error listing migrations:', err);
  await pool.end();
  process.exit(1);
});
