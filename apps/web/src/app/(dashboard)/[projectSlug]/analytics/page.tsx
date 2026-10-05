import * as React from 'react';
import { notFound } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { Effect, Exit } from 'effect';
import { getProjectBySlug } from '@/features/projects/service';
import { getAllAnalyticsData } from '@/features/web-analytics/service';
import { AnalyticsDashboard } from '@/features/web-analytics/components/analytics-dashboard';

interface AnalyticsPageProps {
  params: Promise<{ projectSlug: string }>;
}

export default async function ProjectAnalyticsPage({ params }: AnalyticsPageProps) {
  const { projectSlug } = await params;
  const { userId, orgId } = await auth();

  if (!userId) {
    notFound();
  }

  const projectExit = await Effect.runPromiseExit(
    getProjectBySlug(projectSlug, { clerkUserId: userId, clerkOrgId: orgId })
  );

  if (Exit.isFailure(projectExit)) {
    notFound();
  }

  const project = projectExit.value;

  const analyticsExit = await Effect.runPromiseExit(
    getAllAnalyticsData(project.id, '30d')
  );

  const initialData = Exit.isSuccess(analyticsExit)
    ? analyticsExit.value
    : {
        kpis: {
          uniqueVisitors: { value: 0, previousValue: 0, changePercentage: 0 },
          totalPageviews: { value: 0, previousValue: 0, changePercentage: 0 },
          totalSessions: { value: 0, previousValue: 0, changePercentage: 0 },
          bounceRate: { value: 0, previousValue: 0, changePercentage: 0 },
          avgSessionDuration: { value: 0, previousValue: 0, changePercentage: 0 },
        },
        timeSeries: [],
        breakdowns: {
          pages: [],
          referrers: [],
          utm: [],
          countries: [],
          browsers: [],
          os: [],
          devices: [],
        },
        dateRange: '30d' as const,
        granularity: 'day' as const,
        from: new Date(Date.now() - 30 * 86400000).toISOString(),
        to: new Date().toISOString(),
      };

  return <AnalyticsDashboard project={project} initialData={initialData} />;
}
