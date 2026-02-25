# Epic 14: Compliance Partner Agent — RAG Pipeline & AI-Guided Assessment

## Epic Overview

**Epic ID:** Epic 14
**Status:** Draft
**Priority:** Critical (core product differentiator — transforms Laglig from a registry into an active compliance partner)
**Business Owner:** Sarah (PO)
**Technical Lead:** Development Team

## Epic Goal

Build an AI compliance partner agent embedded in the webapp that guides users through regulatory changes with deep context about the law, the company, and their compliance history. The agent leverages a RAG pipeline across all knowledge sources (legal documents, company profile, uploaded files, assessment history) to deliver actionable, company-specific compliance guidance.

## Epic Description

### Why This Matters

Today, Laglig detects law changes and shows them to users (Epic 8). But the user experience stops at "here's what changed" — the user is left alone to figure out what it means for *their* company, what to do about it, and how to document their response. This is the core compliance workflow gap.

The Compliance Partner Agent closes that gap. When a user clicks into a change, the agent:
1. **Explains** what changed in the law, at section level, in plain Swedish
2. **Contextualizes** why it matters to *this specific company* (industry, size, activities, certifications)
3. **Recalls** what the company did last time a similar change occurred
4. **Guides** the user through assessment, task creation, and resolution
5. **Learns** from every interaction, building a richer company compliance memory over time

This transforms Laglig from a passive law registry into an active compliance partner — the product's core value proposition.

### Design Principles (Anthropic "Building Effective Agents" Guide)

- **Start simple:** Single agent loop with well-designed tools. No multi-agent orchestrator.
- **Tools over prompts:** The agent interacts with the app through defined tools (search, create task, update status). Tool descriptions get the same rigor as prompts.
- **Transparency:** The agent shows its reasoning. Users see what it searched, what it found, and why it recommends what it does.
- **Human-in-the-loop:** Read-only operations (search, retrieve) run freely. State-changing actions (create task, update compliance status, mark assessed) require user confirmation.
- **Contextual retrieval:** Paragraph-level chunks with contextual headers ensure embeddings capture both content and document position.

### Strategic Phasing

**Phase 1 — Data Foundation:** Standardize document JSON across all content types, build the ContentChunk table with pgvector, and generate embeddings for the full document database. This is the prerequisite for all RAG-powered features.

**Phase 2 — Company Context:** Add WorkspaceProfile for structured company data, build the conversational onboarding flow where the agent interviews the company, and enable knowledge extraction from user-uploaded files (bilagor, bevis, policies).

**Phase 3 — Agent Core:** Define the tool surface area, build the unified RAG retrieval pipeline, and design the agent's system prompt and behavioral guardrails.

**Phase 4 — Agent UX:** Build the agentic change assessment flow (the primary interaction surface), the ChangeAssessment model for company memory, and the general compliance partner chat interface.

### Existing System Context

**What works today:**
- `LegalDocument` with `html_content` (SSOT), `markdown_content`, `json_content`, `full_text` fields — but JSON/MD coverage is incomplete (see Data Gap below)
- `ChangeEvent` model tracks detected amendments with `change_type`, `ai_summary`
- Story 8.1 Changes tab — shows unacknowledged changes with priority sort, URL filters, law list indicators (Done)
- Chat UI (Story 3.3) — basic streaming chat exists but has no RAG, no tools, no company context
- File management (Stories 6.7a, 6.7b) — users can upload files to workspace, stored in Supabase storage
- pgvector extension available in Supabase PostgreSQL (1536-dim `embedding` field already on `LegalDocument`)
- `LawListItem.last_change_acknowledged_at` — field exists for tracking change acknowledgment
- Template system (Epic 12) — curated law list templates with summering + kommentar
- Amendment detection pipeline — `sync-sfs-updates` runs daily, creates ChangeEvents

