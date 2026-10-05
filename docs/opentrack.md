# OpenTrack — Product Specification & Technical Architecture

## 1. Executive Summary & Vision

**OpenTrack** is an open-source, developer-first product analytics platform designed as a lightweight, modern, and transparent alternative to proprietary analytics platforms such as PostHog, Mixpanel, and Amplitude.

### Core Philosophy
* **Complete Data Ownership**: Self-hostable with direct access to raw PostgreSQL data without vendor lock-in.
* **Modern Developer Experience**: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Tremor visualizations, and a sleek dark-mode-first aesthetic.
* **Seamless Authentication & Multi-Tenancy**: Built-in authentication and organization management powered by Clerk.
* **Serverless Scalability**: Database persistence backed by Neon Serverless PostgreSQL with optimized indexing for high-throughput time-series event ingestion.
* **Privacy by Design**: Configurable cookie-less tracking modes, IP anonymization, and granular data retention policies compliant with GDPR and CCPA.

---

## 2. System Architecture & Tech Stack

### 2.1 Workspace Structure (`pnpm` Monorepo)
The repository is organized as a clean, minimal `pnpm` workspace where application code lives directly inside `apps/web` without artificial internal package fragmentation:

```
OpenTrack/
├── apps/
│   └── web/                         # Next.js (App Router, Server Actions, Ingestion API)
│       ├── src/
│       │   ├── app/                 # Next.js thin routing entry points
│       │   │   ├── (auth)/          # Styled Clerk Auth pages (sign-in, sign-up)
│       │   │   ├── (dashboard)/     # Authenticated dashboard views
│       │   │   │   └── [projectSlug]/
│       │   │   │       ├── analytics/
│       │   │   │       ├── live/
│       │   │   │       ├── insights/
│       │   │   │       ├── funnels/
│       │   │   │       ├── persons/
│       │   │   │       └── settings/
│       │   │   └── api/v1/          # Ingestion route handlers (/capture, /batch)
│       │   ├── features/            # VERTICAL SLICE ARCHITECTURE (VSA)
│       │   │   ├── ingestion/       # Effect pipeline, validation schemas, batch writes
│       │   │   ├── web-analytics/   # KPI metrics, pageviews, referrers, geo aggregations
│       │   │   ├── live-stream/     # Real-time event log, inspector drawer
│       │   │   ├── funnels/         # Funnel calculation engine, drop-off queries
│       │   │   ├── insights/        # Custom query builder & aggregation services
│       │   │   ├── persons/         # Identity resolution ($identify), user timelines
│       │   │   └── projects/        # API key generation, domain allowlists, settings
│       │   ├── components/ui/       # Base UI primitives (shadcn/ui + Radix)
│       │   └── lib/                 # Shared infrastructure (non-domain)
│       │       ├── db/              # Drizzle ORM schema, Neon connection pool
│       │       ├── effect/          # Effect runtime runner & error boundary bridges
│       │       └── auth/            # Clerk auth helpers & organization context
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   └── sdk/                         # Standalone Client Tracker (@opentrack/web / opentrack.js)
│       ├── src/                     # Client tracking runtime (< 5KB gzip)
│       ├── tsup.config.ts           # Bundles IIFE (<script> tag) + ESM + CJS
│       └── package.json
├── pnpm-workspace.yaml
└── package.json
```

