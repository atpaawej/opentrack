'use client';

import * as React from 'react';
import Link from 'next/link';
import { UserButton, OrganizationSwitcher } from '@clerk/nextjs';
import { ProjectSwitcher } from './project-switcher';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Project } from '@/lib/db/schema';

interface HeaderProps {
  currentProject: Project;
  projects: Project[];
}

export function Header({ currentProject, projects }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800/60 bg-[#09090b]/90 backdrop-blur-md">
      <div className="flex h-12 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-zinc-100 hover:text-white transition-opacity group"
          >
            {/* Geometric minimal OpenTrack logomark */}
            <div className="h-6 w-6 rounded bg-zinc-100 text-zinc-950 flex items-center justify-center font-mono font-bold text-xs">
              OT
            </div>
            <span className="font-semibold text-sm tracking-tight hidden sm:inline-block">
              OpenTrack
            </span>
          </Link>

          <span className="text-zinc-700 text-sm hidden sm:inline select-none">/</span>

          <ProjectSwitcher
            currentProject={currentProject}
            projects={projects}
          />
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="h-8 w-8 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-850"
          >
            <Link href={`/${currentProject.slug}/settings`} title="Project Settings">
              <Settings className="h-3.5 w-3.5" />
            </Link>
          </Button>

          <div className="h-3.5 w-px bg-zinc-800" />

          <div className="flex items-center gap-2.5">
            <OrganizationSwitcher
              appearance={{
                elements: {
                  rootBox: 'flex items-center',
                  organizationSwitcherTrigger:
                    'px-2 py-1 text-xs text-zinc-400 hover:text-zinc-100 rounded hover:bg-zinc-900 border border-zinc-800/80 transition-colors',
                },
              }}
            />
            <UserButton
              appearance={{
                elements: {
                  avatarBox: 'h-7 w-7 ring-1 ring-zinc-800 hover:ring-zinc-600 transition-all',
                },
              }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
