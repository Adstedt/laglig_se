# Requirements

## Functional Requirements

**FR1:** The system SHALL provide public access to 170,000+ legal documents (Swedish laws/SFS, Swedish court cases from HD/HovR/HFD, EU regulations, EU directives) via server-side rendered pages optimized for SEO, with no authentication required for viewing legal content.

**FR2:** The system SHALL implement a dynamic onboarding flow that collects company org-number, scrapes Bolagsverket data, asks 3-5 AI-selected contextual questions based on industry and company size, and generates a personalized law list via streaming AI in two phases: Phase 1 (15-30 high-priority laws pre-signup in <3 minutes) and Phase 2 (remaining 45-65 laws post-signup in <60 seconds background generation) for comprehensive 60-80 law coverage.

**FR3:** The system SHALL generate personalized law lists containing 60-80 laws with AI-powered contextual commentary explaining what each law means specifically for the user's business (industry, size, employee count, contextual answers from dynamic questions), categorized into Grundläggande, Arbetsmiljö, Branschspecifika, GDPR & Data, Ekonomi, Miljö, and Övrigt groups.

**FR4:** The system SHALL provide a RAG-powered AI chatbot that answers legal questions using ONLY verified legal sources (SFS laws, Swedish court cases from HD/HovR/HFD, EU regulations/directives, kollektivavtal) with mandatory inline citations, minimizing hallucinations through strict RAG grounding.

**FR5:** The system SHALL support drag-and-drop of law cards, employee cards, task cards, and files into the AI chat interface to build contextual queries.

**FR6:** The AI chatbot SHALL stream components (law cards, task suggestions) back to the frontend based on conversation context, enabling intelligent workflow automation.

**FR7:** The system SHALL provide a compliance workflow system with: (a) Law List as the primary compliance view displaying list items with manual compliance status (Ej påbörjad, Pågående, Klar, Ej tillämpbar), responsible person assignment, task progress indicators, and due dates; (b) Legal Document Modal (Jira-style two-panel: 60% scrollable left, 40% static right) containing AI summary, contextual commentary, related documents, task list, evidence gallery, activity log, and collapsible legal text; (c) Task Workspace with customizable Kanban columns (default: Att göra, Pågående, Klar; user-configurable up to 8 columns) plus List, Calendar, and Summary views; (d) Task Modal (same two-panel layout) for task details, assignees, due dates, evidence uploads, and threaded comments; supporting multi-list scenarios where the same legal document can appear on different lists with independent compliance tracking per list item.

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

## Non-Functional Requirements

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
