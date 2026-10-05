'use server';

import { auth } from '@clerk/nextjs/server';
import { Effect, Exit } from 'effect';
import { runInsightQuery, saveInsight, listInsights } from './service';
import type { InsightQueryConfig, InsightQueryResult, SavedInsight } from './types';

export async function runInsightQueryAction(
  projectId: string,
  config: InsightQueryConfig
): Promise<{ success: true; data: InsightQueryResult } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: 'Unauthorized: User not authenticated' };
  }

  const exit = await Effect.runPromiseExit(runInsightQuery(projectId, config));

  if (Exit.isFailure(exit)) {
    const failure: any = exit.cause;
    const msg = failure?.error?.message || failure?.message || 'Failed to execute query';
    return { success: false, error: msg };
  }

  return { success: true, data: exit.value };
}

export async function saveInsightAction(
  projectId: string,
  data: {
    name: string;
    type?: string;
    queryConfig: InsightQueryConfig;
  }
): Promise<{ success: true; insight: SavedInsight } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: 'Unauthorized: User not authenticated' };
  }

  const exit = await Effect.runPromiseExit(
    saveInsight(projectId, {
      ...data,
      createdBy: userId,
    })
  );

  if (Exit.isFailure(exit)) {
    const failure: any = exit.cause;
    const msg = failure?.error?.message || failure?.message || 'Failed to save insight';
    return { success: false, error: msg };
  }

  return { success: true, insight: exit.value };
}

export async function listInsightsAction(
  projectId: string
): Promise<{ success: true; insights: SavedInsight[] } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: 'Unauthorized: User not authenticated' };
  }

  const exit = await Effect.runPromiseExit(listInsights(projectId));

  if (Exit.isFailure(exit)) {
    const failure: any = exit.cause;
    const msg = failure?.error?.message || failure?.message || 'Failed to list insights';
    return { success: false, error: msg };
  }

  return { success: true, insights: exit.value };
}
