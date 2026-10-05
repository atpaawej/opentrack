---
number: 0003
title: Database Schema Expansion, Ingestion Enrichment & Batch API
status: complete
grilled: 2026-10-06
---

# 0003 — Database Schema Expansion, Ingestion Enrichment & Batch API

> **Goal:** The database schema supports all event properties, persons, aliases, dashboards, and insights from docs/opentrack.md; the ingestion pipeline supports single & batch (`/api/v1/batch`) ingestion, enriched headers (geo, user agent, referrer, utm), and automatic identity resolution for `$identify` and `$alias`.

## Problem

Currently, `events` only captures basic fields (`distinctId`, `sessionId`, `properties`, `ipHash`). Web analytics and live feed queries cannot efficiently filter on `pagePath`, `referrerDomain`, `browser`, `os`, `countryCode`, or `deviceType` without full JSON extraction. Additionally, `/api/v1/batch` does not exist, and there are no tables or logic for `persons`, `person_aliases`, `dashboards`, and `insights`.

## Why

1. `apps/web/src/lib/db/schema.ts` lacks tables `persons`, `personAliases`, `dashboards`, and `insights`.
2. `events` table lacks top-level columns required by `docs/opentrack.md` Section 3.2.
3. `apps/web/src/app/api/v1/batch/route.ts` is missing.
4. `apps/web/src/features/ingestion/` only supports single event capture and does not extract enrichment attributes or perform identity resolution.

## Decisions

1. **Schema Expansion**:
   - Add columns to `projects`: `secretKey` (varchar(64)), `timezone` (varchar(64) default 'UTC'), `dataRetentionDays` (integer default 365).
   - Add columns to `events`: `userAgent` (text), `browser` (varchar(64)), `browserVersion` (varchar(64)), `os` (varchar(64)), `deviceType` (varchar(32)), `screenWidth` (integer), `screenHeight` (integer), `countryCode` (varchar(2)), `region` (varchar(64)), `city` (varchar(128)), `referrer` (text), `referrerDomain` (varchar(255)), `pageUrl` (text), `pagePath` (varchar(512)), `utmSource` (varchar(128)), `utmMedium` (varchar(128)), `utmCampaign` (varchar(128)), `utmTerm` (varchar(128)), `utmContent` (varchar(128)).
   - Add tables: `persons`, `personAliases`, `dashboards`, `insights`.
2. **Batch Endpoint & Ingestion Logic**:
   - `POST /api/v1/batch`: Validates array of up to 100 events, executes bulk insert with single transaction/query where possible.
   - Extracts system and client properties (either from explicit properties like `$current_url`, `$pathname`, `$referrer`, `$browser`, `$os`, or HTTP headers `user-agent`, `x-forwarded-for`, `x-vercel-ip-country`, etc.).
   - If event is `$identify`, upsert into `persons` with merged properties, and if an anonymous `distinct_id` was provided with a new user ID, insert an alias record in `personAliases`.
3. **API Key Extraction**: Allow `api_key` in request body or `X-OpenTrack-Key` header.
4. **CORS / Allowed Domains Verification**: Check `Origin` / `Referer` against `project.allowedDomains` if configured.

## Steps

### Step 1 — Update Schema with New Columns & Tables
Files: `apps/web/src/lib/db/schema.ts`
Add all tables, relations, and types as defined in Section 3 of `docs/opentrack.md`.

### Step 2 — Expand Ingestion Schemas & Enrichment Logic
Files:
- `apps/web/src/features/ingestion/schemas.ts`
- `apps/web/src/features/ingestion/enrichment.ts`
- `apps/web/src/features/ingestion/service.ts`
Parse user agent (browser, OS, device), parse geo headers, extract path/referrer/utm, handle `$identify` and `$alias`.

### Step 3 — Implement Batch Ingestion Route & Service
Files:
- `apps/web/src/features/ingestion/batch.ts`
- `apps/web/src/app/api/v1/batch/route.ts`
- `apps/web/src/app/api/v1/batch/route.test.ts`
Accept `{ api_key?: string, batch: Array<CapturePayload> }` or array of events.

### Step 4 — Verify Unit & Integration Tests
Run Vitest tests for ingestion, batching, and schema typing.
