# Epic 8: Amendment Monitoring & Change Notifications

## Epic Overview

**Epic ID:** Epic 8
**Status:** Draft (v3 — restructured 2026-02-17 to align with phased SFS-first, agency-second strategy)
**Priority:** Critical (launch blocker — users on templates need change awareness)
**Business Owner:** Sarah (PO)
**Technical Lead:** Development Team

## Epic Goal

Ensure that every document type tracked on the platform (SFS laws, myndighetsforeskrifter) has working amendment monitoring, and that detected changes propagate to users through templates, law lists, in-app notifications, and email digests.

**Scope:** SFS documents and agency regulations (myndighetsforeskrifter). EU documents and court cases are deferred.

## Epic Description

### Why This Matters

Users are about to adopt templates and start tracking laws. If a law in their template is amended and they don't know about it, the platform fails at its core promise. This epic closes the gap between "a law changed" and "the user knows and has taken action" — first for SFS laws (where detection already works), then for agency regulations (where nothing exists yet).

### Strategic Phasing

**Phase 1 (SFS Backend):** The SFS amendment detection pipeline is mature — `sync-sfs-updates` runs daily, detects amendments, parses PDFs via Claude, creates `ChangeEvent` records. But the chain breaks there. Phase 1 wires ChangeEvents to user-facing notifications + email and auto-syncs template metadata.

**Phase 2 (SFS UX):** Gives users a proper in-app experience for reviewing changes — Changes tab, diff view, acknowledge workflow.

**Phase 3 (Agency Regulations):** Builds amendment monitoring from scratch for myndighetsforeskrifter. This requires expanding document ingestion beyond template-referenced docs, building agency-specific change detection, and wiring into the notification pipeline from Phase 1.

**Phase 4 (Collaboration & Polish):** Lower-priority notification features — collaboration triggers, reminders, weekly digests, preferences UI. Can be split to a separate epic if needed.

### Existing System Context

**What works today:**
- `sync-sfs-updates` cron (04:30 UTC) — detects SFS amendments, parses PDFs, creates `ChangeEvent` + `AmendmentDocument` + `LegalDocument`
- `sync-sfs` cron (04:00 UTC) — detects newly published SFS laws
- `sync-court-cases` cron (05:00 UTC) — syncs court cases, creates `CrossReference` links
- `ChangeEvent` model — records all detected changes with `notification_sent` boolean (always `false` — never used)
- `Notification` / `NotificationPreference` models — exist in schema but no code creates records
- `LawListItem.last_change_acknowledged_at` / `last_change_acknowledged_by` — fields exist but unused
- `TemplateItem.last_amendment` — exists but manually maintained
- Resend email service — working for admin cron notifications
- Story 12.3 content generation pipeline — proven summering/kommentar prompts
- AFS HTML scraping pipeline (Story 9.1) — 81 entries ingested, one-time only

**What does NOT exist:**
- No shared email infrastructure for user-facing emails (only raw HTML admin cron emails)
- No code creates `Notification` records from `ChangeEvent` (the wiring is missing)
- No user-facing email notifications (only admin cron emails)
- No in-app notification UI (bell, dropdown, badge)
- No auto-sync of `TemplateItem.last_amendment` when base documents change
- No amendment monitoring for any agency regulation (zero — no cron, no detection, no adapter pattern)
- No agency document ingestion beyond template-referenced docs and AFS scrape
- No change review UX (Changes tab, diff view, acknowledge)
- No notification preferences UI

---

## Complete Story Inventory

All stories in this epic, with their status and file locations:

### Prerequisite
| # | Story | File | Status |
|---|-------|------|--------|
| **0.1** | Email Infrastructure Foundation | `docs/stories/0.1.email-infrastructure-foundation.md` | Approved |

### Phase 1: SFS — Complete the Notification Loop
| # | Story | File | Status |
|---|-------|------|--------|
| **8.15** | Notification Service & Recipient Resolution | `docs/stories/8.15.notification-service-recipient-resolution.md` | Draft v1 |
| **8.16** | Template & LawList Change Propagation | `docs/stories/8.16.template-lawlist-change-propagation.md` | Draft v1 |
| **8.4** | Daily Amendment Email Digest | `docs/stories/8.4.email-notifications-law-changes.md` | Draft v2 |
| **8.5** | In-App Notification Bell | `docs/stories/8.5.in-app-notification-bell.md` | Draft v2 |

