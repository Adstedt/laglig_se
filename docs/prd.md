# Laglig.se Product Requirements Document (PRD)

**Version:** 1.3
**Status:** Complete - Onboarding Flow Enhanced
**Last Updated:** 2025-11-03
**Owner:** Product Team

---
## Changelog


### Version 1.3 (2025-11-03)
**Dynamic Onboarding & Comprehensive Law Generation Update**

**Major Changes:**
- **Epic 4 Onboarding Flow Enhancement:** Updated from static Bolagsverket-only analysis to conversational dynamic questioning flow
  - Added Story 4.2b: NEW - Dynamic contextual questioning (3-5 AI-selected questions based on industry + previous answers)
  - Updated Story 4.3: Changed from "15-25 laws" to "two-phase generation (15-30 high-priority pre-signup, 60-80 total post-signup)"
  - Added Story 4.4b: NEW - Post-signup Phase 2 background law generation

- **Two-Phase Law Generation Strategy:**
  - **Phase 1 (Pre-Signup):** Generate 15-30 highest-priority laws from Bolagsverket data + dynamic question answers to demonstrate value before signup
  - **Phase 2 (Post-Signup):** Generate remaining 45-65 laws in background (30-60 seconds) for comprehensive 60-80 law coverage matching Notisum parity

- **Dynamic Questioning Logic:**
  - AI selects 3-5 contextual questions based on SNI code (industry), employee count, and previous answers
  - Industry-specific questions (e.g., Restaurang → "Serverar ni alkohol?", Bygg → "Arbetar ni med farliga ämnen?")
  - Employee-count-triggered questions (e.g., 10+ employees → "Har ni skyddsombud?")
  - Follow-up questions based on answers (e.g., "Ja" to alcohol → "Vilken typ av serveringstillstånd?")
  - Hard limit: 5 questions maximum to prevent interrogation fatigue

- **Functional Requirements Updated:**
  - FR2: Onboarding flow now includes dynamic questioning, not just Bolagsverket scraping
  - FR3: Law lists expanded from 15-25 to 60-80 laws with two-phase generation

- **UX Impact:**
  - Pre-signup: Shows "+45-65 mer lagar efter registrering" badge to create conversion trigger
  - Post-signup: Dashboard shows progress bar "Kompletterar din laglista... 23/68 lagar"
  - User can interact with Dashboard during Phase 2 generation (non-blocking background process)
  - Laws categorized into: Grundläggande, Arbetsmiljö, Branschspecifika, GDPR & Data, Ekonomi, Miljö, Övrigt

**Rationale:**
1. **Dynamic Questioning:** Bolagsverket data alone insufficient for accurate law selection. Industry-specific context (alcohol licensing, hazardous materials, subcontractors, etc.) dramatically affects applicable laws.
2. **60-80 Law Coverage:** Competitive analysis of Notisum shows typical law lists contain 60-80 laws. Generating only 15-25 laws underserves users and misses compliance gaps.
3. **Two-Phase Strategy:** Balances conversion (show value fast) with comprehensiveness (match competitor coverage). Phase 1 demonstrates "magic" in 2-3 minutes, Phase 2 completes coverage post-signup without blocking user.

**Technical Implications:**
- AI question selection requires GPT-4 with industry knowledge base
- Phase 2 generation uses background job (not blocking request/response)
- Session storage preserves partial onboarding state (24-hour expiry) for browser-close recovery
- CompanyContext object stores all answers for downstream AI chat, notifications, and analytics

---
### Version 1.2 (2025-11-02)
**Multi-Content-Type Architecture Update**

**Major Changes:**
- **Epic 2 Scope Expansion:** Changed from "10,000+ law database" to "170,000+ multi-content-type legal database"
  - Added Swedish Court Cases (AD, HD, HovR, HFD, MÖD, MIG): 15,000-20,000 pages
  - Added EU Legislation (Regulations, Directives): 110,000+ pages
  - **UPDATED (v1.3):** AD (Arbetsdomstolen / Labour Court) IS included in MVP as Priority #1 court - Domstolsverket PUH API has working AD data (fixes Notisum's broken AD coverage)
  - Excluded Propositioner, EU Court Cases to Phase 2

- **Epic 2 Stories:** Restructured from 8 to 11 stories
  - Story 2.1: NEW - Multi-content-type data model design
  - Story 2.2: Updated - SFS laws ingestion (50,000+ documents)
  - Story 2.3: NEW - Court cases ingestion (AD, HFD, HD, HovR - priority order)
  - Story 2.4: NEW - EU legislation ingestion (Regulations, Directives)
  - Story 2.5: Updated - SEO pages for all content types with type-specific routes
  - Story 2.6: Updated - Content-type-specific categorization
  - Story 2.7: NEW - Multi-content-type search and filtering
  - Story 2.8: NEW - Cross-document navigation system
  - Story 2.9: Updated - SNI discovery with multi-content results
  - Story 2.10: NEW - Content-type-specific RAG chunking strategies
  - Story 2.11: Updated - Multi-content-type change history tracking

- **Database Schema:** Polymorphic design to support multiple content types
  - `legal_documents` table (polymorphic for all types)
  - `court_cases` table (type-specific metadata)
  - `eu_documents` table (CELEX, NIM data)
  - `cross_references` table (laws ↔ cases ↔ EU directives)
  - `amendments` table (SFS amendment tracking)
  - `document_subjects` table (categorization)

- **Functional Requirements Updated:**
  - FR1: 10,000+ laws → 170,000+ legal documents
  - FR4: RAG sources expanded to include court cases and EU legislation
  - FR8: Change monitoring expanded to all content types
  - FR24: Individual pages support content-type-appropriate tabs
  - FR36: Categorization applies to all 170,000+ documents

- **Architecture Requirements Updated:**
  - Multi-source API dependencies: Riksdagen, Domstolsverket, EUR-Lex
  - Content-type-specific indexing strategies for pgvector
  - Multi-content-type change detection jobs

**Rationale:** Competitive analysis of Notisum revealed their SEO strategy relies on comprehensive content coverage across 18+ document types. To compete, Laglig.se MVP must cover SFS laws, court precedent, and EU legislation (7 content types, ~170K pages) to drive sufficient SEO traffic.

**Data Source Status:**
- ✅ Riksdagen API: Available, confirmed
- ✅ EUR-Lex API: Available, confirmed
- ✅ Domstolsverket API: Available, confirmed
- ❌ AD Labour Court: Data quality issues in Notisum, investigate alternative sources post-MVP

### Version 1.1 (2025-11-01)
**PRD Completion - Ready for Architect Handoff**

**Changes:**
- Added Post-MVP Roadmap section with explicit out-of-scope features
- Added User Research & Validation Approach section
- Added Technical Risk Areas section (6 high-complexity areas flagged)
- Added Next Steps section with UX Expert and Architect handoff prompts
- Updated status to "Complete - Ready for Architect"

### Version 1.0 (2025-01-01)
**Initial PRD Draft**

- Complete epic structure (8 epics, 86 stories)
- Functional and Non-Functional Requirements (41 FR, 26 NFR)
- Goals, user research, competitive analysis
- Technical stack defined
- Revenue model and pricing tiers

---


## Goals and Background Context

### Goals

**Primary Business Goals:**

1. **Achieve 10M SEK ARR within 18 months** across three customer segments (SMBs, ISO consultants, public sector) plus Fortnox integration channel

2. **Acquire 760+ paying customers** by Month 18 (260 direct + 500 via Fortnox partnership)

3. **Establish SEO dominance** - Rank #1-3 for 100+ Swedish legal search terms, driving 50,000+ monthly organic visitors

4. **Validate product-market fit** - NPS >50, <5% monthly churn, >40% of customers from referrals/organic/Fortnox channel

5. **Launch Fortnox integration** by Month 9, achieving 500 Fortnox customers and 2.25M SEK ARR by Month 18

**Primary User Goals:**

1. **SMB Owners/HR Managers:** Avoid costly legal mistakes (€10,000-500,000 fines), get quick answers to HR/compliance questions, gain confidence they're "doing it right"

2. **ISO Compliance Managers:** Streamline audit preparation, automate compliance tracking, collaborate with team, stay ahead of regulatory changes

3. **Public Sector Officers:** Centralize compliance across departments, reduce reliance on expensive consultants, maintain audit-ready documentation

**Product Goals:**

1. **Transform compliance from reactive to proactive** - Users discover compliance gaps BEFORE violations occur

2. **Make Swedish law accessible** - 10,000+ laws publicly available with AI-powered plain-language explanations

3. **Provide zero-hallucination legal guidance** - RAG-powered AI that only answers from verified legal sources with full citations

4. **Drive retention through change monitoring** - Automatic notifications when tracked laws change, preventing compliance lapses

5. **Enable "coolt med koll" positioning** - Compliance as aspirational business infrastructure, not burdensome obligation

---

### Background Context

#### The Problem We're Solving

Swedish businesses are legally obligated to comply with hundreds of laws spanning arbetsmiljö (workplace safety), arbetsrätt (employment law), avtalsrätt (contract law), and sector-specific regulations. For most SMBs, compliance is **reactive, expensive, and risky**:

- **Reactive:** Companies only address compliance when facing audits, employee complaints, or violations
- **Expensive when done right:** Legal consultants charge 1,500-3,000 SEK/hour
- **Risky when done wrong:** A single HR mistake can cost 100,000-500,000+ SEK in fines
- **Difficult to navigate:** Existing tools (Notisum, InfoTorg Juridik) have outdated UX, no AI assistance, and require legal expertise

**Market Validation:** Notisum generates ~40M SEK ARR at 60% margins despite inferior product, validating strong demand and healthy unit economics.

#### Why Existing Solutions Fall Short

1. **Notisum** - 1990s UX, no AI, just static document access, expensive (8,000+ SEK/year)
2. **Legal consultants** - Expensive, slow, reactive (pay per question)
3. **DIY/Google** - Unreliable, fragmented, high risk of misinterpretation
4. **Enterprise tools** - Overkill for SMBs, require dedicated compliance staff

#### Our Approach

Laglig.se transforms legal compliance from a reactive burden into proactive business infrastructure by combining:

1. **Free, SEO-indexed legal content** - All Swedish laws (SFS), court cases, EU regulations publicly accessible
2. **AI-powered compliance tools** (paid) - RAG-based chatbot, personalized law lists, automated task generation, change monitoring
3. **Industry-specific guidance** (paid) - Tailored compliance packs for construction, restaurants, tech, manufacturing

**Key Differentiators:**
- **Freemium SEO Moat:** Public content ranks for everything, drives organic traffic
- **RAG-Powered AI:** Zero-hallucination through comprehensive Swedish law database
- **Proactive, Not Reactive:** Monitors legal changes and pushes tasks BEFORE deadlines
- **Modern UX:** Jira-inspired Kanban, conversational AI, drag-and-drop components
- **"Coolt med koll" Positioning:** Compliance as aspirational, not burdensome

#### Strategic Context

This PRD documents the **MVP (Minimum Viable Product)** scope for Laglig.se, targeting launch within 4-6 months. The MVP focuses on 8 core features that deliver immediate value while establishing the foundation for post-MVP expansion (Fortnox integration, public sector features, advanced collaboration).

The project is **bootstrap-funded** with a **solo founder** handling development, sales, and customer success. This constraint drives ruthless prioritization and self-serve product design.

#### User Research & Validation Approach

**Current Foundation:** This PRD is informed by competitive analysis (Notisum market validation, €40M ARR at poor UX), founder domain expertise in the Swedish SMB market, and analysis of existing legal compliance pain points.

**MVP Validation Strategy:** The MVP serves as the primary user research vehicle. Key assumptions to validate post-launch:
- **Assumption 1:** SMB owners will pay €399-899/month for compliance automation (validate via trial-to-paid conversion >25%)
- **Assumption 2:** AI-powered guidance reduces need for legal consultants (validate via user interviews at Month 3)
- **Assumption 3:** Change monitoring drives retention (validate via churn rate <5% monthly)
- **Assumption 4:** SEO-driven freemium model acquires customers cost-effectively (validate via CAC:LTV ratio)

**Post-MVP Research Plan:** Conduct structured user interviews (n=20-30) at Month 3 to validate feature prioritization and identify gaps in current offering. Use NPS surveys and usage analytics to guide Phase 2 roadmap.

---

### Change Log

| Date | Version | Description | Author |
|------|---------|-------------|---------|
| 2025-01-01 | 1.0 | Initial PRD created from Project Brief and 7 feature specifications | John (PM Agent) |
| 2025-11-01 | 1.1 | Added Post-MVP Roadmap, User Research section, Technical Risk Areas. Passed PM Checklist (92%% - Ready for Architect). | John (PM Agent) |

---

## Requirements

### Functional Requirements

**FR1:** The system SHALL provide public access to 170,000+ legal documents (Swedish laws/SFS, Swedish court cases from HD/HovR/HFD, EU regulations, EU directives) via server-side rendered pages optimized for SEO, with no authentication required for viewing legal content.

**FR2:** The system SHALL implement a dynamic onboarding flow that collects company org-number, scrapes Bolagsverket data, asks 3-5 AI-selected contextual questions based on industry and company size, and generates a personalized law list via streaming AI in two phases: Phase 1 (15-30 high-priority laws pre-signup in <3 minutes) and Phase 2 (remaining 45-65 laws post-signup in <60 seconds background generation) for comprehensive 60-80 law coverage.

**FR3:** The system SHALL generate personalized law lists containing 60-80 laws with AI-powered contextual commentary explaining what each law means specifically for the user's business (industry, size, employee count, contextual answers from dynamic questions), categorized into Grundläggande, Arbetsmiljö, Branschspecifika, GDPR & Data, Ekonomi, Miljö, and Övrigt groups.

**FR4:** The system SHALL provide a RAG-powered AI chatbot that answers legal questions using ONLY verified legal sources (SFS laws, Swedish court cases from HD/HovR/HFD, EU regulations/directives, kollektivavtal) with mandatory inline citations, minimizing hallucinations through strict RAG grounding.

**FR5:** The system SHALL support drag-and-drop of law cards, employee cards, task cards, and files into the AI chat interface to build contextual queries.

**FR6:** The AI chatbot SHALL stream components (law cards, task suggestions) back to the frontend based on conversation context, enabling intelligent workflow automation.

**FR7:** The system SHALL provide a Kanban-style compliance workspace with columns (Not Started, In Progress, Blocked, Review, Compliant) where users can drag law cards and add notes.

**FR8:** The system SHALL monitor all legal content types daily (SFS laws via Riksdagen API, court cases via Domstolsverket API, EU legislation via EUR-Lex API) and detect changes (amendments, new sections, repeals, metadata updates), storing complete change history indefinitely.

**FR9:** The system SHALL send email notifications (daily digest format) when laws in a user's law list change, with AI-generated plain-language summaries of what changed, minimizing hallucinations through strict RAG grounding and mandatory source citations.

**FR10:** The system SHALL provide an in-app notification bell in the top navigation showing unacknowledged law changes, with a dropdown preview and badge count.

**FR11:** The system SHALL display a "Changes" tab within the Law List page showing all unacknowledged changes with GitHub-style diff views and "Mark as reviewed" workflow.

**FR12:** The system SHALL send weekly industry digest emails (Sunday 18:00 CET) with law changes relevant to the user's SNI code, based on curated industry starter packs (15-25 laws per industry).

**FR13:** The system SHALL provide an HR Module with employee CRUD operations, supporting fields aligned with Fortnox schema (name, personnummer [encrypted], employment date, contract type, role, department, manager).

**FR14:** The system SHALL support CSV import of employee data with GPT-4 fuzzy role matching (e.g., "Builder" → "construction_worker"), user-selected date format, and skip-invalid-rows-with-warnings behavior.

**FR15:** The system SHALL allow users to upload kollektivavtal PDFs, automatically chunk and embed them into the RAG database, and assign them to employee groups (arbetare vs. tjänstemän).

**FR16:** The system SHALL calculate employee compliance status (Compliant, Needs Attention, Non-Compliant) based on document completeness, data quality, and kollektivavtal assignment.

**FR17:** The system SHALL provide workspace-based multi-tenancy with five user roles: Owner (full access, billing), Admin (full access except deletion), HR Manager (HR + sensitive data), Member (view-only law lists), Auditor (multi-workspace read-only).

**FR18:** The system SHALL implement three subscription tiers via Stripe: Solo (€399/mo, 1 user, 5 employees, 50 AI queries), Team (€899/mo, 5 users, 50 employees, 500 AI queries), Enterprise (€2,000+/mo, unlimited, manual invoicing).

**FR19:** The system SHALL enforce usage limits per tier (AI queries, employees, kollektivavtal, storage) with 10% overage allowance before prompting upgrade.

**FR20:** The system SHALL provide add-on purchases: +10 employees (€100/mo), +5GB storage (€50/mo), allowing users to grow without tier jumping.

**FR21:** The system SHALL implement a 14-day free trial requiring credit card upfront, with automatic conversion to paid subscription unless canceled.

**FR22:** The system SHALL support team invites via email, with pending invitation status visible to Owner/Admin and ability to re-send invites.

**FR23:** The system SHALL integrate with Bolagsverket API during signup to auto-fill company name, address, SNI code, and legal form based on org-number.

**FR24:** The system SHALL provide individual legal document pages (laws, court cases, EU legislation) with content-type-appropriate tabs: Overview (AI summary, key sections), Content (full SFS text), Change History (for laws: amendment timeline; for court cases: citation history; for EU: implementation status), Notes (team collaboration with @mentions).

**FR25:** The system SHALL implement a global search (keyboard shortcut `/` or `Cmd+K`) across laws, tasks, employees, and comments with instant dropdown results.

**FR26:** The system SHALL display law cards throughout the UI as draggable components with metadata (category, status badge, priority, assigned employees).

**FR27:** The system SHALL provide a Dashboard summary view showing compliance progress ring, AI insights (recent changes, new laws for industry), quick actions, and recent activity feed.

**FR28:** The system SHALL allow users to manually add/remove laws from their personalized lists and create multiple law lists per workspace (e.g., "Main List", "Construction-Specific").

**FR29:** The system SHALL support Supabase Auth with three authentication methods: email+password, Google OAuth, Microsoft OAuth, requiring email verification via 6-digit code.

**FR30:** The system SHALL implement password complexity requirements: min 8 chars, 1 number, 1 special character, 1 uppercase letter, check against breach database (HaveIBeenPwned).

**FR31:** The system SHALL provide activity logs for Enterprise tier showing who reviewed which law changes and when, creating an audit trail for compliance documentation.

**FR32:** The system SHALL soft-delete workspaces with 30-day recovery period, continuing Stripe subscription until end of billing cycle, and sending email notifications to all team members.

**FR33:** The system SHALL allow workspace pausing (data preserved, access blocked) and resumption without data loss.

**FR34:** The system SHALL support workspace settings including: company logo upload, notification preferences (email frequency, in-app), billing management, and integration toggles (post-MVP: Fortnox, Slack).

**FR35:** The system SHALL provide SNI-based law discovery, allowing users to enter industry code and instantly receive 12-25 relevant laws for their sector.

**FR36:** The system SHALL categorize all 170,000+ legal documents (laws, court cases, EU legislation) into 10 top-level categories (Arbetsrätt, Dataskydd, Skatterätt, Bolagsrätt, Miljö & Bygg, Livsmedel & Hälsa, Finans, Immaterialrätt, Konsumentskydd, Transport & Logistik) with AI-powered B2B/Private/Both classification.

**FR37:** The system SHALL provide popular abbreviation search (e.g., "LAS" → Anställningsskyddslagen, "ABL" → Aktiebolagslagen) for quick law discovery.

**FR38:** The system SHALL display effective dates for law changes and source document links (Riksdagen propositions) in change notifications and diff views.

**FR39:** The system SHALL send reminder emails for unacknowledged law changes at 3 days and 7 days after initial notification, plus inclusion in weekly digest with CTA to Changes tab.

**FR40:** The system SHALL maintain persistent in-app notification badge showing unacknowledged change count until all changes marked as reviewed.

**FR41:** The system SHALL design employee schema (FR13) and workspace data model to support future Fortnox OAuth integration, with fields mapped to Fortnox API structure (employeeId → EmployeeId, personnelType → PersonnelType) to enable seamless one-click sync in post-MVP Phase 2.

