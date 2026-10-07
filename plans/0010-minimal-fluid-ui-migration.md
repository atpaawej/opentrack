---
number: 0010
title: Minimal, fluid analytics UI migration
status: draft
grilled: pending
---

# 0010 — Minimal, fluid analytics UI migration

> **Goal:** OpenTrack feels like a calm, fast instrument for people shipping AI-assisted web apps: it explains what happened, where people dropped off, and what has not been instrumented, without implying nonexistent data.

## Problem

The current interface has many pages but the overview does not yet feel like a connected analytics product. A row of near-identical KPI cards, a hand-built chart, and several tabbed lists make the data feel dispersed. Controls and motion are implemented differently in each feature. The reference screenshots suggest the desired density and interactive analytical feel, **not** a request to reproduce DataFast's colors, empty panels, or upsell overlays.

## Audience and job

**Proposed interpretation to confirm:** independent makers and small product teams shipping AI-assisted / “vibe-coded” websites and apps. They want to verify tracking, see traffic and behavior, find drop-offs, and decide what to instrument next. This is analytics **for** those apps, not automatic tracking of the coding assistant or the build process.

## Why this is a migration, not a reskin

- Next.js App Router, React 19, Tailwind 3, Clerk, and Sonner are already in place (`apps/web/package.json`).
- The current UI owns shadcn-style `Button`, `Dialog`, `Sheet`, `Table`, and other primitives under `apps/web/src/components/ui/`; `tabs.tsx` is hand-built and lacks the complete keyboard/tab-panel contract. Feature-local controls still bypass primitives (`features/web-analytics/components/breakdown-panels.tsx`, `features/insights/components/insights-chart.tsx`).
- Overview chart and insight visualizations are custom SVG, and funnel steps are custom CSS bars (`features/web-analytics/components/time-series-chart.tsx`, `features/insights/components/insights-chart.tsx`, `features/funnels/components/funnel-chart.tsx`).
- Global theme is barely tokenized and the root forces dark mode (`app/globals.css`, `app/layout.tsx`, `tailwind.config.ts`). Mobile sidebar vanishes without a replacement (`components/dashboard/sidebar.tsx`).
- Only pageviews are emitted automatically by the SDK; optional click autocapture and explicit custom events are available (`packages/sdk/src`). Analytics aggregates contain real limitations documented below. The product spec in `docs/opentrack.md` describes some future capabilities as if already present; implementation must govern UI claims.

## Decisions — proposed, not yet approved

### Definition: minimal + fluid

- **Minimal** = one strong information hierarchy, fewer simultaneous controls, one primary question per region, restrained surfaces, plain language, compact but legible density, useful empty/error states. Not tiny typography or hiding essential data.
- **Fluid layout** = intentional scaling between screen sizes for gutters, headings and major spacing; real layout breakpoints when structure changes; no scaling down controls until they become unusable.
- **Fluid interaction** = immediate feedback, spatially coherent overlays, retargetable motion on reversible actions, stable chart geometry during fetches, navigation that never waits on a transition. Not constant animation.
- **Analytics-rich** = the right visual form for available data, not more charts for their own sake. Every module answers a question, states its unit/time window, and offers a next action where applicable.

### First-pass visual plan, then critique

**First pass considered:** dark navy canvas, mint accent, five KPI cards, large chart, matching rounded breakdown cards. **Critique:** that is a recolored SaaS kit; it could describe any analytics clone. **Revised direction:** retain the dark engineering context of the product, but make a single traffic *trace* and its attached metric rail the visual signature. Use a ledger-like ranked area below it and one contextual conversion/instrumentation module. Reserve mint for selected data and live/healthy state; do not paint every CTA and card mint. Borders divide unlike information; no endless equal-height empty cards or decorative grid lines.

Core palette (working tokens, check contrast on actual screens):

| Token | Hex | Role |
| --- | --- | --- |
| `canvas` | `#0D171C` | Deep blue-charcoal workspace, not pure black |
| `surface` | `#16262D` | Chart and control surfaces |
| `edge` | `#33515A` | Information grouping and focus-adjacent separation |
| `ink` | `#F0F5F3` | Primary text and numbers |
| `muted` | `#B3C6C8` | Secondary data, not placeholder-grey microcopy |
| `signal` | `#76D5C3` | Selected series / verified live state |