### Phase 2: SFS — Change Review UX
| # | Story | File | Status |
|---|-------|------|--------|
| **8.1** | Changes Tab | `docs/stories/8.1.change-detection-ui-changes-tab.md` | Draft v2 |
| **8.2** | GitHub-Style Diff View | `docs/stories/8.2.github-style-diff-view.md` | Draft v2 |
| **8.3** | Mark as Reviewed Workflow | `docs/stories/8.3.mark-as-reviewed-workflow.md` | Draft v2 |
| **8.10** | Effective Date Tracking | `docs/stories/8.10.effective-date-tracking.md` | Draft v2 |

### Phase 3: Agency Regulations — Build the Pipeline
| # | Story | File | Status |
|---|-------|------|--------|
| **8.17** | Expand Agency Document Ingestion | `docs/stories/8.17.expand-agency-document-ingestion.md` | Draft v1 |
| **8.18** | Agency Adapter Pattern & Change Detection | `docs/stories/8.18.agency-adapter-pattern-change-detection.md` | Draft v1 |
| **8.19** | Agency Regulation Sync Cron | `docs/stories/8.19.agency-regulation-sync-cron.md` | Draft v1 |

### Phase 4: Collaboration & Polish (deferred — can be separate epic)
| # | Story | File | Status |
|---|-------|------|--------|
| **8.13** | Collaboration Notification Triggers | No story file — deferred | Inline in epic only |
| **8.14** | Task Deadline Cron | No story file — deferred | Inline in epic only |
| **8.6** | Amendment Acknowledgment Reminders | `docs/stories/8.6.reminder-emails-unacknowledged-changes.md` | Draft v1 |
| **8.7** | Weekly AI Editorial Digest | `docs/stories/8.7.weekly-industry-digest-email.md` | Draft v1 |
| **8.11** | Notification Preferences UI | `docs/stories/8.11.change-notification-preferences.md` | Draft v1 |
| **8.9** | Amendment Timeline Visualization | `docs/stories/8.9.amendment-timeline-visualization.md` | Draft v1 |

### Supporting
| # | Story | File | Status |
|---|-------|------|--------|
| **8.12** | Change Detection Performance Optimization | `docs/stories/8.12.optimize-change-detection-performance.md` | Draft v1 |

### Superseded
| # | Story | Reason |
|---|-------|--------|
| ~~8.8~~ | ~~AI Change Summaries~~ | Superseded by Story 12.3 content generation pipeline |

**Note on 8.13/8.14:** These stories cover workspace collaboration notifications (task assigned, mentions, deadlines) — a different concern from amendment monitoring. They were added in the v2 epic rewrite as they share the notification infrastructure built by 8.15. Detailed story files will be written when Phase 4 is prioritized. They are not needed for the amendment monitoring goal.

---

## Prerequisite: Email Infrastructure

### Story 0.1: Email Infrastructure Foundation (APPROVED — implement first)

**As a** developer working on any email-dependent feature,
**I want** a shared, production-ready email infrastructure with branded templates, preference enforcement, and unsubscribe handling,
**so that** every epic that needs transactional email can plug into a consistent, tested foundation.

This is a **cross-cutting prerequisite** that blocks Story 8.4 (daily email digest) and all other email-sending stories. It provides:
- React Email setup with branded `LagligEmailLayout` template
- Shared `EmailService` wrapping Resend with preference checking and retry logic
- Unsubscribe endpoint with HMAC-signed tokens (GDPR compliance)
- `shouldSendEmail()` and `getEmailPreference()` helpers
- **Status:** Approved — ready to implement
- **Detailed story:** `docs/stories/0.1.email-infrastructure-foundation.md`

---

## Phase 1: SFS — Complete the Notification Loop

**Goal:** When an SFS law tracked in a user's law list is amended, the user is notified via email and in-app notification. Template metadata auto-updates.

**Why first:** Highest-impact, lowest-effort. The detection pipeline works end-to-end. We just need to connect ChangeEvent → user.

### Story 8.15: Notification Service & Recipient Resolution (NEW)

