# Epic 10: Workspace Onboarding & Invitation Flow - Brownfield Enhancement

## Epic Overview

**Epic ID:** Epic 10
**Status:** Draft
**Priority:** Critical (blocks all new-user usage)
**Business Owner:** Product Team
**Technical Lead:** Development Team

## Epic Goal

Fix the broken new-user experience where signup leads to a crash (no workspace), and implement a multi-step workspace creation wizard with invitation acceptance flow so that every authenticated user has a clear path to a functional workspace.

## Epic Description

### Existing System Context

- **Auth flow:** Supabase Auth for signup/verification, NextAuth (JWT) for sessions. After verification, users redirect to `/dashboard`.
- **Workspace model:** Fully defined in Prisma (`Workspace`, `WorkspaceMember`, `CompanyProfile`). Workspaces represent companies with org numbers, SNI codes, subscription tiers.
- **Current problem:** `getWorkspaceContext()` in `lib/auth/workspace-context.ts:105` throws `WorkspaceAccessError('NO_WORKSPACE')` when user has no `WorkspaceMember` record. The workspace layout and pages don't catch this, resulting in an unhandled error (500/404 for the user).
- **Existing workspace creation:** `createWorkspace()` server action exists (`app/actions/workspace.ts:55-132`) but is only accessible via `CreateWorkspaceModal` in the workspace switcher - which is inside the workspace shell that crashes before rendering.
- **Technology stack:** Next.js 15 (App Router), Prisma, Supabase Auth, NextAuth, Redis, shadcn/ui, Tailwind CSS.

### Enhancement Details

**What's being added/changed:**

1. Post-auth routing guard that detects "no workspace" and redirects to onboarding instead of crashing
2. Multi-step workspace creation wizard at `/onboarding` (company info with address fields aligned to Bolagsverket data model, then review/confirm)
3. `WorkspaceInvitation` model and token-based invitation acceptance flow for invited users
4. Graceful handling of workspace access edge cases (deleted, paused workspaces)

**How it integrates:**

- New `/onboarding` route group outside `(workspace)` layout (no workspace shell dependency)
- Reuses existing `createWorkspace()` action, extended with company profile fields
- Hooks into existing `WorkspaceAccessError` error handling pattern
- New Prisma model `WorkspaceInvitation` with migration
- Client-side `use-workspace.tsx` hook already has `noWorkspaceRedirect` - needs to point to `/onboarding`

**Future extensibility (not in scope):**

- **Law list generator step:** Will slot in as Step 2 of the wizard (between company info and confirmation) once the law generation backend and agents are ready. The wizard architecture must support inserting steps without rework.
- **Bolagsverket API lookup:** Company info fields (name, address, SNI, legal form) are modeled to match Bolagsverket response structure. Currently manual entry; later, entering org number will auto-fill via API.
- **Tier selection / billing:** Deferred to trial-expiry epic. All new workspaces start as TRIAL with full Team-level access for 14 days.

**Success criteria:**

- New user signs up, verifies email, and lands on onboarding wizard (not a crash)
- User completes workspace creation wizard and arrives at dashboard with functional workspace
- Invited user signs up and is presented with pending invitation(s) to accept instead of workspace creation
- No regression in existing workspace functionality for established users

### Relationship to Existing Stories

- **Story 4.7 (Trial Signup Flow):** Covers widget-based signup with pre-generated law list. Different flow - that's the marketing funnel entry point. This epic covers the direct signup path.
- **Story 5.3 (Team Invite System):** Covers sending invitations from workspace settings. This epic covers the _receiving/accepting_ side during onboarding. Story 5.3 should be updated to depend on the invitation model created here.
- **Story 5.12 (Workspace Onboarding Checklist):** Post-workspace-creation guided tasks. Complementary - runs after this epic's flow completes.

---

## Stories

### Story 10.1: Post-Auth Workspace Guard & Onboarding Routing

