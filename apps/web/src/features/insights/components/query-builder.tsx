'use client';

import * as React from 'react';
import {
  Play,
  Download,
  BookmarkPlus,
  Plus,
  Trash2,
  Filter as FilterIcon,
  Layers,
  Calendar,
  Sparkles,
  BarChart2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { runInsightQueryAction, saveInsightAction } from '../actions';
import { InsightsChart } from './insights-chart';
import type {
  InsightQueryConfig,
  InsightQueryResult,
  InsightAggregation,
  InsightFilterOperator,
  InsightDateRange,
  InsightChartType,
  InsightFilter,
} from '../types';

interface QueryBuilderProps {
  projectId: string;
  projectSlug: string;
  initialQuery?: Partial<InsightQueryConfig>;
}

const COMMON_EVENTS = [
  { value: '$pageview', label: '$pageview (Page View)' },
  { value: 'signup_completed', label: 'signup_completed' },
  { value: 'button_clicked', label: 'button_clicked' },
  { value: 'pricing_viewed', label: 'pricing_viewed' },
  { value: 'checkout_started', label: 'checkout_started' },
  { value: 'purchase_completed', label: 'purchase_completed' },
];

const AGGREGATION_OPTIONS: { value: InsightAggregation; label: string; requiresProperty?: boolean }[] = [
  { value: 'count', label: 'Total Events (COUNT)' },
  { value: 'unique_users', label: 'Unique Users (COUNT DISTINCT)' },
  { value: 'unique_sessions', label: 'Unique Sessions' },
  { value: 'avg', label: 'Average (AVG)', requiresProperty: true },
  { value: 'sum', label: 'Sum (SUM)', requiresProperty: true },
  { value: 'min', label: 'Minimum (MIN)', requiresProperty: true },
  { value: 'max', label: 'Maximum (MAX)', requiresProperty: true },
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
  { value: 'none', label: 'None (Overall)' },
  { value: 'browser', label: 'Browser' },
  { value: 'os', label: 'Operating System' },
  { value: 'deviceType', label: 'Device Type' },
  { value: 'countryCode', label: 'Country Code' },
  { value: 'pagePath', label: 'Page Path' },
  { value: 'utmSource', label: 'UTM Source' },
  { value: 'utmCampaign', label: 'UTM Campaign' },
  { value: 'properties.tier', label: 'Custom: properties.tier' },
  { value: 'properties.plan', label: 'Custom: properties.plan' },
];

export function QueryBuilder({
  projectId,
  projectSlug,
  initialQuery,
}: QueryBuilderProps) {
  // Query State
  const [selectedEvent, setSelectedEvent] = React.useState<string>(
    initialQuery?.eventNames?.[0] || '$pageview'
  );
  const [customEventInput, setCustomEventInput] = React.useState<string>('');
  const [aggregation, setAggregation] = React.useState<InsightAggregation>(
    initialQuery?.aggregation || 'count'
  );
  const [aggregationProperty, setAggregationProperty] = React.useState<string>(
    initialQuery?.aggregationProperty || 'properties.order_value'
  );
  const [filters, setFilters] = React.useState<InsightFilter[]>(
    initialQuery?.filters || []
  );
  const [breakdown, setBreakdown] = React.useState<string>(
    initialQuery?.breakdown || 'none'
  );
  const [dateRange, setDateRange] = React.useState<InsightDateRange>(
    initialQuery?.dateRange || '30d'
  );
  const [chartType, setChartType] = React.useState<InsightChartType>(
    initialQuery?.chartType || 'line'
  );

  // Execution State
  const [loading, setLoading] = React.useState(false);
  const [queryResult, setQueryResult] = React.useState<InsightQueryResult | null>(null);

  // Save Modal State
  const [isSaveModalOpen, setIsSaveModalOpen] = React.useState(false);
  const [insightName, setInsightName] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const activeEventName = customEventInput.trim() ? customEventInput.trim() : selectedEvent;

  const currentConfig: InsightQueryConfig = React.useMemo(() => {
    return {
      eventNames: activeEventName && activeEventName !== '*' ? [activeEventName] : undefined,
      aggregation,
      aggregationProperty:
        ['avg', 'sum', 'min', 'max'].includes(aggregation) ? aggregationProperty : undefined,
      filters: filters.filter((f) => f.property.trim().length > 0),
      breakdown: breakdown !== 'none' ? breakdown : undefined,
      dateRange,
      chartType,
    };
  }, [activeEventName, aggregation, aggregationProperty, filters, breakdown, dateRange, chartType]);

  const runQuery = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await runInsightQueryAction(projectId, currentConfig);
      if (res.success) {
        setQueryResult(res.data);
      } else {
        toast.error(res.error || 'Failed to execute insight query');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error running query');
    } finally {
      setLoading(false);
    }
  }, [projectId, currentConfig]);

  // Run initial query on mount
  React.useEffect(() => {
    runQuery();
  }, []);

  const addFilter = () => {
    setFilters([...filters, { property: 'browser', operator: 'equals', value: 'Chrome' }]);
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const updateFilter = (index: number, updated: Partial<InsightFilter>) => {
    setFilters(
      filters.map((f, i) => (i === index ? { ...f, ...updated } : f))
    );
  };

  const handleExportCsv = () => {
    if (!queryResult) {
      toast.error('No query results to export');
      return;
    }

    let csv = '';
    if (queryResult.tableRows.length > 0 && queryResult.tableHeaders.length > 0) {
      const headers = queryResult.tableHeaders;
      const rows = queryResult.tableRows.map((row) =>
        headers.map((h) => JSON.stringify(row[h] ?? '')).join(',')
      );
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
      toast.error('Please enter a name for the insight');
      return;
    }
    setSaving(true);
    try {
      const res = await saveInsightAction(projectId, {
        name: insightName.trim(),
        type: chartType === 'table' ? 'table' : 'trend',
        queryConfig: currentConfig,
      });

      if (res.success) {
        toast.success(`Insight "${res.insight.name}" saved!`);
        setIsSaveModalOpen(false);
        setInsightName('');
      } else {
        toast.error(res.error || 'Failed to save insight');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error saving insight');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header / Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-100">Custom Insights</h1>
            <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-mono">
              Engine
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            Ad-hoc SQL query builder, multi-mode charts, and breakdowns for project {projectSlug}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={!queryResult}
            className="border-zinc-800 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-850 text-xs h-8"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSaveModalOpen(true)}
            className="border-zinc-800 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-850 text-xs h-8"
          >
            <BookmarkPlus className="w-3.5 h-3.5 mr-1.5" />
            Save Insight
          </Button>

          <Button
            size="sm"
            onClick={runQuery}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 font-medium shadow-sm transition-all"
          >
            {loading ? (
              <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
            ) : (
              <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
            )}
            Run Query
          </Button>
        </div>
      </div>

      {/* Query Builder Controls Panel */}
      <Card className="border-zinc-800/80 bg-zinc-950">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            Query Builder
          </CardTitle>
          <CardDescription className="text-xs text-zinc-400">
            Configure events, metrics, arbitrary property filters, and group-by dimensions.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Row 1: Event & Aggregation */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Event Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Event</label>
              <div className="flex gap-2">
                <select
                  value={selectedEvent}
                  onChange={(e) => {
                    setSelectedEvent(e.target.value);
                    if (e.target.value !== 'custom') setCustomEventInput('');
                  }}
                  className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
                >
                  <option value="*">All Events (*)</option>
                  {COMMON_EVENTS.map((ev) => (
                    <option key={ev.value} value={ev.value}>
                      {ev.label}
                    </option>
                  ))}
                  <option value="custom">+ Custom Event Name...</option>
                </select>
              </div>
              {selectedEvent === 'custom' && (
                <Input
                  type="text"
                  placeholder="e.g. checkout_completed"
                  value={customEventInput}
                  onChange={(e) => setCustomEventInput(e.target.value)}
                  className="h-8 text-xs bg-zinc-900 border-zinc-800 mt-1"
                />
              )}
            </div>

            {/* Aggregation Function */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Aggregation</label>
              <select
                value={aggregation}
                onChange={(e) => setAggregation(e.target.value as InsightAggregation)}
                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
              >
                {AGGREGATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Numeric Property if avg / sum / min / max */}
            {['avg', 'sum', 'min', 'max'].includes(aggregation) ? (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Property Key (Numeric)</label>
                <Input
                  type="text"
                  placeholder="properties.order_value"
                  value={aggregationProperty}
                  onChange={(e) => setAggregationProperty(e.target.value)}
                  className="h-8 text-xs bg-zinc-900 border-zinc-800"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Date Range</label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as InsightDateRange)}
                  className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
                >
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="90d">Last 90 Days</option>
                </select>
              </div>
            )}
          </div>

          {/* Row 2: Breakdown Dimension & Date Range (if not shown in col 3) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-zinc-500" />
                Breakdown Dimension (Group by)
              </label>
              <select
                value={breakdown}
                onChange={(e) => setBreakdown(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
              >
                {BREAKDOWN_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {['avg', 'sum', 'min', 'max'].includes(aggregation) && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                  Date Range
                </label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as InsightDateRange)}
                  className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
                >
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="90d">Last 90 Days</option>
                </select>
              </div>
            )}
          </div>

          {/* Row 3: Filters Section */}
          <div className="pt-2 border-t border-zinc-850">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                <FilterIcon className="w-3.5 h-3.5 text-zinc-400" />
                Filters ({filters.length})
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={addFilter}
                className="h-7 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/20"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Filter
              </Button>
            </div>

            {filters.length === 0 ? (
              <div className="text-xs text-zinc-500 py-1">
                No filters applied. Results will include all matching events.
              </div>
            ) : (
              <div className="space-y-2">
                {filters.map((filter, idx) => (
                  <div key={idx} className="flex flex-wrap items-center gap-2 bg-zinc-900/60 p-2 rounded border border-zinc-800">
                    <Input
                      type="text"
                      placeholder="Property (e.g. browser, properties.tier)"
                      value={filter.property}
                      onChange={(e) => updateFilter(idx, { property: e.target.value })}
                      className="h-7 text-xs bg-zinc-950 border-zinc-800 w-44"
                    />

                    <select
                      value={filter.operator}
                      onChange={(e) =>
                        updateFilter(idx, { operator: e.target.value as InsightFilterOperator })
                      }
                      className="bg-zinc-950 border border-zinc-800 text-zinc-200 rounded px-2 py-1 text-xs h-7"
                    >
                      {FILTER_OPERATORS.map((op) => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </select>

                    {filter.operator !== 'is_set' && (
                      <Input
                        type="text"
                        placeholder="Value (e.g. Chrome, Pro)"
                        value={String(filter.value ?? '')}
                        onChange={(e) => updateFilter(idx, { value: e.target.value })}
                        className="h-7 text-xs bg-zinc-950 border-zinc-800 flex-1 min-w-[120px]"
                      />
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFilter(idx)}
                      className="h-7 w-7 p-0 text-zinc-500 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Query Results & Visualizations */}
      <InsightsChart
        data={queryResult}
        loading={loading}
        chartType={chartType}
        onChartTypeChange={setChartType}
      />

      {/* Save Insight Dialog Modal */}
      <Dialog open={isSaveModalOpen} onOpenChange={setIsSaveModalOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-zinc-100 text-base">Save Insight</DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Save this query configuration to your project dashboard for quick access and tracking.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Insight Name</label>
              <Input
                type="text"
                placeholder="e.g. Weekly Active Signups by Browser"
                value={insightName}
                onChange={(e) => setInsightName(e.target.value)}
                className="h-8 text-xs bg-zinc-900 border-zinc-800"
              />
            </div>
            <div className="text-[11px] text-zinc-500 space-y-1 bg-zinc-900/60 p-2.5 rounded border border-zinc-850">
              <div>
                <span className="text-zinc-400 font-medium">Event: </span>
                {activeEventName || 'All Events'}
              </div>
              <div>
                <span className="text-zinc-400 font-medium">Metric: </span>
                {aggregation}
              </div>
              <div>
                <span className="text-zinc-400 font-medium">Breakdown: </span>
                {breakdown !== 'none' ? breakdown : 'None'}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSaveModalOpen(false)}
              className="border-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveInsight}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium"
            >
              {saving ? 'Saving...' : 'Save to Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