**As a** platform,
**I need** a shared notification service that resolves who cares about a `ChangeEvent` and creates `Notification` records,
**so that** all downstream delivery channels (email, bell, future push) have a consistent source of truth.

**This is the foundational "wiring" story that all other notification stories depend on.**

- Shared `createChangeNotifications(changeEventId)` function in `lib/notifications/`
- Recipient resolution: `ChangeEvent.document_id` → `LawListItem.document_id` → `LawList.workspace_id` → `WorkspaceMember` → `User`
- Creates `Notification` record per affected user per workspace:
  - `type: AMENDMENT_DETECTED` (new enum value)
  - `entity_type: 'change_event'`, `entity_id: changeEvent.id`
  - `title`: base law title
  - `message`: amendment SFS number + summering snippet
- Respects `NotificationPreference` per user
- Expand `NotificationType` enum: add `AMENDMENT_DETECTED`, `LAW_REPEALED`, `RULING_CITED`, `AMENDMENT_REMINDER`
- Expand `NotificationPreference` model: add `amendment_detected_enabled`, `law_repealed_enabled` (default true)
- Idempotent: calling twice for same ChangeEvent doesn't create duplicates
- **Status:** New — needs story file

### Story 8.16: Template & LawList Change Propagation (NEW)

**As a** platform,
**I need** template metadata to auto-update when tracked documents are amended,
**so that** templates stay current and users see accurate "last amendment" information.

- When `sync-sfs-updates` processes an amendment for a base law:
  - Find all `TemplateItem` records where `document_id` matches the base law
  - Update `TemplateItem.last_amendment` to the new amendment SFS number
  - Update `TemplateItem.updated_at`
- Can be implemented as a post-processing step in `sync-sfs-updates` or as a triggered function called after ChangeEvent creation
- Log: "Updated N template items for SFS YYYY:NNN amendment"
- No user notification here (that's 8.15's job) — this is purely metadata sync
- **Status:** New — needs story file

### Story 8.4: Daily Amendment Email Digest (EXISTING — v2)

**As a** workspace member with laws in my law list,
**I want** to receive a daily email digest when amendments affect laws I track,
**so that** I'm alerted to compliance-relevant changes even when not using the app.

- Cron at `/api/cron/notify-amendment-changes` runs 07:00 UTC daily
- Finds un-notified `ChangeEvent` records via `notification_sent = false`
- Calls Story 8.15's recipient resolution to find affected workspaces + users
- Generates summering + kommentar via Story 12.3 pipeline (Sonnet inline) if missing
- Groups by workspace, sends one digest email per workspace
- Marks `ChangeEvent.notification_sent = true` after delivery
- Respects `NotificationPreference.email_enabled`
- **Status:** Draft (v2) — well-defined, ready to implement
- **Detailed story:** `docs/stories/8.4.email-notifications-law-changes.md`
- **Depends on:** Story 8.15 (notification service + recipient resolution)

### Story 8.5: In-App Notification Bell (EXISTING — v2)

**As a** workspace member,
**I want** to see a notification bell with unread count in the app header,
**so that** I'm aware of changes without checking email.

- Bell icon in top navigation with unread badge count
- Dropdown showing last 5 unread notifications
- Click notification → navigate to relevant entity
- Mark as read (individual + mark all read)
- Polling every 5 minutes for count updates
- Reads from `Notification` records created by Story 8.15
- **Status:** Draft (v2) — needs story file update
- **Depends on:** Story 8.15 (must have Notification records to display)

### Phase 1 Sequencing

```
Story 0.1  (Email Infrastructure)     ← PREREQUISITE: must complete before 8.4
Story 8.15 (Notification Service)     ← Foundation: createChangeNotifications()
Story 8.16 (Template Sync)            ← Can be parallel with 8.15
Story 8.4  (Daily Email Digest)       ← Depends on 0.1 (EmailService) + 8.15 (recipients)
Story 8.5  (Notification Bell)        ← Depends on 8.15, can parallel with 8.4
```

**Phase 1 Definition of Done:**
- [ ] Shared email infrastructure with branded templates, preference checking, unsubscribe (Story 0.1)
- [ ] When SFS law is amended, all workspace members tracking it receive email digest next morning
- [ ] In-app notification bell shows unread amendment count
- [ ] `TemplateItem.last_amendment` auto-updates when base document is amended
- [ ] `ChangeEvent.notification_sent` correctly marked after delivery

