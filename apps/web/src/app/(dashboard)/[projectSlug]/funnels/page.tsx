import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GitMerge } from 'lucide-react';

interface PageProps {
  params: Promise<{ projectSlug: string }>;
}

export default async function FunnelsPage({ params }: PageProps) {
  const { projectSlug } = await params;

  return (
    <div className="space-y-6">
      <div className="border-b border-zinc-800/80 pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white">Conversion Funnels</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Drop-off analysis and step-by-step conversion for {projectSlug}.
        </p>
      </div>

      <Card className="border-zinc-800/80 bg-zinc-950/40">
        <CardHeader>
          <div className="flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-emerald-400" />
            <CardTitle>Conversion Funnels</CardTitle>
          </div>
          <CardDescription>
            Multi-step funnel visualization and drop-off analysis are scheduled for Plan 0005.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-zinc-800/80 rounded-xl bg-zinc-900/20">
            <p className="text-sm font-medium text-zinc-300">Funnels Engine Initialized</p>
            <p className="text-xs text-zinc-500 mt-1">Multi-step user path calculations will render here.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
