'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FolderPlus, Sparkles } from 'lucide-react';
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

      toast.success(`Project "${res.project.name}" ready!`);
      router.push(`/${res.project.slug}`);
    } catch {
      toast.error('Unexpected error creating project');
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-lg border-zinc-800/90 bg-zinc-950/70 shadow-2xl backdrop-blur-md">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400">
          <FolderPlus className="h-6 w-6" />
        </div>
        <CardTitle className="text-xl font-bold">Create your first project</CardTitle>
        <CardDescription>
          Every project gets an isolated API key, custom CORS domains, and live event pipeline.
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
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors"
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
              placeholder="e.g. localhost, myapp.com"
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors"
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full gap-2 mt-2">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            <span>{loading ? 'Setting up workspace...' : 'Initialize Project'}</span>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
