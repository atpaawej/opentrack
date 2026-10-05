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
  Key,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  projectSlug: string;
}

export function Sidebar({ projectSlug }: SidebarProps) {
  const pathname = usePathname();

  const navigation = [
    {
      name: 'Overview & Analytics',
      href: `/${projectSlug}`,
      icon: BarChart3,
      exact: true,
    },
    {
      name: 'Live Stream',
      href: `/${projectSlug}/live`,
      icon: Radio,
      badge: 'Live',
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
      name: 'Persons & Users',
      href: `/${projectSlug}/persons`,
      icon: Users,
    },
    {
      name: 'Settings & API Keys',
      href: `/${projectSlug}/settings`,
      icon: Settings,
    },
  ];

  return (
    <aside className="w-64 shrink-0 border-r border-zinc-800/80 bg-zinc-950/40 p-4 flex flex-col justify-between hidden md:flex">
      <div className="space-y-1">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Navigation
        </p>
        <nav className="space-y-1">
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
                  'group flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 active:scale-[0.98]',
                  isActive
                    ? 'bg-zinc-800/90 text-white shadow-sm ring-1 ring-zinc-700/50'
                    : 'text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200'
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={cn(
                      'h-4 w-4 transition-colors',
                      isActive
                        ? 'text-emerald-400'
                        : 'text-zinc-400 group-hover:text-zinc-300'
                    )}
                  />
                  <span>{item.name}</span>
                </div>

                {item.badge && (
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-950/60 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-800/40">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                    </span>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-3.5 space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-zinc-300">
          <Key className="h-3.5 w-3.5 text-emerald-400" />
          <span>Quick Setup</span>
        </div>
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          Embed the OpenTrack script or install the SDK to start streaming user interactions.
        </p>
      </div>
    </aside>
  );
}
