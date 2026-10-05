'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Copy, Globe, Key, Shield } from 'lucide-react';
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
      setTimeout(() => setCopiedKey(false), 2000);
      toast.success('API key copied to clipboard');
    } catch {
      toast.error('Failed to copy to clipboard');
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
        toast.success('Allowed domains updated successfully');
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* API Key Card */}
      <Card className="border-zinc-800/80 bg-zinc-950/40">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-emerald-400" />
            <CardTitle>API Credentials</CardTitle>
          </div>
          <CardDescription>
            Use this write-only publishable key in your website tracker or SDK client.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            API Key
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900/90 px-3.5 py-2 font-mono text-xs text-emerald-400 selection:bg-zinc-800 truncate">
              {project.apiKey}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyKey}
              className="gap-1.5 border-zinc-800 active:scale-[0.96]"
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
        </CardContent>
      </Card>

      {/* Allowed Domains Card */}
      <Card className="border-zinc-800/80 bg-zinc-950/40">
        <form onSubmit={handleSaveDomains}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-emerald-400" />
              <CardTitle>CORS & Ingestion Security</CardTitle>
            </div>
            <CardDescription>
              Restrict which website domains are authorized to submit telemetry with this project key. Leave blank to allow all origins.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label
              htmlFor="domains-input"
              className="text-xs font-semibold text-zinc-400 uppercase tracking-wider"
            >
              Allowed Origins (Comma separated)
            </label>
            <input
              id="domains-input"
              type="text"
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
              placeholder="e.g. localhost, myapp.com, *.myapp.com"
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors"
            />
          </CardContent>
          <CardFooter className="border-t border-zinc-800/60 pt-4 flex justify-end">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving Changes...' : 'Save Settings'}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Project Metadata Card */}
      <Card className="border-zinc-800/80 bg-zinc-950/40">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-zinc-400" />
            <CardTitle>Metadata</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-zinc-400">
          <div className="flex justify-between py-1 border-b border-zinc-800/50">
            <span>Project Slug</span>
            <span className="font-mono text-zinc-200">{project.slug}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-zinc-800/50">
            <span>Created At</span>
            <span className="text-zinc-200">{new Date(project.createdAt).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between py-1">
            <span>Ownership</span>
            <span className="text-zinc-200">
              {project.clerkOrgId ? `Organization (${project.clerkOrgId})` : 'Personal User'}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
