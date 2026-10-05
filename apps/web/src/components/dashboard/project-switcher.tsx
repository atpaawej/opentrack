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
import { Check, ChevronsUpDown, Plus, FolderKanban } from 'lucide-react';
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
      toast.error('Project name cannot be empty');
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

      toast.success(`Project "${res.project.name}" created!`);
      setDialogOpen(false);
      setProjectName('');
      setAllowedDomains('');
      router.push(`/${res.project.slug}`);
    } catch {
      toast.error('An unexpected error occurred while creating project');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            role="combobox"
            aria-expanded={open}
            aria-label="Select a project"
            className="w-56 justify-between border-zinc-800 bg-zinc-900/60 text-zinc-100 hover:bg-zinc-800/80 hover:text-white"
          >
            <div className="flex items-center gap-2 truncate">
              <FolderKanban className="h-4 w-4 shrink-0 text-emerald-400" />
              <span className="truncate font-medium">{currentProject.name}</span>
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel className="text-[11px] font-medium text-zinc-400">
            Projects
          </DropdownMenuLabel>
          {projects.map((project) => (
            <DropdownMenuItem
              key={project.id}
              onSelect={() => handleSelect(project.slug)}
              className="flex items-center justify-between py-2 cursor-pointer"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="truncate text-zinc-200">{project.name}</span>
              </div>
              {project.id === currentProject.id && (
                <Check className="h-4 w-4 text-emerald-400 ml-auto" />
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              setOpen(false);
              setDialogOpen(true);
            }}
            className="gap-2 text-zinc-200 cursor-pointer font-medium hover:text-white"
          >
            <Plus className="h-4 w-4 text-emerald-400" />
            <span>Create Project</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Create new project</DialogTitle>
              <DialogDescription>
                Add a new project to start tracking web analytics, funnels, and live events.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label
                  htmlFor="project-name"
                  className="text-xs font-medium text-zinc-300"
                >
                  Project Name
                </label>
                <input
                  id="project-name"
                  type="text"
                  placeholder="e.g. Acme Production"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="project-domains"
                  className="text-xs font-medium text-zinc-300"
                >
                  Allowed Domains (Optional, comma-separated)
                </label>
                <input
                  id="project-domains"
                  type="text"
                  placeholder="localhost, acme.com"
                  value={allowedDomains}
                  onChange={(e) => setAllowedDomains(e.target.value)}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-colors"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Project'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
