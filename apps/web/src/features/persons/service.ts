import { Effect } from 'effect';
import { eq, and, or, inArray, desc, asc, ilike, sql, count, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  persons,
  personAliases,
  events,
  type Person,
  type Event,
} from '@/lib/db/schema';
import type {
  PersonListItem,
  PersonSession,
  PersonProfileDetail,
  ListPersonsOptions,
  ListPersonsResult,
} from './types';
import {
  PersonNotFoundError,
  PersonsDatabaseError,
  PersonsValidationError,
  type PersonsError,
} from './errors';

/**
 * Groups a list of historical events into user sessions based on sessionId and 30-minute inactivity window.
 * Returns sessions sorted chronologically descending (newest session first),
 * with events within each session sorted chronologically ascending.
 */
export function groupEventsIntoSessions(eventsList: Event[]): PersonSession[] {
  if (!eventsList || eventsList.length === 0) {
    return [];
  }

  // Sort events chronologically ascending
  const sorted = [...eventsList].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const INACTIVITY_GAP_MS = 30 * 60 * 1000; // 30 minutes
  const sessionBuckets: Event[][] = [];
  let currentBucket: Event[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const currentEvent = sorted[i];

    if (currentBucket.length === 0) {
      currentBucket.push(currentEvent);
      continue;
    }

    const prevEvent = currentBucket[currentBucket.length - 1];
    const prevTime = new Date(prevEvent.timestamp).getTime();
    const currTime = new Date(currentEvent.timestamp).getTime();
    const timeDiff = currTime - prevTime;

    const bothHaveSessionId = Boolean(currentEvent.sessionId && prevEvent.sessionId);
    const sameSessionId = bothHaveSessionId && currentEvent.sessionId === prevEvent.sessionId;
    const differentSessionId = bothHaveSessionId && currentEvent.sessionId !== prevEvent.sessionId;

    if (differentSessionId) {
      sessionBuckets.push(currentBucket);
      currentBucket = [currentEvent];
    } else if (sameSessionId) {
      currentBucket.push(currentEvent);
    } else {
      if (timeDiff <= INACTIVITY_GAP_MS) {
        currentBucket.push(currentEvent);
      } else {
        sessionBuckets.push(currentBucket);
        currentBucket = [currentEvent];
      }
    }
  }

  if (currentBucket.length > 0) {
    sessionBuckets.push(currentBucket);
  }

  const sessions: PersonSession[] = sessionBuckets.map((bucket, index) => {
    const startTime = new Date(bucket[0].timestamp);
    const endTime = new Date(bucket[bucket.length - 1].timestamp);
    const duration = Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / 1000));

    const explicitSessionId = bucket.find((e) => Boolean(e.sessionId))?.sessionId;
    const sessionId = explicitSessionId || `sess_${startTime.getTime()}_${index}`;

    const pageviews = bucket.filter(
      (e) => e.eventName === '$pageview' || e.eventName === 'pageview'
    );
    const pagePaths = new Set(bucket.map((e) => e.pagePath).filter(Boolean));
    const pageCount = pageviews.length > 0 ? pageviews.length : Math.max(pagePaths.size, 1);

    return {
      sessionId,
      startTime,
      endTime,
      duration,
      pageCount,
      events: bucket,
    };
  });

  // Ordered chronologically descending
  sessions.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

  return sessions;
}

/**
 * Lists persons in a project with optional search and pagination, calculating totalEvents from events table.
 */
