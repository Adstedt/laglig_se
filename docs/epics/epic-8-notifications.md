# Epic 8: Notifications & Change Tracking

## Epic Overview

**Epic ID:** Epic 8
**Status:** Draft (v2 — rewritten 2026-02-09 to align with actual data model and product architecture)
**Priority:** High (core compliance value prop)
**Business Owner:** Sarah (PO)
**Technical Lead:** Development Team

## Epic Goal

Provide a comprehensive notification system that keeps workspace members informed about legal changes affecting their tracked laws, collaboration activity within their workspace, and compliance deadlines — across in-app, email, and digest channels.

## Epic Description

### Why This Matters

Laglig.se helps organizations stay legally compliant. The notification system is the **primary mechanism** for closing the loop between "a law changed" and "our users know about it and have taken action." Without notifications, compliance tracking is passive — users have to remember to check. With notifications, it becomes proactive.

### Existing System Context

**Data models already in place:**
- `ChangeEvent` — records all legal document changes (AMENDMENT, NEW_LAW, REPEAL, NEW_RULING, METADATA_UPDATE) with `notification_sent` boolean flag
- `Notification` — in-app notification records with `type`, `title`, `body`, `entity_type`/`entity_id`, `read_at`
- `NotificationPreference` — per-user-per-workspace preference toggles for email/push and per-type controls
- `ActivityLog` — comprehensive change tracking for all task/comment/list item mutations (already populated by server actions)
- `LawListItem` — has `last_change_acknowledged_at`, `last_change_acknowledged_by`, `responsible_user_id`, `assigned_to`, `due_date`
- `Comment` — supports `mentions[]` array for @mention tracking
- `Task` — has `assignee_id`, `due_date`, `priority`, column-based status
- `CrossReference` — links court rulings to cited SFS laws (`CITES` type)
- `AmendmentDocument` / `SectionChange` — parsed amendment data with full content
- `WorkspaceInvitation` — invitation lifecycle (PENDING → ACCEPTED/EXPIRED/REVOKED)

**Infrastructure already in place:**
- Resend email service (`lib/email/cron-notifications.ts`) — admin cron notification emails
- Story 12.3 content generation pipeline (`lib/ai/prompts/document-content.ts`) — summering/kommentar prompts
- `sync-sfs-updates` cron (04:30 UTC) — detects amendments, creates ChangeEvent + AmendmentDocument + LegalDocument
- `sync-court-cases` cron (05:00 UTC) — syncs court cases, creates CrossReference links to cited laws

**What does NOT exist yet:**
- No code creates `Notification` records for user events (the model is a stub)
- No user-facing email notifications (only admin cron emails)
- No in-app notification UI (bell, dropdown, badge)
- No collaboration event triggers (task assigned, mentioned, comment)
- No task deadline cron (due soon, overdue detection)
- No amendment acknowledgment reminders
- No preference UI for users to control their notifications

### Notification Framework

The system has 4 layers:

1. **Detection** — What happened? (cron jobs detect legal changes; server actions detect user actions)
2. **Routing** — Who cares? (recipient resolution via law lists, task assignment, responsible person)
3. **Delivery** — How to tell them? (in-app bell, transactional email, scheduled digest)
4. **Response** — What do they do about it? (acknowledge amendment, complete task, review change)

### Complete Event Map

#### Legal Change Events (external, cron-detected)

| Event | Trigger Source | Recipients | Channel Default |
|-------|---------------|------------|-----------------|
| Amendment detected | `sync-sfs-updates` → ChangeEvent | Workspace members tracking the base law | Daily digest email + in-app |
| Court ruling cites tracked law | `sync-court-cases` → CrossReference | Workspace members tracking the cited law | Daily digest email + in-app |
| Law repealed | ChangeEvent (REPEAL) | Workspace members tracking that law | Daily digest email + in-app (urgent flag) |
| Amendment unacknowledged (reminder) | Cron checks `last_change_acknowledged_at` | Responsible person / assignee on LawListItem | Email (Day 3 nudge, Day 7 escalate) |

#### Workspace Collaboration Events (internal, user-triggered)

**Tier 1 — Email + in-app (default ON):**
Direct, personal, actionable — the user specifically needs to do something.