Additional semantic warning/error and comparison-series colors are defined separately and never rely on color alone. Use CSS variables for surfaces, text, chart series, focus and semantic status, with Tailwind mapping; do not scatter literal hex values in feature files.

**Type:** IBM Plex Sans for navigation, body and tabular-number metrics (`font-variant-numeric: tabular-nums`); IBM Plex Mono only for event names, paths, API keys and code. Headings ~24–28px desktop / ~22–24px mobile, body 14–15px, dense secondary information 12–13px minimum when practical. Sentence case, left alignment, readable labels, no mandatory uppercase eyebrows. Use a single number as a focal point only when it answers a question, not as decorative hero copy.

**Layout:** persistent project shell; page title and date/filter actions share a top row; the main chart occupies the first large reading surface, with compact metrics attached above it. Below, two unequal areas show ranked behavior and configuration-dependent conversion; deeper analysis stays in Insights and Funnels. Keep labels and values left aligned; align numeric columns on the right. Reflow to one column on mobile with visible mobile navigation.

```text
Desktop / overview
┌ project / nav ┬  Project name                 [Date range] [Refresh] ┐
│              │  ┌ Visitors │ Pageviews │ Sessions │ Bounce │ Duration ┐│
│              │  │         Traffic over time / selectable series        ││
│              │  │                        TRACE                         ││
│              │  └──────────────────────────────────────────────────────┘│
│              │  ┌ Pages & event activity ─────┐ ┌ Conversion / setup ┐ │
│              │  │ ranked, comparable values   │ │ only if configured │ │
│              │  └─────────────────────────────┘ └───────────────────┘ │
└──────────────┴──────────────────────────────────────────────────────────┘

Mobile / overview
┌ Project  [Menu] ┐
│ Date range      │
│ KPI strip/stack │
│ Traffic chart   │
│ Pages & events  │
│ Conversion/setup│
└─────────────────┘
```

The other viable option—several equal dashboard cards mirroring the screenshots—was rejected: it looks busy when empty and buries the main signal. Keep the distinctive choice in the trace/metric composition; all other surfaces remain quiet.

### Navigation and page roles

- **Overview** `/:projectSlug`: installation state until data arrives; then traffic trace, key metrics, top pages/event activity and a conditional configured funnel or an invitation to instrument one. Date range is shared across modules. No invented KPI.
- **Live events** `/live`: fast inspectable event feed with pause/filter; accessible event-details sheet; no decorative chart in a log.
- **Explore** `/insights` (keep route): query builder beside/above results, one visualization at a time (trend, distribution or table), saved queries later.
- **Funnels** `/funnels`: step conversion with exact denominators and drill-down, not a redundant donut. No sample conversion numbers when events are absent.
- **People** `/persons` (keep route): directory and event/session history; explicitly distinguish identified people from anonymous visitors.
- **Settings** `/settings`: grouped project, tracking, privacy and destructive actions. First-event installation guidance remains prominent on empty Overview, not a perpetual overlay over fake charts.
- `/analytics` currently duplicates the overview without a sidebar link: retain as a compatible redirect or define a distinct role before altering routes.

### Analytics/data contract

**Available now:** distinct-event-ID visitors, `$pageview` count, session count, bounce and observed session duration; time series for visitors/pageviews/sessions; top page/referrer/campaign/geo/device dimensions; custom-event insight aggregates; configured funnels; live and person history. These are computed in `features/web-analytics/service.ts`, `features/insights/service.ts`, and `features/funnels/service.ts`.

**Correct before presenting as trustworthy:** label breakdowns as *event counts* until rewritten to count pageviews/visitors; calculate shares against all eligible data rather than only the returned top ten; do not imply first-touch attribution from event referrers; fill missing time buckets with zero; make timezone explicit; render previous-zero growth as `New`/not comparable rather than +100%; distinguish data load failure from actual zero activity (`app/(dashboard)/[projectSlug]/page.tsx`, `analytics/page.tsx`); audit identity aliasing and bounce/session definitions. Chart tooltips and totals must match the service contract.

