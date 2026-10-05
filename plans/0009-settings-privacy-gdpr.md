---
number: 0009
title: Project Settings, API Keys Management & GDPR Compliance
status: completed
grilled: 2026-10-06
---

# 0009 — Project Settings, API Keys Management & GDPR Compliance

> **Goal:** Project admins can manage publishable and secret API keys (generation, rotation, copy), configure CORS domain whitelists, adjust data retention and IP privacy settings, trigger GDPR user deletions ("right to be forgotten"), and export raw data.

## Problem

Currently, `apps/web/src/app/(dashboard)/[projectSlug]/settings/` only allows editing the project name and domain list. There is no secret API key management, no data retention setting, and no GDPR deletion or data export tooling.

## Decisions

1. **API Keys & Settings**:
   - Secret key (`ot_sec_...`): generated and displayed on demand with rotation confirmation.
   - Publishable key (`ot_live_...`): easy copy and rotation.
   - Allowed domains: comma-separated or list of allowed origin hosts.
   - Privacy settings: IP anonymization toggle, data retention window (90, 180, 365, unlimited).
2. **GDPR Tools**:
   - Right to be Forgotten: action to delete all events, persons, and alias records for a given `distinct_id`.
   - Data Export: download events associated with a distinct_id or date range as JSON/CSV.

## Steps

### Step 1 — Settings Service Expansion
Files:
- `apps/web/src/features/projects/service.ts`
- `apps/web/src/features/projects/actions.ts`

### Step 2 — Settings & GDPR UI
Files:
- `apps/web/src/app/(dashboard)/[projectSlug]/settings/page.tsx`
- `apps/web/src/app/(dashboard)/[projectSlug]/settings/settings-form.tsx`
- `apps/web/src/app/(dashboard)/[projectSlug]/settings/gdpr-panel.tsx`

### Step 3 — Tests
Files:
- `apps/web/src/features/projects/service.test.ts`
