'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createProjectAction } from '@/features/projects/actions';
import { toast } from 'sonner';

export function CreateFirstProject() {
  const router = useRouter();
  const [name, setName] = React.useState('');
  const [domains, setDomains] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      toast.error('Enter a project name');
      return;
    }

    setLoading(true);
    try {
      const allowedDomains = domains.split(',').map((domain) => domain.trim()).filter(Boolean);
      const result = await createProjectAction({
        name: name.trim(),
        allowedDomains: allowedDomains.length ? allowedDomains : undefined,
      });
      if (!result.success || !result.project) {
        toast.error(result.error || 'Could not create project. Try again.');
        return;
      }
      toast.success(`Project "${result.project.name}" created`);
      router.push(`/${result.project.slug}`);
    } catch {
      toast.error('Could not create project. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">Create your first project</CardTitle>
        <CardDescription>Connect an app to start seeing visits. You can add custom events later.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="project-name" className="text-sm font-medium text-foreground">Project name</label>
            <Input id="project-name" name="project-name" autoComplete="off" required value={name} onChange={(event) => setName(event.target.value)} placeholder="My app" autoFocus />
          </div>
          <div className="space-y-2">
            <label htmlFor="project-domains" className="text-sm font-medium text-foreground">Allowed domains <span className="font-normal text-muted">(optional)</span></label>
            <Input id="project-domains" name="project-domains" value={domains} onChange={(event) => setDomains(event.target.value)} placeholder="localhost, example.com" aria-describedby="project-domains-help" />
            <p id="project-domains-help" className="text-xs text-muted">Separate domains with commas. Leave blank to allow all origins.</p>
          </div>
          <Button type="submit" disabled={loading} className="w-full">{loading ? 'Creating project…' : 'Create project'}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
