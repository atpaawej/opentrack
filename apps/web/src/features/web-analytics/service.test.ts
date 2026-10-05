import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Effect, Exit } from 'effect';
import { db } from '@/lib/db';
import { projects, events } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  resolveDateRange,
  calculateChangePercentage,
  getKpiMetrics,
  getTimeSeriesMetrics,
  getBreakdownMetrics,
  getAllAnalyticsData,
} from './service';

describe('Web Analytics Slice — Service & Metrics Aggregation', () => {
  const testApiKey = `ot_live_test_web_analytics_${Date.now()}`;
  let testProjectId: string;
  let emptyProjectId: string;

  beforeAll(async () => {
    // 1. Create a project with test events
    const [inserted] = await db
      .insert(projects)
      .values({
        name: 'Web Analytics Test Project',
        slug: `test-analytics-${Date.now()}`,
        clerkUserId: 'test_user_analytics',
        apiKey: testApiKey,
      })
      .returning();
    testProjectId = inserted.id;

    // 2. Create an empty project with 0 events
    const [emptyProj] = await db
      .insert(projects)
      .values({
        name: 'Empty Test Project',
        slug: `test-empty-${Date.now()}`,
        clerkUserId: 'test_user_analytics',
        apiKey: `ot_live_test_empty_${Date.now()}`,
      })
      .returning();
    emptyProjectId = emptyProj.id;

    const now = new Date();
    // 3. Insert specific events into testProjectId
    // Visitor 1: Session 1 (Single event -> bounces)
    const event1Time = new Date(now.getTime() - 2 * 3600 * 1000); // 2 hours ago
    await db.insert(events).values({
      projectId: testProjectId,
      eventName: '$pageview',
      distinctId: 'user_1',
      sessionId: 'sess_1',
      pagePath: '/home',
      referrerDomain: 'google.com',
      browser: 'Chrome',
      os: 'macOS',
      deviceType: 'Desktop',
      countryCode: 'US',
      utmCampaign: 'launch_2026',
      timestamp: event1Time,
    });

    // Visitor 2: Session 2 (Two events 60s apart -> does NOT bounce, duration 60s)
    const event2TimeA = new Date(now.getTime() - 4 * 3600 * 1000); // 4 hours ago
    const event2TimeB = new Date(now.getTime() - 4 * 3600 * 1000 + 60 * 1000); // 4 hours ago + 60s
    await db.insert(events).values([
      {
        projectId: testProjectId,
        eventName: '$pageview',
        distinctId: 'user_2',
        sessionId: 'sess_2',
        pagePath: '/pricing',
        referrerDomain: 'twitter.com',
        browser: 'Firefox',
        os: 'Windows',
        deviceType: 'Desktop',
        countryCode: 'DE',
        utmCampaign: 'launch_2026',
        timestamp: event2TimeA,
      },
      {
        projectId: testProjectId,
        eventName: 'button_clicked',
        distinctId: 'user_2',
        sessionId: 'sess_2',
        pagePath: '/pricing',
        referrerDomain: 'twitter.com',
        browser: 'Firefox',
        os: 'Windows',
        deviceType: 'Desktop',
        countryCode: 'DE',
        utmCampaign: 'launch_2026',
        timestamp: event2TimeB,
      },
    ]);

    // Visitor 3: Session 3 (Custom event only, no $pageview, single event -> bounces)
    const event3Time = new Date(now.getTime() - 5 * 3600 * 1000);
    await db.insert(events).values({
      projectId: testProjectId,
      eventName: 'signup_started',
      distinctId: 'user_3',
      sessionId: 'sess_3',
      pagePath: '/signup',
      referrerDomain: '',
      browser: 'Safari',
      os: 'iOS',
      deviceType: 'Mobile',
      countryCode: 'GB',
      utmCampaign: '',
      timestamp: event3Time,
    });
  });

  afterAll(async () => {
    if (testProjectId) {
      await db.delete(events).where(eq(events.projectId, testProjectId));
      await db.delete(projects).where(eq(projects.id, testProjectId));
    }
    if (emptyProjectId) {
      await db.delete(events).where(eq(events.projectId, emptyProjectId));
      await db.delete(projects).where(eq(projects.id, emptyProjectId));
    }
  });

  describe('resolveDateRange helper', () => {
    it('resolves 24h interval correctly', () => {
      const res = resolveDateRange('24h');
      expect(res.defaultGranularity).toBe('hour');
      expect(res.to.getTime() - res.from.getTime()).toBeCloseTo(24 * 3600 * 1000, -3);
      expect(res.previousTo.getTime() - res.previousFrom.getTime()).toBeCloseTo(24 * 3600 * 1000, -3);
    });

    it('resolves 7d interval correctly', () => {
      const res = resolveDateRange('7d');
      expect(res.defaultGranularity).toBe('day');
      expect(res.to.getTime() - res.from.getTime()).toBeCloseTo(7 * 86400 * 1000, -3);
    });

    it('resolves custom interval correctly', () => {
      const from = new Date('2026-01-01T00:00:00Z');
      const to = new Date('2026-01-05T00:00:00Z');
      const res = resolveDateRange('custom', from, to);
      expect(res.from.toISOString()).toBe(from.toISOString());
      expect(res.to.toISOString()).toBe(to.toISOString());
      expect(res.defaultGranularity).toBe('day');
    });
  });

  describe('calculateChangePercentage', () => {
    it('calculates positive delta correctly', () => {
      expect(calculateChangePercentage(150, 100)).toBe(50);
      expect(calculateChangePercentage(112, 100)).toBe(12);
    });

    it('calculates negative delta correctly', () => {
      expect(calculateChangePercentage(80, 100)).toBe(-20);
    });

    it('handles 0 in previous value', () => {
      expect(calculateChangePercentage(50, 0)).toBe(100);
      expect(calculateChangePercentage(0, 0)).toBe(0);
    });
  });

  describe('Empty State Handling (0 events)', () => {
    it('returns zeroed KPI metrics when no events exist', async () => {
      const exit = await Effect.runPromiseExit(getKpiMetrics(emptyProjectId, '30d'));
      expect(Exit.isSuccess(exit)).toBe(true);

      if (Exit.isSuccess(exit)) {
        const kpis = exit.value;
        expect(kpis.uniqueVisitors.value).toBe(0);
        expect(kpis.totalPageviews.value).toBe(0);
        expect(kpis.totalSessions.value).toBe(0);
        expect(kpis.bounceRate.value).toBe(0);
        expect(kpis.avgSessionDuration.value).toBe(0);
        expect(kpis.uniqueVisitors.changePercentage).toBe(0);
      }
    });

    it('returns empty time-series when no events exist', async () => {
      const exit = await Effect.runPromiseExit(
        getTimeSeriesMetrics(emptyProjectId, '30d', 'day')
      );
      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(exit.value).toEqual([]);
      }
    });

    it('returns empty breakdown items when no events exist', async () => {
      const exit = await Effect.runPromiseExit(
        getBreakdownMetrics(emptyProjectId, '30d', 'pages')
      );
      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(exit.value).toEqual([]);
      }
    });
  });

  describe('KPI Metrics Calculations', () => {
    it('accurately computes unique visitors, pageviews, sessions, bounce rate, and duration', async () => {
      const exit = await Effect.runPromiseExit(getKpiMetrics(testProjectId, '24h'));
      expect(Exit.isSuccess(exit)).toBe(true);

      if (Exit.isSuccess(exit)) {
        const kpis = exit.value;

        // 3 unique visitors (user_1, user_2, user_3)
        expect(kpis.uniqueVisitors.value).toBe(3);

        // 2 pageviews ($pageview on user_1 and user_2; user_3 had signup_started)
        expect(kpis.totalPageviews.value).toBe(2);

        // 3 sessions (sess_1, sess_2, sess_3)
        expect(kpis.totalSessions.value).toBe(3);

        // Bounce rate:
        // sess_1 has 1 event -> bounced
        // sess_2 has 2 events, 60s apart -> NOT bounced
        // sess_3 has 1 event -> bounced
        // 2 bounced out of 3 sessions = 66.7%
        expect(kpis.bounceRate.value).toBeCloseTo(66.7, 0);

        // Avg session duration:
        // sess_1 duration = 0s
        // sess_2 duration = 60s
        // sess_3 duration = 0s
        // (0 + 60 + 0) / 3 = 20s
        expect(kpis.avgSessionDuration.value).toBe(20);
      }
    });
  });

  describe('Time Series Aggregations', () => {
    it('returns time-series data points grouped by granularity', async () => {
      const exit = await Effect.runPromiseExit(
        getTimeSeriesMetrics(testProjectId, '24h', 'hour')
      );
      expect(Exit.isSuccess(exit)).toBe(true);

      if (Exit.isSuccess(exit)) {
        const points = exit.value;
        expect(points.length).toBeGreaterThan(0);

        const totalPvs = points.reduce((acc, p) => acc + p.pageviews, 0);
        expect(totalPvs).toBe(2);

        // Points should have valid ISO timestamp strings
        points.forEach((p) => {
          expect(new Date(p.timestamp).toString()).not.toBe('Invalid Date');
        });
      }
    });
  });

  describe('Breakdown Metrics', () => {
    it('returns ranked pages with percentages', async () => {
      const exit = await Effect.runPromiseExit(
        getBreakdownMetrics(testProjectId, '24h', 'pages')
      );
      expect(Exit.isSuccess(exit)).toBe(true);

      if (Exit.isSuccess(exit)) {
        const pages = exit.value;
        expect(pages.length).toBeGreaterThan(0);
        expect(pages.some((p) => p.name === '/home' || p.name === '/pricing')).toBe(true);

        const totalPct = pages.reduce((acc, p) => acc + p.percentage, 0);
        expect(totalPct).toBeCloseTo(100, 0);
      }
    });

    it('returns ranked referrers with fallback for direct traffic', async () => {
      const exit = await Effect.runPromiseExit(
        getBreakdownMetrics(testProjectId, '24h', 'referrers')
      );
      expect(Exit.isSuccess(exit)).toBe(true);

      if (Exit.isSuccess(exit)) {
        const refs = exit.value;
        expect(refs.some((r) => r.name === 'google.com')).toBe(true);
        expect(refs.some((r) => r.name === 'Direct / None')).toBe(true);
      }
    });

    it('returns breakdown for countries, browsers, os, devices', async () => {
      const [countries, browsers, os, devices] = await Promise.all([
        Effect.runPromise(getBreakdownMetrics(testProjectId, '24h', 'countries')),
        Effect.runPromise(getBreakdownMetrics(testProjectId, '24h', 'browsers')),
        Effect.runPromise(getBreakdownMetrics(testProjectId, '24h', 'os')),
        Effect.runPromise(getBreakdownMetrics(testProjectId, '24h', 'devices')),
      ]);

      expect(countries.some((c) => c.name === 'US')).toBe(true);
      expect(browsers.some((b) => b.name === 'Chrome')).toBe(true);
      expect(os.some((o) => o.name === 'macOS' || o.name === 'Windows')).toBe(true);
      expect(devices.some((d) => d.name === 'Desktop')).toBe(true);
    });
  });

  describe('getAllAnalyticsData aggregated query', () => {
    it('returns the complete analytics payload in one call', async () => {
      const exit = await Effect.runPromiseExit(
        getAllAnalyticsData(testProjectId, '24h', 'hour')
      );
      expect(Exit.isSuccess(exit)).toBe(true);

      if (Exit.isSuccess(exit)) {
        const payload = exit.value;
        expect(payload.kpis.uniqueVisitors.value).toBe(3);
        expect(payload.timeSeries.length).toBeGreaterThan(0);
        expect(payload.breakdowns.pages.length).toBeGreaterThan(0);
        expect(payload.breakdowns.countries.length).toBeGreaterThan(0);
        expect(payload.dateRange).toBe('24h');
        expect(payload.granularity).toBe('hour');
      }
    });
  });
});
