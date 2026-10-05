'use client';

import * as React from 'react';
import {
  FileText,
  Compass,
  Megaphone,
  Globe,
  Laptop,
  Smartphone,
  Tablet,
  Monitor,
  ExternalLink,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { BreakdownItem } from '../types';

interface BreakdownPanelsProps {
  breakdowns: {
    pages: BreakdownItem[];
    referrers: BreakdownItem[];
    utm: BreakdownItem[];
    countries: BreakdownItem[];
    browsers: BreakdownItem[];
    os: BreakdownItem[];
    devices: BreakdownItem[];
  };
  className?: string;
}

function getCountryFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2 || countryCode.toLowerCase() === 'unknown') {
    return '🌐';
  }
  try {
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  } catch {
    return '🌐';
  }
}

function BrowserIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" />
      <line x1="21.17" y1="8" x2="12" y2="8" />
      <line x1="3.95" y1="6.06" x2="8.54" y2="14" />
      <line x1="10.88" y1="21.94" x2="15.46" y2="14" />
    </svg>
  );
}

function getBrowserIcon(browserName: string) {
  return BrowserIcon;
}

function getDeviceIcon(deviceType: string) {
  const d = deviceType.toLowerCase();
  if (d.includes('mobile') || d.includes('phone')) return Smartphone;
  if (d.includes('tablet')) return Tablet;
  return Monitor;
}

interface BreakdownListProps {
  items: BreakdownItem[];
  emptyMessage: string;
  renderIcon?: (item: BreakdownItem) => React.ReactNode;
}

