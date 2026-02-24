# Epic 8: Execution Order

Quick reference for working through Epic 8 stories in the correct order.
Check off each story as it's completed. Dependencies are noted — don't skip ahead.

---

## Prerequisite

- [ ] **1. Story 0.1 — Email Infrastructure Foundation**
  `docs/stories/0.1.email-infrastructure-foundation.md` | Status: Approved
  React Email setup, shared EmailService, unsubscribe endpoint, preference helpers.
  *Blocks: 8.4 (email digest)*

---

## Phase 1: SFS — Complete the Notification Loop

- [ ] **2. Story 8.15 — Notification Service & Recipient Resolution**
  `docs/stories/8.15.notification-service-recipient-resolution.md`
  Schema migration (new NotificationTypes), `createChangeNotifications()`, recipient resolution.
  *Blocks: 8.4, 8.5, and all Phase 4 stories*

- [ ] **3. Story 8.16 — Template & LawList Change Propagation**
  `docs/stories/8.16.template-lawlist-change-propagation.md`
  Auto-sync `TemplateItem.last_amendment` when base document is amended.
  *No blockers — can run parallel with 8.15*

- [ ] **4. Story 8.4 — Daily Amendment Email Digest**
  `docs/stories/8.4.email-notifications-law-changes.md`
  Daily cron sending amendment digest emails to affected workspace members.
  *Depends on: 0.1 + 8.15*

- [ ] **5. Story 8.5 — In-App Notification Bell**
  `docs/stories/8.5.in-app-notification-bell.md`
  Bell icon, unread count, dropdown with recent notifications.
  *Depends on: 8.15 | Can run parallel with 8.4*

---

## Phase 2: SFS — Change Review UX

- [ ] **6. Story 8.1 — Changes Tab**
  `docs/stories/8.1.change-detection-ui-changes-tab.md`
  "Changes" tab on law list page showing unacknowledged amendments.

- [ ] **7. Story 8.2 — GitHub-Style Diff View**
  `docs/stories/8.2.github-style-diff-view.md`
  Section-level diffs with red/green highlighting and AI summaries.
  *Can run parallel with 8.1*

- [ ] **8. Story 8.3 — Mark as Reviewed Workflow**
  `docs/stories/8.3.mark-as-reviewed-workflow.md`
  Acknowledge button, bulk acknowledge, activity logging.
  *Depends on: 8.1*

- [ ] **9. Story 8.10 — Effective Date Tracking**
  `docs/stories/8.10.effective-date-tracking.md`
  Effective date badges and countdown on change cards and diff view.
  *Enhances 8.1 + 8.2 — can be parallel or after*

---

## Phase 3: Agency Regulations — Build the Pipeline

- [ ] **10. Story 8.17 — Expand Agency Document Ingestion**
  `docs/stories/8.17.expand-agency-document-ingestion.md`
  Ingest full content for all agency regulation stubs. Content hashes for change detection.

- [ ] **11. Story 8.18 — Agency Adapter Pattern & Change Detection**
  `docs/stories/8.18.agency-adapter-pattern-change-detection.md`
  Per-agency adapters (AFS, NFS, MSBFS) that check websites for changes.
  *Can start parallel with 8.17 (interface design)*

- [ ] **12. Story 8.19 — Agency Regulation Sync Cron**
  `docs/stories/8.19.agency-regulation-sync-cron.md`
  Weekly cron running adapters, processing changes into the Phase 1 notification pipeline.
  *Depends on: 8.17 + 8.18*

---

## Phase 4: Collaboration & Polish (deferred)

Stories below are not needed for amendment monitoring. Work on these when Phase 4 is prioritized.

- [ ] 8.13 — Collaboration Notification Triggers *(no story file yet)*
- [ ] 8.14 — Task Deadline Cron *(no story file yet)*
- [ ] 8.6 — Amendment Acknowledgment Reminders
- [ ] 8.7 — Weekly AI Editorial Digest
- [ ] 8.11 — Notification Preferences UI
- [ ] 8.9 — Amendment Timeline Visualization
- [ ] 8.12 — Change Detection Performance Optimization
