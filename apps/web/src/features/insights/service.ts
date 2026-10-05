import { Effect } from 'effect';
import { sql, and, gte, lte, eq, inArray, desc, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import { events, insights } from '@/lib/db/schema';
import type {
  InsightQueryConfig,
  InsightQueryResult,
  InsightTimeSeriesPoint,
  InsightBreakdownItem,
  InsightDateRange,
  InsightGranularity,
  InsightFilter,
  SavedInsight,
} from './types';
import { InsightError } from './errors';

export function resolveInsightDateRange(
  dateRange: InsightDateRange,
  customFrom?: string | Date,
  customTo?: string | Date
): {
  from: Date;
  to: Date;
  defaultGranularity: InsightGranularity;
} {
  const now = new Date();

  if (dateRange === 'custom') {
    const from = customFrom ? new Date(customFrom) : new Date(now.getTime() - 7 * 86400000);
    const to = customTo ? new Date(customTo) : now;
    const durationDays = Math.max(1, (to.getTime() - from.getTime()) / 86400000);

    let defaultGranularity: InsightGranularity = 'day';
    if (durationDays <= 2) defaultGranularity = 'hour';
    else if (durationDays <= 30) defaultGranularity = 'day';
    else if (durationDays <= 90) defaultGranularity = 'week';
    else defaultGranularity = 'month';

    return { from, to, defaultGranularity };
  }

  if (dateRange === '7d') {
    return {
      from: new Date(now.getTime() - 7 * 86400000),
      to: now,
      defaultGranularity: 'day',
    };
  }

  if (dateRange === '90d') {
    return {
      from: new Date(now.getTime() - 90 * 86400000),
      to: now,
      defaultGranularity: 'week',
    };
  }

  // Default '30d'
  return {
    from: new Date(now.getTime() - 30 * 86400000),
    to: now,
    defaultGranularity: 'day',
  };
}

/**
 * Resolves a property string (either system column or custom JSON property) to a SQL expression
 */
export function getPropertySqlExpression(property: string): SQL {
  const p = property.trim();
  switch (p) {
    case 'eventName':
    case 'event_name':
      return sql`${events.eventName}`;
    case 'distinctId':
    case 'distinct_id':
      return sql`${events.distinctId}`;
    case 'sessionId':
    case 'session_id':
      return sql`${events.sessionId}`;
    case 'browser':
      return sql`${events.browser}`;
    case 'browserVersion':
    case 'browser_version':
      return sql`${events.browserVersion}`;
    case 'os':
      return sql`${events.os}`;
    case 'deviceType':
    case 'device_type':
      return sql`${events.deviceType}`;
    case 'countryCode':
    case 'country_code':
      return sql`${events.countryCode}`;
    case 'region':
      return sql`${events.region}`;
    case 'city':
      return sql`${events.city}`;
    case 'referrer':
      return sql`${events.referrer}`;
    case 'referrerDomain':
    case 'referrer_domain':
      return sql`${events.referrerDomain}`;
    case 'pageUrl':
    case 'page_url':
      return sql`${events.pageUrl}`;
    case 'pagePath':
    case 'page_path':
      return sql`${events.pagePath}`;
    case 'utmSource':
    case 'utm_source':
      return sql`${events.utmSource}`;
    case 'utmMedium':
    case 'utm_medium':
      return sql`${events.utmMedium}`;
    case 'utmCampaign':
    case 'utm_campaign':
      return sql`${events.utmCampaign}`;
    case 'utmTerm':
    case 'utm_term':
      return sql`${events.utmTerm}`;
    case 'utmContent':
    case 'utm_content':
      return sql`${events.utmContent}`;
    case 'screenWidth':
    case 'screen_width':
      return sql`${events.screenWidth}`;
    case 'screenHeight':
    case 'screen_height':
      return sql`${events.screenHeight}`;
    default: {
      const jsonKey = p.startsWith('properties.') ? p.slice(11) : p;
      return sql`(${events.properties}->>${jsonKey})`;
    }
  }
}

/**
 * Builds a SQL filter condition from an InsightFilter
 */
export function buildFilterCondition(filter: InsightFilter): SQL {
  const expr = getPropertySqlExpression(filter.property);
  const val = filter.value !== undefined ? String(filter.value) : '';

  switch (filter.operator) {
    case 'equals':
      return sql`${expr} = ${val}`;
    case 'does_not_equal':
      return sql`(${expr} != ${val} OR ${expr} IS NULL)`;
    case 'contains':
      return sql`${expr} ILIKE ${'%' + val + '%'}`;
    case 'is_set':
      return sql`(${expr} IS NOT NULL AND ${expr} != '')`;
    case 'greater_than':
      return sql`(CASE WHEN ${expr} ~ '^[-+]?[0-9]*\\.?[0-9]+$' THEN (${expr})::numeric ELSE NULL END) > ${Number(filter.value || 0)}`;
    case 'less_than':
      return sql`(CASE WHEN ${expr} ~ '^[-+]?[0-9]*\\.?[0-9]+$' THEN (${expr})::numeric ELSE NULL END) < ${Number(filter.value || 0)}`;
    default:
      return sql`1=1`;
  }
}

/**
 * Builds the SQL aggregation expression
 */
export function buildAggregationSql(
  aggregation: InsightQueryConfig['aggregation'],
  aggregationProperty?: string
): SQL {
  switch (aggregation) {
    case 'count':
      return sql`COUNT(*)::int`;
    case 'unique_users':
      return sql`COUNT(DISTINCT ${events.distinctId})::int`;
    case 'unique_sessions':
      return sql`COUNT(DISTINCT ${events.sessionId})::int`;
    case 'avg': {
      const propExpr = getPropertySqlExpression(aggregationProperty || 'value');
      return sql`COALESCE(ROUND(AVG(CASE WHEN ${propExpr} ~ '^[-+]?[0-9]*\\.?[0-9]+$' THEN (${propExpr})::numeric ELSE NULL END), 2), 0)::float`;
    }
    case 'sum': {
      const propExpr = getPropertySqlExpression(aggregationProperty || 'value');
      return sql`COALESCE(ROUND(SUM(CASE WHEN ${propExpr} ~ '^[-+]?[0-9]*\\.?[0-9]+$' THEN (${propExpr})::numeric ELSE NULL END), 2), 0)::float`;
    }
    case 'min': {
      const propExpr = getPropertySqlExpression(aggregationProperty || 'value');
      return sql`COALESCE(MIN(CASE WHEN ${propExpr} ~ '^[-+]?[0-9]*\\.?[0-9]+$' THEN (${propExpr})::numeric ELSE NULL END), 0)::float`;
    }
    case 'max': {
      const propExpr = getPropertySqlExpression(aggregationProperty || 'value');
      return sql`COALESCE(MAX(CASE WHEN ${propExpr} ~ '^[-+]?[0-9]*\\.?[0-9]+$' THEN (${propExpr})::numeric ELSE NULL END), 0)::float`;
    }
    default:
      return sql`COUNT(*)::int`;
  }
}

/**
 * Runs a custom insight query against the events table
 */
export function runInsightQuery(
  projectId: string,
  config: InsightQueryConfig
): Effect.Effect<InsightQueryResult, InsightError> {
  return Effect.gen(function* () {
    const { from, to, defaultGranularity } = resolveInsightDateRange(
      config.dateRange,
      config.customFrom,
      config.customTo
    );
    const granularity = config.granularity || defaultGranularity;

    // Build common WHERE conditions
    const conditions: SQL[] = [
      eq(events.projectId, projectId),
      gte(events.timestamp, from),
      lte(events.timestamp, to),
    ];

    if (config.eventNames && config.eventNames.length > 0) {
      conditions.push(inArray(events.eventName, config.eventNames));
    }

    if (config.filters && config.filters.length > 0) {
      for (const filter of config.filters) {
        conditions.push(buildFilterCondition(filter));
      }
    }

    const whereClause = and(...conditions)!;
    const aggSql = buildAggregationSql(config.aggregation, config.aggregationProperty);

    const result = yield* Effect.tryPromise({
      try: async () => {
        // 1. Total summary value
        const summaryRows = await db
          .select({
            total: aggSql,
          })
          .from(events)
          .where(whereClause);

        const summaryValue = Number(summaryRows[0]?.total || 0);

        // 2. Breakdown query if breakdown dimension is specified
        let breakdown: InsightBreakdownItem[] = [];
        if (config.breakdown && config.breakdown !== 'none') {
          const breakdownExpr = getPropertySqlExpression(config.breakdown);
          const breakdownRows = await db
            .select({
              name: sql<string>`COALESCE(${breakdownExpr}, 'Unknown')`,
              value: aggSql,
            })
            .from(events)
            .where(whereClause)
            .groupBy(sql`1`)
            .orderBy(desc(sql`2`))
            .limit(25);

          const totalBreakdownVal = breakdownRows.reduce(
            (acc, curr) => acc + Number(curr.value || 0),
            0
          );

          breakdown = breakdownRows.map((r) => ({
            name: String(r.name || 'Unknown'),
            value: Number(r.value || 0),
            percentage:
              totalBreakdownVal > 0
                ? Math.round((Number(r.value || 0) / totalBreakdownVal) * 1000) / 10
                : 0,
          }));
        }

        // 3. Time Series query
        const truncExpr = sql<string>`date_trunc(${granularity}, ${events.timestamp})`;
        const timeSeriesRows = await db
          .select({
            bucket: truncExpr,
            val: aggSql,
          })
          .from(events)
          .where(whereClause)
          .groupBy(sql`1`)
          .orderBy(sql`1 ASC`);

        const timeSeries: InsightTimeSeriesPoint[] = timeSeriesRows.map((r) => ({
          timestamp: new Date(r.bucket).toISOString(),
          value: Number(r.val || 0),
        }));

        // 4. Data table rows
        let tableHeaders: string[] = [];
        let tableRows: Record<string, any>[] = [];

        if (breakdown.length > 0) {
          tableHeaders = ['Dimension', 'Value', 'Share (%)'];
          tableRows = breakdown.map((item) => ({
            Dimension: item.name,
            Value: item.value,
            'Share (%)': `${item.percentage}%`,
          }));
        } else {
          tableHeaders = ['Timestamp', 'Value'];
          tableRows = timeSeries.map((p) => ({
            Timestamp: p.timestamp,
            Value: p.value,
          }));
        }

        return {
          summaryValue,
          timeSeries,
          breakdown,
          tableHeaders,
          tableRows,
          totalRows: tableRows.length,
          query: config,
          from: from.toISOString(),
          to: to.toISOString(),
        };
      },
      catch: (err) =>
        new InsightError({
          message: `Failed to execute insight query: ${err instanceof Error ? err.message : String(err)}`,
          cause: err,
        }),
    });

    return result;
  });
}

/**
 * Saves an insight query configuration to the database
 */
export function saveInsight(
  projectId: string,
  input: {
    name: string;
    type?: string;
    queryConfig: InsightQueryConfig;
    dashboardId?: string;
    createdBy?: string;
  }
): Effect.Effect<SavedInsight, InsightError> {
  return Effect.gen(function* () {
    const inserted = yield* Effect.tryPromise({
      try: async () => {
        const [row] = await db
          .insert(insights)
          .values({
            projectId,
            name: input.name.trim(),
            type: input.type || 'trend',
            queryConfig: input.queryConfig,
            dashboardId: input.dashboardId || null,
            createdBy: input.createdBy || null,
          })
          .returning();
        return row;
      },
      catch: (err) =>
        new InsightError({
          message: `Failed to save insight: ${err instanceof Error ? err.message : String(err)}`,
          cause: err,
        }),
    });

    return {
      id: inserted.id,
      projectId: inserted.projectId,
      dashboardId: inserted.dashboardId,
      name: inserted.name,
      type: inserted.type,
      queryConfig: inserted.queryConfig as unknown as InsightQueryConfig,
      layout: inserted.layout as Record<string, any>,
      createdBy: inserted.createdBy,
      createdAt: inserted.createdAt,
      updatedAt: inserted.updatedAt,
    };
  });
}

/**
 * Lists all saved insights for a project
 */
export function listInsights(
  projectId: string,
  typeFilter?: string
): Effect.Effect<SavedInsight[], InsightError> {
  return Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try: async () => {
        let query = db
          .select()
          .from(insights)
          .where(
            typeFilter
              ? and(eq(insights.projectId, projectId), eq(insights.type, typeFilter))
              : eq(insights.projectId, projectId)
          )
          .orderBy(desc(insights.createdAt));

        return await query;
      },
      catch: (err) =>
        new InsightError({
          message: `Failed to list insights: ${err instanceof Error ? err.message : String(err)}`,
          cause: err,
        }),
    });

    return rows.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      dashboardId: r.dashboardId,
      name: r.name,
      type: r.type,
      queryConfig: r.queryConfig as unknown as InsightQueryConfig,
      layout: r.layout as Record<string, any>,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  });
}

/**
 * Gets a saved insight by ID
 */
export function getInsight(insightId: string): Effect.Effect<SavedInsight | null, InsightError> {
  return Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try: async () => {
        return await db
          .select()
          .from(insights)
          .where(eq(insights.id, insightId))
          .limit(1);
      },
      catch: (err) =>
        new InsightError({
          message: `Failed to get insight: ${err instanceof Error ? err.message : String(err)}`,
          cause: err,
        }),
    });

    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      projectId: r.projectId,
      dashboardId: r.dashboardId,
      name: r.name,
      type: r.type,
      queryConfig: r.queryConfig as unknown as InsightQueryConfig,
      layout: r.layout as Record<string, any>,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  });
}
