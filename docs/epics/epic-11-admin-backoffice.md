# Epic 11: Admin Backoffice - Brownfield Enhancement

## Epic Overview

**Epic ID:** Epic 11
**Status:** Draft
**Priority:** Medium (internal tooling, not user-facing)
**Business Owner:** Product Team
**Technical Lead:** Development Team

## Epic Goal

Provide an internal admin backoffice at `/admin` for the Laglig team to monitor the platform, manage customers and subscriptions, debug issues via user impersonation, and operate/monitor cron jobs with detailed execution logs.

## Epic Description

### Existing System Context

- **Auth flow:** Supabase Auth for signup/verification, NextAuth (JWT) for sessions. Workspace-scoped RBAC with roles (OWNER, ADMIN, HR_MANAGER, MEMBER, AUDITOR).
- **Admin surface today:** Single `/api/admin/sync-status` REST endpoint protected by `ADMIN_SECRET` env var. Empty cache dashboard placeholder at `(workspace)/admin/cache-dashboard`. No admin UI.
- **Cron jobs:** `/api/cron/warm-cache` and `/api/cron/prewarm-cache` exist. Sync jobs for legal content ingestion (SFS, courts, EU) run via Vercel Cron. No execution logging or history persisted.
- **Data available for admin views:** `User`, `Workspace`, `WorkspaceMember`, `CompanyProfile`, `ChangeEvent` models all exist in Prisma. Subscription tier stored on `Workspace.subscription_tier`.
- **Technology stack:** Next.js 16 (App Router), React 19, Prisma 6.19, Supabase Auth, NextAuth 4.24, Upstash Redis, shadcn/ui, Tailwind CSS, TanStack Table.

### Enhancement Details

**What's being added:**

1. Dedicated admin authentication at `/admin/login`, completely separate from workspace auth
2. Admin shell layout with sidebar navigation
3. Customer overview dashboard with platform-wide metrics
4. Workspace management with search, filtering, and actions (change tier, pause, disable)
5. User management with search, detail views, and workspace membership visibility
6. User impersonation ("login as") with audit trail and admin escape hatch
7. Cron job dashboard with manual triggers and live status
8. Job execution log persistence (new Prisma model) with error detail viewer

**How it integrates:**

- New `/app/admin/` route group outside `(workspace)` layout — no workspace shell dependency
- Separate admin session cookie (`admin_session`) independent of NextAuth workspace sessions
- Reads existing Prisma models (User, Workspace, WorkspaceMember, CompanyProfile) — no changes to those tables
- New `CronJobRun` Prisma model for persisting job execution history and error logs
- Impersonation generates a real NextAuth user session while preserving admin session in a parallel cookie
- Manual job triggers call existing cron API endpoints server-side

**Auth approach (lightweight):**

- Environment variable `ADMIN_EMAILS` defines allowed admin email addresses
- Admin login page at `/admin/login` with email + password (validated against Supabase Auth, then checked against `ADMIN_EMAILS` allowlist)
- JWT stored in `admin_session` cookie (separate from NextAuth `next-auth.session-token`)
- No new `AdminUser` database model needed initially — reuses existing `User` table filtered by env allowlist
- Avoids Prisma migration for admin auth, keeping it simple and reversible

**Supersedes:** Story 2.16 (Admin Backoffice for Job Monitoring) in backlog — its scope is fully covered by Stories 11.6 and 11.7 in this epic.

**Success criteria:**

- Admin can log in at `/admin/login` and access the backoffice
- Admin can see all workspaces, users, subscription tiers, and contact info
- Admin can change subscription tiers, pause/unpause workspaces
- Admin can impersonate any user and return to admin seamlessly
- Admin can view cron job status, trigger jobs manually, and inspect execution logs with error details
- No impact on existing user-facing functionality

---

## Stories

### Story 11.1: Admin Authentication & Shell Layout

**As a** Laglig team member,
**I want** to log in to a separate admin backoffice at `/admin`,
**so that** I can access platform management tools without going through workspace auth.

**Acceptance Criteria:**