---

### Non-Functional Requirements

**NFR1:** The system SHALL render individual law pages via server-side rendering (SSR) with Core Web Vitals scores meeting Google's "Good" thresholds (LCP <2.5s, FID <100ms, CLS <0.1) for SEO optimization.

**NFR2:** The system SHALL ensure AI chatbot response time <3 seconds for RAG queries, including vector similarity search and LLM generation.

**NFR3:** The system SHALL implement aggressive caching (target 75%+ cache hit rate) for vector embeddings and frequently accessed law content to optimize AI API costs.

**NFR4:** The system SHALL store ALL employee personnummer (Swedish personal identity numbers) encrypted at rest using AES-256 or equivalent, with encryption keys managed separately from database.

**NFR5:** The system SHALL implement GDPR-compliant data handling with user right to data export, deletion, and processing transparency, including clear consent flows for AI processing.

**NFR6:** The system SHALL maintain 99.9% uptime for core features (law pages, AI chat, change monitoring) measured monthly, excluding planned maintenance.

**NFR7:** The system SHALL scale to support 10,000+ concurrent users without performance degradation, leveraging Vercel Edge functions and PostgreSQL connection pooling.

**NFR8:** The system SHALL implement rate limiting per user tier: Solo (50 AI queries/month), Team (500/month), Enterprise (unlimited), with 10% overage grace before hard block.

**NFR9:** The system SHALL minimize hallucinations in AI responses through strict RAG grounding: ONLY generate answers from retrieved law chunks with mandatory inline citations, else respond "I don't have enough information."

**NFR10:** The system SHALL complete daily Riksdagen API change detection cron job within 2 hours (00:00-02:00 UTC), processing all 10,000+ laws and triggering notifications.

**NFR11:** The system SHALL generate AI change summaries for law amendments within 5 minutes of detection, storing summaries in database for instant notification delivery.

**NFR12:** The system SHALL support mobile-responsive design (viewport widths 320px-2560px) with touch-optimized drag-and-drop for law cards and AI chat components.

**NFR13:** The system SHALL maintain comprehensive application logs with structured JSON format, retention period of 90 days, and error alerting to development team via email/Slack.

**NFR14:** The system SHALL implement session timeout of 30 days for authenticated users, requiring re-authentication afterward.

**NFR15:** The system SHALL provide legal disclaimers prominently: footer on all pages, before first AI chat message, in Terms of Service, clarifying "AI-assisted guidance, not legal advice."

**NFR16:** The system SHALL implement backup strategy: Daily PostgreSQL snapshots with 30-day retention, weekly full backups with 90-day retention, tested restoration quarterly.

**NFR17:** The system SHALL optimize vector database storage costs by using PostgreSQL pgvector for MVP (avoiding Pinecone subscription), with migration path to Pinecone if query volume exceeds 100,000/day.

**NFR18 (CRITICAL):** The system MUST track unit economics per active user: AI API costs (OpenAI/Anthropic), vector query costs, storage costs, with target gross margin >80% across all tiers, reported weekly to founder for business model validation.

**NFR19:** The system SHALL implement feature flags for gradual rollout of new features (e.g., kollektivavtal compliance checking, advanced team collaboration) to subset of users for validation.

**NFR20:** The system SHALL ensure Swedish language quality in AI responses, with prompt engineering optimized for legal Swedish terminology and fallback to keyword search if AI confidence <70%.

**NFR21:** The system SHALL support browser compatibility: Chrome/Edge (last 2 versions), Firefox (last 2 versions), Safari (last 2 versions), with graceful degradation for older browsers.

**NFR22:** The system SHALL implement Content Security Policy (CSP) headers to prevent XSS attacks, with strict-dynamic and nonce-based script loading.

**NFR23:** The system SHALL validate all user inputs server-side to prevent SQL injection, command injection, and other OWASP Top 10 vulnerabilities.

**NFR24:** The system SHALL implement semantic chunking for law documents (500-800 tokens per chunk) to optimize RAG retrieval accuracy vs. fixed-size chunking.

**NFR25:** The system SHALL provide graceful error messages for users, avoiding technical jargon (e.g., "We couldn't load that law right now" vs. "500 Internal Server Error").

**NFR26:** The system SHALL implement email marketing automation for:
- **Trial nurturing:** Day 1 welcome, Day 7 feature tips, Day 12 conversion reminder
- **Newsletter signups:** Weekly legal updates, industry insights, product announcements for non-customers
- **Email engagement tracking:** Open rates, click rates, conversion attribution
- **System requirements:** Integration with email service provider (Resend, SendGrid, or Loops) with template management, audience segmentation, and A/B testing capabilities for newsletter optimization

---

## User Interface Design Goals

### Overall UX Vision

**Design Philosophy:** "Coolt med koll" - Compliance as aspirational, modern business infrastructure

Laglig.se transforms legal compliance from bureaucratic drudgery into intuitive, even *enjoyable* workflows. The UI should feel like **Jira met a modern legal AI assistant** - powerful for professionals, approachable for SMB owners.

**Core UX Principles:**

1. **Progressive Disclosure** - Hide complexity until needed. Start simple (law list), reveal depth on interaction (drag into chat, view detailed diff).

2. **Component-First Mental Model** - Everything is a draggable, reusable card (law, employee, task, file). Users build context visually, not through complex forms.

3. **Streaming = Magic** - Dynamic onboarding streams law list generation in real-time. AI chat streams responses. Users see intelligence at work, building trust.

4. **Zero Jargon** - Legal terms explained in plain Swedish. Status badges use symbols + short text ("✅ Compliant" not "Regulatory adherence achieved").

5. **Confidence Through Clarity** - Users should always know: What do I need to do? Why does this matter? Where do I find help?

---

### Key Interaction Paradigms

#### 1. Drag-and-Drop Context Building

**Interaction:** Users drag law cards, employee cards, task cards, files directly into AI chat sidebar to build contextual queries.

**Why it works:**
- **Tangible** - Makes abstract "context" feel physical and manipulable
- **Discoverable** - Hover states and drop zones teach the interaction naturally
- **Powerful** - Enables complex multi-entity queries without forms

**Implementation notes:**
- Visual feedback: Glow/highlight on hover, smooth animation on drop
- Context pills appear above chat input showing active components
- Max 10 components to prevent context overload

---

#### 2. Streaming Intelligence

**Interaction:** AI responses, onboarding law lists, and component suggestions stream word-by-word or card-by-card to frontend.

**Why it works:**
- **Perceived performance** - User sees progress immediately
- **Trust building** - Watching AI "think" makes process transparent
- **Engagement** - Streaming creates anticipation

**Implementation notes:**
- Vercel AI SDK `useChat` hook for text streaming
- Component streaming: Law cards appear one-by-one
- Graceful handling if stream interrupted

---

#### 3. Kanban-Style Compliance Workspace

**Interaction:** Law cards move across columns (Not Started → In Progress → Blocked → Review → Compliant) via drag-and-drop, Jira-style.

**Why it works:**
- **Familiar mental model** - Most users know Kanban from Trello/Jira/Asana
- **Visual progress** - See compliance status at a glance
- **Flexible workflow** - Users customize columns, add notes

**Implementation notes:**
- Use @dnd-kit or react-beautiful-dnd
- Auto-save on card move
- Mobile: Swipe instead of drag

---

#### 4. Inline Contextual Help

**Interaction:** Tooltips, hover states, and inline hints explain features without leaving page.

**Why it works:**
- **Self-serve** - Reduces support burden
- **Contextual** - Help appears exactly when needed
- **Non-intrusive** - Doesn't block workflow

---

#### 5. Citation-First AI Responses

**Interaction:** Every AI answer includes inline citations `[1]` that show hover tooltips with source law text and clickable links.

**Why it works:**
- **Trust** - Users verify AI isn't hallucinating
- **Learning** - Users discover related law sections organically
- **Legal defensibility** - Answers traceable to official sources

---

### Core Screens and Views

1. **Public Law Pages** - SEO entry point
2. **Dynamic Onboarding Widget** - Conversion engine
3. **Dashboard (Summary View)** - Default landing after login
4. **Kanban Compliance Workspace** - Primary workspace
5. **AI Chat Sidebar** - Always accessible
6. **Individual Law Page** - Deep dive with tabs
7. **HR Module - Employee List** - Table/card views
8. **HR Module - Employee Profile** - 4 tabs
9. **Law List - Changes Tab** - Review unacknowledged changes
10. **Workspace Settings** - Configuration

---

### Accessibility

**Target Level:** WCAG AA (for MVP)

**Key requirements:**
- Keyboard navigation for all interactive elements
- Screen reader compatibility (semantic HTML, ARIA labels)
- Color contrast ratios ≥4.5:1 for normal text
- Focus indicators on all focusable elements
- Alt text for images, icons

**Post-MVP:** WCAG AAA for public sector customers

---

### Branding

**Design Philosophy:** Minimalist, OpenAI-inspired, light mode default

**Visual Direction:**
- **Inspiration:** OpenAI's ChatGPT interface - clean, spacious, content-focused
- **Whitespace:** Generous padding, breathing room
- **Simplicity:** Minimal UI elements, hide complexity
- **Light mode default:** Clean white/light gray backgrounds

