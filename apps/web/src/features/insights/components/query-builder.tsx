'use client';

import * as React from 'react';
import { Play, Download, BookmarkPlus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { runInsightQueryAction, saveInsightAction } from '../actions';
import { InsightsChart } from './insights-chart';
import type {
  InsightQueryConfig, InsightQueryResult, InsightAggregation, InsightFilterOperator,
  InsightDateRange, InsightChartType, InsightFilter,
} from '../types';

interface QueryBuilderProps {
  projectId: string;
  projectSlug: string;
  initialQuery?: Partial<InsightQueryConfig>;
}

const COMMON_EVENTS = [
  { value: '$pageview', label: '$pageview (automatic)' },
  { value: 'signup_completed', label: 'signup_completed (requires instrumentation)' },
  { value: 'button_clicked', label: 'button_clicked (requires instrumentation)' },
  { value: 'pricing_viewed', label: 'pricing_viewed (requires instrumentation)' },
  { value: 'checkout_started', label: 'checkout_started (requires instrumentation)' },
  { value: 'purchase_completed', label: 'purchase_completed (requires instrumentation)' },
];

const AGGREGATION_OPTIONS: { value: InsightAggregation; label: string }[] = [
  { value: 'count', label: 'Event count' },
  { value: 'unique_users', label: 'Unique users' },
  { value: 'unique_sessions', label: 'Unique sessions' },
  { value: 'avg', label: 'Average (numeric property)' },
  { value: 'sum', label: 'Sum (numeric property)' },
  { value: 'min', label: 'Minimum (numeric property)' },
  { value: 'max', label: 'Maximum (numeric property)' },
];

const FILTER_OPERATORS: { value: InsightFilterOperator; label: string }[] = [
  { value: 'equals', label: 'equals' },
  { value: 'does_not_equal', label: 'does not equal' },
  { value: 'contains', label: 'contains' },
  { value: 'is_set', label: 'is set' },
  { value: 'greater_than', label: 'greater than' },
  { value: 'less_than', label: 'less than' },
];

const BREAKDOWN_OPTIONS = [
  { value: 'none', label: 'None (overall)' },
  { value: 'browser', label: 'Browser' },
  { value: 'os', label: 'Operating system' },
  { value: 'deviceType', label: 'Device type' },
  { value: 'countryCode', label: 'Country code' },
  { value: 'pagePath', label: 'Page path' },
  { value: 'utmSource', label: 'UTM source' },
  { value: 'utmCampaign', label: 'UTM campaign' },
  { value: 'properties.tier', label: 'Custom: properties.tier' },
  { value: 'properties.plan', label: 'Custom: properties.plan' },
];

const DATE_RANGES: { value: InsightDateRange; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

function DateRangeSelect({ id, value, onChange }: {
  id: string;
  value: InsightDateRange;
  onChange: (value: InsightDateRange) => void;
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as InsightDateRange)}>
      <SelectTrigger id={id}><SelectValue placeholder="Choose a date range" /></SelectTrigger>
      <SelectContent>
        {value === 'custom' && <SelectItem value="custom">Custom range (saved query)</SelectItem>}
        {DATE_RANGES.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function QueryBuilder({ projectId, projectSlug, initialQuery }: QueryBuilderProps) {
  const id = React.useId();
  const initialEvent = initialQuery?.eventNames?.[0] || '$pageview';
  const initialIsCustom = initialEvent !== '*' && !COMMON_EVENTS.some((event) => event.value === initialEvent);
  const [selectedEvent, setSelectedEvent] = React.useState(initialIsCustom ? 'custom' : initialEvent);
  const [customEventInput, setCustomEventInput] = React.useState(initialIsCustom ? initialEvent : '');
  const [aggregation, setAggregation] = React.useState<InsightAggregation>(initialQuery?.aggregation || 'count');
  const [aggregationProperty, setAggregationProperty] = React.useState(initialQuery?.aggregationProperty || '');
  const [filters, setFilters] = React.useState<InsightFilter[]>(initialQuery?.filters || []);
  const [breakdown, setBreakdown] = React.useState(initialQuery?.breakdown || 'none');
  const [dateRange, setDateRange] = React.useState<InsightDateRange>(initialQuery?.dateRange || '30d');
  const [chartType, setChartType] = React.useState<InsightChartType>(initialQuery?.chartType || 'line');
  const [loading, setLoading] = React.useState(false);
  const [queryResult, setQueryResult] = React.useState<InsightQueryResult | null>(null);
  const [isSaveModalOpen, setIsSaveModalOpen] = React.useState(false);
  const [insightName, setInsightName] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const activeEventName = selectedEvent === 'custom' ? customEventInput.trim() : selectedEvent;
  const needsProperty = ['avg', 'sum', 'min', 'max'].includes(aggregation);
  const canRun = Boolean(activeEventName && (!needsProperty || aggregationProperty.trim()));
  const currentConfig: InsightQueryConfig = React.useMemo(() => ({
    eventNames: activeEventName !== '*' ? [activeEventName] : undefined,
    aggregation,
    aggregationProperty: needsProperty ? aggregationProperty.trim() : undefined,
    filters: filters.filter((filter) => filter.property.trim().length > 0),
    breakdown: breakdown !== 'none' ? breakdown : undefined,
    dateRange,
    ...(dateRange === 'custom' ? { customFrom: initialQuery?.customFrom, customTo: initialQuery?.customTo } : {}),
    chartType,
  }), [activeEventName, aggregation, needsProperty, aggregationProperty, filters, breakdown, dateRange, initialQuery?.customFrom, initialQuery?.customTo, chartType]);

  const runQuery = React.useCallback(async () => {
    if (!canRun) return;
    setLoading(true);
    try {
      const res = await runInsightQueryAction(projectId, currentConfig);
      if (res.success) setQueryResult(res.data);
      else toast.error(res.error || 'Could not run this query');
    } catch (err: any) {
      toast.error(err?.message || 'Could not run this query');
    } finally {
      setLoading(false);
    }
  }, [projectId, currentConfig, canRun]);

  // Run the initial query once; changes to the controls wait for Run query.
  React.useEffect(() => {
    void runQuery();
  }, []);

  const updateFilter = (index: number, updated: Partial<InsightFilter>) => {
    setFilters(filters.map((filter, i) => i === index ? { ...filter, ...updated } : filter));
  };

  const handleExportCsv = () => {
    if (!queryResult) {
      toast.error('No query results to export');
      return;
    }
    let csv = '';
    if (queryResult.tableRows.length > 0 && queryResult.tableHeaders.length > 0) {
      const headers = queryResult.tableHeaders;
      const rows = queryResult.tableRows.map((row) => headers.map((header) => JSON.stringify(row[header] ?? '')).join(','));
      csv = [headers.join(','), ...rows].join('\n');
    } else {
      csv = 'Metric,Value\nTotal,' + queryResult.summaryValue;
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `opentrack-insight-${dateRange}-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Query results exported to CSV');
  };

  const handleSaveInsight = async () => {
    if (!insightName.trim()) {
      toast.error('Enter a name for the insight');
      return;
    }
    setSaving(true);
    try {
      const res = await saveInsightAction(projectId, {
        name: insightName.trim(), type: chartType === 'table' ? 'table' : 'trend', queryConfig: currentConfig,
      });
      if (res.success) {
        toast.success(`Insight "${res.insight.name}" saved`);
        setIsSaveModalOpen(false);
        setInsightName('');
      } else toast.error(res.error || 'Could not save the insight');
    } catch (err: any) {
      toast.error(err?.message || 'Could not save the insight');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-edge/60 pb-5 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Insights</h1>
          <p className="mt-1 text-sm text-muted">Explore events and properties for {projectSlug}. Only $pageview is captured automatically; other events need instrumentation.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={!queryResult}>
            <Download aria-hidden="true" className="h-4 w-4" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsSaveModalOpen(true)} disabled={!canRun}>
            <BookmarkPlus aria-hidden="true" className="h-4 w-4" /> Save insight
          </Button>
          <Button size="sm" onClick={runQuery} disabled={loading || !canRun} aria-busy={loading}>
            <Play aria-hidden="true" className="h-4 w-4" /> {loading ? 'Running…' : 'Run query'}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Build a query</CardTitle>
          <CardDescription>Choose an event, a metric, and optional filters. Example event and property names only return data if your app captures them.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label htmlFor={`${id}-event`} className="text-sm font-medium">Event</label>
              <Select value={selectedEvent} onValueChange={(value) => {
                setSelectedEvent(value);
                if (value !== 'custom') setCustomEventInput('');
              }}>
                <SelectTrigger id={`${id}-event`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="*">All captured events</SelectItem>
                  {COMMON_EVENTS.map((event) => <SelectItem key={event.value} value={event.value}>{event.label}</SelectItem>)}
                  <SelectItem value="custom">Enter an event name…</SelectItem>
                </SelectContent>
              </Select>
              {selectedEvent === 'custom' && <>
                <label htmlFor={`${id}-custom-event`} className="sr-only">Custom event name</label>
                <Input id={`${id}-custom-event`} placeholder="e.g. signup_completed" value={customEventInput} onChange={(event) => setCustomEventInput(event.target.value)} className="font-mono" />
              </>}
            </div>
            <div className="space-y-2">
              <label htmlFor={`${id}-aggregation`} className="text-sm font-medium">Metric</label>
              <Select value={aggregation} onValueChange={(value) => setAggregation(value as InsightAggregation)}>
                <SelectTrigger id={`${id}-aggregation`}><SelectValue /></SelectTrigger>
                <SelectContent>{AGGREGATION_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {needsProperty ? <div className="space-y-2">
              <label htmlFor={`${id}-aggregation-property`} className="text-sm font-medium">Numeric property key</label>
              <Input id={`${id}-aggregation-property`} placeholder="e.g. properties.order_value" value={aggregationProperty} onChange={(event) => setAggregationProperty(event.target.value)} className="font-mono" />
            </div> : <div className="space-y-2">
              <label htmlFor={`${id}-date-range`} className="text-sm font-medium">Date range</label>
              <DateRangeSelect id={`${id}-date-range`} value={dateRange} onChange={setDateRange} />
            </div>}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor={`${id}-breakdown`} className="text-sm font-medium">Group by</label>
              <Select value={breakdown} onValueChange={setBreakdown}>
                <SelectTrigger id={`${id}-breakdown`}><SelectValue /></SelectTrigger>
                <SelectContent>{BREAKDOWN_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {needsProperty && <div className="space-y-2">
              <label htmlFor={`${id}-date-range`} className="text-sm font-medium">Date range</label>
              <DateRangeSelect id={`${id}-date-range`} value={dateRange} onChange={setDateRange} />
            </div>}
          </div>

          <div className="border-t border-edge/60 pt-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium">Filters ({filters.length})</h2>
              <Button variant="outline" size="sm" onClick={() => setFilters([...filters, { property: '', operator: 'equals', value: '' }])}>
                <Plus aria-hidden="true" className="h-4 w-4" /> Add filter
              </Button>
            </div>
            {filters.length === 0 ? <p className="text-sm text-muted">No filters. Results include all matching events.</p> :
              <div className="space-y-2">{filters.map((filter, index) => (
                <div key={index} role="group" aria-label={`Filter ${index + 1}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-edge/60 bg-background/40 p-3">
                  <label htmlFor={`${id}-filter-${index}-property`} className="sr-only">Filter {index + 1} property</label>
                  <Input id={`${id}-filter-${index}-property`} placeholder="Property key" value={filter.property} onChange={(event) => updateFilter(index, { property: event.target.value })} className="min-w-40 flex-1 font-mono" />
                  <label htmlFor={`${id}-filter-${index}-operator`} className="sr-only">Filter {index + 1} operator</label>
                  <Select value={filter.operator} onValueChange={(value) => updateFilter(index, { operator: value as InsightFilterOperator })}>
                    <SelectTrigger id={`${id}-filter-${index}-operator`} className="w-full sm:w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>{FILTER_OPERATORS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                  </Select>
                  {filter.operator !== 'is_set' && <>
                    <label htmlFor={`${id}-filter-${index}-value`} className="sr-only">Filter {index + 1} value</label>
                    <Input id={`${id}-filter-${index}-value`} placeholder="Value" value={String(filter.value ?? '')} onChange={(event) => updateFilter(index, { value: event.target.value })} className="min-w-32 flex-1" />
                  </>}
                  <Button variant="ghost" size="icon" aria-label={`Remove filter ${index + 1}`} onClick={() => setFilters(filters.filter((_, i) => i !== index))}>
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                  </Button>
                </div>
              ))}</div>}
          </div>
        </CardContent>
      </Card>

      <InsightsChart data={queryResult} loading={loading} chartType={chartType} onChartTypeChange={setChartType} />

      <Dialog open={isSaveModalOpen} onOpenChange={setIsSaveModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save insight</DialogTitle>
            <DialogDescription>Save this query configuration for quick access. Results depend on captured events.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label htmlFor={`${id}-insight-name`} className="text-sm font-medium">Insight name</label>
            <Input id={`${id}-insight-name`} placeholder="e.g. Signups by browser" value={insightName} onChange={(event) => setInsightName(event.target.value)} />
            <p className="break-words text-sm text-muted">Event: {activeEventName === '*' ? 'All captured events' : activeEventName} · Metric: {AGGREGATION_OPTIONS.find((option) => option.value === aggregation)?.label} · Group by: {breakdown === 'none' ? 'none' : breakdown}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsSaveModalOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSaveInsight} disabled={saving}>{saving ? 'Saving…' : 'Save insight'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