**What does NOT exist:**
- No structured JSON for 99.6% of SFS laws (only 47/10,803 have `json_content`)
- No paragraph-level chunking or chunk table
- No company profile or context beyond workspace name
- No onboarding interview or conversational data capture
- No text extraction or embedding for user-uploaded files
- No agent tool definitions or RAG retrieval pipeline
- No assessment flow — Story 8.3 was never built (marked "Needs Rewrite" in Epic 8)
- No ChangeAssessment model for storing assessment outcomes
- No compliance status history (only current status on LawListItem)

### Data Gap Analysis

| Content Type | Total | Has HTML | Has JSON | Has MD | RAG-Ready? |
|---|---|---|---|---|---|
| SFS_LAW | 10,803 | 10,797 (99.9%) | 47 (0.4%) | 47 (0.4%) | No |
| SFS_AMENDMENT | 30,794 | 24,932 (81%) | 24,932 (81%) | 24,931 (81%) | Partially — JSON too flat |
| AGENCY_REGULATION | 288 | 282 (98%) | 201 (70%) | 282 (98%) | Partially |

**SFS Law HTML** is functional (raw Riksdag API format with `name="K1P1"` anchors, `class="paragraf"` markers) — renders correctly on site with working TOC. But JSON/MD derivation hasn't been run. A deterministic parser can extract the hierarchical structure from existing HTML.

**Amendment HTML** is high-quality semantic HTML from the LLM pipeline (structured IDs like `K6_P17_S1`). JSON exists but is too flat — chapters dump into single content blobs, no paragraph-level breakdown. Needs deeper JSON derivation.

**Note:** HTML ingestion backfill is being handled separately. This epic assumes HTML is complete and focuses on the downstream pipeline: JSON → chunks → embeddings → RAG.

---

## Complete Story Inventory

### Phase 1: Data Foundation
| # | Story | Status |
|---|-------|--------|
| **14.1** | Standardized Document JSON Schema & Derivation | Draft |
| **14.2** | ContentChunk Model & Chunking Pipeline | Draft |
| **14.3** | Embedding Generation Pipeline | Draft |

### Phase 2: Company Context
| # | Story | Status |
|---|-------|--------|
| **14.4** | WorkspaceProfile Data Model & Settings UI | Draft |
| **14.5** | Conversational Onboarding Flow | Draft |
| **14.6** | File Knowledge Extraction & Embedding | Draft |

### Phase 3: Agent Core
| # | Story | Status |
|---|-------|--------|
| **14.7** | Agent Tool Definitions | Draft |
| **14.8** | RAG Retrieval Pipeline | Draft |
| **14.9** | Agent System Prompt & Behavioral Design | Draft |

### Phase 4: Agent UX
| # | Story | Status |
|---|-------|--------|
| **14.10** | Agentic Change Assessment Flow (formerly Epic 8 Story 8.3) | Draft |
| **14.11** | Chat-First Dashboard ("Hem") | Draft |

---

## Phase 1: Data Foundation

**Goal:** Every document in the database has a standardized hierarchical JSON representation, is chunked at paragraph level with contextual headers, and has vector embeddings for semantic search.

**Prerequisite:** HTML ingestion backfill complete for SFS laws and amendments (handled outside this epic).

### Story 14.1: Standardized Document JSON Schema & Derivation

**As a** platform building a RAG pipeline,
**I need** all legal documents to have a standardized hierarchical JSON representation,
**so that** downstream chunking and retrieval work consistently across all content types.

**Key deliverables:**
- Define canonical JSON schema: `{ chapters: [{ number, title, sections: [{ number, paragraphs: [{ number, text, role }] }] }] }`
- Build deterministic parser for Riksdag HTML (SFS laws) — extract hierarchy from `name="K1P1"` anchors and `class="paragraf"` markers
- Improve amendment JSON derivation — break chapter-level content blobs into paragraph-level structure (the hierarchy already exists in the HTML IDs like `K6_P17_S1`)
- Validate agency regulation JSON follows the same schema
- Derive markdown_content from HTML for all documents missing it
- Batch processing script with progress logging
- **Scope:** Schema definition + parsers + batch derivation for ~10,803 SFS laws, ~24,932 amendments, ~288 agency regulations

