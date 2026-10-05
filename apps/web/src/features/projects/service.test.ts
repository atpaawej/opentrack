import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Effect, Exit } from 'effect';
import {
  slugify,
  generateApiKey,
  generateSecretKey,
  validateCreateProjectInput,
  createProject,
  listUserProjects,
  getProjectBySlug,
  updateProjectDomains,
  rotateApiKey,
  updateProjectPrivacySettings,
  purgePersonData,
  exportProjectEvents,
} from './service';
import {
  ProjectValidationError,
  ProjectNotFoundError,
  UnauthorizedProjectAccessError,
} from './errors';
import { db } from '@/lib/db';
import { projects, events, persons, personAliases } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

describe('Projects Slice — Service & Validation', () => {
  const testUserId = `test_user_${Date.now()}`;
  const otherUserId = `other_user_${Date.now()}`;
  let createdSlug: string;
  let createdProjectId: string;

  afterAll(async () => {
    if (createdSlug) {
      await db.delete(projects).where(eq(projects.slug, createdSlug));
    }
  });

  describe('slugify', () => {
    it('converts titles into clean url-friendly slugs', () => {
      expect(slugify('My Super SaaS!')).toBe('my-super-saas');
      expect(slugify('  Production API v2  ')).toBe('production-api-v2');
      expect(slugify('OpenTrack_Analytics')).toBe('opentrack-analytics');
    });
  });

  describe('generateApiKey', () => {
    it('generates an ot_live_ prefixed API key', () => {
      const key = generateApiKey();
      expect(key.startsWith('ot_live_')).toBe(true);
      expect(key.length).toBeGreaterThan(20);
    });
  });

  describe('validateCreateProjectInput', () => {
    it('succeeds with a valid project name', async () => {
      const exit = await Effect.runPromiseExit(
        validateCreateProjectInput({ name: 'Acme App' })
      );
      expect(Exit.isSuccess(exit)).toBe(true);
    });

    it('fails with ProjectValidationError when name is empty', async () => {
      const exit = await Effect.runPromiseExit(
        validateCreateProjectInput({ name: '' })
      );
      expect(Exit.isFailure(exit)).toBe(true);
    });
  });

  describe('createProject', () => {
    it('creates a project with unique slug and API key in the database', async () => {
      const projectName = `Test Project ${Date.now()}`;
      const exit = await Effect.runPromiseExit(
        createProject(
          { name: projectName, allowedDomains: ['example.com'] },
          { clerkUserId: testUserId }
        )
      );

      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        const project = exit.value;
        createdSlug = project.slug;
        createdProjectId = project.id;
        expect(project.name).toBe(projectName);
        expect(project.slug).toBeDefined();
        expect(project.apiKey.startsWith('ot_live_')).toBe(true);
        expect(project.secretKey?.startsWith('ot_sec_')).toBe(true);
        expect(project.clerkUserId).toBe(testUserId);
        expect(project.allowedDomains).toEqual(['example.com']);
      }
    });
  });

  describe('listUserProjects', () => {
    it('returns projects owned by the user', async () => {
      const exit = await Effect.runPromiseExit(
        listUserProjects({ clerkUserId: testUserId })
      );
      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(exit.value.length).toBeGreaterThan(0);
        expect(exit.value.some((p) => p.slug === createdSlug)).toBe(true);
      }
    });

    it('returns empty list for a user with no projects', async () => {
      const exit = await Effect.runPromiseExit(
        listUserProjects({ clerkUserId: `empty_user_${Date.now()}` })
      );
      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(exit.value).toHaveLength(0);
      }
    });
  });

  describe('getProjectBySlug', () => {
    it('retrieves project for authorized user', async () => {
      const exit = await Effect.runPromiseExit(
        getProjectBySlug(createdSlug, { clerkUserId: testUserId })
      );
      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(exit.value.slug).toBe(createdSlug);
      }
    });

    it('fails with ProjectNotFoundError for non-existent slug', async () => {
      const exit = await Effect.runPromiseExit(
        getProjectBySlug('non-existent-slug-xyz', { clerkUserId: testUserId })
      );
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const error = Exit.isFailure(exit) ? (exit.cause as any).error : null;
        expect(error).toBeInstanceOf(ProjectNotFoundError);
      }
    });

    it('fails with UnauthorizedProjectAccessError when user is not owner', async () => {
      const exit = await Effect.runPromiseExit(
        getProjectBySlug(createdSlug, { clerkUserId: otherUserId })
      );
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const error = Exit.isFailure(exit) ? (exit.cause as any).error : null;
        expect(error).toBeInstanceOf(UnauthorizedProjectAccessError);
      }
    });
  });

  describe('updateProjectDomains', () => {
    it('updates allowed domains for authorized user', async () => {
      const newDomains = ['example.com', 'app.example.com'];
      const exit = await Effect.runPromiseExit(
        updateProjectDomains(
          createdSlug,
          { allowedDomains: newDomains },
          { clerkUserId: testUserId }
        )
      );
      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(exit.value.allowedDomains).toEqual(newDomains);
      }
    });
  });

  describe('generateSecretKey', () => {
    it('generates an ot_sec_ prefixed secret key', () => {
      const key = generateSecretKey();
      expect(key.startsWith('ot_sec_')).toBe(true);
      expect(key.length).toBeGreaterThan(24);
    });
  });

  describe('rotateApiKey', () => {
    it('rotates public key and updates projects table', async () => {
      const beforeExit = await Effect.runPromiseExit(
        getProjectBySlug(createdSlug, { clerkUserId: testUserId })
      );
      expect(Exit.isSuccess(beforeExit)).toBe(true);
      const oldKey = Exit.isSuccess(beforeExit) ? beforeExit.value.apiKey : '';

      const exit = await Effect.runPromiseExit(
        rotateApiKey(createdProjectId, 'public')
      );
      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(exit.value.apiKey.startsWith('ot_live_')).toBe(true);
        expect(exit.value.apiKey).not.toBe(oldKey);
      }
    });

    it('rotates secret key and updates projects table', async () => {
      const exit = await Effect.runPromiseExit(
        rotateApiKey(createdProjectId, 'secret')
      );
      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(exit.value.secretKey?.startsWith('ot_sec_')).toBe(true);
      }
    });

    it('fails with ProjectValidationError when key type is invalid', async () => {
      const exit = await Effect.runPromiseExit(
        rotateApiKey(createdProjectId, 'invalid' as any)
      );
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const error = (exit.cause as any).error;
        expect(error).toBeInstanceOf(ProjectValidationError);
      }
    });
  });

  describe('updateProjectPrivacySettings', () => {
    it('updates dataRetentionDays and timezone', async () => {
      const exit = await Effect.runPromiseExit(
        updateProjectPrivacySettings(createdProjectId, {
          dataRetentionDays: 180,
          timezone: 'America/New_York',
        })
      );
      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(exit.value.dataRetentionDays).toBe(180);
        expect(exit.value.timezone).toBe('America/New_York');
      }
    });

    it('fails validation when dataRetentionDays is negative', async () => {
      const exit = await Effect.runPromiseExit(
        updateProjectPrivacySettings(createdProjectId, {
          dataRetentionDays: -1,
        })
      );
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const error = (exit.cause as any).error;
        expect(error).toBeInstanceOf(ProjectValidationError);
      }
    });
  });

  describe('purgePersonData (GDPR Deletion)', () => {
    it('permanently deletes all events, persons, and person_aliases matching distinctId and its aliases', async () => {
      const canonicalId = `gdpr_user_${Date.now()}`;
      const aliasId = `gdpr_anon_${Date.now()}`;

      // Insert person record
      await db.insert(persons).values({
        projectId: createdProjectId,
        distinctId: canonicalId,
        properties: { name: 'GDPR Test User', email: 'gdpr@example.com' },
      });

      // Insert alias record
      await db.insert(personAliases).values({
        projectId: createdProjectId,
        aliasId,
        personDistinctId: canonicalId,
      });

      // Insert events for both canonical and alias
      await db.insert(events).values([
        {
          projectId: createdProjectId,
          eventName: 'login',
          distinctId: canonicalId,
          properties: { ip: '127.0.0.1' },
        },
        {
          projectId: createdProjectId,
          eventName: '$pageview',
          distinctId: aliasId,
          properties: { path: '/home' },
        },
      ]);

      // Execute GDPR Purge
      const exit = await Effect.runPromiseExit(
        purgePersonData(createdProjectId, canonicalId)
      );

      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(exit.value.success).toBe(true);
        expect(exit.value.deletedEventsCount).toBeGreaterThanOrEqual(2);
        expect(exit.value.deletedPersonsCount).toBe(1);
        expect(exit.value.deletedAliasesCount).toBe(1);
      }

      // Verify no traces remain in database
      const remainingPersons = await db
        .select()
        .from(persons)
        .where(
          and(
            eq(persons.projectId, createdProjectId),
            eq(persons.distinctId, canonicalId)
          )
        );
      expect(remainingPersons).toHaveLength(0);

      const remainingAliases = await db
        .select()
        .from(personAliases)
        .where(
          and(
            eq(personAliases.projectId, createdProjectId),
            eq(personAliases.aliasId, aliasId)
          )
        );
      expect(remainingAliases).toHaveLength(0);

      const remainingEvents = await db
        .select()
        .from(events)
        .where(
          and(
            eq(events.projectId, createdProjectId),
            eq(events.distinctId, canonicalId)
          )
        );
      expect(remainingEvents).toHaveLength(0);
    });
  });

  describe('exportProjectEvents', () => {
    it('exports events filtered by distinctId and project-wide', async () => {
      const exportUserId = `export_user_${Date.now()}`;
      await db.insert(events).values([
        {
          projectId: createdProjectId,
          eventName: 'export_test_1',
          distinctId: exportUserId,
          properties: { step: 1 },
        },
        {
          projectId: createdProjectId,
          eventName: 'export_test_2',
          distinctId: exportUserId,
          properties: { step: 2 },
        },
      ]);

      // Export filtered by distinctId
      const userExportExit = await Effect.runPromiseExit(
        exportProjectEvents(createdProjectId, { distinctId: exportUserId })
      );
      expect(Exit.isSuccess(userExportExit)).toBe(true);
      if (Exit.isSuccess(userExportExit)) {
        expect(userExportExit.value.length).toBeGreaterThanOrEqual(2);
        expect(userExportExit.value.every((e) => e.distinctId === exportUserId)).toBe(true);
      }

      // Export project-wide
      const allExportExit = await Effect.runPromiseExit(
        exportProjectEvents(createdProjectId, { limit: 10 })
      );
      expect(Exit.isSuccess(allExportExit)).toBe(true);
      if (Exit.isSuccess(allExportExit)) {
        expect(allExportExit.value.length).toBeGreaterThanOrEqual(2);
      }
    });
  });
});

