# Technical Assumptions

## Repository Structure: Monorepo

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

## Service Architecture: Monolith (Serverless Functions)

**Decision:** Next.js monolith deployed to Vercel with serverless functions

**Rationale:**

- MVP speed (single deployment)
- Vercel optimization
- Cost efficiency
- Solo founder friendly

**Architecture:** Next.js App (SSR + React) + API Routes (serverless) + Cron Jobs + External Services (Supabase, OpenAI, Stripe, Email, Riksdagen API, Bolagsverket API)

---

## Testing Requirements: Unit + Integration

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

## Frontend Stack

**Framework:** Next.js 14+ (App Router)

**UI Libraries:**

- shadcn/ui (Radix UI + Tailwind)
- Tailwind CSS
- @dnd-kit or react-beautiful-dnd
- React Hook Form + Zod
- Zustand (state management)
- TanStack Query (data fetching)

---

## Backend Stack

**Database:** Supabase PostgreSQL (with pgvector extension)

**ORM:** Prisma

**Authentication:** Supabase Auth + NextAuth.js (hybrid)

---

## AI Stack

**LLM Provider:** OpenAI (GPT-4) OR Anthropic (Claude 3.5 Sonnet)

**Embeddings:** OpenAI text-embedding-3-small

**Vector Database:** PostgreSQL with pgvector (via Supabase)

**Semantic Chunking:** LangChain or custom implementation (500-800 tokens/chunk)

**RAG Framework:** Vercel AI SDK + custom RAG

---

## Email System

**Provider:** Resend (recommended) OR SendGrid OR Loops

**Template Management:** React Email

**Email Types:**

- Transactional (signup, password reset, invites)
- Marketing (newsletter, digests, updates)
- Notifications (law changes, reminders)

---

## Monitoring & Observability

**Error Tracking:** Sentry

**Analytics:** Vercel Analytics + PostHog (optional)

**Logging:** Vercel logs + structured JSON

---

## CI/CD & Deployment

**Hosting:** Vercel

**CI/CD Pipeline:** GitHub Actions (Prettier, ESLint, TypeScript, tests)

**Database Migrations:** Prisma migrations via Vercel build step

**Secrets Management:** Vercel Environment Variables

---

## Security & Compliance

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

## Technical Risk Areas Requiring Architect Deep-Dive

The following areas involve significant technical complexity or external dependencies that require careful architectural investigation during implementation planning:

### 1. RAG Implementation & Accuracy Tuning

**Complexity:** High - Core product differentiator with quality-critical requirements

**Key Challenges:**

- **Chunk size optimization:** Specified as 500-800 tokens (NFR24), but optimal size varies by law structure. May require experimentation.
- **Retrieval parameters:** Top-k value, similarity threshold, reranking strategies need tuning for Swedish legal text.
- **Embedding model selection:** `text-embedding-3-small` chosen for cost, but accuracy vs. `text-embedding-3-large` should be validated.
- **Hallucination minimization:** Target <5% hallucination rate (NFR9). Requires robust grounding mechanism and citation verification.

**Architect Action:** Design RAG pipeline with configurable parameters. Plan A/B testing framework for tuning post-launch.

---

### 2. Multi-Source API Dependencies (Riksdagen, Domstolsverket, EUR-Lex) & Reliability

**Complexity:** Medium - Critical external dependency for change detection

**Key Challenges:**

- **API reliability unknown:** No SLA from Riksdagen. What if API down during daily cron job (NFR10)?
- **Rate limiting:** Specified as 10 req/sec (Story 2.1), but actual limits may differ. Risk of job timeout if throttled.
- **API schema changes:** Government APIs can change without notice. Need versioning strategy.
- **Data completeness:** API may not provide all law metadata (effective dates, source propositions). Requires fallback.

**Architect Action:** Design fallback strategy (cache last known state, retry logic, alerting). Consider scraping as backup if API unreliable.

---

### 3. Vector Database Scaling Triggers

**Complexity:** Medium - Performance and cost implications at scale

**Key Challenges:**

- **pgvector vs. Pinecone decision:** NFR17 specifies migration at 100k queries/day, but query performance may degrade earlier with 100k+ embeddings.
- **Index optimization:** HNSW vs. IVFFlat trade-offs not evaluated. Wrong choice impacts query latency.
- **Storage costs:** 100k chunks × 1536 dimensions = significant storage. Cost projections needed.
- **Query latency at scale:** Target <3s response time (NFR2) must hold at 10k concurrent users (NFR7).

**Architect Action:** Establish monitoring for query latency and storage size. Define migration triggers with buffer (e.g., migrate at 70k queries/day, not 100k).

---

### 4. Real-Time Drag-and-Drop Performance

**Complexity:** Medium - UX-critical interaction with many moving parts

**Key Challenges:**

- **Performance with 100+ law cards:** Drag-and-drop libraries (@dnd-kit, react-beautiful-dnd) may struggle with large card counts.
- **State management:** Dragging across components (Kanban → Chat) requires global state. Zustand vs. Jotai vs. React Context?
- **Mobile touch optimization:** Different interaction model than desktop drag. Needs separate implementation path.
- **Optimistic updates:** NFR requirement (Story 6.5) - rollback strategy if API fails?

**Architect Action:** Prototype drag-and-drop with 200 mock cards. Measure FPS and consider virtualization if performance issues.

---

### 5. Daily Multi-Content-Type Change Detection at Scale

**Complexity:** High - Cron job processing 10k+ laws with AI generation

**Key Challenges:**

- **Job completion time:** Target <2 hours (NFR10) to process 10k laws. At 10 req/sec = 1,000 seconds (16 min) just for fetching. Diffing + AI summary generation adds significant time.
- **Parallel processing:** Need concurrency (Story 8.12 specifies 10 parallel) but must respect API rate limits.
- **AI summary generation latency:** Target <5 min per change (NFR11), but GPT-4 can be slow. Need batching strategy.
- **Error handling:** If job fails at law 7,000, how do we resume? Need checkpoint mechanism.

**Architect Action:** Design job with checkpoint/resume capability. Consider queueing system (BullMQ) for reliable processing. Monitor job runtime and optimize bottlenecks.

---

### 6. Multi-Tenancy Data Isolation

**Complexity:** Medium-High - Security-critical for GDPR compliance

**Key Challenges:**

- **Row-Level Security (RLS):** Supabase RLS policies must be airtight. One misconfigured policy = data breach.
- **Query performance:** RLS adds overhead. Ensure indexes on workspace_id don't degrade performance.
- **Testing isolation:** How do we test that User A can't access User B's data? Need automated security tests.

**Architect Action:** Comprehensive RLS policy review. Automated tests for multi-tenancy isolation. Penetration testing before launch.

---

**Summary:** These 6 risk areas should be prioritized for prototyping and architectural planning. Each has potential to block MVP launch if not addressed early.

---
