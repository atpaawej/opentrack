import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { Effect, Exit } from 'effect';
import { getProjectBySlug, checkProjectHasEvents } from '@/features/projects/service';
import { getAllAnalyticsData } from '@/features/web-analytics/service';
import { AnalyticsDashboard } from '@/features/web-analytics/components/analytics-dashboard';
import { SetupGuide } from '@/components/dashboard/setup-guide';
import { Button } from '@/components/ui/button';

interface ProjectPageProps {
  params: Promise<{ projectSlug: string }>;
}

export default async function ProjectOverviewPage({ params }: ProjectPageProps) {
  const { projectSlug } = await params;
  const { userId, orgId } = await auth();
  if (!userId) notFound();

  const projectExit = await Effect.runPromiseExit(getProjectBySlug(projectSlug, { clerkUserId: userId, clerkOrgId: orgId }));
  if (Exit.isFailure(projectExit)) notFound();
  const project = projectExit.value;

  const retry = (
    <div role="alert" className="space-y-3 rounded-xl border border-edge bg-surface p-6">
      <h1 className="text-lg font-semibold text-foreground">Analytics unavailable</h1>
      <p className="text-sm text-muted">We couldn’t load activity for {project.name}. Your data has not been changed. Try again.</p>
      <Button asChild variant="outline"><a href={`/${encodeURIComponent(projectSlug)}`}>Try again</a></Button>
    </div>
  );

  const hasEventsExit = await Effect.runPromiseExit(checkProjectHasEvents(project.id));
  if (Exit.isFailure(hasEventsExit)) return retry;
  if (hasEventsExit.value) {
    const analyticsExit = await Effect.runPromiseExit(getAllAnalyticsData(project.id, '30d'));
    if (Exit.isFailure(analyticsExit)) return retry;
    return <AnalyticsDashboard project={project} initialData={analyticsExit.value} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-edge pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Connect {project.name}</h1>
          <p className="mt-1 text-sm text-muted">No events have arrived yet. Add the tracker, then open your app to send the first pageview.</p>
        </div>
        <Button variant="ghost" asChild size="sm"><Link href={`/${project.slug}/settings`}>Tracking settings</Link></Button>
      </div>
      <SetupGuide project={project} initialHasEvents={false} />
    </div>
  );
}
