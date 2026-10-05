# OpenTrack

> Open-source, developer-first product analytics platform built with Next.js, Effect-TS, Neon Postgres, Drizzle ORM, and a lightweight client tracking SDK.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16.3.8-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![Effect-TS](https://img.shields.io/badge/Effect--TS-3.13-purple)](https://effect.website/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-0.40-green)](https://orm.drizzle.team/)
[![Neon Database](https://img.shields.io/badge/Neon-PostgreSQL-00E599?logo=postgresql)](https://neon.tech/)

---

## Overview

**OpenTrack** is an open-source, developer-first alternative to proprietary analytics platforms (PostHog, Mixpanel, Amplitude). It provides complete data ownership directly on serverless PostgreSQL, zero vendor lock-in, and privacy-first event ingestion.

### Key Highlights

- **Minimal Ingestion Spine**: Thin Next.js Route Handler delegating directly to a Vertical Slice Architecture (VSA) ingestion workflow.
- **Production Reliability via Effect-TS**: Resilient workflows with explicit tagged error channels (`PayloadValidationError`, `InvalidApiKeyError`, `DatabaseWriteError`) and transient-retry scheduling.
- **Boundary Validation**: `@effect/schema` for compile-time and runtime validation at API boundaries.
- **Serverless PostgreSQL & Drizzle ORM**: Connection pooling with `@neondatabase/serverless` and typesafe database schemas.
- **Privacy by Design**: Automated salted SHA-256 client IP hashing (`ip_hash`) and rolling 30-minute anonymous session tracking.
- **Ultra-lightweight Browser SDK**: Standalone tracking library (`@opentrack/web`) bundled with `tsup` into an IIFE script tag (< 3.5 KB minified) with `navigator.sendBeacon` and keepalive `fetch` fallback.

---

## Workspace Structure

OpenTrack is organized as a clean `pnpm` monorepo:

```
OpenTrack/
├── apps/
│   └── web/                         # Next.js 16 (App Router, Ingestion API)
│       ├── src/
│       │   ├── app/
│       │   │   ├── api/v1/capture/  # POST /api/v1/capture route handler
│       │   │   ├── layout.tsx
│       │   │   └── page.tsx
│       │   ├── features/
│       │   │   └── ingestion/       # Vertical Slice: schemas, errors, Effect service
│       │   └── lib/
│       │       └── db/              # Neon DB pool, Drizzle schema & migration tools
│       ├── drizzle/                 # Generated SQL migrations
│       ├── package.json
│       ├── tsconfig.json
│       └── vitest.config.ts
├── packages/
│   └── sdk/                         # Standalone Client Tracker (@opentrack/web)
│       ├── src/
│       │   ├── index.ts             # SDK API (init, capture, getDistinctId, getSessionId)
│       │   ├── session.ts           # Rolling 30-min sessions & distinct_id in localStorage
│       │   └── transport.ts         # sendBeacon + fetch keepalive transport
│       ├── dist/                    # ESM, CJS, and IIFE bundle (opentrack.min.js)
│       ├── package.json
│       └── tsup.config.ts
├── scripts/
│   ├── env-sync.mjs                 # Synchronize & check .env.local across monorepo
│   └── smoke-test-spine.ts          # End-to-end spine verification smoke test
├── pnpm-workspace.yaml
└── package.json
```

---

## Quick Start

### 1. Prerequisites

- **Node.js**: v20+ (tested on Node v24)
- **pnpm**: v9+ or v11+

### 2. Installation & Environment

Clone the repository and install dependencies:

```bash
git clone https://github.com/atpaawej/opentrack.git
cd opentrack
pnpm install
```

Configure your environment:

```bash
cp .env.example .env.local
```

Populate `.env.local` with your Neon Postgres connection string:

```env
DATABASE_URL="postgresql://user:password@host/neondb?sslmode=require"
DATABASE_URL_POOLED="postgresql://user:password@host-pooler/neondb?sslmode=require"
```

Synchronize the environment file into `apps/web`:

```bash
pnpm env:sync
```

To verify synchronization between root and `apps/web`:

```bash
pnpm env:check
```

---

## Database & Migrations

OpenTrack uses Drizzle ORM configured against Neon Serverless PostgreSQL.

```bash
# Check status of applied and pending migrations
pnpm db:list

# Generate new migration files from schema definitions
pnpm db:generate

# Execute pending migrations against the database
pnpm db:migrate

# Push schema directly without generating migration files (dev)
pnpm db:push
```

---

## Testing & Quality Assurance

We use [Vitest](https://vitest.dev/) for unit and integration testing:

```bash
# Run all unit and integration tests across web and SDK workspaces
pnpm test

# Run end-to-end database spine verification smoke test
pnpm test:smoke

# Run full monorepo production build
pnpm build
```

---

## Client SDK Usage (`@opentrack/web`)

### Via Script Tag

```html
<script
  src="https://your-domain.com/opentrack.min.js"
  data-api-key="ot_live_your_project_key"
  data-endpoint="/api/v1/capture"
  defer
></script>

<script>
  window.addEventListener('load', () => {
    window.opentrack.capture('pageview', { path: window.location.pathname });
  });
</script>
```

### Via NPM / Bundler

```bash
pnpm add @opentrack/web
```

```typescript
import opentrack from '@opentrack/web';

opentrack.init('ot_live_your_project_key', {
  endpoint: 'https://analytics.yourdomain.com/api/v1/capture',
  debug: process.env.NODE_ENV === 'development',
});

// Capture an event
await opentrack.capture('user_signed_up', {
  plan: 'pro',
  billing: 'annual',
});
```

---

## API Specification

### `POST /api/v1/capture`

Captures an individual analytics event. Supports CORS preflight (`OPTIONS *`).

#### Request Headers
- `Content-Type: application/json`

#### Request Payload
```json
{
  "api_key": "ot_live_...",
  "event": "user_signed_up",
  "distinct_id": "usr_94812",
  "session_id": "ses_31201",
  "properties": {
    "plan": "pro"
  },
  "timestamp": 1791220295299
}
```

#### Responses
- `200 OK`: `{ "status": "ok", "eventId": "uuid" }`
- `400 Bad Request`: `{ "error": "Invalid payload", "details": ... }`
- `401 Unauthorized`: `{ "error": "Invalid API key" }`
- `500 Internal Server Error`: `{ "error": "Internal Server Error" }`

---

## License

MIT © [OpenTrack Contributors](LICENSE)
