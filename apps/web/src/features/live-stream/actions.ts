'use server';

import { auth } from '@clerk/nextjs/server';
import { Effect, Exit } from 'effect';
import { getProjectBySlug } from '@/features/projects/service';
import { getLiveEvents } from './service';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export interface GetLiveEventsParams {
  projectSlug?: string;
  projectId?: string;
  eventName?: string | string[] | readonly string[];
  distinctId?: string;
  since?: string | number | Date;
  limit?: number;
}

export async function getLiveEventsAction(params: GetLiveEventsParams) {
  const { userId, orgId } = await auth();

  if (!userId) {
    return { success: false, error: 'Unauthorized: User not authenticated' };
  }

  let resolvedProjectId = params.projectId;

  // Resolve projectId from projectSlug if not directly provided
  if (!resolvedProjectId && params.projectSlug) {
    const projectExit = await Effect.runPromiseExit(
      getProjectBySlug(params.projectSlug, {
        clerkUserId: userId,
        clerkOrgId: orgId,
      })
    );

    if (Exit.isFailure(projectExit)) {
      const failure: any = projectExit.cause;
      const msg = failure?.error?.message || failure?.message || 'Project not found or unauthorized';
      return { success: false, error: msg };
    }

    resolvedProjectId = projectExit.value.id;
  } else if (resolvedProjectId) {
    // Verify access to projectId
    const rows = await db
      .select()
      .from(projects)
      .where(eq(projects.id, resolvedProjectId))
      .limit(1);

    if (rows.length === 0) {
      return { success: false, error: 'Project not found' };
    }

    const project = rows[0];
    const isOwner = project.clerkUserId === userId;
    const isOrgMember =
      Boolean(project.clerkOrgId) &&
      Boolean(orgId) &&
      project.clerkOrgId === orgId;

    if (!isOwner && !isOrgMember) {
      return { success: false, error: 'Unauthorized access to project' };
    }
  }

  if (!resolvedProjectId) {
    return { success: false, error: 'projectId or projectSlug is required' };
  }

  const exit = await Effect.runPromiseExit(
    getLiveEvents({
      projectId: resolvedProjectId,
      eventName: params.eventName,
      distinctId: params.distinctId,
      since: params.since,
      limit: params.limit,
    })
  );

  if (Exit.isFailure(exit)) {
    const failure: any = exit.cause;
    const msg = failure?.error?.message || failure?.message || 'Failed to fetch live events';
    return { success: false, error: msg };
  }

  return { success: true, events: exit.value };
}
