---
number: 0007
title: User Identity & People Explorer (Directory & Activity Timeline)
status: draft
grilled: 2026-10-06
---

# 0007 — User Identity & People Explorer (Directory & Activity Timeline)

> **Goal:** Product teams can explore identified users and anonymous visitors in a searchable directory, and drill down into individual Person Profile pages featuring user traits, location/device context, and chronological event timelines grouped by session.

## Problem

Currently, `apps/web/src/app/(dashboard)/[projectSlug]/persons/page.tsx` is an empty placeholder. Users cannot see who is using their product, inspect user properties, or review user journey timelines.

## Decisions

1. **Persons Directory (`/persons`)**:
   - Paginated list of persons querying `persons` table.
   - Shows identifier (email/name/distinctId), first seen, last seen, trait badges.
   - Search by distinctId or email.
2. **Individual Person Profile (`/persons/[distinctId]`)**:
   - Header with user traits, first/last seen, location, device.
   - User traits table / editor.
   - Chronological event timeline grouped by sessions.
   - Expandable raw event inspector.

## Steps

### Step 1 — Persons Service & Queries
Files:
- `apps/web/src/features/persons/service.ts`
- `apps/web/src/features/persons/actions.ts`

### Step 2 — Directory & Profile Pages
Files:
- `apps/web/src/features/persons/components/person-list.tsx`
- `apps/web/src/features/persons/components/person-timeline.tsx`
- `apps/web/src/features/persons/components/person-traits.tsx`
- `apps/web/src/app/(dashboard)/[projectSlug]/persons/page.tsx`
- `apps/web/src/app/(dashboard)/[projectSlug]/persons/[distinctId]/page.tsx`

### Step 3 — Tests
Files:
- `apps/web/src/features/persons/service.test.ts`
