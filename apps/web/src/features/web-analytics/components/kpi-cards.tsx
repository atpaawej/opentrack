'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { KpiMetricsSummary, KpiMetric } from '../types';

export type TrafficMetric = 'visitors' | 'pageviews' | 'sessions';

interface KpiCardsProps {
  metrics: KpiMetricsSummary;
  activeMetric: TrafficMetric;
  onMetricChange: (metric: TrafficMetric) => void;
  className?: string;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0s';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

function Change({ metric, inverse = false }: { metric: KpiMetric; inverse?: boolean }) {
  if (metric.previousValue === 0 && metric.value > 0) {
    return <span className="text-[11px] text-muted">New this period</span>;
  }
  const delta = metric.changePercentage ?? 0;
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'unchanged';
  const improved = inverse ? delta < 0 : delta > 0;
  return (
    <span className={cn('text-[11px] tabular-nums', delta === 0 ? 'text-muted' : improved ? 'text-signal' : 'text-[#F2A39B]')}>
      {direction === 'unchanged' ? 'No change' : `${delta > 0 ? '+' : ''}${delta}% vs previous`}
    </span>
  );
}

export function KpiCards({ metrics, activeMetric, onMetricChange, className }: KpiCardsProps) {
  const items: {
    label: string;
    value: KpiMetric;
    format: (value: number) => string;
    metric?: TrafficMetric;
    inverse?: boolean;
    description: string;
  }[] = [
    { label: 'Visitors', value: metrics.uniqueVisitors, format: (v) => v.toLocaleString(), metric: 'visitors', description: 'Distinct event IDs seen in this period' },
    { label: 'Pageviews', value: metrics.totalPageviews, format: (v) => v.toLocaleString(), metric: 'pageviews', description: 'Recorded pageview events' },
    { label: 'Sessions', value: metrics.totalSessions, format: (v) => v.toLocaleString(), metric: 'sessions', description: 'Observed browsing sessions' },
    { label: 'Bounce rate', value: metrics.bounceRate, format: (v) => `${v.toFixed(1)}%`, inverse: true, description: 'Sessions with one event or less than ten seconds of activity' },
    { label: 'Visit duration', value: metrics.avgSessionDuration, format: formatDuration, description: 'Average time between the first and last observed event in a session' },
  ];

  return (
    <div className={cn('grid grid-cols-2 border-b border-edge/60 sm:grid-cols-3 xl:grid-cols-5', className)} aria-label="Traffic metrics">
      {items.map((item) => {
        const selected = item.metric === activeMetric;
        const content = (
          <>
            <span className="text-xs font-medium text-muted">{item.label}</span>
            <span className="mt-2 block text-[clamp(1.25rem,1.8vw,1.7rem)] font-semibold leading-none tracking-tight tabular-nums text-foreground">{item.format(item.value.value)}</span>
            <span className="mt-2 block"><Change metric={item.value} inverse={item.inverse} /></span>
            <span className="sr-only">{item.description}</span>
          </>
        );
        return item.metric ? (
          <button
            key={item.label}
            type="button"
            aria-pressed={selected}
            title={`${item.label}: ${item.description}. Show on chart`}
            onClick={() => onMetricChange(item.metric!)}
            className={cn('relative min-w-0 border-r border-edge/40 px-4 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal sm:px-5', selected ? 'bg-signal/[0.06]' : 'hover:bg-white/[0.03]')}
          >
            {selected && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-signal" />}
            {content}
          </button>
        ) : (
          <div key={item.label} className="min-w-0 border-r border-edge/40 px-4 py-4 sm:px-5" title={item.description}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