### 2.2 Core Tech Stack
1. **Frontend & Application Server**: Next.js (App Router, Server Actions, React 19, strict TypeScript).
2. **Production Reliability & Effect System**: **Effect-TS (`effect`)** for functional domain workflows, resilient retry policies, concurrency control, and typed error channels.
3. **Boundary Validation**: **`@effect/schema`** for strictly typed, compile-time and runtime validation of ingestion payloads, query parameters, and mutations.
4. **Database & Storage**: **Neon Serverless PostgreSQL** with pooled connections, optimized for Vercel deployment.
5. **Data Access Layer**: **Drizzle ORM** for type-safe schema definitions and high-performance SQL generation.
6. **Authentication & Multi-Tenancy**: **Clerk (`@clerk/nextjs`)** with Clerk's native `dark` theme from `@clerk/themes`, seamlessly matching the card styling and dark interface out of the box.
7. **Styling, UI Primitives & Motion**: Tailwind CSS, **shadcn/ui** primitives (Radix UI), Lucide Icons, **Sonner** for fluid stacked toast notifications, and **Tremor / Recharts** for high-density analytics visualizations.
8. **Client Tracking SDK**: Zero-dependency standalone TypeScript library (`packages/sdk`) compiled to a micro-bundle (`opentrack.min.js`, < 5KB).
9. **Deployment Target**: Vercel (Edge/Serverless functions, zero-cold-start database pooling via Neon).

### 2.3 Vertical Slice Architecture (VSA) Rules
To prevent messy cross-dependencies and ensure maintainability:
* **Feature Slices are Self-Contained**: Each feature inside `src/features/<feature-name>` encapsulates its domain schemas, Drizzle database queries, Effect workflows, and React components.
* **No Raw Database Queries in UI or Route Handlers**: Route handlers (`src/app/api/...`) and Server Components are strictly thin orchestrators. They invoke the respective feature slice's Effect service and handle HTTP/JSON responses or render views.
* **Explicit Typed Domain Errors**: Slices define explicit `TaggedError` classes (e.g. `InvalidApiKeyError`, `DomainNotAllowedError`). Errors are handled via Effect's typed error channel rather than untyped `try/catch` exceptions.

### 2.4 Clerk Auth & Dark-Mode-First UI Foundation
* **Native Dark Theme**: Designed dark-mode-first using `zinc-950` backgrounds, deep high-contrast borders (`zinc-800`), glowing status accents, and crisp typography.
* **Clerk Native Dark Cards**: Authentication screens (`<SignIn />`, `<SignUp />`) and navigation widgets (`<UserButton />`, `<OrganizationSwitcher />`) leverage Clerk's prebuilt `dark` theme (`baseTheme: dark`), delivering clean, polished dark card UI without fragile custom CSS hacks.
* **Fluid Frontend Engineering**: The UI adheres to design engineering foundations (spring physics, interruptible transitions, zero-layout-shift skeletons, tactile hover and press feedback, and Sonner toasts) for an ultra-snappy, native-feeling experience.

---

## 3. Data Models & Database Schema

The database schema is structured for efficient time-series querying, rapid event writes, and identity resolution.

### 3.1 Organizations & Projects
* **`organizations`**
  * `id`: UUID (Primary Key)
  * `clerk_org_id`: VARCHAR (Indexed, mapping to Clerk Organization)
  * `name`: VARCHAR(255)
  * `created_at`: TIMESTAMP WITH TIME ZONE
  * `updated_at`: TIMESTAMP WITH TIME ZONE

* **`projects`**
  * `id`: UUID (Primary Key)
  * `organization_id`: UUID (Foreign Key -> `organizations.id`, Indexed)
  * `name`: VARCHAR(255)
  * `slug`: VARCHAR(255)
  * `api_key`: VARCHAR(64) (Unique, Indexed, public ingestion key with prefix `ot_live_...`)
  * `secret_key`: VARCHAR(64) (Hashed, private API key with prefix `ot_sec_...`)
  * `allowed_domains`: TEXT[] (Array of allowed origin hostnames for CORS verification)
  * `timezone`: VARCHAR(64) (Default `'UTC'`)
  * `data_retention_days`: INTEGER (Default `365`)
  * `created_at`: TIMESTAMP WITH TIME ZONE
  * `updated_at`: TIMESTAMP WITH TIME ZONE