**Vibe-coded-app template, only after instrumentation:** small opt-in event recipes such as `signup_completed`, `feature_used`, `build_failed`, `app_error`, and `deploy_completed` with copyable SDK/server capture examples, a detected/not-detected status, and a funnel template **only when matching events exist**. Define denominator, identity and privacy handling first. Do not claim deployment quality, revenue, AI cost, retention, or acquisition ROI without the required event/property model and calculations. No external mock data in production dashboards.

**Visualization map, driven by a question rather than a chart quota:**

| Question | Visual | Data prerequisite |
| --- | --- | --- |
| Is anyone using the app, and when? | Overview time-series line/area plus compact visitor/pageview/session rail | Existing bucketing, after zero-fill/timezone and empty/error fixes |
| Which pages and events matter? | Ranked page/event table with comparable horizontal bars where useful | Existing page breakdown must be scoped to pageviews; top custom-event counts need a new query |
| Where do users come from? | Compact referrer/UTM ranked table, with explicit *event context* label until attribution exists | Existing referrer/campaign events; no first-touch attribution claim |
| Where do users leave a configured flow? | Recharts horizontal step bars, step-to-step and total conversion values | Explicitly captured ordered events and a configured funnel |
| How is a custom metric changing? | Recharts line or bar for Insight, table for exact values, donut only for a real low-cardinality part-to-whole | User-selected event/property and valid numeric data for numeric aggregation |
| What happened just now? | Live event log, not a decorative chart | Recent ingested events |

### Libraries and ownership

- **shadcn/ui:** keep source-owned primitives in `src/components/ui`, update from compatible official shadcn components as needed. Radix Tabs, Tooltip, Select, Popover, AlertDialog, navigation sheet, etc. replace local reimplementations; existing Radix Dialog/Sheet and Sonner remain. Do not blindly overwrite locally modified primitives. Plain semantic markup remains fine for non-interactive content.
- **Recharts:** migrate traffic/insights and actual funnel graphics to Recharts, optionally using shadcn's `ChartContainer`/tooltip/legend composition for consistent theme. Feature services return chart-ready typed data; Recharts lives only in client chart components. Keep ranked tables as tables when comparisons are clearest. No second chart abstraction (Tremor) in this pass. Include keyboard-accessible chart data/table fallback, readable ticks and mobile inspection.
- **Motion for React:** use the current `motion` package (successor to Framer Motion) only at meaningful seams; keep existing CSS press/hover for simple controls. Motion must live in small client boundaries so server pages do not become client pages. Keep Radix semantics/focus/portal behavior and use controlled presence where exit animations require it. Never hold route navigation for an exit animation.
- **Fluid for Tailwind CSS:** propose `fluid-tailwind` for selected viewport-responsive type/gutters (`clamp()`), not motion. Pilot against existing Tailwind 3 config, rem-based `screens`/font sizes and its extractor; add its `tailwind-merge` integration if `cn()` combines fluid utilities. Do not mix this decision with an unplanned Tailwind 4 migration. Use fixed minimum tap targets and actual breakpoint reflow for dense charts/tables.

### Button contract and trailing arrow

Keep one CVA `Button` implementation with stable variants: `default` (primary action), `secondary`, `outline`, `ghost`, `destructive`, `link`; and consistent `sm`, `default`, `lg`, `icon` sizes. Use a semantic wrapper/opt-in `trailingArrow` only for forward/navigation actions. Rest state is a right chevron (`>`); on fine-pointer hover or keyboard focus, a short stem reveals and the chevron shifts 2px to read as `→`. Reserve the icon's width from the start; animate stem width/opacity and icon transform over ~150ms with `--ease-out`, without changing text or moving the button. On touch show the complete arrow or static chevron; on reduced motion show the final state instantly. No arrow on Save, Delete, loading or icon-only buttons. Accessible action name never depends on the arrow. Press response remains subtle (~0.98 scale, 100–160ms) and disabled buttons never animate.

### Motion opportunities: gated by frequency, purpose, speed and function

