'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Copy } from 'lucide-react';
import { updateProjectDomainsAction } from '@/features/projects/actions';
import { toast } from 'sonner';
import type { Project } from '@/lib/db/schema';

interface SettingsFormProps {
  project: Project;
}

export function SettingsForm({ project }: SettingsFormProps) {
  const [domains, setDomains] = React.useState(
    project.allowedDomains ? project.allowedDomains.join(', ') : ''
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const [copiedKey, setCopiedKey] = React.useState(false);

  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(project.apiKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 1800);
      toast.success('API key copied');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleSaveDomains = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const parsedDomains = domains
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);

      const res = await updateProjectDomainsAction(project.slug, parsedDomains);
      if (!res.success) {
        toast.error(res.error || 'Failed to update domains');
      } else {
        toast.success('Allowed domains saved');
      }
    } catch {
      toast.error('Unexpected error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* API Key Card */}
      <Card className="border-zinc-800/80 bg-zinc-950">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-zinc-100">
            Publishable API Key
          </CardTitle>
          <CardDescription className="text-xs text-zinc-400">
            Client-side write-only key used by tracker scripts and SDKs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 font-mono text-xs text-zinc-200 truncate">
              {project.apiKey}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyKey}
              className="gap-1.5 text-xs border-zinc-800 text-zinc-300 hover:text-white"
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
        </CardContent>
      </Card>

      {/* Allowed Domains Card */}
      <Card className="border-zinc-800/80 bg-zinc-950">
        <form onSubmit={handleSaveDomains}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-zinc-100">
              Allowed Domains
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400">
              Limit telemetry ingestion to specific origins. Leave blank to accept events from any origin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <input
              id="domains-input"
              type="text"
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
              placeholder="e.g. localhost, app.example.com"
              className="w-full rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-0 transition-colors"
            />
          </CardContent>
          <CardFooter className="border-t border-zinc-800/60 pt-3 flex justify-end">
            <Button type="submit" size="sm" disabled={isSaving} className="text-xs font-medium">
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Project Metadata Card */}
      <Card className="border-zinc-800/80 bg-zinc-950">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-zinc-100">
            Project Metadata
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-zinc-400">
          <div className="flex justify-between py-1.5 border-b border-zinc-800/40">
            <span>Slug</span>
            <span className="font-mono text-zinc-200">{project.slug}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-zinc-800/40">
            <span>Created</span>
            <span className="text-zinc-200">{new Date(project.createdAt).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span>Scope</span>
            <span className="text-zinc-200">
              {project.clerkOrgId ? `Organization (${project.clerkOrgId})` : 'Personal Workspace'}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
