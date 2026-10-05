export type FunnelWindowUnit = 'minute' | 'hour' | 'day';

export interface FunnelStepFilter {
  property: string;
  operator: 'equals' | 'does_not_equal' | 'contains' | 'is_set' | 'greater_than' | 'less_than';
  value?: string | number | boolean;
}

export interface FunnelStepConfig {
  id: string;
  eventName: string;
  name?: string;
  filters?: FunnelStepFilter[];
}

export interface FunnelConversionWindow {
  value: number;
  unit: FunnelWindowUnit;
}

export interface FunnelQueryConfig {
  steps: FunnelStepConfig[];
  conversionWindow: FunnelConversionWindow;
  dateRange: '7d' | '30d' | '90d' | 'custom';
  customFrom?: string | Date;
  customTo?: string | Date;
}

export interface FunnelStepResult {
  stepIndex: number;
  id: string;
  name: string;
  eventName: string;
  count: number;
  dropOffCount: number;
  dropOffPercentage: number;
  conversionRateFromPrevious: number;
  conversionRateFromFirst: number;
  medianTimeToConvertSeconds: number | null;
  droppedUserIds: string[];
}

export interface FunnelResult {
  steps: FunnelStepResult[];
  overallConversionRate: number;
  totalUsers: number;
  convertedUsers: number;
  query: FunnelQueryConfig;
  from: string;
  to: string;
}

export interface SavedFunnel {
  id: string;
  projectId: string;
  name: string;
  queryConfig: FunnelQueryConfig;
  createdBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