| # | Location | Today | Purpose | Frequency | Suggested motion |
| --- | --- | --- | --- | --- | --- |
| 1 | `components/ui/dialog.tsx:28`, `sheet.tsx:29` | CSS enter/exit, questionable sheet easing utility | Spatial consistency | Occasional | Overlay opacity 180ms; dialog opacity + scale `.97 → 1` 220ms `--ease-out`; sheet translateX `100% → 0` 280ms `--ease-drawer`, same-edge exit 200ms. Test rapid reversal and Radix focus. |
| 2 | `components/ui/tabs.tsx:70` | Selection and panel swap snap | State indication | Tens/day | Active indicator transforms in 140ms `--ease-out`; data content changes immediately without queued fade; use Radix Tabs keyboard semantics. |
| 3 | `app/(dashboard)/[projectSlug]/layout.tsx:38` | Nav content replaces abruptly | Preventing a jarring change | Tens/day | Keep header/sidebar stationary; on resolved route content only, opacity `0.85 → 1` in 120ms `--ease-out`; no page-wide slide or blocking exit. Try it on devices; remove if it reduces perceived speed. |
| 4 | `components/dashboard/setup-guide.tsx:56` | First received event swaps setup state | Feedback | Rare | Swap tracking status via opacity + 4px transform in 220ms `--ease-out`; announce connection to assistive tech; no celebratory confetti. |
| 5 | `features/persons/components/person-profile.tsx` | Session details pop open | State indication | Occasional | Radix Accordion measured height + opacity in 200ms `--ease-out`; test nested scrolling and rapid toggle. |

**Rejected candidates (the gate matters):**

- `features/web-analytics/components/time-series-chart.tsx` — line-drawing/chart-wide transitions during range changes. **Function:** the data is being read, so decorative motion hinders comprehension.
- `components/dashboard/sidebar.tsx` — delayed nav exit before changing pages. **Frequency:** repeat navigation; any waiting reduces speed.
- `features/live-stream/components/live-stream-feed.tsx` — stagger every polled row. **Frequency and function:** repeated arrivals make a monitoring view unstable.
- `features/web-analytics/components/kpi-cards.tsx` — count-up on every fetch. **Function:** exact values become difficult to read.

**Verdict:** this data-heavy interface needs a few high-leverage state transitions, not a motion blanket. Overlay behavior has the greatest shared reach. Motion is feedback, not the visual identity. Use `improve-animations plan <suggestion>` if a standalone motion implementation plan is needed. For every suggestion use gentler opacity-only or instant geometry under `prefers-reduced-motion`; gate hover-only states behind `(hover: hover) and (pointer: fine)`, and retain keyboard focus and touch behavior.

## Steps

### Step 0 — Validate truth and record a baseline

Files: `features/web-analytics/service.ts`, `features/insights/service.ts`, `features/funnels/service.ts`, both overview route files; current route screenshots.

Document metric definitions, sample real/zero/error states, date-bucket semantics and existing chart interactions; add representative fixtures and tests. Capture desktop/mobile screenshots before changes. Fix zero-on-error and misleading labels/deltas before replacing chart rendering.

**Done when:** each visible metric has a tested source, unit, denominator and empty/error rule; screenshot baseline exists.

### Step 1 — Tokens, typography, shell and primitives

Files: `app/globals.css`, `tailwind.config.ts`, `app/layout.tsx`, `components/dashboard/{header,sidebar}.tsx`, `components/ui/{button,tabs,dialog,sheet,...}.tsx`, `lib/utils.ts`.

Pilot palette and type; introduce semantic tokens; wire mobile navigation; standardize Radix/shadcn controls, focus/touch sizes and arrow affordance; remove dead Tailwind utilities (`zinc-850`, `zinc-750`, `ease-drawer`, `duration-400` where unconfigured); keep Clerk and Sonner visually aligned. Treat theme switching as a separate decision; dark-first is sufficient initially.

**Done when:** shared primitives and shell work with keyboard/touch at 360, 768, 1440px; no hard-coded palette is needed on a migrated screen.

### Step 2 — Ship Overview as the reference slice

Files: `features/web-analytics/components/{analytics-dashboard,kpi-cards,time-series-chart,breakdown-panels}.tsx`, overview routes and analytics services.

Build integrated metric/traffic composition using Recharts; choose one default series, accessible metric controls and chart/table fallback; promote pages and event activity only with correct aggregations. Add useful no-data/partial-data/error states, keep filters stable during fetching, and prevent racing date-range requests from showing stale results. Align header/time range with content.

**Done when:** users can answer “is tracking working, what changed, and where did traffic go?” without opening a second page; chart values match service fixtures and there is no misleading empty chart.

### Step 3 — Migrate deeper analysis