**As a** newly registered user,
**I want** to be directed to workspace setup after login instead of seeing an error,
**so that** I can create my workspace and start using the platform.

**Acceptance Criteria:**

1. When an authenticated user with no `WorkspaceMember` record accesses any `(workspace)` route, they are redirected to `/onboarding` instead of getting an error
2. The redirect preserves the originally requested URL so the user can be sent there after workspace creation
3. Users with an existing workspace are unaffected - normal routing continues
4. The `/onboarding` route is accessible only to authenticated users without a workspace
5. Users who already have a workspace and visit `/onboarding` are redirected to `/dashboard`
6. The `NO_WORKSPACE` error in `getWorkspaceContext()` is handled gracefully in the workspace layout with a redirect rather than an unhandled exception
7. Auth callback (`/auth/callback`) and login redirect point to `/onboarding` instead of `/dashboard` for users without workspaces (or redirect chain: `/dashboard` -> detect no workspace -> `/onboarding`)
8. Edge cases handled: deleted workspace (show "workspace deleted" message), paused workspace (show "workspace paused" with reactivation option for owners)

**Key Files:**

| File                                 | Change                                                           |
| ------------------------------------ | ---------------------------------------------------------------- |
| `app/(workspace)/layout.tsx`         | Add try-catch around workspace context, redirect on NO_WORKSPACE |
| `lib/hooks/use-workspace.tsx`        | Update `noWorkspaceRedirect` to `/onboarding`                    |
| `app/api/workspace/context/route.ts` | Return structured redirect info for NO_WORKSPACE                 |
| `app/onboarding/layout.tsx`          | New - auth-only layout without workspace shell                   |
| `app/onboarding/page.tsx`            | New - entry point that checks state and routes to correct step   |

---

### Story 10.2: Workspace Creation Wizard

**As a** new user without a workspace,
**I want** to set up my company workspace through a guided multi-step form,
**so that** I can start using the platform with my company's context.

**Acceptance Criteria:**

1. Multi-step wizard at `/onboarding` with step indicator (Step 1 of 2, Step 2 of 2)
2. **Step 1 - Företagsinformation (Company Info):**
   - Företagsnamn (company name) - required
   - Organisationsnummer - required, format validated (XXXXXX-XXXX Swedish org number format)
   - Adress (street address) - optional
   - Postnummer (postal code) - optional, format validated (XXX XX)
   - Ort (city) - optional
   - Bransch / SNI-kod (industry) - optional, dropdown or text
   - Juridisk form (legal form: AB, HB, EF, etc.) - optional, dropdown
   - Antal anställda (employee count) - optional, numeric
   - All text in Swedish
3. **Step 2 - Bekräfta & Skapa (Review & Create):**
   - Summary of entered company info
   - "Din 14-dagars provperiod börjar nu" messaging
   - "Skapa workspace" CTA button
   - Back button to edit
4. On submit: creates Workspace (TRIAL tier, 14-day trial) + CompanyProfile + WorkspaceMember (OWNER role) in a single transaction
5. Sets active workspace cookie after creation
6. Redirects to `/dashboard` on success (or to originally requested URL if preserved from Story 10.1)
7. Form state persists between steps (not lost on back/forward navigation)
8. Loading state on submit with disabled button to prevent double-submit
9. Error handling: duplicate org number shows clear message, server errors show toast
10. Wizard architecture supports adding more steps in the future (e.g., law list generator between Step 1 and the confirmation step) without structural changes
11. Responsive design - works on mobile

**Key Files:**

| File                                               | Change                                                                                                                  |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `app/onboarding/page.tsx`                          | Wizard container with step management                                                                                   |
| `app/onboarding/_components/company-info-step.tsx` | New - Step 1 form                                                                                                       |
| `app/onboarding/_components/confirm-step.tsx`      | New - Step 2 review                                                                                                     |
| `app/onboarding/_components/wizard-stepper.tsx`    | New - Step indicator component                                                                                          |
| `app/actions/workspace.ts`                         | Extend `createWorkspace()` to accept company profile fields (org_number, address, sni_code, legal_form, employee_count) |
| `prisma/schema.prisma`                             | No schema changes needed - Workspace and CompanyProfile models already have all required fields                         |

