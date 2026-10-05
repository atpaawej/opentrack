'use client';

import * as React from 'react';
import {
  Users,
  Eye,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Activity,
  HelpCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { KpiMetricsSummary, KpiMetric } from '../types';

interface KpiCardsProps {
  metrics: KpiMetricsSummary;
  className?: string;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function formatNumber(num: number): string {
  if (num === undefined || num === null) return '0';
  return num.toLocaleString();
}

interface MetricCardConfig {
  title: string;
  metric: KpiMetric;
  icon: React.ComponentType<{ className?: string }>;
  tooltip: string;
  formatter: (val: number) => string;
  invertDeltaColor?: boolean;
}

export function KpiCards({ metrics, className }: KpiCardsProps) {
  const cards: MetricCardConfig[] = [
    {
      title: 'Unique Visitors',
      metric: metrics.uniqueVisitors,
      icon: Users,
      tooltip: 'Distinct visitors identified by unique device hash or user ID.',
      formatter: formatNumber,
    },
    {
      title: 'Total Pageviews',
      metric: metrics.totalPageviews,
      icon: Eye,
      tooltip: 'Aggregate count of all $pageview events recorded.',
      formatter: formatNumber,
    },
    {
      title: 'Total Sessions',
      metric: metrics.totalSessions,
      icon: Layers,
      tooltip: 'Distinct browsing sessions grouped by session identifier.',
      formatter: formatNumber,
    },
    {
      title: 'Bounce Rate',
      metric: metrics.bounceRate,
      icon: Activity,
      tooltip: 'Percentage of sessions with only 1 event or lasting less than 10 seconds.',
      formatter: (val) => `${val.toFixed(1)}%`,
      invertDeltaColor: true, // A lower bounce rate is good (green)
    },
    {
      title: 'Avg. Visit Duration',
      metric: metrics.avgSessionDuration,
      icon: Clock,
      tooltip: 'Average elapsed time between first and last event in a session.',
      formatter: formatDuration,
    },
  ];

  return (
    <div className={cn('grid grid-cols-2 md:grid-cols-5 gap-3.5', className)}>
      {cards.map((item) => {
        const Icon = item.icon;
        const change = item.metric.changePercentage;
        const isPositive = change > 0;
        const isNegative = change < 0;
        const isNeutral = change === 0;

        // For bounce rate, negative change is positive for performance
        let isGood = isPositive;
        if (item.invertDeltaColor) {
          isGood = isNegative;
        }

        const deltaColor = isNeutral
          ? 'text-zinc-500 bg-zinc-800/40 border-zinc-700/40'
          : isGood
          ? 'text-emerald-400 bg-emerald-950/40 border-emerald-800/30'
          : 'text-rose-400 bg-rose-950/40 border-rose-800/30';

        const DeltaIcon = isPositive
          ? ArrowUpRight
          : isNegative
          ? ArrowDownRight
          : null;

        return (
          <Card
            key={item.title}
            className="group relative overflow-hidden border-zinc-850/80 bg-zinc-950/70 p-4 transition-all duration-200 hover:border-zinc-700/80 hover:bg-zinc-900/30"
          >
            <CardContent className="p-0 space-y-2">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-xs font-medium tracking-tight text-zinc-400 group-hover:text-zinc-300 flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 text-zinc-500 group-hover:text-zinc-400 transition-colors" />
                  {item.title}
                </span>

                <div className="relative group/tooltip">
                  <HelpCircle className="h-3 w-3 text-zinc-600 hover:text-zinc-400 cursor-help transition-colors" />
                  <div className="pointer-events-none absolute right-0 top-5 z-50 w-48 rounded bg-zinc-900 px-2 py-1.5 text-[11px] text-zinc-300 opacity-0 shadow-lg border border-zinc-800 transition-opacity group-hover/tooltip:opacity-100">
                    {item.tooltip}
                  </div>
                </div>
              </div>

              <div className="flex items-baseline justify-between pt-1">
                <div className="text-2xl font-bold tracking-tight text-zinc-100 font-mono">
                  {item.formatter(item.metric.value)}
                </div>

                <div
                  className={cn(
                    'inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium font-mono border',
                    deltaColor
                  )}
                  title={`Previous period: ${item.formatter(item.metric.previousValue)}`}
                >
                  {DeltaIcon && <DeltaIcon className="h-3 w-3" />}
                  <span>
                    {isPositive ? '+' : ''}
                    {change}%
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-zinc-400 font-mono">
                vs prev: {item.formatter(item.metric.previousValue)}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