---

## Phase 2: SFS — Change Review UX

**Goal:** Give users a proper in-app experience for reviewing what changed, understanding the impact, and acknowledging they've seen it.

### Story 8.1: Changes Tab (EXISTING — v2)

**As a** workspace member,
**I want** a "Changes" tab on my law list showing unacknowledged amendments,
**so that** I can review updates and stay compliant.

- Changes tab with unacknowledged count badge
- Change cards with priority, law title, amendment SFS, AI summering + kommentar
- Filter by priority (High/Medium/Low)
- "View Details" → diff view, "Mark as Reviewed" → acknowledge
- **Status:** Draft (v2) — well-defined
- **Detailed story:** `docs/stories/8.1.change-detection-ui-changes-tab.md`

### Story 8.2: GitHub-Style Diff View (EXISTING — v2)

**As a** workspace member reviewing a change,
**I want** a side-by-side diff showing exactly what changed,
**so that** I understand the impact without reading raw legal text.

- Section-level diffs from `SectionChange` records (AMENDED/NEW/REPEALED)
- Red/green highlighting, line numbers
- AI summering + kommentar at top
- Links to full law and Riksdagen PDF
- **Status:** Draft (v2) — well-defined
- **Detailed story:** `docs/stories/8.2.github-style-diff-view.md`

### Story 8.3: Mark as Reviewed Workflow (EXISTING — v2)

**As a** workspace member,
**I want** to mark a change as reviewed so it disappears from my Changes tab,
**so that** I can track which amendments I've handled.

- Updates `LawListItem.last_change_acknowledged_at` + `last_change_acknowledged_by`
- Bulk "Mark All as Reviewed" option
- Activity logged to `ActivityLog`
- **Status:** Draft (v2) — well-defined
- **Detailed story:** `docs/stories/8.3.mark-as-reviewed-workflow.md`
- **Depends on:** Story 8.1

### Story 8.10: Effective Date Tracking (EXISTING — v2)

**As a** workspace member,
**I want** to see when each amendment takes effect,
**so that** I can plan compliance timelines.

- Effective date badges on change cards and diff view (future/today/past/unknown)
- Resolution chain: AmendmentDocument → Amendment → LegalDocument → null
- Sort changes by effective date as secondary option
- **Status:** Draft (v2) — well-defined
- **Detailed story:** `docs/stories/8.10.effective-date-tracking.md`

### Phase 2 Sequencing

```
Story 8.1  (Changes Tab)              ← Entry point for all change review
Story 8.2  (Diff View)                ← Can parallel with 8.1
Story 8.3  (Mark as Reviewed)         ← Depends on 8.1 (needs tab to place buttons)
Story 8.10 (Effective Dates)          ← Enhances 8.1 + 8.2 (can be parallel or after)
```

**Phase 2 Definition of Done:**
- [ ] Users see Changes tab with unacknowledged amendment list
- [ ] Users can view section-level diffs with AI summaries
- [ ] Users can mark changes as reviewed (single + bulk)
- [ ] Effective dates displayed with visual countdown badges

---

## Phase 3: Agency Regulations — Build the Pipeline

**Goal:** Ensure myndighetsforeskrifter (AFS, NFS, MSBFS, etc.) have amendment monitoring equivalent to SFS laws.

**Context:** Currently there is ZERO monitoring for agency regulations. AFS has 81 entries from a one-time HTML scrape. Other agencies have stubs only. Each agency has a different website, publishing format, and no unified API.

### Story 8.17: Expand Agency Document Ingestion (NEW)

**As a** platform,
**I need** to ingest the full set of agency regulation documents (not just template-referenced ones),
**so that** we have a complete baseline to monitor for changes.

- Audit current state: which agencies have full content vs. stubs vs. nothing
- For agencies already in templates (AFS, NFS, MSBFS, ELSAK-FS, KIFS, BFS, SKVFS, SCB-FS, SSMFS, STAFS, SRVFS): ensure all published documents are ingested with content
- Expand `agency-pdf-registry.ts` with complete document lists per agency
- For HTML-scrapable agencies (AFS via av.se): use existing scraping pipeline
- For PDF-only agencies: use PDF-direct LLM pipeline (adapt from SFS amendment pipeline)
- Store content hash per document for future change detection (new metadata field)
- **Status:** New — needs story file
- **Scope decision needed:** How many agencies to cover in first pass vs. iterative expansion