**Org Number Format Validation:**

```typescript
// Swedish organisationsnummer: XXXXXX-XXXX (10 digits with optional hyphen)
// Validate format only - no registry lookup (Bolagsverket integration comes later)
const orgNumberSchema = z
  .string()
  .regex(/^\d{6}-?\d{4}$/, 'Ogiltigt format. Ange XXXXXX-XXXX')
```

**Data Flow:**

- `createWorkspace()` action extended to accept `FormData` with company fields
- Creates `Workspace` with `org_number`, `company_legal_name`, `sni_code`
- Creates `CompanyProfile` with `company_name`, `sni_code`, `legal_form`, `employee_count`, `address`
- Creates `WorkspaceMember` with `role: OWNER`
- All in one Prisma transaction

---

### Story 10.3: Invitation Model & Acceptance Flow

**As a** user who has been invited to a workspace,
**I want** to see and accept my pending invitation(s) during onboarding,
**so that** I can join an existing workspace without creating a new one.

**Acceptance Criteria:**

1. New `WorkspaceInvitation` model in Prisma with fields: id, workspace_id, email, role, token (unique), invited_by, status (PENDING/ACCEPTED/EXPIRED/REVOKED), expires_at, created_at
2. Database migration creates `workspace_invitations` table with indexes on email, token, workspace_id
3. When a user without a workspace arrives at `/onboarding`, the system checks for pending invitations matching their email
4. If pending invitations exist: show invitation card(s) with workspace name, role, inviter name, and expiry date instead of the workspace creation wizard
5. User can accept an invitation → creates `WorkspaceMember` record, sets active workspace, marks invitation as ACCEPTED, redirects to `/dashboard`
6. User can decline an invitation → marks invitation as REVOKED, shows next invitation or falls through to workspace creation wizard
7. If user has both pending invitations AND wants to create a new workspace, they can dismiss invitations and proceed to the wizard via a "Skapa eget workspace istället" link
8. Invitation tokens are cryptographically secure (minimum 32 bytes, URL-safe base64)
9. Expired invitations (past `expires_at`) are not shown and automatically marked EXPIRED
10. After accepting an invitation, user's workspace context cache is invalidated

**Key Files:**

| File                                                 | Change                                                                 |
| ---------------------------------------------------- | ---------------------------------------------------------------------- |
| `prisma/schema.prisma`                               | Add `WorkspaceInvitation` model                                        |
| `prisma/migrations/...`                              | New migration for workspace_invitations table                          |
| `app/onboarding/page.tsx`                            | Check for pending invitations before showing wizard                    |
| `app/onboarding/_components/pending-invitations.tsx` | New - invitation cards UI                                              |
| `app/actions/invitations.ts`                         | New - acceptInvitation(), declineInvitation(), getPendingInvitations() |
| `lib/auth/workspace-context.ts`                      | Invalidate cache on invitation acceptance                              |

**Schema Addition:**

```prisma
model WorkspaceInvitation {
  id           String           @id @default(uuid())
  workspace_id String
  email        String
  role         WorkspaceRole    @default(MEMBER)
  token        String           @unique
  invited_by   String
  status       InvitationStatus @default(PENDING)
  expires_at   DateTime
  created_at   DateTime         @default(now())

  workspace Workspace @relation(fields: [workspace_id], references: [id], onDelete: Cascade)
  inviter   User      @relation("InvitationInviter", fields: [invited_by], references: [id])

  @@index([email])
  @@index([workspace_id])
  @@index([token])
  @@map("workspace_invitations")
}

enum InvitationStatus {
  PENDING
  ACCEPTED
  EXPIRED
  REVOKED
}
```

