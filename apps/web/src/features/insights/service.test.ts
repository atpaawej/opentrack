import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Effect, Exit } from 'effect';
import { db } from '@/lib/db';
import { projects, events, insights } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  resolveInsightDateRange,
  runInsightQuery,
  saveInsight,
  listInsights,
  getInsight,
} from './service';

describe('Custom Insights Engine — Service & Aggregations', () => {
  let testProjectId: string;
  let emptyProjectId: string;

  beforeAll(async () => {
    // 1. Create a project with test events
    const [inserted] = await db
      .insert(projects)
      .values({
        name: 'Insights Test Project',
        slug: `test-insights-${Date.now()}`,
        clerkUserId: 'test_user_insights',
        apiKey: `ot_live_test_insights_${Date.now()}`,
      })
      .returning();
    testProjectId = inserted.id;

    // 2. Create an empty project
    const [emptyProj] = await db
      .insert(projects)
      .values({
        name: 'Empty Insights Project',
        slug: `test-empty-insights-${Date.now()}`,
        clerkUserId: 'test_user_insights',
        apiKey: `ot_live_test_empty_insights_${Date.now()}`,
      })
      .returning();
    emptyProjectId = emptyProj.id;

    // 3. Seed test events
    const now = new Date();
    const eventTime1 = new Date(now.getTime() - 2 * 3600 * 1000); // 2 hours ago
    const eventTime2 = new Date(now.getTime() - 3 * 3600 * 1000); // 3 hours ago
    const eventTime3 = new Date(now.getTime() - 4 * 3600 * 1000); // 4 hours ago

    await db.insert(events).values([
      {
        projectId: testProjectId,
        eventName: '$pageview',
        distinctId: 'user_alpha',
        sessionId: 'sess_1',
        browser: 'Chrome',
        os: 'macOS',
        deviceType: 'Desktop',
        countryCode: 'US',
        properties: { tier: 'pro', order_value: 120 },
        timestamp: eventTime1,
      },
      {
        projectId: testProjectId,
        eventName: '$pageview',
        distinctId: 'user_alpha',
        sessionId: 'sess_1',
        browser: 'Chrome',
        os: 'macOS',
        deviceType: 'Desktop',
        countryCode: 'US',
        properties: { tier: 'pro', order_value: 80 },
        timestamp: eventTime2,
      },
      {
        projectId: testProjectId,
        eventName: 'checkout_completed',
        distinctId: 'user_beta',
        sessionId: 'sess_2',
        browser: 'Firefox',
        os: 'Windows',
        deviceType: 'Desktop',
        countryCode: 'DE',
        properties: { tier: 'enterprise', order_value: 300 },
        timestamp: eventTime3,
      },
    ]);
  });

  afterAll(async () => {
    if (testProjectId) {
      await db.delete(insights).where(eq(insights.projectId, testProjectId));
      await db.delete(events).where(eq(events.projectId, testProjectId));
      await db.delete(projects).where(eq(projects.id, testProjectId));
    }
    if (emptyProjectId) {
      await db.delete(insights).where(eq(insights.projectId, emptyProjectId));
      await db.delete(events).where(eq(events.projectId, emptyProjectId));
      await db.delete(projects).where(eq(projects.id, emptyProjectId));
    }
  });

  describe('resolveInsightDateRange', () => {
    it('resolves 7d, 30d, 90d presets properly', () => {
      const r7 = resolveInsightDateRange('7d');
      expect(r7.defaultGranularity).toBe('day');
      expect(r7.to.getTime() - r7.from.getTime()).toBeCloseTo(7 * 86400 * 1000, -3);

      const r30 = resolveInsightDateRange('30d');
      expect(r30.defaultGranularity).toBe('day');
      expect(r30.to.getTime() - r30.from.getTime()).toBeCloseTo(30 * 86400 * 1000, -3);

      const r90 = resolveInsightDateRange('90d');
      expect(r90.defaultGranularity).toBe('week');
    });

    it('resolves custom date range', () => {
      const from = new Date('2026-05-01T00:00:00Z');
      const to = new Date('2026-05-15T00:00:00Z');
      const res = resolveInsightDateRange('custom', from, to);
      expect(res.from.toISOString()).toBe(from.toISOString());
      expect(res.to.toISOString()).toBe(to.toISOString());
      expect(res.defaultGranularity).toBe('day');
    });
  });

  describe('runInsightQuery', () => {
    it('returns empty result when project has 0 events', async () => {
      const exit = await Effect.runPromiseExit(
        runInsightQuery(emptyProjectId, {
          aggregation: 'count',
          dateRange: '30d',
        })
      );

      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(exit.value.summaryValue).toBe(0);
        expect(exit.value.timeSeries).toEqual([]);
        expect(exit.value.breakdown).toEqual([]);
      }
    });

    it('counts total events and unique users accurately', async () => {
      // 1. Total events count
      const countExit = await Effect.runPromiseExit(
        runInsightQuery(testProjectId, {
          aggregation: 'count',
          dateRange: '7d',
        })
      );
      expect(Exit.isSuccess(countExit)).toBe(true);
      if (Exit.isSuccess(countExit)) {
        expect(countExit.value.summaryValue).toBe(3);
      }

      // 2. Unique users count
      const usersExit = await Effect.runPromiseExit(
        runInsightQuery(testProjectId, {
          aggregation: 'unique_users',
          dateRange: '7d',
        })
      );
      expect(Exit.isSuccess(usersExit)).toBe(true);
      if (Exit.isSuccess(usersExit)) {
        expect(usersExit.value.summaryValue).toBe(2); // user_alpha and user_beta
      }
    });

    it('filters by eventName and property operators', async () => {
      // Filter by eventName '$pageview'
      const pageviewsExit = await Effect.runPromiseExit(
        runInsightQuery(testProjectId, {
          eventNames: ['$pageview'],
          aggregation: 'count',
          dateRange: '7d',
        })
      );
      expect(Exit.isSuccess(pageviewsExit)).toBe(true);
      if (Exit.isSuccess(pageviewsExit)) {
        expect(pageviewsExit.value.summaryValue).toBe(2);
      }

      // Filter by property 'browser' equals 'Chrome'
      const filterExit = await Effect.runPromiseExit(
        runInsightQuery(testProjectId, {
          aggregation: 'count',
          filters: [{ property: 'browser', operator: 'equals', value: 'Chrome' }],
          dateRange: '7d',
        })
      );
      expect(Exit.isSuccess(filterExit)).toBe(true);
      if (Exit.isSuccess(filterExit)) {
        expect(filterExit.value.summaryValue).toBe(2);
      }

      // Filter by JSON property 'properties.tier' equals 'enterprise'
      const jsonFilterExit = await Effect.runPromiseExit(
        runInsightQuery(testProjectId, {
          aggregation: 'count',
          filters: [{ property: 'properties.tier', operator: 'equals', value: 'enterprise' }],
          dateRange: '7d',
        })
      );
      expect(Exit.isSuccess(jsonFilterExit)).toBe(true);
      if (Exit.isSuccess(jsonFilterExit)) {
        expect(jsonFilterExit.value.summaryValue).toBe(1);
      }
    });

    it('performs numeric aggregations (sum, avg, min, max) on JSON properties', async () => {
      // Sum order_value
      const sumExit = await Effect.runPromiseExit(
        runInsightQuery(testProjectId, {
          aggregation: 'sum',
          aggregationProperty: 'properties.order_value',
          dateRange: '7d',
        })
      );
      expect(Exit.isSuccess(sumExit)).toBe(true);
      if (Exit.isSuccess(sumExit)) {
        // 120 + 80 + 300 = 500
        expect(sumExit.value.summaryValue).toBe(500);
      }

      // Avg order_value
      const avgExit = await Effect.runPromiseExit(
        runInsightQuery(testProjectId, {
          aggregation: 'avg',
          aggregationProperty: 'properties.order_value',
          dateRange: '7d',
        })
      );
      expect(Exit.isSuccess(avgExit)).toBe(true);
      if (Exit.isSuccess(avgExit)) {
        // 500 / 3 = 166.67
        expect(avgExit.value.summaryValue).toBeCloseTo(166.67, 1);
      }

      // Max order_value
      const maxExit = await Effect.runPromiseExit(
        runInsightQuery(testProjectId, {
          aggregation: 'max',
          aggregationProperty: 'properties.order_value',
          dateRange: '7d',
        })
      );
      expect(Exit.isSuccess(maxExit)).toBe(true);
      if (Exit.isSuccess(maxExit)) {
        expect(maxExit.value.summaryValue).toBe(300);
      }
    });

    it('computes breakdown grouped by system and JSON dimension', async () => {
      // Breakdown by browser
      const breakdownExit = await Effect.runPromiseExit(
        runInsightQuery(testProjectId, {
          aggregation: 'count',
          breakdown: 'browser',
          dateRange: '7d',
        })
      );
      expect(Exit.isSuccess(breakdownExit)).toBe(true);
      if (Exit.isSuccess(breakdownExit)) {
        const breakdown = breakdownExit.value.breakdown;
        expect(breakdown.length).toBe(2);
        const chrome = breakdown.find((b) => b.name === 'Chrome');
        const firefox = breakdown.find((b) => b.name === 'Firefox');
        expect(chrome?.value).toBe(2);
        expect(firefox?.value).toBe(1);
      }

      // Breakdown by custom JSON property 'properties.tier'
      const jsonBreakdownExit = await Effect.runPromiseExit(
        runInsightQuery(testProjectId, {
          aggregation: 'count',
          breakdown: 'properties.tier',
          dateRange: '7d',
        })
      );
      expect(Exit.isSuccess(jsonBreakdownExit)).toBe(true);
      if (Exit.isSuccess(jsonBreakdownExit)) {
        const bd = jsonBreakdownExit.value.breakdown;
        const pro = bd.find((b) => b.name === 'pro');
        const enterprise = bd.find((b) => b.name === 'enterprise');
        expect(pro?.value).toBe(2);
        expect(enterprise?.value).toBe(1);
      }
    });
  });

  describe('saveInsight, listInsights and getInsight', () => {
    let savedId: string;

    it('saves an insight query configuration', async () => {
      const exit = await Effect.runPromiseExit(
        saveInsight(testProjectId, {
          name: 'High Value Orders Trend',
          type: 'trend',
          queryConfig: {
            aggregation: 'sum',
            aggregationProperty: 'properties.order_value',
            dateRange: '30d',
          },
        })
      );

      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(exit.value.name).toBe('High Value Orders Trend');
        expect(exit.value.projectId).toBe(testProjectId);
        savedId = exit.value.id;
      }
    });

    it('lists saved insights for a project', async () => {
      const exit = await Effect.runPromiseExit(listInsights(testProjectId));
      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(exit.value.length).toBeGreaterThanOrEqual(1);
        expect(exit.value.some((i) => i.id === savedId)).toBe(true);
      }
    });

    it('retrieves saved insight by id', async () => {
      const exit = await Effect.runPromiseExit(getInsight(savedId));
      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(exit.value?.id).toBe(savedId);
        expect(exit.value?.name).toBe('High Value Orders Trend');
      }
    });
  });
});
