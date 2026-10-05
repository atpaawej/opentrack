import * as React from 'react';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { Effect, Exit } from 'effect';
import { Header } from '@/components/dashboard/header';
import { Sidebar } from '@/components/dashboard/sidebar';
import { listUserProjects, getProjectBySlug } from '@/features/projects/service';

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{ projectSlug: string }>;
}

export default async function ProjectDashboardLayout({
  children,
  params,
}: ProjectLayoutProps) {
  const { projectSlug } = await params;
  const { userId, orgId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const [projectsExit, currentProjectExit] = await Promise.all([
    Effect.runPromiseExit(listUserProjects({ clerkUserId: userId, clerkOrgId: orgId })),
    Effect.runPromiseExit(getProjectBySlug(projectSlug, { clerkUserId: userId, clerkOrgId: orgId })),
  ]);

  if (Exit.isFailure(currentProjectExit)) {
    // If project not found or unauthorized
    notFound();
  }

  const currentProject = currentProjectExit.value;
  const projects = Exit.isSuccess(projectsExit) ? projectsExit.value : [currentProject];

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <Header currentProject={currentProject} projects={projects} />
      <div className="flex flex-1">
        <Sidebar projectSlug={projectSlug} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