### 3.2 Events Table (Time-Series Optimized)
* **`events`**
  * `id`: UUID (Primary Key, default `gen_random_uuid()`)
  * `project_id`: UUID (Foreign Key -> `projects.id`, Indexed)
  * `event_name`: VARCHAR(255) (Indexed)
  * `distinct_id`: VARCHAR(255) (Indexed, unique user or anonymous session identifier)
  * `session_id`: VARCHAR(255) (Indexed, grouped browser visit identifier)
  * `properties`: JSONB (Indexed with GIN index for arbitrary key-value queries)
  * `user_agent`: TEXT
  * `browser`: VARCHAR(64) (Indexed)
  * `browser_version`: VARCHAR(64)
  * `os`: VARCHAR(64) (Indexed)
  * `device_type`: VARCHAR(32) (`'desktop'`, `'mobile'`, `'tablet'`, `'bot'`)
  * `screen_width`: INTEGER
  * `screen_height`: INTEGER
  * `ip_hash`: VARCHAR(64) (SHA-256 one-way hash of IP with salt for privacy)
  * `country_code`: VARCHAR(2) (ISO 3166-1 alpha-2, Indexed)
  * `region`: VARCHAR(64)
  * `city`: VARCHAR(128)
  * `referrer`: TEXT
  * `referrer_domain`: VARCHAR(255) (Indexed)
  * `page_url`: TEXT
  * `page_path`: VARCHAR(512) (Indexed)
  * `utm_source`: VARCHAR(128) (Indexed)
  * `utm_medium`: VARCHAR(128) (Indexed)
  * `utm_campaign`: VARCHAR(128) (Indexed)
  * `utm_term`: VARCHAR(128)
  * `utm_content`: VARCHAR(128)
  * `timestamp`: TIMESTAMP WITH TIME ZONE (Indexed, primary time ordering column)
  * `created_at`: TIMESTAMP WITH TIME ZONE (Default `NOW()`)

* **Indexes**:
  * `CREATE INDEX idx_events_project_time ON events(project_id, timestamp DESC);`
  * `CREATE INDEX idx_events_project_event_time ON events(project_id, event_name, timestamp DESC);`
  * `CREATE INDEX idx_events_project_distinct ON events(project_id, distinct_id, timestamp DESC);`
  * `CREATE INDEX idx_events_properties_gin ON events USING GIN (properties);`

### 3.3 Persons & Identity Resolution
* **`persons`**
  * `id`: UUID (Primary Key)
  * `project_id`: UUID (Foreign Key -> `projects.id`, Indexed)
  * `distinct_id`: VARCHAR(255) (Unique per project, primary canonical user ID)
  * `properties`: JSONB (User traits: `email`, `name`, `avatar`, `plan`, custom fields)
  * `first_seen_at`: TIMESTAMP WITH TIME ZONE
  * `last_seen_at`: TIMESTAMP WITH TIME ZONE
  * `created_at`: TIMESTAMP WITH TIME ZONE
  * `updated_at`: TIMESTAMP WITH TIME ZONE

* **`person_aliases`**
  * `id`: UUID (Primary Key)
  * `project_id`: UUID (Foreign Key -> `projects.id`, Indexed)
  * `alias_id`: VARCHAR(255) (Secondary distinct ID, e.g. anonymous visitor UUID)
  * `person_distinct_id`: VARCHAR(255) (Canonical distinct ID of identified user)
  * `created_at`: TIMESTAMP WITH TIME ZONE
  * Unique Constraint: `(project_id, alias_id)`

### 3.4 Saved Insights, Funnels & Dashboards
* **`dashboards`**
  * `id`: UUID (Primary Key)
  * `project_id`: UUID (Foreign Key -> `projects.id`, Indexed)
  * `name`: VARCHAR(255)
  * `description`: TEXT
  * `is_default`: BOOLEAN (Default `false`)
  * `created_by`: VARCHAR(255) (Clerk User ID)
  * `created_at`: TIMESTAMP WITH TIME ZONE
  * `updated_at`: TIMESTAMP WITH TIME ZONE

