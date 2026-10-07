'use client';

import * as React from 'react';
import {
  LineChart as LineChartIcon,
  BarChart2,
  PieChart as PieChartIcon,
  Table as TableIcon,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { InsightQueryResult, InsightChartType, InsightBreakdownItem, InsightTimeSeriesPoint } from '../types';

interface InsightsChartProps {
  data: InsightQueryResult | null;
  loading?: boolean;
  chartType: InsightChartType;
  onChartTypeChange?: (type: InsightChartType) => void;
  className?: string;
}

const SIGNAL = 'var(--chart-1, var(--signal, #76d5c3))';
const SERIES = [
  SIGNAL,
  'var(--chart-2, var(--comparison, #94b5de))',
  'var(--chart-3, #c4adeb)',
  'var(--chart-4, #eac483)',
  'var(--chart-5, #e79ab0)',
  'var(--chart-6, #89c8ce)',
  'var(--chart-7, #b9cb91)',
  'var(--chart-8, #e7ab8d)',
];
const axisColor = 'var(--muted, #B3C6C8)';
const edgeColor = 'var(--edge, #33515A)';
const tooltipStyle = {
  backgroundColor: 'var(--surface, #16262D)',
  border: `1px solid ${edgeColor}`,
  borderRadius: 6,
  color: 'var(--foreground, #F0F5F3)',
  fontSize: 12,
};
const number = (value: number) => value.toLocaleString();
const formatDate = (timestamp: string) => {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp : date.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  }) + ' UTC';
};
const tickDate = (timestamp: string, showTime: boolean) => {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp : (showTime
    ? date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', timeZone: 'UTC' })
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }));
};
const hasHourlyBuckets = (points: InsightTimeSeriesPoint[]) => points.length > 1 &&
  new Date(points[points.length - 1].timestamp).getTime() - new Date(points[0].timestamp).getTime() <= 2 * 86400000;

export function InsightsChart({ data, loading, chartType, onChartTypeChange, className }: InsightsChartProps) {
  const [tablePage, setTablePage] = React.useState(0);
  const pageSize = 10;
  React.useEffect(() => setTablePage(0), [data]);

  if (loading) {
    return (
      <Card className={cn('border-[var(--edge,#33515A)] bg-[var(--surface,#16262D)] p-6', className)} aria-busy="true">
        <div className="h-64 flex items-center justify-center text-sm text-[var(--muted,#B3C6C8)]" role="status">
          Computing insight…
        </div>
      </Card>
    );
  }

  if (!data || (data.timeSeries.length === 0 && data.breakdown.length === 0 && data.tableRows.length === 0 && data.summaryValue === 0)) {
    return (
      <Card className={cn('border-[var(--edge,#33515A)] bg-[var(--surface,#16262D)] p-6', className)}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h3 className="text-sm font-medium text-[var(--foreground,#F0F5F3)]">Query results</h3>
          <ChartTypeSelector active={chartType} onChange={onChartTypeChange} />
        </div>
        <div className="min-h-48 border border-dashed border-[var(--edge,#33515A)] rounded flex flex-col items-center justify-center p-6 text-center">
          <p className="text-sm font-medium text-[var(--foreground,#F0F5F3)]">{data ? 'No events matched this query' : 'Run a query to see results'}</p>
          {data && <p className="text-sm text-[var(--muted,#B3C6C8)] mt-1 max-w-sm">
            Try a wider date range, fewer filters, or a different event name.
          </p>}
        </div>
      </Card>
    );
  }

  const aggregationLabel: Record<string, string> = {
    count: 'Event count', unique_users: 'Unique users', unique_sessions: 'Unique sessions',
    avg: 'Average', sum: 'Sum', min: 'Minimum', max: 'Maximum',
  };

  return (
    <Card className={cn('min-w-0 border-[var(--edge,#33515A)] bg-[var(--surface,#16262D)]', className)}>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--edge,#33515A)] pb-4">
        <div>
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="text-sm text-[var(--muted,#B3C6C8)]">{aggregationLabel[data.query.aggregation]}</span>
            <span className="text-2xl font-semibold tabular-nums text-[var(--foreground,#F0F5F3)]">{number(data.summaryValue)}</span>
          </div>
          <p className="text-sm text-[var(--muted,#B3C6C8)] mt-1">{data.query.dateRange === 'custom' ? 'Custom date range' : `Last ${data.query.dateRange.slice(0, -1)} days`}</p>
        </div>
        <ChartTypeSelector active={chartType} onChange={onChartTypeChange} />
      </CardHeader>
      <CardContent className="min-w-0 pt-5">
        {chartType === 'line' && <RenderLineChart timeSeries={data.timeSeries} />}
        {chartType === 'bar' && <RenderBarChart breakdown={data.breakdown} timeSeries={data.timeSeries} />}
        {chartType === 'donut' && <RenderDonutChart data={data} />}
        {chartType === 'table' && (
          <RenderTable headers={data.tableHeaders} rows={data.tableRows} page={tablePage} setPage={setTablePage} pageSize={pageSize} />
        )}
      </CardContent>
    </Card>
  );
}