export function listPersons(
  projectId: string,
  options: ListPersonsOptions = {}
): Effect.Effect<ListPersonsResult, PersonsError> {
  return Effect.gen(function* () {
    if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
      return yield* Effect.fail(
        new PersonsValidationError({
          message: 'projectId is required to list persons',
        })
      );
    }

    const rawLimit = options.limit;
    const rawOffset = options.offset;
    const limit = Math.max(
      1,
      Math.min(100, typeof rawLimit === 'number' ? rawLimit : parseInt(String(rawLimit || 20), 10) || 20)
    );
    const offset = Math.max(
      0,
      typeof rawOffset === 'number' ? rawOffset : parseInt(String(rawOffset || 0), 10) || 0
    );

    const conditions: SQL<unknown>[] = [eq(persons.projectId, projectId)];

    const search = options.search?.trim();
    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          ilike(persons.distinctId, pattern),
          sql`(${persons.properties}->>'email') ILIKE ${pattern}`,
          sql`(${persons.properties}->>'name') ILIKE ${pattern}`,
          sql`(${persons.properties}->>'$email') ILIKE ${pattern}`,
          sql`(${persons.properties}->>'$name') ILIKE ${pattern}`
        )!
      );
    }

    const whereClause = and(...conditions);

    // 1. Count total matching persons
    const totalCount = yield* Effect.tryPromise({
      try: async () => {
        const [res] = await db
          .select({ total: count() })
          .from(persons)
          .where(whereClause);
        return Number(res?.total || 0);
      },
      catch: (err) =>
        new PersonsDatabaseError({
          message: 'Failed to count persons',
          cause: err,
        }),
    });

    // 2. Fetch paginated person rows
    const personRows = yield* Effect.tryPromise({
      try: async () => {
        return await db
          .select()
          .from(persons)
          .where(whereClause)
          .orderBy(desc(persons.lastSeenAt))
          .limit(limit)
          .offset(offset);
      },
      catch: (err) =>
        new PersonsDatabaseError({
          message: 'Failed to query persons list',
          cause: err,
        }),
    });

    if (personRows.length === 0) {
      return {
        persons: [],
        total: totalCount,
        limit,
        offset,
      };
    }

    // 3. For all fetched persons, look up aliases and event counts
    const personDistinctIds = personRows.map((p) => p.distinctId);

    const { aliasRows, eventCounts } = yield* Effect.tryPromise({
      try: async () => {
        const [aliases, countsRes] = await Promise.all([
          db
            .select({
              aliasId: personAliases.aliasId,
              personDistinctId: personAliases.personDistinctId,
            })
            .from(personAliases)
            .where(
              and(
                eq(personAliases.projectId, projectId),
                inArray(personAliases.personDistinctId, personDistinctIds)
              )
            ),
          // We will query event counts after collecting all aliases
          null,
        ]);
        return { aliasRows: aliases, eventCounts: countsRes };
      },
      catch: (err) =>
        new PersonsDatabaseError({
          message: 'Failed to query person aliases',
          cause: err,
        }),
    });

    // Build map of personDistinctId -> Set of distinct IDs (distinctId + aliases)
    const idMap = new Map<string, Set<string>>();
    const allIdsToCount = new Set<string>();

    for (const p of personRows) {
      const set = new Set<string>([p.distinctId]);
      idMap.set(p.distinctId, set);
      allIdsToCount.add(p.distinctId);
    }

    for (const a of aliasRows) {
      const set = idMap.get(a.personDistinctId);
      if (set) {
        set.add(a.aliasId);
        allIdsToCount.add(a.aliasId);
      }
    }

    // Query event counts for all matching distinct IDs
    const eventCountsResult = yield* Effect.tryPromise({
      try: async () => {
        return await db
          .select({
            distinctId: events.distinctId,
            count: count(),
          })
          .from(events)
          .where(
            and(
              eq(events.projectId, projectId),
              inArray(events.distinctId, Array.from(allIdsToCount))
            )
          )
          .groupBy(events.distinctId);
      },
      catch: (err) =>
        new PersonsDatabaseError({
          message: 'Failed to count events for persons',
          cause: err,
        }),
    });

    const countByDistinctId = new Map<string, number>();
    for (const row of eventCountsResult) {
      countByDistinctId.set(row.distinctId, Number(row.count || 0));
    }

    // Assemble PersonListItem items
    const items: PersonListItem[] = personRows.map((p) => {
      const ids = idMap.get(p.distinctId) || new Set([p.distinctId]);
      let totalEvents = 0;
      for (const id of ids) {
        totalEvents += countByDistinctId.get(id) || 0;
      }

      const props = (p.properties as Record<string, unknown>) || {};
      const email =
        typeof props.email === 'string'
          ? props.email
          : typeof props.$email === 'string'
          ? props.$email
          : null;
      const name =
        typeof props.name === 'string'
          ? props.name
          : typeof props.$name === 'string'
          ? props.$name
          : null;

      return {
        id: p.id,
        distinctId: p.distinctId,
        properties: props,
        firstSeenAt: p.firstSeenAt,
        lastSeenAt: p.lastSeenAt,
        totalEvents,
        email,
        name,
      };
    });

    return {
      persons: items,
      total: totalCount,
      limit,
      offset,
    };
  });
}

/**
 * Retrieves the full profile of a person including aliases, historical events,
 * and session activity clusters. Gracefully handles unaliased distinctIds by synthesizing
 * stub persons if events exist.
 */
