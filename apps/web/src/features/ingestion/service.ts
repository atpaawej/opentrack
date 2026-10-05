import crypto from 'node:crypto';
import { Effect, Schedule } from 'effect';
import { Schema } from '@effect/schema';
import { eq, and as drizzleAnd } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  projects,
  events,
  persons,
  personAliases,
  type Event,
  type Project,
  type Person,
  type PersonAlias,
} from '@/lib/db/schema';
import {
  CapturePayloadSchema,
  BatchCapturePayloadSchema,
  type CapturePayload,
  type BatchCapturePayload,
} from './schemas';
import {
  PayloadValidationError,
  InvalidApiKeyError,
  DomainNotAllowedError,
  DatabaseWriteError,
  type IngestionError,
} from './errors';
import {
  enrichEventFields,
  getHeaderValue,
  type HeaderSource,
  type EnrichedEventFields,
} from './enrichment';

export type IngestionHeaders = HeaderSource;

export interface IngestionOptions {
  readonly clientIp?: string | null;
  readonly headers?: IngestionHeaders;
  readonly apiKey?: string;
}

// In-memory cache for API key validation: apiKey -> Project
const projectCache = new Map<string, { project: Project; cachedAt: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute cache

export function hashClientIp(clientIp: string | null | undefined, salt = 'opentrack_ip_salt'): string | null {
  if (!clientIp) return null;
  const normalized = clientIp.trim().split(',')[0].trim();
  if (!normalized) return null;
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

export function extractHostname(urlOrHost: string | null | undefined): string | null {
  if (!urlOrHost) return null;
  try {
    const trimmed = urlOrHost.trim();
    if (trimmed.includes('://')) {
      return new URL(trimmed).hostname.toLowerCase();
    }
    return trimmed.split('/')[0].split(':')[0].toLowerCase();
  } catch {
    return null;
  }
}

export function isDomainAllowed(host: string, allowedList: string[]): boolean {
  const normalizedHost = host.toLowerCase().trim();
  for (const allowed of allowedList) {
    const normalizedAllowed = extractHostname(allowed) || allowed.toLowerCase().trim();
    if (normalizedHost === normalizedAllowed) {
      return true;
    }
    if (normalizedAllowed.startsWith('*.')) {
      const base = normalizedAllowed.slice(2);
      if (normalizedHost === base || normalizedHost.endsWith(`.${base}`)) {
        return true;
      }
    } else if (normalizedHost.endsWith(`.${normalizedAllowed}`)) {
      return true;
    }
  }
  return false;
}

/**
 * Validates project origin/referer against allowedDomains if configured
 */
export function verifyAllowedDomains(
  project: Project,
  originOrReferer?: string | null
): Effect.Effect<void, DomainNotAllowedError> {
  return Effect.gen(function* () {
    if (!project.allowedDomains || project.allowedDomains.length === 0) {
      return;
    }

    if (!originOrReferer) {
      // Non-browser / server SDK requests without origin/referer are permitted
      return;
    }

    const host = extractHostname(originOrReferer);
    if (!host || !isDomainAllowed(host, project.allowedDomains)) {
      return yield* Effect.fail(
        new DomainNotAllowedError({
          origin: originOrReferer,
          allowedDomains: project.allowedDomains,
          message: `Origin or Referer '${originOrReferer}' is not allowed for project '${project.name}'`,
        })
      );
    }
  });
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

    const isIdentityEvent =
      decoded.event === '$identify' ||
      decoded.event === 'identify' ||
      decoded.event === '$alias' ||
      decoded.event === 'alias';

    if (!isIdentityEvent) {
      const hasDistinctId =
        Boolean(decoded.distinct_id) ||
        Boolean(decoded.properties && (decoded.properties['distinct_id'] || decoded.properties['$distinct_id']));
      if (!hasDistinctId) {
        return yield* Effect.fail(
          new PayloadValidationError({
            message: 'Invalid capture payload',
            details: 'Field distinct_id is required',
          })
        );
      }
    }

    return decoded;
  });
}

