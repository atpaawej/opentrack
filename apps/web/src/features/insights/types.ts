export type InsightAggregation =
  | 'count'
  | 'unique_users'
  | 'unique_sessions'
  | 'avg'
  | 'sum'
  | 'min'
  | 'max';

export type InsightFilterOperator =
  | 'equals'
  | 'does_not_equal'
  | 'contains'
  | 'is_set'
  | 'greater_than'
  | 'less_than';

export interface InsightFilter {
  property: string;
  operator: InsightFilterOperator;
  value?: string | number | boolean;
}

export type InsightDateRange = '7d' | '30d' | '90d' | 'custom';
export type InsightGranularity = 'hour' | 'day' | 'week' | 'month';
export type InsightChartType = 'line' | 'bar' | 'donut' | 'table';

export interface InsightQueryConfig {
  eventNames?: string[];
  aggregation: InsightAggregation;
  aggregationProperty?: string;
  filters?: InsightFilter[];
  breakdown?: string;
  dateRange: InsightDateRange;
  customFrom?: string | Date;
  customTo?: string | Date;
  granularity?: InsightGranularity;
  chartType?: InsightChartType;
}

export interface InsightTimeSeriesPoint {
  timestamp: string;
  value: number;
  breakdown?: Record<string, number>;
}

export interface InsightBreakdownItem {
  name: string;
  value: number;
  percentage: number;
}

export interface InsightQueryResult {
  summaryValue: number;
  timeSeries: InsightTimeSeriesPoint[];
  breakdown: InsightBreakdownItem[];
  tableHeaders: string[];
  tableRows: Record<string, any>[];
  totalRows: number;
  query: InsightQueryConfig;
  from: string;
  to: string;
}

export interface SavedInsight {
  id: string;
  projectId: string;
  dashboardId?: string | null;
  name: string;
  type: string;
  queryConfig: InsightQueryConfig;
  layout?: Record<string, any>;
  createdBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
