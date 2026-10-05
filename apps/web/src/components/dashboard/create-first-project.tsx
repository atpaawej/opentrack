'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createProjectAction } from '@/features/projects/actions';
import { toast } from 'sonner';

export function CreateFirstProject() {
  const router = useRouter();
  const [name, setName] = React.useState('');
  const [domains, setDomains] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Project name is required');
      return;
    }

    setLoading(true);
    try {
      const allowedDomains = domains
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);

      const res = await createProjectAction({
        name: name.trim(),
        allowedDomains: allowedDomains.length > 0 ? allowedDomains : undefined,
      });

      if (!res.success || !res.project) {
        toast.error(res.error || 'Failed to create project');
        setLoading(false);
        return;
      }

      toast.success(`Project "${res.project.name}" created`);
      router.push(`/${res.project.slug}`);
    } catch {
      toast.error('Unexpected error creating project');
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-zinc-800 bg-[#0c0c0e]">
      <CardHeader className="pb-3 text-left">
        <CardTitle className="text-lg font-semibold text-zinc-100">
          Create first project
        </CardTitle>
        <CardDescription className="text-xs text-zinc-400">
          Each project receives an isolated write key and event pipeline.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5 text-left">
            <label htmlFor="pname" className="text-xs font-medium text-zinc-300">
              Project Name
            </label>
            <input
              id="pname"
              type="text"
              placeholder="e.g. My Next.js SaaS"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-0 transition-colors"
              autoFocus
            />
          </div>

          <div className="space-y-1.5 text-left">
            <label htmlFor="pdoms" className="text-xs font-medium text-zinc-300">
              Allowed Domains (Optional)
            </label>
            <input
              id="pdoms"
              type="text"
              placeholder="localhost, example.com"
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
              className="w-full rounded border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-0 transition-colors"
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full text-xs font-medium mt-2">
            {loading ? 'Setting up...' : 'Create Project'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
