# Document Completion Status

**Document Version:** 2.1
**Last Updated:** 2026-06-03 (Sarah, PO — full sweep after EPIC-19-AGENT-PARTNER-CHECKLIST refresh: Epic 14 row +3 Done [14.28/14.29/14.30 shipped 2026-05-26 to 2026-05-28]; Epic 17 row +4 effectively done [17.10 + 17.10b in `completed/`; 17.11 + 17.11b Ready for Review post-2026-06-03 ship], +5 backlog [17.16/17.17/17.18 dual-version sub-epic drafted 2026-06-03; 17.9d file-aware citation pill; 17.11c future follow-up]; Epic 19 row added as separate entry — was previously bundled under Epic 14)
**PRD Version:** 1.5

## Epic Summary

| Epic | Name | Stories (Done/Backlog) | Status |
|------|------|----------------------|--------|
| 1 | Foundation & Core Infrastructure | 10 / 0 | Done |
| 2 | Legal Content Foundation | 14 / 12 | Done |
| 3 | RAG-Powered AI Chat Interface | 5 / 4 | Partial — drag-and-drop context building deferred |
| 4 | Dynamic Onboarding & Personalized Law Lists | 11 / 1 | Done |
| 5 | Workspace Management & Team Collaboration | 5 / 1 | Partial — billing, usage limits, team invites not started |
| 6 | Compliance Workspace (Kanban + Dashboard) | 22 / 1 | Done |
| 7 | HR Module (Employee Management) | 0 / 12 | Not Started |
| 8 | Change Monitoring & Notification System | 12 / 6 | Done |
| 9 | Legal Intelligence & AI Enrichment | 4 / 1 | Partial — agency regulation ingestion done, parliamentary context deferred |
| 10 | Workspace Onboarding & Invitation Flow | 3 / 0 | Done |
| 11 | Admin Backoffice | 7 / 0 | Done |
| 12 | Law List Templates & Standard Packages | 12 / 2 | Done |
| 13 | ELI Structured Data & Interoperability | 0 / 0 | Not Started — no stories scoped yet |
| 14 | Compliance Agent | **21** / 1 | Done — 3 sibling additions shipped 2026-05-26 to 2026-05-28 (14.28 `update_requirement`, 14.29 `add_task_comment`, 14.30 `transition_document_status`); 14.31 (staleness retrofit) Approved-not-built |
| 15 | BolagsAPI Integration & Company Enrichment | 3 / 0 | Mostly Done — SNI reference system remaining |
| 16 | Conversion Funnel & First-Value Optimization | 4 / 0 | Done |
| 17 | Document Management System | **13** / **5** | **Active** — core DMS + agent tools shipped (17.10 + 17.10b in `completed/`; 17.11 + 17.11b Ready for Review 2026-06-03). **Dual-Version Document Visibility brownfield sub-epic added 2026-06-03** (3-story epic at `docs/prd/epic-17-addendum-dual-version-visibility.md`: 17.16 PO-Approved + ready for dev; 17.17 + 17.18 Draft). Backlog also includes 17.9d (file-aware citation pill) + 17.11c (agent auto-branch follow-up; spec TBD). |
| 19 | Agent Partner (skills + subagents) — new epic added 2026-04-19 | **10** / 7 | **Active** — foundation + skills tracks fully shipped. 19.1/19.2/19.3/19.4/19.4a/19.5/19.6/19.7a/b/c all in `completed/` (10 stories shipped between 2026-05-24 and 2026-05-27). Remaining: 19.4b (sequence with Epic 21), 19.8 (`draft_styrdokument` type-aware — awaits dual-version foundation), 19.9 + 19.10 (subagents — deferred), 19.11 + 19.12 (continuous governance), 19.13 (grounding eval). Tracked in detail at `docs/stories/EPIC-19-AGENT-PARTNER-CHECKLIST.md`. |
| P | Performance (Caching & Optimization) | 4 / 1 | Mostly Done |

**TOTAL: ~213 stories tracked across 18 epics + performance sprint**
**Completed: ~170 stories (~80%)**
**11 of 18 epics fully complete**

**Recent velocity (2026-05-24 → 2026-06-03):** 17 stories from Draft/Approved → `completed/` or Ready-for-Review in 10 days — 14.28/14.29/14.30 + 19.1/19.2/19.3/19.4/19.4a/19.5 + 19.6/19.7a/b/c + 17.10/17.10b + 17.11/17.11b (RfR). Same-day SM→PO→Dev→QA cycles are now the norm for small brownfield-additive work.

## Not Started Epics

- **Epic 7 (HR Module):** 12 stories in backlog. Employee CRUD, CSV import, compliance status, kollektivavtal. Not blocking other epics. Decision needed: MVP or Phase 2.
- **Epic 13 (ELI Structured Data):** No stories scoped. SEO enhancement for European legislation interoperability. Low priority, post-launch.

## Key Notes

- Epics 9–17 were added as brownfield enhancements during active development (Jan–Apr 2026); **Epic 19 (Agent Partner) added 2026-04-19** as a coordinated cross-epic vision spanning Epic 14 (Compliance Agent), Epic 17 (DMS), and 15+ new stories.
- Several epics exceeded their original story estimates during implementation (Epic 6: 22 vs 8-10 estimated, Epic 14: 21 vs 14 estimated [+3 inline-approval siblings]).
- Epic 3's original RAG approach was largely superseded by Epic 14's agentic tool-use architecture.
- Epic 5 (billing/monetization) remains the primary blocker for paid launch.
- **Epic 17's Dual-Version Document Visibility sub-epic (2026-06-03)** is a brownfield-additive architectural correction surfaced during 17.11b's live smoke — Model A's single-pointer schema was breaking the 17.10b `[Källa:]` citation contract during revision windows. Model B dual-pointer foundation is PO-Approved and ready for dev; UX + agent reads stories drafted but await foundation. Cross-cutting compliance correctness, not new user features per se.

---
