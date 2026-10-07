import { Effect } from 'effect';
import { sql, eq, and, gte, lte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { events } from '@/lib/db/schema';
import {
  DateRangeKey,
  Granularity,
  KpiMetricsSummary,
  TimeSeriesPoint,
  BreakdownItem,
  BreakdownDimension,
  AnalyticsDataPayload,
} from './types';
import { WebAnalyticsError } from './errors';

export function resolveDateRange(
  dateRange: DateRangeKey,
  customFrom?: string | Date,
  customTo?: string | Date
): {
  from: Date;
  to: Date;
  previousFrom: Date;
  previousTo: Date;
  defaultGranularity: Granularity;
} {
  const now = new Date();

  if (dateRange === 'custom') {
    const from = customFrom ? new Date(customFrom) : new Date(now.getTime() - 7 * 86400000);
    const to = customTo ? new Date(customTo) : now;
    const duration = Math.max(1000, to.getTime() - from.getTime());
    const previousTo = new Date(from.getTime());
    const previousFrom = new Date(from.getTime() - duration);

    let defaultGranularity: Granularity = 'day';
    const days = duration / (1000 * 60 * 60 * 24);
    if (days <= 2) defaultGranularity = 'hour';
    else if (days <= 30) defaultGranularity = 'day';
    else if (days <= 90) defaultGranularity = 'week';
    else defaultGranularity = 'month';

    return { from, to, previousFrom, previousTo, defaultGranularity };
  }

  if (dateRange === 'today') {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const to = now;
    const duration = Math.max(1000, to.getTime() - from.getTime());
    const previousTo = from;
    const previousFrom = new Date(from.getTime() - duration);
    return { from, to, previousFrom, previousTo, defaultGranularity: 'hour' };
  }

  if (dateRange === '24h') {
    const from = new Date(now.getTime() - 24 * 3600000);
    const to = now;
    const previousTo = from;
    const previousFrom = new Date(from.getTime() - 24 * 3600000);
    return { from, to, previousFrom, previousTo, defaultGranularity: 'hour' };
  }

  if (dateRange === '7d') {
    const from = new Date(now.getTime() - 7 * 86400000);
    const to = now;
    const previousTo = from;
    const previousFrom = new Date(from.getTime() - 7 * 86400000);
    return { from, to, previousFrom, previousTo, defaultGranularity: 'day' };
  }

  if (dateRange === '90d') {
    const from = new Date(now.getTime() - 90 * 86400000);
    const to = now;
    const previousTo = from;
    const previousFrom = new Date(from.getTime() - 90 * 86400000);
    return { from, to, previousFrom, previousTo, defaultGranularity: 'week' };
  }

  // Default '30d'
  const from = new Date(now.getTime() - 30 * 86400000);
  const to = now;
  const previousTo = from;
  const previousFrom = new Date(from.getTime() - 30 * 86400000);
  return { from, to, previousFrom, previousTo, defaultGranularity: 'day' };
}

export function calculateChangePercentage(current: number, previous: number): number | null {
  if (previous === 0) {
    return current > 0 ? null : 0;
  }
  const pct = ((current - previous) / previous) * 100;
  return Math.round(pct * 10) / 10;
}

interface WindowMetrics {
  uniqueVisitors: number;
  totalPageviews: number;
  totalSessions: number;
  bounceRate: number;
  avgSessionDuration: number;
}

async function queryKpiWindow(
  projectId: string,
  fromDate: Date,
  toDate: Date
): Promise<WindowMetrics> {
  const summaryRes = await db
    .select({
      uniqueVisitors: sql<number>`count(distinct ${events.distinctId})::int`,
      totalPageviews: sql<number>`count(case when ${events.eventName} = '$pageview' then 1 end)::int`,
      totalSessions: sql<number>`count(distinct ${events.sessionId})::int`,
    })
    .from(events)
    .where(
      and(
        eq(events.projectId, projectId),
        gte(events.timestamp, fromDate),
        lte(events.timestamp, toDate)
      )
    );

  const summary = summaryRes[0] ?? { uniqueVisitors: 0, totalPageviews: 0, totalSessions: 0 };

  const sessionRows = await db
    .select({
      eventCount: sql<number>`count(*)::int`,
      durationSeconds: sql<number>`extract(epoch from (max(${events.timestamp}) - min(${events.timestamp})))::float`,
    })
    .from(events)
    .where(
      and(
        eq(events.projectId, projectId),
        gte(events.timestamp, fromDate),
        lte(events.timestamp, toDate)
      )
    )
    .groupBy(sql`coalesce(${events.sessionId}, ${events.distinctId})`);

  let bounceRate = 0;
  let avgSessionDuration = 0;

  if (sessionRows.length > 0) {
    const bounced = sessionRows.filter(
      (s) => s.eventCount <= 1 || s.durationSeconds < 10
    ).length;
    bounceRate = Math.round((bounced / sessionRows.length) * 1000) / 10;

    const totalDuration = sessionRows.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);
    avgSessionDuration = Math.round(totalDuration / sessionRows.length);
  }

  const calculatedSessions = Math.max(summary.totalSessions, sessionRows.length);

  return {
    uniqueVisitors: summary.uniqueVisitors,
    totalPageviews: summary.totalPageviews,
    totalSessions: calculatedSessions,
    bounceRate,
    avgSessionDuration,
  };
}