| Event | Trigger | Recipients |
|-------|---------|------------|
| Task assigned to you | `updateTaskAssignee()` | The assignee |
| @mentioned in comment | `createComment()` with mentions[] | Mentioned users |
| Task overdue | Deadline cron | Assignee + task creator |
| Task due soon (3 days) | Deadline cron | Assignee |
| Responsible person assigned | LawListItem.responsible_user_id changed | The assigned person |
| Workspace invitation | WorkspaceInvitation created | Invitee (email only) |

**Tier 2 — In-app only (default ON, email opt-in):**
Contextual, good to know, but not directly targeting you.

| Event | Trigger | Recipients |
|-------|---------|------------|
| Comment on your task | createComment() | Task creator + assignee (not the commenter) |
| Task status changed | updateTaskStatus() | Creator + assignee (not the mover) |
| Compliance status changed | LawListItem compliance_status update | Responsible person + workspace admins |
| Evidence/file attached | File linked to task or list item | Assignee / responsible person |
| Member joined workspace | Invitation accepted | Workspace admins + owner |
| Role changed | Admin changes member role | The affected member |

**Tier 3 — Digest only (scheduled, aggregated):**

| Event | Content | Channel | Timing |
|-------|---------|---------|--------|
| Daily digest | Amendments + court rulings + unacknowledged items count | Email | 07:00 UTC daily |
| Weekly editorial | AI-generated legal landscape recap, customer-specific changes, compliance snapshot | Email | Sunday 18:00 CET |

### NotificationType Enum (proposed expansion)

Current enum covers only task/comment types. Needs these additions:

```
// Existing
TASK_ASSIGNED, TASK_DUE_SOON, TASK_OVERDUE,
COMMENT_ADDED, MENTION, STATUS_CHANGED, WEEKLY_DIGEST

// New — Legal change events
AMENDMENT_DETECTED        // Law you track was amended
RULING_CITED              // Court ruling cites law you track
LAW_REPEALED              // Law you track was repealed
AMENDMENT_REMINDER        // Unacknowledged amendment reminder (Day 3, Day 7)

// New — Collaboration events
RESPONSIBLE_ASSIGNED      // You were assigned responsibility for a law item
COMPLIANCE_CHANGED        // Compliance status changed on an item you own

// New — Admin events
WORKSPACE_INVITATION      // You were invited to a workspace
MEMBER_JOINED             // Someone joined your workspace
```

### NotificationPreference Model (proposed expansion)

Add per-type toggles for new notification types:
- `amendment_detected_enabled` (default: true)
- `ruling_cited_enabled` (default: true)
- `law_repealed_enabled` (default: true)
- `amendment_reminder_enabled` (default: true)
- `responsible_assigned_enabled` (default: true)
- `compliance_changed_enabled` (default: true)

---

## Stories

### Phase 1: In-App Change Tracking UI

These stories provide the in-app experience for viewing and acting on legal changes. They are prerequisites for the acknowledgment workflow that drives reminders.

#### Story 8.1: Changes Tab — Amendment Change List UI

**As a** workspace member,
**I want** to see a list of recent legal changes affecting laws in my lists,
**so that** I can review what changed and take action.

- Changes tab in workspace showing unacknowledged amendments and court rulings
- Filter by law, change type, date range, priority
- Links to diff view and amendment detail page
- Shows summering/kommentar from Story 12.3 content
- **Status:** Draft — needs data model alignment rewrite

#### Story 8.2: GitHub-Style Diff View

**As a** workspace member reviewing a legal change,
**I want** to see a side-by-side diff of what changed in a law,
**so that** I can understand the exact impact.

- Side-by-side diff of old vs new section text
- Syntax highlighting for additions/deletions
- Section-level navigation within the diff
- **Status:** Draft — needs data model alignment rewrite

#### Story 8.3: Mark as Reviewed / Acknowledge Workflow

**As a** workspace member,
**I want** to mark a legal change as reviewed (acknowledged),
**so that** my team knows it's been handled and I stop getting reminders.

- "Mark as reviewed" button on change detail / diff view
- Sets `LawListItem.last_change_acknowledged_at` + `last_change_acknowledged_by`
- Bulk acknowledge for multiple changes
- Acknowledgment status visible in changes tab
- **Prerequisite for:** Story 8.6 (reminders)
- **Status:** Draft — needs data model alignment rewrite

---

### Phase 2: Notification Service & Delivery

These stories build the notification infrastructure — the service that creates notifications and the channels that deliver them.

#### Story 8.4: Daily Amendment & Ruling Email Digest

