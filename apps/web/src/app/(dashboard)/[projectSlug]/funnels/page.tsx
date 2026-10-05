import * as React from 'react';
import { notFound } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { Effect, Exit } from 'effect';
import { getProjectBySlug } from '@/features/projects/service';
import { FunnelBuilder } from '@/features/funnels/components/funnel-builder';

interface PageProps {
  params: Promise<{ projectSlug: string }>;
}

export default async function FunnelsPage({ params }: PageProps) {
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

  return (
    <FunnelBuilder
      projectId={project.id}
      projectSlug={project.slug}
      initialQuery={{
        steps: [
          { id: 'step-1', name: 'Visited Site', eventName: '$pageview' },
          { id: 'step-2', name: 'Completed Signup', eventName: 'signup_completed' },
        ],
        conversionWindow: { value: 1, unit: 'day' },
        dateRange: '30d',
      }}
    />
  );
}
