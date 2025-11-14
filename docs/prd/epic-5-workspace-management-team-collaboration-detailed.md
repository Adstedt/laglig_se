# Epic 5: Workspace Management & Team Collaboration (DETAILED)

**Goal:** Enable multi-user workspaces with subscription tiers, team invites, role-based access, and billing integration.

**Value Delivered:** Teams can collaborate on compliance + subscription billing enables revenue + usage tracking validates business model.

---

## Story 5.1: Implement Workspace Data Model and Multi-Tenancy

**As a** developer,
**I want** to build workspace-based multi-tenancy architecture,
**so that** each company's data is isolated and team members share access.

**Acceptance Criteria:**

1. Prisma schema updated with `workspaces` table: id, name, owner_id, company_logo, created_at, subscription_tier, trial_ends_at, status (active/paused/deleted)
2. `workspace_members` table: id, workspace_id, user_id, role (owner/admin/hr_manager/member/auditor), invited_at, joined_at
3. Row-Level Security (RLS) policies ensure users only access their workspace data
4. All core tables (laws_in_workspace, employees, tasks, chat_messages) include workspace_id foreign key
5. Database queries scoped to workspace_id by default
6. Middleware checks user has access to requested workspace
7. Test: User A cannot access User B's workspace data
8. Test: Workspace deletion cascades to all related data (soft-delete)

---

## Story 5.2: Implement Five User Roles with Permissions

**As a** workspace owner,
**I want** to assign different roles to team members,
**so that** I control who can access sensitive HR data and billing.

**Acceptance Criteria:**

1. Five roles defined: Owner, Admin, HR Manager, Member, Auditor
2. **Owner:** Full access + billing + workspace deletion
3. **Admin:** Full access except billing and deletion
4. **HR Manager:** Full access to HR Module + employee data, read-only law lists
5. **Member:** Read-only law lists, can use AI chat, cannot see employees
6. **Auditor:** Read-only access to multiple workspaces (for ISO consultants)
7. Permissions checked at API route level (middleware)
8. Permissions checked at UI level (hide/disable actions)
9. Permission matrix documented in code comments
10. Test: Member cannot access HR Module, HR Manager cannot change billing

---

## Story 5.3: Build Team Invite System

**As a** workspace owner/admin,
**I want** to invite team members via email,
**so that** they can join my workspace.

**Acceptance Criteria:**

1. Team settings page shows current members list
2. "Invite Member" button opens modal
3. Modal fields: Email, Role (dropdown)
4. Clicking "Send Invite" creates pending invitation
5. Invitation email sent to recipient with: workspace name, inviter name, "Join Workspace" CTA link
6. Invite link format: `/invite/[token]`
7. Recipient clicks link → Redirected to signup (if new user) or direct join (if existing user)
8. After joining, invitation status updated to "accepted"
9. Owner/Admin can re-send invites or revoke pending invites
10. Invite expiry: 7 days, auto-delete expired invites

---

## Story 5.4: Integrate Stripe for Subscription Billing

**As a** product owner,
**I want** to collect payments via Stripe,
**so that** users can subscribe to paid tiers.

**Acceptance Criteria:**

1. Stripe account created, publishable and secret keys configured
2. Stripe Customer created for each workspace
3. Three Stripe Products created: Solo (€399/mo), Team (€899/mo), Enterprise (€2,000+/mo custom)
4. Stripe Checkout integration for trial → paid conversion
5. Billing page shows: Current plan, next billing date, payment method, invoice history
6. "Upgrade Plan" flow: Select tier → Stripe Checkout → Subscription created
7. Webhook endpoint `/api/webhooks/stripe` handles: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
8. Subscription status synced to `workspaces.subscription_tier` and `workspaces.subscription_status`
9. Failed payments → Email notification + 3-day grace period before access blocked
10. Test subscription lifecycle: Trial → Paid → Upgrade → Downgrade → Cancel

---

## Story 5.5: Implement Usage Limits Per Tier

**As a** system,
**I want** to enforce usage limits based on subscription tier,
**so that** users must upgrade when they exceed limits.

**Acceptance Criteria:**

1. Usage limits defined per tier:
   - Solo: 1 user, 5 employees, 50 AI queries/month, 1GB storage
   - Team: 5 users, 50 employees, 500 AI queries/month, 10GB storage
   - Enterprise: Unlimited users, unlimited employees, unlimited queries, 100GB storage
2. Usage tracked in database: `workspace_usage` table with fields: ai_queries_this_month, employee_count, storage_used_mb
3. Middleware checks usage before allowing actions:
   - Adding user → Check user limit
   - Adding employee → Check employee limit
   - Sending AI query → Check query limit
   - Uploading file → Check storage limit
4. 10% overage allowance before hard block
5. Soft limit warning at 80%: "You've used 40/50 AI queries this month. Upgrade?"
6. Hard limit at 110%: "You've reached your limit. Upgrade to continue."
7. Usage resets monthly (1st of month)
8. Analytics dashboard shows usage trends

---

## Story 5.6: Build Add-On Purchase System

**As a** user,
**I want** to purchase add-ons instead of upgrading my entire tier,
**so that** I can grow incrementally.

**Acceptance Criteria:**

1. Add-ons defined:
   - +10 employees: €100/month
   - +5GB storage: €50/month
