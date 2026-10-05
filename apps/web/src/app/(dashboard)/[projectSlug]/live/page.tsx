import * as React from 'react';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { Effect, Exit } from 'effect';
import { Badge } from '@/components/ui/badge';
import { getProjectBySlug } from '@/features/projects/service';
import { getLiveEvents } from '@/features/live-stream/service';
import { LiveStreamFeed } from '@/features/live-stream/components/live-stream-feed';
import type { Event } from '@/lib/db/schema';

interface PageProps {
  params: Promise<{ projectSlug: string }>;
}

export default async function LiveStreamPage({ params }: PageProps) {
  const { projectSlug } = await params;
  const { userId, orgId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  // Fetch project details
  const projectExit = await Effect.runPromiseExit(
    getProjectBySlug(projectSlug, { clerkUserId: userId, clerkOrgId: orgId })
  );

  if (Exit.isFailure(projectExit)) {
    notFound();
  }

  const project = projectExit.value;

  // Initial server-side query of live events
  const eventsExit = await Effect.runPromiseExit(
    getLiveEvents({
      projectId: project.id,
      limit: 50,
    })
  );

  const initialEvents: Event[] = Exit.isSuccess(eventsExit) ? eventsExit.value : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-800/60 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
              Live Stream
            </h1>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
              Active Stream
            </Badge>
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            Real-time telemetry event stream for{' '}
            <span className="font-medium text-zinc-300">{project.name}</span>.
          </p>
        </div>
      </div>

      <LiveStreamFeed
        projectSlug={projectSlug}
        initialEvents={initialEvents}
      />
    </div>
  );
}