/**
 * Validates the raw payload against BatchCapturePayloadSchema
 */
export function validateBatchPayload(
  raw: unknown
): Effect.Effect<{ apiKey?: string; batch: CapturePayload[] }, PayloadValidationError> {
  return Effect.gen(function* () {
    const decoded = yield* Schema.decodeUnknown(BatchCapturePayloadSchema)(raw).pipe(
      Effect.mapError(
        (parseError) =>
          new PayloadValidationError({
            message: 'Invalid batch capture payload',
            details: parseError.message,
          })
      )
    );

    let apiKey: string | undefined;
    let batch: CapturePayload[];

    if (decoded && typeof decoded === 'object' && 'batch' in decoded) {
      apiKey = (decoded as { api_key?: string; batch: CapturePayload[] }).api_key;
      batch = [...(decoded as { api_key?: string; batch: CapturePayload[] }).batch];
    } else if (Array.isArray(decoded)) {
      batch = [...(decoded as CapturePayload[])];
    } else {
      batch = [];
    }

    if (batch.length === 0) {
      return yield* Effect.fail(
        new PayloadValidationError({
          message: 'Batch capture payload cannot be empty',
        })
      );
    }

    if (batch.length > 100) {
      return yield* Effect.fail(
        new PayloadValidationError({
          message: 'Batch size cannot exceed 100 events per request',
        })
      );
    }

    // Validate each item in the batch
    for (let i = 0; i < batch.length; i++) {
      const item = batch[i];
      const isIdentityEvent =
        item.event === '$identify' ||
        item.event === 'identify' ||
        item.event === '$alias' ||
        item.event === 'alias';

      if (!isIdentityEvent) {
        const hasDistinctId =
          Boolean(item.distinct_id) ||
          Boolean(item.properties && (item.properties['distinct_id'] || item.properties['$distinct_id']));
        if (!hasDistinctId) {
          return yield* Effect.fail(
            new PayloadValidationError({
              message: `Invalid capture payload at index ${i}`,
              details: 'Field distinct_id is required',
            })
          );
        }
      }
    }

    return { apiKey, batch };
  });
}

/**
 * Validates API key against Neon Postgres projects table
 */
export function verifyApiKey(apiKey?: string | null): Effect.Effect<Project, InvalidApiKeyError | DatabaseWriteError> {
  return Effect.gen(function* () {
    if (!apiKey || !apiKey.trim()) {
      return yield* Effect.fail(
        new InvalidApiKeyError({
          apiKey: '',
          message: 'Unauthorized: Missing API key',
        })
      );
    }

    const trimmedKey = apiKey.trim();

    // Check in-memory cache first
    const cached = projectCache.get(trimmedKey);
    const now = Date.now();
    if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
      return cached.project;
    }

    const projectResult = yield* Effect.tryPromise({
      try: () => db.select().from(projects).where(eq(projects.apiKey, trimmedKey)).limit(1),
      catch: (err) =>
        new DatabaseWriteError({
          message: 'Failed to verify project API key in database',
          cause: err,
        }),
    });

    if (!projectResult || projectResult.length === 0) {
      return yield* Effect.fail(
        new InvalidApiKeyError({
          apiKey: trimmedKey,
          message: `Unauthorized: Invalid or non-existent API key '${trimmedKey}'`,
        })
      );
    }

    const project = projectResult[0];
    projectCache.set(trimmedKey, { project, cachedAt: now });
    return project;
  });
}

/**
 * Handles identity resolution for $identify and $alias events
 */