### Story 8.18: Agency Website Adapter Pattern & Change Detection (NEW)

**As a** platform,
**I need** a per-agency adapter pattern that can check for new or updated regulations,
**so that** we detect changes to agency regulations automatically.

- Create `lib/agency/adapters/` with base adapter interface:
  ```
  interface AgencyAdapter {
    agencyCode: string
    checkForUpdates(): Promise<AgencyUpdate[]>
    fetchDocument(docNumber: string): Promise<DocumentContent>
  }
  ```
- Implement adapters for priority agencies (start with agencies in published templates)
- Change detection strategy per agency:
  - **HTML-scrapable (AFS):** Re-scrape regulation pages, compare content hash
  - **PDF-based (NFS, MSBFS, etc.):** Check agency listing pages for new/updated document links, compare against stored URLs/dates
  - **RSS/feed where available:** Monitor for new publication announcements
- Each adapter returns list of detected changes: `{ documentNumber, changeType, newUrl, detectedAt }`
- **Status:** New — needs story file + research into each agency's publishing patterns

### Story 8.19: Agency Regulation Sync Cron (NEW)

**As a** platform,
**I need** a scheduled cron job that runs the agency adapters and processes detected changes,
**so that** agency regulation amendments are detected and recorded like SFS amendments.

- New cron endpoint: `/api/cron/sync-agency-regulations`
- Schedule: Weekly (agency regulations change less frequently than SFS laws)
- Iterates registered agency adapters from Story 8.18
- For each detected change:
  - Fetch updated document content (HTML scrape or PDF download)
  - Compare against stored version (content hash diff)
  - If changed: archive previous version via `DocumentVersion`, create `ChangeEvent`
  - If new: create `LegalDocument` record with full content
  - Process content through appropriate pipeline (HTML transform or PDF→LLM→HTML)
- Create `ChangeEvent` records with `content_type = AGENCY_REGULATION`
- Feeds into Story 8.15's notification service (same recipient resolution, same email/bell delivery)
- Stats tracking: per-agency checked/changed/failed counts
- `maxDuration = 300` with 30s buffer (same pattern as SFS crons)
- **Status:** New — needs story file
- **Depends on:** Story 8.17 (baseline documents must exist), Story 8.18 (adapters must be built)

### Phase 3 Sequencing

```
Story 8.17 (Expand Ingestion)         ← Must complete first: need baseline documents
Story 8.18 (Adapter Pattern)          ← Can start in parallel with 8.17 (interface design)
Story 8.19 (Sync Cron)                ← Depends on 8.17 + 8.18
```

**Phase 3 Definition of Done:**
- [ ] All agency regulations in published templates have full content (not stubs)
- [ ] Agency adapters implemented for agencies in published templates
- [ ] Weekly cron detects changes to agency regulation documents
- [ ] Agency regulation changes create ChangeEvents that flow through Phase 1 notification pipeline
- [ ] Users tracking agency regulations in law lists get same email/bell notifications as SFS changes

---

## Phase 4: Collaboration & Polish (Can Be Separate Epic)

**Goal:** Notification features beyond legal change monitoring — collaboration awareness, reminders, digests, and user preference controls.

**Note:** These stories are a different concern from amendment monitoring. They can be developed independently or extracted to a separate "Epic 8B: Collaboration Notifications" if prioritization warrants it.

### Story 8.13: Collaboration Notification Triggers (EXISTING)

- Wire `createNotification()` into existing server actions:
  - Task assigned → TASK_ASSIGNED
  - @mention in comment → MENTION
  - Comment on your task → COMMENT_ADDED
  - Task status changed → STATUS_CHANGED
  - Responsible person assigned → RESPONSIBLE_ASSIGNED
  - Compliance status changed → COMPLIANCE_CHANGED
- Tier 1 events also trigger transactional email
- **Depends on:** Story 8.15 (notification service)

### Story 8.14: Task Deadline Cron (EXISTING)

- Cron at `/api/cron/check-task-deadlines` runs daily 07:30 UTC
- Due in 3 days → TASK_DUE_SOON notification
- Overdue → TASK_OVERDUE notification + email
- **Depends on:** Story 8.15 (notification service)

