import { nanoid } from 'nanoid';
import { Effect } from 'effect';
import { Schema } from '@effect/schema';
import { eq, or, and, isNull, desc, count, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projects, events, type Project } from '@/lib/db/schema';
import {
  CreateProjectSchema,
  UpdateProjectDomainsSchema,
  type CreateProjectInput,
  type UpdateProjectDomainsInput,
} from './schemas';
import {
  ProjectValidationError,
  ProjectNotFoundError,
  UnauthorizedProjectAccessError,
  ProjectDatabaseError,
} from './errors';

export interface AuthContext {
  readonly clerkUserId: string;
  readonly clerkOrgId?: string | null;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function generateApiKey(): string {
  return `ot_live_${nanoid(24)}`;
}

/**
 * Validates project creation command
 */
export function validateCreateProjectInput(
  raw: unknown
): Effect.Effect<CreateProjectInput, ProjectValidationError> {
  return Effect.gen(function* () {
    const decoded = yield* Schema.decodeUnknown(CreateProjectSchema)(raw).pipe(
      Effect.mapError(
        (parseError) =>
          new ProjectValidationError({
            message: 'Invalid project creation parameters',
            details: parseError.message,
          })
      )
    );
    return decoded;
  });
}

/**
 * Validates domain update command
 */
export function validateUpdateDomainsInput(
  raw: unknown
): Effect.Effect<UpdateProjectDomainsInput, ProjectValidationError> {
  return Effect.gen(function* () {
    const decoded = yield* Schema.decodeUnknown(UpdateProjectDomainsSchema)(raw).pipe(
      Effect.mapError(
        (parseError) =>
          new ProjectValidationError({
            message: 'Invalid domains list',
            details: parseError.message,
          })
      )
    );
    return decoded;
  });
}

/**
 * Creates a new project owned by the caller
 */
export function createProject(
  rawInput: unknown,
  authContext: AuthContext
): Effect.Effect<Project, ProjectValidationError | ProjectDatabaseError> {
  return Effect.gen(function* () {
    const input = yield* validateCreateProjectInput(rawInput);

    let baseSlug = slugify(input.slug || input.name);
    if (!baseSlug) {
      baseSlug = `project-${nanoid(6).toLowerCase()}`;
    }

    // Check if slug already exists to prevent duplicate key constraint violations
    const existing = yield* Effect.tryPromise({
      try: () => db.select({ id: projects.id }).from(projects).where(eq(projects.slug, baseSlug)).limit(1),
      catch: (err) =>
        new ProjectDatabaseError({
          message: 'Failed to query database for existing project slug',
          cause: err,
        }),
    });

    const finalSlug = existing.length > 0 ? `${baseSlug}-${nanoid(6).toLowerCase()}` : baseSlug;
    const apiKey = generateApiKey();

    const [inserted] = yield* Effect.tryPromise({
      try: () =>
        db
          .insert(projects)
          .values({
            name: input.name.trim(),
            slug: finalSlug,
            apiKey,
            clerkUserId: authContext.clerkUserId,
            clerkOrgId: authContext.clerkOrgId || null,
            allowedDomains: input.allowedDomains ? [...input.allowedDomains] : null,
          })
          .returning(),
      catch: (err) =>
        new ProjectDatabaseError({
          message: 'Failed to insert new project into database',
          cause: err,
        }),
    });

    return inserted;
  });
}

/**
 * Lists all projects accessible to the current user/organization
 */
export function listUserProjects(
  authContext: AuthContext
): Effect.Effect<Project[], ProjectDatabaseError> {
  return Effect.gen(function* () {
    const condition: SQL<unknown> = authContext.clerkOrgId
      ? or(
          eq(projects.clerkOrgId, authContext.clerkOrgId),
          and(eq(projects.clerkUserId, authContext.clerkUserId), isNull(projects.clerkOrgId))
        )!
      : eq(projects.clerkUserId, authContext.clerkUserId);

    const results = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(projects)
          .where(condition)
          .orderBy(desc(projects.createdAt)),
      catch: (err) =>
        new ProjectDatabaseError({
          message: 'Failed to list user projects from database',
          cause: err,
        }),
    });

    return results;
  });
}

/**
 * Retrieves a project by slug, enforcing authorization
 */
export function getProjectBySlug(
  slug: string,
  authContext: AuthContext
): Effect.Effect<Project, ProjectNotFoundError | UnauthorizedProjectAccessError | ProjectDatabaseError> {
  return Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try: () => db.select().from(projects).where(eq(projects.slug, slug)).limit(1),
      catch: (err) =>
        new ProjectDatabaseError({
          message: `Failed to query project with slug '${slug}'`,
          cause: err,
        }),
    });

    if (rows.length === 0) {
      return yield* Effect.fail(
        new ProjectNotFoundError({
          slug,
          message: `Project with slug '${slug}' was not found`,
        })
      );
    }

    const project = rows[0];

    const isUserOwner = project.clerkUserId === authContext.clerkUserId;
    const isOrgMember =
      Boolean(project.clerkOrgId) &&
      Boolean(authContext.clerkOrgId) &&
      project.clerkOrgId === authContext.clerkOrgId;

    if (!isUserOwner && !isOrgMember) {
      return yield* Effect.fail(
        new UnauthorizedProjectAccessError({
          slug,
          message: `Unauthorized: User '${authContext.clerkUserId}' cannot access project '${slug}'`,
        })
      );
    }

    return project;
  });
}

/**
 * Updates allowed CORS domains for a project
 */
export function updateProjectDomains(
  slug: string,
  rawInput: unknown,
  authContext: AuthContext
): Effect.Effect<
  Project,
  ProjectValidationError | ProjectNotFoundError | UnauthorizedProjectAccessError | ProjectDatabaseError
> {
  return Effect.gen(function* () {
    const validated = yield* validateUpdateDomainsInput(rawInput);
    const project = yield* getProjectBySlug(slug, authContext);

    const [updated] = yield* Effect.tryPromise({
      try: () =>
        db
          .update(projects)
          .set({
            allowedDomains: [...validated.allowedDomains],
            updatedAt: new Date(),
          })
          .where(eq(projects.id, project.id))
          .returning(),
      catch: (err) =>
        new ProjectDatabaseError({
          message: `Failed to update domains for project '${slug}'`,
          cause: err,
        }),
    });

    return updated;
  });
}

/**
 * Checks if a project has received at least one event
 */
export function checkProjectHasEvents(
  projectId: string
): Effect.Effect<boolean, ProjectDatabaseError> {
  return Effect.gen(function* () {
    const [result] = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ value: count() })
          .from(events)
          .where(eq(events.projectId, projectId)),
      catch: (err) =>
        new ProjectDatabaseError({
          message: `Failed to check events count for project '${projectId}'`,
          cause: err,
        }),
    });

    return (result?.value ?? 0) > 0;
  });
}