* **`insights`**
  * `id`: UUID (Primary Key)
  * `project_id`: UUID (Foreign Key -> `projects.id`, Indexed)
  * `dashboard_id`: UUID (Nullable Foreign Key -> `dashboards.id`)
  * `name`: VARCHAR(255)
  * `type`: VARCHAR(32) (`'trend'`, `'funnel'`, `'retention'`, `'table'`)
  * `query_config`: JSONB (Filters, breakdown properties, metrics, date ranges)
  * `layout`: JSONB (Position and dimensions on dashboard grid)
  * `created_by`: VARCHAR(255) (Clerk User ID)
  * `created_at`: TIMESTAMP WITH TIME ZONE
  * `updated_at`: TIMESTAMP WITH TIME ZONE

---

## 4. Client Tracking SDK (`opentrack.js`)

### 4.1 Delivery Formats
1. **CDN Script Tag**: Single minified script tag embeddable into any HTML `<head>`:
   ```html
   <script
     src="https://cdn.opentrack.dev/v1/opentrack.min.js"
     data-api-key="ot_live_xxxxxxxxxxxxxxxx"
     data-endpoint="https://analytics.yourdomain.com"
     defer>
   </script>
   ```
2. **NPM Package**: Module package for React, Next.js, Vue, Svelte, and vanilla TypeScript apps:
   ```bash
   npm install @opentrack/web
   ```

### 4.2 SDK Core Capabilities
* **Automatic Pageview Tracking**: Intercepts `pushState`, `replaceState`, and `popstate` to handle Single Page Applications (SPAs) without page refreshes.
* **Auto-Capture (Optional)**: Automatically tracks clicks on interactive elements (`<button>`, `<a>`, `input[type="submit"]`), logging tag names, IDs, CSS classes, inner text, and target URLs.
* **Session Persistence**: Maintains an anonymous `distinct_id` and a rotating `session_id` (expires after 30 minutes of inactivity) in `localStorage` / first-party cookies.
* **UTM & Referrer Extraction**: Automatically parses `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, and `document.referrer`.
* **Reliable Transport Mechanism**:
  * Uses `navigator.sendBeacon` for zero-delay delivery when closing or navigating away from tabs.
  * Falls back to `window.fetch` with `keepalive: true`.
  * In-memory event queue with exponential backoff retries when client is offline or experiencing network drops.

### 4.3 SDK JavaScript API Reference
```typescript
import { opentrack } from '@opentrack/web';

// 1. Initialization
opentrack.init('ot_live_9a7b8c...', {
  api_host: 'https://analytics.yourdomain.com',
  autocapture: true,
  capture_pageview: true,
  disable_session_recording: false,
  cookie_domain: '.yourdomain.com',
  persistence: 'localStorage', // 'localStorage' | 'cookie' | 'memory'
});

// 2. Custom Event Capture
opentrack.capture('plan_upgraded', {
  previous_plan: 'starter',
  new_plan: 'enterprise',
  seats: 25,
  monthly_billing_usd: 499.00
});

// 3. User Identification
opentrack.identify('usr_98124', {
  email: 'alex@example.com',
  name: 'Alex Vance',
  role: 'CTO',
  account_tier: 'enterprise'
});