### Story 8.6: Amendment Acknowledgment Reminders (EXISTING)

- Day 3: Nudge email to responsible person
- Day 7: Escalation to responsible person + workspace admins
- **Depends on:** Story 8.3 (acknowledge workflow) + Story 8.15 (notification service)

### Story 8.7: Weekly AI Editorial Digest (EXISTING)

- Sunday 18:00 CET
- AI-generated workspace-specific legal landscape recap
- Amendments this week, unacknowledged items, compliance snapshot
- **Depends on:** Story 8.4 (shares recipient resolution + email infra)

### Story 8.11: Notification Preferences UI (EXISTING)

- Settings page with per-type toggles for all notification types
- Channel controls: email master toggle, per-type email opt-in/out
- Warning modal for critical toggles (disabling amendment notifications)
- **Depends on:** Stories 8.15 + 8.5 (notification types must exist to configure)

### Story 8.9: Amendment Timeline Visualization (EXISTING)

- Historical timeline of all amendments to a law
- Visual markers for acknowledged vs unacknowledged
- Competitive parity with Notisum + AI summary differentiator
- **Independent** — can be developed anytime

---

## Supporting Stories

### Story 8.12: Change Detection Performance Optimization (EXISTING)

- Parallel processing, incremental hashing, rate limiting
- Operational concern — implement when scale demands it
- **Independent**

---

## Superseded Stories

### ~~Story 8.8: AI Change Summaries~~

**Superseded by Story 12.3** (Content Generation Pipeline). The summering/kommentar pipeline replaces the OpenAI-based approach entirely.

---

## Full Story Sequencing

```
PREREQUISITE: Email Infrastructure
  0.1  (Email Infrastructure)         ← MUST be first: React Email, EmailService, unsubscribe, preferences

PHASE 1: SFS — Complete the Notification Loop
  8.15 (Notification Service)         ← FOUNDATION: createChangeNotifications(), recipient resolution
  8.16 (Template Sync)                ← Parallel with 8.15 (no dependency between them)
  8.4  (Daily Email Digest)           ← Depends on 0.1 (EmailService) + 8.15 (recipient resolution)
  8.5  (Notification Bell)            ← Depends on 8.15 (reads Notification records)

PHASE 2: SFS — Change Review UX
  8.1  (Changes Tab)                  ← Phase 2 entry point
  8.2  (Diff View)                    ← Parallel with 8.1
  8.3  (Mark as Reviewed)             ← Depends on 8.1
  8.10 (Effective Dates)              ← Enhances 8.1 + 8.2

PHASE 3: Agency Regulations — Build the Pipeline
  8.17 (Expand Ingestion)             ← Phase 3 entry point
  8.18 (Adapter Pattern)              ← Parallel with 8.17
  8.19 (Sync Cron)                    ← Depends on 8.17 + 8.18

PHASE 4: Collaboration & Polish (deferred — story files written when prioritized)
  8.13 (Collab Triggers)              ← Depends on 8.15 — no story file yet
  8.14 (Deadline Cron)                ← Depends on 8.15 — no story file yet
  8.6  (Reminders)                    ← Depends on 8.3 + 8.15
  8.7  (Weekly Digest)                ← Depends on 8.4
  8.11 (Preferences UI)               ← Depends on 8.15 + 8.5
  8.9  (Timeline)                     ← Independent
```

**Recommended implementation order (Prerequisite + Phases 1-3):**
1. **0.1** (Email Infrastructure) — prerequisite: React Email, EmailService, unsubscribe, preference helpers
2. **8.15** (Notification Service) — establishes recipient resolution + Notification creation
3. **8.16** (Template Sync) — quick win, can be done in parallel with 8.15
4. **8.4** (Daily Email Digest) — highest immediate user value, depends on 0.1 + 8.15
5. **8.5** (Notification Bell) — in-app awareness, parallel with 8.4
6. **8.1** + **8.2** (Changes Tab + Diff View) — in-app review experience
7. **8.3** (Mark as Reviewed) — completes the review workflow
8. **8.10** (Effective Dates) — enhances change cards and diff view
9. **8.17** (Expand Ingestion) — starts Phase 3 baseline
10. **8.18** (Adapter Pattern) — parallel with 8.17
11. **8.19** (Sync Cron) — completes Phase 3

