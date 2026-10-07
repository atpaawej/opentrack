'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton, OrganizationSwitcher } from '@clerk/nextjs';
import { Menu, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { DashboardNavigation } from './sidebar';
import { ProjectSwitcher } from './project-switcher';
import type { Project } from '@/lib/db/schema';

interface HeaderProps {
  currentProject: Project;
  projects: Project[];
}

export function Header({ currentProject, projects }: HeaderProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <header className="dashboard-header sticky top-0 z-40 w-full border-b border-edge/60 bg-background/95 backdrop-blur-md">
      <div className="flex min-h-14 items-center justify-between gap-2 ~px-4/8">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link
            href="/"
            aria-label="OpenTrack home"
            className="flex min-h-10 shrink-0 items-center gap-2 rounded-md text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded bg-foreground font-mono text-xs font-semibold text-background" aria-hidden="true">OT</span>
            <span className="hidden font-semibold tracking-tight ~text-sm/base sm:inline">OpenTrack</span>
          </Link>
          <span aria-hidden="true" className="hidden text-muted sm:inline">/</span>
          <ProjectSwitcher currentProject={currentProject} projects={projects} />
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="icon" asChild className="hidden text-muted md:inline-flex" >
            <Link href={`/${currentProject.slug}/settings`} aria-label="Project settings">
              <Settings aria-hidden="true" className="h-4 w-4" />
            </Link>
          </Button>
          <div className="hidden h-5 w-px bg-edge md:block" aria-hidden="true" />
          <div className="hidden md:flex">
            <OrganizationSwitcher
              appearance={{ elements: {
                rootBox: 'flex items-center',
                organizationSwitcherTrigger: 'min-h-10 px-2 text-xs text-muted hover:text-foreground rounded hover:bg-surface border border-edge transition-colors',
              } }}
            />
          </div>
          <UserButton appearance={{ elements: { avatarBox: 'h-8 w-8 ring-1 ring-edge hover:ring-signal transition-colors' } }} />
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="ml-1 h-11 w-11 text-foreground md:hidden" aria-label="Open navigation">
                <Menu aria-hidden="true" className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[min(20rem,90vw)] p-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] md:hidden">
              <SheetHeader className="mb-5 text-left">
                <SheetTitle><span className="block max-w-[16rem] truncate ~text-lg/2xl">{currentProject.name}</span></SheetTitle>
                <SheetDescription>Project navigation</SheetDescription>
              </SheetHeader>
              <DashboardNavigation projectSlug={currentProject.slug} onNavigate={() => setMenuOpen(false)} />
              <div className="mt-auto border-t border-edge/60 pt-4">
                <p className="mb-2 text-xs text-muted">Organization</p>
                <OrganizationSwitcher appearance={{ elements: {
                  organizationSwitcherTrigger: 'min-h-10 rounded-md border border-edge px-3 text-sm text-foreground hover:bg-edge/40',
                } }} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