### Story 14.2: ContentChunk Model & Chunking Pipeline

**As a** platform building semantic search,
**I need** legal documents broken into paragraph-level chunks with contextual headers stored in a unified table,
**so that** the agent can retrieve precisely relevant content with full document context.

**Key deliverables:**
- Prisma model: `ContentChunk` with pgvector embedding field
  - `sourceType` enum: `LEGAL_DOCUMENT`, `USER_FILE`, `CONVERSATION`, `ASSESSMENT`
  - `sourceId` — polymorphic reference to source record
  - `workspaceId` — NULL for shared legal content, set for workspace-private content
  - `path` — hierarchical address (e.g., `kap2.§3.st1`)
  - `contextualHeader` — full breadcrumb for embedding context (e.g., "Arbetsmiljölagen (SFS 1977:1160) › Kap 2: Arbetsmiljöns beskaffenhet › 3 §")
  - `content` — the actual chunk text
  - `contentRole` enum: `PARAGRAPH`, `ALLMANT_RAD`, `TABLE`, `HEADING`, `TRANSITION_PROVISION`, `FOOTNOTE`
  - `embedding` — pgvector (dimension determined by chosen embedding model)
  - `tokenCount`, `metadata` (JSON)
- Chunking logic: derive chunks from `json_content`, generate contextual header from document hierarchy
- Chunk lifecycle: when `json_content` is regenerated, re-derive and re-embed chunks
- Database migration with pgvector index (ivfflat or HNSW — benchmark both)
- **Design decision:** Paragraph-level chunks with contextual headers (Anthropic contextual retrieval pattern). Higher levels reconstructed by path prefix grouping.

### Story 14.3: Embedding Generation Pipeline

**As a** platform preparing for semantic search,
**I need** embeddings generated for all content chunks across the database,
**so that** the RAG pipeline can perform vector similarity search.

**Key deliverables:**
- Choose embedding model (candidates: OpenAI `text-embedding-3-small` at 1536-dim, or Voyage AI `voyage-3` — evaluate cost/quality tradeoff)
- Batch embedding script for initial full-DB generation (~10K laws + ~25K amendments + ~288 agency regs = hundreds of thousands of chunks)
- Cost estimation before running
- Incremental embedding: hook into document update pipeline — when a document's JSON changes, re-chunk and re-embed
- Progress logging, resume-on-failure, rate limiting
- pgvector index tuning (HNSW vs ivfflat, `lists` parameter based on dataset size)
- Verification: sample queries to validate retrieval quality

---

## Phase 2: Company Context

**Goal:** The agent knows about the specific company — their industry, size, activities, compliance posture, uploaded policies, and how they've handled changes before.

### Story 14.4: WorkspaceProfile Data Model & Settings UI

**As a** workspace admin,
**I want** to maintain structured information about my company,
**so that** the compliance partner can give me relevant, company-specific guidance.

**Key deliverables:**
- Prisma model: `WorkspaceProfile` (1:1 with Workspace)
  - `companyName`, `orgNumber` (organisationsnummer)
  - `organizationType` enum: `AB`, `HB`, `KOMMUN`, `REGION`, `STATLIG_MYNDIGHET`, `ENSKILD_FIRMA`, `OTHER`
  - `sniCode` — Swedish Standard Industrial Classification
  - `industryLabel` — human-readable industry name
  - `employeeCountRange` enum: `RANGE_1_9`, `RANGE_10_49`, `RANGE_50_249`, `RANGE_250_PLUS`
  - `activityFlags` — JSON: `{ chemicals, construction, food, personalData, publicSector, heavyMachinery, ... }`
  - `certifications` — String[]: `["ISO 45001", "ISO 14001", ...]`
  - `complianceMaturity` enum: `BASIC`, `DEVELOPING`, `ESTABLISHED`, `ADVANCED`
  - `hasComplianceOfficer` — boolean
  - `profileCompleteness` — 0-100 (drives "tell me more" nudges)
  - `lastOnboardingAt` — timestamp of last conversational onboarding
