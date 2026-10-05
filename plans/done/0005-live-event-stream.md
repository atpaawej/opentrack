---
number: 0005
title: Real-Time Live Event Stream & Inspector Drawer
status: draft
grilled: 2026-10-06
---

# 0005 — Real-Time Live Event Stream & Inspector Drawer

> **Goal:** Product teams can monitor real-time ingested events in an auto-refreshing feed with Pause/Resume, event/user filtering, and an interruptible slide-over inspector sheet showing formatted properties, raw JSON with 1-click copy, and user profile shortcuts.

## Problem

Currently, `apps/web/src/app/(dashboard)/[projectSlug]/live/page.tsx` is an empty placeholder card. There is no way for users to see incoming events, inspect payloads, test their client SDK installation in real time, or debug event properties.

## Decisions

1. **Vertical Slice Architecture**:
   - `src/features/live-stream/`:
     - `service.ts`: Query recent events with optional filters (`eventName`, `distinctId`, `limit`).
     - `actions.ts`: Server Actions / Route handlers for client polling.
     - `components/live-stream-feed.tsx`: Client component managing auto-refresh (every 3 seconds), Pause/Resume toggle, Clear feed, and filters.
     - `components/event-drawer.tsx`: Slide-over sheet using Radix Dialog / Sheet primitives.
2. **UI & Design Engineering**:
   - Dark mode styling with `zinc-950` canvas, `zinc-900` cards, pulsating live status badge.
   - Formatted properties table + syntax highlighted JSON inspector with 1-click copy toast notification via Sonner.
   - Person shortcut button linking directly to `/persons/[distinctId]`.

## Steps

### Step 1 — Live Stream Service & Schemas
Files:
- `apps/web/src/features/live-stream/schemas.ts`
- `apps/web/src/features/live-stream/service.ts`
- `apps/web/src/features/live-stream/actions.ts`

### Step 2 — Live Feed UI & Slide-Over Sheet
Files:
- `apps/web/src/components/ui/sheet.tsx`
- `apps/web/src/features/live-stream/components/event-row.tsx`
- `apps/web/src/features/live-stream/components/event-drawer.tsx`
- `apps/web/src/features/live-stream/components/live-stream-feed.tsx`
- `apps/web/src/app/(dashboard)/[projectSlug]/live/page.tsx`

### Step 3 — Tests
Files:
- `apps/web/src/features/live-stream/service.test.ts`