**Color Palette:**
- **Primary:** Deep blue (#1e40af) - Trust, professionalism
- **Accent:** Bright green (#10b981) - Compliance success
- **Warning:** Amber (#f59e0b)
- **Error:** Red (#ef4444)
- **Background:** White (#ffffff) and subtle gray (#f9fafb)
- **Border:** Light gray (#e5e7eb)
- **Text:** Near-black (#111827)

**Typography:**
- **Sans-serif:** Inter, SF Pro, or system font stack
- **Font weights:** Regular (400), Medium (500), Semibold (600)
- **Monospace:** For SFS numbers and legal citations

**UI Elements:**
- **Rounded corners:** 8px border-radius
- **Shadows:** Subtle shadow-sm and shadow-md
- **Borders:** 1px, light gray, minimal use

**Layout Principles:**
- **Spacious:** 24px-32px gaps between sections
- **Single column primary content:** Focused, centered
- **Max-width content:** ~800px for readability

**Tone of Voice:**
- **Conversational, not bureaucratic**
- **Confident, not preachy**
- **Helpful, not condescending**

**Iconography:**
- **Minimal icon use:** Text-first
- **Style:** Outlined icons (Heroicons, Lucide)
- **Size:** 20px or 24px consistent

**Reference:**
- Primary inspiration: chat.openai.com
- Secondary: linear.app

---

### Design System & Components

#### Component Library Approach

**Framework:** shadcn/ui + Tailwind CSS

**Rationale:**
- Pre-built, accessible components
- Minimalist aesthetic matches OpenAI inspiration
- Components copied into codebase (full control)
- Tailwind-native

**Implementation Note:** Full component specifications will be defined in design handoff document. Architects should use shadcn/ui defaults as starting point.

---

#### Standardized UI Patterns

**Reusable Components Required:**
- **Buttons:** Primary, Secondary, Ghost, Destructive variants
- **Status Badges:** Compliant (green), Needs Attention (amber), Non-Compliant (red)
- **Cards:** Law cards, Employee cards, Task cards (all draggable)
- **Form Inputs:** Text, Textarea, Select (consistent styling)

**Color System:**
- Define Tailwind config with custom tokens
- Ensures consistent colors across all components

**Typography Scale:**
- Semantic heading levels (H1-H4)
- Body text sizes (large/default/small)

**Spacing System:**
- Use Tailwind's spacing scale consistently
- Generous whitespace (OpenAI-inspired)

---

#### Design Handoff Requirements

**Architects will receive:**
1. Component library specification
2. Color token definitions for Tailwind config
3. Typography scale and usage guidelines
4. Icon library selection
5. Animation/transition standards

---

### Target Device and Platforms

**Primary Target:** Web Responsive (Desktop + Tablet + Mobile)

**Breakpoints:**
- **Desktop:** 1280px+ (primary target)
- **Tablet:** 768px-1279px
- **Mobile:** 320px-767px

**Platform priorities:**
1. Desktop Chrome/Edge (70% of B2B users)
2. Desktop Safari (Mac users)
3. Mobile Safari (iPhone)
4. Mobile Chrome (Android)

**NOT in MVP:**
- Native mobile apps
- Desktop apps
- Browser extensions

**Progressive Web App (PWA):**
- Add to homescreen capability
- Offline mode for law pages
- Push notifications (post-MVP)

---

## Technical Assumptions

### Repository Structure: Monorepo

**Decision:** Single repository containing all application code

**Rationale:**
- Solo founder managing one codebase
- Faster development with shared types
- Atomic commits across frontend/backend
- Easier refactoring

**Structure:**
```
laglig_se/
├── app/                 # Next.js App Router pages
├── components/          # React components
├── lib/                 # Shared utilities
├── api/                 # API routes
├── jobs/                # Cron jobs
├── prisma/              # Database schema
├── public/              # Static assets
└── tests/               # Test files
```

---

### Service Architecture: Monolith (Serverless Functions)

**Decision:** Next.js monolith deployed to Vercel with serverless functions

**Rationale:**
- MVP speed (single deployment)
- Vercel optimization
- Cost efficiency
- Solo founder friendly

**Architecture:** Next.js App (SSR + React) + API Routes (serverless) + Cron Jobs + External Services (Supabase, OpenAI, Stripe, Email, Riksdagen API, Bolagsverket API)

---

### Testing Requirements: Unit + Integration

**Decision:** Focus on critical path testing

**Test Strategy:**

1. **Unit Tests** (Vitest + React Testing Library)
   - Utility functions, business logic
   - Target coverage: 60-70%

2. **Integration Tests** (Playwright or Cypress)
   - Critical user journeys end-to-end
   - Target coverage: 8-10 critical paths

3. **Manual Testing**
   - UI/UX polish, edge cases
   - Before each major release

**NOT in MVP:**
- Full E2E test suite
- Visual regression testing
- Load/performance testing

---

### Frontend Stack

**Framework:** Next.js 14+ (App Router)

**UI Libraries:**
- shadcn/ui (Radix UI + Tailwind)
- Tailwind CSS
- @dnd-kit or react-beautiful-dnd
- React Hook Form + Zod
- Zustand (state management)
- TanStack Query (data fetching)

---

### Backend Stack

**Database:** Supabase PostgreSQL (with pgvector extension)

**ORM:** Prisma

**Authentication:** Supabase Auth + NextAuth.js (hybrid)

---

### AI Stack

**LLM Provider:** OpenAI (GPT-4) OR Anthropic (Claude 3.5 Sonnet)

**Embeddings:** OpenAI text-embedding-3-small

**Vector Database:** PostgreSQL with pgvector (via Supabase)

**Semantic Chunking:** LangChain or custom implementation (500-800 tokens/chunk)

**RAG Framework:** Vercel AI SDK + custom RAG

---

### Email System

**Provider:** Resend (recommended) OR SendGrid OR Loops

**Template Management:** React Email

**Email Types:**
- Transactional (signup, password reset, invites)
- Marketing (newsletter, digests, updates)
- Notifications (law changes, reminders)

---

### Monitoring & Observability

**Error Tracking:** Sentry

**Analytics:** Vercel Analytics + PostHog (optional)

**Logging:** Vercel logs + structured JSON

---

### CI/CD & Deployment

**Hosting:** Vercel

**CI/CD Pipeline:** GitHub Actions (Prettier, ESLint, TypeScript, tests)

**Database Migrations:** Prisma migrations via Vercel build step

**Secrets Management:** Vercel Environment Variables

---

### Security & Compliance

**GDPR Requirements:**
- Data encryption at rest
- Personnummer encrypted (AES-256)
- Data export/deletion APIs
- 30-day soft delete + purge

**Authentication Security:**
- bcrypt password hashing
- Password complexity enforcement
- Breach check (HaveIBeenPwned)
- 30-day session expiry
- CSRF protection

**API Security:**
- Rate limiting (10 req/sec per IP)
- Zod input validation
- SQL injection prevention (Prisma)
- XSS prevention (React auto-escaping + CSP)

**Infrastructure Security:**
- HTTPS only
- Security headers (CSP, X-Frame-Options)
- Dependency scanning (Dependabot)
- Secret scanning

---

### Technical Risk Areas Requiring Architect Deep-Dive

The following areas involve significant technical complexity or external dependencies that require careful architectural investigation during implementation planning:

#### 1. RAG Implementation & Accuracy Tuning

**Complexity:** High - Core product differentiator with quality-critical requirements

**Key Challenges:**
- **Chunk size optimization:** Specified as 500-800 tokens (NFR24), but optimal size varies by law structure. May require experimentation.
- **Retrieval parameters:** Top-k value, similarity threshold, reranking strategies need tuning for Swedish legal text.
- **Embedding model selection:** `text-embedding-3-small` chosen for cost, but accuracy vs. `text-embedding-3-large` should be validated.
- **Hallucination minimization:** Target <5% hallucination rate (NFR9). Requires robust grounding mechanism and citation verification.

**Architect Action:** Design RAG pipeline with configurable parameters. Plan A/B testing framework for tuning post-launch.

---

#### 2. Multi-Source API Dependencies (Riksdagen, Domstolsverket, EUR-Lex) & Reliability

**Complexity:** Medium - Critical external dependency for change detection

**Key Challenges:**
- **API reliability unknown:** No SLA from Riksdagen. What if API down during daily cron job (NFR10)?
- **Rate limiting:** Specified as 10 req/sec (Story 2.1), but actual limits may differ. Risk of job timeout if throttled.
- **API schema changes:** Government APIs can change without notice. Need versioning strategy.
- **Data completeness:** API may not provide all law metadata (effective dates, source propositions). Requires fallback.

**Architect Action:** Design fallback strategy (cache last known state, retry logic, alerting). Consider scraping as backup if API unreliable.

---

#### 3. Vector Database Scaling Triggers

**Complexity:** Medium - Performance and cost implications at scale

**Key Challenges:**
- **pgvector vs. Pinecone decision:** NFR17 specifies migration at 100k queries/day, but query performance may degrade earlier with 100k+ embeddings.
- **Index optimization:** HNSW vs. IVFFlat trade-offs not evaluated. Wrong choice impacts query latency.
- **Storage costs:** 100k chunks × 1536 dimensions = significant storage. Cost projections needed.
- **Query latency at scale:** Target <3s response time (NFR2) must hold at 10k concurrent users (NFR7).

**Architect Action:** Establish monitoring for query latency and storage size. Define migration triggers with buffer (e.g., migrate at 70k queries/day, not 100k).

---

#### 4. Real-Time Drag-and-Drop Performance

**Complexity:** Medium - UX-critical interaction with many moving parts

**Key Challenges:**
- **Performance with 100+ law cards:** Drag-and-drop libraries (@dnd-kit, react-beautiful-dnd) may struggle with large card counts.
- **State management:** Dragging across components (Kanban → Chat) requires global state. Zustand vs. Jotai vs. React Context?
- **Mobile touch optimization:** Different interaction model than desktop drag. Needs separate implementation path.
- **Optimistic updates:** NFR requirement (Story 6.5) - rollback strategy if API fails?

**Architect Action:** Prototype drag-and-drop with 200 mock cards. Measure FPS and consider virtualization if performance issues.

---

#### 5. Daily Multi-Content-Type Change Detection at Scale

**Complexity:** High - Cron job processing 10k+ laws with AI generation

**Key Challenges:**
- **Job completion time:** Target <2 hours (NFR10) to process 10k laws. At 10 req/sec = 1,000 seconds (16 min) just for fetching. Diffing + AI summary generation adds significant time.
- **Parallel processing:** Need concurrency (Story 8.12 specifies 10 parallel) but must respect API rate limits.
- **AI summary generation latency:** Target <5 min per change (NFR11), but GPT-4 can be slow. Need batching strategy.
- **Error handling:** If job fails at law 7,000, how do we resume? Need checkpoint mechanism.

**Architect Action:** Design job with checkpoint/resume capability. Consider queueing system (BullMQ) for reliable processing. Monitor job runtime and optimize bottlenecks.

---

#### 6. Multi-Tenancy Data Isolation

**Complexity:** Medium-High - Security-critical for GDPR compliance

**Key Challenges:**
- **Row-Level Security (RLS):** Supabase RLS policies must be airtight. One misconfigured policy = data breach.
- **Query performance:** RLS adds overhead. Ensure indexes on workspace_id don't degrade performance.
- **Testing isolation:** How do we test that User A can't access User B's data? Need automated security tests.

**Architect Action:** Comprehensive RLS policy review. Automated tests for multi-tenancy isolation. Penetration testing before launch.

---

**Summary:** These 6 risk areas should be prioritized for prototyping and architectural planning. Each has potential to block MVP launch if not addressed early.

---

## Epic List

### Epic 1: Foundation & Core Infrastructure
**Goal:** Establish project foundation while delivering initial 100 public law pages to validate SEO strategy.

**Delivers:** Next.js app, database, auth, CI/CD, 100 law pages, monitoring, security

**Requirements covered:** NFR1, FR29, NFR6, NFR13, NFR22, NFR23

**Estimated stories:** 8-10

---

### Epic 2: Legal Content Foundation
**Goal:** Build comprehensive multi-source legal content database with 170,000+ public SEO-optimized pages covering Swedish laws, court precedent, and EU legislation. Provide category structure, search/discovery features, and begin recording law change history.

**Delivers:** 170,000+ legal content pages (SFS laws, court cases from HD/HovR/HFD/MÖD/MIG, EU regulations/directives), multi-content-type search, cross-document navigation, change history recording (no UI yet)

**Requirements covered:** FR1, FR4, FR8, FR24, FR35, FR36, FR37, NFR1

**Estimated stories:** 11

**Note:** Expanded from single-source (SFS laws only) to multi-content-type architecture based on competitive analysis. Court cases and EU legislation critical for SEO coverage.
---

### Epic 3: RAG-Powered AI Chat Interface
**Goal:** Implement zero-hallucination AI chatbot with drag-and-drop context building and citation-first responses.

**Delivers:** Vector database, AI chat UI, drag-and-drop, RAG responses, streaming, citations

**Requirements covered:** FR4, FR5, FR6, NFR2, NFR3, NFR9, NFR20, NFR24

**Estimated stories:** 10-12

---

### Epic 4: Dynamic Onboarding & Personalized Law Lists
**Goal:** Create conversion engine that transforms homepage visitors into trial users through AI-driven conversational onboarding, dynamic questioning, and two-phase comprehensive law list generation (60-80 laws).

**Delivers:** Onboarding widget, Bolagsverket integration, dynamic contextual questioning (3-5 AI-selected questions), two-phase streaming generation (Phase 1: 15-30 laws pre-signup, Phase 2: 45-65 laws post-signup background), trial signup, email verification

**Requirements covered:** FR2, FR3, FR21, FR23, FR30, NFR4, NFR5

**Estimated stories:** 12

---

### Epic 5: Workspace Management & Team Collaboration
**Goal:** Enable multi-user workspaces with subscription tiers, team invites, role-based access, and billing integration.

**Delivers:** Multi-tenancy, roles, invites, tiers, Stripe, usage tracking, workspace settings

**Requirements covered:** FR17, FR18, FR19, FR20, FR22, FR32, FR33, FR34, NFR18

**Estimated stories:** 10-12

---

### Epic 6: Compliance Workspace (Kanban + Dashboard)
**Goal:** Provide Jira-inspired Kanban board for visual compliance tracking and summary dashboard.

**Delivers:** Dashboard, Kanban, drag-and-drop cards, law card modal, task management

**Requirements covered:** FR7, FR27, FR28, FR25

**Estimated stories:** 8-10

---

### Epic 7: HR Module (Employee Management)
**Goal:** Connect employees to laws for context-aware HR compliance, improving AI chatbot value.

**Delivers:** Employee CRUD, CSV import, compliance status, kollektivavtal, drag to chat

**Requirements covered:** FR13, FR14, FR15, FR16, FR41, NFR4

**Estimated stories:** 10-12

---

### Epic 8: Change Monitoring & Notification System
**Goal:** Implement retention engine that automatically detects law changes and notifies users.

**Delivers:** Change detection, AI summaries, email/in-app notifications, diff view, reminders, weekly digest, timeline

**Requirements covered:** FR8, FR9, FR10, FR11, FR12, FR38, FR39, FR40, NFR10, NFR11, NFR26

**Estimated stories:** 10-12

---

**Total Estimated Stories:** 70-86 across 8 epics

**Estimated Timeline:** 16 weeks (4 months) - aligns with 4-6 month MVP goal

---

## Post-MVP Roadmap (Out of Scope)

The following features are **explicitly NOT included in the MVP** and are planned for post-MVP phases based on user feedback and business traction:

### Phase 2: Integration & Automation (Months 7-9)

**Fortnox OAuth Integration**
- One-click employee sync from Fortnox to Laglig.se
- Automatic schema mapping (FR41 lays foundation)
- **Rationale for deferral:** Requires Fortnox partnership negotiations, OAuth setup, and rigorous data sync testing. MVP validates core value proposition first.

**Slack/Teams Integration**
- Post law changes and AI insights to team channels
- Slash commands for quick AI queries
- **Rationale:** Nice-to-have for team collaboration, not critical for individual user value

### Phase 3: Public Sector Features (Months 10-12)

**Advanced Multi-Department Compliance**
- Department-specific law lists and workflows
- Cross-department audit trails
- Budget tracking for compliance activities
- **Rationale:** Public sector has unique procurement requirements; validate SMB/ISO consultant demand first

**Audit Report Generation**
- Automated compliance reports for auditors
- PDF export with evidence attachments
- **Rationale:** Complex feature requiring deep audit workflow understanding

### Phase 4: Mobile & Expansion (Months 13+)

**Native Mobile Apps**
- iOS and Android native apps
- Offline law access
- Push notifications
- **Rationale:** Web responsive sufficient for MVP; native apps require significant investment

**Multi-Language Support**
- English interface for international companies operating in Sweden
- Norwegian/Danish law databases (expansion)
- **Rationale:** Focus on Swedish market first; internationalization adds complexity

**Advanced Analytics Dashboard**
- Compliance trend analysis
- Team productivity metrics
- Custom reporting
- **Rationale:** Requires significant usage data; build after MVP establishes baseline

### Other Deferred Features

- **Browser Extension:** Quick law lookup from any webpage
- **API for Third-Party Integrations:** Public API for partners
- **White-Label Solution:** For large consultancies to rebrand
- **AI-Powered Compliance Recommendations:** Proactive task generation based on industry changes
- **Video Training Library:** Recorded webinars and tutorials

**Decision Criteria for Adding Features:**
- Feature must serve >30% of active users
- Clear ROI: Revenue impact or significant churn reduction
- Does not distract from core value proposition (law discovery + AI guidance + change monitoring)

---
## Epic 1: Foundation & Core Infrastructure (DETAILED)

**Goal:** Establish project foundation (Next.js app, database, auth, deployment pipeline) while delivering initial public law pages to validate SEO strategy.

**Value Delivered:** Working application infrastructure + 100 public law pages generating early SEO traffic + ability to deploy features continuously.

---

### Story 1.1: Initialize Next.js 14 Project with TypeScript and Tailwind

**As a** developer,
**I want** to set up a Next.js 14 project with TypeScript, Tailwind CSS, and essential tooling,
**so that** I have a modern development environment ready for rapid feature development.

**Acceptance Criteria:**

1. Next.js 14+ installed with App Router (not Pages Router)
2. TypeScript configured with strict mode enabled
3. Tailwind CSS installed and configured with custom color tokens (primary, success, warning, error)
4. ESLint + Prettier configured for code quality and formatting
5. Git repository initialized with `.gitignore` (exclude `node_modules`, `.env.local`, `.next`)
6. Project runs locally with `npm run dev` showing default Next.js homepage
7. No build errors or TypeScript warnings

---

### Story 1.2: Set Up Supabase PostgreSQL Database with Prisma ORM

**As a** developer,
**I want** to connect to Supabase PostgreSQL and configure Prisma ORM,
**so that** I have a type-safe database layer for all data operations.

**Acceptance Criteria:**

1. Supabase project created (free tier) with PostgreSQL database
2. Prisma installed and initialized
3. Database connection string configured in `.env.local`
4. Initial Prisma schema created with User and Workspace models
5. First migration generated and applied successfully
6. Prisma Client generated with TypeScript types
7. Database connection tested successfully
8. pgvector extension enabled in Supabase

---

### Story 1.3: Implement Authentication (Supabase Auth + NextAuth.js)

**As a** user,
**I want** to sign up and log in using email/password, Google, or Microsoft,
**so that** I can access my personalized workspace.

**Acceptance Criteria:**

1. Supabase Auth configured with email/password provider
2. Google OAuth provider configured
3. Microsoft OAuth provider configured
4. NextAuth.js integrated for session management
5. Login page with email/password form and OAuth buttons
6. Sign-up page with password complexity validation
7. Email verification flow (6-digit code)
8. Password reset flow
9. Protected routes redirect to login if not authenticated
10. Session cookies set with 30-day expiration, HTTP-only
11. User profile accessible at `/api/auth/me`

---

### Story 1.4: Deploy to Vercel with CI/CD Pipeline

**As a** developer,
**I want** to automatically deploy to Vercel on every push to main,
**so that** I can continuously deliver features without manual deployment.

**Acceptance Criteria:**

1. Vercel project created and linked to GitHub
2. Automatic deployments for main branch (production)
3. Preview deployments for all PRs
4. Environment variables configured in Vercel
5. Build succeeds without errors
6. Production URL accessible
7. GitHub Actions workflow runs: ESLint, TypeScript, Prettier
8. Failed checks block PR merges

---

### Story 1.5: Create Initial Law Pages (SSR for SEO) - 100 Laws

**As a** visitor,
**I want** to view Swedish laws on public pages optimized for Google,
**so that** I can discover Laglig.se through organic search.

**Acceptance Criteria:**

1. Riksdagen API integration fetches 100 SFS laws
2. Law data stored in laws table
3. Dynamic route `/alla-lagar/[lawSlug]` renders law pages
4. Law pages use SSR for SEO
5. Each page includes: title, SFS number, full text, published date
6. Meta tags configured (title, description, Open Graph)
7. Sitemap.xml generated listing all 100 laws
8. Robots.txt allows all crawlers
9. Core Web Vitals meet "Good" thresholds
10. Pages render correctly on desktop and mobile

---

### Story 1.6: Set Up Error Tracking and Logging (Sentry)

**As a** developer,
**I want** to automatically capture errors in production,
**so that** I can debug issues without manual reports.

**Acceptance Criteria:**

1. Sentry account created
2. Sentry SDK installed
3. Sentry initialized in client and server configs
4. Source maps uploaded to Sentry
5. Test error captured successfully in dashboard
6. Error reports include: stack trace, user context, environment
7. Email alerts for critical errors
8. Sentry integrated with Vercel

---

### Story 1.7: Implement Security Headers (CSP, X-Frame-Options)

**As a** security-conscious product owner,
**I want** to protect users from XSS and clickjacking,
**so that** the application meets security best practices.

**Acceptance Criteria:**

1. CSP header configured in Next.js middleware
2. CSP allows: self, Vercel, Supabase, OpenAI
3. CSP blocks: inline scripts (except nonce), eval(), data: URIs
4. X-Frame-Options: DENY header set
5. X-Content-Type-Options: nosniff header set
6. Referrer-Policy: strict-origin-when-cross-origin set
7. Security headers tested with securityheaders.com (score A/A+)
8. No CSP violations in browser console

---

### Story 1.8: Set Up Input Validation (Zod Schemas)

**As a** developer,
**I want** to validate all user inputs server-side with type-safe schemas,
**so that** I prevent injection attacks.

**Acceptance Criteria:**

1. Zod library installed
2. Validation schemas created for user signup/login
3. API routes validate request bodies using Zod
4. Example: POST `/api/auth/signup` validates email format, password complexity
5. Validation errors return clear messages
6. No raw user input passed to database queries
7. XSS prevention: React auto-escapes, no dangerouslySetInnerHTML

---

### Story 1.9: Create Landing Page with Hero Section

**As a** visitor,
**I want** to understand Laglig.se's value proposition on the homepage,
**so that** I can decide if the product is right for me.

**Acceptance Criteria:**

1. Homepage renders with hero section
2. Headline: "Vi håller koll på lagarna – du håller koll på affären"
3. Subheadline: "AI-driven lagefterlevnad..."
4. Primary CTA: "Se din laglista"
5. Secondary CTA: "Utforska funktioner"
6. Hero visual: placeholder image or gradient
7. Legal disclaimer in footer
8. Navigation bar: Logo, Features, Pricing, About, Login, Sign up
9. Mobile-responsive (320px-1920px)
10. Page loads in <2 seconds

---

### Story 1.10: Configure Monitoring and Analytics (Vercel Analytics)

**As a** product owner,
**I want** to track page views and Core Web Vitals,
**so that** I can measure SEO performance and engagement.

**Acceptance Criteria:**

1. Vercel Analytics enabled
2. Analytics tracking code added to app/layout.tsx
3. Dashboard shows: page views, unique visitors, top pages
4. Core Web Vitals tracked: LCP, FID, CLS, TTFB
5. Analytics data accessible in Vercel dashboard
6. No GDPR issues (Vercel Analytics is cookieless)

---

**Epic 1 Complete: 10 stories, 3-4 weeks estimated**
## Epic 2: Legal Content Foundation (DETAILED)

**Goal:** Build comprehensive multi-source legal content database with 170,000+ public SEO-optimized pages covering Swedish laws, court precedent, and EU legislation. Provide category structure, search/discovery features, and begin recording law change history for future retention features.

**Content Types (MVP):**
- **Swedish Laws (SFS):** 50,000-100,000 pages - Riksdagen API
- **Swedish Court Cases:** 9,000-16,000 pages - Domstolsverket API
  - HD (Supreme Court): 3,000-5,000 cases
  - HovR (Courts of Appeal): 1,500-3,000 cases
  - HFD (Supreme Administrative Court): 1,500-3,000 cases
  - MÖD (Environmental Court): 600-1,200 cases [Post-MVP: Industry-specific]
  - MIG (Migration Court): 200-500 cases [Post-MVP: Industry-specific]
- **EU Legislation:** 110,000+ pages - EUR-Lex API
  - EU Regulations: 100,000+ pages
  - EU Directives: 10,000-15,000 pages

**Total MVP Pages:** ~170,000-225,000 legal content pages

**Excluded from MVP (Post-MVP/Phase 2):**
- AD (Labour Court) - Data source quality issues, revisit post-MVP
- Propositioner (Government Bills) - Phase 2 professional tier
- EU Court Cases - Phase 2 for legal interpretation
- SOU/Ds (Preparatory Works) - Low SMB value, Phase 3 or skip

**Value Delivered:** Comprehensive multi-content-type legal library driving massive SEO traffic (170K+ indexable pages) + discovery tools enabling users to find relevant laws, court precedent, and EU compliance requirements + cross-document navigation (laws ↔ cases ↔ EU directives) + historical data collection for Epic 8.
---

### Story 2.1: Design Multi-Content-Type Data Model

**As a** developer,
**I want** to create a flexible database schema supporting multiple legal document types,
**so that** we can store SFS laws, court cases, and EU legislation with type-specific metadata.

**Acceptance Criteria:**

1. `ContentType` enum created with values: SFS_LAW, HD_SUPREME_COURT, HOVR_COURT_APPEAL, HFD_ADMIN_SUPREME, MOD_ENVIRONMENT_COURT, MIG_MIGRATION_COURT, EU_REGULATION, EU_DIRECTIVE
2. `legal_documents` table created with polymorphic schema:
   - id (UUID), content_type (ContentType), document_number (VARCHAR unique), title (TEXT)
   - summary (TEXT), full_text (TEXT), effective_date (DATE), publication_date (DATE)
   - status (DocumentStatus enum), source_url (TEXT), metadata (JSONB)
   - search_vector (tsvector), embedding (vector(1536))
3. Type-specific tables created:
   - `court_cases` (document_id, court_name, case_number, lower_court, decision_date, parties JSONB)
   - `eu_documents` (document_id, celex_number, eut_reference, national_implementation_measures JSONB)
4. `cross_references` table created (source_document_id, target_document_id, reference_type, context)
5. `amendments` table created for SFS laws with **enhanced metadata from competitive analysis**:
   - base_document_id, amending_document_id (relations to legal_documents)
   - amending_law_title (full title: "Lag (2025:732) om ändring i...")
   - publication_date (when amending law published), effective_date (when takes effect, can be future)
   - affected_sections_raw (Notisum format: "ändr. 6 kap. 17 §; upph. 8 kap. 4 §")
   - affected_sections (JSON: {amended: ["6:17"], repealed: ["8:4"], new: [], renumbered: []})
   - summary (2-3 sentence GPT-4 generated plain language summary)
   - summary_generated_by (enum: GPT_4, HUMAN, SFSR, RIKSDAGEN)
   - detected_method (enum: RIKSDAGEN_TEXT_PARSING, LAGEN_NU_SCRAPING, SFSR_REGISTER, LAGRUMMET_RINFO)
   - metadata (JSONB for debugging), created_at, updated_at
   - **See `docs/notisum-amendment-competitive-analysis.md` for feature parity rationale**
6. `document_subjects` table created (document_id, subject_code, subject_name) for categorization
7. Prisma schema updated with all models and relations
8. Migration generated and applied successfully
9. TypeScript types generated for all models
10. Test data inserted for each content type validates schema

---

### Story 2.2: Ingest 11,351 SFS Laws (1968-Present) from Riksdagen API

**As a** developer,
**I want** to fetch all SFS laws from Riksdagen API and store them in the database,
**so that** we have complete Swedish legal content for the platform.

**Acceptance Criteria:**

1. Node script created to fetch all SFS documents from Riksdagen API
2. Script fetches: title, SFS number, full text, published date, ministry, metadata
3. Rate limiting implemented (conservative 5 requests/second to respect API limits)
4. Data stored in `legal_documents` table with content_type = SFS_LAW
5. SFS-specific metadata stored in `metadata` JSONB field: ministry, law_type (lag/förordning), abbreviations
6. Script handles pagination for 11,351 documents (1968-present coverage)
7. Duplicate detection: Skip laws already in database (by document_number)
8. Error handling: Retry failed requests 3x before logging to Sentry
9. Progress logging: "Processed 5,000/11,351 laws..."
10. Script completes full ingestion in <48 hours (multi-day background job acceptable - ~38 hours estimated at 5 req/sec)
11. Verification: Database contains 11,351 SFS documents (1968-present) after completion
12. **Note:** Riksdagen API provides laws from 1968-present. Pre-1968 laws rarely relevant for SMB compliance. Can add Lagrummet as fallback source in Phase 2 if historical laws requested.
12. **Amendment extraction** (competitive feature - see `docs/historical-amendment-tracking-strategy.md`):
    - For EACH SFS law, parse inline amendment references from full text (e.g., "Lag (2021:1112)")
    - Create Amendment records linking original law → amending law
    - Fetch amending law metadata (already in database from Step 1)
    - Parse affected sections from amending law text: "föreskrivs att 1 kap. 3 § ska ha följande lydelse"
    - Generate 2-3 sentence summary with GPT-4 (Swedish, plain language)
    - Parse effective date from transition provisions: "träder i kraft den 1 juli 2011"
    - Store all 7 data points per amendment (SFS number, title, pub date, affected sections, summary, effective date, user comments placeholder)
13. **Amendment backfill** from lagen.nu (background job, separate from main ingestion):
    - For laws with <5 amendments (suspected incomplete), scrape lagen.nu for complete list
    - Rate limit: 1 request per 2 seconds (respectful)
    - Run as separate background job, does not block main ingestion
14. **Cost impact:** One-time GPT-4 cost ~$238 for summarizing 5,675 amending laws (2,600 tokens × $0.042/amendment)
15. **Performance impact:** +1.6 hours for amendment parsing (regex + text processing), +1.3 hours for lagen.nu backfill
16. **Database impact:** +90,000 Amendment records with full metadata (~45MB storage)
17. Verification: Database contains 90,000+ Amendment records after completion with all 7 fields populated

---

### Story 2.3: Ingest Swedish Court Cases from Domstolsverket API

**As a** developer,
**I want** to fetch court cases from AD, HFD, HD, and HovR (priority order),
**so that** we have comprehensive Swedish case law precedent.

**Acceptance Criteria:**

1. Integration with Domstolsverket PUH API endpoint (verify availability)
2. Node script created to fetch cases from multiple courts (priority order):
   - **AD (Arbetsdomstolen / Labour Court):** AD series - **PRIORITY #1** (employment law - critical for all employers)
   - HFD (Högsta Förvaltningsdomstolen / Supreme Administrative Court): HFD/RÅ series - Priority #2 (tax/administrative law)
   - HD (Högsta Domstolen / Supreme Court): NJA series - Priority #3 (general civil/criminal law)
   - HovR (Hovrätterna / Courts of Appeal): RH series - Priority #4 (practical precedent)
3. For each court, script fetches: case number, decision date, court name, summary, full text, lower court (if available), parties (extract from full text)
4. Data stored in `legal_documents` table with appropriate content_type (AD_LABOUR_COURT, HFD_ADMIN_SUPREME, HD_SUPREME_COURT, HOVR_COURT_APPEAL)
5. Court-specific metadata stored in `court_cases` table
6. Case numbering formats preserved (AD YYYY nr N, HFD YYYY ref N, NJA YYYY s NN, RH YYYY:N)
7. Script extracts cross-references to cited SFS laws from `lagrumLista` field and stores in `cross_references` table
8. Rate limiting per API guidelines (conservative 5 req/sec recommended)
9. Progress logging per court: "AD: 500/2,500 cases, HFD: 300/2,000 cases, HD: 400/4,000 cases, HovR: 200/1,500 cases..."
10. Error handling with retry logic
11. Script completes in <12 hours for all four courts (run as multi-day background job if needed)
12. Verification: Database contains 10,000-20,000 court cases after completion (increased from 6-11K to include AD)
13. **Competitive Advantage:** AD data is working in Domstolsverket PUH API (Notisum's AD coverage is broken - empty case pages). This gives us THE MOST CRITICAL court for employers that competitors cannot provide.

---

### Story 2.4: Ingest EU Regulations and Directives from EUR-Lex API

**As a** developer,
**I want** to fetch EU regulations and directives in Swedish from EUR-Lex,
**so that** we have comprehensive EU compliance content.

**Acceptance Criteria:**

1. Integration with EUR-Lex SPARQL/REST API
2. Node script created to fetch EU documents in Swedish:
   - Regulations: CELEX format 3YYYYRNNNN
   - Directives: CELEX format 3YYYYLNNNN
3. Script fetches: CELEX number, EU document number, title (Swedish), full text (Swedish), publication date, entry into force date, EUT reference
4. Data stored in `legal_documents` table with content_type EU_REGULATION or EU_DIRECTIVE
5. EU-specific metadata stored in `eu_documents` table
6. For directives, fetch National Implementation Measures (NIM) from EUR-Lex NIM database
7. NIM data stored in `eu_documents.national_implementation_measures` JSONB field
8. Script extracts cross-references between EU directives and Swedish implementing SFS laws
9. Cross-references stored in `cross_references` table
10. Rate limiting per EUR-Lex API guidelines
11. Progress logging: "Regulations: 10,000/100,000, Directives: 1,000/10,000..."
12. Script completes in <12 hours for all EU documents
13. Verification: Database contains 110,000+ EU documents after completion

---

### Story 2.5: Generate SEO-Optimized Pages for All Content Types

**As a** visitor,
**I want** to view any legal document (law, court case, EU regulation) on a public, SEO-optimized page,
**so that** I can discover Laglig.se through Google search.

**Acceptance Criteria:**

1. Dynamic routes created for each content type:
   - `/lagar/[lawSlug]` for SFS laws
   - `/rattsfall/hd/[caseSlug]` for HD cases
   - `/rattsfall/hovr/[caseSlug]` for HovR cases
   - `/rattsfall/hfd/[caseSlug]` for HFD cases
   - `/eu/forordningar/[regSlug]` for EU regulations
   - `/eu/direktiv/[dirSlug]` for EU directives
2. All pages use Server-Side Rendering (SSR) for SEO
3. URL slugs generated from titles + document numbers
4. Each page displays type-appropriate content:
   - SFS: Law title, SFS number, full text, effective date, amendments
   - Court cases: Case number, court, decision date, summary, full judgment, cited laws
   - EU: Document number, CELEX, title, full text, national implementation (directives)
5. Meta tags optimized per content type
6. Structured data (JSON-LD) for legal documents and court cases
7. Sitemap.xml auto-generated listing ALL 170,000+ pages (split into multiple sitemaps if needed)
8. Canonical URLs set for all content types
9. Core Web Vitals: LCP <2.5s, CLS <0.1, FID <100ms
10. Mobile-responsive layout for all content types
11. Legal disclaimer in footer: "AI-assisted guidance, not legal advice"

---

### Story 2.6: Implement Content Type-Specific Categorization

**As a** visitor,
**I want** to browse legal content by category and content type,
**so that** I can discover relevant laws, court cases, and EU regulations for my needs.

**Acceptance Criteria:**

1. 10 top-level subject categories defined: Arbetsrätt, Dataskydd, Skatterätt, Bolagsrätt, Miljö & Bygg, Livsmedel & Hälsa, Finans, Immaterialrätt, Konsumentskydd, Transport & Logistik
2. AI categorization script uses GPT-4 to classify ALL document types
3. Categorization prompt adapted per content type:
   - SFS laws: title + first 500 chars → category + B2B/Private/Both
   - Court cases: case summary + decision → category + subject tags
   - EU documents: title + recitals → category + industry applicability
4. Categories stored in `document_subjects` table
5. Category pages created for each content type:
   - `/lagar/kategorier/arbetsratt` - SFS laws in category
   - `/rattsfall/kategorier/arbetsratt` - Court cases in category
   - `/eu/kategorier/arbetsratt` - EU legislation in category
6. Document count shown per category per type
7. Category pages SEO-optimized with meta tags
8. Verification: All 170,000+ documents have assigned categories
9. Manual review of 100 random categorizations (mixed types) shows >90% accuracy
10. Content type filter on category pages: "Show only: Laws | Court Cases | EU Legislation"

---

### Story 2.7: Build Multi-Content-Type Search and Filtering

**As a** user,
**I want** to search across all legal content types with filtering,
**so that** I can quickly find specific laws, court precedent, or EU regulations.

**Acceptance Criteria:**

1. Unified search page created: `/sok` (search)
2. Full-text search implemented using PostgreSQL `tsvector` across all content types
3. Search queries match: titles, document numbers, full text, summaries
4. Search results display mixed content types with clear type badges
5. Each result shows: title, document number, content type, category, snippet
6. Results ranked by relevance using weighted ranking:
   - Title match: weight 1.0
   - Document number match: weight 0.9
   - Full text match: weight 0.5
7. Filters available:
   - Content Type (Laws, HD Cases, HovR Cases, HFD Cases, EU Regulations, EU Directives)
   - Category (Arbetsrätt, Dataskydd, etc.)
   - Business Type (B2B/Private/Both)
   - Date Range (publication date)
8. Search performance <800ms for 170,000+ documents
9. Pagination (20 results per page)
10. No results state with suggestions
11. Mobile-responsive search interface
12. Search analytics tracked (query, results count, clicks)

---

### Story 2.8: Implement Cross-Document Navigation System

**As a** user,
**I want** to navigate between related documents (law → cases citing it → EU directive requiring it),
**so that** I understand the complete legal landscape.

**Acceptance Criteria:**

1. SFS law pages display "Referenced in Court Cases" section showing all court cases that cite this law
2. Court case pages display "Cited Laws" section showing all SFS laws cited in the judgment
3. EU directive pages display "Swedish Implementation" section showing SFS laws implementing the directive
4. SFS law pages display "Implements EU Directive" section if law is implementing EU law
5. Cross-references automatically extracted during ingestion (Stories 2.2, 2.3, 2.4)
6. Manual cross-reference creation interface for authenticated users (link documents)
7. Bidirectional navigation works (A → B means B → A link appears)
8. Cross-reference links show context snippet: "This case interprets § 7 regarding..."
9. Cross-reference counts shown: "Referenced in 12 court cases"
10. Mobile-responsive cross-reference sections
11. Verification: Sample SFS law shows all expected court case references

---

### Story 2.9: Create SNI Code-Based Multi-Content Discovery

**As a** visitor,
**I want** to enter my industry code (SNI) and see all relevant legal content,
**so that** I understand my sector's complete compliance landscape (laws + court precedent + EU regulations).

**Acceptance Criteria:**

1. SNI discovery page created: `/upptack-lagar/bransch` (discover laws/industry)
2. Input field for SNI code (5 digits)
3. SNI code validation (format: XXXXX)
4. Industry starter packs created for 15 common sectors
5. Each starter pack contains curated mix of content types:
   - 12-25 SFS laws relevant to industry
   - 3-8 key court cases showing precedent
   - 5-12 EU regulations/directives affecting industry
6. Results page shows tabbed view:
   - "Lagar" tab: SFS laws
   - "Rättsfall" tab: Court cases with brief summaries
   - "EU-lagstiftning" tab: EU regulations and directives
7. Each tab sortable by relevance, date, category
8. "Lägg till i Min Lista" (Add to My List) CTA requires authentication
9. SEO-optimized pages for each industry: `/upptack-lagar/bransch/bygg-och-anlaggning`
10. SNI → content mapping stored in database
11. Mobile-responsive layout with tab navigation

---

### Story 2.10: Implement Content Type-Specific RAG Chunking Strategies

**As a** developer,
**I want** to chunk different content types appropriately for RAG embeddings,
**so that** semantic search retrieves optimal context for each document type.

**Acceptance Criteria:**

1. Chunking strategy configuration defined per content type:
   - **SFS laws:** Chunk by § (section), preserve chapter context, max 500 tokens
   - **Court cases:** Chunk by semantic section (Facts, Analysis, Conclusion), max 800 tokens
   - **EU regulations:** Chunk by article, preserve preamble context, max 500 tokens
   - **EU directives:** Chunk by article, preserve recitals context, max 500 tokens
2. Metadata preserved in each chunk:
   - SFS: chapter number, section number, law title
   - Court case: court name, case number, section type (Facts/Analysis/Conclusion)
   - EU: article number, CELEX, document type
3. Chunk overlap configured: 50 tokens overlap between adjacent chunks
4. Embedding generation script processes all 170,000+ documents
5. Embeddings generated using OpenAI `text-embedding-3-small` (1536 dimensions)
6. Embeddings stored in `legal_documents.embedding` vector field
7. Vector index created (HNSW) for fast similarity search
8. Script handles rate limits (max 1,000 requests/minute)
9. Progress logging per content type: "SFS: 5,000/50,000, HD: 200/3,000..."
10. Script completes in <16 hours for all content types
11. Test query: "employee sick leave rights" returns relevant chunks from SFS laws AND court cases
12. Verification: Database contains 100,000-200,000 chunk embeddings

---

### Story 2.11: Begin Recording Multi-Content-Type Change History

**As a** product owner,
**I want** to start collecting change history for ALL content types NOW (even without UI),
**so that** by Epic 8, we have 10+ weeks of historical data.

**Acceptance Criteria:**

1. Daily cron job created (runs 00:00 UTC)
2. Job monitors changes across all content types:
   - **SFS laws:** Check for new amendments, repeals, title changes
   - **Court cases:** Check for new published cases (HD, HovR, HFD)
   - **EU regulations/directives:** Check for new EU legislation, amendments
3. For each content type, compare current version to previous version
4. Detect changes:
   - New documents added (new SFS, new court cases, new EU acts)
   - Content changes (SFS amendments, corrected court case text)
   - Status changes (SFS repealed, EU directive superseded)
5. Changes stored in `content_changes` table: id, document_id, change_type, old_value, new_value, detected_at, content_type
6. No user-facing UI (background data collection)
7. Job logs: "Detected 45 changes today: 12 new SFS, 8 new court cases, 25 new EU acts"
8. Errors logged to Sentry
9. Job completes in <3 hours
10. Database accumulates change history silently
11. Verification: After 2 weeks, database contains change records for all content types
12. Change detection tested: Mock SFS amendment detected correctly
13. **NEW: Amendment enrichment** when SFS changes detected (competitive feature):
    - For new/updated SFS laws, extract amendment references from full text
    - Parse affected sections: "föreskrivs att 1 kap. 3 § ska ha följande lydelse"
    - Generate 2-3 sentence GPT-4 summary in Swedish (plain language)
    - Parse effective date from transition provisions
    - Create/update Amendment records with all 7 fields
    - Cost: ~$0.42/month for ~10 new amendments detected nightly
    - See `docs/historical-amendment-tracking-strategy.md` Section 12.5 for implementation

---

**Epic 2 Complete: 11 stories, 4-5 weeks estimated**
**As a** developer,
**I want** to create a flexible database schema supporting multiple legal document types,
**so that** we can store SFS laws, court cases, and EU legislation with type-specific metadata.

**Acceptance Criteria:**

1. `ContentType` enum created with values: SFS_LAW, HD_SUPREME_COURT, HOVR_COURT_APPEAL, HFD_ADMIN_SUPREME, MOD_ENVIRONMENT_COURT, MIG_MIGRATION_COURT, EU_REGULATION, EU_DIRECTIVE
2. `legal_documents` table created with polymorphic schema:
   - id (UUID), content_type (ContentType), document_number (VARCHAR unique), title (TEXT)
   - summary (TEXT), full_text (TEXT), effective_date (DATE), publication_date (DATE)
   - status (DocumentStatus enum), source_url (TEXT), metadata (JSONB)
   - search_vector (tsvector), embedding (vector(1536))
3. Type-specific tables created:
   - `court_cases` (document_id, court_name, case_number, lower_court, decision_date, parties JSONB)
   - `eu_documents` (document_id, celex_number, eut_reference, national_implementation_measures JSONB)
4. `cross_references` table created (source_document_id, target_document_id, reference_type, context)
5. `amendments` table created for SFS laws with **enhanced metadata from competitive analysis**:
   - base_document_id, amending_document_id (relations to legal_documents)
   - amending_law_title (full title: "Lag (2025:732) om ändring i...")
   - publication_date (when amending law published), effective_date (when takes effect, can be future)
   - affected_sections_raw (Notisum format: "ändr. 6 kap. 17 §; upph. 8 kap. 4 §")
   - affected_sections (JSON: {amended: ["6:17"], repealed: ["8:4"], new: [], renumbered: []})
   - summary (2-3 sentence GPT-4 generated plain language summary)
   - summary_generated_by (enum: GPT_4, HUMAN, SFSR, RIKSDAGEN)
   - detected_method (enum: RIKSDAGEN_TEXT_PARSING, LAGEN_NU_SCRAPING, SFSR_REGISTER, LAGRUMMET_RINFO)
   - metadata (JSONB for debugging), created_at, updated_at
   - **See `docs/notisum-amendment-competitive-analysis.md` for feature parity rationale**
6. `document_subjects` table created (document_id, subject_code, subject_name) for categorization
7. Prisma schema updated with all models and relations
8. Migration generated and applied successfully
9. TypeScript types generated for all models
10. Test data inserted for each content type validates schema

---

### Story 2.2: Ingest 11,351 SFS Laws (1968-Present) from Riksdagen API

**As a** developer,
**I want** to fetch all SFS laws from Riksdagen API and store them in the database,
**so that** we have complete Swedish legal content for the platform.

**Acceptance Criteria:**

1. Node script created to fetch all SFS documents from Riksdagen API
2. Script fetches: title, SFS number, full text, published date, ministry, metadata
3. Rate limiting implemented (conservative 5 requests/second to respect API limits)
4. Data stored in `legal_documents` table with content_type = SFS_LAW
5. SFS-specific metadata stored in `metadata` JSONB field: ministry, law_type (lag/förordning), abbreviations
6. Script handles pagination for 11,351 documents (1968-present coverage)
7. Duplicate detection: Skip laws already in database (by document_number)
8. Error handling: Retry failed requests 3x before logging to Sentry
9. Progress logging: "Processed 5,000/11,351 laws..."
10. Script completes full ingestion in <48 hours (multi-day background job acceptable - ~38 hours estimated at 5 req/sec)
11. Verification: Database contains 11,351 SFS documents (1968-present) after completion
12. **Note:** Riksdagen API provides laws from 1968-present. Pre-1968 laws rarely relevant for SMB compliance. Can add Lagrummet as fallback source in Phase 2 if historical laws requested.
12. **Amendment extraction** (competitive feature - see `docs/historical-amendment-tracking-strategy.md`):
    - For EACH SFS law, parse inline amendment references from full text (e.g., "Lag (2021:1112)")
    - Create Amendment records linking original law → amending law
    - Fetch amending law metadata (already in database from Step 1)
    - Parse affected sections from amending law text: "föreskrivs att 1 kap. 3 § ska ha följande lydelse"
    - Generate 2-3 sentence summary with GPT-4 (Swedish, plain language)
    - Parse effective date from transition provisions: "träder i kraft den 1 juli 2011"
    - Store all 7 data points per amendment (SFS number, title, pub date, affected sections, summary, effective date, user comments placeholder)
13. **Amendment backfill** from lagen.nu (background job, separate from main ingestion):
    - For laws with <5 amendments (suspected incomplete), scrape lagen.nu for complete list
    - Rate limit: 1 request per 2 seconds (respectful)
    - Run as separate background job, does not block main ingestion
14. **Cost impact:** One-time GPT-4 cost ~$238 for summarizing 5,675 amending laws (2,600 tokens × $0.042/amendment)
15. **Performance impact:** +1.6 hours for amendment parsing (regex + text processing), +1.3 hours for lagen.nu backfill
16. **Database impact:** +90,000 Amendment records with full metadata (~45MB storage)
17. Verification: Database contains 90,000+ Amendment records after completion with all 7 fields populated

---

### Story 2.3: Ingest Swedish Court Cases from Domstolsverket API

**As a** developer,
**I want** to fetch court cases from AD, HFD, HD, and HovR (priority order),
**so that** we have comprehensive Swedish case law precedent.

**Acceptance Criteria:**

1. Integration with Domstolsverket PUH API endpoint (verify availability)
2. Node script created to fetch cases from multiple courts (priority order):
   - **AD (Arbetsdomstolen / Labour Court):** AD series - **PRIORITY #1** (employment law - critical for all employers)
   - HFD (Högsta Förvaltningsdomstolen / Supreme Administrative Court): HFD/RÅ series - Priority #2 (tax/administrative law)
   - HD (Högsta Domstolen / Supreme Court): NJA series - Priority #3 (general civil/criminal law)
   - HovR (Hovrätterna / Courts of Appeal): RH series - Priority #4 (practical precedent)
3. For each court, script fetches: case number, decision date, court name, summary, full text, lower court (if available), parties (extract from full text)
4. Data stored in `legal_documents` table with appropriate content_type (AD_LABOUR_COURT, HFD_ADMIN_SUPREME, HD_SUPREME_COURT, HOVR_COURT_APPEAL)
5. Court-specific metadata stored in `court_cases` table
6. Case numbering formats preserved (AD YYYY nr N, HFD YYYY ref N, NJA YYYY s NN, RH YYYY:N)
7. Script extracts cross-references to cited SFS laws from `lagrumLista` field and stores in `cross_references` table
8. Rate limiting per API guidelines (conservative 5 req/sec recommended)
9. Progress logging per court: "AD: 500/2,500 cases, HFD: 300/2,000 cases, HD: 400/4,000 cases, HovR: 200/1,500 cases..."
10. Error handling with retry logic
11. Script completes in <12 hours for all four courts (run as multi-day background job if needed)
12. Verification: Database contains 10,000-20,000 court cases after completion (increased from 6-11K to include AD)
13. **Competitive Advantage:** AD data is working in Domstolsverket PUH API (Notisum's AD coverage is broken - empty case pages). This gives us THE MOST CRITICAL court for employers that competitors cannot provide.

---

### Story 2.4: Ingest EU Regulations and Directives from EUR-Lex API

**As a** developer,
**I want** to fetch EU regulations and directives in Swedish from EUR-Lex,
**so that** we have comprehensive EU compliance content.

**Acceptance Criteria:**

1. Integration with EUR-Lex SPARQL/REST API
2. Node script created to fetch EU documents in Swedish:
   - Regulations: CELEX format 3YYYYRNNNN
   - Directives: CELEX format 3YYYYLNNNN
3. Script fetches: CELEX number, EU document number, title (Swedish), full text (Swedish), publication date, entry into force date, EUT reference
4. Data stored in `legal_documents` table with content_type EU_REGULATION or EU_DIRECTIVE
5. EU-specific metadata stored in `eu_documents` table
6. For directives, fetch National Implementation Measures (NIM) from EUR-Lex NIM database
7. NIM data stored in `eu_documents.national_implementation_measures` JSONB field
8. Script extracts cross-references between EU directives and Swedish implementing SFS laws
9. Cross-references stored in `cross_references` table
10. Rate limiting per EUR-Lex API guidelines
11. Progress logging: "Regulations: 10,000/100,000, Directives: 1,000/10,000..."
12. Script completes in <12 hours for all EU documents
13. Verification: Database contains 110,000+ EU documents after completion

---

### Story 2.5: Generate SEO-Optimized Pages for All Content Types

**As a** visitor,
**I want** to view any legal document (law, court case, EU regulation) on a public, SEO-optimized page,
**so that** I can discover Laglig.se through Google search.

**Acceptance Criteria:**

1. Dynamic routes created for each content type:
   - `/lagar/[lawSlug]` for SFS laws
   - `/rattsfall/hd/[caseSlug]` for HD cases
   - `/rattsfall/hovr/[caseSlug]` for HovR cases
   - `/rattsfall/hfd/[caseSlug]` for HFD cases
   - `/eu/forordningar/[regSlug]` for EU regulations
   - `/eu/direktiv/[dirSlug]` for EU directives
2. All pages use Server-Side Rendering (SSR) for SEO
3. URL slugs generated from titles + document numbers
4. Each page displays type-appropriate content:
   - SFS: Law title, SFS number, full text, effective date, amendments
   - Court cases: Case number, court, decision date, summary, full judgment, cited laws
   - EU: Document number, CELEX, title, full text, national implementation (directives)
5. Meta tags optimized per content type
6. Structured data (JSON-LD) for legal documents and court cases
7. Sitemap.xml auto-generated listing ALL 170,000+ pages (split into multiple sitemaps if needed)
8. Canonical URLs set for all content types
9. Core Web Vitals: LCP <2.5s, CLS <0.1, FID <100ms
10. Mobile-responsive layout for all content types
11. Legal disclaimer in footer: "AI-assisted guidance, not legal advice"

---

### Story 2.6: Implement Content Type-Specific Categorization

**As a** visitor,
**I want** to browse legal content by category and content type,
**so that** I can discover relevant laws, court cases, and EU regulations for my needs.

**Acceptance Criteria:**

1. 10 top-level subject categories defined: Arbetsrätt, Dataskydd, Skatterätt, Bolagsrätt, Miljö & Bygg, Livsmedel & Hälsa, Finans, Immaterialrätt, Konsumentskydd, Transport & Logistik
2. AI categorization script uses GPT-4 to classify ALL document types
3. Categorization prompt adapted per content type:
   - SFS laws: title + first 500 chars → category + B2B/Private/Both
   - Court cases: case summary + decision → category + subject tags
   - EU documents: title + recitals → category + industry applicability
4. Categories stored in `document_subjects` table
5. Category pages created for each content type:
   - `/lagar/kategorier/arbetsratt` - SFS laws in category
   - `/rattsfall/kategorier/arbetsratt` - Court cases in category
   - `/eu/kategorier/arbetsratt` - EU legislation in category
6. Document count shown per category per type
7. Category pages SEO-optimized with meta tags
8. Verification: All 170,000+ documents have assigned categories
9. Manual review of 100 random categorizations (mixed types) shows >90% accuracy
10. Content type filter on category pages: "Show only: Laws | Court Cases | EU Legislation"

---

### Story 2.7: Build Multi-Content-Type Search and Filtering

**As a** user,
**I want** to search across all legal content types with filtering,
**so that** I can quickly find specific laws, court precedent, or EU regulations.

**Acceptance Criteria:**

1. Unified search page created: `/sok` (search)
2. Full-text search implemented using PostgreSQL `tsvector` across all content types
3. Search queries match: titles, document numbers, full text, summaries
4. Search results display mixed content types with clear type badges
5. Each result shows: title, document number, content type, category, snippet
6. Results ranked by relevance using weighted ranking:
   - Title match: weight 1.0
   - Document number match: weight 0.9
   - Full text match: weight 0.5
7. Filters available:
   - Content Type (Laws, HD Cases, HovR Cases, HFD Cases, EU Regulations, EU Directives)
   - Category (Arbetsrätt, Dataskydd, etc.)
   - Business Type (B2B/Private/Both)
   - Date Range (publication date)
8. Search performance <800ms for 170,000+ documents
9. Pagination (20 results per page)
10. No results state with suggestions
11. Mobile-responsive search interface
12. Search analytics tracked (query, results count, clicks)

---

### Story 2.8: Implement Cross-Document Navigation System

**As a** user,
**I want** to navigate between related documents (law → cases citing it → EU directive requiring it),
**so that** I understand the complete legal landscape.

**Acceptance Criteria:**

1. SFS law pages display "Referenced in Court Cases" section showing all court cases that cite this law
2. Court case pages display "Cited Laws" section showing all SFS laws cited in the judgment
3. EU directive pages display "Swedish Implementation" section showing SFS laws implementing the directive
4. SFS law pages display "Implements EU Directive" section if law is implementing EU law
5. Cross-references automatically extracted during ingestion (Stories 2.2, 2.3, 2.4)
6. Manual cross-reference creation interface for authenticated users (link documents)
7. Bidirectional navigation works (A → B means B → A link appears)
8. Cross-reference links show context snippet: "This case interprets § 7 regarding..."
9. Cross-reference counts shown: "Referenced in 12 court cases"
10. Mobile-responsive cross-reference sections
11. Verification: Sample SFS law shows all expected court case references

---

### Story 2.9: Create SNI Code-Based Multi-Content Discovery

**As a** visitor,
**I want** to enter my industry code (SNI) and see all relevant legal content,
**so that** I understand my sector's complete compliance landscape (laws + court precedent + EU regulations).

**Acceptance Criteria:**

1. SNI discovery page created: `/upptack-lagar/bransch` (discover laws/industry)
2. Input field for SNI code (5 digits)
3. SNI code validation (format: XXXXX)
4. Industry starter packs created for 15 common sectors
5. Each starter pack contains curated mix of content types:
   - 12-25 SFS laws relevant to industry
   - 3-8 key court cases showing precedent
   - 5-12 EU regulations/directives affecting industry
6. Results page shows tabbed view:
   - "Lagar" tab: SFS laws
   - "Rättsfall" tab: Court cases with brief summaries
   - "EU-lagstiftning" tab: EU regulations and directives
7. Each tab sortable by relevance, date, category
8. "Lägg till i Min Lista" (Add to My List) CTA requires authentication
9. SEO-optimized pages for each industry: `/upptack-lagar/bransch/bygg-och-anlaggning`
10. SNI → content mapping stored in database
11. Mobile-responsive layout with tab navigation

---

### Story 2.10: Implement Content Type-Specific RAG Chunking Strategies

**As a** developer,
**I want** to chunk different content types appropriately for RAG embeddings,
**so that** semantic search retrieves optimal context for each document type.

**Acceptance Criteria:**

1. Chunking strategy configuration defined per content type:
   - **SFS laws:** Chunk by § (section), preserve chapter context, max 500 tokens
   - **Court cases:** Chunk by semantic section (Facts, Analysis, Conclusion), max 800 tokens
   - **EU regulations:** Chunk by article, preserve preamble context, max 500 tokens
   - **EU directives:** Chunk by article, preserve recitals context, max 500 tokens
2. Metadata preserved in each chunk:
   - SFS: chapter number, section number, law title
   - Court case: court name, case number, section type (Facts/Analysis/Conclusion)
   - EU: article number, CELEX, document type
3. Chunk overlap configured: 50 tokens overlap between adjacent chunks
4. Embedding generation script processes all 170,000+ documents
5. Embeddings generated using OpenAI `text-embedding-3-small` (1536 dimensions)
6. Embeddings stored in `legal_documents.embedding` vector field
7. Vector index created (HNSW) for fast similarity search
8. Script handles rate limits (max 1,000 requests/minute)
9. Progress logging per content type: "SFS: 5,000/50,000, HD: 200/3,000..."
10. Script completes in <16 hours for all content types
11. Test query: "employee sick leave rights" returns relevant chunks from SFS laws AND court cases
12. Verification: Database contains 100,000-200,000 chunk embeddings

---

### Story 2.11: Begin Recording Multi-Content-Type Change History

**As a** product owner,
**I want** to start collecting change history for ALL content types NOW (even without UI),
**so that** by Epic 8, we have 10+ weeks of historical data.

**Acceptance Criteria:**

1. Daily cron job created (runs 00:00 UTC)
2. Job monitors changes across all content types:
   - **SFS laws:** Check for new amendments, repeals, title changes
   - **Court cases:** Check for new published cases (HD, HovR, HFD)
   - **EU regulations/directives:** Check for new EU legislation, amendments
3. For each content type, compare current version to previous version
4. Detect changes:
   - New documents added (new SFS, new court cases, new EU acts)
   - Content changes (SFS amendments, corrected court case text)
   - Status changes (SFS repealed, EU directive superseded)
5. Changes stored in `content_changes` table: id, document_id, change_type, old_value, new_value, detected_at, content_type
6. No user-facing UI (background data collection)
7. Job logs: "Detected 45 changes today: 12 new SFS, 8 new court cases, 25 new EU acts"
8. Errors logged to Sentry
9. Job completes in <3 hours
10. Database accumulates change history silently
11. Verification: After 2 weeks, database contains change records for all content types
12. Change detection tested: Mock SFS amendment detected correctly
13. **NEW: Amendment enrichment** when SFS changes detected (competitive feature):
    - For new/updated SFS laws, extract amendment references from full text
    - Parse affected sections: "föreskrivs att 1 kap. 3 § ska ha följande lydelse"
    - Generate 2-3 sentence GPT-4 summary in Swedish (plain language)
    - Parse effective date from transition provisions
    - Create/update Amendment records with all 7 fields
    - Cost: ~$0.42/month for ~10 new amendments detected nightly
    - See `docs/historical-amendment-tracking-strategy.md` Section 12.5 for implementation

---

**Epic 2 Complete: 11 stories, 4-5 weeks estimated**



---

## Epic 3: RAG-Powered AI Chat Interface (DETAILED)

**Goal:** Implement zero-hallucination AI chatbot with drag-and-drop context building, citation-first responses, and streaming UI.

**Value Delivered:** Users can ask legal questions and receive accurate, cited answers grounded in Swedish law + drag-and-drop UX makes AI contextual and powerful.

---

### Story 3.1: Set Up Vector Database (pgvector + Embeddings)

**As a** developer,
**I want** to embed all 10,000+ laws into a vector database,
**so that** the AI can perform semantic similarity search for RAG.

**Acceptance Criteria:**

1. pgvector extension enabled in Supabase PostgreSQL
2. New table `law_embeddings` created with fields: id, law_id, chunk_text, embedding (vector(1536)), metadata
3. Semantic chunking script implemented (500-800 tokens per chunk)
4. Script chunks all 10,000+ laws, generates embeddings using OpenAI `text-embedding-3-small`
5. Embeddings stored in database (estimated 50,000-100,000 chunks total)
6. Vector index created for fast similarity search (HNSW or IVFFlat)
7. Script handles rate limits (max 1,000 requests/minute)
8. Progress logging: "Embedded 1,000/10,000 laws..."
9. Script completes in <8 hours
10. Test query: "What are employee rights during sick leave?" returns relevant chunks

---

### Story 3.2: Implement RAG Query Pipeline

**As a** developer,
**I want** to build a RAG pipeline that retrieves relevant law chunks and generates answers,
**so that** the AI chatbot can respond accurately to user questions.

**Acceptance Criteria:**

1. API endpoint created: `POST /api/chat/query`
2. Request body: `{ query: string, context?: string[] }`
3. Pipeline steps:
   - Generate embedding for user query
   - Perform vector similarity search (retrieve top 10 chunks)
   - Construct prompt with system instructions + retrieved chunks + user query
   - Call OpenAI GPT-4 or Anthropic Claude
   - Return response with citations
4. System prompt enforces: "ONLY answer from provided chunks, cite sources, else say 'I don't have enough information'"
5. Response format: `{ answer: string, citations: [{ law_id, sfs_number, title, chunk_text }] }`
6. RAG accuracy tested with 20 sample questions (manual review: >90% grounded answers)
7. Query latency <3 seconds end-to-end
8. Error handling: LLM timeout, no relevant chunks found
9. Logging: User query, retrieved chunks, LLM response

---

### Story 3.3: Build AI Chat UI with Streaming Responses

**As a** user,
**I want** to type a legal question and see the AI response stream in real-time,
**so that** I get fast, engaging answers.

**Acceptance Criteria:**

1. AI Chat sidebar component created (fixed right side, 400px width)
2. Chat interface includes: message history, input field, send button
3. User types question, clicks Send
4. Message appears in chat history immediately
5. AI response streams word-by-word using Vercel AI SDK `useChat` hook
6. Streaming animation (typing indicator while waiting)
7. Citations appear inline: `[1]`, `[2]` with hover tooltips showing source law
8. Citation tooltip includes: law title, SFS number, snippet, "View law" link
9. Chat history persisted in workspace (requires Epic 5 for multi-tenancy)
10. Mobile: Chat sidebar converts to full-screen modal
11. Keyboard shortcut: `Cmd+K` or `/` opens chat

---

### Story 3.4: Implement Drag-and-Drop for Law Cards into Chat

**As a** user,
**I want** to drag law cards from my law list into the chat,
**so that** the AI can answer questions specifically about those laws.

**Acceptance Criteria:**

1. Law cards made draggable using `@dnd-kit` or `react-beautiful-dnd`
2. Chat input area is a drop zone
3. User drags law card into chat → card converts to "context pill" above input field
4. Context pill displays: law title, "X" button to remove
5. When user sends message, backend includes law_id in context
6. RAG pipeline retrieves chunks ONLY from specified laws (not full database)
7. Visual feedback: Drop zone highlights on hover, smooth animation on drop
8. Max 10 context items to prevent overload
9. Context persists across chat messages (stays until manually removed)
10. Mobile: Tap law card → "Add to chat context" button → pill appears

---

### Story 3.5: Implement Drag-and-Drop for Employee Cards into Chat

**As a** user,
**I want** to drag employee cards into chat,
**so that** the AI can answer HR questions specific to that employee.

**Acceptance Criteria:**

1. Employee cards (from HR Module Epic 7) made draggable
2. Dragging employee card into chat adds context pill
3. Context pill displays: employee name, role, "X" to remove
4. Backend includes employee metadata in RAG prompt: role, employment type, contract date, assigned kollektivavtal
5. Example query: "What are [Employee Name]'s vacation rights?" → AI considers their specific kollektivavtal
6. Context persists until removed
7. Visual feedback: Drop zone highlights, smooth animation
8. Mobile: Tap employee → "Add to chat context"
9. Privacy: Only users with HR Manager or Admin role can drag employee cards (role check in Epic 5)

---

### Story 3.6: Implement Drag-and-Drop for Task Cards into Chat

**As a** user,
**I want** to drag compliance task cards into chat,
**so that** the AI can help me understand or complete that task.

**Acceptance Criteria:**

1. Task cards (from Kanban Epic 6) made draggable
2. Dragging task card into chat adds context pill
3. Context pill displays: task title, "X" to remove
4. Backend includes task metadata in RAG prompt: task description, linked law, status
5. Example query: "How do I complete this task?" → AI explains based on linked law
6. Context persists until removed
7. Visual feedback: Drop zone highlights, animation
8. Mobile: Tap task → "Add to chat context"

---

### Story 3.7: Implement Drag-and-Drop for Files into Chat (Kollektivavtal PDFs)

**As a** user,
**I want** to drag uploaded kollektivavtal PDFs into chat,
**so that** the AI can answer questions from that specific agreement.

**Acceptance Criteria:**

1. File upload feature (from HR Module Epic 7) allows PDF uploads
2. Uploaded PDFs chunked and embedded into vector database (separate from laws)
3. File cards made draggable
4. Dragging file into chat adds context pill
5. Context pill displays: filename, "X" to remove
6. RAG pipeline searches both law embeddings AND file embeddings
7. Citations distinguish between laws and uploaded files
8. Example query: "What does our kollektivavtal say about overtime?" → AI searches uploaded PDF
9. File embeddings tagged with workspace_id for multi-tenancy
10. Mobile: Tap file → "Add to chat context"

---

### Story 3.8: Implement AI Component Streaming (Law Cards, Task Suggestions)

**As a** user,
**I want** the AI to suggest law cards or tasks directly in the chat,
**so that** I can take action without leaving the conversation.

**Acceptance Criteria:**

1. LLM prompt includes tool/function calling for components
2. AI can stream back components: `law_card`, `task_suggestion`, `employee_suggestion`
3. Frontend renders streamed components as interactive cards in chat
4. Law card includes: title, category, "Add to list" button
5. Task suggestion includes: title, description, "Create task" button
6. Clicking "Add to list" adds law to user's workspace (requires Epic 5)
7. Clicking "Create task" opens task creation modal (requires Epic 6)
8. Component streaming uses Vercel AI SDK tool calling
9. Example: User asks "What HR laws apply to restaurants?" → AI streams 5 law cards
10. Mobile-responsive component rendering

---

### Story 3.9: Add Citation Verification and Hallucination Detection

**As a** product owner,
**I want** to verify that AI responses are grounded in retrieved chunks,
**so that** we minimize hallucinations and maintain trust.

**Acceptance Criteria:**

1. Backend logs every AI response with: query, retrieved chunks, LLM response
2. Post-processing script checks if answer contains claims not in retrieved chunks
3. Hallucination detection uses simple keyword matching (v1) or LLM-based verification (v2)
4. If hallucination detected, flag response for manual review
5. Dashboard shows hallucination rate: Target <5%
6. Prompt engineering iteration to reduce hallucinations
7. System instruction enforced: "If you cannot answer from provided sources, respond 'I don't have enough information to answer that question.'"
8. Test with 50 edge case questions (manual review confirms >95% grounded)

---

### Story 3.10: Implement Chat History and Session Management

**As a** user,
**I want** my chat history saved,
**so that** I can reference previous conversations.

**Acceptance Criteria:**

1. Chat messages stored in `chat_messages` table: id, workspace_id, user_id, role (user/assistant), content, created_at
2. Chat sidebar loads last 20 messages on open
3. Infinite scroll to load older messages
4. Messages grouped by date ("Today", "Yesterday", "Last week")
5. User can delete individual messages or clear entire history
6. Chat history scoped to workspace (multi-tenancy in Epic 5)
7. Search within chat history (keyword search)
8. Export chat history as PDF or text file
9. Privacy: Chat history deleted if workspace deleted (Epic 5 soft-delete cascade)

---

### Story 3.11: Optimize AI API Costs with Caching

**As a** product owner,
**I want** to cache AI responses for common queries,
**so that** we reduce OpenAI API costs.

**Acceptance Criteria:**

1. Response caching implemented using Redis or Vercel KV
2. Cache key: hash of query + context (law_ids)
3. Cache hit → Return cached response (skip LLM call)
4. Cache miss → Call LLM, store response in cache
5. Cache TTL: 7 days
6. Cache invalidation: When law content changes
7. Analytics tracking: Cache hit rate target >50%
8. Cost tracking: AI API costs per query logged
9. Dashboard shows: Daily API costs, cache hit rate, queries per tier
10. Optimization: Cheaper embedding model if cost/query >€0.10

---

### Story 3.12: Add Legal Disclaimer and AI Response Warnings

**As a** product owner,
**I want** to display legal disclaimers prominently,
**so that** users understand AI guidance is not legal advice.

**Acceptance Criteria:**

1. First-time chat users see disclaimer modal before sending first message
2. Disclaimer text: "AI-assisted guidance, not legal advice. Consult a lawyer for specific situations."
3. User must click "I understand" to proceed
4. Disclaimer shown in footer of every chat message (small text)
5. AI responses include warning for high-risk topics (e.g., termination, discrimination): "⚠️ Consider consulting a lawyer for this matter"
6. High-risk topic detection via keyword matching (expandable list)
7. Terms of Service updated to include AI usage terms
8. Legal review of disclaimer language (external lawyer review recommended)

---

**Epic 3 Complete: 12 stories, 3-4 weeks estimated**

---

## Epic 4: Dynamic Onboarding & Personalized Law Lists (DETAILED)

**Goal:** Create conversion engine that transforms homepage visitors into trial users through streaming law list generation.

**Value Delivered:** Visitors instantly see personalized law list without account creation + seamless trial signup converts interest into subscriptions.

---

### Story 4.1: Build Dynamic Onboarding Widget (Homepage)

**As a** visitor,
**I want** to enter my org-number on the homepage and see my personalized law list,
**so that** I can evaluate Laglig.se before signing up.

**Acceptance Criteria:**

1. Homepage includes prominent onboarding widget (hero section)
2. Widget headline: "Se vilka lagar som gäller för ditt företag"
3. Input field for Swedish org-number (10 digits, format: XXXXXX-XXXX)
4. Client-side validation: 10 digits, valid format
5. "Generera min laglista" CTA button (primary style)
6. Clicking CTA triggers API call, shows loading state
7. Loading animation: Streaming text "Hämtar företagsinfo...", "Analyserar bransch...", "Väljer relevanta lagar..."
8. Widget mobile-responsive
9. Privacy note: "Vi hämtar endast publik info från Bolagsverket"

---

### Story 4.2: Integrate Bolagsverket API for Company Data

**As a** system,
**I want** to fetch company data from Bolagsverket based on org-number,
**so that** I can personalize the law list without manual input.

**Acceptance Criteria:**

1. API endpoint created: `POST /api/onboarding/fetch-company`
2. Request body: `{ orgNumber: string }`
3. Integration with Bolagsverket API (or alternative Swedish company registry)
4. Fetch: company name, address, SNI code, legal form (AB, HB, etc.), employee count (if available)
5. Response format: `{ name, address, sniCode, legalForm, employeeCount }`
6. Error handling: Invalid org-number, company not found, API timeout
7. Fallback: If Bolagsverket API unavailable, prompt user to enter industry manually
8. Rate limiting: Max 100 requests/hour per IP
9. Logging: Successful fetches, errors to Sentry
10. Test with 10 real org-numbers (verify data accuracy)


### Story 4.2b: Implement Dynamic Contextual Questioning Flow

**As a** visitor,
**I want** to answer 3-5 contextual questions about my business during onboarding,
**so that** the AI can generate a highly accurate and comprehensive law list.

**Acceptance Criteria:**

1. After Bolagsverket data fetch, AI determines first question based on SNI code and employee count
2. Question selection logic implemented with GPT-4 or rule-based decision tree:
   - **Always ask:** "Hur många anställda har ni?" (if not in Bolagsverket data)
   - **Industry-triggered questions:** Based on SNI code
     - Restaurang (SNI 56.x): "Serverar ni alkohol?", "Har ni uteservering?", "Anställer ni personer under 18 år?"
     - Bygg (SNI 41-43): "Arbetar ni med farliga ämnen?", "Har ni underentreprenörer?", "Arbetar ni på höjd?"
     - E-handel (SNI 47.91): "Säljer ni till privatpersoner eller företag?", "Säljer ni till andra EU-länder?"
     - Vårdgivare (SNI 86-88): "Privat eller kommunal vårdgivare?", "Hanterar ni patientjournaler?"
   - **Employee-count-triggered questions:**
     - 1-9 employees: "Har ni kollektivavtal?"
     - 10-24 employees: "Har ni skyddsombud?" (required by law)
     - 25+ employees: "Har ni skyddskommitté?" (required by law)
   - **Follow-up questions:** Based on previous answers
     - If "Ja" to alcohol: "Vilken typ av serveringstillstånd?"
     - If "Ja" to subcontractors: "Kontrollerar ni deras F-skatt?"
3. Question UI displays:
   - Progress indicator: "Fråga 2 av ~4"
   - Contextual intro: "Eftersom ni har 12 anställda:"
   - Question text (large, clear Swedish)
   - Answer options (radio buttons or large buttons)
   - Educational tooltip: "💡 Med 10+ anställda krävs skyddsombud enligt Arbetsmiljölagen"
4. Laws stream into list as questions are answered (progressive value demonstration)
5. Each answer adds 3-8 new laws to streaming list with reason tags: "Gäller eftersom ni serverar alkohol"
6. Hard limit: Maximum 5 questions, then force to Phase 1 completion
7. User can go back to previous question, answers preserved, law list regenerates
8. "Hoppa över" option available with warning: "Vi kanske missar relevanta lagar"
9. "Vet inte" answer option includes law with "⚠️ Kan gälla dig - kontrollera" tag
10. Answers stored in `CompanyContext` object for downstream use (AI chat, notifications, analytics)
11. Session storage preserves partial progress (24-hour expiry) if user closes browser
12. Mobile-responsive question UI (large touch targets)
13. Question-answer flow completes in <2 minutes (target: avg 3-4 questions × 30 seconds each)
14. Test with 10 different industries: Verify questions are relevant and law lists accurate

**Technical Notes:**
- Question selection can be rule-based initially (if/then logic), GPT-4 as enhancement later
- Each question adds to streaming law generation, not batch at end
- Educational tooltips position Laglig.se as educator, not just tool

---
---

### Story 4.3: Implement Two-Phase AI-Powered Law List Generation

**As a** visitor,
**I want** the system to generate a comprehensive personalized law list in two phases,
**so that** I see value quickly (Phase 1) and get complete coverage after signup (Phase 2).

**Acceptance Criteria:**

**Phase 1 (Pre-Signup - High-Priority Laws):**

1. API endpoint created: `POST /api/onboarding/generate-law-list-phase1`
2. Request body: `{ sniCode, legalForm, employeeCount, companyName, contextualAnswers }`
3. Backend retrieves industry starter pack (from Epic 2) based on SNI code
4. GPT-4 prompt: "Given [company data + contextual answers], select 15-30 HIGHEST-PRIORITY laws, prioritize by: (1) change frequency, (2) fine risk, (3) business-criticality, (4) industry-specificity"
5. AI returns ranked law list with contextual commentary per law
6. Commentary format: "Gäller eftersom ni har 12 anställda" or "Gäller eftersom ni serverar alkohol"
7. Response format: `{ phase: 1, totalEstimated: 68, laws: [{ law_id, title, sfs_number, commentary, priority, category }] }`
8. Generation time <3 minutes (including streaming during question answering)
9. Laws categorized: Grundläggande, Arbetsmiljö, Branschspecifika (Phase 1 focuses on these 3)
10. Fallback: If SNI code not in starter packs, use general "SMB starter pack"

**Phase 2 (Post-Signup - Comprehensive Coverage):**

11. API endpoint created: `POST /api/onboarding/generate-law-list-phase2`
12. Triggered automatically after account creation, runs as background job
13. Request body: `{ userId, workspaceId, phase1LawIds, contextualAnswers }`
14. GPT-4 prompt: "Given [company data], generate REMAINING 45-65 laws for comprehensive 60-80 total coverage. Exclude Phase 1 laws. Include: nice-to-know laws, tangential regulations, environmental laws, specialized contexts."
15. Categories added: GDPR & Data, Ekonomi, Miljö, Övrigt
16. Generation time <60 seconds for 45-65 laws
17. Laws stream into user's workspace in real-time (background process, non-blocking)
18. Progress tracking: Database stores `phase2_generation_status` (pending/in_progress/complete)
19. Frontend polls: `GET /api/onboarding/phase2-status/{workspaceId}` returns `{ progress: 45/68, complete: false }`
20. Upon completion: Database marks `phase2_generation_status = complete`, sends completion event
21. Error handling: If Phase 2 fails, retry up to 3 times, then notify user "Vi slutför din laglista, det kan ta några minuter till"

**Testing:**

22. Test Phase 1 with 15 different industries (manual review: >95% relevant for immediate compliance)
23. Test Phase 2 with same industries (manual review: comprehensive coverage, minimal duplication)
24. Verify Phase 1 + Phase 2 totals 60-80 laws per industry
25. Compare generated lists against Notisum's industry lists (coverage parity check)

**Technical Notes:**
- Phase 1 laws prioritized for "conversion value" - show user we understand their business
- Phase 2 adds breadth for Notisum parity (users expect comprehensive coverage)
- contextualAnswers from Story 4.2b dramatically improve accuracy vs. Bolagsverket-only
- Background job for Phase 2 uses job queue (BullMQ or similar) for reliability

---
---

### Story 4.4: Build Streaming Law List UI

**As a** visitor,
**I want** to watch my law list generate in real-time,
**so that** I experience the "magic" of AI personalization.

**Acceptance Criteria:**

1. After submitting org-number, law list streams onto page
2. Streaming animation: Laws appear one-by-one, card-by-card
3. Each law card displays: title, SFS number, category badge, AI commentary (1-2 sentences)
4. Cards have subtle fade-in animation
5. Progress indicator: "12/20 lagar valda..."
6. Streaming uses Vercel AI SDK or Server-Sent Events (SSE)
7. Once complete, show: "Din personliga laglista är klar! ✅"
8. Call-to-action: "Spara och fortsätt" button (triggers signup)
9. Law cards interactive: Click to expand full details
10. Mobile-responsive card layout (1 column mobile, 2-3 desktop)

---

### Story 4.4b: Build Post-Signup Phase 2 Completion UI

**As a** new user,
**I want** to see my law list complete in the background after signup,
**so that** I have comprehensive 60-80 law coverage without waiting.

**Acceptance Criteria:**

**Dashboard Progress Indicator:**

1. After signup, user lands on Dashboard with 15-30 Phase 1 laws visible immediately
2. Progress bar displayed at top of Dashboard:
   - "Kompletterar din laglista... 23/68 lagar"
   - Animated progress bar fills as laws generate
   - Estimated time remaining: "~45 sekunder kvar"
   - Dismissible: Small [X] button hides bar, but generation continues in background
3. Progress bar color: Primary brand color with subtle animation (shimmer or pulse)
4. Mobile-responsive: Full-width on mobile, partial-width on desktop

**Real-Time Law Streaming:**

5. New laws from Phase 2 appear with fade-in animation as they're generated
6. Each new law card tagged with "✨ NY GENERERAD" badge (disappears after 3 seconds)
7. Laws auto-organize into categories as they populate:
   - Grundläggande (23) - already populated from Phase 1
   - Arbetsmiljö (12) - populates as generated
   - Branschspecifika (8) - populates as generated
   - GDPR & Data (5) - populates as generated
   - Ekonomi (8) - populates as generated
   - Miljö (3) - populates as generated
   - Övrigt (2) - populates as generated
8. Category counts update in real-time: "Arbetsmiljö (8)" → "Arbetsmiljö (9)" → "Arbetsmiljö (12)"
9. Smooth transitions: No jarring reordering, laws append to bottom of each category

**User Interaction During Generation:**

10. User can interact with Dashboard during Phase 2 generation (NOT blocked)
11. User can click law cards to view details (opens in new tab/modal, doesn't interrupt generation)
12. User can set notification preferences while generation runs
13. User can start AI chat while generation runs (Phase 1 laws already available as context)
14. If user navigates away from Dashboard, generation continues in background
15. Progress bar reappears if user returns to Dashboard before completion

**Completion Experience:**

16. When Phase 2 completes, show toast notification (top-right or center):
    - "✅ Klar! 68 lagar i din lista är nu kompletta och aktiverade för ändringsbevakning"
    - Auto-dismisses after 8 seconds
    - Subtle confetti animation (optional, can be disabled in user settings)
17. Progress bar transitions to success state: "✅ Din laglista är komplett med 68 lagar"
18. Success banner auto-dismisses after 10 seconds or on manual close
19. Database updates: workspace.phase2_generation_status = 'complete'
20. Analytics event tracked: `phase2_generation_complete` with duration and law count

**Error Handling:**

21. If Phase 2 generation fails (API error, timeout):
    - Progress bar shows: "⏸️ Kompletterar din laglista, tar lite längre tid än förväntat..."
    - Retry mechanism: Automatic retry up to 3 times with exponential backoff
    - If all retries fail: "Vi slutför din laglista snart. Du får ett mejl när det är klart."
22. User can continue using app with Phase 1 laws while Phase 2 retries
23. Email sent when Phase 2 eventually completes: "Din laglista med 68 lagar är nu klar!"

**Frontend Polling:**

24. Dashboard polls `GET /api/onboarding/phase2-status/{workspaceId}` every 2 seconds during generation
25. Response format: `{ progress: 45, total: 68, complete: false, newLaws: [{law_id, title, ...}] }`
26. Polling stops when `complete: true` or user navigates away (resumes on return)
27. Efficient polling: Only fetch new laws since last poll (not full list every time)

**Testing:**

28. Test with slow network: Verify UI doesn't break, progress bar shows accurately
29. Test browser close during Phase 2: Verify generation continues server-side, resumes UI on return
30. Test with Phase 2 failure: Verify retry logic works, user isn't blocked

**Performance:**

31. Phase 2 generation target: <60 seconds for 45-65 laws
32. Dashboard remains responsive (<100ms interactions) during background generation
33. Category reorganization uses CSS transitions (smooth, not jarring)

**Technical Notes:**
- Background job uses job queue (BullMQ) for reliability
- Frontend uses Server-Sent Events (SSE) or polling for real-time updates
- Laws cached in client state to avoid refetching
- Optimistic UI: Show laws immediately as they're generated, not batched

---

### Story 4.5: Implement Trial Signup Flow

**As a** visitor,
**I want** to sign up for a free trial after seeing my law list,
**so that** I can save it and access full features.

**Acceptance Criteria:**

1. Clicking "Spara och fortsätt" opens signup modal
2. Signup form fields: Email, Password, Company name (pre-filled from Bolagsverket)
3. Password complexity validation (min 8 chars, 1 number, 1 special char, 1 uppercase)
4. Password breach check via HaveIBeenPwned API
5. Checkbox: "I agree to Terms of Service and Privacy Policy"
6. "Start 14-dagars gratis provperiod" CTA
7. Credit card NOT required for trial (changed from original requirement - architect decision)
8. Account created → Email verification sent (6-digit code)
9. User redirected to email verification page
10. Generated law list automatically saved to user's workspace
11. Error handling: Email already exists, weak password, API errors

**Note:** Original requirement (FR21) specified credit card upfront, but architect may reconsider to reduce signup friction. Recommend A/B testing.

---

### Story 4.6: Build Email Verification Flow

**As a** new user,
**I want** to verify my email with a 6-digit code,
**so that** the system confirms my email is valid.

**Acceptance Criteria:**

1. After signup, 6-digit verification code sent via email (Resend or SendGrid)
2. Email template includes: code, company name, "Verify your email" CTA
3. Verification page displays: "Check your email for a 6-digit code"
4. Input field for 6-digit code
5. Client-side validation: Exactly 6 digits
6. Submit code → Backend validates → Account marked as verified
7. Redirect to Dashboard on success
8. Error handling: Invalid code, expired code (30-minute expiry)
9. "Resend code" option (max 3 resends per hour)
10. Email sent from no-reply@laglig.se with branded template

---

### Story 4.7: Create Welcome Email Sequence (Trial Nurturing)

**As a** product owner,
**I want** to send automated emails during the trial period,
**so that** I increase trial-to-paid conversion.

**Acceptance Criteria:**

1. Email automation set up with Resend/SendGrid/Loops
2. **Day 1 (Welcome):** "Welcome to Laglig.se! Here's your law list." + feature overview
3. **Day 3 (Feature tips):** "5 ways to get the most from Laglig.se" (AI chat, drag-and-drop, change monitoring teaser)
4. **Day 7 (Engagement check):** "How's it going? Need help?" + link to support
5. **Day 12 (Conversion push):** "Your trial ends in 2 days - Upgrade now!" + pricing, testimonials, urgency
6. Emails track open rates, click rates (UTM parameters)
7. Unsubscribe link in every email
8. A/B testing capability (subject lines, CTAs)
9. Email content in Swedish
10. Templates use React Email for easy editing

---

### Story 4.8: Implement Free Trial Expiration Logic

**As a** system,
**I want** to automatically expire free trials after 14 days,
**so that** users must upgrade to continue using the product.

**Acceptance Criteria:**

1. User accounts have `trial_ends_at` field (set to signup_date + 14 days)
2. Daily cron job checks for expired trials (runs 00:00 UTC)
3. Expired trial users: Access blocked, workspace set to "paused" status
4. Paused workspace shows banner: "Your trial has ended. Upgrade to continue."
5. User can click "Upgrade" → Redirects to billing page (Epic 5)
6. Data preserved for 30 days after trial expiration (Epic 5 soft-delete)
7. Email sent on day 14: "Your trial has ended" + upgrade CTA
8. Expired users cannot login (redirect to upgrade page)
9. Analytics tracking: Trial → Paid conversion rate (target >25%)

---

### Story 4.9: Add Personalized Law List Management

**As a** user,
**I want** to customize my law list (add/remove laws, create multiple lists),
**so that** I track only relevant compliance requirements.

**Acceptance Criteria:**

1. Law List page displays all laws in user's list
2. Each law card shows: title, category, priority, status (from Kanban Epic 6)
3. "Add Law" button opens search modal (search all 10,000+ laws)
4. User can add laws manually from search results
5. "Remove Law" button (with confirmation) removes law from list
6. User can create multiple law lists: "Main List", "Construction-Specific", "GDPR Focus"
7. List switcher dropdown in navigation
8. Drag-and-drop to reorder laws (priority)
9. Export law list as PDF or CSV
10. Law list scoped to workspace (multi-tenancy in Epic 5)

---

### Story 4.10: Implement Onboarding Progress Tracking

**As a** product owner,
**I want** to track onboarding funnel metrics,
**so that** I can optimize conversion rates.

**Acceptance Criteria:**

1. Analytics events tracked:
   - Onboarding widget viewed
   - Org-number submitted
   - Law list generated successfully
   - Signup modal opened
   - Account created
   - Email verified
   - First login to Dashboard
2. Funnel visualization in analytics dashboard
3. Conversion rates calculated: Widget view → List generated, List generated → Signup, Signup → Verified, Verified → First login
4. Tracking includes: timestamp, user_id, session_id, referral source
5. A/B testing support: Track variant ID for widget CTAs
6. Goal: >40% widget view → signup, >80% signup → verified
7. Weekly report emailed to founder

---

**Epic 4 Complete: 10 stories, 3-4 weeks estimated**

---

## Epic 5: Workspace Management & Team Collaboration (DETAILED)

**Goal:** Enable multi-user workspaces with subscription tiers, team invites, role-based access, and billing integration.

**Value Delivered:** Teams can collaborate on compliance + subscription billing enables revenue + usage tracking validates business model.

---

### Story 5.1: Implement Workspace Data Model and Multi-Tenancy

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

### Story 5.2: Implement Five User Roles with Permissions

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

### Story 5.3: Build Team Invite System

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

### Story 5.4: Integrate Stripe for Subscription Billing

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

### Story 5.5: Implement Usage Limits Per Tier

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

### Story 5.6: Build Add-On Purchase System

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

### Story 5.7: Implement Workspace Settings Page

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

### Story 5.8: Implement Workspace Pause and Deletion

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

### Story 5.9: Build Workspace Switcher (Multi-Workspace Support)

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

### Story 5.10: Implement Unit Economics Tracking (NFR18 - CRITICAL)

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

### Story 5.11: Build Workspace Activity Log (Enterprise Feature)

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

### Story 5.12: Implement Workspace Onboarding Checklist

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

## Epic 6: Compliance Workspace (Kanban + Dashboard) (DETAILED)

**Goal:** Provide Jira-inspired Kanban board for visual compliance tracking and summary dashboard.

**Value Delivered:** Visual compliance progress tracking + dashboard provides actionable insights + task management enables workflow automation.

---

### Story 6.1: Build Dashboard Summary View

**As a** user,
**I want** to see a dashboard when I log in,
**so that** I get an overview of my compliance status and priorities.

**Acceptance Criteria:**

1. Dashboard page created at `/dashboard` (default landing after login)
2. **Compliance Progress Ring:** Circular progress chart showing % of laws "Compliant" vs total
3. **AI Insights Section:**
   - Recent law changes (last 7 days) affecting workspace
   - New laws recommended for industry
   - AI-generated priority suggestions: "3 laws need urgent attention"
4. **Quick Actions:** Buttons for "Ask AI", "Add Law", "Invite Team", "Add Employee"
5. **Recent Activity Feed:**
   - Last 10 actions: "Anna reviewed Law X", "Law Y changed yesterday"
   - Timestamp + user avatar
6. **Law List Preview:** Top 5 prioritized laws with status badges
7. Mobile-responsive layout (stacked sections on mobile)
8. Dashboard loads in <2 seconds

---

### Story 6.2: Create Kanban Compliance Workspace

**As a** user,
**I want** to organize laws in a Kanban board,
**so that** I track progress from "Not Started" to "Compliant".

**Acceptance Criteria:**

1. Kanban page created at `/workspace`
2. Five columns: Not Started, In Progress, Blocked, Review, Compliant
3. Each law in user's law list displayed as card in appropriate column
4. Law cards show: title, category badge, priority (High/Medium/Low), assigned employee (if any)
5. Drag-and-drop to move cards between columns
6. Column headers show count: "In Progress (5)"
7. Cards persist position after refresh
8. "Add Law" button in each column
9. Empty state: "No laws in this column yet"
10. Mobile: Horizontal scroll for columns, or vertical stack with section headers

---

### Story 6.3: Implement Law Card Modal (Detailed View)

**As a** user,
**I want** to click a law card to see full details and add notes,
**so that** I can manage that law's compliance.

**Acceptance Criteria:**

1. Clicking law card opens modal
2. Modal displays:
   - Law title, SFS number
   - Category badge
   - AI summary (200 words)
   - Current status (column)
   - Priority dropdown (High/Medium/Low)
   - Assigned employees (multi-select dropdown)
   - Due date picker (optional)
   - Notes textarea (markdown supported)
   - Tags input (custom tags)
3. "View Full Law" link → Opens individual law page
4. "Ask AI About This" button → Opens chat with law pre-loaded in context
5. "Save" button persists changes
6. "Close" or ESC key closes modal
7. Modal mobile-responsive (full-screen on mobile)

---

### Story 6.4: Add Task Management to Law Cards

**As a** user,
**I want** to create tasks within each law card,
**so that** I break down compliance into actionable steps.

**Acceptance Criteria:**

1. Law card modal includes "Tasks" section
2. Task list shows existing tasks with checkboxes
3. "Add Task" button creates new task
4. Task fields: Title, Description (optional), Assigned to (team member), Due date
5. Checking task marks it complete
6. Task completion % shown on law card: "3/5 tasks complete"
7. Tasks stored in `law_tasks` table: id, law_id, workspace_id, title, assigned_to, due_date, completed
8. Kanban card shows task progress bar
9. Overdue tasks highlighted in red

---

### Story 6.5: Implement Drag-and-Drop for Kanban Board

**As a** user,
**I want** to drag law cards between columns,
**so that** I update compliance status visually.

**Acceptance Criteria:**

1. Law cards draggable using `@dnd-kit` or `react-beautiful-dnd`
2. Columns are drop zones
3. Dragging card shows visual feedback (card follows cursor, drop zone highlights)
4. Dropping card in new column → Backend updates law status
5. Smooth animation on drop
6. Optimistic UI update (card moves immediately, rollback if API fails)
7. Keyboard accessibility: Arrow keys + Enter to move cards
8. Touch support for mobile (drag with finger)
9. Performance: Smooth with 100+ law cards

---

### Story 6.6: Add Filtering and Search to Kanban

**As a** user,
**I want** to filter laws on the Kanban board,
**so that** I focus on specific categories or priorities.

**Acceptance Criteria:**

1. Filter bar above Kanban board
2. Filters available:
   - Category (multi-select dropdown)
   - Priority (High/Medium/Low)
   - Assigned employee (dropdown)
   - Tags (multi-select)
3. Search input filters by law title
4. Filters stack (AND logic): Category=Arbetsrätt AND Priority=High
5. Filtered results shown immediately (client-side filtering)
6. Clear filters button
7. Filter state persisted in URL query params
8. Mobile: Filters in collapsible section

---

### Story 6.7: Implement Kanban Column Customization

**As a** user,
**I want** to customize Kanban columns,
**so that** I match my compliance workflow.

**Acceptance Criteria:**

1. Settings → Workspace → "Customize Kanban" section
2. User can rename columns (default: Not Started, In Progress, Blocked, Review, Compliant)
3. User can add new columns (max 8 columns)
4. User can reorder columns (drag-and-drop)
5. User can delete custom columns (laws move to "Not Started")
6. Column customization saved per workspace
7. Default columns cannot be deleted (only renamed)

---

### Story 6.8: Add Bulk Actions to Kanban

**As a** user,
**I want** to perform bulk actions on multiple laws,
**so that** I update many laws at once.

**Acceptance Criteria:**

1. Checkbox on each law card
2. "Select All" checkbox in column header
3. Bulk actions toolbar appears when ≥1 card selected
4. Actions available:
   - Move to column (dropdown)
   - Set priority (dropdown)
   - Assign to employee (dropdown)
   - Add tag (input)
   - Delete from list (confirmation)
5. Bulk action applied to all selected cards
6. Success toast: "5 laws moved to In Progress"
7. Deselect all after action completes

---

### Story 6.9: Implement Global Search (Cmd+K)

**As a** user,
**I want** to search across laws, tasks, employees, and comments,
**so that** I quickly find anything in my workspace.

**Acceptance Criteria:**

1. Keyboard shortcut `/` or `Cmd+K` (Mac) or `Ctrl+K` (Windows) opens search modal
2. Search input with autofocus
3. As user types, results appear instantly
4. Results grouped by type: Laws (5), Tasks (3), Employees (2), Comments (1)
5. Each result shows: title, snippet, breadcrumb (where it's from)
6. Arrow keys navigate results, Enter opens selected result
7. Search uses full-text search on database or client-side search
8. Recent searches shown when input empty
9. ESC closes modal

---

### Story 6.10: Add Export Kanban Board as PDF/Image

**As a** user,
**I want** to export my Kanban board,
**so that** I share it with stakeholders or print for audits.

**Acceptance Criteria:**

1. Export button in Kanban toolbar
2. Export options: PDF, PNG
3. **PDF export:**
   - Renders Kanban board as multi-page PDF
   - Each column on separate page or single wide page
   - Includes workspace logo, date, "Generated by Laglig.se"
4. **PNG export:**
   - Captures visible Kanban board as image
   - High resolution (2x for retina)
5. Download triggered automatically
6. Filename: `Kanban-Board-[Workspace-Name]-[Date].pdf`
7. Watermark: "Laglig.se Compliance Workspace"

---

**Epic 6 Complete: 10 stories, 2-3 weeks estimated**

---
## Epic 7: HR Module (Employee Management) (DETAILED)

**Goal:** Connect employees to laws for context-aware HR compliance, improving AI chatbot value.

**Value Delivered:** Centralized employee database + AI can answer employee-specific questions + kollektivavtal integration ensures compliance.

---

### Story 7.1: Build Employee List View (CRUD)

**As an** HR manager,
**I want** to manage employees in a centralized list,
**so that** I track who works for my company.

**Acceptance Criteria:**

1. HR Module page created at `/hr/employees`
2. Table view shows all employees with columns: Name, Role, Employment Date, Contract Type, Status
3. "Add Employee" button opens modal
4. **Add Employee Modal fields:**
   - Name (required)
   - Personnummer (Swedish SSN, encrypted at rest, required)
   - Email (optional)
   - Phone (optional)
   - Employment date (date picker, required)
   - Contract type (dropdown: Permanent, Fixed-term, Consultant)
   - Role (dropdown: Manager, Employee, Intern, etc.)
   - Department (text input)
   - Manager (dropdown of existing employees)
5. "Save" creates employee record
6. Edit button (inline edit or modal)
7. Delete button (confirmation modal)
8. Search bar filters by name
9. Role-based access: Only HR Manager, Admin, Owner can access

---

### Story 7.2: Implement Employee Profile Page with Tabs

**As an** HR manager,
**I want** to view detailed employee profile,
**so that** I see all HR data and compliance status in one place.

**Acceptance Criteria:**

1. Clicking employee name opens profile page: `/hr/employees/[id]`
2. Profile tabs: Overview, Documents, Compliance, Activity
3. **Overview tab:**
   - Personal info (name, personnummer, email, phone)
   - Employment details (role, department, manager, employment date)
   - Contract type, end date (if fixed-term)
   - Edit button (opens modal with all fields)
4. **Documents tab:**
   - Uploaded documents (contract, ID, certificates)
   - Upload button (PDF/image)
   - Document list with: filename, upload date, uploader
   - Download/delete buttons
5. **Compliance tab:**
   - Kollektivavtal assignment
   - Compliance status (Compliant/Needs Attention/Non-Compliant)
   - Related laws (laws that apply to this employee)
6. **Activity tab:**
   - Audit log: Who edited this employee's data and when

---

### Story 7.3: Implement CSV Import for Employee Data

**As an** HR manager,
**I want** to import employees from CSV/Excel,
**so that** I don't manually enter 50+ employees.

**Acceptance Criteria:**

1. Import button on Employee List page
2. Upload CSV file (max 10MB)
3. CSV columns expected: Name, Personnummer, Email, Phone, Employment Date, Contract Type, Role, Department
4. Preview table shows first 10 rows
5. Column mapping: User maps CSV columns to system fields (auto-detected if headers match)
6. Date format selector (DD/MM/YYYY, YYYY-MM-DD, etc.)
7. **GPT-4 fuzzy role matching:** "Builder" → "construction_worker", "CEO" → "manager"
8. Validation: Highlight invalid rows (missing required fields, invalid personnummer)
9. "Skip invalid rows" checkbox
10. Import button processes valid rows, shows summary: "45 imported, 5 skipped"
11. Error log downloadable: "Row 12: Invalid personnummer format"

---

### Story 7.4: Implement Employee Compliance Status Calculation

**As an** HR manager,
**I want** to see which employees are compliant,
**so that** I prioritize HR tasks.

**Acceptance Criteria:**

1. Compliance status calculated per employee:
   - **Compliant:** All required fields filled, kollektivavtal assigned, no missing documents
   - **Needs Attention:** Some missing data (e.g., no kollektivavtal, missing contract document)
   - **Non-Compliant:** Critical missing data (e.g., no employment date, invalid personnummer)
2. Status badge shown in Employee List and Profile
3. Compliance reasons listed: "Missing kollektivavtal assignment", "No contract document uploaded"
4. Dashboard shows compliance summary: "40/50 employees compliant"
5. Filter employees by status
6. Automated reminders to HR Manager when employee status is "Needs Attention" for >7 days

---

### Story 7.5: Implement Kollektivavtal (Collective Agreement) Management

**As an** HR manager,
**I want** to upload and assign kollektivavtal to employees,
**so that** the AI knows which agreement applies to each employee.

**Acceptance Criteria:**

1. Kollektivavtal page created at `/hr/kollektivavtal`
2. Upload PDF button
3. Upload flow:
   - Select PDF (max 20MB)
   - Name input (e.g., "Byggnads Kollektivavtal 2024")
   - Type selector (Arbetare, Tjänstemän, Specialized)
   - Upload → PDF chunked and embedded into vector database
4. Kollektivavtal list shows: Name, Type, Upload date, Assigned employees count
5. Assign to employees: Checkbox list or bulk assign by department/role
6. AI chat can query kollektivavtal: "What does our agreement say about vacation days?"
7. Citations distinguish between laws and kollektivavtal
8. Delete kollektivavtal (confirmation, unassigns from employees)

---

### Story 7.6: Implement Employee Cards (Draggable to Chat)

**As a** user,
**I want** to drag employee cards into AI chat,
**so that** I ask HR questions specific to that employee.

**Acceptance Criteria:**

1. Employee List view includes card layout option (toggle: Table/Cards)
2. Each card shows: Name, role, photo (if uploaded), compliance status badge
3. Cards draggable (already implemented in Epic 3.5)
4. Dragging into chat adds employee context
5. AI uses employee metadata: role, kollektivavtal, employment date
6. Example: Drag "Anna Svensson" → Ask "How many vacation days does Anna have?" → AI checks her kollektivavtal
7. Privacy: Only HR Manager/Admin/Owner can drag employee cards

---

### Story 7.7: Add Employee Photo Upload

**As an** HR manager,
**I want** to upload employee photos,
**so that** the employee list is more visual and recognizable.

**Acceptance Criteria:**

1. Employee Profile → Photo upload section
2. Click to upload or drag-and-drop
3. Image requirements: Max 5MB, JPG/PNG, min 200x200px
4. Image cropping tool (square crop for avatar)
5. Photo stored in Supabase storage
6. Photo URL saved in `employees.photo_url`
7. Avatar displayed in: Employee List (card view), Profile, Chat context pills
8. Fallback: Initials avatar if no photo

---

### Story 7.8: Implement Employee Filters and Sorting

**As an** HR manager,
**I want** to filter and sort employees,
**so that** I find specific groups quickly.

**Acceptance Criteria:**

1. Filter bar on Employee List page
2. Filters: Department, Role, Contract Type, Compliance Status, Manager
3. Multi-select filters (AND logic)
4. Sort by: Name (A-Z), Employment Date (newest/oldest), Compliance Status
5. Filters persist in URL query params
6. Clear filters button
7. Export filtered list as CSV

---

### Story 7.9: Build Employee-Law Relationship (Auto-Assignment)

**As a** system,
**I want** to automatically suggest laws relevant to each employee,
**so that** users see which laws apply to whom.

**Acceptance Criteria:**

1. When employee created, AI analyzes role + department + kollektivavtal
2. System suggests 5-10 relevant laws (e.g., employee role=construction_worker → suggest Arbetsmiljölagen, Byggarbetskonventionen)
3. Suggested laws shown in Employee Profile → Compliance tab
4. User can accept/reject suggestions
5. Accepted laws linked in `employee_laws` table
6. Law cards in Kanban show assigned employees
7. Filtering Kanban by employee shows only their relevant laws

---

### Story 7.10: Implement Employee Offboarding Workflow

**As an** HR manager,
**I want** to offboard employees when they leave,
**so that** I maintain accurate records and compliance.

**Acceptance Criteria:**

1. Employee Profile → "Mark as Inactive" button
2. Offboarding modal fields: Last working day, Offboarding reason (dropdown: Resignation, Termination, Retirement, End of contract)
3. Marking inactive sets `employees.status = 'inactive'` and `employees.end_date`
4. Inactive employees hidden from default Employee List view
5. "Show inactive employees" toggle
6. Inactive employees cannot be assigned to new tasks/laws
7. Data retained for 2 years (GDPR compliance), then hard deleted
8. Export employee data before offboarding (GDPR right to data portability)

---

### Story 7.11: Add Employee Notes and @Mentions

**As an** HR manager,
**I want** to add notes to employee profiles and @mention teammates,
**so that** I collaborate on HR matters.

**Acceptance Criteria:**

1. Employee Profile → Notes section
2. Rich text editor (markdown supported)
3. @mention functionality: Type @ → Dropdown of team members
4. @mentioned users receive in-app notification
5. Notes timestamped and attributed to author
6. Edit/delete own notes only (or Admin/Owner can edit all)
7. Notes searchable via global search
8. Privacy: Notes only visible to HR Manager/Admin/Owner roles

---

### Story 7.12: Implement Fortnox Schema Compatibility (FR41)

**As a** product owner,
**I want** to design employee schema to support future Fortnox integration,
**so that** we enable one-click sync post-MVP.

**Acceptance Criteria:**

1. Employee schema fields mapped to Fortnox API structure:
   - `employee_id` → Fortnox `EmployeeId`
   - `personnummer` → Fortnox `PersonalIdentityNumber`
   - `contract_type` → Fortnox `PersonnelType`
   - `employment_date` → Fortnox `EmploymentDate`
   - `role` → Fortnox `ScheduleId` (mapping table for role → schedule)
2. Database migration adds `fortnox_id` field (null for now)
3. Documentation created: "Fortnox Integration Mapping"
4. No user-facing features in MVP (infrastructure only)
5. Post-MVP: OAuth flow will populate `fortnox_id` and enable sync

---

**Epic 7 Complete: 12 stories, 3-4 weeks estimated**

---

## Epic 8: Change Monitoring & Notification System (DETAILED)

**Goal:** Implement retention engine that automatically detects law changes and notifies users with AI-powered plain language summaries and business impact assessment.

**Value Delivered:** Users never miss critical law updates + AI summaries make changes understandable + retention improves through ongoing value delivery.

**Competitive Context:** Notisum provides basic change notifications with raw legal text only (confirmed via live account testing). Laglig.se differentiates through:
- AI plain language summaries explaining "what changed" in Swedish
- Business impact assessment (High/Medium/Low priority)
- Action guidance ("Review by [date]" vs "No action needed")
- Visual GitHub-style diffs (not just grey text boxes)
- Contextual help explaining legal notation (ändr:, nya §§, rubr:)

**Reference:** See `docs/competitive-analysis/notisum-change-notification-analysis.md` for detailed competitor breakdown based on live email examples.
---

### Story 8.1: Build Change Detection UI (Changes Tab)

**As a** user,
**I want** to see which laws in my list have changed,
**so that** I review updates and stay compliant.

**Acceptance Criteria:**

1. Law List page → "Changes" tab (next to "All Laws" tab)
2. Changes tab shows all unacknowledged changes for laws in workspace
3. Each change displayed as card:
   - 🔴/🟡/🟢 Priority badge (High/Medium/Low) - DIFFERENTIATION from Notisum
   - Law title, SFS number
   - Change detected date
   - Change type badge (Amendment, New Section, Repeal, Metadata Update)
   - **AI Summary** (1-2 sentences in plain Swedish): "This amendment extends parental leave to 18 months" - DIFFERENTIATION from Notisum
   - **Business Impact** (1 sentence): "Action required by Dec 1" or "FYI only - reference update" - DIFFERENTIATION from Notisum
   - "View Details" button → Opens diff view
   - "Mark as Reviewed" button
4. Changes sorted by priority (High → Medium → Low), then by date
5. Unacknowledged count badge on "Changes" tab: "Changes (3)"
6. Empty state: "No unacknowledged changes ✅"
7. Filter by priority: "Show: All | High Priority | Medium | Low"

### Story 8.2: Implement GitHub-Style Diff View

**As a** user,
**I want** to see exactly what changed in a law,
**so that** I understand the impact.

**Acceptance Criteria:**

1. Clicking "View Details" on change card opens diff modal
2. **Diff view shows** (DIFFERENTIATION: Notisum only shows grey box with full text):
   - Law title, SFS number
   - Change type, detected date
   - **Side-by-side comparison:** Old version | New version (GitHub-style)
   - **Changed sections highlighted:** Red background for removed text, green for added
   - Line numbers for reference
   - **Contextual explanation:** "§ 26 was modified - this section handles X"
3. **AI summary at top** (2-3 sentences in plain Swedish):
   - "Summary: Sick pay procedure references updated to align with new Försäkringskassan guidelines"
   - "Impact: Low - Administrative reference update, no action required"
4. "Mark as Reviewed" button in modal
5. **"View Full Law" link** → Opens individual law page
6. **Link to official source:** "Riksdagen PDF" link
7. Mobile: Stack old/new versions vertically instead of side-by-side
8. Diff library: Use `diff` npm package or similar
9. **Competitive note:** Notisum shows raw text in grey box - no visual diff, no before/after

### Story 8.3: Implement "Mark as Reviewed" Workflow

**As a** user,
**I want** to mark changes as reviewed,
**so that** they disappear from my Changes tab after I've acknowledged them.

**Acceptance Criteria:**

1. "Mark as Reviewed" button on change card and diff modal
2. Clicking button:
   - Updates `law_changes.acknowledged_at` timestamp
   - Updates `law_changes.acknowledged_by` to current user
   - Removes change from Changes tab
   - Decreases unacknowledged count badge
3. Confirmation toast: "Change marked as reviewed ✓"
4. Bulk "Mark All as Reviewed" button (confirmation modal)
5. Activity logged: "Anna reviewed change to Arbetsmiljölagen on 2025-01-15"
6. Enterprise tier: Activity appears in Workspace Activity Log

---

### Story 8.4: Implement Email Notifications for Law Changes

**As a** user,
**I want** to receive email notifications when laws in my list change,
**so that** I'm alerted even when not using the app.

**Acceptance Criteria:**

1. When law change detected (Epic 2.11 cron job), trigger notification pipeline
2. **Daily Digest Email** (sent 08:00-09:00 CET, morning batch):
   - **Subject:** "🔔 [List Name] - X nya lagändringar att granska" (personalized per law list)
   - **Email body structure** (inspired by Notisum, enhanced with AI):
     - Greeting: "Hej [Name],"
     - Context: "Följande lagar i din lista '[List Name]' har ändrats:"
     - **For each changed law:**
       - 🟢/🟡/🔴 Priority badge (Low/Medium/High)
       - Law title with link to Laglig.se page
       - SFS amendment number (e.g., "SFS 2025:938")
       - **AI Summary** (2-3 sentences in plain Swedish)
       - **Business Impact** (1 sentence: "No action required" or "Review by Dec 1")
       - Changed sections: "ändr: 26 §" with explanation
       - Effective date: "Ikraftträdande 1 december 2025"
       - **Dual links:** [View on Laglig.se] [Official Riksdagen PDF]
     - CTA button: "Granska alla ändringar"
     - Footer with unsubscribe link
   - Sent only if changes detected in last 24 hours
   - **Multiple law lists:** Send separate email per list (like Notisum)
3. **Email content differentiators** (vs Notisum):
   - Plain language AI summaries (not just legal text)
   - Priority indication (High/Medium/Low)
   - Action guidance per change
   - Contextual explanation of legal notation
4. **Section-level granularity** (match Notisum):
   - Show exact sections changed (§ numbers)
   - List multiple recent amendments if applicable
   - Include "Senaste ändringar" section for multi-amendment laws
5. Email preferences in Workspace Settings (user can opt out)
6. Unsubscribe link in footer: "Avbeställare är [email]"
7. Email template uses React Email, branded design
8. Track email open rates (UTM parameters in links)
9. **Competitive validation:** Email structure validated against live Notisum examples (Nov 2025)

### Story 8.5: Implement In-App Notification Bell

**As a** user,
**I want** to see a notification bell with unacknowledged change count,
**so that** I know at a glance if there are updates.

**Acceptance Criteria:**

1. Notification bell icon in top navigation (right side)
2. Badge shows unacknowledged change count: "3"
3. Clicking bell opens dropdown showing recent changes (last 5)
4. Each change in dropdown:
   - Law title
   - AI summary (truncated to 50 chars)
   - Time ago: "2 hours ago"
   - Click → Opens Changes tab
5. "View All Changes" link at bottom → Opens Changes tab
6. Bell badge disappears when count = 0
7. Real-time updates: Poll for new changes every 5 minutes or use WebSocket

---

### Story 8.6: Implement Reminder Emails for Unacknowledged Changes

**As a** product owner,
**I want** to send reminder emails to users with unacknowledged changes,
**so that** critical updates aren't missed.

**Acceptance Criteria:**

1. **Day 3 reminder:**
   - If change unacknowledged after 3 days, send reminder email
   - Subject: "Påminnelse: Olästa lagändringar"
   - Body: "Du har 3 olästa lagändringar från [Date]. Granska dem nu för att hålla dig uppdaterad."
   - CTA: "Granska ändringar"
2. **Day 7 reminder:**
   - If still unacknowledged after 7 days, send second reminder
   - Subject: "Viktigt: Lagändringar kräver din uppmärksamhet"
   - Body: Slightly more urgent tone + specific law names listed
3. **Weekly digest inclusion:**
   - Unacknowledged changes included in weekly industry digest email
   - CTA prominently displayed
4. Reminder emails track engagement (opens, clicks)
5. Users can disable reminders in settings (not recommended, show warning)

---

### Story 8.7: Implement Weekly Industry Digest Email

**As a** user,
**I want** to receive a weekly email with law changes relevant to my industry,
**so that** I discover changes to laws not yet in my list.

**Acceptance Criteria:**

1. Weekly digest sent Sundays at 18:00 CET
2. **Email content:**
   - Subject: "Veckans lagändringar för [Industry Name]"
   - Intro: "Här är vad som hände i veckans lagstiftning för [industry]"
   - Section 1: Changes to laws in workspace (from daily digest)
   - Section 2: Changes to industry starter pack laws NOT in workspace (discovery)
   - Section 3: "Nya lagar du kanske behöver" - AI recommendations
   - CTA: "Lägg till i min laglista"
3. Industry determined by workspace's SNI code (set during onboarding)
4. Email sent only if ≥1 change detected that week
5. Users can opt out in settings
6. A/B test subject lines for engagement

---

### Story 8.8: Implement AI Change Summaries

**As a** user,
**I want** to see plain-language summaries of law changes,
**so that** I understand the impact without reading legal jargon.

**Acceptance Criteria:**

1. When change detected, generate AI summary using GPT-4
2. Prompt: "Summarize this law change in 1-2 sentences for a business owner. Focus on practical impact. Old version: [text]. New version: [text]."
3. Summary stored in `law_changes.ai_summary`
4. Summary generation completes within 5 minutes of detection (NFR11)
5. Summaries displayed in:
   - Changes tab cards
   - Email notifications
   - Notification bell dropdown
   - Diff view modal
6. Hallucination check: If summary contains claims not in diff, regenerate
7. Fallback: If AI fails, show "Change detected. View details for more information."

---

### Story 8.9: Add Amendment Timeline Visualization (Notisum Competitive Parity)

**As a** user,
**I want** to see a complete amendment history timeline for each law with rich metadata,
**so that** I understand how the law has evolved and can track regulatory changes over time.

**Competitive Context:** Notisum provides amendment timelines with 7 data points per amendment (see `docs/notisum-amendment-competitive-analysis.md`). This story implements **feature parity + automation advantages**.

**Acceptance Criteria:**

1. Individual Law Page → "Change History" tab (replace placeholder from Epic 2.6)
2. **Amendment Timeline Component** displays all historical amendments chronologically (newest first)
3. **Each amendment card shows all 7 fields** (competitive requirement):
   - **SFS Number** (clickable link to amending law): "SFS 2025:732"
   - **Publication Date**: "2025-06-24"
   - **Full Title**: "Lag (2025:732) om ändring i arbetsmiljölagen (1977:1160)"
   - **Affected Sections** (Notisum format): "ändr. 6 kap. 17 §; upph. 8 kap. 4 §"
   - **Summary** (2-3 sentences, GPT-4 generated): "Gränsen för att företrädas av elevskyddsombud höjs..."
   - **Effective Date** (with future indicator): "2028-07-01" + badge "Framtida"
   - **User Comments** (workspace-specific): Expandable text area for team notes
4. **Visual Design** (inspired by Notisum, enhanced):
   - Border-left-4 with blue accent
   - Collapsible cards (click to expand full details)
   - Color coding: Green (new sections), Yellow (amended), Red (repealed)
   - Mobile-responsive (stack fields vertically on <768px)
5. **Contextual Help** explaining Swedish legal notation:
   - Tooltip on "ändr." → "Amended sections"
   - Tooltip on "upph." → "Repealed sections"
   - Tooltip on "nya" → "New sections added"
   - Tooltip on "betecknas" → "Section renumbered"
6. **Data Source Indicator**: Badge showing source (Riksdagen parsing, Lagen.nu, SFSR)
7. **Link to Amending Law**: Click SFS number → Opens amending law detail page
8. **Link to Official PDF**: "View Riksdagen PDF" button → Opens Notisum-hosted PDF or Riksdagen URL
9. **Empty State** (if no amendments): "This law has not been amended since publication."
10. **Loading State**: Skeleton cards while fetching 90K+ amendment records
11. **Performance**: Timeline loads <500ms for laws with <50 amendments (90% of cases)
12. **Verification**: Arbetsmiljölagen (1977:1160) displays all 77 amendments matching Notisum data

**Competitive Advantages Beyond Notisum:**
- ✅ **Automated Updates**: Nightly cron detects new amendments (Notisum requires manual updates)
- ✅ **AI Summaries**: GPT-4 generated vs. manually written
- ✅ **Workspace Comments**: Team collaboration (Notisum lacks this)
- ✅ **Cross-Law Navigation**: Click SFS number → View amending law immediately

**Reference Implementation:** See `docs/historical-amendment-tracking-strategy.md` Section 12.7 for React component code.

---

### Story 8.10: Implement Effective Date Tracking and Source Links

**As a** user,
**I want** to see when a law change takes effect and access source documents,
**so that** I plan compliance timelines.

**Acceptance Criteria:**

1. Riksdagen API provides effective date and source proposition link
2. `law_changes` table stores: `effective_date`, `source_url`
3. Diff view modal displays:
   - Detected date: "Ändringen upptäckt 2025-01-10"
   - Effective date: "Träder i kraft 2025-03-01"
   - Time until effective: "60 days from now" (if future)
   - Source link: "Läs proposition [link to Riksdagen]"
4. Changes tab shows effective date badge: "Effective in 30 days" (amber), "Effective today" (red), "Effective 10 days ago" (green)
5. Sort changes by effective date (prioritize upcoming)

---

### Story 8.11: Implement Change Notification Preferences

**As a** user,
**I want** to customize which change notifications I receive,
**so that** I'm not overwhelmed.

**Acceptance Criteria:**

1. Workspace Settings → Notifications tab
2. **Email preferences:**
   - Daily digest: On/Off
   - Weekly industry digest: On/Off
   - Reminder emails: On/Off (after 3 days, after 7 days)
   - Frequency: Instant, Daily, Weekly, Off
3. **In-app preferences:**
   - Notification bell: On/Off
   - Desktop notifications (browser push): On/Off
4. **Change type filters:**
   - Amendments: On/Off
   - New sections: On/Off
   - Repeals: On/Off
   - Metadata changes: On/Off
5. Preferences saved per user (not per workspace)
6. Default: All notifications enabled

---

### Story 8.12: Optimize Change Detection Performance

**As a** product owner,
**I want** to ensure change detection cron job completes within 2 hours,
**so that** notifications are timely.

**Acceptance Criteria:**

1. Daily cron job (from Epic 2.8) optimized:
   - Parallel processing: Process 10 laws concurrently
   - Incremental hashing: Compare checksums before full diff (skip unchanged)
   - Rate limiting: Respect Riksdagen API limits (10 req/sec)
2. Job completion time monitored (target <2 hours per NFR10)
3. Error handling: Retry failed law fetches, log errors to Sentry
4. Progress tracking: Log "Processed 5,000/10,000 laws (50%)"
5. Alerting: Email founder if job fails or exceeds 3 hours
6. Performance dashboard: Job runtime trend (daily chart)
7. Optimization: Cache frequently accessed laws, skip rarely changed laws

---

**Epic 8 Complete: 12 stories, 3-4 weeks estimated**

---

**ALL EPICS COMPLETE (Epics 2-8): Total 76 stories, 22-28 weeks estimated**

**End of PRD Epic Details**

---


## Next Steps

This PRD is now complete and ready for handoff to specialized roles. The following prompts should be used to initiate the next phases of the project.

---

### UX Expert Handoff Prompt

**Prompt for UX Expert/Designer:**

```
I need you to create a comprehensive design system and UI/UX specifications for Laglig.se based on the attached PRD (docs/prd.md).

CONTEXT:
- Product: Swedish legal compliance SaaS platform
- Design Philosophy: "Coolt med koll" - Minimalist, OpenAI-inspired aesthetic
- Target Users: SMB owners, HR managers, ISO compliance consultants
- Key Interactions: Drag-and-drop context building, streaming AI responses, Kanban compliance tracking

YOUR DELIVERABLES:

1. **Design System Specification**
   - Complete Tailwind config with color tokens, typography scale, spacing system
   - Component library based on shadcn/ui (buttons, badges, cards, forms, modals)
   - Icon library selection and usage guidelines
   - Animation and transition standards

2. **High-Fidelity Mockups** (Priority Screens)
   - Homepage with dynamic onboarding widget (streaming law list generation)
   - Dashboard summary view (compliance progress ring, AI insights, activity feed)
   - Kanban compliance workspace (5 columns, draggable law cards)
   - AI Chat sidebar (with context pills, streaming responses, inline citations)
   - Individual law page (4 tabs: Overview, Content, Change History, Notes)
   - HR Module - Employee list (table/card toggle views)
   - Changes tab (GitHub-style diff view)

3. **Interaction Design Specifications**
   - Drag-and-drop states and animations (law cards → chat, Kanban movements)
   - Streaming UI patterns (law list generation, AI responses, component streaming)
   - Mobile responsive breakpoints and adaptations
   - Error states and loading states
   - Empty states and onboarding flows

4. **Accessibility Guidelines**
   - WCAG AA compliance checklist
   - Keyboard navigation maps
   - Screen reader annotations
   - Color contrast validation

REFERENCE MATERIALS IN PRD:
- Section "User Interface Design Goals" (lines 247-496) contains full UX vision
- Section "Key Interaction Paradigms" details 5 core interactions
- Section "Branding" specifies color palette, typography, design inspiration

DELIVERABLE FORMAT:
- Figma file with all screens, components, and design tokens
- Design handoff document (Markdown) with implementation notes for developers
- Component usage examples and documentation

Please confirm you understand the requirements and are ready to proceed.
```

---

### Architect Handoff Prompt

**Prompt for Technical Architect:**

```
I need you to create a comprehensive technical architecture specification for Laglig.se based on the attached PRD (docs/prd.md).

CONTEXT:
- Product: Swedish legal compliance SaaS with AI-powered chatbot
- Stack: Next.js 14 (App Router), Supabase PostgreSQL + pgvector, OpenAI/Anthropic, Vercel deployment
- Constraints: Bootstrap-funded, solo founder, 4-6 month MVP timeline
- Scale Target: 10,000 concurrent users, 10,000+ laws, 50k-100k vector embeddings

YOUR DELIVERABLES:

1. **System Architecture Document**
   - High-level architecture diagram (Next.js app, Supabase, external APIs, Vercel infrastructure)
   - Data flow diagrams for critical paths (RAG query, change detection, onboarding)
   - Service boundaries and API contracts
   - Authentication and authorization architecture (Supabase Auth, RLS policies)
   - Multi-tenancy data isolation strategy

2. **Database Schema Design**
   - Complete Prisma schema with all tables, relationships, indexes
   - Tables: workspaces, users, workspace_members, legal_documents (polymorphic for all content types), court_cases, eu_documents, cross_references, amendments, document_subjects, law_embeddings, content_changes, employees, kollektivavtal, tasks, chat_messages, workspace_costs, activity_log
   - Row-Level Security (RLS) policies for multi-tenancy
   - Migration strategy (Prisma Migrate, CI/CD integration)
   - Data retention and GDPR compliance mechanisms

3. **Technical Risk Mitigation Plans**
   - **RAG Implementation:** Chunk size optimization, retrieval parameter tuning, hallucination detection strategy
   - **Multi-Source API Dependencies (Riksdagen, Domstolsverket, EUR-Lex):** Fallback/retry logic, caching strategy, rate limit handling
   - **Vector Database Scaling:** pgvector → Pinecone migration triggers, query performance monitoring
   - **Drag-and-Drop Performance:** State management approach, virtualization if needed, mobile touch handling
   - **Daily Multi-Content-Type Change Detection:** Job architecture (BullMQ queue?), checkpoint/resume mechanism, parallel processing design
   - **Multi-Tenancy Security:** RLS policy testing, penetration testing plan, data isolation verification

4. **API Specification**
   - RESTful API endpoints for all features (or Next.js API routes documentation)
   - Request/response schemas (Zod validation)
   - Error handling and status codes
   - Rate limiting strategy per tier
   - Webhook handling (Stripe, future integrations)

5. **AI/RAG Pipeline Architecture**
   - Vector embedding generation workflow (OpenAI text-embedding-3-small)
   - Semantic chunking implementation (500-800 tokens)
   - RAG query pipeline (embedding → similarity search → LLM prompt construction)
   - Caching strategy (Redis/Vercel KV for responses)
   - Citation extraction and verification
   - Cost optimization strategies (NFR18 - unit economics tracking)

6. **CI/CD & Deployment Strategy**
   - GitHub Actions workflows (test, build, deploy)
   - Vercel deployment configuration
   - Environment management (dev, staging, production)
   - Database migration automation
   - Monitoring and alerting setup (Sentry, Vercel Analytics)

7. **Testing Strategy**
   - Unit testing approach (Vitest + React Testing Library)
   - Integration testing (Playwright/Cypress for critical paths)
   - Security testing (RLS policy validation, penetration tests)
   - Performance testing (load testing for 10k concurrent users)

CRITICAL REQUIREMENTS FROM PRD:
- NFR1: Core Web Vitals (LCP <2.5s, FID <100ms, CLS <0.1)
- NFR2: AI response time <3 seconds
- NFR4: Encrypted personnummer (AES-256)
- NFR10: Change detection completes in <2 hours
- NFR18: Unit economics tracking (>80% gross margin target)
- FR41: Fortnox schema compatibility (future integration)

REFERENCE MATERIALS IN PRD:
- Section "Technical Assumptions" (lines 509-677) defines full stack
- Section "Technical Risk Areas" (lines 678-866) flags 6 high-complexity areas
- Section "Requirements" (lines 111-246) contains 41 FR + 26 NFR
- All 86 user stories (lines 967-2878) contain implementation acceptance criteria

DELIVERABLE FORMAT:
- Architecture Decision Records (ADRs) for key technical choices
- Technical specification document (Markdown) with diagrams
- Database schema (Prisma schema file)
- API documentation (OpenAPI/Swagger or detailed Markdown)
- Risk mitigation implementation plans

Please confirm you understand the requirements and are ready to proceed.
```

---

### Recommended Next Actions

After UX and Architecture phases complete:

1. **Epic 1 Sprint Planning** - Break Epic 1 stories into implementable tasks
2. **Development Environment Setup** - Initialize Next.js project, Supabase project, Vercel deployment
3. **Begin Implementation** - Start with Story 1.1 (Initialize Next.js 14 Project)

**Estimated Timeline:**
- UX Design Phase: 2-3 weeks
- Architecture Phase: 2 weeks (can overlap with UX)
- Development (8 Epics): 16-22 weeks
- **Total: 20-27 weeks (~5-7 months)**

---
## Document Completion Status

**Document Version:** 1.1 (Complete - Ready for Architect)
**Last Updated:** 2025-11-01
**Completion:** 100% (All sections and epic details complete)

**Total Epic Summary:**
- Epic 1: Foundation & Core Infrastructure (10 stories, 3-4 weeks)
- Epic 2: Legal Content Foundation (11 stories, 4-5 weeks)
- Epic 3: RAG-Powered AI Chat Interface (12 stories, 3-4 weeks)
- Epic 4: Dynamic Onboarding & Personalized Law Lists (10 stories, 3-4 weeks)
- Epic 5: Workspace Management & Team Collaboration (12 stories, 3-4 weeks)
- Epic 6: Compliance Workspace (Kanban + Dashboard) (10 stories, 2-3 weeks)
- Epic 7: HR Module (Employee Management) (12 stories, 3-4 weeks)
- Epic 8: Change Monitoring & Notification System (12 stories, 3-4 weeks)

**TOTAL: 89 stories across 8 epics, estimated 24-30 weeks (5.5-7 months)**

**Next Steps:**
1. Architect review and technical design
2. Database schema design
3. API specification
4. UI/UX design handoff
5. Sprint planning and story breakdown

---

**End of PRD**
