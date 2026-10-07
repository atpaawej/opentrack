'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { FunnelResult } from '../types';

interface FunnelChartProps {
  data: FunnelResult | null;
  loading?: boolean;
  projectSlug: string;
  className?: string;
}

const signal = 'var(--chart-1, var(--signal, #76d5c3))';
const muted = 'var(--muted, #B3C6C8)';
const edge = 'var(--edge, #33515A)';
const number = (value: number) => value.toLocaleString();

function formatSeconds(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const remSec = seconds % 60;
  if (mins < 60) return `${mins}m ${remSec > 0 ? `${remSec}s` : ''}`.trim();
  const hours = Math.floor(mins / 60);
  const remMin = mins % 60;
  if (hours < 24) return `${hours}h ${remMin > 0 ? `${remMin}m` : ''}`.trim();
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export function FunnelChart({ data, loading, projectSlug, className }: FunnelChartProps) {
  const [selectedDrilldownStep, setSelectedDrilldownStep] = React.useState<number | null>(null);
  React.useEffect(() => setSelectedDrilldownStep(null), [data]);

  if (loading) {
    return <Card className={cn('border-[var(--edge,#33515A)] bg-[var(--surface,#16262D)] p-6', className)} aria-busy="true">
      <div role="status" className="flex min-h-64 items-center justify-center text-sm text-[var(--muted,#B3C6C8)]">Calculating conversion funnel…</div>
    </Card>;
  }

  if (!data || !data.steps.length || data.totalUsers === 0) {
    return <Card className={cn('border-[var(--edge,#33515A)] bg-[var(--surface,#16262D)] p-6', className)}>
      <div className="min-h-48 rounded border border-dashed border-[var(--edge,#33515A)] flex flex-col items-center justify-center p-6 text-center">
        <p className="text-sm font-medium text-[var(--foreground,#F0F5F3)]">{data ? 'No funnel activity in this window' : 'Run a funnel to see results'}</p>
        <p className="text-sm text-[var(--muted,#B3C6C8)] mt-1 max-w-lg">
          {data?.steps.length
            ? <>No one completed the first step, <span className="font-mono">{data.steps[0].eventName}</span>. Check that this event is being captured, or widen the date range.</>
            : 'Choose at least two captured events in order to see where people drop off.'}
        </p>
      </div>
    </Card>;
  }

  const activeDrilldown = selectedDrilldownStep !== null && selectedDrilldownStep < data.steps.length - 1
    ? data.steps[selectedDrilldownStep] : null;
  const chartData = data.steps.map((step, index) => ({
    step: `${index + 1}`, name: step.name, count: step.count,
    share: step.conversionRateFromFirst,
  }));
  const window = data.query.conversionWindow;

  return <div className={cn('space-y-4', className)}>
    <Card className="border-[var(--edge,#33515A)] bg-[var(--surface,#16262D)]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-[var(--foreground,#F0F5F3)]">Conversion steps</CardTitle>
        <CardDescription className="text-sm text-[var(--muted,#B3C6C8)]">
          Ordered events within {window.value} {window.unit}{window.value === 1 ? '' : 's'} of the first step. Bars show people who reached each step out of {number(data.totalUsers)} starters.
        </CardDescription>
      </CardHeader>
      <CardContent className="min-w-0">
        <div className="mb-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3 text-[var(--muted,#B3C6C8)]">
          <p>Started: <strong className="tabular-nums text-[var(--foreground,#F0F5F3)]">{number(data.totalUsers)}</strong></p>
          <p>Completed: <strong className="tabular-nums text-[var(--foreground,#F0F5F3)]">{number(data.convertedUsers)}</strong></p>
          <p>Overall conversion: <strong className="tabular-nums text-[var(--foreground,#F0F5F3)]">{data.overallConversionRate}%</strong> of starters</p>
        </div>
        <figure className="w-full min-w-0" style={{ height: Math.max(170, data.steps.length * 48 + 30) }}>
          <figcaption className="sr-only">People reaching each funnel step. Exact counts and conversion denominators are listed below.</figcaption>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" accessibilityLayer margin={{ top: 6, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid horizontal={false} stroke={edge} strokeDasharray="3 4" />
              <XAxis type="number" domain={[0, data.totalUsers]} tickFormatter={(value: number) => number(value)} tick={{ fontSize: 12 }} stroke={muted} allowDecimals={false} />
              <YAxis type="category" dataKey="step" width={36} tickFormatter={(value: string) => `#${value}`} tick={{ fontSize: 12 }} stroke={muted} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--surface, #16262D)', border: `1px solid ${edge}`, color: 'var(--foreground, #F0F5F3)', fontSize: 12 }}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ''}
                formatter={(value) => [`${number(Number(value))} people`, 'Reached step']} />
              <Bar dataKey="count" name="Reached step" fill={signal} maxBarSize={20} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </figure>
        <ol className="mt-4 divide-y divide-[var(--edge,#33515A)] border-t border-[var(--edge,#33515A)]">
          {data.steps.map((step, index) => {
            const previousCount = index > 0 ? data.steps[index - 1].count : null;
            const isLast = index === data.steps.length - 1;
            const drilldownOpen = selectedDrilldownStep === index;
            return <li key={step.id || index} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--foreground,#F0F5F3)]">{index + 1}. {step.name}</p>
                  <p className="break-all font-mono text-xs text-[var(--muted,#B3C6C8)]">{step.eventName}</p>
                </div>
                <strong className="tabular-nums text-sm text-[var(--foreground,#F0F5F3)]">{number(step.count)} people</strong>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-[var(--muted,#B3C6C8)] tabular-nums">
                <span>{step.conversionRateFromFirst}% of {number(data.totalUsers)} starters</span>
                {previousCount !== null && <span>{previousCount === 0 ? 'Not comparable (previous step: 0)' : `${step.conversionRateFromPrevious}% of ${number(previousCount)} at previous step`}</span>}
                {index > 0 && step.medianTimeToConvertSeconds !== null && <span>Median from previous step: {formatSeconds(step.medianTimeToConvertSeconds)}</span>}
              </div>
              {step.count === 0 && index > 0 && <p className="mt-2 text-sm text-[var(--muted,#B3C6C8)]">{previousCount === 0
                ? 'No one reached the previous step, so this step cannot be evaluated.'
                : <>No one reached this step. Check that <span className="font-mono">{step.eventName}</span> is captured after the previous event.</>}</p>}
              {!isLast && <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--muted,#B3C6C8)]">
                <span>Did not reach step {index + 2}: <strong className="font-medium tabular-nums text-[var(--foreground,#F0F5F3)]">{number(step.dropOffCount)}</strong> of {number(step.count)} ({step.count === 0 ? '—' : `${step.dropOffPercentage}%`})</span>
                {step.droppedUserIds.length > 0 && <Button type="button" variant="outline" size="sm"
                  aria-expanded={drilldownOpen} aria-controls={`funnel-dropoff-${index}`}
                  onClick={() => setSelectedDrilldownStep(drilldownOpen ? null : index)}>
                  {drilldownOpen ? 'Hide' : 'Inspect'} dropped people
                </Button>}
              </div>}
            </li>;
          })}
        </ol>
      </CardContent>
    </Card>

    {activeDrilldown && activeDrilldown.droppedUserIds.length > 0 && <Card id={`funnel-dropoff-${selectedDrilldownStep}`} className="border-[var(--edge,#33515A)] bg-[var(--surface,#16262D)]">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base text-[var(--foreground,#F0F5F3)]">Dropped after {activeDrilldown.name}</CardTitle>
          <CardDescription className="text-sm text-[var(--muted,#B3C6C8)]">
            {number(activeDrilldown.droppedUserIds.length)} people did not reach {data.steps[activeDrilldown.stepIndex + 1]?.name}.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => setSelectedDrilldownStep(null)}>Close</Button>
      </CardHeader>
      <CardContent>
        <ul className="max-h-72 overflow-y-auto divide-y divide-[var(--edge,#33515A)]">
          {activeDrilldown.droppedUserIds.map((userId) => <li key={userId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <span className="min-w-0 break-all font-mono text-[var(--foreground,#F0F5F3)]">{userId}</span>
            <Link href={`/${projectSlug}/persons/${encodeURIComponent(userId)}`}
              aria-label={`View person ${userId}`} className="shrink-0 rounded p-2 text-[var(--signal,#76d5c3)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--signal,#76d5c3)]">
              View person
            </Link>
          </li>)}
        </ul>
      </CardContent>
    </Card>}
  </div>;
}
