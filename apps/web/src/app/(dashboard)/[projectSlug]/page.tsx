import * as React from 'react';
import { notFound } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { Effect, Exit } from 'effect';
import { getProjectBySlug, checkProjectHasEvents } from '@/features/projects/service';
import { SetupGuide } from '@/components/dashboard/setup-guide';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Globe, Key, ShieldCheck, Zap } from 'lucide-react';

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {project.name}
            </h1>
            <Badge variant="outline" className="font-mono text-[11px] text-zinc-400">
              {project.slug}
            </Badge>
            {hasEvents ? (
              <Badge variant="live">Collecting Data</Badge>
            ) : (
              <Badge variant="secondary">Awaiting First Event</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            Real-time analytics and telemetry stream for {project.name}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span className="text-xs text-zinc-300">
              {project.clerkOrgId ? 'Organization Workspace' : 'Personal Project'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Setup Guide & Telemetry Status */}
      <SetupGuide project={project} initialHasEvents={hasEvents} />

      {/* Quick Diagnostics & Configuration Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-zinc-800/80 bg-zinc-950/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Ingestion Status
            </CardTitle>
            <Zap className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-zinc-100">
              {hasEvents ? 'Active' : 'Listening'}
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Public ingestion endpoint: <code className="text-zinc-300 font-mono">/api/v1/capture</code>
            </p>
          </CardContent>
        </Card>

        <Card className="border-zinc-800/80 bg-zinc-950/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Allowed Domains
            </CardTitle>
            <Globe className="h-4 w-4 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-zinc-100">
              {project.allowedDomains && project.allowedDomains.length > 0
                ? `${project.allowedDomains.length} Configured`
                : 'All Origins (*) allowed'}
            </div>
            <p className="text-xs text-zinc-400 mt-1 truncate">
              {project.allowedDomains && project.allowedDomains.length > 0
                ? project.allowedDomains.join(', ')
                : 'Requests from any origin are accepted'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-zinc-800/80 bg-zinc-950/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Project ID
            </CardTitle>
            <Key className="h-4 w-4 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-mono font-medium text-zinc-200 truncate">
              {project.id}
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Internal UUID for database relations
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