1. `/admin/login` page with email and password fields
2. Authentication validates credentials via Supabase Auth, then checks email against `ADMIN_EMAILS` environment variable
3. On successful auth, a signed JWT is stored in `admin_session` cookie (HttpOnly, Secure, SameSite=Strict, 24h expiry)
4. `/admin` layout checks for valid `admin_session` cookie; redirects to `/admin/login` if missing or expired
5. Admin shell layout with sidebar navigation containing links: Dashboard, Workspaces, Users, Cron Jobs
6. Header shows current admin user email and logout button
7. Logout clears `admin_session` cookie and redirects to `/admin/login`
8. Non-admin users who authenticate get a clear "Access denied" message (not a generic error)
9. All `/admin/*` routes are protected by the admin layout guard
10. Admin session is entirely independent of NextAuth workspace sessions — both can coexist

**Key Files:**

| File                                 | Change                                                     |
| ------------------------------------ | ---------------------------------------------------------- |
| `app/admin/login/page.tsx`           | New - admin login form                                     |
| `app/admin/layout.tsx`               | New - admin shell with auth guard and sidebar              |
| `app/admin/page.tsx`                 | New - redirects to `/admin/dashboard`                      |
| `lib/admin/auth.ts`                  | New - admin JWT creation, validation, `ADMIN_EMAILS` check |
| `app/actions/admin-auth.ts`          | New - `adminLogin()`, `adminLogout()` server actions       |
| `components/admin/admin-sidebar.tsx` | New - sidebar navigation component                         |
| `components/admin/admin-header.tsx`  | New - header with user info and logout                     |

**Technical Notes:**

- JWT payload: `{ email, iat, exp }` signed with `ADMIN_JWT_SECRET` env var
- Cookie name: `admin_session` (avoids collision with `next-auth.session-token`)
- Middleware is NOT used for admin auth (to avoid complexity with existing NextAuth middleware). Instead, the admin layout server component validates the cookie.

---

### Story 11.2: Customer Overview Dashboard

**As an** admin,
**I want** to see a high-level overview of the platform's customers,
**so that** I can quickly understand platform health and growth.

**Acceptance Criteria:**

1. Dashboard page at `/admin/dashboard`
2. Metric cards displayed:
   - Total workspaces (with breakdown: Active, Paused, Deleted)
   - Total users
   - Subscription tier distribution (Trial, Solo, Team, Enterprise) as count per tier
   - New signups in the last 7 and 30 days
3. Recent workspaces table: last 10 created workspaces showing name, owner email, tier, status, created date
4. Recent users table: last 10 registered users showing name, email, last login, workspace count
5. Data fetched server-side via Prisma aggregate queries (no client-side fetching)
6. Page refreshes data on each visit (no caching needed for admin views)

**Key Files:**

| File                               | Change                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `app/admin/dashboard/page.tsx`     | New - dashboard with metrics and tables                                |
| `lib/admin/queries.ts`             | New - admin-specific Prisma queries (counts, aggregates, recent lists) |
| `components/admin/metric-card.tsx` | New - reusable metric display card                                     |

---

### Story 11.3: Workspace Management

**As an** admin,
**I want** to browse, search, and manage all workspaces on the platform,
**so that** I can handle customer support tasks and subscription changes.

**Acceptance Criteria:**

1. Workspace list page at `/admin/workspaces`
2. Searchable data table (TanStack Table) with columns: Name, Slug, Owner (email), Subscription Tier, Status, Member Count, Created Date
3. Search by workspace name, slug, or owner email (server-side filtering)
4. Filter by subscription tier (dropdown) and status (dropdown)
5. Sortable by any column
6. Paginated (25 per page)
7. Click a workspace row to open detail view at `/admin/workspaces/[id]`
8. Detail view shows:
   - Workspace info (name, slug, org number, status, tier, created date)
   - Company profile (company name, SNI code, legal form, employee count, address)
   - Member list (name, email, role, joined date)
   - Quick stats (law list count, task count, document count)
9. Actions available on detail view:
   - Change subscription tier (dropdown + confirm)
   - Change status: Pause / Unpause / Mark Deleted (with confirmation dialog)
10. All mutations logged in `ActivityLog` with `entity_type: 'ADMIN_ACTION'`

**Key Files:**

| File                                   | Change                                                          |
| -------------------------------------- | --------------------------------------------------------------- |
| `app/admin/workspaces/page.tsx`        | New - workspace list with search/filter table                   |
| `app/admin/workspaces/[id]/page.tsx`   | New - workspace detail view                                     |
| `lib/admin/queries.ts`                 | Extend - workspace list queries with search, filter, pagination |
| `app/actions/admin-workspaces.ts`      | New - `updateWorkspaceTier()`, `updateWorkspaceStatus()`        |
| `components/admin/workspace-table.tsx` | New - TanStack Table for workspace list                         |

