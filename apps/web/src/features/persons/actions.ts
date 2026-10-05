'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { Effect, Exit } from 'effect';
import { getProjectBySlug } from '@/features/projects/service';
import { listPersons, getPersonProfile, updatePersonTrait } from './service';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { ListPersonsResult, PersonProfileDetail } from './types';
import type { Person } from '@/lib/db/schema';

interface ResolveProjectParams {
  projectSlug?: string;
  projectId?: string;
}

async function resolveAuthorizedProjectId(
  params: ResolveProjectParams,
  userId: string,
  orgId?: string | null
): Promise<{ projectId: string; slug: string } | { error: string }> {
  let resolvedProjectId = params.projectId;
  let resolvedSlug = params.projectSlug || '';

  if (params.projectSlug) {
    const projectExit = await Effect.runPromiseExit(
      getProjectBySlug(params.projectSlug, {
        clerkUserId: userId,
        clerkOrgId: orgId,
      })
    );

    if (Exit.isFailure(projectExit)) {
      const failure: any = projectExit.cause;
      const msg = failure?.error?.message || failure?.message || 'Project not found or unauthorized';
      return { error: msg };
    }

    resolvedProjectId = projectExit.value.id;
    resolvedSlug = projectExit.value.slug;
  } else if (resolvedProjectId) {
    const rows = await db
      .select()
      .from(projects)
      .where(eq(projects.id, resolvedProjectId))
      .limit(1);

    if (rows.length === 0) {
      return { error: 'Project not found' };
    }

    const project = rows[0];
    const isOwner = project.clerkUserId === userId;
    const isOrgMember =
      Boolean(project.clerkOrgId) &&
      Boolean(orgId) &&
      project.clerkOrgId === orgId;

    if (!isOwner && !isOrgMember) {
      return { error: 'Unauthorized access to project' };
    }

    resolvedSlug = project.slug;
  }

  if (!resolvedProjectId) {
    return { error: 'projectId or projectSlug is required' };
  }

  return { projectId: resolvedProjectId, slug: resolvedSlug };
}

export interface GetPersonsActionParams {
  projectSlug?: string;
  projectId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function getPersonsAction(
  params: GetPersonsActionParams
): Promise<
  | { success: true; data: ListPersonsResult }
  | { success: false; error: string }
> {
  const { userId, orgId } = await auth();

  if (!userId) {
    return { success: false, error: 'Unauthorized: User not authenticated' };
  }

  const resolved = await resolveAuthorizedProjectId(params, userId, orgId);
  if ('error' in resolved) {
    return { success: false, error: resolved.error };
  }

  const exit = await Effect.runPromiseExit(
    listPersons(resolved.projectId, {
      search: params.search,
      limit: params.limit,
      offset: params.offset,
    })
  );

  if (Exit.isFailure(exit)) {
    const failure: any = exit.cause;
    const msg = failure?.error?.message || failure?.message || 'Failed to list persons';
    return { success: false, error: msg };
  }

  return { success: true, data: exit.value };
}

export interface GetPersonProfileActionParams {
  projectSlug?: string;
  projectId?: string;
  distinctId: string;
}

export async function getPersonProfileAction(
  params: GetPersonProfileActionParams
): Promise<
  | { success: true; profile: PersonProfileDetail }
  | { success: false; error: string }
> {
  const { userId, orgId } = await auth();

  if (!userId) {
    return { success: false, error: 'Unauthorized: User not authenticated' };
  }

  const resolved = await resolveAuthorizedProjectId(params, userId, orgId);
  if ('error' in resolved) {
    return { success: false, error: resolved.error };
  }

  const exit = await Effect.runPromiseExit(
    getPersonProfile(resolved.projectId, params.distinctId)
  );

  if (Exit.isFailure(exit)) {
    const failure: any = exit.cause;
    const msg = failure?.error?.message || failure?.message || 'Failed to fetch person profile';
    return { success: false, error: msg };
  }

  return { success: true, profile: exit.value };
}

export interface UpdatePersonTraitActionParams {
  projectSlug?: string;
  projectId?: string;
  distinctId: string;
  key: string;
  value: unknown;
}

export async function updatePersonTraitAction(
  params: UpdatePersonTraitActionParams
): Promise<
  | { success: true; person: Person }
  | { success: false; error: string }
> {
  const { userId, orgId } = await auth();

  if (!userId) {
    return { success: false, error: 'Unauthorized: User not authenticated' };
  }

  const resolved = await resolveAuthorizedProjectId(params, userId, orgId);
  if ('error' in resolved) {
    return { success: false, error: resolved.error };
  }

  const exit = await Effect.runPromiseExit(
    updatePersonTrait(resolved.projectId, params.distinctId, params.key, params.value)
  );

  if (Exit.isFailure(exit)) {
    const failure: any = exit.cause;
    const msg = failure?.error?.message || failure?.message || 'Failed to update person trait';
    return { success: false, error: msg };
  }

  revalidatePath(`/${resolved.slug}/persons`);
  revalidatePath(`/${resolved.slug}/persons/${encodeURIComponent(params.distinctId)}`);

  return { success: true, person: exit.value };
}
