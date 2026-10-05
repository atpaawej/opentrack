import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Effect, Exit } from 'effect';
import { db } from '@/lib/db';
import { projects, events, insights } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  resolveFunnelDateRange,
  conversionWindowToMs,
  matchesStepFilters,
  calculateMedian,
  calculateFunnel,
  saveFunnel,
  listFunnels,
} from './service';

describe('Conversion Funnels Engine — Service & Calculations', () => {
  let testProjectId: string;
  let emptyProjectId: string;

  beforeAll(async () => {
    // 1. Create test project
    const [inserted] = await db
      .insert(projects)
      .values({
        name: 'Funnels Test Project',
        slug: `test-funnels-${Date.now()}`,
        clerkUserId: 'test_user_funnels',
        apiKey: `ot_live_test_funnels_${Date.now()}`,
      })
      .returning();
    testProjectId = inserted.id;

    // 2. Create empty project
    const [emptyProj] = await db
      .insert(projects)
      .values({
        name: 'Empty Funnels Project',
        slug: `test-empty-funnels-${Date.now()}`,
        clerkUserId: 'test_user_funnels',
        apiKey: `ot_live_test_empty_funnels_${Date.now()}`,
      })
      .returning();
    emptyProjectId = emptyProj.id;

    // 3. Seed users for funnel testing
    // Window will be 2 hours for our test
    const now = new Date();
    const baseTime = new Date(now.getTime() - 24 * 3600 * 1000); // 24 hours ago

    // User Alpha: completes Step 1 -> Step 2 (after 10 min) -> Step 3 (after 20 min) -> CONVERTS FULLY
    const uAlphaS1 = new Date(baseTime.getTime() + 1000);
    const uAlphaS2 = new Date(baseTime.getTime() + 10 * 60 * 1000); // +10 min
    const uAlphaS3 = new Date(baseTime.getTime() + 30 * 60 * 1000); // +20 min from S2

    // User Beta: completes Step 1 -> Step 2 (after 20 min), drops before Step 3
    const uBetaS1 = new Date(baseTime.getTime() + 2000);
    const uBetaS2 = new Date(baseTime.getTime() + 20 * 60 * 1000); // +20 min

    // User Gamma: completes Step 1, never triggers Step 2
    const uGammaS1 = new Date(baseTime.getTime() + 3000);

    // User Delta: completes Step 1, triggers Step 2 AFTER 3 hours (exceeds 2-hour window -> drops out)
    const uDeltaS1 = new Date(baseTime.getTime() + 4000);
    const uDeltaS2 = new Date(baseTime.getTime() + 3 * 3600 * 1000); // +3 hours!

    await db.insert(events).values([
      // User Alpha
      {
        projectId: testProjectId,
        eventName: '$pageview',
        distinctId: 'user_alpha',
        sessionId: 'sess_a',
        timestamp: uAlphaS1,
      },
      {
        projectId: testProjectId,
        eventName: 'signup_started',
        distinctId: 'user_alpha',
        sessionId: 'sess_a',
        timestamp: uAlphaS2,
      },
      {
        projectId: testProjectId,
        eventName: 'payment_submitted',
        distinctId: 'user_alpha',
        sessionId: 'sess_a',
        timestamp: uAlphaS3,
      },

      // User Beta
      {
        projectId: testProjectId,
        eventName: '$pageview',
        distinctId: 'user_beta',
        sessionId: 'sess_b',
        timestamp: uBetaS1,
      },
      {
        projectId: testProjectId,
        eventName: 'signup_started',
        distinctId: 'user_beta',
        sessionId: 'sess_b',
        timestamp: uBetaS2,
      },

      // User Gamma
      {
        projectId: testProjectId,
        eventName: '$pageview',
        distinctId: 'user_gamma',
        sessionId: 'sess_g',
        timestamp: uGammaS1,
      },

      // User Delta
      {
        projectId: testProjectId,
        eventName: '$pageview',
        distinctId: 'user_delta',
        sessionId: 'sess_d',
        timestamp: uDeltaS1,
      },
      {
        projectId: testProjectId,
        eventName: 'signup_started',
        distinctId: 'user_delta',
        sessionId: 'sess_d',
        timestamp: uDeltaS2,
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

  describe('Helper functions', () => {
    it('conversionWindowToMs computes correct millisecond durations', () => {
      expect(conversionWindowToMs({ value: 15, unit: 'minute' })).toBe(15 * 60 * 1000);
      expect(conversionWindowToMs({ value: 2, unit: 'hour' })).toBe(2 * 3600 * 1000);
      expect(conversionWindowToMs({ value: 7, unit: 'day' })).toBe(7 * 86400 * 1000);
    });

    it('calculateMedian handles odd, even, and empty arrays', () => {
      expect(calculateMedian([])).toBeNull();
      expect(calculateMedian([50])).toBe(50);
      expect(calculateMedian([10, 20, 30])).toBe(20);
      expect(calculateMedian([10, 20, 30, 40])).toBe(25);
    });

    it('matchesStepFilters filters correctly by property and operator', () => {
      const ev = { browser: 'Chrome', properties: { plan: 'enterprise', seats: 10 } };
      expect(matchesStepFilters(ev, [{ property: 'browser', operator: 'equals', value: 'Chrome' }])).toBe(true);
      expect(matchesStepFilters(ev, [{ property: 'browser', operator: 'equals', value: 'Firefox' }])).toBe(false);
      expect(matchesStepFilters(ev, [{ property: 'properties.plan', operator: 'equals', value: 'enterprise' }])).toBe(true);
      expect(matchesStepFilters(ev, [{ property: 'properties.seats', operator: 'greater_than', value: 5 }])).toBe(true);
      expect(matchesStepFilters(ev, [{ property: 'properties.seats', operator: 'less_than', value: 5 }])).toBe(false);
    });
  });

  describe('calculateFunnel', () => {
    it('returns empty stats for project with 0 events', async () => {
      const exit = await Effect.runPromiseExit(
        calculateFunnel(emptyProjectId, {
          steps: [
            { id: 's1', eventName: '$pageview' },
            { id: 's2', eventName: 'signup_completed' },
          ],
          conversionWindow: { value: 1, unit: 'day' },
          dateRange: '30d',
        })
      );

      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(exit.value.totalUsers).toBe(0);
        expect(exit.value.convertedUsers).toBe(0);
        expect(exit.value.overallConversionRate).toBe(0);
        expect(exit.value.steps[0].count).toBe(0);
      }
    });

    it('accurately calculates 3-step funnel with conversion window and drop-offs', async () => {
      const exit = await Effect.runPromiseExit(
        calculateFunnel(testProjectId, {
          steps: [
            { id: 'step-1', name: 'Page View', eventName: '$pageview' },
            { id: 'step-2', name: 'Signup Started', eventName: 'signup_started' },
            { id: 'step-3', name: 'Payment Submitted', eventName: 'payment_submitted' },
          ],
          conversionWindow: { value: 2, unit: 'hour' },
          dateRange: '7d',
        })
      );

      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        const res = exit.value;
        // Total entering Step 1: 4 users (alpha, beta, gamma, delta)
        expect(res.totalUsers).toBe(4);
        expect(res.steps[0].count).toBe(4);

        // Step 2: 2 users completed within 2h window (alpha, beta).
        // (Delta exceeded the 2-hour window, gamma never performed Step 2).
        expect(res.steps[1].count).toBe(2);

        // Step 3: 1 user completed (alpha)
        expect(res.steps[2].count).toBe(1);
        expect(res.convertedUsers).toBe(1);

        // Overall conversion rate: 1 / 4 = 25%
        expect(res.overallConversionRate).toBe(25);

        // Step 1 drop-offs: 2 users (gamma, delta)
        expect(res.steps[0].dropOffCount).toBe(2);
        expect(res.steps[0].dropOffPercentage).toBe(50);
        expect(res.steps[0].droppedUserIds).toContain('user_gamma');
        expect(res.steps[0].droppedUserIds).toContain('user_delta');

        // Step 2 drop-offs: 1 user (beta)
        expect(res.steps[1].dropOffCount).toBe(1);
        expect(res.steps[1].dropOffPercentage).toBe(50);
        expect(res.steps[1].droppedUserIds).toContain('user_beta');

        // Step 3 (final step): 0 drop-offs
        expect(res.steps[2].dropOffCount).toBe(0);

        // Conversion rates from previous:
        // Step 1: 100%
        // Step 2: 2 / 4 = 50%
        // Step 3: 1 / 2 = 50%
        expect(res.steps[0].conversionRateFromPrevious).toBe(100);
        expect(res.steps[1].conversionRateFromPrevious).toBe(50);
        expect(res.steps[2].conversionRateFromPrevious).toBe(50);

        // Median time to convert for Step 2:
        // Durations: Alpha took ~599s (~10m), Beta took ~1198s (~20m)
        // Median is ~898.5s
        expect(res.steps[1].medianTimeToConvertSeconds).toBeGreaterThan(0);
      }
    });

    it('fails if less than 2 steps are provided', async () => {
      const exit = await Effect.runPromiseExit(
        calculateFunnel(testProjectId, {
          steps: [{ id: 'step-1', eventName: '$pageview' }],
          conversionWindow: { value: 1, unit: 'day' },
          dateRange: '7d',
        })
      );
      expect(Exit.isFailure(exit)).toBe(true);
    });
  });

  describe('saveFunnel and listFunnels', () => {
    let savedFunnelId: string;

    it('saves a funnel configuration in insights table with type funnel', async () => {
      const exit = await Effect.runPromiseExit(
        saveFunnel(testProjectId, {
          name: 'Core Onboarding Funnel',
          queryConfig: {
            steps: [
              { id: '1', eventName: '$pageview' },
              { id: '2', eventName: 'signup_started' },
            ],
            conversionWindow: { value: 1, unit: 'day' },
            dateRange: '30d',
          },
        })
      );

      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(exit.value.name).toBe('Core Onboarding Funnel');
        expect(exit.value.projectId).toBe(testProjectId);
        savedFunnelId = exit.value.id;
      }
    });

    it('lists saved funnels for a project', async () => {
      const exit = await Effect.runPromiseExit(listFunnels(testProjectId));
      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(exit.value.length).toBeGreaterThanOrEqual(1);
        expect(exit.value.some((f) => f.id === savedFunnelId)).toBe(true);
      }
    });
  });
});