Files: `features/insights/components/{query-builder,insights-chart}.tsx`, `features/funnels/components/{funnel-builder,funnel-chart}.tsx`.

Use shared inputs/selects/tabs/dialogs, replace custom SVG/CSS chart graphics with Recharts where appropriate, keep tables where they communicate more clearly, and preserve CSV/export and person drill-down. Show what event definitions are missing instead of a fake funnel. Saved-query discovery is separate product work.

**Done when:** filters, tables and chart types agree on values; funnel steps expose conversion denominator and missing-step state.

### Step 4 — Finish high-frequency and edge screens

Files: `features/live-stream/components/*`, `features/persons/components/*`, `components/dashboard/setup-guide.tsx`, `app/(dashboard)/[projectSlug]/settings/*`.

Fix keyboard access to clickable rows/disclosures; apply dialog/sheet/accordion motion sparingly, responsive overflow for tables, plain-language setup/empty/error text and settings safety. Preserve Clerk auth and API key controls. Resolve duplicate `/analytics` behavior without breaking old links.

**Done when:** every route has mobile navigation, a tested loading/empty/error path and complete keyboard access to its primary action.

### Step 5 — App-specific instrumentation, if confirmed

Files: `packages/sdk/src/*`, setup docs/UI, event query services and tests.

Define opt-in AI-built-app event recipes and one activation funnel with exact definitions; add detection and setup guides first, then render only genuinely observed data. Do not ship speculative revenue, deploy or reliability dashboards.

**Done when:** a new project sees a truthful installation path; an instrumented fixture sees a meaningful conversion view; an uninstrumented project never displays invented metrics.

### Step 6 — Bring the public and auth surfaces into the same system

Files: `app/page.tsx`, `app/(auth)/*`, `components/dashboard/create-first-project.tsx`, `components/dashboard/project-switcher.tsx`.

Apply the approved tokens and type to the landing, sign-in/up wrappers and first-project flow without replacing Clerk's accessible auth UI. Let the landing's first screen demonstrate a real event-to-answer workflow rather than a generic number/gradient hero; do not invent customer data or testimonial claims. Align copy and button variants with the product shell.

**Done when:** the public page, authentication, first project creation and product dashboard feel like one product, including mobile and keyboard states.

## Seams / verification

- Service-level tests for metric definitions, top-N percentages, zero buckets, timezone, identity caveats and absence of events; keep aggregation logic outside chart components.
- Component interaction tests (add browser-capable UI harness) for Radix dialog/sheet focus and Escape, keyboard tabs/rows, arrow hover/focus/touch, chart controls, rapid open/close, and out-of-order fetches. Current Vitest setup runs in `node` and has no meaningful UI interaction coverage.
- Visual review at 360/768/1440/1920px and light/dark browser preferences while dark mode is forced. Verify readable contrast, stable skeleton dimensions, reduced-motion behavior and no mobile horizontal clipping; check chart keyboard/touch summaries.
- Migration by vertical slice, not a flag-day package swap. Preserve existing URLs and server-side auth checks.

## Out of scope

Copying DataFast's layout/brand, fake sample traffic on live projects, a blanket redesign of marketing/auth flows in the first slice, automatic bot/LLM/deployment/revenue tracking with no data model, a new chart library on top of Recharts, and blanket animation of all screens. The screenshot is a density/interaction reference, not a specification of available metrics.

## Open questions

1. Does “for vibe-coded apps” mean analytics **for apps built with AI** (recommended), or analytics *of the app-building workflow itself* (prompt/build/deploy telemetry)? These are different products and event contracts.
2. Is **dark-first** the desired shipped direction for this migration (recommended based on repo and reference), with light mode postponed?
3. Should the first implementation slice be **tokens + shell + Overview** (recommended), with insights/funnels/live migrated incrementally?

## Primary library references

- [Fluid for Tailwind CSS: installation/limits](https://fluid.tw/) — fluid viewport utilities, not animation.
- [shadcn/ui Charts](https://ui.shadcn.com/docs/components/chart) — Recharts with theme/tooltip composition, keyboard accessibility layer and explicit chart height.
- [Motion for React install](https://motion.dev/docs/react-installation) and [Radix integration](https://motion.dev/docs/radix) — `motion` package and controlled presence for Radix exit animations.
