# Next Steps

**Last Updated:** 2026-04-07

> **Note:** This document replaces the original pre-development handoff prompts (UX Expert / Architect) which were completed in November 2025. The project is now in active development with 11 of 17 epics complete.

---

## Current Priority: Remaining Partial Epics

### Epic 5: Workspace Management — Billing & Monetization

**Status:** 50% complete (5/~12 stories). Core multi-tenancy, roles, and settings are done.

**Remaining (blocks paid launch):**
- Stripe subscription billing integration
- Usage limits per tier
- Team invite system (depends on Epic 10's WorkspaceInvitation model)
- Add-on purchase system
- Unit economics tracking (NFR18)

### Epic 17: Document Management System — Advanced Features

**Status:** 69% complete (9/13 stories). Core DMS operational (editor, versioning, templates, export).

**Remaining:**
- Advanced document features (scope TBD — review story files)

### Epic 3: RAG Chat — Context Building UX

**Status:** 75% complete (5/9 stories). Chat UI and streaming work. Agent tools handle context programmatically.

**Remaining:**
- Drag-and-drop for law cards, employee cards, task cards, file import into chat
- Note: Epic 14's agentic approach may reduce the priority of visual drag-and-drop

---

## Not Started Epics — Decision Needed

### Epic 7: HR Module (Employee Management)

**12 stories in backlog.** Employee CRUD, CSV import, compliance status, kollektivavtal.

**Decision:** Is this MVP or Phase 2? Not blocking other epics. Adds significant value for HR-focused compliance but is a large scope commitment.

### Epic 13: ELI Structured Data & Legislation Interoperability

**No stories scoped.** Enhanced JSON-LD, ELI URIs, legislation feeds for SEO.

**Decision:** Post-launch enhancement. Low priority but unique differentiator (first Swedish ELI source).

---

## Recommended Sequence

1. **Epic 5 (Billing)** — unblocks paid launch
2. **Epic 17 (remaining)** — complete DMS feature set
3. **Epic 7 or Phase 2** — based on user feedback post-launch
4. **Epic 13** — SEO enhancement, schedule when convenient

---
