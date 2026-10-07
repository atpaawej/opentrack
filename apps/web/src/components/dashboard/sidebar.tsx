'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Radio, Sparkles, GitMerge, Users, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  projectSlug: string;
}

const navigation = [
  { name: 'Overview', route: '', icon: BarChart3 },
  { name: 'Live events', route: '/live', icon: Radio },
  { name: 'Explore', route: '/insights', icon: Sparkles },
  { name: 'Funnels', route: '/funnels', icon: GitMerge },
  { name: 'People', route: '/persons', icon: Users },
  { name: 'Settings', route: '/settings', icon: Settings },
];

export function DashboardNavigation({ projectSlug, onNavigate }: SidebarProps & { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Project navigation" className="space-y-1">
      {navigation.map(({ name, route, icon: Icon }) => {
        const href = `/${projectSlug}${route}`;
        const isActive = route ? (pathname === href || pathname.startsWith(`${href}/`)) : pathname === href;

        return (
          <Link
            key={route}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            onClick={onNavigate}
            className={cn(
              'group flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 ease-ease-out-custom focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal active:bg-edge/40',
              isActive
                ? 'bg-surface text-foreground'
                : 'text-muted hover:bg-surface/70 hover:text-foreground'
            )}
          >
            <Icon aria-hidden="true" className={cn('h-4 w-4 shrink-0', isActive ? 'text-signal' : 'text-muted')} />
            <span>{name}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar({ projectSlug }: SidebarProps) {
  return (
    <aside className="hidden w-56 shrink-0 flex-col justify-between border-r border-edge/60 bg-background p-3 md:flex">
      <DashboardNavigation projectSlug={projectSlug} />
      <div className="px-3 py-2 text-xs text-muted">OpenTrack v0.1</div>
    </aside>
  );
}
