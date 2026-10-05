import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';

interface PageProps {
  params: Promise<{ projectSlug: string }>;
}

export default async function PersonsPage({ params }: PageProps) {
  const { projectSlug } = await params;

  return (
    <div className="space-y-6">
      <div className="border-b border-zinc-800/80 pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white">Persons & Cohorts</h1>
        <p className="mt-1 text-sm text-zinc-400">
          User profiles, identified distinct IDs, and session history for {projectSlug}.
        </p>
      </div>

      <Card className="border-zinc-800/80 bg-zinc-950/40">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-400" />
            <CardTitle>Identified Users</CardTitle>
          </div>
          <CardDescription>
            User explorer and activity timelines are scheduled for Plan 0005.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-zinc-800/80 rounded-xl bg-zinc-900/20">
            <p className="text-sm font-medium text-zinc-300">User Identification System</p>
            <p className="text-xs text-zinc-500 mt-1">Users identified with distinct_id will populate here.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
