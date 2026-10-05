import { Effect } from 'effect';
import { Schema } from '@effect/schema';
import { eq, and, gt, desc, ilike, inArray, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import { events, type Event } from '@/lib/db/schema';
import { LiveStreamQuerySchema, type LiveStreamQueryInput } from './schemas';
import {
  LiveStreamValidationError,
  LiveStreamDatabaseError,
  type LiveStreamError,
} from './errors';

export interface GetLiveEventsOptions {
  projectId: string;
  eventName?: string | string[] | readonly string[];
  distinctId?: string;
  since?: Date | string | number;
  limit?: number | string;
}

/**
 * Validates raw input against LiveStreamQuerySchema
 */
export function validateLiveStreamQuery(
  raw: unknown
): Effect.Effect<LiveStreamQueryInput, LiveStreamValidationError> {
  return Effect.gen(function* () {
    const decoded = yield* Schema.decodeUnknown(LiveStreamQuerySchema)(raw).pipe(
      Effect.mapError(
        (parseError) =>
          new LiveStreamValidationError({
            message: 'Invalid live stream query parameters',
            details: parseError.message,
          })
      )
    );
    return decoded;
  });
}

/**
 * Queries live stream events from the database ordered by timestamp DESC
 */
export function getLiveEvents(
  options: GetLiveEventsOptions
): Effect.Effect<Event[], LiveStreamError> {
  return Effect.gen(function* () {
    const { projectId, eventName, distinctId, since, limit } = options;

    if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
      return yield* Effect.fail(
        new LiveStreamValidationError({
          message: 'projectId is required to query live stream events',
        })
      );
    }

    const conditions: SQL<unknown>[] = [eq(events.projectId, projectId)];

    // Filter by eventName (exact or ILIKE / array)
    if (Array.isArray(eventName) && eventName.length > 0) {
      if (eventName.length === 1) {
        conditions.push(ilike(events.eventName, `%${eventName[0].trim()}%`));
      } else {
        conditions.push(inArray(events.eventName, [...eventName]));
      }
    } else if (typeof eventName === 'string' && eventName.trim()) {
      const trimmed = eventName.trim();
      if (trimmed.includes(',')) {
        const parts = trimmed
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean);
        if (parts.length > 1) {
          conditions.push(inArray(events.eventName, parts));
        } else if (parts.length === 1) {
          conditions.push(ilike(events.eventName, `%${parts[0]}%`));
        }
      } else {
        conditions.push(ilike(events.eventName, `%${trimmed}%`));
      }
    }

    // Filter by distinctId (ILIKE)
    if (typeof distinctId === 'string' && distinctId.trim()) {
      conditions.push(ilike(events.distinctId, `%${distinctId.trim()}%`));
    }

    // Filter by since timestamp (for polling incremental new events)
    if (since !== undefined && since !== null) {
      const sinceDate = since instanceof Date ? since : new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        conditions.push(gt(events.timestamp, sinceDate));
      }
    }

    let parsedLimit = 50;
    if (limit !== undefined && limit !== null) {
      const num = typeof limit === 'number' ? limit : parseInt(String(limit), 10);
      if (!isNaN(num)) {
        parsedLimit = Math.min(Math.max(num, 1), 100);
      }
    }

    const results = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(events)
          .where(and(...conditions))
          .orderBy(desc(events.timestamp))
          .limit(parsedLimit),
      catch: (err) =>
        new LiveStreamDatabaseError({
          message: 'Failed to query live stream events from database',
          cause: err,
        }),
    });

    return results;
  });
}

/**
 * Validates raw input and queries live stream events
 */
export function queryLiveEvents(
  rawInput: unknown
): Effect.Effect<Event[], LiveStreamError> {
  return Effect.gen(function* () {
    const validated = yield* validateLiveStreamQuery(rawInput);
    if (!validated.projectId) {
      return yield* Effect.fail(
        new LiveStreamValidationError({
          message: 'projectId is required to query live stream events',
        })
      );
    }

    return yield* getLiveEvents({
      projectId: validated.projectId,
      eventName: validated.eventName,
      distinctId: validated.distinctId,
      since: validated.since,
      limit: validated.limit,
    });
  });
}
