# 5. API Specification

## 5.1 API Architecture Overview

**Hybrid Strategy Rationale:**

As documented in Section 1.2, laglig.se uses a **hybrid API architecture** that leverages Next.js 15's Server Actions for internal operations while exposing REST endpoints for external integrations. This approach optimizes for:

1. **Developer Experience** - Server Actions eliminate boilerplate API routes for internal features
2. **Type Safety** - End-to-end TypeScript without manual API contracts
3. **Performance** - Server Actions reduce network overhead with direct server-side execution
4. **External Integration** - REST API for webhooks, cron jobs, and enterprise API access

**Decision Matrix: When to Use Each API Style**

| Use Case                    | API Style      | Reasoning                                             |
| --------------------------- | -------------- | ----------------------------------------------------- |
| **User forms & mutations**  | Server Actions | Type-safe, no API boilerplate, automatic revalidation |
| **AI chat interactions**    | Server Actions | Streaming responses, minimal latency                  |
| **Task/compliance updates** | Server Actions | Optimistic updates, real-time sync (Epic 6)           |
| **Authentication flows**    | Server Actions | Tight Next.js integration, session management         |
| **Stripe webhooks**         | REST API       | External service callbacks require public endpoints   |
| **Vercel Cron jobs**        | REST API       | Scheduled tasks need HTTP endpoints                   |
| **Admin ingestion scripts** | REST API       | Long-running background jobs, separate process        |
| **Enterprise API access**   | REST API       | Third-party integrations, API keys, versioning        |
| **Fortnox sync**            | REST API       | OAuth callbacks, external system integration          |

---

## 5.2 Server Actions Specification

**Technology:** Next.js 15 Server Actions (`'use server'` directive)

**Location:** `app/actions/*.ts` (organized by feature area)

**Error Handling Pattern:**

```typescript
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }
```

**Key Server Actions by feature area:**

1. **Authentication** (`app/actions/auth.ts`)
   - `signInAction(formData)` - Credential-based sign in
   - `signOutAction()` - Sign out current user
   - `signUpAction(formData)` - New user registration

2. **Onboarding** (`app/actions/onboarding.ts`)
   - `fetchCompanyDataAction(orgNumber)` - Fetch from Bolagsverket API
   - `startOnboardingAction(input)` - Create onboarding session + Phase 1 law list
   - `saveContextualAnswersAction(input)` - Store Phase 2 answers
   - `generateFinalLawListAction(sessionId)` - GPT-4 Phase 2 generation

3. **Compliance Workflow** (`app/actions/compliance.ts`) - _Epic 6 Revision_
   - **List Items:**
     - `updateListItemStatusAction(input)` - Update compliance status
     - `assignResponsibleAction(input)` - Assign responsible person
     - `updateBusinessContextAction(input)` - Update "Why this matters"
   - **Tasks:**
     - `createTaskAction(input)` - Create new task
     - `updateTaskAction(input)` - Update task details
     - `moveTaskToColumnAction(input)` - Move task in Kanban
     - `linkTaskToListItemAction(input)` - Link task to list item(s)
   - **Task Columns:**
     - `createColumnAction(input)` - Add custom column
     - `updateColumnAction(input)` - Rename/reorder column
     - `deleteColumnAction(input)` - Remove custom column
   - **Comments:**
     - `addCommentAction(input)` - Add comment to task/list item
     - `updateCommentAction(input)` - Edit existing comment
     - `deleteCommentAction(input)` - Remove comment
   - **Evidence:**
     - `uploadEvidenceAction(input)` - Upload file to task/list item
     - `deleteEvidenceAction(input)` - Remove evidence file
   - **Activity:**
     - `getActivityLogAction(input)` - Fetch history for entity

4. **Notifications** (`app/actions/notifications.ts`) - _Epic 6_
   - `getNotificationsAction(input)` - Fetch user notifications
   - `markAsReadAction(input)` - Mark notification(s) as read
   - `markAllAsReadAction(workspaceId)` - Mark all as read
   - `updateNotificationPreferencesAction(input)` - Update user settings

5. **Search** (`app/actions/search.ts`) - _Epic 6_
   - `globalSearchAction(input)` - Search across laws, tasks, comments, evidence

6. **AI Chat** (`app/actions/ai-chat.ts`)
   - `sendAIChatMessageAction(input)` - Send message + stream AI response
   - `getChatHistoryAction(workspaceId)` - Retrieve conversation history

7. **HR Module** (`app/actions/hr.ts`)
   - `createEmployeeAction(input)` - Add new employee
   - `updateEmployeeAction(input)` - Update employee data
   - `syncFortnoxEmployeesAction(workspaceId)` - Sync from Fortnox API
   - `attachCollectiveAgreementAction(input)` - Link kollektivavtal to employee