**Note:** This story creates the invitation model and the acceptance flow only. The _sending_ of invitations (from workspace settings, with email delivery) is covered by existing Story 5.3 which should be updated to use this model.

---

## Story Sequencing

```
Story 10.1 (Guard & Routing)
    ↓
Story 10.2 (Creation Wizard)  ←  can be developed in parallel with 10.3
Story 10.3 (Invitation Flow)  ←  can be developed in parallel with 10.2
```

- **10.1 must be completed first** - establishes the `/onboarding` route and redirect logic
- **10.2 and 10.3 are independent** - can be developed in parallel after 10.1
- **10.2 is the higher priority** of the two since it unblocks all new users, while 10.3 only applies to invited users

---

## Compatibility Requirements

- [x] Existing APIs remain unchanged (workspace context API gets additional redirect info, backwards compatible)
- [x] Database schema changes are backward compatible (new table, no changes to existing tables)
- [x] UI changes follow existing patterns (shadcn/ui components, Tailwind, Swedish localization)
- [x] Performance impact is minimal (one additional DB query for invitation check during onboarding)
- [x] Existing users with workspaces are completely unaffected
- [x] `createWorkspace()` action is extended, not replaced - existing callers (CreateWorkspaceModal) continue to work

## Risk Mitigation

- **Primary Risk:** Redirect loop if workspace detection logic has edge cases (e.g., user with deleted workspace bouncing between dashboard and onboarding)
- **Mitigation:** Explicit handling of all workspace states (ACTIVE, PAUSED, DELETED) with distinct UI for each; integration tests covering all state combinations
- **Rollback Plan:** Revert the workspace layout change (Story 10.1) to restore previous behavior; the onboarding routes are additive and can be removed without affecting existing functionality

## Definition of Done

- [ ] All stories completed with acceptance criteria met
- [ ] New user can sign up, verify email, and reach a working dashboard via the onboarding wizard
- [ ] Invited user can sign up and accept an invitation to join an existing workspace
- [ ] Existing users with workspaces experience no change in behavior
- [ ] No regression in workspace switching, workspace creation via modal, or workspace settings
- [ ] Swedish language used throughout all new UI
- [ ] Mobile-responsive onboarding wizard

## Deferred / Future Work

| Item                       | Deferred To                 | Notes                                                        |
| -------------------------- | --------------------------- | ------------------------------------------------------------ |
| Tier/plan selection        | Trial expiry epic           | All users start as TRIAL; selection happens at day 10-14     |
| Bolagsverket API lookup    | Story 4.2                   | Fields modeled to match API response; manual entry for now   |
| Law list generator step    | Post-law-generation-backend | Slots in as wizard Step 2 (between company info and confirm) |
| Stripe billing integration | Story 5.4                   | No payment collection during onboarding                      |
| Invitation email sending   | Story 5.3                   | This epic only covers acceptance; sending is separate        |
| Welcome email sequence     | Story 4.9                   | Post-onboarding email nurture                                |

---

## Story Manager Handoff

Please develop detailed user stories for this brownfield epic. Key considerations:

- This is an enhancement to an existing system running Next.js 15 (App Router), Prisma, Supabase Auth, NextAuth, Redis, shadcn/ui
- Integration points: workspace layout guard, workspace context helper, auth callback, Prisma schema, workspace actions
- Existing patterns to follow: server actions pattern (`app/actions/`), workspace context caching with Redis, shadcn/ui forms with Zod validation, Swedish localization throughout
- Critical compatibility requirements: existing workspace users must be unaffected, `createWorkspace()` must remain backwards compatible, workspace context API must remain backwards compatible
- Each story must include verification that existing functionality remains intact
- The wizard must be architected for future step insertion (law list generator) without structural rework

The epic should maintain system integrity while delivering a functional onboarding path for all new users.
