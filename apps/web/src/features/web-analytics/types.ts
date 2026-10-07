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
  /** Null means the previous period was zero and growth is not comparable ("New"). */
  changePercentage: number | null;
}

export interface KpiMetricsSummary {
  /** Distinct event.distinctId values across all event types in the selected window; no alias stitching. */
  uniqueVisitors: KpiMetric;
  totalPageviews: KpiMetric;
  totalSessions: KpiMetric;
  bounceRate: KpiMetric;
  avgSessionDuration: KpiMetric;
}

export interface TimeSeriesPoint {
  /** UTC bucket start (Monday for weeks). Distinct IDs are counted per bucket. */
  timestamp: string;
  pageviews: number;
  visitors: number;
  sessions: number;
}

export interface BreakdownItem {
  name: string;
  /** Pageview event count for pages; event count for other dimensions. */
  value: number;
  /** Share of all eligible events (including groups outside the top ten), rounded to 0.1%. */
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
    events: BreakdownItem[];
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
  /** Buckets and selected date bounds use UTC (not the project's configured timezone). */
  timezone: 'UTC';
  from: string;
  to: string;
}
