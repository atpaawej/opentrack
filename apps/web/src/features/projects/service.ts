import { nanoid } from 'nanoid';
import { Effect } from 'effect';
import { Schema } from '@effect/schema';
import { eq, or, and, isNull, desc, count, inArray, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  projects,
  events,
  persons,
  personAliases,
  type Project,
  type Event,
} from '@/lib/db/schema';
import {
  CreateProjectSchema,
  UpdateProjectDomainsSchema,
  UpdateProjectPrivacySchema,
  RotateApiKeySchema,
  PurgePersonDataSchema,
  ExportProjectEventsSchema,
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

export function generateSecretKey(): string {
  return `ot_sec_${nanoid(32)}`;
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
    const secretKey = generateSecretKey();

    const [inserted] = yield* Effect.tryPromise({
      try: () =>
        db
          .insert(projects)
          .values({
            name: input.name.trim(),
            slug: finalSlug,
            apiKey,
            secretKey,
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

/**
 * Rotates an API key (public ot_live_... or secret ot_sec_...) for a project
 */
export function rotateApiKey(
  projectId: string,
  type: 'public' | 'secret'
): Effect.Effect<
  Project,
  ProjectValidationError | ProjectNotFoundError | ProjectDatabaseError
> {
  return Effect.gen(function* () {
    if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
      return yield* Effect.fail(
        new ProjectValidationError({
          message: 'Project ID is required to rotate API key',
        })
      );
    }

    if (type !== 'public' && type !== 'secret') {
      return yield* Effect.fail(
        new ProjectValidationError({
          message: 'Invalid key type. Must be "public" or "secret"',
        })
      );
    }

    const newKey = type === 'public' ? generateApiKey() : generateSecretKey();
    const updatePayload =
      type === 'public'
        ? { apiKey: newKey, updatedAt: new Date() }
        : { secretKey: newKey, updatedAt: new Date() };

    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .update(projects)
          .set(updatePayload)
          .where(eq(projects.id, projectId))
          .returning(),
      catch: (err) =>
        new ProjectDatabaseError({
          message: `Failed to rotate ${type} API key for project '${projectId}'`,
          cause: err,
        }),
    });

    if (rows.length === 0) {
      return yield* Effect.fail(
        new ProjectNotFoundError({
          slug: projectId,
          message: `Project with ID '${projectId}' was not found`,
        })
      );
    }

    return rows[0];
  });
}

/**
 * Updates project privacy settings (data retention and timezone)
 */
export function updateProjectPrivacySettings(
  projectId: string,
  settings: { dataRetentionDays?: number; timezone?: string }
): Effect.Effect<
  Project,
  ProjectValidationError | ProjectNotFoundError | ProjectDatabaseError
> {
  return Effect.gen(function* () {
    if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
      return yield* Effect.fail(
        new ProjectValidationError({
          message: 'Project ID is required to update privacy settings',
        })
      );
    }

    const updatePayload: Partial<typeof projects.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (settings.dataRetentionDays !== undefined) {
      if (typeof settings.dataRetentionDays !== 'number' || settings.dataRetentionDays < 0) {
        return yield* Effect.fail(
          new ProjectValidationError({
            message: 'dataRetentionDays must be a non-negative integer',
          })
        );
      }
      updatePayload.dataRetentionDays = settings.dataRetentionDays;
    }

    if (settings.timezone !== undefined) {
      const trimmedTz = settings.timezone.trim();
      if (!trimmedTz) {
        return yield* Effect.fail(
          new ProjectValidationError({
            message: 'timezone must be a non-empty string',
          })
        );
      }
      updatePayload.timezone = trimmedTz;
    }

    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .update(projects)
          .set(updatePayload)
          .where(eq(projects.id, projectId))
          .returning(),
      catch: (err) =>
        new ProjectDatabaseError({
          message: `Failed to update privacy settings for project '${projectId}'`,
          cause: err,
        }),
    });

    if (rows.length === 0) {
      return yield* Effect.fail(
        new ProjectNotFoundError({
          slug: projectId,
          message: `Project with ID '${projectId}' was not found`,
        })
      );
    }

    return rows[0];
  });
}

export interface PurgePersonDataResult {
  readonly success: boolean;
  readonly distinctId: string;
  readonly deletedEventsCount: number;
  readonly deletedPersonsCount: number;
  readonly deletedAliasesCount: number;
}

/**
 * GDPR "Right to be Forgotten" user purge:
 * Permanently deletes all events, person records, and aliases matching distinctId
 * within the specified project.
 */
export function purgePersonData(
  projectId: string,
  distinctId: string
): Effect.Effect<
  PurgePersonDataResult,
  ProjectValidationError | ProjectDatabaseError
