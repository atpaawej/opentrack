'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Radio,
  Sparkles,
  GitMerge,
  Users,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  projectSlug: string;
}

export function Sidebar({ projectSlug }: SidebarProps) {
  const pathname = usePathname();

  const navigation = [
    {
      name: 'Overview',
      href: `/${projectSlug}`,
      icon: BarChart3,
      exact: true,
    },
    {
      name: 'Live Stream',
      href: `/${projectSlug}/live`,
      icon: Radio,
    },
    {
      name: 'Insights',
      href: `/${projectSlug}/insights`,
      icon: Sparkles,
    },
    {
      name: 'Funnels',
      href: `/${projectSlug}/funnels`,
      icon: GitMerge,
    },
    {
      name: 'Persons',
      href: `/${projectSlug}/persons`,
      icon: Users,
    },
    {
      name: 'Settings',
      href: `/${projectSlug}/settings`,
      icon: Settings,
    },
  ];

  return (
    <aside className="w-56 shrink-0 border-r border-zinc-800/60 bg-[#09090b] p-3 flex flex-col justify-between hidden md:flex">
      <nav className="space-y-0.5">
        {navigation.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);

          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'group flex items-center gap-2.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors select-none active:scale-[0.98]',
                isActive
                  ? 'bg-zinc-900 text-zinc-100 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40'
              )}
            >
              <Icon
                className={cn(
                  'h-3.5 w-3.5 transition-colors',
                  isActive ? 'text-zinc-100' : 'text-zinc-500 group-hover:text-zinc-400'
                )}
              />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-2.5 py-2 text-[11px] text-zinc-500 font-mono">
        OpenTrack v0.1
      </div>
    </aside>
  );
}
