---
number: 0001
title: Minimal Spine (Monorepo, Ingestion Pipeline, Effect, Neon DB, and Client SDK)
status: draft
grilled: 2026-10-05
---

# 0001 — Minimal Spine

> **Goal:** An end-to-end minimal spine where a client SDK captures an event, sends it via HTTP to Next.js, executes an Effect-TS pipeline for validation and IP anonymization, and persists it into Neon Postgres via Drizzle ORM.

## Problem

OpenTrack has a comprehensive technical specification in `docs/opentrack.md`, but zero code in the repository. Before building dashboards, charts, Clerk authentication, or funnels, we need a working, verifiable minimal architectural spine that proves events can be ingested from client to database reliably.

## Why

The workspace `C:\Users\aawej\projects\OpenTrack` currently contains no `package.json`, no monorepo structure, and no database configuration. Starting with high-level UI without establishing the ingestion spine leads to mocked data and architectural rework. Implementing the spine first establishes:
1. The `pnpm` monorepo configuration (`apps/web` and `packages/sdk`).
2. The Vertical Slice Architecture boundary for `features/ingestion`.
3. The Effect-TS runtime, error channels, and `@effect/schema` validation.
4. The Neon Postgres connection pool and Drizzle schema for `projects` and `events`.
5. The standalone browser SDK transport mechanism.

## Decisions

1. **Monorepo Structure**: `pnpm` workspaces with `apps/web` (Next.js 16.3.8, App Router, React 19) and `packages/sdk` (standalone client library). No extra internal micro-packages.
2. **Vertical Slice Architecture (VSA)**: `src/features/ingestion` contains schemas, database queries, and Effect workflows. Zero raw database queries in UI or route handlers.
3. **Production Reliability with Effect-TS**: Ingestion workflow, retries, and domain error channels are handled through `effect`. Validation at the system boundary is handled by `@effect/schema`.
4. **Database & ORM**: Neon Serverless PostgreSQL with connection pooling via `@neondatabase/serverless` and Drizzle ORM (`drizzle-orm`).
5. **No Auth in Spine Phase**: Clerk integration and UI dashboard belong in subsequent plans. This plan establishes the data ingestion pipeline using project API keys (`ot_live_...`).

## Steps

### Step 1 — Initialize Monorepo and Workspace Configuration

Files: `pnpm-workspace.yaml:1`, `package.json:1`, `.gitignore:1`

Create root `pnpm-workspace.yaml` declaring `apps/*` and `packages/*`. Create root `package.json` with scripts for `dev`, `build`, and `lint`. Add root `.gitignore`.

**Done when:** `pnpm install` runs cleanly at the root without errors.

---

### Step 2 — Scaffold Next.js Application (`apps/web`)

Files: `apps/web/package.json:1`, `apps/web/tsconfig.json:1`, `apps/web/next.config.ts:1`, `apps/web/tailwind.config.ts:1`

Set up `apps/web` with Next.js 15, React 19, TypeScript, Tailwind CSS, `effect`, `@effect/schema`, `drizzle-orm`, `@neondatabase/serverless`, and `dotenv`. Configure strict TypeScript and path aliases (`@/*` pointing to `./src/*`).

**Done when:** `pnpm --filter web build` compiles successfully.

---

### Step 3 — Database Connection & Minimal Schema (Neon + Drizzle)

Files: `apps/web/src/lib/db/schema.ts:1`, `apps/web/src/lib/db/index.ts:1`, `apps/web/drizzle.config.ts:1`

Define the initial Drizzle schema:
* `projects`: `id` (uuid), `name` (varchar), `api_key` (varchar, unique), `allowed_domains` (text[]), `created_at` (timestamp).
* `events`: `id` (uuid), `project_id` (uuid, fk), `event_name` (varchar), `distinct_id` (varchar), `session_id` (varchar), `properties` (jsonb), `ip_hash` (varchar), `timestamp` (timestamp).

Configure the Neon database connection pool client with fail-safe connection handling.

**Done when:** Drizzle migrations/push can connect and generate tables against the Neon database URL.

---

### Step 4 — Ingestion Vertical Slice (`features/ingestion`)