export function resolveIdentity(
  project: Project,
  payload: CapturePayload
): Effect.Effect<void, DatabaseWriteError> {
  return Effect.tryPromise({
    try: async () => {
      const isIdentify = payload.event === '$identify' || payload.event === 'identify';
      const isAlias = payload.event === '$alias' || payload.event === 'alias';

      if (!isIdentify && !isAlias) {
        return;
      }

      const props = (payload.properties as Record<string, unknown>) || {};

      if (isIdentify) {
        const targetDistinctId =
          payload.distinct_id ||
          payload.alias ||
          (typeof props['distinct_id'] === 'string' ? props['distinct_id'] : null) ||
          (typeof props['$distinct_id'] === 'string' ? props['$distinct_id'] : null);

        if (!targetDistinctId) return;

        // Upsert person
        const existingPersons = await db
          .select()
          .from(persons)
          .where(
            drizzleAnd(
              eq(persons.projectId, project.id),
              eq(persons.distinctId, targetDistinctId)
            )
          )
          .limit(1);

        const now = new Date();

        if (existingPersons.length > 0) {
          const existing = existingPersons[0];
          const mergedProps = {
            ...(existing.properties as Record<string, unknown>),
            ...props,
          };
          await db
            .update(persons)
            .set({
              properties: mergedProps,
              lastSeenAt: now,
              updatedAt: now,
            })
            .where(eq(persons.id, existing.id));
        } else {
          await db.insert(persons).values({
            projectId: project.id,
            distinctId: targetDistinctId,
            properties: props,
            firstSeenAt: now,
            lastSeenAt: now,
            createdAt: now,
            updatedAt: now,
          });
        }

        // Check for alias in identify payload
        const aliasId =
          payload.alias ||
          (typeof props['$anon_distinct_id'] === 'string' ? props['$anon_distinct_id'] : null) ||
          (typeof props['alias_id'] === 'string' ? props['alias_id'] : null) ||
          (typeof props['alias'] === 'string' ? props['alias'] : null);

        if (aliasId && aliasId !== targetDistinctId) {
          const existingAliases = await db
            .select()
            .from(personAliases)
            .where(
              drizzleAnd(
                eq(personAliases.projectId, project.id),
                eq(personAliases.aliasId, aliasId)
              )
            )
            .limit(1);

          if (existingAliases.length === 0) {
            await db.insert(personAliases).values({
              projectId: project.id,
              aliasId,
              personDistinctId: targetDistinctId,
              createdAt: now,
            });
          }
        }
      } else if (isAlias) {
        const aliasId =
          payload.alias ||
          (typeof props['alias_id'] === 'string' ? props['alias_id'] : null) ||
          (typeof props['alias'] === 'string' ? props['alias'] : null);

        const targetDistinctId =
          payload.distinct_id ||
          (typeof props['person_distinct_id'] === 'string' ? props['person_distinct_id'] : null) ||
          (typeof props['distinct_id'] === 'string' ? props['distinct_id'] : null);

        if (!aliasId || !targetDistinctId) return;

        const now = new Date();

        // 1. Ensure person record exists for target
        const existingPersons = await db
          .select()
          .from(persons)
          .where(
            drizzleAnd(
              eq(persons.projectId, project.id),
              eq(persons.distinctId, targetDistinctId)
            )
          )
          .limit(1);

        if (existingPersons.length === 0) {
          await db.insert(persons).values({
            projectId: project.id,
            distinctId: targetDistinctId,
            properties: props,
            firstSeenAt: now,
            lastSeenAt: now,
            createdAt: now,
            updatedAt: now,
          });
        }

        // 2. Insert alias record
        const existingAliases = await db
          .select()
          .from(personAliases)
          .where(
            drizzleAnd(
              eq(personAliases.projectId, project.id),
              eq(personAliases.aliasId, aliasId)
            )
          )
          .limit(1);

        if (existingAliases.length === 0) {
          await db.insert(personAliases).values({
            projectId: project.id,
            aliasId,
            personDistinctId: targetDistinctId,
            createdAt: now,
          });
        }
      }
    },
    catch: (err) =>
      new DatabaseWriteError({
        message: 'Failed to resolve person identity in database',
        cause: err,
      }),
  });
}