8. **Workspace** (`app/actions/workspace.ts`)
   - `createWorkspaceAction(input)` - Create new workspace
   - `inviteMemberAction(input)` - Send workspace invitation
   - `updateMemberRoleAction(input)` - Change member permissions

**See Section 5.2 subsections in full document for complete TypeScript implementations.**

---

## 5.3 REST API Specification (OpenAPI 3.0)

**Base URL:** `https://laglig.se/api/v1`

**Authentication:** API Key (header: `X-API-Key`) or Bearer token (OAuth 2.0)

**Key REST Endpoints:**

### Admin Ingestion Endpoints

- `POST /api/v1/admin/ingest/riksdagen-sfs` - Start SFS law ingestion (11,351 laws)
- `POST /api/v1/admin/ingest/domstolsverket-cases` - Start court case ingestion (AD, HFD, HD, HovR)
- `POST /api/v1/admin/ingest/eu-legislation` - Start EU legislation ingestion
- `GET /api/v1/admin/jobs/{jobId}/status` - Check background job status

### Cron Endpoints (Vercel Cron)

- `GET /api/v1/cron/detect-sfs-changes` - Daily SFS change detection (02:00 CET)
- `GET /api/v1/cron/detect-court-case-changes` - Daily court case detection (02:30 CET)
- `GET /api/v1/cron/generate-embeddings` - Batch embedding generation
- `GET /api/v1/cron/send-due-date-reminders` - Daily task due date reminders (08:00 CET) - _Epic 6_
- `GET /api/v1/cron/send-weekly-digest` - Weekly compliance summary (Sunday 18:00 CET) - _Epic 6_

### Webhook Endpoints

- `POST /api/v1/webhooks/stripe` - Stripe webhook receiver (subscriptions, payments)
- `GET /api/v1/webhooks/fortnox/oauth-callback` - Fortnox OAuth callback

### Public API Endpoints (Enterprise Tier)

- `GET /api/v1/public/laws` - Search legal documents
- `GET /api/v1/public/laws/{documentId}` - Get document by ID
- `GET /api/v1/public/workspaces/{workspaceId}/law-list` - Get workspace law list
- `POST /api/v1/public/ai/query` - AI query endpoint

### Health & Monitoring

- `GET /api/v1/health` - Health check endpoint

**Complete OpenAPI 3.0 specification with request/response schemas, authentication patterns, and example payloads is available in the full Section 5.3.**

---

## 5.4 Authentication & Authorization

### NextAuth.js Configuration (Server Actions)

- **Providers:** Credentials (email/password), Google OAuth 2.0
- **Session:** JWT-based, 30-day expiry
- **Adapter:** Prisma adapter for database persistence

### API Key Authentication (REST Endpoints)

- **Header:** `X-API-Key: sk_live_xxxxx`
- **Storage:** Encrypted in `workspaces.api_key` column
- **Rotation:** Supported via workspace settings UI

### Role-Based Access Control (RBAC)

**Roles:**

- `OWNER` - Full workspace control
- `ADMIN` - Manage members, settings, HR
- `MEMBER` - Use all features, no admin access
- `VIEWER` - Read-only access

**Permissions matrix documented in Section 5.4.3.**

---

## 5.5 Rate Limiting & Quotas

**Implementation:** Redis-based with `@upstash/ratelimit`

**Rate Limits:**

| Scope                     | Limit          | Window            |
| ------------------------- | -------------- | ----------------- |
| **User (Server Actions)** | 100 requests   | per minute        |
| **Workspace (REST API)**  | 1,000 requests | per hour          |
| **Public API**            | 100 requests   | per hour (per IP) |
| **AI Chat**               | 20 messages    | per minute        |

**Workspace Quotas by Tier:**

| Tier             | AI Messages/Month | Storage   | Team Members | HR Employees |
| ---------------- | ----------------- | --------- | ------------ | ------------ |
| **FREE**         | 50                | 0.5 GB    | 3            | 10           |
| **BASIC**        | 500               | 5 GB      | 5            | 25           |
| **PROFESSIONAL** | 2,000             | 50 GB     | 15           | 100          |
| **ENTERPRISE**   | Unlimited         | Unlimited | Unlimited    | Unlimited    |

---

## 5.6 Versioning Strategy

**REST API:** URL path versioning (`/api/v1`, `/api/v2`)

- Current: v1
- Deprecation policy: 12-month support after new version release
- Breaking changes trigger version bump

**Server Actions:** Function overloading for backward compatibility

- Detect v1 vs v2 signatures
- Log deprecation warnings
- Gradual migration path

---

## 5.7 API Documentation & Developer Portal

**Location:** `https://laglig.se/developers`

**Includes:**

- Interactive OpenAPI documentation (Swagger UI)
- Server Actions usage examples
- Authentication guide
- Rate limiting documentation
- Code samples (TypeScript, curl, Python)
- Webhook payload examples
- API changelog

---