**As a** workspace member with laws in my law list,
**I want** to receive a daily email digest when amendments or relevant court rulings affect laws I track,
**so that** I'm alerted to compliance-relevant changes even when not using the app.

- Cron at `/api/cron/notify-amendment-changes` runs 07:00 UTC daily
- Finds un-notified amendments via `ChangeEvent.notification_sent = false`
- Finds court rulings citing tracked laws via `CrossReference` + `LawListItem`
- Generates summering + kommentar using Story 12.3 prompts (Sonnet inline) if missing
- Groups by workspace, sends one email per workspace
- Marks `ChangeEvent.notification_sent = true` after delivery
- Respects `NotificationPreference.email_enabled`
- **Status:** Draft (v2) — rewritten, ready to implement
- **Detailed story:** `docs/stories/8.4.email-notifications-law-changes.md`

#### Story 8.5: In-App Notification Bell & Notification Service

**As a** workspace member,
**I want** to see a notification bell with unread count in the app header,
**so that** I'm aware of changes and activity without checking email.

- Notification bell icon in workspace header with unread badge count
- Dropdown showing recent notifications (last 20) grouped by type
- Click notification → navigate to relevant entity (amendment, task, comment)
- Mark as read (individual + mark all read)
- Notification creation service: shared function `createNotification()` called by server actions and cron jobs
- Creates `Notification` records for all Tier 1 + Tier 2 events
- Polling every 60s for new notifications (or SSE in future)
- **Status:** Draft — needs full rewrite

#### Story 8.13: Collaboration Notification Triggers (NEW)

**As a** workspace member,
**I want** to receive notifications when teammates assign me tasks, mention me, or update items I'm responsible for,
**so that** I can respond promptly to collaboration activity.

- Add `createNotification()` calls to existing server actions:
  - `updateTaskAssignee()` → TASK_ASSIGNED notification
  - `createComment()` with mentions → MENTION notification for each mentioned user
  - `createComment()` → COMMENT_ADDED notification for task creator/assignee
  - `updateTaskStatus()` → STATUS_CHANGED notification for creator/assignee
  - LawListItem responsible person change → RESPONSIBLE_ASSIGNED notification
  - LawListItem compliance status change → COMPLIANCE_CHANGED notification
- Tier 1 events also trigger transactional email (via Resend)
- Tier 2 events create in-app notification only (email opt-in via preferences)
- Deduplicate: don't notify the user who performed the action
- **Status:** New story
- **Depends on:** Story 8.5 (notification service + bell)

#### Story 8.14: Task Deadline Cron — Due Soon & Overdue (NEW)

**As a** workspace member with tasks assigned to me,
**I want** to be notified when tasks are approaching their due date or overdue,
**so that** I can prioritize time-sensitive compliance work.

- New cron at `/api/cron/check-task-deadlines` runs daily at 07:30 UTC
- Queries tasks where `due_date` is within 3 days → TASK_DUE_SOON notification + email to assignee
- Queries tasks where `due_date` is past and `completed_at` is null → TASK_OVERDUE notification + email to assignee + creator
- Avoids duplicate notifications (check if notification already exists for this task + type + date)
- `maxDuration = 60` (lightweight cron)
- **Status:** New story

---

### Phase 3: Reminders & Digests

These stories add scheduled notification patterns beyond the daily digest.

#### Story 8.6: Amendment Acknowledgment Reminders

**As a** compliance manager,
**I want** unacknowledged amendments to trigger escalating reminders,
**so that** no legal change goes unreviewed.

- Cron checks `LawListItem.last_change_acknowledged_at` vs `ChangeEvent.detected_at`
- Day 3: Friendly nudge email to the responsible person
- Day 7: Urgent escalation email to responsible person + workspace admins
- Respects `NotificationPreference.amendment_reminder_enabled`
- Creates in-app notification for each reminder
- **Depends on:** Story 8.3 (acknowledge workflow must exist first)
- **Status:** Draft — needs data model alignment rewrite

#### Story 8.7: Weekly AI Editorial Digest

**As a** workspace member,
**I want** to receive a weekly email summarizing the legal landscape relevant to my organization,
**so that** I stay informed even during quiet weeks.

- Cron runs Sunday 18:00 CET
- AI-generated editorial (Claude Sonnet) contextual to the workspace's tracked laws and industry:
  - "This week in your legal landscape" overview
  - Workspace-specific: amendments this week, court rulings citing your laws
  - Unacknowledged items count + who owns them
  - Compliance status snapshot (X% compliant across your lists)
  - Written in kommentar voice ("Vi behöver...", "Vi ska...")