- Settings UI: section in workspace settings to view/edit profile fields
- API: server actions for CRUD
- Profile completeness calculation logic
- Seed with NULL values for existing workspaces (non-breaking migration)

### Story 14.5: Conversational Onboarding Flow

**As a** new workspace admin,
**I want** the compliance partner to interview me about my company through natural conversation,
**so that** my profile is populated without filling out forms.

**Key deliverables:**
- Prisma model: `WorkspaceConversation`
  - `workspaceId`, `type` enum: `ONBOARDING`, `CHECK_IN`, `AD_HOC`
  - `transcript` — JSON (full message array)
  - `extractedInsights` — JSON (structured data the agent pulled from conversation)
  - `conductedAt` — timestamp
- Onboarding agent prompt: asks 5-7 adaptive questions in Swedish, extracts structured profile fields
- Trigger: first time a workspace admin visits the compliance partner, or manually via settings
- Post-conversation: auto-populate `WorkspaceProfile` fields from extracted insights
- Periodic check-in capability: "Har något ändrats i er verksamhet?" (agent-initiated, configurable frequency)
- Store both raw transcript (for context) and extracted structured data (for queries)
- **Two knowledge channels:** Explicit (this conversation) + Implicit (which laws they track, what tasks they create — derived from existing data, no new schema needed)

### Story 14.6: File Knowledge Extraction & Embedding

**As a** workspace member who has uploaded company policies and evidence,
**I want** the compliance partner to understand the content of my uploaded files,
**so that** it can reference my actual policies when giving guidance.

**Key deliverables:**
- Text extraction pipeline for uploaded files (PDF, Word, images via OCR)
- AI classification of file type: `POLICY`, `RISK_ASSESSMENT`, `CERTIFICATE`, `PROCEDURE`, `AUDIT_REPORT`, `TRAINING_MATERIAL`, `OTHER`
- Extend existing File model with: `extractedText`, `contentSummary` (AI-generated), `documentCategory`, relationship to relevant `LegalDocument` records
- Chunk extracted text and store in `ContentChunk` table with `sourceType: USER_FILE`, `workspaceId` set
- Embeddings generated for file chunks (same pipeline as Story 14.3)
- Retrieval scoping: file chunks only visible to the owning workspace
- Trigger: on file upload (async background job) or manual "re-process" action
- **Privacy:** File content never leaves the workspace boundary. Embeddings are workspace-scoped.

---

## Phase 3: Agent Core

**Goal:** The agent has a well-defined tool surface, can retrieve relevant context from all knowledge sources in a single query, and operates within clear behavioral guardrails.

### Story 14.7: Agent Tool Definitions

**As a** compliance partner agent,
**I need** well-defined tools to interact with the application,
**so that** I can search laws, access company context, and take actions on behalf of the user.

**Key deliverables:**
- Tool definitions following Anthropic best practices (clear names, comprehensive descriptions, example usage, edge cases, parameter validation)
- **Read-only tools** (run freely, no confirmation needed):
  - `search_laws` — semantic search across legal document chunks, returns relevant passages with contextual headers
  - `get_document_details` — full content retrieval for a specific legal document
  - `get_change_details` — ChangeEvent details including amendment text, affected sections, SectionChange records
  - `get_company_context` — WorkspaceProfile fields, recent assessments, compliance posture summary
  - `search_company_files` — semantic search across workspace's uploaded file chunks
  - `get_compliance_history` — past ChangeAssessments for this law/workspace, task history, status timeline
- **Write tools** (require user confirmation):
  - `create_task` — create a task in the workspace task list, linked to the relevant law/change
  - `update_compliance_status` — update a LawListItem's compliance status with reason
  - `save_assessment` — persist a ChangeAssessment record
  - `add_context_note` — add a note to a LawListItem explaining why this law matters to the company