---

### Story 11.4: User Management

**As an** admin,
**I want** to browse and search all users on the platform,
**so that** I can look up customer information and understand their workspace memberships.

**Acceptance Criteria:**

1. User list page at `/admin/users`
2. Searchable data table with columns: Name, Email, Last Login, Workspace Count, Created Date
3. Search by name or email (server-side filtering)
4. Sortable by any column
5. Paginated (25 per page)
6. Click a user row to open detail view at `/admin/users/[id]`
7. Detail view shows:
   - User info (name, email, avatar, created date, last login)
   - Workspace memberships table (workspace name, role, subscription tier, joined date)
   - "Impersonate" button (implemented in Story 11.5)
8. Read-only — no user editing from admin (users manage their own profile)

**Key Files:**

| File                              | Change                                             |
| --------------------------------- | -------------------------------------------------- |
| `app/admin/users/page.tsx`        | New - user list with search table                  |
| `app/admin/users/[id]/page.tsx`   | New - user detail view                             |
| `lib/admin/queries.ts`            | Extend - user list queries with search, pagination |
| `components/admin/user-table.tsx` | New - TanStack Table for user list                 |

---

### Story 11.5: User Impersonation

**As an** admin,
**I want** to log in as any user to see exactly what they see,
**so that** I can debug issues and provide effective customer support.

**Acceptance Criteria:**

1. "Login as [user name]" button on user detail page (`/admin/users/[id]`)
2. Clicking the button shows a confirmation dialog: "Du kommer att logga in som [name] ([email]). Din admin-session behålls."
3. On confirm: server action creates a valid NextAuth session for the target user and sets it as the `next-auth.session-token` cookie
4. Admin is redirected to `/dashboard` as the impersonated user
5. A fixed banner is shown at the top of all pages during impersonation: "Du är inloggad som [name] ([email]) — Tillbaka till admin" with a return link
6. The `admin_session` cookie is preserved during impersonation — it is NOT cleared
7. Clicking "Tillbaka till admin" clears the impersonated NextAuth session cookie and redirects to `/admin/users/[id]`
8. Impersonation events are logged: admin email, target user email, timestamp, action (START/END)
9. Impersonation log is stored in `ActivityLog` with `entity_type: 'IMPERSONATION'`
10. Impersonation works across all workspace routes the target user has access to

**Key Files:**

| File                                        | Change                                                                                               |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `app/actions/admin-impersonate.ts`          | New - `startImpersonation()`, `endImpersonation()` server actions                                    |
| `components/admin/impersonation-banner.tsx` | New - persistent top banner shown during impersonation                                               |
| `app/(workspace)/layout.tsx`                | Modified - render impersonation banner when `admin_session` cookie is present alongside user session |
| `lib/admin/auth.ts`                         | Extend - helper to check if current request is an impersonation                                      |
| `app/admin/users/[id]/page.tsx`             | Modified - add impersonate button                                                                    |

**Technical Notes:**

- Impersonation detection: if both `admin_session` and `next-auth.session-token` cookies are present, and the admin session email differs from the NextAuth session email, the user is being impersonated.
- The NextAuth session for impersonation is created by encoding a JWT with the target user's ID/email using the same `NEXTAUTH_SECRET`. This avoids touching Supabase Auth.
- Security: only valid `admin_session` holders can trigger impersonation. The server action validates the admin session before creating the impersonated session.

---

### Story 11.6: Cron Job Dashboard & Manual Triggers

**As an** admin,
**I want** to see the status of all cron jobs and trigger them manually,
**so that** I can monitor data freshness and recover from failures.

**Acceptance Criteria:**

1. Cron job page at `/admin/cron-jobs`
2. Job registry: a hardcoded configuration listing all known cron jobs with name, description, schedule (cron expression), and API endpoint
3. For each job, display:
   - Job name and description
   - Schedule (human-readable, e.g. "Daily at 03:00 UTC")
   - Last run: timestamp, duration, status (success/failed/running)
   - Items processed / items failed (from last run)
4. Status indicators: green (last run succeeded), red (last run failed), yellow (running now), grey (never run)
5. "Kör nu" (Run now) button per job with confirmation dialog
6. Manual trigger calls the job's API endpoint server-side (via internal fetch) with proper auth headers
7. Running state shown while job executes (polling or optimistic UI)
8. Health checks displayed:
   - Riksdagen API reachable (yes/no)
   - Domstolsverket API reachable (yes/no)
   - Database connection OK
   - Redis connection OK
