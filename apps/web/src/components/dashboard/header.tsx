'use client';

import * as React from 'react';
import Link from 'next/link';
import { UserButton, OrganizationSwitcher } from '@clerk/nextjs';
import { ProjectSwitcher } from './project-switcher';
import { Activity, ExternalLink, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Project } from '@/lib/db/schema';

interface HeaderProps {
  currentProject: Project;
  projects: Project[];
}

export function Header({ currentProject, projects }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-zinc-100 hover:text-white transition-colors"
          >
            <div className="h-8 w-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-100 shadow-sm">
              <Activity className="h-4 w-4 text-emerald-400" />
            </div>
            <span className="font-semibold text-sm tracking-tight hidden md:inline-block">
              OpenTrack
            </span>
          </Link>

          <div className="h-4 w-px bg-zinc-800 hidden sm:block" />

          <ProjectSwitcher
            currentProject={currentProject}
            projects={projects}
          />
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-xs text-zinc-400 hover:text-zinc-200 hidden sm:flex items-center gap-1.5"
          >
            <a
              href="https://github.com/OpenTrack"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>Docs</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            asChild
            className="h-8 w-8 text-zinc-400 hover:text-zinc-100"
          >
            <Link href={`/${currentProject.slug}/settings`} title="Project Settings">
              <Settings className="h-4 w-4" />
            </Link>
          </Button>

          <div className="h-4 w-px bg-zinc-800" />

          <div className="flex items-center gap-2">
            <OrganizationSwitcher
              appearance={{
                elements: {
                  rootBox: 'flex items-center',
                  organizationSwitcherTrigger:
                    'px-2 py-1 text-xs text-zinc-300 hover:text-white rounded-md hover:bg-zinc-900 border border-zinc-800/60',
                },
              }}
            />
            <UserButton
              appearance={{
                elements: {
                  avatarBox: 'h-8 w-8 ring-1 ring-zinc-800 hover:ring-zinc-700 transition-all',
                },
              }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
