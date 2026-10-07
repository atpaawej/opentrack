'use client';

import * as React from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';
import type { Granularity, KpiMetricsSummary, TimeSeriesPoint } from '../types';
import { KpiCards, type TrafficMetric } from './kpi-cards';

type ChartMode = 'area' | 'line' | 'bar';

interface TimeSeriesChartProps {
  data: TimeSeriesPoint[];
  metrics: KpiMetricsSummary;
  granularity: Granularity;
  onGranularityChange?: (granularity: Granularity) => void;
  className?: string;
}

const GRANULARITIES: Granularity[] = ['hour', 'day', 'week', 'month'];
const COLORS: Record<TrafficMetric, string> = {
  visitors: 'var(--chart-1, #76D5C3)',
  pageviews: 'var(--chart-2, #A2B9EE)',
  sessions: 'var(--chart-3, #E6B483)',
};
const LABELS: Record<TrafficMetric, string> = {
  visitors: 'Visitors', pageviews: 'Pageviews', sessions: 'Sessions',
};

function formatDate(timestamp: string, granularity: Granularity, detailed = false): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return new Intl.DateTimeFormat('en', granularity === 'hour'
    ? { timeZone: 'UTC', month: detailed ? 'short' : undefined, day: detailed ? 'numeric' : undefined, hour: '2-digit', hour12: false }
    : { timeZone: 'UTC', month: 'short', day: 'numeric', year: detailed ? 'numeric' : undefined }
  ).format(date);
}

export function TimeSeriesChart({ data, metrics, granularity, onGranularityChange, className }: TimeSeriesChartProps) {
  const [metric, setMetric] = React.useState<TrafficMetric>('visitors');
  const [mode, setMode] = React.useState<ChartMode>('area');
  const color = COLORS[metric];
  const common = (
    <>
      <CartesianGrid vertical={false} stroke="var(--edge, #33515A)" strokeOpacity={0.45} />
      <XAxis dataKey="timestamp" tickLine={false} axisLine={false} minTickGap={30} tickMargin={12}
        tick={{ fill: 'var(--muted, #B3C6C8)', fontSize: 11 }} tickFormatter={(value: string) => formatDate(value, granularity)} />
      <YAxis allowDecimals={false} width={42} tickLine={false} axisLine={false}
        tick={{ fill: 'var(--muted, #B3C6C8)', fontSize: 11 }} />
      <Tooltip
        labelFormatter={(value) => `${formatDate(String(value), granularity, true)} UTC`}
        formatter={(value) => [Number(value ?? 0).toLocaleString(), LABELS[metric]]}
        contentStyle={{ background: 'var(--surface, #16262D)', border: '1px solid var(--edge, #33515A)', borderRadius: 10, color: 'var(--foreground, #F0F5F3)' }}
        labelStyle={{ color: 'var(--muted, #B3C6C8)' }}
        cursor={{ stroke: 'var(--muted, #B3C6C8)', strokeOpacity: 0.5 }}
      />
    </>
  );

  return (
    <section className={cn('overflow-hidden rounded-2xl border border-edge/60 bg-surface', className)} aria-label="Traffic over time">
      <KpiCards metrics={metrics} activeMetric={metric} onMetricChange={setMetric} />
      <div className="flex flex-col gap-3 px-4 pt-5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">Traffic over time</h2>
          <p className="mt-0.5 text-xs text-muted">{LABELS[metric]} by {granularity} · UTC</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Time interval" className="inline-flex rounded-lg border border-edge/60 p-0.5">
            {GRANULARITIES.map((interval) => (
              <button key={interval} type="button" aria-pressed={granularity === interval}
                onClick={() => onGranularityChange?.(interval)}
                className={cn('rounded-md px-2.5 py-1.5 text-xs capitalize text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal', granularity === interval && 'bg-foreground/10 text-foreground')}>
                {interval}
              </button>
            ))}
          </div>
          <div role="group" aria-label="Chart display" className="inline-flex rounded-lg border border-edge/60 p-0.5">
            {(['area', 'line', 'bar'] as ChartMode[]).map((kind) => (
              <button key={kind} type="button" aria-pressed={mode === kind} onClick={() => setMode(kind)}
                className={cn('rounded-md px-2.5 py-1.5 text-xs capitalize text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal', mode === kind && 'bg-foreground/10 text-foreground')}>
                {kind}
              </button>
            ))}
          </div>
        </div>
      </div>
      {data.length ? (
        <>
          <div className="h-[260px] min-w-0 px-2 pb-2 pt-5 sm:h-[320px] sm:px-4" role="img" aria-label={`${LABELS[metric]} over time, ${data.length} ${granularity}ly data points. Exact values follow in the data table.`}>
            <ResponsiveContainer width="100%" height="100%">
              {mode === 'area' ? (
                <AreaChart accessibilityLayer data={data} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                  <defs><linearGradient id="traffic-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.22} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
                  {common}
                  <Area type="monotone" dataKey={metric} stroke={color} strokeWidth={2} fill="url(#traffic-fill)" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                </AreaChart>
              ) : mode === 'line' ? (
                <LineChart accessibilityLayer data={data} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                  {common}
                  <Line type="monotone" dataKey={metric} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                </LineChart>
              ) : (
                <BarChart accessibilityLayer data={data} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                  {common}
                  <Bar dataKey={metric} fill={color} maxBarSize={32} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
          <details className="border-t border-edge/40 px-5 py-3 text-xs text-muted">
            <summary className="cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">View chart data</summary>
            <div className="mt-3 max-h-64 overflow-auto">
              <table className="w-full text-left tabular-nums"><caption className="sr-only">Traffic by {granularity}, UTC</caption><thead><tr className="border-b border-edge/50"><th scope="col" className="py-2 font-medium">Time (UTC)</th><th scope="col" className="py-2 text-right font-medium">Visitors</th><th scope="col" className="py-2 text-right font-medium">Pageviews</th><th scope="col" className="py-2 text-right font-medium">Sessions</th></tr></thead>
                <tbody>{data.map((point) => <tr key={point.timestamp} className="border-b border-edge/30"><th scope="row" className="py-2 font-normal">{formatDate(point.timestamp, granularity, true)}</th><td className="py-2 text-right">{point.visitors.toLocaleString()}</td><td className="py-2 text-right">{point.pageviews.toLocaleString()}</td><td className="py-2 text-right">{point.sessions.toLocaleString()}</td></tr>)}</tbody>
              </table>
            </div>
          </details>
        </>
      ) : (
        <div className="flex min-h-[250px] flex-col items-center justify-center px-6 text-center">
          <p className="text-sm font-medium text-foreground">No activity in this period</p>
          <p className="mt-1 max-w-sm text-sm text-muted">Try a longer date range, or check that your app is sending events.</p>
        </div>
      )}
    </section>
  );
}