---

## Schema Changes Required

### NotificationType Enum Expansion

```prisma
enum NotificationType {
  // Existing
  TASK_ASSIGNED
  TASK_DUE_SOON
  TASK_OVERDUE
  COMMENT_ADDED
  MENTION
  STATUS_CHANGED
  WEEKLY_DIGEST

  // New — Legal change events (Phase 1)
  AMENDMENT_DETECTED
  RULING_CITED
  LAW_REPEALED
  AMENDMENT_REMINDER

  // New — Collaboration events (Phase 4)
  RESPONSIBLE_ASSIGNED
  COMPLIANCE_CHANGED

  // New — Admin events (Phase 4)
  WORKSPACE_INVITATION
  MEMBER_JOINED
}
```

### NotificationPreference Model Expansion

```prisma
// New legal event toggles (default true — compliance-critical)
amendment_detected_enabled   Boolean @default(true)
ruling_cited_enabled         Boolean @default(true)
law_repealed_enabled         Boolean @default(true)
amendment_reminder_enabled   Boolean @default(true)

// New collaboration toggles (Phase 4)
responsible_assigned_enabled Boolean @default(true)
compliance_changed_enabled   Boolean @default(true)
```

### Vercel Cron Additions

```json
{
  "path": "/api/cron/notify-amendment-changes",
  "schedule": "0 7 * * *"
},
{
  "path": "/api/cron/sync-agency-regulations",
  "schedule": "0 6 * * 1"
},
{
  "path": "/api/cron/check-task-deadlines",
  "schedule": "30 7 * * *"
},
{
  "path": "/api/cron/send-weekly-digest",
  "schedule": "0 17 * * 0"
}
```

---

## Notification Framework

The system has 4 layers:

1. **Detection** — What happened? (cron jobs detect legal changes; server actions detect user actions)
2. **Routing** — Who cares? (recipient resolution via law lists, task assignment, responsible person)
3. **Delivery** — How to tell them? (in-app bell, transactional email, scheduled digest)
4. **Response** — What do they do about it? (acknowledge amendment, complete task, review change)

### Complete Event Map

#### Legal Change Events (external, cron-detected)

| Event | Trigger Source | Recipients | Channel Default |
|-------|---------------|------------|-----------------|
| SFS amendment detected | `sync-sfs-updates` → ChangeEvent | Workspace members tracking the base law | Daily digest email + in-app |
| Agency regulation changed | `sync-agency-regulations` → ChangeEvent | Workspace members tracking that regulation | Daily digest email + in-app |
| Court ruling cites tracked law | `sync-court-cases` → CrossReference | Workspace members tracking the cited law | Daily digest email + in-app |
| Law repealed | ChangeEvent (REPEAL) | Workspace members tracking that law | Daily digest email + in-app (urgent flag) |
| Amendment unacknowledged (reminder) | Cron checks `last_change_acknowledged_at` | Responsible person / assignee on LawListItem | Email (Day 3 nudge, Day 7 escalate) |

#### Workspace Collaboration Events (internal, user-triggered — Phase 4)

**Tier 1 — Email + in-app (default ON):**

| Event | Trigger | Recipients |
|-------|---------|------------|
| Task assigned to you | `updateTaskAssignee()` | The assignee |
| @mentioned in comment | `createComment()` with mentions[] | Mentioned users |
| Task overdue | Deadline cron | Assignee + task creator |
| Task due soon (3 days) | Deadline cron | Assignee |
| Responsible person assigned | LawListItem.responsible_user_id changed | The assigned person |
| Workspace invitation | WorkspaceInvitation created | Invitee (email only) |

**Tier 2 — In-app only (default ON, email opt-in):**

| Event | Trigger | Recipients |
|-------|---------|------------|
| Comment on your task | createComment() | Task creator + assignee (not the commenter) |
| Task status changed | updateTaskStatus() | Creator + assignee (not the mover) |
| Compliance status changed | LawListItem compliance_status update | Responsible person + workspace admins |
| Member joined workspace | Invitation accepted | Workspace admins + owner |

**Tier 3 — Digest only (scheduled, aggregated):**

