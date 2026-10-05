'use client';

import * as React from 'react';
import {
  TrendingUp,
  BarChart2,
  LineChart as LineChartIcon,
  Layers,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TimeSeriesPoint, Granularity } from '../types';

type ChartMode = 'area' | 'line' | 'bar';
type ActiveMetric = 'all' | 'pageviews' | 'visitors' | 'sessions';

interface TimeSeriesChartProps {
  data: TimeSeriesPoint[];
  granularity: Granularity;
  onGranularityChange?: (g: Granularity) => void;
  className?: string;
}

export function TimeSeriesChart({
  data,
  granularity,
  onGranularityChange,
  className,
}: TimeSeriesChartProps) {
  const [chartMode, setChartMode] = React.useState<ChartMode>('area');
  const [activeMetric, setActiveMetric] = React.useState<ActiveMetric>('all');
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);

  // Layout metrics for SVG viewBox
  const vbWidth = 1000;
  const vbHeight = 280;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 25;
  const padBottom = 35;
  const chartW = vbWidth - padLeft - padRight;
  const chartH = vbHeight - padTop - padBottom;

  const pointsCount = data.length;

  const maxVal = React.useMemo(() => {
    if (!data.length) return 10;
    const values: number[] = [];
    data.forEach((p) => {
      if (activeMetric === 'all' || activeMetric === 'pageviews') values.push(p.pageviews);
      if (activeMetric === 'all' || activeMetric === 'visitors') values.push(p.visitors);
      if (activeMetric === 'all' || activeMetric === 'sessions') values.push(p.sessions);
    });
    const max = Math.max(...values, 0);
    return max <= 0 ? 10 : Math.ceil(max * 1.15);
  }, [data, activeMetric]);

  const getY = (val: number) => {
    return padTop + chartH - (val / maxVal) * chartH;
  };

  const getX = (index: number) => {
    if (pointsCount <= 1) return padLeft + chartW / 2;
    return padLeft + (index / (pointsCount - 1)) * chartW;
  };

  const generatePath = (metricKey: 'pageviews' | 'visitors' | 'sessions') => {
    if (!data.length) return '';
    return data
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(d[metricKey]).toFixed(1)}`)
      .join(' ');
  };

  const generateAreaPath = (metricKey: 'pageviews' | 'visitors' | 'sessions') => {
    if (!data.length) return '';
    const linePath = generatePath(metricKey);
    const firstX = getX(0).toFixed(1);
    const lastX = getX(pointsCount - 1).toFixed(1);
    const bottomY = (padTop + chartH).toFixed(1);
    return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  };

  const hoveredPoint = hoverIndex !== null && hoverIndex >= 0 && hoverIndex < data.length ? data[hoverIndex] : null;

  const formatTickDate = (isoStr: string) => {
    const d = new Date(isoStr);
    if (granularity === 'hour') {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    if (granularity === 'month') {
      return d.toLocaleDateString([], { month: 'short', year: 'numeric' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const formatTooltipDate = (isoStr: string) => {
    const d = new Date(isoStr);
    if (granularity === 'hour') {
      return d.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    }
    return d.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Y-axis grid ticks (4 steps)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    val: Math.round(maxVal * ratio),
    y: padTop + chartH - ratio * chartH,
  }));

  // X-axis label indices (e.g. 5 indices)
  const xLabelIndices = React.useMemo(() => {
    if (pointsCount <= 1) return [0];
    if (pointsCount <= 6) return data.map((_, i) => i);
    const step = Math.floor((pointsCount - 1) / 4);
    return [0, step, step * 2, step * 3, pointsCount - 1];
  }, [pointsCount, data]);

  return (
    <Card className={cn('border-zinc-850/80 bg-zinc-950/70 overflow-hidden', className)}>
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border-b border-zinc-850/60 pb-3">
        {/* Metric Selector Toggles */}
        <div className="flex items-center gap-1 bg-zinc-900/80 p-0.5 rounded-lg border border-zinc-800/80">
          <button
            type="button"
            onClick={() => setActiveMetric('all')}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-md transition-colors select-none',
              activeMetric === 'all'
                ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveMetric('pageviews')}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-md transition-colors select-none flex items-center gap-1.5',
              activeMetric === 'pageviews'
                ? 'bg-blue-950/70 text-blue-300 border border-blue-800/50 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            Pageviews
          </button>
          <button
            type="button"
            onClick={() => setActiveMetric('visitors')}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-md transition-colors select-none flex items-center gap-1.5',
              activeMetric === 'visitors'
                ? 'bg-purple-950/70 text-purple-300 border border-purple-800/50 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            Visitors
          </button>
          <button
            type="button"
            onClick={() => setActiveMetric('sessions')}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-md transition-colors select-none flex items-center gap-1.5',
              activeMetric === 'sessions'
                ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/50 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Sessions
          </button>
        </div>

        {/* Chart View Toggles & Granularity */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Granularity Selector */}
          <div className="flex items-center gap-0.5 bg-zinc-900/80 p-0.5 rounded-lg border border-zinc-800/80 text-[11px] font-mono">
            {(['hour', 'day', 'week', 'month'] as Granularity[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => onGranularityChange?.(g)}
                className={cn(
                  'px-2 py-0.5 rounded capitalize transition-colors select-none',
                  granularity === g
                    ? 'bg-zinc-800 text-zinc-100 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                )}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Mode Toggles */}
          <div className="flex items-center gap-0.5 bg-zinc-900/80 p-0.5 rounded-lg border border-zinc-800/80">
            <button
              type="button"
              onClick={() => setChartMode('area')}
              title="Area Chart"
              className={cn(
                'p-1.5 rounded transition-colors',
                chartMode === 'area'
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              <TrendingUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setChartMode('line')}
              title="Line Chart"
              className={cn(
                'p-1.5 rounded transition-colors',
                chartMode === 'line'
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              <LineChartIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setChartMode('bar')}
              title="Bar Chart"
              className={cn(
                'p-1.5 rounded transition-colors',
                chartMode === 'bar'
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              <BarChart2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-2 relative select-none">
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-500 text-xs">
            <Calendar className="h-8 w-8 text-zinc-700 mb-2 stroke-1" />
            No traffic recorded for the selected window.
          </div>
        ) : (
          <div className="relative w-full h-[270px]">
            <svg
              viewBox={`0 0 ${vbWidth} ${vbHeight}`}
              className="w-full h-full overflow-visible"
              onMouseLeave={() => setHoverIndex(null)}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const mouseX = ((e.clientX - rect.left) / rect.width) * vbWidth;
                const clampedX = Math.max(padLeft, Math.min(padLeft + chartW, mouseX));
                const ratio = (clampedX - padLeft) / chartW;
                const idx = Math.min(pointsCount - 1, Math.max(0, Math.round(ratio * (pointsCount - 1))));
                setHoverIndex(idx);
              }}
            >
              <defs>
                <linearGradient id="pageviewsArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="visitorsArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="sessionsArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Horizontal Lines */}
              {yTicks.map((tick, i) => (
                <g key={i}>
                  <line
                    x1={padLeft}
                    y1={tick.y}
                    x2={padLeft + chartW}
                    y2={tick.y}
                    stroke="#27272a"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                  <text
                    x={padLeft - 8}
                    y={tick.y + 3}
                    textAnchor="end"
                    className="text-[10px] fill-zinc-500 font-mono"
                  >
                    {tick.val}
                  </text>
                </g>
              ))}

              {/* Area & Line mode rendering */}
              {chartMode !== 'bar' && (
                <>
                  {/* Pageviews Area / Line */}
                  {(activeMetric === 'all' || activeMetric === 'pageviews') && (
                    <g>
                      {chartMode === 'area' && (
                        <path
                          d={generateAreaPath('pageviews')}
                          fill="url(#pageviewsArea)"
                          className="transition-all duration-300"
                        />
                      )}
                      <path
                        d={generatePath('pageviews')}
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                  )}

                  {/* Visitors Area / Line */}
                  {(activeMetric === 'all' || activeMetric === 'visitors') && (
                    <g>
                      {chartMode === 'area' && (
                        <path
                          d={generateAreaPath('visitors')}
                          fill="url(#visitorsArea)"
                          className="transition-all duration-300"
                        />
                      )}
                      <path
                        d={generatePath('visitors')}
                        fill="none"
                        stroke="#a855f7"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                  )}

                  {/* Sessions Area / Line */}
                  {(activeMetric === 'all' || activeMetric === 'sessions') && (
                    <g>
                      {chartMode === 'area' && (
                        <path
                          d={generateAreaPath('sessions')}
                          fill="url(#sessionsArea)"
                          className="transition-all duration-300"
                        />
                      )}
                      <path
                        d={generatePath('sessions')}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                  )}
                </>
              )}

              {/* Bar mode rendering */}
              {chartMode === 'bar' && (
                <g>
                  {data.map((d, i) => {
                    const cx = getX(i);
                    const slotWidth = Math.max(4, Math.min(30, (chartW / pointsCount) * 0.7));
                    const barX = cx - slotWidth / 2;

                    const pvH = Math.max(0, (padTop + chartH) - getY(d.pageviews));
                    const visH = Math.max(0, (padTop + chartH) - getY(d.visitors));
                    const sessH = Math.max(0, (padTop + chartH) - getY(d.sessions));

                    if (activeMetric === 'pageviews') {
                      return (
                        <rect
                          key={i}
                          x={barX}
                          y={getY(d.pageviews)}
                          width={slotWidth}
                          height={pvH}
                          rx="2"
                          fill="#3b82f6"
                          opacity={hoverIndex === i ? 1 : 0.85}
                        />
                      );
                    }
                    if (activeMetric === 'visitors') {
                      return (
                        <rect
                          key={i}
                          x={barX}
                          y={getY(d.visitors)}
                          width={slotWidth}
                          height={visH}
                          rx="2"
                          fill="#a855f7"
                          opacity={hoverIndex === i ? 1 : 0.85}
                        />
                      );
                    }
                    if (activeMetric === 'sessions') {
                      return (
                        <rect
                          key={i}
                          x={barX}
                          y={getY(d.sessions)}
                          width={slotWidth}
                          height={sessH}
                          rx="2"
                          fill="#10b981"
                          opacity={hoverIndex === i ? 1 : 0.85}
                        />
                      );
                    }

                    // Combined overview bars
                    const subW = Math.max(2, slotWidth / 3 - 1);
                    return (
                      <g key={i}>
                        <rect
                          x={barX}
                          y={getY(d.pageviews)}
                          width={subW}
                          height={pvH}
                          rx="1"
                          fill="#3b82f6"
                          opacity={hoverIndex === i ? 1 : 0.8}
                        />
                        <rect
                          x={barX + subW + 1}
                          y={getY(d.visitors)}
                          width={subW}
                          height={visH}
                          rx="1"
                          fill="#a855f7"
                          opacity={hoverIndex === i ? 1 : 0.8}
                        />
                        <rect
                          x={barX + (subW + 1) * 2}
                          y={getY(d.sessions)}
                          width={subW}
                          height={sessH}
                          rx="1"
                          fill="#10b981"
                          opacity={hoverIndex === i ? 1 : 0.8}
                        />
                      </g>
                    );
                  })}
                </g>
              )}

              {/* X-Axis bottom labels */}
              {xLabelIndices.map((idx) => {
                const item = data[idx];
                if (!item) return null;
                return (
                  <text
                    key={idx}
                    x={getX(idx)}
                    y={padTop + chartH + 18}
                    textAnchor="middle"
                    className="text-[10px] fill-zinc-500 font-mono"
                  >
                    {formatTickDate(item.timestamp)}
                  </text>
                );
              })}

              {/* Interactive Crosshair Cursor */}
              {hoverIndex !== null && hoverIndex >= 0 && (
                <g pointerEvents="none">
                  <line
                    x1={getX(hoverIndex)}
                    y1={padTop}
                    x2={getX(hoverIndex)}
                    y2={padTop + chartH}
                    stroke="#52525b"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />

                  {/* Highlights for data points */}
                  {data[hoverIndex] && (
                    <>
                      {(activeMetric === 'all' || activeMetric === 'pageviews') && (
                        <circle
                          cx={getX(hoverIndex)}
                          cy={getY(data[hoverIndex].pageviews)}
                          r="4"
                          fill="#3b82f6"
                          stroke="#09090b"
                          strokeWidth="2"
                        />
                      )}
                      {(activeMetric === 'all' || activeMetric === 'visitors') && (
                        <circle
                          cx={getX(hoverIndex)}
                          cy={getY(data[hoverIndex].visitors)}
                          r="4"
                          fill="#a855f7"
                          stroke="#09090b"
                          strokeWidth="2"
                        />
                      )}
                      {(activeMetric === 'all' || activeMetric === 'sessions') && (
                        <circle
                          cx={getX(hoverIndex)}
                          cy={getY(data[hoverIndex].sessions)}
                          r="4"
                          fill="#10b981"
                          stroke="#09090b"
                          strokeWidth="2"
                        />
                      )}
                    </>
                  )}
                </g>
              )}
            </svg>

            {/* Interactive Tooltip Card */}
            {hoveredPoint && hoverIndex !== null && (
              <div
                className="pointer-events-none absolute z-20 rounded-lg border border-zinc-800 bg-zinc-900/95 p-2.5 shadow-xl backdrop-blur-md transition-all duration-75 text-xs font-mono"
                style={{
                  left: `${Math.min(80, Math.max(10, (getX(hoverIndex) / vbWidth) * 100))}%`,
                  top: '10px',
                  transform: 'translateX(-50%)',
                }}
              >
                <div className="font-semibold text-zinc-200 border-b border-zinc-800 pb-1 mb-1.5 text-[11px]">
                  {formatTooltipDate(hoveredPoint.timestamp)}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-4 text-zinc-300">
                    <span className="flex items-center gap-1.5 text-blue-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      Pageviews:
                    </span>
                    <span className="font-semibold text-zinc-100">
                      {hoveredPoint.pageviews.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-zinc-300">
                    <span className="flex items-center gap-1.5 text-purple-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                      Visitors:
                    </span>
                    <span className="font-semibold text-zinc-100">
                      {hoveredPoint.visitors.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-zinc-300">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Sessions:
                    </span>
                    <span className="font-semibold text-zinc-100">
                      {hoveredPoint.sessions.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
