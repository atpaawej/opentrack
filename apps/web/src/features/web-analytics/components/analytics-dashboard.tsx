'use client';

import * as React from 'react';
import Link from 'next/link';
import { CalendarDays, Check, ChevronDown, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TimeSeriesChart } from './time-series-chart';
import { BreakdownPanels } from './breakdown-panels';
import { fetchAnalyticsDataAction } from '../actions';
import type { AnalyticsDataPayload, DateRangeKey, Granularity } from '../types';
import type { Project } from '@/lib/db/schema';

interface AnalyticsDashboardProps {
  project: Project;
  initialData: AnalyticsDataPayload;
}

const DATE_RANGES: { key: DateRangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '24h', label: 'Last 24 hours' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' },
];

function formatWindow(from: string, to: string): string {
  const formatter = new Intl.DateTimeFormat('en', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
  return `${formatter.format(new Date(from))} – ${formatter.format(new Date(to))} UTC`;
}

export function AnalyticsDashboard({ project, initialData }: AnalyticsDashboardProps) {
  const [data, setData] = React.useState(initialData);
  const [dateRange, setDateRange] = React.useState<DateRangeKey>(initialData.dateRange);
  const [granularity, setGranularity] = React.useState<Granularity>(initialData.granularity);
  const [updating, setUpdating] = React.useState(false);
  const latestRequest = React.useRef(0);

  const load = async (range: DateRangeKey, interval: Granularity | undefined, manual = false) => {
    const request = ++latestRequest.current;
    setUpdating(true);
    try {
      const result = await fetchAnalyticsDataAction(project.id, range, interval);
      if (request !== latestRequest.current) return;
      if (!result.success) {
        toast.error(result.error || 'Could not load analytics. Try again.');
        return;
      }
      setData(result.data);
      setDateRange(range);
      setGranularity(result.data.granularity);
      if (manual) toast.success('Analytics updated');
    } catch {
      if (request === latestRequest.current) toast.error('Could not load analytics. Try again.');
    } finally {
      if (request === latestRequest.current) setUpdating(false);
    }
  };

  const selectedRange = DATE_RANGES.find(({ key }) => key === dateRange)?.label ?? 'Last 30 days';

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground ~sm/lg:~text-2xl/3xl">{project.name}</h1>
          <p className="mt-1 text-sm text-muted">{formatWindow(data.from, data.to)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2" aria-label={`Date range: ${selectedRange}`}>
                <CalendarDays className="h-4 w-4" aria-hidden="true" />{selectedRange}<ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {DATE_RANGES.map(({ key, label }) => (
                <DropdownMenuItem key={key} onClick={() => { if (key !== dateRange) void load(key, undefined); }} className="flex items-center justify-between gap-4">
                  {label}{key === dateRange && <Check className="h-4 w-4" aria-hidden="true" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" disabled={updating} onClick={() => void load(dateRange, granularity, true)}>
            <RotateCw aria-hidden="true" className={`mr-2 h-4 w-4 ${updating ? 'animate-spin' : ''}`} />Refresh
          </Button>
        </div>
      </div>
      <div aria-live="polite" className="sr-only">{updating ? 'Updating analytics' : ''}</div>
      <div aria-busy={updating} className={updating ? 'opacity-80 transition-opacity duration-150' : 'opacity-100 transition-opacity duration-150'}>
        <TimeSeriesChart data={data.timeSeries} metrics={data.kpis} granularity={granularity}
          onGranularityChange={(interval) => { if (interval !== granularity) void load(dateRange, interval); }} />
      </div>
      <BreakdownPanels breakdowns={data.breakdowns} />
      <aside className="flex flex-col gap-4 rounded-xl border border-edge/60 bg-surface/60 p-5 sm:flex-row sm:items-center sm:justify-between" aria-labelledby="conversion-heading">
        <div className="max-w-xl">
          <h2 id="conversion-heading" className="text-sm font-semibold text-foreground">Measure what visitors do next</h2>
          <p className="mt-1 text-sm text-muted">Pageviews work automatically. To measure signups or feature use, capture those events in your app and build a funnel from them.</p>
        </div>
        <Button variant="secondary" asChild className="shrink-0 self-start sm:self-auto"><Link href={`/${project.slug}/funnels`}>Build a funnel</Link></Button>
      </aside>
    </div>
  );
}
