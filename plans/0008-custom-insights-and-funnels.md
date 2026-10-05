---
number: 0008
title: Custom Insights & Conversion Funnels Engine
status: draft
grilled: 2026-10-06
---

# 0008 — Custom Insights & Conversion Funnels Engine

> **Goal:** Product teams can build ad-hoc custom queries (aggregations, breakdowns, filters) with multi-mode charts (Line, Bar, Donut, Table), and construct multi-step conversion funnels to visualize conversion drop-offs and time to convert.

## Problem

Currently, `apps/web/src/app/(dashboard)/[projectSlug]/insights/page.tsx` and `funnels/page.tsx` are placeholders. Teams cannot build custom queries or analyze conversion funnels.

## Decisions

1. **Custom Insights Engine (`src/features/insights/`)**:
   - `service.ts`: Query builder supporting metrics (`count`, `unique_users`, `unique_sessions`, numeric property `avg`/`sum`/`min`/`max`), property breakdowns, and arbitrary filters.
   - UI: Query builder controls (event picker, metric selector, filter rows, breakdown dropdown), visualization chart renderers, CSV export.
2. **Conversion Funnels Engine (`src/features/funnels/`)**:
   - `service.ts`: Multi-step sequential query calculating conversion through Steps 1 to N within conversion window (e.g. 1 hour, 1 day, 7 days, 30 days), conversion drop-off percentages, and median conversion times.
   - UI: Funnel step builder, visual drop-off bars, step drilldown.

## Steps

### Step 1 — Insights & Funnels Calculation Services
Files:
- `apps/web/src/features/insights/service.ts`
- `apps/web/src/features/funnels/service.ts`

### Step 2 — Custom Insights UI
Files:
- `apps/web/src/features/insights/components/query-builder.tsx`
- `apps/web/src/features/insights/components/insights-chart.tsx`
- `apps/web/src/app/(dashboard)/[projectSlug]/insights/page.tsx`

### Step 3 — Conversion Funnels UI
Files:
- `apps/web/src/features/funnels/components/funnel-builder.tsx`
- `apps/web/src/features/funnels/components/funnel-chart.tsx`
- `apps/web/src/app/(dashboard)/[projectSlug]/funnels/page.tsx`

### Step 4 — Tests
Files:
- `apps/web/src/features/insights/service.test.ts`
- `apps/web/src/features/funnels/service.test.ts`
