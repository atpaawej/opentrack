import crypto from 'node:crypto';
import { Effect, Schedule, Option } from 'effect';
import { Schema } from '@effect/schema';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projects, events, type Event, type Project } from '@/lib/db/schema';
import { CapturePayloadSchema, type CapturePayload } from './schemas';
import {
  PayloadValidationError,
  InvalidApiKeyError,
  DatabaseWriteError,
} from './errors';

// In-memory cache for API key validation: apiKey -> Project
const projectCache = new Map<string, { project: Project; cachedAt: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute cache

export function hashClientIp(clientIp: string | null | undefined, salt = 'opentrack_ip_salt'): string | null {
  if (!clientIp) return null;
  // Anonymize IP by hashing with a salt
  const normalized = clientIp.trim().split(',')[0].trim();
  return crypto.createHash('sha256').update(`${salt}:${normalized}`).digest('hex');
}

export function parseTimestamp(input: unknown): Date {
  if (input instanceof Date) return input;
  if (typeof input === 'number') return new Date(input);
  if (typeof input === 'string') {
    const parsed = new Date(input);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

/**
 * Validates the raw payload against the CapturePayloadSchema
 */
export function validatePayload(raw: unknown): Effect.Effect<CapturePayload, PayloadValidationError> {
  return Effect.gen(function* () {
    const decoded = yield* Schema.decodeUnknown(CapturePayloadSchema)(raw).pipe(
      Effect.mapError(
        (parseError) =>
          new PayloadValidationError({
            message: 'Invalid capture payload',
            details: parseError.message,
          })
      )
    );
    return decoded;
  });
}

/**
 * Validates API key against Neon Postgres projects table
 */
export function verifyApiKey(apiKey: string): Effect.Effect<Project, InvalidApiKeyError | DatabaseWriteError> {
  return Effect.gen(function* () {
    // Check in-memory cache first
    const cached = projectCache.get(apiKey);
    const now = Date.now();
    if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
      return cached.project;
    }

    const projectResult = yield* Effect.tryPromise({
      try: () => db.select().from(projects).where(eq(projects.apiKey, apiKey)).limit(1),
      catch: (err) =>
        new DatabaseWriteError({
          message: 'Failed to verify project API key in database',
          cause: err,
        }),
    });

    if (!projectResult || projectResult.length === 0) {
      return yield* Effect.fail(
        new InvalidApiKeyError({
          apiKey,
          message: `Unauthorized: Invalid or non-existent API key '${apiKey}'`,
        })
      );
    }

    const project = projectResult[0];
    projectCache.set(apiKey, { project, cachedAt: now });
    return project;
  });
}

/**
 * Ingestion workflow for single event capture
 */
export function ingestEvent(
  rawPayload: unknown,
  clientIp?: string | null
): Effect.Effect<Event, PayloadValidationError | InvalidApiKeyError | DatabaseWriteError> {
  return Effect.gen(function* () {
    // 1. Validate payload
    const payload = yield* validatePayload(rawPayload);

    // 2. Verify API key
    const project = yield* verifyApiKey(payload.api_key);

    // 3. Hash client IP for privacy
    const ipHash = hashClientIp(clientIp);

    // 4. Resolve event timestamp
    const eventTimestamp = parseTimestamp(payload.timestamp);

    // 5. Persist into Neon Postgres with retry on transient DB failure
    const insertEffect = Effect.tryPromise({
      try: async () => {
        const [inserted] = await db
          .insert(events)
          .values({
            projectId: project.id,
            eventName: payload.event,
            distinctId: payload.distinct_id,
            sessionId: payload.session_id || null,
            properties: payload.properties || {},
            ipHash,
            timestamp: eventTimestamp,
          })
          .returning();
        return inserted;
      },
      catch: (err) =>
        new DatabaseWriteError({
          message: 'Failed to insert event record into database',
          cause: err,
        }),
    });

    // Retry transient DB errors up to 2 times with 100ms exponential delay
    const retryPolicy = Schedule.exponential('100 millis').pipe(
      Schedule.compose(Schedule.recurs(2))
    );

    const insertedEvent = yield* insertEffect.pipe(Effect.retry(retryPolicy));

    return insertedEvent;
  });
}
