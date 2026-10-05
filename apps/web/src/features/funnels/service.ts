import { Effect } from 'effect';
import { sql, and, gte, lte, eq, inArray, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { events, insights } from '@/lib/db/schema';
import type {
  FunnelQueryConfig,
  FunnelResult,
  FunnelStepResult,
  FunnelStepFilter,
  SavedFunnel,
} from './types';
import { FunnelError } from './errors';

export function resolveFunnelDateRange(
  dateRange: FunnelQueryConfig['dateRange'],
  customFrom?: string | Date,
  customTo?: string | Date
): { from: Date; to: Date } {
  const now = new Date();

  if (dateRange === 'custom') {
    const from = customFrom ? new Date(customFrom) : new Date(now.getTime() - 7 * 86400000);
    const to = customTo ? new Date(customTo) : now;
    return { from, to };
  }

  if (dateRange === '7d') {
    return {
      from: new Date(now.getTime() - 7 * 86400000),
      to: now,
    };
  }

  if (dateRange === '90d') {
    return {
      from: new Date(now.getTime() - 90 * 86400000),
      to: now,
    };
  }

  // Default '30d'
  return {
    from: new Date(now.getTime() - 30 * 86400000),
    to: now,
  };
}

export function conversionWindowToMs(window: FunnelQueryConfig['conversionWindow']): number {
  const val = Math.max(1, window.value || 1);
  switch (window.unit) {
    case 'minute':
      return val * 60 * 1000;
    case 'hour':
      return val * 3600 * 1000;
    case 'day':
      return val * 86400 * 1000;
    default:
      return val * 86400 * 1000;
  }
}

/**
 * Checks if an event record satisfies a list of step filters
 */
export function matchesStepFilters(eventRecord: any, filters?: FunnelStepFilter[]): boolean {
  if (!filters || filters.length === 0) return true;

  for (const filter of filters) {
    let actualValue: any;
    const prop = filter.property.trim();

    if (prop in eventRecord) {
      actualValue = eventRecord[prop];
    } else if (prop.startsWith('properties.')) {
      const key = prop.slice(11);
      actualValue = eventRecord.properties?.[key];
    } else if (eventRecord.properties && prop in eventRecord.properties) {
      actualValue = eventRecord.properties[prop];
    } else {
      actualValue = undefined;
    }

    const targetVal = filter.value;

    switch (filter.operator) {
      case 'equals':
        if (String(actualValue ?? '') !== String(targetVal ?? '')) return false;
        break;
      case 'does_not_equal':
        if (String(actualValue ?? '') === String(targetVal ?? '')) return false;
        break;
      case 'contains':
        if (!String(actualValue ?? '').toLowerCase().includes(String(targetVal ?? '').toLowerCase())) {
          return false;
        }
        break;
      case 'is_set':
        if (actualValue === undefined || actualValue === null || actualValue === '') {
          return false;
        }
        break;
      case 'greater_than': {
        const num = Number(actualValue);
        if (isNaN(num) || num <= Number(targetVal || 0)) return false;
        break;
      }
      case 'less_than': {
        const num = Number(actualValue);
        if (isNaN(num) || num >= Number(targetVal || 0)) return false;
        break;
      }
    }
  }

  return true;
}

export function calculateMedian(numbers: number[]): number | null {
  if (!numbers.length) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[mid];
  }
  return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
}

/**
 * Calculates a multi-step conversion funnel
 */