- Only sent if workspace has active members with `weekly_digest_enabled = true`
- **Status:** Draft — needs full rewrite (v1 mixed in AI recommendations / discovery features that belong elsewhere)

---

### Phase 4: User Preferences

#### Story 8.11: Notification Preferences UI

**As a** workspace member,
**I want** to control which notifications I receive and through which channels,
**so that** I'm informed without being overwhelmed.

- Settings page at workspace notification preferences route
- Per-type toggles for all notification types:
  - Legal: amendment detected, ruling cited, law repealed, amendment reminders
  - Collaboration: task assigned, mentioned, comment added, status changed, due soon, overdue
  - Workspace: responsible assigned, compliance changed, member joined
  - Digest: daily digest, weekly digest
- Channel controls:
  - Email master toggle (kill switch)
  - Per-type email opt-in/opt-out (Tier 1 events default ON, Tier 2 default OFF)
  - In-app always on (no toggle — you need to see workspace activity)
- Warning modal for critical toggles (disabling amendment notifications, daily digest, reminders)
- **Status:** Draft — needs rewrite to cover expanded notification types

---

### Supporting Stories (In-App UI, not notification delivery)

These stories enhance the in-app experience for viewing and acting on legal changes. They support the notification ecosystem but are not about notification delivery.

#### Story 8.9: Amendment Timeline Visualization

- Historical timeline of all amendments to a law
- Visual markers for acknowledged vs unacknowledged
- Comment support on timeline entries
- **Status:** Draft — needs data model alignment

#### Story 8.10: Effective Date Tracking & Extraction

- Extract effective dates from amendment transition provisions
- Display countdown/badges for upcoming effective dates
- Calendar view of upcoming changes
- **Status:** Draft — needs data model alignment

#### Story 8.12: Change Detection Performance Optimization

- Parallel processing for change detection cron
- Incremental hashing to skip unchanged laws
- Rate limiting for external API calls
- **Status:** Draft — operational concern, not user-facing

---

### Superseded Stories

#### ~~Story 8.8: AI Change Summaries~~

**Superseded by Story 12.3** (Content Generation Pipeline). The summering/kommentar pipeline from Story 12.3 replaces the OpenAI-based approach entirely:
- "Summering" = neutral 2-3 sentence summary (replaces "AI summary")
- "Kommentar" = compliance-focused "Vi ska..." voice (replaces "business impact")
- Uses Anthropic Claude (not OpenAI)
- Includes hallucination checking via `validateLlmOutput`

The `generate-summaries` cron job (currently using OpenAI `gpt-4o-mini` for `ChangeEvent.ai_summary`) should be deprecated in favor of Story 12.3's `buildSystemPrompt()` + `buildDocumentContext()` generating `LegalDocument.summary` + `LegalDocument.kommentar`.

---

## Story Sequencing

```
Phase 1: In-App Change Tracking
  Story 8.1 (Changes Tab)
  Story 8.2 (Diff View)           ← Can be parallel with 8.1
  Story 8.3 (Acknowledge)         ← Depends on 8.1 (needs changes tab to place the button)

Phase 2: Notification Infrastructure
  Story 8.5 (Bell + Service)      ← Foundation: createNotification(), Notification UI
  Story 8.4 (Daily Digest Email)  ← Independent of 8.5, can be parallel
  Story 8.13 (Collab Triggers)    ← Depends on 8.5 (uses createNotification())
  Story 8.14 (Deadline Cron)      ← Depends on 8.5 (uses createNotification())

Phase 3: Reminders & Digests
  Story 8.6 (Amendment Reminders) ← Depends on 8.3 (acknowledge workflow) + 8.5 (notification service)
  Story 8.7 (Weekly Editorial)    ← Depends on 8.4 (shares recipient resolution + email infra)

Phase 4: User Control
  Story 8.11 (Preferences UI)     ← Depends on 8.5 (notification types must exist to configure)
                                     Can be developed alongside Phase 2-3 stories

Supporting (can be developed anytime):
  Story 8.9 (Timeline)            ← Independent
  Story 8.10 (Effective Dates)    ← Independent
  Story 8.12 (Performance)        ← Independent, operational
```

