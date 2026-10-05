import * as React from 'react';
import { notFound } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { Effect, Exit } from 'effect';
import { getProjectBySlug, checkProjectHasEvents } from '@/features/projects/service';
import { SetupGuide } from '@/components/dashboard/setup-guide';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ProjectPageProps {
  params: Promise<{ projectSlug: string }>;
}

export default async function ProjectOverviewPage({ params }: ProjectPageProps) {
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

  const hasEventsExit = await Effect.runPromiseExit(checkProjectHasEvents(project.id));
  const hasEvents = Exit.isSuccess(hasEventsExit) ? hasEventsExit.value : false;

  return (
    <div className="space-y-6">
      {/* Top Project Bar */}
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 border-b border-zinc-800/60 pb-5">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
            {project.name}
          </h1>
          <Badge variant="outline">{project.slug}</Badge>
          <Badge variant={hasEvents ? 'contrast' : 'secondary'}>
            {hasEvents ? 'Active' : 'Awaiting data'}
          </Badge>
        </div>

        <div className="text-xs text-zinc-400 font-mono">
          {project.clerkOrgId ? 'Organization' : 'Personal'}
        </div>
      </div>

      {/* Main Setup Guide & Telemetry Status */}
      <SetupGuide project={project} initialHasEvents={hasEvents} />

      {/* Quick Diagnostics & Configuration Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-zinc-800/80 bg-zinc-950">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-zinc-400">
              Endpoint
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-xs text-zinc-200">
              /api/v1/capture
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Public ingestion receiver
            </p>
          </CardContent>
        </Card>

        <Card className="border-zinc-800/80 bg-zinc-950">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-zinc-400">
              CORS Policy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs font-medium text-zinc-200 truncate">
              {project.allowedDomains && project.allowedDomains.length > 0
                ? `${project.allowedDomains.length} domains permitted`
                : 'All origins (*)'}
            </div>
            <p className="text-xs text-zinc-400 mt-1 truncate">
              {project.allowedDomains && project.allowedDomains.length > 0
                ? project.allowedDomains.join(', ')
                : 'Unrestricted client origins'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-zinc-800/80 bg-zinc-950">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-zinc-400">
              Project Identifier
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs font-mono text-zinc-300 truncate">
              {project.id}
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              UUID database reference
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
