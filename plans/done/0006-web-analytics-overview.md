---
number: 0006
title: Web Analytics Overview (KPIs, Time-Series & Breakdown Panels)
status: draft
grilled: 2026-10-06
---

# 0006 — Web Analytics Overview (KPIs, Time-Series & Breakdown Panels)

> **Goal:** Display comprehensive website traffic analytics (Unique Visitors, Pageviews, Sessions, Bounce Rate, Avg Duration) with percentage deltas, interactive time-series charts, and top breakdown panels (Pages, Referrers, UTM Campaigns, Devices, Geographies).

## Problem

Currently, `apps/web/src/app/(dashboard)/[projectSlug]/page.tsx` shows only the setup guide when events = 0, and a placeholder when events > 0. OpenTrack has no web analytics dashboard to compute traffic numbers, display trend lines, or show traffic sources.

## Decisions

1. **Analytics Engine (`src/features/web-analytics/`)**:
   - `service.ts`:
     - `getKpiMetrics(projectId, dateRange)`: Unique visitors, total pageviews, total sessions, bounce rate, average session duration, plus comparison period deltas.
     - `getTimeSeriesMetrics(projectId, dateRange, interval)`: Grouped data points by hour/day/week for trend charts.
     - `getBreakdowns(projectId, dateRange, breakdownType)`: Top Pages, Top Referrers, UTM Campaigns, Browsers, Operating Systems, Countries.
2. **Visualizations & Interaction**:
   - Time-series charts (Line, Area, Bar) with Recharts/SVG primitives.
   - Date range selector (Today, Last 24 Hours, Last 7 Days, Last 30 Days, Last 90 Days).
   - Zero Layout Shift skeleton loaders.
   - Tabbed breakdown panels with visual percentage bars and visitor counts.

## Steps

### Step 1 — Web Analytics Query Service & Aggregations
Files:
- `apps/web/src/features/web-analytics/types.ts`
- `apps/web/src/features/web-analytics/service.ts`
- `apps/web/src/features/web-analytics/actions.ts`

### Step 2 — Analytics UI Components
Files:
- `apps/web/src/features/web-analytics/components/kpi-cards.tsx`
- `apps/web/src/features/web-analytics/components/time-series-chart.tsx`
- `apps/web/src/features/web-analytics/components/breakdown-tables.tsx`
- `apps/web/src/features/web-analytics/components/analytics-dashboard.tsx`
- `apps/web/src/app/(dashboard)/[projectSlug]/page.tsx`
- `apps/web/src/app/(dashboard)/[projectSlug]/analytics/page.tsx`

### Step 3 — Tests
Files:
- `apps/web/src/features/web-analytics/service.test.ts`