**Recommended implementation order:**
1. 8.5 (Bell + Service) — establishes `createNotification()` used by everything else
2. 8.4 (Daily Digest) — highest user value, can start in parallel with 8.5
3. 8.13 (Collab Triggers) — wires up all server actions to create notifications
4. 8.14 (Deadline Cron) — task due/overdue detection
5. 8.1 + 8.3 (Changes Tab + Acknowledge) — in-app change review flow
6. 8.6 (Reminders) — requires acknowledge workflow
7. 8.11 (Preferences) — user control over notification volume
8. 8.7 (Weekly Editorial) — polish, lower priority
9. 8.2, 8.9, 8.10, 8.12 — supporting UI and performance

---

## Schema Changes Required

### NotificationType Enum Expansion

Add to existing enum:
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

  // New — Legal change events
  AMENDMENT_DETECTED
  RULING_CITED
  LAW_REPEALED
  AMENDMENT_REMINDER

  // New — Collaboration events
  RESPONSIBLE_ASSIGNED
  COMPLIANCE_CHANGED

  // New — Admin events
  WORKSPACE_INVITATION
  MEMBER_JOINED
}
```

### NotificationPreference Model Expansion

Add fields for new notification types:
```prisma
// New legal event toggles (default true — compliance-critical)
amendment_detected_enabled   Boolean @default(true)
ruling_cited_enabled         Boolean @default(true)
law_repealed_enabled         Boolean @default(true)
amendment_reminder_enabled   Boolean @default(true)

// New collaboration toggles
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
  "path": "/api/cron/check-task-deadlines",
  "schedule": "30 7 * * *"
},
{
  "path": "/api/cron/send-weekly-digest",
  "schedule": "0 17 * * 0"
}
```

---

## Compatibility Requirements

- [x] All notification features are additive — no changes to existing user-facing functionality
- [x] `Notification` and `NotificationPreference` models already exist in schema — enum expansion is backwards-compatible
- [x] Existing server actions (tasks, comments) gain notification calls but behavior is unchanged
- [x] Email notifications use existing Resend infrastructure
- [x] Content generation reuses proven Story 12.3 pipeline
- [x] Cron jobs follow established patterns (maxDuration, timeout buffer, auth check, stats JSON)

## Risk Mitigation

- **Notification volume:** Users could be overwhelmed. Mitigated by tiered defaults (Tier 1 = email, Tier 2 = in-app only) and preferences UI (Story 8.11).
- **LLM cost in daily digest:** Sonnet calls for summering/kommentar generation. Mitigated by storing results on LegalDocument for reuse, and falling back to section change list if LLM fails.
- **Cron timing:** Daily digest (07:00) must run after sync-sfs-updates (04:30) and sync-court-cases (05:00). Sufficient buffer (2+ hours) exists.
- **Email deliverability:** Transactional emails (task assigned, mentions) need to not hit spam. Mitigated by using Resend with proper SPF/DKIM/DMARC (already configured for admin emails).
- **Amendment reminder escalation:** Day 7 emails to workspace admins could be noisy if many items are unacknowledged. Consider batching into a single "X items unreviewed" summary rather than individual emails.

## Supersedes / Deprecates

- **Story 8.8** (AI Change Summaries) — fully superseded by Story 12.3 content generation pipeline
- **`generate-summaries` cron job** — uses OpenAI `gpt-4o-mini` for `ChangeEvent.ai_summary`. Should be deprecated once Story 8.4 is implemented (summering/kommentar on LegalDocument replaces ai_summary on ChangeEvent)

## Definition of Done

- [ ] Users receive daily email digests for amendments + court rulings affecting their tracked laws
- [ ] In-app notification bell shows unread count and recent notifications
- [ ] Task assignment, mentions, and comments trigger appropriate notifications
- [ ] Task due soon and overdue are detected and notified
- [ ] Unacknowledged amendments trigger escalating reminders (Day 3, Day 7)
- [ ] Weekly AI editorial digest summarizes the legal landscape per workspace
- [ ] Users can control notification preferences per type and channel
- [ ] All notifications respect user preferences
- [ ] No regression in existing functionality
- [ ] Notification system handles failures gracefully (email failures don't block processing)

## Change Log

| Date       | Version | Description | Author |
|------------|---------|-------------|--------|
| 2025-11-12 | 1.0     | Initial epic (stories 8.1-8.12 drafted) | Sarah (PO) |
| 2026-02-09 | 2.0     | Major rewrite: align with actual data model, add notification framework, add Stories 8.13/8.14, supersede 8.8, restructure phases | Sarah (PO) |