9. New `CronJobRun` Prisma model to persist job execution history (see schema below)
10. Cron job endpoints updated to create a `CronJobRun` record at start, and update it on completion/failure

**Key Files:**

| File                                  | Change                                                                      |
| ------------------------------------- | --------------------------------------------------------------------------- |
| `app/admin/cron-jobs/page.tsx`        | New - cron job dashboard                                                    |
| `lib/admin/job-registry.ts`           | New - static registry of known cron jobs                                    |
| `lib/admin/health.ts`                 | New - health check utilities (API pings, DB/Redis checks)                   |
| `app/actions/admin-cron.ts`           | New - `triggerJob()` server action                                          |
| `prisma/schema.prisma`                | Add `CronJobRun` model                                                      |
| `lib/admin/job-logger.ts`             | New - helper to create/update CronJobRun records from within cron endpoints |
| `app/api/cron/warm-cache/route.ts`    | Modified - add job logging                                                  |
| `app/api/cron/prewarm-cache/route.ts` | Modified - add job logging                                                  |

**Schema Addition:**

```prisma
model CronJobRun {
  id              String   @id @default(uuid())
  job_name        String
  status          JobRunStatus @default(RUNNING)
  started_at      DateTime @default(now())
  completed_at    DateTime?
  duration_ms     Int?
  items_processed Int      @default(0)
  items_failed    Int      @default(0)
  error_message   String?
  error_stack     String?
  log_output      String?  @db.Text
  triggered_by    String?  // "cron" or admin email if manual
  metadata        Json?    // Additional job-specific data

  @@index([job_name, started_at(sort: Desc)])
  @@map("cron_job_runs")
}

enum JobRunStatus {
  RUNNING
  SUCCESS
  FAILED
}
```

---

### Story 11.7: Job Execution Logs & Error Viewer

**As an** admin,
**I want** to inspect detailed execution logs and errors for cron jobs,
**so that** I can diagnose failures in legal document ingestion and other automated processes.

**Acceptance Criteria:**

1. Click a job on the cron dashboard to navigate to `/admin/cron-jobs/[jobName]`
2. Job detail page shows run history: table of recent runs (last 50) with timestamp, duration, status, items processed, items failed
3. Click a specific run to expand inline or navigate to `/admin/cron-jobs/[jobName]/[runId]`
4. Run detail shows:
   - Full log output (scrollable, monospace, syntax-highlighted for timestamps/errors)
   - Error message and stack trace (if failed)
   - Metadata (job-specific details like document counts by type)
   - Items processed vs failed breakdown
5. Error aggregation view at `/admin/cron-jobs/errors`:
   - List of all failed runs across all jobs, most recent first
   - Filterable by job name and date range
   - Shows: job name, timestamp, error message (truncated), affected document numbers
6. Log output supports structured logging: each cron job can append log lines to `CronJobRun.log_output` during execution
7. Pagination on run history (25 per page)
8. Auto-refresh toggle on job detail page (poll every 10s when enabled) for monitoring running jobs

**Key Files:**

| File                                             | Change                                              |
| ------------------------------------------------ | --------------------------------------------------- |
| `app/admin/cron-jobs/[jobName]/page.tsx`         | New - job run history                               |
| `app/admin/cron-jobs/[jobName]/[runId]/page.tsx` | New - individual run detail                         |
| `app/admin/cron-jobs/errors/page.tsx`            | New - cross-job error aggregation                   |
| `lib/admin/queries.ts`                           | Extend - job run queries with filtering, pagination |
| `components/admin/log-viewer.tsx`                | New - monospace log display component               |
| `components/admin/run-history-table.tsx`         | New - run history data table                        |

---

## Story Sequencing

```
Story 11.1 (Admin Auth & Shell)
    ↓
Story 11.2 (Dashboard)        ─┐
Story 11.3 (Workspaces)        ├─ Can be developed in parallel after 11.1
Story 11.4 (Users)             ─┘
    ↓
Story 11.5 (Impersonation)    ← Depends on 11.4 (user detail page)
    ↓
Story 11.6 (Cron Dashboard)   ← Schema migration (CronJobRun), independent of 11.2-11.5
    ↓
Story 11.7 (Execution Logs)   ← Depends on 11.6 (CronJobRun model and data)
```

