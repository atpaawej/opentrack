import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Effect, Exit } from 'effect';
import {
  slugify,
  generateApiKey,
  validateCreateProjectInput,
  createProject,
  listUserProjects,
  getProjectBySlug,
  updateProjectDomains,
} from './service';
import {
  ProjectValidationError,
  ProjectNotFoundError,
  UnauthorizedProjectAccessError,
} from './errors';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

describe('Projects Slice — Service & Validation', () => {
  const testUserId = `test_user_${Date.now()}`;
  const otherUserId = `other_user_${Date.now()}`;
  let createdSlug: string;

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
        expect(project.name).toBe(projectName);
        expect(project.slug).toBeDefined();
        expect(project.apiKey.startsWith('ot_live_')).toBe(true);
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
});
