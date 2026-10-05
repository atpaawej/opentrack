import * as React from 'react';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { Effect, Exit } from 'effect';
import { Badge } from '@/components/ui/badge';
import { getProjectBySlug } from '@/features/projects/service';
import { listPersons } from '@/features/persons/service';
import { PersonList } from '@/features/persons/components/person-list';
import type { ListPersonsResult } from '@/features/persons/types';

interface PageProps {
  params: Promise<{ projectSlug: string }>;
  searchParams?: Promise<{ search?: string; page?: string }>;
}

export default async function PersonsPage({ params, searchParams }: PageProps) {
  const { projectSlug } = await params;
  const { userId, orgId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const projectExit = await Effect.runPromiseExit(
    getProjectBySlug(projectSlug, { clerkUserId: userId, clerkOrgId: orgId })
  );

  if (Exit.isFailure(projectExit)) {
    notFound();
  }

  const project = projectExit.value;

  const sp = searchParams ? await searchParams : {};
  const search = sp.search || undefined;
  const pageNum = parseInt(sp.page || '1', 10) || 1;
  const limit = 20;
  const offset = (pageNum - 1) * limit;

  const personsExit = await Effect.runPromiseExit(
    listPersons(project.id, { search, limit, offset })
  );

  const initialData: ListPersonsResult = Exit.isSuccess(personsExit)
    ? personsExit.value
    : { persons: [], total: 0, limit, offset };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-800/60 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
              Persons &amp; Users
            </h1>
            <Badge variant="outline" className="border-zinc-800 bg-zinc-900/60 text-zinc-300 font-mono">
              Directory
            </Badge>
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            Explore identified users, user traits, and activity history for{' '}
            <span className="font-medium text-zinc-300">{project.name}</span>.
          </p>
        </div>
      </div>

      <PersonList
        projectSlug={projectSlug}
        initialData={initialData}
      />
    </div>
  );
}
