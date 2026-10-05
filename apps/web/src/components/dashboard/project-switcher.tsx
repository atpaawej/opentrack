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
            role="combobox"
            aria-expanded={open}
            className="flex items-center gap-2 rounded px-2 py-1 text-xs font-medium text-zinc-200 hover:text-white hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-colors cursor-pointer select-none active:scale-[0.98]"
          >
            <span className="max-w-[140px] truncate">{currentProject.name}</span>
            <ChevronsUpDown className="h-3 w-3 text-zinc-500 shrink-0" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-52">
          <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
            Projects
          </DropdownMenuLabel>
          {projects.map((project) => (
            <DropdownMenuItem
              key={project.id}
              onSelect={() => handleSelect(project.slug)}
              className="flex items-center justify-between text-xs py-1.5 cursor-pointer text-zinc-300 hover:text-white"
            >
              <span className="truncate">{project.name}</span>
              {project.id === currentProject.id && (
                <Check className="h-3.5 w-3.5 text-zinc-200 ml-2" />
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              setOpen(false);
              setDialogOpen(true);
            }}
            className="gap-2 text-xs text-zinc-400 hover:text-white cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 text-zinc-400" />
            <span>New project</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-zinc-100">
                New Project
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Create an isolated analytics workspace with a dedicated API key.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="project-name"
                  className="text-xs font-medium text-zinc-300"
                >
                  Name
                </label>
                <input
                  id="project-name"
                  type="text"
                  placeholder="e.g. Production App"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full rounded border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-0 transition-colors font-sans"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="project-domains"
                  className="text-xs font-medium text-zinc-300"
                >
                  Allowed Domains (Optional)
                </label>
                <input
                  id="project-domains"
                  type="text"
                  placeholder="localhost, example.com"
                  value={allowedDomains}
                  onChange={(e) => setAllowedDomains(e.target.value)}
                  className="w-full rounded border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-0 transition-colors font-mono text-[11px]"
                />
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
                {isSubmitting ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