export function getPersonProfile(
  projectId: string,
  distinctId: string
): Effect.Effect<PersonProfileDetail, PersonsError> {
  return Effect.gen(function* () {
    if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
      return yield* Effect.fail(
        new PersonsValidationError({
          message: 'projectId is required',
        })
      );
    }

    if (!distinctId || typeof distinctId !== 'string' || !distinctId.trim()) {
      return yield* Effect.fail(
        new PersonsValidationError({
          message: 'distinctId is required',
        })
      );
    }

    const trimmedDistinctId = distinctId.trim();

    // 1. Try to find person directly in persons table
    let primaryPerson = yield* Effect.tryPromise({
      try: async () => {
        const rows = await db
          .select()
          .from(persons)
          .where(
            and(
              eq(persons.projectId, projectId),
              eq(persons.distinctId, trimmedDistinctId)
            )
          )
          .limit(1);
        return rows[0] || null;
      },
      catch: (err) =>
        new PersonsDatabaseError({
          message: `Failed to find person with distinctId '${trimmedDistinctId}'`,
          cause: err,
        }),
    });

    // 2. If not found, check if distinctId is an alias
    if (!primaryPerson) {
      const aliasRow = yield* Effect.tryPromise({
        try: async () => {
          const rows = await db
            .select()
            .from(personAliases)
            .where(
              and(
                eq(personAliases.projectId, projectId),
                eq(personAliases.aliasId, trimmedDistinctId)
              )
            )
            .limit(1);
          return rows[0] || null;
        },
        catch: (err) =>
          new PersonsDatabaseError({
            message: `Failed to query person alias '${trimmedDistinctId}'`,
            cause: err,
          }),
      });

      if (aliasRow) {
        primaryPerson = yield* Effect.tryPromise({
          try: async () => {
            const rows = await db
              .select()
              .from(persons)
              .where(
                and(
                  eq(persons.projectId, projectId),
                  eq(persons.distinctId, aliasRow.personDistinctId)
                )
              )
              .limit(1);
            return rows[0] || null;
          },
          catch: (err) =>
            new PersonsDatabaseError({
              message: `Failed to query person for alias '${aliasRow.personDistinctId}'`,
              cause: err,
            }),
        });
      }
    }

    // 3. If still not found, check if events exist for distinctId
    if (!primaryPerson) {
      const eventsCheck = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .select()
            .from(events)
            .where(
              and(
                eq(events.projectId, projectId),
                eq(events.distinctId, trimmedDistinctId)
              )
            )
            .orderBy(asc(events.timestamp));
        },
        catch: (err) =>
          new PersonsDatabaseError({
            message: 'Failed to check events for unlinked distinctId',
            cause: err,
          }),
      });

      if (eventsCheck.length === 0) {
        return yield* Effect.fail(
          new PersonNotFoundError({
            distinctId: trimmedDistinctId,
            message: `Person '${trimmedDistinctId}' not found in project`,
          })
        );
      }

      // Synthesize stub person record
      const firstSeenAt = new Date(eventsCheck[0].timestamp);
      const lastSeenAt = new Date(eventsCheck[eventsCheck.length - 1].timestamp);

      // Attempt to infer email/name/traits from event properties
      const synthesizedProperties: Record<string, unknown> = {};
      for (const ev of eventsCheck) {
        const p = (ev.properties as Record<string, unknown>) || {};
        if (p.email && !synthesizedProperties.email) synthesizedProperties.email = p.email;
        if (p.$email && !synthesizedProperties.email) synthesizedProperties.email = p.$email;
        if (p.name && !synthesizedProperties.name) synthesizedProperties.name = p.name;
        if (p.$name && !synthesizedProperties.name) synthesizedProperties.name = p.$name;
      }

      primaryPerson = {
        id: `stub_${trimmedDistinctId}`,
        projectId,
        distinctId: trimmedDistinctId,
        properties: synthesizedProperties,
        firstSeenAt,
        lastSeenAt,
        createdAt: firstSeenAt,
        updatedAt: lastSeenAt,
      };
    }

    // 4. Query all aliases for primaryPerson
    const aliasRows = yield* Effect.tryPromise({
      try: async () => {
        return await db
          .select()
          .from(personAliases)
          .where(
            and(
              eq(personAliases.projectId, projectId),
              eq(personAliases.personDistinctId, primaryPerson.distinctId)
            )
          );
      },
      catch: (err) =>
        new PersonsDatabaseError({
          message: 'Failed to query person aliases',
          cause: err,
        }),
    });

    const aliases = Array.from(
      new Set(
        aliasRows
          .map((a) => a.aliasId)
          .filter((a) => a !== primaryPerson.distinctId)
      )
    );

    // If query distinctId was an alias, ensure it's recorded
    if (trimmedDistinctId !== primaryPerson.distinctId && !aliases.includes(trimmedDistinctId)) {
      aliases.push(trimmedDistinctId);
    }

    const allMatchingDistinctIds = Array.from(
      new Set([primaryPerson.distinctId, ...aliases])
    );

    // 5. Query all historical events matching the person or any alias
    const allHistoricalEvents = yield* Effect.tryPromise({
      try: async () => {
        return await db
          .select()
          .from(events)
          .where(
            and(
              eq(events.projectId, projectId),
              inArray(events.distinctId, allMatchingDistinctIds)
            )
          )
          .orderBy(asc(events.timestamp));
      },
      catch: (err) =>
        new PersonsDatabaseError({
          message: 'Failed to query person historical events',
          cause: err,
        }),
    });

    // 6. Group events into sessions
    const sessions = groupEventsIntoSessions(allHistoricalEvents);

    return {
      person: primaryPerson,
      aliases,
      sessions,
      totalEvents: allHistoricalEvents.length,
    };
  });
}