- Tool response design: high-signal, semantic identifiers, token-efficient. Implement `concise` vs `detailed` response modes.
- Poka-yoke: absolute IDs, no ambiguous parameters, clear error messages with guidance

### Story 14.8: RAG Retrieval Pipeline

**As a** compliance partner agent,
**I need** to retrieve the most relevant context from all knowledge sources in a single query,
**so that** my responses are grounded in accurate, company-specific information.

**Key deliverables:**
- Unified retrieval function: query ContentChunk table with vector similarity, filtered by `workspaceId IS NULL OR workspaceId = ?`
- Context assembly: combine legal chunks + company file chunks + assessment history into a coherent context window
- Token budget management: prioritize most relevant chunks within model context limits
- Reranking: optional second-pass reranking for quality (evaluate whether needed based on retrieval benchmarks)
- Hybrid search: combine vector similarity with keyword/full-text search for high-precision legal terms (e.g., specific SFS numbers, paragraph references)
- Query expansion: if initial query returns low-relevance results, agent can reformulate and retry
- Performance target: retrieval latency < 500ms for top-20 chunks
- **Workspace scoping is non-negotiable:** Never return another workspace's private chunks

### Story 14.9: Agent System Prompt & Behavioral Design

**As a** platform operator,
**I need** the compliance partner to behave consistently, transparently, and safely,
**so that** users trust its guidance and it doesn't take inappropriate actions.

**Key deliverables:**
- System prompt in Swedish compliance context:
  - Role: "Du är en compliance-partner som hjälper användare att förstå och hantera lagändringar"
  - Knowledge boundaries: "Du baserar dina svar på de lagar och dokument som finns i systemet"
  - Transparency: always cite sources (document number, chapter, section)
  - Tone: professional, clear, actionable. Not legalese, not casual.
- Behavioral guardrails:
  - Never fabricate legal text or invent requirements
  - Always distinguish between "the law says" (factual) and "you should consider" (advisory)
  - Pause before state-changing actions — explain what will happen, ask for confirmation
  - If uncertain, say so explicitly rather than guessing
- Transparency protocol:
  - Show which documents were searched
  - Show which chunks were retrieved and why
  - Explain reasoning before recommendations
- Human-in-the-loop rules:
  - Read-only tools: execute without asking
  - Write tools: explain proposed action → wait for confirmation → execute → confirm result
- Conversation memory: maintain context within a session, reference earlier statements
- Fallback behavior: graceful degradation when company profile is incomplete ("Jag ser att er profil saknar branschinformation — vill ni berätta mer om er verksamhet?")

---

## Phase 4: Agent UX

**Goal:** Users can interact with the compliance partner through two surfaces — the focused assessment flow (for change events) and the general chat (for any compliance question).

### Story 14.10: Agentic Change Assessment Flow (formerly Story 8.3)

**As a** workspace member who has seen a change notification,
**I want** the compliance partner to guide me through assessing what the change means for my company,
**so that** I can make an informed decision and document my response.

**Moved from:** Epic 8, Story 8.3 ("Agentic Change Assessment Flow" — was marked "Needs Rewrite")

**Key deliverables:**
- Prisma model: `ChangeAssessment`
  - `changeEventId` → ChangeEvent
  - `lawListItemId` → LawListItem
  - `workspaceId` → Workspace
  - `status` enum: `IN_PROGRESS`, `REVIEWED`, `ACTION_REQUIRED`, `NOT_APPLICABLE`, `DEFERRED`
  - `impactLevel` enum: `HIGH`, `MEDIUM`, `LOW`, `NONE`
  - `aiAnalysis` — the agent's explanation (stored for future reference)
  - `aiRecommendations` — JSON: suggested actions
  - `userNotes` — free text from user
  - `userDecision` — what they chose to do
  - `assessedBy` → User, `assessedAt` → timestamp