| Event | Content | Channel | Timing |
|-------|---------|---------|--------|
| Daily digest | SFS amendments + agency changes + court rulings + unacknowledged count | Email | 07:00 UTC daily |
| Weekly editorial | AI-generated legal landscape recap, workspace-specific changes | Email | Sunday 18:00 CET |

---

## Risk Mitigation

- **Notification volume:** Users could be overwhelmed. Mitigated by tiered defaults (Tier 1 = email, Tier 2 = in-app only) and preferences UI (Story 8.11).
- **LLM cost in daily digest:** Sonnet calls for summering/kommentar generation. Mitigated by storing results on LegalDocument for reuse, and falling back to section change list if LLM fails.
- **Cron timing:** Daily digest (07:00) must run after sync-sfs-updates (04:30) and sync-court-cases (05:00). Sufficient buffer (2+ hours) exists. Agency sync (06:00 Monday) runs before daily digest.
- **Email deliverability:** Transactional emails need to not hit spam. Mitigated by using Resend with proper SPF/DKIM/DMARC (already configured for admin emails).
- **Agency website instability:** Agency websites may change structure, break scrapers, or go down. Mitigated by per-adapter error handling, content hash comparison (don't false-positive on HTML changes), and admin alerts on failures.
- **Agency regulation change frequency:** Much lower than SFS. Weekly cron (Monday 06:00) is sufficient. Can increase frequency if needed.

## Compatibility Requirements

- [x] All notification features are additive — no changes to existing user-facing functionality
- [x] `Notification` and `NotificationPreference` models already exist in schema — enum expansion is backwards-compatible
- [x] Existing server actions (tasks, comments) gain notification calls but behavior is unchanged
- [x] Email notifications use existing Resend infrastructure
- [x] Content generation reuses proven Story 12.3 pipeline
- [x] Cron jobs follow established patterns (maxDuration, timeout buffer, auth check, stats JSON)
- [x] Agency regulation changes flow through same ChangeEvent → Notification pipeline as SFS

## Supersedes / Deprecates

- **Story 8.8** (AI Change Summaries) — fully superseded by Story 12.3 content generation pipeline
- **`generate-summaries` cron job** — uses OpenAI `gpt-4o-mini` for `ChangeEvent.ai_summary`. Should be deprecated once Story 8.4 is implemented

## Definition of Done

**Phase 1 (SFS Backend):**
- [ ] SFS amendment → email notification to affected workspace members
- [ ] SFS amendment → in-app notification via bell
- [ ] TemplateItem.last_amendment auto-syncs when base document amended

**Phase 2 (SFS UX):**
- [ ] Changes tab shows unacknowledged amendments with AI summaries
- [ ] Diff view shows section-level changes with highlighting
- [ ] Mark as reviewed workflow completes the loop
- [ ] Effective date badges on change cards

**Phase 3 (Agency Regulations):**
- [ ] All template-referenced agency documents have full content
- [ ] Agency adapters detect changes to regulations
- [ ] Agency changes flow through same notification pipeline as SFS
- [ ] Users tracking agency regulations get same notifications as SFS users

**Phase 4 (Collaboration):**
- [ ] Collaboration events (task assigned, mentions) trigger notifications
- [ ] Task deadlines trigger due soon / overdue notifications
- [ ] Users can control notification preferences per type and channel

## Change Log

| Date       | Version | Description | Author |
|------------|---------|-------------|--------|
| 2025-11-12 | 1.0     | Initial epic (stories 8.1-8.12 drafted) | Sarah (PO) |
| 2026-02-09 | 2.0     | Major rewrite: align with actual data model, add notification framework, add Stories 8.13/8.14, supersede 8.8, restructure phases | Sarah (PO) |
| 2026-02-17 | 3.0     | Strategic restructure: phased SFS-first/agency-second approach. Added Stories 8.15 (notification service), 8.16 (template sync), 8.17-8.19 (agency regulation monitoring). Moved collaboration stories to Phase 4. Aligned with template launch readiness. | Sarah (PO) |
| 2026-02-17 | 3.1     | Added Story 0.1 (Email Infrastructure Foundation) as prerequisite. Added complete story inventory table with file locations and status. Clarified 8.13/8.14 are deferred (no story files until Phase 4 prioritized). Updated sequencing to start with 0.1. | Sarah (PO) |
