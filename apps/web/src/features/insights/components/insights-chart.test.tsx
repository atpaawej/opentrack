import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { InsightsChart } from './insights-chart';
import type { InsightQueryResult } from '../types';

const result: InsightQueryResult = {
  summaryValue: 3,
  timeSeries: [{ timestamp: '2026-10-01T00:00:00.000Z', value: 3 }],
  breakdown: [{ name: 'Web', value: 3, percentage: 100 }],
  tableHeaders: ['Dimension', 'Value', 'Share (%)'],
  tableRows: [{ Dimension: 'Web', Value: 3, 'Share (%)': '100%' }],
  totalRows: 1,
  query: { aggregation: 'count', dateRange: '7d', breakdown: 'deviceType' },
  from: '2026-10-01T00:00:00.000Z',
  to: '2026-10-08T00:00:00.000Z',
};

describe('InsightsChart states and accessible data', () => {
  it('distinguishes a query that has not run from no matching events', () => {
    expect(renderToStaticMarkup(<InsightsChart data={null} chartType="line" />)).toContain('Run a query to see results');
    const empty = { ...result, summaryValue: 0, timeSeries: [], breakdown: [], tableRows: [] };
    expect(renderToStaticMarkup(<InsightsChart data={empty} chartType="line" />)).toContain('No events matched this query');
  });

  it('keeps exact chart data available without hover and preserves a true zero row', () => {
    const zero = { ...result, summaryValue: 0, breakdown: [], timeSeries: [{ timestamp: result.from, value: 0 }], tableRows: [{ Timestamp: result.from, Value: 0 }] };
    const html = renderToStaticMarkup(<InsightsChart data={zero} chartType="line" />);
    expect(html).toContain('View exact chart data');
    expect(html).toContain('Time (UTC)');
    expect(html).toContain('>0</td>');
    expect(html).not.toContain('No events matched this query');
  });

  it('rejects a non-additive or partial part-to-whole without inventing a slice', () => {
    const html = renderToStaticMarkup(<InsightsChart data={{ ...result, query: { ...result.query, aggregation: 'unique_users' } }} chartType="donut" />);
    expect(html).toContain('Choose Bar or Table');
    expect(renderToStaticMarkup(<InsightsChart data={{ ...result, summaryValue: 4 }} chartType="donut" />)).toContain('Choose Bar or Table');
  });

  it('preserves exact table values and a keyboard-addressable display selector', () => {
    const html = renderToStaticMarkup(<InsightsChart data={result} chartType="table" onChartTypeChange={() => {}} />);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('>Web</td>');
    expect(html).toContain('>100%</td>');
  });
});
