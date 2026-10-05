---
number: 0004
title: Client Tracking SDK Enhancements (@opentrack/web)
status: completed
grilled: 2026-10-06
---

# 0004 — Client Tracking SDK Enhancements (@opentrack/web)

> **Goal:** The standalone client tracker `@opentrack/web` supports `identify()`, automatic SPA pageview tracking, autocapture for interactive element clicks, UTM & referrer extraction, and robust offline transport with `navigator.sendBeacon` and `keepalive: true`.

## Problem

Currently, `packages/sdk` only implements a basic `capture()` and `session` management. It lacks:
1. `opentrack.identify(distinctId, properties)` for identity resolution.
2. Automatic pageview tracking for Single Page Applications (intercepting HTML5 history API `pushState`, `replaceState`, `popstate`).
3. Autocapture for click interactions on buttons, links, and inputs.
4. Automatic parsing and injection of UTM parameters (`utm_source`, `utm_medium`, etc.) and referrer.
5. In-memory offline event queue and fallback between `sendBeacon` and `fetch({ keepalive: true })`.

## Decisions

1. **SPA Pageview Interception**:
   - Wrap `window.history.pushState` and `window.history.replaceState`, and listen to `popstate` to trigger `$pageview` automatically when `capture_pageview !== false`.
2. **Autocapture**:
   - When `autocapture: true` in config, attach a global click listener capturing `tag_name`, `element_id`, `element_text`, `element_classes`, `href` (for `<a>`).
3. **Identity Tracking**:
   - `opentrack.identify(distinctId, userProperties)` sends an `$identify` event with `$anon_distinct_id` set to the previous anonymous UUID, and switches the local `distinct_id` to the canonical identified user ID.
4. **Offline Queue & Beacon Transport**:
   - If offline (`!navigator.onLine`) or fetch fails, queue events in memory and flush upon network reconnection (`window.addEventListener('online', ...)`).
   - Use `navigator.sendBeacon` if available when tab unloads, otherwise fallback to `fetch(..., { keepalive: true })`.

## Steps

### Step 1 — SDK Feature Expansion
Files:
- `packages/sdk/src/index.ts`
- `packages/sdk/src/autocapture.ts`
- `packages/sdk/src/pageview.ts`
- `packages/sdk/src/transport.ts`
- `packages/sdk/src/session.ts`

### Step 2 — Comprehensive Vitest Suite
Files:
- `packages/sdk/src/index.test.ts`
Test `identify`, `capture`, autocapture listener, SPA pageview tracking, and offline queue behavior.

### Step 3 — Build Verification
Verify `pnpm --filter @opentrack/web build` outputs both ESM and minified IIFE bundle `< 5KB`.
