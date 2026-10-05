import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Effect, Exit } from 'effect';
import {
  listPersons,
  getPersonProfile,
  updatePersonTrait,
  groupEventsIntoSessions,
} from './service';
import {
  PersonNotFoundError,
  PersonsValidationError,
} from './errors';
import { db } from '@/lib/db';
import { projects, events, persons, personAliases, type Event } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

describe('Persons Slice — Service, Queries & Sessionization', () => {
  let projectId: string;
  let emptyProjectId: string;
  const now = Date.now();

  beforeAll(async () => {
    // 1. Create main test project
    const [p] = await db
      .insert(projects)
      .values({
        name: 'Persons Test Project',
        slug: `test-persons-${now}`,
        clerkUserId: 'test_user_persons',
        apiKey: `ot_live_test_p_${now}`,
      })
      .returning();
    projectId = p.id;

    // 2. Create empty project
    const [pEmpty] = await db
      .insert(projects)
      .values({
        name: 'Empty Persons Project',
        slug: `test-empty-persons-${now}`,
        clerkUserId: 'test_user_persons',
        apiKey: `ot_live_test_p_empty_${now}`,
      })
      .returning();
    emptyProjectId = pEmpty.id;

    // 3. Seed persons into test project
    const t0 = new Date(now - 1000 * 60 * 60 * 24); // 1 day ago
    const t1 = new Date(now - 1000 * 60 * 60);      // 1 hour ago
    const t2 = new Date(now - 1000 * 60 * 10);      // 10 mins ago

    await db.insert(persons).values([
      {
        projectId,
        distinctId: 'user_alice',
        properties: {
          name: 'Alice Johnson',
          email: 'alice@example.com',
          plan: 'pro',
          role: 'admin',
        },
        firstSeenAt: t0,
        lastSeenAt: t2,
      },
      {
        projectId,
        distinctId: 'user_bob',
        properties: {
          $name: 'Bob Smith',
          $email: 'bob@example.com',
          plan: 'free',
        },
        firstSeenAt: t1,
        lastSeenAt: t1,
      },
      {
        projectId,
        distinctId: 'user_charlie',
        properties: {
          company: 'Acme Corp',
        },
        firstSeenAt: t2,
        lastSeenAt: t2,
      },
    ]);

    // 4. Seed aliases: link 'anon_alice_uuid' -> 'user_alice'
    await db.insert(personAliases).values([
      {
        projectId,
        aliasId: 'anon_alice_uuid',
        personDistinctId: 'user_alice',
      },
    ]);

    // 5. Seed events for Alice, Bob, and unlinked 'anon_david'
    // Session 1 for Alice (earlier today): anon_alice_uuid events
    const s1Start = new Date(now - 1000 * 60 * 120); // 2 hours ago
    const s1Next = new Date(now - 1000 * 60 * 115);  // 115 mins ago
    // Session 2 for Alice (recent): user_alice events
    const s2Start = new Date(now - 1000 * 60 * 20);  // 20 mins ago
    const s2Next = new Date(now - 1000 * 60 * 10);   // 10 mins ago

    await db.insert(events).values([
      // Alice session 1 (under alias)
      {
        projectId,
        eventName: '$pageview',
        distinctId: 'anon_alice_uuid',
        sessionId: 'sess_alice_1',
        pagePath: '/landing',
        timestamp: s1Start,
        browser: 'Chrome',
        os: 'macOS',
        countryCode: 'US',
        city: 'San Francisco',
        properties: { referrer: 'google.com' },
      },
      {
        projectId,
        eventName: 'button_click',
        distinctId: 'anon_alice_uuid',
        sessionId: 'sess_alice_1',
        pagePath: '/landing',
        timestamp: s1Next,
        browser: 'Chrome',
        os: 'macOS',
        countryCode: 'US',
        city: 'San Francisco',
        properties: { button_id: 'signup_btn' },
      },
      // Alice session 2 (under primary distinctId)
      {
        projectId,
        eventName: '$identify',
        distinctId: 'user_alice',
        sessionId: 'sess_alice_2',
        pagePath: '/signup',
        timestamp: s2Start,
        browser: 'Chrome',
        os: 'macOS',
        countryCode: 'US',
        city: 'San Francisco',
        properties: { email: 'alice@example.com' },
      },
      {
        projectId,
        eventName: '$pageview',
        distinctId: 'user_alice',
        sessionId: 'sess_alice_2',
        pagePath: '/dashboard',
        timestamp: s2Next,
        browser: 'Chrome',
        os: 'macOS',
        countryCode: 'US',
        city: 'San Francisco',
        properties: { path: '/dashboard' },
      },
      // Bob events
      {
        projectId,
        eventName: '$pageview',
        distinctId: 'user_bob',
        timestamp: t1,
        pagePath: '/home',
      },
      // Unlinked user David (events exist, but no row in persons yet)
      {
        projectId,
        eventName: '$pageview',
        distinctId: 'anon_david_99',
        pagePath: '/blog/intro',
        timestamp: t1,
        countryCode: 'GB',
        properties: { email: 'david@test.co.uk' },
      },
    ]);
  });

  afterAll(async () => {
    // Cleanup test data
    if (projectId) {
      await db.delete(events).where(eq(events.projectId, projectId));
      await db.delete(personAliases).where(eq(personAliases.projectId, projectId));
      await db.delete(persons).where(eq(persons.projectId, projectId));
      await db.delete(projects).where(eq(projects.id, projectId));
    }
    if (emptyProjectId) {
      await db.delete(projects).where(eq(projects.id, emptyProjectId));
    }
  });

  describe('groupEventsIntoSessions helper', () => {
    it('returns empty array when events list is empty', () => {
      const result = groupEventsIntoSessions([]);
      expect(result).toEqual([]);
    });

    it('groups events with same sessionId into a single session', () => {
      const t = new Date('2026-10-06T10:00:00Z');
      const tPlus5 = new Date('2026-10-06T10:05:00Z');
      const mockEvents = [
        {
          id: 'e1',
          sessionId: 'session_abc',
          eventName: '$pageview',
          pagePath: '/a',
          timestamp: t,
        } as Event,
        {
          id: 'e2',
          sessionId: 'session_abc',
          eventName: '$pageview',
          pagePath: '/b',
          timestamp: tPlus5,
        } as Event,
      ];

      const sessions = groupEventsIntoSessions(mockEvents);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].sessionId).toBe('session_abc');
      expect(sessions[0].duration).toBe(300); // 5 mins in seconds
      expect(sessions[0].pageCount).toBe(2);
      expect(sessions[0].events).toHaveLength(2);
    });

    it('splits sessions if explicit sessionId changes', () => {
      const t = new Date('2026-10-06T10:00:00Z');
      const tPlus1 = new Date('2026-10-06T10:01:00Z');
      const mockEvents = [
        {
          id: 'e1',
          sessionId: 'sess_1',
          eventName: '$pageview',
          pagePath: '/home',
          timestamp: t,
        } as Event,
        {
          id: 'e2',
          sessionId: 'sess_2',
          eventName: '$pageview',
          pagePath: '/pricing',
          timestamp: tPlus1,
        } as Event,
      ];

      const sessions = groupEventsIntoSessions(mockEvents);
      expect(sessions).toHaveLength(2);
      // Ordered chronologically descending: sess_2 is first
      expect(sessions[0].sessionId).toBe('sess_2');
      expect(sessions[1].sessionId).toBe('sess_1');
    });

    it('splits sessions when inactivity gap exceeds 30 minutes without sessionId', () => {
      const t = new Date('2026-10-06T10:00:00Z');
      const tPlus45 = new Date('2026-10-06T10:45:00Z'); // 45 min gap (> 30 min)
      const mockEvents = [
        {
          id: 'e1',
          sessionId: null,
          eventName: '$pageview',
          pagePath: '/home',
          timestamp: t,
        } as Event,
        {
          id: 'e2',
          sessionId: null,
          eventName: '$pageview',
          pagePath: '/about',
          timestamp: tPlus45,
        } as Event,
      ];

      const sessions = groupEventsIntoSessions(mockEvents);
      expect(sessions).toHaveLength(2);
      expect(sessions[0].startTime.getTime()).toBe(tPlus45.getTime());
      expect(sessions[1].startTime.getTime()).toBe(t.getTime());
    });

    it('groups events without sessionId within 30 minutes into same session', () => {
      const t = new Date('2026-10-06T10:00:00Z');
      const tPlus15 = new Date('2026-10-06T10:15:00Z'); // 15 min gap (<= 30 min)
      const mockEvents = [
        {
          id: 'e1',
          sessionId: null,
          eventName: '$pageview',
          pagePath: '/home',
          timestamp: t,
        } as Event,
        {
          id: 'e2',
          sessionId: null,
          eventName: 'click',
          pagePath: '/home',
          timestamp: tPlus15,
        } as Event,
      ];

      const sessions = groupEventsIntoSessions(mockEvents);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].duration).toBe(15 * 60);
      expect(sessions[0].events).toHaveLength(2);
    });
  });

  describe('listPersons query', () => {
    it('fails with PersonsValidationError if projectId is empty', async () => {
      const exit = await Effect.runPromiseExit(listPersons(''));
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const failure: any = exit.cause;
        expect(failure.error._tag).toBe('PersonsValidationError');
      }
    });

    it('returns empty list for project with no persons', async () => {
      const result = await Effect.runPromise(listPersons(emptyProjectId));
      expect(result.persons).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('lists all persons and correctly aggregates totalEvents including aliases', async () => {
      const result = await Effect.runPromise(listPersons(projectId));
      expect(result.total).toBe(3);
      expect(result.persons).toHaveLength(3);

      const alice = result.persons.find((p) => p.distinctId === 'user_alice');
      expect(alice).toBeDefined();
      expect(alice?.name).toBe('Alice Johnson');
      expect(alice?.email).toBe('alice@example.com');
      // Alice has 2 events under user_alice + 2 events under anon_alice_uuid = 4 total!
      expect(alice?.totalEvents).toBe(4);

      const bob = result.persons.find((p) => p.distinctId === 'user_bob');
      expect(bob).toBeDefined();
      expect(bob?.name).toBe('Bob Smith');
      expect(bob?.email).toBe('bob@example.com');
      expect(bob?.totalEvents).toBe(1);

      const charlie = result.persons.find((p) => p.distinctId === 'user_charlie');
      expect(charlie).toBeDefined();
      expect(charlie?.name).toBeNull();
      expect(charlie?.email).toBeNull();
      expect(charlie?.totalEvents).toBe(0);
    });

    it('filters persons by search term on distinctId', async () => {
      const result = await Effect.runPromise(
        listPersons(projectId, { search: 'charlie' })
      );
      expect(result.total).toBe(1);
      expect(result.persons[0].distinctId).toBe('user_charlie');
    });

    it('filters persons by search term on email', async () => {
      const result = await Effect.runPromise(
        listPersons(projectId, { search: 'alice@example.com' })
      );
      expect(result.total).toBe(1);
      expect(result.persons[0].distinctId).toBe('user_alice');
    });

    it('filters persons by search term on name ($name)', async () => {
      const result = await Effect.runPromise(
        listPersons(projectId, { search: 'Bob' })
      );
      expect(result.total).toBe(1);
      expect(result.persons[0].distinctId).toBe('user_bob');
    });

    it('supports pagination with limit and offset', async () => {
      const page1 = await Effect.runPromise(
        listPersons(projectId, { limit: 2, offset: 0 })
      );
      expect(page1.persons).toHaveLength(2);
      expect(page1.total).toBe(3);

      const page2 = await Effect.runPromise(
        listPersons(projectId, { limit: 2, offset: 2 })
      );
      expect(page2.persons).toHaveLength(1);
      expect(page2.total).toBe(3);
    });
  });

  describe('getPersonProfile', () => {
    it('fails with PersonNotFoundError when person and events do not exist', async () => {
      const exit = await Effect.runPromiseExit(
        getPersonProfile(projectId, 'non_existent_user')
      );
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const failure: any = exit.cause;
        expect(failure.error._tag).toBe('PersonNotFoundError');
      }
    });

    it('returns full person profile with aliases and grouped sessions for primary distinctId', async () => {
      const profile = await Effect.runPromise(
        getPersonProfile(projectId, 'user_alice')
      );

      expect(profile.person.distinctId).toBe('user_alice');
      expect(profile.aliases).toContain('anon_alice_uuid');
      expect(profile.totalEvents).toBe(4);
      expect(profile.sessions.length).toBeGreaterThanOrEqual(2);

      // Verify sessions contain both sess_alice_2 and sess_alice_1
      const sessionIds = profile.sessions.map((s) => s.sessionId);
      expect(sessionIds).toContain('sess_alice_2');
      expect(sessionIds).toContain('sess_alice_1');

      // Verify sessions are ordered chronologically descending (sess_alice_2 is newer)
      expect(profile.sessions[0].sessionId).toBe('sess_alice_2');
      expect(profile.sessions[1].sessionId).toBe('sess_alice_1');
    });

    it('resolves aliasId to primary person profile when queried by alias', async () => {
      const profile = await Effect.runPromise(
        getPersonProfile(projectId, 'anon_alice_uuid')
      );

      expect(profile.person.distinctId).toBe('user_alice');
      expect(profile.aliases).toContain('anon_alice_uuid');
      expect(profile.totalEvents).toBe(4);
    });

    it('gracefully handles unaliased distinctIds by synthesizing stub person when events exist', async () => {
      const profile = await Effect.runPromise(
        getPersonProfile(projectId, 'anon_david_99')
      );

      expect(profile.person.distinctId).toBe('anon_david_99');
      expect(profile.totalEvents).toBe(1);
      expect(profile.sessions).toHaveLength(1);
      expect(profile.person.properties).toHaveProperty('email', 'david@test.co.uk');
    });
  });

  describe('updatePersonTrait', () => {
    it('fails with validation error if key is empty', async () => {
      const exit = await Effect.runPromiseExit(
        updatePersonTrait(projectId, 'user_alice', '', 'value')
      );
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const failure: any = exit.cause;
        expect(failure.error._tag).toBe('PersonsValidationError');
      }
    });

    it('fails with PersonNotFoundError if person does not exist and has no events', async () => {
      const exit = await Effect.runPromiseExit(
        updatePersonTrait(projectId, 'nobody_xyz', 'tier', 'enterprise')
      );
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const failure: any = exit.cause;
        expect(failure.error._tag).toBe('PersonNotFoundError');
      }
    });

    it('updates traits on existing person and preserves other traits', async () => {
      const updated = await Effect.runPromise(
        updatePersonTrait(projectId, 'user_alice', 'tier', 'enterprise')
      );

      const props = updated.properties as Record<string, unknown>;
      expect(props.tier).toBe('enterprise');
      expect(props.plan).toBe('pro');
      expect(props.email).toBe('alice@example.com');

      // Verify in DB
      const [dbRow] = await db
        .select()
        .from(persons)
        .where(eq(persons.id, updated.id));
      expect((dbRow.properties as Record<string, unknown>).tier).toBe('enterprise');
    });

    it('creates a person row with trait if person does not exist but events exist', async () => {
      const created = await Effect.runPromise(
        updatePersonTrait(projectId, 'anon_david_99', 'signup_source', 'organic')
      );

      expect(created.distinctId).toBe('anon_david_99');
      const props = created.properties as Record<string, unknown>;
      expect(props.signup_source).toBe('organic');

      // Now query profile to ensure it loads from persons table
      const profile = await Effect.runPromise(
        getPersonProfile(projectId, 'anon_david_99')
      );
      expect(profile.person.distinctId).toBe('anon_david_99');
      expect((profile.person.properties as Record<string, unknown>).signup_source).toBe('organic');
    });
  });
});
