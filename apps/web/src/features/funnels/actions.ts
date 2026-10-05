'use server';

import { auth } from '@clerk/nextjs/server';
import { Effect, Exit } from 'effect';
import { calculateFunnel, saveFunnel, listFunnels } from './service';
import type { FunnelQueryConfig, FunnelResult, SavedFunnel } from './types';

export async function calculateFunnelAction(
  projectId: string,
  config: FunnelQueryConfig
): Promise<{ success: true; data: FunnelResult } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: 'Unauthorized: User not authenticated' };
  }

  const exit = await Effect.runPromiseExit(calculateFunnel(projectId, config));

  if (Exit.isFailure(exit)) {
    const failure: any = exit.cause;
    const msg = failure?.error?.message || failure?.message || 'Failed to calculate funnel';
    return { success: false, error: msg };
  }

  return { success: true, data: exit.value };
}

export async function saveFunnelAction(
  projectId: string,
  data: {
    name: string;
    queryConfig: FunnelQueryConfig;
  }
): Promise<{ success: true; funnel: SavedFunnel } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: 'Unauthorized: User not authenticated' };
  }

  const exit = await Effect.runPromiseExit(
    saveFunnel(projectId, {
      ...data,
      createdBy: userId,
    })
  );

  if (Exit.isFailure(exit)) {
    const failure: any = exit.cause;
    const msg = failure?.error?.message || failure?.message || 'Failed to save funnel';
    return { success: false, error: msg };
  }

  return { success: true, funnel: exit.value };
}

export async function listFunnelsAction(
  projectId: string
): Promise<{ success: true; funnels: SavedFunnel[] } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: 'Unauthorized: User not authenticated' };
  }

  const exit = await Effect.runPromiseExit(listFunnels(projectId));

  if (Exit.isFailure(exit)) {
    const failure: any = exit.cause;
    const msg = failure?.error?.message || failure?.message || 'Failed to list funnels';
    return { success: false, error: msg };
  }

  return { success: true, funnels: exit.value };
}