- Assessment flow page: `/laglistor/andringar/[changeEventId]?item=[lawListItemId]`
  - Left panel: the change details (amendment text, affected sections, diff if available from Story 8.2)
  - Right panel: agent conversation — pre-loaded with change context, company profile, compliance history
  - Agent opens with: "Denna ändring påverkar [lag] som ni bevakar i listan [listnamn]. Här är vad som har ändrats och vad det kan innebära för er verksamhet..."
  - Agent uses tools to search related laws, check company context, review past assessments
  - User can ask follow-up questions, request task creation, update compliance status
  - Assessment is saved when user chooses a resolution status
- Entry points: Changes tab row click (Story 8.1) and law list item change indicator click
- Update `LawListItem.last_change_acknowledged_at` when assessment is completed
- Compliance status history: log status transitions (add `ComplianceStatusLog` table or use `ChangeAssessment` as the audit trail)
- **This is the company memory:** Every assessment becomes a data point the agent can reference in future interactions ("Senast den här lagen ändrades bedömde ni det som medel påverkan och skapade 3 uppgifter")

### Story 14.11: Chat-First Dashboard ("Hem")

**As a** workspace member,
**I want** the dashboard to be a chat-first agent interface with contextual compliance cards,
**so that** I can interact with my compliance partner naturally as my primary workspace experience.

**Key deliverables:**
- Transform the dashboard from a widget grid into a Cowork-inspired chat-first interface
- Sidebar nav renamed from "Dashboard" to "Hem", route stays `/dashboard`
- Branded greeting heading using Safiro font, centered chat input
- Dynamic context cards above the chat: compliance %, pending amendments, overdue tasks — clickable to start conversations
- Conversation persists within a work session, shared between Hem page and the right sidebar on other pages
- "Ny konversation" saves the current chat; "Tidigare konversationer" list to revisit saved chats
- Right sidebar AI chat toggle hidden on `/dashboard` (Hem IS the chat); sidebar on other pages shares the same global conversation
- New login/session starts fresh with updated context cards
- Schema change: `conversation_id` field on `ChatMessage` for grouping archived conversations
- **Dependency change:** This story has NO dependencies — it is the foundational agent surface. Stories 14.5 (onboarding), 14.7 (tools), 14.9 (system prompt), and 14.10 (assessment flow) build ON TOP of this interface.
- **Scope boundary:** UI shell + wiring existing chat capabilities. Full agent tools come with 14.7+.

---

## Dependencies & Sequencing

```
Phase 1 (Data Foundation)
  14.1 → 14.2 → 14.3        (JSON → chunks → embeddings, strictly sequential)

Phase 2 (Company Context)
  14.4 → 14.5               (profile model → onboarding flow)
  14.6                       (file extraction — independent, needs 14.2 for ContentChunk table)

Phase 3 (Agent Core)
  14.7                       (tool definitions — needs 14.2 + 14.4 for data access)
  14.8                       (RAG pipeline — needs 14.3 for embeddings)
  14.9                       (system prompt — needs 14.7 + 14.8 to reference tool behavior)

Phase 4 (Agent UX)
  14.11                      (chat-first dashboard "Hem" — NO dependencies, foundational surface)
  14.10                      (assessment flow — needs 14.7 + 14.8 + 14.9 + 14.11)
```

**Cross-epic dependencies:**
- **Epic 8, Story 8.1** (Done): Provides the Changes tab entry point to Story 14.10
- **Epic 8, Story 8.2** (Draft): GitHub-style diff view can be embedded in the assessment flow (nice-to-have, not blocking)
- **Epic 13**: Sync refactor improves amendment detection reliability — makes the agent's data more trustworthy
- **HTML ingestion backfill** (handled outside this epic): Must complete before Phase 1 can run

**Story 8.3 migration:** Story 8.3 ("Mark as Reviewed Workflow" / "Agentic Change Assessment Flow") moves from Epic 8 to this epic as Story 14.10. The old 8.3 story file should be archived and replaced with a redirect note. Epic 8's story inventory should be updated accordingly.

---

## Data Model Summary

### New Tables

