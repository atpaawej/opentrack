---
number: 0002
title: Authentication, Project Management & Dashboard Shell
status: complete
grilled: 2026-10-05
completed: 2026-10-05
---

# 0002 — Authentication, Project Management & Dashboard Shell

> **Goal:** Authenticated users can log in via Clerk, create and switch between projects, view their publishable API keys with tracking setup instructions, and navigate a responsive dark-mode dashboard shell.

## Problem

Currently, OpenTrack's database only contains manually seeded projects and raw ingestion. Users cannot sign up, cannot create or manage projects, cannot see their API keys or copy installation snippets, and have no user interface to access the platform.

## Why

In `apps/web/src/lib/db/schema.ts:4`, the `projects` table lacks ownership attribution (`clerk_user_id`, `clerk_org_id`, `slug`). In `apps/web/package.json:25`, `@clerk/nextjs` is not installed, and `apps/web/src/app/page.tsx:1` contains only an unauthenticated placeholder. Without an authenticated multi-project dashboard shell, features like Web Analytics, Live Events, and Funnels have nowhere to render and no project context to query against.

## Decisions

1. **Authentication Engine**: Clerk (`@clerk/nextjs`) using Clerk's native dark theme (`baseTheme: dark` from `@clerk/themes`) for cards, login, signup, user buttons, and organization switchers.
2. **Project Scoping**: Projects are owned by a Clerk user or Clerk organization. Each project has a human-readable unique `slug` (e.g. `my-saas-app`) used in dashboard route URLs (`/[projectSlug]/...`).
3. **Vertical Slice Architecture**: Project operations live in `apps/web/src/features/projects/` powered by Effect-TS for validation (`@effect/schema`), key generation (`ot_live_<nanoid>`), and database mutations.
4. **UI Design System**: Built dark-mode first with Tailwind CSS (`zinc-950`), Lucide icons, `next-themes`, and shadcn/ui primitives. Toasts are powered by Sonner (`sonner`).
5. **Ingestion API Public Exemption**: Clerk middleware protects all dashboard pages (`/[projectSlug]/*`) and internal APIs while keeping `/api/v1/capture` and `/api/v1/batch` strictly public.

## Steps

### Step 1 — Install Clerk, UI Primitives, and Theme Packages

Files: `apps/web/package.json:19`

Install `@clerk/nextjs`, `@clerk/themes`, `lucide-react`, `sonner`, `next-themes`, `clsx`, `tailwind-merge`, `class-variance-authority`, and radix primitives into `apps/web`.

**Done when:** `pnpm --filter web build` compiles cleanly with new dependencies declared.

---

### Step 2 — Schema Expansion for Organizations & Project Ownership

Files: `apps/web/src/lib/db/schema.ts:4`

Update `projects` table:
* Add `slug` (varchar(255), notNull, unique).
* Add `clerkUserId` (varchar(255), notNull).
* Add `clerkOrgId` (varchar(255), nullable).
* Add `updatedAt` (timestamp, defaultNow, notNull).

Add `organizations` table to map Clerk organizations for team collaboration. Push migration to Neon database.

**Done when:** `pnpm --filter web db:push` applies the changes to Neon without errors.

---

### Step 3 — Clerk Middleware & Auth Routes

Files:
* `apps/web/src/middleware.ts:1`
* `apps/web/src/app/(auth)/sign-in/[[...sign-in]]/page.tsx:1`
* `apps/web/src/app/(auth)/sign-up/[[...sign-up]]/page.tsx:1`
* `apps/web/src/app/layout.tsx:1`

Wrap root layout in `<ClerkProvider appearance={{ baseTheme: dark }}>`. Configure `clerkMiddleware` to protect dashboard routes (`/(dashboard)/.*`) while keeping `/api/v1/*` public. Render clean, centered dark-themed sign-in and sign-up pages.

