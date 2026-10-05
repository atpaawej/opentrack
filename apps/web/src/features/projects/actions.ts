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
  rotateApiKey,
  updateProjectPrivacySettings,
  purgePersonData,
  exportProjectEvents,
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

export async function rotateApiKeyAction(
  projectSlug: string,
  type: 'public' | 'secret'
) {
  const { userId, orgId } = await auth();

  if (!userId) {
    return { success: false, error: 'Unauthorized: User not authenticated' };
  }

  const exit = await Effect.runPromiseExit(
    Effect.gen(function* () {
      const project = yield* getProjectBySlug(projectSlug, {
        clerkUserId: userId,
        clerkOrgId: orgId,
      });
      return yield* rotateApiKey(project.id, type);
    })
  );

  if (Exit.isFailure(exit)) {
    const failure: any = exit.cause;
    const msg = failure?.error?.message || failure?.message || 'Failed to rotate API key';
    return { success: false, error: msg };
  }

  revalidatePath(`/${projectSlug}`);
  revalidatePath(`/${projectSlug}/settings`);
  return { success: true, project: exit.value };
}

export async function updateProjectPrivacyAction(
  projectSlug: string,
  dataRetentionDays?: number,
  timezone?: string
) {
  const { userId, orgId } = await auth();

  if (!userId) {
    return { success: false, error: 'Unauthorized: User not authenticated' };
  }

  const exit = await Effect.runPromiseExit(
    Effect.gen(function* () {
      const project = yield* getProjectBySlug(projectSlug, {
        clerkUserId: userId,
        clerkOrgId: orgId,
      });
      return yield* updateProjectPrivacySettings(project.id, {
        dataRetentionDays,
        timezone,
      });
    })
  );

  if (Exit.isFailure(exit)) {
    const failure: any = exit.cause;
    const msg =
      failure?.error?.message || failure?.message || 'Failed to update privacy settings';
    return { success: false, error: msg };
  }

  revalidatePath(`/${projectSlug}`);
  revalidatePath(`/${projectSlug}/settings`);
  return { success: true, project: exit.value };
}

export async function gdprPurgeUserAction(projectSlug: string, distinctId: string) {
  const { userId, orgId } = await auth();

  if (!userId) {
    return { success: false, error: 'Unauthorized: User not authenticated' };
  }

  const exit = await Effect.runPromiseExit(
    Effect.gen(function* () {
      const project = yield* getProjectBySlug(projectSlug, {
        clerkUserId: userId,
        clerkOrgId: orgId,
      });
      return yield* purgePersonData(project.id, distinctId);
    })
  );

  if (Exit.isFailure(exit)) {
    const failure: any = exit.cause;
    const msg = failure?.error?.message || failure?.message || 'Failed to purge user data';
    return { success: false, error: msg };
  }

  revalidatePath(`/${projectSlug}`);
  revalidatePath(`/${projectSlug}/persons`);
  revalidatePath(`/${projectSlug}/live`);
  revalidatePath(`/${projectSlug}/settings`);
  return { success: true, result: exit.value };
}

export async function exportUserEventsAction(projectSlug: string, distinctId?: string) {
  const { userId, orgId } = await auth();

  if (!userId) {
    return { success: false, error: 'Unauthorized: User not authenticated' };
  }

  const exit = await Effect.runPromiseExit(
    Effect.gen(function* () {
      const project = yield* getProjectBySlug(projectSlug, {
        clerkUserId: userId,
        clerkOrgId: orgId,
      });
      return yield* exportProjectEvents(project.id, { distinctId });
    })
  );

  if (Exit.isFailure(exit)) {
    const failure: any = exit.cause;
    const msg = failure?.error?.message || failure?.message || 'Failed to export events';
    return { success: false, error: msg };
  }

  return { success: true, events: exit.value };
}

