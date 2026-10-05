import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface PageProps {
  params: Promise<{ projectSlug: string }>;
}

export default async function PersonsPage({ params }: PageProps) {
  const { projectSlug } = await params;

  return (
    <div className="space-y-6">
      <div className="border-b border-zinc-800/60 pb-5">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-100">Persons</h1>
        <p className="mt-1 text-xs text-zinc-400">
          User profiles and activity timelines for {projectSlug}.
        </p>
      </div>

      <Card className="border-zinc-800/80 bg-zinc-950">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-zinc-100">User Identification</CardTitle>
          <CardDescription className="text-xs text-zinc-400">
            User timeline inspection is scheduled for Plan 0005.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-zinc-800/80 rounded bg-zinc-900/20">
            <p className="text-xs font-medium text-zinc-400">User identification module ready</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
