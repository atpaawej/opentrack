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
      <div className="flex items-center justify-between border-b border-zinc-800/60 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
              Live Stream
            </h1>
            <Badge variant="outline">SSE Channel</Badge>
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            Real-time telemetry event pipeline for {projectSlug}.
          </p>
        </div>
      </div>

      <Card className="border-zinc-800/80 bg-zinc-950">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-zinc-100">
            Live Ingestion Stream
          </CardTitle>
          <CardDescription className="text-xs text-zinc-400">
            Real-time event inspector will render here in Plan 0003.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-zinc-800/80 rounded bg-zinc-900/20">
            <Radio className="h-5 w-5 text-zinc-400 mb-2" />
            <p className="text-xs font-medium text-zinc-300">
              Listening for events
            </p>
            <p className="text-[11px] text-zinc-500 mt-1 max-w-sm">
              Incoming telemetry to <code className="text-zinc-400 font-mono">/api/v1/capture</code> will stream live.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
