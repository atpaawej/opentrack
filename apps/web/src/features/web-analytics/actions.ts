'use server';

import { auth } from '@clerk/nextjs/server';
import { Effect, Exit } from 'effect';
import {
  getAllAnalyticsData,
  getTimeSeriesMetrics,
  getBreakdownMetrics,
  getKpiMetrics,
} from './service';
import type {
  DateRangeKey,
  Granularity,
  BreakdownDimension,
  AnalyticsDataPayload,
  TimeSeriesPoint,
  BreakdownItem,
  KpiMetricsSummary,
} from './types';

export async function fetchAnalyticsDataAction(
  projectId: string,
  dateRange: DateRangeKey = '30d',
  granularity?: Granularity,
  customFrom?: string,
  customTo?: string
): Promise<{ success: true; data: AnalyticsDataPayload } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: 'Unauthorized: User not authenticated' };
  }

  const exit = await Effect.runPromiseExit(
    getAllAnalyticsData(projectId, dateRange, granularity, customFrom, customTo)
  );

  if (Exit.isFailure(exit)) {
    const failure: any = exit.cause;
    const msg = failure?.error?.message || failure?.message || 'Failed to fetch analytics data';
    return { success: false, error: msg };
  }

  return { success: true, data: exit.value };
}

export async function fetchTimeSeriesAction(
  projectId: string,
  dateRange: DateRangeKey = '30d',
  granularity?: Granularity,
  customFrom?: string,
  customTo?: string
): Promise<{ success: true; timeSeries: TimeSeriesPoint[] } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: 'Unauthorized: User not authenticated' };
  }

  const exit = await Effect.runPromiseExit(
    getTimeSeriesMetrics(projectId, dateRange, granularity, customFrom, customTo)
  );

  if (Exit.isFailure(exit)) {
    const failure: any = exit.cause;
    const msg = failure?.error?.message || failure?.message || 'Failed to fetch time series data';
    return { success: false, error: msg };
  }

  return { success: true, timeSeries: exit.value };
}

export async function fetchBreakdownAction(
  projectId: string,
  dateRange: DateRangeKey = '30d',
  dimension: BreakdownDimension = 'pages',
  customFrom?: string,
  customTo?: string
): Promise<{ success: true; items: BreakdownItem[] } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: 'Unauthorized: User not authenticated' };
  }

  const exit = await Effect.runPromiseExit(
    getBreakdownMetrics(projectId, dateRange, dimension, customFrom, customTo)
  );

  if (Exit.isFailure(exit)) {
    const failure: any = exit.cause;
    const msg = failure?.error?.message || failure?.message || 'Failed to fetch breakdown data';
    return { success: false, error: msg };
  }

  return { success: true, items: exit.value };
}
