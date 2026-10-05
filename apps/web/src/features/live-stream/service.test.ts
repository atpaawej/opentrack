import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Effect, Exit } from 'effect';
import {
  validateLiveStreamQuery,
  getLiveEvents,
  queryLiveEvents,
} from './service';
import {
  LiveStreamValidationError,
} from './errors';
import { db } from '@/lib/db';
import { projects, events } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  formatRelativeTime,
  getCountryFlag,
} from './components/event-row';
import { getEventBadgeColor } from './components/event-drawer';

describe('Live Stream Slice — Service, Querying & Validation', () => {
  let project1Id: string;
  let project2Id: string;

  const now = Date.now();
  const t0 = new Date(now - 10000); // 10s ago
  const t1 = new Date(now - 8000);  // 8s ago
  const t2 = new Date(now - 6000);  // 6s ago
  const t3 = new Date(now - 4000);  // 4s ago
  const t4 = new Date(now - 2000);  // 2s ago

  beforeAll(async () => {
    // Create test project 1
    const [p1] = await db
      .insert(projects)
      .values({
        name: 'Live Stream Test Project 1',
        slug: `test-live-1-${now}`,
        clerkUserId: 'test_user_live',
        apiKey: `ot_live_test_ls1_${now}`,
      })
      .returning();
    project1Id = p1.id;

    // Create test project 2 (for multi-tenant isolation verification)
    const [p2] = await db
      .insert(projects)
      .values({
        name: 'Live Stream Test Project 2',
        slug: `test-live-2-${now}`,
        clerkUserId: 'test_user_live',
        apiKey: `ot_live_test_ls2_${now}`,
      })
      .returning();
    project2Id = p2.id;

    // Insert test events for project 1
    await db.insert(events).values([
      {
        projectId: project1Id,
        eventName: '$pageview',
        distinctId: 'user_alice',
        pagePath: '/home',
        countryCode: 'US',
        browser: 'Chrome',
        os: 'macOS',
        timestamp: t0,
      },
      {
        projectId: project1Id,
        eventName: '$identify',
        distinctId: 'user_alice',
        pagePath: '/login',
        countryCode: 'US',
        browser: 'Chrome',
        os: 'macOS',
        timestamp: t1,
      },
      {
        projectId: project1Id,
        eventName: 'button_clicked',
        distinctId: 'user_bob',
        pagePath: '/pricing',
        countryCode: 'DE',
        browser: 'Firefox',
        os: 'Linux',
        timestamp: t2,
      },
      {
        projectId: project1Id,
        eventName: 'checkout_error',
        distinctId: 'user_charlie',
        pagePath: '/checkout',
        countryCode: 'GB',
        browser: 'Safari',
        os: 'iOS',
        timestamp: t3,
      },
      {
        projectId: project1Id,
        eventName: '$pageview',
        distinctId: 'user_bob',
        pagePath: '/dashboard',
        countryCode: 'DE',
        browser: 'Firefox',
        os: 'Linux',
        timestamp: t4,
      },
    ]);

    // Insert test event for project 2 (isolation check)
    await db.insert(events).values([
      {
        projectId: project2Id,
        eventName: 'other_project_event',
        distinctId: 'user_isolated',
        pagePath: '/secret',
        timestamp: t4,
      },
    ]);
  });

  afterAll(async () => {
    if (project1Id) {
      await db.delete(events).where(eq(events.projectId, project1Id));
      await db.delete(projects).where(eq(projects.id, project1Id));
    }
    if (project2Id) {
      await db.delete(events).where(eq(events.projectId, project2Id));
      await db.delete(projects).where(eq(projects.id, project2Id));
    }
  });

  describe('validateLiveStreamQuery', () => {
    it('succeeds with valid query parameters', async () => {
      const exit = await Effect.runPromiseExit(
        validateLiveStreamQuery({
          projectId: 'proj_123',
          limit: 25,
          eventName: '$pageview',
          distinctId: 'user_alice',
          since: '2026-10-06T00:00:00Z',
        })
      );

      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(exit.value.limit).toBe(25);
        expect(exit.value.eventName).toBe('$pageview');
        expect(exit.value.distinctId).toBe('user_alice');
      }
    });

    it('succeeds with empty query object', async () => {
      const exit = await Effect.runPromiseExit(validateLiveStreamQuery({}));
      expect(Exit.isSuccess(exit)).toBe(true);
    });
  });

  describe('getLiveEvents', () => {
    it('fails with LiveStreamValidationError when projectId is missing', async () => {
      const exit = await Effect.runPromiseExit(
        getLiveEvents({ projectId: '' })
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const error = (exit.cause as any).error;
        expect(error).toBeInstanceOf(LiveStreamValidationError);
      }
    });

    it('filters strictly by projectId and isolates from other projects', async () => {
      const exit = await Effect.runPromiseExit(
        getLiveEvents({ projectId: project1Id })
      );

      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(exit.value.length).toBe(5);
        expect(exit.value.every((e) => e.projectId === project1Id)).toBe(true);
        expect(exit.value.some((e) => e.eventName === 'other_project_event')).toBe(false);
      }
    });

    it('returns events ordered by timestamp DESC', async () => {
      const exit = await Effect.runPromiseExit(
        getLiveEvents({ projectId: project1Id })
      );

      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        const timestamps = exit.value.map((e) => new Date(e.timestamp).getTime());
        for (let i = 0; i < timestamps.length - 1; i++) {
          expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i + 1]);
        }
        // Latest event is at t4 ($pageview for user_bob)
        expect(exit.value[0].eventName).toBe('$pageview');
        expect(exit.value[0].distinctId).toBe('user_bob');
      }
    });

    it('filters by eventName using string match (ILIKE)', async () => {
      const exit = await Effect.runPromiseExit(
        getLiveEvents({ projectId: project1Id, eventName: 'checkout' })
      );

      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(exit.value.length).toBe(1);
        expect(exit.value[0].eventName).toBe('checkout_error');
      }
    });

    it('filters by eventName using array of names', async () => {
      const exit = await Effect.runPromiseExit(
        getLiveEvents({
          projectId: project1Id,
          eventName: ['$identify', 'button_clicked'],
        })
      );

      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(exit.value.length).toBe(2);
        const names = exit.value.map((e) => e.eventName);
        expect(names).toContain('$identify');
        expect(names).toContain('button_clicked');
      }
    });

    it('filters by eventName using comma-separated list', async () => {
      const exit = await Effect.runPromiseExit(
        getLiveEvents({
          projectId: project1Id,
          eventName: '$pageview, checkout_error',
        })
      );

      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        // We had 2 $pageviews and 1 checkout_error
        expect(exit.value.length).toBe(3);
        const names = exit.value.map((e) => e.eventName);
        expect(names).toContain('$pageview');
        expect(names).toContain('checkout_error');
      }
    });

    it('filters by distinctId (ILIKE)', async () => {
      const exit = await Effect.runPromiseExit(
        getLiveEvents({ projectId: project1Id, distinctId: 'alice' })
      );

      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(exit.value.length).toBe(2);
        expect(exit.value.every((e) => e.distinctId === 'user_alice')).toBe(true);
      }
    });

    it('filters by since timestamp for incremental polling', async () => {
      // Query events newer than t2
      const exit = await Effect.runPromiseExit(
        getLiveEvents({ projectId: project1Id, since: t2 })
      );

      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        // Only t3 (checkout_error) and t4 ($pageview) are > t2
        expect(exit.value.length).toBe(2);
        expect(exit.value[0].timestamp.getTime()).toBeGreaterThan(t2.getTime());
        expect(exit.value[1].timestamp.getTime()).toBeGreaterThan(t2.getTime());
      }
    });

    it('respects the limit option', async () => {
      const exit = await Effect.runPromiseExit(
        getLiveEvents({ projectId: project1Id, limit: 2 })
      );

      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(exit.value.length).toBe(2);
      }
    });
  });

  describe('queryLiveEvents', () => {
    it('validates raw input and queries events successfully', async () => {
      const exit = await Effect.runPromiseExit(
        queryLiveEvents({
          projectId: project1Id,
          limit: 3,
        })
      );

      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(exit.value.length).toBe(3);
      }
    });

    it('fails with LiveStreamValidationError if raw input lacks projectId', async () => {
      const exit = await Effect.runPromiseExit(
        queryLiveEvents({ limit: 10 })
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const error = (exit.cause as any).error;
        expect(error).toBeInstanceOf(LiveStreamValidationError);
      }
    });
  });

  describe('UI helpers', () => {
    it('formatRelativeTime produces human-readable relative strings', () => {
      expect(formatRelativeTime(Date.now() - 1000)).toBe('just now');
      expect(formatRelativeTime(Date.now() - 15000)).toBe('15s ago');
      expect(formatRelativeTime(Date.now() - 120000)).toBe('2m ago');
      expect(formatRelativeTime(Date.now() - 7200000)).toBe('2h ago');
    });

    it('getCountryFlag converts ISO country codes to emoji flags', () => {
      expect(getCountryFlag('US')).toBe('🇺🇸');
      expect(getCountryFlag('DE')).toBe('🇩🇪');
      expect(getCountryFlag(null)).toBeNull();
      expect(getCountryFlag('')).toBeNull();
    });

    it('getEventBadgeColor assigns designated colors for event categories', () => {
      expect(getEventBadgeColor('$pageview').text).toBe('text-blue-400');
      expect(getEventBadgeColor('$identify').text).toBe('text-emerald-400');
      expect(getEventBadgeColor('network_error').text).toBe('text-red-400');
      expect(getEventBadgeColor('custom_click').text).toBe('text-purple-400');
    });
  });
});
