'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { createProjectAction } from '@/features/projects/actions';
import { toast } from 'sonner';
import type { Project } from '@/lib/db/schema';

interface ProjectSwitcherProps {
  currentProject: Project;
  projects: Project[];
}

export function ProjectSwitcher({ currentProject, projects }: ProjectSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [projectName, setProjectName] = React.useState('');
  const [allowedDomains, setAllowedDomains] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSelect = (slug: string) => {
    setOpen(false);
    if (slug !== currentProject.slug) {
      router.push(`/${slug}`);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) {
      toast.error('Project name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const domains = allowedDomains
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);

      const res = await createProjectAction({
        name: projectName.trim(),
        allowedDomains: domains.length > 0 ? domains : undefined,
      });

      if (!res.success || !res.project) {
        toast.error(res.error || 'Failed to create project');
        setIsSubmitting(false);
        return;
      }

      toast.success(`Project "${res.project.name}" created`);
      setDialogOpen(false);
      setProjectName('');
      setAllowedDomains('');
      router.push(`/${res.project.slug}`);
    } catch {
      toast.error('Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Switch project, current: ${currentProject.name}`}
            aria-expanded={open}
            className="flex min-h-9 items-center gap-2 rounded-md border border-transparent px-2 py-1 text-sm font-medium text-foreground hover:border-edge hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            <span className="max-w-[110px] truncate sm:max-w-[170px]">{currentProject.name}</span>
            <ChevronsUpDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-52">
          <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-wider text-muted">
            Projects
          </DropdownMenuLabel>
          {projects.map((project) => (
            <DropdownMenuItem
              key={project.id}
              onSelect={() => handleSelect(project.slug)}
              className="flex items-center justify-between text-xs py-1.5 cursor-pointer text-foreground hover:text-white"
            >
              <span className="truncate">{project.name}</span>
              {project.id === currentProject.id && (
                <Check className="h-3.5 w-3.5 text-foreground ml-2" />
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              setOpen(false);
              setDialogOpen(true);
            }}
            className="gap-2 text-xs text-muted hover:text-white cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 text-muted" />
            <span>New project</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md bg-surface border-edge">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-foreground">
                New Project
              </DialogTitle>
              <DialogDescription className="text-xs text-muted">
                Create an isolated analytics workspace with a dedicated API key.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="project-name"
                  className="text-xs font-medium text-foreground"
                >
                  Name
                </label>
                <Input
                  id="project-name"
                  required
                  placeholder="My app"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="project-domains"
                  className="text-xs font-medium text-foreground"
                >
                  Allowed Domains (Optional)
                </label>
                <Input
                  id="project-domains"
                  placeholder="localhost, example.com"
                  value={allowedDomains}
                  onChange={(e) => setAllowedDomains(e.target.value)}
                  aria-describedby="project-domains-help"
                />
                <p id="project-domains-help" className="text-xs text-muted">Separate domains with commas. Leave blank to allow all origins.</p>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDialogOpen(false)}
                disabled={isSubmitting}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting} className="text-xs font-medium">
                {isSubmitting ? 'Creating project…' : 'Create project'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