// 4. Session Reset (Logout)
opentrack.reset();
```

---

## 5. Event Ingestion Pipeline & API

### 5.1 Endpoints
* **`POST /api/v1/capture`**: Ingest a single event payload.
* **`POST /api/v1/batch`**: Ingest an array of up to 100 events in a single HTTP request.

### 5.2 Ingestion Flow & Security
1. **API Key Authentication**: Extract `api_key` from request body or `X-OpenTrack-Key` header. Validate project existence from cached project records.
2. **CORS & Domain Verification**: If `allowed_domains` is populated on the project, compare against the `Origin` and `Referer` headers. Reject unauthorized cross-origin requests.
3. **Rate Limiting**: IP-based and API-key-based token bucket rate limiter to prevent ingestion floods and Denial of Service.
4. **Geo & User-Agent Enrichment**:
   * Parse user agent for browser, OS, and device classification.
   * Parse client IP for country, region, and city headers (Vercel/Cloudflare headers or maxmind GeoIP).
5. **IP Anonymization**: Strip raw client IP address; replace with irreversible salted SHA-256 hash `ip_hash` to preserve privacy while supporting unique visitor counting.
6. **Person & Alias Update**: If payload is an `identify` or `alias` event, upsert into `persons` and `person_aliases` asynchronously.
7. **Storage Execution**: Batch insert events into the Neon PostgreSQL `events` table with prepared statements.

### 5.3 Event Payload Schema (`POST /api/v1/capture`)
```json
{
  "api_key": "ot_live_abcdef123456",
  "event": "checkout_completed",
  "distinct_id": "anon_84f93b2a-1941",
  "session_id": "sess_810283",
  "timestamp": "2026-10-05T16:20:00.000Z",
  "properties": {
    "$current_url": "https://myapp.com/checkout/success",
    "$pathname": "/checkout/success",
    "$referrer": "https://myapp.com/pricing",
    "$browser": "Chrome",
    "$os": "Windows",
    "$screen_width": 1920,
    "$screen_height": 1080,
    "order_id": "ord_91823",
    "total_amount": 149.50,
    "currency": "USD",
    "items_count": 3
  }
}
```

---

## 6. Dashboard & User Interface Specifications

The OpenTrack web interface is built around a dark-mode-first aesthetic with fast navigation, clear typography, dense usable data layouts, and fluid motion inspired by Emil Kowalski and Apple design engineering principles.

### 6.1 Design System & Component Primitives
* **Theme Foundation**: Native Dark mode (`zinc-950` canvas, `zinc-900` card surfaces, `zinc-800` subtle high-contrast borders), with an optional Light mode toggle via `next-themes`.
* **Component Primitives (shadcn/ui + Radix)**:
  * Overlays: `Dialog`, `Sheet` (slide-over drawer), `Popover`, `Tooltip`, `DropdownMenu`.
  * Navigation: `Tabs`, `Command` palette (`cmdk`), `Breadcrumbs`.
  * Forms & Controls: `Button`, `Input`, `Select`, `Switch`, `Calendar` / Date Range Picker.
  * Data Display: `Card`, `Table`, `Badge`, `Skeleton`.
  * Notifications: **Sonner** (`sonner`) providing stacked, swipeable, spring-animated toasts for mutation confirmations, copy events, and errors.
* **Visual Data Language**: Tremor & Recharts color palette for metric curves, bar breakdowns, and status indicators.

### 6.2 Fluid Frontend & Motion Engineering
* **Physical Spring Physics**: Micro-interactions, drawers, and modal transitions use damped spring physics (`stiffness: 400, damping: 30`) rather than linear easings, making interactions feel physical and responsive.
* **Interruptibility**: Sheet slide-overs (e.g. event inspector drawer) and modals are fully interruptible—users can reverse gesture or dismiss without waiting for animations to complete.
* **Zero Layout Shift (CLS = 0)**: Metric cards and charts render geometric skeleton placeholders matching the exact bounding boxes of rendered components to guarantee zero jumpiness during data queries.
* **Tactile Feedback & Depth**:
  * Buttons and interactive list items feature subtle press-down states (`active:scale-[0.98]`).
  * Elevation is achieved via translucent background blurs (`backdrop-blur-md`) and layered border opacity rather than harsh drop shadows.
* **Touch-Native & Responsive**: On mobile viewports, side drawers seamlessly adapt into native-feeling bottom sheets with pull-to-dismiss behavior.

### 6.3 Top Navigation & Project Switcher
* **Organization Switcher**: Switch between personal and team organizations powered by Clerk's native dark widget.
* **Project Dropdown**: Instant project switcher with search, status indicators, and "+ Create Project" button.
* **Global Command Palette (`Cmd + K`)**: Rapid keyboard navigation to jump directly to events, user profiles, funnels, dashboards, or project settings.
* **Live Ingestion Health Indicator**: Green pulsating dot displaying real-time ingestion status and events/minute throughput.

---

## 7. Web Analytics Overview

The Web Analytics module provides high-level website traffic metrics comparable to Plausible, Umami, and Google Analytics 4.

### 7.1 Key Performance Metric Cards
* **Unique Visitors**: Count of distinct `ip_hash` / `distinct_id` entries over the chosen time range, with percentage delta compared to previous period.
* **Total Pageviews**: Aggregate count of `$pageview` events.
* **Total Sessions**: Count of distinct `session_id` entries.
* **Bounce Rate**: Percentage of sessions that logged only a single event with duration < 10 seconds.
* **Average Session Duration**: Mean time elapsed between the first and last event in a session.

### 7.2 Main Traffic Charts & Breakdown Tabs
* **Interactive Time-Series Chart**:
  * Toggle between Line, Smooth Area, and Bar visualizations.
  * Granularity selector: Hourly, Daily, Weekly, Monthly.
  * Date range selector: Today, Last 24 Hours, Last 7 Days, Last 30 Days, Last 90 Days, Year-to-Date, Custom Date Range.
* **Breakdown Panels (Ranked lists with percentage bars and visitor counts)**:
  * **Top Pages**: Grouped by `$pathname`, with total views, unique visitors, and bounce rate per route.
  * **Top Referrers**: Grouped by `$referrer_domain`, categorizing Direct, Search, Social, and Campaigns.
  * **UTM Campaigns**: Breakdown by `utm_source`, `utm_medium`, and `utm_campaign`.
  * **Geographic Map & Country Table**: Interactive SVG world map and country list with ISO flags and visitor counts.
  * **Devices & Browsers**: Donut and bar charts for Browser (Chrome, Safari, Firefox, Edge) and Operating System (Windows, macOS, iOS, Android, Linux).

---

## 8. Real-Time Live Event Stream

The Live Event Feed displays real-time activity across all active users.

### 8.1 Feed Behavior & Controls
* **Live Ingestion Feed**: Chronological list of incoming events updating automatically with new event badges.
* **Stream Controls**:
  * **Pause / Resume**: Freeze incoming events to inspect a specific stream.
  * **Clear Feed**: Clear the active buffer view.
  * **Filter by Event Name**: Multiselect filter for event types (e.g. `pageview`, `signup_clicked`).
  * **Filter by Distinct ID**: Live search for a specific user identifier.
* **Event Row Presentation**:
  * Timestamp (relative time with full UTC hover tooltip).
  * Event Name with color-coded badges (`$pageview` in blue, custom events in purple, errors in red).
  * Distinct User ID / Identified Name.
  * Page Path / Current URL.
  * Country flag badge and browser icon.

### 8.2 Event Inspection Drawer (Slide-Over Sheet)
Clicking any event row opens a slide-over sheet containing:
* **Raw JSON Inspector**: Formatted, syntax-highlighted JSON viewer with a "Copy JSON" button.
* **Formatted Property Table**: Key-value display of system properties (`$browser`, `$os`, `$ip_hash`, `$screen_width`) and custom application properties.
* **User Card Shortcut**: Direct link to the Person profile associated with the event's `distinct_id`.
* **Geo & Network Context**: Location details (Country, City, Region) and User Agent string.

---

## 9. Custom Insights & Query Builder

The Custom Insights engine allows teams to build tailored queries without writing raw SQL.

### 9.1 Query Construction Engine
1. **Event Selector**: Choose one or multiple events (e.g. `signup_completed`, `checkout_started`).
2. **Aggregation Function**:
   * Total Event Count (`COUNT(*)`)
   * Unique Users (`COUNT(DISTINCT distinct_id)`)
   * Unique Sessions (`COUNT(DISTINCT session_id)`)
   * Numeric Aggregations on JSON properties (`SUM`, `AVG`, `MIN`, `MAX`, `P50`, `P90`, `P99` on e.g. `properties.order_value`).
3. **Filter Builder**:
   * Add arbitrary filters on event properties or system fields.
   * Operators: `equals`, `does not equal`, `contains`, `does not contain`, `is set`, `is not set`, `greater than`, `less than`.
   * Boolean grouping (`AND` / `OR`).
4. **Breakdown / Group By**:
   * Group query results by any property (e.g. `browser`, `country`, `properties.pricing_tier`).
5. **Date Window & Granularity**:
   * Dynamic date ranges with rolling intervals (e.g. past 14 days grouped by day).

### 9.2 Visualization Modes
* **Line Chart**: Time-series comparison across multiple events or breakdown groups.
* **Bar Chart**: Ranked horizontal or vertical comparisons of aggregated values.
* **Donut Chart**: Property distribution shares.
* **Data Table**: Paginated raw summary table with column sorting and 1-click CSV/JSON export.
* **Save to Dashboard**: Pin saved insight queries directly onto any custom dashboard.

---

## 10. Conversion Funnels Engine

Funnels allow product teams to visualize conversion rates, friction points, and drop-offs through defined user onboarding or purchase journeys.

### 10.1 Funnel Definition & Step Builder
* **Multi-Step Sequencing**: Configure an ordered series of 2 to 10 sequential events:
  * Example:
    * Step 1: `$pageview` where `path = '/pricing'`
    * Step 2: `pricing_plan_selected`
    * Step 3: `signup_modal_opened`
    * Step 4: `account_created`
    * Step 5: `payment_submitted`
* **Step Configuration**:
  * Event type selection.
  * Step-specific property filters (e.g., Step 2 must have `properties.billing = 'annual'`).
* **Conversion Window**:
  * Define maximum elapsed time for step completion (e.g., 5 minutes, 1 hour, 24 hours, 7 days, 30 days).
* **Funnel Calculation Logic**:
  * Strict order matching or flexible intermediate event handling.
  * Unique user-based calculation (calculating if `distinct_id` reached each step within the time window).

### 10.2 Funnel Visualizations & Metrics
* **Horizontal / Vertical Step Graph**: Visual bars depicting user drop-off percentage between consecutive steps and total conversion from Step 1 to Final Step.
* **Median Time to Convert**: Calculates the median duration taken for users to progress from Step $N$ to Step $N+1$.
* **Step Drop-off Drilldown**:
  * Ability to click on dropped-off users at any step to view their Person profiles and investigate where friction occurred.
* **Breakdown Comparisons**: Split the funnel by a property (e.g., compare Conversion Rate on Mobile vs Desktop, or Organic vs Paid).

---

## 11. User Identity & People Explorer

The People Explorer bridges anonymous activity with authenticated user accounts.

### 11.1 Identity Resolution Architecture
* When a visitor first arrives, OpenTrack generates a random anonymous UUID stored locally (`distinct_id`).
* When the user registers or logs in, the client calls `opentrack.identify('user_123', { email: 'user@acme.com', name: 'Alex' })`.
* OpenTrack creates a record in `person_aliases` mapping `anon_uuid -> user_123`.
* Historical events previously logged under `anon_uuid` are resolved to `user_123` in analytics queries.

### 11.2 Person Directory (User List View)
* Paginated directory of all identified persons and active distinct visitors.
* Columns:
  * User Identifier (Avatar, Name, Email, or Distinct ID).
  * First Seen (Date & Relative Time).
  * Last Seen (Date & Relative Time).
  * Total Events Logged.
  * Custom Trait Badges (e.g., `Plan: Pro`, `Role: Admin`).
* Search & Filtering: Filter users by email, distinct ID, custom properties, or date range.

### 11.3 Individual Person Profile Page
* **User Header**: Displays email, name, distinct ID, first active, last active, location, and device details.
* **User Traits Editor**: Table of all JSON properties associated with the person, with the ability to add custom tags.
* **Chronological Activity Timeline**:
  * Vertical timeline showing all events triggered by this user in chronological order.
  * Grouped by sessions with session duration and page paths visited.
  * Expandable event rows showing the exact properties sent with each individual event.

---

## 12. Retention & Cohort Analysis

Retention analytics measures customer engagement and product stickiness over time.

### 12.1 Retention Matrix
* **Cohort Definition**:
  * Initial Event (e.g., `account_created` or `$pageview`).
  * Return Event (e.g., `app_opened`, `dashboard_viewed`, or any event).
  * Time Frame: Daily (Day 0 to Day 30) or Weekly (Week 0 to Week 12).
* **Retention Heatmap Visual**:
  * Table rows representing starting cohorts (e.g., users who signed up in Week 1, Week 2).
  * Columns representing elapsed periods (Day 1, Day 2, Day 3... or Week 1, Week 2...).
  * Color intensity gradient representing percentage of returning users.

### 12.2 Behavioral Cohort Segmentation
* Create cohorts of users based on actions performed:
  * *Active Users*: Triggered any event in the last 7 days.
  * *Power Users*: Triggered `core_feature_used` more than 10 times in 30 days.
  * *Slipping Away*: Created an account 30 days ago but has had 0 events in the last 14 days.
* Cohorts can be applied as global filters across Funnels, Insights, and Web Analytics.

---

## 13. Project Management, Multi-Tenancy & Settings

### 13.1 Multi-Tenant Organization Structure
* Powered by Clerk Organizations:
  * Organization admins can invite team members via email.
  * Role-based access control (Admin, Member, Viewer).
  * Shared projects within an organization workspace.

### 13.2 Project Management & API Keys
* **Project Creation**: Create distinct tracking containers for staging, production, or separate applications.
* **Key Management**:
  * **Publishable Ingestion Key (`ot_live_...`)**: Safe to embed in client-side HTML/JS. Can only ingest events; cannot query or read analytics.
  * **Secret Admin Key (`ot_sec_...`)**: Server-to-server key for backend event ingestion and REST API querying. Never exposed to browser clients.
  * Key rotation and revocation controls.
* **Domain Whitelisting**: Specify authorized domains (e.g. `https://mycompany.com`, `https://app.mycompany.com`). Ingestion requests from other origins are rejected.
* **Data Scrubbing & Privacy Settings**:
  * Toggle automatic stripping of query parameters containing sensitive tokens (e.g. `token`, `password`, `auth`).
  * IP anonymization toggle (truncate or hash IP).
  * Data retention window setting (e.g. 90 days, 180 days, 365 days, or unlimited).

---

## 14. Data Privacy, Compliance & Security

### 14.1 Compliance Architecture (GDPR / CCPA / PECR)
* **Zero-Cookie Tracking Mode**:
  * Option to run SDK without setting cookies or accessing persistent `localStorage`.
  * Computes daily rotating non-reversible session hashes using IP + User Agent + Salt, preventing cross-day user tracking without consent.
* **Right to be Forgotten (GDPR Deletion)**:
  * One-click or API-driven user purge: deletes all events and person records associated with a `distinct_id`.
* **Data Portability**:
  * Raw event export via JSON or CSV downloads directly from the query interface or via authenticated API.

### 14.2 Infrastructure Security
* All ingestion and dashboard traffic served strictly over HTTPS/TLS.
* Clerk session token verification on all protected Next.js API routes and Server Actions.
* Prepared SQL queries via Drizzle ORM to eliminate SQL injection vulnerabilities.
* Rate limiting on ingestion endpoints to prevent resource exhaustion.
