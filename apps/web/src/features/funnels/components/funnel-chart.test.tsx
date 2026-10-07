import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FunnelChart } from './funnel-chart';
import type { FunnelResult } from '../types';

const result: FunnelResult = {
  totalUsers: 4,
  convertedUsers: 0,
  overallConversionRate: 0,
  from: '2026-10-01T00:00:00.000Z',
  to: '2026-10-08T00:00:00.000Z',
  query: {
    dateRange: '7d', conversionWindow: { value: 1, unit: 'day' },
    steps: [{ id: 'a', eventName: 'signup_started' }, { id: 'b', eventName: 'signup_completed' }],
  },
  steps: [
    { stepIndex: 0, id: 'a', name: 'Started', eventName: 'signup_started', count: 4,
      dropOffCount: 4, dropOffPercentage: 100, conversionRateFromFirst: 100,
      conversionRateFromPrevious: 100, medianTimeToConvertSeconds: null, droppedUserIds: ['person_a'] },
    { stepIndex: 1, id: 'b', name: 'Completed', eventName: 'signup_completed', count: 0,
      dropOffCount: 0, dropOffPercentage: 0, conversionRateFromFirst: 0,
      conversionRateFromPrevious: 0, medianTimeToConvertSeconds: null, droppedUserIds: [] },
  ],
};

describe('FunnelChart states and denominators', () => {
  it('does not present a funnel before running it', () => {
    expect(renderToStaticMarkup(<FunnelChart data={null} projectSlug="demo" />)).toContain('Run a funnel to see results');
  });

  it('identifies the event needed when the first step has no activity', () => {
    const zero = { ...result, totalUsers: 0, steps: result.steps.map((step) => ({ ...step, count: 0 })) };
    const html = renderToStaticMarkup(<FunnelChart data={zero} projectSlug="demo" />);
    expect(html).toContain('signup_started');
    expect(html).not.toContain('Overall conversion:');
  });

  it('keeps a genuine zero final step, explicit denominators and a drilldown control', () => {
    const html = renderToStaticMarkup(<FunnelChart data={result} projectSlug="demo" />);
    expect(html).toContain('0% of 4 starters');
    expect(html).toContain('0% of 4 at previous step');
    expect(html).toContain('No one reached this step');
    expect(html).toContain('Inspect dropped people');
    expect(html).not.toContain('height:3%');
  });

  it('does not imply a comparable rate after a previous step with no users', () => {
    const third = { ...result.steps[1], id: 'c', stepIndex: 2, name: 'Activated', eventName: 'activated' };
    const html = renderToStaticMarkup(<FunnelChart data={{ ...result, steps: [...result.steps, third] }} projectSlug="demo" />);
    expect(html).toContain('Not comparable (previous step: 0)');
    expect(html).toContain('cannot be evaluated');
  });
});