export function calculateFunnel(
  projectId: string,
  config: FunnelQueryConfig
): Effect.Effect<FunnelResult, FunnelError> {
  return Effect.gen(function* () {
    if (!config.steps || config.steps.length < 2) {
      return yield* Effect.fail(
        new FunnelError({ message: 'Funnel must have at least 2 steps' })
      );
    }

    const { from, to } = resolveFunnelDateRange(
      config.dateRange,
      config.customFrom,
      config.customTo
    );
    const windowMs = conversionWindowToMs(config.conversionWindow);
    const queryEnd = new Date(to.getTime() + windowMs);

    const stepEventNames = Array.from(new Set(config.steps.map((s) => s.eventName)));

    const rawEvents = yield* Effect.tryPromise({
      try: async () => {
        return await db
          .select({
            id: events.id,
            eventName: events.eventName,
            distinctId: events.distinctId,
            sessionId: events.sessionId,
            browser: events.browser,
            os: events.os,
            deviceType: events.deviceType,
            countryCode: events.countryCode,
            pagePath: events.pagePath,
            properties: events.properties,
            timestamp: events.timestamp,
          })
          .from(events)
          .where(
            and(
              eq(events.projectId, projectId),
              inArray(events.eventName, stepEventNames),
              gte(events.timestamp, from),
              lte(events.timestamp, queryEnd)
            )
          )
          .orderBy(events.distinctId, events.timestamp);
      },
      catch: (err) =>
        new FunnelError({
          message: `Failed to query funnel events: ${err instanceof Error ? err.message : String(err)}`,
          cause: err,
        }),
    });

    // Group events by distinctId
    const eventsByUser = new Map<string, typeof rawEvents>();
    for (const ev of rawEvents) {
      const list = eventsByUser.get(ev.distinctId) || [];
      list.push(ev);
      eventsByUser.set(ev.distinctId, list);
    }

    const numSteps = config.steps.length;
    // Step completion tracking per step index
    // userCompletedStep[stepIndex] = Map<distinctId, timestamp>
    const userCompletedStep: Map<string, Date>[] = Array.from(
      { length: numSteps },
      () => new Map()
    );

    // Durations between step i-1 and step i in seconds
    const stepDurations: number[][] = Array.from({ length: numSteps }, () => []);

    for (const [distinctId, userEvts] of eventsByUser.entries()) {
      // Step 1: Must occur within [from, to]
      const step1Config = config.steps[0];
      const step1Event = userEvts.find(
        (e) =>
          e.eventName === step1Config.eventName &&
          e.timestamp >= from &&
          e.timestamp <= to &&
          matchesStepFilters(e, step1Config.filters)
      );

      if (!step1Event) {
        continue;
      }

      const step1Time = step1Event.timestamp;
      userCompletedStep[0].set(distinctId, step1Time);

      let prevTime = step1Time;

      // Sequential check for Step 2..N
      for (let s = 1; s < numSteps; s++) {
        const stepConfig = config.steps[s];
        const nextEvent = userEvts.find(
          (e) =>
            e.eventName === stepConfig.eventName &&
            e.timestamp >= prevTime &&
            e.timestamp.getTime() <= step1Time.getTime() + windowMs &&
            matchesStepFilters(e, stepConfig.filters)
        );

        if (!nextEvent) {
          // Dropped out at step s-1
          break;
        }

        userCompletedStep[s].set(distinctId, nextEvent.timestamp);
        const durationSec = Math.max(
          0,
          Math.round((nextEvent.timestamp.getTime() - prevTime.getTime()) / 1000)
        );
        stepDurations[s].push(durationSec);
        prevTime = nextEvent.timestamp;
      }
    }

    const firstStepCount = userCompletedStep[0].size;
    const finalStepCount = userCompletedStep[numSteps - 1].size;

    const stepResults: FunnelStepResult[] = [];

    for (let s = 0; s < numSteps; s++) {
      const stepConfig = config.steps[s];
      const currentCount = userCompletedStep[s].size;
      const nextCount = s < numSteps - 1 ? userCompletedStep[s + 1].size : 0;
      const dropOffCount = s < numSteps - 1 ? Math.max(0, currentCount - nextCount) : 0;
      const dropOffPercentage =
        currentCount > 0 ? Math.round((dropOffCount / currentCount) * 1000) / 10 : 0;

      const prevCount = s > 0 ? userCompletedStep[s - 1].size : currentCount;
      const conversionRateFromPrevious =
        s === 0
          ? 100
          : prevCount > 0
          ? Math.round((currentCount / prevCount) * 1000) / 10
          : 0;

      const conversionRateFromFirst =
        firstStepCount > 0 ? Math.round((currentCount / firstStepCount) * 1000) / 10 : 0;

      const medianTimeToConvertSeconds =
        s > 0 ? calculateMedian(stepDurations[s]) : null;

      // Extract dropped user identifiers
      const droppedUserIds: string[] = [];
      if (s < numSteps - 1) {
        const nextUsers = userCompletedStep[s + 1];
        for (const uid of userCompletedStep[s].keys()) {
          if (!nextUsers.has(uid)) {
            droppedUserIds.push(uid);
          }
        }
      }

      stepResults.push({
        stepIndex: s,
        id: stepConfig.id,
        name: stepConfig.name || `Step ${s + 1}: ${stepConfig.eventName}`,
        eventName: stepConfig.eventName,
        count: currentCount,
        dropOffCount,
        dropOffPercentage,
        conversionRateFromPrevious,
        conversionRateFromFirst,
        medianTimeToConvertSeconds,
        droppedUserIds,
      });
    }

    const overallConversionRate =
      firstStepCount > 0 ? Math.round((finalStepCount / firstStepCount) * 1000) / 10 : 0;

    return {
      steps: stepResults,
      overallConversionRate,
      totalUsers: firstStepCount,
      convertedUsers: finalStepCount,
      query: config,
      from: from.toISOString(),
      to: to.toISOString(),
    };
  });
}

/**
 * Saves a funnel configuration to the insights table
 */
export function saveFunnel(
  projectId: string,
  input: {
    name: string;
    queryConfig: FunnelQueryConfig;
    createdBy?: string;
  }
): Effect.Effect<SavedFunnel, FunnelError> {
  return Effect.gen(function* () {
    const inserted = yield* Effect.tryPromise({
      try: async () => {
        const [row] = await db
          .insert(insights)
          .values({
            projectId,
            name: input.name.trim(),
            type: 'funnel',
            queryConfig: input.queryConfig,
            createdBy: input.createdBy || null,
          })
          .returning();
        return row;
      },
      catch: (err) =>
        new FunnelError({
          message: `Failed to save funnel: ${err instanceof Error ? err.message : String(err)}`,
          cause: err,
        }),
    });

    return {
      id: inserted.id,
      projectId: inserted.projectId,
      name: inserted.name,
      queryConfig: inserted.queryConfig as unknown as FunnelQueryConfig,
      createdBy: inserted.createdBy,
      createdAt: inserted.createdAt,
      updatedAt: inserted.updatedAt,
    };
  });
}

/**
 * Lists all saved funnels for a project
 */
export function listFunnels(projectId: string): Effect.Effect<SavedFunnel[], FunnelError> {
  return Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try: async () => {
        return await db
          .select()
          .from(insights)
          .where(and(eq(insights.projectId, projectId), eq(insights.type, 'funnel')))
          .orderBy(desc(insights.createdAt));
      },
      catch: (err) =>
        new FunnelError({
          message: `Failed to list funnels: ${err instanceof Error ? err.message : String(err)}`,
          cause: err,
        }),
    });

    return rows.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      name: r.name,
      queryConfig: r.queryConfig as unknown as FunnelQueryConfig,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  });
}
