'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Users,
  ArrowRight,
  Clock,
  UserX,
  ExternalLink,
  ChevronDown,
  TrendingDown,
  Percent,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { FunnelResult, FunnelStepResult } from '../types';

interface FunnelChartProps {
  data: FunnelResult | null;
  loading?: boolean;
  projectSlug: string;
  className?: string;
}

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

export function FunnelChart({
  data,
  loading,
  projectSlug,
  className,
}: FunnelChartProps) {
  const [selectedDrilldownStep, setSelectedDrilldownStep] = React.useState<number | null>(null);

  if (loading) {
    return (
      <Card className={cn('border-zinc-800/80 bg-zinc-950 p-6', className)}>
        <div className="flex justify-between items-center mb-6">
          <div className="h-6 w-36 bg-zinc-900 rounded animate-pulse" />
          <div className="h-8 w-48 bg-zinc-900 rounded animate-pulse" />
        </div>
        <div className="h-72 w-full bg-zinc-900/40 rounded flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="h-5 w-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-zinc-400">Calculating conversion funnel...</span>
          </div>
        </div>
      </Card>
    );
  }

  if (!data || data.steps.length === 0 || data.totalUsers === 0) {
    return (
      <Card className={cn('border-zinc-800/80 bg-zinc-950 p-6', className)}>
        <div className="h-64 border border-dashed border-zinc-800 rounded flex flex-col items-center justify-center p-8 text-center bg-zinc-900/20">
          <TrendingDown className="w-8 h-8 text-zinc-600 mb-2" />
          <p className="text-xs font-medium text-zinc-300">No funnel data found</p>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm">
            No events matched the first step in this time window. Try expanding your date range or adjusting step criteria.
          </p>
        </div>
      </Card>
    );
  }

  const activeDrilldown =
    selectedDrilldownStep !== null && selectedDrilldownStep < data.steps.length
      ? data.steps[selectedDrilldownStep]
      : null;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Funnel Metrics Summary Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-zinc-800/80 bg-zinc-950">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                Total Started (Step 1)
              </p>
              <p className="text-xl font-bold tracking-tight text-zinc-100">
                {data.totalUsers.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-800/80 bg-zinc-950">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-900/50 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                Completed Funnel
              </p>
              <p className="text-xl font-bold tracking-tight text-emerald-400">
                {data.convertedUsers.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-800/80 bg-zinc-950">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-900/50 text-indigo-400">
              <Percent className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                Overall Conversion Rate
              </p>
              <p className="text-xl font-bold tracking-tight text-indigo-300">
                {data.overallConversionRate}%
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Funnel Visualization Card */}
      <Card className="border-zinc-800/80 bg-zinc-950">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-semibold text-zinc-100">Conversion Steps</CardTitle>
          <CardDescription className="text-xs text-zinc-400">
            Conversion drop-offs, elapsed conversion times, and step progress within the {data.query.conversionWindow.value}{' '}
            {data.query.conversionWindow.unit}(s) window.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-3">
            {data.steps.map((step, idx) => {
              const barWidth = Math.max(3, step.conversionRateFromFirst);
              const isLast = idx === data.steps.length - 1;

              return (
                <div key={step.id || idx} className="space-y-2">
                  {/* Step Card Row */}
                  <div className="p-3.5 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 text-xs font-mono font-semibold text-zinc-300">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-zinc-100">{step.name}</span>
                            <Badge
                              variant="outline"
                              className="text-[10px] font-mono border-zinc-800 text-zinc-400 bg-zinc-950"
                            >
                              {step.eventName}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs">
                        <div className="text-right">
                          <span className="font-semibold text-zinc-100 text-sm">
                            {step.count.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-zinc-500 ml-1">users</span>
                        </div>

                        <Badge
                          variant="outline"
                          className="font-mono text-xs border-emerald-500/20 text-emerald-400 bg-emerald-950/20"
                        >
                          {step.conversionRateFromFirst}%
                        </Badge>
                      </div>
                    </div>

                    {/* Step Bar */}
                    <div className="h-2.5 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-850">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500 ease-out"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>

                  {/* Inter-step Transition & Drop-off Indicator */}
                  {!isLast && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-1.5 text-xs text-zinc-400 bg-zinc-900/30 rounded border border-dashed border-zinc-850">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-rose-400 font-medium">
                          <TrendingDown className="w-3.5 h-3.5" />
                          <span>Drop-off:</span>
                          <span className="font-mono font-semibold">
                            {step.dropOffCount.toLocaleString()} ({step.dropOffPercentage}%)
                          </span>
                        </div>

                        {data.steps[idx + 1].medianTimeToConvertSeconds !== null && (
                          <div className="flex items-center gap-1 text-zinc-500 text-[11px] font-mono">
                            <Clock className="w-3 h-3 text-zinc-400" />
                            <span>
                              Median time:{' '}
                              {formatSeconds(data.steps[idx + 1].medianTimeToConvertSeconds)}
                            </span>
                          </div>
                        )}
                      </div>

                      {step.dropOffCount > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setSelectedDrilldownStep(
                              selectedDrilldownStep === idx ? null : idx
                            )
                          }
                          className="h-6 text-[11px] text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/30 px-2"
                        >
                          <UserX className="w-3 h-3 mr-1" />
                          {selectedDrilldownStep === idx
                            ? 'Hide dropped users'
                            : `Inspect ${step.dropOffCount} dropped users`}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Drop-off Drilldown Panel */}
      {activeDrilldown && activeDrilldown.droppedUserIds.length > 0 && (
        <Card className="border-indigo-900/40 bg-zinc-950/90 shadow-xl animate-in fade-in-50 duration-200">
          <CardHeader className="pb-3 border-b border-zinc-850">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <UserX className="w-4 h-4 text-indigo-400" />
                  Drop-off Drilldown: {activeDrilldown.name}
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400">
                  {activeDrilldown.droppedUserIds.length} users completed this step but dropped off
                  before {data.steps[activeDrilldown.stepIndex + 1]?.name}.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDrilldownStep(null)}
                className="h-7 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Close
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {activeDrilldown.droppedUserIds.map((userId) => (
                <div
                  key={userId}
                  className="flex items-center justify-between p-2 rounded bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500/80" />
                    <span className="font-mono text-xs text-zinc-200">{userId}</span>
                  </div>

                  <Link
                    href={`/${projectSlug}/persons/${encodeURIComponent(userId)}`}
                    className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-medium hover:underline"
                  >
                    View Person
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