**Done when:** Navigating to an unauthenticated protected route redirects to `/sign-in`, and `/api/v1/capture` remains accessible without authentication.

---

### Step 4 — Projects Vertical Slice (`features/projects`)

Files:
* `apps/web/src/features/projects/schemas.ts:1`
* `apps/web/src/features/projects/errors.ts:1`
* `apps/web/src/features/projects/service.ts:1`

Implement Effect-TS workflows for project management:
1. `CreateProjectCommand`: Validates project name, generates url-safe slug and unique `ot_live_...` API key, and inserts into DB.
2. `ListUserProjectsQuery`: Fetches all projects owned by the current Clerk user/org.
3. `GetProjectBySlugQuery`: Retrieves project details, verifying caller authorization.
4. `UpdateProjectDomainsCommand`: Updates CORS `allowed_domains`.

**Done when:** Unit tests for `createProject`, `listProjects`, and `getProjectBySlug` pass with valid data and return typed errors on unauthorized access.

---

### Step 5 — Base UI Primitives & Toast Setup

Files:
* `apps/web/src/components/ui/button.tsx:1`
* `apps/web/src/components/ui/card.tsx:1`
* `apps/web/src/components/ui/dialog.tsx:1`
* `apps/web/src/components/ui/dropdown-menu.tsx:1`
* `apps/web/src/components/ui/badge.tsx:1`
* `apps/web/src/components/ui/sonner.tsx:1`

Add essential shadcn/ui primitives styled with Tailwind zinc dark palette and integrate `<Toaster />` from Sonner into root layout.

**Done when:** Components render in Storybook/test page without style regressions.

---

### Step 6 — Dashboard Shell Layout & Navigation

Files:
* `apps/web/src/app/(dashboard)/layout.tsx:1`
* `apps/web/src/app/(dashboard)/[projectSlug]/layout.tsx:1`
* `apps/web/src/components/dashboard/header.tsx:1`
* `apps/web/src/components/dashboard/sidebar.tsx:1`
* `apps/web/src/components/dashboard/project-switcher.tsx:1`

Build the dashboard shell:
* **Header**: Project Switcher dropdown, Clerk `<UserButton />`, Clerk `<OrganizationSwitcher />`, link to project settings.
* **Sidebar**: Links to *Overview / Analytics*, *Live Stream*, *Insights*, *Funnels*, *Persons*, and *Settings*. Active link highlighting with subtle zinc border.
* **Project Switcher**: Lists all user projects, shows active project, and provides "+ New Project" modal trigger.

**Done when:** User can switch between projects via the dropdown and URL updates to `/[projectSlug]/...`.

---

### Step 7 — Project Onboarding & Setup Card (Zero-State View)

Files:
* `apps/web/src/app/(dashboard)/[projectSlug]/page.tsx:1`
* `apps/web/src/components/dashboard/setup-guide.tsx:1`

When a project has zero captured events:
* Display an onboarding card explaining how to install OpenTrack.
* Provide a 1-click copyable HTML `<script>` tag with the project's actual `ot_live_...` API key.
* Provide an npm installation code block (`npm i @opentrack/web`).
* Show a live pulse badge ("Listening for your first event...") that checks if an event has arrived.

**Done when:** Creating a new project displays the setup guide with the project's unique API key, and 1-click copy copies the script tag to clipboard.

## Seams

* **Auth Seam**: Clerk session verification in Server Actions and route handlers.
* **Database Seam**: `projects` table queries asserting proper ownership and unique slugs.
* **UI Seam**: Navigation between project routes (`/[projectSlug]/analytics`, `/[projectSlug]/live`, etc.) in the dashboard shell.

## Out of scope

* Live event streaming log UI and slide-over inspector (Plan 0003).
* Web Analytics metric calculation and charts (Plan 0004).
* Funnels and Cohort analysis (Plan 0005).

## Open questions

None. The Clerk setup, dark theme integration, VSA project slice, and dashboard shell are clearly defined.
