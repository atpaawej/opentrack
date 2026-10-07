'use client';

import * as React from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { BreakdownItem } from '../types';

interface BreakdownPanelsProps {
  breakdowns: {
    events: BreakdownItem[];
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

function BreakdownList({ items, unit = 'events', empty }: { items: BreakdownItem[]; unit?: string; empty: string }) {
  if (items.length === 0) return <p className="py-12 text-center text-sm text-muted">{empty}</p>;
  return (
    <ol className="divide-y divide-edge/40">
      {items.map((item) => (
        <li key={item.name} className="flex items-center gap-3 py-2.5 text-sm">
          <span className="min-w-0 flex-1 truncate text-foreground" title={item.name}>{item.name}</span>
          <span className="shrink-0 tabular-nums text-foreground" aria-label={`${item.value.toLocaleString()} ${unit}`}>{item.value.toLocaleString()}</span>
          <span className="w-12 shrink-0 text-right tabular-nums text-muted">{item.percentage}%</span>
        </li>
      ))}
    </ol>
  );
}

export function BreakdownPanels({ breakdowns, className }: BreakdownPanelsProps) {
  const pages = breakdowns.pages.slice(0, 7);
  return (
    <div className={cn('grid gap-4 lg:grid-cols-[1.25fr_1fr]', className)}>
      <section className="min-w-0 rounded-2xl border border-edge/60 bg-surface p-4 sm:p-5" aria-labelledby="top-pages-heading">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2 id="top-pages-heading" className="text-base font-semibold text-foreground">Top pages</h2>
            <p className="mt-1 text-xs text-muted">Pageviews by path</p>
          </div>
          <span className="shrink-0 text-xs text-muted">Share of all pageviews</span>
        </div>
        {pages.length ? (
          <>
            <div className="mt-5 h-[235px] min-w-0" role="img" aria-label="Pageviews for the top pages. Exact values are listed below.">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart accessibilityLayer data={pages} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid horizontal={false} stroke="var(--edge, #33515A)" strokeOpacity={0.4} />
                  <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted, #B3C6C8)', fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={96} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted, #B3C6C8)', fontSize: 11 }} tickFormatter={(value: string) => value.length > 15 ? `${value.slice(0, 14)}…` : value} />
                  <Tooltip formatter={(value) => [Number(value ?? 0).toLocaleString(), 'Pageviews']} contentStyle={{ background: 'var(--surface, #16262D)', border: '1px solid var(--edge, #33515A)', color: 'var(--foreground, #F0F5F3)', borderRadius: 10 }} />
                  <Bar dataKey="value" fill="var(--chart-2, #A2B9EE)" radius={[0, 4, 4, 0]} maxBarSize={16} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <BreakdownList items={pages} unit="pageviews" empty="No pageviews yet." />
          </>
        ) : <p className="py-20 text-center text-sm text-muted">No pageviews in this period. Try a longer date range.</p>}
      </section>

      <section className="min-w-0 rounded-2xl border border-edge/60 bg-surface p-4 sm:p-5" aria-labelledby="context-heading">
        <h2 id="context-heading" className="text-base font-semibold text-foreground">What people did</h2>
        <p className="mt-1 text-xs text-muted">Captured app events and traffic context</p>
        <Tabs defaultValue="events" className="mt-4">
          <div className="overflow-x-auto pb-1"><TabsList className="h-auto max-w-full justify-start whitespace-nowrap">
            <TabsTrigger value="events">App events</TabsTrigger>
            <TabsTrigger value="referrers">Referrers</TabsTrigger>
            <TabsTrigger value="utm">Campaigns</TabsTrigger>
            <TabsTrigger value="countries">Countries</TabsTrigger>
            <TabsTrigger value="devices">Devices</TabsTrigger>
            <TabsTrigger value="browsers">Browsers</TabsTrigger>
          </TabsList></div>
          <TabsContent value="events"><BreakdownList items={breakdowns.events} empty="Only automatic events so far. Capture a signup or feature action in your app to see it here." /></TabsContent>
          <TabsContent value="referrers"><p className="mt-3 text-xs text-muted">Event context, not first-touch acquisition.</p><BreakdownList items={breakdowns.referrers} empty="No referrer context recorded yet." /></TabsContent>
          <TabsContent value="utm"><BreakdownList items={breakdowns.utm} empty="No campaign tags recorded yet." /></TabsContent>
          <TabsContent value="countries"><BreakdownList items={breakdowns.countries} empty="No location data was provided for these events." /></TabsContent>
          <TabsContent value="devices"><BreakdownList items={breakdowns.devices} empty="No device information recorded yet." /></TabsContent>
          <TabsContent value="browsers"><BreakdownList items={breakdowns.browsers} empty="No browser information recorded yet." /></TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