2. Billing page shows "Add-ons" section
3. User can toggle add-ons on/off
4. Clicking "Add +10 employees" → Stripe creates additional subscription item
5. Add-on pricing prorated (charged immediately for current billing period)
6. Add-ons included in usage limit calculations
7. Example: Team tier (50 employees) + 2x add-ons = 70 employee limit
8. Stripe webhook updates add-on status
9. Invoice line items show base tier + add-ons separately

---

## Story 5.7: Implement Workspace Settings Page

**As a** workspace owner/admin,
**I want** to configure workspace settings,
**so that** I can customize branding and notifications.

**Acceptance Criteria:**

1. Workspace Settings page with tabs: General, Team, Billing, Notifications, Integrations
2. **General tab:**
   - Workspace name (editable)
   - Company logo upload (max 2MB, PNG/JPG)
   - Industry (SNI code, readonly - set during onboarding)
3. **Team tab:**
   - Current members list (name, role, joined date)
   - Invite member button
   - Change role dropdown (Owner/Admin only)
   - Remove member button (confirmation modal)
4. **Billing tab:**
   - Current plan, next billing date
   - Payment method, update card button
   - Invoice history (downloadable PDFs)
   - Upgrade/downgrade buttons
5. **Notifications tab:**
   - Email preferences: Daily digest, weekly digest, instant change alerts
   - In-app notification preferences
6. **Integrations tab:**
   - Placeholder: "Fortnox integration coming soon"
7. Save button persists changes
8. Owner-only actions disabled for non-owners

---

## Story 5.8: Implement Workspace Pause and Deletion

**As a** workspace owner,
**I want** to pause or delete my workspace,
**so that** I can stop paying without losing data (pause) or permanently remove everything (delete).

**Acceptance Criteria:**

1. **Pause workspace:**
   - Settings page → "Pause Workspace" button
   - Confirmation modal: "Your data will be preserved but access blocked until resumed."
   - Workspace status set to "paused"
   - Team members cannot login to workspace
   - Stripe subscription canceled, no future charges
   - Data preserved indefinitely
   - "Resume Workspace" button re-enables access
2. **Delete workspace:**
   - Settings page → "Delete Workspace" button (Owner only)
   - Confirmation modal requires typing workspace name
   - Workspace soft-deleted (status: "deleted")
   - All workspace data hidden from queries
   - Email sent to all team members: "Workspace deleted"
   - 30-day recovery period (Owner can restore)
   - After 30 days, hard delete via cron job (GDPR compliance)
   - Stripe subscription canceled immediately

---

## Story 5.9: Build Workspace Switcher (Multi-Workspace Support)

**As a** user,
**I want** to switch between workspaces if I belong to multiple,
**so that** I can manage different companies or act as an auditor.

**Acceptance Criteria:**

1. Top navigation includes workspace switcher dropdown
2. Dropdown shows all workspaces user belongs to
3. Current workspace highlighted
4. Clicking workspace → Switches context, reloads page
5. Workspace context stored in session (cookie)
6. All queries scoped to active workspace
7. Auditor role can access multiple client workspaces (read-only)
8. "Create New Workspace" option in dropdown
9. Mobile: Workspace switcher in hamburger menu

---

## Story 5.10: Implement Unit Economics Tracking (NFR18 - CRITICAL)

**As a** product owner,
**I want** to track costs per workspace to validate business model,
**so that** I ensure gross margin >80%.

**Acceptance Criteria:**

1. `workspace_costs` table tracks: workspace_id, month, ai_api_cost, vector_query_cost, storage_cost, total_cost
2. AI API costs logged per query (OpenAI/Anthropic pricing)
3. Vector query costs calculated (Supabase pricing or estimated)
4. Storage costs calculated based on GB used
5. Monthly cron job aggregates costs per workspace
6. Analytics dashboard shows:
   - Revenue per workspace (subscription MRR)
   - Cost per workspace (AI + storage)
   - Gross margin % (target >80%)
   - Cohort analysis: Margin by tier (Solo vs Team vs Enterprise)
7. Email report sent to founder weekly
8. Alerting: If any workspace margin <60%, flag for review
9. Cost optimization recommendations: "Switch to cheaper embedding model for workspace X"

---

## Story 5.11: Build Workspace Activity Log (Enterprise Feature)

**As an** Enterprise customer,
**I want** to see an audit trail of who did what,
**so that** I maintain compliance documentation.

**Acceptance Criteria:**

1. `workspace_activity_log` table: id, workspace_id, user_id, action, resource_type, resource_id, timestamp
2. Actions logged:
   - Law change reviewed
   - Employee added/edited/deleted
   - Team member invited/removed
   - Settings changed
   - File uploaded/deleted
3. Activity Log page (Enterprise tier only)
4. Filterable by: User, Action type, Date range
5. Exportable as CSV
6. Log retention: 2 years
7. Performance: Indexed for fast queries on large datasets

---

## Story 5.12: Implement Workspace Onboarding Checklist

**As a** new user,
**I want** to see a checklist of setup steps,
**so that** I know how to get started.

**Acceptance Criteria:**

1. After first login, onboarding checklist displayed in Dashboard
2. Checklist items:
   - ✅ Law list generated (auto-completed during onboarding)
   - ⬜ Invite your team
   - ⬜ Add your first employee
   - ⬜ Ask AI a question
   - ⬜ Customize law list
3. Each item links to relevant page
4. Checklist dismissible (persisted in user preferences)
5. Progress % shown: "2/5 completed"
6. Gamification: Confetti animation when 100% complete

---

**Epic 5 Complete: 12 stories, 3-4 weeks estimated**

---