function BreakdownList({ items, emptyMessage, renderIcon }: BreakdownListProps) {
  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-zinc-500 text-xs">
        {emptyMessage}
      </div>
    );
  }

  const highestValue = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="space-y-1.5 font-mono text-xs">
      {items.map((item, idx) => {
        const relativeShare = Math.round((item.value / highestValue) * 100);

        return (
          <div
            key={`${item.name}-${idx}`}
            className="group relative flex items-center justify-between rounded-md p-2 overflow-hidden hover:bg-zinc-900/50 transition-colors"
          >
            {/* Visual Progress Bar Behind Content */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-zinc-800/40 rounded-md transition-all duration-500 group-hover:bg-zinc-800/60"
              style={{ width: `${relativeShare}%` }}
            />

            {/* Left Content */}
            <div className="relative z-10 flex items-center gap-2.5 min-w-0 pr-2">
              <span className="text-zinc-600 text-[11px] w-4 text-right shrink-0">
                {idx + 1}
              </span>
              {renderIcon && (
                <div className="shrink-0 flex items-center justify-center">
                  {renderIcon(item)}
                </div>
              )}
              <span
                className="truncate text-zinc-300 font-sans text-xs group-hover:text-zinc-100"
                title={item.name}
              >
                {item.name}
              </span>
            </div>

            {/* Right Value & Percentage */}
            <div className="relative z-10 flex items-center gap-3 shrink-0">
              <span className="font-semibold text-zinc-200">
                {item.value.toLocaleString()}
              </span>
              <span className="text-[11px] text-zinc-500 w-10 text-right">
                {item.percentage}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function BreakdownPanels({ breakdowns, className }: BreakdownPanelsProps) {
  const [contentTab, setContentTab] = React.useState<'pages' | 'referrers' | 'utm'>('pages');
  const [techTab, setTechTab] = React.useState<'countries' | 'browsers' | 'os' | 'devices'>('countries');

  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-4', className)}>
      {/* Panel 1: Content & Referrers */}
      <Card className="border-zinc-850/80 bg-zinc-950/70 overflow-hidden">
        <CardHeader className="p-3 border-b border-zinc-850/60 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 bg-zinc-900/80 p-0.5 rounded-lg border border-zinc-800/80">
              <button
                type="button"
                onClick={() => setContentTab('pages')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                  contentTab === 'pages'
                    ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                )}
              >
                <FileText className="h-3.5 w-3.5" />
                Top Pages
              </button>

              <button
                type="button"
                onClick={() => setContentTab('referrers')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                  contentTab === 'referrers'
                    ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                )}
              >
                <Compass className="h-3.5 w-3.5" />
                Referrers
              </button>

              <button
                type="button"
                onClick={() => setContentTab('utm')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                  contentTab === 'utm'
                    ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                )}
              >
                <Megaphone className="h-3.5 w-3.5" />
                Campaigns
              </button>
            </div>

            <div className="text-[11px] text-zinc-500 font-mono pr-1">
              Top 10
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-3">
          {contentTab === 'pages' && (
            <BreakdownList
              items={breakdowns.pages}
              emptyMessage="No page views recorded in this period."
              renderIcon={() => (
                <FileText className="h-3.5 w-3.5 text-zinc-500" />
              )}
            />
          )}

          {contentTab === 'referrers' && (
            <BreakdownList
              items={breakdowns.referrers}
              emptyMessage="No referral sources detected in this period."
              renderIcon={(item) => (
                <Compass className="h-3.5 w-3.5 text-zinc-500" />
              )}
            />
          )}

          {contentTab === 'utm' && (
            <BreakdownList
              items={breakdowns.utm}
              emptyMessage="No UTM campaigns tracked in this period."
              renderIcon={() => (
                <Megaphone className="h-3.5 w-3.5 text-zinc-500" />
              )}
            />
          )}
        </CardContent>
      </Card>

      {/* Panel 2: Audience & Environment */}
      <Card className="border-zinc-850/80 bg-zinc-950/70 overflow-hidden">
        <CardHeader className="p-3 border-b border-zinc-850/60 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 bg-zinc-900/80 p-0.5 rounded-lg border border-zinc-800/80">
              <button
                type="button"
                onClick={() => setTechTab('countries')}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md transition-colors',
                  techTab === 'countries'
                    ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                )}
              >
                <Globe className="h-3.5 w-3.5" />
                Countries
              </button>

              <button
                type="button"
                onClick={() => setTechTab('browsers')}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md transition-colors',
                  techTab === 'browsers'
                    ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                )}
              >
                <BrowserIcon className="h-3.5 w-3.5" />
                Browsers
              </button>

              <button
                type="button"
                onClick={() => setTechTab('os')}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md transition-colors',
                  techTab === 'os'
                    ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                )}
              >
                <Laptop className="h-3.5 w-3.5" />
                OS
              </button>

              <button
                type="button"
                onClick={() => setTechTab('devices')}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md transition-colors',
                  techTab === 'devices'
                    ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                )}
              >
                <Monitor className="h-3.5 w-3.5" />
                Devices
              </button>
            </div>

            <div className="text-[11px] text-zinc-500 font-mono pr-1">
              Top 10
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-3">
          {techTab === 'countries' && (
            <BreakdownList
              items={breakdowns.countries}
              emptyMessage="No country locations recorded in this period."
              renderIcon={(item) => (
                <span className="text-base leading-none select-none">
                  {getCountryFlag(item.name)}
                </span>
              )}
            />
          )}

          {techTab === 'browsers' && (
            <BreakdownList
              items={breakdowns.browsers}
              emptyMessage="No browser records available."
              renderIcon={(item) => {
                const Icon = getBrowserIcon(item.name);
                return <Icon className="h-3.5 w-3.5 text-zinc-400" />;
              }}
            />
          )}

          {techTab === 'os' && (
            <BreakdownList
              items={breakdowns.os}
              emptyMessage="No operating system records available."
              renderIcon={() => (
                <Laptop className="h-3.5 w-3.5 text-zinc-400" />
              )}
            />
          )}

          {techTab === 'devices' && (
            <BreakdownList
              items={breakdowns.devices}
              emptyMessage="No device records available."
              renderIcon={(item) => {
                const Icon = getDeviceIcon(item.name);
                return <Icon className="h-3.5 w-3.5 text-zinc-400" />;
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