> {
  return Effect.gen(function* () {
    if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
      return yield* Effect.fail(
        new ProjectValidationError({
          message: 'Project ID is required for GDPR user purge',
        })
      );
    }

    if (!distinctId || typeof distinctId !== 'string' || !distinctId.trim()) {
      return yield* Effect.fail(
        new ProjectValidationError({
          message: 'distinctId is required for GDPR user purge',
        })
      );
    }

    const targetId = distinctId.trim();

    // 1. Resolve all aliases and linked distinct IDs in this project
    const aliases = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            aliasId: personAliases.aliasId,
            personDistinctId: personAliases.personDistinctId,
          })
          .from(personAliases)
          .where(
            and(
              eq(personAliases.projectId, projectId),
              or(
                eq(personAliases.aliasId, targetId),
                eq(personAliases.personDistinctId, targetId)
              )
            )
          ),
      catch: (err) =>
        new ProjectDatabaseError({
          message: `Failed to query aliases for GDPR purge on '${targetId}'`,
          cause: err,
        }),
    });

    const targetIds = new Set<string>([targetId]);
    for (const a of aliases) {
      targetIds.add(a.aliasId);
      targetIds.add(a.personDistinctId);
    }

    if (targetIds.size > 1) {
      const moreAliases = yield* Effect.tryPromise({
        try: () =>
          db
            .select({
              aliasId: personAliases.aliasId,
              personDistinctId: personAliases.personDistinctId,
            })
            .from(personAliases)
            .where(
              and(
                eq(personAliases.projectId, projectId),
                or(
                  inArray(personAliases.personDistinctId, Array.from(targetIds)),
                  inArray(personAliases.aliasId, Array.from(targetIds))
                )
              )
            ),
        catch: (err) =>
          new ProjectDatabaseError({
            message: 'Failed to query related aliases for GDPR purge',
            cause: err,
          }),
      });
      for (const a of moreAliases) {
        targetIds.add(a.aliasId);
        targetIds.add(a.personDistinctId);
      }
    }

    const idList = Array.from(targetIds);

    // 2. Delete events
    const deletedEvents = yield* Effect.tryPromise({
      try: () =>
        db
          .delete(events)
          .where(
            and(
              eq(events.projectId, projectId),
              inArray(events.distinctId, idList)
            )
          )
          .returning({ id: events.id }),
      catch: (err) =>
        new ProjectDatabaseError({
          message: `Failed to delete events for GDPR purge on '${targetId}'`,
          cause: err,
        }),
    });

    // 3. Delete person_aliases
    const deletedAliases = yield* Effect.tryPromise({
      try: () =>
        db
          .delete(personAliases)
          .where(
            and(
              eq(personAliases.projectId, projectId),
              or(
                inArray(personAliases.aliasId, idList),
                inArray(personAliases.personDistinctId, idList)
              )
            )
          )
          .returning({ id: personAliases.id }),
      catch: (err) =>
        new ProjectDatabaseError({
          message: `Failed to delete person aliases for GDPR purge on '${targetId}'`,
          cause: err,
        }),
    });

    // 4. Delete persons
    const deletedPersons = yield* Effect.tryPromise({
      try: () =>
        db
          .delete(persons)
          .where(
            and(
              eq(persons.projectId, projectId),
              inArray(persons.distinctId, idList)
            )
          )
          .returning({ id: persons.id }),
      catch: (err) =>
        new ProjectDatabaseError({
          message: `Failed to delete persons for GDPR purge on '${targetId}'`,
          cause: err,
        }),
    });

    return {
      success: true,
      distinctId: targetId,
      deletedEventsCount: deletedEvents.length,
      deletedPersonsCount: deletedPersons.length,
      deletedAliasesCount: deletedAliases.length,
    };
  });
}

export interface ExportProjectEventsOptions {
  distinctId?: string;
  limit?: number;
}

/**
 * Returns array of raw events for data portability export
 */
export function exportProjectEvents(
  projectId: string,
  options: ExportProjectEventsOptions = {}
): Effect.Effect<Event[], ProjectValidationError | ProjectDatabaseError> {
  return Effect.gen(function* () {
    if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
      return yield* Effect.fail(
        new ProjectValidationError({
          message: 'Project ID is required to export events',
        })
      );
    }

    const limit = options.limit ? Math.min(Math.max(1, options.limit), 50000) : 10000;

    let targetIds: string[] | null = null;
    if (options.distinctId && options.distinctId.trim()) {
      const baseId = options.distinctId.trim();
      const aliasRows = yield* Effect.tryPromise({
        try: () =>
          db
            .select({
              aliasId: personAliases.aliasId,
              personDistinctId: personAliases.personDistinctId,
            })
            .from(personAliases)
            .where(
              and(
                eq(personAliases.projectId, projectId),
                or(
                  eq(personAliases.aliasId, baseId),
                  eq(personAliases.personDistinctId, baseId)
                )
              )
            ),
        catch: (err) =>
          new ProjectDatabaseError({
            message: `Failed to query aliases for event export`,
            cause: err,
          }),
      });

      const set = new Set<string>([baseId]);
      for (const a of aliasRows) {
        set.add(a.aliasId);
        set.add(a.personDistinctId);
      }
      targetIds = Array.from(set);
    }

    const whereClause =
      targetIds && targetIds.length > 0
        ? and(
            eq(events.projectId, projectId),
            inArray(events.distinctId, targetIds)
          )
        : eq(events.projectId, projectId);

    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(events)
          .where(whereClause)
          .orderBy(desc(events.timestamp))
          .limit(limit),
      catch: (err) =>
        new ProjectDatabaseError({
          message: `Failed to export events for project '${projectId}'`,
          cause: err,
        }),
    });

    return rows;
  });
}

