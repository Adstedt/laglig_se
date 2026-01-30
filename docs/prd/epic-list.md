# Epic List

## Epic 1: Foundation & Core Infrastructure

**Goal:** Establish project foundation while delivering initial 100 public law pages to validate SEO strategy.

**Delivers:** Next.js app, database, auth, CI/CD, 100 law pages, monitoring, security

**Requirements covered:** NFR1, FR29, NFR6, NFR13, NFR22, NFR23

**Estimated stories:** 8-10

---

## Epic 2: Legal Content Foundation

**Goal:** Build comprehensive multi-source legal content database with 170,000+ public SEO-optimized pages covering Swedish laws, court precedent, and EU legislation. Provide category structure, search/discovery features, and begin recording law change history.

**Delivers:** 170,000+ legal content pages (SFS laws, court cases from HD/HovR/HFD/MÖD/MIG, EU regulations/directives), multi-content-type search, cross-document navigation, change history recording (no UI yet)

**Requirements covered:** FR1, FR4, FR8, FR24, FR35, FR36, FR37, NFR1

**Estimated stories:** 11

## **Note:** Expanded from single-source (SFS laws only) to multi-content-type architecture based on competitive analysis. Court cases and EU legislation critical for SEO coverage.

## Epic 3: RAG-Powered AI Chat Interface

**Goal:** Implement zero-hallucination AI chatbot with drag-and-drop context building and citation-first responses.

**Delivers:** Vector database, AI chat UI, drag-and-drop, RAG responses, streaming, citations

**Requirements covered:** FR4, FR5, FR6, NFR2, NFR3, NFR9, NFR20, NFR24

**Estimated stories:** 10-12

---

## Epic 4: Dynamic Onboarding & Personalized Law Lists

**Goal:** Create conversion engine that transforms homepage visitors into trial users through AI-driven conversational onboarding, dynamic questioning, and two-phase comprehensive law list generation (60-80 laws).

**Delivers:** Onboarding widget, Bolagsverket integration, dynamic contextual questioning (3-5 AI-selected questions), two-phase streaming generation (Phase 1: 15-30 laws pre-signup, Phase 2: 45-65 laws post-signup background), trial signup, email verification

**Requirements covered:** FR2, FR3, FR21, FR23, FR30, NFR4, NFR5

**Estimated stories:** 12

---

## Epic 5: Workspace Management & Team Collaboration

**Goal:** Enable multi-user workspaces with subscription tiers, team invites, role-based access, and billing integration.

**Delivers:** Multi-tenancy, roles, invites, tiers, Stripe, usage tracking, workspace settings

**Requirements covered:** FR17, FR18, FR19, FR20, FR22, FR32, FR33, FR34, NFR18

**Estimated stories:** 10-12

---

## Epic 6: Compliance Workspace (Kanban + Dashboard)

**Goal:** Provide Jira-inspired Kanban board for visual compliance tracking and summary dashboard.

**Delivers:** Dashboard, Kanban, drag-and-drop cards, law card modal, task management

**Requirements covered:** FR7, FR27, FR28, FR25

**Estimated stories:** 8-10

---

## Epic 7: HR Module (Employee Management)

**Goal:** Connect employees to laws for context-aware HR compliance, improving AI chatbot value.

**Delivers:** Employee CRUD, CSV import, compliance status, kollektivavtal, drag to chat

**Requirements covered:** FR13, FR14, FR15, FR16, FR41, NFR4

**Estimated stories:** 10-12

---

## Epic 8: Change Monitoring & Notification System

**Goal:** Implement retention engine that automatically detects law changes and notifies users.

**Delivers:** Change detection, AI summaries, email/in-app notifications, diff view, reminders, weekly digest, timeline

**Requirements covered:** FR8, FR9, FR10, FR11, FR12, FR38, FR39, FR40, NFR10, NFR11, NFR26

**Estimated stories:** 10-12

---

## Epic 9: Legal Intelligence & AI Enrichment

**Goal:** Enrich raw legal content with AI-generated contextual analysis using parliamentary documents (propositions, committee reports) to provide genuine legal insight beyond raw text.

**Delivers:** AI-generated legal comments with parliamentary context, proposition summaries, cross-references to preparatory works, "why did this change?" explanations

**Requirements covered:** FR4 (enhanced), NFR9, NFR24

**Estimated stories:** 5-7

---

## Epic 10: Workspace Onboarding & Invitation Flow

**Goal:** Fix broken new-user experience (crash on first login due to missing workspace) by implementing a multi-step workspace creation wizard and invitation acceptance flow, ensuring every authenticated user has a clear path to a functional workspace.

**Delivers:** Post-auth workspace guard with redirect to onboarding, multi-step workspace creation wizard (company info aligned to Bolagsverket data model, review & confirm), WorkspaceInvitation model with token-based acceptance flow for invited users

**Requirements covered:** FR17 (workspace creation), FR18 (team invites - acceptance side), FR20 (onboarding)

**Estimated stories:** 3

**Note:** Brownfield enhancement. Tier selection, Stripe billing, Bolagsverket API lookup, and law list generator step explicitly deferred. All new workspaces start as TRIAL. Wizard architecture supports future step insertion (law list generator). Story 5.3 (Team Invite System) depends on the invitation model created here.

**Priority:** Critical - blocks all new-user access to the platform.

---

**Total Estimated Stories:** 78-96 across 10 epics

**Estimated Timeline:** 18 weeks (4.5 months) - aligns with 4-6 month MVP goal

---