/**
 * Calculates high-level KPI cards and comparison period percentage change
 */
export function getKpiMetrics(
  projectId: string,
  dateRange: DateRangeKey,
  customFrom?: string | Date,
  customTo?: string | Date
): Effect.Effect<KpiMetricsSummary, WebAnalyticsError> {
  return Effect.gen(function* () {
    const { from, to, previousFrom, previousTo } = resolveDateRange(
      dateRange,
      customFrom,
      customTo
    );

    const [currentMetrics, previousMetrics] = yield* Effect.tryPromise({
      try: () =>
        Promise.all([
          queryKpiWindow(projectId, from, to),
          queryKpiWindow(projectId, previousFrom, previousTo),
        ]),
      catch: (err) =>
        new WebAnalyticsError({
          message: 'Failed to query KPI metrics',
          cause: err,
        }),
    });

    return {
      uniqueVisitors: {
        value: currentMetrics.uniqueVisitors,
        previousValue: previousMetrics.uniqueVisitors,
        changePercentage: calculateChangePercentage(
          currentMetrics.uniqueVisitors,
          previousMetrics.uniqueVisitors
        ),
      },
      totalPageviews: {
        value: currentMetrics.totalPageviews,
        previousValue: previousMetrics.totalPageviews,
        changePercentage: calculateChangePercentage(
          currentMetrics.totalPageviews,
          previousMetrics.totalPageviews
        ),
      },
      totalSessions: {
        value: currentMetrics.totalSessions,
        previousValue: previousMetrics.totalSessions,
        changePercentage: calculateChangePercentage(
          currentMetrics.totalSessions,
          previousMetrics.totalSessions
        ),
      },
      bounceRate: {
        value: currentMetrics.bounceRate,
        previousValue: previousMetrics.bounceRate,
        changePercentage: calculateChangePercentage(
          currentMetrics.bounceRate,
          previousMetrics.bounceRate
        ),
      },
      avgSessionDuration: {
        value: currentMetrics.avgSessionDuration,
        previousValue: previousMetrics.avgSessionDuration,
        changePercentage: calculateChangePercentage(
          currentMetrics.avgSessionDuration,
          previousMetrics.avgSessionDuration
        ),
      },
    };
  });
}

// Traffic ranges and buckets are UTC, regardless of the database connection's timezone.
function startOfUtcBucket(date: Date, granularity: Granularity): Date {
  const bucket = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  if (granularity === 'hour') bucket.setUTCHours(date.getUTCHours());
  if (granularity === 'week') bucket.setUTCDate(bucket.getUTCDate() - ((bucket.getUTCDay() + 6) % 7));
  if (granularity === 'month') bucket.setUTCDate(1);
  return bucket;
}

