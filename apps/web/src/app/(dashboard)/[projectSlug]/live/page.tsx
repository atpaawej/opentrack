import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Radio } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PageProps {
  params: Promise<{ projectSlug: string }>;
}

export default async function LiveStreamPage({ params }: PageProps) {
  const { projectSlug } = await params;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Live Event Stream
            </h1>
            <Badge variant="live">Live Connection</Badge>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            Real-time SSE event pipeline for {projectSlug}.
          </p>
        </div>
      </div>

      <Card className="border-zinc-800/80 bg-zinc-950/40">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-emerald-400" />
            <CardTitle>Live Ingestion Stream</CardTitle>
          </div>
          <CardDescription>
            Live event logs and real-time inspector will stream here in Plan 0003.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-zinc-800/80 rounded-xl bg-zinc-900/20">
            <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
              <Radio className="h-6 w-6 text-emerald-400 animate-pulse" />
            </div>
            <p className="text-sm font-medium text-zinc-200">
              Ready for Live Streaming
            </p>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm">
              Events submitted to <code className="text-zinc-400">/api/v1/capture</code> with your project API key will stream in real-time.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