| Table | Purpose | Phase |
|---|---|---|
| `ContentChunk` | Unified chunk table for RAG with pgvector embeddings | 14.2 |
| `WorkspaceProfile` | Structured company context (1:1 with Workspace) | 14.4 |
| `WorkspaceConversation` | Onboarding transcripts, check-ins, chat history | 14.5 |
| `ChangeAssessment` | Assessment outcomes — the company compliance memory | 14.10 |
| `ComplianceStatusLog` | Status transition audit trail for LawListItems | 14.10 |

### Modified Tables

| Table | Change | Phase |
|---|---|---|
| `LegalDocument` | `json_content` standardized to hierarchical schema | 14.1 |
| `File` | Add `extractedText`, `contentSummary`, `documentCategory` | 14.6 |
| `LawListItem` | Add `contextNotes` (optional) | 14.7 |

### Key Design Decisions

1. **pgvector** for embeddings — native Supabase support, single database, no external vector DB
2. **Unified ContentChunk table** — one retrieval surface for all knowledge sources, workspace-scoped
3. **Paragraph-level chunks with contextual headers** — Anthropic contextual retrieval pattern for maximum precision
4. **Conversational onboarding** — agent conducts the interview, lowest friction for users
5. **Two knowledge channels** — Explicit (conversations) + Implicit (usage patterns) — the implicit channel requires zero user effort
6. **Peer context deferred** — can be layered on top as an additional retrieval source later

---

## Success Metrics

| Metric | Target | Measurement |
|---|---|---|
| JSON coverage | 100% of documents with HTML have valid JSON | DB query |
| Chunk coverage | All documents chunked, all chunks embedded | ContentChunk count vs LegalDocument count |
| Retrieval precision | Top-5 chunks contain relevant content >80% of the time | Manual evaluation on test queries |
| Assessment completion rate | >60% of change events get assessed within 7 days | ChangeAssessment records / ChangeEvent records |
| Profile completion | >70% of active workspaces have profileCompleteness > 50 | WorkspaceProfile query |
| Agent accuracy | 0 fabricated legal citations in production | Monitoring + user reports |
| Retrieval latency | < 500ms for top-20 chunk retrieval | Performance monitoring |

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Embedding costs for 40K+ documents | Medium | Medium | Estimate before running. Use smaller model if needed. Batch API pricing. |
| JSON parser misses edge cases in Riksdag HTML | High | Medium | Comprehensive test suite with diverse law structures. Manual review of sample output. |
| Agent hallucination of legal text | Low | Critical | System prompt guardrails. Citation requirement. Never generate legal text — only quote retrieved chunks. |
| pgvector performance at scale | Low | High | HNSW index. Benchmark at expected dataset size. Partition by content type if needed. |
| Onboarding conversation feels forced | Medium | Medium | Make it optional. Allow manual profile editing. Nudge gently, don't require. |
| File extraction quality varies | High | Medium | Support common formats first (PDF, Word). Graceful degradation for unsupported formats. Show extraction preview. |

---

## Compatibility Requirements

- [x] Existing APIs remain unchanged (new endpoints only)
- [x] Database schema changes are backward compatible (all new fields nullable or with defaults)
- [x] UI changes follow existing patterns (Tailwind + shadcn/ui components)
- [x] Performance impact minimal (pgvector queries are isolated, don't affect existing page loads)
- [x] Existing file management UI unchanged (extraction runs in background)

## Definition of Done

- [ ] All stories completed with acceptance criteria met
- [ ] ContentChunk table populated with embeddings for all document types
- [ ] WorkspaceProfile model functional with settings UI
- [ ] Onboarding conversation flow working end-to-end
- [ ] Agent assessment flow accessible from Changes tab and law list indicators
- [ ] All tools tested with realistic compliance scenarios
- [ ] No regression in existing features (law browsing, search, law lists, templates)
- [ ] RAG retrieval quality validated on sample queries
- [ ] Agent behavioral guardrails verified (no fabricated citations, proper human-in-the-loop)
- [ ] Documentation updated (this epic file, architectural decisions)
