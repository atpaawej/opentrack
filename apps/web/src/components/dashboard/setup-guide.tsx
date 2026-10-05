'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Copy, Terminal, Code2, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
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
  autoCapture: true, // tracks pageviews & clicks automatically
});`;

  // Copy helper with feedback
  const handleCopy = async (text: string, type: 'key' | 'code') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'key') {
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
        toast.success('API key copied to clipboard');
      } else {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
        toast.success('Code snippet copied to clipboard');
      }
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  // Poll for first event if none received yet
  React.useEffect(() => {
    if (hasEvents) return;

    const interval = setInterval(async () => {
      setIsChecking(true);
      try {
        const res = await checkProjectEventsAction(project.id);
        if (res.hasEvents) {
          setHasEvents(true);
          toast.success('First event received! 🎉', {
            description: 'OpenTrack has successfully captured telemetry from your application.',
          });
        }
      } catch {
        // silent retry
      } finally {
        setIsChecking(false);
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [hasEvents, project.id]);

  if (hasEvents) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm animate-in fade-in-50 duration-300">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h4 className="font-semibold text-zinc-100 flex items-center gap-2">
              Ingestion Active & Connected
              <Badge variant="live">Live</Badge>
            </h4>
            <p className="text-sm text-zinc-400">
              Events are streaming smoothly into project <span className="font-mono text-zinc-300 font-semibold">{project.name}</span>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleCopy(project.apiKey, 'key')}
            className="text-xs border-zinc-800"
          >
            {copiedKey ? (
              <Check className="h-3.5 w-3.5 text-emerald-400 mr-1.5" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-zinc-400 mr-1.5" />
            )}
            Copy API Key
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card className="border-zinc-800/90 bg-zinc-950/60 shadow-xl overflow-hidden relative">
      {/* Decorative top border highlight */}
      <div className="h-0.5 w-full bg-gradient-to-r from-emerald-500/0 via-emerald-500/60 to-emerald-500/0" />

      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2.5">
              <span>Set up tracking for {project.name}</span>
              <Sparkles className="h-4 w-4 text-emerald-400" />
            </CardTitle>
            <CardDescription className="mt-1 text-sm text-zinc-400">
              Embed one snippet to begin collecting page views, custom events, and user funnels.
            </CardDescription>
          </div>

          {/* Live listening pulse badge */}
          <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 shadow-inner">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs font-medium text-zinc-300">
              {isChecking ? 'Checking events...' : 'Listening for your first event...'}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Project API Key row */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Publishable API Key
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900/90 px-3.5 py-2 font-mono text-xs text-emerald-400 selection:bg-zinc-800">
              {project.apiKey}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy(project.apiKey, 'key')}
              className="shrink-0 gap-1.5 border-zinc-800 active:scale-[0.96]"
            >
              {copiedKey ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 text-zinc-400" />
                  <span>Copy</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Tab selection for installation */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-2">
            <button
              onClick={() => setActiveTab('html')}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 active:scale-[0.97] ${
                activeTab === 'html'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              <Code2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>HTML Script Tag (No build step)</span>
            </button>

            <button
              onClick={() => setActiveTab('npm')}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 active:scale-[0.97] ${
                activeTab === 'npm'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              <Terminal className="h-3.5 w-3.5 text-emerald-400" />
              <span>React / Next.js / npm</span>
            </button>
          </div>

          {activeTab === 'html' ? (
            <div className="space-y-3">
              <p className="text-xs text-zinc-400">
                Paste this snippet in the <code className="text-zinc-200">&lt;head&gt;</code> of your website or web application:
              </p>
              <div className="relative group">
                <pre className="overflow-x-auto rounded-lg border border-zinc-800/90 bg-zinc-950 p-4 font-mono text-xs text-zinc-200 leading-relaxed">
                  <code>{htmlSnippet}</code>
                </pre>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleCopy(htmlSnippet, 'code')}
                  className="absolute right-3 top-3 h-7 gap-1 px-2.5 text-xs bg-zinc-800/90 hover:bg-zinc-700 active:scale-[0.95]"
                >
                  {copiedCode ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-zinc-400" />
                      <span>Copy Snippet</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-zinc-400">
                1. Install the SDK package:
              </p>
              <div className="relative group">
                <pre className="overflow-x-auto rounded-lg border border-zinc-800/90 bg-zinc-950 p-3 font-mono text-xs text-zinc-200">
                  <code>{npmInstallCode}</code>
                </pre>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleCopy(npmInstallCode, 'code')}
                  className="absolute right-2.5 top-2.5 h-6 gap-1 px-2 text-[11px] bg-zinc-800/90 hover:bg-zinc-700 active:scale-[0.95]"
                >
                  <Copy className="h-3 w-3 text-zinc-400" />
                  <span>Copy</span>
                </Button>
              </div>

              <p className="text-xs text-zinc-400 pt-2">
                2. Initialize in your root layout or entrypoint:
              </p>
              <div className="relative group">
                <pre className="overflow-x-auto rounded-lg border border-zinc-800/90 bg-zinc-950 p-4 font-mono text-xs text-zinc-200 leading-relaxed">
                  <code>{npmInitCode}</code>
                </pre>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleCopy(npmInitCode, 'code')}
                  className="absolute right-3 top-3 h-7 gap-1 px-2.5 text-xs bg-zinc-800/90 hover:bg-zinc-700 active:scale-[0.95]"
                >
                  {copiedCode ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
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
          )}
        </div>
      </CardContent>
    </Card>
  );
}