/**
 * Updates or adds a trait in person's properties JSONB object.
 * If person doesn't exist in persons table but has events, creates a person record with the trait.
 */
export function updatePersonTrait(
  projectId: string,
  distinctId: string,
  key: string,
  value: unknown
): Effect.Effect<Person, PersonsError> {
  return Effect.gen(function* () {
    if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
      return yield* Effect.fail(
        new PersonsValidationError({ message: 'projectId is required' })
      );
    }

    if (!distinctId || typeof distinctId !== 'string' || !distinctId.trim()) {
      return yield* Effect.fail(
        new PersonsValidationError({ message: 'distinctId is required' })
      );
    }

    const trimmedKey = key?.trim();
    if (!trimmedKey) {
      return yield* Effect.fail(
        new PersonsValidationError({ message: 'Trait key cannot be empty' })
      );
    }

    const trimmedDistinctId = distinctId.trim();

    // 1. Find existing person
    let existingPerson = yield* Effect.tryPromise({
      try: async () => {
        const rows = await db
          .select()
          .from(persons)
          .where(
            and(
              eq(persons.projectId, projectId),
              eq(persons.distinctId, trimmedDistinctId)
            )
          )
          .limit(1);
        return rows[0] || null;
      },
      catch: (err) =>
        new PersonsDatabaseError({
          message: 'Failed to look up person',
          cause: err,
        }),
    });

    // 2. If not found by distinctId, check alias
    if (!existingPerson) {
      const aliasRow = yield* Effect.tryPromise({
        try: async () => {
          const rows = await db
            .select()
            .from(personAliases)
            .where(
              and(
                eq(personAliases.projectId, projectId),
                eq(personAliases.aliasId, trimmedDistinctId)
              )
            )
            .limit(1);
          return rows[0] || null;
        },
        catch: (err) =>
          new PersonsDatabaseError({
            message: 'Failed to query person alias',
            cause: err,
          }),
      });

      if (aliasRow) {
        existingPerson = yield* Effect.tryPromise({
          try: async () => {
            const rows = await db
              .select()
              .from(persons)
              .where(
                and(
                  eq(persons.projectId, projectId),
                  eq(persons.distinctId, aliasRow.personDistinctId)
                )
              )
              .limit(1);
            return rows[0] || null;
          },
          catch: (err) =>
            new PersonsDatabaseError({
              message: 'Failed to look up person for alias',
              cause: err,
            }),
        });
      }
    }

    const now = new Date();

    // 3. If person not found, verify whether events exist
    if (!existingPerson) {
      const eventExists = yield* Effect.tryPromise({
        try: async () => {
          const rows = await db
            .select({ id: events.id })
            .from(events)
            .where(
              and(
                eq(events.projectId, projectId),
                eq(events.distinctId, trimmedDistinctId)
              )
            )
            .limit(1);
          return rows.length > 0;
        },
        catch: (err) =>
          new PersonsDatabaseError({
            message: 'Failed to check events',
            cause: err,
          }),
      });

      if (!eventExists) {
        return yield* Effect.fail(
          new PersonNotFoundError({
            distinctId: trimmedDistinctId,
            message: `Cannot update trait: Person '${trimmedDistinctId}' not found`,
          })
        );
      }

      // Create new person record with trait
      const createdPerson = yield* Effect.tryPromise({
        try: async () => {
          const [inserted] = await db
            .insert(persons)
            .values({
              projectId,
              distinctId: trimmedDistinctId,
              properties: { [trimmedKey]: value },
              firstSeenAt: now,
              lastSeenAt: now,
              createdAt: now,
              updatedAt: now,
            })
            .returning();
          return inserted;
        },
        catch: (err) =>
          new PersonsDatabaseError({
            message: 'Failed to create person with trait',
            cause: err,
          }),
      });

      return createdPerson;
    }

    // 4. Update existing person's properties
    const currentProps = (existingPerson.properties as Record<string, unknown>) || {};
    const updatedProps = {
      ...currentProps,
      [trimmedKey]: value,
    };

    const updatedPerson = yield* Effect.tryPromise({
      try: async () => {
        const [updated] = await db
          .update(persons)
          .set({
            properties: updatedProps,
            updatedAt: now,
          })
          .where(eq(persons.id, existingPerson.id))
          .returning();
        return updated;
      },
      catch: (err) =>
        new PersonsDatabaseError({
          message: 'Failed to update person trait in database',
          cause: err,
        }),
    });

    return updatedPerson;
  });
}
