import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { eq } from 'drizzle-orm';
import { Effect, Exit } from 'effect';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load environment variables using Node native loader before imports
const envLocalPath = path.join(rootDir, '.env.local');
if (fs.existsSync(envLocalPath)) {
  process.loadEnvFile(envLocalPath);
}

import { db, pool } from '../apps/web/src/lib/db/index';
import { projects, events } from '../apps/web/src/lib/db/schema';
import { ingestEvent, hashClientIp } from '../apps/web/src/features/ingestion/service';

const TEST_API_KEY = 'ot_live_spine_test';
const TEST_IP = '203.0.113.42';

async function runSmokeTest() {
  console.log('========================================');
  console.log('🚀 Running OpenTrack Spine Verification Smoke Test');
  console.log('========================================\n');

  try {
    // 1. Ensure test project exists in Neon DB
    console.log('[1/4] Ensuring test project exists in Neon Postgres...');
    const existingProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.apiKey, TEST_API_KEY))
      .limit(1);

    let testProject;
    if (existingProjects.length > 0) {
      testProject = existingProjects[0];
      console.log(`  Found existing project: ${testProject.name} (${testProject.id})`);
    } else {
      const [inserted] = await db
        .insert(projects)
        .values({
          name: 'Spine Test Project',
          apiKey: TEST_API_KEY,
          allowedDomains: ['localhost', 'opentrack.dev'],
        })
        .returning();
      testProject = inserted;
      console.log(`  Created test project: ${testProject.name} (${testProject.id})`);
    }

    // 2. Prepare event payload
    console.log('\n[2/4] Executing Ingestion Effect Pipeline with client IP and event payload...');
    const distinctId = `spine_user_${Date.now()}`;
    const sessionId = `spine_sess_${Date.now()}`;
    const testPayload = {
      api_key: TEST_API_KEY,
      event: 'user_signed_up',
      distinct_id: distinctId,
      session_id: sessionId,
      properties: {
        plan: 'starter',
        source: 'spine-smoke-test',
        verified: true,
      },
      timestamp: Date.now(),
    };

    const exit = await Effect.runPromiseExit(ingestEvent(testPayload, TEST_IP));

    if (Exit.isFailure(exit)) {
      console.error('❌ Ingestion pipeline failed:', JSON.stringify(exit.cause));
      throw new Error('Ingestion pipeline execution failed');
    }

    const ingestedEvent = exit.value;
    console.log(`  ✅ Event successfully ingested into database: ID ${ingestedEvent.id}`);

    // 3. Query Neon database directly to verify event persistence and fields
    console.log('\n[3/4] Querying Neon Postgres events table to verify persistence...');
    const [persisted] = await db
      .select()
      .from(events)
      .where(eq(events.id, ingestedEvent.id))
      .limit(1);

    if (!persisted) {
      throw new Error(`Persisted event with ID ${ingestedEvent.id} not found in database!`);
    }

    console.log('  Event row retrieved from Neon:');
    console.log(`    - ID:          ${persisted.id}`);
    console.log(`    - Project ID:  ${persisted.projectId}`);
    console.log(`    - Event Name:  ${persisted.eventName}`);
    console.log(`    - Distinct ID: ${persisted.distinctId}`);
    console.log(`    - Session ID:  ${persisted.sessionId}`);
    console.log(`    - IP Hash:     ${persisted.ipHash}`);
    console.log(`    - Timestamp:   ${persisted.timestamp.toISOString()}`);
    console.log(`    - Properties:  ${JSON.stringify(persisted.properties)}`);

    // 4. Run Assertions
    console.log('\n[4/4] Validating schema integrity and field assertions...');

    if (persisted.projectId !== testProject.id) {
      throw new Error(`Project ID mismatch: expected ${testProject.id}, got ${persisted.projectId}`);
    }

    if (persisted.eventName !== 'user_signed_up') {
      throw new Error(`Event name mismatch: expected 'user_signed_up', got '${persisted.eventName}'`);
    }

    if (persisted.distinctId !== distinctId) {
      throw new Error(`Distinct ID mismatch: expected '${distinctId}', got '${persisted.distinctId}'`);
    }

    if (persisted.sessionId !== sessionId) {
      throw new Error(`Session ID mismatch: expected '${sessionId}', got '${persisted.sessionId}'`);
    }

    const expectedIpHash = hashClientIp(TEST_IP);
    if (persisted.ipHash !== expectedIpHash) {
      throw new Error(`IP Hash mismatch: expected ${expectedIpHash}, got ${persisted.ipHash}`);
    }

    const props = persisted.properties as Record<string, unknown>;
    if (props?.plan !== 'starter' || props?.verified !== true) {
      throw new Error(`Event properties mismatch: ${JSON.stringify(props)}`);
    }

    const eventAgeMs = Date.now() - persisted.timestamp.getTime();
    if (eventAgeMs > 60_000 || eventAgeMs < -5_000) {
      throw new Error(`Event timestamp out of expected range: age is ${eventAgeMs}ms`);
    }

    console.log('  ✅ All database assertions passed:');
    console.log('     ✓ Project relation verified');
    console.log('     ✓ Anonymized IP hash verified');
    console.log('     ✓ Session & Distinct IDs verified');
    console.log('     ✓ JSONB properties payload verified');
    console.log('     ✓ Event timestamp freshness verified');

    console.log('\n========================================');
    console.log('🎉 Spine verification: PASSED');
    console.log('========================================\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Spine verification: FAILED');
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runSmokeTest();