- **11.1 must be completed first** — establishes admin auth, layout, and navigation
- **11.2, 11.3, 11.4 are independent** — can be developed in parallel after 11.1
- **11.5 depends on 11.4** — needs the user detail page to place the impersonate button
- **11.6 is independent** of 11.2–11.5 but requires 11.1; includes schema migration
- **11.7 depends on 11.6** — needs the CronJobRun model and populated data

---

## Compatibility Requirements

- [x] Existing APIs remain unchanged (admin routes are additive, no modifications to user-facing endpoints)
- [x] Database schema changes are backward compatible (new `CronJobRun` table only, no changes to existing tables)
- [x] UI changes follow existing patterns (shadcn/ui components, Tailwind, TanStack Table)
- [x] Performance impact is minimal (admin queries are internal-only, not on user request path)
- [x] Existing user authentication and workspace sessions are unaffected
- [x] Cron job endpoint modifications are additive (adding logging, not changing behavior)

## Risk Mitigation

- **Primary Risk:** Impersonation session leaking if admin forgets to end impersonation, or cookie conflicts between admin and user sessions
- **Mitigation:** Impersonation banner is always visible and cannot be dismissed. Admin session cookie has a different name and path. Impersonation sessions have a shorter TTL (1 hour). All impersonation events are logged.
- **Secondary Risk:** Cron job logging adding latency to job execution
- **Mitigation:** Log writes are non-blocking where possible. `log_output` is appended, not re-written. Jobs that fail to write logs still complete their primary work.
- **Rollback Plan:** All admin routes are in `/app/admin/` — removing the directory restores the system to its previous state. The `CronJobRun` model is additive and can be left in place or dropped without affecting existing functionality.

## Definition of Done

- [ ] Admin can log in at `/admin/login` with email + password (validated against ADMIN_EMAILS allowlist)
- [ ] Dashboard shows platform metrics (workspaces, users, subscription breakdown)
- [ ] Admin can search, filter, and manage workspaces (change tier, pause/unpause)
- [ ] Admin can search users and view their workspace memberships
- [ ] Admin can impersonate any user with persistent banner and safe return to admin
- [ ] Admin can view cron job status, trigger jobs manually, and see health checks
- [ ] Admin can drill into job execution logs and errors with full detail
- [ ] All admin actions are audit-logged
- [ ] No regression in existing user-facing functionality
- [ ] Existing cron jobs continue to function even if logging fails

## Supersedes

- **Story 2.16 (Admin Backoffice for Job Monitoring)** — Its scope is fully covered by Stories 11.6 and 11.7 in this epic. Story 2.16 should be marked as superseded/closed.

## Deferred / Future Work

| Item                                               | Deferred To                | Notes                                                    |
| -------------------------------------------------- | -------------------------- | -------------------------------------------------------- |
| Admin user management (add/remove admins via UI)   | Future iteration           | Currently managed via ADMIN_EMAILS env var               |
| Billing history / Stripe integration visibility    | Post-Stripe integration    | No billing system exists yet                             |
| Platform analytics (DAU, retention, feature usage) | Future iteration           | Consider Vercel Analytics or custom                      |
| Admin audit log viewer                             | Future iteration           | Logs written via ActivityLog, viewer not in v1           |
| Email to users from admin                          | Future iteration           | Requires Resend integration for ad-hoc emails            |
| EU/Court/Myndighet sync job integration            | When those cron jobs exist | Job logging pattern from 11.6 applies to all future jobs |

---

## Story Manager Handoff

Please develop detailed user stories for this brownfield epic. Key considerations:

- This is an enhancement to an existing system running Next.js 16 (App Router), React 19, Prisma 6.19, Supabase Auth, NextAuth 4.24, Upstash Redis, shadcn/ui, TanStack Table
- Integration points: Supabase Auth (reused for admin credential validation), NextAuth JWT (for impersonation), Prisma schema (new CronJobRun model), existing cron API endpoints (add logging), workspace layout (impersonation banner)
- Existing patterns to follow: server actions pattern (`app/actions/`), TanStack Table for data tables, shadcn/ui forms with Zod validation, Prisma queries in `lib/`
- Critical compatibility requirements: existing user auth and workspace sessions must be unaffected, cron jobs must continue working even if logging fails, admin routes must be fully isolated from user routes
- Each story must include verification that existing functionality remains intact
- The admin auth system must be entirely separate from workspace auth — two sessions can coexist

The epic should maintain system integrity while delivering a functional admin backoffice for internal platform operations.
