'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { Effect, Exit } from 'effect';
import {
  createProject,
  listUserProjects,
  getProjectBySlug,
  updateProjectDomains,
  checkProjectHasEvents,
} from './service';

export async function createProjectAction(data: { name: string; allowedDomains?: string[] }) {
  const { userId, orgId } = await auth();

  if (!userId) {
    return { success: false, error: 'Unauthorized: User not authenticated' };
  }

  const exit = await Effect.runPromiseExit(
    createProject(data, { clerkUserId: userId, clerkOrgId: orgId })
  );

  if (Exit.isFailure(exit)) {
    const failure: any = exit.cause;
    const msg = failure?.error?.message || failure?.message || 'Failed to create project';
    return { success: false, error: msg };
  }

  revalidatePath('/');
  revalidatePath(`/${exit.value.slug}`);
  return { success: true, project: exit.value };
}

export async function updateProjectDomainsAction(slug: string, domains: string[]) {
  const { userId, orgId } = await auth();

  if (!userId) {
    return { success: false, error: 'Unauthorized: User not authenticated' };
  }

  const exit = await Effect.runPromiseExit(
    updateProjectDomains(slug, { allowedDomains: domains }, { clerkUserId: userId, clerkOrgId: orgId })
  );

  if (Exit.isFailure(exit)) {
    const failure: any = exit.cause;
    const msg = failure?.error?.message || failure?.message || 'Failed to update project domains';
    return { success: false, error: msg };
  }

  revalidatePath(`/${slug}`);
  return { success: true, project: exit.value };
}

export async function checkProjectEventsAction(projectId: string) {
  const { userId } = await auth();
  if (!userId) {
    return { hasEvents: false };
  }

  const exit = await Effect.runPromiseExit(checkProjectHasEvents(projectId));
  if (Exit.isFailure(exit)) {
    return { hasEvents: false };
  }

  return { hasEvents: exit.value };
}