function parseIngestionContext(
  clientIpOrOptions?: string | null | IngestionOptions,
  headersOrContext?: IngestionHeaders | IngestionOptions
): { clientIp: string | null | undefined; headers: IngestionHeaders; apiKey?: string } {
  let clientIp: string | null | undefined = null;
  let headers: IngestionHeaders = undefined;
  let apiKey: string | undefined = undefined;

  if (typeof clientIpOrOptions === 'string' || clientIpOrOptions === null) {
    clientIp = clientIpOrOptions;
    if (headersOrContext && (headersOrContext instanceof Headers || !('clientIp' in (headersOrContext as Record<string, unknown>)))) {
      headers = headersOrContext as IngestionHeaders;
    } else if (headersOrContext && typeof headersOrContext === 'object') {
      const ctx = headersOrContext as IngestionOptions;
      headers = ctx.headers;
      apiKey = ctx.apiKey;
      if (ctx.clientIp) clientIp = ctx.clientIp;
    }
  } else if (clientIpOrOptions && typeof clientIpOrOptions === 'object') {
    clientIp = clientIpOrOptions.clientIp;
    headers = clientIpOrOptions.headers;
    apiKey = clientIpOrOptions.apiKey;
  }

  return { clientIp, headers, apiKey };
}

/**
 * Ingestion workflow for single event capture
 */