Files:
* `apps/web/src/features/ingestion/schemas.ts:1`
* `apps/web/src/features/ingestion/errors.ts:1`
* `apps/web/src/features/ingestion/service.ts:1`

Implement the vertical slice using Effect-TS:
1. `schemas.ts`: Define `CapturePayload` using `@effect/schema` (validates `api_key`, `event`, `distinct_id`, `session_id`, `properties`, `timestamp`).
2. `errors.ts`: Define `InvalidApiKeyError`, `PayloadValidationError`, and `DatabaseWriteError` as `Data.TaggedError`.
3. `service.ts`: Effect workflow that:
   * Validates input payload using `Schema.decodeUnknown`.
   * Verifies the `api_key` against `projects` table (with in-memory cache or DB query).
   * Generates a salted SHA-256 hash of the client IP (`ip_hash`).
   * Inserts the event record into the `events` table with automatic retry on transient failure (`Effect.retry`).

**Done when:** Unit test or script executing the Effect workflow succeeds with valid inputs and yields typed tagged errors on invalid API keys or malformed payloads.

---

### Step 5 — Thin Route Handler (`app/api/v1/capture`)

File: `apps/web/src/app/api/v1/capture/route.ts:1`

Implement Next.js Route Handler for `POST /api/v1/capture`:
* Support CORS preflight (`OPTIONS`) with `Access-Control-Allow-Origin: *`.
* Extract client IP from headers (`x-forwarded-for` or `cf-connecting-ip`).
* Execute the Ingestion Slice Effect workflow.
* Map Effect exit channels to HTTP responses:
  * Success -> `200 OK` `{ "status": "ok" }`
  * `PayloadValidationError` -> `400 Bad Request` `{ "error": "Invalid payload", "details": ... }`
  * `InvalidApiKeyError` -> `401 Unauthorized` `{ "error": "Invalid API key" }`
  * Internal error -> `500 Internal Server Error`

**Done when:** `curl -X POST http://localhost:3000/api/v1/capture` with valid JSON returns `200 OK`.

---

### Step 6 — Standalone Client SDK (`packages/sdk`)

Files:
* `packages/sdk/package.json:1`
* `packages/sdk/tsconfig.json:1`
* `packages/sdk/tsup.config.ts:1`
* `packages/sdk/src/index.ts:1`
* `packages/sdk/src/transport.ts:1`
* `packages/sdk/src/session.ts:1`

Create minimal SDK:
* `session.ts`: Manages persistent anonymous `distinct_id` and 30-minute rolling `session_id` in `localStorage`.
* `transport.ts`: Dispatches events via `navigator.sendBeacon` with fallback to `fetch(..., { keepalive: true })`.
* `index.ts`: Exposes `init(apiKey, options)` and `capture(eventName, properties)`.
* Build pipeline with `tsup` outputting ESM, CJS, and standalone IIFE bundle (`dist/opentrack.min.js`).

**Done when:** `pnpm --filter @opentrack/web build` outputs bundle < 5KB.

---

### Step 7 — End-to-End Spine Verification Test

File: `scripts/smoke-test-spine.ts:1`

Create an automated smoke test script that:
1. Inserts a test project (`api_key: "ot_live_spine_test"`).
2. Uses the compiled `@opentrack/web` SDK (or node-fetch equivalent) to fire `capture("user_signed_up", { plan: "starter" })`.
3. Queries the `events` table in Neon.
4. Asserts that the event exists, properties match, `ip_hash` is populated, and timestamp is valid.

**Done when:** Smoke test exits with code 0 and logs `"Spine verification: PASSED"`.

## Seams

* **HTTP Seam**: `POST /api/v1/capture` tested via `curl` and automated fetch tests.
* **Database Seam**: `events` and `projects` tables queried directly via Drizzle in verification script.
* **SDK Seam**: Standalone bundle build test and client import test.

## Out of scope

* Clerk authentication and user login screens (Plan 0002).
* Dashboard UI, charts, and dark-mode widgets (Plan 0003).
* Web Analytics aggregations, funnels, and live feed viewer (Plan 0004).
* Batch ingestion endpoint `/api/v1/batch` (deferred to batch optimization plan).

## Open questions

None. The stack, architecture (VSA), reliability layer (Effect-TS), database (Neon), and monorepo structure are all settled.
