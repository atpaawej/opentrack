'use client';

import * as React from 'react';
import {
  Calendar,
  ChevronDown,
  RotateCw,
  Sparkles,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { KpiCards } from './kpi-cards';
import { TimeSeriesChart } from './time-series-chart';
import { BreakdownPanels } from './breakdown-panels';
import { fetchAnalyticsDataAction } from '../actions';
import type {
  AnalyticsDataPayload,
  DateRangeKey,
  Granularity,
} from '../types';
import type { Project } from '@/lib/db/schema';
import { toast } from 'sonner';

interface AnalyticsDashboardProps {
  project: Project;
  initialData: AnalyticsDataPayload;
}

const DATE_RANGE_OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '24h', label: 'Last 24 Hours' },
  { key: '7d', label: 'Last 7 Days' },
  { key: '30d', label: 'Last 30 Days' },
  { key: '90d', label: 'Last 90 Days' },
];

export function AnalyticsDashboard({ project, initialData }: AnalyticsDashboardProps) {
  const [data, setData] = React.useState<AnalyticsDataPayload>(initialData);
  const [dateRange, setDateRange] = React.useState<DateRangeKey>(initialData.dateRange);
  const [granularity, setGranularity] = React.useState<Granularity>(initialData.granularity);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = React.useState<boolean>(false);

  const loadData = async (
    newRange: DateRangeKey,
    newGranularity?: Granularity,
    isManualRefresh = false
  ) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const result = await fetchAnalyticsDataAction(
        project.id,
        newRange,
        newGranularity || granularity
      );

      if (result.success) {
        setData(result.data);
        setDateRange(newRange);
        if (newGranularity) {
          setGranularity(newGranularity);
        } else {
          setGranularity(result.data.granularity);
        }
        if (isManualRefresh) {
          toast.success('Analytics updated');
        }
      } else {
        toast.error(result.error);
      }
    } catch (err: any) {
      toast.error('Failed to update analytics');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleDateRangeSelect = (key: DateRangeKey) => {
    if (key === dateRange) return;
    setDateRange(key);
    loadData(key, undefined, false);
  };

  const handleGranularityChange = (g: Granularity) => {
    if (g === granularity) return;
    setGranularity(g);
    loadData(dateRange, g, false);
  };

  const currentRangeLabel =
    DATE_RANGE_OPTIONS.find((opt) => opt.key === dateRange)?.label || 'Last 30 Days';

  const formatWindowPeriod = (fromStr: string, toStr: string) => {
    const f = new Date(fromStr);
    const t = new Date(toStr);
    return `${f.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    })} – ${t.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`;
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Range Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
              {project.name}
              <Badge variant="contrast" className="text-[10px]">
                Web Analytics
              </Badge>
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5 font-mono">
              {formatWindowPeriod(data.from, data.to)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh Action */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(dateRange, granularity, true)}
            disabled={isLoading || isRefreshing}
            className="h-8 border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 active:scale-[0.98]"
          >
            <RotateCw
              className={cn(
                'h-3.5 w-3.5 mr-1.5',
                isRefreshing && 'animate-spin text-zinc-100'
              )}
            />
            <span>Refresh</span>
          </Button>

          {/* Date Range Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-zinc-800 bg-zinc-900/60 text-zinc-200 hover:text-zinc-100 hover:bg-zinc-800 active:scale-[0.98] gap-2 font-mono text-xs"
              >
                <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                <span>{currentRangeLabel}</span>
                <ChevronDown className="h-3 w-3 text-zinc-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-44 bg-zinc-900 border-zinc-800 text-zinc-200"
            >
              {DATE_RANGE_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.key}
                  onClick={() => handleDateRangeSelect(opt.key)}
                  className="flex items-center justify-between text-xs cursor-pointer focus:bg-zinc-800 focus:text-zinc-100"
                >
                  <span>{opt.label}</span>
                  {dateRange === opt.key && (
                    <Check className="h-3.5 w-3.5 text-zinc-300" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Content with Zero Layout Shift */}
      {isLoading ? (
        <div className="space-y-6">
          {/* KPI Cards Skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-28 rounded-xl border border-zinc-850/80 bg-zinc-950/70 p-4 space-y-3"
              >
                <Skeleton className="h-3 w-24 bg-zinc-800/60" />
                <Skeleton className="h-7 w-20 bg-zinc-800/60" />
                <Skeleton className="h-2.5 w-16 bg-zinc-800/40" />
              </div>
            ))}
          </div>

          {/* Time Series Chart Skeleton */}
          <div className="h-80 rounded-xl border border-zinc-850/80 bg-zinc-950/70 p-4 space-y-4">
            <div className="flex justify-between items-center">
              <Skeleton className="h-6 w-48 bg-zinc-800/60" />
              <Skeleton className="h-6 w-32 bg-zinc-800/60" />
            </div>
            <Skeleton className="h-56 w-full bg-zinc-900/50" />
          </div>

          {/* Breakdown Panels Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-72 rounded-xl border border-zinc-850/80 bg-zinc-950/70 p-4 space-y-3">
              <Skeleton className="h-6 w-36 bg-zinc-800/60" />
              <Skeleton className="h-10 w-full bg-zinc-900/50" />
              <Skeleton className="h-10 w-full bg-zinc-900/50" />
              <Skeleton className="h-10 w-full bg-zinc-900/50" />
            </div>
            <div className="h-72 rounded-xl border border-zinc-850/80 bg-zinc-950/70 p-4 space-y-3">
              <Skeleton className="h-6 w-36 bg-zinc-800/60" />
              <Skeleton className="h-10 w-full bg-zinc-900/50" />
              <Skeleton className="h-10 w-full bg-zinc-900/50" />
              <Skeleton className="h-10 w-full bg-zinc-900/50" />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPI Metrics */}
          <KpiCards metrics={data.kpis} />

          {/* Main Time Series Chart */}
          <TimeSeriesChart
            data={data.timeSeries}
            granularity={granularity}
            onGranularityChange={handleGranularityChange}
          />

          {/* Top Breakdowns (Pages, Referrers, Campaigns, Geo, Tech) */}
          <BreakdownPanels breakdowns={data.breakdowns} />
        </div>
      )}
    </div>
  );
}