export function ingestEvent(
  rawPayload: unknown,
  clientIpOrOptions?: string | null | IngestionOptions,
  headersOrContext?: IngestionHeaders | IngestionOptions
): Effect.Effect<Event, IngestionError> {
  return Effect.gen(function* () {
    const { clientIp, headers, apiKey: contextApiKey } = parseIngestionContext(
      clientIpOrOptions,
      headersOrContext
    );

    // 1. Validate payload
    const payload = yield* validatePayload(rawPayload);

    // 2. Resolve API key
    const rawApiKey =
      payload.api_key ||
      contextApiKey ||
      getHeaderValue(headers, 'x-opentrack-key') ||
      getHeaderValue(headers, 'authorization')?.replace(/^Bearer\s+/i, '');

    const project = yield* verifyApiKey(rawApiKey);

    // 3. Domain verification
    const origin =
      getHeaderValue(headers, 'origin') || getHeaderValue(headers, 'referer');
    yield* verifyAllowedDomains(project, origin);

    // 4. Handle identity resolution if $identify / $alias
    yield* resolveIdentity(project, payload);

    // 5. Enrichment & IP hashing
    const ipHash = hashClientIp(clientIp);
    const eventTimestamp = parseTimestamp(payload.timestamp);
    const enriched = enrichEventFields(payload.properties as Record<string, unknown>, headers);

    const resolvedDistinctId =
      payload.distinct_id ||
      payload.alias ||
      (payload.properties && typeof payload.properties['distinct_id'] === 'string'
        ? (payload.properties['distinct_id'] as string)
        : null) ||
      'anonymous';

    // 6. Persist into Neon Postgres with retry on transient DB failure
    const insertEffect = Effect.tryPromise({
      try: async () => {
        const [inserted] = await db
          .insert(events)
          .values({
            projectId: project.id,
            eventName: payload.event,
            distinctId: resolvedDistinctId,
            sessionId: payload.session_id || null,
            properties: payload.properties || {},
            userAgent: enriched.userAgent,
            browser: enriched.browser,
            browserVersion: enriched.browserVersion,
            os: enriched.os,
            deviceType: enriched.deviceType,
            screenWidth: enriched.screenWidth,
            screenHeight: enriched.screenHeight,
            ipHash,
            countryCode: enriched.countryCode,
            region: enriched.region,
            city: enriched.city,
            referrer: enriched.referrer,
            referrerDomain: enriched.referrerDomain,
            pageUrl: enriched.pageUrl,
            pagePath: enriched.pagePath,
            utmSource: enriched.utmSource,
            utmMedium: enriched.utmMedium,
            utmCampaign: enriched.utmCampaign,
            utmTerm: enriched.utmTerm,
            utmContent: enriched.utmContent,
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

    const retryPolicy = Schedule.exponential('100 millis').pipe(
      Schedule.compose(Schedule.recurs(2))
    );

    const insertedEvent = yield* insertEffect.pipe(Effect.retry(retryPolicy));
    return insertedEvent;
  });
}

/**
 * Ingestion workflow for batch event capture
 */
export function ingestBatch(
  rawPayload: unknown,
  clientIpOrOptions?: string | null | IngestionOptions,
  headersOrContext?: IngestionHeaders | IngestionOptions
): Effect.Effect<Event[], IngestionError> {
  return Effect.gen(function* () {
    const { clientIp, headers, apiKey: contextApiKey } = parseIngestionContext(
      clientIpOrOptions,
      headersOrContext
    );

    // 1. Validate batch payload
    const { apiKey: topLevelApiKey, batch } = yield* validateBatchPayload(rawPayload);

    const fallbackApiKey =
      topLevelApiKey ||
      contextApiKey ||
      getHeaderValue(headers, 'x-opentrack-key') ||
      getHeaderValue(headers, 'authorization')?.replace(/^Bearer\s+/i, '');

    const origin =
      getHeaderValue(headers, 'origin') || getHeaderValue(headers, 'referer');
    const ipHash = hashClientIp(clientIp);

    // 2. Prepare event records for batch insert
    const insertValues: Array<typeof events.$inferInsert> = [];

    for (const item of batch) {
      const apiKey = item.api_key || fallbackApiKey;
      const project = yield* verifyApiKey(apiKey);

      yield* verifyAllowedDomains(project, origin);
      yield* resolveIdentity(project, item);

      const eventTimestamp = parseTimestamp(item.timestamp);
      const enriched = enrichEventFields(item.properties as Record<string, unknown>, headers);
      const resolvedDistinctId =
        item.distinct_id ||
        item.alias ||
        (item.properties && typeof item.properties['distinct_id'] === 'string'
          ? (item.properties['distinct_id'] as string)
          : null) ||
        'anonymous';

      insertValues.push({
        projectId: project.id,
        eventName: item.event,
        distinctId: resolvedDistinctId,
        sessionId: item.session_id || null,
        properties: item.properties || {},
        userAgent: enriched.userAgent,
        browser: enriched.browser,
        browserVersion: enriched.browserVersion,
        os: enriched.os,
        deviceType: enriched.deviceType,
        screenWidth: enriched.screenWidth,
        screenHeight: enriched.screenHeight,
        ipHash,
        countryCode: enriched.countryCode,
        region: enriched.region,
        city: enriched.city,
        referrer: enriched.referrer,
        referrerDomain: enriched.referrerDomain,
        pageUrl: enriched.pageUrl,
        pagePath: enriched.pagePath,
        utmSource: enriched.utmSource,
        utmMedium: enriched.utmMedium,
        utmCampaign: enriched.utmCampaign,
        utmTerm: enriched.utmTerm,
        utmContent: enriched.utmContent,
        timestamp: eventTimestamp,
      });
    }

    // 3. Batch insert into Neon Postgres
    const insertEffect = Effect.tryPromise({
      try: async () => {
        const inserted = await db.insert(events).values(insertValues).returning();
        return inserted;
      },
      catch: (err) =>
        new DatabaseWriteError({
          message: 'Failed to insert batch events into database',
          cause: err,
        }),
    });

    const retryPolicy = Schedule.exponential('100 millis').pipe(
      Schedule.compose(Schedule.recurs(2))
    );

    const insertedEvents = yield* insertEffect.pipe(Effect.retry(retryPolicy));
    return insertedEvents;
  });
}
