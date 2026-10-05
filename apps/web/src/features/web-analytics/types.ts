export type DateRangeKey = 'today' | '24h' | '7d' | '30d' | '90d' | 'custom';

export type Granularity = 'hour' | 'day' | 'week' | 'month';

export interface DateRangeFilter {
  key: DateRangeKey;
  from: Date;
  to: Date;
}

export interface KpiMetric {
  value: number;
  previousValue: number;
  changePercentage: number;
}

export interface KpiMetricsSummary {
  uniqueVisitors: KpiMetric;
  totalPageviews: KpiMetric;
  totalSessions: KpiMetric;
  bounceRate: KpiMetric;
  avgSessionDuration: KpiMetric;
}

export interface TimeSeriesPoint {
  timestamp: string;
  pageviews: number;
  visitors: number;
  sessions: number;
}

export interface BreakdownItem {
  name: string;
  value: number;
  percentage: number;
  metadata?: Record<string, string | number | null>;
}

export type BreakdownDimension =
  | 'pages'
  | 'referrers'
  | 'utm'
  | 'countries'
  | 'browsers'
  | 'os'
  | 'devices';

export interface AnalyticsDataPayload {
  kpis: KpiMetricsSummary;
  timeSeries: TimeSeriesPoint[];
  breakdowns: {
    pages: BreakdownItem[];
    referrers: BreakdownItem[];
    utm: BreakdownItem[];
    countries: BreakdownItem[];
    browsers: BreakdownItem[];
    os: BreakdownItem[];
    devices: BreakdownItem[];
  };
  dateRange: DateRangeKey;
  granularity: Granularity;
  from: string;
  to: string;
}
