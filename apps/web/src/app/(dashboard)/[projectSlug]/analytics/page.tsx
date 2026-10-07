import { notFound, redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { Effect, Exit } from 'effect';
import { getProjectBySlug } from '@/features/projects/service';

interface AnalyticsPageProps {
  params: Promise<{ projectSlug: string }>;
}

// Preserve old links without maintaining a second, potentially inconsistent overview.
export default async function ProjectAnalyticsPage({ params }: AnalyticsPageProps) {
  const { projectSlug } = await params;
  const { userId, orgId } = await auth();

  if (!userId) notFound();

  const projectExit = await Effect.runPromiseExit(
    getProjectBySlug(projectSlug, { clerkUserId: userId, clerkOrgId: orgId })
  );
  if (Exit.isFailure(projectExit)) notFound();

  redirect(`/${encodeURIComponent(projectExit.value.slug)}`);
}
