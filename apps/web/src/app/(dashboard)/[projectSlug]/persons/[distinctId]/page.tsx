import * as React from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { Effect, Exit } from 'effect';
import { ArrowLeft, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getProjectBySlug } from '@/features/projects/service';
import { getPersonProfile } from '@/features/persons/service';
import { PersonProfile } from '@/features/persons/components/person-profile';

interface PageProps {
  params: Promise<{
    projectSlug: string;
    distinctId: string;
  }>;
}

export default async function PersonDetailPage({ params }: PageProps) {
  const { projectSlug, distinctId: encodedDistinctId } = await params;
  const { userId, orgId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const distinctId = decodeURIComponent(encodedDistinctId);

  // Authenticate & fetch project
  const projectExit = await Effect.runPromiseExit(
    getProjectBySlug(projectSlug, { clerkUserId: userId, clerkOrgId: orgId })
  );

  if (Exit.isFailure(projectExit)) {
    notFound();
  }

  const project = projectExit.value;

  // Query person profile (handles alias resolution & stub creation if events exist)
  const profileExit = await Effect.runPromiseExit(
    getPersonProfile(project.id, distinctId)
  );

  if (Exit.isFailure(profileExit)) {
    return (
      <div className="space-y-6">
        <Link
          href={`/${projectSlug}/persons`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Persons
        </Link>

        <Card className="border-zinc-800/80 bg-zinc-950 p-12 text-center">
          <CardContent className="flex flex-col items-center justify-center space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500">
              <UserX className="h-6 w-6" />
            </div>
            <h2 className="text-base font-semibold text-zinc-100">
              Person Not Found
            </h2>
            <p className="text-xs text-zinc-400 max-w-md">
              No person record or historical events were found for distinct ID{' '}
              <code className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-[11px] text-zinc-300 border border-zinc-800">
                {distinctId}
              </code>{' '}
              in project <span className="text-zinc-200">{project.name}</span>.
            </p>
            <div className="pt-2">
              <Button asChild variant="outline" size="sm" className="text-xs border-zinc-800 bg-zinc-900">
                <Link href={`/${projectSlug}/persons`}>Return to Directory</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const profile = profileExit.value;

  return (
    <PersonProfile
      projectSlug={projectSlug}
      initialProfile={profile}
    />
  );
}
