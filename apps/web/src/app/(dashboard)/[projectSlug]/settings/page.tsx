import * as React from 'react';
import { notFound } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { Effect, Exit } from 'effect';
import { getProjectBySlug } from '@/features/projects/service';
import { SettingsForm } from './settings-form';

interface SettingsPageProps {
  params: Promise<{ projectSlug: string }>;
}

export default async function ProjectSettingsPage({ params }: SettingsPageProps) {
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
    <div className="space-y-6">
      <div className="border-b border-zinc-800/80 pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Project Settings
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Manage API keys, CORS allowed domains, and project metadata for {project.name}.
        </p>
      </div>

      <SettingsForm project={project} />
    </div>
  );
}
