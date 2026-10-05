'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { checkProjectEventsAction } from '@/features/projects/actions';
import type { Project } from '@/lib/db/schema';

interface SetupGuideProps {
  project: Project;
  initialHasEvents: boolean;
}

export function SetupGuide({ project, initialHasEvents }: SetupGuideProps) {
  const [activeTab, setActiveTab] = React.useState<'html' | 'npm'>('html');
  const [copiedKey, setCopiedKey] = React.useState(false);
  const [copiedCode, setCopiedCode] = React.useState(false);
  const [hasEvents, setHasEvents] = React.useState(initialHasEvents);
  const [isChecking, setIsChecking] = React.useState(false);

  const htmlSnippet = `<script
  defer
  data-api-key="${project.apiKey}"
  src="https://cdn.opentrack.dev/v1/tracker.js"
></script>`;

  const npmInstallCode = `npm install @opentrack/web`;

  const npmInitCode = `import { init } from '@opentrack/web';

init({
  apiKey: '${project.apiKey}',
  autoCapture: true,
});`;

  const handleCopy = async (text: string, type: 'key' | 'code') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'key') {
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 1800);
        toast.success('API key copied');
      } else {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 1800);
        toast.success('Snippet copied');
      }
    } catch {
      toast.error('Failed to copy');
    }
  };

  React.useEffect(() => {
    if (hasEvents) return;

    const interval = setInterval(async () => {
      setIsChecking(true);
      try {
        const res = await checkProjectEventsAction(project.id);
        if (res.hasEvents) {
          setHasEvents(true);
          toast.success('First event received');
        }
      } catch {
        // silent retry
      } finally {
        setIsChecking(false);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [hasEvents, project.id]);

  if (hasEvents) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-100">
              Ingestion Active
            </span>
            <Badge variant="default">Connected</Badge>
          </div>
          <p className="text-xs text-zinc-400">
            OpenTrack is capturing events for project <span className="font-mono text-zinc-200">{project.name}</span>.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => handleCopy(project.apiKey, 'key')}
          className="text-xs border-zinc-800 text-zinc-300 hover:text-white"
        >
          {copiedKey ? (
            <Check className="h-3.5 w-3.5 text-zinc-200 mr-1.5" />
          ) : (
            <Copy className="h-3.5 w-3.5 text-zinc-400 mr-1.5" />
          )}
          Copy API Key
        </Button>
      </div>
    );
  }

  return (
    <Card className="border-zinc-800/80 bg-zinc-950">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-semibold text-zinc-100">
              Install tracking
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400 mt-1">
              Embed one snippet to collect page views, clicks, and custom telemetry.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900/60 px-2.5 py-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zinc-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-zinc-300" />
            </span>
            <span className="text-[11px] font-mono text-zinc-400">
              {isChecking ? 'Checking...' : 'Awaiting first event'}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Project API Key row */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
            API Key
          </span>
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 font-mono text-xs text-zinc-200 selection:bg-zinc-800 truncate">
              {project.apiKey}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy(project.apiKey, 'key')}
              className="shrink-0 gap-1.5 text-xs border-zinc-800 text-zinc-300 hover:text-white"
            >
              {copiedKey ? (
                <>
                  <Check className="h-3.5 w-3.5 text-zinc-200" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-zinc-400" />
                  <span>Copy</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Tab selection for installation */}
        <div className="space-y-3 pt-1">
          <div className="inline-flex rounded border border-zinc-800 bg-zinc-900/50 p-0.5">
            <button
              onClick={() => setActiveTab('html')}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                activeTab === 'html'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              HTML Script
            </button>
            <button
              onClick={() => setActiveTab('npm')}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                activeTab === 'npm'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              React / Next.js SDK
            </button>
          </div>

          {activeTab === 'html' ? (
            <div className="space-y-2">
              <p className="text-xs text-zinc-400">
                Include in your document head:
              </p>
              <div className="relative group">
                <pre className="overflow-x-auto rounded border border-zinc-800/80 bg-zinc-900/30 p-3.5 font-mono text-xs text-zinc-200 leading-relaxed">
                  <code>{htmlSnippet}</code>
                </pre>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(htmlSnippet, 'code')}
                  className="absolute right-2.5 top-2.5 h-7 px-2 text-xs border-zinc-800 bg-zinc-900/90 text-zinc-300 hover:text-white"
                >
                  {copiedCode ? (
                    <Check className="h-3.5 w-3.5 text-zinc-200" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-zinc-400" />
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <span className="text-[11px] text-zinc-400">1. Install package</span>
                <div className="relative">
                  <pre className="overflow-x-auto rounded border border-zinc-800/80 bg-zinc-900/30 p-2.5 font-mono text-xs text-zinc-200">
                    <code>{npmInstallCode}</code>
                  </pre>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(npmInstallCode, 'code')}
                    className="absolute right-2 top-2 h-6 px-2 text-[11px] border-zinc-800 bg-zinc-900/90 text-zinc-300 hover:text-white"
                  >
                    <Copy className="h-3 w-3 text-zinc-400" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] text-zinc-400">2. Initialize tracker</span>
                <div className="relative">
                  <pre className="overflow-x-auto rounded border border-zinc-800/80 bg-zinc-900/30 p-3 font-mono text-xs text-zinc-200 leading-relaxed">
                    <code>{npmInitCode}</code>
                  </pre>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(npmInitCode, 'code')}
                    className="absolute right-2 top-2 h-7 px-2 text-xs border-zinc-800 bg-zinc-900/90 text-zinc-300 hover:text-white"
                  >
                    {copiedCode ? (
                      <Check className="h-3.5 w-3.5 text-zinc-200" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-zinc-400" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
