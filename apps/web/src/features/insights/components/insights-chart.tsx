'use client';

import * as React from 'react';
import {
  LineChart as LineChartIcon,
  BarChart2,
  PieChart as PieChartIcon,
  Table as TableIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type {
  InsightQueryResult,
  InsightChartType,
} from '../types';

interface InsightsChartProps {
  data: InsightQueryResult | null;
  loading?: boolean;
  chartType: InsightChartType;
  onChartTypeChange?: (type: InsightChartType) => void;
  className?: string;
}

const PALETTE = [
  '#10b981', // emerald-500
  '#06b6d4', // cyan-500
  '#6366f1', // indigo-500
  '#f59e0b', // amber-500
  '#ec4899', // pink-500
  '#8b5cf6', // violet-500
  '#14b8a6', // teal-500
  '#f97316', // orange-500
];

export function InsightsChart({
  data,
  loading,
  chartType,
  onChartTypeChange,
  className,
}: InsightsChartProps) {
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);
  const [tablePage, setTablePage] = React.useState(0);
  const pageSize = 10;

  if (loading) {
    return (
      <Card className={cn('border-zinc-800/80 bg-zinc-950 p-6', className)}>
        <div className="flex justify-between items-center mb-6">
          <div className="h-6 w-36 bg-zinc-900 rounded animate-pulse" />
          <div className="h-8 w-48 bg-zinc-900 rounded animate-pulse" />
        </div>
        <div className="h-72 w-full bg-zinc-900/50 rounded flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="h-5 w-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-zinc-400">Computing insight...</span>
          </div>
        </div>
      </Card>
    );
  }

  if (!data || (data.timeSeries.length === 0 && data.breakdown.length === 0 && data.summaryValue === 0)) {
    return (
      <Card className={cn('border-zinc-800/80 bg-zinc-950 p-6', className)}>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-sm font-medium text-zinc-200">Query Results</h3>
            <p className="text-xs text-zinc-500">No events matched the selected filters</p>
          </div>
          <ChartTypeSelector active={chartType} onChange={onChartTypeChange} />
        </div>
        <div className="h-64 border border-dashed border-zinc-800 rounded flex flex-col items-center justify-center p-8 text-center bg-zinc-900/20">
          <BarChart2 className="w-8 h-8 text-zinc-600 mb-2" />
          <p className="text-xs font-medium text-zinc-300">No data found</p>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm">
            Try adjusting your date range, relaxing filters, or selecting a different event name.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn('border-zinc-800/80 bg-zinc-950', className)}>
      <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-zinc-850">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Result</span>
            <span className="text-2xl font-bold tracking-tight text-zinc-100">
              {Number(data.summaryValue).toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Total {data.query.aggregation.replace('_', ' ')} across {data.query.dateRange}
          </p>
        </div>
        <ChartTypeSelector active={chartType} onChange={onChartTypeChange} />
      </CardHeader>

      <CardContent className="pt-6">
        {chartType === 'line' && (
          <RenderLineChart
            timeSeries={data.timeSeries}
            hoverIndex={hoverIndex}
            setHoverIndex={setHoverIndex}
          />
        )}
        {chartType === 'bar' && (
          <RenderBarChart breakdown={data.breakdown} timeSeries={data.timeSeries} />
        )}
        {chartType === 'donut' && (
          <RenderDonutChart breakdown={data.breakdown} total={data.summaryValue} />
        )}
        {chartType === 'table' && (
          <RenderTable
            headers={data.tableHeaders}
            rows={data.tableRows}
            page={tablePage}
            setPage={setTablePage}
            pageSize={pageSize}
          />
        )}
      </CardContent>
    </Card>
  );
}

function ChartTypeSelector({
  active,
  onChange,
}: {
  active: InsightChartType;
  onChange?: (t: InsightChartType) => void;
}) {
  if (!onChange) return null;
  const types: { id: InsightChartType; label: string; icon: React.ReactNode }[] = [
    { id: 'line', label: 'Line', icon: <LineChartIcon className="w-3.5 h-3.5" /> },
    { id: 'bar', label: 'Bar', icon: <BarChart2 className="w-3.5 h-3.5" /> },
    { id: 'donut', label: 'Donut', icon: <PieChartIcon className="w-3.5 h-3.5" /> },
    { id: 'table', label: 'Table', icon: <TableIcon className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-md p-1">
      {types.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors',
            active === t.id
              ? 'bg-zinc-800 text-zinc-100 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
          )}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}

function RenderLineChart({
  timeSeries,
  hoverIndex,
  setHoverIndex,
}: {
  timeSeries: { timestamp: string; value: number }[];
  hoverIndex: number | null;
  setHoverIndex: (i: number | null) => void;
}) {
  if (!timeSeries.length) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-zinc-500">
        No time-series data available
      </div>
    );
  }

  const vbWidth = 800;
  const vbHeight = 260;
  const padLeft = 40;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 30;
  const chartW = vbWidth - padLeft - padRight;
  const chartH = vbHeight - padTop - padBottom;

  const maxVal = Math.max(...timeSeries.map((p) => p.value), 10);
  const getY = (val: number) => padTop + chartH - (val / maxVal) * chartH;
  const getX = (idx: number) => {
    if (timeSeries.length <= 1) return padLeft + chartW / 2;
    return padLeft + (idx / (timeSeries.length - 1)) * chartW;
  };

  const points = timeSeries.map((p, i) => `${getX(i).toFixed(1)},${getY(p.value).toFixed(1)}`).join(' ');
  const areaPath = timeSeries.length > 1
    ? `M ${getX(0).toFixed(1)} ${getY(timeSeries[0].value).toFixed(1)} ` +
      timeSeries.slice(1).map((p, i) => `L ${getX(i + 1).toFixed(1)} ${getY(p.value).toFixed(1)}`).join(' ') +
      ` L ${getX(timeSeries.length - 1).toFixed(1)} ${(padTop + chartH).toFixed(1)}` +
      ` L ${getX(0).toFixed(1)} ${(padTop + chartH).toFixed(1)} Z`
    : '';

  const hovered = hoverIndex !== null && hoverIndex >= 0 && hoverIndex < timeSeries.length ? timeSeries[hoverIndex] : null;

  return (
    <div className="relative">
      {hovered && (
        <div
          className="absolute -top-3 pointer-events-none z-10 -translate-x-1/2 rounded bg-zinc-900 border border-zinc-700/80 px-2.5 py-1 text-xs shadow-lg"
          style={{
            left: `${((getX(hoverIndex!) / vbWidth) * 100).toFixed(1)}%`,
          }}
        >
          <div className="text-zinc-400 font-mono text-[10px]">
            {new Date(hovered.timestamp).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
          <div className="font-semibold text-emerald-400">
            {hovered.value.toLocaleString()}
          </div>
        </div>
      )}

      <svg
        viewBox={`0 0 ${vbWidth} ${vbHeight}`}
        className="w-full h-64 overflow-visible cursor-crosshair select-none"
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id="insightAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padTop + chartH * (1 - ratio);
          const val = Math.round(maxVal * ratio);
          return (
            <g key={ratio}>
              <line
                x1={padLeft}
                y1={y}
                x2={padLeft + chartW}
                y2={y}
                stroke="#27272a"
                strokeDasharray="3 3"
              />
              <text
                x={padLeft - 8}
                y={y + 3}
                fill="#71717a"
                fontSize="10"
                textAnchor="end"
                fontFamily="monospace"
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* Fill area */}
        {areaPath && <path d={areaPath} fill="url(#insightAreaGrad)" />}

        {/* Main Line */}
        {timeSeries.length > 1 && (
          <polyline
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />
        )}

        {/* Hover Crosshair */}
        {hoverIndex !== null && (
          <g>
            <line
              x1={getX(hoverIndex)}
              y1={padTop}
              x2={getX(hoverIndex)}
              y2={padTop + chartH}
              stroke="#52525b"
              strokeDasharray="2 2"
            />
            <circle
              cx={getX(hoverIndex)}
              cy={getY(timeSeries[hoverIndex].value)}
              r="4.5"
              fill="#10b981"
              stroke="#18181b"
              strokeWidth="2"
            />
          </g>
        )}

        {/* Interactive capture columns */}
        {timeSeries.map((_, i) => {
          const colW = chartW / Math.max(1, timeSeries.length);
          const colX = getX(i) - colW / 2;
          return (
            <rect
              key={i}
              x={colX}
              y={padTop}
              width={colW}
              height={chartH}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoverIndex(i)}
            />
          );
        })}

        {/* Bottom date labels */}
        {timeSeries.length > 0 && (
          <>
            <text
              x={padLeft}
              y={padTop + chartH + 18}
              fill="#71717a"
              fontSize="10"
              fontFamily="monospace"
            >
              {new Date(timeSeries[0].timestamp).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </text>
            {timeSeries.length > 1 && (
              <text
                x={padLeft + chartW}
                y={padTop + chartH + 18}
                fill="#71717a"
                fontSize="10"
                textAnchor="end"
                fontFamily="monospace"
              >
                {new Date(timeSeries[timeSeries.length - 1].timestamp).toLocaleDateString(
                  undefined,
                  { month: 'short', day: 'numeric' }
                )}
              </text>
            )}
          </>
        )}
      </svg>
    </div>
  );
}

function RenderBarChart({
  breakdown,
  timeSeries,
}: {
  breakdown: { name: string; value: number; percentage: number }[];
  timeSeries: { timestamp: string; value: number }[];
}) {
  if (breakdown.length > 0) {
    const maxVal = Math.max(...breakdown.map((b) => b.value), 1);
    return (
      <div className="space-y-3 py-2">
        {breakdown.map((item, idx) => {
          const color = PALETTE[idx % PALETTE.length];
          const barWidth = Math.max(2, (item.value / maxVal) * 100);
          return (
            <div key={item.name} className="group">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="font-medium text-zinc-300 truncate max-w-[280px]">
                  {item.name}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-zinc-100">
                    {item.value.toLocaleString()}
                  </span>
                  <Badge variant="outline" className="text-[10px] text-zinc-400 font-mono">
                    {item.percentage}%
                  </Badge>
                </div>
              </div>
              <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Fallback to timeSeries bars
  const maxVal = Math.max(...timeSeries.map((t) => t.value), 1);
  return (
    <div className="h-64 flex items-end gap-1.5 pt-6 pb-2">
      {timeSeries.map((p, i) => {
        const heightPct = Math.max(4, (p.value / maxVal) * 100);
        return (
          <div
            key={i}
            className="flex-1 flex flex-col items-center group relative h-full justify-end"
          >
            <div
              className="w-full bg-emerald-500/80 hover:bg-emerald-400 rounded-t transition-all"
              style={{ height: `${heightPct}%` }}
            />
            <div className="opacity-0 group-hover:opacity-100 absolute -top-7 bg-zinc-900 border border-zinc-700 px-2 py-0.5 rounded text-[10px] text-zinc-200 pointer-events-none whitespace-nowrap z-10">
              {p.value.toLocaleString()}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RenderDonutChart({
  breakdown,
  total,
}: {
  breakdown: { name: string; value: number; percentage: number }[];
  total: number;
}) {
  if (!breakdown.length) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-zinc-500">
        Breakdown is required to render a donut chart. Choose a breakdown dimension.
      </div>
    );
  }

  const size = 200;
  const strokeWidth = 26;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  return (
    <div className="flex flex-col md:flex-row items-center justify-around gap-6 py-4">
      <div className="relative w-48 h-48 flex items-center justify-center">
        <svg width={size} height={size} className="-rotate-90 transform">
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke="#27272a"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {breakdown.map((item, idx) => {
            const strokeDasharray = `${(item.percentage / 100) * circumference} ${circumference}`;
            const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
            accumulatedPercent += item.percentage;
            return (
              <circle
                key={item.name}
                cx={center}
                cy={center}
                r={radius}
                stroke={PALETTE[idx % PALETTE.length]}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                fill="none"
                className="transition-all duration-300 hover:opacity-80"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold text-zinc-100">{total.toLocaleString()}</span>
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Total</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 max-w-xs w-full">
        {breakdown.slice(0, 7).map((item, idx) => (
          <div key={item.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: PALETTE[idx % PALETTE.length] }}
              />
              <span className="text-zinc-300 truncate max-w-[140px]">{item.name}</span>
            </div>
            <div className="flex items-center gap-2 font-mono">
              <span className="text-zinc-400">{item.value.toLocaleString()}</span>
              <span className="text-zinc-500 font-semibold">{item.percentage}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RenderTable({
  headers,
  rows,
  page,
  setPage,
  pageSize,
}: {
  headers: string[];
  rows: Record<string, any>[];
  page: number;
  setPage: (p: number) => void;
  pageSize: number;
}) {
  if (!rows.length) {
    return (
      <div className="h-48 flex items-center justify-center text-xs text-zinc-500">
        No rows to display
      </div>
    );
  }

  const totalPages = Math.ceil(rows.length / pageSize);
  const paginatedRows = rows.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded border border-zinc-800">
        <table className="w-full text-left text-xs text-zinc-300">
          <thead className="bg-zinc-900 border-b border-zinc-800 text-[11px] text-zinc-400 uppercase tracking-wider">
            <tr>
              {headers.map((h) => (
                <th key={h} className="px-4 py-2.5 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {paginatedRows.map((r, i) => (
              <tr key={i} className="hover:bg-zinc-900/40 transition-colors">
                {headers.map((h) => (
                  <td key={h} className="px-4 py-2.5 font-mono text-zinc-200">
                    {typeof r[h] === 'number' ? r[h].toLocaleString() : String(r[h] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-zinc-400 pt-2">
          <span>
            Showing {page * pageSize + 1} - {Math.min((page + 1) * pageSize, rows.length)} of{' '}
            {rows.length}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              className="h-7 text-xs border-zinc-800"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(page + 1)}
              className="h-7 text-xs border-zinc-800"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