function nextUtcBucket(date: Date, granularity: Granularity): Date {
  const next = new Date(date);
  if (granularity === 'hour') next.setUTCHours(next.getUTCHours() + 1);
  if (granularity === 'day') next.setUTCDate(next.getUTCDate() + 1);
  if (granularity === 'week') next.setUTCDate(next.getUTCDate() + 7);
  if (granularity === 'month') next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

/**
 * Calculates time-series points grouped by UTC hour, day, ISO week or month.
 * An empty range returns []; otherwise missing buckets within the range are zero.
 */
export function getTimeSeriesMetrics(
  projectId: string,
  dateRange: DateRangeKey,
  granularity?: Granularity,
  customFrom?: string | Date,
  customTo?: string | Date
): Effect.Effect<TimeSeriesPoint[], WebAnalyticsError> {
  return Effect.gen(function* () {
    const resolved = resolveDateRange(dateRange, customFrom, customTo);
    const activeGranularity = granularity || resolved.defaultGranularity;

    const rows = yield* Effect.tryPromise({
      try: async () => {
        const truncSql = sql.raw(`'${activeGranularity}'`);
        const utcBucket = sql`date_trunc(${truncSql}, ${events.timestamp} at time zone 'UTC') at time zone 'UTC'`;
        return await db
          .select({
            bucket: sql<string>`${utcBucket}::text`,
            pageviews: sql<number>`count(case when ${events.eventName} = '$pageview' then 1 end)::int`,
            visitors: sql<number>`count(distinct ${events.distinctId})::int`,
            sessions: sql<number>`count(distinct coalesce(${events.sessionId}, ${events.distinctId}))::int`,
          })
          .from(events)
          .where(
            and(
              eq(events.projectId, projectId),
              gte(events.timestamp, resolved.from),
              lte(events.timestamp, resolved.to)
            )
          )
          .groupBy(utcBucket)
          .orderBy(sql`${utcBucket} asc`);
      },
      catch: (err) =>
        new WebAnalyticsError({
          message: 'Failed to query time series metrics',
          cause: err,
        }),
    });

    if (rows.length === 0) return [];

    const byBucket = new Map(rows.map((row) => [new Date(row.bucket).toISOString(), row]));
    const points: TimeSeriesPoint[] = [];
    for (
      let bucket = startOfUtcBucket(resolved.from, activeGranularity);
      bucket <= resolved.to;
      bucket = nextUtcBucket(bucket, activeGranularity)
    ) {
      const timestamp = bucket.toISOString();
      const row = byBucket.get(timestamp);
      points.push({
        timestamp,
        pageviews: row?.pageviews ?? 0,
        visitors: row?.visitors ?? 0,
        sessions: row?.sessions ?? 0,
      });
    }

    return points;
  });
}

/**
 * Pages rank $pageview events; other dimensions rank all recorded events (event context,
 * not first-touch attribution). Percentages use the full eligible event count, not top 10.
 */
export function getBreakdownMetrics(
  projectId: string,
  dateRange: DateRangeKey,
  dimension: BreakdownDimension,
  customFrom?: string | Date,
  customTo?: string | Date
): Effect.Effect<BreakdownItem[], WebAnalyticsError> {
  return Effect.gen(function* () {
    const { from, to } = resolveDateRange(dateRange, customFrom, customTo);

    const result = yield* Effect.tryPromise({
      try: async () => {
        let nameExpr = sql`'Unknown'`;

        switch (dimension) {
          case 'pages':
            nameExpr = sql`coalesce(nullif(${events.pagePath}, ''), '/')`;
            break;
          case 'referrers':
            nameExpr = sql`coalesce(nullif(${events.referrerDomain}, ''), 'Direct / None')`;
            break;
          case 'utm':
            nameExpr = sql`coalesce(nullif(${events.utmCampaign}, ''), 'None')`;
            break;
          case 'countries':
            nameExpr = sql`coalesce(nullif(${events.countryCode}, ''), 'Unknown')`;
            break;
          case 'browsers':
            nameExpr = sql`coalesce(nullif(${events.browser}, ''), 'Other')`;
            break;
          case 'os':
            nameExpr = sql`coalesce(nullif(${events.os}, ''), 'Other')`;
            break;
          case 'devices':
            nameExpr = sql`coalesce(nullif(${events.deviceType}, ''), 'Desktop')`;
            break;
        }

        const rows = await db
          .select({
            name: sql<string>`${nameExpr}::text`,
            value: sql<number>`count(*)::int`,
            // Window total runs before LIMIT: shares include every eligible event.
            total: sql<number>`sum(count(*)) over()::int`,
          })
          .from(events)
          .where(
            and(
              eq(events.projectId, projectId),
              gte(events.timestamp, from),
              lte(events.timestamp, to),
              dimension === 'pages' ? eq(events.eventName, '$pageview') : undefined
            )
          )
          .groupBy(nameExpr)
          .orderBy(sql`count(*) desc`)
          .limit(10);

        const totalValue = rows[0]?.total ?? 0;

        const items: BreakdownItem[] = rows.map((r) => ({
          name: r.name,
          value: r.value,
          percentage:
            totalValue > 0 ? Math.round((r.value / totalValue) * 1000) / 10 : 0,
        }));

        return items;
      },
      catch: (err) =>
        new WebAnalyticsError({
          message: `Failed to query breakdown metrics for ${dimension}`,
          cause: err,
        }),
    });

    return result;
  });
}

/** Custom actions explicitly captured by an app (automatic $ events are excluded). */
export function getTopEvents(
  projectId: string,
  dateRange: DateRangeKey,
  customFrom?: string | Date,
  customTo?: string | Date
): Effect.Effect<BreakdownItem[], WebAnalyticsError> {
  return Effect.tryPromise({
    try: async () => {
      const { from, to } = resolveDateRange(dateRange, customFrom, customTo);
      const rows = await db.select({
        name: events.eventName,
        value: sql<number>`count(*)::int`,
        total: sql<number>`sum(count(*)) over()::int`,
      }).from(events).where(and(
        eq(events.projectId, projectId),
        gte(events.timestamp, from),
        lte(events.timestamp, to),
        sql`${events.eventName} not like '$%'`
      )).groupBy(events.eventName).orderBy(sql`count(*) desc`, events.eventName).limit(10);
      const total = rows[0]?.total ?? 0;
      return rows.map((row) => ({
        name: row.name,
        value: row.value,
        percentage: total ? Math.round(row.value / total * 1000) / 10 : 0,
      }));
    },
    catch: (cause) => new WebAnalyticsError({ message: 'Failed to query app events', cause }),
  });
}

/**
 * Aggregates all web analytics metrics (KPIs, time-series, and breakdowns) in a single workflow
 */
export function getAllAnalyticsData(
  projectId: string,
  dateRange: DateRangeKey = '30d',
  granularity?: Granularity,
  customFrom?: string | Date,
  customTo?: string | Date
): Effect.Effect<AnalyticsDataPayload, WebAnalyticsError> {
  return Effect.gen(function* () {
    const resolved = resolveDateRange(dateRange, customFrom, customTo);
    const activeGranularity = granularity || resolved.defaultGranularity;

    const [
      kpis,
      timeSeries,
      appEvents,
      pages,
      referrers,
      utm,
      countries,
      browsers,
      os,
      devices,
    ] = yield* Effect.all([
      getKpiMetrics(projectId, dateRange, customFrom, customTo),
      getTimeSeriesMetrics(projectId, dateRange, activeGranularity, customFrom, customTo),
      getTopEvents(projectId, dateRange, customFrom, customTo),
      getBreakdownMetrics(projectId, dateRange, 'pages', customFrom, customTo),
      getBreakdownMetrics(projectId, dateRange, 'referrers', customFrom, customTo),
      getBreakdownMetrics(projectId, dateRange, 'utm', customFrom, customTo),
      getBreakdownMetrics(projectId, dateRange, 'countries', customFrom, customTo),
      getBreakdownMetrics(projectId, dateRange, 'browsers', customFrom, customTo),
      getBreakdownMetrics(projectId, dateRange, 'os', customFrom, customTo),
      getBreakdownMetrics(projectId, dateRange, 'devices', customFrom, customTo),
    ]);

    return {
      kpis,
      timeSeries,
      breakdowns: {
        events: appEvents,
        pages,
        referrers,
        utm,
        countries,
        browsers,
        os,
        devices,
      },
      dateRange,
      granularity: activeGranularity,
      timezone: 'UTC',
      from: resolved.from.toISOString(),
      to: resolved.to.toISOString(),
    };
  });
}
