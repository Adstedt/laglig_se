# Epic 8: Amendment Monitoring & Change Notifications (DETAILED)

**Status:** See `docs/epics/epic-8-notifications.md` (v3) for the authoritative epic document.

**This file is superseded.** The v3 rewrite (2026-02-17) restructured the epic into a phased SFS-first, agency-second strategy. The detailed story files in `docs/stories/8.*.md` remain the source of truth for individual story acceptance criteria.

**Redirect:** `docs/epics/epic-8-notifications.md`

---

## Quick Reference: Story Index

### Prerequisite
- **0.1** Email Infrastructure Foundation — `docs/stories/0.1.email-infrastructure-foundation.md` (Approved)

### Phase 1: SFS — Complete the Notification Loop
- **8.15** Notification Service & Recipient Resolution — `docs/stories/8.15.notification-service-recipient-resolution.md`
- **8.16** Template & LawList Change Propagation — `docs/stories/8.16.template-lawlist-change-propagation.md`
- **8.4** Daily Amendment Email Digest — `docs/stories/8.4.email-notifications-law-changes.md`
- **8.5** In-App Notification Bell — `docs/stories/8.5.in-app-notification-bell.md`

### Phase 2: SFS — Change Review UX
- **8.1** Changes Tab — `docs/stories/8.1.change-detection-ui-changes-tab.md`
- **8.2** GitHub-Style Diff View — `docs/stories/8.2.github-style-diff-view.md`
- **8.3** Mark as Reviewed — `docs/stories/8.3.mark-as-reviewed-workflow.md`
- **8.10** Effective Date Tracking — `docs/stories/8.10.effective-date-tracking.md`

### Phase 3: Agency Regulations — Build the Pipeline
- **8.17** Expand Agency Document Ingestion — `docs/stories/8.17.expand-agency-document-ingestion.md`
- **8.18** Agency Website Adapter Pattern & Change Detection — `docs/stories/8.18.agency-adapter-pattern-change-detection.md`
- **8.19** Agency Regulation Sync Cron — `docs/stories/8.19.agency-regulation-sync-cron.md`

### Phase 4: Collaboration & Polish
- **8.13** Collaboration Notification Triggers — needs story file
- **8.14** Task Deadline Cron — needs story file
- **8.6** Amendment Reminders — `docs/stories/8.6.reminder-emails-unacknowledged-changes.md`
- **8.7** Weekly Digest — `docs/stories/8.7.weekly-industry-digest-email.md`
- **8.11** Notification Preferences UI — `docs/stories/8.11.change-notification-preferences.md`
- **8.9** Amendment Timeline — `docs/stories/8.9.amendment-timeline-visualization.md`

### Superseded
- ~~**8.8**~~ AI Change Summaries — superseded by Story 12.3
- ~~**8.12**~~ Performance Optimization — deferred, operational