function ChartTypeSelector({ active, onChange }: { active: InsightChartType; onChange?: (type: InsightChartType) => void }) {
  if (!onChange) return null;
  const types: { id: InsightChartType; label: string; icon: React.ReactNode }[] = [
    { id: 'line', label: 'Line', icon: <LineChartIcon className="w-4 h-4" /> },
    { id: 'bar', label: 'Bar', icon: <BarChart2 className="w-4 h-4" /> },
    { id: 'donut', label: 'Donut', icon: <PieChartIcon className="w-4 h-4" /> },
    { id: 'table', label: 'Table', icon: <TableIcon className="w-4 h-4" /> },
  ];
  return (
    <div role="group" aria-label="Result display" className="flex flex-wrap gap-1">
      {types.map((type) => (
        <button key={type.id} type="button" aria-pressed={active === type.id} onClick={() => onChange(type.id)}
          className={cn('flex min-h-9 items-center gap-1.5 px-2.5 text-sm rounded border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--signal,#76d5c3)]',
            active === type.id ? 'border-[var(--signal,#76d5c3)] text-[var(--foreground,#F0F5F3)]' : 'border-[var(--edge,#33515A)] text-[var(--muted,#B3C6C8)] hover:text-[var(--foreground,#F0F5F3)]')}
        >
          {type.icon}{type.label}
        </button>
      ))}
    </div>
  );
}

function ChartDataTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-4 text-sm text-[var(--muted,#B3C6C8)]">
      <summary className="cursor-pointer w-fit rounded py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--signal,#76d5c3)]">View exact chart data</summary>
      <div className="mt-2 max-h-64 overflow-auto rounded border border-[var(--edge,#33515A)]">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-[var(--surface,#16262D)]"><tr>{headers.map((header) => <th key={header} scope="col" className="px-3 py-2 font-medium">{header}</th>)}</tr></thead>
          <tbody>{rows.map((row, index) => <tr key={index} className="border-t border-[var(--edge,#33515A)]">{row.map((cell, cellIndex) => <td key={cellIndex} className="px-3 py-2 tabular-nums">{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </details>
  );
}

function RenderLineChart({ timeSeries }: { timeSeries: InsightTimeSeriesPoint[] }) {
  if (!timeSeries.length) return <p className="py-16 text-center text-sm text-[var(--muted,#B3C6C8)]">No time-series data available for this query.</p>;
  return (
    <div>
      <figure className="h-64 w-full min-w-0">
        <figcaption className="sr-only">Insight value over time. Use the chart keyboard controls or view exact chart data below.</figcaption>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={timeSeries} accessibilityLayer margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={edgeColor} strokeDasharray="3 4" />
            <XAxis dataKey="timestamp" tickFormatter={(timestamp: string) => tickDate(timestamp, hasHourlyBuckets(timeSeries))} stroke={axisColor} tick={{ fontSize: 12 }} minTickGap={30} />
            <YAxis width={48} stroke={axisColor} tick={{ fontSize: 12 }} tickFormatter={(value: number) => number(value)} domain={['auto', 'auto']} />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={(label) => formatDate(String(label))} formatter={(value) => [number(Number(value)), 'Value']} />
            <Line type="linear" dataKey="value" name="Value" stroke={SIGNAL} strokeWidth={2} dot={timeSeries.length === 1} activeDot={{ r: 5 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </figure>
      <ChartDataTable headers={['Time (UTC)', 'Value']} rows={timeSeries.map((point) => [formatDate(point.timestamp), number(point.value)])} />
    </div>
  );
}

function RenderBarChart({ breakdown, timeSeries }: { breakdown: InsightBreakdownItem[]; timeSeries: InsightTimeSeriesPoint[] }) {
  if (!breakdown.length && !timeSeries.length) return <p className="py-16 text-center text-sm text-[var(--muted,#B3C6C8)]">No values to chart for this query.</p>;
  if (breakdown.length) {
    return (
      <div>
        <figure style={{ height: Math.max(220, breakdown.length * 36 + 36) }} className="w-full min-w-0">
          <figcaption className="sr-only">Insight values by breakdown. Exact values and shares are available below.</figcaption>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={breakdown} layout="vertical" accessibilityLayer margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
              <XAxis type="number" stroke={axisColor} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={86} stroke={axisColor} tick={{ fontSize: 12 }} tickFormatter={(name: string) => name.length > 12 ? `${name.slice(0, 11)}…` : name} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [number(Number(value)), 'Value']} />
              <Bar dataKey="value" fill={SIGNAL} maxBarSize={20} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </figure>
        <ChartDataTable headers={['Dimension', 'Value', 'Share of returned breakdown']} rows={breakdown.map((item) => [item.name, number(item.value), `${item.percentage}%`])} />
      </div>
    );
  }
  return (
    <div>
      <figure className="h-64 w-full min-w-0">
        <figcaption className="sr-only">Insight values by time. Exact values are available below.</figcaption>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={timeSeries} accessibilityLayer margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={edgeColor} strokeDasharray="3 4" />
            <XAxis dataKey="timestamp" tickFormatter={(timestamp: string) => tickDate(timestamp, hasHourlyBuckets(timeSeries))} stroke={axisColor} tick={{ fontSize: 12 }} minTickGap={30} />
            <YAxis width={48} stroke={axisColor} tick={{ fontSize: 12 }} tickFormatter={(value: number) => number(value)} />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={(label) => formatDate(String(label))} formatter={(value) => [number(Number(value)), 'Value']} />
            <Bar dataKey="value" name="Value" fill={SIGNAL} maxBarSize={28} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </figure>
      <ChartDataTable headers={['Time (UTC)', 'Value']} rows={timeSeries.map((point) => [formatDate(point.timestamp), number(point.value)])} />
    </div>
  );
}

function RenderDonutChart({ data }: { data: InsightQueryResult }) {
  const breakdown = data.breakdown;
  if (!breakdown.length) return <p className="py-16 text-center text-sm text-[var(--muted,#B3C6C8)]">Choose a breakdown dimension to see a distribution.</p>;
  const sum = breakdown.reduce((total, item) => total + item.value, 0);
  // A part-to-whole is only valid for an additive metric with every category present.
  if (breakdown.length > 8 || !['count', 'sum'].includes(data.query.aggregation) ||
      breakdown.some((item) => item.value < 0) || sum <= 0 || Math.abs(sum - data.summaryValue) > 0.01) {
    return <p className="py-16 text-center text-sm text-[var(--muted,#B3C6C8)]">A donut needs up to 8 categories that add up to the total. Choose Bar or Table to inspect this result.</p>;
  }
  return (
    <div>
      <figure className="h-64 w-full min-w-0">
        <figcaption className="sr-only">Insight breakdown by share of total. Exact values are available below.</figcaption>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart accessibilityLayer>
            <Pie data={breakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="55%" outerRadius="80%" paddingAngle={0} isAnimationActive={false}>
              {breakdown.map((item, index) => <Cell key={`${item.name}-${index}`} fill={SERIES[index]} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => [number(Number(value)), 'Value']} />
          </PieChart>
        </ResponsiveContainer>
      </figure>
      <ChartDataTable headers={['Dimension', 'Value', 'Share of returned breakdown']} rows={breakdown.map((item) => [item.name, number(item.value), `${item.percentage}%`])} />
    </div>
  );
}

function RenderTable({ headers, rows, page, setPage, pageSize }: {
  headers: string[]; rows: Record<string, any>[]; page: number; setPage: (page: number) => void; pageSize: number;
}) {
  if (!rows.length) return <p className="py-16 text-center text-sm text-[var(--muted,#B3C6C8)]">No rows to display.</p>;
  const totalPages = Math.ceil(rows.length / pageSize);
  const currentPage = Math.min(page, totalPages - 1);
  const paginatedRows = rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded border border-[var(--edge,#33515A)]">
        <table className="w-full text-left text-sm text-[var(--foreground,#F0F5F3)]">
          <thead className="border-b border-[var(--edge,#33515A)] text-[var(--muted,#B3C6C8)]">
            <tr>{headers.map((header) => <th key={header} scope="col" className="px-4 py-2.5 font-medium">{header}</th>)}</tr>
          </thead>
          <tbody>{paginatedRows.map((row, index) => (
            <tr key={currentPage * pageSize + index} className="border-b border-[var(--edge,#33515A)] last:border-0">
              {headers.map((header) => <td key={header} className="px-4 py-2.5 tabular-nums">{typeof row[header] === 'number' ? number(row[header]) : String(row[header] ?? '')}</td>)}
            </tr>
          ))}</tbody>
        </table>
      </div>
      {totalPages > 1 && <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--muted,#B3C6C8)]">
        <span>Showing {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, rows.length)} of {rows.length}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={currentPage >= totalPages - 1} onClick={() => setPage(currentPage + 1)}>Next</Button>
        </div>
      </div>}
    </div>
  );
}
